import { useEffect, useState } from 'react'
import { api, BASE } from '../api'
import { VIDEO_STATUS } from '../labels'
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
        . يمكنك متابعة العمل في الصفحة، أو تركها: الفيديو يُحفظ هنا.
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
      setVideos(fresh)
    }, 4000)
    return () => clearInterval(timer)
  }, [running, videos])

  const start = async () => {
    if (!template) return
    setStarting(true)
    setError(null)
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
      <h3>الفيديو</h3>
      <p className="muted">
        يُولَّد صوت الشرح والحوار من النص بالذكاء الاصطناعي، والصور من وصف المشاهد، ثم يُصيَّر الفيديو بالقالب
        المختار. النصوص الشرعية لا تُقرأ بصوت اصطناعي: القرآن بتلاوة قارئ، والحديث من تسجيل يضعه صانع المحتوى في
        data/recitations، وإلا عُرض بصمت.
      </p>
      <p className="muted small">
        {script.approved
          ? 'النسخة معتمدة: الفيديو النهائي بلا علامة مائية.'
          : 'قبل الاعتماد يُنشأ فيديو معاينة بعلامة مائية «معاينة · غير معتمد» يشاهده المراجعون؛ بعد الاعتماد يُنشأ الفيديو النهائي بلا علامة، والصوت والصور محفوظة فلا يُدفع ثمنها مرة أخرى.'}
      </p>
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
      {videos.length > 0 && (
        <ul className="plain videos">
          {videos.map((v, i) => (
            <li key={v.id}>
              <div className="badges">
                <span className={`badge ${v.status === 'done' ? 'ok' : v.status === 'failed' ? 'bad' : 'info'}`}>
                  {VIDEO_STATUS[v.status]}
                </span>
                <span className={v.preview ? 'badge warn' : 'badge ok'}>{v.preview ? 'معاينة بعلامة مائية' : 'نهائي'}</span>
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
                <video controls preload="metadata" src={BASE + v.url} className="player" />
              )}
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
