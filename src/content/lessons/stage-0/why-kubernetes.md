# 为什么需要 Kubernetes

上一课我们在一台机器上用 `docker run` 跑起了一个容器。真实业务不会只有一个容器、一台机器：一个中等规模的系统往往有几十个服务、上百个容器实例，分布在十几台甚至上百台服务器上。这时"手工 `docker run`"就会迅速失控。

这一课从手工运维的痛点出发，讲清楚 Kubernetes 的两个核心思想——**声明式 API** 和**控制循环**，再画出 K8s 的整体架构，最后简要了解它的历史与版本节奏。学完后你会对"K8s 到底在做什么"有一张完整的全景图，后续每一课都是在这张图上填细节。

## 手工运维容器的痛点

假设你要在 3 台服务器上运行上一课的 `hello-app`，要求 6 个副本、对外提供服务。用 Docker 手工操作，会遇到下面这些问题：

| 场景 | 手工做法 | 问题 |
|---|---|---|
| 放置 | 挑机器，挨个 `ssh` 上去 `docker run` | 哪台机器资源还够？要自己记 |
| 故障恢复 | 半夜收到告警，登录机器重启容器 | 机器宕机了，容器要在别的机器上重建 |
| 扩容 | 再找机器、再 `docker run` | 流量高峰来得比人快 |
| 服务发现 | 把 6 个 IP:端口写进 Nginx upstream | 容器重建后 IP 变了，配置要跟着改 |
| 发布 | 逐台停旧容器、起新容器 | 怎么保证不中断？出错怎么回滚？ |
| 配置 | 每台机器上放一份配置文件 | 改一次配置要改 N 处 |
| 资源隔离 | 手动加 `--memory` `--cpus` | 容易漏，一个服务拖垮整机 |

用脚本（Shell、Ansible）可以缓解一部分，但本质上它们是**命令式**的：描述"要执行哪些步骤"。步骤执行完，脚本就结束了，它不会持续盯着系统。容器挂了、机器宕了，还得有人再跑一次。

我们需要的是一个系统：**告诉它想要什么状态，它自己负责达到并一直维持这个状态**。这就是容器编排（Container Orchestration）系统，Kubernetes 是目前事实上的标准。

## 声明式 API

对比两种表达方式：

```bash
# 命令式：告诉系统"做什么"
docker run -d hello-app:v2   # 在 node1 上执行
docker run -d hello-app:v2   # 在 node2 上执行
docker run -d hello-app:v2   # 在 node3 上执行
```

```yaml title="hello-deployment.yaml"
# 声明式：告诉系统"要什么"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      containers:
        - name: hello
          image: nginx:1.29
          resources:
            limits:
              memory: 128Mi
```

声明式的 YAML 只描述**期望状态（Desired State）**："我要 3 个运行 `nginx:1.29` 的副本，每个最多用 128 MiB 内存"。至于放到哪台机器、先起哪个、挂了怎么办，全部交给 K8s。

声明式带来的好处：

- **幂等**：同一份 YAML 执行多少次结果都一样，不会重复创建。
- **可版本化**：YAML 放进 Git，每次变更都有记录、可审查、可回滚。这是 GitOps 的基础。
- **自愈**：系统持续把实际状态拉回期望状态，而不是执行一次就结束。

K8s 中的每一种资源（Pod、Deployment、Service……）都是一个 API 对象，几乎都有两个关键字段：`spec`（你声明的期望状态）和 `status`（系统观测到的实际状态）。[kubectl 与声明式 API](/learn/kubectl-and-yaml) 一课会详细展开。

## 控制循环与调谐

谁负责让 `status` 追上 `spec`？答案是**控制器（Controller）**。每个控制器都在运行一个永不停止的**控制循环（Control Loop）**：

