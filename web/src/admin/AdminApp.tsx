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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token } = await adminApi.login(username.trim(), password)
      adminToken.set(token)
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
          <span>اسم المستخدم</span>
          <input type="text" autoFocus autoComplete="username" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>كلمة المرور</span>
          <input type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <Notice tone="bad" icon="alert">{error}</Notice>}
        <button className="primary" disabled={!username.trim() || !password || busy}>{busy ? 'جارٍ التحقق…' : 'دخول'}</button>
      </form>
    </div>
  )
}
