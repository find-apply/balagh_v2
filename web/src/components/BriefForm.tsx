import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AudienceSpec, Brief, Platform } from '../types'
import { GROUPS } from '../audiences'
import { AudienceFields, More, PlatformPicker } from './AudienceFields'
import { ChoiceField } from './ChoiceField'

const TOPICS = [
  'لماذا يبتلي الله الناس؟',
  'الصدق وأثره في حياة المسلم',
  'بر الوالدين في زمن الانشغال',
  'ما معنى التوحيد؟',
  'لماذا يصلي المسلمون خمس مرات؟',
  'حسن الخلق مع الجار',
]

const DURATIONS = [
  { label: '15 ث', value: '15' },
  { label: '30 ث', value: '30' },
  { label: '45 ث', value: '45' },
  { label: '60 ث', value: '60' },
  { label: '90 ث', value: '90' },
  { label: '3 دقائق', value: '180' },
]

interface Props {
  disabled: boolean
  onSubmit: (brief: Brief) => void
}

export function BriefForm({ disabled, onSubmit }: Props) {
  const [idea, setIdea] = useState('')
  const [audience, setAudience] = useState<AudienceSpec>({
    audience: GROUPS[0].label,
    language: 'ar',
    dialect: null,
    audience_knowledge: GROUPS[0].knowledge,
    tone: null,
  })
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube_shorts'])
  const [duration, setDuration] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (platforms.length === 0) return
    onSubmit({
      ...audience,
      idea: idea.trim() || null,
      platforms,
      duration_seconds: duration ? Number(duration) : null,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>ابدأ بفكرة، أو اترك بلاغ يقترح</h2>
      <p className="muted">كل خانة فيها خيار تلقائي: اختر ما يهمك واترك الباقي لبلاغ.</p>

      <div className="field">
        <span>الفكرة أو الموضوع</span>
        <div className="chips">
          <button type="button" className={idea.trim() ? 'chip auto' : 'chip on auto'} onClick={() => setIdea('')}>
            ✦ اقترح عليّ مواضيع
          </button>
          {TOPICS.map((t) => (
            <button type="button" key={t} className={idea === t ? 'chip on' : 'chip'} onClick={() => setIdea(t)}>
              {t}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="أو اكتب فكرتك هنا. اتركها فارغة ليقترح بلاغ مواضيع تناسب جمهورك."
        />
      </div>

      <AudienceFields value={audience} onChange={setAudience} compact />

      <div className="field">
        <span>المنصات</span>
        <PlatformPicker value={platforms} onChange={setPlatforms} />
        {platforms.length === 0 && <small className="error-text">اختر منصة واحدة على الأقل.</small>}
      </div>

      <More compact label="مدة الفيديو (تلقائية)">
        <ChoiceField
          label="مدة الفيديو"
          auto="تلقائي"
          options={DURATIONS}
          value={duration}
          onChange={setDuration}
          type="number"
          min={5}
          max={600}
          customPlaceholder="بالثواني، من 5 إلى 600"
          hint="في الوضع التلقائي يقترح بلاغ مدة لكل فكرة حسب المنصات."
        />
      </More>

      <button className="primary big" disabled={disabled || platforms.length === 0}>
        {idea.trim() ? 'اقترح 3 أفكار' : 'اقترح عليّ 3 أفكار'}
      </button>
    </form>
  )
}