```text
        ┌──────────────────────────────────────┐
        │                                      │
        ▼                                      │
  ① 观察（Observe）                            │
     读取期望状态 spec 和实际状态 status        │
        │                                      │
        ▼                                      │
  ② 比较（Diff）                               │
     期望 3 个副本，实际只有 2 个              │
        │                                      │
        ▼                                      │
  ③ 行动（Act）                                │
     创建 1 个新 Pod ──────────────────────────┘
```

这个"让实际状态趋近期望状态"的过程叫**调谐（Reconcile）**。它和空调恒温器是一个道理：你设定 26°C（期望状态），恒温器不停测量室温（实际状态），高了就制冷，低了就停机，永远不会"执行完毕"。

控制循环有几个重要特点：

- **基于状态而不是事件**：控制器每次都比较完整的期望和实际状态，即使漏掉了某个事件，下一轮也能纠正。
- **各管一摊**：Deployment 控制器管 ReplicaSet，ReplicaSet 控制器管 Pod，节点控制器管节点健康……每个控制器只负责一种资源，彼此通过 API 对象间接协作。
- **最终一致**：系统不保证瞬间达到期望状态，但保证会持续朝它收敛。

在 kind 集群搭好后（下一课），你可以亲眼看到调谐：删掉一个 Pod，几秒钟内控制器就会补上一个新的。

```console
$ kubectl delete pod <某个 hello Pod 的名字>
$ kubectl get pods -l app=hello
NAME                     READY   STATUS              RESTARTS   AGE
hello-6d4b8f9c7b-2xkqp   1/1     Running             0          5m
hello-6d4b8f9c7b-7hz9w   1/1     Running             0          5m
hello-6d4b8f9c7b-vn4tc   0/1     ContainerCreating   0          2s
```

> [!TIP]
> 理解了"声明期望状态 + 控制器持续调谐"，K8s 里 90% 的行为都能推理出来。[CRD 与 Operator 模式](/learn/crd-operator) 讲的就是如何用同样的模式为你自己的资源写控制器。

## Kubernetes 架构全景

一个 K8s 集群由两部分组成：**控制平面（Control Plane）** 负责决策，**工作节点（Worker Node）** 负责运行容器。

```text
┌──────────────────────────── 控制平面 Control Plane ────────────────────────────┐
│                                                                               │
│   ┌──────────────────┐        ┌──────────────────────────────────────────┐   │
│   │       etcd       │◀──────▶│             kube-apiserver               │   │
│   │  集群状态存储      │        │   唯一入口：认证、授权、准入、读写对象      │   │
│   └──────────────────┘        └──────────────────────────────────────────┘   │
│                                   ▲            ▲              ▲              │
│                                   │ watch      │ watch        │ watch        │
│                     ┌─────────────┴──┐  ┌──────┴─────────┐ ┌──┴───────────┐  │
│                     │ kube-scheduler │  │ kube-controller│ │ cloud-       │  │
│                     │ 为 Pod 选节点   │  │ -manager 控制器 │ │ controller-  │  │
│                     └────────────────┘  └────────────────┘ │ manager(可选) │  │
│                                                            └──────────────┘  │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ HTTPS（kubelet / kube-proxy watch apiserver）
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌─────────── Node 1 ───────────┐ ┌─────────── Node 2 ───────────┐ ┌──── Node 3 ────┐
│ kubelet   管理本节点的 Pod    │ │ kubelet                      │ │      ...       │
│ kube-proxy  Service 转发规则 │ │ kube-proxy                   │ │                │
│ 容器运行时 containerd (CRI)   │ │ containerd                   │ │                │
│ ┌─────┐ ┌─────┐ ┌─────┐      │ │ ┌─────┐ ┌─────┐              │ │                │
│ │ Pod │ │ Pod │ │ Pod │      │ │ │ Pod │ │ Pod │              │ │                │
│ └─────┘ └─────┘ └─────┘      │ │ └─────┘ └─────┘              │ │                │
└──────────────────────────────┘ └──────────────────────────────┘ └────────────────┘
        ▲
        │ kubectl apply -f hello-deployment.yaml
      用户
```

