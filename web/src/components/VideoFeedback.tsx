import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Feedback, ViewerRole } from '../types'

export const VIEWER_ROLES: Record<ViewerRole, string> = {
  student: 'طالب علم',
  scholar: 'عالم',
  sheikh: 'شيخ',
  other: 'مشاهد',
}

const KEY = 'balagh.rater'

/** The rater's name and standing, remembered on this device so a reviewer types them once. */
function remembered(): { name: string; role: ViewerRole | null } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v.name === 'string') return { name: v.name, role: v.role in VIEWER_ROLES ? v.role : null }
  } catch {
    // nothing remembered
  }
  return { name: '', role: null }
}

function Stars({ value, onChange, size = 'big' }: { value: number; onChange?: (n: number) => void; size?: 'big' | 'small' }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <span className={`stars ${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} من 5`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} من 5`} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
            ★
          </button>
        ) : (
          <span key={n} className={n <= shown ? 'on' : ''} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </span>
  )
}

/** After a video is made: "give me your opinion", with stars, the rater's standing and name. */
export function VideoFeedback({ videoId }: { videoId: string }) {
  const [list, setList] = useState<Feedback[] | null>(null)
  const [stars, setStars] = useState(0)
  const [role, setRole] = useState<ViewerRole | null>(() => remembered().role)
  const [name, setName] = useState(() => remembered().name)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    setList(null)
    setSent(false)
    api.feedback(videoId).then(setList, () => setList([]))
  }, [videoId])

  const ready = stars > 0 && role !== null && name.trim().length >= 2
  const send = async () => {
    if (!ready || !role) return
    setSending(true)
    setError(null)
    try {
      const f = await api.rate(videoId, { stars, role, name: name.trim(), comment: comment.trim() || null })
      setList((l) => [f, ...(l ?? [])])
      setSent(true)
      setStars(0)
      setComment('')
      try {
        localStorage.setItem(KEY, JSON.stringify({ name: name.trim(), role }))
      } catch {
        // remembered for this visit only
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  const average = list && list.length ? list.reduce((s, f) => s + f.stars, 0) / list.length : null

  return (
    <div className="feedback">
      <div className="feedback-head">
        <h4>أعطنا رأيك في هذا الفيديو</h4>
        {average !== null && (
          <span className="muted small">
            <Stars value={Math.round(average)} size="small" /> {average.toFixed(1)} من {list!.length} {list!.length === 1 ? 'تقييم' : 'تقييمات'}
          </span>
        )}
      </div>

      {sent ? (
        <p className="notice ok">
          شكرا، سُجّل تقييمك.{' '}
          <button type="button" className="link" onClick={() => setSent(false)}>
            أضف تقييما آخر
          </button>
        </p>
      ) : (
        <form
          className="feedback-form"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Stars value={stars} onChange={setStars} />
          <div className="chips" role="radiogroup" aria-label="الاختصاص">
            {(Object.keys(VIEWER_ROLES) as ViewerRole[]).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} className={role === r ? 'chip on' : 'chip'} onClick={() => setRole(r)}>
                {VIEWER_ROLES[r]}
              </button>
            ))}
          </div>
          <input type="text" placeholder="اسمك" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="الاسم" />
          <textarea placeholder="ملاحظتك (اختياري)" value={comment} maxLength={1000} rows={2} onChange={(e) => setComment(e.target.value)} aria-label="الملاحظة" />
          {error && <p className="notice bad small">{error}</p>}
          <button type="submit" className="primary" disabled={!ready || sending}>
            {sending ? 'يُرسل…' : 'أرسل التقييم'}
          </button>
        </form>
      )}

      {list && list.length > 0 && (
        <ul className="plain feedback-list">
          {list.slice(0, 5).map((f) => (
            <li key={f.id}>
              <Stars value={f.stars} size="small" /> <strong dir="auto">{f.name}</strong> <span className="badge">{VIEWER_ROLES[f.role]}</span>
              {f.comment && (
                <p className="muted small" dir="auto">
                  {f.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
