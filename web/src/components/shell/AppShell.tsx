import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import { Logo } from '../Landing'

interface Props {
  rail: ReactNode
  /** Shown at the far side of the mobile top bar. */
  action?: ReactNode
  menuLabel: string
  children: ReactNode
}

/** The page frame for every signed-in screen: a rail on wide screens, a drawer behind a top bar on narrow ones. */
export function AppShell({ rail, action, menuLabel, children }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const close = () => setOpen(false)
    addEventListener('popstate', close)
    return () => removeEventListener('popstate', close)
  }, [])

  return (
    <div className={open ? 'shell drawer-open' : 'shell'}>
      <aside className="shell-rail">{rail}</aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="shell-main">
        <header className="mobile-bar">
          <button className="menu" aria-label={menuLabel} onClick={() => setOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <Logo />
          {action ?? <span />}
        </header>
        {children}
      </div>
    </div>
  )
}
