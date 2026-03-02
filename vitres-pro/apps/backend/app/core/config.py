import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    JWT_SECRET: str
    RESEND_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    class Config:
        # On dit à Pydantic de chercher dans le dossier courant OU dans apps/backend
        env_file = [".env", "apps/backend/.env"]
        env_file_encoding = 'utf-8'
        extra = "ignore" 

settings = Settings()