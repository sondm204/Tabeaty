export interface Countdown {
  title: string
  endsAt: number
}

export interface Pomodoro {
  focusMinutes: number
  breakMinutes: number
  phase: 'focus' | 'break'
  endsAt: number | null
  pausedMs: number | null
}

export const defaultPomodoro: Pomodoro = {
  focusMinutes: 25, breakMinutes: 5, phase: 'focus', endsAt: null, pausedMs: null,
}

export function pomodoroRemaining(timer: Pomodoro, now: number) {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now)
  if (timer.pausedMs !== null) return timer.pausedMs
  return (timer.phase === 'focus' ? timer.focusMinutes : timer.breakMinutes) * 60_000
}

export function resetPomodoro(timer: Pomodoro): Pomodoro {
  return { ...timer, endsAt: null, pausedMs: null }
}

export function nextPomodoro(timer: Pomodoro): Pomodoro {
  return { ...resetPomodoro(timer), phase: timer.phase === 'focus' ? 'break' : 'focus' }
}

export function togglePomodoro(timer: Pomodoro, now: number): Pomodoro {
  const remaining = pomodoroRemaining(timer, now)
  if (timer.endsAt === null) return { ...timer, endsAt: now + remaining, pausedMs: null }
  if (remaining > 0) return { ...timer, endsAt: null, pausedMs: remaining }
  const next = nextPomodoro(timer)
  return { ...next, endsAt: now + pomodoroRemaining(next, now) }
}

export function timerParts(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const days = Math.floor(seconds / 86400)
  const time = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
  return { days, time: time.map((digit) => String(digit).padStart(2, '0')).join(':') }
}