### 控制平面组件

| 组件 | 职责 |
|---|---|
| kube-apiserver | 集群的唯一入口，提供 REST API。所有组件（包括 kubectl）都只和它通信，它负责认证、授权、准入控制，并把对象读写到 etcd |
| etcd | 一致性、高可用的键值数据库，保存集群的全部状态。etcd 丢了，集群就"失忆"了 |
| kube-scheduler | 监听尚未分配节点的 Pod，根据资源需求、亲和性、污点等规则为它选一个节点 |
| kube-controller-manager | 运行大量内置控制器：Deployment、ReplicaSet、Node、Job、EndpointSlice、ServiceAccount 等 |
| cloud-controller-manager | 可选，对接云厂商 API（创建负载均衡器、管理节点生命周期等），本地和裸金属集群通常没有 |

### 节点组件

| 组件 | 职责 |
|---|---|
| kubelet | 每个节点上的代理。监听分配到本节点的 Pod，通过 CRI 调用容器运行时创建容器，执行健康检查，上报节点和 Pod 状态 |
| kube-proxy | 维护节点上的网络规则（iptables/IPVS/nftables），实现 Service 的负载均衡。使用 Cilium 等 CNI 时可被替代 |
| 容器运行时 | containerd 或 CRI-O，负责真正拉镜像和运行容器，见 [容器基础](/learn/containers) |

此外还有一些以插件（Addon）形式运行在集群里的组件：CoreDNS 提供集群内 DNS，CNI 插件负责 Pod 网络，metrics-server 提供资源指标等。

### 一次部署的大致流程

执行 `kubectl apply -f hello-deployment.yaml` 之后：

1. kubectl 把 YAML 发给 **apiserver**，apiserver 校验后写入 **etcd**。
2. **Deployment 控制器**发现新的 Deployment，创建一个 ReplicaSet。
3. **ReplicaSet 控制器**发现需要 3 个 Pod、实际 0 个，创建 3 个 Pod 对象（此时还没有节点）。
4. **scheduler** 发现 3 个未调度的 Pod，为每个选定节点，把结果写回 apiserver。
5. 各节点的 **kubelet** 发现有分配给自己的 Pod，通过 CRI 让 **containerd** 拉镜像、启动容器。
6. kubelet 把 Pod 状态（Running、IP 等）上报给 apiserver。

注意：组件之间从不直接调用，全都通过 apiserver 读写对象、监听（watch）变化。这种松耦合让每个组件都可以独立替换和扩展。[控制平面深入：一个 Pod 的诞生](/learn/control-plane) 会把这个流程拆到源码级别。

## K8s 的历史与版本节奏

### 简史

- **2003～2014**：Google 内部使用 Borg 系统管理海量容器，后来又有了改进版 Omega。
- **2014 年 6 月**：Google 开源 Kubernetes（希腊语"舵手"），吸收了 Borg 十余年的经验。
- **2015 年 7 月**：发布 v1.0，同时 Google 联合 Linux 基金会成立 **CNCF（云原生计算基金会）**，K8s 成为其第一个项目。
- **2018 年 3 月**：成为 CNCF 第一个"毕业"项目。
- **2022 年 5 月**：v1.24 移除 dockershim，节点全面转向 CRI 运行时。
- **至今**：各大云厂商都提供托管 K8s（EKS、GKE、AKS 等），它已成为云原生基础设施的事实标准，也是 AI 训练与推理平台的主流底座。

### 版本号与发布节奏

K8s 版本号遵循 `主版本.次版本.补丁版本`，例如 `v1.37.0`：

- **次版本**大约每 **4 个月**发布一个，每年约 3 个。
- 社区通常同时维护**最近 3 个次版本**，每个次版本约有 **14 个月**的补丁支持期。
- **补丁版本**大约每月发布，包含 bug 修复和安全修复。

