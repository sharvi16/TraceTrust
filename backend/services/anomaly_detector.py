"""Anomaly detection for TraceTrust expenses.

Two layers:
  1. check_rules  — fast, deterministic business-rule checks (no ML).
  2. check_ml     — per-NGO Isolation Forest; retrains on every new expense
                    (acceptable at MVP scale).

Both functions return a (possibly empty) list of human-readable reason strings.
The caller (expenses route) is responsible for persisting AnomalyAlert records.
"""
sys = None  # will be imported lazily
import sys as _sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

_OVERHEAD_RATIO_THRESHOLD = 0.40  # admin + salary > 40 % of total donations
_LARGE_EXPENSE_RATIO = 0.30       # single expense > 30 % of total donations
_ML_DIR = Path(__file__).resolve().parents[2] / "ml" / "models"


def check_rules(expense, ngo_id: str, db: Session) -> list[str]:
    """Apply deterministic business rules; return a list of flag reasons."""
    from models import Donation as DonationModel
    from models import Expense as ExpenseModel

    import uuid
    ngo_uuid = uuid.UUID(ngo_id)

    flags: list[str] = []

    # ─ Rule 1: Duplicate amount in the last 24 hours ───────────────────────────
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    duplicate_count: int = (
        db.query(func.count(ExpenseModel.expense_id))
        .filter(
            ExpenseModel.ngo_id == ngo_uuid,
            ExpenseModel.amount == expense.amount,
            ExpenseModel.timestamp >= cutoff,
        )
        .scalar()
    ) or 0
    if duplicate_count >= 2:  # 2 already exist → this would be the 3rd
        flags.append(
            "Possible duplicate: same amount logged 3+ times in 24 hours"
        )

    # ─ Rule 2: Overhead spike (admin + salary vs total donations) ────────────
    total_donated: float = (
        db.query(func.sum(DonationModel.amount))
        .filter(DonationModel.ngo_id == ngo_uuid)
        .scalar()
    ) or 0.0

    if total_donated > 0:
        current_overhead: float = (
            db.query(func.sum(ExpenseModel.amount))
            .filter(
                ExpenseModel.ngo_id == ngo_uuid,
                ExpenseModel.category.in_(["admin", "salary"]),
            )
            .scalar()
        ) or 0.0
        # Include the current expense if it falls into overhead categories
        running_overhead = current_overhead + (
            expense.amount if expense.category in ("admin", "salary") else 0.0
        )
        if running_overhead / total_donated > _OVERHEAD_RATIO_THRESHOLD:
            flags.append(
                "Admin overhead exceeds 40% of total donations received"
            )

    # ─ Rule 3: Unusual logging time ─────────────────────────────────────────
    ts: datetime = expense.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    hour = ts.hour
    if hour < 6 or hour > 22:
        flags.append(f"Expense logged at unusual hour ({hour}:00)")

    # ─ Rule 4: Single expense > 30 % of total donations ever received ───────
    if total_donated > 0 and expense.amount > _LARGE_EXPENSE_RATIO * total_donated:
        flags.append(
            "Single expense exceeds 30% of total donations ever received"
        )

    return flags


def check_ml(expense, ngo_id: str, db: Session) -> list[str]:
    """Retrain the per-NGO Isolation Forest on all historical expenses, then
    predict whether the new expense is anomalous.

    Returns an empty list if:
    - fewer than 20 historical expenses exist (model cannot be trained yet), or
    - any exception occurs (ML never crashes the request).
    """
    try:
        # Lazy imports — scikit-learn / joblib are optional at import time
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
        import anomaly_model

        from models import Expense as ExpenseModel
        import uuid

        historical = (
            db.query(ExpenseModel)
            .filter(ExpenseModel.ngo_id == uuid.UUID(ngo_id))
            .all()
        )

        # Retrain (will no-op if < 20 samples)
        anomaly_model.train_model(ngo_id, historical)

        # Predict on the new (not-yet-committed) expense
        if anomaly_model.predict_anomaly(ngo_id, expense):
            return ["ML model flagged this expense as unusual pattern"]

    except Exception:  # noqa: BLE001 — never crash the request over ML
        pass

    return []

    return []
