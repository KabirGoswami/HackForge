import os
from dotenv import load_dotenv

# Load variables from .env file if present
load_dotenv()

# Etherscan API Configuration
# Add your API key here or set it as an environment variable
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "YOUR_API_KEY_HERE")
ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"

