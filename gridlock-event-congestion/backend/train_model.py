from pathlib import Path
import sys

# Ensure project root is on sys.path so `from backend...` imports work when
# running this script as `python backend/train_model.py` from the repo root.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.core.model_pipeline import SegmentImpactModel
from sklearn.metrics import r2_score, mean_squared_error
import numpy as np


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
            print("Building training data...")
            training_df = model.build_training_data(events_csv=events_csv, graph_path=graph_path)
            print(f"Training samples: {len(training_df)}")
            
            print("Training model...")
            pipeline = model.train_model(training_df)
            
            # Compute metrics on training set
            training_df_clean = training_df.dropna(subset=["target_speed_degradation"])
            X = training_df_clean.drop(columns=["target_speed_degradation"])
            y_true = training_df_clean["target_speed_degradation"].clip(0.0, 0.85)
            y_pred = pipeline.predict(X)
            
            r2 = r2_score(y_true, y_pred)
            rmse = np.sqrt(mean_squared_error(y_true, y_pred))
            mae = np.mean(np.abs(y_true - y_pred))
            
            print(f"\n{'='*50}")
            print(f"Training Metrics:")
            print(f"  R² Score:  {r2:.4f}")
            print(f"  RMSE:      {rmse:.6f}")
            print(f"  MAE:       {mae:.6f}")
            print(f"{'='*50}\n")
            
            model.save_model(pipeline)
            model_path = model.model_path
            print(f"Training complete. Model saved to {model_path}")
        except Exception as e:
            print(f"Training failed: {e}")
            import traceback
            traceback.print_exc()

