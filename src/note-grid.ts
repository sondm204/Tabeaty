import { noteRect, relativePoint } from './model'
import type { Point, Rect, Size, StickyNote } from './model'

const GAP = 16
const gridLine = (edge: number) => Math.ceil((edge + GAP) / GAP) * GAP

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP
    && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP
}

/** Plan the whole layout before moving any notes. Locked notes reserve their space. */
export function arrangeNotes(notes: StickyNote[], area: Size): Map<string, Point> | undefined {
  const placed = notes.filter((note) => note.locked).map((note) => noteRect(note, area))
  const positions = new Map<string, Point>()
  const ordered = notes.filter((note) => !note.locked).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  for (const note of ordered) {
    const { width, height } = noteRect(note, area)
    const xs = [...new Set([0, ...placed.map((rect) => gridLine(rect.x + rect.width))])].sort((a, b) => a - b)
    const ys = [...new Set([0, ...placed.map((rect) => gridLine(rect.y + rect.height))])].sort((a, b) => a - b)
    let slot: Rect | undefined
    for (const y of ys) {
      if (y + height > area.height) break
      for (const x of xs) {
        if (x + width > area.width) break
        const candidate = { x, y, width, height }
        if (!placed.some((rect) => overlaps(candidate, rect))) {
          slot = candidate
          break
        }
      }
      if (slot) break
    }
    if (!slot) return
    placed.push(slot)
    positions.set(note.id, relativePoint(slot, slot, area, note))
  }
  return positions
}
