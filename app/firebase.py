"""Server-side Firebase actions that need the project's service-account key: today, turning a rejected account's
sign-in off in Firebase itself. The key is read from FIREBASE_ADMIN_CREDENTIALS (a file path), or from
secrets/firebase-admin.json; it is never committed and never reaches the apps. Without it these calls are skipped."""
import logging
import os
from pathlib import Path
from typing import Optional

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from .auth import PROJECT

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ["https://www.googleapis.com/auth/identitytoolkit", "https://www.googleapis.com/auth/cloud-platform"]
log = logging.getLogger(__name__)

_creds: Optional[service_account.Credentials] = None


def _credentials() -> Optional[service_account.Credentials]:
    global _creds
    if _creds is None:
        path = Path(os.getenv("FIREBASE_ADMIN_CREDENTIALS") or ROOT / "secrets" / "firebase-admin.json")
        if not path.is_file():
            return None
        _creds = service_account.Credentials.from_service_account_file(str(path), scopes=SCOPES)
    if not _creds.valid:
        _creds.refresh(Request())
    return _creds


def _call(action: str, payload: dict) -> bool:
    creds = _credentials()
    if creds is None:
        return False
    try:
        r = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:{action}",
            headers={"Authorization": f"Bearer {creds.token}"}, json=payload, timeout=15,
        )
        r.raise_for_status()
        return True
    except requests.RequestException as e:
        log.warning("Firebase %s failed for %s: %s", action, payload.get("localId"), e)
        return False


def delete_user(uid: str) -> bool:
    """Removes the Firebase account itself, so the person's sign-in is gone too."""
    return _call("delete", {"localId": uid})


def set_disabled(uid: str, disabled: bool) -> bool:
    """Turns an account's Firebase sign-in off or back on. False when no key is configured or Firebase refused."""
    return _call("update", {"localId": uid, "disableUser": disabled})
