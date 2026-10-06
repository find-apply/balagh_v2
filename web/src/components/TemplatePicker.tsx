import type { Aspect } from '../labels'
import { ASPECTS } from '../labels'
import type { VideoTemplate } from '../types'

interface Props {
  templates: VideoTemplate[] | null
  chosen: string | null
  /** The frame the script's platform implies; matching templates come first, the rest stay available. */
  aspect: Aspect
  disabled: boolean
  onPick: (template: VideoTemplate) => void
}

export function TemplatePicker({ templates, chosen, aspect, disabled, onPick }: Props) {
  const fit = templates?.filter((t) => t.aspect === aspect) ?? []
  const rest = templates?.filter((t) => t.aspect !== aspect) ?? []
  return (
    <section className="card">
      <h3>قالب الفيديو</h3>
      <p className="muted small">
        القالب الذي يُحوَّل به هذا السيناريو إلى فيديو. قالب أطفال يكتب أول مرة قصة حوار من السيناريو، وهي نص جديد يلزم اعتماده.
      </p>
      {!templates && <p className="muted">تعذر تحميل مكتبة القوالب. تأكد أن الخادم يعمل ثم أعد تحميل الصفحة.</p>}
      {templates && (
        <>
        {rest.length > 0 && <h4 className="tpl-group">{`يناسب منصتك (${ASPECTS[aspect]})`}</h4>}
        <div className="templates">
          {fit.map((t) => (
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
        {rest.length > 0 && (
          <details className="tpl-rest">
            <summary>{`قوالب بصيغة أخرى (${rest.length}): ${ASPECTS[rest[0].aspect as Aspect]}`}</summary>
            <div className="templates">
              {rest.map((t) => (
                <article className={t.id === chosen ? 'card idea chosen' : 'card idea'} key={t.id}>
                  <img className="preview" src={`/templates/${t.id}.jpg`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <div className="badges">
                    <span className="badge" dir="ltr">{t.aspect}</span>
                    {t.story && <span className="badge info">للأطفال</span>}
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
          </details>
        )}
        </>
      )}
    </section>
  )
}
