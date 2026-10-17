from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response

from .config import Settings, get_settings
from .contracts.schema import build_openapi

logger = logging.getLogger("udyam.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    application = FastAPI(title="Udyam Saathi API", version=config.app_version,
                          docs_url="/docs" if config.app_env != "production" else None)
    application.state.settings = config
    application.add_middleware(CORSMiddleware, allow_origins=config.cors_origins,
                               allow_credentials=False, allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
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

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error("request_failed id=%s error_type=%s", request.state.request_id, type(exc).__name__)
        return failure(request, 500, "internal_error", "The request failed; retry or contact your assessor", True)

    @application.get("/health/live", tags=["health"])
    def live() -> dict[str, str]:
        return {"status": "ok", "version": config.app_version}

    @application.get("/health/ready", tags=["health"])
    def ready() -> JSONResponse:
        # A configured address is not evidence of database/auth/model connectivity.
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": {
            "database": "not_verified", "storage": "not_verified", "models": "not_verified"}})

    application.openapi = lambda: build_openapi(application)  # type: ignore[method-assign]
    return application


app = create_app()
