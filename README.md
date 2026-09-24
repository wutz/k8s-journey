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

## 动画速览

`/animation` 页面嵌入了一部约 3 分钟、带中文旁白的动画，按六个阶段串起整条学习路线，并把每一章对应到相关课文。

- 播放器：`public/animation/player.html`，单文件，无外部依赖。画面用 Canvas 实时绘制，背景音乐和音效由 Web Audio 实时合成，旁白音频以 base64 内嵌。可以单独访问 `/animation/player.html`（线上会 307 跳转到 `/animation/player`）
- 快捷键：点击画面 / 空格暂停，`←` `→` 快退快进，`M` 静音，`V` 开关旁白，`F` 全屏；起始页的「播放并导出视频」可以录制成视频文件（MP4 或 WebM，取决于浏览器），仅在独立页面显示
- 自检：打开 `/animation/player.html?scan=1`，逐帧渲染并离线合成全部音频，页面 `data-scan` 为 `OK` 表示没有问题；`?t=秒数&still=1` 可以停在某一帧
- 封面图：`public/animation/poster.jpg`，首页和分享卡片使用
- 重新生成旁白（改文案或换声音）：编辑 `scripts/animation/gen_vo.py` 中的文案列表后运行 `python3 scripts/animation/gen_vo.py`（需要 [uv](https://docs.astral.sh/uv/) 和 macOS 的 `afinfo`），脚本会写回播放器里的 `VO_DATA`

## 说明

Kubernetes® 是 The Linux Foundation 的注册商标。本项目为社区学习资料，与 CNCF 无隶属关系。
