from celery import Celery
import os
from typing import Optional
from backend.etherscan_client import EtherscanClient
from backend.osint_clients import get_live_osint_data
from engine.extract import run_extraction
from engine.graph import run_graph_analysis
from engine.timing import TimingEngine
from engine.scoring import run_scoring
import pandas as pd
import json

# Configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery app
celery_app = Celery(
    "forensic_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

@celery_app.task(bind=True)
def run_forensic_pipeline_task(self, target_wallet: Optional[str] = None):
    """
    Asynchronous task that executes the full forensic pipeline.
    Uses the ForensicRepository for persistent storage instead of flat files.
    """
    try:
        # Initialize Repository
        repo = ForensicRepository()
        job_id = self.request.id
        repo.create_job(job_id, target_wallet)

        self.update_state(state='PROGRESS', meta={'progress': 10, 'status': 'Fetching Blockchain Data'})

        # 1. Data Acquisition
        if target_wallet:
            client = EtherscanClient()
            df_normal = client.get_wallet_transactions(target_wallet)
            df_internal = client.get_internal_transactions(target_wallet)
            df_tx = pd.concat([df_normal, df_internal]).drop_duplicates()

            # PERSIST: Transactions
            repo.save_transactions(job_id, df_tx)

            # Live OSINT Acquisition
            live_osint = get_live_osint_data(target_wallet)
            current_osint = live_osint
        else:
            # Synthetic mode fallback - load from file for now to maintain compat
            df_tx = pd.read_csv("data/transactions.csv")
            repo.save_transactions(job_id, df_tx)
            current_osint = "data/osint_posts.json"

        self.update_state(state='PROGRESS', meta={'progress': 30, 'status': 'Extracting OSINT Markers'})

        # 2. Extraction (Refactored to return data)
        entities = run_extraction(current_osint)
        repo.save_osint_entities(job_id, entities)

        self.update_state(state='PROGRESS', meta={'progress': 50, 'status': 'Analyzing Ledger Graph'})

        # 3. Graph Analysis (Refactored to return data)
        graph_res = run_graph_analysis(df_tx)
        repo.save_graph_results(job_id, graph_res)

        self.update_state(state='PROGRESS', meta={'progress': 70, 'status': 'Computing Temporal Correlation'})

        # 4. Timing Analysis
        timing_eng = TimingEngine(df_tx)
        wallets = df_tx['from'].unique()
        wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

        if isinstance(current_osint, str):
            with open(current_osint, "r") as f:
                posts = json.load(f)
        else:
            posts = current_osint

        identity_links = []
        for post in posts:
            author = post['author']
            try:
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

        self.update_state(state='PROGRESS', meta={'progress': 90, 'status': 'Finalizing Suspect Scoring'})

        # 5. Scoring (Refactored to return data)
        scored_links = run_scoring(identity_links, graph_res)
        repo.save_scored_links(job_id, scored_links)

        # Finalize Job
        repo.update_job_status(job_id, "SUCCESS")

        return {
            "status": "success",
            "job_id": job_id,
            "target_wallet": target_wallet,
            "high_conf_suspects": len([l for l in scored_links if l['probability'] >= 0.7])
        }

    except Exception as e:
        print(f"Pipeline task failed: {e}")
        try:
            repo = ForensicRepository()
            repo.update_job_status(self.request.id, "FAILURE")
        except:
            pass
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise e
