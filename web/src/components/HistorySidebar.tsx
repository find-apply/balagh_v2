import { useState } from 'react'
import { BASE } from '../api'
import type { HistoryEntry } from '../history'
import { LANGUAGES } from '../labels'
import { Logo } from './Landing'

interface Props {
  entries: HistoryEntry[]
  activeId: string | null
  busyId: string | null
  composing: boolean
  onNew: () => void
  onOpen: (id: string) => void
  onHide: (id: string) => void
  onHome: () => void
}

const DAY = 24 * 60 * 60 * 1000

function group(at: string): string {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const t = new Date(at).getTime()
  if (t >= start.getTime()) return 'اليوم'
  if (t >= start.getTime() - 6 * DAY) return 'هذا الأسبوع'
  return 'أقدم'
}

export function HistorySidebar({ entries, activeId, busyId, composing, onNew, onOpen, onHide, onHome }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const shown = q ? entries.filter((e) => `${e.title} ${e.audience}`.includes(q)) : entries
  const groups = new Map<string, HistoryEntry[]>()
  shown.forEach((e) => groups.set(group(e.at), [...(groups.get(group(e.at)) ?? []), e]))

  return (
    <div className="rail">
      <button className="logo-button" onClick={onHome} aria-label="الصفحة الرئيسية">
        <Logo />
      </button>

      <button className={composing ? 'primary block-button new-btn on' : 'primary block-button new-btn'} onClick={onNew}>
        + توليد جديد
        {busyId === 'new' && <span className="spinner" />}
      </button>

      {entries.length > 3 && (
        <input className="rail-search" type="search" placeholder="ابحث في السجل" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}

      <nav className="rail-list" aria-label="سجل التوليدات">
        {entries.length === 0 && (
          <p className="rail-empty">
            لا توليدات بعد.
            <br />
            ستظهر مشاريعك هنا، محفوظة في هذا المتصفح.
          </p>
        )}
        {q && shown.length === 0 && <p className="rail-empty">لا نتائج.</p>}
        {[...groups].map(([label, items]) => (
          <div key={label}>
            <span className="rail-group">{label}</span>
            {items.map((e) => (
              <div key={e.id} className={e.id === activeId ? 'rail-item on' : 'rail-item'}>
                <button className="rail-open" onClick={() => onOpen(e.id)}>
                  <span className="rail-title" dir="auto">
                    {e.title}
                  </span>
                  <small>
                    {busyId === e.id ? (
                      <>
                        <span className="spinner brand mini" /> جارٍ التوليد
                      </>
                    ) : (
                      <>
                        <i className={e.approved ? 'state ok' : e.scripts ? 'state warn' : 'state'} />
                        {LANGUAGES[e.language]} · {e.scripts ? `${e.scripts} سيناريو` : '3 أفكار'}
                        {e.shared && ' · رابط مراجعة'}
                      </>
                    )}
                  </small>
                </button>
                <button className="rail-hide" title="إخفاء من السجل" aria-label="إخفاء من السجل" onClick={() => onHide(e.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-foot">
        <button className="link" onClick={onHome}>
          عن بلاغ
        </button>
        <a href={`${BASE}/docs`} target="_blank" rel="noreferrer">
          API
        </a>
      </div>
    </div>
  )
}
