import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Point } from '../model'

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; children: ReactNode
}) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...props}>{children}</button>
}

export function PositionFields({ position, update }: {
  position: Point; update: (patch: Partial<Point>) => void
}) {
  return <>
    <RangeField label="Vị trí ngang" value={Math.round(position.x * 100)} min={0} max={100}
      unit="%" onChange={(value) => update({ x: value / 100 })} />
    <RangeField label="Vị trí dọc" value={Math.round(position.y * 100)} min={0} max={100}
      unit="%" onChange={(value) => update({ y: value / 100 })} />
  </>
}

export function RangeField({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void
}) {
  return <label className="range-field">
    <span>{label}<span className="range-value" aria-hidden="true">{value}{unit}</span></span>
    <input type="range" value={value} min={min} max={max} aria-valuetext={`${value}${unit}`}
      onChange={(event) => onChange(event.target.valueAsNumber)} />
  </label>
}
