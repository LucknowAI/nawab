"""SQLAlchemy ORM model for user feedback."""

from sqlalchemy import BigInteger, ForeignKey, Text
from sqlalchemy.orm import mapped_column, relationship

from sqlalchemy_models.base import Base


class FeedbackModel(Base):
    """Stores feedback submitted by users."""

    __tablename__ = "feedback"

    id      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    message = mapped_column(Text, nullable=False)

    # -----------------------------------------------------------------------
    # Relationships
    # -----------------------------------------------------------------------
    user = relationship("UserModel", back_populates="feedback")

    def __repr__(self) -> str:
        return f"<FeedbackModel id={self.id} user_id={self.user_id}>"
