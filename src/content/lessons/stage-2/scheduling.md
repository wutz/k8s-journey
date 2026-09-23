# 调度：亲和性、污点与拓扑分布

默认情况下，调度器（kube-scheduler）只关心一件事：哪个节点剩余的资源装得下这个 Pod。但真实集群里约束要多得多：GPU 任务必须去 GPU 节点，数据库的三个副本不能挤在同一台机器上，缓存最好和应用放在一起，控制平面节点不跑业务，节点维护前要把 Pod 安全挪走。这一课学习如何把这些意图告诉调度器。

学完之后，你能用 nodeSelector 和节点亲和性把 Pod 放到指定节点，用 Pod 亲和/反亲和控制 Pod 之间的相对位置，用污点和容忍"保留"节点，用拓扑分布约束让副本均匀分布，用 PriorityClass 让重要负载在资源不足时抢占，并用 cordon/drain 安全地维护节点。

## 调度器如何做决定

```text
待调度 Pod ──▶ 过滤（Filter）            ──▶ 打分（Score）       ──▶ 绑定（Bind）
              资源够吗？nodeSelector？       偏好亲和性、均衡度、    写入 spec.nodeName
              污点能容忍吗？硬性亲和？        镜像是否已存在……
              → 剔除不合格节点               → 选总分最高的节点
```

本课的机制可以按"硬约束"和"软偏好"分类：硬约束在过滤阶段生效，不满足就 `Pending`；软偏好在打分阶段生效，尽量满足、满足不了也会调度。

| 机制 | 表达的意图 | 硬/软 |
|---|---|---|
| nodeSelector | 只去带某标签的节点 | 硬 |
| nodeAffinity | 节点标签的复杂条件 | 硬或软 |
| podAffinity / podAntiAffinity | 靠近 / 远离某些 Pod | 硬或软 |
| taints / tolerations | 节点拒绝没有容忍的 Pod | 硬（`PreferNoSchedule` 为软） |
| topologySpreadConstraints | 在拓扑域之间均匀分布 | 硬或软 |
| PriorityClass | 资源不足时谁优先 | 触发抢占 |

## 准备实验环境

用 [本地集群](/learn/local-cluster) 一课创建的三节点 kind 集群。给两个工作节点打上"可用区"标签，模拟多机房：

```bash
kubectl label node k8s-journey-worker  topology.kubernetes.io/zone=zone-a
kubectl label node k8s-journey-worker2 topology.kubernetes.io/zone=zone-b
kubectl label node k8s-journey-worker  disktype=ssd
kubectl get nodes -L topology.kubernetes.io/zone,disktype
```

