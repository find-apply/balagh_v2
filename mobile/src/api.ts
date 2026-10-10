import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Brief, Feedback, FeedbackIn, Project, PublicShowcase, ReviewReport, ReviewRole, Script, Video, VideoTemplate,
} from './shared/types'
import { idToken } from './firebase'

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

// A per-device id, as a browser has: what this device made before its account was approved is kept under it,
// and moves to the account once the admin lets it in.
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
    const token = await idToken()
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

/** What a person gives when signing up; the admin reviews it before the account is let in. */
export interface Profile {
  full_name: string
  specialization: string
  phone: string
}

export type AccountStatus = 'pending' | 'approved' | 'rejected'

/** The signed-in account as the server keeps it. */
export interface Me {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
  /** How the person signed in: 'google.com' or 'password'. */
  provider: string | null
  full_name: string | null
  specialization: string | null
  phone: string | null
  status: AccountStatus
  /** Set by the admin after checking the person; decides who signs their content. */
  role: 'specialist' | 'creator' | null
  /** The person changed their specialization; the admin has not looked at it yet. */
  specialization_changed: boolean
  moved: number
}

/** Whether generation is open; the admin can pause it with a message. */
export interface FlowStatus {
  paused: boolean
  message: string
}

export interface LocalizeBody {
  audience: string
  language: 'ar' | 'en'
  audience_knowledge: 'familiar' | 'basic' | 'new'
  dialect: string | null
  tone: string | null
}

export type ReportReason = 'offensive' | 'religious_error' | 'wrong_text' | 'other'

/** Generated content a person flags for the admin. */
export interface ReportIn {
  project_id: string
  script_id?: string | null
  video_id?: string | null
  reason: ReportReason
  note: string
}

export const api = {
  report: (body: ReportIn) => request<{ id: number; status: string }>('POST', '/reports', body),
  me: (profile?: Profile) => request<Me>('POST', '/me', profile ? { profile } : undefined),
  updateProfile: (profile: Profile) => request<Me>('PUT', '/me/profile', profile),
  deleteMe: () => request<void>('DELETE', '/me'),
  status: () => request<FlowStatus>('GET', '/status'),
  localize: (projectId: string, scriptId: string, body: LocalizeBody) =>
    request<Script>('POST', `/projects/${projectId}/scripts/${scriptId}/localize`, body),
  createProject: (brief: Brief) => request<Project>('POST', '/projects', brief),
  /** A PDF, image or text file to draw the ideas from; the id goes in the brief's source_file. */
  upload: async (file: { uri: string; name: string; type: string }): Promise<{ id: string; name: string }> => {
    const form = new FormData()
    // React Native's FormData takes a file as its uri, name and type. Expo's fetch does not read such a part,
    // so the upload goes through XMLHttpRequest, which does.
    form.append('file', file as unknown as Blob)
    const token = await idToken()
    const client = await clientId()
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', BASE + '/uploads')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('X-Client-Id', client)
      xhr.timeout = 120_000
      xhr.onerror = xhr.ontimeout = () => reject(new ApiError(0, 'تعذر رفع الملف. تأكد من اتصالك بالإنترنت.'))
      xhr.onload = () => {
        let data: { id?: string; name?: string; detail?: unknown } | null = null
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          // Not JSON: the status says what happened.
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.id) resolve({ id: data.id, name: data.name ?? file.name })
        else reject(new ApiError(xhr.status, typeof data?.detail === 'string' ? data.detail : `خطأ ${xhr.status}`))
      }
      xhr.send(form)
    })
  },
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
