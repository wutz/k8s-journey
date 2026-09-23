# 批调度：Kueue、Volcano 与 Gang 调度

默认调度器是为在线服务设计的：Pod 来一个调度一个，资源不够就 Pending 等着。这种方式跑 AI 训练会出两类问题。第一类是**死锁**：一个 4 节点的分布式训练，调度器先放下了 3 个 Pod，第 4 个因为资源不够一直 Pending，而前 3 个已经占着 24 张卡在等它，谁也跑不起来；如果同时有两个这样的任务，会互相卡死。第二类是**没有秩序**：谁先提交谁先占，团队之间没有配额，一个人提交 100 个任务就能把整个集群占满。

这一课介绍解决这两个问题的工具：Gang 调度（全有或全无，All-or-Nothing）解决死锁，队列与配额解决秩序。我们会对比三种方案：Kueue（准入层）、Volcano（调度层）和 scheduler-plugins 的 Coscheduling 插件，讲清 ClusterQueue、LocalQueue、ResourceFlavor、借用与抢占，以及它们混用时的坑。Kueue 和 Coscheduling 都能在 kind 里体验。

> [!NOTE] 本课需要的环境
> 练习用 kind 集群即可，用 CPU 和内存代替 GPU 做配额实验。文中生产配置来自 3 台 8 卡 GPU 节点的训练集群，涉及的 TrainJob 需要先安装下一课的 Kubeflow Trainer。

## Gang 调度：全有或全无

分布式训练的所有 worker 必须同时在线，NCCL 初始化时每个 rank 都要和其他 rank 建连，少一个都会一直等到超时。所以调度的正确语义应该是：**要么这一组 Pod 全部放下，要么一个都不放**。这叫 Gang 调度。

```text
集群剩余 16 张卡，同时来了两个任务，各要 4 个 Pod × 4 卡 = 16 卡

逐个调度（默认调度器）            Gang 调度
  任务 A: ■ ■ □ □  (2/4 Running)     任务 A: ■ ■ ■ ■  全部 Running
  任务 B: ■ ■ □ □  (2/4 Running)     任务 B: □ □ □ □  整组排队
  → 两边都凑不齐，卡全被占着空等     → A 跑完释放后 B 再整组启动
```

实现 Gang 调度有两个位置可以下手：

| 位置 | 做法 | 代表 |
| --- | --- | --- |
| 准入层 | 资源够才让 Job 创建 Pod，不够就让 Job 保持挂起（suspend），一个 Pod 都不建 | Kueue |
| 调度层 | Pod 都建出来，调度器把一组 Pod 当整体评估，凑不齐就全部 Pending | Volcano、Coscheduling |

两者最大的区别在**资源不足时的开销**：准入层方案下，排队的任务在集群里只是一个挂起的 Job 对象；调度层方案下，几十上百个 Pending Pod 会在每个调度周期里被反复评估。

## Kueue：在准入层排队

Kueue 是 Kubernetes SIG Scheduling 维护的作业排队系统。它不替换 kube-scheduler，只决定"一个 Job 什么时候可以开始"。工作流程：

```text
用户提交 Job（带 queue-name 标签，suspend: true）
        │
        ▼
Kueue webhook 为 Job 创建一个 Workload 对象，记录它总共需要多少资源
        │
        ▼
Workload 进入 LocalQueue → ClusterQueue 排队
        │
   配额够吗？ ── 否 ──→ 继续排队（0 个 Pod）
        │是
        ▼
Kueue 把 Job 的 suspend 改为 false，并按 ResourceFlavor 注入 nodeSelector/tolerations
        │
        ▼
Job 控制器创建 Pod → kube-scheduler 正常调度
```

### 四个核心对象

| 对象 | 作用域 | 作用 |
| --- | --- | --- |
| ResourceFlavor | 集群 | 描述一类节点，例如"H100 节点池"，用节点标签选择，可带污点容忍 |
| ClusterQueue | 集群 | 资源池：每种 Flavor 下各类资源的配额（nominalQuota），以及借用、抢占策略 |
| LocalQueue | 命名空间 | 租户提交作业的入口，指向一个 ClusterQueue |
| WorkloadPriorityClass | 集群 | 作业级优先级，决定排队顺序和抢占，独立于 Pod 的 PriorityClass |

下面是团队生产集群的队列配置（去掉了与本课无关的拓扑感知部分）：

