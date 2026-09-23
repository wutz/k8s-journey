# 自动扩缩容

业务流量从来不是一条直线：白天高峰、夜里低谷，大促时瞬间翻十倍。副本数写死，要么高峰扛不住，要么低谷白白烧钱。在 [健康检查与资源管理](/learn/probes-resources) 里我们学会了给容器设 requests/limits，这些数字本身也很难一次拍准。

Kubernetes 的自动扩缩分三个层次：**水平扩缩（HPA）** 调整 Pod 数量，**垂直扩缩（VPA）** 调整每个 Pod 的资源，**节点扩缩（Cluster Autoscaler / Karpenter）** 调整机器数量。这一课依次讲清它们的原理和配合方式，并在 kind 集群里用压测亲眼看 HPA 把副本从 1 扩到多个再缩回来。

## 三层扩缩全景

```text
                      指标来源
     metrics-server（CPU/内存）  Prometheus Adapter / KEDA（自定义、外部指标）
                 │                         │
                 ▼                         ▼
      ┌──────────────────┐      ┌──────────────────┐
      │ HPA：改 replicas  │      │ VPA：改 requests  │
      └────────┬─────────┘      └────────┬─────────┘
               │  Pod 变多 / 变大，节点放不下 → Pending
               ▼
   ┌──────────────────────────────────────────────┐
   │ Cluster Autoscaler / Karpenter：加节点、删空闲节点 │
   └──────────────────────────────────────────────┘
```

它们都是 [控制平面深入](/learn/control-plane) 里讲过的控制循环：周期性读取指标，计算期望值，写回对象。

## metrics-server：资源指标管道

HPA 要知道 Pod 用了多少 CPU，数据来自 **Metrics API**（`metrics.k8s.io`）。它的标准实现是 metrics-server：定期从每个 kubelet 的 `/metrics/resource` 端点抓取容器的 CPU 和内存用量，在内存中保存最新值，通过 apiserver 的聚合层（API Aggregation）对外提供。

- 它只保留最近一次采样，**不是监控系统**，没有历史数据，长期指标请用 [可观测性](/learn/observability) 一课的 VictoriaMetrics/Prometheus。
- `kubectl top` 也依赖它。

在 kind 中安装。kind 的 kubelet 使用自签证书，需要加 `--kubelet-insecure-tls`（生产集群应为 kubelet 配置正规签发的服务证书，不要加这个参数）：

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set replicas=1 \
  --set 'args={--kubelet-insecure-tls}'

kubectl -n kube-system rollout status deploy/metrics-server
kubectl get apiservice v1beta1.metrics.k8s.io     # AVAILABLE 应为 True
kubectl top nodes
kubectl top pods -A --sort-by=cpu | head
```

> [!PROD] 生产部署
> 生产环境通常以 Helm Chart 部署（Chart 版本截至本文写作时为 3.13.x，请以官方发布为准），并把副本数设为 2 且配置反亲和，避免单点：metrics-server 不可用时，所有基于资源指标的 HPA 都会停止工作（`FailedGetResourceMetric`），`kubectl top` 也会失败。

## HPA：水平扩缩

HorizontalPodAutoscaler 使用 `autoscaling/v2` API（v1.23 起稳定）。控制器默认每 15 秒执行一次：

```text
期望副本数 = ceil( 当前副本数 × 当前指标值 / 目标指标值 )
```

例如 3 个副本，平均 CPU 利用率 90%，目标 60%：`ceil(3 × 90 / 60) = 5`。几个细节：

- **利用率是相对 requests 计算的**。容器没设 CPU requests，HPA 就无法计算 CPU 利用率，会报 `missing request for cpu`。
- 比值在 1 附近的容忍区间内（默认 ±10%）不触发扩缩，避免抖动。
- 多个指标时分别计算，**取最大的副本数**。
- 未就绪的 Pod 和刚启动的 Pod 会被特殊处理，避免启动时 CPU 尖峰导致误扩。

### 一个完整的 HPA

```yaml title="web-hpa.yaml"
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60        # 相对 requests 的百分比
    - type: Resource
      resource:
        name: memory
        target:
          type: AverageValue
          averageValue: 400Mi           # 也可以用绝对值
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0     # 扩容立即响应
      policies:
        - type: Percent
          value: 100                    # 每 15 秒最多翻倍
          periodSeconds: 15
        - type: Pods
          value: 4                      # 或最多加 4 个
          periodSeconds: 15
      selectPolicy: Max                 # 取两者中更激进的
    scaleDown:
      stabilizationWindowSeconds: 300   # 取过去 5 分钟内的最大建议值，防止锯齿
      policies:
        - type: Percent
          value: 20                     # 每分钟最多缩 20%
          periodSeconds: 60
