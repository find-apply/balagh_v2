import { useState } from 'react'
import { VIEWER_ROLES } from '../../components/VideoFeedback'
import type { Feedback, ViewerRole } from '../../types'
import { adminApi } from '../adminApi'
import type { FeedbackReport } from '../adminApi'
import { date, num } from '../format'
import { Card, Cell, DataTable, IconButton, Status, Tag, Toolbar } from '../ui'
import { useLoad } from '../useLoad'

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

/** What viewers thought of the finished videos, and how each template compares. */
export function Ratings() {
  const { data, error, loading, reload } = useLoad(adminApi.feedback)
  // Flipped locally as soon as the server accepts, so the list need not reload.
  const [featured, setFeatured] = useState<Record<number, boolean>>({})
  const [only, setOnly] = useState(false)
  const isOn = (f: Feedback) => featured[f.id] ?? f.featured
  const toggle = async (f: Feedback) => {
    const r = await adminApi.feature(f.id, !isOn(f))
    setFeatured((m) => ({ ...m, [f.id]: r.featured }))
  }
  return (
    <>
      <Toolbar>
        <div className="adm-seg" role="group" aria-label="تصفية التقييمات">
          <button className={only ? 'chip' : 'chip on'} aria-pressed={!only} onClick={() => setOnly(false)}>
            كل ما وصل
          </button>
          <button className={only ? 'chip on' : 'chip'} aria-pressed={only} onClick={() => setOnly(true)}>
            المعتمد للصفحة الرئيسية
          </button>
        </div>
        <IconButton icon="refresh" className="adm-push" onClick={reload}>تحديث</IconButton>
      </Toolbar>
      <Status error={error} loading={loading && !data} />
      {data && (
        <>
          <Card title="القوالب">
            <DataTable<FeedbackReport['templates'][number]>
              rows={data.templates}
              rowKey={(t) => t.template}
              empty="لا قوالب."
              columns={[
                { header: 'القالب', cell: (t) => t.name },
                { header: 'المتوسط', cell: (t) => (t.average === null ? <span className="muted">—</span> : <span className="adm-nowrap">{stars(Math.round(t.average))} {num(t.average)}</span>) },
                { header: 'التقييمات', cell: (t) => num(t.ratings) },
                {
                  header: 'من قيّم',
                  cell: (t) =>
                    Object.entries(t.by_role).map(([r, n]) => (
                      <Tag key={r}>
                        {VIEWER_ROLES[r as ViewerRole] ?? r}: {num(n)}
                      </Tag>
                    )),
                },
              ]}
            />
          </Card>
          <Card title="آخر التقييمات" flush>
            <DataTable<Feedback>
              rows={only ? data.items.filter(isOn) : data.items}
              rowKey={(f) => f.id}
              empty={only ? 'لم تعتمد تقييما للصفحة الرئيسية بعد.' : 'لم يقيّم أحد فيديو بعد.'}
              columns={[
                { header: 'الوقت', cell: (f) => <span className="adm-nowrap">{date(f.created_at)}</span> },
                { header: 'التقييم', cell: (f) => <span className="adm-nowrap">{stars(f.stars)}</span> },
                { header: 'من', cell: (f) => <Cell title={f.name} sub={VIEWER_ROLES[f.role]} /> },
                { header: 'القالب', cell: (f) => data.templates.find((t) => t.template === f.template)?.name ?? f.template },
                { header: 'الملاحظة', cell: (f) => <span dir="auto">{f.comment}</span> },
                {
                  header: 'الصفحة الرئيسية',
                  cell: (f) => (
                    <button type="button" className={isOn(f) ? 'small-button on' : 'small-button'} aria-pressed={isOn(f)} onClick={() => void toggle(f)}>
                      {isOn(f) ? '✓ معتمد · أزله' : 'اعتمده للعرض'}
                    </button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  )
}
