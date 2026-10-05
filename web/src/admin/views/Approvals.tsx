import { go } from '../../route'
import { adminApi } from '../adminApi'
import { num, ROLES } from '../format'
import { Card, Cell, DataTable, LevelBadge, Status, Tag } from '../ui'
import { useLoad } from '../useLoad'

export function Approvals() {
  const { data, error, loading } = useLoad(adminApi.approvals)
  if (!data) return <Status error={error} loading={loading} />
  return (
    <Card flush>
      <DataTable
        rows={data}
        rowKey={(a) => a.script_id}
        onOpen={(a) => go(`#/admin/projects/${a.project_id}/${a.script_id}`)}
        empty="لا شيء بانتظار الاعتماد."
        columns={[
          { header: 'السيناريو', cell: (a) => <Cell title={a.title} sub={`v${num(a.version)}${a.localized ? ' · موطّنة' : ''}`} /> },
          { header: 'المستوى', cell: (a) => <LevelBadge level={a.content_level} /> },
          { header: 'وقّع', cell: (a) => a.signed.map((r) => <Tag key={r} tone="ok" icon="check">{ROLES[r]}</Tag>) },
          { header: 'ينتظر', cell: (a) => a.missing.map((r) => <Tag key={r} tone="warn" icon="clock">{ROLES[r]}</Tag>) },
        ]}
      />
    </Card>
  )
}
