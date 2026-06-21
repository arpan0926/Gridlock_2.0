from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from backend.app.core import database as db

router = APIRouter()


class FeedbackInput(BaseModel):
    event_id: Optional[str] = Field(None, example="EVT-1001")
    event_type: str = Field(..., example="Cricket")
    predicted_speed_degradation: float = Field(..., example=0.32)
    actual_speed_degradation: float = Field(..., example=0.28)
    notes: Optional[str] = Field(None, example="Actual impact was lower due to early police deployment.")


class MetricsResponse(BaseModel):
    event_type: str
    records: int
    average_error: float
    last_updated: str


@router.post("/feedback")
def submit_feedback(payload: FeedbackInput):
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    row_id = db.save_feedback(data)
    return {"status": "ok", "message": "Feedback recorded.", "id": row_id}


@router.get("/metrics")
def get_feedback_metrics():
    metrics = db.get_feedback_metrics()
    return {"metrics": metrics}


@router.get("/feedback/history")
def get_feedback_history(limit: int = 100):
    """Return all feedback entries, newest first."""
    return {"history": db.get_feedback_history(limit=limit)}
