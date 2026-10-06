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
}

const ACTIVE = new Set(['queued', 'voicing', 'imaging', 'rendering'])

/** Renders the approved script with its template and follows the job until the MP4 is ready. */
export function VideoPanel({ projectId, script, template, templates, disabled }: Props) {
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

  const blocked = !template ? 'اختر قالبا أولا.' : !script.approved ? 'يُفتح إنشاء الفيديو بعد اعتماد النسخة.' : null

  return (
    <section className="card">
      <h3>الفيديو</h3>
      <p className="muted">
        يُولَّد صوت الشرح والحوار من النص بالذكاء الاصطناعي، والصور من وصف المشاهد، ثم يُصيَّر الفيديو بالقالب
        المختار. النصوص الشرعية لا تُقرأ بصوت اصطناعي: القرآن بتلاوة قارئ، والحديث من تسجيل يضعه صانع المحتوى في
        data/recitations، وإلا عُرض بصمت.
      </p>
      {blocked && <p className="muted small">{blocked}</p>}
      {error && <div className="notice bad">{error}</div>}
      <button className="primary" disabled={disabled || starting || running || Boolean(blocked)} onClick={start}>
        {running ? 'يُنشأ الفيديو…' : `أنشئ الفيديو${template ? ` بقالب «${template.name}»` : ''}`}
      </button>
      {videos.length > 0 && (
        <ul className="plain videos">
          {videos.map((v, i) => (
            <li key={v.id}>
              <div className="badges">
                <span className={`badge ${v.status === 'done' ? 'ok' : v.status === 'failed' ? 'bad' : 'info'}`}>
                  {VIDEO_STATUS[v.status]}
                </span>
                <span className="badge">{templates?.find((t) => t.id === v.template)?.name ?? v.template}</span>
                {v.duration_seconds != null && <span className="badge">{Math.round(v.duration_seconds)} ث</span>}
                {v.status === 'done' && (
                  <span className="badge">
                    {v.new_clips} مقطع صوتي و{v.new_images} صورة جديدة
                  </span>
                )}
              </div>
              {ACTIVE.has(v.status) && (
                <p className="muted small">يستغرق إنشاء الفيديو عادة بين 3 و8 دقائق. يمكنك متابعة العمل في الصفحة.</p>
              )}
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
