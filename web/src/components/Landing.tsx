import type React from 'react'
import { BASE } from '../api'
import { PublicPicks } from './PublicPicks'
import { CountUp, Reveal } from './reveal'

const STEPS = [
  { title: 'ثلاث أفكار', text: 'من موضوع تكتبه، أو يقترح بلاغ المواضيع حسب جمهورك ومنصاتك.' },
  { title: 'توثيق قبل الكتابة', text: 'كل آية أو حديث تعتمد عليه الفكرة يُبحث عنه في القرآن الكريم والصحيحين. ما لم يوجد لا يُستعمل.' },
  { title: 'سيناريو بمشاهد موقّتة', text: 'التعليق والنص على الشاشة والصورة لكل مشهد، والنص الشرعي يُدرجه النظام حرفيا من المصدر.' },
  { title: 'توطين لجمهور آخر', text: 'لغة ولهجة وثقافة ومستوى معرفة مختلف: يتغير أسلوب الشرح والأمثلة، ولا يتغير ما يُدّعى.' },
  { title: 'ثلاثة مراجعين آليين', text: 'علمي، وجمهور، ومعنى يقارن النسخة الموطّنة بالأصل ادعاءً ادعاءً.' },
  { title: 'اعتماد بشري', text: 'التصدير مقفل حتى يوقّع من تتطلبه النسخة باسمه وصفته، على قدر خطر المحتوى.' },
]

const GUARANTEES = [
  { title: 'لا نص شرعي من ذاكرة النموذج', text: 'النموذج يضع علامة مثل {{Q1}} والنظام يُدرج النص من المصدر.' },
  { title: 'القرآن يُقتبس حرفيا فقط', text: 'السيناريو الذي يعتمد على آية دون اقتباسها يُرفض ويعاد توليده.' },
  { title: 'لفظ الحديث مطابق', text: 'يُتحقق أن اللفظ مقطع متصل من نص الحديث، وإلا رُفض السيناريو.' },
  { title: 'ترجمة من المصدر', text: 'في الإنجليزية يُدرج النظام ترجمة منشورة جاهزة، لا ترجمة النموذج.' },
  { title: 'لا فتوى شخصية', text: 'كل طلب يُصنَّف على أربعة مستويات، والفتوى الشخصية تُحال إلى مختص.' },
  { title: 'مصطلحات مضبوطة', text: 'قاموس ملزم من الحزمة العلمية، وفحص آلي في كل نسخة موطّنة.' },
]

const RESULTS = [
  { value: '10/10', label: 'اقتباسات بلاغ المطابقة حرفيا للمصدر' },
  { value: '6/6', label: 'أسئلة فتوى شخصية أُحيلت إلى مختص' },
  { value: '28/28', label: 'خطأ مزروعا كشفه المراجعون' },
  { value: '0/8', label: 'سيناريو سليم عُلّم خطأً' },
]

/** The brand mark links to the home page wherever it appears; `plain` renders it without the link, for a
 * parent that already makes it a button. */
export function Logo({ plain = false }: { plain?: boolean } = {}) {
  if (plain) return <LogoMark />
  return (
    <a className="logo" href="#" aria-label="الصفحة الرئيسية">
      <LogoMark inner />
    </a>
  )
}

