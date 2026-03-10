import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import AuditLog, Donation, NGO, User
from routes.auth import get_current_user, require_role
from services import redis_service

router = APIRouter(prefix="/donations", tags=["donations"])


# ── Request schemas ────────────────────────────────────────────────────────────
class LogDonationRequest(BaseModel):
    donor_email: str
    amount: float
    currency: str = "INR"
    transaction_ref: str


# ── POST /donations/log  (NGO Admin only) ─────────────────────────────────────
@router.post("/log", status_code=status.HTTP_201_CREATED)
def log_donation(
    payload: LogDonationRequest,
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

    # Resolve donor
    donor = (
        db.query(User)
        .filter(User.email == payload.donor_email, User.role == "donor")
        .first()
    )
    if donor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No donor account found with email '{payload.donor_email}'.",
        )

    # Uniqueness check on transaction_ref
    if db.query(Donation).filter(
        Donation.transaction_ref == payload.transaction_ref
    ).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A donation with this transaction_ref already exists.",
        )

    donation = Donation(
        donor_id=donor.user_id,
        ngo_id=ngo_id,
        amount=payload.amount,
        currency=payload.currency,
        transaction_ref=payload.transaction_ref,
    )
    db.add(donation)
    db.flush()  # populate donation_id before writing audit log

    audit = AuditLog(
        table_name="donations",
        record_id=str(donation.donation_id),
        action="INSERT",
        new_value={
            "donation_id": str(donation.donation_id),
            "donor_id": str(donation.donor_id),
            "ngo_id": str(donation.ngo_id),
            "amount": donation.amount,
            "currency": donation.currency,
            "transaction_ref": donation.transaction_ref,
        },
        performed_by=current_user.user_id,
    )
    db.add(audit)
    db.commit()

    redis_service.invalidate_impact(str(ngo_id))

    return {"message": "Donation logged", "donation_id": str(donation.donation_id)}


# ── GET /donations/my  (Donor only) ───────────────────────────────────────────
@router.get("/my")
def my_donations(
    current_user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    donations = (
        db.query(Donation)
        .filter(Donation.donor_id == current_user.user_id)
        .order_by(Donation.timestamp.desc())
        .all()
    )

    # Group by ngo_id
    ngo_map: dict[str, dict] = defaultdict(lambda: {
        "ngo_id": None,
        "ngo_name": None,
        "total_donated": 0.0,
        "donation_count": 0,
        "donations": [],
    })

    for d in donations:
        key = str(d.ngo_id)
        entry = ngo_map[key]
        entry["ngo_id"] = key
        if entry["ngo_name"] is None:
            ngo = db.query(NGO).filter(NGO.ngo_id == d.ngo_id).first()
            entry["ngo_name"] = ngo.name if ngo else None
        entry["total_donated"] += d.amount
        entry["donation_count"] += 1
        entry["donations"].append({
            "donation_id": str(d.donation_id),
            "amount": d.amount,
            "currency": d.currency,
            "transaction_ref": d.transaction_ref,
            "timestamp": d.timestamp.isoformat(),
        })

    return list(ngo_map.values())


# ── GET /donations/ngo/{ngo_id}  (Public) ─────────────────────────────────────
@router.get("/ngo/{ngo_id}")
def ngo_donations(ngo_id: str, db: Session = Depends(get_db)):
    try:
        ngo_uuid = uuid.UUID(ngo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ngo_id format.",
        )

    donations = (
        db.query(Donation)
        .filter(Donation.ngo_id == ngo_uuid)
        .order_by(Donation.timestamp.desc())
        .all()
    )

    donor_ids = {d.donor_id for d in donations}

    return {
        "total_donated": sum(d.amount for d in donations),
        "donor_count": len(donor_ids),
        "donation_list": [
            {
                "donation_id": str(d.donation_id),
                "amount": d.amount,
                "currency": d.currency,
                "transaction_ref": d.transaction_ref,
                "timestamp": d.timestamp.isoformat(),
            }
            for d in donations
        ],
    }
