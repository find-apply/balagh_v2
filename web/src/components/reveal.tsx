import { createElement, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Whether the element has scrolled into view once. Reveals are one-shot: a card that appeared stays. */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, inView }
}

/** A block that fades and rises into place when it scrolls into view. With `stagger`, its children follow one
 * after another (each child gets `--i`). */
export function Reveal({ as = 'div', className = '', stagger = false, children }: { as?: 'div' | 'section' | 'ol' | 'ul'; className?: string; stagger?: boolean; children: ReactNode }) {
  const { ref, inView } = useInView<HTMLElement>()
  return createElement(as, { ref, className: `${className} reveal${stagger ? ' stagger' : ''}${inView ? ' in' : ''}`.trim() }, children)
}

/** A number (or a string with numbers in it, like "28/28") that counts up from zero the first time it is seen. */
export function CountUp({ value, ms = 1100 }: { value: string; ms?: number }) {
  const { ref, inView } = useInView<HTMLElement>(0.6)
  const [shown, setShown] = useState(() => value.replace(/\d+/g, '0'))
  useEffect(() => {
    if (!inView) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setShown(value.replace(/\d+/g, (n) => String(Math.round(Number(n) * e))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, ms])
  return (
    <strong ref={ref} dir="ltr">
      {shown}
    </strong>
  )
}
