from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from backend.app.core.feedback import FeedbackTracker

router = APIRouter()
tracker = FeedbackTracker()


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
    tracker.log_feedback(payload.dict())
    return {"status": "ok", "message": "Feedback recorded."}


@router.get("/metrics")
def get_feedback_metrics():
    metrics = tracker.summary_metrics()
    return {"metrics": metrics}
