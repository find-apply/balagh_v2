import { CHARACTERS, STORY_SCENES } from '../labels'
import type { Script } from '../types'

/** The dialogue story a children's template plays. Generated text: it is approved with the script. */
export function StoryView({ script }: { script: Script }) {
  const story = script.story
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
      <ol className="scenes" dir={dir}>
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
                <p className="muted small" dir="ltr">
                  <span className="tag">صورة</span> {s.image_prompt}
                </p>
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
    </section>
  )
}
