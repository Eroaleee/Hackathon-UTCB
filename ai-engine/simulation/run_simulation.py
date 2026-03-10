"""
Load Bucharest bike network, run agent simulation, return GeoJSON heatmap.
Optionally accepts proposed new lanes (scenario_geojson) to simulate future state.
"""
import osmnx as ox
import networkx as nx
from shapely.geometry import shape
from agent_model import VeloModel

_cached_graph = None  # Cache the graph to avoid re-downloading every run


def get_bucharest_graph(scenario_geojson=None):
    global _cached_graph
    if _cached_graph is None:
        print("📥 Downloading Bucharest bike network from OSM (first run only)...")
        G = ox.graph_from_place("Bucharest, Romania", network_type="bike")
        G = ox.add_edge_speeds(G)
        G = ox.add_edge_travel_times(G)
        _cached_graph = G
        print(f"✅ Graph loaded: {len(G.nodes)} nodes, {len(G.edges)} edges")

    G = _cached_graph.copy()

    # If a scenario was provided (proposed new lanes), inject them into the graph
    if scenario_geojson:
        print("🔧 Injecting scenario lanes into graph...")
        for feature in scenario_geojson.get("features", []):
            geom = shape(feature["geometry"])
            if geom.geom_type == "LineString":
                coords = list(geom.coords)
                for i in range(len(coords) - 1):
                    u_lon, u_lat = coords[i]
                    v_lon, v_lat = coords[i + 1]
                    u = ox.nearest_nodes(G, u_lon, u_lat)
                    v = ox.nearest_nodes(G, v_lon, v_lat)
                    # Add edge with fast travel time (simulating a protected lane)
                    G.add_edge(u, v, travel_time=1, length=50, speed_kph=20)
    return G


def run(n_cyclists=200, steps=100, scenario_geojson=None):
    G = get_bucharest_graph(scenario_geojson)
    print(f"🚴 Running simulation: {n_cyclists} cyclists × {steps} steps...")
    model = VeloModel(G, n_cyclists=n_cyclists)
    edge_usage = model.run(steps=steps)
    print(f"✅ Simulation complete. {len(edge_usage)} edges used.")

    features = []
    for (u, v), count in edge_usage.items():
        try:
            if G.has_edge(u, v):
                edge_data = list(G[u][v].values())[0]
                if "geometry" in edge_data:
                    coords = list(edge_data["geometry"].coords)
                else:
                    coords = [(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "usage_count": count,
                        "intensity": min(count / 20.0, 1.0)
                    }
                })
        except Exception:
            continue
    return {"type": "FeatureCollection", "features": features}
