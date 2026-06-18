# Gridlock Event Congestion Prototype

**Flipkart Gridlock Hackathon Round 2** — A segment-level traffic impact forecasting and operational recommendation system for planned events in Bengaluru.

---

## Project Overview

This system addresses three critical gaps in event traffic management:

### **The 3 Pillars**

#### **Pillar 1: Impact Forecasting (The Brain)**
- **What we do:** Predict % speed degradation **per road segment**, not just "area around event"
- **Features:** Event type, footfall, venue capacity, day/time, road network topology, historical baselines
- **Output:** Speed degradation per segment + affected radius + duration estimate
- **Tech:** LightGBM trained on segment-event pairs from historical Astram data
- **Edge:** Reuses proven Round 1 LightGBM pipeline adapted for segment-level granularity

#### **Pillar 2: Operational Recommendations (The Differentiator)**
- **Manpower Allocation:** Rule-based lookup (footfall × road criticality → officer count)
- **Barricading Plan:** Identifies high-priority segments in event perimeter for barricade placement
- **Diversion Routes:** Pre-computed alternate routes ranked by capacity & detour length using OSMnx/NetworkX
- **Output:** Actionable deployment guidelines backed by network analysis

#### **Pillar 3: Post-Event Learning Loop (The Unique Angle)**
- **Feedback Collection:** Log actual vs predicted congestion after each event
- **Accuracy Tracking:** Per-event-type model performance dashboard
- **Concept:** System gets smarter after every event — judges love seeing this
- **Storage:** Simple JSON feedback log with metrics aggregation

---

## Repository Structure

```
gridlock-event-congestion/
├── README.md                      # This file
├── .gitignore                     # Ignore data, models, caches
├── backend/
│   ├── train_model.py            # Entry point for model training
│   ├── requirements.txt           # Backend dependencies
│   ├── models/                   # Saved ML models (.pkl)
│   └── app/
│       ├── main.py               # FastAPI app & routing
│       ├── api/
│       │   ├── forecast.py       # POST /api/forecast endpoint
│       │   └── feedback.py       # POST /api/feedback, GET /api/metrics
│       ├── core/
│       │   ├── model_pipeline.py # SegmentImpactModel (training & inference)
│       │   ├── recommendation.py # ManpowerRecommendation, Barricade, Routes
│       │   └── feedback.py       # FeedbackTracker (persistence)
│       └── services/
│           └── osm_service.py    # OSMnx graph loading & utilities
├── notebooks/                     # Jupyter notebooks (EDA, routing, training)
├── scripts/
│   └── download_osm_data.py      # Fetch Bengaluru OSM graph
├── data/
│   ├── raw/                      # Input: event CSV
│   └── processed/                # Output: bengaluru_drive.graphml
└── frontend/                      # React dashboard (built by teammate)
```

---

## Quick Start

### **Prerequisites**
- Python 3.9+
- pip / virtualenv
- ~2GB disk space for OSM graph + models

### **1. Install Dependencies**
```bash
cd gridlock-event-congestion
python -m pip install -r backend/requirements.txt
```

### **2. Download OSM Road Network**
```bash
python scripts/download_osm_data.py
```
Creates `data/processed/bengaluru_drive.graphml` (~500MB, one-time download).

### **3. Train the Model**
```bash
python backend/train_model.py
```
- Loads raw event data from `data/raw/Astram event data_anonymized*.csv`
- Extracts features for each event→segment pair
- Trains LightGBM (tuned hyperparameters from Round 1)
- Saves model to `backend/models/impact_model.pkl`
- **Time:** ~5–10 min on modern CPU

### **4. Start the API Server**
```bash
cd gridlock-event-congestion
uvicorn backend.app.main:app --reload --port 8000
```
- Runs on `http://127.0.0.1:8000`
- Interactive docs: `http://127.0.0.1:8000/docs`

