import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.app import models

PASSWORD_ITERATIONS = 210_000
SESSION_LIFETIME = timedelta(days=7)


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${password_digest.hex()}"


def verify_password(password: str, encoded_password: str) -> bool:
    try:
        algorithm, iterations, salt_hex, expected_hex = encoded_password.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(actual.hex(), expected_hex)
    except (ValueError, TypeError):
        return False


def create_session(session: Session, user: models.User) -> str:
    token = secrets.token_urlsafe(32)
    auth_session = models.AuthSession(
        user=user,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        expires_at=_utc_now_naive() + SESSION_LIFETIME,
    )
    session.add(auth_session)
    session.commit()
    return token


def get_user_for_token(session: Session, token: str) -> models.User | None:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    auth_session = session.scalar(
        select(models.AuthSession)
        .where(
            models.AuthSession.token_hash == token_hash,
            models.AuthSession.expires_at > _utc_now_naive(),
        )
        .options(joinedload(models.AuthSession.user))
    )
    return auth_session.user if auth_session else None


def revoke_session(session: Session, token: str) -> None:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    auth_session = session.scalar(
        select(models.AuthSession).where(models.AuthSession.token_hash == token_hash)
    )
    if auth_session:
        session.delete(auth_session)
        session.commit()
