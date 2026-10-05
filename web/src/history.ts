import type { Project } from './types'

// Generation history lives in this browser only: the API has no accounts, so it cannot list "my" projects.
const KEY = 'balagh.history'
const LEGACY_KEY = 'balagh.project'

export interface HistoryEntry {
  id: string
  title: string
  audience: string
  language: Project['brief']['language']
  at: string
  scripts: number
  approved: number
  /** Opened from someone else's review link rather than created here. */
  shared: boolean
}

export function loadHistory(): HistoryEntry[] {
  try {
    const entries: HistoryEntry[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy && !entries.some((e) => e.id === legacy)) {
      entries.unshift({ id: legacy, title: '…', audience: '', language: 'ar', at: new Date().toISOString(), scripts: 0, approved: 0, shared: false })
    }
    localStorage.removeItem(LEGACY_KEY)
    return entries
  } catch {
    return []
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage can be unavailable (private mode); history then lasts for the session only.
  }
}

export function projectTitle(p: Project): string {
  return p.brief.idea?.trim() || p.ideas[0]?.title || 'مواضيع مقترحة'
}

/** Inserts or refreshes the entry for a project, keeping its original date and newest-first order. */
export function upsertEntry(entries: HistoryEntry[], p: Project, shared = false): HistoryEntry[] {
  const old = entries.find((e) => e.id === p.id)
  const scripts = Object.values(p.scripts)
  const entry: HistoryEntry = {
    id: p.id,
    title: projectTitle(p),
    audience: p.brief.audience,
    language: p.brief.language,
    at: old?.at ?? new Date().toISOString(),
    scripts: scripts.length,
    approved: scripts.filter((s) => s.approved).length,
    shared: old?.shared ?? shared,
  }
  if (old && JSON.stringify(old) === JSON.stringify(entry)) return entries
  return old ? entries.map((e) => (e.id === p.id ? entry : e)) : [entry, ...entries]
}
