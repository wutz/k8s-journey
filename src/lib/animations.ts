import { useEffect, useState } from 'react'
// 动画清单由 scripts/animation/gen_vo.mjs 生成：哪些课有动画、各自时长与场景
import manifest from '~/content/animations.gen.json'

export type AnimationInfo = { duration: number; scenes: string[]; title?: string }

const animations = manifest as Record<string, AnimationInfo>

// 播放器是 public/animation/player.html 中的独立页面（Canvas + Web Audio），站点里用 iframe 嵌入
export const PLAYER = '/animation/player.html'

export const findAnimation = (id: string): AnimationInfo | undefined => animations[id]

export const playerUrl = (id: string, autoplay = false) =>
  id === 'journey' && !autoplay ? PLAYER : `${PLAYER}?id=${id}${autoplay ? '&autoplay=1' : ''}`

export const posterUrl = (id: string) => `/animation/${id}/poster.jpg`

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`

export const lessonAnimationTotal = () =>
  Object.entries(animations).reduce((n, [id, a]) => (id === 'journey' ? n : n + a.duration), 0)

// 播放器连播切换到另一部时会向父页面发 {type:'k8s-anim', id}
export function onPlayerSwitch(cb: (id: string) => void) {
  const h = (e: MessageEvent) => {
    if (e.origin === location.origin && e.data?.type === 'k8s-anim' && typeof e.data.id === 'string') cb(e.data.id)
  }
  window.addEventListener('message', h)
  return () => window.removeEventListener('message', h)
}

// iPhone Safari 等不支持 Fullscreen API 时，播放器会发 {type:'k8s-anim-fs', on} 请求父页面把画框铺满视口（网页全屏）
export function usePlayerPseudoFullscreen() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'k8s-anim-fs') setOn(!!e.data.on)
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])
  useEffect(() => {
    if (!on) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [on])
  return on
}

// 网页全屏时画框的样式：固定铺满视口（含刘海安全区），盖住导航栏
export const pseudoFullscreenClass = 'fixed inset-0 z-[100] !mt-0 !aspect-auto !rounded-none !border-0 h-dvh w-screen'
