import { useState } from 'react'
import { adminApi } from '../adminApi'
import type { AccountRole, AccountRow, AccountStatus } from '../adminApi'
import { date } from '../format'
import { Card, Cell, DataTable, IconButton, Status, Tag, Toolbar } from '../ui'
import type { Tone } from '../ui'
import { useLoad } from '../useLoad'

const FILTERS: { key: AccountStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'قيد المراجعة' },
  { key: 'approved', label: 'مقبولة' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'all', label: 'الكل' },
]

const STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  pending: { label: 'قيد المراجعة', tone: 'warn' },
  approved: { label: 'مقبول', tone: 'ok' },
  rejected: { label: 'مرفوض', tone: 'bad' },
}

/** Sign-ups waiting to be let in, and every account's standing. */
export function Accounts() {
  const [filter, setFilter] = useState<AccountStatus | 'all'>('pending')
  const { data, error, loading, reload } = useLoad(() => adminApi.accounts(filter === 'all' ? undefined : filter), [filter])
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // The role the admin is choosing for each row, before it is saved.
  const [roles, setRoles] = useState<Record<string, AccountRole>>({})
  const roleOf = (a: AccountRow) => roles[a.uid] ?? a.role ?? null

  const decide = async (a: AccountRow, status: AccountStatus) => {
    setBusy(a.uid)
    setFailed(null)
    try {
      await adminApi.setAccountStatus(a.uid, status, roleOf(a) ?? undefined)
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
        <div className="adm-seg" role="group" aria-label="تصفية الحسابات">
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
          <DataTable<AccountRow>
            rows={data}
            rowKey={(a) => a.uid}
            empty={filter === 'pending' ? 'لا طلبات تنتظر المراجعة.' : 'لا حسابات.'}
            columns={[
              { header: 'الاسم', cell: (a) => <Cell title={a.full_name || a.name || '—'} sub={a.email ?? undefined} /> },
              {
                header: 'التخصص',
                cell: (a) => (
                  <span dir="auto">
                    {a.specialization || '—'} {a.specialization_changed && <Tag tone="warn">عدّله صاحبه</Tag>}
                  </span>
                ),
              },
              {
                header: 'الصفة',
                cell: (a) => (
                  <span className="adm-nowrap">
                    <select
                      aria-label={`صفة ${a.full_name || a.name || ''}`}
                      value={roleOf(a) ?? ''}
                      onChange={(e) => setRoles((r) => ({ ...r, [a.uid]: e.target.value as AccountRole }))}
                    >
                      <option value="" disabled>اختر بعد التحقق</option>
                      <option value="specialist">مختص شرعي</option>
                      <option value="creator">صانع محتوى</option>
                    </select>{' '}
                    {a.status === 'approved' && roles[a.uid] && roles[a.uid] !== a.role && (
                      <button type="button" className="small-button" disabled={busy === a.uid} onClick={() => void decide(a, 'approved')}>
                        احفظ
                      </button>
                    )}
                  </span>
                ),
              },
              { header: 'الهاتف', cell: (a) => (a.phone ? <span dir="ltr" className="adm-nowrap">{a.phone}</span> : '—') },
              { header: 'التسجيل', cell: (a) => <span className="adm-nowrap">{date(a.created_at)}</span> },
              { header: 'الحالة', cell: (a) => <Tag tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Tag> },
              {
                header: 'القرار',
                cell: (a) => (
                  <span className="adm-nowrap">
                    {a.status !== 'approved' && (
                      <button
                        type="button"
                        className="small-button"
                        disabled={busy === a.uid || !roleOf(a)}
                        title={roleOf(a) ? undefined : 'حدّد الصفة أولا'}
                        onClick={() => void decide(a, 'approved')}
                      >
                        قبول
                      </button>
                    )}{' '}
                    {a.status !== 'rejected' && (
                      <button type="button" className="small-button" disabled={busy === a.uid} onClick={() => void decide(a, 'rejected')}>
                        رفض
                      </button>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  )
}
