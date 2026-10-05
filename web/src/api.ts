import type { Brief, LocalizeRequest, Project, ReviewReport, Script } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8010').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  referral: boolean

  constructor(status: number, message: string, referral = false) {
    super(message)
    this.status = status
    this.referral = referral
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
    throw new ApiError(0, `تعذر الاتصال بالخادم (${BASE}). تأكد أنه يعمل.`)
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `خطأ ${response.status}`
    throw new ApiError(response.status, message, Boolean(data?.referral))
  }
  return response.json()
}

export const api = {
  createProject: (brief: Brief) => request<Project>('POST', '/projects', brief),
  getProject: (id: string) => request<Project>('GET', `/projects/${id}`),
  createScript: (projectId: string, ideaId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/ideas/${ideaId}/script`, { notes }),
  localize: (projectId: string, scriptId: string, body: LocalizeRequest) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/localize`, body),
  review: (projectId: string, scriptId: string) =>
    request<ReviewReport>('POST', `/projects/${projectId}/scripts/${scriptId}/review`),
  revise: (projectId: string, scriptId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/revise`, { notes }),
  approve: (projectId: string, scriptId: string) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/approve`),
}
