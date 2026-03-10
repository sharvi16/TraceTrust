import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class NGO(Base):
    __tablename__ = "ngos"

    ngo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    registration_number: Mapped[str] = mapped_column(
        String, unique=True, nullable=False
    )
    category: Mapped[str] = mapped_column(
        Enum("education", "health", "food", "disaster", name="ngo_category_enum"),
        nullable=False,
    )
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    admins: Mapped[list["User"]] = relationship("User", back_populates="ngo")  # noqa: F821
    donations: Mapped[list["Donation"]] = relationship("Donation", back_populates="ngo")  # noqa: F821
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="ngo")  # noqa: F821
    anomaly_alerts: Mapped[list["AnomalyAlert"]] = relationship("AnomalyAlert", back_populates="ngo")  # noqa: F821
