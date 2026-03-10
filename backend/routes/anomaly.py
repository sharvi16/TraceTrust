import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import AnomalyAlert, Expense, User
from routes.auth import get_current_user, require_role

router = APIRouter(prefix="/anomaly", tags=["anomaly"])


# ── GET /anomaly/alerts/{ngo_id}  (NGO Admin of that NGO OR Super Admin) ──────
@router.get("/alerts/{ngo_id}")
def get_alerts(
    ngo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Role check: ngo_admin may only view their own NGO's alerts
    if current_user.role == "ngo_admin":
        if current_user.ngo_id is None or str(current_user.ngo_id) != ngo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorised to view alerts for this NGO.",
            )
    elif current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    try:
        ngo_uuid = uuid.UUID(ngo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ngo_id format.",
        )

    alerts = (
        db.query(AnomalyAlert)
        .filter(AnomalyAlert.ngo_id == ngo_uuid)
        .order_by(AnomalyAlert.flagged_at.desc())
        .all()
    )

    result = []
    for alert in alerts:
        expense = db.query(Expense).filter(
            Expense.expense_id == alert.expense_id
        ).first()

        result.append({
            "alert_id": str(alert.alert_id),
            "ngo_id": str(alert.ngo_id),
            "reason": alert.reason,
            "flagged_at": alert.flagged_at.isoformat(),
            "resolved": alert.resolved,
            "expense": {
                "expense_id": str(expense.expense_id),
                "amount": expense.amount,
                "category": expense.category,
                "description": expense.description,
                "timestamp": expense.timestamp.isoformat(),
            } if expense else None,
        })

    return result


# ── PATCH /anomaly/resolve/{alert_id}  (Super Admin only) ───────────────────
@router.patch("/resolve/{alert_id}")
def resolve_alert(
    alert_id: str,
    _: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert_id format.",
        )

    alert = db.query(AnomalyAlert).filter(
        AnomalyAlert.alert_id == alert_uuid
    ).first()

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found.",
        )

    alert.resolved = True
    db.commit()
    return {"message": "Alert marked as resolved"}
