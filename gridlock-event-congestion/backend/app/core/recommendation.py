from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import networkx as nx
import osmnx as ox


@dataclass
class ManpowerRecommendation:
    officer_count: int
    signal_override: bool
    rationale: str


@dataclass
class BarricadeCandidate:
    segment_id: str
    road_name: str
    highway_type: str
    priority_score: int
    distance_m: float


@dataclass
class DiversionRoute:
    route_id: str
    total_distance_m: float
    detour_ratio: float
    capacity_score: int
    path_nodes: List[int]


class RecommendationEngine:
    HIGH_FOOTFALL = 50000
    MEDIUM_FOOTFALL = 20000

    def road_criticality_score(self, corridor: Optional[str], priority: Optional[str]) -> int:
        score = 2
        if corridor and corridor.lower() not in ["non-corridor", "unknown", "nan"]:
            score += 2
        if priority and priority.lower() == "high":
            score += 2
        elif priority and priority.lower() == "medium":
            score += 1
        return min(5, score)

    def calculate_manpower(self, expected_footfall: int, criticality_score: int) -> ManpowerRecommendation:
        base = 1
        if expected_footfall >= self.HIGH_FOOTFALL:
            base = 4
        elif expected_footfall >= self.MEDIUM_FOOTFALL:
            base = 3
        else:
            base = 2

        if criticality_score >= 4:
            base += 1

        signal_override = criticality_score >= 4
        rationale = (
            f"Footfall {expected_footfall} mapped to {base} officers; "
            f"criticality score {criticality_score} triggers {'signal override' if signal_override else 'standard deployment'}."
        )
        return ManpowerRecommendation(officer_count=base, signal_override=signal_override, rationale=rationale)

    def generate_barricade_candidates(
        self,
        graph: nx.MultiDiGraph,
        latitude: float,
        longitude: float,
        radius_m: int = 1000,
        limit: int = 6,
    ) -> List[BarricadeCandidate]:
        # find nearest node and collect nodes within radius
        try:
            center_node = ox.distance.nearest_nodes(graph, longitude, latitude)
        except Exception:
            center_node = ox.get_nearest_node(graph, (latitude, longitude))

        center_attr = graph.nodes.get(center_node, {})
        center_lat = float(center_attr.get("y", center_attr.get("lat", latitude)))
        center_lon = float(center_attr.get("x", center_attr.get("lon", longitude)))

        nodes_in_radius = set()
        for n, data in graph.nodes(data=True):
            lat = data.get("y", data.get("lat", None))
            lon = data.get("x", data.get("lon", None))
            if lat is None or lon is None:
                continue
            try:
                dist = ox.distance.great_circle_vec(center_lat, center_lon, float(lat), float(lon))
            except Exception:
                dist = ((center_lat - float(lat)) ** 2 + (center_lon - float(lon)) ** 2) ** 0.5 * 111000
            if dist <= radius_m:
                nodes_in_radius.add(n)

        candidates = []
        for u, v, key, edge_data in graph.edges(keys=True, data=True):
            if u not in nodes_in_radius and v not in nodes_in_radius:
                continue
            highway_type = self._highway_type(edge_data)
            score = self._barricade_priority(highway_type, edge_data)
            road_name = self._road_name(edge_data)
            candidates.append(
                BarricadeCandidate(
                    segment_id=f"{u}-{v}-{key}",
                    road_name=road_name,
                    highway_type=highway_type,
                    priority_score=score,
                    distance_m=float(edge_data.get("length", 0.0)),
                )
            )

        candidates.sort(key=lambda item: item.priority_score, reverse=True)
        return candidates[:limit]

    def plan_alternate_routes(
        self,
        graph: nx.MultiDiGraph,
        origin: Tuple[float, float],
        destination: Optional[Tuple[float, float]],
        max_paths: int = 3,
    ) -> List[DiversionRoute]:
        if destination is None:
            return []

        origin_node = ox.distance.nearest_nodes(graph, origin[1], origin[0])
        dest_node = ox.distance.nearest_nodes(graph, destination[1], destination[0])

        try:
            paths = nx.shortest_simple_paths(graph, origin_node, dest_node, weight="length")
        except Exception:
            return []

        routes = []
        for idx, path in enumerate(paths):
            if idx >= max_paths:
                break
            distance = self._route_length(graph, path)
            detour = distance / max(1.0, self._direct_line_distance(origin, destination))
            capacity = self._route_capacity(graph, path)
            routes.append(
                DiversionRoute(
                    route_id=f"route-{idx + 1}",
                    total_distance_m=distance,
                    detour_ratio=round(detour, 2),
                    capacity_score=capacity,
                    path_nodes=list(path),
                )
            )

        return routes

    def _barricade_priority(self, highway_type: str, edge_data: Dict) -> int:
        score = 1
        if highway_type in ["motorway", "trunk", "primary"]:
            score += 3
        elif highway_type in ["secondary", "tertiary"]:
            score += 2
        if edge_data.get("highway") == "service":
            score -= 1
        if edge_data.get("length", 0.0) < 120:
            score += 1
        return max(1, score)

    def _route_length(self, graph: nx.MultiDiGraph, path: List[int]) -> float:
        total = 0.0
        for u, v in zip(path[:-1], path[1:]):
            edge_data = graph.get_edge_data(u, v)
            if edge_data:
                edge = next(iter(edge_data.values()))
                total += float(edge.get("length", 0.0))
        return total

    def _route_capacity(self, graph: nx.MultiDiGraph, path: List[int]) -> int:
        score = 0
        for u, v in zip(path[:-1], path[1:]):
            edge_data = graph.get_edge_data(u, v)
            if edge_data:
                edge = next(iter(edge_data.values()))
                highway_type = self._highway_type(edge)
                if highway_type in ["motorway", "trunk", "primary"]:
                    score += 3
                elif highway_type in ["secondary", "tertiary"]:
                    score += 2
                else:
                    score += 1
        return max(1, min(10, score // len(path)))

    @staticmethod
    def _direct_line_distance(origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        return ox.distance.great_circle_vec(origin[0], origin[1], destination[0], destination[1])

    @staticmethod
    def _road_name(edge_data: Dict) -> str:
        names = edge_data.get("name")
        if isinstance(names, list):
            return names[0] if names else "unknown"
        return str(names) if names else "unknown"

    @staticmethod
    def _highway_type(edge_data: Dict) -> str:
        highway = edge_data.get("highway")
        if isinstance(highway, list):
            highway = highway[0]
        return str(highway) if highway else "unclassified"
