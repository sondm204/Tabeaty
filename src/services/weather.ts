import type { City } from '../model'
import { inRange, isCity, record } from './validation'

export interface Forecast { date: string; code: number; high: number; low: number; rain: number | null }
export interface Weather {
  temperature: number
  humidity: number
  code: number
  days: Forecast[]
}

export function normalizeWeather(value: unknown): Weather {
  if (!record(value) || !record(value.current) || !record(value.daily)) throw new Error('Dữ liệu thời tiết không hợp lệ.')
  const { temperature_2m: temperature, relative_humidity_2m: humidity, weather_code: code } = value.current
  const { time, weather_code: codes, temperature_2m_max: highs, temperature_2m_min: lows, precipitation_probability_max: rain } = value.daily
  if (!inRange(temperature, -100, 100) || !inRange(humidity, 0, 100) || !inRange(code, 0, 99)
    || !Array.isArray(time) || !Array.isArray(codes) || !Array.isArray(highs) || !Array.isArray(lows)) {
    throw new Error('Dữ liệu thời tiết không hợp lệ.')
  }
  const days: Forecast[] = []
  for (let index = 1; index < Math.min(time.length, 4); index++) {
    const [date, dailyCode, high, low, probability] = [time[index], codes[index], highs[index], lows[index], Array.isArray(rain) ? rain[index] : null]
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))
      || !inRange(dailyCode, 0, 99) || !inRange(high, -100, 100) || !inRange(low, -100, 100)) continue
    days.push({ date, code: dailyCode, high, low, rain: inRange(probability, 0, 100) ? probability : null })
  }
  return { temperature, humidity, code, days }
}

export async function getWeather(city: Pick<City, 'latitude' | 'longitude'>, signal: AbortSignal) {
  const params = new URLSearchParams({
    latitude: String(city.latitude), longitude: String(city.longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto', forecast_days: '4',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!response.ok) throw new Error('Dịch vụ thời tiết tạm thời gián đoạn.')
  return normalizeWeather(await response.json())
}

export async function searchCities(query: string, signal: AbortSignal): Promise<City[]> {
  const params = new URLSearchParams({ name: query, count: '8', language: 'vi', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!response.ok) throw new Error('Không thể tìm thành phố lúc này.')
  const value: unknown = await response.json()
  if (!record(value) || !Array.isArray(value.results)) return []
  return value.results.flatMap((item: unknown) => {
    if (!record(item)) return []
    const city = { name: item.name, country: item.country ?? '', latitude: item.latitude, longitude: item.longitude }
    return isCity(city) ? [city] : []
  })
}
