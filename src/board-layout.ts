import type { Size } from './model'

export function fitBoard(reference: Size, viewport: Size) {
  const scale = Math.min(viewport.width / reference.width, viewport.height / reference.height)
  return {
    ...reference,
    scale,
    x: (viewport.width - reference.width * scale) / 2,
    y: (viewport.height - reference.height * scale) / 2,
  }
}
