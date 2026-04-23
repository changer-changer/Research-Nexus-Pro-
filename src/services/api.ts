// Unified API client for Research-Nexus Pro
// All API calls should go through this layer instead of raw fetch()

const API_V3 = '/api/v3'
const API_V4 = '/api/v4'
const API_ROOT = '/api'
const API_COGNEE = '/api/cognee'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  v3: {
    get: <T>(path: string) => request<T>(`${API_V3}${path}`),
    post: <T>(path: string, body: unknown) => request<T>(`${API_V3}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),
    del: <T>(path: string) => request<T>(`${API_V3}${path}`, { method: 'DELETE' }),
  },
  v4: {
    post: <T>(path: string, body: unknown) => request<T>(`${API_V4}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),
  },
  root: {
    get: <T>(path: string) => request<T>(`${API_ROOT}${path}`),
    post: <T>(path: string, body: unknown) => request<T>(`${API_ROOT}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),
    del: <T>(path: string) => request<T>(`${API_ROOT}${path}`, { method: 'DELETE' }),
  },
  cognee: {
    get: <T>(path: string) => request<T>(`${API_COGNEE}${path}`),
    post: <T>(path: string, body?: unknown) => request<T>(`${API_COGNEE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
    }),
  },
}
