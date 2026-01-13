from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Valide le token JWT envoyé par le mobile via Supabase.
    """
    token = credentials.credentials
    
    try:
        # Supabase utilise l'algorithme HS256 avec le JWT_SECRET
        # Le paramètre audience="authenticated" est crucial pour Supabase
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=["HS256"], 
            audience="authenticated",
            options={"verify_aud": True} 
        )
        return payload 
    except JWTError as e:
        print(f"JWT Validation Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )