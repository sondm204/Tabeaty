import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNote, defaults, defaultShortcuts } from '../src/model'
import { parseBackup, serializeBackup } from '../src/services/backup'
import { itemBytes } from '../src/services/storage'
import { isSettings, normalizeUrl } from '../src/services/validation'
import { createRotation, ROTATION_INTERVAL } from '../src/services/wallpaper'
import { getWeather, normalizeWeather, searchCities } from '../src/services/weather'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Lối tắt', () => {
  it('chuẩn hóa HTTPS, HTTP và địa chỉ có cổng', () => {
    expect(normalizeUrl(' example.org/path ')).toBe('https://example.org/path')
    expect(normalizeUrl('http://localhost:5600')).toBe('http://localhost:5600/')
    expect(normalizeUrl('example.org:8443')).toBe('https://example.org:8443/')
  })
  it.each(['javascript:alert(1)', 'javascript:80', 'data:text/html,X', 'file:///tmp/x', 'https://user:pass@example.org/', '//example.org', 'https://a\\b'])('từ chối địa chỉ %s', (input) => {
    expect(() => normalizeUrl(input)).toThrow()
  })
})

describe('Sao lưu', () => {
  const note = { ...createNote(defaults, { x: .2, y: .4 }, 1), title: 'Tiếng Việt', content: 'Một dòng\nMột 🌃' }
  const backup = { notes: [note], settings: defaults, shortcuts: defaultShortcuts }

  it('khôi phục đầy đủ dữ liệu và tính byte UTF-8 thay vì số ký tự', () => {
    const json = serializeBackup(backup)
    expect(parseBackup(json)).toEqual(backup)
    expect(itemBytes('x', 'ế🌱')).toBe(10)
    expect(itemBytes('x', 'ế🌱')).toBeGreaterThan('x"ế🌱"'.length)
  })
  it('đọc bản sao lưu cũ và kiểm tra giao diện tiện ích mới', () => {
    const { clockAppearance, weatherAppearance, ...legacySettings } = defaults
    expect(parseBackup(serializeBackup({ ...backup, settings: legacySettings })).settings).toEqual(legacySettings)
    const settings = {
      ...defaults,
      clockAppearance: { ...clockAppearance!, x: .25, y: .75, color: '#ff0000', scale: 120 },
      weatherAppearance: { ...weatherAppearance!, opacity: 15 },
    }
    expect(parseBackup(serializeBackup({ ...backup, settings })).settings).toEqual(settings)
    expect(isSettings({ ...settings, clockAppearance: { ...settings.clockAppearance, x: 1.1 } })).toBe(false)
    expect(isSettings({ ...settings, weatherAppearance: { ...settings.weatherAppearance, opacity: -1 } })).toBe(false)
  })

  it('từ chối bản sao lưu hỏng, mục trùng, lưu ngoài viewport hoặc URL không an toàn', () => {
    expect(() => parseBackup('{')).toThrow(SyntaxError)
    expect(() => parseBackup(serializeBackup({ ...backup, notes: [note, note] }))).toThrow('trùng')
    expect(() => parseBackup(serializeBackup({ ...backup, notes: [{ ...note, x: 4 }] }))).toThrow('định dạng')
    const badLink = { id: 'test', url: 'javascript:alert(1)', label: 'x' }
    expect(() => parseBackup(serializeBackup({ ...backup, shortcuts: [badLink] }))).toThrow('định dạng')
  })
})

describe('Open-Meteo', () => {
  const response = {
    current: { temperature_2m: 23.2, relative_humidity_2m: 84, weather_code: 61 },
    daily: {
      time: ['2026-11-18', '2026-11-19', '2026-11-20'], weather_code: [61, 0, 3],
      temperature_2m_max: [25, 29, 25], temperature_2m_min: [16, 19, 17], precipitation_probability_max: [60, 0, null],
    },
  }

  it('chuẩn hóa thời tiết hiện tại và dự báo những ngày tiếp theo', async () => {
    const fetchMock = vi.fn(async () => Response.json(response))
    vi.stubGlobal('fetch', fetchMock)
    const weather = await getWeather(defaults.city, new AbortController().signal)
    expect(weather).toEqual({
      temperature: 23.2, humidity: 84, code: 61,
      days: [{ date: '2026-11-19', code: 0, high: 29, low: 19, rain: 0 }, { date: '2026-11-20', code: 3, high: 25, low: 17, rain: null }],
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('forecast_days=4'), expect.any(Object))
    expect(() => normalizeWeather({ current: {}, daily: {} })).toThrow()
  })

  it('trả về lỗi hợp lệ khi máy chủ tạm ngưng và bỏ qua kết quả thành phố hỏng', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ results: [{ name: 'Sai' }, { name: 'Tokyo', country: 'Nhật Bản', latitude: 35.6, longitude: 139.6 }] }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    await expect(getWeather(defaults.city, signal)).rejects.toThrow('gián đoạn')
    expect(await searchCities('Tokyo', signal)).toEqual([{ name: 'Tokyo', country: 'Nhật Bản', latitude: 35.6, longitude: 139.6 }])
  })
})

describe('Lịch đổi hình nền', () => {
  it('tự đổi sau năm phút và khởi động lại lịch sau khi bấm đổi ảnh', async () => {
    vi.useFakeTimers()
    const load = vi.fn(async () => {})
    const rotation = createRotation(load)
    await rotation.rotate()
    await vi.advanceTimersByTimeAsync(ROTATION_INTERVAL - 1)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(ROTATION_INTERVAL / 2)
    await rotation.rotate()
    await vi.advanceTimersByTimeAsync(ROTATION_INTERVAL - 1)
    expect(load).toHaveBeenCalledTimes(3)
    rotation.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('khi quay lại tab quá hạn, chỉ có một yêu cầu và dừng thì hủy yêu cầu', async () => {
    vi.useFakeTimers()
    const load = vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValueOnce(undefined)
      .mockImplementation((signal) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })))
    const rotation = createRotation(load)
    await rotation.rotate()
    vi.setSystemTime(Date.now() + ROTATION_INTERVAL + 20)
    const request = rotation.resume()
    await rotation.rotate()
    await rotation.resume()
    expect(load).toHaveBeenCalledTimes(2)
    rotation.stop()
    await request
    expect(load.mock.calls[1]?.[0].aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
