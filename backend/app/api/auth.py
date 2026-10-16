from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.app import models, schemas
from backend.app.browser_security import (
    COOKIE_NAME,
    clear_session_cookie,
    require_browser_origin,
    set_session_cookie,
)
from backend.app.dependencies import (
    BearerCredentials,
    CurrentUser,
    DbSession,
)
from backend.app.services.auth import (
    create_session,
    hash_password,
    revoke_session,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["authentication"])


class BrowserAuthResponse(BaseModel):
    user: schemas.UserRead


def create_user(
    payload: schemas.RegisterRequest,
    session: DbSession,
) -> models.User:
    name = payload.name.strip()

    if len(name) < 2:
        raise HTTPException(
            status_code=422,
            detail="Name must contain at least two characters",
        )

    user = models.User(
        name=name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    session.add(user)

    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account already uses that email",
        ) from None

    return user


def authenticate_user(
    payload: schemas.AuthCredentials,
    session: DbSession,
) -> models.User:
    user = session.scalar(
        select(models.User).where(models.User.email == payload.email)
    )

    if user is None or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    return user


# Explicit bearer-token endpoints for API clients and existing tests.

@router.post(
    "/register",
    response_model=schemas.AuthResponse,
    status_code=201,
)
def register(
    payload: schemas.RegisterRequest,
    session: DbSession,
    response: Response,
):
    user = create_user(payload, session)
    token = create_session(session, user)
    response.headers["Cache-Control"] = "no-store"

    return schemas.AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(
    payload: schemas.AuthCredentials,
    session: DbSession,
    response: Response,
):
    user = authenticate_user(payload, session)
    token = create_session(session, user)
    response.headers["Cache-Control"] = "no-store"

    return schemas.AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserRead)
def get_me(current_user: CurrentUser, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return current_user


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    credentials: BearerCredentials,
    current_user: CurrentUser,
    session: DbSession,
):
    del current_user

    token = (
        credentials.credentials
        if credentials is not None
        else request.cookies.get(COOKIE_NAME)
    )

    if token:
        revoke_session(session, token)

    response = Response(status_code=204)
    clear_session_cookie(response)
    return response


# Browser endpoints return user information, never the session token.

@router.post(
    "/session/register",
    response_model=BrowserAuthResponse,
    status_code=201,
)
def browser_register(
    payload: schemas.RegisterRequest,
    request: Request,
    response: Response,
    session: DbSession,
):
    require_browser_origin(request)

    user = create_user(payload, session)
    token = create_session(session, user)

    previous_token = request.cookies.get(COOKIE_NAME)
    if previous_token:
        revoke_session(session, previous_token)

    set_session_cookie(response, token)
    return BrowserAuthResponse(user=user)


@router.post("/session/login", response_model=BrowserAuthResponse)
def browser_login(
    payload: schemas.AuthCredentials,
    request: Request,
    response: Response,
    session: DbSession,
):
    require_browser_origin(request)

    user = authenticate_user(payload, session)
    token = create_session(session, user)

    previous_token = request.cookies.get(COOKIE_NAME)
    if previous_token:
        revoke_session(session, previous_token)

    set_session_cookie(response, token)
    return BrowserAuthResponse(user=user)


@router.post("/session/logout", status_code=204)
def browser_logout(request: Request, session: DbSession):
    require_browser_origin(request)

    token = request.cookies.get(COOKIE_NAME)
    if token:
        revoke_session(session, token)

    response = Response(status_code=204)
    clear_session_cookie(response)
    return response