截至本文写作时，最新稳定版本是 v1.37，请以 [官方发行版本页面](https://kubernetes.io/zh-cn/releases/) 为准。

新功能一般经历 **Alpha → Beta → GA（Stable）** 三个阶段。Alpha 功能默认关闭，可能随时变更或删除；GA 功能才可以放心在生产中依赖。这也体现在 API 版本上，例如 `v1alpha1`、`v1beta1`、`v1`。

> [!PROD] 升级节奏
> 生产集群不能只装不升：落后超过 3 个次版本就不再有安全补丁。升级只能逐个次版本进行（1.35 → 1.36 → 1.37），不能跳版本。控制平面先升，节点后升，kubelet 版本不能比 apiserver 新，也不能落后太多，具体见版本偏差策略。详见 [Day-2 运维](/learn/day2-operations)。

## 动手练习

1. 列出你所在团队（或你设想的一个项目）当前用手工方式运维服务时遇到的 3 个痛点，对照本课表格想想 K8s 分别用什么机制解决。
2. 不看本课，在纸上画出 K8s 架构图，标出控制平面的 4 个核心组件和节点上的 3 个组件。
3. 打开 [官方发行版本页面](https://kubernetes.io/zh-cn/releases/)，找出当前仍在维护的 3 个次版本，以及最老那个版本的维护截止日期。
4. 用自己的话写出"调谐"的含义，并举一个生活中的类似例子（恒温器之外的）。

## 自测

<details>
<summary>命令式和声明式的根本区别是什么？</summary>

命令式描述"要执行哪些步骤"，执行完即结束，不关心之后状态是否漂移；声明式描述"期望的最终状态"，由系统负责达到并持续维持。声明式天然幂等、可版本化，并且配合控制循环实现自愈。

</details>

<details>
<summary>一个 Pod 所在的节点宕机了，是哪个组件决定在别的节点上重建它？</summary>

多个组件协作：节点控制器（在 kube-controller-manager 中）发现节点失联并驱逐其上的 Pod；ReplicaSet 控制器发现实际副本数少于期望，创建新的 Pod 对象；kube-scheduler 为新 Pod 选一个健康节点；该节点的 kubelet 负责把容器跑起来。注意：只有被控制器（如 ReplicaSet）管理的 Pod 才会被重建，裸 Pod 不会。

</details>

<details>
<summary>为什么说 etcd 是集群中最重要的组件之一？</summary>

etcd 保存了集群的全部状态：所有 API 对象的 spec 和 status。其他组件都是无状态的，可以随时重启重建；etcd 数据丢失意味着集群"失忆"，所有工作负载定义都没了。因此生产环境必须对 etcd 做高可用部署和定期备份。

</details>

<details>
<summary>scheduler 会直接通知 kubelet 启动容器吗？</summary>

不会。scheduler 只把调度结果（Pod 的 `nodeName`）写回 apiserver。kubelet 通过 watch apiserver 发现分配给自己的 Pod，然后自行启动。所有组件都只和 apiserver 通信。

</details>

<details>
<summary>K8s 大约多久发布一个次版本？一个次版本的补丁支持期大约多长？</summary>

大约每 4 个月一个次版本，社区同时维护最近 3 个次版本，每个次版本约有 14 个月的补丁支持期。

</details>

## 参考资料

- [Kubernetes 官方文档：概述](https://kubernetes.io/zh-cn/docs/concepts/overview/)
- [Kubernetes 官方文档：Kubernetes 组件](https://kubernetes.io/zh-cn/docs/concepts/overview/components/)
- [Kubernetes 官方文档：集群架构](https://kubernetes.io/zh-cn/docs/concepts/architecture/)
- [Kubernetes 官方文档：控制器](https://kubernetes.io/zh-cn/docs/concepts/architecture/controller/)
- [Kubernetes 官方文档：Kubernetes 对象](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/)
- [Kubernetes 发行版本](https://kubernetes.io/zh-cn/releases/)
- [Kubernetes 版本偏差策略](https://kubernetes.io/zh-cn/releases/version-skew-policy/)
