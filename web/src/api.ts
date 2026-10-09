import type { HistoryEntry } from './history'
import type { Brief, Feedback, FeedbackIn, PublicShowcase, LocalizeRequest, Project, ReviewReport, ReviewRole, Script, Video, VideoTemplate } from './types'

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
      // crypto.randomUUID needs a secure context; a plain-HTTP origin falls back to Math.random.
      id = (crypto.randomUUID?.() ?? Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')).replace(/-/g, '')
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
  /** A PDF, image or text file to draw the ideas from; the id goes in the brief's source_file. */
  upload: async (file: File): Promise<{ id: string; name: string }> => {
    const form = new FormData()
    form.append('file', file)
    let response: Response
    try {
      response = await fetch(BASE + '/uploads', { method: 'POST', body: form, headers: clientId() ? { 'X-Client-Id': clientId() } : {} })
    } catch {
      throw new ApiError(0, `تعذر الاتصال بالخادم (${BASE}).`)
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new ApiError(response.status, typeof data?.detail === 'string' ? data.detail : `خطأ ${response.status}`)
    }
    return response.json()
  },
  listProjects: () => request<HistoryEntry[]>('GET', '/projects'),
  hideProject: (id: string) => request<void>('DELETE', `/projects/${id}`),
  getProject: (id: string) => request<Project>('GET', `/projects/${id}`),
  /** Adds the project to this browser's server-side history; shared marks one opened from a review link. */
  openProject: (id: string, shared: boolean) => request<Project>('POST', `/projects/${id}/open?shared=${shared}`),
  createScript: (projectId: string, ideaId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/ideas/${ideaId}/script`, { notes }),
  localize: (projectId: string, scriptId: string, body: LocalizeRequest) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/localize`, body),
  review: (projectId: string, scriptId: string) =>
    request<ReviewReport>('POST', `/projects/${projectId}/scripts/${scriptId}/review`),
  revise: (projectId: string, scriptId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/revise`, { notes }),
  exportScript: (projectId: string, scriptId: string) => request<Script>('GET', `/projects/${projectId}/scripts/${scriptId}/export`),
  approve: (projectId: string, scriptId: string, role: ReviewRole, name: string, note?: string, invite?: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/approve`, { role, name, note: note ?? null, invite: invite ?? null }),
  requestChanges: (projectId: string, scriptId: string, role: ReviewRole, name: string, note: string, invite?: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/request-changes`, { role, name, note, invite: invite ?? null }),
  /** The creator invites their language reviewer; the scholar's invitations come from the platform. */
  invite: (projectId: string, role: ReviewRole) => request<{ role: ReviewRole; token: string }>('POST', `/projects/${projectId}/invites`, { role }),
  templates: () => request<VideoTemplate[]>('GET', '/video/templates'),
  chooseTemplate: (projectId: string, scriptId: string, template: string) =>
    request<Script>('PUT', `/projects/${projectId}/scripts/${scriptId}/template`, { template }),
  rewriteStory: (projectId: string, scriptId: string, notes: string | null) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/story`, { notes }),
  createVideo: (projectId: string, scriptId: string, template: string) =>
    request<Video>('POST', `/projects/${projectId}/scripts/${scriptId}/videos`, { template }),
  videos: (projectId: string, scriptId: string) => request<Video[]>('GET', `/projects/${projectId}/scripts/${scriptId}/videos`),
  video: (id: string) => request<Video>('GET', `/videos/${id}`),
  showcase: () => request<PublicShowcase>('GET', '/showcase'),
  feedback: (videoId: string) => request<Feedback[]>('GET', `/videos/${videoId}/feedback`),
  rate: (videoId: string, body: FeedbackIn) => request<Feedback>('POST', `/videos/${videoId}/feedback`, body),
}
