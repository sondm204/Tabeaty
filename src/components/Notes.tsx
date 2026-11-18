import { GripHorizontal, LockKeyhole, Palette, Trash2, Type, UnlockKeyhole, X } from 'lucide-react'
import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import {
  colors, defaultInk, MAX_HEIGHT, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH, noteRect, relativePoint,
} from '../model'
import type { Rect, Size, StickyNote } from '../model'
import type { ResizeDirection, SnapGuides } from '../snap'
import { richTextFromPlain } from '../rich-text'
import { IconButton, RangeField } from './Controls'

const RichNote = lazy(() => import('./RichNote'))

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
  findSnap: (id: string, rect: Rect, direction?: ResizeDirection) => { rect: Rect; guides: SnapGuides }
  showGuides: (guides: SnapGuides) => void
}

export const Note = memo(function Note({ note, area, layer, focus, conflict, update, activate, remove, resolve, findSnap, showGuides }: NoteProps) {
  const [appearance, setAppearance] = useState(false)
  const [focusRich, setFocusRich] = useState(false)
  const [previewRect, setPreviewRect] = useState<Rect>()
  const title = useRef<HTMLInputElement>(null)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const gesture = useRef<{ rect?: Rect; direction?: ResizeDirection; detach: () => void }>(null)
  const bounds = noteRect(note, area)
  const label = note.title || 'Ghi chú'
  useEffect(() => { if (focus) title.current?.focus() }, [focus])
  useEffect(() => () => {
    if (!gesture.current) return
    gesture.current.detach()
    showGuides({})
  }, [showGuides])

  function preview(rect: Rect, shift: boolean, direction?: ResizeDirection) {
    const snapped = shift ? findSnap(note.id, rect, direction) : undefined
    const x = (snapped?.rect.x ?? rect.x) - rect.x
    const y = (snapped?.rect.y ?? rect.y) - rect.y
    const width = (snapped?.rect.width ?? rect.width) - rect.width
    const height = (snapped?.rect.height ?? rect.height) - rect.height
    setPreviewRect((previous) => {
      if (!x && !y && !width && !height) return undefined
      return previous?.x === x && previous.y === y && previous.width === width && previous.height === height
        ? previous : { x, y, width, height }
    })
    showGuides(snapped?.guides ?? {})
  }

  function startGesture(direction?: ResizeDirection) {
    gesture.current?.detach()
    const onShift = (event: KeyboardEvent) => {
      const rect = gesture.current?.rect
      if (event.key === 'Shift' && rect) preview(rect, event.shiftKey, direction)
    }
    const onBlur = () => {
      const rect = gesture.current?.rect
      if (rect) preview(rect, false, direction)
    }
    window.addEventListener('keydown', onShift)
    window.addEventListener('keyup', onShift)
    window.addEventListener('blur', onBlur)
    gesture.current = {
      direction,
      detach() {
        window.removeEventListener('keydown', onShift)
        window.removeEventListener('keyup', onShift)
        window.removeEventListener('blur', onBlur)
      },
    }
  }

  function track(rect: Rect, shift: boolean) {
    if (!gesture.current) return
    gesture.current.rect = rect
    preview(rect, shift, gesture.current.direction)
  }

  function finish(rect: Rect, shift: boolean) {
    const finalRect = shift && gesture.current?.rect ? findSnap(note.id, rect, gesture.current.direction).rect : rect
    gesture.current?.detach()
    gesture.current = null
    setPreviewRect(undefined)
    showGuides({})
    return finalRect
  }

  const resizing = !!gesture.current?.direction
  const translate = previewRect ? `${previewRect.x}px ${previewRect.y}px` : undefined

  return <Rnd
    className="note"
    // Keep the preview separate from react-rnd's raw drag transform.
    style={{ zIndex: layer, translate: resizing ? undefined : translate }}
    position={{ x: bounds.x, y: bounds.y }}
    size={{ width: bounds.width, height: bounds.height }}
    minWidth={Math.min(MIN_WIDTH, area.width)} minHeight={Math.min(MIN_HEIGHT, area.height)}
    maxWidth={Math.min(MAX_WIDTH, area.width)} maxHeight={Math.min(MAX_HEIGHT, area.height)}
    bounds="parent" dragHandleClassName="note-grip" cancel="button,input,textarea,select,label"
    disableDragging={note.locked} enableResizing={!note.locked}
    onDragStart={() => startGesture()}
    onDrag={(event, { x, y }) => track({ ...bounds, x, y }, event.shiftKey)}
    onDragStop={(event, { x, y }) => {
      const rect = finish({ ...bounds, x, y }, event.shiftKey)
      update(note.id, relativePoint(rect, rect, area, note))
    }}
    onResizeStart={(_, direction) => startGesture(direction)}
    onResize={(event, _, element, __, position) => {
      track({ ...position, width: element.offsetWidth, height: element.offsetHeight }, event.shiftKey)
    }}
    onResizeStop={(event, _, element, __, position) => {
      const rect = finish({ ...position, width: element.offsetWidth, height: element.offsetHeight }, event.shiftKey)
      const savedSize = {
        width: rect.width === bounds.width ? note.width : Math.max(MIN_WIDTH, rect.width),
        height: rect.height === bounds.height ? note.height : Math.max(MIN_HEIGHT, rect.height),
      }
      update(note.id, { ...savedSize, ...relativePoint(rect, rect, area, note) })
    }}
  >
    <article className="note-card" aria-label={label} onPointerDown={() => activate(note.id)} onFocus={() => activate(note.id)}
      style={{ translate: resizing ? translate : undefined,
        width: resizing && previewRect ? `calc(100% + ${previewRect.width}px)` : undefined,
        height: resizing && previewRect ? `calc(100% + ${previewRect.height}px)` : undefined,
        color: note.textColor, backgroundColor: `color-mix(in srgb, ${note.backgroundColor} ${note.opacity}%, transparent)` }}>
      <header className={`note-bar note-grip ${note.locked ? 'locked' : ''}`}>
        <GripHorizontal className="grip" size={16} aria-hidden="true" />
        <input ref={title} className="note-title" value={note.title} placeholder="Tiêu đề" maxLength={120} aria-label="Tiêu đề ghi chú"
          onChange={(event) => update(note.id, { title: event.target.value })} />
        {note.format !== 'rich' && <IconButton label="Bật định dạng ghi chú" onClick={() => {
          setFocusRich(true)
          update(note.id, { format: 'rich', content: JSON.stringify(richTextFromPlain(note.content)) })
        }}><Type size={15} /></IconButton>}
        <button ref={appearanceButton} className="icon-button" type="button" aria-label="Kiểu ghi chú" title="Kiểu ghi chú" aria-expanded={appearance}
          onClick={() => setAppearance(!appearance)}><Palette size={15} /></button>
        <IconButton label={note.locked ? 'Mở khóa vị trí' : 'Khóa vị trí'} aria-pressed={note.locked} onClick={() => update(note.id, { locked: !note.locked })}>
          {note.locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}
        </IconButton>
        <IconButton label="Xóa ghi chú" onClick={() => remove(note.id)}><Trash2 size={14} /></IconButton>
      </header>
      {conflict && <button type="button" className="note-conflict" onClick={() => resolve(note.id)}>Có thay đổi từ thiết bị khác</button>}
      {note.format === 'rich' ? <Suspense fallback={<p className="note-text">Đang mở trình soạn thảo…</p>}>
        <RichNote value={note.content} fontSize={note.fontSize} autofocus={focusRich}
          onChange={(content) => update(note.id, { content })} />
      </Suspense> : <textarea className="note-text" value={note.content} placeholder="Viết gì đó…" aria-label="Nội dung ghi chú"
        style={{ fontSize: note.fontSize }} onChange={(event) => update(note.id, { content: event.target.value })} />}
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
