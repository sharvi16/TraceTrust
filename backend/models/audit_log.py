# =============================================================================
# IMMUTABLE AUDIT LOG
# -----------------------------------------------------------------------------
# This table is append-only by design. It must NEVER be mutated after insert.
#
# WARNING TO FUTURE DEVELOPERS:
#   - Do NOT add UPDATE or DELETE routes/operations for AuditLog records.
#   - Do NOT add cascade deletes from any parent table to this table.
#   - Do NOT expose any endpoint that modifies existing log entries.
#
# Rationale: AuditLog is the source of truth for regulatory compliance and
# donor transparency. Any mutation would undermine the trust model of TraceTrust.
# =============================================================================

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    table_name: Mapped[str] = mapped_column(String, nullable=False)
    record_id: Mapped[str] = mapped_column(String, nullable=False)
    # Only "INSERT" is ever stored here — see module-level warning above.
    action: Mapped[str] = mapped_column(String, nullable=False, default="INSERT")
    new_value: Mapped[dict] = mapped_column(JSON, nullable=False)
    performed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship (read-only reference — never cascade delete)
    performed_by_user: Mapped["User"] = relationship("User", back_populates="audit_logs")  # noqa: F821
