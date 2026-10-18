const API_BASE = "http://localhost:8000";

export interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  details: string;
  result?: any;
}

export interface ApiClient {
  analyze(targetWallet?: string): Promise<{ job_id: string; status: string; message: string }>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  getGraph(jobId?: string): Promise<any>;
  getSuspects(jobId?: string): Promise<any[]>;
  getMetrics(): Promise<any>;
}

export const api: ApiClient = {
  async analyze(targetWallet) {
    const res = await fetch(`${API_BASE}/analyze?target_wallet=${targetWallet || ""}`, {
      method: "POST",
    });
    return res.json();
  },
  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/job/${jobId}`);
    return res.json();
  },
  async getGraph(jobId) {
    const url = jobId ? `${API_BASE}/graph?job_id=${jobId}` : `${API_BASE}/graph`;
    const res = await fetch(url);
    return res.json();
  },
  async getSuspects(jobId) {
    const url = jobId ? `${API_BASE}/suspects?job_id=${jobId}` : `${API_BASE}/suspects`;
    const res = await fetch(url);
    return res.json();
  },
  async getMetrics() {
    const res = await fetch(`${API_BASE}/metrics`);
    return res.json();
  },
};
