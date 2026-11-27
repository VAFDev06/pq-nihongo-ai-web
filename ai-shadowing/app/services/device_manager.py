"""Device selection, 4GB GPU low-VRAM offload manager, and serialized GPU execution lock."""
from contextlib import contextmanager
import gc
import logging
import threading
from typing import Iterator, Optional

import torch

from app.config.settings import Settings

logger = logging.getLogger(__name__)


class DeviceManager:
    """Manages CPU/CUDA selection and sequential low-VRAM GPU execution.

    On GPUs with <= 6 GB VRAM (such as RTX 3050 Ti 4 GB), holding both Qwen3-ASR-0.6B (~1.6 GB)
    and Qwen3-ForcedAligner-0.6B (~1.85 GB) resident on VRAM simultaneously risks CUDA OOM.
    In low-VRAM mode, models stay cached in host RAM and are moved onto GPU one at a time
    under a mutex lock, with automatic CPU fallback if CUDA OOM occurs.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.cuda_available = torch.cuda.is_available()
        self.gpu_name: Optional[str] = None
        self.gpu_vram_mb: Optional[int] = None
        if self.cuda_available:
            try:
                props = torch.cuda.get_device_properties(0)
                self.gpu_name = props.name
                self.gpu_vram_mb = int(props.total_memory // (1024 * 1024))
            except Exception as exc:
                logger.warning("CUDA detected but device inspection failed: %s", exc)
                self.cuda_available = False

        if settings.shadowing_device == "cpu":
            self.target_device = "cpu"
        elif settings.shadowing_device == "cuda":
            if self.cuda_available:
                self.target_device = "cuda:0"
            else:
                logger.warning("SHADOWING_DEVICE=cuda requested but CUDA unavailable; falling back to cpu")
                self.target_device = "cpu"
        else:
            self.target_device = "cuda:0" if self.cuda_available else "cpu"

        if settings.shadowing_low_vram_mode == "true":
            self.low_vram_mode = self.target_device.startswith("cuda")
        elif settings.shadowing_low_vram_mode == "false":
            self.low_vram_mode = False
        else:
            # Auto-enable sequential VRAM offload whenever GPU has <= 6144 MB total VRAM
            self.low_vram_mode = (
                self.target_device.startswith("cuda")
                and self.gpu_vram_mb is not None
                and self.gpu_vram_mb <= 6144
            )

        self._gpu_lock = threading.Lock()
        logger.info(
            "DeviceManager initialized: target_device=%s, cuda=%s, gpu=%s (%s MB), low_vram_mode=%s",
            self.target_device,
            self.cuda_available,
            self.gpu_name,
            self.gpu_vram_mb,
            self.low_vram_mode,
        )

    @property
    def preferred_dtype(self) -> torch.dtype:
        if self.target_device.startswith("cuda"):
            return torch.float16
        return torch.float32

    @contextmanager
    def acquire_model(self, wrapper: object, model_label: str) -> Iterator[str]:
        """Context manager ensuring safe sequential GPU access & low-VRAM offload.

        Yields the actual device string used ('cuda:0' or 'cpu').
        """
        with self._gpu_lock:
            torch_model = getattr(wrapper, "model", None)
            if not self.target_device.startswith("cuda") or torch_model is None:
                yield "cpu"
                return

            moved_to_gpu = False
            used_device = self.target_device
            try:
                if self.low_vram_mode:
                    torch_model.to(self.target_device)
                    if hasattr(wrapper, "device"):
                        setattr(wrapper, "device", torch.device(self.target_device))
                    moved_to_gpu = True
                yield used_device
            except torch.cuda.OutOfMemoryError:
                logger.warning("CUDA OOM while running %s; clearing cache and falling back to CPU", model_label)
                torch_model.to("cpu", dtype=torch.float32)
                if hasattr(wrapper, "device"):
                    setattr(wrapper, "device", torch.device("cpu"))
                if hasattr(wrapper, "dtype"):
                    setattr(wrapper, "dtype", torch.float32)
                gc.collect()
                torch.cuda.empty_cache()
                moved_to_gpu = False
                raise
            finally:
                if moved_to_gpu and self.low_vram_mode:
                    try:
                        torch_model.to("cpu")
                        if hasattr(wrapper, "device"):
                            setattr(wrapper, "device", torch.device("cpu"))
                    except Exception as exc:
                        logger.warning("Offloading %s back to CPU failed: %s", model_label, exc)
                    torch.cuda.empty_cache()
