import { BASE } from '../api'
import type { Video } from '../types'

/** What the automatic checks found on a finished video, and four stills of it. */
export function VideoChecks({ video, compact = false }: { video: Video; compact?: boolean }) {
  if (video.status !== 'done') return null
  const bad = video.checks.filter((c) => !c.ok)
  return (
    <div className="vchecks">
      {video.frames.length > 0 && (
        <div className="frames" aria-label="لقطات من الفيديو">
          {video.frames.map((f) => (
            <img src={BASE + f} alt="" key={f} loading="lazy" />
          ))}
        </div>
      )}
      {video.checks.length > 0 && (
        <ul className={`plain checks ${compact ? 'compact' : ''}`}>
          {video.checks.map((c) => (
            <li key={c.name} className={c.ok ? 'ok' : 'bad'}>
              <span className={c.ok ? 'badge ok' : 'badge bad'}>{c.ok ? '✓' : '!'}</span> {c.detail}
            </li>
          ))}
        </ul>
      )}
      {bad.length > 0 && <p className="small bad-text">فحص آلي وجد {bad.length} ملاحظة؛ شاهد الفيديو قبل الاعتماد.</p>}
    </div>
  )
}
