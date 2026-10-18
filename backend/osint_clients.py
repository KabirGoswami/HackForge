import requests
import random
import time
from typing import List, Dict, Any, Optional
import os
from datetime import datetime

# Use environment variable for GitHub Token to avoid rate limiting
GITHUB_TOKEN = os.getenv("GITHUB_API_TOKEN")
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
    def __init__(self):
        self.token = GITHUB_TOKEN
        self.base_url = GITHUB_BASE_URL
        self.headers = {"Authorization": f"token {self.token}"} if self.token else {}

    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """
        Searches GitHub code/commits for the query string (e.g., a wallet address).
        """
        # We search for the query in code/commits
        endpoint = f"{self.base_url}/search/code"
        params = {"q": query}

        try:
            response = requests.get(endpoint, params=params, headers=self.headers, timeout=10)
            if response.status_code != 200:
                print(f"GitHub API Error: {response.status_code}")
                return []

            data = response.json()
            items = data.get("items", [])

            normalized_posts = []
            for item in items:
                # Map GitHub search result to OSINT schema
                # author -> authorAlias, commit date -> timestamp
                normalized_posts.append({
                    "author": item.get("author", {}).get("login", "unknown_github_user"),
                    "timestamp": int(time.time()), # GitHub search results don't always provide commit date in the item
                    "rawText": item.get("text", ""),
                    "source": "github"
                })
            return normalized_posts
        except Exception as e:
            print(f"Network error fetching from GitHub: {e}")
            return []

class MockSocialClient(BaseOsintClient):
    """
    Simulated live social media ingestion.
    Generates realistic posts based on keywords to ensure the bridge works
    without requiring 10+ proprietary API keys.
    """
    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """
        Simulates a live feed of posts mentioning the target.
        """
        # Deterministic mock data based on the query to simulate "finding" a link
        mock_users = ["@crypto_whale", "@darknet_leaks", "@chain_detective", "@exploit_bot"]

        # Generate 1-3 simulated posts
        num_posts = random.randint(1, 3)
        results = []

        for _ in range(num_posts):
            user = random.choice(mock_users)
            # Create a timestamp within the last 24 hours
            ts = int(time.time()) - random.randint(0, 86400)

            results.append({
                "author": user,
                "timestamp": ts,
                "rawText": f"Analyzing suspicious activity related to {query}. Looks like a bridge exploit.",
                "source": "mock_social"
            })

        return results

def get_live_osint_data(query: str) -> List[Dict[str, Any]]:
    """
    Aggregates data from all enabled OSINT sources.
    """
    clients = [GitHubClient(), MockSocialClient()]
    all_data = []

    for client in clients:
        all_data.extend(client.fetch(query))

    return all_data
