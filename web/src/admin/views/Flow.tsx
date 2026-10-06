import { useState } from 'react'
import { adminApi } from '../adminApi'
import type { FlowSettings } from '../adminApi'
import { STAGES } from '../format'
import { Card, IconButton, Notice, Status, Tag } from '../ui'
import { useLoad } from '../useLoad'

export function Flow() {
  const flow = useLoad(adminApi.flow)
  const settings = useLoad(adminApi.settings)
  const [form, setForm] = useState<FlowSettings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [fail, setFail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  // The form starts from the loaded settings once; later edits stay local until saved.
  const loaded = settings.data
  if (loaded && form === null) setForm(loaded)

  if (!flow.data || !form) return <Status error={flow.error ?? settings.error} loading />
  const set = <K extends keyof FlowSettings>(k: K, v: FlowSettings[K]) => {
    setForm({ ...form, [k]: v })
    setSaved(null)
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(settings.data)

  async function save() {
    if (!form) return
    setSaving(true)
    setFail(null)
    try {
      await adminApi.saveSettings(form)
      setSaved('تم الحفظ، وتسري الإعدادات على الطلبات القادمة.')
      settings.reload()
      flow.reload()
    } catch (e) {
      setFail(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className={`card adm-pause ${form.paused ? 'on' : ''}`}>
        <div>
          <h3>{form.paused ? 'التوليد متوقف' : 'التوليد يعمل'}</h3>
          <p className="adm-note">الإيقاف يمنع الأفكار والسيناريوهات والتوطين والمراجعة والتصحيح، ويُبقي العرض والاعتماد متاحين.</p>
        </div>
        <IconButton icon={form.paused ? 'play' : 'pause'} className={form.paused ? 'primary' : 'adm-danger'} onClick={() => set('paused', !form.paused)}>
          {form.paused ? 'استئناف التوليد' : 'إيقاف التوليد'}
        </IconButton>
        {form.paused && (
          <label className="field">
            <span>رسالة للمستخدمين</span>
            <input value={form.paused_message} maxLength={300} placeholder="التوليد متوقف مؤقتا للصيانة، حاول لاحقا." onChange={(e) => set('paused_message', e.target.value)} />
          </label>
        )}
      </section>

      <Card title="النماذج والقواعد التحريرية" icon="cpu">
        <div className="adm-two">
          <label className="field">
            <span>نموذج الكتابة (أفكار، سيناريو، توطين، تصحيح)</span>
            <input dir="ltr" value={form.generation_model} onChange={(e) => set('generation_model', e.target.value)} />
          </label>
          <label className="field">
            <span>نموذج المراجعة الآلية</span>
            <input dir="ltr" value={form.review_model} onChange={(e) => set('review_model', e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>قواعد تحريرية إضافية تُلحق بكل طلب ({form.extra_rules.length}/3000)</span>
          <textarea rows={5} maxLength={3000} value={form.extra_rules} placeholder="مثال: تجنّب ذكر الأرقام الدقيقة للأجور. استخدم «صلى الله عليه وسلم» عند ذكر النبي." onChange={(e) => set('extra_rules', e.target.value)} />
        </label>
        <p className="adm-note">القواعد الإضافية تُلحق ولا تلغي القواعد الأساسية ولا التحقق من النصوص الشرعية.</p>
        {fail && <Notice tone="bad" icon="alert">{fail}</Notice>}
        {saved && <Notice tone="ok" icon="check">{saved}</Notice>}
        <div className="adm-actions">
          <IconButton icon="check" className="primary" onClick={save} disabled={!dirty || saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</IconButton>
          {dirty && <button onClick={() => setForm(settings.data)}>تراجع</button>}
        </div>
      </Card>

      <Card title="مراحل المسار" icon="workflow">
        <ol className="adm-stages">
          {flow.data.stages.map((s) => (
            <li key={s.key}>
              <div>
                <strong>{STAGES[s.key]}</strong>
                <p>{s.detail}</p>
              </div>
              <span>{s.model ? <code>{s.model}</code> : <Tag icon="users">بشري</Tag>}</span>
            </li>
          ))}
        </ol>
        <p className="adm-note">
          الاعتمادات المطلوبة:{' '}
          {Object.entries(flow.data.approval_roles).map(([r, why]) => `${r === 'creator' ? 'صاحب المحتوى' : r === 'scholar' ? 'المراجع الشرعي' : 'المراجع اللغوي'} (${why})`).join(' · ')}
        </p>
        <p className="adm-note">
          المصادر: القرآن الكريم، {Object.values(flow.data.sources.collections).join('، ')} · {flow.data.sources.glossary_terms} مصطلحا معتمدا · حد أقصى {flow.data.sources.max_verses} آيات للاقتباس.
        </p>
      </Card>

      <Card title="التعليمات الأساسية (للقراءة فقط)" icon="book">
        <p className="adm-note">تُعدَّل هذه في الشيفرة وتخضع للمراجعة؛ استخدم القواعد الإضافية أعلاه لتغييرات سريعة.</p>
        {Object.entries(flow.data.prompts).map(([k, text]) => (
          <div key={k} className="adm-prompt">
            <button onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
              <code>{k}</code> <span>{open === k ? '▾' : '◂'}</span>
            </button>
            {open === k && <pre dir="ltr">{text}</pre>}
          </div>
        ))}
      </Card>
    </>
  )
}
