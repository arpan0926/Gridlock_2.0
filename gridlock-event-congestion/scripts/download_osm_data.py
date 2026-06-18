import osmnx as ox

if __name__ == "__main__":
    place_name = "Bengaluru, India"
    graph = ox.graph_from_place(place_name, network_type="drive")
    ox.save_graphml(graph, "data/processed/bengaluru_drive.graphml")
    print(f"Saved {place_name} road network graph to data/processed/bengaluru_drive.graphml")
