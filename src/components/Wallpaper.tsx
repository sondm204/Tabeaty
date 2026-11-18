import { memo, useEffect, useRef, useState } from 'react'
import type { Settings } from '../model'
import { createRotation, preloadWallpaper } from '../services/wallpaper'

export function useWallpaper() {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const controller = useRef<ReturnType<typeof createRotation>>(null)

  useEffect(() => {
    const rotation = createRotation(async (signal) => {
      const width = window.innerWidth > 1920 ? 2560 : 1920
      const height = Math.round(width * 9 / 16)
      const url = `https://picsum.photos/${width}/${height}?random=${crypto.randomUUID()}`
      setLoading(true)
      setFailed(false)
      try {
        await preloadWallpaper(url, signal)
        if (!signal.aborted) setImages((current) => [...current.slice(-1), url])
      } catch {
        if (!signal.aborted) setFailed(true)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    })
    controller.current = rotation
    const visible = () => { if (!document.hidden) void rotation.resume() }
    document.addEventListener('visibilitychange', visible)
    void rotation.rotate()
    return () => {
      document.removeEventListener('visibilitychange', visible)
      rotation.stop()
    }
  }, [])

  return { images, loading, failed, refresh: () => { void controller.current?.rotate() } }
}

export const Wallpaper = memo(function Wallpaper({ images, overlay, blur, animate }: {
  images: string[]
} & Pick<Settings, 'overlay' | 'blur' | 'animate'>) {
  return (
    <div className="wallpaper" aria-hidden="true">
      <div className="wallpaper-images" style={{ filter: blur ? `blur(${blur}px)` : undefined, inset: -blur * 2 }}>
        {images.map((url, index) => (
          <img key={url} src={url} alt="" className={animate && index === images.length - 1 ? 'wallpaper-in' : ''} />
        ))}
      </div>
      <div className="wallpaper-tint" style={{ backgroundColor: `rgb(7 20 17 / ${overlay}%)` }} />
    </div>
  )
})
