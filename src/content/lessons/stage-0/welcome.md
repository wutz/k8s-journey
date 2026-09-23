# 学习路线与使用指南

这套教程面向会用 Linux 命令行、但还没接触过 Kubernetes 的工程师，目标是带你从"第一次听说容器"一路走到"能规划、部署并长期运维一个生产集群，并在上面建设 GPU/AI 平台"。全程分 6 个阶段、36 篇课文，每一篇都尽量配上能在自己电脑上跑起来的例子。

读完这一课，你会知道每个阶段学什么、学到什么程度、适合按什么节奏推进，也会准备好接下来要用的实验环境。

## 为什么要按路线学

Kubernetes（常简称 K8s，K 和 s 之间有 8 个字母）的知识点多且互相交织：想看懂 Service 需要先懂 Pod 和标签，想排查网络故障需要先懂 CNI 和 kube-proxy，想部署生产集群又需要把前面这些全都串起来。零散地看博客很容易"每个词都认识，连起来不会用"。

所以本站把内容按依赖关系排成一条线：前面的课为后面的课铺路，后面的课会反复引用前面的概念。第一次学建议按顺序走；已经有基础的读者可以根据下面的路线图直接跳到对应阶段。

## 六个阶段的路线图

| 阶段 | 名称 | 定位 | 学完能做到 |
|---|---|---|---|
| 0 | 启程 | Prerequisites | 理解容器与 K8s 要解决的问题，在自己电脑上跑起第一个集群 |
| 1 | 入门 | Beginner | 用 YAML 声明式地部署一个无状态 Web 应用，并对外提供服务 |
| 2 | 进阶 | Intermediate | 为真实应用配置健康检查、资源、存储、调度和入口流量，并用 Helm / Kustomize 管理 |
| 3 | 原理 | Advanced | 理解控制平面、网络、安全和扩展机制是怎样工作的，能解释"为什么" |
| 4 | 生产 | Production | 规划、部署并长期运维高可用生产集群，出了问题知道从哪里查 |
| 5 | 专家 | Expert | 在 K8s 上建设 GPU/AI 平台和多租户平台，并持续跟进社区演进 |

### 阶段 0：启程——搞懂容器，搭好实验环境

K8s 管理的是容器，所以先把容器本身弄明白：

- [学习路线与使用指南](/learn/welcome)：就是你正在读的这一篇。
- [容器基础：从进程到镜像](/learn/containers)：容器本质上是被 Namespace 隔离、被 cgroup 限制的普通进程；镜像是分层的文件系统。你会写出第一个 Dockerfile。
- [为什么需要 Kubernetes](/learn/why-kubernetes)：从单机手工运维容器的痛点出发，理解声明式 API、控制循环和 K8s 的整体架构。
- [搭建本地实验集群](/learn/local-cluster)：安装 kubectl，用 kind 创建 1 个控制平面 + 2 个工作节点的集群，部署第一个应用。

**学到什么程度**：能说清楚"容器是什么、K8s 管什么"，本地集群能随时创建和销毁。

### 阶段 1：入门——掌握核心对象

- [kubectl 与声明式 API](/learn/kubectl-and-yaml)
- [Pod：最小调度单元](/learn/pods)
- [标签、注解与命名空间](/learn/labels-namespaces)
- [ReplicaSet 与 Deployment](/learn/deployments)
- [Service 与服务发现](/learn/services)
- [ConfigMap 与 Secret](/learn/configmaps-secrets)

**学到什么程度**：不看教程也能写出一个 Deployment + Service + ConfigMap 的组合，完成滚动更新和回滚，会用 `kubectl logs`、`kubectl exec`、`kubectl describe` 看问题。这大致对应 CKAD 考试的一半内容。

### 阶段 2：进阶——让应用可靠地跑起来

- [健康检查与资源管理](/learn/probes-resources)
- [存储：Volume、PV、PVC 与 StorageClass](/learn/storage-basics)
- [StatefulSet 与有状态应用](/learn/statefulsets)
- [Job、CronJob 与 DaemonSet](/learn/jobs-daemonsets)
- [Ingress 与 Gateway API](/learn/ingress-gateway)
- [调度：亲和性、污点与拓扑分布](/learn/scheduling)
- [用 Helm 与 Kustomize 管理应用](/learn/helm-kustomize)

**学到什么程度**：能把一个带数据库、定时任务、HTTPS 入口的真实业务完整地搬上 K8s，并用 Helm 或 Kustomize 管理多套环境。

### 阶段 3：原理——深入内部机制

