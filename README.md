# K8s Journey

面向新手、从零到生产级的 Kubernetes 中文学习路线。6 个阶段、37 课，从容器基础一路讲到生产集群运维与 GPU/AI 平台。

| 阶段 | 主题 | 目标 |
|---|---|---|
| 00 启程 | 容器、为什么需要 K8s、本地集群 | 在自己电脑上跑起第一个集群 |
| 01 入门 | kubectl、Pod、Deployment、Service、配置 | 声明式部署一个无状态 Web 应用 |
| 02 进阶 | 探针与资源、存储、StatefulSet、Ingress、调度、Helm | 让真实应用可靠地跑起来 |
| 03 原理 | 控制平面、网络、RBAC、安全、扩缩容、CRD | 理解内部机制，能解释"为什么" |
| 04 生产 | 集群规划、Kubespray、Cilium、Rook-Ceph、可观测性、Day-2 | 部署和长期运维高可用集群 |
| 05 专家 | GPU Operator、批调度、分布式训练、大模型推理、多租户 | 建设 AI 与平台级能力 |

## 技术栈

- [TanStack Start](https://tanstack.com/start)（React 19 + TanStack Router），全部页面构建时预渲染
- Tailwind CSS v4，设计规范见 [DESIGN.md](./DESIGN.md)（Geist 体系 + Kubernetes Blue `#326ce5`）
- 课文为 Markdown，服务端用 `marked` + `highlight.js` 渲染
- 部署到 Cloudflare Workers（`@cloudflare/vite-plugin`）

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build        # 产物在 dist/
pnpm preview      # 用 workerd 本地预览构建产物
```

## 部署

```bash
pnpm wrangler login
pnpm run deploy
```

`wrangler.jsonc` 已开启 `workers_dev` 与 `preview_urls`，部署后可通过 `*.workers.dev` 访问，每个版本也有独立预览地址。

## 写课文

- 大纲与元数据：`src/content/curriculum.ts`
- 正文：`src/content/lessons/<stage-id>/<slug>.md`
- 写作规范、提示框语法与内容来源要求见 [CONTENT_GUIDE.md](./CONTENT_GUIDE.md)

## 说明

Kubernetes® 是 The Linux Foundation 的注册商标。本项目为社区学习资料，与 CNCF 无隶属关系。
