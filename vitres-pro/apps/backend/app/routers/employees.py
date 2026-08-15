import secrets
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from uuid import UUID
from datetime import date
from pydantic import BaseModel
from PIL import Image, ImageOps

from pydantic import field_validator

from app.models.models import get_db, Employee
from app.schemas.schemas import EmployeeBase, EmployeeOut, EmployeeUpdate, validate_hours_per_weekday
from app.core.deps import get_current_user
from app.core.supabase import supabase_admin

router = APIRouter()

AVATAR_BUCKET = "avatars"
AVATAR_MAX_SIZE = 512
AVATAR_MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def _signed_avatar_url(emp: Employee) -> Optional[str]:
    """URL signée (bucket privé) valable 7 jours — jamais persistée, recalculée
    à chaque lecture. Renvoie None si pas de photo ou si Storage est injoignable
    (l'avatar retombe alors sur les initiales côté mobile)."""
    if not emp.avatar_path:
        return None
    try:
        res = supabase_admin.storage.from_(AVATAR_BUCKET).create_signed_url(
            emp.avatar_path, 60 * 60 * 24 * 7,
        )
        return res.get("signedURL") or res.get("signed_url")
    except Exception:
        return None


def _employee_out(emp: Employee) -> EmployeeOut:
    out = EmployeeOut.model_validate(emp, from_attributes=True)
    out.avatar_url = _signed_avatar_url(emp)
    return out

# --- SCHEMAS LOCAUX ---
class EmployeeCreateRequest(BaseModel):
    email: str
    # Optionnel : si vide, un mot de passe aléatoire est généré côté serveur
    # (l'admin peut réinitialiser le mot de passe plus tard via reset-password).
    password: Optional[str] = None
    full_name: str
    color: str = "#3B82F6"
    weekly_hours: float = 38.0
    role: str = "employee"
    phone: Optional[str] = None
    hours_per_weekday: Optional[Dict[str, float]] = None
    hours_valid_from: Optional[date] = None
    hours_valid_until: Optional[date] = None

    @field_validator("hours_per_weekday")
    @classmethod
    def _check_hours_per_weekday(cls, v):
        return validate_hours_per_weekday(v)


def _compute_hours_from_weekday(hours_per_weekday: Dict[str, float]) -> tuple[float, float]:
    """Calcule (weekly_hours, daily_capacity) à partir d'un dict heures/jour."""
    total = round(sum(hours_per_weekday.values()), 2)
    worked_days = sum(1 for v in hours_per_weekday.values() if v > 0) or 5
    return total, round(total / worked_days, 2)

class PasswordResetRequest(BaseModel):
    password: str

# --- ROUTES ---

@router.get("", response_model=List[EmployeeOut])
def read_employees(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return [_employee_out(emp) for emp in db.query(Employee).all()]

@router.get("/me", response_model=EmployeeOut)
def read_me(
    current_user: Employee = Depends(get_current_user),
):
    return _employee_out(current_user)


@router.post("/me/avatar", response_model=EmployeeOut)
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image.")

    raw = file.file.read(AVATAR_MAX_UPLOAD_BYTES + 1)
    if len(raw) > AVATAR_MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image trop volumineuse (8 Mo max).")

    try:
        img = Image.open(BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail((AVATAR_MAX_SIZE, AVATAR_MAX_SIZE))
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=80)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier image invalide.")

    path = f"{current_user.id}.jpg"
    try:
        supabase_admin.storage.from_(AVATAR_BUCKET).upload(
            path, buffer.getvalue(),
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Échec de l'upload : {str(e)}")

    current_user.avatar_path = path
    db.commit()
    db.refresh(current_user)
    return _employee_out(current_user)


@router.delete("/me/avatar", response_model=EmployeeOut)
def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.avatar_path:
        try:
            supabase_admin.storage.from_(AVATAR_BUCKET).remove([current_user.avatar_path])
        except Exception:
            pass
        current_user.avatar_path = None
        db.commit()
        db.refresh(current_user)
    return _employee_out(current_user)

@router.post("", response_model=EmployeeOut)
def create_employee(
    emp_data: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user) # current_user est un objet Employee
):
    # 1. Vérification Admin (CORRIGÉ)
    # On vérifie directement l'attribut .role de l'objet, plus besoin de ["sub"]
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé. Admin requis.")

    if emp_data.role not in ("admin", "employee", "subcontractor"):
        raise HTTPException(status_code=400, detail="Rôle invalide.")

    # 2. Création dans Supabase Auth
    password = emp_data.password or secrets.token_urlsafe(12)
    try:
        user_response = supabase_admin.auth.admin.create_user({
            "email": emp_data.email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": emp_data.full_name}
        })
        new_user_id = UUID(user_response.user.id)
    except Exception as e:
        # AJOUT : Log l'erreur exacte dans la console serveur
        print(f"❌ ERREUR SUPABASE AUTH: {str(e)}") 
        raise HTTPException(status_code=400, detail=f"Erreur Auth: {str(e)}")

    # 3. Création dans la DB SQL
    if emp_data.hours_per_weekday:
        weekly_hours, daily_capacity = _compute_hours_from_weekday(emp_data.hours_per_weekday)
    else:
        weekly_hours = emp_data.weekly_hours
        daily_capacity = round(emp_data.weekly_hours / 5, 2)

    new_employee = Employee(
        id=new_user_id,
        email=emp_data.email,
        full_name=emp_data.full_name,
        color=emp_data.color,
        role=emp_data.role,
        phone=emp_data.phone,
        weekly_hours=weekly_hours,
        daily_capacity=daily_capacity,
        hours_per_weekday=emp_data.hours_per_weekday,
        hours_valid_from=emp_data.hours_valid_from,
        hours_valid_until=emp_data.hours_valid_until,
    )
    
    try:
        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)
    except Exception as e:
        # Nettoyage si échec DB
        try:
            supabase_admin.auth.admin.delete_user(str(new_user_id))
        except:
            pass
        raise HTTPException(status_code=400, detail=f"Erreur DB: {str(e)}")

    return new_employee

