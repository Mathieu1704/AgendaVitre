from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.routers import interventions, clients, planning, employees, absences, raw_events, notifications, logs, settings

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="LVM Agenda API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://lvmagenda.be",
        "https://www.lvmagenda.be",
        "https://agenda-vitre.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(interventions.router, prefix="/api/interventions", tags=["interventions"])
app.include_router(planning.router, prefix="/api/planning", tags=["planning"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(absences.router, prefix="/api/absences", tags=["absences"])
app.include_router(raw_events.router, prefix="/api/raw-events", tags=["raw-events"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])



@app.get("/")
def read_root():
    return {"status": "ok", "message": "LVM Agenda API V2 (Prod Ready)"}