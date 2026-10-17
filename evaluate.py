import json
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Set
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS

def main():
    print("Starting Forensic Engine Evaluation...")

    # 1. Load Data
    with open("data/osint_posts.json", "r") as f:
        posts = json.load(f)

    tx_path = "data/transactions.csv"
    gt_path = "data/ground_truth.json"

    # 2. Execute Pipeline
    print("Step 1: Extracting OSINT Entities...")
    extracted_entities = run_extraction("data/osint_posts.json", "data/osint_entities.json")

    print("Step 2: Analyzing Ledger Graph...")
    graph_res = run_graph_analysis(tx_path, "data/graph_results.json")

    print("Step 3: Timing and Burst Analysis...")
    df_tx = pd.read_csv(tx_path)
    timing_eng = TimingEngine(df_tx)
    wallets = df_tx['from'].unique()
    wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

    # Link posts to bursts to create signals
    identity_links = []
    for post in posts:
        # Use extract_osint_markers logic or simply match handles
        author = post['author']
        post_ts = pd.to_datetime(post['timestamp']).timestamp()

        for wallet, bursts in wallet_bursts.items():
            for burst in bursts:
                delta = burst['start'] - post_ts
                if 0 < delta < 3600:
                    p_val = timing_eng.compute_permutation_p_value(post_ts, burst['start'])

                    # Build signals for this identity-wallet pair
                    signals = {
                        "timing_p_value": p_val,
                        "direct_leak": 0.0, # Will be updated by entity check
                        "gas_funder_link": 0.0,
                        "cluster_proximity": 0.0
                    }

                    # Check for direct leaks in extracted entities
                    for ent in extracted_entities:
                        if ent['author'] == author:
                            for e in ent['entities']:
                                if e['value'] == wallet:
                                    signals['direct_leak'] = 1.0

                    # Check gas funder link
                    if graph_res['gas_funder'] and wallet == graph_res['gas_funder']:
                        signals['gas_funder_link'] = 1.0

                    # Check cluster proximity
                    clusters = graph_res['clusters']
                    # Simplified: if they share a cluster with another linked wallet
                    # (In full version, this is more complex)

                    identity_links.append({
                        "identity": author,
                        "wallet": wallet,
                        "signals": signals
                    })

    print("Step 4: Evidence Fusion...")
    scored_links = run_scoring(identity_links, graph_res, "data/links.json")

    # 3. Evaluate against Ground Truth
    with open(gt_path, "r") as f:
        gt = json.load(f)

    # Metrics: Recall on laundering set
    true_laundering = set()
    if 'laundering_wallets' in gt:
        true_laundering = set(gt['laundering_wallets'])
    else:
        # Fallback: combine attacker, hubs, and leaves
        true_laundering.add(gt.get('attacker'))
        true_laundering.update(gt.get('hubs', []))
        true_laundering.update(gt.get('leaves', []))

    predicted_laundering = set(graph_res['tainted_set'])

    tp = len(true_laundering.intersection(predicted_laundering))
    fp = len(predicted_laundering - true_laundering)
    fn = len(true_laundering - predicted_laundering)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0

    # Metrics: Identity Links
    correct_identities = 0
    for link in scored_links:
        if link['probability'] > 0.7:
            # Check if this identity is mapped to this wallet in ground truth
            if link['wallet'] in gt.get('identity_map', {}).get(link['identity'], []):
                correct_identities += 1

    metrics = {
        "laundering_precision": round(precision, 4),
        "laundering_recall": round(recall, 4),
        "correct_identity_links": correct_identities,
        "total_high_conf_links": len([l for l in scored_links if l['probability'] > 0.7])
    }

    with open("data/metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n--- EVALUATION SUMMARY ---")
    print(f"Laundering Precision: {metrics['laundering_precision']}")
    print(f"Laundering Recall:    {metrics['laundering_recall']}")
    print(f"Correct ID Links:     {metrics['correct_identity_links']}")
    print("--------------------------")

if __name__ == "__main__":
    main()
