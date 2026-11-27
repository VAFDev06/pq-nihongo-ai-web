"""PQ Nihongo — Private Shadowing AI Model Server entrypoint.

Internal-only FastAPI service called by the Spring Boot backend.
Do not expose directly to public browser traffic.
"""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import alignment, asr, health, intonation, pronunciation, shadowing
from app.config.settings import get_settings
from app.container import get_container
from app.services.audio_preprocessor import AudioValidationError


def _configure_logging(level_name: str) -> None:
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _configure_logging(settings.log_level)
    container = get_container()
    container.preload_if_configured()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="PQ Nihongo — Private Shadowing AI Model Server",
        description="Local Japanese ASR, Forced Alignment, Pronunciation Scoring (hatsuon) and Experimental F0 Intonation.",
        version="1.0.0",
        lifespan=lifespan,
    )

    @app.exception_handler(AudioValidationError)
    async def audio_validation_exception_handler(request: Request, exc: AudioValidationError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message},
        )

    app.include_router(health.router)
    app.include_router(asr.router)
    app.include_router(alignment.router)
    app.include_router(pronunciation.router)
    app.include_router(intonation.router)
    app.include_router(shadowing.router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.shadowing_host,
        port=settings.shadowing_port,
        workers=settings.shadowing_workers,
        log_level=settings.log_level.lower(),
    )
