import { useEffect, useRef, useState } from 'react'
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

/** Every template: a list of what fits the script (and what fits it in another frame), a box of what its audience
 * cannot use with the reason said once, and a stage that plays the one in view large, with its facts and the
 * button that picks it. A locked template can be watched on the stage too, so the way to it is clear. */
export function TemplatePicker({ templates, chosen, aspect, audience, disabled, onPick, onWantKids }: Props) {
  const kids = isChildren(audience)
  const options = templates ? templateOptions(templates, aspect, audience) : []
  const fit = options.filter((o) => o.group === 'fit')
  const other = options.filter((o) => o.group === 'other')
  const blocked = options.filter((o) => o.group === 'blocked')
  const [shownId, setShownId] = useState<string | null>(null)
  const shown =
    options.find((o) => o.template.id === shownId) ??
    options.find((o) => chosen !== null && o.group !== 'blocked' && o.family.includes(chosen)) ??
    options[0]
  const isChosen = (o: TemplateOption) => chosen !== null && o.group !== 'blocked' && o.family.includes(chosen)
  const reasons = [...new Set(blocked.map((o) => o.reason))]
  const wantKids = !kids && onWantKids && blocked.some((o) => o.needsKids) ? onWantKids : undefined
  const phone = usePhone()
  if (phone && shown)
    return (
      <section className="card tpl-phone">
        <Swipe options={options} start={options.indexOf(shown)} isChosen={isChosen} disabled={disabled} onPick={onPick} onWantKids={wantKids} />
      </section>
    )
  return (
    <section className="card">
      <p className="muted small">
        {kids
          ? 'القالب الذي يُحوَّل به السيناريو إلى فيديو. قوالب الأطفال تكتب أول مرة قصة حوار بالشخصيات الثابتة، وهي نص جديد يلزم اعتماده.'
          : 'القالب الذي يُحوَّل به السيناريو إلى فيديو. شاهد كل قالب يتحرك، ثم اختر واحدا.'}
      </p>
      {!templates && <p className="muted">تعذر تحميل مكتبة القوالب. تأكد أن الخادم يعمل ثم أعد تحميل الصفحة.</p>}
      {shown && (
        <div className="tpl-layout">
          <div className="tpl-list">
            <Rows title={`يناسب مشروعك (${ASPECTS[aspect]})`} options={fit} shown={shown} isChosen={isChosen} onShow={setShownId} />
            <Rows title="بمقاس آخر" note="متاحة، لكن مقاسها غير مقاس منصتك." options={other} shown={shown} isChosen={isChosen} onShow={setShownId} />
            {blocked.length > 0 && (
              <div className="tpl-locked">
                <h4>
                  <Icon name="lock" size={16} /> غير متاح لهذا الجمهور ({blocked.length})
                </h4>
                <p>{reasons.length === 1 ? `${reasons[0]} اضغط أي واحد لتشاهده.` : 'اضغط أي واحد لتشاهده وتعرف السبب.'}</p>
                <div className="tpl-thumbs">
                  {blocked.map((o) => (
                    <button
                      key={o.template.id}
                      type="button"
                      className={o.template.aspect === '16:9' ? 'wide' : ''}
                      aria-pressed={o === shown}
                      aria-label={`شاهد ${o.template.name}`}
                      title={o.template.name}
                      onClick={() => setShownId(o.template.id)}
                    >
                      <Clip id={o.template.id} />
                    </button>
                  ))}
                </div>
                {wantKids && (
                  <button type="button" className="tpl-kids" onClick={wantKids}>
                    وطّن السيناريو للأطفال
                  </button>
                )}
              </div>
            )}
          </div>
          <Stage option={shown} chosen={isChosen(shown)} disabled={disabled} onPick={onPick} onWantKids={wantKids} />
        </div>
      )}
    </section>
  )
}

