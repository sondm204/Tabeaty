import { useEffect, useRef, useState } from 'react'
import type { City } from './model'
import { getWeather } from './services/weather'
import type { Weather } from './services/weather'

const WEATHER_INTERVAL = 30 * 60_000
const RETRY_INTERVAL = 60_000

export function useWeather(city: City, enabled: boolean) {
  const [data, setData] = useState<{ location: string; weather?: Weather; failed: boolean }>()
  const refresh = useRef<() => void>(null)
  const { latitude, longitude } = city
  const location = `${latitude},${longitude}`

  useEffect(() => {
    if (!enabled) return
    let deadline = 0
    let failures = 0
    let active: AbortController | undefined
    let timer: ReturnType<typeof setTimeout>
    let stopped = false

    async function load() {
      if (active || stopped) return
      clearTimeout(timer)
      const request = new AbortController()
      active = request
      const timeout = setTimeout(() => request.abort(), 12_000)
      setData((last) => last?.location === location ? { ...last, failed: false } : undefined)
      try {
        const weather = await getWeather({ latitude, longitude }, request.signal)
        if (stopped) return
        failures = 0
        setData({ location, weather, failed: false })
      } catch {
        if (stopped) return
        failures++
        setData((last) => ({
          location, weather: last?.location === location ? last.weather : undefined, failed: true,
        }))
      } finally {
        clearTimeout(timeout)
        active = undefined
        if (!stopped) {
          const delay = failures ? Math.min(WEATHER_INTERVAL, RETRY_INTERVAL * 2 ** Math.min(failures - 1, 5)) : WEATHER_INTERVAL
          deadline = Date.now() + delay
          timer = setTimeout(() => { void load() }, delay)
        }
      }
    }

    const reload = () => { void load() }
    const wake = () => { if (!document.hidden && Date.now() >= deadline) reload() }
    refresh.current = reload
    reload()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', reload)
    return () => {
      stopped = true
      refresh.current = null
      active?.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', reload)
    }
  }, [enabled, latitude, longitude, location])

  const shown = data?.location === location ? data : undefined
  return { weather: shown?.weather, failed: shown?.failed ?? false, retry: () => refresh.current?.() }
}
