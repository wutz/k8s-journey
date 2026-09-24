import { Link, createFileRoute } from '@tanstack/react-router'
import { allLessons, stages, totalMinutes } from '~/content/curriculum'

export const Route = createFileRoute('/')({
  component: Home,
})

const terminal = [
  { p: '$', t: 'kind create cluster --name journey --config kind.yaml' },
  { p: ' ', t: '✓ Ensuring node image (kindest/node) 🖼', m: true },
  { p: ' ', t: '✓ Starting control-plane 🕹️', m: true },
  { p: '$', t: 'kubectl create deployment web --image=nginx --replicas=3' },
  { p: ' ', t: 'deployment.apps/web created', m: true },
  { p: '$', t: 'kubectl get pods -o wide' },
  { p: ' ', t: 'NAME                   READY   STATUS    NODE', m: true },
  { p: ' ', t: 'web-7d4b9c6f5d-8xk2p   1/1     Running   journey-worker', m: true },
  { p: ' ', t: 'web-7d4b9c6f5d-q9zlm   1/1     Running   journey-worker2', m: true },
  { p: ' ', t: 'web-7d4b9c6f5d-tn4rw   1/1     Running   journey-worker', m: true },
]

const method = [
  {
    k: '01',
    title: '先问为什么',
    body: '每个对象都从它要解决的问题讲起，再讲它是什么、怎么用。理解动机，才记得住设计。',
  },
  {
    k: '02',
    title: '每课都能动手',
    body: '所有入门与进阶示例都能在本地 kind 集群里跑通，复制命令即可实验，配有练习和自测。',
  },
  {
    k: '03',
    title: '对齐生产实践',
    body: '生产与专家阶段取材于真实的 GPU / AI 集群建设经验：Kubespray、Cilium、Rook-Ceph、GPU Operator。',
  },
]

