"""
SQLAlchemy ORM models for conversations and messages.

Tables
------
conversations      – one row per logical conversation belonging to a user.
chat_messages      – one row per message; FK → conversations.id.
message_snapshots  – append-only pydantic-ai message snapshot log; FK → conversations.id.
"""

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import mapped_column, relationship

from sqlalchemy_models.base import Base


# ---------------------------------------------------------------------------
# Enums (stored as VARCHAR so they are readable without an enum type in PG)
# ---------------------------------------------------------------------------

MessageRole = Enum("user", "assistant", "system", name="message_role")
ConversationStatus = Enum("active", "completed", "archived", name="session_status")


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------

class ConversationModel(Base):
    """A logical conversation (== session) belonging to a single user."""

    __tablename__ = "conversations"

    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # FK → users.id
    user_id = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # human-readable UUID generated in src/handlers/chat.py
    session_id = mapped_column(String(36), unique=True, nullable=False, index=True)

    title = mapped_column(String(255), nullable=True)

    status = mapped_column(ConversationStatus, nullable=False, default="active")
    message_count = mapped_column(Integer, nullable=False, default=0)
    completed_at = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at = mapped_column(DateTime(timezone=True), nullable=True)

    city_id = mapped_column(String(50), nullable=False, default="lucknow", index=True)

    # arbitrary extra data (e.g. language, topic, model name)
    extra_metadata = mapped_column(JSONB, nullable=True, default=dict)

    # one conversation → many messages
    messages = relationship(
        "ChatMessageModel",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessageModel.timestamp",
    )

    # one conversation → many message snapshots
    message_snapshots = relationship(
        "MessageSnapshotModel",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="MessageSnapshotModel.sequence",
    )

    # many conversations → one user
    user = relationship("UserModel", back_populates="conversations")

    def __repr__(self):
        return (
            f"<ConversationModel id={self.id} session_id={self.session_id!r}"
            f" user_id={self.user_id!r} status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# ChatMessage
# ---------------------------------------------------------------------------

class ChatMessageModel(Base):
    """A single message inside a conversation."""

    __tablename__ = "chat_messages"

    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # the UUID set in src/handlers/chat.py
    message_id = mapped_column(String(36), unique=True, nullable=False, index=True)

    # FK → conversations.id
    conversation_id = mapped_column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = mapped_column(MessageRole, nullable=False)

    # use Text so very long LLM responses are not truncated
    content = mapped_column(Text, nullable=False)

    timestamp = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # e.g. {"tokens": 123, "model": "gpt-4o"}
    extra_metadata = mapped_column(JSONB, nullable=True, default=dict)

    # many messages → one conversation
    conversation = relationship("ConversationModel", back_populates="messages")

    def __repr__(self):
        return (
            f"<ChatMessageModel id={self.id} message_id={self.message_id!r}"
            f" role={self.role!r} conversation_id={self.conversation_id!r}>"
        )


# ---------------------------------------------------------------------------
# MessageSnapshot  ── append-only pydantic-ai message snapshot log
# ---------------------------------------------------------------------------

class MessageSnapshotModel(Base):
    """
    Stores pydantic-ai message snapshots for conversation replay.

    Columns
    -------
    conversation_id  FK → conversations.id
    sequence         0-based monotone counter within one conversation
    event            Full pydantic-ai messages_snapshot serialised as JSONB

    Design notes
    ------------
    * Append-only – rows are never updated in normal flow.
    * (conversation_id, sequence) is UNIQUE to prevent duplicate rows.
    * The latest snapshot row contains the full ModelMessage list needed
      to resume a conversation or replay it in the UI.
    """

    __tablename__ = "message_snapshots"
    __table_args__ = (
        UniqueConstraint("conversation_id", "sequence", name="uq_message_snapshots_conv_seq"),
    )

    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    conversation_id = mapped_column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Monotone counter scoped to the conversation
    sequence = mapped_column(Integer, nullable=False)

    # Full AG-UI event dict (e.g. {"type":"TEXT_MESSAGE_CONTENT","delta":"Hi"})
    event = mapped_column(JSONB, nullable=False)

    # many snapshots → one conversation
    conversation = relationship("ConversationModel", back_populates="message_snapshots")

    def __repr__(self):
        event_type = (self.event or {}).get("type", "?")
        return (
            f"<MessageSnapshotModel id={self.id} conversation_id={self.conversation_id}"
            f" seq={self.sequence} type={event_type!r}>"
        )

