import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import NGO, User

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Crypto helpers ────────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRE_MINUTES
    )
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


# ── Shared dependency: get_current_user ───────────────────────────────────────
def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode Bearer JWT and return the authenticated User, or raise 401."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: Optional[str] = payload.get("user_id")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    user = db.query(User).filter(User.user_id == uuid.UUID(user_id)).first()
    if user is None:
        raise exc
    return user


# ── Dependency factory: require_role ─────────────────────────────────────────
def require_role(*allowed_roles: str):
    """Return a FastAPI dependency that enforces one of the given roles.

    Usage::

        @router.post("/admin-only")
        def admin_route(user = Depends(require_role("super_admin"))):
            ...
    """
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {list(allowed_roles)}",
            )
        return current_user

    return dependency


# ── Request schemas ───────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str  # "donor" | "ngo_admin"
    ngo_name: Optional[str] = None
    registration_number: Optional[str] = None
    category: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ApproveNGORequest(BaseModel):
    ngo_id: str


# ── POST /auth/register ───────────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role not in ("donor", "ngo_admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be 'donor' or 'ngo_admin'",
        )

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    ngo_id = None

    if payload.role == "ngo_admin":
        if not all([payload.ngo_name, payload.registration_number, payload.category]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ngo_name, registration_number, and category are required for ngo_admin",
            )
        # Check registration number uniqueness before creating
        if db.query(NGO).filter(
            NGO.registration_number == payload.registration_number
        ).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An NGO with this registration number already exists",
            )
        ngo = NGO(
            name=payload.ngo_name,
            registration_number=payload.registration_number,
            category=payload.category,
            approved=False,
        )
        db.add(ngo)
        db.flush()  # populate ngo.ngo_id before creating the user
        ngo_id = ngo.ngo_id

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        ngo_id=ngo_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Registration successful", "user_id": str(user.user_id)}


# ── POST /auth/login ──────────────────────────────────────────────────────────
@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.role == "ngo_admin" and user.ngo_id is not None:
        ngo = db.query(NGO).filter(NGO.ngo_id == user.ngo_id).first()
        if ngo and not ngo.approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="NGO not yet approved by admin",
            )

    token = create_access_token(
        {
            "user_id": str(user.user_id),
            "role": user.role,
            "ngo_id": str(user.ngo_id) if user.ngo_id else None,
        }
    )
    return {"access_token": token, "token_type": "bearer", "role": user.role}


# ── POST /auth/approve-ngo  (Super Admin only) ───────────────────────────────
@router.post("/approve-ngo")
def approve_ngo(
    payload: ApproveNGORequest,
    _: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    ngo = db.query(NGO).filter(NGO.ngo_id == uuid.UUID(payload.ngo_id)).first()
    if ngo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO not found",
        )
    ngo.approved = True
    db.commit()
    return {"message": "NGO approved successfully"}


# ── GET /auth/pending-ngos  (Super Admin only) ──────────────────────────────
@router.get("/pending-ngos")
def get_pending_ngos(
    _: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    ngos = db.query(NGO).filter(NGO.approved == False).all()  # noqa: E712
    return [
        {
            "ngo_id": str(n.ngo_id),
            "name": n.name,
            "registration_number": n.registration_number,
            "category": n.category,
        }
        for n in ngos
    ]


# ── GET /auth/me  (any authenticated user) ───────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": str(current_user.user_id),
        "email": current_user.email,
        "role": current_user.role,
        "ngo_id": str(current_user.ngo_id) if current_user.ngo_id else None,
        "created_at": current_user.created_at.isoformat(),
    }