```yaml title="queue-setup.yaml"
apiVersion: kueue.x-k8s.io/v1beta2
kind: ResourceFlavor
metadata:
  name: h100
spec:
  nodeLabels:
    example.com/gpu: h100                 # 只选 H100 节点
  tolerations:                             # GPU 节点带污点，这里显式声明容忍
    - key: "nvidia.com/gpu"
      operator: "Exists"
      effect: "NoSchedule"
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: gpu-cluster-queue
spec:
  namespaceSelector: {}                    # 所有命名空间都可以使用
  resourceGroups:
    - coveredResources: ["cpu", "memory", "nvidia.com/gpu"]
      flavors:
        - name: h100
          resources:                       # 顺序必须与 coveredResources 一致
            - name: "cpu"
              nominalQuota: "382"
            - name: "memory"
              nominalQuota: 3000Gi
            - name: "nvidia.com/gpu"
              nominalQuota: 24             # 3 节点 × 8 卡
  preemption:
    withinClusterQueue: Never
    reclaimWithinCohort: Never
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: LocalQueue
metadata:
  name: gpu-local-queue
  namespace: default
spec:
  clusterQueue: gpu-cluster-queue
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: WorkloadPriorityClass
metadata:
  name: high-priority
value: 10000
```

> [!WARNING] nominalQuota 需要手工填，而且要填 allocatable
> Kueue 不会自动发现集群有多少资源，配额完全靠手填。应该填节点的 **allocatable 总和**（capacity 减去 kubelet 预留），而不是 capacity。节点增减后要同步修改。可以用一行命令统计：
>
> ```bash
> kubectl get nodes -l node-role.kubernetes.io/gpu -o json | \
>   jq '[.items[].status.allocatable["nvidia.com/gpu"] // "0" | tonumber] | add'
> ```

### 提交作业

任何 Kueue 支持的作业类型（batch/Job、JobSet、Kubeflow TrainJob、MPIJob、RayJob 等）接入方式都一样：打上 `kueue.x-k8s.io/queue-name` 标签，并以挂起状态提交。

```yaml title="kueue-job.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  generateName: sample-job-
  namespace: default
  labels:
    kueue.x-k8s.io/queue-name: gpu-local-queue
    kueue.x-k8s.io/priority-class: high-priority     # 可选
spec:
  suspend: true              # 交给 Kueue 决定何时开始
  parallelism: 3
  completions: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: registry.k8s.io/e2e-test-images/agnhost:2.53
          args: ["pause"]
          resources:
            requests:
              cpu: "1"
              memory: 200Mi
```

排查时先看 Workload：

```bash
kubectl get workloads -n default
kubectl describe workload <name> -n default     # Events 和 conditions 会写明为什么没被准入
kubectl get clusterqueue gpu-cluster-queue      # PENDING WORKLOADS / ADMITTED WORKLOADS
```

| 症状 | 常见原因 |
| --- | --- |
| Job 一直 suspend，也没有 Workload | 缺 `kueue.x-k8s.io/queue-name` 标签，或该作业类型没在 Kueue 的 integrations 里启用 |
| 有 Workload 但一直 Pending | LocalQueue 不存在或不在同一个命名空间；nominalQuota 不够（正常排队） |
| 已准入但 Pod Pending | 配额够但节点上实际放不下（碎片、污点），见下文"准入不等于调度成功" |

### 队列之间借用：Cohort

一个团队一个 ClusterQueue，配额切死了会浪费：A 团队的卡闲着，B 团队的任务却在排队。Kueue 用 Cohort（队列组）解决这个问题：同一个 Cohort 里的 ClusterQueue 可以借用彼此闲置的配额，别人要用时再还回去。

```yaml title="team-queues.yaml"
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: team-a
spec:
  cohortName: ai-platform
  namespaceSelector:
    matchLabels:
      team: a
  resourceGroups:
    - coveredResources: ["nvidia.com/gpu"]
      flavors:
        - name: h100
          resources:
            - name: "nvidia.com/gpu"
              nominalQuota: 16          # 保底 16 卡
              borrowingLimit: 8         # 最多向别人借 8 卡
  preemption:
    reclaimWithinCohort: Any            # 别人借了我的卡，我需要时可以抢回来
    withinClusterQueue: LowerPriority   # 队列内高优先级可以抢占低优先级
```

几种抢占策略的含义：