### **5. Test an Endpoint**
```bash
curl -X POST http://127.0.0.1:8000/api/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "Concert",
    "expected_footfall": 25000,
    "venue_capacity": 40000,
    "day_of_week": "Saturday",
    "time_of_day": "18:30:00",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "corridor": "MG Road",
    "priority": "High"
  }'
```

---

## API Endpoints

### **POST `/api/forecast`**
Forecast segment-level impact and operational recommendations for an event.

**Request Body:**
```json
{
  "event_type": "Concert",
  "expected_footfall": 25000,
  "venue_capacity": 40000,
  "day_of_week": "Saturday",
  "time_of_day": "18:30:00",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "end_latitude": 12.9750,
  "end_longitude": 77.5950,
  "corridor": "MG Road",
  "priority": "High",
  "event_cause": "Concert"
}
```

**Response:**
```json
{
  "segments": [
    {
      "segment_id": "1234-5678-0",
      "road_name": "MG Road",
      "highway_type": "primary",
      "predicted_speed_degradation": 0.35,
      "affected_radius_m": 1500.0,
      "duration_min": 45,
      "distance_m": 250.5
    }
  ],
  "manpower": {
    "officer_count": 4,
    "signal_override": true,
    "rationale": "Footfall 25000 mapped to 4 officers; criticality score 4 triggers signal override."
  },
  "barricade_candidates": [
    {
      "segment_id": "1234-5679-0",
      "road_name": "Brigade Road",
      "highway_type": "secondary",
      "priority_score": 3,
      "distance_m": 180.0
    }
  ],
  "diversion_routes": [
    {
      "route_id": "route-1",
      "total_distance_m": 5200.0,
      "detour_ratio": 1.15,
      "capacity_score": 8,
      "path_nodes": [100, 101, 102, 103]
    }
  ]
}
```

### **POST `/api/feedback`**
Log actual vs predicted congestion after an event.

**Request Body:**
```json
{
  "event_id": "EVT-001",
  "event_type": "Concert",
  "predicted_speed_degradation": 0.35,
  "actual_speed_degradation": 0.32,
  "notes": "Actual impact was lower due to early police deployment."
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Feedback recorded."
}
```

### **GET `/api/metrics`**
Retrieve aggregated model accuracy per event type.

**Response:**
```json
{
  "metrics": [
    {
      "event_type": "Concert",
      "records": 12,
      "average_error": 0.0342,
      "last_updated": "2025-06-18T10:30:00Z"
    },
    {
      "event_type": "Cricket",
      "records": 8,
      "average_error": 0.0285,
      "last_updated": "2025-06-18T09:15:00Z"
    }
  ]
}
```

---

## Model Training Pipeline

### **Feature Engineering**
The model uses temporal, geospatial, and event features:

