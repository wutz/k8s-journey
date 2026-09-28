import { useState } from 'react'
import { findAnimation, formatDuration, playerUrl, posterUrl } from '~/lib/animations'

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.2-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

// 课文顶部的动画速览：先只显示封面，点击后才加载播放器（旁白音频较大，不在打开课文时下载）
export function LessonAnimation({ slug, title }: { slug: string; title: string }) {
  const anim = findAnimation(slug)
  const [open, setOpen] = useState(false)
  if (!anim) return null
  const duration = formatDuration(anim.duration)

  return (
    <section aria-label="动画速览" className="mt-8 max-w-[72ch]">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-hairline bg-canvas shadow-[var(--shadow-float)]">
        {open ? (
          <iframe
            src={playerUrl(slug, true)}
            title={`${title} · 动画速览`}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`播放动画速览：${title}（${duration}）`}
            className="group absolute inset-0 block size-full cursor-pointer"
          >
            <img
              src={posterUrl(slug)}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <span className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-transform group-hover:scale-105">
              <PlayIcon className="ml-1 size-6" />
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink/80 px-2 py-0.5 font-mono text-xs text-white">
              {duration}
            </span>
          </button>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-sm text-mute">
        <span>
          <span className="font-medium text-body">动画速览</span> · {duration} · {anim.scenes.length - 2} 个要点 · 含中文旁白
        </span>
        <a
          href={playerUrl(slug)}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent hover:text-accent-deep"
        >
          在新窗口中观看 ↗
        </a>
      </div>
    </section>
  )
}
