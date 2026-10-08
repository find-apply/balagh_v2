import { useState } from 'react'
import { go, reviewHash } from '../../route'
import { adminApi } from '../adminApi'
import { num, ROLES } from '../format'
import { Card, Cell, DataTable, LevelBadge, Status, Tag } from '../ui'
import { useLoad } from '../useLoad'

export function Approvals() {
  const { data, error, loading } = useLoad(adminApi.approvals)
  const [copied, setCopied] = useState<string | null>(null)
  // A scholar's invitation link for one of the platform's specialists: the only way to sign in that role.
  const invite = async (projectId: string, scriptId: string) => {
    const { token } = await adminApi.invite(projectId, 'scholar')
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}${reviewHash(projectId, scriptId, 'scholar', token)}`)
    setCopied(scriptId)
  }
  if (!data) return <Status error={error} loading={loading} />
  return (
    <Card flush>
      <DataTable
        rows={data}
        rowKey={(a) => a.script_id}
        onOpen={(a) => go(`#/admin/projects/${a.project_id}/${a.script_id}`)}
        empty="لا شيء بانتظار الاعتماد."
        columns={[
          { header: 'السيناريو', cell: (a) => <Cell title={a.title} sub={`v${num(a.version)} · ${a.author === 'specialist' ? 'مختص شرعي' : 'غير مختص'}${a.localized ? ' · موطّنة' : ''}`} /> },
          { header: 'المستوى', cell: (a) => <LevelBadge level={a.content_level} /> },
          { header: 'وقّع', cell: (a) => a.signed.map((r) => <Tag key={r} tone="ok" icon="check">{ROLES[r]}</Tag>) },
          { header: 'ينتظر', cell: (a) => a.missing.map((r) => <Tag key={r} tone="warn" icon="clock">{ROLES[r]}</Tag>) },
          {
            header: 'دعوة',
            cell: (a) => a.missing.includes('scholar') && (
              <button type="button" className="small-button" onClick={(e) => { e.stopPropagation(); void invite(a.project_id, a.script_id) }}>
                {copied === a.script_id ? 'نُسخ' : 'انسخ رابط مراجع شرعي'}
              </button>
            ),
          },
        ]}
      />
    </Card>
  )
}