```

`behavior` 是 v2 最实用的部分：**扩容要快、缩容要慢**。默认的缩容稳定窗口就是 300 秒，大多数场景够用；对启动很慢的 Java 服务，可以进一步放缓缩容。

> [!WARNING] 内存指标要谨慎
> 很多运行时（JVM、Go、Node.js）内存上去了不会主动还给系统，负载降下来后内存用量也不降，HPA 就永远缩不回去。内存更适合作为防止 OOM 的"兜底"指标，主要扩缩依据用 CPU 或业务指标（QPS、队列长度）。

### 自定义指标与外部指标

除 `Resource` 外，`metrics` 还支持：

| 类型 | 来源 API | 例子 |
|---|---|---|
| `Pods` | `custom.metrics.k8s.io` | 每个 Pod 的平均 QPS |
| `Object` | `custom.metrics.k8s.io` | 某个 Ingress 的总请求速率 |
| `External` | `external.metrics.k8s.io` | 消息队列长度、云监控指标 |
| `ContainerResource` | `metrics.k8s.io` | 只看主容器的 CPU，忽略 sidecar |

custom/external 两个 API 需要一个适配器实现，常见的是 Prometheus Adapter 或 KEDA。以每 Pod QPS 为例：

```yaml title="hpa-qps.yaml"
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"          # 每个 Pod 平均 100 QPS
```

### 与 Deployment 配合的注意事项

- 启用 HPA 后，**不要在 Deployment 清单里再写 `replicas`**，否则每次 `kubectl apply`、Helm 升级或 GitOps 同步都会把副本数改回清单里的值，和 HPA 来回打架。
- `minReplicas` 至少设 2，配合 PodDisruptionBudget，保证节点维护时服务不中断。
- 就绪探针要准确：新 Pod 就绪之前不分担流量，HPA 会看到指标仍然很高而继续扩容。

## 动手：在 kind 中压测演示 HPA

> [!LAB] HPA 扩缩全过程
> 前提：已按上文安装 metrics-server，`kubectl top nodes` 能看到数据。

1. 部署一个会消耗 CPU 的应用，注意设置 CPU requests：

```yaml title="php-apache.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: php-apache
spec:
  selector:
    matchLabels: { run: php-apache }
  template:
    metadata:
      labels: { run: php-apache }
    spec:
      containers:
        - name: php-apache
          image: registry.k8s.io/hpa-example
          ports:
            - containerPort: 80
          resources:
            requests: { cpu: 200m }
            limits: { cpu: 500m }
---
apiVersion: v1
kind: Service
metadata:
  name: php-apache
spec:
  selector: { run: php-apache }
  ports:
    - port: 80
```

```bash
kubectl apply -f php-apache.yaml
kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=8
kubectl get hpa php-apache
# NAME         REFERENCE               TARGETS       MINPODS   MAXPODS   REPLICAS
# php-apache   Deployment/php-apache   cpu: 0%/50%   1         8         1
```

2. 另开一个终端持续观察：

```bash
kubectl get hpa php-apache --watch
```

3. 再开一个终端施加负载（每个请求都会让 php 做一段计算）：

```bash
kubectl run load-generator --rm -it --image=busybox:1.36 --restart=Never -- \
  /bin/sh -c "while sleep 0.01; do wget -q -O- http://php-apache; done"
