import { useState } from 'react'
import type { FormEvent } from 'react'
import { signOutNow, useAccount } from '../account'
import { api, ApiError } from '../api'
import { go } from '../route'
import { AccountDialog } from './AccountDialog'
import { CONTACT_EMAIL } from './AccountGate'

const UPDATED = '10 أكتوبر 2026'
const WORD = 'احذف'

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <header className="legal-head">
        <button type="button" className="link" onClick={() => go('')}>
          بلاغ
        </button>
      </header>
      <article className="legal-body">
        <h1>{title}</h1>
        {children}
        <p className="muted small">
          للتواصل: <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a>
        </p>
      </article>
    </div>
  )
}

/** The privacy policy the stores link to: what Balagh keeps, who processes it, and how to have it deleted. */
export function PrivacyPage() {
  return (
    <Page title="سياسة الخصوصية">
      <p className="muted small">آخر تحديث: {UPDATED}</p>
      <p>
        بلاغ أداة لصناعة محتوى دعوي موثَّق: تقترح الأفكار وتكتب السيناريو بنصوص من القرآن الكريم والصحيحين، ثم يراجعه الإنسان ويُصنع منه
        الفيديو. تشرح هذه الصفحة ما نحفظه عنك في الموقع (balagh.space) وفي تطبيق «بلاغ» على الهاتف، ولماذا، وكيف تحذفه.
      </p>

      <h2>ما نجمعه</h2>
      <ul>
        <li>
          <strong>حسابك:</strong> بريدك الإلكتروني، واسمك وصورتك إن دخلت بحساب Google، وطريقة الدخول. يتولى Google Firebase الدخول وكلمات
          المرور، ولا نرى كلمة مرورك.
        </li>
        <li>
          <strong>معلومات التسجيل:</strong> الاسم الكامل والتخصص ورقم الهاتف. تراجعها الإدارة لتقبل الحساب وتحدد صفتك (مختص شرعي أو صانع
          محتوى).
        </li>
        <li>
          <strong>ما تصنعه:</strong> مواضيعك وإعداداتك، والأفكار والسيناريوهات والفيديوهات المولَّدة، ومراجعاتها وتوقيعات الاعتماد باسمك.
        </li>
        <li>
          <strong>مصدر الإلهام:</strong> الملف الذي ترفعه (PDF أو صورة أو نص) يُقرأ مرة واحدة لطلبك ثم يُحذف؛ يبقى ملخص ما قُرئ منه مع المشروع.
          ورابط يوتيوب يُحفظ مع المشروع.
        </li>
        <li>
          <strong>التقييمات والبلاغات:</strong> نجومك واسمك وصفتك وملاحظتك على الفيديو، وما تبلّغ عنه من مشكلات في المحتوى.
        </li>
        <li>
          <strong>معرّف الجهاز:</strong> رقم عشوائي يحفظه المتصفح أو التطبيق ليعرف سجل مشاريعه قبل الدخول. لا نجمع موقعك ولا جهات اتصالك، ولا
          نستعمل أدوات إعلانات أو تتبّع.
        </li>
      </ul>

      <h2>لماذا نستعملها</h2>
      <ul>
        <li>لتعمل الخدمة: توليد المحتوى، وحفظ مشاريعك على كل أجهزتك، وصنع الفيديو.</li>
        <li>للمراجعة البشرية: قبول الحسابات، وتوقيع النسخ بأسماء أصحابها، ومعالجة البلاغات.</li>
        <li>لتحسين الجودة: مقارنة القوالب بتقييماتها. لا نبيع بياناتك، ولا نستعملها للإعلان.</li>
      </ul>

      <h2>من يعالجها نيابة عنا</h2>
      <ul>
        <li>
          <strong>Google Firebase:</strong> تسجيل الدخول.
        </li>
        <li>
          <strong>OpenAI وGoogle Gemini:</strong> نرسل إليهما الموضوع والجمهور ونص السيناريو ومحتوى مصدر الإلهام لتوليد الأفكار والسيناريو
          والمراجعة الآلية والصوت. لا نرسل بريدك ولا هاتفك.
        </li>
        <li>
          <strong>Magnific:</strong> وصف الصور المطلوبة لبعض القوالب، دون أي معلومة عنك.
        </li>
        <li>
          <strong>الاستضافة:</strong> تُحفظ البيانات على خادمنا (Google Cloud)، وتنتقل عبر اتصال مشفّر (HTTPS).
        </li>
      </ul>

      <h2>ما يظهر للآخرين</h2>
      <p>
        مشاريعك خاصة بك ومن تشاركه رابطها. حين تنشر الإدارة عملا في الصفحة الرئيسية يظهر محتواه، وقد تُعرض تقييمات مختارة باسم صاحبها
        وصفته.
      </p>

      <h2>مدة الحفظ والحذف</h2>
      <p>
        نحفظ بياناتك ما دام حسابك قائما. تستطيع حذف حسابك في أي وقت من التطبيق (الإعدادات ← احذف حسابي) أو من{' '}
        <a href="#/delete-account">صفحة حذف الحساب</a>. يُحذف عندها حسابك ودخولك، واسمك وهاتفك وتخصصك وصفتك، وسجل مشاريعك، وتصبح تقييماتك
        باسم «مشاهد». الأعمال التي راجعها مختص ونشرتها الإدارة تبقى منشورة دون اسمك، بتوقيع «صانع محتوى». إن أردت حذفها أيضا راسلنا.
      </p>

      <h2>الأطفال</h2>
      <p>بلاغ موجّه لصنّاع المحتوى والمختصين البالغين، وليس للأطفال دون 13 سنة.</p>

      <h2>التغييرات</h2>
      <p>إن غيّرنا هذه السياسة نحدّث تاريخها أعلاه، ونخبرك داخل الخدمة إن كان التغيير جوهريا.</p>
    </Page>
  )
}