const BA_BODY = 'M31.19 38.03Q25.53 38.03 21.66 37.4Q17.79 36.78 15.4 35.35Q13.01 33.92 11.95 31.64Q10.88 29.35 10.88 25.97Q10.88 23.89 11.43 21.4Q11.97 18.91 12.96 16.47L17.95 17.92Q17.06 19.69 16.57 21.32Q16.08 22.96 16.08 24.26Q16.08 25.77 16.7 26.78Q17.32 27.79 18.73 28.42Q20.13 29.04 22.41 29.32Q24.7 29.61 28.08 29.61H35.35Q38.78 29.61 41.12 29.45Q43.46 29.3 44.89 28.91Q46.31 28.52 46.96 27.92Q47.61 27.32 47.61 26.44Q47.61 25.66 47.48 24.44Q47.35 23.22 46.99 21.25L46.11 16.41L51.77 15.48L52.55 20.31Q52.81 21.71 52.96 23.43Q53.12 25.14 53.12 26.44Q53.12 29.92 52.16 32.16Q51.2 34.39 48.73 35.69Q46.26 36.99 42.03 37.51Q37.79 38.03 31.19 38.03Z'
const BA_DOT = 'M31.14 48.52Q29.79 48.52 28.93 47.69Q28.08 46.86 28.08 45.04Q28.08 43.22 28.93 42.39Q29.79 41.56 31.14 41.56H32.18Q33.53 41.56 34.39 42.39Q35.25 43.22 35.25 45.04Q35.25 46.86 34.39 47.69Q33.53 48.52 32.18 48.52Z'

function LogoMark({ inner = false }: { inner?: boolean }) {
  return (
    <span className={inner ? 'logo-inner' : 'logo'}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="currentColor" />
        {/* The letter ب from IBM Plex Sans Arabic Bold, its dot in the brand's gold: the app icon's mark. */}
        <path fill="#fff" d={BA_BODY} />
        <path fill="#d4a94d" d={BA_DOT} />
      </svg>
      بلاغ
    </span>
  )
}

function HeroMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-head">
        <span className="badge">العربية · الفصحى المبسطة</span>
        <span className="badge level-A">أ · معلومات مستقرة</span>
        <span className="badge">30 ث</span>
      </div>
      <h3>بعد كل ضيق فرج</h3>
      <ol className="mock-scenes">
        <li>
          <span className="time">0-6 ث</span>
          <p>هل مررت بيوم ظننت أنه لن ينتهي؟</p>
        </li>
        <li>
          <span className="time">6-18 ث</span>
          <div>
            <p className="scripture">«إِنَّ مَعَ الْعُسْرِ يُسْرًا»</p>
            <span className="badge ok">✓ موثّق · الشرح: 6 · اقتباس حرفي</span>
          </div>
        </li>
      </ol>
      <div className="mock-review">
        <span className="badge ok">المراجع العلمي ✓</span>
        <span className="badge ok">مراجع الجمهور ✓</span>
        <span className="badge warn">بانتظار اعتماد صانع المحتوى</span>
      </div>
    </div>
  )
}

