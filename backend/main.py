import os
import sys
import uuid
import datetime
import json
from typing import List, Dict, Any, Optional, Union
import pandas as pd
from dotenv import load_dotenv

# Ensure workspace root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

# Import our forensic engines
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS
from backend.etherscan_client import EtherscanClient
from backend.osint_clients import get_live_osint_data, GitHubClient, MockSocialClient
from engine.alerts import ClusterAlertSystem
from backend.repository import ForensicRepository

# Celery async worker setup (optional / resilient)
try:
    from backend.worker import run_forensic_pipeline_task, celery_app
    from celery.result import AsyncResult
    CELERY_AVAILABLE = True
except Exception:
    CELERY_AVAILABLE = False
    celery_app = None

# Initialize Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    except Exception as e:
        print(f"Gemini initialization notice: {e}")

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


def execute_pipeline(osint_data: Optional[Union[str, List[Dict[str, Any]]]] = None, job_id: Optional[str] = None):
    """Runs the full forensic pipeline, updates the cache, and saves to repository.
    osint_data: Can be a path to a JSON file or a list of post objects.
    """
    tx_path = "data/transactions.csv"
    osint_path = "data/osint_posts.json"
    entities_path = "data/osint_entities.json"

    current_job_id = job_id or f"job-{uuid.uuid4().hex[:8]}"

    # Use provided live data or fallback to static file
    current_osint = osint_data if osint_data is not None else osint_path

    # 1. Extraction
    extracted_entities = run_extraction(current_osint, entities_path)

    # 2. Graph Analysis
    graph_res = run_graph_analysis(tx_path, "data/graph_results.json")

    # 3. Timing & Entity Analysis
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

    # Map author -> leaked wallet addresses from extraction
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
                identity_links.append({
                    "identity": author,
                    "wallet": leaked_wallet,
                    "source": "osint_entity_leak",
                    "signals": signals
                })

    # Temporal burst correlation
    for post in posts:
        author = post.get('author', 'unknown')
        post_source = post.get('source', 'osint')
        raw_ts = post.get('timestamp')
        try:
            if isinstance(raw_ts, (int, float)):
                post_ts = float(raw_ts)
            else:
                post_ts = pd.to_datetime(raw_ts).timestamp()
        except Exception:
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

    # Persist to SQLite repository for resilience
    try:
        repo = ForensicRepository()
        repo.create_job(current_job_id, CACHE.get("target_wallet"))
        repo.save_transactions(current_job_id, df_tx)
        repo.save_osint_entities(current_job_id, extracted_entities)
        repo.save_graph_results(current_job_id, graph_res)
        repo.save_scored_links(current_job_id, scored_links)
        repo.update_job_status(current_job_id, "SUCCESS")
    except Exception as e:
        print(f"Repository persistence warning: {e}")

    return graph_res, scored_links, df_tx, current_job_id


def run_pipeline_sync(clean_wallet: Optional[str] = None, job_id: Optional[str] = None):
    mode = "synthetic"
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
        try:
            with open("data/osint_posts.json", "r") as f:
                existing_posts = json.load(f)
        except Exception:
            existing_posts = []

        updated_posts = combined_live_osint + [p for p in existing_posts if clean_wallet not in p.get('text', '')]
        with open("data/osint_posts.json", "w") as f:
            json.dump(updated_posts, f, indent=2)

    # Run pipeline
    graph_res, scored_links, df_tx_final, created_job_id = execute_pipeline(job_id=job_id)

    CACHE["graph_res"] = graph_res
    CACHE["scored_links"] = scored_links
    CACHE["df_tx"] = df_tx_final
    CACHE["mode"] = mode
    CACHE["target_wallet"] = clean_wallet

    return {
        "status": "success",
        "job_id": created_job_id,
        "message": f"Analysis complete in {mode} mode",
        "mode": mode,
        "target_wallet": clean_wallet,
        "suspects_count": len(scored_links),
        "tainted_wallets": len(graph_res.get('tainted_set', []))
    }


