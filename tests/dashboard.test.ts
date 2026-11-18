import { describe, expect, it } from 'vitest'
import { createNote, defaults, widgetVisible } from '../src/model'
import { parseRichText, richTextFromPlain, serializeRichText } from '../src/rich-text'
import { parseBackup, serializeBackup } from '../src/services/backup'
import { isSettings } from '../src/services/validation'
import { countdownEvents, defaultPomodoro, pomodoroRemaining, saveCountdown, timerParts, togglePomodoro } from '../src/timers'

const note = (id: string, createdAt: number) => ({
  ...createNote({ ...defaults, width: 200, height: 150 }, { x: 0, y: 0 }, 1), id, createdAt,
})

describe('Ghi chú định dạng', () => {
  it('giữ nội dung và các dòng trống của ghi chú văn bản cũ', () => {
    const content = parseRichText(JSON.stringify(richTextFromPlain('Ý tưởng\n\nTiếp theo')))
    expect(content?.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Ý tưởng' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tiếp theo' }] },
    ])
  })

  it('sao lưu và nhập được checklist có định dạng, từ chối node ảnh', () => {
    const rich = {
      ...note('task', 1), format: 'rich' as const,
      content: JSON.stringify({
        type: 'doc', content: [{
          type: 'taskList', content: [{
            type: 'taskItem', attrs: { checked: true }, content: [{
              type: 'paragraph', content: [{ type: 'text', text: 'Xong', marks: [{ type: 'bold' }] }],
            }],
          }],
        }],
      }),
    }
    const backup = { notes: [rich], settings: defaults, shortcuts: [] }
    expect(parseBackup(serializeBackup(backup))).toEqual(backup)
    expect(parseRichText('{"type":"doc","content":[{"type":"image","attrs":{"src":"https://example.com"}}]}')).toBeUndefined()
  })

  it('chuẩn hóa thuộc tính danh sách dán từ HTML trước khi lưu', () => {
    const json = serializeRichText({
      type: 'doc', content: [{
        type: 'orderedList', attrs: { start: NaN, type: 'invalid' },
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      }],
    })
    expect(parseRichText(json)?.content?.[0]?.attrs).toEqual({ start: 1, type: null })
  })
})

describe('Hẹn giờ', () => {
  it('khôi phục bố cục hẹn giờ riêng và vẫn đọc được bản sao lưu cũ', () => {
    const { countdownPosition, pomodoroPosition, countdowns, widgetVisibility, ...old } = defaults
    const backup = { notes: [], shortcuts: [], settings: old }
    expect(parseBackup(serializeBackup(backup)).settings).toEqual(old)
    const settings = { ...old, countdownPosition: { x: .4, y: .2 }, pomodoroPosition: { x: .8, y: .65 } }
    expect(parseBackup(serializeBackup({ ...backup, settings })).settings).toEqual(settings)
    expect(isSettings({ ...settings, countdownPosition: { x: 1.1, y: .2 } })).toBe(false)
    expect(isSettings({ ...settings, pomodoroPosition: { x: .8, y: -1 } })).toBe(false)
  })

  it('giữ mốc cũ và giới hạn ba mốc có thể sửa riêng', () => {
    const original = { title: 'Mốc cũ', endsAt: 1000 }
    const first = countdownEvents({ countdown: original })
    expect(first).toEqual([{ id: 'legacy', ...original }])
    const second = saveCountdown(first, { id: 'second', title: 'Mốc hai', endsAt: 2000 }, true)!
    const third = saveCountdown(second, { id: 'third', title: 'Mốc ba', endsAt: 3000 }, true)!
    expect(saveCountdown(third, { id: 'fourth', title: 'Mốc bốn', endsAt: 4000 }, true)).toBeUndefined()
    expect(saveCountdown(third, { id: 'legacy', title: 'Đã sửa', endsAt: 1500 }, false)?.[0]?.title).toBe('Đã sửa')
    expect(saveCountdown(third, { id: 'absent', title: 'Đã xóa', endsAt: 5000 }, false)).toBeUndefined()
    expect(countdownEvents({ countdown: original, countdowns: [] })).toEqual([])
    expect(isSettings({ ...defaults, countdowns: third })).toBe(true)
    expect(isSettings({ ...defaults, countdowns: [...third, ...first] })).toBe(false)
    expect(isSettings({ ...defaults, countdowns: [first[0], first[0]] })).toBe(false)
  })

  it('giữ thời gian còn lại khi tạm dừng và chuyển pha khi hết giờ', () => {
    const running = togglePomodoro(defaultPomodoro, 1000)
    const paused = togglePomodoro(running, 2000)
    expect(pomodoroRemaining(paused, 100_000)).toBe(25 * 60_000 - 1000)
    const resumed = togglePomodoro(paused, 100_000)
    expect(resumed.endsAt).toBe(100_000 + 25 * 60_000 - 1000)
    const expired = resumed.endsAt! + 50
    expect(pomodoroRemaining(resumed, expired)).toBe(0)
    expect(togglePomodoro(resumed, expired)).toMatchObject({ phase: 'break', endsAt: expired + 5 * 60_000 })
  })

  it('hiển thị ngày và làm tròn giây, đồng thời kiểm tra dữ liệu đã lưu', () => {
    expect(timerParts(86_400_001)).toEqual({ days: 1, time: '00:00:01' })
    expect(timerParts(-500)).toEqual({ days: 0, time: '00:00:00' })
    expect(isSettings({ ...defaults, countdown: { title: 'Mốc', endsAt: 2000 } })).toBe(true)
    expect(isSettings({ ...defaults, pomodoro: { ...defaultPomodoro, breakMinutes: 0 } })).toBe(false)
  })
})

it('đọc công tắc hẹn giờ cũ và ưu tiên trạng thái riêng của từng tiện ích', () => {
  const settings = { ...defaults, showTimers: true, widgetVisibility: { countdown: false, weather: false } }
  expect(widgetVisible(settings, 'countdown')).toBe(false)
  expect(widgetVisible(settings, 'pomodoro')).toBe(true)
  expect(widgetVisible(settings, 'weather')).toBe(false)
  expect(widgetVisible(settings, 'clock')).toBe(true)
  expect(widgetVisible(defaults, 'countdown')).toBe(false)
  expect(isSettings({ ...settings, widgetVisibility: { clock: 'false' } })).toBe(false)
})

it('lưu từng chế độ ngày giờ và vẫn đọc cấu hình trước khi có chế độ', () => {
  const { clockDisplay, ...legacy } = defaults
  expect(isSettings(legacy)).toBe(true)
  for (const mode of ['date-time', 'time', 'date'] as const) {
    const settings = { ...legacy, clockDisplay: mode }
    expect(parseBackup(serializeBackup({ settings, notes: [], shortcuts: [] })).settings.clockDisplay).toBe(mode)
  }
  expect(isSettings({ ...legacy, clockDisplay: 'unknown' })).toBe(false)
})
