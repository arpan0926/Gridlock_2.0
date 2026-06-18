import json
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import lightgbm as lgb
import networkx as nx
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from backend.app.services.osm_service import OSMGraphService


class SegmentImpactModel:
    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path
        self.pipeline: Optional[Pipeline] = None
        if model_path and model_path.exists():
            self.load_model()

    def load_model(self):
        with open(self.model_path, "rb") as handle:
            self.pipeline = pd.read_pickle(handle)

    def save_model(self, pipeline: Pipeline):
        self.pipeline = pipeline
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as handle:
            pd.to_pickle(self.pipeline, handle)

    def build_training_data(self, events_csv: Path, graph_path: Path, max_events: int = 1200) -> pd.DataFrame:
        df = pd.read_csv(events_csv, low_memory=False)
        df = df.dropna(subset=["latitude", "longitude"])
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        df = df.head(max_events)

        osm_service = OSMGraphService(graph_path=graph_path)
        graph = osm_service.load_graph()
        if graph is None:
            raise FileNotFoundError("Bengaluru road network graph is required for training.")

        records = []
        for _, row in df.iterrows():
            base = self._event_base_features(row)
            if base is None:
                continue

            node = osm_service.nearest_node(row["latitude"], row["longitude"], graph)
            if node is None:
                continue

            # attach node coordinates for geospatial features
            node_attr = graph.nodes.get(node, {})
            node_lat = float(node_attr.get("y", row.get("latitude")))
            node_lon = float(node_attr.get("x", row.get("longitude")))
            base["lat"] = node_lat
            base["lon"] = node_lon
            # compute simple interactions used in Round1 pipeline
            if "hour_sin" in base:
                base["lat_hour_interaction"] = base["lat"] * base.get("hour_sin", 0.0)
                base["lon_hour_interaction"] = base["lon"] * base.get("hour_cos", 0.0)
            if "lat" in base and "lon" in base:
                base["lat_lon_combined"] = base["lat"] * base["lon"]

            subgraph = osm_service.nearby_subgraph(graph, node, radius_m=1000)
            for u, v, key, edge_data in subgraph.edges(keys=True, data=True):
                features = {**base, **self._edge_features(edge_data)}
                features["target_speed_degradation"] = self._synthetic_segment_target(features)
                records.append(features)

        return pd.DataFrame(records)

    def train_model(self, training_df: pd.DataFrame) -> Pipeline:
        training_df = training_df.dropna(subset=["target_speed_degradation"])
        X = training_df.drop(columns=["target_speed_degradation"])
        y = training_df["target_speed_degradation"].clip(0.0, 0.85)

        categorical_features = [
            "event_type",
            "event_cause",
            "corridor",
            "priority",
            "day_of_week",
            "highway_type",
        ]
        numeric_features = [
            "expected_footfall",
            "venue_capacity",
            "event_duration_min",
            "historical_speed_kph",
            "edge_length_m",
            "maxspeed_kph",
            "lanes",
            "road_criticality",
        ]

        # OneHotEncoder changed parameter name between sklearn versions (sparse -> sparse_output)
        try:
            ohe = OneHotEncoder(handle_unknown="ignore", sparse=False)
        except TypeError:
            ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", ohe, categorical_features),
                ("num", StandardScaler(), numeric_features),
            ],
            remainder="drop",
        )

        # Use Round1-proven LightGBM hyperparameters (adapted)
        model = lgb.LGBMRegressor(
            num_leaves=255,
            max_depth=12,
            min_child_samples=10,
            n_estimators=2000,
            learning_rate=0.02,
            subsample=0.8,
            subsample_freq=1,
            colsample_bytree=0.8,
            reg_alpha=0.05,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )

        pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("regressor", model)])
        pipeline.fit(X, y)
        return pipeline

    def train_and_save(self, events_csv: Path, graph_path: Path):
        training_df = self.build_training_data(events_csv, graph_path)
        pipeline = self.train_model(training_df)
        self.save_model(pipeline)
        return self.model_path

    def predict_segment_impacts(self, input_data, graph: nx.MultiDiGraph, radius_m: int = 1200, limit: int = 10) -> List[Dict]:
        if self.pipeline is None:
            raise RuntimeError("Impact model is not loaded.")

        dummy_row = self._event_base_features(input_data.__dict__)
        node = OSMGraphService(graph_path=None).nearest_node(input_data.latitude, input_data.longitude, graph)
        node_attr = graph.nodes.get(node, {})
        node_lat = float(node_attr.get("y", input_data.latitude))
        node_lon = float(node_attr.get("x", input_data.longitude))
        dummy_row["lat"] = node_lat
        dummy_row["lon"] = node_lon
        if "hour_sin" in dummy_row:
            dummy_row["lat_hour_interaction"] = dummy_row["lat"] * dummy_row.get("hour_sin", 0.0)
            dummy_row["lon_hour_interaction"] = dummy_row["lon"] * dummy_row.get("hour_cos", 0.0)
        dummy_row["lat_lon_combined"] = dummy_row["lat"] * dummy_row["lon"]

        subgraph = OSMGraphService(graph_path=None).nearby_subgraph(graph, node, radius_m)

        candidates = []
        for u, v, key, edge_data in subgraph.edges(keys=True, data=True):
            features = {**dummy_row, **self._edge_features(edge_data)}
            X = pd.DataFrame([features])
            predicted = float(self.pipeline.predict(X)[0])
            candidates.append(
                {
                    "segment_id": f"{u}-{v}-{key}",
                    "road_name": self._road_name(edge_data),
                    "highway_type": self._highway_type(edge_data),
                    "predicted_speed_degradation": round(predicted, 3),
                    "affected_radius_m": round(radius_m * min(1.0, predicted + 0.25), 1),
                    "duration_min": max(10, int(predicted * 80 + 20)),
                    "distance_m": float(edge_data.get("length", 0.0)),
                }
            )

        candidates = sorted(candidates, key=lambda item: item["predicted_speed_degradation"], reverse=True)
        return [c for c in candidates[:limit]]

    def _event_base_features(self, row: Dict) -> Optional[Dict]:
        event_type = str(row.get("event_type", "unknown")).strip().lower()
        if event_type == "nan" or event_type == "":
            event_type = "unplanned"

        expected_footfall = int(row.get("expected_footfall", 4000)) if row.get("expected_footfall") not in [None, "", "nan"] else self._estimate_footfall(event_type)
        venue_capacity = int(row.get("venue_capacity", 20000)) if row.get("venue_capacity") not in [None, "", "nan"] else self._estimate_capacity(event_type)

        start_ts = self._parse_datetime(row.get("start_datetime"))
        end_ts = self._parse_datetime(row.get("end_datetime"))
        duration_min = int((end_ts - start_ts).total_seconds() / 60) if end_ts and start_ts else 60

        # temporal features similar to Round1 pipeline
        hour = start_ts.hour if start_ts else 0
        minute = start_ts.minute if start_ts else 0
        day = start_ts.day if start_ts else 0
        slot_of_day = hour * 4 + (minute // 15)
        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        minute_sin = np.sin(2 * np.pi * minute / 60)
        minute_cos = np.cos(2 * np.pi * minute / 60)
        day_sin = np.sin(2 * np.pi * (day % 7) / 7)
        day_cos = np.cos(2 * np.pi * (day % 7) / 7)

        base = {
            "event_type": event_type,
            "event_cause": str(row.get("event_cause", "unknown")).strip().lower(),
            "corridor": str(row.get("corridor", "non-corridor")).strip().lower(),
            "priority": str(row.get("priority", "medium")).strip().lower(),
            "expected_footfall": expected_footfall,
            "venue_capacity": venue_capacity,
            "day_of_week": start_ts.strftime("%A").lower() if start_ts else "unknown",
            "event_duration_min": max(15, duration_min),
            "historical_speed_kph": float(row.get("historical_speed_kph", 40.0)),
            "road_criticality": float(self._road_criticality_score(row.get("priority", "medium"))),
            # Round1 temporal fields
            "hour": int(hour),
            "minute": int(minute),
            "day": int(day),
            "slot_of_day": int(slot_of_day),
            "hour_sin": float(hour_sin),
            "hour_cos": float(hour_cos),
            "minute_sin": float(minute_sin),
            "minute_cos": float(minute_cos),
            "day_sin": float(day_sin),
            "day_cos": float(day_cos),
        }

        # geospatial placeholders (filled later when node is known)
        base.setdefault("lat", np.nan)
        base.setdefault("lon", np.nan)
        base.setdefault("lat_hour_interaction", 0.0)
        base.setdefault("lon_hour_interaction", 0.0)
        base.setdefault("lat_lon_combined", 0.0)

        return base

    def _edge_features(self, edge_data: Dict) -> Dict:
        maxspeed = self._parse_maxspeed(edge_data.get("maxspeed", None))
        lanes = self._parse_lanes(edge_data.get("lanes", None))
        highway_type = self._highway_type(edge_data)

        return {
            "edge_length_m": float(edge_data.get("length", 0.0)),
            "maxspeed_kph": float(maxspeed if maxspeed is not None else 40.0),
            "lanes": float(lanes if lanes is not None else 1.0),
            "highway_type": highway_type,
        }

    def _road_name(self, edge_data: Dict) -> str:
        names = edge_data.get("name")
        if isinstance(names, list):
            return names[0]
        return str(names) if names else "unknown"

    def _highway_type(self, edge_data: Dict) -> str:
        highway = edge_data.get("highway")
        if isinstance(highway, list):
            highway = highway[0]
        return str(highway) if highway else "unclassified"

    @staticmethod
    def _parse_maxspeed(value):
        if value is None:
            return None
        if isinstance(value, list):
            value = value[0]
        try:
            return float(str(value).split()[0])
        except Exception:
            return None

    @staticmethod
    def _parse_lanes(value):
        if value is None:
            return None
        if isinstance(value, list):
            value = value[0]
        try:
            return float(str(value).split()[0])
        except Exception:
            return None

    def _estimate_footfall(self, event_type: str) -> int:
        mapping = {
            "concert": 25000,
            "cricket": 45000,
            "expo": 18000,
            "political rally": 30000,
            "unplanned": 1200,
        }
        return mapping.get(event_type.lower(), 6000)

    def _estimate_capacity(self, event_type: str) -> int:
        mapping = {
            "concert": 40000,
            "cricket": 75000,
            "expo": 25000,
            "political rally": 60000,
            "unplanned": 5000,
        }
        return mapping.get(event_type.lower(), 20000)

    @staticmethod
    def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
        if value is None or str(value).strip().lower() in ["nan", ""]:
            return None
        for fmt in ["%Y-%m-%d %H:%M:%S.%f%z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"]:
            try:
                return datetime.strptime(str(value), fmt)
            except Exception:
                continue
        return None

    def _road_criticality_score(self, priority: str) -> float:
        mapping = {"high": 5.0, "medium": 3.0, "low": 1.5}
        return mapping.get(str(priority).lower(), 3.0)

    def _synthetic_segment_target(self, features: Dict) -> float:
        base = 0.08
        priority = features.get("priority", "medium")
        if priority == "high":
            base += 0.20
        elif priority == "low":
            base += 0.02

        event_type = features.get("event_type", "unplanned")
        if event_type in ["concert", "cricket"]:
            base += 0.10
        elif event_type == "political rally":
            base += 0.12
        elif event_type == "unplanned":
            base += 0.15

        if features.get("highway_type", "").lower() in ["motorway", "trunk", "primary"]:
            base += 0.08

        if features.get("maxspeed_kph", 40) >= 80:
            base += 0.04

        length_km = features.get("edge_length_m", 0.0) / 1000.0
        base += min(0.12, 0.02 * length_km)
        base += 0.001 * max(0, 60 - features.get("historical_speed_kph", 40))
        return float(min(0.85, max(0.04, base + random.uniform(-0.02, 0.02))))
