from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text, Numeric, create_engine, Table, Float, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
import uuid
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- TABLE D'ASSOCIATION (Many-to-Many) ---
# Permet de dire : L'intervention X est assignée à l'employé A ET l'employé B
intervention_employees = Table(
    'intervention_employees', Base.metadata,
    Column('intervention_id', UUID(as_uuid=True), ForeignKey('interventions.id'), primary_key=True),
    Column('employee_id', UUID(as_uuid=True), ForeignKey('employees.id'), primary_key=True)
)

# --- TABLES ---

class CompanySettings(Base):
    """Pour stocker les paramètres globaux comme la tolérance d'heures"""
    __tablename__ = "company_settings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    overtime_tolerance_hours = Column(Float, default=3.0) # Ex: 3h de dépassement autorisé

class Employee(Base):
    """
    Extension du profil utilisateur Supabase.
    L'ID ici DOIT correspondre à l'ID user.id de Supabase Auth.
    """
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True) # Pas de default, on prend celui de Supabase
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="employee") # 'admin' ou 'employee'
    color = Column(String, default="#3B82F6") # Couleur pour le planning admin
    
    # Gestion du temps
    weekly_hours = Column(Float, default=38.0) # Contrat hebdo
    daily_capacity = Column(Float, default=7.6) # Capacité journalière par défaut (38/5)
    
    # Relations
    interventions = relationship("Intervention", secondary=intervention_employees, back_populates="employees")
    absences = relationship("Absence", back_populates="employee")

class Absence(Base):
    __tablename__ = "absences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String, nullable=True) # Maladie, Congé, etc.
    
    employee = relationship("Employee", back_populates="absences")

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
    
    # SUPPRIMÉ : employee_id (car maintenant c'est une liste via 'employees')
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="planned") 
    price_estimated = Column(Numeric(10, 2), nullable=True)
    
    # Relations
    client = relationship("Client", back_populates="interventions")
    employees = relationship("Employee", secondary=intervention_employees, back_populates="interventions")