@router.post("/sync-profile")
def sync_profile(
    profile: EmployeeBase,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user) # ✅ Objet Employee
):
    # Plus besoin de chercher en DB, current_user EST l'employé
    # Mais sync_profile sert souvent à créer le profil la première fois...
    # Si get_current_user échoue car l'employé n'existe pas encore en DB,
    # il faudra peut-être adapter deps.py ou gérer ce cas spécifique.
    
    # Pour l'instant, si tu utilises sync_profile juste pour mettre à jour :
    for k, v in profile.model_dump().items():
        setattr(current_user, k, v)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: UUID,
    obj_in: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Seul un admin peut modifier un employé")

    db_obj = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    update_data = obj_in.model_dump(exclude_unset=True)

    if "role" in update_data and update_data["role"] not in ("admin", "employee", "subcontractor"):
        raise HTTPException(status_code=400, detail="Rôle invalide.")

    # Si on change les heures par jour, on recalcule weekly_hours et daily_capacity depuis leur somme
    if update_data.get("hours_per_weekday"):
        update_data["weekly_hours"], update_data["daily_capacity"] = _compute_hours_from_weekday(
            update_data["hours_per_weekday"]
        )
    # Sinon, si on change juste les heures hebdo, on recalcule la capacité journalière (hebdo / 5)
    elif "weekly_hours" in update_data:
        update_data["daily_capacity"] = round(update_data["weekly_hours"] / 5, 2)

    for field in update_data:
        setattr(db_obj, field, update_data[field])

    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.post("/{employee_id}/reset-password")
def reset_employee_password(
    employee_id: UUID,
    body: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    try:
        supabase_admin.auth.admin.update_user_by_id(str(employee_id), {"password": body.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur Supabase: {str(e)}")
    return {"status": "ok"}


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """
    Supprime un employé.
    1. Retire l'employé de toutes les interventions (Désassignation).
    2. Supprime l'employé de la DB.
    3. Supprime le compte de connexion Supabase Auth.
    """
    # 1. Sécurité : Seul l'admin peut supprimer
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Interdit : Seul l'admin peut supprimer.")

    # 2. Récupérer l'employé
    employee_to_delete = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee_to_delete:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    try:
        # ✅ CRUCIAL : On vide ses interventions avant de supprimer
        # Cela supprime les liens dans la table 'intervention_employees'
        # Les interventions redeviennent "Non assignées" (ou assignées aux autres collègues s'il y en a)
        employee_to_delete.interventions = []
        db.commit() # On valide la désassignation

        # 3. Supprimer l'employé de la base de données
        db.delete(employee_to_delete)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Erreur DB: {e}")
        raise HTTPException(status_code=400, detail=f"Impossible de supprimer : {str(e)}")

    # 4. Supprimer le compte Auth Supabase (Optionnel mais recommandé pour nettoyer)
    try:
        supabase_admin.auth.admin.delete_user(str(employee_id))
    except Exception as e:
        print(f"⚠️ Note: Le compte Auth n'a pas pu être supprimé (peut-être déjà fait) : {e}")

    return {"message": "Employé supprimé et interventions libérées."}