`topology.kubernetes.io/zone`、`kubernetes.io/hostname` 都是 Kubernetes 约定的[知名标签](https://kubernetes.io/zh-cn/docs/reference/labels-annotations-taints/)，云厂商会自动设置，裸金属集群需要自己打。

## 把 Pod 放到指定节点

### nodeSelector

最简单的方式，节点必须拥有**全部**列出的标签：

```yaml title="nodeselector.yaml"
apiVersion: v1
kind: Pod
metadata: {name: on-ssd}
spec:
  nodeSelector:
    disktype: ssd
  containers:
    - {name: app, image: nginx:1.27}
```

`kubectl apply` 后用 `kubectl get pod on-ssd -o wide` 确认它一定在 `k8s-journey-worker`。如果没有任何节点满足条件，Pod 会停在 `Pending`，事件中出现 `didn't match Pod's node affinity/selector`。

### nodeAffinity

节点亲和性是 nodeSelector 的增强版，支持运算符和"软偏好"：

```yaml title="node-affinity.yaml"
apiVersion: apps/v1
kind: Deployment
metadata: {name: affinity-demo}
spec:
  replicas: 4
  selector: {matchLabels: {app: affinity-demo}}
  template:
    metadata: {labels: {app: affinity-demo}}
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:     # 硬约束
            nodeSelectorTerms:
              - matchExpressions:
                  - key: topology.kubernetes.io/zone
                    operator: In
                    values: [zone-a, zone-b]
          preferredDuringSchedulingIgnoredDuringExecution:    # 软偏好
            - weight: 80                                      # 1-100
              preference:
                matchExpressions:
                  - key: disktype
                    operator: In
                    values: [ssd]
      containers:
        - {name: app, image: nginx:1.27}
```

- 运算符：`In`、`NotIn`、`Exists`、`DoesNotExist`、`Gt`、`Lt`（后两者比较整数）。`NotIn` 和 `DoesNotExist` 可以实现"反亲和"，例如不去 GPU 节点。
- `nodeSelectorTerms` 之间是**或**，同一 term 内的 `matchExpressions` 之间是**与**。
- 名字中的 `IgnoredDuringExecution` 表示：Pod 调度后节点标签变了，已运行的 Pod 不会被赶走。

apply 后查看分布：大多数 Pod 在 `k8s-journey-worker`（ssd），但不保证全部。软偏好只是打分的一项，还要和资源均衡等其他打分项综合，所以不要指望它 100% 生效。

## Pod 之间的相对位置

### podAntiAffinity：副本打散

三副本的服务如果都落在同一个节点，这个节点一挂服务就全挂。Pod 反亲和让同一应用的副本互相"排斥"：

```yaml title="anti-affinity.yaml"
apiVersion: apps/v1
kind: Deployment
metadata: {name: spread-web}
spec:
  replicas: 3
  selector: {matchLabels: {app: spread-web}}
  template:
    metadata: {labels: {app: spread-web}}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels: {app: spread-web}
              topologyKey: kubernetes.io/hostname    # "同一拓扑域"= 同一节点
      containers:
        - {name: web, image: nginx:1.27}
```

`kubectl apply` 后用 `kubectl get pods -l app=spread-web -o wide` 查看：两个副本分别在两个工作节点上，第三个副本无处可去而 Pending。这正是硬约束的代价：副本数超过拓扑域数量就调度不了。多数场景应改用 `preferredDuringSchedulingIgnoredDuringExecution`，或下文的拓扑分布约束。

`topologyKey` 决定"什么算在一起"：`kubernetes.io/hostname` 是按节点，`topology.kubernetes.io/zone` 是按可用区。

### podAffinity：靠近放置

反过来，让应用 Pod 尽量和它的缓存在同一节点，减少网络开销：

```yaml
affinity:
  podAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels: {app: redis-cache}
          topologyKey: kubernetes.io/hostname
```

> [!WARNING] Pod 间亲和性的开销
> Pod 亲和/反亲和需要调度器检查集群中其他 Pod 的位置，计算量随集群规模增长。官方不建议在数百节点以上的大集群里大量使用硬性 Pod 亲和性。副本打散优先用拓扑分布约束。

## 污点与容忍

亲和性是 Pod "挑"节点；污点（Taint）反过来，是节点"拒绝" Pod。只有带对应容忍（Toleration）的 Pod 才能上去。典型用途：

- 控制平面节点不跑业务（kind 的 control-plane 节点就带 `node-role.kubernetes.io/control-plane:NoSchedule`）；
- GPU 等昂贵节点只给声明需要它的负载使用；
- 节点故障时，节点控制器自动加 `node.kubernetes.io/not-ready` 等污点驱逐 Pod。

污点格式是 `key=value:effect`，effect 有三种：

| effect | 新 Pod | 已在节点上运行的 Pod |
|---|---|---|
| `NoSchedule` | 不调度（除非容忍） | 不受影响 |
| `PreferNoSchedule` | 尽量不调度 | 不受影响 |
| `NoExecute` | 不调度 | **驱逐**不容忍的 Pod |

```bash
kubectl taint nodes k8s-journey-worker2 dedicated=gpu:NoSchedule
kubectl create deployment taint-demo --image=nginx:1.27 --replicas=4
kubectl get pods -l app=taint-demo -o wide     # 全部在 k8s-journey-worker，worker2 被"保留"了
```

给需要 GPU 节点的负载加上容忍：

```yaml
tolerations:   # operator: Equal 需匹配 value；Exists 只看 key
  - {key: dedicated, operator: Equal, value: gpu, effect: NoSchedule}
```

> [!NOTE] 容忍不等于吸引
> 容忍只是"允许"Pod 调度到带污点的节点，不会把 Pod "拉"过去。要让某类负载**只**跑在专用节点上，需要**污点 + 容忍 + 节点亲和性**三者配合：污点挡住别人，亲和性把自己引过去。

`NoExecute` 可以配合 `tolerationSeconds` 表示"最多再容忍多久"。Kubernetes 会给每个 Pod 自动加上对 `not-ready` 和 `unreachable` 的容忍，默认 300 秒，这就是节点失联后大约 5 分钟 Pod 才被重建的原因：

```yaml
tolerations:   # 对故障切换敏感的服务可以缩短
  - {key: node.kubernetes.io/unreachable, operator: Exists, effect: NoExecute, tolerationSeconds: 60}
```

删除污点在末尾加 `-`：`kubectl taint nodes k8s-journey-worker2 dedicated=gpu:NoSchedule-`。

## 拓扑分布约束

`topologySpreadConstraints` 专为"均匀分布"设计，比反亲和更灵活：它允许一个拓扑域里放多个 Pod，只要求各域之间的数量差不超过 `maxSkew`。

```yaml title="topology-spread.yaml"
apiVersion: apps/v1
kind: Deployment
metadata: {name: zone-spread}
spec:
  replicas: 6
  selector: {matchLabels: {app: zone-spread}}
  template:
    metadata: {labels: {app: zone-spread}}
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule      # 硬约束；ScheduleAnyway 为软
          labelSelector:
            matchLabels: {app: zone-spread}
          matchLabelKeys: ["pod-template-hash"] # 只和同一版本的 Pod 比较
      containers:
        - {name: app, image: nginx:1.27}
```

```bash
kubectl apply -f topology-spread.yaml
kubectl get pods -l app=zone-spread -o wide --no-headers | awk '{print $7}' | sort | uniq -c
#   3 k8s-journey-worker
#   3 k8s-journey-worker2
```

`maxSkew: 1` 表示 zone-a 与 zone-b 的副本数之差最多为 1：3/3、4/3 都允许，5/3 不允许。

- 没有 zone 标签的节点（本例的 control-plane）不参与计算。
- `matchLabelKeys: ["pod-template-hash"]` 让滚动更新时新旧 ReplicaSet 分开计算，避免新版本 Pod 因旧 Pod 的分布而挤到一边。
- 约束只在**调度时**生效。节点增减后已有 Pod 不会自动重新均衡，需要借助 [descheduler](https://github.com/kubernetes-sigs/descheduler) 之类的工具。

## 优先级与抢占

### PriorityClass

资源不足时，重要的 Pod 应该能把不重要的挤出去。PriorityClass 给 Pod 定义一个整数优先级，数值越大越重要：

```yaml title="priority.yaml"
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: {name: high}
value: 100000
globalDefault: false        # 为 true 时作为未指定优先级 Pod 的默认值
description: "在线核心服务"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: {name: low}
value: 1000
# preemptionPolicy: Never   # 设置后本类 Pod 排队时优先，但不会抢占别人
```

系统内置了 `system-cluster-critical` 和 `system-node-critical` 两个高优先级类，保留给 CoreDNS、CNI 等关键组件，业务不要使用。

### 实验：观察抢占

把 `k8s-journey-worker` 的 CPU 用"低优先级"Pod 占满，再放一个"高优先级"Pod：

```yaml title="preempt-demo.yaml"
apiVersion: apps/v1
kind: Deployment
metadata: {name: low-batch}
spec:
  replicas: 2
  selector: {matchLabels: {app: low-batch}}
  template:
    metadata: {labels: {app: low-batch}}
    spec:
      priorityClassName: low
      nodeSelector: {kubernetes.io/hostname: k8s-journey-worker}
      containers:
        - {name: pause, image: registry.k8s.io/pause:3.10, resources: {requests: {cpu: REQ}}}
---
apiVersion: v1
kind: Pod
metadata: {name: vip}
spec:
  priorityClassName: high
  nodeSelector: {kubernetes.io/hostname: k8s-journey-worker}
  containers:
    - {name: pause, image: registry.k8s.io/pause:3.10, resources: {requests: {cpu: REQ}}}
```

kind 节点的可分配 CPU 等于宿主机核数，这里让每个 Pod 请求 40%：

```bash
kubectl apply -f priority.yaml
CPU=$(kubectl get node k8s-journey-worker -o jsonpath='{.status.allocatable.cpu}')   # 例如 8
REQ="$((CPU * 400))m"
sed "s/REQ/${REQ}/" preempt-demo.yaml | kubectl apply -f -
kubectl get pods -o wide -w
# vip 先 Pending，随后一个 low-batch Pod 被删除，vip 调度成功；
# 被删的 low-batch 重建后因资源不足而 Pending
kubectl get events --field-selector reason=Preempted
```

> [!PROD] 优先级的生产用法
> - 至少分三档：平台组件（使用系统内置类）、在线服务、离线/批处理。给离线任务低优先级，集群空闲时充分利用资源，在线流量上来时自动让位。
> - 抢占会尊重 PodDisruptionBudget，但只是"尽力而为"，无法保证不违反。
> - 在 ResourceQuota 中可以用 `scopeSelector` 按优先级类限制配额，防止所有人都把自己的 Pod 标成最高优先级。

## 节点维护：cordon 与 drain

升级内核、更换硬件前，需要把节点上的 Pod 安全迁走：

```bash
kubectl cordon k8s-journey-worker2        # 标记不可调度，已有 Pod 不受影响
kubectl get nodes                         # STATUS: Ready,SchedulingDisabled
kubectl drain k8s-journey-worker2 --ignore-daemonsets --delete-emptydir-data
# drain = cordon + 逐个驱逐（Eviction）节点上的 Pod
# ... 维护完成 ...
kubectl uncordon k8s-journey-worker2
```

- `--ignore-daemonsets`：DaemonSet 的 Pod 会被立刻重建回来，驱逐没有意义，跳过即可。
- `--delete-emptydir-data`：使用 emptyDir 的 Pod 数据会丢失，需要显式确认。
- 不受控制器管理的"裸 Pod"默认会阻止 drain，因为删了就没了；确认可以删除时加 `--force`。

drain 使用 Eviction API，会遵守 **PodDisruptionBudget（PDB）**。PDB 声明"这个应用最少保持几个副本可用"：

```yaml title="pdb.yaml"
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: spread-web}
spec:
  minAvailable: 2                # 或 maxUnavailable: 1
  selector: {matchLabels: {app: spread-web}}
```

如果驱逐会让可用副本低于 `minAvailable`，drain 会反复重试并输出 `Cannot evict pod as it would violate the pod's disruption budget`，直到其他地方有新副本就绪。

> [!WARNING] 过严的 PDB 会让节点无法维护
> `minAvailable` 等于副本数（或 `maxUnavailable: 0`）意味着永远不允许自愿驱逐，节点 drain 会一直卡住，集群升级也会卡住。单副本应用配 PDB 同理。PDB 应当留出至少一个副本的余量。

## 生产实践：把组件固定在控制平面节点

团队集群里，MetalLB、Gateway 控制器、存储 provisioner 等平台组件通常固定运行在管理节点上，把 GPU 工作节点完整留给业务。在这些组件的 Helm values 中统一写法是"节点亲和性 + 容忍控制平面污点"：

```yaml title="values.yml（节选）"
controller:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-role.kubernetes.io/control-plane
                operator: Exists
  tolerations:
    - {operator: Exists, effect: NoSchedule}
```

注意这里的容忍没有写 `key`，`operator: Exists` 会容忍**所有** `NoSchedule` 污点，写起来省事但范围很宽，只适合受信任的平台组件。GPU 节点则反过来打上污点，只有声明了容忍的训练和推理任务才能进入，详见阶段 5 的 [GPU Operator](/learn/gpu-operator)。

## 动手练习

1. 把 `spread-web` 的反亲和改为 `preferred`，副本数改为 5，观察分布情况。
2. 给 `k8s-journey-worker` 加一个 `NoExecute` 污点，观察节点上的 Pod 发生了什么；再给一个 Deployment 加上 `tolerationSeconds: 30` 的容忍，对比其行为。
3. 把 `zone-spread` 扩容到 7 个副本，然后把 `whenUnsatisfiable` 改为 `ScheduleAnyway`，比较两种情况下的分布。
4. 为 `spread-web` 创建 `minAvailable: 2` 的 PDB，在只有 2 个副本 Running 的情况下 drain 其中一个节点，观察输出；然后把 PDB 改为 `minAvailable: 1` 再试。

## 自测

<details>
<summary>nodeSelector 和 nodeAffinity 的 required 规则有什么区别？</summary>

两者都是硬约束。nodeSelector 只能表达"标签等于某值"且全部满足；nodeAffinity 支持 `In`、`NotIn`、`Exists`、`DoesNotExist`、`Gt`、`Lt` 等运算符，多个 `nodeSelectorTerms` 之间是"或"关系，并且还有 preferred 软偏好形式。

</details>

<details>
<summary>给节点加了污点，为什么上面原有的 Pod 没有被赶走？</summary>

`NoSchedule` 和 `PreferNoSchedule` 只影响新调度的 Pod，不影响已在运行的 Pod。只有 `NoExecute` 才会驱逐不容忍该污点的已有 Pod。

</details>

<details>
<summary>为什么给 Pod 加了 GPU 节点的容忍后，它仍然可能被调度到普通节点？</summary>

容忍只表示"允许"调度到带污点的节点，并不要求必须去。要让 Pod 只运行在 GPU 节点，还需要配合 nodeSelector 或节点亲和性。

</details>

<details>
<summary>6 个副本的 Deployment 用了按主机名的硬性 podAntiAffinity，在 3 个工作节点的集群里会怎样？</summary>

只有 3 个副本能调度成功，每个节点一个，其余 3 个一直 Pending，因为每个节点上都已有同标签的 Pod。可以改为 preferred 反亲和，或使用 `maxSkew: 1` 的拓扑分布约束（每个节点 2 个）。

</details>

<details>
<summary>drain 节点时一直提示 violate the pod's disruption budget，可能的原因和处理办法是什么？</summary>

驱逐该 Pod 会让应用的可用副本数低于 PDB 的要求。可能是 PDB 设置过严（如 `minAvailable` 等于副本数），或其他副本本身不健康、因资源或约束无法在别处调度。处理方式是先修复其他副本或扩容，使新副本就绪；必要时评估后调整 PDB。

</details>

## 参考资料

- [Kubernetes 官方文档：Kubernetes 调度器](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/kube-scheduler/)
- [Kubernetes 官方文档：将 Pod 指派给节点](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Kubernetes 官方文档：污点和容忍度](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/taint-and-toleration/)
- [Kubernetes 官方文档：Pod 拓扑分布约束](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/topology-spread-constraints/)
- [Kubernetes 官方文档：Pod 优先级和抢占](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/pod-priority-preemption/)
- [Kubernetes 官方文档：安全地清空一个节点](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/safely-drain-node/)
- [Kubernetes 官方文档：为应用程序设置干扰预算](https://kubernetes.io/zh-cn/docs/tasks/run-application/configure-pdb/)
- [Kubernetes 官方文档：众所周知的标签、注解和污点](https://kubernetes.io/zh-cn/docs/reference/labels-annotations-taints/)
