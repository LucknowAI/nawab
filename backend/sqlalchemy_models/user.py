"""
SQLAlchemy ORM model for users.

Table
-----
users  – one row per unique user; supports Google OAuth and email/OTP login.
"""

from sqlalchemy import BigInteger, Boolean, DateTime, String
from sqlalchemy.orm import mapped_column, relationship

from sqlalchemy_models.base import Base


class UserModel(Base):
    """
    Represents a registered user.

    Supports two auth providers:
    - google  : google_id is set; all profile fields populated from Google ID-token.
    - email   : google_id is NULL; user authenticated via email OTP.
    """

    __tablename__ = "users"

    # -----------------------------------------------------------------------
    # Primary key
    # -----------------------------------------------------------------------
    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # -----------------------------------------------------------------------
    # Google-sourced identity fields
    # -----------------------------------------------------------------------

    # `sub` claim from Google ID token – globally unique per Google account.
    # NULL for email/OTP users (PostgreSQL allows multiple NULLs in a unique column).
    google_id    = mapped_column(String(128), unique=True, nullable=True, index=True)

    email        = mapped_column(String(255),  unique=True, nullable=False, index=True)
    full_name    = mapped_column(String(255),  nullable=True)
    given_name   = mapped_column(String(128),  nullable=True)
    family_name  = mapped_column(String(128),  nullable=True)

    # Profile picture URL returned by Google
    picture      = mapped_column(String(1024), nullable=True)

    # Whether Google has verified the email address (`email_verified` claim)
    email_verified = mapped_column(Boolean, nullable=False, default=False)

    # -----------------------------------------------------------------------
    # Auth / meta
    # -----------------------------------------------------------------------
    # "google" for Google OAuth users, "email" for email/OTP users
    auth_provider = mapped_column(String(32),  nullable=False, default="google")

    last_login   = mapped_column(DateTime(timezone=True), nullable=True)

    # City preference — used as fallback when no city_id is in the AG-UI state
    default_city_id = mapped_column(String(50), nullable=False, default="lucknow")

    # -----------------------------------------------------------------------
    # Relationships
    # -----------------------------------------------------------------------
    conversations = relationship(
        "ConversationModel",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    feedback = relationship(
        "FeedbackModel",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<UserModel id={self.id} email={self.email!r}>"
