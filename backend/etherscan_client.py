import requests
import pandas as pd
from typing import List, Dict, Any
from backend.etherscan_config import ETHERSCAN_API_KEY, ETHERSCAN_BASE_URL

class EtherscanClient:
    """
    Interface to fetch real blockchain data from Etherscan.
    Allows the engine to move from synthetic data to real-world targets.
    """
    def __init__(self):
        self.api_key = ETHERSCAN_API_KEY
        self.base_url = ETHERSCAN_BASE_URL

    def get_wallet_transactions(self, address: str, limit: int = 1000) -> pd.DataFrame:
        """
        Fetches normal transactions for a given address.
        """
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": 0,
            "endblock": 99999999,
            "sort": "asc",
            "apikey": self.api_key
        }

        try:
            response = requests.get(self.base_url, params=params)
            data = response.json()

            if data["status"] != "1":
                print(f"Etherscan Error: {data.get('message')}")
                return pd.DataFrame()

            txs = data["result"]
            df = pd.DataFrame(txs)

            # Normalize to our engine's expected format
            # Etherscan: time -> timestamp, value -> amount_eth (in wei)
            if not df.empty:
                df = df.rename(columns={
                    'timeStamp': 'timestamp',
                    'from': 'from',
                    'to': 'to',
                    'value': 'amount_eth'
                })
                # Convert Wei to ETH
                df['amount_eth'] = df['amount_eth'].astype(float) / 10**18
                # Ensure timestamp is integer
                df['timestamp'] = df['timestamp'].astype(int)
                # Add a default chain
                df['chain'] = 'Ethereum'

                return df[['timestamp', 'from', 'to', 'amount_eth', 'chain']]

        except Exception as e:
            print(f"Network error fetching from Etherscan: {e}")
            return pd.DataFrame()

        return pd.DataFrame()

    def get_internal_transactions(self, address: str) -> pd.DataFrame:
        """
        Fetches internal transactions (critical for tracking contract-based splits).
        """
        params = {
            "module": "account",
            "action": "txlistinternal",
            "address": address,
            "apikey": self.api_key
        }
        try:
            response = requests.get(self.base_url, params=params)
            data = response.json()
            if data["status"] == "1":
                df = pd.DataFrame(data["result"])
                df = df.rename(columns={'timeStamp': 'timestamp', 'value': 'amount_eth'})
                df['amount_eth'] = df['amount_eth'].astype(float) / 10**18
                df['timestamp'] = df['timestamp'].astype(int)
                df['chain'] = 'Ethereum'
                return df[['timestamp', 'from', 'to', 'amount_eth', 'chain']]
        except:
            pass
        return pd.DataFrame()
