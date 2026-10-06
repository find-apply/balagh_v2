import type { VideoTemplate } from '../types'

interface Props {
  templates: VideoTemplate[] | null
  chosen: string | null
  disabled: boolean
  onPick: (template: VideoTemplate) => void
}

export function TemplatePicker({ templates, chosen, disabled, onPick }: Props) {
  return (
    <section className="card">
      <h3>قالب الفيديو</h3>
      <p className="muted">
        اختر من المكتبة القالب الذي يُحوَّل به هذا السيناريو إلى فيديو. اختيار قالب أطفال لأول مرة يكتب قصة حوار من
        السيناريو، وهي نص جديد يلزم اعتماده.
      </p>
      {!templates && <p className="muted">تعذر تحميل مكتبة القوالب. تأكد أن الخادم يعمل ثم أعد تحميل الصفحة.</p>}
      {templates && (
        <div className="ideas">
          {templates.map((t) => (
            <article className={t.id === chosen ? 'card idea chosen' : 'card idea'} key={t.id}>
              <img
                className={`preview ${t.aspect === '9:16' ? 'tall' : ''}`}
                src={`/templates/${t.id}.jpg`}
                alt=""
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <div className="badges">
                <span className="badge" dir="ltr">
                  {t.aspect}
                </span>
                <span className="badge">{t.uses_images ? 'رسوم وصور' : 'رسوم فقط'}</span>
                {t.story && <span className="badge info">للأطفال</span>}
                {t.typical_seconds != null && (
                  <span className="badge">{`التصيير ${Math.ceil(t.typical_seconds / 60)} د تقريبا`}</span>
                )}
                {!t.ready && <span className="badge warn">قريبا</span>}
                {t.id === chosen && <span className="badge ok">القالب المختار</span>}
              </div>
              <h4>{t.name}</h4>
              <p>{t.description}</p>
              {t.id !== chosen && (
                <button className="primary" disabled={disabled || !t.ready} onClick={() => onPick(t)}>
                  اختر هذا القالب
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
