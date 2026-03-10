import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from models import Donation, NGO, User
from routes.auth import get_current_user, require_role
from services import impact_calculator, redis_service

router = APIRouter(prefix="/impact", tags=["impact"])


def _get_or_calculate(ngo_id: str, db: Session) -> tuple[dict, bool]:
    """Return (impact_data, cache_hit).  Populates cache on miss."""
    cached = redis_service.get_cached_impact(ngo_id)
    if cached is not None:
        return cached, True
    data = impact_calculator.calculate_impact_score(ngo_id, db)
    redis_service.set_cached_impact(ngo_id, data)
    return data, False


# ── GET /impact/donor/my  – must be defined BEFORE /{ngo_id} ────────────────────
# (FastAPI resolves literal path segments before parameterised ones)
@router.get("/donor/my")
def my_impact(
    current_user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    """Return per-NGO impact breakdown for the authenticated donor."""
    # Distinct NGOs this donor has contributed to
    ngo_ids = (
        db.query(Donation.ngo_id)
        .filter(Donation.donor_id == current_user.user_id)
        .distinct()
        .all()
    )

    result = []
    for (ngo_id_val,) in ngo_ids:
        ngo = db.query(NGO).filter(NGO.ngo_id == ngo_id_val).first()
        if ngo is None:
            continue

        # Total this donor gave to this NGO
        from sqlalchemy import func
        you_donated: float = (
            db.query(func.sum(Donation.amount))
            .filter(
                Donation.donor_id == current_user.user_id,
                Donation.ngo_id == ngo_id_val,
            )
            .scalar()
        ) or 0.0

        score_data, _ = _get_or_calculate(str(ngo_id_val), db)
        impact_score = score_data["impact_score"]
        reached_cause = round(you_donated * (impact_score / 100), 2)

        result.append({
            "ngo_id": str(ngo_id_val),
            "ngo_name": ngo.name,
            "you_donated": round(you_donated, 2),
            "reached_cause": reached_cause,
            "impact_score": impact_score,
            "grade": score_data["grade"],
        })

    return result


# ── GET /impact/all  (Public) ─────────────────────────────────────────────────
@router.get("/all")
def all_impact(db: Session = Depends(get_db)):
    """Return impact scores for all approved NGOs, sorted by score descending."""
    ngos = db.query(NGO).filter(NGO.approved == True).all()  # noqa: E712

    scores = []
    for ngo in ngos:
        data, _ = _get_or_calculate(str(ngo.ngo_id), db)
        scores.append({
            "ngo_id": str(ngo.ngo_id),
            "ngo_name": ngo.name,
            "category": ngo.category,
            **data,
        })

    scores.sort(key=lambda x: x["impact_score"], reverse=True)
    return scores


# ── GET /impact/{ngo_id}  (Public) ────────────────────────────────────────────
@router.get("/{ngo_id}")
def ngo_impact(ngo_id: str, response: Response, db: Session = Depends(get_db)):
    """Return the impact score for a single NGO, with X-Cache header."""
    try:
        uuid.UUID(ngo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ngo_id format.",
        )

    data, cache_hit = _get_or_calculate(ngo_id, db)
    response.headers["X-Cache"] = "HIT" if cache_hit else "MISS"
    return data
