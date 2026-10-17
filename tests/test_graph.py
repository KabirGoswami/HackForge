import json
import os
from engine.graph import LedgerGraph, run_graph_analysis

def test_graph_basics():
    # We assume generate_data.py was run and data/transactions.csv exists
    tx_path = "data/transactions.csv"
    if not os.path.exists(tx_path):
        pytest.fail("Run generate_data.py first")

    lg = LedgerGraph(tx_path)
    drain = lg.detect_drain_wallet()
    assert drain is not None
    assert len(drain) == 42 # 0x address length

    hubs = lg.detect_hubs(drain)
    assert len(hubs) > 0

    tainted = lg.trace_taint(drain)
    assert drain in tainted
    assert len(tainted) > 1
