import { useEffect, useState } from 'react'
import type { Task } from '../tasks'

function useSeconds() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return seconds
}

/** Inline generation progress. The API answers in one response, so stages advance on a time estimate and never all complete early. */
export function Progress({ task, step }: { task: Task; step?: string }) {
  const seconds = useSeconds()
  const share = task.expected / task.stages.length
  const current = Math.min(Math.floor(seconds / share), task.stages.length - 1)
  const percent = Math.round(92 * (1 - Math.exp(-seconds / (task.expected * 0.6))))

  return (
    <div className="gen-card" role="status" aria-live="polite">
      <div className="progress-head">
        <span className="spinner brand" />
        <div className="grow">
          {step && <span className="step-chip">{step}</span>}
          <h3>{task.title}</h3>
        </div>
        <span className="elapsed">
          {seconds} ث
          <small>من نحو {task.expected < 60 ? `${task.expected} ث` : 'دقيقة'}</small>
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${percent}%` }} />
      </div>
      {/* The server answers in one response: these are what the step does, timed by a typical run, not live status. */}
      <ol className="stages" aria-label="ما تشمله هذه الخطوة">
        {task.stages.map((stage, i) => (
          <li key={stage} className={i < current ? 'done' : i === current ? 'now' : ''}>
            <span className="dot" />
            {stage}
          </li>
        ))}
      </ol>
      <p className="muted small">
        التقدم تقديري من الزمن المعتاد، لا حالة لحظية من الخادم. يمكنك تصفح السجل أثناء التوليد. النصوص الشرعية
        يدرجها النظام من المصدر، لا النموذج.
      </p>
    </div>
  )
}

export function Toast({ label }: { label: string }) {
  return (
    <div className="toast" role="status">
      <span className="spinner" /> {label}
    </div>
  )
}

export function IdeaSkeletons() {
  return (
    <div className="ideas" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className="card idea skeleton" key={i}>
          <span className="sk sk-badges" />
          <span className="sk sk-title" />
          <span className="sk sk-block" />
          <span className="sk sk-line" />
          <span className="sk sk-line short" />
          <span className="sk sk-button" />
        </div>
      ))}
    </div>
  )
}

export function ScriptSkeleton() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <span className="sk sk-title" />
      {[0, 1, 2, 3].map((i) => (
        <div className="sk-scene" key={i}>
          <span className="sk sk-time" />
          <div className="grow">
            <span className="sk sk-line" />
            <span className="sk sk-line short" />
          </div>
        </div>
      ))}
    </div>
  )
}
