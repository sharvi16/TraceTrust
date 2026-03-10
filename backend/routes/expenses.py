import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import AnomalyAlert, AuditLog, Expense, User
from routes.auth import get_current_user, require_role
from services import anomaly_detector, redis_service

router = APIRouter(prefix="/expenses", tags=["expenses"])


# ── Request schema ─────────────────────────────────────────────────────────────
class LogExpenseRequest(BaseModel):
    amount: float
    category: str  # "food"|"medicine"|"education"|"salary"|"admin"|"other"
    description: str


_VALID_CATEGORIES = {"food", "medicine", "education", "salary", "admin", "other"}


# ── POST /expenses/log  (NGO Admin only) ──────────────────────────────────────
@router.post("/log", status_code=status.HTTP_201_CREATED)
def log_expense(
    payload: LogExpenseRequest,
    current_user: User = Depends(require_role("ngo_admin")),
    db: Session = Depends(get_db),
):
    # Security: ngo_id always comes from the authenticated user's JWT
    ngo_id = current_user.ngo_id
    if ngo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to an NGO.",
        )

    if payload.category not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"category must be one of {sorted(_VALID_CATEGORIES)}.",
        )

    expense = Expense(
        ngo_id=ngo_id,
        amount=payload.amount,
        category=payload.category,
        description=payload.description,
        logged_by=current_user.user_id,
        is_flagged=False,
    )
    db.add(expense)
    db.flush()  # populate expense_id before audit log and anomaly checks

    # Audit log (append-only)
    audit = AuditLog(
        table_name="expenses",
        record_id=str(expense.expense_id),
        action="INSERT",
        new_value={
            "expense_id": str(expense.expense_id),
            "ngo_id": str(expense.ngo_id),
            "amount": expense.amount,
            "category": expense.category,
            "description": expense.description,
            "logged_by": str(expense.logged_by),
        },
        performed_by=current_user.user_id,
    )
    db.add(audit)

    # Anomaly detection (rules + ML)
    reasons: list[str] = []
    reasons.extend(anomaly_detector.check_rules(expense, str(ngo_id), db))
    reasons.extend(anomaly_detector.check_ml(expense, str(ngo_id), db))

    if reasons:
        expense.is_flagged = True
        for reason in reasons:
            db.add(
                AnomalyAlert(
                    ngo_id=ngo_id,
                    expense_id=expense.expense_id,
                    reason=reason,
                )
            )

    db.commit()
    redis_service.invalidate_impact(str(ngo_id))

    return {
        "message": "Expense logged",
        "expense_id": str(expense.expense_id),
        "anomalies_detected": reasons,
    }


# ── GET /expenses/{ngo_id}  (Public) ──────────────────────────────────────────
@router.get("/{ngo_id}")
def ngo_expenses(ngo_id: str, db: Session = Depends(get_db)):
    try:
        ngo_uuid = uuid.UUID(ngo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ngo_id format.",
        )

    expenses = (
        db.query(Expense)
        .filter(Expense.ngo_id == ngo_uuid)
        .order_by(Expense.timestamp.desc())
        .all()
    )

    by_category: dict[str, float] = defaultdict(float)
    total_expenses = 0.0
    flagged_count = 0

    expense_list = []
    for e in expenses:
        by_category[e.category] += e.amount
        total_expenses += e.amount
        if e.is_flagged:
            flagged_count += 1
        expense_list.append({
            "expense_id": str(e.expense_id),
            "amount": e.amount,
            "category": e.category,
            "description": e.description,
            "is_flagged": e.is_flagged,
            "timestamp": e.timestamp.isoformat(),
        })

    return {
        "summary": {
            "by_category": dict(by_category),
            "total_expenses": total_expenses,
            "flagged_count": flagged_count,
        },
        "expenses": expense_list,
    }
