import { Grip, MoveDiagonal, MoveDiagonal2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { clamp, MAX_WIDGET_SCALE, MIN_WIDGET_SCALE, relativePoint } from '../model'
import type { Point, Rect, Size, WidgetAppearance } from '../model'

interface Gesture {
  pointer: number
  start: Point
  rect: Rect
  area: Size
  appearance: WidgetAppearance
  resize: boolean
  leftHandle: boolean
}

export function EditableWidget({ label, appearance, editing, update, style, children }: {
  label: string
  appearance: WidgetAppearance
  editing: boolean
  update: (patch: Partial<WidgetAppearance>) => void
  style?: CSSProperties
  children: ReactNode
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture>(null)
  const [draft, setDraft] = useState<Partial<WidgetAppearance>>()
  const layout = editing ? { ...appearance, ...draft } : appearance
  const leftHandle = draft ? gesture.current?.leftHandle : layout.x >= .5

  function start(event: PointerEvent<HTMLButtonElement>, resize: boolean) {
    const widget = wrapper.current
    const parent = widget?.parentElement
    if (!widget || !parent || event.button !== 0 || gesture.current) return
    const { x, y, width, height } = widget.getBoundingClientRect()
    const frame = parent.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {
      pointer: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      rect: { x: x - frame.x, y: y - frame.y, width, height },
      area: { width: frame.width, height: frame.height },
      appearance,
      resize,
      leftHandle: !!leftHandle,
    }
  }

  function change(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current
    if (active?.pointer !== event.pointerId) return
    const dx = event.clientX - active.start.x
    const dy = event.clientY - active.start.y
    if (active.resize) {
      // Project the pointer movement onto the original diagonal to scale both axes.
      const { width, height } = active.rect
      const distance = (dx * width * (active.leftHandle ? -1 : 1) + dy * height) / (width ** 2 + height ** 2)
      return { scale: clamp(Math.round(active.appearance.scale * (1 + distance)), MIN_WIDGET_SCALE, MAX_WIDGET_SCALE) }
    }
    return relativePoint({ x: active.rect.x + dx, y: active.rect.y + dy }, active.rect, active.area, active.appearance)
  }

  function stop(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (gesture.current?.pointer !== event.pointerId) return
    const patch = commit ? change(event) : undefined
    gesture.current = null
    setDraft(undefined)
    if (patch) update(patch)
  }

  const properties = {
    ...style,
    '--widget-x': `${layout.x * 100}%`, '--widget-y': `${layout.y * 100}%`,
    '--widget-scale': layout.scale / 100, '--widget-color': layout.color,
  } as CSSProperties

  const handles = {
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const patch = change(event)
      if (patch) setDraft(patch)
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => stop(event, true),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => stop(event, false),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => stop(event, false),
  }

  return <div ref={wrapper} className={`widget${editing ? ' widget-editable' : ''}`} style={properties}>
    {children}
    {editing && <>
      <button type="button" className="widget-handle widget-move" aria-label={`Di chuyển ${label}`} title={`Di chuyển ${label}`}
        onPointerDown={(event) => start(event, false)} {...handles}><Grip size={16} /></button>
      <button type="button" className={`widget-handle widget-resize ${leftHandle ? 'widget-resize-left' : ''}`}
        aria-label={`Đổi kích thước ${label}`} title={`Đổi kích thước ${label}`}
        onPointerDown={(event) => start(event, true)} {...handles}>{leftHandle ? <MoveDiagonal size={14} /> : <MoveDiagonal2 size={14} />}</button>
    </>}
  </div>
}
