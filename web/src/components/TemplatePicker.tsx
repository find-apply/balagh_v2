import type { Aspect } from '../labels'
import { ASPECTS } from '../labels'
import type { VideoTemplate } from '../types'

interface Props {
  templates: VideoTemplate[] | null
  chosen: string | null
  /** The frame the script's platform implies; matching templates come first, the rest stay available. */
  aspect: Aspect
  /** The script's audience as the brief words it: children's templates fit only an audience of children. */
  audience: string
  disabled: boolean
  onPick: (template: VideoTemplate) => void
}

/** The same test the server applies: the story templates are for an audience of children. */
export const isChildren = (audience: string) => /أطفال|طفل|أولاد|صغار|براعم|\bkids?\b|\bchildren\b|\bchild\b|\b(?:[3-9]|1[0-2])\s*(?:إلى|الى|-|–|to)\s*(?:[4-9]|1[0-2])\s*(?:سنوات|سنة|years?)/i.test(audience)

export function TemplatePicker({ templates, chosen, aspect, audience, disabled, onPick }: Props) {
  const kids = isChildren(audience)
  // Templates for this audience, in the platform's frame first; the children's story templates are offered
  // only to an audience of children, and the others only to everyone else.
  const forThem = templates?.filter((t) => t.story === kids) ?? []
  const fit = forThem.filter((t) => t.aspect === aspect)
  const rest = forThem.filter((t) => t.aspect !== aspect)
  const others = templates?.filter((t) => t.story !== kids) ?? []
  return (
    <section className="card">
      <p className="muted small">
        {kids
          ? 'القالب الذي يُحوَّل به السيناريو إلى فيديو. قوالب الأطفال تكتب أول مرة قصة حوار بالشخصيات الثابتة، وهي نص جديد يلزم اعتماده.'
          : 'القالب الذي يُحوَّل به السيناريو إلى فيديو. قوالب الأطفال (القصة المصورة، السبورة، إعلان الأهل) لا تناسب هذا الجمهور، فهي لا تُعرض هنا.'}
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
        {others.length > 0 && (
          <p className="muted small tpl-others">
            {kids
              ? `قوالب الكبار (${others.map((t) => t.name).join('، ')}) لا تُعرض لجمهور من الأطفال.`
              : `قوالب الأطفال (${others.map((t) => t.name).join('، ')}) تظهر حين يكون الجمهور أطفالا؛ وطّن السيناريو لهم أولا إن أردتها.`}
          </p>
        )}
        </>
      )}
    </section>
  )
}
