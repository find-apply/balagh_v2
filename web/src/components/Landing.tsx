import { BASE } from '../api'

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

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="currentColor" />
        <text x="32" y="45" fontSize="34" fontWeight="700" textAnchor="middle" fill="#fff">
          ب
        </text>
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
  const cta = resume ? 'تابع مشروعك' : 'ابدأ مشروعا'
  return (
    <div className="landing">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="links">
            <a href="#how">كيف يعمل</a>
            <a href="#trust">الضمانات</a>
            <a href="#results">النتائج</a>
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
          <div className="hero-copy">
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
              <a className="button ghost big" href="#how">
                كيف يعمل
              </a>
            </div>
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
        <div className="section-inner problem">
          <h2>المشكلة</h2>
          <p>
            صانع المحتوى الذي يستعين بنموذج لغوي يحصل على سيناريو مقنع في ثوان، لكنه لا يعرف هل الآية بلفظها، وهل الحديث في
            مصدره، وهل بقي المعنى كما هو حين نُقل النص إلى جمهور آخر. التحقق اليدوي يأخذ وقتا أطول من الكتابة نفسها.
          </p>
        </div>
      </section>

      <section id="how" className="section">
        <div className="section-inner">
          <span className="eyebrow">كيف يعمل</span>
          <h2>من الفكرة إلى نسخة معتمدة في ست خطوات</h2>
          <ol className="steps-grid">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trust" className="section alt">
        <div className="section-inner">
          <span className="eyebrow">الضمانات</span>
          <h2>ضوابط في الكود، لا في تعليمات النموذج وحدها</h2>
          <div className="trust-grid">
            {GUARANTEES.map((g) => (
              <div className="trust" key={g.title}>
                <span className="check">✓</span>
                <div>
                  <h3>{g.title}</h3>
                  <p className="muted">{g.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="split">
            <div>
              <h3>ما يقوم به الذكاء الاصطناعي</h3>
              <p className="muted">اقتراح الزوايا، والصياغة بلغة الجمهور، والتكييف الثقافي، والمراجعة الأولية.</p>
            </div>
            <div>
              <h3>ما لا يُترك له</h3>
              <p className="muted">نص الآية والحديث، ونسبته، وترجمته، وقرار النشر.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="results" className="section">
        <div className="section-inner">
          <span className="eyebrow">النتائج</span>
          <h2>تقييم على 16 موضوعا و6 أسئلة فتوى و28 خطأ مزروعا</h2>
          <div className="stats">
            {RESULTS.map((r) => (
              <div className="stat" key={r.label}>
                <strong>{r.value}</strong>
                <span>{r.label}</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            العينة صغيرة والتشغيل واحد، ولم يراجع مختص شرعي المخرجات بعد. ما يضيفه بلاغ هو الضمان والتتبع.
          </p>
        </div>
      </section>

      <section className="cta-band">
        <div className="section-inner">
          <h2>جاهز لأول سيناريو موثّق؟</h2>
          <p>اختر جمهورك ومنصتك، واترك الباقي لبلاغ. كل خانة فيها خيار تلقائي.</p>
          <button className="primary big light" onClick={onStart}>
            {cta} ←
          </button>
        </div>
      </section>

      <footer className="footer">
        <div className="section-inner">
          <Logo />
          <p className="muted small">
            أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة
            يراجعها الإنسان قبل النشر. لا تصدر الأداة فتاوى.
          </p>
        </div>
      </footer>
    </div>
  )
}
