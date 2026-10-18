import type { components } from './generated/schema'

export type Assessment = components['schemas']['Assessment']
export type BusinessRecord = components['schemas']['BusinessRecord']
export type JobView = components['schemas']['JobView']

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean,
    public readonly requestId?: string, public readonly status?: number) { super(message) }
}

export async function apiRequest<T>(path: `/v1/${string}`, options: {
  token: string; method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; signal?: AbortSignal; idempotencyKey?: string
}): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!base) throw new ApiError('configuration_missing', 'The workspace API is not configured.', false)
  const headers: Record<string, string> = { Authorization: `Bearer ${options.token}` }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  let response: Response
  try {
    const timeout = AbortSignal.timeout(15_000)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, { method: options.method || 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network_error', 'Connection interrupted. Your saved work remains available.', true)
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as components['schemas']['ErrorEnvelope'] | null
    throw new ApiError(payload?.code || 'request_failed', payload?.message || 'The request could not be completed.',
      payload?.retryable ?? response.status >= 500, payload?.request_id, response.status)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}
