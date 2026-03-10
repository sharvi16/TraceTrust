import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Expense(Base):
    __tablename__ = "expenses"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ngo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ngos.ngo_id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(
        Enum(
            "food",
            "medicine",
            "education",
            "salary",
            "admin",
            "other",
            name="expense_category_enum",
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    logged_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    ngo: Mapped["NGO"] = relationship("NGO", back_populates="expenses")  # noqa: F821
    logged_by_user: Mapped["User"] = relationship("User", back_populates="logged_expenses")  # noqa: F821
    anomaly_alerts: Mapped[list["AnomalyAlert"]] = relationship("AnomalyAlert", back_populates="expense")  # noqa: F821
