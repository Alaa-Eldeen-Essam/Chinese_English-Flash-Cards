const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json();
}
