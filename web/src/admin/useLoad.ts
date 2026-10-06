import { useEffect, useState } from 'react'

/** Runs a loader on mount, whenever `deps` change, and on demand; a response that arrives after a newer
 * request started is dropped, so typing fast in a search box never shows an older result. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const key = JSON.stringify(deps)

  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      if (live) setLoading(true)
    }, 0)
    load().then(
      (d) => {
        if (!live) return
        setData(d)
        setError(null)
        setLoading(false)
      },
      (e) => {
        if (!live) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      },
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
    // The loader is identified by its deps, not its identity: callers pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])

  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}
