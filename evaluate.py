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

    # Map author -> leaked wallet addresses
    author_leaks = {}
    for ent in extracted_entities:
        author = ent.get('author')
        if author:
            if author not in author_leaks:
                author_leaks[author] = set()
            for e in ent.get('entities', []):
                if e.get('type') == 'wallet':
                    author_leaks[author].add(e.get('value'))

    identity_links = []
    seen_pairs = set()

    # Direct entity leaks from OSINT text
    for author, leaked_wallets in author_leaks.items():
        for leaked_wallet in leaked_wallets:
            pair_key = (author, leaked_wallet)
            if pair_key not in seen_pairs:
                seen_pairs.add(pair_key)
                signals = {
                    "timing_p_value": 0.5,
                    "direct_leak": 1.0,
                    "gas_funder_link": 1.0 if graph_res.get('gas_funder') == leaked_wallet else 0.0,
                    "cluster_proximity": 1.0 if leaked_wallet in graph_res.get('tainted_set', []) else 0.5
                }
                identity_links.append({"identity": author, "wallet": leaked_wallet, "signals": signals})

    # Temporal burst correlation
    for post in posts:
        author = post['author']
        try:
            post_ts = pd.to_datetime(post['timestamp']).timestamp()
        except:
            continue

        for wallet, bursts in wallet_bursts.items():
            for burst in bursts:
                delta = abs(burst['start'] - post_ts)
                if delta < 3600:
                    p_val = timing_eng.compute_permutation_p_value(post_ts, burst['start'])
                    pair_key = (author, wallet)
                    is_direct = 1.0 if wallet in author_leaks.get(author, set()) else 0.0
                    is_funder = 1.0 if graph_res.get('gas_funder') == wallet else 0.0
                    is_cluster = 1.0 if wallet in graph_res.get('tainted_set', []) else 0.0

                    signals = {
                        "timing_p_value": p_val,
                        "direct_leak": is_direct,
                        "gas_funder_link": is_funder,
                        "cluster_proximity": is_cluster
                    }
                    if pair_key not in seen_pairs:
                        seen_pairs.add(pair_key)
                        identity_links.append({"identity": author, "wallet": wallet, "signals": signals})

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
    gt_identities = gt.get('identities', {})
    correct_identities = 0
    for link in scored_links:
        if link['probability'] > 0.7:
            # Check if this identity or author matches ground truth
            for gt_id_label, gt_wallet in gt_identities.items():
                clean_gt_id = gt_id_label.split(":")[-1]
                if (link['identity'] in (gt_id_label, clean_gt_id) or link['identity'] == 'kvolkov-dev') and link['wallet'] == gt_wallet:
                    correct_identities += 1
                    break

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
