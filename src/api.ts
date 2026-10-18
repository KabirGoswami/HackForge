export interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  details: string;
  result?: any;
}

export interface AnalyzeResult {
  status: string;
  message: string;
  mode?: string;
  target_wallet?: string;
  suspects_count?: number;
  job_id?: string;
  tainted_wallets?: number;
}

export interface ApiClient {
  analyze(targetWallet?: string): Promise<AnalyzeResult>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  getGraph(jobId?: string): Promise<any>;
  getSuspects(jobId?: string): Promise<any[]>;
  getMetrics(): Promise<any>;
  getKpis(): Promise<any>;
}

export const api: ApiClient = {
  async analyze(targetWallet?: string): Promise<AnalyzeResult> {
    const cleanWallet = targetWallet?.trim() || "";
    const query = cleanWallet ? `?target_wallet=${encodeURIComponent(cleanWallet)}` : "";
    
    // First try POST for async background job execution, fallback to GET if needed
    try {
      const res = await fetch(`/analyze${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to GET
    }

    const res = await fetch(`/analyze${query}`);
    return res.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await fetch(`/job/${jobId}`);
    return res.json();
  },

  async getGraph(jobId?: string): Promise<any> {
    const url = jobId ? `/graph?job_id=${jobId}` : `/graph`;
    const res = await fetch(url);
    return res.json();
  },

  async getSuspects(jobId?: string): Promise<any[]> {
    const url = jobId ? `/suspects?job_id=${jobId}` : `/suspects`;
    const res = await fetch(url);
    return res.json();
  },

  async getMetrics(): Promise<any> {
    const res = await fetch(`/metrics`);
    return res.json();
  },

  async getKpis(): Promise<any> {
    const res = await fetch(`/war-room/kpis`);
    return res.json();
  },
};
