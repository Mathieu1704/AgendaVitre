from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import interventions, clients, planning, employees, absences, raw_events

app = FastAPI(title="LVM Agenda API")

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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(interventions.router, prefix="/api/interventions", tags=["interventions"])
app.include_router(planning.router, prefix="/api/planning", tags=["planning"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(absences.router, prefix="/api/absences", tags=["absences"])
app.include_router(raw_events.router, prefix="/api/raw-events", tags=["raw-events"])



@app.get("/")
def read_root():
    return {"status": "ok", "message": "LVM Agenda API V2 (Prod Ready)"}