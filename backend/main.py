import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import Base, SessionLocal, engine

# Import all models so SQLAlchemy registers them with Base.metadata
from models import AnomalyAlert, AuditLog, Donation, Expense, NGO, User  # noqa: F401

from routes import auth, donations, expenses, impact, anomaly

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created / verified.")

    db: Session = SessionLocal()
    try:
        existing = (
            db.query(User).filter(User.email == settings.SUPER_ADMIN_EMAIL).first()
        )
        if existing is None:
            admin = User(
                email=settings.SUPER_ADMIN_EMAIL,
                password_hash=_pwd_context.hash(settings.SUPER_ADMIN_PASSWORD),
                role="super_admin",
                ngo_id=None,
            )
            db.add(admin)
            db.commit()
            logger.info("Super admin created: %s", settings.SUPER_ADMIN_EMAIL)
        else:
            logger.info("Super admin already exists — skipping seed.")
    finally:
        db.close()

    yield  # application runs here

    # ── Shutdown (nothing to tear down) ──


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TraceTrust API",
    description="Transparent NGO donation ledger — donors see every rupee.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS (development — restrict origins in production) ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: replace with explicit origins before deploying
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(donations.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(impact.router, prefix="/api")
app.include_router(anomaly.router, prefix="/api")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
