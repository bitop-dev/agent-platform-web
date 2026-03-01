const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem("token", data.token);
        headers["Authorization"] = `Bearer ${data.token}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({ error: "Request failed" }));
          throw new ApiError(retry.status, err.error || "Request failed");
        }
        return retry.json();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, err.error || "Request failed");
  }
  return res.json();
}

// Auth
export const auth = {
  register: (email: string, name: string, password: string) =>
    request<{ token: string; refresh_token: string; user: User }>("/api/v1/auth/register", {
      method: "POST", body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; refresh_token: string; user: User }>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/v1/me"),
};

// Agents
export const agents = {
  list: () => request<{ agents: Agent[] }>("/api/v1/agents"),
  get: (id: string) => request<Agent>(`/api/v1/agents/${id}`),
  create: (data: CreateAgentRequest) =>
    request<Agent>("/api/v1/agents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateAgentRequest> & { enabled?: boolean }) =>
    request<Agent>(`/api/v1/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ status: string }>(`/api/v1/agents/${id}`, { method: "DELETE" }),
};

// Runs
export const runs = {
  create: (agentId: string, mission: string, baseUrl?: string) =>
    request<Run>("/api/v1/runs", {
      method: "POST", body: JSON.stringify({ agent_id: agentId, mission, base_url: baseUrl }),
    }),
  get: (id: string) => request<Run>(`/api/v1/runs/${id}`),
  list: () => request<{ runs: Run[] }>("/api/v1/runs"),
  events: (id: string) => request<{ events: RunEvent[] }>(`/api/v1/runs/${id}/events`),
  cancel: (id: string) =>
    request<{ status: string }>(`/api/v1/runs/${id}/cancel`, { method: "POST" }),
};

// API Keys
export const apiKeys = {
  list: () => request<{ api_keys: ApiKey[] }>("/api/v1/api-keys"),
  create: (data: CreateApiKeyRequest) =>
    request<ApiKey>("/api/v1/api-keys", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ status: string }>(`/api/v1/api-keys/${id}`, { method: "DELETE" }),
};

// Skills
export const skills = {
  list: (tier?: string) => request<{ skills: Skill[] }>(`/api/v1/skills${tier ? `?tier=${tier}` : ""}`),
  get: (id: string) => request<Skill>(`/api/v1/skills/${id}`),
  create: (data: CreateSkillRequest) =>
    request<Skill>("/api/v1/skills", { method: "POST", body: JSON.stringify(data) }),
};

// Skill Sources
export const skillSources = {
  list: () => request<{ skill_sources: SkillSource[] }>("/api/v1/skill-sources"),
  create: (url: string, label: string) =>
    request<SkillSource>("/api/v1/skill-sources", { method: "POST", body: JSON.stringify({ url, label }) }),
  delete: (id: string) =>
    request<void>(`/api/v1/skill-sources/${id}`, { method: "DELETE" }),
  sync: (id: string) =>
    request<{ message: string }>(`/api/v1/skill-sources/${id}/sync`, { method: "POST" }),
  syncAll: () =>
    request<{ message: string }>("/api/v1/skill-sources/sync", { method: "POST" }),
};

// Models + Dashboard
export const models = {
  list: (provider?: string) =>
    request<{ models: Model[] }>(`/api/v1/models${provider ? `?provider=${provider}` : ""}`),
};
export const dashboard = { get: () => request<DashboardData>("/api/v1/dashboard") };

// WebSocket
export function connectRunStream(runId: string, onEvent: (e: RunEvent) => void, onClose?: () => void): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/ws/runs/${runId}`);
  ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { /* skip */ } };
  ws.onclose = () => onClose?.();
  return ws;
}

// Types
export interface User { id: string; email: string; name: string; created_at: string }
export interface Agent {
  id: string; user_id: string; name: string; description?: string; system_prompt: string;
  model_provider: string; model_name: string; config_yaml: string;
  max_turns: number; timeout_seconds: number; enabled: boolean;
  created_at: string; updated_at: string;
}
export interface CreateAgentRequest {
  name: string; description?: string; system_prompt: string;
  model_provider: string; model_name: string; config_yaml?: string;
  max_turns?: number; timeout_seconds?: number;
}
export interface Run {
  id: string; agent_id: string; user_id: string; mission: string;
  model_provider: string; model_name: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  output_text: string; error_message: string;
  total_turns: number; input_tokens: number; output_tokens: number;
  cost_usd: number; duration_ms: number;
  created_at: string; started_at: string; completed_at: string;
}
export interface RunEvent { id: number; run_id: string; seq: number; event_type: string; data: string; occurred_at: string }
export interface ApiKey { id: string; provider: string; label: string; key_hint: string; is_default: boolean; base_url: string; created_at: string }
export interface CreateApiKeyRequest { provider: string; label: string; key: string; is_default: boolean; base_url?: string }
export interface Skill { id: string; name: string; description: string; tier: string; version: string; skill_md: string; tags: string; source_url: string; enabled: boolean; created_at: string }
export interface CreateSkillRequest { name: string; description?: string; tier?: string; skill_md?: string; tags?: string; source_url?: string }
export interface SkillSource { id: string; url: string; label: string; is_default: boolean; status: string; skill_count: number; error_msg?: string; last_synced?: string; created_at: string }
export interface Model { id: string; provider: string; display_name: string; context_window: number; input_cost_per_1m: number; output_cost_per_1m: number; supports_tools: boolean; is_reasoning: boolean }
export interface DashboardData { agents: number; total_runs: number; succeeded: number; failed: number; running: number; recent_runs: Run[] }
