"""Impact Score Engine for TraceTrust.

Calculates how effectively an NGO converts donations into programme spend.
"""
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Donation, Expense

_PROGRAM_CATEGORIES = {"food", "medicine", "education", "other"}
_OVERHEAD_CATEGORIES = {"salary", "admin"}


def _grade(impact_score: float) -> str:
    if impact_score >= 80:
        return "A"
    if impact_score >= 60:
        return "B"
    if impact_score >= 40:
        return "C"
    return "D"


def calculate_impact_score(ngo_id: str, db: Session) -> dict:
    """Compute and return the full impact-score payload for *ngo_id*.

    Does NOT touch Redis — callers are responsible for caching.
    """
    import uuid
    ngo_uuid = uuid.UUID(ngo_id)

    # 1. Total donations
    total_donated: float = (
        db.query(func.sum(Donation.amount))
        .filter(Donation.ngo_id == ngo_uuid)
        .scalar()
    ) or 0.0

    if total_donated == 0:
        return {
            "ngo_id": ngo_id,
            "impact_score": 0,
            "grade": "N/A",
            "total_donated": 0,
            "program_expenses": 0,
            "overhead_expenses": 0,
            "unaccounted": 0,
            "overhead_ratio": 0,
            "donor_count": 0,
            "last_calculated": datetime.now(timezone.utc).isoformat(),
            "message": "No donations recorded yet.",
        }

    # 2. Expense splits
    program_expenses: float = (
        db.query(func.sum(Expense.amount))
        .filter(
            Expense.ngo_id == ngo_uuid,
            Expense.category.in_(_PROGRAM_CATEGORIES),
        )
        .scalar()
    ) or 0.0

    overhead_expenses: float = (
        db.query(func.sum(Expense.amount))
        .filter(
            Expense.ngo_id == ngo_uuid,
            Expense.category.in_(_OVERHEAD_CATEGORIES),
        )
        .scalar()
    ) or 0.0

    # 3. Derived metrics
    impact_score = round((program_expenses / total_donated) * 100, 2)
    overhead_ratio = round((overhead_expenses / total_donated) * 100, 2)
    unaccounted = round(total_donated - program_expenses - overhead_expenses, 2)

    # 4. Donor count
    donor_count: int = (
        db.query(func.count(func.distinct(Donation.donor_id)))
        .filter(Donation.ngo_id == ngo_uuid)
        .scalar()
    ) or 0

    return {
        "ngo_id": ngo_id,
        "impact_score": impact_score,
        "grade": _grade(impact_score),
        "total_donated": round(total_donated, 2),
        "program_expenses": round(program_expenses, 2),
        "overhead_expenses": round(overhead_expenses, 2),
        "unaccounted": unaccounted,
        "overhead_ratio": overhead_ratio,
        "donor_count": donor_count,
        "last_calculated": datetime.now(timezone.utc).isoformat(),
    }
