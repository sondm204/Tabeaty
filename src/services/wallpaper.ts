export const ROTATION_INTERVAL = 5 * 60 * 1000

export function createRotation(load: (signal: AbortSignal) => Promise<void>, interval = ROTATION_INTERVAL) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: AbortController | undefined
  let deadline = 0
  let stopped = false

  const rotate = async () => {
    if (stopped || active) return
    clearTimeout(timer)
    const request = new AbortController()
    active = request
    deadline = Date.now() + interval
    try {
      await load(request.signal)
    } finally {
      active = undefined
      if (!stopped) timer = setTimeout(() => { void rotate() }, Math.max(0, deadline - Date.now()))
    }
  }

  return {
    rotate,
    resume() {
      if (Date.now() >= deadline) return rotate()
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      active?.abort()
    },
  }
}

export function preloadWallpaper(url: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    const stop = () => finish(new Error('Tải hình nền bị gián đoạn.'))
    const timer = setTimeout(stop, 15_000)
    function finish(error?: Error) {
      clearTimeout(timer)
      signal.removeEventListener('abort', stop)
      image.onload = null
      image.onerror = null
      if (error) {
        image.removeAttribute('src')
        reject(error)
      } else resolve()
    }
    image.onload = () => { void image.decode().then(() => finish(), stop) }
    image.onerror = stop
    if (signal.aborted) return stop()
    signal.addEventListener('abort', stop, { once: true })
    image.src = url
  })
}
