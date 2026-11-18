import { defaultPomodoro } from './timers'
import type { Countdown, CountdownEvent, Pomodoro } from './timers'

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect extends Point, Size {}
export interface StickyNote extends Rect {
  id: string
  title: string
  content: string
  format?: 'rich'
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

export interface WidgetAppearance extends Point {
  color: string
  scale: number
}

export interface WeatherAppearance extends WidgetAppearance {
  backgroundColor: string
  opacity: number
}

export interface ScalablePosition extends Point {
  scale?: number
}

export const widgetIds = ['clock', 'weather', 'countdown', 'pomodoro', 'shortcuts', 'notes'] as const
export type WidgetId = typeof widgetIds[number]
export type ClockDisplay = 'date-time' | 'time' | 'date'

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
  clockAppearance?: WidgetAppearance
  clockDisplay?: ClockDisplay
  weatherAppearance?: WeatherAppearance
  showTimers?: boolean
  widgetVisibility?: Partial<Record<WidgetId, boolean>>
  countdown?: Countdown | null
  countdowns?: CountdownEvent[]
  pomodoro?: Pomodoro
  countdownPosition?: ScalablePosition
  pomodoroPosition?: ScalablePosition
  shortcutPosition?: ScalablePosition
  fullHeightWidgets?: true
}

export interface Shortcut { id: string; label: string; url: string }

export const MIN_WIDTH = 200
export const MIN_HEIGHT = 150
export const MAX_WIDTH = 760
export const MAX_HEIGHT = 600
export const MAX_SHORTCUTS = 24
export const MIN_WIDGET_SCALE = 60
export const MAX_WIDGET_SCALE = 150
export const colors = ['#f6efa9', '#f8d8dd', '#d4e6f6', '#d9edd4', '#e4ddf6', '#f8f5eb', '#303435'] as const

const DEFAULT_WIDGET_Y = .18
export const defaultClockAppearance: WidgetAppearance = { x: 0, y: DEFAULT_WIDGET_Y, color: '#faf9f1', scale: 100 }
export const defaultWeatherAppearance: WeatherAppearance = {
  x: 1, y: DEFAULT_WIDGET_Y, color: '#f8f8f0', scale: 100, backgroundColor: '#1a2620', opacity: 61,
}
export const defaultCountdownPosition: ScalablePosition = { x: 0, y: 1, scale: 100 }
export const defaultPomodoroPosition: ScalablePosition = { x: .5, y: 1, scale: 100 }
export const defaultShortcutPosition: ScalablePosition = { x: .5, y: 1, scale: 100 }

export const defaults: Settings = {
  overlay: 24, blur: 0, animate: true, defaultColor: colors[0], defaultOpacity: 96,
  width: 300, height: 240, fontSize: 15,
  city: { name: 'Hà Nội', country: 'Việt Nam', latitude: 21.0285, longitude: 105.8542 },
  clockAppearance: defaultClockAppearance, clockDisplay: 'date-time', weatherAppearance: defaultWeatherAppearance,
  showTimers: false, widgetVisibility: {}, countdown: null, countdowns: [], pomodoro: defaultPomodoro,
  countdownPosition: defaultCountdownPosition, pomodoroPosition: defaultPomodoroPosition, shortcutPosition: defaultShortcutPosition,
  fullHeightWidgets: true,
}

export function widgetVisible(settings: Settings, widget: WidgetId) {
  const timer = widget === 'countdown' || widget === 'pomodoro'
  return settings.widgetVisibility?.[widget] ?? (!timer || settings.showTimers === true)
}

function expandWidgetPosition<T extends Point>(position?: T): T | undefined {
  if (position) return { ...position, y: DEFAULT_WIDGET_Y + (1 - DEFAULT_WIDGET_Y) * position.y }
}

export function settingsForFullHeight(settings: Settings): Settings {
  if (settings.fullHeightWidgets) return settings
  return {
    ...settings,
    fullHeightWidgets: true,
    clockAppearance: expandWidgetPosition(settings.clockAppearance),
    weatherAppearance: expandWidgetPosition(settings.weatherAppearance),
    countdownPosition: expandWidgetPosition(settings.countdownPosition),
    pomodoroPosition: expandWidgetPosition(settings.pomodoroPosition),
  }
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
