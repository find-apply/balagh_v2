import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Brief, Feedback, FeedbackIn, Project, PublicShowcase, ReviewReport, ReviewRole, Script, Video, VideoTemplate,
} from './shared/types'

/** The same API the site uses. Set EXPO_PUBLIC_API_URL to point the app at another server. */
export const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://balagh.space/api').replace(/\/$/, '')

/** A row of this device's history, as the server keeps it. */
export interface HistoryEntry {
  id: string
  title: string
  audience: string
  language: 'ar' | 'en'
  at: string
  scripts: number
  approved: number
  shared: boolean
}

/** A finished video in this device's library, with the version it was made from. */
export interface LibraryItem {
  video: Video
  project_id: string
  script_id: string
  title: string
  audience: string
  approved: boolean
}

export class ApiError extends Error {
  status: number
  referral: boolean
  constructor(status: number, message: string, referral = false) {
    super(message)
    this.status = status
    this.referral = referral
  }
}

// An anonymous per-device id: the server keeps this device's history under it (there are no accounts),
// exactly as it does for a browser.
let client: Promise<string> | null = null
function clientId(): Promise<string> {
  client ??= (async () => {
    const KEY = 'balagh.client'
    let id = await AsyncStorage.getItem(KEY).catch(() => null)
    if (!id) {
      id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      await AsyncStorage.setItem(KEY, id).catch(() => undefined)
    }
    return id
  })()
  return client
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Client-Id': await clientId(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d?.msg ?? '').join('، ') : `خطأ ${response.status}`
    throw new ApiError(response.status, message.replace(/^Value error, /, ''), Boolean(data?.referral))
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  createProject: (brief: Brief) => request<Project>('POST', '/projects', brief),
  listProjects: () => request<HistoryEntry[]>('GET', '/projects'),
  hideProject: (id: string) => request<void>('DELETE', `/projects/${id}`),
  getProject: (id: string) => request<Project>('GET', `/projects/${id}`),
  createScript: (projectId: string, ideaId: string) => request<Script>('POST', `/projects/${projectId}/ideas/${ideaId}/script`, { notes: null }),
  review: (projectId: string, scriptId: string) => request<ReviewReport>('POST', `/projects/${projectId}/scripts/${scriptId}/review`),
  revise: (projectId: string, scriptId: string) => request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/revise`, { notes: null }),
  approve: (projectId: string, scriptId: string, role: ReviewRole, name: string) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/approve`, { role, name, note: null, invite: null }),
  templates: () => request<VideoTemplate[]>('GET', '/video/templates'),
  chooseTemplate: (projectId: string, scriptId: string, template: string) =>
    request<Script>('PUT', `/projects/${projectId}/scripts/${scriptId}/template`, { template }),
  createVideo: (projectId: string, scriptId: string, template: string) =>
    request<Video>('POST', `/projects/${projectId}/scripts/${scriptId}/videos`, { template }),
  videos: (projectId: string, scriptId: string) => request<Video[]>('GET', `/projects/${projectId}/scripts/${scriptId}/videos`),
  video: (id: string) => request<Video>('GET', `/videos/${id}`),
  showcase: () => request<PublicShowcase>('GET', '/showcase'),
  library: () => request<LibraryItem[]>('GET', '/library'),
  feedback: (videoId: string) => request<Feedback[]>('GET', `/videos/${videoId}/feedback`),
  rate: (videoId: string, body: FeedbackIn) => request<Feedback>('POST', `/videos/${videoId}/feedback`, body),
}

/** The site's address, for links a reviewer opens in a browser. */
export const SITE = BASE.replace(/\/api$/, '')
