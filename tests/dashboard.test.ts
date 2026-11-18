import { describe, expect, it } from 'vitest'
import { createNote, defaults, noteRect } from '../src/model'
import { arrangeNotes } from '../src/note-grid'
import { parseRichText, richTextFromPlain, serializeRichText } from '../src/rich-text'
import { parseBackup, serializeBackup } from '../src/services/backup'
import { isSettings } from '../src/services/validation'
import { defaultPomodoro, pomodoroRemaining, timerParts, togglePomodoro } from '../src/timers'

const note = (id: string, createdAt: number) => ({
  ...createNote({ ...defaults, width: 200, height: 150 }, { x: 0, y: 0 }, 1), id, createdAt,
})

describe('Xếp ghi chú theo lưới', () => {
  it('giữ chỗ của ghi chú khóa và xếp các ghi chú còn lại theo thứ tự tạo', () => {
    const area = { width: 500, height: 400 }
    const first = note('first', 1)
    const second = note('second', 2)
    const locked = { ...note('locked', 3), locked: true }
    const layout = arrangeNotes([second, locked, first], area)
    expect(layout?.has('locked')).toBe(false)
    expect(noteRect({ ...first, ...layout?.get('first') }, area)).toMatchObject({ x: 224, y: 0 })
    expect(noteRect({ ...second, ...layout?.get('second') }, area)).toMatchObject({ x: 0, y: 176 })
  })

  it('không tạo phương án xếp chồng lên nhau nếu vùng làm việc quá nhỏ', () => {
    expect(arrangeNotes([note('left', 1), note('right', 2)], { width: 390, height: 150 })).toBeUndefined()
  })
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
