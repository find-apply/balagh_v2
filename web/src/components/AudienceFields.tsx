import { useState } from 'react'
import type { ReactNode } from 'react'
import { ASPECTS, aspectOf, KNOWLEDGE, LANGUAGES, PLATFORMS } from '../labels'
import type { AudienceKnowledge, AudienceSpec, Language, Platform } from '../types'
import { ChoiceField } from './ChoiceField'
import type { Option } from './ChoiceField'
import { GROUPS } from '../audiences'

const REGIONS = ['الجزائر', 'المغرب العربي', 'مصر', 'الخليج العربي', 'بلاد الشام', 'بريطانيا', 'أمريكا الشمالية', 'أوروبا']

const DIALECTS: Record<Language, string[]> = {
  ar: ['الفصحى المبسطة', 'الدارجة الجزائرية', 'الدارجة المغربية', 'العامية المصرية', 'اللهجة الخليجية', 'اللهجة الشامية'],
  en: ['Plain simple English', 'British English', 'American English', 'Casual, Gen Z'],
}

const TONES = ['هادئ وتأملي', 'حماسي ومحفّز', 'قصصي', 'تعليمي مباشر', 'حواري: سؤال وجواب', 'خفيف وقريب']

const SEP = '، '

const options = (labels: string[]): Option[] => labels.map((l) => ({ label: l, value: l }))

/** The API takes one audience string, "<group>، <region>"; this splits a saved one back into its two pickers. */
function splitAudience(audience: string): [string | null, string | null] {
  const group = GROUPS.find((g) => audience === g.label || audience.startsWith(g.label + SEP))
  if (!group) return [audience || null, null]
  return [group.label, audience.slice(group.label.length + SEP.length) || null]
}

interface Props {
  value: AudienceSpec
  onChange: (value: AudienceSpec) => void
  /** Shown after the essential fields, before the advanced panel. */
  children?: ReactNode
  /** Extra fields placed inside the advanced panel, after the audience ones. */
  advanced?: ReactNode
  /** How many of the extra advanced fields differ from their automatic default. */
  advancedChanged?: number
}

