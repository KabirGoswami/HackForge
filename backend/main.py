from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import pandas as pd
import json
import os

# Import our forensic engines
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS

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

    return graph_res, scored_links, df_tx

@app.get("/analyze")
async def analyze():
    """Trigger a full pipeline run and return results."""
    try:
        graph_res, scored_links, df_tx = execute_pipeline()
        CACHE["graph_res"] = graph_res
        CACHE["scored_links"] = scored_links
        CACHE["df_tx"] = df_tx
        return {"status": "success", "message": "Pipeline executed successfully"}
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

@app.get("/metrics")
async def get_metrics():
    """Returns evaluation metrics."""
    if os.path.exists("data/metrics.json"):
        with open("data/metrics.json", "r") as f:
            return json.load(f)
    return {"error": "Metrics not found. Run /analyze first."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