function Home() {
  const hours = Math.round(totalMinutes / 60)
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="mesh pointer-events-none absolute inset-0 -z-10" />
        <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div>
            <p className="eyebrow">Kubernetes · 中文教程 · 从零到专业</p>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-2px] text-ink sm:text-[56px] sm:tracking-[-2.8px]">
              从第一个 Pod，
              <br />
              到生产级集群。
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-body">
              一条循序渐进的 Kubernetes 学习路线。从容器原理讲起，逐步深入核心对象、内部机制、生产部署运维，直到
              GPU 与大模型平台。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/learn/$slug"
                params={{ slug: 'welcome' }}
                className="inline-flex h-11 items-center rounded-full bg-ink px-6 font-medium text-white hover:bg-[#383838] transition-colors"
              >
                从第一课开始
              </Link>
              <Link
                to="/learn"
                className="inline-flex h-11 items-center rounded-full border border-hairline bg-elevated px-6 font-medium text-ink hover:border-[#d4d4d4] transition-colors"
              >
                查看学习路线
              </Link>
              <Link
                to="/animation"
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium text-accent hover:text-accent-deep transition-colors"
              >
                <PlayIcon className="size-4" />
                看 3 分钟动画
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
              {[
                [String(stages.length), '个阶段'],
                [String(allLessons.length), '篇课文'],
                [`~${hours}`, '小时学习'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-3xl font-semibold tracking-[-1.2px] text-ink">{v}</dt>
                  <dd className="mt-1 text-sm text-mute">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-hairline bg-elevated shadow-[var(--shadow-float)]">
            <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3">
              <span className="size-2.5 rounded-full bg-[#ebebeb]" />
              <span className="size-2.5 rounded-full bg-[#ebebeb]" />
              <span className="size-2.5 rounded-full bg-[#ebebeb]" />
              <span className="ml-3 font-mono text-xs text-mute">~/k8s-journey — zsh</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6">
              {terminal.map((l, i) => (
                <div key={i} className={l.m ? 'text-mute' : 'text-ink'}>
                  <span className="mr-2 select-none text-accent">{l.p}</span>
                  {l.t}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </section>

      {/* Animation teaser */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[5fr_7fr]">
          <div>
            <p className="eyebrow">Animation</p>
            <h2 className="mt-3 text-[32px] font-semibold leading-10 tracking-[-1.28px]">先用 3 分钟，看完整条航程</h2>
            <p className="mt-3 text-body">
              一部带中文旁白的动画：从一个容器、一个 Pod 讲起，看它们如何自愈、扩容、上线到生产集群，最后调度 GPU
              跑起大模型。六个阶段，一眼看清要去哪里。
            </p>
            <Link
              to="/animation"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 font-medium text-white hover:bg-[#383838] transition-colors"
            >
              <PlayIcon className="size-4" />
              播放动画
            </Link>
          </div>
          <Link
            to="/animation"
            aria-label="播放 K8s Journey 动画"
            className="group relative block aspect-video overflow-hidden rounded-2xl border border-hairline bg-[#05070c] shadow-[var(--shadow-float)]"
          >
            <img
              src="/animation/poster.jpg"
              alt="动画封面：从第一个 Pod 到生产级集群"
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <span className="absolute bottom-3 left-3 inline-flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-ink shadow-lg transition-transform group-hover:scale-105">
              <PlayIcon className="size-3.5" />
              播放
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-xs text-white">
              3:01
            </span>
          </Link>
        </div>
      </section>

      {/* Stages */}
      <section className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
        <p className="eyebrow">Roadmap</p>
        <h2 className="mt-3 text-[32px] font-semibold leading-10 tracking-[-1.28px]">六个阶段，逐级攀升</h2>
        <p className="mt-3 max-w-2xl text-body">
          每个阶段都有明确的目标。学完一个阶段，你就能独立完成这一层级的工作，再向上一级。
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((s) => (
            <Link
              key={s.id}
              to="/learn/$slug"
              params={{ slug: s.lessons[0].slug }}
              className="group flex flex-col rounded-xl border border-hairline bg-elevated p-6 transition-shadow hover:shadow-[var(--shadow-float)]"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">
                  Stage {String(s.index).padStart(2, '0')} · {s.level}
                </span>
                <span className="font-mono text-xs text-faint">{s.lessons.length} 课</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.4px] text-ink">
                {s.name}
                <span className="font-normal text-mute"> · {s.tagline}</span>
              </h3>
              <p className="mt-2 text-sm leading-6 text-body">{s.goal}</p>
              <ul className="mt-5 space-y-1.5 border-t border-hairline pt-4 text-sm text-mute">
                {s.lessons.slice(0, 4).map((l) => (
                  <li key={l.slug} className="truncate">
                    {l.title}
                  </li>
                ))}
                {s.lessons.length > 4 && <li className="text-faint">…还有 {s.lessons.length - 4} 课</li>}
              </ul>
              <span className="mt-5 text-sm font-medium text-accent group-hover:text-accent-deep">
                进入本阶段 →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Method */}
      <section className="border-y border-hairline bg-elevated">
        <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-[32px] font-semibold leading-10 tracking-[-1.28px]">这样学，更扎实</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {method.map((m) => (
              <div key={m.k} className="rounded-xl border border-hairline bg-canvas p-6">
                <span className="font-mono text-sm text-accent">{m.k}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-[-0.3px]">{m.title}</h3>
                <p className="mt-2 text-sm leading-6 text-body">{m.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <a
              href="https://kubernetes.io/zh-cn/docs/home/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-hairline p-6 hover:shadow-[var(--shadow-float)] transition-shadow"
            >
              <p className="eyebrow">Reference 01</p>
              <p className="mt-2 font-semibold">Kubernetes 官方文档</p>
              <p className="mt-1 text-sm text-body">概念与 API 以官方文档为准，每课末尾都附有对应的官方章节链接。</p>
            </a>
            <div className="rounded-xl border border-hairline p-6">
              <p className="eyebrow">Reference 02</p>
              <p className="mt-2 font-semibold">k8s-in-action 生产实践手册</p>
              <p className="mt-1 text-sm text-body">
                一线 GPU / AI 集群的部署手册：集群规划、Kubespray、网络、存储、可观测性与 AI 负载。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 py-24 text-center sm:px-6">
        <h2 className="text-[36px] font-semibold leading-tight tracking-[-1.6px] sm:text-[48px] sm:tracking-[-2.4px]">
          准备好出发了吗？
        </h2>
        <p className="mx-auto mt-4 max-w-md text-body">只需要一台电脑和一个终端。第一课 10 分钟，带你看清整条路线。</p>
        <Link
          to="/learn/$slug"
          params={{ slug: 'welcome' }}
          className="mt-8 inline-flex h-11 items-center rounded-full bg-ink px-6 font-medium text-white hover:bg-[#383838] transition-colors"
        >
          开始学习
        </Link>
      </section>
    </main>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.2-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}
