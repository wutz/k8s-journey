# 认证考试与持续成长

走到这里，你已经从容器的 Namespace 和 cgroup 一路学到了 GPU 调度、分布式训练、推理网关和多租户平台。Kubernetes 的知识面很宽，更新也很快：每年三个小版本，每个版本都有功能进入 GA、有 API 被废弃，AI 相关的生态几乎每个月都有新项目。学完一套教程只是起点，更重要的是建立一套持续学习的方法。

这一课分两部分：一是 CNCF 的三门官方认证（CKA、CKAD、CKS）怎么准备，它们是检验动手能力、查漏补缺的好工具；二是怎样跟进版本演进和社区动态，让你的知识和集群都不过时。

## 三门认证

CNCF 与 Linux 基金会提供三门 Kubernetes 认证考试，都是**在线监考的实操考试**：考试时你面对的是真实的集群终端，在限定时间内（约 2 小时）完成一系列任务，而不是做选择题。

| 认证 | 面向 | 考察重点 | 对应本教程 |
| --- | --- | --- | --- |
| CKA（Certified Kubernetes Administrator） | 集群管理员 | 集群安装与升级、etcd 备份恢复、网络、存储、调度、故障排查 | 阶段 1～4，尤其 [控制平面](/learn/control-plane)、[Day-2 运维](/learn/day2-operations)、[故障排查](/learn/troubleshooting) |
| CKAD（Certified Kubernetes Application Developer） | 应用开发者 | Pod 设计、配置、探针、Deployment 发布、Service、Job、Helm | 阶段 1～2 |
| CKS（Certified Kubernetes Security Specialist） | 安全工程师 | 集群加固、RBAC、PSS、NetworkPolicy、供应链安全、运行时检测 | [RBAC](/learn/rbac)、[工作负载安全加固](/learn/security) |

CKS 要求先持有有效的 CKA 证书。考纲（curriculum）、考试时长、所考的 Kubernetes 版本、价格和证书有效期会不定期调整，报名前一定以官方页面为准；各考试的最新考纲公开在 CNCF 的 curriculum 仓库里。

### 备考建议

**把考纲当清单用。** 逐条对照考纲，每一项都在自己的 kind 或 kubeadm 集群里亲手做一遍，做不出来的就是要补的地方。

**练速度，不只是练会。** 实操考试最大的敌人是时间。几个习惯能省下大量时间：

```bash
# 设置别名和补全（考试环境通常已配好 k 别名，确认一下即可）
alias k=kubectl
source <(kubectl completion bash)
complete -o default -F __start_kubectl k

# 用命令生成 YAML 骨架，而不是从零手写
export do="--dry-run=client -o yaml"
k create deploy web --image=nginx --replicas=3 $do > web.yaml
k run tmp --image=busybox:1.36 --rm -it --restart=Never -- sh

# 忘了字段时查 explain，而不是翻网页
k explain pod.spec.containers.securityContext --recursive | less
```

**熟悉官方文档的结构。** 考试期间允许查阅 kubernetes.io 官方文档（具体允许的站点以考试规则为准）。平时就用官方文档查问题，知道"NetworkPolicy 的例子在哪一页""etcd 备份命令在哪一页"，比记住所有字段更实用。

**注意上下文。** 每道题可能要求在不同的集群上操作，题目开头会给出切换上下文的命令，一定先执行。改错集群是最常见的丢分原因。

> [!TIP] 认证的价值在于备考过程
> 证书本身能证明你具备基础的动手能力，但真正的收获是备考时被迫把每个知识点都在终端里过一遍。本教程的生产经验（GPU、RDMA、多租户）不在考试范围内，考试考察的是"任何 Kubernetes 集群都通用"的基本功，两者互补。

## 跟进版本演进

Kubernetes 大约每 4 个月发布一个小版本，每个小版本提供约 14 个月的补丁支持。这意味着一个生产集群如果一年不升级，就会落后到不再受支持的版本。跟进版本不只是"追新"，更是运维责任。

