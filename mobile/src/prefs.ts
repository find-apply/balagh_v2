import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

/** This device's settings, kept on the device: whether a new script is reviewed straight away, the name and
 * standing a rating is signed with, and which finished videos of the library have been opened. */
export interface Prefs {
  autoReview: boolean
  raterName: string
  raterRole: 'student' | 'scholar' | 'sheikh' | 'other' | null
  /** Library videos already opened, so the library tab counts only the new ones. Null until the library was
   * first seen: the videos there then count as seen, so an update does not flag a whole library as new. */
  seenVideos: string[] | null
}

const KEY = 'balagh.prefs'
const DEFAULTS: Prefs = { autoReview: true, raterName: '', raterRole: null, seenVideos: null }
/** Enough for any real library; the oldest ids are dropped first. */
const SEEN_LIMIT = 1000
let current: Prefs = DEFAULTS
let loaded: Promise<Prefs> | null = null
const listeners = new Set<(p: Prefs) => void>()

export function loadPrefs(): Promise<Prefs> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((v) => (current = { ...DEFAULTS, ...(v ? JSON.parse(v) : {}) }))
    .catch(() => current)
  return loaded
}

export async function setPrefs(change: Partial<Prefs>) {
  await loadPrefs()
  current = { ...current, ...change }
  listeners.forEach((l) => l(current))
  await AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined)
}

/** Records library videos as opened (or, the first time, as already there). */
export async function markVideosSeen(ids: string[]) {
  const p = await loadPrefs().then(() => current)
  const seen = p.seenVideos ?? []
  const fresh = ids.filter((id) => !seen.includes(id))
  if (fresh.length === 0 && p.seenVideos !== null) return
  await setPrefs({ seenVideos: [...seen, ...fresh].slice(-SEEN_LIMIT) })
}

export function usePrefs(): Prefs {
  const [p, setP] = useState(current)
  useEffect(() => {
    void loadPrefs().then(setP)
    listeners.add(setP)
    return () => {
      listeners.delete(setP)
    }
  }, [])
  return p
}
