import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; children: ReactNode
}) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...props}>{children}</button>
}

export function RangeField({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void
}) {
  return <label className="range-field">
    <span>{label}<output>{value}{unit}</output></span>
    <input type="range" value={value} min={min} max={max} onChange={(event) => onChange(event.target.valueAsNumber)} />
  </label>
}
