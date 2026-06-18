from pathlib import Path
from typing import Optional, Tuple

import networkx as nx
import osmnx as ox


class OSMGraphService:
    def __init__(self, graph_path: Optional[Path] = None):
        self.graph_path = graph_path
        self._graph = None

    def load_graph(self) -> Optional[nx.MultiDiGraph]:
        if self._graph is not None:
            return self._graph
        if self.graph_path is None:
            return None
        if not Path(self.graph_path).exists():
            raise FileNotFoundError(f"OSM graph not found at {self.graph_path}")
        self._graph = ox.load_graphml(str(self.graph_path))
        return self._graph

    def nearest_node(self, latitude: float, longitude: float, graph: nx.MultiDiGraph) -> int:
        # ox.distance.nearest_nodes expects (G, X, Y) => (graph, lon, lat)
        try:
            return ox.distance.nearest_nodes(graph, longitude, latitude)
        except Exception:
            # fallback to OSMnx deprecated API name
            return ox.get_nearest_node(graph, (latitude, longitude))

    def nearby_subgraph(self, graph: nx.MultiDiGraph, node: int, radius_m: int) -> nx.MultiDiGraph:
        # Build an induced subgraph of nodes within radius_m meters of the node
        node_attr = graph.nodes.get(node, {})
        if not node_attr:
            return graph.subgraph([]).copy()
        center_lat = float(node_attr.get("y", node_attr.get("lat", 0.0)))
        center_lon = float(node_attr.get("x", node_attr.get("lon", 0.0)))

        selected_nodes = []
        for n, data in graph.nodes(data=True):
            lat = float(data.get("y", data.get("lat", None)))
            lon = float(data.get("x", data.get("lon", None)))
            if lat is None or lon is None:
                continue
            try:
                dist = ox.distance.great_circle_vec(center_lat, center_lon, lat, lon)
            except Exception:
                # fallback: approximate using simple euclidean on degrees (not ideal)
                dist = ((center_lat - lat) ** 2 + (center_lon - lon) ** 2) ** 0.5 * 111000
            if dist <= radius_m:
                selected_nodes.append(n)

        return graph.subgraph(selected_nodes).copy()

    def graph_stats(self, graph: nx.MultiDiGraph) -> dict:
        return {
            "nodes": len(graph.nodes),
            "edges": len(graph.edges),
        }
