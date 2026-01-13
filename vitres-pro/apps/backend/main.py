from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import interventions, clients

app = FastAPI(title="VitresPro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(interventions.router, prefix="/api/interventions", tags=["interventions"])

@app.get("/")
def read_root():
    return {"status": "ok", "message": "VitresPro API Running"}
