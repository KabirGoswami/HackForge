const API_BASE = "http://localhost:8000";

export interface ApiClient {
  analyze(targetWallet?: string): Promise<{ status: string; message: string; mode: string; target_wallet?: string; suspects_count?: number }>;
  getGraph(): Promise<any>;
  getSuspects(): Promise<any[]>;
  getMetrics(): Promise<any>;
  getKpis(): Promise<any>;
}

export const api: ApiClient = {
  async analyze(targetWallet?: string) {
    const url = targetWallet && targetWallet.trim()
      ? `/analyze?target_wallet=${encodeURIComponent(targetWallet.trim())}`
      : `/analyze`;
    const res = await fetch(url);
    return res.json();
  },
  async getGraph() {
    const res = await fetch(`/graph`);
    return res.json();
  },
  async getSuspects() {
    const res = await fetch(`/suspects`);
    return res.json();
  },
  async getMetrics() {
    const res = await fetch(`/metrics`);
    return res.json();
  },
  async getKpis() {
    const res = await fetch(`/war-room/kpis`);
    return res.json();
  },
};

