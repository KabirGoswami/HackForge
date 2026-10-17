import pandas as pd
import numpy as np
from typing import List, Dict, Any
from config_alerts import CLUSTER_CONFIDENCE_WEIGHT, ALERT_VOLUME_THRESHOLD_USD

class ClusterAlertSystem:
    def __init__(self, graph_results: Dict[str, Any]):
        self.graph_res = graph_results
        self.tainted_set = set(graph_results.get('tainted_set', []))
        self.clusters = graph_results.get('clusters', {})

    def calculate_cluster_heat(self) -> Dict[str, float]:
        """
        Generates a heatmap of cluster confidence.
        Probability = (Sum of probabilities of members) / (Count * Weight)
        """
        cluster_scores = {}

        # We assume scored_links are available or we use a default
        # In a real run, we'd pass in the scored_links result
        # For the heatmap, we can use the 'tainted' status as a base

        for wallet, cluster_id in self.clusters.items():
            if cluster_id not in cluster_scores:
                cluster_scores[cluster_id] = []
            cluster_scores[cluster_id].append(1.0 if wallet in self.tainted_set else 0.0)

        heatmap = {}
        for cid, scores in cluster_scores.items():
            # Heat = percentage of cluster members that are tainted
            heatmap[cid] = float(np.mean(scores) * CLUSTER_CONFIDENCE_WEIGHT)

        return heatmap

    def check_for_alerts(self, current_txs: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Checks incoming transactions against defined thresholds.
        """
        alerts = []
        # Group by cluster to see total volume moving
        cluster_volumes = {}

        for _, row in current_txs.iterrows():
            sender = row['from']
            if sender in self.clusters:
                cid = self.clusters[sender]
                cluster_volumes[cid] = cluster_volumes.get(cid, 0) + row['amount_eth'] * 2500 # Approx ETH price

        for cid, volume in cluster_volumes.items():
            # Check if this cluster is suspicious (heat > 0.5)
            heat = self.calculate_cluster_heat().get(cid, 0)
            if heat > 0.5 and volume > ALERT_VOLUME_THRESHOLD_USD:
                alerts.append({
                    "cluster_id": cid,
                    "volume_usd": volume,
                    "severity": "CRITICAL" if volume > 10_000_000 else "WARNING",
                    "message": f"Suspicious Cluster {cid} moving ${volume:,.2f} USD"
                })

        return alerts
