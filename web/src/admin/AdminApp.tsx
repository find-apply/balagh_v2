import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Logo } from '../components/Landing'
import { go } from '../route'
import { Icon } from '../components/Icon'
import { AppShell } from '../components/shell/AppShell'
import { Rail, RailBrand, RailFoot, RailNav } from '../components/shell/Rail'
import { adminApi, adminToken } from './adminApi'
import { SECTIONS } from './sections'
import { PageHeader, Notice } from './ui'

export function AdminApp({ path }: { path: string[] }) {
  const [authed, setAuthed] = useState(Boolean(adminToken.get()))

  // A rejected token anywhere sends the admin back to the login screen.
  useEffect(() => {
    const onReject = () => {
      adminToken.set('')
      setAuthed(false)
    }
    addEventListener('admin-unauthorized', onReject)
    return () => removeEventListener('admin-unauthorized', onReject)
  }, [])

  if (!authed) return <Login onDone={() => setAuthed(true)} />

  const section = SECTIONS.find((s) => s.key === path[0]) ?? SECTIONS[0]
  return (
    <AppShell
      menuLabel="القائمة"
      rail={
        <Rail>
          <RailBrand badge="الإدارة" />
          <RailNav
            label="أقسام الإدارة"
            activeKey={section.key}
            items={SECTIONS.map((s) => ({ key: s.key, label: s.label, icon: s.icon, href: `#/admin/${s.key}` }))}
          />
          <RailFoot
            items={[
              { icon: 'sparkles', label: 'الاستوديو', href: '#/new' },
              {
                icon: 'logout',
                label: 'تسجيل الخروج',
                onClick: () => {
                  adminToken.set('')
                  setAuthed(false)
                },
              },
            ]}
          />
        </Rail>
      }
    >
      <main className="adm-main">
        <PageHeader icon={section.icon} title={section.label} sub={section.sub} />
        <section.View path={path} />
      </main>
    </AppShell>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminApi.check(token.trim())
      adminToken.set(token.trim())
      onDone()
      go('#/admin', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-login">
      <form className="card" onSubmit={submit}>
        <Logo />
        <h1><Icon name="lock" size={20} /> دخول الإدارة</h1>
        <label className="field">
          <span>رمز الإدارة</span>
          <input type="password" autoFocus autoComplete="current-password" dir="ltr" value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        {error && <Notice tone="bad" icon="alert">{error}</Notice>}
        <button className="primary" disabled={!token.trim() || busy}>{busy ? 'جارٍ التحقق…' : 'دخول'}</button>
      </form>
    </div>
  )
}
