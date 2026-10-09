import { useEffect, useState } from 'react'
import { api, BASE } from '../api'
import { reviewHash } from '../route'
import type { PublicShowcase } from '../types'
import { Reveal } from './reveal'
import { VIEWER_ROLES } from './VideoFeedback'

/** The landing page's public part, chosen in the admin: published projects and featured ratings. Each block
 * shows only when the admin has picked something for it. */
export function PublicPicks() {
  const [data, setData] = useState<PublicShowcase | null>(null)
  useEffect(() => {
    api.showcase().then(setData, () => setData(null))
  }, [])
  if (!data) return null
  return (
    <>
      {data.projects.length > 0 && (
        <section id="published" className="section alt">
          <div className="section-inner">
            <Reveal>
              <span className="eyebrow">من أعمال بلاغ</span>
              <h2>محتوى أُنتج على المنصة، كما هو</h2>
            </Reveal>
            <div className="pub-grid">
              {data.projects.map((p) => (
                <article className="card pub-card" key={p.project_id}>
                  {p.video_url ? (
                    <video controls preload="none" playsInline src={BASE + p.video_url} poster={p.poster ? BASE + p.poster : undefined} />
                  ) : (
                    <div className="pub-novideo" aria-hidden="true">سيناريو</div>
                  )}
                  <div className="badges">
                    {p.approved ? <span className="badge ok">✓ معتمد من مراجع</span> : <span className="badge warn">بانتظار الاعتماد</span>}
                    {p.preview && <span className="badge">معاينة</span>}
                    <span className="badge">{p.audience}</span>
                  </div>
                  <h3 dir="auto">{p.title}</h3>
                  <p className="muted" dir="auto">{p.hook}</p>
                  <a href={reviewHash(p.project_id, p.script_id)}>اقرأ السيناريو ومصادره ←</a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      {data.ratings.length > 0 && (
        <section id="voices" className="section">
          <div className="section-inner">
            <Reveal>
              <span className="eyebrow">آراء</span>
              <h2>ما قاله من شاهد</h2>
            </Reveal>
            <div className="pub-grid">
              {data.ratings.map((r, i) => (
                <blockquote className="card quote" key={i}>
                  <p className="pub-stars" aria-label={`${r.stars} من 5`}>
                    {'★'.repeat(r.stars)}
                    <span>{'★'.repeat(5 - r.stars)}</span>
                  </p>
                  <p dir="auto">«{r.comment}»</p>
                  <footer>
                    <strong dir="auto">{r.name}</strong> · {VIEWER_ROLES[r.role]}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
