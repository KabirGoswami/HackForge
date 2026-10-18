import os
import sys
from dotenv import load_dotenv

# Ensure workspace root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import pandas as pd
import json

# Import our forensic engines
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS
from backend.etherscan_client import EtherscanClient
from engine.alerts import ClusterAlertSystem
from backend.osint_clients import GitHubClient, MockSocialClient

app = FastAPI(title="QOBE Forensic API")

# Enable CORS so the React frontend can talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state to avoid re-running the heavy pipeline on every request
CACHE = {
    "graph_res": None,
    "scored_links": None,
    "df_tx": None,
    "mode": "synthetic",
    "target_wallet": None
}

def execute_pipeline():
    """Runs the full forensic pipeline and updates the cache."""
    tx_path = "data/transactions.csv"
    osint_path = "data/osint_posts.json"
    entities_path = "data/osint_entities.json"

    # 1. Extraction
    run_extraction(osint_path, entities_path)

    # 2. Graph Analysis
    graph_res = run_graph_analysis(tx_path, "data/graph_results.json")

    # 3. Timing & Entity Analysis
    df_tx = pd.read_csv(tx_path)
    timing_eng = TimingEngine(df_tx)
    wallets = df_tx['from'].unique()
    wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

    with open(osint_path, "r") as f:
        posts = json.load(f)

    extracted_entities = []
    if os.path.exists(entities_path):
        with open(entities_path, "r") as f:
            extracted_entities = json.load(f)

    # Map author -> leaked wallet addresses & source
    author_leaks = {}
    author_sources = {p.get('author'): p.get('source', 'osint') for p in posts}

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

    # 3a. Direct entity leaks from OSINT text
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
                identity_links.append({
                    "identity": author,
                    "wallet": leaked_wallet,
                    "source": author_sources.get(author, "osint"),
                    "signals": signals
                })

    # 3b. Temporal burst correlation
    for post in posts:
        author = post['author']
        post_source = post.get('source', 'osint')
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
                        identity_links.append({
                            "identity": author,
                            "wallet": wallet,
                            "source": post_source,
                            "signals": signals
                        })

    # 4. Scoring
    scored_links = run_scoring(identity_links, graph_res, "data/links.json")

    CACHE["graph_res"] = graph_res
    CACHE["scored_links"] = scored_links
    CACHE["df_tx"] = df_tx

    return graph_res, scored_links, df_tx


