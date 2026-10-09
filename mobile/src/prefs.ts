import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

/** This device's settings, kept on the device: whether a new script is reviewed straight away, and the name and
 * standing a rating is signed with. */
export interface Prefs {
  autoReview: boolean
  raterName: string
  raterRole: 'student' | 'scholar' | 'sheikh' | 'other' | null
}

const KEY = 'balagh.prefs'
const DEFAULTS: Prefs = { autoReview: true, raterName: '', raterRole: null }
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
