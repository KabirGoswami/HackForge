from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import pandas as pd
import json
import os

# Import our forensic engines
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS
from backend.etherscan_client import EtherscanClient
from engine.alerts import ClusterAlertSystem

app = FastAPI(title="QOBE Forensic API")

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
    "df_tx": None
}

def execute_pipeline():
    """Runs the full forensic pipeline and updates the cache."""
    tx_path = "data/transactions.csv"
    osint_path = "data/osint_posts.json"

    # 1. Extraction
    run_extraction(osint_path, "data/osint_entities.json")

    # 2. Graph Analysis
    graph_res = run_graph_analysis(tx_path, "data/graph_results.json")

    # 3. Timing Analysis
    df_tx = pd.read_csv(tx_path)
    timing_eng = TimingEngine(df_tx)
    wallets = df_tx['from'].unique()
    wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

    with open(osint_path, "r") as f:
        posts = json.load(f)

    identity_links = []
    for post in posts:
        author = post['author']
        try:
            post_ts = pd.to_datetime(post['timestamp']).timestamp()
        except:
            continue

        for wallet, bursts in wallet_bursts.items():
            for burst in bursts:
                delta = burst['start'] - post_ts
                if 0 < delta < 3600:
                    p_val = timing_eng.compute_permutation_p_value(post_ts, burst['start'])
                    signals = {"timing_p_value": p_val, "direct_leak": 0.0, "gas_funder_link": 0.0, "cluster_proximity": 0.0}
                    if graph_res['gas_funder'] == wallet:
                        signals['gas_funder_link'] = 1.0
                    identity_links.append({"identity": author, "wallet": wallet, "signals": signals})

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
    If target_wallet is provided, it fetches REAL data from Etherscan.
    """
    try:
        if target_wallet:
            # REAL-WORLD MODE
            client = EtherscanClient()
            print(f"Fetching real-world data for {target_wallet}...")

            # Fetch normal and internal txs
            df_normal = client.get_wallet_transactions(target_wallet)
            df_internal = client.get_internal_transactions(target_wallet)

            df_tx = pd.concat([df_normal, df_internal]).drop_duplicates()

            # Save to data folder so the engine can use it
            df_tx.to_csv("data/transactions.csv", index=False)

        else:
            # SYNTHETIC MODE
            # We assume generate_data.py has already been run
            pass

        # Now run the existing pipeline on the current data/transactions.csv
        graph_res, scored_links, df_tx_final = execute_pipeline()

        CACHE["graph_res"] = graph_res
        CACHE["scored_links"] = scored_links
        CACHE["df_tx"] = df_tx_final

        return {"status": "success", "message": "Analysis complete", "mode": "real" if target_wallet else "synthetic"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph():
    """Returns the ledger graph and tainted set."""
    if not CACHE["graph_res"]:
        execute_pipeline() # Auto-run if cache is empty
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
    # In a real production app, we'd pass in the LATEST window of txs
    # Here we use the cached df_tx as the current state
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
        "gas_funder_address": graph_res.get('gas_funder')
    }

@app.post("/war-room/copilot")
async def copilot_query(payload: Dict[str, Any]):
    """
    AI-driven forensic analyst.
    Expects { "query": str, "suspect_id": optional str }
    """
    query = payload.get("query", "")
    suspect_id = payload.get("suspect_id")

    if not CACHE["scored_links"]:
        execute_pipeline()

    # Find evidence context
    evidence_context = ""
    if suspect_id:
        suspect = next((s for s in CACHE["scored_links"] if s['wallet'] == suspect_id), None)
        if suspect:
            evidence_context = f"Evidence for {suspect['identity']}: {'; '.join(suspect.get('evidence', []))}"
    else:
        # General context from top 3 suspects
        top_3 = CACHE["scored_links"][:3]
        evidence_context = "\n".join([f"{s['identity']} -> {s['wallet']}: {'; '.join(s.get('evidence', []))}" for s in top_3])

    # In a real production app, we'd call an LLM here.
    # For the forensic engine demo, we provide a grounded, structured response based on the evidence.
    response = f"Analyst Note: Based on the gathered forensic evidence:\n\n{evidence_context}\n\nThe system predicts this link based on temporal correlation and graph proximity. Please verify with a manual chain audit."

    return {"response": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
