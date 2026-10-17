import pandas as pd
import numpy as np
import networkx as nx
import json
from community import community_louvain
from typing import List, Dict, Any, Tuple, Set
from config import (
    HUB_MIN_OUT_DEGREE,
    DRAIN_MIN_INFLOW_ETH,
    GAS_FUNDER_MAX_AMOUNT,
    GAS_FUNDER_MIN_TARGETS,
    BRIDGE_AMOUNT_TOLERANCE,
    BRIDGE_TIME_WINDOW_SEC
)

class LedgerGraph:
    def __init__(self, tx_path: str):
        self.df = pd.read_csv(tx_path)
        self.graph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self):
        """Builds the directed graph from transaction data."""
        for _, row in self.df.iterrows():
            self.graph.add_edge(
                row['from'],
                row['to'],
                amount=row['amount_eth'],
                timestamp=row['timestamp'],
                chain=row['chain']
            )

    def detect_drain_wallet(self) -> str:
        """The drain wallet has the largest inflow burst shortly after the exploit."""
        # Simplified: Find the wallet with the absolute maximum total inflow
        in_degrees = dict(self.graph.in_degree(weight='amount'))
        if not in_degrees:
            return ""
        return max(in_degrees, key=in_degrees.get)

    def detect_hubs(self, drain_wallet: str) -> List[str]:
        """Hubs are wallets that received from the drain and have high fan-out."""
        hubs = []
        if drain_wallet not in self.graph:
            return hubs

        # First level descendants of the drain
        descendants = list(self.graph.successors(drain_wallet))
        for node in descendants:
            if self.graph.out_degree(node) >= HUB_MIN_OUT_DEGREE:
                hubs.append(node)
        return hubs

    def detect_gas_funder(self, target_set: Set[str]) -> str:
        """
        The gas funder sends small amounts of ETH to many wallets
        that later become part of the attack infrastructure.
        """
        funder_scores = {}
        for node in self.graph.nodes():
            # Get wallets this node sent money to
            successors = list(self.graph.successors(node))
            # Count how many of those successors are in our target_set (hubs/attacker)
            funded_targets = [s for s in successors if s in target_set]

            if len(funded_targets) >= GAS_FUNDER_MIN_TARGETS:
                # Verify the amounts are small (gas-like)
                amounts = [self.graph[node][s]['amount'] for s in funded_targets]
                if all(a <= GAS_FUNDER_MAX_AMOUNT for a in amounts):
                    funder_scores[node] = len(funded_targets)

        if not funder_scores:
            return ""
        return max(funder_scores, key=funder_scores.get)

    def get_clusters(self) -> Dict[str, int]:
        """Community detection using Louvain on the undirected version of the graph."""
        undirected = self.graph.to_undirected()
        # Louvain needs weights to be meaningful
        partition = community_louvain.best_partition(undirected, weight='amount')
        return partition

    def match_bridges(self) -> List[Tuple[str, str, float]]:
        """
        Matches Wallet X -> Bridge with Bridge -> Wallet Y
        using amount ratio and time window.
        """
        links = []
        # Find all transactions where 'to' is a known bridge or 'from' is a bridge
        # In this synthetic data, we treat nodes with high fan-out/in-flow but low balance as potential bridges
        # For the demo, we'll look for transactions with 'chain' changes

        # Simple bridge heuristic: nodes that appear on multiple chains in the CSV
        all_nodes = self.df['from'].unique()
        # (Wait, the data is already in a CSV, we can just check the 'chain' column)

        # Find pairs: (From A, To Bridge, Chain 1) -> (From Bridge, To B, Chain 2)
        txs = self.df.to_dict('records')
        for i in range(len(txs)):
            for j in range(len(txs)):
                if i == j: continue
                tx1 = txs[i]
                tx2 = txs[j]

                if tx1['to'] == tx2['from'] and tx1['chain'] != tx2['chain']:
                    # Time window check
                    t1 = pd.to_datetime(tx1['timestamp']).timestamp()
                    t2 = pd.to_datetime(tx2['timestamp']).timestamp()
                    time_diff = t2 - t1
                    if 0 < time_diff <= BRIDGE_TIME_WINDOW_SEC:
                        # Amount ratio check
                        ratio = tx2['amount_eth'] / tx1['amount_eth'] if tx1['amount_eth'] > 0 else 0
                        if 0.99 <= ratio <= 1.01:
                            score = 1.0 - (abs(1.0 - ratio))
                            links.append((tx1['from'], tx2['to'], score))
        return links

    def trace_taint(self, start_node: str) -> Set[str]:
        """Recursive flow tracing to find all descendants of the drain wallet."""
        tainted = {start_node}
        queue = [start_node]

        while queue:
            current = queue.pop(0)
            for successor in self.graph.successors(current):
                if successor not in tainted:
                    tainted.add(successor)
                    queue.append(successor)
        return tainted

def run_graph_analysis(tx_path: str, output_path: str):
    lg = LedgerGraph(tx_path)

    drain = lg.detect_drain_wallet()
    hubs = lg.detect_hubs(drain)
    tainted = lg.trace_taint(drain)

    # Gas funder targets the attacker + hubs
    target_set = tainted.union(set(hubs))
    funder = lg.detect_gas_funder(target_set)

    clusters = lg.get_clusters()
    bridges = lg.match_bridges()

    results = {
        "drain_wallet": drain,
        "hubs": hubs,
        "gas_funder": funder,
        "tainted_set": list(tainted),
        "clusters": clusters,
        "bridge_links": bridges
    }

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    return results