| 字段 | 作用 |
| --- | --- |
| `withinClusterQueue` | 队列内部：新来的高优先级作业能否抢占同队列的低优先级作业 |
| `reclaimWithinCohort` | 跨队列：自己的配额被别人借走时，能否把借用者的作业驱逐掉收回配额 |
| `borrowWithinCohort` | 自己在借用状态下，能否抢占别的队列里的低优先级作业 |

Kueue 的抢占以 **Workload 为单位**，被抢占的作业整体重新挂起、回到队列，不会只杀一部分 Pod。在此基础上还可以开启公平共享（Fair Sharing），让 Cohort 内的队列按权重分享空闲资源，而不是谁先借到谁用。具体字段随 API 版本调整过，启用前请查阅对应版本的官方文档。

> [!PROD] 生产队列怎么划分
> 团队的经验是：每个团队或项目一个命名空间 + 一个 LocalQueue；每类 GPU 一个 ResourceFlavor；按"组织"划分 ClusterQueue 并放进同一个 Cohort。起步阶段可以像上面的生产配置一样先关掉抢占（`Never`），等大家习惯排队后再逐步开启借用和回收，避免训练任务被意外中断引发争议。

### 准入不等于调度成功

Kueue 只核对"配额账本"。如果 24 张卡的配额里剩下 8 张，但它们分散在 3 台机器上，一个要单机 8 卡的任务会被准入，然后 Pod 在调度阶段 Pending。解决办法有两个：

- 开启 `waitForPodsReady`：作业准入后如果 Pod 在超时时间内没有全部就绪，Kueue 把它退回队列，释放配额，避免半启动的作业占着资源。
- 使用拓扑感知调度（Topology Aware Scheduling，TAS）：在 ResourceFlavor 上设置 `topologyName`，Kueue 会实时扫描节点的实际空闲容量，按拓扑（主机、机架、网络块）判断能不能放下。

> [!WARNING] TAS 的两个坑
> 启用 TAS 后准入受两道门控制：nominalQuota（静态账本）和 TAS 统计的节点空闲容量（动态），取更严格的一个。团队踩过两个坑：一是 GPU 节点的污点容忍必须在 ResourceFlavor 里**显式声明**，TAS 不认 webhook 自动注入的容忍；二是 Topology 的 `levels`、ResourceFlavor 的 `nodeLabels` 和 `topologyName` 创建后不可修改，改错只能删了重建。

## Volcano：在调度层做 Gang

Volcano 是 CNCF 的批处理调度系统，出现得比 Kueue 早，由三个组件组成：独立的调度器 `volcano-scheduler`、控制器和准入 webhook。它用 PodGroup 表示一组要一起调度的 Pod：

```yaml title="volcano-job.yaml"
apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: mpi-demo
spec:
  minAvailable: 3               # Gang：至少 3 个 Pod 能同时放下才调度
  schedulerName: volcano
  queue: default
  tasks:
    - name: worker
      replicas: 3
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: worker
              image: registry.k8s.io/pause:3.10
              resources:
                requests:
                  cpu: "1"
```

Volcano 自己的 Job（VCJob）提交时，webhook 会自动创建 PodGroup。Volcano 安装后自带 `root` 和 `default` 两个 Queue，默认不限额，开箱即用；需要多租户时创建子 Queue 并设置 `capability`（上限）和 `weight`（按比例分享）。

它的优势在调度策略丰富：DRF（主导资源公平）、binpack、proportion（按权重分配队列）、优先级抢占等都以插件形式提供，适合超大规模、重度多租户的纯 GPU 集群。

### 给 TrainJob 用 Volcano 要先建 PodGroup

非 VCJob 的作业（例如下一课的 Kubeflow TrainJob）不走 VCJob 的 webhook，PodGroup **不会自动创建**。必须先手工创建 PodGroup，再提交作业，并让 Pod 带上 `scheduling.k8s.io/group-name` 注解：

```yaml
apiVersion: scheduling.volcano.sh/v1beta1
kind: PodGroup
metadata:
  name: my-training
spec:
  minMember: 2          # 必须等于训练节点数
  queue: default
```

顺序反了，Volcano 的 PodGroup 控制器会认为"带了 group-name 注解的 Pod 已有 PodGroup"而跳过它们，作业就永远卡住。

## Kueue 与 Volcano 共存的坑

