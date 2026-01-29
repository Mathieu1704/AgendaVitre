from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import get_db, Employee

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db) #  On injecte la DB ici
) -> Employee:
    """
    Valide le token, récupère l'ID, et charge l'Employé depuis la DB.
    """
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=["HS256"], 
            audience="authenticated",
            options={"verify_aud": True} 
        )
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide: ID manquant")

        # VÉRIFICATION EN BASE DE DONNÉES
        # On cherche l'employé qui a cet ID Supabase exact
        employee = db.query(Employee).filter(Employee.id == user_id).first()
        
        if not employee:
            # Si l'user est connecté sur Supabase mais n'est pas dans ta table employees
            raise HTTPException(
                status_code=401, 
                detail="Utilisateur inconnu dans la table employés"
            )
            
        return employee #  On renvoie l'objet complet

    except JWTError as e:
        print(f"JWT Validation Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Erreur d'authentification: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )