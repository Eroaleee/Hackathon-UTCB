"""
Agent-Based Simulation for cyclist behavior in Bucharest.
Each agent = one cyclist traveling origin → destination via the bike network.
Edge usage count = basis for heatmap (high count = high demand corridor).
"""
import mesa
import networkx as nx
import random


class CyclistAgent(mesa.Agent):
    def __init__(self, model, origin, destination):
        super().__init__(model)
        self.origin = origin
        self.destination = destination
        self.current_node = origin
        self.path = []
        self.completed = False

    def step(self):
        if self.completed:
            return
        if not self.path:
            try:
                self.path = nx.shortest_path(
                    self.model.graph, self.current_node, self.destination, weight="travel_time"
                )
                self.path.pop(0)  # Remove current node
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                self.completed = True
                return
        if self.path:
            next_node = self.path.pop(0)
            edge_key = (min(self.current_node, next_node), max(self.current_node, next_node))
            self.model.edge_usage[edge_key] = self.model.edge_usage.get(edge_key, 0) + 1
            self.current_node = next_node
        if self.current_node == self.destination:
            self.completed = True


class VeloModel(mesa.Model):
    def __init__(self, graph, n_cyclists=200):
        super().__init__()
        self.graph = graph
        self.edge_usage: dict = {}
        nodes = list(graph.nodes)
        for i in range(n_cyclists):
            origin = random.choice(nodes)
            dest = random.choice(nodes)
            if origin != dest:
                agent = CyclistAgent(self, origin, dest)

    def step(self):
        self.agents.shuffle_do("step")

    def run(self, steps=100):
        for _ in range(steps):
            self.step()
        return self.edge_usage
