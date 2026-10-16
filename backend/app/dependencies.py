from typing import Annotated

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app import models
from backend.app.browser_security import (
    COOKIE_NAME,
    require_browser_origin,
)
from backend.app.database import get_db
from backend.app.services.auth import get_user_for_token


bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]

BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(bearer),
]


def get_current_user(
    request: Request,
    credentials: BearerCredentials,
    session: DbSession,
) -> models.User:
    if credentials is not None:
        # Explicit API tokens remain supported for API clients and tests.
        token = credentials.credentials
    else:
        token = request.cookies.get(COOKIE_NAME)

        if token and request.method not in {"GET", "HEAD", "OPTIONS"}:
            require_browser_origin(request)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_for_token(session, token)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Session is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


CurrentUser = Annotated[models.User, Depends(get_current_user)]