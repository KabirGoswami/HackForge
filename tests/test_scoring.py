import pytest
from engine.scoring import ScoringEngine

def test_fusion_logic():
    weights = {
        "timing_p_value": 1.0,
        "direct_leak": 2.0,
        "gas_funder_link": 1.0,
        "cluster_proximity": 0.5
    }
    scorer = ScoringEngine(weights)

    # Case 1: No evidence
    prob1, ev1 = scorer.fuse_evidence(
        "user1", "0x1",
        {"timing_p_value": 1.0, "direct_leak": 0, "gas_funder_link": 0, "cluster_proximity": 0}
    )

    # Case 2: Strong direct leak + timing
    prob2, ev2 = scorer.fuse_evidence(
        "user1", "0x1",
        {"timing_p_value": 0.001, "direct_leak": 1.0, "gas_funder_link": 1.0, "cluster_proximity": 1.0}
    )

    assert prob2 > prob1
    assert "Wallet address found directly in OSINT text" in ev2
    assert any("Strong temporal alignment" in e for e in ev2)

def test_propagation():
    scorer = ScoringEngine({})
    links = [{
        "identity": "hacker",
        "wallet": "0x_main",
        "probability": 0.9,
        "evidence": ["direct leak"]
    }]
    clusters = {"0x_main": 1, "0x_side": 1, "0x_noise": 2}
    tainted = {"0x_main", "0x_side"}

    expanded = scorer.propagate_identity(links, clusters, tainted)

    # Should have 2 links: the original and the cluster member
    assert len(expanded) == 2
    assert expanded[1]['wallet'] == "0x_side"
    assert expanded[1]['probability'] == 0.9 * 0.5
