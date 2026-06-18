from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import forecast_router, feedback_router

app = FastAPI(
    title="Gridlock Event Congestion API",
    description="Forecast impact, recommend manpower and diversions, and log feedback for event congestion.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Gridlock Event Congestion backend is running."}
