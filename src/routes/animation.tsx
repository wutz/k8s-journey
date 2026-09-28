import { Link, createFileRoute } from '@tanstack/react-router'
import { findLesson, stages } from '~/content/curriculum'
import { PLAYER, findAnimation, formatDuration, lessonAnimationTotal, posterUrl } from '~/lib/animations'

export const Route = createFileRoute('/animation')({
  head: () => ({
    meta: [
      { title: '动画速览 · K8s Journey' },
      { name: 'description', content: '3 分钟动画，带中文旁白：看 Kubernetes 从第一个 Pod 一路走到生产级集群与 AI 平台；每一课另有一段动画速览。' },
      { property: 'og:title', content: 'K8s Journey · 3 分钟动画速览' },
      { property: 'og:image', content: posterUrl('journey') },
    ],
  }),
  component: AnimationPage,
})

// 动画各章节在时间轴上的位置，与 public/animation/journey/scenes.js 中各场景的时长对应
const chapters = [
  { stage: 0, at: '0:09', topics: '容器与镜像、为什么需要编排、用 kind 搭建本地集群', lessons: ['containers', 'why-kubernetes', 'local-cluster'] },
  { stage: 1, at: '0:34', topics: '声明式 API、Pod、标签与命名空间、Deployment 自愈、Service 负载均衡', lessons: ['kubectl-and-yaml', 'pods', 'labels-namespaces', 'deployments', 'services'] },
  { stage: 2, at: '1:00', topics: '探针与资源、PV / PVC、各类控制器、Ingress、Helm', lessons: ['probes-resources', 'storage-basics', 'statefulsets', 'jobs-daemonsets', 'ingress-gateway', 'helm-kustomize'] },
  { stage: 3, at: '1:26', topics: '一个 Pod 的诞生、CNI 网络模型、认证授权与 RBAC', lessons: ['control-plane', 'networking-model', 'rbac'] },
  { stage: 4, at: '1:52', topics: '高可用规划与 Kubespray、Cilium / MetalLB、Rook-Ceph、故障自愈与可观测性', lessons: ['cluster-planning', 'kubespray', 'production-networking', 'production-storage', 'observability'] },
  { stage: 5, at: '2:20', topics: 'GPU Operator、Kueue / Volcano 批调度、RDMA 分布式训练、大模型推理', lessons: ['gpu-operator', 'batch-scheduling', 'distributed-training', 'llm-inference'] },
]

const keys = [
  ['点击画面 / 空格', '暂停 · 继续'],
  ['← →', '快退 · 快进 5 秒'],
  ['M', '静音'],
  ['V', '开关旁白'],
  ['F', '全屏'],
]

function AnimationPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
      <p className="eyebrow">Animation · 3 分钟速览</p>
      <h1 className="mt-3 text-[40px] font-semibold leading-tight tracking-[-2px]">从第一个 Pod，到生产级集群</h1>
      <p className="mt-3 max-w-2xl text-body">
        开始学习之前，先用 3 分钟看完整条航程：六个阶段各讲什么、会遇到哪些关键概念。含中文旁白、背景音乐与音效，建议佩戴耳机。
      </p>

      <div className="relative mt-10 aspect-video overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[var(--shadow-float)]">
        <iframe
          src={PLAYER}
          title="K8s Journey 动画：从第一个 Pod 到生产级集群"
          allow="autoplay; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-mute">
          {keys.map(([k, v]) => (
            <li key={k}>
              <kbd className="rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-xs text-body">{k}</kbd>{' '}
              {v}
            </li>
          ))}
        </ul>
        <a href={PLAYER} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent hover:text-accent-deep">
          在新窗口中观看 ↗
        </a>
      </div>

      <section className="mt-20">
        <p className="eyebrow">Chapters</p>
        <h2 className="mt-3 text-[32px] font-semibold leading-10 tracking-[-1.28px]">动画里的每一站，对应哪些课</h2>
        <p className="mt-3 max-w-2xl text-body">看完动画后，可以按章节直接进入对应的课文深入学习。</p>
        <ol className="mt-10 divide-y divide-hairline rounded-xl border border-hairline bg-elevated">
          {chapters.map((c) => {
            const s = stages[c.stage]
            return (
              <li key={s.id} className="grid gap-4 p-6 md:grid-cols-[180px_1fr]">
                <div>
                  <span className="font-mono text-sm text-accent">{c.at}</span>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.3px] text-ink">
                    {String(s.index).padStart(2, '0')} {s.name}
                  </p>
                  <p className="text-sm text-mute">{s.tagline}</p>
                </div>
                <div>
                  <p className="text-sm leading-6 text-body">{c.topics}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.lessons.map((slug) => (
                      <Link
                        key={slug}
                        to="/learn/$slug"
                        params={{ slug }}
                        className="rounded-full border border-hairline px-3 py-1 text-xs text-body hover:border-accent hover:text-accent transition-colors"
                      >
                        {findLesson(slug)?.lesson.title ?? slug}
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mt-20">
        <p className="eyebrow">Lessons</p>
        <h2 className="mt-3 text-[32px] font-semibold leading-10 tracking-[-1.28px]">每一课，都有一段动画速览</h2>
        <p className="mt-3 max-w-2xl text-body">
          每段一分半左右，把一课最关键的几个概念画出来讲一遍，共约 {Math.round(lessonAnimationTotal() / 60)} 分钟。动画放在每篇课文的开头，也可以在这里挑着看。
        </p>
        <div className="mt-10 space-y-12">
          {stages.map((s) => (
            <div key={s.id}>
              <p className="text-sm font-medium text-ink">
                <span className="font-mono text-accent">{String(s.index).padStart(2, '0')}</span> {s.name}
                <span className="ml-2 font-normal text-mute">{s.tagline}</span>
              </p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.lessons.map((l) => {
                  const a = findAnimation(l.slug)
                  if (!a) return null
                  return (
                    <li key={l.slug}>
                      <Link
                        to="/learn/$slug"
                        params={{ slug: l.slug }}
                        className="group block overflow-hidden rounded-xl border border-hairline bg-elevated transition-shadow hover:shadow-[var(--shadow-float)]"
                      >
                        <div className="relative aspect-video overflow-hidden border-b border-hairline bg-canvas">
                          <img
                            src={posterUrl(l.slug)}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          <span className="absolute bottom-2 right-2 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
                            {formatDuration(a.duration)}
                          </span>
                        </div>
                        <div className="p-4">
                          <p className="font-medium text-ink group-hover:text-accent transition-colors">{l.title}</p>
                          <p className="mt-1 line-clamp-1 text-sm text-mute">{a.scenes.slice(1, -1).join(' · ')}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
