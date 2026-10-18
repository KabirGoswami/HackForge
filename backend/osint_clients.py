import os
import requests
import datetime
import random
import time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

GITHUB_API_TOKEN = os.getenv("GITHUB_API_TOKEN")
GITHUB_BASE_URL = "https://api.github.com"


class BaseOsintClient:
    """Base class to ensure all OSINT sources normalize to the same schema."""
    def fetch(self, query: str) -> List[Dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement fetch()")


class GitHubClient(BaseOsintClient):
    """
    Interface to fetch real-world identity markers from GitHub.
    Searches commits and issues for wallet addresses or specific handles.
    """
    def __init__(self, token: Optional[str] = None):
        self.token = token or GITHUB_API_TOKEN
        self.base_url = GITHUB_BASE_URL
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "QOBE-Forensic-Engine"
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    def search_wallet(self, wallet_address: str) -> List[Dict[str, Any]]:
        posts = []
        try:
            # 1. Search Commits
            url = f"{self.base_url}/search/commits?q={wallet_address}&sort=author-date&order=desc"
            resp = requests.get(url, headers=self.headers, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("items", [])[:5]:
                    commit = item.get("commit", {})
                    author_info = commit.get("author", {})
                    author = author_info.get("name") or item.get("author", {}).get("login", "github_committer")
                    timestamp = author_info.get("date", datetime.datetime.now(datetime.timezone.utc).isoformat())
                    msg = commit.get("message", "")
                    raw_text = f"GitHub commit {item.get('sha', '')[:8]}: {msg} (ref: {wallet_address})"
                    posts.append({
                        "source": "github",
                        "author": author,
                        "timestamp": timestamp,
                        "text": raw_text,
                        "rawText": raw_text
                    })

            # 2. Search Issues if needed
            if len(posts) < 2:
                url_issues = f"{self.base_url}/search/issues?q={wallet_address}&sort=created&order=desc"
                resp_issues = requests.get(url_issues, headers=self.headers, timeout=6)
                if resp_issues.status_code == 200:
                    data_issues = resp_issues.json()
                    for item in data_issues.get("items", [])[:3]:
                        user = item.get("user", {}).get("login", "github_user")
                        timestamp = item.get("created_at", datetime.datetime.now(datetime.timezone.utc).isoformat())
                        raw_text = f"GitHub issue #{item.get('number')}: {item.get('title', '')} - {item.get('body', '')[:120]} (ref: {wallet_address})"
                        posts.append({
                            "source": "github",
                            "author": user,
                            "timestamp": timestamp,
                            "text": raw_text,
                            "rawText": raw_text
                        })
        except Exception as e:
            print(f"GitHub search exception for {wallet_address}: {e}")

        return posts

    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """Unified fetch interface for compatibility with pipeline workers."""
        results = self.search_wallet(query)
        if results:
            return results
        # Fallback to code search
        try:
            endpoint = f"{self.base_url}/search/code"
            params = {"q": query}
            resp = requests.get(endpoint, params=params, headers=self.headers, timeout=6)
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                out = []
                for item in items[:4]:
                    raw_text = f"Found ref in {item.get('name', 'file')}: {query}"
                    out.append({
                        "source": "github",
                        "author": item.get("repository", {}).get("owner", {}).get("login", "unknown_github_user"),
                        "timestamp": int(time.time()),
                        "text": raw_text,
                        "rawText": raw_text
                    })
                return out
        except Exception as e:
            print(f"Network error in GitHubClient.fetch: {e}")
        return []


class MockSocialClient(BaseOsintClient):
    """
    Simulated live social intelligence client.
    Generates realistic posts mentioning the target wallet.
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
            raw_text = templates[i % len(templates)]
            posts.append({
                "source": "mock_social",
                "author": handle,
                "timestamp": post_time,
                "text": raw_text,
                "rawText": raw_text
            })

        return posts

    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """Unified fetch interface returning posts for the target query."""
        return self.generate_posts(query)


def get_live_osint_data(query: str) -> List[Dict[str, Any]]:
    """
    Aggregates data from all enabled OSINT sources.
    """
    clients = [GitHubClient(), MockSocialClient()]
    all_data = []
    for client in clients:
        all_data.extend(client.fetch(query))
    return all_data