> [!DANGER] Kueue 的 Pod webhook 会让 Volcano 瘫痪
> 团队曾在同一个集群里同时装了 Kueue 和 Volcano，结果所有 Volcano 作业都起不来。原因是 Kueue 启用了 `pod` 集成后，它的 mutating webhook 会拦截普通 Pod 的创建，给 Pod 加上调度门控并改写调度相关字段，Volcano 的 Pod 就再也到不了 volcano-scheduler 手里。
>
> 规避办法：Kueue 的 `integrations.frameworks` 里**不要启用 `pod` 和 `deployment`**，只保留明确的作业类型：
>
> ```yaml
> integrations:
>   frameworks:
>     - "batch/job"
>     - "jobset.x-k8s.io/jobset"
>     - "trainer.kubeflow.org/trainjob"
>     - "kubeflow.org/mpijob"
> ```

另外两个小冲突：

- **CRD 短名**：Kueue 的 LocalQueue 占用了短名 `queue`，`kubectl get queue` 查到的是 LocalQueue。查 Volcano 的 Queue 要用 `kubectl get q` 或全名 `queues.scheduling.volcano.sh`。
- **两个 PodGroup**：Volcano 的 `podgroups.scheduling.volcano.sh` 和 scheduler-plugins 的 `podgroups.scheduling.x-k8s.io` 同名不同组，`kubectl get podgroup` 时注意用全名。

## Coscheduling：最轻量，但不推荐上生产

kubernetes-sigs/scheduler-plugins 项目提供了一个带 Coscheduling 插件的第二调度器。它的用法最直观：创建 PodGroup，然后让 Pod 带上标签并指定调度器。

```yaml title="coscheduling-demo.yaml"
apiVersion: scheduling.x-k8s.io/v1alpha1
kind: PodGroup
metadata:
  name: pg1
spec:
  scheduleTimeoutSeconds: 10
  minMember: 3                  # 至少 3 个 Pod 才能一起调度
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pause
spec:
  replicas: 2                   # 故意只给 2 个
  selector:
    matchLabels:
      app: pause
  template:
    metadata:
      labels:
        app: pause
        scheduling.x-k8s.io/pod-group: pg1
    spec:
      schedulerName: scheduler-plugins-scheduler
      containers:
        - name: pause
          image: registry.k8s.io/pause:3.10
```

2 个 Pod 凑不够 `minMember: 3`，全部 Pending；`kubectl scale deploy pause --replicas=3` 之后三个 Pod 一起 Running。这个演示很适合理解 Gang 语义。

它在 Permit 阶段让已经选好节点的 Pod 等待同组其他成员，凑齐才一起绑定，超时则全部打回。问题也出在这里：它仍然是逐个 Pod 调度。团队实测过一个要 48 卡、但集群只有 24 卡的任务，48 个 Pending Pod 在每个调度周期都被重新尝试，短时间内产生了 **40 万条以上** 的 `FailedScheduling` 事件，给 apiserver 和 etcd 造成了很大压力。

## 选型建议

| 维度 | Kueue | Volcano | Coscheduling |
| --- | --- | --- | --- |
| 工作层 | 准入层 | 调度层（替换调度器） | 调度层（第二调度器） |
| 资源不足时 | 0 个 Pod | 全组 Pod Pending | 全组 Pod Pending，反复重试 |
| 配额 | 手工 nominalQuota，Cohort 借用 | Queue capability/weight | 无 |
| 抢占粒度 | Workload | PodGroup | 无 |
| 组件 | 1 个控制器 | scheduler + controller + admission | scheduler + controller |
| 与 TrainJob 集成 | 加标签 + suspend，全自动 | 需手工先建 PodGroup | 需手工建 PodGroup |
| 团队结论 | 首选 | 备选，需要复杂调度策略时 | 仅用于学习演示 |

> [!NOTE] 原生 Gang 调度
> Kubernetes 1.35 引入了原生 Gang 调度的 Alpha 实现（Workload API 与 PodGroup），调度器可以把一组 Pod 作为一个单元评估，并在凑不齐时把 Pod 挡在调度队列之外。截至本文写作时它仍是 Alpha、默认关闭，不要用于生产。社区设想的长期形态是"Kueue 管配额和排队 + kube-scheduler 原生保证全有或全无"，值得持续关注。

## 动手练习

