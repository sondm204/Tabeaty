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
