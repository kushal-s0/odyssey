from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from collections.abc import Awaitable, Callable
from collections.abc import AsyncIterator
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.concurrency import run_in_threadpool

from .config import Settings, get_settings
from .contracts.schema import build_openapi
from .db.pool import Database
from .auth.jwt import TokenVerifier
from .routes.auth import router as auth_router
from .routes.uploads import router as uploads_router
from .routes.submissions import router as submissions_router
from .routes.jobs import router as jobs_router
from .routes.internal_jobs import router as internal_jobs_router
from .routes.assessments import router as assessments_router
from .services.jobs import Jobs
from .worker.gradio import activity
from .services.storage import StorageUnavailable

logger = logging.getLogger("udyam.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()

    @asynccontextmanager
    async def lifespan(instance: FastAPI) -> AsyncIterator[None]:
        instance.state.database = None
        database = None
        if config.database_url and config.database_url.get_secret_value():
            database = Database(config)
            try:
                await run_in_threadpool(database.open)
                instance.state.database = database
                await run_in_threadpool(activity, Jobs(database, config))
            except Exception as error:
                logger.error("database_startup_failed error_type=%s", type(error).__name__)
                instance.state.database = None
                database.close()
                database = None
        try:
            yield
        finally:
            if database:
                database.close()

    application = FastAPI(title="Udyam Saathi API", version=config.app_version,
                          docs_url="/docs" if config.app_env != "production" else None, lifespan=lifespan)
    application.state.settings = config
    application.state.token_verifier = TokenVerifier(config)
    application.include_router(auth_router)
    application.include_router(uploads_router)
    application.include_router(submissions_router)
    application.include_router(jobs_router)
    application.include_router(internal_jobs_router)
    application.include_router(assessments_router)
    application.add_middleware(CORSMiddleware, allow_origins=config.cors_origins,
                               allow_credentials=False, allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                               allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"])

    @application.middleware("http")
    async def request_context(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request.state.request_id = str(uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        logger.info("request id=%s method=%s status=%s elapsed_ms=%.1f", request.state.request_id,
                    request.method, response.status_code, (time.perf_counter() - started) * 1000)
        return response

    def failure(request: Request, status: int, code: str, message: str, retryable: bool = False) -> JSONResponse:
        return JSONResponse(status_code=status, content={"code": code, "message": message,
                             "retryable": retryable, "request_id": request.state.request_id})

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        # Route code must never put provider errors, source text or credentials in detail.
        message = exc.detail if isinstance(exc.detail, str) else "Request could not be completed"
        return failure(request, exc.status_code, f"http_{exc.status_code}", message, exc.status_code >= 500)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return failure(request, 422, "invalid_request", "Check the request fields and supported input limits")

    @application.exception_handler(StorageUnavailable)
    async def storage_error(request: Request, exc: StorageUnavailable) -> JSONResponse:
        return failure(request, 503, 'storage_unavailable', 'Private file storage is unavailable; retry shortly', True)

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error("request_failed id=%s error_type=%s", request.state.request_id, type(exc).__name__)
        return failure(request, 500, "internal_error", "The request failed; retry or contact your assessor", True)

    @application.get("/health/live", tags=["health"])
    def live() -> dict[str, str]:
        return {"status": "ok", "version": config.app_version}

    @application.get("/health/ready", tags=["health"])
    def ready(request: Request) -> JSONResponse:
        # A configured address is not evidence of database/auth/model connectivity.
        database = getattr(request.app.state, "database", None)
        database_status = "ready" if database and database.ready() else "unavailable"
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": {
            "database": database_status, "storage": "not_verified", "models": "not_verified"}})

    application.openapi = lambda: build_openapi(application)  # type: ignore[method-assign]
    return application


app = create_app()
