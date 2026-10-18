import os
import json
import sqlite3
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime

# In a full production deploy, we would use PostgreSQL.
# For the current worktree development, we use SQLite for zero-config persistence
# that still implements the Repository pattern.
DB_PATH = os.getenv("DATABASE_URL", "data/forensics.db")

class ForensicRepository:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        """Initializes the database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # 1. Jobs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    created_at TIMESTAMP,
                    status TEXT,
                    target_wallet TEXT,
                    metadata TEXT
                )
            ''')
            # 2. Transactions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    tx_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT,
                    timestamp INTEGER,
                    sender TEXT,
                    receiver TEXT,
                    amount_eth REAL,
                    chain TEXT,
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id)
                )
            ''')
            # 3. OSINT Entities table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS osint_entities (
                    entity_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT,
                    post_id TEXT,
                    author TEXT,
                    entities TEXT,
                    claims TEXT,
                    summary TEXT,
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id)
                )
            ''')
            # 4. Graph Results table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS graph_results (
                    job_id TEXT PRIMARY KEY,
                    drain_wallet TEXT,
                    hubs TEXT,
                    gas_funder TEXT,
                    tainted_set TEXT,
                    clusters TEXT,
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id)
                )
            ''')
            # 5. Scored Links table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scored_links (
                    link_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT,
                    identity TEXT,
                    wallet TEXT,
                    probability REAL,
                    evidence TEXT,
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id)
                )
            ''')
            conn.commit()

    # --- Job Management ---
    def create_job(self, job_id: str, target_wallet: Optional[str] = None) -> None:
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO jobs (job_id, created_at, status, target_wallet) VALUES (?, ?, ?, ?)",
                (job_id, datetime.now().isoformat(), "PENDING", target_wallet)
            )
            conn.commit()

    def update_job_status(self, job_id: str, status: str, metadata: Optional[Dict] = None) -> None:
        meta_json = json.dumps(metadata) if metadata else None
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE jobs SET status = ?, metadata = ? WHERE job_id = ?",
                (status, meta_json, job_id)
            )
            conn.commit()

    # --- Data Persistence ---
    def save_transactions(self, job_id: str, df: pd.DataFrame) -> None:
        with self._get_connection() as conn:
            # df.to_sql requires sqlalchemy. For SQLite vanilla, we loop.
            for _, row in df.iterrows():
                conn.execute(
                    "INSERT INTO transactions (job_id, timestamp, sender, receiver, amount_eth, chain) VALUES (?, ?, ?, ?, ?, ?)",
                    (job_id, int(row['timestamp']), row['from'], row['to'], float(row['amount_eth']), row['chain'])
                )
            conn.commit()

    def get_transactions(self, job_id: str) -> pd.DataFrame:
        with self._get_connection() as conn:
            df = pd.read_sql_query(
                "SELECT timestamp, sender as 'from', receiver as 'to', amount_eth, chain FROM transactions WHERE job_id = ?",
                conn, params=(job_id,)
            )
            return df

    def save_osint_entities(self, job_id: str, entities: List[Dict[str, Any]]) -> None:
        with self._get_connection() as conn:
            for ent in entities:
                conn.execute(
                    "INSERT INTO osint_entities (job_id, post_id, author, entities, claims, summary) VALUES (?, ?, ?, ?, ?, ?)",
                    (job_id, ent['post_id'], ent['author'], json.dumps(ent['entities']), json.dumps(ent['claims']), ent['summary'])
                )
            conn.commit()

    def get_osint_entities(self, job_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM osint_entities WHERE job_id = ?", (job_id,))
            rows = cursor.fetchall()
            return [
                {
                    "post_id": row["post_id"],
                    "author": row["author"],
                    "entities": json.loads(row["entities"]),
                    "claims": json.loads(row["claims"]),
                    "summary": row["summary"]
                }
                for row in rows
            ]

    def save_graph_results(self, job_id: str, results: Dict[str, Any]) -> None:
        with self._get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO graph_results (job_id, drain_wallet, hubs, gas_funder, tainted_set, clusters) VALUES (?, ?, ?, ?, ?, ?)",
                (job_id, results.get('drain_wallet'), json.dumps(results.get('hubs')),
                 results.get('gas_funder'), json.dumps(results.get('tainted_set')), json.dumps(results.get('clusters', {})))
            )
            conn.commit()

    def get_graph_results(self, job_id: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM graph_results WHERE job_id = ?", (job_id,)).fetchone()
            if not row: return {}
            return {
                "drain_wallet": row["drain_wallet"],
                "hubs": json.loads(row["hubs"]),
                "gas_funder": row["gas_funder"],
                "tainted_set": json.loads(row["tainted_set"]),
                "clusters": json.loads(row["clusters"])
            }

    def save_scored_links(self, job_id: str, links: List[Dict[str, Any]]) -> None:
        with self._get_connection() as conn:
            for link in links:
                conn.execute(
                    "INSERT INTO scored_links (job_id, identity, wallet, probability, evidence) VALUES (?, ?, ?, ?, ?)",
                    (job_id, link['identity'], link['wallet'], float(link['probability']), json.dumps(link.get('evidence', [])))
                )
            conn.commit()

    def get_scored_links(self, job_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM scored_links WHERE job_id = ?", (job_id,))
            rows = cursor.fetchall()
            return [
                {
                    "identity": row["identity"],
                    "wallet": row["wallet"],
                    "probability": row["probability"],
                    "evidence": json.loads(row["evidence"])
                }
                for row in rows
            ]