```

4. 一两分钟后，TARGETS 升到 200% 以上，REPLICAS 按公式逐步增加，直到平均利用率回到 50% 左右。查看决策过程：

```bash
kubectl describe hpa php-apache | sed -n '/Conditions/,$p'
# Normal  SuccessfulRescale  New size: 4; reason: cpu resource utilization (percentage of request) above target
```

5. 在负载终端按 `Ctrl+C` 停止压测。副本数不会立刻下降——要等默认 5 分钟的缩容稳定窗口过去，才会逐步缩回 1。

## VPA：垂直扩缩

HPA 解决"几个 Pod"，**VerticalPodAutoscaler** 解决"每个 Pod 要多大"。它不是 Kubernetes 内置组件，需要从 [kubernetes/autoscaler](https://github.com/kubernetes/autoscaler) 单独安装，包含三个组件：

- **Recommender**：根据历史用量计算推荐的 requests。
- **Updater**：发现 Pod 资源与推荐值偏差太大时，让它按新值更新。
- **Admission Controller**：在 Pod 创建时把 requests 改成推荐值。

```yaml title="web-vpa.yaml"
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  updatePolicy:
    updateMode: "Off"          # 只给建议，不动 Pod
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed: { cpu: 50m, memory: 64Mi }
        maxAllowed: { cpu: "2", memory: 2Gi }
```

`updateMode` 的取值：

| 模式 | 行为 |
|---|---|
| `Off` | 只计算推荐值，写在 `status.recommendation` 里 |
| `Initial` | 只在 Pod 创建时设置，不驱逐运行中的 Pod |
| `Recreate` | 必要时驱逐 Pod 让它按新值重建 |
| `InPlaceOrRecreate` | 优先利用 Pod 原地调整资源（In-place Pod Resize），不行再重建 |

> [!TIP] 最稳妥的用法
> 生产中最常见也最安全的用法是 `updateMode: "Off"`：让 VPA 观察一两周，用 `kubectl describe vpa web` 查看推荐值，再人工把合理的数字写回清单。这就是"requests 到底该设多少"的数据来源。
>
> 注意：**不要让 VPA 和 HPA 同时基于同一个 CPU/内存指标工作**。VPA 调大 requests 会让利用率下降，HPA 随之缩容，两者互相干扰。组合使用时，HPA 应基于自定义指标（如 QPS）。

Pod 原地调整资源（修改运行中容器的 CPU/内存而不重启）是近几个版本逐步稳定下来的特性，它让 VPA 的自动模式对有状态和启动慢的应用更友好。具体可用程度请以你所用的 Kubernetes 与 VPA 版本说明为准。

## 节点扩缩：Cluster Autoscaler 与 Karpenter

HPA 把副本扩到 20 个，节点装不下，新 Pod 就会 `Pending`。节点扩缩器正是以"有因资源不足而无法调度的 Pod"为信号的：

**Cluster Autoscaler（CA）**

- 基于预先定义的**节点组**（云上的 Auto Scaling Group、节点池）工作。
- 发现 Pending Pod 时，模拟调度"如果某个节点组加一台，这个 Pod 能不能放下"，能就调用云 API 扩容该节点组。
- 周期性检查利用率低的节点，如果其上 Pod 都能挪到别处，就驱逐并删除节点。会尊重 PDB，带本地存储或 `cluster-autoscaler.kubernetes.io/safe-to-evict: "false"` 注解的 Pod 会阻止缩容。

**Karpenter**

- 不依赖预定义节点组，直接根据 Pending Pod 的需求（CPU、内存、GPU、架构、可用区、竞价实例）**即时挑选最合适的机型**创建节点。
- 支持节点整合（Consolidation）：主动把零散 Pod 合并到更少更便宜的节点上。
- 最初由 AWS 开源，现已捐给 Kubernetes SIG Autoscaling，其他云厂商也在提供实现。

> [!NOTE] 裸金属集群怎么办
> 自建机房的物理机没有"调用 API 就多一台机器"的能力，CA/Karpenter 一般用不上。常见做法是按峰值容量规划节点，用优先级和抢占保障核心业务，把离线任务作为低优先级负载"填谷"，扩容节点则走 [Day-2 运维](/learn/day2-operations) 中的流程。

## KEDA：事件驱动扩缩

HPA 最小只能缩到 1 个副本（缩到 0 需要开启 alpha 特性门控）。很多异步任务（消费消息队列、处理上传文件）在没有消息时完全不需要运行。[KEDA](https://keda.sh/)（Kubernetes Event-driven Autoscaling，CNCF 毕业项目）解决这个问题：

- 内置数十种 **Scaler**：Kafka、RabbitMQ、Redis、Prometheus 查询、Cron、云队列等。
- 用户创建 `ScaledObject`，KEDA 负责在 0 ↔ 1 之间激活/停用工作负载，并自动生成一个 HPA 处理 1 ↔ N 的扩缩，同时作为 external metrics 适配器为这个 HPA 提供指标。

```yaml title="keda-rabbitmq.yaml"
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-worker
spec:
  scaleTargetRef:
    name: order-worker            # Deployment 名
  minReplicaCount: 0              # 没消息时缩到 0
  maxReplicaCount: 30
  cooldownPeriod: 300
  triggers:
    - type: rabbitmq
      metadata:
        queueName: orders
        mode: QueueLength
        value: "20"               # 每个副本负责 20 条积压消息
      authenticationRef:
        name: rabbitmq-auth
