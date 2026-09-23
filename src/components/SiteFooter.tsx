import { Link } from '@tanstack/react-router'
import { stages } from '~/content/curriculum'
import { Logo } from './Logo'

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_2fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm leading-6 text-mute">
            从容器基础到生产集群与 AI 平台，一条循序渐进的 Kubernetes 学习路线。内容参考 Kubernetes
            官方文档与一线生产实践。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {stages.map((s) => (
            <div key={s.id} className="space-y-2">
              <p className="eyebrow">Stage {String(s.index).padStart(2, '0')}</p>
              <Link
                to="/learn/$slug"
                params={{ slug: s.lessons[0].slug }}
                className="block text-sm text-body hover:text-ink"
              >
                {s.name} · {s.tagline}
              </Link>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-hairline">
        <p className="mx-auto max-w-[1400px] px-4 py-5 text-xs text-faint sm:px-6">
          Kubernetes® 是 The Linux Foundation 的注册商标。本站为独立学习资料，与 CNCF 无隶属关系。
        </p>
      </div>
    </footer>
  )
}
