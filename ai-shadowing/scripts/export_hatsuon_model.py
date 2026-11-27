"""One-time helper to export the hatsuon ONNX acoustic model into HATSUON_MODEL_DIR."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / ".cache" / "hatsuon"
DEFAULT_HF = ROOT / ".cache" / "huggingface"


def main() -> int:
    out_dir = Path(os.environ.get("HATSUON_MODEL_DIR", str(DEFAULT_OUT)))
    hf_dir = Path(os.environ.get("HF_HOME", str(DEFAULT_HF)))
    out_dir.mkdir(parents=True, exist_ok=True)
    hf_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["HF_HOME"] = str(hf_dir)
    env["HATSUON_MODEL_DIR"] = str(out_dir)

    model_file = out_dir / "model.onnx"
    if model_file.exists():
        print(f"hatsuon acoustic model already exported at: {model_file}")
        return 0

    print(f"Exporting hatsuon ONNX int8 model to {out_dir} ...")
    cmd = [sys.executable, "-m", "hatsuon.export", "--out", str(out_dir)]
    # Fallback to hatsuon-export console script if module execution isn't exposed
    res = subprocess.run(cmd, env=env)
    if res.returncode != 0:
        exe_name = "hatsuon-export.exe" if os.name == "nt" else "hatsuon-export"
        script_path = Path(sys.executable).parent / exe_name
        res = subprocess.run([str(script_path), "--out", str(out_dir)], env=env)
    return res.returncode


if __name__ == "__main__":
    raise SystemExit(main())
