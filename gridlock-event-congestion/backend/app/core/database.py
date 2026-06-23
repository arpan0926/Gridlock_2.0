"""
SQLite database manager for Gridlock 2.0.

Stores forecast results and feedback persistently so data survives
page navigations and server restarts.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
import os
from pathlib import Path

BASE_DIR = Path(os.path.abspath(os.path.dirname(__file__))).parents[2]

MODEL_PATH = BASE_DIR / "models" / "impact_model.pkl"
GRAPH_PATH = BASE_DIR / "data" / "processed" / "bengaluru_drive.graphml" 
DB_PATH = BASE_DIR / "gridlock.db"


def get_connection() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory set."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS forecasts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type      TEXT NOT NULL,
            expected_footfall INTEGER,
            venue_capacity  INTEGER,
            day_of_week     TEXT,
            time_of_day     TEXT,
            latitude        REAL,
            longitude       REAL,
            corridor        TEXT,
            priority        TEXT,
            avg_degradation REAL,
            max_degradation REAL,
            officer_count   INTEGER,
            barricade_count INTEGER,
            segment_count   INTEGER,
            diversion_count INTEGER DEFAULT 0,
            full_response   TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS feedback (
            id                          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id                    TEXT,
            event_type                  TEXT NOT NULL,
            predicted_speed_degradation REAL NOT NULL,
            actual_speed_degradation    REAL NOT NULL,
            error                       REAL NOT NULL,
            notes                       TEXT,
            created_at                  TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Forecast helpers
# ---------------------------------------------------------------------------

def save_forecast(input_data: Dict, response_data: Dict) -> int:
    """Persist a forecast run. Returns the new row ID."""
    segments = response_data.get("segments", [])
    degradations = [s.get("predicted_speed_degradation", 0) for s in segments]
    avg_deg = sum(degradations) / len(degradations) if degradations else 0.0
    max_deg = max(degradations) if degradations else 0.0

    manpower = response_data.get("manpower", {})
    barricades = response_data.get("barricade_candidates", [])
    diversions = response_data.get("diversion_routes", [])

    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO forecasts (
            event_type, expected_footfall, venue_capacity, day_of_week,
            time_of_day, latitude, longitude, corridor, priority,
            avg_degradation, max_degradation, officer_count,
            barricade_count, segment_count, diversion_count,
            full_response, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            input_data.get("event_type", ""),
            input_data.get("expected_footfall", 0),
            input_data.get("venue_capacity", 0),
            input_data.get("day_of_week", ""),
            input_data.get("time_of_day", ""),
            input_data.get("latitude", 0.0),
            input_data.get("longitude", 0.0),
            input_data.get("corridor", ""),
            input_data.get("priority", ""),
            round(avg_deg, 6),
            round(max_deg, 6),
            manpower.get("officer_count", 0) if isinstance(manpower, dict) else 0,
            len(barricades),
            len(segments),
            len(diversions),
            json.dumps(response_data, default=str),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_forecasts(limit: int = 50) -> List[Dict]:
    """Return recent forecast summaries (without full_response)."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, event_type, expected_footfall, venue_capacity, day_of_week,
               time_of_day, latitude, longitude, corridor, priority,
               avg_degradation, max_degradation, officer_count,
               barricade_count, segment_count, diversion_count, created_at
        FROM forecasts
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_forecast_by_id(forecast_id: int) -> Optional[Dict]:
    """Return a single forecast with full response."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM forecasts WHERE id = ?", (forecast_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    result = dict(row)
    if result.get("full_response"):
        result["full_response"] = json.loads(result["full_response"])
    return result


# ---------------------------------------------------------------------------
# Feedback helpers
# ---------------------------------------------------------------------------

def save_feedback(feedback: Dict) -> int:
    """Persist a feedback entry. Returns the new row ID."""
    predicted = float(feedback["predicted_speed_degradation"])
    actual = float(feedback["actual_speed_degradation"])
    error = abs(actual - predicted)

    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO feedback (
            event_id, event_type, predicted_speed_degradation,
            actual_speed_degradation, error, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            feedback.get("event_id"),
            feedback["event_type"],
            predicted,
            actual,
            round(error, 6),
            feedback.get("notes", ""),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_feedback_history(limit: int = 100) -> List[Dict]:
    """Return all feedback entries, newest first."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, event_id, event_type, predicted_speed_degradation,
               actual_speed_degradation, error, notes, created_at
        FROM feedback
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_feedback_metrics() -> List[Dict]:
    """Aggregate feedback by event_type for analytics."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT
            event_type,
            COUNT(*) as records,
            ROUND(AVG(error), 4) as average_error,
            MAX(created_at) as last_updated
        FROM feedback
        GROUP BY event_type
        ORDER BY records DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_forecast_analytics() -> Dict:
    """Return aggregate stats from the forecasts table for the analytics page."""
    conn = get_connection()

    # Total forecasts
    total = conn.execute("SELECT COUNT(*) as cnt FROM forecasts").fetchone()["cnt"]

    # By event type
    by_type = conn.execute(
        """
        SELECT event_type, COUNT(*) as count,
               ROUND(AVG(avg_degradation), 4) as avg_deg,
               ROUND(AVG(officer_count), 1) as avg_officers
        FROM forecasts
        GROUP BY event_type
        ORDER BY count DESC
        """
    ).fetchall()

    # Recent 30 for trend
    recent = conn.execute(
        """
        SELECT id, event_type, avg_degradation, officer_count, created_at
        FROM forecasts
        ORDER BY id DESC
        LIMIT 30
        """
    ).fetchall()

    conn.close()
    return {
        "total_forecasts": total,
        "by_event_type": [dict(r) for r in by_type],
        "recent_forecasts": [dict(r) for r in recent],
    }


# Auto-initialise tables on import
init_db()
