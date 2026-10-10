import { adminApi } from '../adminApi'
import { KINDS, num } from '../format'
import { Card, DataTable, LevelBadge, Meter, Notice, Stat, Status, Tag } from '../ui'
import { useLoad } from '../useLoad'

export function Overview() {
  const { data, error, loading } = useLoad(adminApi.overview)
  if (!data) return <Status error={error} loading={loading} />
  const t = data.totals
  const { total, failed, by_kind } = data.runs_24h
  const failRate = total ? Math.round((failed / total) * 100) : 0
  const peak = Math.max(1, ...data.series.map((d) => Math.max(d.projects, d.runs)))

  return (
    <>
      {data.paused && (
        <Notice tone="warn" icon="pause">
          <strong>التوليد متوقف حاليا.</strong> لن يستطيع المستخدمون إنشاء مشاريع أو سيناريوهات حتى تستأنفه من «مسار التوليد».
        </Notice>
      )}
      <div className="adm-stats">
        <Stat icon="folder" label="المشاريع" value={num(t.projects)} />
        <Stat icon="file" label="السيناريوهات" value={num(t.scripts)} hint={`${num(t.localized)} موطّنة`} />
        <Stat icon="check" label="معتمدة" value={num(t.approved)} tone="ok" />
        <Stat icon="clock" label="بانتظار الاعتماد" value={num(t.awaiting)} tone={t.awaiting ? 'warn' : undefined} hint={`${num(t.specialist)} تحتاج مختصا`} />
        <Stat icon="users" label="حسابات تنتظر القبول" value={num(t.pending_accounts)} tone={t.pending_accounts ? 'warn' : undefined} />
        <Stat icon="alert" label="بلاغات مفتوحة" value={num(t.open_reports)} tone={t.open_reports ? 'bad' : undefined} />
        <Stat icon="cpu" label="استدعاءات النموذج (24 ساعة)" value={num(total)} tone={failRate > 10 ? 'bad' : undefined} hint={`${num(failRate)}٪ فشل`} />
      </div>

      <div className="adm-grid">
        <Card title="النشاط في آخر 14 يوما" icon="activity">
          <div className="adm-bars" role="img" aria-label="مشاريع جديدة واستدعاءات نموذج لكل يوم">
            {data.series.map((d) => (
              <div key={d.day} className="adm-bar" title={`${d.day}: ${d.projects} مشروع، ${d.runs} استدعاء`}>
                <i style={{ height: `${(d.runs / peak) * 100}%` }} className="runs" />
                <i style={{ height: `${(d.projects / peak) * 100}%` }} className="proj" />
                <small>{d.day.slice(8)}</small>
              </div>
            ))}
          </div>
          <p className="adm-legend">
            <span className="proj" /> مشاريع جديدة <span className="runs" /> استدعاءات النموذج
          </p>
        </Card>

        <Card title="مستويات المحتوى" icon="layers">
          {Object.entries(data.by_level).map(([level, n]) => (
            <Meter key={level} label={<LevelBadge level={level} />} value={num(n)} of={t.scripts ? n / t.scripts : 0} />
          ))}
          <p className="adm-note">
            <span className="icon-text"><span>عربي {num(data.by_language.ar ?? 0)}</span> · <span>إنجليزي {num(data.by_language.en ?? 0)}</span></span> (لغة المشاريع)
          </p>
        </Card>
      </div>

      <Card title="أداء مراحل النموذج (24 ساعة)" icon="cpu" flush>
        <DataTable
          rows={by_kind}
          rowKey={(r) => r.kind}
          empty="لا استدعاءات بعد."
          columns={[
            { header: 'المرحلة', cell: (r) => KINDS[r.kind] ?? r.kind },
            { header: 'الاستدعاءات', cell: (r) => num(r.total) },
            { header: 'الفاشلة', cell: (r) => (r.failed ? <Tag tone="bad" icon="alert">{num(r.failed)}</Tag> : '٠') },
            { header: 'متوسط الزمن', cell: (r) => `${num(r.avg_seconds)} ث` },
          ]}
        />
      </Card>
    </>
  )
}