### 读 Release Notes 和版本博客

每个版本发布时，kubernetes.io 博客会发一篇概览文章，列出重要的新功能、进入 GA 的功能、废弃和移除项。完整的变更日志在 kubernetes/kubernetes 仓库的 CHANGELOG 里。建议的阅读顺序：

1. 先读博客的版本概览，了解大方向；
2. 再看 CHANGELOG 里的 **Urgent Upgrade Notes** 和 **Deprecation** 部分，这是升级前必须处理的；
3. 最后按自己关心的 SIG 筛选变更。

升级评估的完整流程见 [Day-2 运维](/learn/day2-operations)。

### 关注 API 废弃

API 从 beta 到 GA、旧版本被移除，是升级时最常见的破坏性变化。官方的"已弃用 API 迁移指南"按版本列出了每个被移除的 API 以及替代版本。升级前可以用工具扫描集群和清单中使用的旧 API，例如 kubent（kube-no-trouble）或 Pluto。

```bash
# 查看 apiserver 暴露的指标里，哪些已废弃的 API 仍在被调用
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis
```

### 跟踪 KEP

每个重要功能都始于一份 KEP（Kubernetes Enhancement Proposal，Kubernetes 增强提案），在 kubernetes/enhancements 仓库里公开讨论。一个功能通常经历 alpha → beta → GA 三个阶段，每个阶段至少一个版本。

本教程里提到的几个例子：

| 功能 | 状态（截至本文写作时） | 为什么值得关注 |
| --- | --- | --- |
| 动态资源分配（DRA） | 1.34 GA | GPU 等设备的下一代分配方式（见 [GPU 调度与 GPU Operator](/learn/gpu-operator)） |
| 原生 Gang 调度（Workload API） | alpha | 可能改变批调度的架构（见 [批调度](/learn/batch-scheduling)） |
| Gateway API 推理扩展 | 独立子项目，快速迭代 | 推理流量治理的标准化方向（见 [大模型推理服务](/learn/llm-inference)） |

读 KEP 能让你理解一个功能"为什么这样设计"、有哪些已知的限制，这往往比使用文档更有价值。对于你正在依赖的 alpha/beta 功能，订阅对应 KEP 的 issue，就能第一时间知道它的变化。

## 参与社区

Kubernetes 由按领域划分的特别兴趣小组（Special Interest Group，SIG）维护，例如 SIG Scheduling（调度器、Kueue）、SIG Network（Service、Gateway API）、SIG Node（kubelet、DRA）、SIG Apps（工作负载、LWS、JobSet）。另有工作组（WG），如专门讨论 AI/批处理负载的 WG Batch、WG Serving。

参与方式由浅入深：

1. **旁听**：各 SIG 的例会是公开的，会议纪要和录像都可以查到，是了解项目走向最直接的方式；
2. **提问与回答**：在 Kubernetes Slack、Discuss 论坛、中文社区里回答别人的问题，是巩固知识的好办法；
3. **报告与复现问题**：在生产中遇到的 bug，整理出最小复现步骤提交 issue；
4. **贡献文档与翻译**：kubernetes.io 的中文本地化（zh-cn）一直欢迎贡献，是很好的第一次贡献；
5. **贡献代码**：从带 `good first issue` 标签的问题开始，阅读贡献者指南，了解 PR 评审和测试流程。

KubeCon + CloudNativeCon 每年在多个地区举办，会后所有演讲视频都会公开。里面有大量一线团队的生产经验分享，是了解"别人怎么用"的最好渠道。

> [!NOTE] 把自己的经验写出来
> 本教程的阶段 4、阶段 5 大量来自一个团队在生产集群上踩过的坑。把你自己的排障过程、选型对比、压测数据写成文档或博客，既能帮助别人，也是对自己知识的一次梳理。

## 一份持续学习的清单

