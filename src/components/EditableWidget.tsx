import { Grip, MoveDiagonal, MoveDiagonal2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { clamp, MAX_WIDGET_SCALE, MIN_WIDGET_SCALE, relativePoint } from '../model'
import type { Point, Rect, Size, WidgetAppearance } from '../model'
import { snapPosition, viewportCenter, viewportGuides } from '../snap'
import type { SnapGuides } from '../snap'

type WidgetLayout = Point & Partial<Pick<WidgetAppearance, 'color' | 'scale'>>
const arrowDirections: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
}

interface Gesture {
  pointer: number
  start: Point
  rect: Rect
  origin: Point
  area: Size
  appearance: WidgetLayout
  resize: boolean
  leftHandle: boolean
  last?: Point
}

function change(active: Gesture, pointer: Point, shift: boolean) {
  const dx = pointer.x - active.start.x
  const dy = pointer.y - active.start.y
  if (active.resize) {
    // Project the pointer movement onto the original diagonal to scale both axes.
    const { width, height } = active.rect
    const distance = (dx * width * (active.leftHandle ? -1 : 1) + dy * height) / (width ** 2 + height ** 2)
    const scale = active.appearance.scale ?? 100
    return { patch: { scale: clamp(Math.round(scale * (1 + distance)), MIN_WIDGET_SCALE, MAX_WIDGET_SCALE) }, guides: {} }
  }
  const point = { x: active.rect.x + dx, y: active.rect.y + dy }
  const snapped = shift && snapPosition(point, active.rect, active.area, [], viewportCenter(active.origin))
  return {
    patch: relativePoint(snapped ? snapped.position : point, active.rect, active.area, active.appearance),
    guides: snapped ? viewportGuides(snapped.guides, active.origin) : {},
  }
}

export function EditableWidget({ label, appearance, editing, update, hide, showGuides, style, children }: {
  label: string
  appearance: WidgetLayout
  editing: boolean
  update: (patch: Partial<WidgetAppearance>) => void
  hide: () => void
  showGuides: (guides: SnapGuides) => void
  style?: CSSProperties
  children: ReactNode
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture>(null)
  const [draft, setDraft] = useState<Partial<WidgetAppearance>>()
  const layout = editing ? { ...appearance, ...draft } : appearance
  const leftHandle = draft ? gesture.current?.leftHandle : layout.x >= .5

  useEffect(() => {
    if (!editing) return
    function previewShift(event: globalThis.KeyboardEvent) {
      const active = gesture.current
      if (event.key !== 'Shift' || !active?.last || active.resize) return
      const { patch, guides } = change(active, active.last, event.shiftKey)
      setDraft(patch)
      showGuides(guides)
    }
    function clearShift() {
      const active = gesture.current
      if (active?.last && !active.resize) {
        setDraft(change(active, active.last, false).patch)
        showGuides({})
      }
    }
    window.addEventListener('keydown', previewShift)
    window.addEventListener('keyup', previewShift)
    window.addEventListener('blur', clearShift)
    return () => {
      window.removeEventListener('keydown', previewShift)
      window.removeEventListener('keyup', previewShift)
      window.removeEventListener('blur', clearShift)
      if (!gesture.current) return
      gesture.current = null
      setDraft(undefined)
      showGuides({})
    }
  }, [editing, showGuides])

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
      origin: { x: frame.x, y: frame.y },
      rect: { x: x - frame.x, y: y - frame.y, width, height },
      area: { width: frame.width, height: frame.height },
      appearance,
      resize,
      leftHandle: !!leftHandle,
    }
  }

  function stop(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const active = gesture.current
    if (active?.pointer !== event.pointerId) return
    gesture.current = null
    setDraft(undefined)
    showGuides({})
    if (commit && active.last) update(change(active, { x: event.clientX, y: event.clientY }, event.shiftKey).patch)
  }

  function step(event: KeyboardEvent<HTMLButtonElement>, resize: boolean) {
    const direction = arrowDirections[event.key]
    if (!direction || gesture.current) return
    event.preventDefault()
    const increment = event.shiftKey ? 5 : 1
    if (resize) {
      const scale = (appearance.scale ?? 100) + (direction.x - direction.y) * increment
      update({ scale: clamp(scale, MIN_WIDGET_SCALE, MAX_WIDGET_SCALE) })
    } else {
      update({ x: clamp(appearance.x + direction.x * increment / 100, 0, 1), y: clamp(appearance.y + direction.y * increment / 100, 0, 1) })
    }
  }

  const properties = {
    ...style,
    '--widget-x': `${layout.x * 100}%`, '--widget-y': `${layout.y * 100}%`,
    '--widget-scale': layout.scale === undefined ? undefined : layout.scale / 100,
    '--widget-color': layout.color,
  } as CSSProperties

  const handles = {
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const active = gesture.current
      if (active?.pointer !== event.pointerId) return
      active.last = { x: event.clientX, y: event.clientY }
      const { patch, guides } = change(active, active.last, event.shiftKey)
      setDraft(patch)
      showGuides(guides)
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => stop(event, true),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => stop(event, false),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => stop(event, false),
  }

  return <div ref={wrapper} className={`widget${editing ? ' widget-editable' : ''}`} style={properties}>
    {children}
    {editing && <>
      <button type="button" className="widget-handle widget-move" aria-label={`Di chuyển ${label}`} title={`Di chuyển ${label}`}
        onPointerDown={(event) => start(event, false)} onKeyDown={(event) => step(event, false)} {...handles}><Grip size={16} /></button>
      <button type="button" className="widget-handle widget-hide" aria-label={`Ẩn ${label}`} title={`Ẩn ${label}`}
        onClick={hide}><Trash2 size={14} /></button>
      {appearance.scale !== undefined && <button type="button" className={`widget-handle widget-resize ${leftHandle ? 'widget-resize-left' : ''}`}
        aria-label={`Đổi kích thước ${label}`} title={`Đổi kích thước ${label}`}
        onPointerDown={(event) => start(event, true)} onKeyDown={(event) => step(event, true)} {...handles}>{leftHandle ? <MoveDiagonal size={14} /> : <MoveDiagonal2 size={14} />}</button>}
    </>}
  </div>
}
