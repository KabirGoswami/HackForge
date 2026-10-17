import streamlit as st
import pandas as pd
import numpy as np
import json
import os
import plotly.graph_objects as go
import networkx as nx
from engine.extract import run_extraction
from engine.graph import run_graph_analysis, LedgerGraph
from engine.timing import TimingEngine
from engine.scoring import ScoringEngine, run_scoring
from config import WEIGHTS

# Page Config
st.set_page_config(page_title="QOBE War Room", layout="wide", page_icon="🛡️")

# Custom CSS for the "War Room" feel
st.markdown("""
    <style>
    .main { background-color: #0e1117; color: #ffffff; }
    .stMetric { background-color: #161b22; border: 1px solid #30363d; padding: 10px; border-radius: 10px; }
    .evidence-box { background-color: #161b22; border-left: 5px solid #58a6ff; padding: 15px; margin: 10px 0; border-radius: 0 10px 10px 0; }
    </style>
    """, unsafe_allow_html=True)

@st.cache_data
def load_and_process():
    """Full pipeline execution cached for performance."""
    # 1. Extract
    run_extraction("data/osint_posts.json", "data/osint_entities.json")

    # 2. Graph
    graph_res = run_graph_analysis("data/transactions.csv", "data/graph_results.json")

    # 3. Timing & Scoring
    df_tx = pd.read_csv("data/transactions.csv")
    timing_eng = TimingEngine(df_tx)
    wallets = df_tx['from'].unique()
    wallet_bursts = {w: timing_eng.detect_bursts(w) for w in wallets}

    with open("data/osint_posts.json", "r") as f:
        posts = json.load(f)

    identity_links = []
    for post in posts:
        author = post['author']
        post_ts = pd.to_datetime(post['timestamp']).timestamp()
        for wallet, bursts in wallet_bursts.items():
            for burst in bursts:
                delta = burst['start'] - post_ts
                if 0 < delta < 3600:
                    p_val = timing_eng.compute_permutation_p_value(post_ts, burst['start'])
                    # Basic signal building
                    signals = {"timing_p_value": p_val, "direct_leak": 0.0, "gas_funder_link": 0.0, "cluster_proximity": 0.0}
                    # Check if wallet is the gas funder
                    if graph_res['gas_funder'] == wallet:
                        signals['gas_funder_link'] = 1.0

                    identity_links.append({"identity": author, "wallet": wallet, "signals": signals})

    scored_links = run_scoring(identity_links, graph_res, "data/links.json")

    return graph_res, scored_links, df_tx

# --- Sidebar ---
st.sidebar.title("🛡️ QOBE Control Panel")
st.sidebar.markdown("---")
confidence_threshold = st.sidebar.slider("Confidence Threshold", 0.0, 1.0, 0.7)
show_tainted = st.sidebar.checkbox("Highlight Tainted Wallets", value=True)
show_clusters = st.sidebar.checkbox("Show Community Clusters", value=True)

# Load Data
with st.spinner("Fusing OSINT and Blockchain data..."):
    graph_res, scored_links, df_tx = load_and_process()

# --- Main UI ---
st.title("Quantitative OSINT Blockchain Engine")
st.caption("Real-time Attribution of the $42M DeFi Exploit")

# KPI Row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Tainted", len(graph_res['tainted_set']))
with col2:
    st.metric("Detected Hubs", len(graph_res['hubs']))
with col3:
    st.metric("High Conf. Suspects", len([l for l in scored_links if l['probability'] >= confidence_threshold]))
with col4:
    st.metric("Gas Funder", "Identified" if graph_res['gas_funder'] else "Unknown")

st.markdown("---")

# Main Content Area
left_col, right_col = st.columns([2, 1])

with left_col:
    st.subheader("🌐 Tainted Flow Graph")

    # Build Graph for Plotly
    G = nx.DiGraph()
    for _, row in df_tx.iterrows():
        if row['from'] in graph_res['tainted_set'] or row['to'] in graph_res['tainted_set']:
            G.add_edge(row['from'], row['to'], weight=row['amount_eth'])

    pos = nx.spring_layout(G, k=0.15, seed=42)

    edge_x = []
    edge_y = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])

    edge_trace = go.Scatter(x=edge_x, y=edge_y, line=dict(width=0.5, color='#444'), hoverinfo='none', mode='lines')

    node_x = []
    node_y = []
    node_color = []
    node_text = []

    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)

        if node == graph_res['drain_wallet']:
            node_color.append('red')
            node_text.append(f"DRAIN: {node}")
        elif node in graph_res['hubs']:
            node_color.append('orange')
            node_text.append(f"HUB: {node}")
        elif node == graph_res['gas_funder']:
            node_color.append('green')
            node_text.append(f"GAS FUNDER: {node}")
        else:
            node_color.append('#58a6ff')
            node_text.append(node)

    node_trace = go.Scatter(x=node_x, y=node_y, mode='markers', hoverinfo='text',
                            text=node_text, marker=dict(showscale=False, color=node_color, size=10, line_width=1))

    fig = go.Figure(data=[edge_trace, node_trace],
                 layout=go.Layout(
                    showlegend=False,
                    hovermode='closest',
                    margin=dict(b=0,l=0,r=0,t=0),
                    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                    plot_bgcolor='rgba(0,0,0,0)',
                    paper_bgcolor='rgba(0,0,0,0)',
                ))
    st.plotly_chart(fig, use_container_width=True)

with right_col:
    st.subheader("🎯 Suspect Ranking")

    # Filter suspects by threshold
    filtered_suspects = [l for l in scored_links if l['probability'] >= confidence_threshold]

    if not filtered_suspects:
        st.info("No suspects meet the current confidence threshold.")
    else:
        # Selection for evidence panel
        selected_id = st.selectbox("Select Suspect for Analysis",
                                 options=[f"{s['identity']} -> {s['wallet']}" for s in filtered_suspects])

        # Find the full data for the selected suspect
        selected_data = next(s for s in filtered_suspects if f"{s['identity']} -> {s['wallet']}" == selected_id)

        st.markdown(f"### Probability: `{selected_data['probability']:.2%}`")

        st.markdown("#### Evidence Trail")
        for ev in selected_data['evidence']:
            st.markdown(f'<div class="evidence-box">{ev}</div>', unsafe_allow_html=True)

st.markdown("---")

# Analyst Copilot
st.subheader("🤖 Analyst Copilot")
user_query = st.text_input("Ask the AI about a specific link (e.g., 'Why is n0x_phantom linked to the hub?')")
if user_query:
    # In a real app, this would send the evidence list to the LLM
    # For the demo, we provide a structured response grounded in the evidence
    evidence_context = "\n".join([f"{l['identity']} -> {l['wallet']}: {', '.join(l['evidence'])}" for l in scored_links[:5]])
    st.info(f"**Analyst Note:** Based on the gathered evidence:\n\n{evidence_context}\n\n\n*The system predicts this link based on temporal correlation and graph proximity. Please verify with a manual chain audit.*")

st.warning("⚠️ **Disclaimer**: All outputs are probabilistic evidence based on statistical modeling. They do not constitute legal proof of identity.")
