import { useState } from 'react'
import { CHARACTERS, STORY_SCENES } from '../labels'
import type { Script } from '../types'

interface Props {
  script: Script
  disabled: boolean
  onRewrite: (notes: string | null) => void
}

/** The dialogue story a children's template plays. Generated text: it is approved with the script. */
export function StoryView({ script, disabled, onRewrite }: Props) {
  const story = script.story
  const [notes, setNotes] = useState('')
  if (!story) return null
  const dir = script.target.language === 'en' ? 'ltr' : 'rtl'
  return (
    <section className="card">
      <h3>قصة الأطفال</h3>
      <p className="muted">
        حوار مولَّد من السيناريو لقالب الأطفال، بشخصيات ثابتة. النص الشرعي فيه مُدرج من المصدر لا من النموذج. يُعتمد مع
        السيناريو.
      </p>
      <h4 dir="auto">{story.title}</h4>
      <ol className="scenes story" dir={dir}>
        {story.scenes.map((s, i) => (
          <li key={i}>
            <div className="time">{STORY_SCENES[s.kind]}</div>
            <div className="scene-body">
              {s.kind === 'text' ? (
                <>
                  <p className="scripture">«{s.quote}»</p>
                  <p className="muted small">{s.source}</p>
                </>
              ) : (
                s.lines.map((l, j) => (
                  <p className="voice" key={j}>
                    <span className="tag">{CHARACTERS[l.who] ?? l.who}</span> {l.text}
                  </p>
                ))
              )}
              {s.kind === 'words' && (
                <ul className="plain">
                  {s.cards.map((c) => (
                    <li key={c.word}>
                      <strong>{c.word}</strong>: {c.meaning}
                    </li>
                  ))}
                </ul>
              )}
              {s.kind === 'quiz' && (
                <p className="onscreen">
                  <span className="tag">السؤال</span> {s.question} — {s.choices.join(' / ')}
                </p>
              )}
              {s.image_prompt && (
                <details className="muted small">
                  <summary>وصف الصورة</summary>
                  <p dir="ltr">{s.image_prompt}</p>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>
      {story.review_note && (
        <p className="muted small" dir="auto">
          ملاحظة للمربّي: {story.review_note}
        </p>
      )}
      <div className="panel">
        <label className="field">
          <span>قصة أخرى؟ ملاحظات (اختياري)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلا: موقف في المدرسة بدل البيت" />
        </label>
        <button disabled={disabled} onClick={() => onRewrite(notes.trim() || null)}>
          اكتب قصة أخرى
        </button>
      </div>
    </section>
  )
}
