import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import os
from pathlib import Path

# Set the base directory to the root of the 'backend' folder
BASE_DIR = Path(os.path.abspath(os.path.dirname(__file__))).parents[2]

# Now paths will safely resolve no matter where Docker puts them
MODEL_PATH = BASE_DIR / "models" / "impact_model.pkl"
GRAPH_PATH = BASE_DIR / "data" / "processed" / "bengaluru_drive.graphml" 
DB_PATH = BASE_DIR / "gridlock.db"

class FeedbackTracker:
    def __init__(self, storage_path: Path = None):
        self.storage_path = storage_path or Path(__file__).resolve().parents[3] / "backend" / "feedback_log.json"
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.storage_path.exists():
            self.storage_path.write_text(json.dumps({"feedback": []}, indent=2), encoding="utf-8")

    def log_feedback(self, feedback: Dict):
        data = self._read_storage()
        payload = {
            "event_id": feedback.get("event_id"),
            "event_type": feedback["event_type"],
            "predicted_speed_degradation": float(feedback["predicted_speed_degradation"]),
            "actual_speed_degradation": float(feedback["actual_speed_degradation"]),
            "error": abs(float(feedback["actual_speed_degradation"]) - float(feedback["predicted_speed_degradation"])),
            "notes": feedback.get("notes", ""),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        data["feedback"].append(payload)
        self._write_storage(data)

    def summary_metrics(self) -> List[Dict]:
        data = self._read_storage()
        if not data.get("feedback"):
            return []

        grouped = {}
        for record in data["feedback"]:
            event_type = record["event_type"]
            grouped.setdefault(event_type, []).append(record)

        metrics = []
        for event_type, records in grouped.items():
            avg_error = sum(r["error"] for r in records) / len(records)
            metrics.append(
                {
                    "event_type": event_type,
                    "records": len(records),
                    "average_error": round(avg_error, 4),
                    "last_updated": records[-1]["timestamp"],
                }
            )
        return metrics

    def _read_storage(self) -> Dict:
        with open(self.storage_path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_storage(self, data: Dict):
        with open(self.storage_path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
