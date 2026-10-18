import pandas as pd
import numpy as np
import json
from typing import List, Dict, Any, Tuple, Set
from config import WEIGHTS

class ScoringEngine:
    def __init__(self, config_weights: Dict[str, float]):
        self.weights = config_weights

    def compute_log_odds(self, signal_value: float, weight: float) -> float:
        """
        Signal value (0..1) converted to a weight-adjusted log-odds contribution.
        """
        if signal_value <= 0:
            return 0.0
        return signal_value * weight * 4.0

    def fuse_evidence(
        self,
        identity: str,
        wallet: str,
        evidence_signals: Dict[str, float],
        prior_prob: float = 0.01
    ) -> Tuple[float, List[str]]:
        """
        Combines multiple signals into a final posterior probability.
        evidence_signals: {'timing_p_value': 0.01, 'direct_leak': 1.0, ...}
        """
        total_score = 0.0
        evidence_trail = []

        # 1. Timing Evidence (p-value inverse)
        if 'timing_p_value' in evidence_signals:
            sig = evidence_signals['timing_p_value']
            conf = max(0.0, 1.0 - sig)
            score = self.compute_log_odds(conf, self.weights.get('timing_p_value', 0.4))
            total_score += score
            if conf > 0.9:
                evidence_trail.append(f"Strong temporal alignment (p={sig:.4f})")

        # 2. Direct Leak
        if 'direct_leak' in evidence_signals:
            sig = evidence_signals['direct_leak']
            score = self.compute_log_odds(sig, self.weights.get('direct_leak', 0.3))
            total_score += score
            if sig > 0:
                evidence_trail.append("Wallet address found directly in OSINT text")

        # 3. Gas Funder Link
        if 'gas_funder_link' in evidence_signals:
            sig = evidence_signals['gas_funder_link']
            score = self.compute_log_odds(sig, self.weights.get('gas_funder_link', 0.2))
            total_score += score
            if sig > 0:
                evidence_trail.append("Wallet was seeded by identified gas-funder")

        # 4. Cluster Proximity
        if 'cluster_proximity' in evidence_signals:
            sig = evidence_signals['cluster_proximity']
            score = self.compute_log_odds(sig, self.weights.get('cluster_proximity', 0.1))
            total_score += score
            if sig > 0.8:
                evidence_trail.append("Wallet belongs to high-confidence suspect cluster")

        # Bayesian fusion via log-odds:
        # Prior probability for any random handle being the attacker/funder in candidate pool (~5%)
        prior_prob = 0.05
        prior_log_odds = np.log(prior_prob / (1.0 - prior_prob))
        posterior_log_odds = prior_log_odds + total_score * 2.5
        probability = 1.0 / (1.0 + np.exp(-posterior_log_odds))

        return float(np.clip(probability, 0.01, 0.99)), evidence_trail



    def propagate_identity(
        self,
        links: List[Dict[str, Any]],
        clusters: Dict[str, int],
        tainted_set: Set[str],
        decay: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        If Identity I -> Wallet W, propagate that link to W's cluster
        and other tainted wallets.
        """
        expanded_links = []

        for link in links:
            identity = link['identity']
            wallet = link['wallet']
            prob = link['probability']
            evidence = link['evidence']

            # Add original link
            expanded_links.append({
                "identity": identity,
                "wallet": wallet,
                "probability": prob,
                "evidence": evidence
            })

            # Propagate to Cluster
            if wallet in clusters:
                cluster_id = clusters[wallet]
                cluster_members = [w for w, c in clusters.items() if c == cluster_id and w != wallet]
                for member in cluster_members:
                    expanded_links.append({
                        "identity": identity,
                        "wallet": member,
                        "probability": prob * decay,
                        "evidence": evidence + [f"Member of cluster {cluster_id} with {wallet}"]
                    })

        return expanded_links

def run_scoring(
    identity_links: List[Dict[str, Any]],
    graph_results: Dict[str, Any],
    output_path: str
):
    """
    Final fusion process.
    identity_links: List of {identity, wallet, signals: {}}
    """
    scorer = ScoringEngine(WEIGHTS)
    final_results = []

    for link in identity_links:
        identity = link['identity']
        wallet = link['wallet']
        signals = link['signals']
        source = link.get('source', 'osint')

        prob, evidence = scorer.fuse_evidence(identity, wallet, signals)

        final_results.append({
            "identity": identity,
            "wallet": wallet,
            "source": source,
            "probability": prob,
            "evidence": evidence
        })


    # Sort by probability
    final_results.sort(key=lambda x: x['probability'], reverse=True)

    with open(output_path, "w") as f:
        json.dump(final_results, f, indent=2)

    return final_results
