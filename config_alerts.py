import os

# --- HEATMAP SETTINGS ---
# Weight for cluster confidence calculation
CLUSTER_CONFIDENCE_WEIGHT = 0.7

# --- ALERT THRESHOLDS ---
# Trigger alert if a suspicious cluster moves more than this amount in USD
ALERT_VOLUME_THRESHOLD_USD = 1_000_000
# Trigger alert if the number of new wallets in a cluster exceeds this count
ALERT_CLUSTER_GROWTH_THRESHOLD = 5
# Alert sensitivity: 1.0 = strict, 0.1 = noisy
ALERT_SENSITIVITY = 0.8