```

在大模型推理服务中，也常用 KEDA 基于 Prometheus 中的排队请求数、GPU KV Cache 使用率等指标扩缩推理副本，这部分会在 [大模型推理服务](/learn/llm-inference) 中展开。

## 动手练习

1. 安装 metrics-server，分别用 `kubectl top pod --containers` 和 `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods | jq` 查看同一份数据。
2. 完成本课的 php-apache 压测 LAB，记录从施压到副本数稳定所用的时间，以及停止压测后开始缩容的时间。
3. 把 php-apache 的 HPA 改为 YAML 管理，添加 `behavior.scaleDown.stabilizationWindowSeconds: 30`，重新压测，对比缩容速度。
4. 删除 php-apache 容器的 CPU requests 后重新部署，观察 `kubectl describe hpa` 中出现的错误。
5. （可选）安装 VPA，给 php-apache 创建 `updateMode: "Off"` 的 VPA，施压几分钟后查看它给出的推荐值。

## 自测

<details>
<summary>HPA 当前有 4 个副本，平均 CPU 利用率 30%，目标 60%，minReplicas 为 3，期望副本数是多少？</summary>

`ceil(4 × 30 / 60) = 2`，但不能低于 minReplicas，所以是 3。另外缩容受 `behavior.scaleDown` 的稳定窗口（默认 300 秒）约束，不会立即执行。

</details>

<details>
<summary>为什么容器必须设置 CPU requests，HPA 才能按 CPU 利用率扩缩？</summary>

`Utilization` 类型的目标是"实际用量 / requests"的百分比。没有 requests，分母不存在，HPA 无法计算，会报 `missing request for cpu`。（使用 `AverageValue` 绝对值目标则不需要 requests，但仍强烈建议设置。）

</details>

<details>
<summary>启用了 HPA 的 Deployment，清单里写着 replicas: 3，会有什么问题？</summary>

每次 `kubectl apply`、Helm 升级或 GitOps 同步都会把副本数重置为 3，覆盖 HPA 的计算结果，导致副本数突变。应从清单中删除 `replicas` 字段，让 HPA 独占管理。

</details>

<details>
<summary>metrics-server 挂了会发生什么？能用它替代 Prometheus 吗？</summary>

基于资源指标的 HPA 无法获取数据，停止扩缩（保持当前副本数），`kubectl top` 失败。不能替代 Prometheus：metrics-server 只在内存中保存最新一次采样，没有历史数据和查询能力，只服务于自动扩缩和 `kubectl top`。

</details>

<details>
<summary>Cluster Autoscaler 以什么作为扩容节点的信号？为什么 CPU 利用率高不会触发扩容？</summary>

以"因资源不足而无法调度的 Pending Pod"为信号，并模拟调度确认新节点能放下它们。调度依据的是 requests 而不是实际用量，节点 CPU 利用率再高，只要 Pod 都能调度，就不需要新节点；Pod 数量的增加由 HPA 负责。

</details>

## 参考资料

- [Kubernetes 官方文档：自动扩缩工作负载](https://kubernetes.io/zh-cn/docs/concepts/workloads/autoscaling/)
- [Kubernetes 官方文档：Pod 水平自动扩缩](https://kubernetes.io/zh-cn/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes 官方文档：HorizontalPodAutoscaler 演练](https://kubernetes.io/zh-cn/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
- [Kubernetes 官方文档：资源指标管道](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- [Kubernetes 官方文档：节点自动扩缩](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/node-autoscaling/)
- [metrics-server](https://github.com/kubernetes-sigs/metrics-server)
- [Vertical Pod Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [Karpenter](https://karpenter.sh/)
- [KEDA](https://keda.sh/)
