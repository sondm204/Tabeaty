import { memo, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets,
  GitFork, Globe2, Mail, Plus, Search, Sun, SquarePlay,
} from 'lucide-react'
import { defaultClockAppearance, defaultWeatherAppearance, widgetVisible } from '../model'
import type { City, ClockDisplay, Settings, Shortcut, WidgetId } from '../model'
import type { Weather } from '../services/weather'
import { useWeather } from '../use-weather'
import { EditableWidget } from './EditableWidget'

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' })
const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const forecastDay = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' })

export const DashboardWidgets = memo(function DashboardWidgets({ settings, ready, editCity, editing, update, setVisibility }: {
  settings: Settings; ready: boolean; editCity: () => void; editing: boolean; update: (patch: Partial<Settings>) => void
  setVisibility: (widget: WidgetId, visible: boolean) => void
}) {
  const clock = settings.clockAppearance ?? defaultClockAppearance
  const weather = settings.weatherAppearance ?? defaultWeatherAppearance
  const showWeather = ready && widgetVisible(settings, 'weather')
  const forecast = useWeather(settings.city, showWeather)
  const weatherStyle = {
    '--weather-background': weather.backgroundColor,
    '--weather-opacity': `${weather.opacity}%`,
  } as CSSProperties
  return <div className={`widgets${editing ? ' widgets-editing' : ''}`}>
    {widgetVisible(settings, 'clock') && <EditableWidget label="ngày giờ" appearance={clock} editing={editing}
      hide={() => setVisibility('clock', false)}
      update={(patch) => update({ clockAppearance: { ...clock, ...patch } })}><Clock display={settings.clockDisplay ?? 'date-time'} /></EditableWidget>}
    {showWeather && <EditableWidget label="thời tiết" appearance={weather} editing={editing} style={weatherStyle}
      hide={() => setVisibility('weather', false)}
      update={(patch) => update({ weatherAppearance: { ...weather, ...patch } })}>
      <WeatherWidget city={settings.city} editCity={editCity} {...forecast} />
    </EditableWidget>}
  </div>
})

function Clock({ display }: { display: ClockDisplay }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function tick() {
      clearTimeout(timer)
      const timestamp = Date.now()
      setNow(new Date(timestamp))
      timer = setTimeout(tick, 60_000 - timestamp % 60_000)
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return <section className={`clock clock--${display}`} aria-label="Ngày giờ địa phương">
    {display !== 'time' && <p className="clock-date"><span>{dayFormat.format(now)}</span><span className="date-dot" />{dateFormat.format(now)}</p>}
    {display !== 'date' && <time dateTime={now.toISOString()}>{timeFormat.format(now)}</time>}
  </section>
}

function condition(code: number) {
  if (code === 0) return { Icon: Sun, label: 'Trời quang' }
  if (code === 1 || code === 2) return { Icon: CloudSun, label: code === 1 ? 'Ít mây' : 'Mây rải rác' }
  if (code === 3) return { Icon: Cloud, label: 'Nhiều mây' }
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Sương mù' }
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: code >= 56 ? 'Mưa phùn đóng băng' : 'Mưa phùn' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { Icon: CloudRain, label: code === 66 || code === 67 ? 'Mưa đóng băng' : code >= 80 ? 'Mưa rào' : 'Có mưa' }
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { Icon: CloudSnow, label: 'Có tuyết' }
  if (code >= 95 && code <= 99) return { Icon: CloudLightning, label: 'Dông' }
  return { Icon: Cloud, label: 'Chưa rõ' }
}

function WeatherWidget({ city, editCity, weather: current, failed, retry }: {
  city: City; editCity: () => void; weather?: Weather; failed: boolean; retry: () => void
}) {
  const { Icon, label } = current ? condition(current.code) : { Icon: Cloud, label: failed ? 'Chưa có dữ liệu' : 'Đang tải thời tiết…' }
  return <section className="weather glass" aria-label="Thời tiết">
    <div className="weather-heading">
      <button type="button" onClick={editCity} title="Đổi thành phố">{city.name}</button>
      <Icon size={28} strokeWidth={1.5} aria-label={label} />
    </div>
    <div className="weather-main">
      {current && <span className="temperature">{Math.round(current.temperature)}°<small>C</small></span>}
      <span className="weather-label">{label}</span>
      {failed && <button type="button" className="weather-retry" onClick={retry}>Tải lại thời tiết</button>}
    </div>
    {current && <>
      <div className="humidity"><Droplets size={14} /> Độ ẩm {Math.round(current.humidity)}%</div>
      {current.days.length > 0 && <div className="forecast">
        {current.days.map((day) => {
          const info = condition(day.code)
          return <div className="forecast-day" key={day.date} title={`${info.label}${day.rain === null ? '' : ` · Mưa ${day.rain}%`}`}>
            <span>{forecastDay.format(new Date(day.date))}</span>
            <info.Icon size={17} strokeWidth={1.6} aria-label={info.label} />
            <span>{Math.round(day.high)}° <small>{Math.round(day.low)}°</small></span>
          </div>
        })}
      </div>}
    </>}
    <div className="attribution">
      {failed && current && <span>Dữ liệu lần tải trước · </span>}
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
    </div>
  </section>
}

const fallbackIcons = { google: Search, youtube: SquarePlay, github: GitFork, gmail: Mail }

function ShortcutIcon({ shortcut }: { shortcut: Shortcut }) {
  const [bad, setBad] = useState(false)
  const url = new URL(shortcut.url)
  const Icon = fallbackIcons[shortcut.id as keyof typeof fallbackIcons] ?? Globe2
  if (bad || url.protocol !== 'https:') return <Icon size={20} strokeWidth={1.7} />
  return <img src={`${url.origin}/favicon.ico`} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} />
}

export const ShortcutDock = memo(function ShortcutDock({ shortcuts, edit }: { shortcuts: Shortcut[]; edit: () => void }) {
  return <nav className="dock" aria-label="Lối tắt">
    <div className="dock-list glass">
      {shortcuts.map((shortcut) => <a className="shortcut" href={shortcut.url} key={shortcut.id} rel="noopener noreferrer" title={shortcut.label || new URL(shortcut.url).hostname}>
        <div className="shortcut-icon"><ShortcutIcon key={shortcut.url} shortcut={shortcut} /></div>
        <span>{shortcut.label || new URL(shortcut.url).hostname}</span>
      </a>)}
      <button type="button" className="shortcut dock-add" onClick={edit} title="Quản lý lối tắt">
        <span className="shortcut-icon"><Plus size={20} /></span><span>Lối tắt</span>
      </button>
    </div>
  </nav>
})
