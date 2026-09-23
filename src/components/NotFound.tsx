import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
      <p className="eyebrow">404 · NotFound</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-1.2px]">这个 Pod 被调度到了不存在的节点</h1>
      <p className="mt-3 text-body">页面不存在，可能是链接写错了，或者课程已经调整。</p>
      <Link
        to="/learn"
        className="mt-8 inline-flex h-10 items-center rounded-full bg-ink px-5 font-medium text-white"
      >
        回到学习路线
      </Link>
    </div>
  )
}
