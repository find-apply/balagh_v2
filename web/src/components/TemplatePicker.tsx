import type { Aspect, TemplateOption } from '../labels'
import { ASPECTS, isChildren, templateOptions } from '../labels'
import type { VideoTemplate } from '../types'
import { Icon } from './Icon'

export { isChildren }

interface Props {
  templates: VideoTemplate[] | null
  chosen: string | null
  /** The frame the script's platform implies: a template with a frame for it shows in that frame. */
  aspect: Aspect
  /** The script's audience as the brief words it: children's templates fit only an audience of children. */
  audience: string
  disabled: boolean
  onPick: (template: VideoTemplate) => void
  /** Opens the localize form set for children, the way to a children's template from another audience. */
  onWantKids?: () => void
}

/** Every template, one card each: what fits the script, what fits it in another frame, and what its audience
 * cannot use (shown greyed, with the reason), so none disappears without a word. */
export function TemplatePicker({ templates, chosen, aspect, audience, disabled, onPick, onWantKids }: Props) {
  const kids = isChildren(audience)
  const options = templates ? templateOptions(templates, aspect, audience) : []
  const fit = options.filter((o) => o.group === 'fit')
  const other = options.filter((o) => o.group === 'other')
  const blocked = options.filter((o) => o.group === 'blocked')
  return (
    <section className="card">
      <p className="muted small">
        {kids
          ? 'القالب الذي يُحوَّل به السيناريو إلى فيديو. قوالب الأطفال تكتب أول مرة قصة حوار بالشخصيات الثابتة، وهي نص جديد يلزم اعتماده.'
          : 'القالب الذي يُحوَّل به السيناريو إلى فيديو.'}
      </p>
      {!templates && <p className="muted">تعذر تحميل مكتبة القوالب. تأكد أن الخادم يعمل ثم أعد تحميل الصفحة.</p>}
      {templates && (
        <>
          <Group title={`يناسب مشروعك (${ASPECTS[aspect]})`} options={fit} chosen={chosen} disabled={disabled} onPick={onPick} />
          <Group title="بمقاس آخر" note="متاحة، لكن مقاسها غير مقاس منصتك." options={other} chosen={chosen} disabled={disabled} onPick={onPick} />
          <Group
            title="غير متاح لهذا الجمهور"
            options={blocked}
            chosen={chosen}
            disabled
            onPick={onPick}
            action={!kids && onWantKids && blocked.some((o) => o.needsKids) ? { label: 'وطّن السيناريو للأطفال', onClick: onWantKids } : undefined}
          />
        </>
      )}
    </section>
  )
}

function Group({ title, note, options, chosen, disabled, onPick, action }: {
  title: string
  note?: string
  options: TemplateOption[]
  chosen: string | null
  disabled: boolean
  onPick: (t: VideoTemplate) => void
  action?: { label: string; onClick: () => void }
}) {
  if (options.length === 0) return null
  return (
    <div className="tpl-group-block">
      <h4 className="tpl-group">{title}</h4>
      {note && <p className="muted small">{note}</p>}
      <div className="templates">
        {options.map((o) => (
          <Card key={o.template.id} option={o} chosen={chosen} disabled={disabled} onPick={onPick} />
        ))}
      </div>
      {action && (
        <p className="tpl-action">
          <button type="button" onClick={action.onClick}>
            {action.label}
          </button>
        </p>
      )}
    </div>
  )
}

function Card({ option, chosen, disabled, onPick }: { option: TemplateOption; chosen: string | null; disabled: boolean; onPick: (t: VideoTemplate) => void }) {
  const t = option.template
  const isChosen = chosen !== null && option.family.includes(chosen)
  const blocked = option.group === 'blocked'
  return (
    <article className={['card idea', isChosen && 'chosen', blocked && 'tpl-off'].filter(Boolean).join(' ')} aria-disabled={blocked || undefined}>
      <img
        className={`preview ${t.aspect === '9:16' ? 'tall' : ''}`}
        src={`/templates/${t.id}.jpg`}
        alt=""
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div className="badges">
        <span className="badge" dir="ltr">{t.aspect}</span>
        <span className="badge">{t.uses_images ? 'رسوم وصور' : 'رسوم فقط'}</span>
        {t.story && <span className="badge info">للأطفال</span>}
        {t.typical_seconds != null && <span className="badge">{`التصيير ${Math.ceil(t.typical_seconds / 60)} د تقريبا`}</span>}
        {isChosen && <span className="badge ok">القالب المختار</span>}
      </div>
      <h4>{t.name}</h4>
      <p>{t.description}</p>
      {option.reason && (
        <p className={blocked ? 'tpl-reason off' : 'tpl-reason'}>
          {blocked && <Icon name="lock" size={14} />} {option.reason}
        </p>
      )}
      {!isChosen && (
        <button className="primary" disabled={disabled || blocked} onClick={() => onPick(t)}>
          {blocked ? 'غير متاح' : 'اختر هذا القالب'}
        </button>
      )}
    </article>
  )
}
