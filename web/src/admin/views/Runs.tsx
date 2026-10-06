import { useState } from 'react'
import { adminApi } from '../adminApi'
import type { Run } from '../adminApi'
import { date, KINDS, num } from '../format'
import { Card, DataTable, IconButton, Status, Tag, Toolbar } from '../ui'
import type { Column } from '../ui'
import { useLoad } from '../useLoad'

const COLUMNS: Column<Run>[] = [
  { header: 'الوقت', cell: (r) => <span className="adm-nowrap">{date(r.at)}</span> },
  { header: 'المرحلة', cell: (r) => KINDS[r.kind] ?? r.kind },
  { header: 'النموذج', cell: (r) => <code className="adm-code">{r.model}</code> },
  { header: 'الزمن', cell: (r) => <span className="adm-nowrap">{num(Math.round(r.seconds * 10) / 10)} ث</span> },
  {
    header: 'النتيجة',
    cell: (r) => (
      <>
        {r.ok ? <Tag tone="ok" icon="check">نجح</Tag> : <Tag tone="bad" icon="alert">فشل</Tag>}
        {r.error && <small className="adm-error" dir="ltr">{r.error}</small>}
      </>
    ),
  },
]

export function Runs() {
  const [failed, setFailed] = useState(false)
  const { data, error, loading, reload } = useLoad(() => adminApi.runs(failed), [failed])
  return (
    <>
      <Toolbar>
        <div className="adm-seg" role="group" aria-label="تصفية السجل">
          <button className={failed ? 'chip' : 'chip on'} aria-pressed={!failed} onClick={() => setFailed(false)}>
            الكل
          </button>
          <button className={failed ? 'chip on' : 'chip'} aria-pressed={failed} onClick={() => setFailed(true)}>
            الفاشلة فقط
          </button>
        </div>
        <IconButton icon="refresh" className="adm-push" onClick={reload}>تحديث</IconButton>
      </Toolbar>
      <Status error={error} loading={loading && !data} />
      {data && (
        <Card flush>
          <DataTable rows={data} rowKey={(r) => r.id} columns={COLUMNS} empty="لا استدعاءات مسجلة." />
        </Card>
      )}
    </>
  )
}
