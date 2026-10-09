import { useSyncExternalStore } from 'react'
import type { Task } from './shared/tasks'

/** A long request in flight (ideas, a script, a review). Kept outside the screens, so leaving a screen and
 * coming back finds the job still running and its clock still counting from when it started. */
export interface Job {
  key: string
  task: Task
  started: number
  error: string | null
}

let jobs: Record<string, Job> = {}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function useJob(key: string): Job | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => jobs[key] ?? null,
  )
}

/** Runs `work` under `key` unless a job with that key is already running; the result goes to `then`. */
export async function run<T>(key: string, task: Task, work: () => Promise<T>): Promise<T | null> {
  if (jobs[key] && !jobs[key].error) return null
  jobs = { ...jobs, [key]: { key, task, started: Date.now(), error: null } }
  emit()
  try {
    const out = await work()
    const { [key]: _, ...rest } = jobs
    jobs = rest
    emit()
    return out
  } catch (e) {
    jobs = { ...jobs, [key]: { ...jobs[key], error: e instanceof Error ? e.message : String(e) } }
    emit()
    return null
  }
}

export function clearJob(key: string) {
  const { [key]: _, ...rest } = jobs
  jobs = rest
  emit()
}
