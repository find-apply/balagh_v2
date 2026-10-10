"""Accounts. Signing in happens in Firebase (Google, or email and password); the app sends the Firebase ID token
as `Authorization: Bearer <token>`, and the API checks it against Google's public keys. No service-account key is
needed for that: the token's signature, audience (the project id) and issuer are enough. Everything else stays
here: a signed-in user's history and ratings are kept under their account instead of under the device's id.
A new account waits for the admin's approval before its token is accepted anywhere but /me."""
import os
import time
from typing import Optional

import requests
from fastapi import Header, HTTPException
from google.auth import jwt
from pydantic import BaseModel

from . import store

PROJECT = os.getenv("FIREBASE_PROJECT_ID", "balagh-ecb5c")
CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

_certs: tuple[float, dict] | None = None
_verified: dict[str, tuple[float, "User"]] = {}


class User(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    provider: Optional[str] = None


def _keys() -> dict:
    """Google's signing certificates, kept for as long as Google says they stay valid."""
    global _certs
    now = time.time()
    if _certs and _certs[0] > now:
        return _certs[1]
    r = requests.get(CERTS_URL, timeout=10)
    r.raise_for_status()
    age = 3600
    for part in r.headers.get("cache-control", "").split(","):
        if part.strip().startswith("max-age="):
            age = int(part.strip()[8:])
    _certs = (now + age, r.json())
    return _certs[1]


def verify(token: str) -> Optional[User]:
    """The user a Firebase ID token belongs to, or None when it is not a valid token of this project."""
    now = time.time()
    hit = _verified.get(token)
    if hit and hit[0] > now:
        return hit[1]
    try:
        claims = jwt.decode(token, certs=_keys(), audience=PROJECT)
    except (ValueError, requests.RequestException):
        return None
    if claims.get("iss") != f"https://securetoken.google.com/{PROJECT}" or not claims.get("sub"):
        return None
    user = User(uid=claims["sub"], email=claims.get("email"), name=claims.get("name"), picture=claims.get("picture"),
                provider=(claims.get("firebase") or {}).get("sign_in_provider"))
    if len(_verified) > 5000:
        _verified.clear()
    _verified[token] = (min(float(claims.get("exp", now)), now + 3600), user)
    return user


def signed_in_user(authorization: Optional[str] = Header(default=None)) -> Optional[User]:
    """The signed-in user, if the request carries a valid token, whatever the account's review status."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return verify(authorization[7:].strip())


NOT_APPROVED = {
    "pending": "حسابك قيد المراجعة. سيُفعَّل بعد موافقة الإدارة.",
    "rejected": "لم يُقبل هذا الحساب. تواصل مع الإدارة.",
}


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[User]:
    """The signed-in user; None for a visitor without an account. An account the admin has not approved
    (or that never registered through /me) is refused outright, so its token opens nothing."""
    user = signed_in_user(authorization)
    if user is None:
        return None
    status = store.user_status(user.uid)
    if status != "approved":
        raise HTTPException(status_code=403, detail=NOT_APPROVED.get(status or "pending", NOT_APPROVED["pending"]))
    return user


def owner_key(user: Optional[User], client_id: Optional[str]) -> Optional[str]:
    """Whose history a request reads and writes: the account's when signed in, else this device's."""
    if user:
        return f"u:{user.uid}"
    return client_id[:64] if client_id else None
