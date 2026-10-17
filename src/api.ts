const API_BASE = "http://localhost:8000";

export interface ApiClient {
  analyze(): Promise<{ status: string; message: string }>;
  getGraph(): Promise<any>;
  getSuspects(): Promise<any[]>;
  getMetrics(): Promise<any>;
}

export const api: ApiClient = {
  async analyze() {
    const res = await fetch(`${API_BASE}/analyze`);
    return res.json();
  },
  async getGraph() {
    const res = await fetch(`${API_BASE}/graph`);
    return res.json();
  },
  async getSuspects() {
    const res = await fetch(`${API_BASE}/suspects`);
    return res.json();
  },
  async getMetrics() {
    const res = await fetch(`${API_BASE}/metrics`);
    return res.json();
  },
};
