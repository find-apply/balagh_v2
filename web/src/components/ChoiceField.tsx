import { useState } from 'react'

export interface Option {
  label: string
  value: string
}

interface Props {
  label: string
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  /** Label of the chip that leaves the choice to the AI (sends null). Omit when a value is required. */
  auto?: string
  customPlaceholder?: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  hint?: string
}

/** A row of preset chips, with an optional "auto" chip and a "custom" chip that reveals a free input. */
export function ChoiceField({ label, options, value, onChange, auto, customPlaceholder, type = 'text', min, max, hint }: Props) {
  const [custom, setCustom] = useState(value !== null && !options.some((o) => o.value === value))
  const pick = (v: string | null) => {
    setCustom(false)
    onChange(v)
  }
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips">
        {auto && (
          <button type="button" className={!custom && value === null ? 'chip on auto' : 'chip auto'} onClick={() => pick(null)}>
            ✦ {auto}
          </button>
        )}
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            className={!custom && value === o.value ? 'chip on' : 'chip'}
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          className={custom ? 'chip on' : 'chip'}
          onClick={() => {
            setCustom(true)
            onChange(null)
          }}
        >
          مخصص
        </button>
      </div>
      {custom && (
        <input
          autoFocus
          required
          type={type}
          min={min}
          max={max}
          value={value ?? ''}
          placeholder={customPlaceholder}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )}
      {hint && <small className="muted">{hint}</small>}
    </div>
  )
}