export function AudienceFields({ value, onChange, children, advanced, advancedChanged = 0 }: Props) {
  const [initialGroup, initialRegion] = splitAudience(value.audience)
  const [group, setGroup] = useState<string | null>(initialGroup)
  const [region, setRegion] = useState<string | null>(initialRegion)
  const set = (patch: Partial<AudienceSpec>) => onChange({ ...value, ...patch })
  const compose = (g: string | null, r: string | null) => [g, r].filter(Boolean).join(SEP)

  // The knowledge level follows the group preset; it only counts as changed when the user overrode it.
  const preset = GROUPS.find((g) => g.label === group)
  const changed =
    Number(region !== null) +
    Number(Boolean(preset && preset.knowledge !== value.audience_knowledge)) +
    Number(value.dialect !== null) +
    Number(value.tone !== null) +
    advancedChanged
  const [open, setOpen] = useState(changed > 0)

  const summary = [
    region ?? 'كل الثقافات',
    KNOWLEDGE[value.audience_knowledge],
    value.dialect ?? 'لهجة تلقائية',
    value.tone ?? 'أسلوب تلقائي',
  ].join(' · ')

  return (
    <>
      <ChoiceField
        label="الجمهور"
        options={options(GROUPS.map((g) => g.label))}
        value={group}
        customPlaceholder="صف جمهورك: العمر، الاهتمامات، علاقته بالإسلام"
        onChange={(g) => {
          setGroup(g)
          const p = GROUPS.find((x) => x.label === g)
          set({ audience: compose(g, region), ...(p ? { audience_knowledge: p.knowledge } : {}) })
        }}
      />
      <div className="field">
        <span>اللغة</span>
        <div className="segmented" role="radiogroup">
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <button
              type="button"
              role="radio"
              aria-checked={value.language === k}
              key={k}
              className={value.language === k ? 'on' : ''}
              onClick={() => set({ language: k as Language, dialect: null })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {children}

      <div className={open ? 'advanced open' : 'advanced'}>
        <button type="button" className="advanced-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="chev" aria-hidden="true">
            ‹
          </span>
          <span className="grow">
            <strong>خيارات متقدمة</strong>
            {!open && <small dir="auto">{summary}</small>}
          </span>
          {changed > 0 && <span className="badge info">{changed} معدّلة</span>}
        </button>
        {open && (
          <div className="advanced-body">
            <ChoiceField
              label="البلد أو الثقافة"
              auto="غير محدد"
              options={options(REGIONS)}
              value={region}
              customPlaceholder="مثال: إندونيسيا، مسلمو فرنسا"
              onChange={(r) => {
                setRegion(r)
                set({ audience: compose(group, r) })
              }}
            />
            <div className="field">
              <span>معرفة الجمهور بالإسلام</span>
              <div className="chips">
                {Object.entries(KNOWLEDGE).map(([k, v]) => (
                  <button
                    type="button"
                    key={k}
                    className={value.audience_knowledge === k ? 'chip on' : 'chip'}
                    onClick={() => set({ audience_knowledge: k as AudienceKnowledge })}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <small className="muted">تُضبط تلقائيا حسب الجمهور، ويمكنك تغييرها.</small>
            </div>
            <ChoiceField
              key={value.language}
              label="اللهجة"
              auto="تلقائي"
              options={options(DIALECTS[value.language])}
              value={value.dialect}
              customPlaceholder="اكتب اللهجة أو مستوى اللغة"
              onChange={(dialect) => set({ dialect })}
            />
            <ChoiceField
              label="الأسلوب"
              auto="تلقائي"
              options={options(TONES)}
              value={value.tone}
              customPlaceholder="مثال: ساخر بلطف، أكاديمي"
              onChange={(tone) => set({ tone })}
            />
            {advanced}
          </div>
        )}
      </div>
    </>
  )
}

const SHORT_FORM: Platform[] = ['tiktok', 'instagram_reels', 'youtube_shorts', 'facebook_reels']
const OTHER: Platform[] = (Object.keys(PLATFORMS) as Platform[]).filter((p) => !SHORT_FORM.includes(p))

interface PlatformProps {
  value: Platform[]
  onChange: (value: Platform[]) => void
}

/** One platform (or the generic short-video choice, which is all of them at once). The platform fixes the
 * frame, the duration defaults and the post, so one choice answers three questions. The API still takes a list. */
export function PlatformPicker({ value, onChange }: PlatformProps) {
  const [more, setMore] = useState(value.some((p) => OTHER.includes(p)))
  const generic = SHORT_FORM.every((p) => value.includes(p)) && value.length === SHORT_FORM.length
  const single = value.length === 1 ? value[0] : null
  const chip = (p: Platform) => (
    <button type="button" key={p} role="radio" aria-checked={single === p} className={single === p ? 'chip on' : 'chip'} onClick={() => onChange([p])}>
      {PLATFORMS[p]}
    </button>
  )
  return (
    <>
      <div className="chips" role="radiogroup">
        <button type="button" role="radio" aria-checked={generic} className={generic ? 'chip on auto' : 'chip auto'} onClick={() => onChange(SHORT_FORM)}>
          ✦ عام: كل منصات الفيديو القصير
        </button>
        {SHORT_FORM.map(chip)}
        {more ? (
          OTHER.map(chip)
        ) : (
          <button type="button" className="chip ghost" onClick={() => setMore(true)}>
            + منصات أخرى
          </button>
        )}
      </div>
      <small className="muted">
        الصيغة: <b>{ASPECTS[aspectOf(value)]}</b>
        {generic ? ' · منشور واحد يصلح لكل المنصات القصيرة' : single ? ` · منشور ووسوم لـ${PLATFORMS[single]}` : ''}
      </small>
    </>
  )
}