**Temporal Features:**
- Hour, minute, day of week
- Cyclical encoding: `sin/cos(hour/24)`, `sin/cos(day/7)`
- Rush hour / late night / off-peak flags
- Slot of day (hour × 4 + minute // 15)

**Geospatial Features:**
- Node latitude/longitude
- Lat-hour interaction: `lat × sin(hour)`
- Lat-lon combined: `lat × lon`

**Event Features:**
- Event type (concert, cricket, expo, political rally, unplanned)
- Expected footfall, venue capacity
- Event duration
- Corridor, priority, event cause

**Road Segment Features:**
- Edge length (meters)
- Max speed (kph)
- Number of lanes
- Highway type (motorway, trunk, primary, secondary, etc.)

### **Training Details**
- **Algorithm:** LightGBM Regressor
- **Hyperparameters (from Round 1):**
  - `num_leaves: 255`
  - `max_depth: 12`
  - `learning_rate: 0.02`
  - `n_estimators: 2000`
  - `subsample: 0.8`
  - `colsample_bytree: 0.8`
  - `reg_alpha: 0.05, reg_lambda: 1.0`
- **Preprocessing:**
  - OneHotEncoding for categorical features
  - StandardScaler for numeric features
- **Target:** Speed degradation (0.0–0.85) per segment
- **Synthetic Target:** Generated from event/segment rules if labels unavailable

### **Output**
- Serialized Pipeline (sklearn + LightGBM): `backend/models/impact_model.pkl`
- Can be loaded and used for batch predictions

---

## Project Architecture

### **Backend Stack**
| Component | Tech |
|-----------|------|
| Web Framework | FastAPI 0.129 |
| ASGI Server | Uvicorn 0.41 |
| ML Model | LightGBM 4.6 |
| Data Handling | Pandas 3.0, NumPy 2.4 |
| Road Network | OSMnx 2.1, NetworkX 3.6 |
| Validation | Pydantic 2.12 |

### **Data Flow**
```
Raw Event CSV
    ↓
Feature Engineering (temporal, geospatial, event, road)
    ↓
LightGBM Training (segment-level pairs)
    ↓
Serialized Model (.pkl)
    ↓
FastAPI /forecast Endpoint
    ↓
Predictions + Recommendations → Frontend / Client
    ↓
Feedback Log (actual vs predicted)
    ↓
Accuracy Metrics per Event Type
```

---

## Team Responsibilities

### **Backend (This Repo)**
- ✅ Model training pipeline
- ✅ Forecasting API (`/api/forecast`)
- ✅ Feedback & metrics API (`/api/feedback`, `/api/metrics`)
- ✅ Recommendation engine (manpower, barricades, routes)
- ✅ OSM graph integration

### **Frontend (React — Your Teammate)**
- [ ] Dashboard layout
- [ ] Event input form
- [ ] Forecast result visualization (map + tables)
- [ ] Manpower/barricade/routes display
- [ ] Feedback submission UI
- [ ] Metrics tracking view

**Frontend → Backend Integration:**
- `POST /api/forecast` with event details
- `GET /api/metrics` for accuracy tracking
- `POST /api/feedback` to log outcomes

---

## Handling Unplanned Events

Per the problem statement, unplanned events (accidents, VIP movement, flash gatherings) cannot be predicted directly.

**Our Approach:**
1. **Anomaly Detection:** Flag unusual live traffic patterns
2. **Rapid Response Playbook:** Pre-configured deployment templates
3. **Common Scenarios:** Playbooks for accident, VIP, flash gathering
4. **Fallback:** Escalate to manual control if confidence < threshold

---

## Development Notes

### **Project History**
- **Round 1:** Built segment-level demand model using LightGBM on Astram data
- **Round 2:** Adapted Round 1 pipeline for impact forecasting (speed degradation), added recommendations & feedback loop

### **Known Limitations**
- Model trained on synthetic targets (no ground-truth speed labels in raw data)
- Pre-computed routes; no real-time routing
- Single-city model (Bengaluru); not generalizable to other cities without retraining
- Feedback metrics aggregated, not used to retrain in real-time

### **Future Enhancements**
- [ ] Collect real speed degradation labels post-event
- [ ] Implement online learning (update model after each feedback)
- [ ] Multi-city model transfer learning
- [ ] Real-time route optimization
- [ ] Integration with live traffic feeds (Google Maps, HERE)

---

## Setup Troubleshooting

### **LightGBM ImportError**
If `ModuleNotFoundError: No module named 'lightgbm'`:
```bash
python -m pip install lightgbm --upgrade
```

### **OSM Graph Not Found**
```bash
python scripts/download_osm_data.py
```

### **API Server Won't Start**
- Check Python interpreter: same one where you ran `pip install -r backend/requirements.txt`
- Try:
```bash
cd gridlock-event-congestion
python -m uvicorn backend.app.main:app --reload --port 8000
```

### **Port 8000 Already in Use**
```bash
uvicorn backend.app.main:app --reload --port 8001
```

---

## Contact & Questions

For setup help or integration questions:
- Check `backend/requirements.txt` for dependency versions
- Review endpoint definitions in `backend/app/api/forecast.py` and `backend/app/api/feedback.py`
- Inspect model architecture in `backend/app/core/model_pipeline.py`
