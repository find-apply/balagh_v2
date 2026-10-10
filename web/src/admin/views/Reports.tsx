import { useState } from 'react'
import { go } from '../../route'
import { adminApi } from '../adminApi'
import type { ReportReason, ReportRow, ReportStatus } from '../adminApi'
import { date } from '../format'
import { Card, Cell, DataTable, IconButton, Status, Tag, Toolbar } from '../ui'
import { useLoad } from '../useLoad'

export const REASONS: Record<ReportReason, string> = {
  offensive: 'محتوى مسيء أو غير لائق',
  religious_error: 'خطأ شرعي في المعنى أو الحكم',
  wrong_text: 'نص شرعي غير مطابق لمصدره',
  other: 'سبب آخر',
}

const FILTERS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'مفتوحة' },
  { key: 'closed', label: 'مغلقة' },
  { key: 'all', label: 'الكل' },
]

/** What people flagged in generated content, from the app or the site. Open the version, act, then close. */
export function Reports() {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open')
  const { data, error, loading, reload } = useLoad(() => adminApi.reports(filter === 'all' ? undefined : filter), [filter])
  const [busy, setBusy] = useState<number | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const set = async (r: ReportRow, status: ReportStatus) => {
    setBusy(r.id)
    setFailed(null)
    try {
      await adminApi.setReport(r.id, status)
      reload()
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Toolbar>
        <div className="adm-seg" role="group" aria-label="تصفية البلاغات">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'chip on' : 'chip'} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <IconButton icon="refresh" className="adm-push" onClick={reload}>تحديث</IconButton>
      </Toolbar>
      <Status error={error ?? failed} loading={loading && !data} />
      {data && (
        <Card flush>
          <DataTable<ReportRow>
            rows={data}
            rowKey={(r) => String(r.id)}
            onOpen={(r) => go(`#/admin/projects/${r.project_id}${r.script_id ? `/${r.script_id}` : ''}`)}
            empty={filter === 'open' ? 'لا بلاغات مفتوحة.' : 'لا بلاغات.'}
            columns={[
              { header: 'السبب', cell: (r) => <Cell title={REASONS[r.reason]} sub={r.video_id ? 'على فيديو' : r.script_id ? 'على نسخة' : 'على المشروع'} /> },
              { header: 'الملاحظة', cell: (r) => <span dir="auto">{r.note || '—'}</span> },
              { header: 'المُبلِّغ', cell: (r) => (r.email ? <span dir="ltr">{r.email}</span> : 'زائر') },
              { header: 'التاريخ', cell: (r) => <span className="adm-nowrap">{date(r.created_at)}</span> },
              { header: 'الحالة', cell: (r) => <Tag tone={r.status === 'open' ? 'warn' : 'ok'}>{r.status === 'open' ? 'مفتوح' : 'مغلق'}</Tag> },
              {
                header: '',
                cell: (r) => (
                  <button
                    type="button"
                    className="small-button"
                    disabled={busy === r.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      void set(r, r.status === 'open' ? 'closed' : 'open')
                    }}
                  >
                    {r.status === 'open' ? 'أغلق' : 'أعد فتحه'}
                  </button>
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  )
}
