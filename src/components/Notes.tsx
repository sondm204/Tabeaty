import { GripHorizontal, LockKeyhole, Palette, Trash2, UnlockKeyhole, X } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import {
  colors, defaultInk, MAX_HEIGHT, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH, noteRect, relativePoint,
} from '../model'
import type { Point, Size, StickyNote } from '../model'
import type { snapNote, SnapGuides } from '../snap'
import { IconButton, RangeField } from './Controls'

interface NoteProps {
  note: StickyNote
  area: Size
  layer: number
  focus: boolean
  conflict: boolean
  update: (id: string, patch: Partial<Omit<StickyNote, 'id' | 'createdAt'>>) => void
  activate: (id: string) => void
  remove: (id: string) => void
  resolve: (id: string) => void
  findSnap: (id: string, point: Point, size: Size) => ReturnType<typeof snapNote>
  showGuides: (guides: SnapGuides) => void
}

export const Note = memo(function Note({ note, area, layer, focus, conflict, update, activate, remove, resolve, findSnap, showGuides }: NoteProps) {
  const [appearance, setAppearance] = useState(false)
  const [offset, setOffset] = useState<Point>()
  const title = useRef<HTMLInputElement>(null)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ point?: Point; detach: () => void }>(null)
  const bounds = noteRect(note, area)
  const label = note.title || 'Ghi chú'
  useEffect(() => { if (focus) title.current?.focus() }, [focus])
  useEffect(() => () => {
    if (!drag.current) return
    drag.current.detach()
    showGuides({})
  }, [showGuides])

  function preview(point: Point, shift: boolean) {
    const snapped = shift ? findSnap(note.id, point, bounds) : undefined
    const x = snapped ? snapped.position.x - point.x : 0
    const y = snapped ? snapped.position.y - point.y : 0
    setOffset((previous) => {
      if (!x && !y) return undefined
      return previous?.x === x && previous.y === y ? previous : { x, y }
    })
    showGuides(snapped?.guides ?? {})
  }

  function startDrag() {
    const onShift = (event: KeyboardEvent) => {
      const point = drag.current?.point
      if (event.key === 'Shift' && point) preview(point, event.shiftKey)
    }
    const onBlur = () => {
      const point = drag.current?.point
      if (point) preview(point, false)
    }
    window.addEventListener('keydown', onShift)
    window.addEventListener('keyup', onShift)
    window.addEventListener('blur', onBlur)
    drag.current = {
      detach() {
        window.removeEventListener('keydown', onShift)
        window.removeEventListener('keyup', onShift)
        window.removeEventListener('blur', onBlur)
      },
    }
  }

  return <Rnd
    className="note"
    // Keep the preview separate from react-rnd's raw drag transform.
    style={{ zIndex: layer, translate: offset ? `${offset.x}px ${offset.y}px` : undefined }}
    position={{ x: bounds.x, y: bounds.y }}
    size={{ width: bounds.width, height: bounds.height }}
    minWidth={Math.min(MIN_WIDTH, area.width)} minHeight={Math.min(MIN_HEIGHT, area.height)}
    maxWidth={Math.min(MAX_WIDTH, area.width)} maxHeight={Math.min(MAX_HEIGHT, area.height)}
    bounds="parent" dragHandleClassName="note-grip" cancel="button,input,textarea,select,label"
    disableDragging={note.locked} enableResizing={!note.locked}
    onDragStart={startDrag}
    onDrag={(event, data) => {
      if (!drag.current) return
      drag.current.point = data
      preview(data, event.shiftKey)
    }}
    onDragStop={(event, data) => {
      const position = event.shiftKey && drag.current?.point ? findSnap(note.id, data, bounds).position : data
      drag.current?.detach()
      drag.current = null
      setOffset(undefined)
      showGuides({})
      update(note.id, relativePoint(position, bounds, area, note))
    }}
    onResizeStop={(_, __, element, ___, position) => {
      const size = { width: element.offsetWidth, height: element.offsetHeight }
      const savedSize = {
        width: size.width === bounds.width ? note.width : Math.max(MIN_WIDTH, size.width),
        height: size.height === bounds.height ? note.height : Math.max(MIN_HEIGHT, size.height),
      }
      update(note.id, { ...savedSize, ...relativePoint(position, size, area, note) })
    }}
  >
    <article className="note-card" aria-label={label} onPointerDown={() => activate(note.id)} onFocus={() => activate(note.id)}
      style={{ color: note.textColor, backgroundColor: `color-mix(in srgb, ${note.backgroundColor} ${note.opacity}%, transparent)` }}>
      <header className={`note-bar note-grip ${note.locked ? 'locked' : ''}`}>
        <GripHorizontal className="grip" size={16} aria-hidden="true" />
        <input ref={title} className="note-title" value={note.title} placeholder="Tiêu đề" maxLength={120} aria-label="Tiêu đề ghi chú"
          onChange={(event) => update(note.id, { title: event.target.value })} />
        <button ref={appearanceButton} className="icon-button" type="button" aria-label="Kiểu ghi chú" title="Kiểu ghi chú" aria-expanded={appearance}
          onClick={() => setAppearance(!appearance)}><Palette size={15} /></button>
        <IconButton label={note.locked ? 'Mở khóa vị trí' : 'Khóa vị trí'} aria-pressed={note.locked} onClick={() => update(note.id, { locked: !note.locked })}>
          {note.locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}
        </IconButton>
        <IconButton label="Xóa ghi chú" onClick={() => remove(note.id)}><Trash2 size={14} /></IconButton>
      </header>
      {conflict && <button type="button" className="note-conflict" onClick={() => resolve(note.id)}>Có thay đổi từ thiết bị khác</button>}
      <textarea className="note-text" value={note.content} placeholder="Viết gì đó…" aria-label="Nội dung ghi chú"
        style={{ fontSize: note.fontSize }} onChange={(event) => update(note.id, { content: event.target.value })} />
      {appearance && <section className="note-style" aria-label="Kiểu ghi chú" onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setAppearance(false)
          appearanceButton.current?.focus()
        }
      }}>
        <div className="note-style-head"><strong>Kiểu ghi chú</strong><IconButton label="Đóng kiểu ghi chú" onClick={() => {
          setAppearance(false)
          appearanceButton.current?.focus()
        }}><X size={16} /></IconButton></div>
        <div className="swatches" aria-label="Màu nền có sẵn">
          {colors.map((color, index) => <button key={color} type="button" className="swatch" style={{ backgroundColor: color }}
            aria-label={['Vàng', 'Hồng', 'Xanh dương', 'Xanh bạc hà', 'Tím', 'Trắng', 'Than'][index]}
            aria-pressed={note.backgroundColor === color} onClick={() => update(note.id, { backgroundColor: color, textColor: defaultInk(color) })} />)}
        </div>
        <div className="color-fields">
          <label>Màu nền <input type="color" value={note.backgroundColor} onChange={(event) => update(note.id, { backgroundColor: event.target.value })} /></label>
          <label>Màu chữ <input type="color" value={note.textColor} onChange={(event) => update(note.id, { textColor: event.target.value })} /></label>
        </div>
        <RangeField label="Độ đậm nền" value={note.opacity} min={0} max={100} unit="%" onChange={(opacity) => update(note.id, { opacity })} />
        <RangeField label="Cỡ chữ" value={note.fontSize} min={12} max={28} unit=" px" onChange={(fontSize) => update(note.id, { fontSize })} />
      </section>}
    </article>
  </Rnd>
})
