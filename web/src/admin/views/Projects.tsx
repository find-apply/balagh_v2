import { useState } from 'react'
import type React from 'react'
import { Workspace } from '../../components/Workspace'
import { go } from '../../route'
import { adminApi } from '../adminApi'
import type { ProjectRow } from '../adminApi'
import { date, num } from '../format'
import { Card, Cell, DataTable, IconButton, LevelBadge, Notice, Status, Tag, Toolbar } from '../ui'
import type { Column } from '../ui'
import { useLoad } from '../useLoad'
import { Icon } from '../../components/Icon'

const adminHash = (projectId: string, scriptId?: string | null) => `#/admin/projects/${projectId}${scriptId ? `/${scriptId}` : ''}`

/** Publish or withdraw a project from the landing page, from its row or from its page. */
function PublishButton({ id, published, onChange }: { id: string; published: boolean; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(published)
  const [busy, setBusy] = useState(false)
  const flip = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    try {
      const r = await adminApi.publish(id, !on)
      setOn(r.published)
      onChange?.(r.published)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className={on ? 'small-button on' : 'small-button'} aria-pressed={on} disabled={busy} onClick={flip}>
      {on ? '✓ منشور · اسحبه' : 'انشره للناس'}
    </button>
  )
}

const COLUMNS: Column<ProjectRow>[] = [
  { header: 'المشروع', cell: (p) => <Cell title={p.title || '—'} sub={p.id.slice(0, 8)} /> },
  { header: 'الجمهور', cell: (p) => <span dir="auto">{p.audience}</span> },
  { header: 'التاريخ', cell: (p) => date(p.created_at) },
  { header: 'سيناريوهات', cell: (p) => num(p.scripts) },
  {
    header: 'الحالة',
    cell: (p) => (
      <>
        {p.levels.map((l) => <LevelBadge key={l} level={l} />)}{' '}
        {p.awaiting > 0 && <Tag tone="warn" icon="clock">{num(p.awaiting)} بانتظار الاعتماد</Tag>}
        {p.approved > 0 && <Tag tone="ok" icon="check">{num(p.approved)} معتمد</Tag>}
      </>
    ),
  },
  { header: 'للناس', cell: (p) => (p.scripts > 0 ? <PublishButton id={p.id} published={p.published} /> : <span className="muted small">لا سيناريو</span>) },
]

export function Projects({ path }: { path: string[] }) {
  return path[1] ? <Detail id={path[1]} scriptId={path[2] ?? null} /> : <List />
}

function List() {
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useLoad(() => adminApi.projects(q), [q])
  return (
    <>
      <Toolbar>
        <span className="adm-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="بحث بالعنوان أو الجمهور أو المعرّف" value={q} onChange={(e) => setQ(e.target.value)} />
        </span>
        <IconButton icon="refresh" onClick={reload}>تحديث</IconButton>
      </Toolbar>
      <Status error={error} loading={loading && !data} />
      {data && (
        <Card flush>
          <DataTable rows={data} rowKey={(p) => p.id} columns={COLUMNS} onOpen={(p) => go(adminHash(p.id))} empty="لا مشاريع مطابقة." />
        </Card>
      )}
    </>
  )
}

/** A project exactly as its owner sees it, read-only, under an admin strip with the controls only an admin has. */
function Detail({ id, scriptId }: { id: string; scriptId: string | null }) {
  const { data: project, error, loading } = useLoad(() => adminApi.project(id), [id])
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState<string | null>(null)

  async function remove() {
    if (!confirm('حذف هذا المشروع نهائيا؟ ستتوقف روابط المراجعة المرتبطة به عن العمل.')) return
    setBusy(true)
    try {
      await adminApi.deleteProject(id)
      go('#/admin/projects')
    } catch (e) {
      setFail(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!project) return <Status error={error} loading={loading} />
  return (
    <>
      <div className="adm-strip">
        <a href="#/admin/projects" className="adm-back">
          <Icon name="back" size={16} /> كل المشاريع
        </a>
        <span className="adm-strip-meta">
          <Icon name="eye" size={15} /> عرض للقراءة فقط · <code>{project.id}</code>
        </span>
        <a className="button" href={`#/p/${project.id}`} target="_blank" rel="noreferrer">
          <Icon name="external" size={16} /> فتح في الاستوديو
        </a>
        <IconButton icon="trash" className="adm-danger" onClick={remove} disabled={busy}>حذف</IconButton>
      </div>
      {fail && <Notice tone="bad" icon="alert">{fail}</Notice>}
      <Workspace project={project} scriptId={scriptId} hashFor={adminHash} />
    </>
  )
}