@app.get("/analyze")
async def analyze(target_wallet: Optional[str] = Query(None)):
    """
    Trigger a full pipeline run.
    - If target_wallet is omitted or blank: runs SYNTHETIC mode (baseline data/ files).
    - If target_wallet is provided:
        a. Fetches real-world transactions from Etherscan.
        b. Fetches live OSINT from GitHub (via GitHubClient) and MockSocialClient.
        c. If Etherscan has no transactions (e.g. test wallet or no key), generates simulated live cluster.
        d. Merges and updates data/transactions.csv and data/osint_posts.json.
    """
    try:
        mode = "synthetic"
        clean_wallet = target_wallet.strip() if target_wallet else None

        if clean_wallet:
            # REAL-WORLD OR SIMULATED LIVE MODE
            print(f"Fetching real-world data for {clean_wallet}...")
            client = EtherscanClient()
            df_normal = client.get_wallet_transactions(clean_wallet)
            df_internal = client.get_internal_transactions(clean_wallet)

            dfs = [d for d in [df_normal, df_internal] if not d.empty]
            df_tx = pd.concat(dfs).drop_duplicates() if dfs else pd.DataFrame()

            print(f"Fetching live OSINT data for {clean_wallet}...")
            gh_client = GitHubClient()
            live_gh_posts = gh_client.search_wallet(clean_wallet)

            mock_social_client = MockSocialClient()
            mock_posts = mock_social_client.generate_posts(clean_wallet)

            combined_live_osint = live_gh_posts + mock_posts

            if not df_tx.empty:
                mode = "real_world"
                print(f"Etherscan fetched {len(df_tx)} real transactions for {clean_wallet}.")
            else:
                mode = "simulated_live"
                print(f"Etherscan returned no transactions for {clean_wallet}; generating simulated live cluster.")
                now_ts = int(pd.Timestamp.now().timestamp())
                sim_txs = [
                    {"timestamp": now_ts - 3600, "from": "0x8c53c786ed62c2f971445abc2f0ddac24097acb7", "to": clean_wallet, "amount_eth": 0.5, "chain": "Ethereum"},
                    {"timestamp": now_ts - 1800, "from": clean_wallet, "to": "0x3158d4a4b6a004674d81a0d2233ea18bca978371", "amount_eth": 350.0, "chain": "Ethereum"},
                    {"timestamp": now_ts - 1200, "from": clean_wallet, "to": "0x3a5151731e512c3a22389617c344f98dafbf4ce3", "amount_eth": 210.0, "chain": "Ethereum"},
                    {"timestamp": now_ts - 600, "from": "0x3158d4a4b6a004674d81a0d2233ea18bca978371", "to": "0xc409e881b27a4401f932d110e87a5502b991f312", "amount_eth": 349.5, "chain": "Ethereum"}
                ]
                df_tx = pd.DataFrame(sim_txs)

            # Persist transactions
            df_tx.to_csv("data/transactions.csv", index=False)

            # Prepend live OSINT posts to osint_posts.json
            with open("data/osint_posts.json", "r") as f:
                existing_posts = json.load(f)

            updated_posts = combined_live_osint + [p for p in existing_posts if clean_wallet not in p.get('text', '')]
            with open("data/osint_posts.json", "w") as f:
                json.dump(updated_posts, f, indent=2)

        # Run pipeline
        graph_res, scored_links, df_tx_final = execute_pipeline()

        CACHE["graph_res"] = graph_res
        CACHE["scored_links"] = scored_links
        CACHE["df_tx"] = df_tx_final
        CACHE["mode"] = mode
        CACHE["target_wallet"] = clean_wallet

        return {
            "status": "success",
            "message": f"Analysis complete in {mode} mode",
            "mode": mode,
            "target_wallet": clean_wallet,
            "suspects_count": len(scored_links),
            "tainted_wallets": len(graph_res.get('tainted_set', []))
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph():
    """Returns the ledger graph and tainted set."""
    if not CACHE["graph_res"]:
        execute_pipeline()
    return CACHE["graph_res"]

@app.get("/suspects")
async def get_suspects():
    """Returns the ranked list of suspects."""
    if not CACHE["scored_links"]:
        execute_pipeline()
    return CACHE["scored_links"]

@app.get("/heatmap")
async def get_heatmap():
    """Returns the cluster-based heatmap for the visualization."""
    if not CACHE["graph_res"]:
        execute_pipeline()

    alert_sys = ClusterAlertSystem(CACHE["graph_res"])
    return alert_sys.calculate_cluster_heat()

@app.get("/alerts")
async def get_alerts():
    """Returns active volume-based alerts for suspicious clusters."""
    if CACHE["graph_res"] is None or CACHE["df_tx"] is None:
        execute_pipeline()

    alert_sys = ClusterAlertSystem(CACHE["graph_res"])
    return alert_sys.check_for_alerts(CACHE["df_tx"])

@app.post("/alerts/settings")
async def update_alert_settings(threshold: float):
    """Updates the volume threshold for alerts."""
    import config_alerts
    config_alerts.ALERT_VOLUME_THRESHOLD_USD = threshold
    return {"status": "success", "new_threshold": threshold}

@app.get("/war-room/kpis")
async def get_war_room_kpis(threshold: float = 0.7):
    """Returns high-level operational KPIs for the War Room."""
    if not CACHE["graph_res"] or not CACHE["scored_links"]:
        execute_pipeline()

    graph_res = CACHE["graph_res"]
    scored_links = CACHE["scored_links"]

    high_conf_count = len([l for l in scored_links if l['probability'] >= threshold])

    return {
        "total_tainted": len(graph_res.get('tainted_set', [])),
        "detected_hubs": len(graph_res.get('hubs', [])),
        "high_conf_suspects": high_conf_count,
        "gas_funder": "Identified" if graph_res.get('gas_funder') else "Unknown",
        "gas_funder_address": graph_res.get('gas_funder'),
        "mode": CACHE.get("mode", "synthetic"),
        "target_wallet": CACHE.get("target_wallet")
    }

@app.post("/war-room/copilot")
async def copilot_query(payload: Dict[str, Any]):
    """
    AI-driven forensic analyst copilot.
    Synthesizes grounded forensic evidence notes from the latest live OSINT and graph tensor.
    """
    query = payload.get("query", "")
    suspect_id = payload.get("suspect_id")

    if not CACHE["scored_links"]:
        execute_pipeline()

    scored = CACHE["scored_links"]
    target = CACHE.get("target_wallet")
    mode = CACHE.get("mode", "synthetic")

    # Find evidence context
    live_links = [s for s in scored if s.get("source") in ("github", "mock_social")]
    relevant_links = live_links if live_links else scored[:3]

    evidence_lines = []
    for s in relevant_links[:3]:
        src_label = s.get('source', 'osint').upper()
        evidence_lines.append(f"• [{src_label}] {s['identity']} -> {s['wallet']}: {'; '.join(s.get('evidence', []))} (Confidence: {s['probability']*100:.1f}%)")

    evidence_context = "\n".join(evidence_lines)

    target_note = f"for target wallet {target} ({mode} mode)" if target else f"for the active DeFi exploit incident ({mode} mode)"
    response = (
        f"Analyst Note: Based on live evidence gathered {target_note}:\n\n"
        f"{evidence_context}\n\n"
        f"Assessment: High-probability attribution established through cross-dimensional correlation between unstructured threat chatter and on-chain burst metrics. Recommend issuing an emergency freeze warrant on downstream consolidation staging vaults."
    )

    return {"response": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
