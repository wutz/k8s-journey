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

站点有两类亮色主题、带中文旁白的动画：

- 总览：`/animation` 页面上约 3 分钟的一部，按六个阶段串起整条学习路线，每一章都对应到相关课文。首页也有入口
- 逐课：37 课每课一段，一分半左右，放在课文开头（点击封面才加载）。`/animation` 页面按阶段列出了全部逐课动画

文件结构：

- `public/animation/player.html`：播放器页面，`?id=<动画 id>` 选择动画，缺省是总览 `journey`，逐课动画的 id 就是课文 slug。`?autoplay=1` 让它直接开播，课文页用的就是这个
- `public/animation/engine.js`：公共引擎。每一帧都只由时间决定，画面用 Canvas 绘制，背景音乐和音效由 Web Audio 实时合成。引擎还提供配色、节点、Pod、终端、YAML 等绘图组件，以及逐课动画共用的片头 `lessonIntro` 和小结 `lessonOutro`
- `public/animation/<id>/scenes.js`：一部动画的场景。每个场景写明时长、旁白 `vo`、音效 `cues` 和绘制函数 `draw(t)`，最后用 `ANIM({...})` 登记
- `public/animation/<id>/vo.json`、`vo/*.mp3`：旁白音频，由脚本生成
- `public/animation/<id>/poster.jpg`：封面图，首页、课文页和分享卡片使用
- `src/content/animations.gen.json`：动画清单（时长、场景名），站点据此决定哪些课显示动画

脚本（需要 [uv](https://docs.astral.sh/uv/)、macOS 的 `afinfo` 和本机 Chrome）：

- `node scripts/animation/gen_vo.mjs [id...]`：用 edge-tts 生成旁白，并刷新动画清单。旁白读得比留给它的时间长时，会自动小幅加快语速；仍然放不下的句子标为 `OVER`，脚本以非 0 退出。文案未变的句子直接复用已有音频
- `node scripts/animation/check.mjs [id...]`：用无头 Chrome 逐帧渲染，离线合成全部音频，并核对旁白与字幕。加 `--shots` 会在每个场景截图到 `/tmp/anim-shots/<id>/`，`--at 12.5,30` 只截指定时刻
- `node scripts/animation/check.mjs --poster [id...]`：重新生成封面图，时间点取 `ANIM({poster: 秒数})`，缺省为片头结束前的一帧

播放器快捷键：点击画面或按空格暂停，`←` `→` 快退快进，`M` 静音，`V` 开关旁白，`F` 全屏。独立页面的起始页有「播放并导出视频」，可以录成视频文件（MP4 或 WebM，取决于浏览器）。在浏览器里打开 `player.html?id=<id>&scan=1` 也能自检，`?t=秒数&still=1` 可以停在某一帧。

## 说明

Kubernetes® 是 The Linux Foundation 的注册商标。本项目为社区学习资料，与 CNCF 无隶属关系。
