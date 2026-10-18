import os
import requests
import datetime
import random
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

GITHUB_API_TOKEN = os.getenv("GITHUB_API_TOKEN")

class GitHubClient:
    """
    Searches GitHub for commits, issues, or code mentions of a specific wallet address.
    """
    def __init__(self, token: Optional[str] = None):
        self.token = token or GITHUB_API_TOKEN
        self.base_url = "https://api.github.com"

    def search_wallet(self, wallet_address: str) -> List[Dict[str, Any]]:
        posts = []
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "QOBE-Forensic-Engine"
        }
        if self.token:
            headers["Authorization"] = f"token {self.token}"

        try:
            # 1. Search Commits
            url = f"{self.base_url}/search/commits?q={wallet_address}&sort=author-date&order=desc"
            resp = requests.get(url, headers=headers, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("items", [])[:5]:
                    commit = item.get("commit", {})
                    author_info = commit.get("author", {})
                    author = author_info.get("name") or item.get("author", {}).get("login", "github_committer")
                    timestamp = author_info.get("date", datetime.datetime.now(datetime.timezone.utc).isoformat())
                    msg = commit.get("message", "")
                    posts.append({
                        "source": "github",
                        "author": author,
                        "timestamp": timestamp,
                        "text": f"GitHub commit {item.get('sha', '')[:8]}: {msg} (ref: {wallet_address})"
                    })

            # 2. Search Issues if needed
            if len(posts) < 2:
                url_issues = f"{self.base_url}/search/issues?q={wallet_address}&sort=created&order=desc"
                resp_issues = requests.get(url_issues, headers=headers, timeout=6)
                if resp_issues.status_code == 200:
                    data_issues = resp_issues.json()
                    for item in data_issues.get("items", [])[:3]:
                        user = item.get("user", {}).get("login", "github_user")
                        timestamp = item.get("created_at", datetime.datetime.now(datetime.timezone.utc).isoformat())
                        posts.append({
                            "source": "github",
                            "author": user,
                            "timestamp": timestamp,
                            "text": f"GitHub issue #{item.get('number')}: {item.get('title', '')} - {item.get('body', '')[:120]} (ref: {wallet_address})"
                        })
        except Exception as e:
            print(f"GitHub search exception for {wallet_address}: {e}")

        return posts


class MockSocialClient:
    """
    Simulated live social intelligence client.
    Generates 1-3 synthetic social posts specifically mentioning the target wallet.
    Used for Scenario B (Simulated Live Mode) and fallback when no live threat feed is active.
    """
    def __init__(self):
        self.mock_handles = ["@crypto_whale", "@darkpool_leaks", "@defi_sleuth", "@chain_watcher", "@burner_hunter"]

    def generate_posts(self, wallet_address: str, base_time: Optional[datetime.datetime] = None) -> List[Dict[str, Any]]:
        now = base_time or datetime.datetime.now(datetime.timezone.utc)
        count = random.randint(2, 3)
        selected_handles = random.sample(self.mock_handles, count)

        templates = [
            f"Alert: High-volume movement detected originating from {wallet_address}. Funds splitting into mixers.",
            f"Burner wallet {wallet_address} was pre-funded 2 hours prior to exploit. Potential gas supplier.",
            f"Cross-referencing staging address {wallet_address} with offshore OTC settlement logs. Watch this cluster.",
            f"Deployer bot script leak references {wallet_address} in hardcoded router config."
        ]

        posts = []
        for i, handle in enumerate(selected_handles):
            offset_seconds = random.randint(15, 450)
            post_time = (now - datetime.timedelta(seconds=offset_seconds)).isoformat()
            posts.append({
                "source": "mock_social",
                "author": handle,
                "timestamp": post_time,
                "text": templates[i % len(templates)]
            })

        return posts