function Rows({ title, note, options, shown, isChosen, onShow }: {
  title: string
  note?: string
  options: TemplateOption[]
  shown: TemplateOption
  isChosen: (o: TemplateOption) => boolean
  onShow: (id: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="tpl-rows">
      <h4>{title}</h4>
      {note && <p className="muted small">{note}</p>}
      {options.map((o) => {
        const t = o.template
        return (
          <button key={t.id} type="button" className="tpl-row" aria-pressed={o === shown} onClick={() => onShow(t.id)}>
            <img className={t.aspect === '16:9' ? 'wide' : ''} src={`/templates/${t.id}.jpg`} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <span className="tpl-row-text">
              <strong>{t.name}</strong>
              <span>{t.description}</span>
              <small>{facts(t)}</small>
            </span>
            {isChosen(o) && <span className="badge ok">المختار</span>}
          </button>
        )
      })}
    </div>
  )
}

function Stage({ option, chosen, disabled, onPick, onWantKids }: {
  option: TemplateOption
  chosen: boolean
  disabled: boolean
  onPick: (t: VideoTemplate) => void
  onWantKids?: () => void
}) {
  const t = option.template
  const blocked = option.group === 'blocked'
  return (
    <section className="tpl-stage" aria-label={`معاينة ${t.name}`} aria-live="polite">
      <figure>
        <div className={`tpl-frame ${t.aspect === '16:9' ? 'wide' : 'tall'}`}>
          <Clip id={t.id} />
          {blocked && (
            <span className="tpl-chip">
              <Icon name="lock" size={12} /> غير متاح
            </span>
          )}
        </div>
        <figcaption>معاينة بلا صوت، أسرع من الفيديو الحقيقي</figcaption>
      </figure>
      <div className="tpl-info">
        <h3>{t.name}</h3>
        <p>{t.description}</p>
        <dl>
          <div>
            <dt>المقاس</dt>
            <dd>{t.aspect === '16:9' ? 'عريض 16:9' : 'عمودي 9:16'}</dd>
          </div>
          <div>
            <dt>المحتوى</dt>
            <dd>{t.uses_images ? 'رسوم وصور' : 'رسوم فقط'}</dd>
          </div>
          {t.typical_seconds != null && (
            <div>
              <dt>مدة التصيير</dt>
              <dd>{`${Math.ceil(t.typical_seconds / 60)} د تقريبا`}</dd>
            </div>
          )}
          <div>
            <dt>الجمهور</dt>
            <dd>{t.story ? 'الأطفال' : 'غير الأطفال'}</dd>
          </div>
        </dl>
        {option.group === 'other' && <p className="tpl-reason">{option.reason}</p>}
        {blocked ? (
          <div className="tpl-why">
            <p>
              <Icon name="lock" size={14} /> {option.reason}
              {onWantKids && option.needsKids && ' لاستعماله، وطّن السيناريو لجمهور الأطفال أولا، فتُكتب منه قصة جديدة.'}
            </p>
            {onWantKids && option.needsKids && (
              <button type="button" className="tpl-kids" onClick={onWantKids}>
                وطّن السيناريو للأطفال
              </button>
            )}
          </div>
        ) : chosen ? (
          <p className="tpl-chosen">
            <Icon name="check" size={18} /> هذا قالب مشروعك
          </p>
        ) : (
          <button className="primary" disabled={disabled} onClick={() => onPick(t)}>
            اختر هذا القالب
          </button>
        )}
      </div>
    </section>
  )
}

const PHONE = '(max-width: 720px)'

function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches)
  useEffect(() => {
    const m = window.matchMedia?.(PHONE)
    if (!m) return
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}

/** The picker on a phone: the templates side by side at full size, swiped through one at a time, with their names
 * above to jump to one, and under the one in the middle its facts and the one action it allows. */
function Swipe({ options, start, isChosen, disabled, onPick, onWantKids }: {
  options: TemplateOption[]
  start: number
  isChosen: (o: TemplateOption) => boolean
  disabled: boolean
  onPick: (t: VideoTemplate) => void
  onWantKids?: () => void
}) {
  const [idx, setIdx] = useState(Math.max(0, start))
  const strip = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  // One card and the gap after it; scrollLeft runs negative in a right-to-left strip, so its size is what counts.
  const step = () => {
    const first = strip.current?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + 12 : 1
  }
  const go = (i: number, smooth = true) => {
    setIdx(i)
    strip.current?.scrollTo({ left: -i * step(), behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    go(Math.max(0, start), false)
    // only where the picker opens; later the swipe leads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const chip = chips.current?.children[idx] as HTMLElement | undefined
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [idx])
  const o = options[idx]
  const t = o.template
  const blocked = o.group === 'blocked'
  return (
    <>
      <div className="tpl-chips" ref={chips}>
        {options.map((x, i) => (
          <button key={x.template.id} type="button" className={x.group === 'blocked' ? 'off' : ''} aria-pressed={i === idx} onClick={() => go(i)}>
            {x.group === 'blocked' && <Icon name="lock" size={12} />}
            {isChosen(x) && <Icon name="check" size={13} />}
            {x.template.name}
          </button>
        ))}
      </div>
      <div
        className="tpl-strip"
        ref={strip}
        onScroll={(e) => {
          const i = Math.min(options.length - 1, Math.max(0, Math.round(Math.abs(e.currentTarget.scrollLeft) / step())))
          if (i !== idx) setIdx(i)
        }}
      >
        {options.map((x, i) => (
          <div
            key={x.template.id}
            className={['tpl-slide', x.template.aspect === '16:9' ? 'wide' : 'tall', i === idx && 'on', x.group === 'blocked' && 'off'].filter(Boolean).join(' ')}
            onClick={() => i !== idx && go(i)}
          >
            <Clip id={x.template.id} />
            {x.group === 'blocked' && (
              <span className="tpl-chip">
                <Icon name="lock" size={12} /> غير متاح
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="tpl-dots" aria-hidden="true">
        {options.map((x, i) => (
          <span key={x.template.id} className={i === idx ? 'on' : ''} />
        ))}
      </div>
      <div className="tpl-now" aria-live="polite">
        <h3>{t.name}</h3>
        <p className="tpl-facts">
          {t.aspect === '16:9' ? 'عريض 16:9' : 'عمودي 9:16'} · {facts(t)}
        </p>
        <p>{t.description}</p>
        {o.group === 'other' && <p className="tpl-reason">{o.reason}</p>}
      </div>
      <div className="tpl-act">
        {blocked ? (
          <>
            <p className="tpl-why-line">
              <Icon name="lock" size={14} /> {o.reason}
            </p>
            {onWantKids && o.needsKids && (
              <button type="button" className="tpl-kids" onClick={onWantKids}>
                وطّن السيناريو للأطفال
              </button>
            )}
          </>
        ) : isChosen(o) ? (
          <p className="tpl-chosen">
            <Icon name="check" size={18} /> قالب مشروعك
          </p>
        ) : (
          <button className="primary" disabled={disabled} onClick={() => onPick(t)}>
            اختر «{t.name}»
          </button>
        )}
      </div>
    </>
  )
}

function facts(t: VideoTemplate) {
  const art = t.uses_images ? 'رسوم وصور' : 'رسوم فقط'
  return t.typical_seconds != null ? `${art} · التصيير ${Math.ceil(t.typical_seconds / 60)} د تقريبا` : art
}

const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A few seconds of the template, sped up and looping without sound, over its still picture; the still alone for
 * someone who asked for less motion, or while the clip loads. */
function Clip({ id }: { id: string }) {
  if (still) return <img src={`/templates/${id}.jpg`} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
  return <video key={id} src={`/templates/${id}.mp4`} poster={`/templates/${id}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
}
