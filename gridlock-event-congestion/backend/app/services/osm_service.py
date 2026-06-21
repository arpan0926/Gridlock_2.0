from pathlib import Path
from typing import Optional

import numpy as np
import networkx as nx
import osmnx as ox


class OSMGraphService:
    def __init__(self, graph_path: Optional[Path] = None):
        self.graph_path = graph_path
        self._graph = None
        self._node_ids = None
        self._node_lats = None
        self._node_lons = None

    def load_graph(self) -> Optional[nx.MultiDiGraph]:
        if self._graph is not None:
            return self._graph
        if self.graph_path is None:
            return None
        if not Path(self.graph_path).exists():
            return None
        self._graph = ox.load_graphml(str(self.graph_path))
        self._build_spatial_index()
        return self._graph

    def _build_spatial_index(self):
        """Pre-build numpy arrays of node coords for fast vectorized distance queries."""
        nodes = self._graph.nodes(data=True)
        ids, lats, lons = [], [], []
        for n, data in nodes:
            lat = data.get("y", data.get("lat"))
            lon = data.get("x", data.get("lon"))
            if lat is not None and lon is not None:
                ids.append(n)
                lats.append(float(lat))
                lons.append(float(lon))
        self._node_ids = np.array(ids)
        self._node_lats = np.radians(np.array(lats))
        self._node_lons = np.radians(np.array(lons))

    def nearest_node(self, latitude: float, longitude: float, graph: nx.MultiDiGraph) -> int:
        try:
            return ox.distance.nearest_nodes(graph, longitude, latitude)
        except Exception:
            return ox.get_nearest_node(graph, (latitude, longitude))

    def nearby_subgraph(self, graph: nx.MultiDiGraph, node: int, radius_m: int) -> nx.MultiDiGraph:
        node_attr = graph.nodes.get(node, {})
        if not node_attr:
            return graph.subgraph([]).copy()
        center_lat = float(node_attr.get("y", node_attr.get("lat", 0.0)))
        center_lon = float(node_attr.get("x", node_attr.get("lon", 0.0)))

        # Use pre-built numpy arrays for vectorized haversine — avoids 155k Python loop iterations
        if self._node_ids is not None:
            clat = np.radians(center_lat)
            clon = np.radians(center_lon)
            dlat = self._node_lats - clat
            dlon = self._node_lons - clon
            a = np.sin(dlat / 2) ** 2 + np.cos(clat) * np.cos(self._node_lats) * np.sin(dlon / 2) ** 2
            dist_m = 2 * 6_371_000 * np.arcsin(np.sqrt(a))
            selected_nodes = self._node_ids[dist_m <= radius_m].tolist()
        else:
            # Fallback if index not built (e.g. OSMGraphService(graph_path=None) used inline)
            selected_nodes = []
            for n, data in graph.nodes(data=True):
                lat = data.get("y", data.get("lat"))
                lon = data.get("x", data.get("lon"))
                if lat is None or lon is None:
                    continue
                dlat = np.radians(float(lat) - center_lat)
                dlon = np.radians(float(lon) - center_lon)
                a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(center_lat)) * np.cos(np.radians(float(lat))) * np.sin(dlon / 2) ** 2
                if 2 * 6_371_000 * np.arcsin(np.sqrt(a)) <= radius_m:
                    selected_nodes.append(n)

        return graph.subgraph(selected_nodes).copy()

    def graph_stats(self, graph: nx.MultiDiGraph) -> dict:
        return {
            "nodes": len(graph.nodes),
            "edges": len(graph.edges),
        }
