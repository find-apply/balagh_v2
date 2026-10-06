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
    <div className="ideas">
      {ideas.map((idea, n) => (
        <article className="card idea" key={idea.id}>
          <div className="badges">
            <span className={`badge level-${idea.content_level}`}>{LEVELS[idea.content_level]}</span>
            <span className="badge">{idea.duration_seconds} ث</span>
            {idea.needs_specialist_review && <span className="badge warn">تحتاج مراجعة مختص</span>}
          </div>
          <span className="idea-num">الفكرة {n + 1}</span>
          <h3 dir="auto">{idea.title}</h3>
          <p className="hook" dir="auto">
            {idea.hook}
          </p>
          <p className="sources-line">
            {idea.evidence.length > 0 ? (
              <span className="badge ok">{idea.evidence.length} نص موثّق</span>
            ) : (
              <span className="badge">بلا نص شرعي</span>
            )}
            {idea.unverified.length > 0 && <span className="badge bad">{idea.unverified.length} غير موثّق، لن يُستعمل</span>}
          </p>
          <button className="primary" disabled={disabled} onClick={() => onPick(idea)}>
            اكتب السيناريو
          </button>
          <details className="idea-more">
            <summary>الفكرة بالتفصيل والنصوص</summary>
            <p dir="auto">{idea.concept}</p>
            <p className="muted" dir="auto">
              <span className="tag">لماذا تنجح</span> {idea.why_it_works}
            </p>
            <p className="muted small" dir="auto">
              <span className="tag">المدة</span> {idea.duration_reason}
            </p>
            {idea.evidence.length > 0 && (
              <div className="block">
                <h4>النصوص الموثّقة من المصادر</h4>
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
          </details>
        </article>
      ))}
    </div>
  )
}
