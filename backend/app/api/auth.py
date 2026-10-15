from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.app import models, schemas
from backend.app.dependencies import BearerCredentials, CurrentUser, DbSession
from backend.app.services.auth import (
    create_session,
    hash_password,
    revoke_session,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=schemas.AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: schemas.RegisterRequest, session: DbSession):
    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="An account already uses that email")

    token = create_session(session, user)
    return schemas.AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.AuthCredentials, session: DbSession):
    user = session.scalar(select(models.User).where(models.User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_session(session, user)
    return schemas.AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserRead)
def get_me(current_user: CurrentUser):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: BearerCredentials,
    current_user: CurrentUser,
    session: DbSession,
) -> Response:
    del current_user
    if credentials:
        revoke_session(session, credentials.credentials)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
