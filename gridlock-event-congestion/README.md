# Gridlock 2.0 — Event Traffic Impact Forecasting System

> **Flipkart Gridlock Hackathon — Round 2**
> A segment-level traffic impact forecasting and operational recommendation platform for planned events in Bengaluru.

---

## What is Gridlock 2.0?

Gridlock 2.0 helps traffic police and event management teams **predict exactly which road segments will slow down** when a planned event happens — and tells them precisely what to do about it.

Most traffic tools answer "will there be congestion near this event?" Gridlock 2.0 answers a harder question: **"Which specific roads will slow down by how much, for how long, and where should officers and barricades go?"**

The system ingests an event's details (type, footfall, location, time) and returns:

- A ranked list of affected road segments with predicted speed degradation percentages
- Exact officer deployment count and whether signal override is warranted
- High-priority barricade placement candidates near the venue
- Computed alternate diversion routes using the real Bengaluru road network
- A post-event feedback loop that tracks model accuracy over time

---

## The Three Pillars

### Pillar 1 — Impact Forecasting (The Brain)

A LightGBM regression model trained on 2,003,015 event-segment pairs derived from 8,173 real historical events (Astram dataset) and the complete Bengaluru OSM road network (155,370 nodes, 393,715 edges).

**What it predicts:** Speed degradation (0.0–0.85 scale) per road segment within a configurable radius of the event venue.

**Features used:**
| Category | Features |
|---|---|
| Temporal | Hour, minute, day-of-week, cyclical sin/cos encoding, slot-of-day, rush-hour flag |
| Geospatial | Node lat/lon, lat×hour interaction, lat×lon combined |
| Event | Type, footfall, venue capacity, duration, corridor, priority, cause |
| Road | Edge length, max speed, lane count, highway classification |

**Training metrics:**
| Metric | Score |
|---|---|
| R² Score | **0.9852** |
| RMSE | 0.0115 |
| MAE | 0.0099 |

### Pillar 2 — Operational Recommendations (The Differentiator)

Rule-based and graph-based engine that translates the forecast into actionable deployment guidance:

- **Manpower allocation** — officer count derived from footfall × road criticality scoring; signal override flag for high-criticality scenarios
- **Barricade candidates** — top N road segments near the venue ranked by highway type and proximity, with exact segment coordinates
- **Diversion routes** — Dijkstra shortest-path routing on the real OSM directed graph, returning full waypoint coordinates for map rendering

### Pillar 3 — Post-Event Learning Loop (The Unique Angle)

After each event, operators submit actual vs. predicted congestion via the feedback API. The system aggregates accuracy per event type, enabling ongoing model evaluation and future retraining.

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML Model | LightGBM 4.x + scikit-learn Pipeline |
| Road Network | OSMnx 2.x + NetworkX 3.x (Bengaluru OSM graph) |
| Backend | FastAPI 0.129 + Uvicorn |
| Frontend | React 19 + Vite 6 |
| Maps | React-Leaflet + Leaflet 1.9 |
| Charts | Recharts 2 |
| Animation | Framer Motion 12 |
| HTTP Client | Axios |

---

## Repository Structure

