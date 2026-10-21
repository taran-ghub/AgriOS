import os

from fastapi import HTTPException, Request, Response

from backend.app.services.auth import SESSION_LIFETIME

COOKIE_NAME = "agrios_session"
COOKIE_PATH = "/api"

IS_PRODUCTION = os.environ.get("APP_ENV", "development") == "production"

configured_origins = os.environ.get("APP_ORIGINS", "")

if IS_PRODUCTION and not configured_origins.strip():
    raise RuntimeError("APP_ORIGINS must be configured in production")

ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in (
        configured_origins
        or (
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "http://localhost:8000,"
            "http://127.0.0.1:8000"
        )
    ).split(",")
    if origin.strip()
}


def require_browser_origin(request: Request) -> None:
    origin = request.headers.get("origin")

    if origin is None or origin not in ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail="Request origin is not allowed",
        )


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path=COOKIE_PATH,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
