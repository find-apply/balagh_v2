import { useEffect, useState } from 'react'
import type { Task } from '../tasks'

/** Generation progress. The API answers in one response, so stages advance on a time estimate and never all complete early. */
export function Progress({ task }: { task: Task }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  if (task.stages.length === 0) {
    return (
      <div className="toast" role="status">
        <span className="spinner" /> {task.title}
      </div>
    )
  }

  const share = task.expected / task.stages.length
  const current = Math.min(Math.floor(seconds / share), task.stages.length - 1)
  const percent = Math.round(92 * (1 - Math.exp(-seconds / (task.expected * 0.6))))

  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="progress-card">
        <div className="progress-head">
          <span className="spinner brand" />
          <div>
            <h3>{task.title}</h3>
            <p className="muted small">
              {seconds} ث · يستغرق عادة نحو {task.expected < 60 ? `${task.expected} ثانية` : 'دقيقة'}
            </p>
          </div>
        </div>
        <div className="bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <ol className="stages">
          {task.stages.map((stage, i) => (
            <li key={stage} className={i < current ? 'done' : i === current ? 'now' : ''}>
              <span className="dot" />
              {stage}
            </li>
          ))}
        </ol>
        <p className="muted small">النصوص الشرعية يدرجها النظام من المصدر، لا النموذج.</p>
      </div>
    </div>
  )
}
