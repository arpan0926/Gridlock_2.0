from datetime import time
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.core.model_pipeline import SegmentImpactModel
from backend.app.core.recommendation import RecommendationEngine
from backend.app.services.osm_service import OSMGraphService

router = APIRouter()

MODEL_PATH = Path(__file__).resolve().parents[3] / "backend" / "models" / "impact_model.pkl"
GRAPH_PATH = Path(__file__).resolve().parents[3] / "data" / "processed" / "bengaluru_drive.graphml"

model = SegmentImpactModel(model_path=MODEL_PATH)
osm_service = OSMGraphService(graph_path=GRAPH_PATH)
recommendation_engine = RecommendationEngine()


class ForecastInput(BaseModel):
    event_type: str = Field(..., example="Concert")
    expected_footfall: int = Field(..., example=25000)
    venue_capacity: int = Field(..., example=50000)
    day_of_week: str = Field(..., example="Saturday")
    time_of_day: time = Field(..., example="18:30:00")
    latitude: float = Field(..., example=12.9716)
    longitude: float = Field(..., example=77.5946)
    end_latitude: Optional[float] = Field(None, example=12.9750)
    end_longitude: Optional[float] = Field(None, example=77.5950)
    corridor: Optional[str] = Field(None, example="MG Road")
    priority: Optional[str] = Field(None, example="High")
    event_cause: Optional[str] = Field(None, example="Concert")


class SegmentPrediction(BaseModel):
    segment_id: str
    road_name: str
    highway_type: str
    predicted_speed_degradation: float
    affected_radius_m: float
    duration_min: int
    distance_m: float


class ManpowerRecommendation(BaseModel):
    officer_count: int
    signal_override: bool
    rationale: str


class BarricadeCandidate(BaseModel):
    segment_id: str
    road_name: str
    priority_score: int
    highway_type: str
    distance_m: float


class DiversionRoute(BaseModel):
    route_id: str
    total_distance_m: float
    detour_ratio: float
    capacity_score: int
    path_nodes: List[int]


class ForecastResponse(BaseModel):
    segments: List[SegmentPrediction]
    manpower: ManpowerRecommendation
    barricade_candidates: List[BarricadeCandidate]
    diversion_routes: List[DiversionRoute]


@router.post("/forecast", response_model=ForecastResponse)
def forecast_event(input_data: ForecastInput):
    graph = osm_service.load_graph()
    if graph is None:
        raise HTTPException(status_code=500, detail="Road network graph is unavailable.")

    score = recommendation_engine.road_criticality_score(input_data.corridor, input_data.priority)
    manpower = recommendation_engine.calculate_manpower(input_data.expected_footfall, score)

    try:
        segments = model.predict_segment_impacts(
            input_data=input_data,
            graph=graph,
            radius_m=1200,
            limit=12,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast model failure: {exc}")

    barricade_candidates = recommendation_engine.generate_barricade_candidates(
        graph=graph,
        latitude=input_data.latitude,
        longitude=input_data.longitude,
        radius_m=1000,
        limit=8,
    )

    destination = (
        input_data.end_latitude,
        input_data.end_longitude,
    ) if input_data.end_latitude and input_data.end_longitude else None

    diversion_routes = recommendation_engine.plan_alternate_routes(
        graph=graph,
        origin=(input_data.latitude, input_data.longitude),
        destination=destination,
        max_paths=3,
    )

    return ForecastResponse(
        segments=segments,
        manpower=manpower,
        barricade_candidates=barricade_candidates,
        diversion_routes=diversion_routes,
    )