- [控制平面深入：一个 Pod 的诞生](/learn/control-plane)
- [网络模型与 CNI](/learn/networking-model)
- [认证、授权与 RBAC](/learn/rbac)
- [工作负载安全加固](/learn/security)
- [自动扩缩容](/learn/autoscaling)
- [CRD 与 Operator 模式](/learn/crd-operator)

**学到什么程度**：遇到"Pod 一直 Pending""Service 访问不通""权限被拒绝"时，能从原理出发推断可能的原因，而不是只会搜报错信息。

### 阶段 4：生产——部署和运维真实集群

- [生产集群规划](/learn/cluster-planning)
- [用 Kubespray 部署高可用集群](/learn/kubespray)
- [生产网络：Cilium、MetalLB 与证书](/learn/production-networking)
- [生产存储：CSI 选型与 Rook-Ceph](/learn/production-storage)
- [可观测性：指标、日志与事件](/learn/observability)
- [镜像仓库与镜像分发](/learn/registry)
- [Day-2 运维：升级、扩容与 etcd 维护](/learn/day2-operations)
- [故障排查方法论](/learn/troubleshooting)

**学到什么程度**：能独立完成一个裸金属高可用集群的规划、部署、监控和升级。这一阶段的内容来自真实生产实践，大部分需要多台虚拟机或物理机，每课开头会说明所需环境。

### 阶段 5：专家——构建 AI 与平台级能力

- [GPU 调度与 GPU Operator](/learn/gpu-operator)
- [批调度：Kueue、Volcano 与 Gang 调度](/learn/batch-scheduling)
- [分布式训练与高性能网络](/learn/distributed-training)
- [大模型推理服务](/learn/llm-inference)
- [多租户与平台工程](/learn/multi-tenancy)
- [认证考试与持续成长](/learn/next-steps)

**学到什么程度**：能为算法团队提供 GPU 训练和大模型推理平台，为多个团队提供隔离的多租户环境。

> [!TIP] 建议节奏
> 每课标注了预计学习时间。以每周 5～6 小时计算，阶段 0～1 约 2 周，阶段 2～3 约 4 周，阶段 4～5 视有没有实验机器需要 4～8 周。宁可慢一点，也要把每课的"动手练习"真正做一遍。

## 怎样使用本站

### 页面布局

- **左侧目录**：按阶段列出全部课文，当前所在的课会高亮。窄屏下可以从页面顶部展开。
- **右侧大纲**：列出本课的二级、三级标题，点击可跳转，滚动时会自动高亮当前小节。
- **课文底部**：有"上一课 / 下一课"导航，以及"标记为已完成"按钮。完成状态保存在浏览器本地，目录中已完成的课会带上标记，方便你随时看到进度。

### 提示框

正文里会穿插几种颜色不同的提示框，含义固定：

> [!NOTE]
> 说明：补充背景知识，跳过不影响理解主线。

> [!TIP]
> 提示：更省事的做法、常用技巧。

> [!WARNING]
> 注意：容易踩坑的地方，操作前请读一遍。

> [!DANGER]
> 危险：可能导致数据丢失或集群不可用的操作，在生产环境要格外小心。

> [!LAB]
> 动手实验：跟着敲命令的完整步骤。

> [!PROD]
> 生产实践：来自真实生产集群的经验，本地实验可以先略读。

### 代码块

命令和配置都放在代码块里，右上角可以一键复制。带文件名的代码块（例如 `nginx-pod.yaml`）表示你应该把内容保存成这个文件再执行后续命令。以 `$` 开头的是输入的命令，没有 `$` 的行是输出，复制时请只复制命令本身。

### 每课的固定结构

每篇课文都按"为什么需要 → 是什么 → 怎么用 → 生产注意事项"的顺序展开，结尾有三个固定小节：

- **动手练习**：3～5 个小任务，建议全部完成。
- **自测**：点开问题查看答案，答不上来就回去重读对应小节。
- **参考资料**：官方文档链接，想深入时从这里出发。

## 前置知识

你需要具备：

- **Linux 命令行**：会用 `cd`、`ls`、`cat`、`vim`/`nano`、`ps`、`curl`，知道什么是进程、端口、环境变量、文件权限。
- **基本网络概念**：IP 地址、端口、DNS、HTTP 请求与响应。
- **YAML 语法**：缩进表示层级、`-` 表示列表、`key: value` 表示映射。不熟也没关系，阶段 1 会边用边讲。

不需要：会写 Go、事先了解 Docker（阶段 0 会从头讲容器）。

## 实验环境

### 硬件

