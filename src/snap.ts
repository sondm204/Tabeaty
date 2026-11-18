import { MAX_HEIGHT, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH } from './model'
import type { Point, Rect, Size } from './model'

export type SnapGuides = Partial<Point>
const SNAP_DISTANCE = 8

function anchors(start: number, size: number) {
  return [start, start + size / 2, start + size]
}

function snapAxis(start: number, size: number, limit: number, targets: number[]) {
  let closest: { position: number; guide: number; distance: number } | undefined
  for (const offset of anchors(0, size)) {
    for (const guide of targets) {
      const position = guide - offset
      const distance = Math.abs(position - start)
      if (position < 0 || position + size > limit || distance > SNAP_DISTANCE) continue
      if (!closest || distance < closest.distance) closest = { position, guide, distance }
    }
  }
  return closest
}

export function snapNote(point: Point, size: Size, area: Size, neighbors: Rect[]) {
  const x = snapAxis(point.x, size.width, area.width,
    [...anchors(0, area.width), ...neighbors.flatMap((note) => anchors(note.x, note.width))])
  const y = snapAxis(point.y, size.height, area.height,
    [...anchors(0, area.height), ...neighbors.flatMap((note) => anchors(note.y, note.height))])
  return {
    position: { x: x?.position ?? point.x, y: y?.position ?? point.y },
    guides: { x: x?.guide, y: y?.guide } satisfies SnapGuides,
  }
}

export type ResizeDirection = Parameters<import('react-rnd').RndResizeCallback>[1]

function snapResizeAxis(start: number, size: number, moving: 'start' | 'end' | undefined,
  limit: number, min: number, max: number, targets: number[]) {
  if (!moving) return { start, size, guide: undefined }
  const end = start + size
  const edge = moving === 'start' ? start : end
  const fixed = moving === 'start' ? end : start
  let best = { start, size, guide: undefined as number | undefined }
  let distance = Infinity
  for (const guide of targets) {
    // A centerline moves half as far as the edge while the opposite edge stays fixed.
    for (const candidate of [guide, 2 * guide - fixed]) {
      const delta = Math.abs(candidate - edge)
      const nextSize = moving === 'start' ? fixed - candidate : candidate - fixed
      if (delta > SNAP_DISTANCE || delta >= distance || candidate < 0 || candidate > limit
        || nextSize < Math.min(limit, min) || nextSize > max) continue
      best = { start: Math.min(candidate, fixed), size: nextSize, guide }
      distance = delta
    }
  }
  return best
}

export function snapResize(rect: Rect, area: Size, neighbors: Rect[], direction: ResizeDirection) {
  const handle = direction.toLowerCase()
  const x = snapResizeAxis(rect.x, rect.width, handle.includes('left') ? 'start' : handle.includes('right') ? 'end' : undefined,
    area.width, MIN_WIDTH, MAX_WIDTH, [...anchors(0, area.width), ...neighbors.flatMap((note) => anchors(note.x, note.width))])
  const y = snapResizeAxis(rect.y, rect.height, handle.includes('top') ? 'start' : handle.includes('bottom') ? 'end' : undefined,
    area.height, MIN_HEIGHT, MAX_HEIGHT, [...anchors(0, area.height), ...neighbors.flatMap((note) => anchors(note.y, note.height))])
  return { rect: { x: x.start, y: y.start, width: x.size, height: y.size }, guides: { x: x.guide, y: y.guide } }
}
