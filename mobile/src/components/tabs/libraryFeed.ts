import { useSyncExternalStore } from 'react'
import { api } from '@/api'
import type { LibraryItem } from '@/api'
import { loadPrefs, markVideosSeen, usePrefs } from '@/prefs'

/** The library's videos, shared by the library screen and the tab bar's count of new videos. */
interface Feed {
  items: LibraryItem[] | null
  error: string | null
}

let current: Feed = { items: null, error: null }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function set(f: Feed) {
  current = f
  listeners.forEach((l) => l())
}

/** Fetches the library again; calls made while one is under way share it. */
export function refreshLibrary(): Promise<void> {
  inflight ??= api
    .library()
    .then(
      async (items) => {
        set({ items, error: null })
        // The first time the library is seen, what is already there is not new.
        const prefs = await loadPrefs()
        if (prefs.seenVideos === null) await markVideosSeen(items.map((i) => i.video.id))
      },
      (e) => set({ items: current.items, error: e instanceof Error ? e.message : String(e) }),
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useLibrary = (): Feed => useSyncExternalStore(subscribe, () => current)

/** The ids of finished videos not opened yet. */
export function useUnseen(): Set<string> {
  const { items } = useLibrary()
  const { seenVideos } = usePrefs()
  if (!items || seenVideos === null) return new Set()
  const seen = new Set(seenVideos)
  return new Set(items.filter((i) => i.video.status === 'done' && !seen.has(i.video.id)).map((i) => i.video.id))
}
