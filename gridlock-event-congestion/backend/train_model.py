from pathlib import Path
import sys

# Ensure project root is on sys.path so `from backend...` imports work when
# running this script as `python backend/train_model.py` from the repo root.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.core.model_pipeline import SegmentImpactModel


if __name__ == "__main__":
    events_csv = Path("data/raw/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
    graph_path = Path("data/processed/bengaluru_drive.graphml")
    model = SegmentImpactModel(model_path=Path("backend/models/impact_model.pkl"))
    print("Starting training pipeline...")
    if not events_csv.exists():
        print(f"ERROR: events CSV not found at {events_csv}. Please place raw event data in data/raw/")
    elif not graph_path.exists():
        print(f"ERROR: OSM graph not found at {graph_path}. Run scripts/download_osm_data.py to fetch and save the graph.")
    else:
        try:
            model_path = model.train_and_save(events_csv=events_csv, graph_path=graph_path)
            print(f"Training complete. Model saved to {model_path}")
        except Exception as e:
            print(f"Training failed: {e}")
