from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import forecast_router, feedback_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.app.api.forecast import osm_service, model
    print(f"[Startup] ML model loaded: {model.pipeline is not None}")
    print("[Startup] Loading OSM graph — server will be ready in ~60s...")
    try:
        graph = osm_service.load_graph()
        if graph is not None:
            print(f"[Startup] OSM graph ready — {len(graph.nodes)} nodes, {len(graph.edges)} edges")
        else:
            print("[Startup] WARNING: OSM graph not found, forecasts will fail")
    except Exception as e:
        print(f"[Startup] ERROR loading OSM graph: {e}")
    yield


app = FastAPI(
    title="Gridlock Event Congestion API",
    description="Forecast impact, recommend manpower and diversions, and log feedback for event congestion.",
    version="0.1.0",
    lifespan=lifespan,
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
