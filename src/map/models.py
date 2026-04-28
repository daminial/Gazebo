
from sqlalchemy import Column, Index, Integer, Numeric, String, ForeignKey, DateTime, func, CheckConstraint, Table, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base


map_template_tags = Table(
    "map_template_tags",
    Base.metadata,
    Column("map_template_id", Integer, ForeignKey("map_templates.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("idx_map_template_tags_tag_id", "tag_id"),
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)  
    name = Column(String, unique=True, nullable=False)

    templates = relationship("MapTemplate", secondary=map_template_tags, back_populates="tags")


class MapTemplate(Base):
    """Шаблон карты в библиотеке пользователя"""
    __tablename__ = "map_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    is_public = Column(Boolean, default=False, nullable=False)
    rating = Column(Numeric(3, 1), default=0, nullable=False)
    votes = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    image = relationship("Image", foreign_keys=[image_id], back_populates="map_templates")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="map_templates")
    tags = relationship("Tag", secondary=map_template_tags, back_populates="templates")
    room_instances = relationship("RoomMap", back_populates="template", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_map_templates_owner_id', 'owner_id'),
        Index('idx_map_templates_created_at', 'created_at'),
        Index('idx_map_templates_is_public', 'is_public'),
        Index(
        "idx_templates_public_rank",
        "is_public", "rating", "votes",
        postgresql_where="is_public = true",
        postgresql_ops={"rating": "DESC", "votes": "DESC"}
    ),
    )

class RoomMap(Base):
    """Экземпляр карты в комнате"""
    __tablename__ = "room_maps"

    id = Column(Integer, primary_key=True, autoincrement=True)

    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
    template_id = Column(Integer,
                         ForeignKey("map_templates.id", ondelete="SET NULL"),
                         nullable=True)
    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="SET NULL"),
                      nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    name_in_room = Column(String, nullable=False)

    image = relationship("Image", uselist=False)
    room = relationship("Room", back_populates="maps")
    template = relationship("MapTemplate", back_populates="room_instances")
    pages = relationship("RoomPage", back_populates="map")

    __table_args__ = (
        CheckConstraint(
            '(template_id IS NOT NULL) OR (image_id IS NOT NULL)',
            name='check_template_or_image'
        ),
    )
