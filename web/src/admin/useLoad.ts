import { useCallback, useEffect, useState } from 'react'

/** Runs a loader on mount and on demand, exposing its state for a view to render. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setLoading(true)
    load().then(
      (d) => {
        setData(d)
        setError(null)
        setLoading(false)
      },
      (e) => {
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      },
    )
  }, deps)

  useEffect(run, [run])
  return { data, error, loading, reload: run }
}
