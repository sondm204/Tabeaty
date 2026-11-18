import { MAX_HEIGHT, MAX_SHORTCUTS, MAX_WIDGET_SCALE, MAX_WIDTH, MIN_HEIGHT, MIN_WIDGET_SCALE, MIN_WIDTH } from '../model'
import type { City, Settings, Shortcut, StickyNote, WeatherAppearance, WidgetAppearance } from '../model'
import { parseRichText } from '../rich-text'
import { widgetIds } from '../model'
import { MAX_COUNTDOWNS, MAX_TIMER_TIMESTAMP } from '../timers'

export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const string = (value: unknown, max = Infinity): value is string =>
  typeof value === 'string' && value.length <= max
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
const color = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

export function normalizeUrl(text: string): string {
  const input = text.trim()
  if (!input || /[\s\\\x00-\x1f]/.test(input) || input.startsWith('//')) throw new Error('Nhập địa chỉ HTTP hoặc HTTPS hợp lệ.')
  const hostWithPort = /^(?:localhost|[\w-]+(?:\.[\w-]+)+):\d+(?:[/?#]|$)/i.test(input)
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input) && !hostWithPort
  let url: URL
  try {
    url = new URL(hasScheme ? input : `https://${input}`)
  } catch {
    throw new Error('Nhập địa chỉ HTTP hoặc HTTPS hợp lệ.')
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) {
    throw new Error('Chỉ hỗ trợ địa chỉ HTTP hoặc HTTPS tối đa 2.048 ký tự, không kèm thông tin đăng nhập.')
  }
  return url.href
}

export function isNote(value: unknown): value is StickyNote {
  return record(value) && id(value.id) && string(value.title, 120) && string(value.content)
    && (value.format === undefined || (value.format === 'rich' && !!parseRichText(value.content)))
    && inRange(value.x, 0, 1) && inRange(value.y, 0, 1)
    && inRange(value.width, MIN_WIDTH, MAX_WIDTH) && inRange(value.height, MIN_HEIGHT, MAX_HEIGHT)
    && inRange(value.zIndex, 0, Number.MAX_SAFE_INTEGER) && inRange(value.createdAt, 0, Number.MAX_SAFE_INTEGER)
    && color(value.backgroundColor) && color(value.textColor) && inRange(value.opacity, 0, 100)
    && inRange(value.fontSize, 12, 28) && typeof value.locked === 'boolean'
}

export function isCity(value: unknown): value is City {
  return record(value) && string(value.name, 150) && !!value.name.trim() && string(value.country, 150)
    && inRange(value.latitude, -90, 90) && inRange(value.longitude, -180, 180)
}

function isPosition(value: unknown) {
  return record(value) && inRange(value.x, 0, 1) && inRange(value.y, 0, 1)
}

function isWidgetAppearance(value: unknown): value is WidgetAppearance {
  return record(value) && isPosition(value) && color(value.color) && inRange(value.scale, MIN_WIDGET_SCALE, MAX_WIDGET_SCALE)
}

function isWeatherAppearance(value: unknown): value is WeatherAppearance {
  return record(value) && isWidgetAppearance(value)
    && color(value.backgroundColor) && inRange(value.opacity, 0, 100)
}

const isTimestamp = (value: unknown) => inRange(value, 1, MAX_TIMER_TIMESTAMP)

function isCountdown(value: unknown) {
  return record(value) && string(value.title, 60) && isTimestamp(value.endsAt)
}

function isCountdownList(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_COUNTDOWNS) return false
  const ids = new Set<string>()
  return value.every((item: unknown) => {
    if (!record(item) || !id(item.id) || ids.has(item.id) || !isCountdown(item)) return false
    ids.add(item.id)
    return true
  })
}

function isTimerPosition(value: unknown) {
  return record(value) && isPosition(value)
    && (value.scale === undefined || inRange(value.scale, MIN_WIDGET_SCALE, MAX_WIDGET_SCALE))
}

function isWidgetVisibility(value: unknown) {
  return record(value) && widgetIds.every((key) => value[key] === undefined || typeof value[key] === 'boolean')
}

function isPomodoro(value: unknown) {
  return record(value) && inRange(value.focusMinutes, 1, 120) && inRange(value.breakMinutes, 1, 60)
    && (value.phase === 'focus' || value.phase === 'break')
    && (value.endsAt === null || isTimestamp(value.endsAt))
    && (value.pausedMs === null || (value.endsAt === null && inRange(value.pausedMs, 1, 120 * 60_000)))
}

export function isSettings(value: unknown): value is Settings {
  return record(value) && inRange(value.overlay, 0, 75) && inRange(value.blur, 0, 16)
    && typeof value.animate === 'boolean' && color(value.defaultColor)
    && inRange(value.defaultOpacity, 0, 100) && inRange(value.width, MIN_WIDTH, MAX_WIDTH)
    && inRange(value.height, MIN_HEIGHT, MAX_HEIGHT) && inRange(value.fontSize, 12, 28) && isCity(value.city)
    && (value.clockAppearance === undefined || isWidgetAppearance(value.clockAppearance))
    && (value.weatherAppearance === undefined || isWeatherAppearance(value.weatherAppearance))
    && (value.showTimers === undefined || typeof value.showTimers === 'boolean')
    && (value.widgetVisibility === undefined || isWidgetVisibility(value.widgetVisibility))
    && (value.countdown === undefined || value.countdown === null || isCountdown(value.countdown))
    && (value.countdowns === undefined || isCountdownList(value.countdowns))
    && (value.pomodoro === undefined || isPomodoro(value.pomodoro))
    && (value.countdownPosition === undefined || isTimerPosition(value.countdownPosition))
    && (value.pomodoroPosition === undefined || isTimerPosition(value.pomodoroPosition))
    && (value.fullHeightWidgets === undefined || value.fullHeightWidgets === true)
}

export function isShortcuts(value: unknown): value is Shortcut[] {
  if (!Array.isArray(value) || value.length > MAX_SHORTCUTS) return false
  const seen = new Set<string>()
  return value.every((item: unknown) => {
    if (!record(item) || !id(item.id) || seen.has(item.id) || !string(item.label, 40) || !string(item.url)) return false
    seen.add(item.id)
    try {
      return normalizeUrl(item.url) === item.url
    } catch {
      return false
    }
  })
}
