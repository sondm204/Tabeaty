export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface StickyNote extends Point, Size {
  id: string
  title: string
  content: string
  zIndex: number
  backgroundColor: string
  textColor: string
  opacity: number
  fontSize: number
  locked: boolean
  createdAt: number
}

export interface City {
  name: string
  country: string
  latitude: number
  longitude: number
}

export interface Settings {
  overlay: number
  blur: number
  animate: boolean
  defaultColor: string
  defaultOpacity: number
  width: number
  height: number
  fontSize: number
  city: City
}

export interface Shortcut { id: string; label: string; url: string }

export const MIN_WIDTH = 200
export const MIN_HEIGHT = 150
export const MAX_WIDTH = 760
export const MAX_HEIGHT = 600
export const MAX_SHORTCUTS = 24
export const colors = ['#f6efa9', '#f8d8dd', '#d4e6f6', '#d9edd4', '#e4ddf6', '#f8f5eb', '#303435'] as const

export const defaults: Settings = {
  overlay: 24, blur: 0, animate: true, defaultColor: colors[0], defaultOpacity: 96,
  width: 300, height: 240, fontSize: 15,
  city: { name: 'Hà Nội', country: 'Việt Nam', latitude: 21.0285, longitude: 105.8542 },
}

export const defaultShortcuts: Shortcut[] = [
  { id: 'google', label: 'Google', url: 'https://www.google.com/' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/' },
  { id: 'gmail', label: 'Gmail', url: 'https://mail.google.com/' },
]

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function defaultInk(color: string) {
  const channel = (index: number) => parseInt(color.slice(index, index + 2), 16)
  const [r, g, b] = [channel(1), channel(3), channel(5)]
  return r * .299 + g * .587 + b * .114 < 140 ? '#faf7ed' : '#292b23'
}

export function createNote(settings: Settings, point: Point, zIndex: number): StickyNote {
  return {
    id: crypto.randomUUID(), title: '', content: '', ...point, zIndex, locked: false,
    width: settings.width, height: settings.height, fontSize: settings.fontSize,
    backgroundColor: settings.defaultColor, textColor: defaultInk(settings.defaultColor),
    opacity: settings.defaultOpacity, createdAt: Date.now(),
  }
}

export function noteRect(note: StickyNote, area: Size) {
  const width = Math.min(note.width, area.width)
  const height = Math.min(note.height, area.height)
  return { width, height, x: note.x * (area.width - width), y: note.y * (area.height - height) }
}

export function relativePoint(point: Point, size: Size, area: Size, fallback: Point): Point {
  return {
    x: area.width > size.width ? clamp(point.x / (area.width - size.width), 0, 1) : fallback.x,
    y: area.height > size.height ? clamp(point.y / (area.height - size.height), 0, 1) : fallback.y,
  }
}
