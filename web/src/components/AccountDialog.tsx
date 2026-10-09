import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../account'
import { Icon } from './Icon'

type Mode = 'in' | 'up' | 'reset'

/** Sign in or create an account: with Google, or with an email and password. An account keeps the history on
 * every device; using Balagh without one stays possible. */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      if (mode !== 'reset') onClose()
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'in') void run(() => signInWithEmail(email.trim(), password))
    else if (mode === 'up') void run(() => signUpWithEmail(name, email.trim(), password))
    else void run(async () => {
      await resetPassword(email.trim())
      setSent(true)
    })
  }

  return (
    <dialog ref={ref} className="account-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form onSubmit={submit} className="account-form">
        <button type="button" className="account-close" aria-label="إغلاق" onClick={onClose}>
          ×
        </button>
        <h2>{mode === 'up' ? 'أنشئ حسابا' : mode === 'reset' ? 'استرجاع كلمة المرور' : 'تسجيل الدخول'}</h2>
        <p className="muted small">بحساب، تجد مشاريعك وفيديوهاتك على كل أجهزتك: الموقع والتطبيق. وما صنعته على هذا المتصفح يُنقل إليه.</p>

        {mode !== 'reset' && (
          <>
            <button type="button" className="google-button" disabled={busy} onClick={() => void run(signInWithGoogle)}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              المتابعة بحساب Google
            </button>
            <div className="account-or">
              <span>أو بالبريد الإلكتروني</span>
            </div>
          </>
        )}

        {mode === 'up' && (
          <label className="field">
            <span>الاسم</span>
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>البريد الإلكتروني</span>
          <input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>كلمة المرور{mode === 'up' ? ' (6 أحرف على الأقل)' : ''}</span>
            <input type="password" dir="ltr" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}

        {error && <p className="notice bad small">{error}</p>}
        {sent && <p className="notice ok small">أرسلنا رابط إعادة التعيين إلى بريدك، إن كان له حساب.</p>}

        <button type="submit" className="primary block-button" disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="lock" size={16} />}
          {mode === 'up' ? 'أنشئ الحساب' : mode === 'reset' ? 'أرسل رابط إعادة التعيين' : 'دخول'}
        </button>

        <p className="small account-switch">
          {mode === 'in' && (
            <>
              <button type="button" className="link" onClick={() => setMode('up')}>ليس لديك حساب؟ أنشئ واحدا</button>
              {' · '}
              <button type="button" className="link" onClick={() => setMode('reset')}>نسيت كلمة المرور؟</button>
            </>
          )}
          {mode !== 'in' && (
            <button type="button" className="link" onClick={() => { setMode('in'); setSent(false) }}>عندي حساب: تسجيل الدخول</button>
          )}
        </p>
      </form>
    </dialog>
  )
}