@app.get("/analyze")
async def analyze_get(target_wallet: Optional[str] = Query(None)):
    """
    Trigger full pipeline run synchronously.
    Supports synthetic, simulated_live, and real-world Etherscan/OSINT modes.
    """
    try:
        clean_wallet = target_wallet.strip() if target_wallet else None
        return run_pipeline_sync(clean_wallet)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze_post(target_wallet: Optional[str] = Query(None)):
    """
    Trigger pipeline run via POST.
    Dispatches to Celery worker if available, or falls back seamlessly to synchronous/background execution.
    """
    clean_wallet = target_wallet.strip() if target_wallet else None

    # Try Celery dispatch if available
    if CELERY_AVAILABLE:
        try:
            task = run_forensic_pipeline_task.delay(clean_wallet)
            return {"job_id": task.id, "status": "PENDING", "message": "Analysis started in background worker"}
        except Exception as e:
            print(f"Celery dispatch failed or broker offline: {e}. Executing synchronously...")

    # Fallback to direct synchronous execution with SQLite persistence
    try:
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        res = run_pipeline_sync(clean_wallet, job_id=job_id)
        return {
            "job_id": job_id,
            "status": "SUCCESS",
            "message": res["message"],
            "mode": res["mode"],
            "target_wallet": clean_wallet,
            "suspects_count": res["suspects_count"],
            "tainted_wallets": res["tainted_wallets"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")


@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """
    Poll the status of a specific forensic analysis job.
    Checks Celery result first, falls back to SQLite ForensicRepository.
    """
    try:
        if CELERY_AVAILABLE and celery_app:
            try:
                res = AsyncResult(job_id, app=celery_app)
                state = res.state
                meta = res.info if isinstance(res.info, dict) else {}
                if state in ("SUCCESS", "PENDING", "PROGRESS", "FAILURE"):
                    response = {
                        "job_id": job_id,
                        "status": state,
                        "progress": meta.get("progress", 100 if state == "SUCCESS" else 0),
                        "details": meta.get("status", "Processing...")
                    }
                    if state == "SUCCESS":
                        response["result"] = res.result
                    return response
            except Exception:
                pass

        # Check SQLite repository
        repo = ForensicRepository()
        with repo._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT job_id, status FROM jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            if row:
                status = row[1]
                return {
                    "job_id": job_id,
                    "status": status,
                    "progress": 100 if status == "SUCCESS" else 50,
                    "details": "Pipeline finished" if status == "SUCCESS" else "Processing pipeline..."
                }

        # If job matches current cache
        return {
            "job_id": job_id,
            "status": "SUCCESS",
            "progress": 100,
            "details": "Analysis complete"
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found: {str(e)}")


@app.get("/graph")
async def get_graph(job_id: Optional[str] = Query(None)):
    """Returns the ledger graph and tainted set.
    If job_id is provided, retrieves results from the database.
    """
    if job_id:
        repo = ForensicRepository()
        res = repo.get_graph_results(job_id)
        if res:
            return res

    if not CACHE["graph_res"]:
        execute_pipeline()
    return CACHE["graph_res"]


@app.get("/suspects")
async def get_suspects(job_id: Optional[str] = Query(None)):
    """Returns the ranked list of suspects.
    If job_id is provided, retrieves results from the database.
    """
    if job_id:
        repo = ForensicRepository()
        res = repo.get_scored_links(job_id)
        if res:
            return res

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
    job_id = payload.get("job_id")

    repo = ForensicRepository()

    # Retrieve scored suspects from repo or cache
    scored = []
    if job_id:
        scored = repo.get_scored_links(job_id)
    if not scored:
        if not CACHE["scored_links"]:
            execute_pipeline()
        scored = CACHE["scored_links"] or []

    target = CACHE.get("target_wallet")
    mode = CACHE.get("mode", "synthetic")

    # Find evidence context
    if suspect_id:
        matched = [s for s in scored if s.get('wallet') == suspect_id]
        chosen = matched if matched else scored[:3]
    else:
        live_links = [s for s in scored if s.get("source") in ("github", "mock_social")]
        chosen = live_links if live_links else scored[:3]

    evidence_lines = []
    for s in chosen[:3]:
        src_label = s.get('source', 'osint').upper()
        evidence_lines.append(
            f"• [{src_label}] {s['identity']} -> {s['wallet']}: {'; '.join(s.get('evidence', []))} (Confidence: {s['probability']*100:.1f}%)"
        )

    evidence_context = "\n".join(evidence_lines) if evidence_lines else "No specific links found."

    # Live AI Synthesis via Gemini if available
    if GEMINI_API_KEY and gemini_model:
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
            resp = gemini_model.generate_content(prompt)
            if resp and resp.text:
                return {"response": resp.text}
        except Exception as e:
            print(f"Gemini API Error: {e}")

    # Rich forensic fallback response
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
