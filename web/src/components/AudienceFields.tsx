import { useState } from 'react'
import { KNOWLEDGE, LANGUAGES, PLATFORMS } from '../labels'
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

const options = (labels: string[]): Option[] => labels.map((l) => ({ label: l, value: l }))

interface Props {
  value: AudienceSpec
  onChange: (value: AudienceSpec) => void
}

export function AudienceFields({ value, onChange }: Props) {
  // The audience sent to the API is "<group>، <region>"; the two parts are picked separately.
  const [group, setGroup] = useState<string | null>(value.audience || null)
  const [region, setRegion] = useState<string | null>(null)
  const set = (patch: Partial<AudienceSpec>) => onChange({ ...value, ...patch })
  const compose = (g: string | null, r: string | null) => [g, r].filter(Boolean).join('، ')

  return (
    <>
      <ChoiceField
        label="الجمهور"
        options={options(GROUPS.map((g) => g.label))}
        value={group}
        customPlaceholder="صف جمهورك: العمر، الاهتمامات، علاقته بالإسلام"
        onChange={(g) => {
          setGroup(g)
          const preset = GROUPS.find((x) => x.label === g)
          set({ audience: compose(g, region), ...(preset ? { audience_knowledge: preset.knowledge } : {}) })
        }}
      />
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
      <div className="field">
        <span>اللغة</span>
        <div className="chips">
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <button
              type="button"
              key={k}
              className={value.language === k ? 'chip on' : 'chip'}
              onClick={() => set({ language: k as Language, dialect: null })}
            >
              {v}
            </button>
          ))}
        </div>
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
    </>
  )
}

const SHORT_FORM: Platform[] = ['tiktok', 'instagram_reels', 'youtube_shorts', 'facebook_reels']

interface PlatformProps {
  value: Platform[]
  onChange: (value: Platform[]) => void
}

export function PlatformPicker({ value, onChange }: PlatformProps) {
  const toggle = (p: Platform) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])
  const allShort = SHORT_FORM.every((p) => value.includes(p)) && value.length === SHORT_FORM.length
  return (
    <div className="chips">
      <button type="button" className={allShort ? 'chip on auto' : 'chip auto'} onClick={() => onChange(SHORT_FORM)}>
        ✦ كل منصات الفيديو القصير
      </button>
      {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
        <button type="button" key={p} className={value.includes(p) ? 'chip on' : 'chip'} onClick={() => toggle(p)}>
          {PLATFORMS[p]}
        </button>
      ))}
    </div>
  )
}