```text
每周       浏览 Kubernetes 博客、你所用项目（Cilium、Kueue、vLLM……）的 Release
每个版本   读版本概览和 Urgent Upgrade Notes，检查集群里的废弃 API
每季度     挑一个 KEP 或一个 SIG 例会深入读一次
每年       评估一次集群升级计划；看一轮 KubeCon 的相关议题
```

## 动手练习

1. 打开 CNCF curriculum 仓库，找到 CKA 的最新考纲，逐条标记：哪些已经在本教程中练过，哪些还没有；为没练过的每一项在 kind 里做一次。
2. 设置好别名、补全和 `$do` 变量，限时 10 分钟，完成：创建一个 3 副本 Deployment、用 ClusterIP Service 暴露、为它配置 readinessProbe、再把镜像滚动升级并回滚。
3. 找到你正在使用的 Kubernetes 版本的下一个小版本的发布博客，列出其中会影响你集群的 3 项变化。
4. 在 kubernetes/enhancements 仓库里找到 DRA 相关的 KEP，读它的 Motivation 和 Non-Goals 部分，用两三句话写下它想解决什么问题。
5. 挑一个你感兴趣的 SIG，找到它的例会时间和会议纪要，读最近一次的纪要。

## 自测

<details>
<summary>CKA、CKAD、CKS 三门考试的定位有什么不同？报考顺序有什么要求？</summary>

CKA 面向集群管理员，考察安装、升级、etcd、网络、存储和排障；CKAD 面向应用开发者，考察如何设计和部署应用；CKS 面向安全，考察集群与工作负载加固、供应链与运行时安全。CKS 要求先持有有效的 CKA 证书，CKA 和 CKAD 没有先后要求。

</details>

<details>
<summary>为什么说一年不升级的生产集群是有风险的？</summary>

Kubernetes 大约每 4 个月发布一个小版本，每个小版本只有约 14 个月的补丁支持期。一年不升级，集群很可能已经或即将脱离支持，无法获得安全修复；而且落后的版本越多，一次升级要跨越的 API 废弃和行为变化就越多，风险越大。

</details>

<details>
<summary>升级集群之前，应该怎样发现正在使用的已废弃 API？</summary>

一是阅读官方的已弃用 API 迁移指南，了解目标版本移除了哪些 API；二是用 kubent、Pluto 等工具扫描集群资源和 Helm/Kustomize 清单；三是查看 apiserver 的 `apiserver_requested_deprecated_apis` 指标，找出仍在调用旧 API 的客户端。

</details>

<details>
<summary>KEP 是什么？读 KEP 有什么用？</summary>

KEP 是 Kubernetes 增强提案，每个重要功能在实现前都要写 KEP，说明动机、设计、替代方案、测试计划和从 alpha 到 GA 的毕业标准。读 KEP 能了解功能为什么这样设计、有哪些限制和计划，适合在依赖一个尚未 GA 的功能前做评估。

</details>

## 参考资料

- [CKA 认证官方页面](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)
- [CKAD 认证官方页面](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/)
- [CKS 认证官方页面](https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist/)
- [CNCF 认证考纲仓库](https://github.com/cncf/curriculum)
- [Kubernetes 官方文档：版本偏差策略与发布周期](https://kubernetes.io/zh-cn/releases/)
- [Kubernetes 官方文档：已弃用 API 的迁移指南](https://kubernetes.io/zh-cn/docs/reference/using-api/deprecation-guide/)
- [Kubernetes 博客](https://kubernetes.io/blog/)
- [Kubernetes 增强提案（KEP）仓库](https://github.com/kubernetes/enhancements)
- [Kubernetes 社区与 SIG 列表](https://github.com/kubernetes/community/blob/master/sig-list.md)
- [Kubernetes 贡献者指南](https://www.kubernetes.dev/docs/guide/)
- [参与 Kubernetes 文档本地化](https://kubernetes.io/zh-cn/docs/contribute/localization/)
- [KubeCon + CloudNativeCon](https://www.cncf.io/kubecon-cloudnativecon-events/)
