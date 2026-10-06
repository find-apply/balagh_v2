// The pieces of the left rail, shared by the studio and the admin so both read as one product.
import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { Logo } from '../Landing'

export function Rail({ children }: { children: ReactNode }) {
  return <div className="rail">{children}</div>
}

export function RailBrand({ onClick, badge }: { onClick?: () => void; badge?: string }) {
  const logo = onClick ? (
    <button className="logo-button" onClick={onClick} aria-label="الصفحة الرئيسية">
      <Logo />
    </button>
  ) : (
    <Logo />
  )
  return (
    <div className="rail-brand">
      {logo}
      {badge && <span className="rail-badge">{badge}</span>}
    </div>
  )
}

export interface RailItem {
  key: string
  label: string
  icon: IconName
  href: string
}

/** Icon links for a fixed set of destinations, with the current one highlighted. */
export function RailNav({ items, activeKey, label }: { items: RailItem[]; activeKey: string; label: string }) {
  return (
    <nav className="rail-menu" aria-label={label}>
      {items.map((i) => (
        <a key={i.key} href={i.href} className={i.key === activeKey ? 'rail-link on' : 'rail-link'} aria-current={i.key === activeKey ? 'page' : undefined}>
          <Icon name={i.icon} size={18} />
          {i.label}
        </a>
      ))}
    </nav>
  )
}

type FootItem = { icon: IconName; label: string } & ({ href: string; external?: boolean } | { onClick: () => void })

export function RailFoot({ items }: { items: FootItem[] }) {
  return (
    <div className="rail-foot">
      {items.map((i) =>
        'href' in i ? (
          <a key={i.label} href={i.href} {...(i.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
            <Icon name={i.icon} size={15} /> {i.label}
          </a>
        ) : (
          <button key={i.label} className="link" onClick={i.onClick}>
            <Icon name={i.icon} size={15} /> {i.label}
          </button>
        ),
      )}
    </div>
  )
}
