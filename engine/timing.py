import pandas as pd
import numpy as np
from scipy import stats
from typing import List, Dict, Any, Tuple
import json
import os
from config import BRIDGE_TIME_WINDOW_SEC

class TimingEngine:
    def __init__(self, tx_df: pd.DataFrame):
        self.df = tx_df.sort_values('timestamp')

    def detect_bursts(self, wallet: str, window_sec: int = 300) -> List[Dict[str, Any]]:
        """
        Identifies bursts of transactions from a specific wallet.
        A burst is a sequence of transactions where the inter-tx delta is small.
        """
        wallet_txs = self.df[self.df['from'] == wallet].sort_values('timestamp')
        if len(wallet_txs) < 2:
            return []

        # Ensure timestamps are numeric
        timestamps = pd.to_datetime(wallet_txs['timestamp']).astype('int64') // 10**9
        timestamps = timestamps.values # Convert to numpy array for positional indexing
        deltas = np.diff(timestamps)

        bursts = []
        if len(deltas) == 0:
            return bursts

        current_burst = [timestamps[0]]
        for i in range(len(deltas)):
            if deltas[i] <= window_sec:
                current_burst.append(timestamps[i+1])
            else:
                if len(current_burst) >= 2:
                    bursts.append({
                        "start": current_burst[0],
                        "end": current_burst[-1],
                        "count": len(current_burst),
                        "median_delta": np.median(np.diff(current_burst))
                    })
                current_burst = [timestamps[i+1]]

        if len(current_burst) >= 2:
            bursts.append({
                "start": current_burst[0],
                "end": current_burst[-1],
                "count": len(current_burst),
                "median_delta": np.median(np.diff(current_burst))
            })

        return bursts

    def analyze_bot_fingerprint(self, wallet: str) -> Dict[str, Any]:
        """
        Analyzes inter-transaction deltas to see if they match a bot's
        lognormal distribution (low coefficient of variation).
        """
        wallet_txs = self.df[self.df['from'] == wallet].sort_values('timestamp')
        if len(wallet_txs) < 5: # Need a minimum sample size
            return {"is_bot": False, "cv": 1.0}

        # Ensure timestamps are numeric for diff
        timestamps = pd.to_datetime(wallet_txs['timestamp']).astype('int64') // 10**9
        deltas = np.diff(timestamps.values)

        # Remove zeros to avoid division by zero
        deltas = deltas[deltas > 0]

        if len(deltas) < 2:
            return {"is_bot": False, "cv": 1.0}

        cv = np.std(deltas) / np.mean(deltas)
        # Bot-like behavior typically has a very consistent (low CV) or
        # specific distribution. Noise is usually higher.
        return {
            "is_bot": cv < 0.5,
            "cv": float(cv)
        }

    def compute_permutation_p_value(self, post_timestamp: float, burst_start: float, iterations: int = 5000) -> float:
        """
        Runs a permutation test to determine if the delay between a post
        and a burst is statistically significant.
        """
        observed_delta = abs(burst_start - post_timestamp)

        # Create a null distribution by shifting the post timestamp
        # randomly across the window of the dataset
        min_ts = pd.to_datetime(self.df['timestamp'].min()).timestamp()
        max_ts = pd.to_datetime(self.df['timestamp'].max()).timestamp()

        random_deltas = []
        for _ in range(iterations):
            random_ts = np.random.uniform(min_ts, max_ts)
            random_deltas.append(abs(burst_start - random_ts))

        # p-value is the fraction of random shifts that produced a smaller or equal delta
        p_value = np.sum(np.array(random_deltas) <= observed_delta) / iterations
        return float(p_value)

    def link_posts_to_bursts(self, posts: List[Dict[str, Any]], wallet_bursts: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Links OSINT posts to blockchain bursts using timing analysis.
        """
        links = []
        for post in posts:
            post_ts = post['timestamp_sec']
            author = post['author']

            for wallet, bursts in wallet_bursts.items():
                for burst in bursts:
                    delta = burst['start'] - post_ts
                    # We look for posts that happen shortly BEFORE a burst
                    if 0 < delta < 3600: # Post within 1 hour before burst
                        p_val = self.compute_permutation_p_value(post_ts, burst['start'])
                        links.append({
                            "author": author,
                            "wallet": wallet,
                            "post_id": post['id'],
                            "median_delta": float(delta),
                            "p_value": p_val,
                            "confidence": 1.0 - p_val
                        })

        return links

def run_timing_analysis(tx_path: str, osint_entities_path: str, output_path: str):
    # Load data
    df = pd.read_csv(tx_path)
    with open(osint_entities_path, "r") as f:
        # We need the original posts for timestamps, not just entities
        # For the demo, we'll assume a similar file structure
        osint_data = json.load(f)

    engine = TimingEngine(df)

    # 1. Identify all active wallets and their bursts
    wallets = df['from'].unique()
    wallet_bursts = {w: engine.detect_bursts(w) for w in wallets}

    # 2. Link posts to bursts
    # Note: In a real run, we'd use a processed OSINT file with timestamps
    # For this module's output, we'll assume a simplified input for the demo
    # (Actual integration happens in run_all)

    # Since this is a module, we return the engine and the bursts
    # The main loop will handle the linking
    return engine, wallet_bursts