```
gridlock-event-congestion/
├── README.md
├── backend/
│   ├── train_model.py          # One-time model training entry point
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   └── impact_model.pkl    # Trained LightGBM pipeline (generated)
│   └── app/
│       ├── main.py             # FastAPI app + lifespan (pre-loads OSM graph)
│       ├── api/
│       │   ├── forecast.py     # POST /api/forecast
│       │   └── feedback.py     # POST /api/feedback  GET /api/metrics
│       ├── core/
│       │   ├── model_pipeline.py   # SegmentImpactModel — training & inference
│       │   ├── recommendation.py   # Manpower, barricade & routing engine
│       │   └── feedback.py         # FeedbackTracker — JSON persistence
│       └── services/
│           └── osm_service.py  # OSMnx graph loader + vectorised spatial index
├── data/
│   ├── raw/                    # Place Astram event CSV here
│   └── processed/
│       └── bengaluru_drive.graphml   # Downloaded OSM graph (generated)
├── scripts/
│   └── download_osm_data.py    # Fetches Bengaluru road network from OSM
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env                    # VITE_API_BASE_URL (points to backend)
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx   # Event form + live map + results
        │   ├── Analytics.jsx   # Model accuracy charts per event type
        │   └── Feedback.jsx    # Post-event outcome submission
        ├── components/
        │   ├── EventForm.jsx   # Input form with map-click coordinates
        │   ├── MapView.jsx     # Leaflet map — segments, barricades, routes
        │   ├── ResultsPanel.jsx
        │   ├── Sidebar.jsx
        │   └── StatCard.jsx
        ├── context/
        │   └── ThemeContext.jsx  # Dark / light theme
        └── services/
            └── api.js          # Axios client + mock data fallback
```

---

## Setup & Running Locally

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.9 or higher |
| Node.js | 18 or higher |
| npm | 9 or higher |
| Disk space | ~500 MB (OSM graph + model) |

---

### Step 1 — Clone the repository

```bash
git clone <repo-url>
cd gridlock-event-congestion
```

---

### Step 2 — Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

---

### Step 3 — Download the Bengaluru road network

> **One-time setup. Takes 5–15 minutes depending on internet speed.**

```bash
python scripts/download_osm_data.py
```

This fetches the complete Bengaluru drive network from OpenStreetMap and saves it to `data/processed/bengaluru_drive.graphml` (~140 MB).

---

### Step 4 — Place the event dataset

Copy the Astram event CSV into the raw data folder:

```
data/raw/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv
```

---

### Step 5 — Train the ML model

> **One-time setup. Takes 5–10 minutes.**

```bash
python backend/train_model.py
```

Expected output:
```
Starting training pipeline...
Building training data...
Training samples: 2003015
Training model...
==================================================
Training Metrics:
  R² Score:  0.9852
  RMSE:      0.011482
  MAE:       0.009936
==================================================
Training complete. Model saved to backend/models/impact_model.pkl
```

---

### Step 6 — Start the backend API server

```bash
python -m uvicorn backend.app.main:app --port 9000
```

> **Important:** The server pre-loads the OSM graph on startup. Wait for the following message before making requests (approximately 60–90 seconds):
> ```
> [Startup] OSM graph ready — 155370 nodes, 393715 edges
> INFO:     Application startup complete.
> ```

Backend is now available at:
- API: `http://127.0.0.1:9000`
- Interactive docs (Swagger): `http://127.0.0.1:9000/docs`

---

### Step 7 — Start the frontend

In a **new terminal**:

```bash
cd frontend
npm install       # only needed once
npm run dev
```

Frontend is available at: **http://localhost:5173**

---

### After first-time setup

On subsequent runs you only need Steps 6 and 7 — the graph and model are already on disk.

---

## API Reference

### `POST /api/forecast`

Runs the full forecasting pipeline for a planned event.

**Request body:**
```json
{
  "event_type": "Concert",
  "expected_footfall": 25000,
  "venue_capacity": 40000,
  "day_of_week": "Saturday",
  "time_of_day": "18:30:00",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "end_latitude": 12.9850,
  "end_longitude": 77.6100,
  "corridor": "MG Road",
  "priority": "High"
}
```

> `end_latitude` / `end_longitude` are optional. When provided, diversion routes are computed between origin and destination.

