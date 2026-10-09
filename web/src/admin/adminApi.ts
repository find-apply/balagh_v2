import { BASE } from '../api'
import type { Feedback, Project } from '../types'

const KEY = 'balagh.admin'

// Kept in memory too, so signing in still works where session storage is blocked.
let memory = ''

export const adminToken = {
  get: () => {
    try {
      return sessionStorage.getItem(KEY) ?? memory
    } catch {
      return memory
    }
  },
  set: (t: string) => {
    memory = t
    try {
      if (t) sessionStorage.setItem(KEY, t)
      else sessionStorage.removeItem(KEY)
    } catch {
      // The token then lasts until the page is reloaded.
    }
  },
}

export class AdminError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: string, path: string, body?: unknown, token = adminToken.get()): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/admin${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AdminError(0, `تعذر الاتصال بالخادم (${BASE}).`)
  }
  if (!res.ok) {
    if (res.status === 401 && token === adminToken.get()) dispatchEvent(new Event('admin-unauthorized'))
    const data = await res.json().catch(() => null)
    const d = data?.detail
    throw new AdminError(res.status, typeof d === 'string' ? d : d ? JSON.stringify(d) : `خطأ ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export interface Overview {
  totals: { projects: number; scripts: number; approved: number; awaiting: number; specialist: number; localized: number }
  by_language: Record<string, number>
  by_level: Record<string, number>
  runs_24h: { total: number; failed: number; by_kind: { kind: string; total: number; failed: number; avg_seconds: number }[] }
  series: { day: string; projects: number; runs: number }[]
  paused: boolean
}

export interface ProjectRow {
  id: string
  title: string
  audience: string
  language: string
  created_at: string | null
  ideas: number
  scripts: number
  approved: number
  awaiting: number
  levels: string[]
}

export interface PendingApproval {
  project_id: string
  script_id: string
  title: string
  version: number
  content_level: string
  author: 'creator' | 'specialist'
  localized: boolean
  missing: string[]
  signed: string[]
}

export interface Run {
  id: number
  at: string
  kind: string
  model: string
  seconds: number
  ok: boolean
  error: string | null
}

export interface FlowSettings {
  generation_model: string
  review_model: string
  extra_rules: string
  paused: boolean
  paused_message: string
}

export interface Flow {
  stages: { key: string; model: string | null; prompt: string | null; detail: string }[]
  prompts: Record<string, string>
  sources: { glossary_terms: number; max_verses: number; collections: Record<string, string> }
  approval_roles: Record<string, string>
}

export interface FeedbackReport {
  templates: { template: string; name: string; ratings: number; average: number | null; by_role: Record<string, number> }[]
  items: Feedback[]
}

export const adminApi = {
  feedback: () => call<FeedbackReport>('GET', '/feedback'),
  check: (token: string) => call<{ ok: boolean }>('GET', '/session', undefined, token),
  overview: () => call<Overview>('GET', '/overview'),
  projects: (q: string) => call<ProjectRow[]>('GET', `/projects?limit=200&q=${encodeURIComponent(q)}`),
  project: (id: string) => call<Project>('GET', `/projects/${id}`),
  deleteProject: (id: string) => call<void>('DELETE', `/projects/${id}?confirm=true`),
  approvals: () => call<PendingApproval[]>('GET', '/approvals'),
  invite: (projectId: string, role = 'scholar') => call<{ role: string; token: string }>('POST', `/projects/${projectId}/invites?role=${role}`),
  runs: (failed: boolean) => call<Run[]>('GET', `/runs?limit=200&failed=${failed}`),
  settings: () => call<FlowSettings>('GET', '/settings'),
  saveSettings: (s: FlowSettings) => call<FlowSettings>('PUT', '/settings', s),
  flow: () => call<Flow>('GET', '/flow'),
}
