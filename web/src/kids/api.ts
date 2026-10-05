import type { GuardianRole, Story, StoryRequest } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8010').replace(/\/$/, '')

export class KidsError extends Error {
  unsuitable: boolean

  constructor(message: string, unsuitable = false) {
    super(message)
    this.unsuitable = unsuitable
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new KidsError('تعذر الاتصال بالخادم.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const detail = typeof data?.detail === 'string' ? data.detail : `خطأ ${response.status}`
    throw new KidsError(detail, Boolean(data?.unsuitable))
  }
  return response.json()
}

export const kidsApi = {
  create: (body: StoryRequest) => request<Story>('POST', '/kids/stories', body),
  get: (id: string) => request<Story>('GET', `/kids/stories/${id}`),
  approve: (id: string, role: GuardianRole, name: string) =>
    request<Story>('POST', `/kids/stories/${id}/approve`, { role, name }),
}