export function Landing({ onStart, resume }: { onStart: () => void; resume: boolean }) {
  const cta = resume ? 'افتح لوحة العمل' : 'ابدأ مشروعا'
  return (
    <div className="landing">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="links">
            <a href="#how">كيف يعمل</a>
            <a href="#trust">الضمانات</a>
            <a href="#results">النتائج</a>
            <a href="#/examples">أمثلة</a>
            <a href={`${BASE}/docs`} target="_blank" rel="noreferrer">
              API
            </a>
          </nav>
          <button className="primary" onClick={onStart}>
            {cta}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy enter">
            <span className="eyebrow">محتوى يعرّف بالإسلام عبر اللغات والثقافات</span>
            <h1>
              سيناريوهات قصيرة مقنعة،
              <br />
              <em>كل نص فيها موثّق من مصدره.</em>
            </h1>
            <p className="lead">
              بلاغ يقترح الأفكار ويكتب السيناريو ويوطّنه لجمهور آخر، ويتحقق من كل آية وحديث في القرآن الكريم والصحيحين قبل
              أن يصل إلى المراجعة البشرية.
            </p>
            <div className="hero-actions">
              <button className="primary big" onClick={onStart}>
                {cta} ←
              </button>
              <a className="button ghost big" href="#/examples">
                أمثلة حقيقية
              </a>
            </div>
            <a className="muted small" href="#how" style={{ display: 'inline-block', marginTop: 10 }}>
              كيف يعمل ↓
            </a>
            <ul className="hero-points">
              <li>القرآن الكريم وصحيحا البخاري ومسلم</li>
              <li>العربية بلهجاتها والإنجليزية</li>
              <li>لا فتاوى شخصية</li>
            </ul>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="band">
        <Reveal className="section-inner problem">
          <h2>المشكلة</h2>
          <p>
            صانع المحتوى الذي يستعين بنموذج لغوي يحصل على سيناريو مقنع في ثوان، لكنه لا يعرف هل الآية بلفظها، وهل الحديث في
            مصدره، وهل بقي المعنى كما هو حين نُقل النص إلى جمهور آخر. التحقق اليدوي يأخذ وقتا أطول من الكتابة نفسها.
          </p>
        </Reveal>
      </section>

      <section id="how" className="section">
        <div className="section-inner">
          <Reveal>
            <span className="eyebrow">كيف يعمل</span>
            <h2>من الفكرة إلى نسخة معتمدة في ست خطوات</h2>
          </Reveal>
          <Reveal as="ol" className="steps-grid" stagger>
            {STEPS.map((s, i) => (
              <li key={s.title} style={{ '--i': i } as React.CSSProperties}>
                <span className="num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section id="trust" className="section alt">
        <div className="section-inner">
          <Reveal>
            <span className="eyebrow">الضمانات</span>
            <h2>ضوابط في الكود، لا في تعليمات النموذج وحدها</h2>
          </Reveal>
          <Reveal className="trust-grid" stagger>
            {GUARANTEES.map((g, i) => (
              <div className="trust" key={g.title} style={{ '--i': i } as React.CSSProperties}>
                <span className="check">✓</span>
                <div>
                  <h3>{g.title}</h3>
                  <p className="muted">{g.text}</p>
                </div>
              </div>
            ))}
          </Reveal>
          <Reveal className="split" stagger>
            <div>
              <h3>ما يقوم به الذكاء الاصطناعي</h3>
              <p className="muted">اقتراح الزوايا، والصياغة بلغة الجمهور، والتكييف الثقافي، والمراجعة الأولية.</p>
            </div>
            <div>
              <h3>ما لا يُترك له</h3>
              <p className="muted">نص الآية والحديث، ونسبته، وترجمته، وقرار النشر.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="results" className="section">
        <div className="section-inner">
          <Reveal>
            <span className="eyebrow">النتائج</span>
            <h2>تقييم على 16 موضوعا و6 أسئلة فتوى و28 خطأ مزروعا</h2>
          </Reveal>
          <Reveal className="stats" stagger>
            {RESULTS.map((r, i) => (
              <div className="stat" key={r.label} style={{ '--i': i } as React.CSSProperties}>
                <CountUp value={r.value} />
                <span>{r.label}</span>
              </div>
            ))}
          </Reveal>
          <p className="muted small">
            العينة صغيرة والتشغيل واحد، ولم يراجع مختص شرعي المخرجات بعد. ما يضيفه بلاغ هو الضمان والتتبع.{' '}
            <a href="#/examples">شاهد مثالين حقيقيين من الطلب إلى الفيديو ←</a>
          </p>
        </div>
      </section>

      <PublicPicks />

      <section className="cta-band">
        <Reveal className="section-inner">
          <h2>جاهز لأول سيناريو موثّق؟</h2>
          <p>اختر جمهورك ومنصتك، واترك الباقي لبلاغ. كل خانة فيها خيار تلقائي.</p>
          <button className="primary big light" onClick={onStart}>
            {cta} ←
          </button>
        </Reveal>
      </section>

      <footer className="footer">
        <div className="section-inner">
          <Logo />
          <p className="muted small">
            أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
            يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
          </p>
          <p className="small">
            <a href="#/privacy">سياسة الخصوصية</a> · <a href="#/delete-account">حذف الحساب</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