**Response:**
```json
{
  "segments": [
    {
      "segment_id": "663311696-10044013422-0",
      "road_name": "Nrupatunga Road",
      "highway_type": "primary",
      "predicted_speed_degradation": 0.483,
      "affected_radius_m": 879.3,
      "duration_min": 58,
      "distance_m": 795.6,
      "start_lat": 12.97511,
      "start_lon": 77.586907,
      "end_lat": 12.968066,
      "end_lon": 77.587361
    }
  ],
  "manpower": {
    "officer_count": 4,
    "signal_override": true,
    "rationale": "Footfall 25000 mapped to 4 officers; criticality score 5 triggers signal override."
  },
  "barricade_candidates": [
    {
      "segment_id": "245615180-12759084951-0",
      "road_name": "Kasturba Road",
      "highway_type": "primary",
      "priority_score": 5,
      "distance_m": 14.0
    }
  ],
  "diversion_routes": [
    {
      "route_id": "route-1",
      "total_distance_m": 3055.4,
      "detour_ratio": 1.37,
      "capacity_score": 3,
      "path_nodes": [123, 456, 789],
      "path_lats": [12.9716, 12.9740, 12.9850],
      "path_lons": [77.5946, 77.6020, 77.6100]
    }
  ]
}
```

---

### `POST /api/feedback`

Records actual post-event congestion for model accuracy tracking.

```json
{
  "event_type": "Concert",
  "predicted_speed_degradation": 0.483,
  "actual_speed_degradation": 0.45,
  "notes": "Early officer deployment reduced peak congestion"
}
```

---

### `GET /api/metrics`

Returns aggregated model accuracy per event type.

```json
{
  "metrics": [
    {
      "event_type": "Concert",
      "records": 3,
      "average_error": 0.0377,
      "last_updated": "2026-06-21T05:30:00Z"
    }
  ]
}
```

---

## How the Forecast Works

```
Event input (type, footfall, location, time)
        │
        ▼
Nearest OSM node lookup (vectorised spatial index)
        │
        ▼
Subgraph extraction — all road segments within 1.2 km radius
        │
        ▼
Feature engineering — temporal + geospatial + event + road features
        │
        ▼
LightGBM batch prediction — speed degradation per segment
        │
        ▼
Rank segments by degradation → top 12 returned
        │
        ├──▶ Manpower rule engine (footfall × criticality → officer count)
        │
        ├──▶ Barricade candidates (vectorised radius search → ranked by highway type)
        │
        └──▶ Diversion routes (Dijkstra on OSM directed graph, if destination given)
```

---

## Supported Event Types

| Event Type | Typical Footfall | Typical Degradation |
|---|---|---|
| Concert | 10,000 – 50,000 | 0.40 – 0.55 |
| Cricket | 30,000 – 80,000 | 0.45 – 0.60 |
| Political Rally | 20,000 – 70,000 | 0.42 – 0.58 |
| Expo | 5,000 – 25,000 | 0.30 – 0.45 |
| Unplanned | — | 0.20 – 0.45 |

---

## Known Limitations

- **Startup latency:** The OSM graph (143 MB) takes ~60 seconds to load into memory on first start. Subsequent requests are fast.
- **Synthetic training targets:** Ground-truth speed labels are unavailable in the raw event data. Targets are derived from rule-based heuristics (event type × road type × priority × footfall). Model accuracy on held-out real speed data is not yet measured.
- **Single-city model:** Trained exclusively on Bengaluru road topology. Not directly applicable to other cities without retraining.
- **Feedback loop is passive:** Post-event feedback is aggregated for visibility but does not trigger automatic model retraining.
- **Diversion routes:** Currently returns one primary route (Dijkstra shortest path). Multiple truly disjoint alternate routes require more complex algorithms.

---

## Troubleshooting

**`ModuleNotFoundError` on backend start**
```bash
pip install -r backend/requirements.txt
```

**OSM graph not found**
```bash
python scripts/download_osm_data.py
```

**Model not found / "Impact model is not loaded"**
```bash
python backend/train_model.py
```

**Port already in use**

Change the port and update `frontend/.env` accordingly:
```bash
# Backend
python -m uvicorn backend.app.main:app --port 9001

# frontend/.env
VITE_API_BASE_URL=http://127.0.0.1:9001/api
```

**Frontend shows mock data instead of real predictions**

Ensure:
1. Backend is running and has printed `Application startup complete`
2. `frontend/.env` contains `VITE_API_BASE_URL=http://127.0.0.1:9000/api`
3. Restart the Vite dev server after editing `.env`
