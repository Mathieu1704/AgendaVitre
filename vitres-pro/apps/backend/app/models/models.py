from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text, Numeric, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
import uuid
from app.core.config import settings

# Configuration SQLAlchemy
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Fonction pour récupérer la DB dans les endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- DÉFINITION DES TABLES ---

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    interventions = relationship("Intervention", back_populates="client")

class Intervention(Base):
    __tablename__ = "interventions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"))
    employee_id = Column(UUID(as_uuid=True), nullable=True) # ID Supabase Auth
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="planned") # planned, in_progress, done, cancelled
    price_estimated = Column(Numeric(10, 2), nullable=True)
    
    client = relationship("Client", back_populates="interventions")