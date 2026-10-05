import type { HistoryEntry } from './history'
import type { Brief, LocalizeRequest, Project, ReviewReport, ReviewRole, Script } from './types'

export const BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8010').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  referral: boolean

  constructor(status: number, message: string, referral = false) {
    super(message)
    this.status = status
    this.referral = referral
  }
}

// An anonymous per-browser id: the server keeps this browser's history under it (there are no accounts).
function clientId(): string {
  try {
    let id = localStorage.getItem('balagh.client')
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '')
      localStorage.setItem('balagh.client', id)
    }
    return id
  } catch {
    return ''
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(clientId() ? { 'X-Client-Id': clientId() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, `تعذر الاتصال بالخادم (${BASE}). تأكد أنه يعمل.`)
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `خطأ ${response.status}`
    throw new ApiError(response.status, message, Boolean(data?.referral))
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  createProject: (brief: Brief) => request<Project>('POST', '/projects', brief),
  listProjects: () => request<HistoryEntry[]>('GET', '/projects'),
  hideProject: (id: string) => request<void>('DELETE', `/projects/${id}`),
  getProject: (id: string) => request<Project>('GET', `/projects/${id}`),
  createScript: (projectId: string, ideaId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/ideas/${ideaId}/script`, { notes }),
  localize: (projectId: string, scriptId: string, body: LocalizeRequest) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/localize`, body),
  review: (projectId: string, scriptId: string) =>
    request<ReviewReport>('POST', `/projects/${projectId}/scripts/${scriptId}/review`),
  revise: (projectId: string, scriptId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/revise`, { notes }),
  approve: (projectId: string, scriptId: string, role: ReviewRole, name: string) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/approve`, { role, name }),
}
