import { useState } from 'react'
import type { FormEvent } from 'react'
import { signOutNow } from '../account'
import { api, ApiError } from '../api'
import type { Me, Profile } from '../api'
import { Icon } from './Icon'

export const CONTACT_EMAIL = 'admin@balagh.space'

const complete = (me: Me) => Boolean(me.full_name && me.specialization && me.phone)

/** Whether a signed-in account may use the site: the admin approves each new account first. */
export const gated = (me: Me) => me.status !== 'approved'

/** What a signed-in account sees until the admin lets it in, as in the app: its sign-up details if it has not
 * given them yet, then the wait, or the refusal. Signing out returns to the site as a visitor. */
export function AccountGate({ me, onChange }: { me: Me; onChange: (me: Me) => void }) {
  if (me.status === 'rejected') return <Rejected me={me} />
  if (!complete(me)) return <ProfileForm me={me} onChange={onChange} />
  return <Pending me={me} onChange={onChange} />
}

function ProfileForm({ me, onChange }: { me: Me; onChange: (me: Me) => void }) {
  const [fullName, setFullName] = useState(me.full_name ?? me.name ?? '')
  const [specialization, setSpecialization] = useState(me.specialization ?? '')
  const [phone, setPhone] = useState(me.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const profile: Profile = { full_name: fullName.trim(), specialization: specialization.trim(), phone: phone.trim() }
    setBusy(true)
    setError(null)
    try {
      onChange(await api.me(profile))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card account-gate">
      <h2>أكمل معلوماتك</h2>
      <p className="muted small">
        خطوة أخيرة قبل إرسال طلبك. دخلت {me.provider === 'google.com' ? 'بحساب Google' : 'بالبريد'}: <span dir="ltr">{me.email}</span>
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span>الاسم الكامل</span>
          <input type="text" autoComplete="name" required minLength={2} maxLength={200} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          <span>التخصص</span>
          <input type="text" required minLength={2} maxLength={200} placeholder="مثال: علوم شرعية، إعلام، تصميم" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        </label>
        <label className="field">
          <span>رقم الهاتف</span>
          <input type="tel" dir="ltr" autoComplete="tel" required pattern="^\+?[0-9 ()\-]{6,40}$" placeholder="+213 5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <p className="notice small">تراجع الإدارة طلبك، ويُفعَّل حسابك بعد الموافقة.</p>
        {error && <p className="notice bad small">{error}</p>}
        <button type="submit" className="primary block-button" disabled={busy}>
          {busy && <span className="spinner" />} إرسال الطلب
        </button>
      </form>
      <SignOut />
    </section>
  )
}

function Pending({ me, onChange }: { me: Me; onChange: (me: Me) => void }) {
  const [busy, setBusy] = useState(false)
  const [still, setStill] = useState(false)
  const check = async () => {
    setBusy(true)
    setStill(false)
    try {
      const next = await api.me()
      onChange(next)
      setStill(next.status === 'pending')
    } catch {
      setStill(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card account-gate">
      <span className="badge warn">قيد المراجعة</span>
      <h2>حسابك قيد المراجعة</h2>
      <p className="muted">تتحقق الإدارة من معلوماتك، وتحدد صفتك (مختص شرعي أو صانع محتوى)، ثم تفعّل حسابك.</p>
      <dl className="account-details">
        <div><dt>الاسم</dt><dd>{me.full_name}</dd></div>
        <div><dt>التخصص</dt><dd>{me.specialization}</dd></div>
        <div><dt>الهاتف</dt><dd dir="ltr">{me.phone}</dd></div>
        <div><dt>البريد</dt><dd dir="ltr">{me.email}</dd></div>
      </dl>
      {still && <p className="notice small">ما زال الطلب قيد المراجعة.</p>}
      <button type="button" className="primary block-button" disabled={busy} onClick={() => void check()}>
        {busy && <span className="spinner" />} تحقق من حالة الطلب
      </button>
      <SignOut />
    </section>
  )
}

function Rejected({ me }: { me: Me }) {
  return (
    <section className="card account-gate">
      <h2>لم يُقبل طلبك</h2>
      <p className="muted">راجعت الإدارة طلبك ولم تقبل هذا الحساب. إن رأيت أن في ذلك خطأ، تواصل معنا وسنعيد النظر فيه.</p>
      <p className="small">
        الحساب: <span dir="ltr">{me.email}</span>
      </p>
      <a className="primary block-button button-link" href={`mailto:${CONTACT_EMAIL}`}>
        <Icon name="mail" size={16} /> تواصل معنا
      </a>
      <SignOut />
    </section>
  )
}

function SignOut() {
  return (
    <p className="small account-switch">
      <button type="button" className="link" onClick={() => void signOutNow()}>
        الخروج والمتابعة دون حساب
      </button>
    </p>
  )
}