1. 在 kind 里安装 Kueue（`helm install kueue oci://registry.k8s.io/kueue/charts/kueue --version 0.18.1 -n kueue-system --create-namespace`，版本以官方发布为准），创建一个 `default-flavor`（不设 nodeLabels）、一个 ClusterQueue（cpu 配额 3、memory 配额 3Gi）和 default 命名空间的 LocalQueue。
2. 连续提交三次上文的 `kueue-job.yaml`（每个 3 × 1 CPU），用 `kubectl get workloads` 和 `kubectl get pods` 观察：第一个立即准入，后两个挂起且没有任何 Pod。删除第一个 Job 后，第二个是否自动开始？
3. 再创建一个 ClusterQueue `team-b` 放进同一个 Cohort，给两个队列各 2 CPU 保底，观察一个队列空闲时另一个队列能否借用。
4. 在另一个 kind 集群里安装 scheduler-plugins（`helm repo add scheduler-plugins https://scheduler-plugins.sigs.k8s.io`），应用 `coscheduling-demo.yaml`，确认 2 个 Pod Pending，扩到 3 个后全部 Running；然后把 `minMember` 改成 10，用 `kubectl get events --field-selector reason=FailedScheduling | wc -l` 观察事件增长速度。
5. 写下你所在团队如果上 Kueue，会怎样划分 ResourceFlavor、ClusterQueue、Cohort 和 LocalQueue。

## 自测

<details>
<summary>Kueue 和 Volcano 在资源不足时的行为有什么不同？这个区别为什么重要？</summary>

Kueue 在准入层工作，资源不足时 Job 保持 suspend，一个 Pod 都不会创建；Volcano 在调度层工作，Pod 会被创建出来，然后整组 Pending。前者在排队期间不给 apiserver 和调度器增加负担，后者在排队作业很多时会有持续的调度开销。

</details>

<details>
<summary>一个带 queue-name 标签的 Job 已经被 Kueue 准入，Pod 却 Pending，可能是什么原因？</summary>

Kueue 默认只核对配额账本，不检查节点上是否真的放得下。常见原因有：剩余 GPU 分散在多个节点形成碎片、节点污点没被容忍、nominalQuota 填得比实际 allocatable 大。可以开启 `waitForPodsReady` 让超时作业退回队列，或者启用 TAS 让准入感知真实节点容量。

</details>

<details>
<summary>给 TrainJob 使用 Volcano 时，为什么必须先创建 PodGroup？</summary>

TrainJob 不经过 Volcano 的 VCJob webhook，PodGroup 不会被自动创建；而 Volcano 的 PodGroup 控制器会跳过已经带有 `scheduling.k8s.io/group-name` 注解的 Pod。先提交作业、后建 PodGroup 会导致 Pod 永远找不到 Gang，作业卡住。

</details>

<details>
<summary>同时安装 Kueue 和 Volcano 时要注意什么？</summary>

Kueue 不要启用 `pod`、`deployment` 等通用集成，否则它的 Pod webhook 会改写 Volcano 作业的 Pod，使其无法被 volcano-scheduler 调度。另外，`kubectl get queue` 会解析到 Kueue 的 LocalQueue，查 Volcano Queue 要用短名 `q` 或全名。

</details>

<details>
<summary>`reclaimWithinCohort: Any` 解决什么问题？</summary>

同一 Cohort 内的队列可以借用彼此闲置的配额。开启 `reclaimWithinCohort` 后，配额的所有者在需要资源时可以驱逐借用者的作业，把自己的保底配额收回来。否则一旦被借走，就只能等借用者的作业自然结束。

</details>

## 参考资料

- [Kubernetes 官方文档：Pod 调度就绪态（Scheduling Gates）](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/pod-scheduling-readiness/)
- [Kubernetes 官方文档：Job](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/job/)
- [Kubernetes 官方文档：调度框架](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/scheduling-framework/)
- [Kueue 官方文档](https://kueue.sigs.k8s.io/docs/)
- [Kueue 概念：ClusterQueue](https://kueue.sigs.k8s.io/docs/concepts/cluster_queue/)
- [Kueue 概念：抢占](https://kueue.sigs.k8s.io/docs/concepts/preemption/)
- [Kueue 概念：拓扑感知调度](https://kueue.sigs.k8s.io/docs/concepts/topology_aware_scheduling/)
- [Volcano 官方文档](https://volcano.sh/zh/docs/)
- [scheduler-plugins 项目](https://github.com/kubernetes-sigs/scheduler-plugins)
- [scheduler-plugins：Coscheduling 说明](https://github.com/kubernetes-sigs/scheduler-plugins/blob/master/pkg/coscheduling/README.md)
