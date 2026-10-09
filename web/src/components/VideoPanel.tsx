import { useEffect, useState } from 'react'
import { api, BASE } from '../api'
import { VIDEO_STATUS } from '../labels'
import { VideoChecks } from './VideoChecks'
import { VideoFeedback } from './VideoFeedback'
import { askToNotify, notifyIfAway } from '../notify'
import type { Script, Video, VideoTemplate } from '../types'

interface Props {
  projectId: string
  script: Script
  template: VideoTemplate | null
  templates: VideoTemplate[] | null
  disabled: boolean
  /** Opens the part of the page a blocked state points to (template or approval). */
  onGo?: (part: 'template' | 'approve') => void
}

const ACTIVE = new Set(['queued', 'voicing', 'imaging', 'rendering'])

/** "نحو 4 دقائق" from seconds, rounded up to a half minute so the promise is rarely broken. */
function minutes(seconds: number): string {
  const m = Math.ceil(seconds / 30) / 2
  return m < 1 ? 'أقل من دقيقة' : m === 1 ? 'نحو دقيقة' : `نحو ${m} ${m <= 10 ? 'دقائق' : 'دقيقة'}`
}

/** The waiting line of a running job: time elapsed against what this template usually takes. */
function Waiting({ video, template }: { video: Video; template: VideoTemplate | undefined }) {
  const since = () => Math.max(0, (Date.now() - new Date(video.created_at).getTime()) / 1000)
  const [elapsed, setElapsed] = useState(since)
  useEffect(() => {
    const timer = setInterval(() => setElapsed(since()), 1000)
    return () => clearInterval(timer)
    // `since` closes over nothing but the prop; the ticker only needs to restart for a new job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.created_at])
  const typical = template?.typical_seconds ?? null
  const share = typical ? Math.min(0.95, elapsed / typical) : null
  const [copied, setCopied] = useState(false)
  const mm = String(Math.floor(elapsed / 60))
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0')
  return (
    <div className="waiting">
      <div className="waiting-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((share ?? 0.1) * 100)}%` }} className={share == null ? 'pulse' : ''} />
      </div>
      <p className="muted small">
        مضى <span dir="ltr">{mm}:{ss}</span>
        {typical
          ? ` · هذا القالب يستغرق عادة ${minutes(typical)}${elapsed > typical * 1.3 ? '، وهذا يطول أكثر من المعتاد: الخادم يصيّر فيديو آخر على الأرجح' : ''}`
          : ' · يستغرق الفيديو عادة بين 3 و8 دقائق'}
        .
      </p>
      <p className="muted small">
        يمكنك متابعة العمل أو إغلاق الصفحة: الفيديو يُحفظ هنا، وإن سمحت بالإشعارات نبّهناك عند اكتماله.{' '}
        <button type="button" className="link inline" onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied(true))}>
          {copied ? 'نُسخ رابط الصفحة' : 'انسخ رابط الصفحة'}
        </button>
      </p>
    </div>
  )
}

