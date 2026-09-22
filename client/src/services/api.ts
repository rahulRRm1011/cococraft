export interface HealthResponse {
  success: boolean;
  service: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function checkApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status: ${response.status}`);
  }

  return response.json();
}
