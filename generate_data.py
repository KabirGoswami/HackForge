"""
Synthetic "2:14 AM DeFi hack" dataset generator.
Outputs (in ./data): transactions.csv, osint_posts.json, ground_truth.json

The hidden planted structure your engine must discover:
  - 1 attacker wallet -> 8 hub wallets -> ~130 leaf wallets (peel/fan-out)
  - Bot timing signature: leaves fire ~40s after their hub (lognormal jitter)
  - 1 gas-funder wallet that seeds the attacker + hubs (clustering signal)
  - ~20% of leaves hop through a fake "bridge" (chain changes, amount -0.1%)
  - 600 noise wallets + ~4000 random txs as market noise
  - OSINT posts: 2 posts from the same handle appear ~50s BEFORE hub bursts
    (time-delta signal) + 1 GitHub commit leaking an email + the gas-funder
    wallet (identity signal) + 12 decoy posts
"""
import json
import os
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
T0 = pd.Timestamp("2026-10-13 02:14:00")  # a Tuesday, 2:14 AM
OUT = "data"
os.makedirs(OUT, exist_ok=True)


def wallet():
    return "0x" + rng.bytes(20).hex()


def lognormal_delay(mean_s, sigma):
    """Delay in seconds with the given median and jitter."""
    return float(rng.lognormal(np.log(mean_s), sigma))


txs = []


def tx(ts, src, dst, amt, chain="ethereum"):
    txs.append({"timestamp": ts, "from": src, "to": dst,
                "amount_eth": round(float(amt), 4), "chain": chain})


# ---------- Cast ----------
victim = wallet()
attacker = wallet()
gas_funder = wallet()
bridge = wallet()
exchange = wallet()          # offshore exchange deposit address
hubs = [wallet() for _ in range(8)]
leaves = {}                   # hub -> list of leaf wallets
truth_leaves = []

# ---------- The hack ----------
for dst, amt, dt in [(attacker, 0.5, -7200)]:   # gas funder seeds attacker 2h earlier
    tx(T0 + pd.Timedelta(seconds=dt), gas_funder, dst, amt)
tx(T0 + pd.Timedelta(minutes=3), victim, attacker, 12000)   # 2:17 AM drain

# ---------- Stage 1: attacker -> hubs ----------
hub_shares = rng.dirichlet(np.ones(8) * 3) * 11900
hub_burst_start = {}
t = T0 + pd.Timedelta(minutes=9)
for hub, amt in zip(hubs, hub_shares):
    t += pd.Timedelta(seconds=lognormal_delay(90, 0.5))
    tx(t, attacker, hub, amt)
    tx(t - pd.Timedelta(seconds=30), gas_funder, hub, 0.05)  # gas seeding
    hub_burst_start[hub] = t + pd.Timedelta(minutes=2 + rng.random() * 3)

# ---------- Stage 2: hubs -> leaves (bot signature ~40s) ----------
amounts_by_hub = dict(zip(hubs, hub_shares))
for hub in hubs:
    n = int(rng.integers(14, 20))
    shares = rng.dirichlet(np.ones(n) * 0.7) * amounts_by_hub[hub] * 0.999
    leaves[hub] = [wallet() for _ in range(n)]
    t = hub_burst_start[hub]
    for leaf, amt in zip(leaves[hub], shares):
        t += pd.Timedelta(seconds=lognormal_delay(40, 0.25))   # <-- bot fingerprint
        tx(t, hub, leaf, amt)
        truth_leaves.append(leaf)
        # 20% hop across a "bridge": chain changes, new wallet, 0.1% fee
        if rng.random() < 0.20:
            new_w = wallet()
            hop_t = t + pd.Timedelta(seconds=lognormal_delay(300, 0.4))
            tx(hop_t, leaf, bridge, amt * 0.999)
            tx(hop_t + pd.Timedelta(seconds=lognormal_delay(240, 0.3)),
               bridge, new_w, amt * 0.998, chain="arbitrum")
            truth_leaves.append(new_w)
        # some cash out at the offshore exchange hours later
        elif rng.random() < 0.15:
            tx(t + pd.Timedelta(hours=float(rng.uniform(2, 5))), leaf, exchange, amt * 0.995)

# ---------- Noise ----------
noise = [wallet() for _ in range(600)]
for _ in range(4000):
    a, b = rng.choice(len(noise), 2, replace=False)
    ts = T0 + pd.Timedelta(seconds=float(rng.uniform(-6 * 3600, 8 * 3600)))
    tx(ts, noise[a], noise[b], rng.lognormal(0.5, 1.5))

df = pd.DataFrame(txs).sort_values("timestamp").reset_index(drop=True)
df.to_csv(f"{OUT}/transactions.csv", index=False)

# ---------- OSINT corpus ----------
posts = []
handle = "n0x_phantom"
# Two posts from the same handle ~50s before hub bursts (time-delta link)
for hub, src in [(hubs[2], "telegram:@darkpool_chat"), (hubs[5], "forum:xss-clone")]:
    delta = 50 + float(rng.normal(0, 3))
    posts.append({
        "source": src, "author": handle,
        "timestamp": str(hub_burst_start[hub] - pd.Timedelta(seconds=delta)),
        "text": "starting the next batch now, burners warmed up. gm to the "
                "protocol team lol",
    })
# GitHub commit leaking email + gas funder wallet (identity link)
posts.append({
    "source": "github:commit", "author": "kvolkov-dev",
    "timestamp": str(T0 - pd.Timedelta(hours=1, minutes=50)),
    "text": f"fix gas estimator for bot v2. TODO remove hardcoded funder "
            f"{gas_funder}. contact: k.volkov.dev@protonmail.example",
})
# Decoys: random handles, random times, random wallets
for i in range(12):
    posts.append({
        "source": str(rng.choice(["telegram", "forum", "github:issue", "reddit"])),
        "author": f"user_{rng.integers(1000, 9999)}",
        "timestamp": str(T0 + pd.Timedelta(seconds=float(rng.uniform(-4 * 3600, 6 * 3600)))),
        "text": str(rng.choice([
            "anyone else seeing gas spike tonight?",
            f"is {wallet()} a scam? got a weird airdrop",
            "selling nft collection dm me",
            "new yield farm launching, apy insane",
            "bridge down again?? lol",
        ])),
    })
posts.sort(key=lambda p: p["timestamp"])
json.dump(posts, open(f"{OUT}/osint_posts.json", "w"), indent=2)

# ---------- Ground truth (NEVER show this to the engine) ----------
json.dump({
    "attacker": attacker, "gas_funder": gas_funder, "hubs": hubs,
    "leaves": truth_leaves, "bridge": bridge, "exchange": exchange,
    "identities": {
        "handle:n0x_phantom": attacker,
        "email:k.volkov.dev@protonmail.example": gas_funder,
    },
}, open(f"{OUT}/ground_truth.json", "w"), indent=2)

print(f"{len(df)} transactions | {df['from'].nunique() + df['to'].nunique()} wallet refs | "
      f"{len(posts)} OSINT posts | {len(truth_leaves)} laundering leaves planted")
