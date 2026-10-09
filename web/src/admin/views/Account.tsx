import { useState } from 'react'
import type { FormEvent } from 'react'
import { adminApi, adminToken } from '../adminApi'
import { Card, Notice, Status } from '../ui'
import { useLoad } from '../useLoad'

/** The admin's username and password. Saving ends every other open session. */
export function Account() {
  const { data, error, loading } = useLoad(adminApi.account)
  const [username, setUsername] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [fail, setFail] = useState<string | null>(null)
  if (!data) return <Status error={error} loading={loading} />
  const name = username ?? data.username ?? ''
  const mismatch = again.length > 0 && again !== password
  const ready = name.trim().length >= 3 && password.length >= 10 && again === password

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFail(null)
    setDone(false)
    try {
      const r = await adminApi.saveAccount(name.trim(), password)
      adminToken.set(r.token)
      setPassword('')
      setAgain('')
      setDone(true)
    } catch (err) {
      setFail(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="بيانات الدخول">
      <form className="adm-form" onSubmit={submit}>
        <label className="field">
          <span>اسم المستخدم</span>
          <input type="text" dir="ltr" autoComplete="username" value={name} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>كلمة المرور الجديدة (10 أحرف على الأقل)</span>
          <input type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>أعد كتابتها</span>
          <input type="password" dir="ltr" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {mismatch && <Notice tone="warn" icon="alert">كلمتا المرور غير متطابقتين.</Notice>}
        {fail && <Notice tone="bad" icon="alert">{fail}</Notice>}
        {done && <Notice tone="ok" icon="check">حُفظت. أُغلقت كل الجلسات الأخرى، وبقيت هذه مفتوحة.</Notice>}
        <button className="primary" disabled={!ready || busy}>{busy ? 'يحفظ…' : 'احفظ'}</button>
      </form>
    </Card>
  )
}