一台 **8 GB 以上内存**的电脑（推荐 16 GB），剩余磁盘空间 20 GB 以上。macOS（Intel 或 Apple Silicon）、Linux、Windows（通过 WSL2）都可以。

本地实验集群用 [kind](https://kind.sigs.k8s.io/)（Kubernetes IN Docker）搭建：它把每个 K8s 节点跑成一个容器，一个 3 节点集群空载时大约占用 2～3 GB 内存。

### 软件

| 软件 | 用途 | 说明 |
|---|---|---|
| Docker 或 Podman | 容器运行环境，kind 依赖它 | macOS/Windows 可用 Docker Desktop、OrbStack、Colima 或 Podman Desktop；Linux 直接装 Docker Engine 或 Podman |
| kubectl | K8s 命令行客户端 | 在 [搭建本地实验集群](/learn/local-cluster) 中安装 |
| kind | 本地多节点集群 | 同上 |
| 一个文本编辑器 | 编辑 YAML | 推荐 VS Code + Kubernetes/YAML 插件 |

先确认容器环境可用：

```console
$ docker version --format '{{.Server.Version}}'
28.x.x
$ docker run --rm hello-world
Hello from Docker!
...
```

如果用 Podman，把上面的 `docker` 换成 `podman` 即可。

> [!WARNING] macOS / Windows 用户
> Docker Desktop 等工具实际上运行在一个 Linux 虚拟机里，请在它的设置里给虚拟机分配至少 4 GB 内存、2 个 CPU，否则多节点 kind 集群可能起不来。

阶段 4、5 的部分内容（高可用集群部署、Ceph 存储、GPU）需要多台 Linux 虚拟机或物理机，届时会单独说明。

## 参考资料的来源

本站内容有两个主要来源：

1. **Kubernetes 官方文档**：优先引用中文版 <https://kubernetes.io/zh-cn/docs/>。官方文档是最权威的参考，但它更像"字典"，适合查阅而不适合从头学。本站负责把知识串成路线，每课末尾给出对应的官方文档链接，方便你深入。
2. **团队生产实践仓库**：阶段 4、5 大量内容来自一个真实的生产实践仓库，涵盖 Kubespray 部署、Cilium 网络、Rook-Ceph 存储、VictoriaMetrics 监控、GPU Operator 等。引用时已去除内部域名和 IP，统一改成 `example.com`、`192.168.x.x` 这类示例值，使用时请替换成你自己的环境。

> [!NOTE] 关于版本
> 截至本文写作时，Kubernetes 最新稳定版本为 v1.37，kind 最新版本为 v0.33。K8s 大约每 4 个月发布一个小版本，文中涉及的组件版本请以官方发布为准。YAML 中的 `apiVersion` 均使用当前稳定版本。

## 动手练习

1. 浏览左侧目录，找到阶段 4 的"故障排查方法论"一课，再用浏览器后退回来，熟悉导航。
2. 确认你的电脑内存 ≥ 8 GB，并安装好 Docker 或 Podman。
3. 执行 `docker run --rm hello-world`（或 `podman run --rm hello-world`），确认输出正常。
4. 把本课标记为"已完成"，刷新页面，确认目录里的完成标记仍然存在。

## 自测

<details>
<summary>本教程一共几个阶段？哪个阶段开始需要多台机器？</summary>

6 个阶段（0～5）。阶段 0～3 的例子都能在本地 kind 集群里运行；阶段 4（生产）开始的部署类内容需要多台 Linux 虚拟机或物理机，阶段 5 的 GPU 相关内容还需要 GPU 节点。

</details>

<details>
<summary>正文里的 `PROD` 提示框表示什么？</summary>

生产实践：来自真实生产集群的经验和注意事项。本地实验时可以先略读，到部署和运维真实集群时再回头细看。

</details>

<details>
<summary>kind 为什么需要 Docker 或 Podman？</summary>

kind 把每个 Kubernetes 节点都运行成一个容器（节点镜像为 `kindest/node`），所以宿主机上必须有一个容器引擎来运行这些"节点容器"。

</details>

## 参考资料

- [Kubernetes 官方文档（中文）](https://kubernetes.io/zh-cn/docs/home/)
- [Kubernetes 概述](https://kubernetes.io/zh-cn/docs/concepts/overview/)
- [Kubernetes 基础教程](https://kubernetes.io/zh-cn/docs/tutorials/kubernetes-basics/)
- [Kubernetes 发行版本](https://kubernetes.io/zh-cn/releases/)
- [kind 快速开始](https://kind.sigs.k8s.io/docs/user/quick-start/)
