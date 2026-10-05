import { LEVELS } from '../labels'
import type { Evidence, Idea } from '../types'

export function EvidenceItem({ e }: { e: Evidence }) {
  return (
    <details className="evidence">
      <summary>
        <span className="badge ok">موثّق</span> {e.source}
      </summary>
      <p className="scripture" dir="rtl">
        {e.text}
      </p>
    </details>
  )
}

interface Props {
  ideas: Idea[]
  disabled: boolean
  onPick: (idea: Idea) => void
}

export function IdeaList({ ideas, disabled, onPick }: Props) {
  return (
    <>
      <div className="page-head">
        <h2>اختر فكرة</h2>
        <p className="muted">ثلاث زوايا للموضوع، لكل منها نصوصها الموثّقة. اختر واحدة ليكتب بلاغ سيناريوها.</p>
      </div>
      <div className="ideas">
        {ideas.map((idea, i) => (
          <article className="card idea" key={idea.id}>
            <div className="idea-top">
              <span className="idea-num">{i + 1}</span>
              <div className="badges">
                <span className={`badge level-${idea.content_level}`}>{LEVELS[idea.content_level]}</span>
                <span className="badge">{idea.duration_seconds} ث</span>
                {idea.needs_specialist_review && <span className="badge warn">تحتاج مراجعة مختص</span>}
              </div>
            </div>
            <h3 dir="auto">{idea.title}</h3>
            <blockquote className="hook" dir="auto">
              {idea.hook}
            </blockquote>
            <p dir="auto">{idea.concept}</p>
            <div className="why">
              <span className="tag">لماذا تنجح</span>
              <p className="muted small" dir="auto">
                {idea.why_it_works}
              </p>
              <p className="muted small" dir="auto">
                <span className="tag">المدة</span> {idea.duration_reason}
              </p>
            </div>
            {idea.evidence.length > 0 && (
              <div className="block">
                <h4>
                  النصوص الموثّقة <span className="count">{idea.evidence.length}</span>
                </h4>
                {idea.evidence.map((e) => (
                  <EvidenceItem key={e.id} e={e} />
                ))}
              </div>
            )}
            {idea.unverified.length > 0 && (
              <div className="block">
                <h4>لم يُعثر عليها في المصادر، فلن تُستعمل</h4>
                <ul className="plain">
                  {idea.unverified.map((u) => (
                    <li key={u}>
                      <span className="badge bad">غير موثّق</span> {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button className="primary block-button idea-cta" disabled={disabled} onClick={() => onPick(idea)}>
              اكتب السيناريو ←
            </button>
          </article>
        ))}
      </div>
    </>
  )
}