/** Deleting an account from the web, as the stores require besides the in-app way. */
export function DeleteAccountPage() {
  const user = useAccount()
  const [signing, setSigning] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const remove = async (e: FormEvent) => {
    e.preventDefault()
    if (typed.trim() !== WORD) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteMe()
      await signOutNow().catch(() => undefined)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="حذف حسابك في بلاغ">
      <p>من هنا تحذف حسابك في بلاغ نهائيا، سواء أنشأته في الموقع أو في التطبيق. ويمكنك أيضا حذفه من التطبيق: الإعدادات ← احذف حسابي.</p>
      <h2>ما يُحذف</h2>
      <ul>
        <li>حسابك ودخولك (Google أو البريد).</li>
        <li>اسمك ورقم هاتفك وتخصصك وصفتك.</li>
        <li>سجل مشاريعك. وتصبح تقييماتك باسم «مشاهد».</li>
      </ul>
      <h2>ما يبقى</h2>
      <p>الأعمال التي راجعها مختص ونشرتها الإدارة تبقى منشورة دون اسمك، بتوقيع «صانع محتوى». إن أردت حذفها أيضا راسلنا.</p>

      {done ? (
        <p className="notice ok">حُذف حسابك. شكرا لاستعمالك بلاغ.</p>
      ) : user === undefined ? (
        <p className="muted">
          <span className="spinner brand" /> يتحقق من الدخول…
        </p>
      ) : user ? (
        <form className="card legal-delete" onSubmit={(e) => void remove(e)}>
          <p>
            الحساب: <strong dir="ltr">{user.email}</strong>
          </p>
          <label className="field">
            <span>للتأكيد، اكتب «{WORD}»</span>
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="notice bad small">{error}</p>}
          <button type="submit" className="danger block-button" disabled={busy || typed.trim() !== WORD}>
            {busy && <span className="spinner" />} احذف حسابي نهائيا
          </button>
        </form>
      ) : (
        <div className="card legal-delete">
          <p>سجّل الدخول بالحساب الذي تريد حذفه، ثم أكّد الحذف.</p>
          <button type="button" className="primary block-button" onClick={() => setSigning(true)}>
            تسجيل الدخول
          </button>
          <p className="muted small">
            لا تستطيع الدخول؟ راسلنا من بريد الحساب على <a href={`mailto:${CONTACT_EMAIL}?subject=حذف حسابي في بلاغ`} dir="ltr">{CONTACT_EMAIL}</a>{' '}
            ونحذفه خلال 30 يوما.
          </p>
        </div>
      )}
      {signing && <AccountDialog onClose={() => setSigning(false)} />}
    </Page>
  )
}
