// Presentational building blocks shared by every admin view. Views compose these and hold no markup of their own.
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'

export type Tone = 'ok' | 'warn' | 'bad'

export function Tag({ tone, icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`adm-tag ${tone ?? ''}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

export function LevelBadge({ level }: { level: string }) {
  return <span className={`badge level-${level}`}>{level}</span>
}

export function Card({ title, icon, flush, children }: { title?: string; icon?: IconName; flush?: boolean; children: ReactNode }) {
  return (
    <section className={`card ${flush ? 'adm-flush' : ''}`}>
      {title && (
        <h3 className={flush ? 'adm-pad' : ''}>
          {icon && <Icon name={icon} size={17} />} {title}
        </h3>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, icon, hint, tone }: { label: string; value: string; icon: IconName; hint?: string; tone?: Tone }) {
  return (
    <div className={`adm-stat ${tone ?? ''}`}>
      <span className="adm-stat-icon">
        <Icon name={icon} size={18} />
      </span>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Meter({ label, value, of }: { label: ReactNode; value: string; of: number }) {
  return (
    <div className="adm-meter">
      {label}
      <div>
        <i style={{ width: `${Math.min(100, of * 100)}%` }} />
      </div>
      <b>{value}</b>
    </div>
  )
}

export function Notice({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      {icon && <Icon name={icon} size={16} />} {children}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="adm-toolbar">{children}</div>
}

export function IconButton({ icon, children, ...rest }: { icon: IconName; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest}>
      <Icon name={icon} size={16} />
      {children}
    </button>
  )
}

export function Status({ error, loading }: { error: string | null; loading: boolean }) {
  if (error)
    return (
      <Notice tone="bad" icon="alert">
        <strong>تعذر التحميل</strong>
        <p>{error}</p>
      </Notice>
    )
  return loading ? <p className="adm-note">جارٍ التحميل…</p> : null
}

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
}

/** A table of rows described by columns; give it `onOpen` and rows become keyboard-reachable links. */
export function DataTable<T>({ columns, rows, rowKey, onOpen, empty }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onOpen?: (row: T) => void
  empty: string
}) {
  return (
    <table className={`adm-table ${onOpen ? 'adm-click' : ''}`}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.header}>{c.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={rowKey(r)}
            tabIndex={onOpen ? 0 : undefined}
            onClick={onOpen && (() => onOpen(r))}
            onKeyDown={onOpen && ((e) => e.key === 'Enter' && onOpen(r))}
          >
            {columns.map((c) => (
              <td key={c.header}>{c.cell(r)}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="adm-empty">
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

/** Shows a Cell's primary line with a quieter second line beneath it. */
export function Cell({ title, sub, dir }: { title: ReactNode; sub?: ReactNode; dir?: 'auto' | 'ltr' }) {
  return (
    <>
      <strong dir={dir ?? 'auto'}>{title}</strong>
      {sub && <small>{sub}</small>}
    </>
  )
}

export function PageHeader({ icon, title, sub, actions }: { icon: IconName; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="adm-head">
      <span className="adm-head-icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="adm-head-actions">{actions}</div>}
    </header>
  )
}
