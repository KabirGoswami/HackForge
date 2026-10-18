from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional, Union
import pandas as pd
import json
import os
import google.generativeai as genai

# Import our forensic engines
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS
from backend.etherscan_client import EtherscanClient
from backend.osint_clients import get_live_osint_data
from engine.alerts import ClusterAlertSystem
from backend.worker import run_forensic_pipeline_task, celery_app
from celery.result import AsyncResult
from backend.repository import ForensicRepository

# Initialize Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')

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
    # NOTE: Transitioning to Repository-based retrieval.
    # CACHE is kept for backward compatibility with endpoints not yet migrated.
    CACHE = {
        "graph_res": None,
        "scored_links": None,
        "df_tx": None
    }

    def execute_pipeline(osint_data: Optional[Union[str, List[Dict[str, Any]]]] = None):

    """Runs the full forensic pipeline and updates the cache.
    osint_data: Can be a path to a JSON file or a list of post objects.
    """
    tx_path = "data/transactions.csv"
    osint_path = "data/osint_posts.json"

    # Use provided live data or fallback to static file
    current_osint = osint_data if osint_data is not None else osint_path

    # 1. Extraction
    # If current_osint is a list, run_extraction handles it directly now
    run_extraction(current_osint, "data/osint_entities.json")

    # 2. Graph Analysis
    graph_res = run_graph_analysis(tx_path, "data/graph_results.json")

    # 3. Timing Analysis
    df_tx = pd.read_csv(tx_path)
    timing_eng = TimingEngine(df_tx)
    wallets = df_tx['from'].unique()
    wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

    # Load posts for timing correlation
    if isinstance(current_osint, str):
        with open(current_osint, "r") as f:
            posts = json.load(f)
    else:
        posts = current_osint

    identity_links = []
    for post in posts:
        author = post['author']
        try:
            # Handle both integer timestamps and ISO strings
            ts = post.get('timestamp')
            post_ts = pd.to_datetime(ts).timestamp() if not isinstance(ts, (int, float)) else ts
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

@app.post("/analyze")
async def analyze(target_wallet: Optional[str] = Query(None)):
    """
    Trigger a full pipeline run asynchronously via Celery.
    Returns a job_id that the client can use to poll for status.
    """
    try:
        # Dispatch the heavy lifting to the worker
        task = run_forensic_pipeline_task.delay(target_wallet)
        return {"job_id": task.id, "status": "PENDING", "message": "Analysis started in background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """
    Poll the status of a specific forensic analysis job.
    """
    try:
        res = AsyncResult(job_id, app=celery_app)
        state = res.state
        meta = res.info if isinstance(res.info, dict) else {}

        response = {
            "job_id": job_id,
            "status": state,
            "progress": meta.get("progress", 0),
            "details": meta.get("status", "Processing...")
        }

        if state == "SUCCESS":
            response["result"] = res.result

        return response
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph(job_id: Optional[str] = Query(None)):
    """Returns the ledger graph and tainted set.
    If job_id is provided, retrieves results from the database.
    """
    if job_id:
        repo = ForensicRepository()
        res = repo.get_graph_results(job_id)
        if res: return res

    if not CACHE["graph_res"]:
        execute_pipeline() # Auto-run if cache is empty
    return CACHE["graph_res"]

@app.get("/suspects")
async def get_suspects(job_id: Optional[str] = Query(None)):
    """Returns the ranked list of suspects.
    If job_id is provided, retrieves results from the database.
    """
    if job_id:
        repo = ForensicRepository()
        res = repo.get_scored_links(job_id)
        if res: return res

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
    job_id = payload.get("job_id")

    # Use Repository to get the most current evidence
    repo = ForensicRepository()

    # If job_id is provided, we use that; otherwise fallback to most recent job
    if not job_id:
        # In a real app, we'd fetch the most recent 'SUCCESS' job
        # For now, we'll return an error if no job is specified for a real query
        if not CACHE["scored_links"]:
            execute_pipeline()
        current_job_id = "default" # Simple fallback
    else:
        current_job_id = job_id

    # Find evidence context
    evidence_context = ""
    if suspect_id:
        suspect = next((s for s in repo.get_scored_links(current_job_id) if s['wallet'] == suspect_id), None)
        if suspect:
            evidence_context = f"Evidence for {suspect['identity']}: {'; '.join(suspect.get('evidence', []))}"
    else:
        # General context from top 3 suspects
        top_3 = repo.get_scored_links(current_job_id)[:3]
        evidence_context = "\n".join([f"{s['identity']} -> {s['wallet']}: {'; '.join(s.get('evidence', []))}" for s in top_3])

    if not evidence_context:
        return {"response": "No forensic evidence found for this target. Please run an analysis first."}

    # LIVE AI SYNTHESIS
    if GEMINI_API_KEY and 'model' in globals():
        try:
            prompt = (
                "You are a Senior Blockchain Forensic Analyst. I will provide you with evidence "
                "connecting a real-world identity to a blockchain wallet. "
                "Your goal is to synthesize this into a professional, concise analyst note. "
                "Focus on the strength of the link, temporal correlation, and graph proximity. "
                "Avoid fluff. Be direct and forensic.\n\n"
                f"Forensic Evidence:\n{evidence_context}\n\n"
                f"Analyst Query: {query}\n\n"
                "Response:"
            )
            response = model.generate_content(prompt)
            return {"response": response.text}
        except Exception as e:
            print(f"Gemini API Error: {e}")
            # Fallback to template if API fails
            response = f"Analyst Note (Fallback): Based on the gathered forensic evidence:\n\n{evidence_context}\n\nThe system predicts this link based on temporal correlation and graph proximity."
            return {"response": response}
    else:
        # Fallback to template
        response = f"Analyst Note: Based on the gathered forensic evidence:\n\n{evidence_context}\n\nThe system predicts this link based on temporal correlation and graph proximity. Please verify with a manual chain audit."
        return {"response": response}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