/** Renders the approved script with its template and follows the job until the MP4 is ready. */
export function VideoPanel({ projectId, script, template, templates, disabled, onGo }: Props) {
  const [videos, setVideos] = useState<Video[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    api.videos(projectId, script.id).then(setVideos, () => setVideos([]))
  }, [projectId, script.id])

  const running = videos.some((v) => ACTIVE.has(v.status))
  useEffect(() => {
    if (!running) return
    const timer = setInterval(async () => {
      const fresh = await Promise.all(videos.map((v) => (ACTIVE.has(v.status) ? api.video(v.id).catch(() => v) : v)))
      for (const v of fresh) {
        const before = videos.find((x) => x.id === v.id)
        if (before && ACTIVE.has(before.status) && v.status === 'done')
          notifyIfAway('بلاغ: الفيديو جاهز', v.preview ? 'فيديو المعاينة جاهز للمشاهدة.' : 'الفيديو النهائي جاهز للتنزيل.')
        if (before && ACTIVE.has(before.status) && v.status === 'failed') notifyIfAway('بلاغ: تعذر إنشاء الفيديو', v.error ?? '')
      }
      setVideos(fresh)
    }, 4000)
    return () => clearInterval(timer)
  }, [running, videos])

  const start = async () => {
    if (!template) return
    setStarting(true)
    setError(null)
    askToNotify()
    try {
      const video = await api.createVideo(projectId, script.id, template.id)
      setVideos((vs) => [video, ...vs])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  const blocked = !template ? 'اختر قالبا أولا.' : null
  const hasFinal = videos.some((v) => v.status === 'done' && !v.preview)
  const hasPreview = videos.some((v) => v.status === 'done' && v.preview)

  return (
    <section className="card">
      <p className="muted small">
        {script.approved
          ? 'النسخة معتمدة: الفيديو النهائي بلا علامة مائية.'
          : 'قبل الاعتماد: فيديو معاينة بعلامة مائية يشاهده المراجعون. بعد الاعتماد: الفيديو النهائي بلا علامة.'}
      </p>
      <details className="muted small more">
        <summary>كيف يُصنع الفيديو؟</summary>
        <p>
          يُولَّد صوت الشرح والحوار والصور بالذكاء الاصطناعي، ثم يُصيَّر الفيديو بالقالب المختار. النصوص الشرعية لا
          تُقرأ بصوت اصطناعي: القرآن بتلاوة قارئ، والحديث من تسجيل قارئ إن وُجد، وإلا عُرض بصمت. الصوت والصور محفوظة
          فلا يُدفع ثمنها مرة أخرى.
        </p>
      </details>
      {error && <div className="notice bad">{error}</div>}
      {blocked ? (
        // Instead of a grey button, the one action that unblocks it.
        <div className="next">
          <div>
            <strong>{blocked}</strong>
            <p className="muted small">القالب يحدد شكل الفيديو وما يُولَّد له.</p>
          </div>
          {onGo && (
            <button className="primary" disabled={disabled} onClick={() => onGo('template')}>
              اختر قالبا
            </button>
          )}
        </div>
      ) : (
        <div className="actions">
          <button className="primary" disabled={disabled || starting || running} onClick={start}>
            {running
              ? 'يُنشأ الفيديو…'
              : script.approved
                ? `${hasFinal ? 'أعد إنشاء' : 'أنشئ'} الفيديو النهائي بقالب «${template!.name}»`
                : `${hasPreview ? 'أعد إنشاء' : 'أنشئ'} معاينة بقالب «${template!.name}»`}
          </button>
          {!script.approved && hasPreview && onGo && (
            <button disabled={disabled} onClick={() => onGo('approve')}>
              المعاينة جاهزة: اذهب إلى الاعتماد
            </button>
          )}
        </div>
      )}
      {videos.some((v) => v.status === 'done') && (
        <details className="checklist">
          <summary>قائمة الفحص البشري قبل النشر (دقيقتان)</summary>
          <ul>
            <li>النص على الشاشة يطابق ما يُسمع، ولا تُقطع آية أو حديث في منتصف كلمة.</li>
            <li>اسم المصدر ورقمه ظاهران تحت كل نص شرعي، و«جزء من الحديث» حين يكون المقتبس أقصر.</li>
            <li>لا نص يخرج عن حواف الشاشة، ولا صورة لا تناسب الجمهور.</li>
            <li>الملاحظات الآلية أعلاه كلها ✓، أو فُهم سبب كل ملاحظة.</li>
            <li>الصوت واضح من أول ثانية، والصمت المقصود لقراءة نص بلا تسجيل مكتوب تحته.</li>
          </ul>
        </details>
      )}
      {videos.length > 0 && (
        <ul className="plain videos">
          {videos.map((v, i) => (
            <li key={v.id}>
              <div className="badges">
                <span className={`badge ${v.status === 'done' ? 'ok' : v.status === 'failed' ? 'bad' : 'info'}`}>
                  {VIDEO_STATUS[v.status]}
                </span>
                <span className={v.preview ? 'badge warn' : 'badge ok'}>{v.preview ? 'فيديو المعاينة · بعلامة مائية' : 'الفيديو النهائي'}</span>
                <span className="badge">{templates?.find((t) => t.id === v.template)?.name ?? v.template}</span>
                {v.duration_seconds != null && <span className="badge">{Math.round(v.duration_seconds)} ث</span>}
                {v.status === 'done' && (
                  <span className="badge">
                    {v.new_clips} مقطع صوتي و{v.new_images} صورة جديدة
                  </span>
                )}
              </div>
              {ACTIVE.has(v.status) && <Waiting video={v} template={templates?.find((t) => t.id === v.template)} />}
              {v.error && <p className="muted small">{v.error}</p>}
              {v.notes.map((n) => (
                <p className="muted small" key={n}>
                  {n}
                </p>
              ))}
              {v.url && i === 0 && (
                <video controls preload="metadata" src={BASE + v.url} className="player" poster={v.frames[0] ? BASE + v.frames[0] : undefined} />
              )}
              <VideoChecks video={v} compact={i > 0} />
              {v.status === 'done' && i === 0 && <VideoFeedback videoId={v.id} />}
              {v.url && (
                <a href={BASE + v.url} download>
                  تنزيل MP4
                </a>
              )}
              {v.url && i > 0 && (
                <a href={BASE + v.url} target="_blank" rel="noreferrer">
                  {' · '}مشاهدة
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
