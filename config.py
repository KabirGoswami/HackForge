import os

# --- LLM CONFIG ---
# Model choice: Claude 3.5 Sonnet is best for extraction
MODEL_NAME = "claude-3-5-sonnet-20240620"
LLM_CACHE_DIR = "data/cache/"

# --- OSINT EXTRACTION ---
# Regex patterns for identity markers
WALLET_REGEX = r"0x[a-fA-F0-9]{40}"
EMAIL_REGEX = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
IPV4_REGEX = r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
HANDLE_REGEX = r"(@[a-zA-Z0-9_.-]{3,24})"

# --- GRAPH ANALYSIS ---
# Thresholds for hub/drain detection
HUB_MIN_OUT_DEGREE = 5           # Min transactions sent to be considered a hub
DRAIN_MIN_INFLOW_ETH = 1000     # Min ETH to be considered the primary drain wallet
GAS_FUNDER_MAX_AMOUNT = 1.0     # Gas funders usually send small amounts (<1 ETH)
GAS_FUNDER_MIN_TARGETS = 3       # Must fund at least 3 different wallets

# --- BRIDGE MATCHING ---
# Allow 1% difference in amount and 30 mins for bridge transit
BRIDGE_AMOUNT_TOLERANCE = 0.01
BRIDGE_TIME_WINDOW_SEC = 1800

# --- SCORING WEIGHTS (M5) ---
WEIGHTS = {
    "timing_p_value": 0.4,
    "direct_leak": 0.3,
    "gas_funder_link": 0.2,
    "cluster_proximity": 0.1
}
