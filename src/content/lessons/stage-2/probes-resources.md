# 健康检查与资源管理

到目前为止，我们部署的 Pod 只要进程没退出，Kubernetes 就认为它"没问题"。但进程活着不等于服务可用：它可能死锁了、可能还在加载数据、可能内存吃光把整台节点拖垮。这一课解决两个问题：**让 Kubernetes 知道应用是否健康**（探针），以及**让应用只用它该用的资源**（requests/limits）。

学完之后，你能为一个 Web 应用正确配置 liveness、readiness、startup 三种探针，看懂 CPU 限流和 OOMKilled 的现象与原因，判断 Pod 的 QoS 等级，并用 LimitRange 和 ResourceQuota 给命名空间设置默认值与总量上限。

## 为什么需要探针

kubelet 默认只看容器主进程是否在运行。下面这些情况进程都"活着"，但服务已经不可用：

- 线程死锁，HTTP 请求全部卡住；
- Java 应用启动要 90 秒，前 90 秒端口已监听但返回 503；
- 依赖的数据库暂时连不上，应用自身正常但处理不了请求。

探针（Probe）就是 kubelet 定期对容器做的诊断。根据用途分三种：

| 探针 | 回答的问题 | 失败后果 |
|---|---|---|
| `livenessProbe` 存活探针 | 容器还"活着"吗？需要重启吗？ | kubelet **重启容器** |
| `readinessProbe` 就绪探针 | 现在能接收流量吗？ | 从 Service 的 EndpointSlice 中**摘除**，不重启 |
| `startupProbe` 启动探针 | 启动完成了吗？ | 启动完成前屏蔽另外两种探针；超过阈值则重启容器 |

```text
容器启动 ──▶ startupProbe 反复探测 ──成功──▶ livenessProbe + readinessProbe 周期运行
                 │                                   │                 │
            超过 failureThreshold               失败 → 重启容器     失败 → 摘除流量
                 ▼                                                    成功 → 恢复流量
             重启容器
```

### 探测方式与参数

每种探针都支持四种检查方式：`httpGet`（返回 200～399 视为成功）、`tcpSocket`（端口能连上即成功）、`exec`（命令退出码为 0 即成功）、`grpc`（调用 gRPC 健康检查协议）。

常用参数与默认值：

| 参数 | 默认值 | 含义 |
|---|---|---|
| `initialDelaySeconds` | 0 | 容器启动后多久开始探测 |
| `periodSeconds` | 10 | 探测间隔 |
| `timeoutSeconds` | 1 | 单次探测超时 |
| `failureThreshold` | 3 | 连续失败几次判定为失败 |
| `successThreshold` | 1 | 连续成功几次判定为恢复（liveness/startup 必须为 1） |

### 一个完整的例子

```yaml title="probe-demo.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: probe-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: probe-demo
  template:
    metadata:
      labels:
        app: probe-demo
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports:
            - name: http
              containerPort: 80
          startupProbe:            # 最多给 30 × 2 = 60 秒启动时间
            httpGet:
              path: /
              port: http
            periodSeconds: 2
            failureThreshold: 30
          readinessProbe:          # 就绪才接流量
            httpGet:
              path: /
              port: http
            periodSeconds: 5
          livenessProbe:           # 只检查进程自身是否卡死
            tcpSocket:
              port: http
            periodSeconds: 10
            failureThreshold: 3
```

```bash
kubectl apply -f probe-demo.yaml
kubectl get pods -l app=probe-demo -w
```

> [!LAB] 观察就绪探针摘除流量
> 删掉其中一个 Pod 的首页，让它的就绪探针失败：
>
> ```bash
> POD=$(kubectl get pod -l app=probe-demo -o jsonpath='{.items[0].metadata.name}')
> kubectl exec $POD -- rm /usr/share/nginx/html/index.html
> kubectl get pods -l app=probe-demo          # READY 变成 0/1，但 RESTARTS 不变
> kubectl describe pod $POD | grep -A3 Events  # Readiness probe failed: HTTP probe failed with statuscode: 403
> ```
>
> 这个 Pod 没有被重启，只是不再接收 Service 流量。再把文件写回去，它会重新变为 Ready：
> `kubectl exec $POD -- sh -c 'echo ok > /usr/share/nginx/html/index.html'`

### 常见误用

> [!WARNING] 探针配置最容易踩的坑
> 1. **liveness 检查外部依赖**：存活探针里去查数据库，数据库一抖，所有副本同时被重启，小故障变成全站雪崩。liveness 只检查进程自身；依赖是否可用交给 readiness（甚至不检查，由应用自己降级）。
> 2. **liveness 与 readiness 用同一个接口、同样阈值**：流量高峰时接口变慢，readiness 摘流量的同时 liveness 也把容器杀了。liveness 的阈值应该比 readiness 更宽松。
> 3. **用 `initialDelaySeconds` 应付慢启动**：设成 120 秒，平时启动只要 10 秒也要白等；偶尔启动 130 秒又被杀。慢启动应该用 startupProbe。
> 4. **`timeoutSeconds` 保持默认 1 秒**：GC 停顿或节点繁忙时很容易超时误判，生产中常设 2～5 秒。
> 5. **exec 探针调用重量级命令**：每 10 秒 fork 一次 `java -jar healthcheck.jar`，本身就是负担。

没有 readinessProbe 的后果在 [ReplicaSet 与 Deployment](/learn/deployments) 里提过：新 Pod 一启动就被视为可用，滚动更新会在应用真正准备好之前删掉旧 Pod。

## requests 与 limits

### 为什么需要声明资源

调度器需要知道一个 Pod 大概要多少资源，才能决定放到哪个节点；节点也需要一道防线，防止某个容器把整台机器的内存吃光。这两件事分别由 `requests` 和 `limits` 负责：

```yaml
resources:
  requests:        # 调度依据：节点上"已承诺"的资源
    cpu: 250m      # 0.25 核，1000m = 1 核
    memory: 128Mi
  limits:          # 运行时上限：由 cgroup 强制执行
    cpu: "1"
    memory: 256Mi
```

- **requests** 只影响调度和资源分配权重。调度器把节点的可分配量（Allocatable）减去所有 Pod 的 requests 之和，剩下的才能放新 Pod。实际用量可以超过 requests。
- **limits** 是硬上限。CPU 和内存超限的后果完全不同：

| 资源 | 超过 limits 时 | 性质 |
|---|---|---|
| CPU | 被 CFS 限流（throttling），进程变慢但不会被杀 | 可压缩资源 |
| 内存 | 触发内核 OOM Killer，容器被杀，状态为 `OOMKilled`，退出码 137 | 不可压缩资源 |

内存单位注意区分 `Mi`（2 的幂）和 `M`（10 的幂）；写成 `128m` 表示 0.128 字节，是经典笔误。

```bash
kubectl describe node k8s-journey-worker | grep -A8 "Allocated resources"
```

### 动手看 CPU 限流

```yaml title="cpu-throttle.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: cpu-throttle
spec:
  containers:
    - name: burn
      image: busybox:1.36
      command: ["sh", "-c", "while true; do :; done"]   # 死循环吃满一个核
      resources:
        requests:
          cpu: 100m
        limits:
          cpu: 200m
```

```bash
kubectl apply -f cpu-throttle.yaml
sleep 20
kubectl exec cpu-throttle -- cat /sys/fs/cgroup/cpu.max    # 20000 100000：每 100ms 周期只能用 20ms
kubectl exec cpu-throttle -- cat /sys/fs/cgroup/cpu.stat   # nr_throttled、throttled_usec 持续增长
```

`cpu.max` 就是 limits 在 cgroup v2 里的落地形式。延迟敏感的服务如果 CPU limits 设得太紧，即使节点空闲也会被限流，表现为 P99 延迟毛刺。

> [!PROD] CPU limits 要不要设？
> 社区有两种主流做法：一是**只设 CPU requests、不设 CPU limits**，让空闲 CPU 能被充分利用，靠 requests 保证公平；二是为多租户或计费场景设置 limits 以获得可预测性。无论哪种，**内存 limits 都应该设置**，并且通常建议内存 requests = limits，避免节点内存超卖导致的连锁驱逐。

### 动手看 OOMKilled

```yaml title="oom-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: oom-demo
spec:
  containers:
    - name: stress
      image: polinux/stress
      command: ["stress"]
      args: ["--vm", "1", "--vm-bytes", "250M", "--vm-hang", "1"]  # 尝试分配 250M
      resources:
        requests:
          memory: 50Mi
        limits:
          memory: 100Mi
```

```console
$ kubectl apply -f oom-demo.yaml
$ kubectl get pod oom-demo -w
NAME       READY   STATUS             RESTARTS      AGE
oom-demo   0/1     OOMKilled          0             5s
oom-demo   0/1     CrashLoopBackOff   1 (3s ago)    8s
$ kubectl get pod oom-demo -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
{"exitCode":137,"reason":"OOMKilled",...}
```

排查 OOMKilled 时先分清两种情况：`reason: OOMKilled` 是容器超过**自己的 limits**；如果 Pod 被驱逐（`Evicted`），则是**节点内存压力**导致 kubelet 驱逐。前者调 limits 或修内存泄漏，后者看节点超卖情况。

> [!NOTE] 原地调整资源
> 以前修改 requests/limits 必须重建 Pod。v1.35 起原地调整 Pod 资源（In-Place Pod Resize）已 GA，可以通过 `resize` 子资源修改运行中容器的 CPU/内存而不重启，例如 `kubectl patch pod cpu-throttle --subresource resize --patch '{"spec":{"containers":[{"name":"burn","resources":{"limits":{"cpu":"500m"}}}]}}'`。是否需要重启容器由 `resizePolicy` 决定。

## QoS 等级

当节点资源紧张时，kubelet 需要决定先牺牲谁。Kubernetes 根据 requests/limits 的设置，自动给每个 Pod 分配一个服务质量等级（QoS Class）：

| QoS | 条件 | 被驱逐/OOM 的优先级 |
|---|---|---|
| `Guaranteed` | **每个**容器都设置了 CPU 和内存的 requests 与 limits，且两者相等 | 最后 |
| `Burstable` | 至少一个容器设置了 CPU 或内存的 requests/limits，但不满足 Guaranteed | 中间 |
| `BestEffort` | 所有容器都没有设置任何 requests/limits | 最先 |

```bash
kubectl get pod cpu-throttle -o jsonpath='{.status.qosClass}'   # Burstable
kubectl get pod oom-demo -o jsonpath='{.status.qosClass}'       # Burstable
```

只设 limits 不设 requests 时，Kubernetes 会把 requests 默认成与 limits 相等，所以只写了 CPU 和内存 limits 的 Pod 也是 Guaranteed。

节点内存压力时，kubelet 大致按"是否超出 requests → Pod 优先级 → 超出 requests 的多少"排序驱逐，BestEffort 因为 requests 为 0 首当其冲。数据库、控制面组件这类关键负载，应该配置成 Guaranteed。

## LimitRange：命名空间内的默认值与边界

总有人忘记写 resources。LimitRange 是命名空间级别的准入策略，可以自动补默认值并限制单个容器的上下限：

```yaml title="limitrange.yaml"
apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: team-a
spec:
  limits:
    - type: Container
      defaultRequest:     # 没写 requests 时补上
        cpu: 100m
        memory: 128Mi
      default:            # 没写 limits 时补上
        cpu: 500m
        memory: 256Mi
      min:
        cpu: 50m
        memory: 64Mi
      max:
        cpu: "2"
        memory: 2Gi
```

```bash
kubectl create namespace team-a
kubectl apply -f limitrange.yaml
kubectl -n team-a run nolimit --image=nginx:1.27
kubectl -n team-a get pod nolimit -o jsonpath='{.spec.containers[0].resources}'
# {"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}
kubectl -n team-a run toobig --image=nginx:1.27 --overrides='{"spec":{"containers":[{"name":"toobig","image":"nginx:1.27","resources":{"limits":{"memory":"4Gi"}}}]}}'
# Error ... maximum memory usage per Container is 2Gi, but limit is 4Gi
```

LimitRange 只在 Pod **创建时**生效，修改 LimitRange 不会影响已有 Pod。

## ResourceQuota：命名空间的总量上限

LimitRange 管"单个"，ResourceQuota 管"总和"。它常用于多团队共享集群，给每个命名空间划定预算：

```yaml title="quota.yaml"
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    persistentvolumeclaims: "10"
    requests.storage: 100Gi
    count/deployments.apps: "10"
```

```console
$ kubectl apply -f quota.yaml
$ kubectl -n team-a describe resourcequota team-a-quota
Resource               Used   Hard
--------               ----   ----
limits.cpu             500m   8
limits.memory          256Mi  16Gi
pods                   1      20
requests.cpu           100m   4
...
```

> [!TIP] Quota 与 LimitRange 搭配使用
> 一旦对 `requests.cpu` 等计算资源设置了配额，该命名空间里**没有声明对应 requests/limits 的 Pod 会被拒绝创建**。所以配额通常和 LimitRange 一起下发，由 LimitRange 补默认值。注意 Deployment 本身能创建成功，被拒绝的是它的 Pod——要到 ReplicaSet 的事件里（`kubectl describe rs`）才能看到 `exceeded quota` 错误。

> [!PROD] 生产里的资源治理
> - 以真实监控数据（P95/P99 用量）为依据设置 requests，而不是拍脑袋；阶段 3 的[自动扩缩容](/learn/autoscaling)会介绍 VPA 给出推荐值。
> - 为每个业务命名空间下发 LimitRange + ResourceQuota，作为平台的默认策略。
> - 关注节点的 `kubectl describe node` 中 requests 总和与实际用量的差距，差距过大说明 requests 虚高、资源被"占而不用"。

## 动手练习

1. 部署 `probe-demo`，把 livenessProbe 改成检查一个不存在的路径 `/healthz`，观察 RESTARTS 如何增长，以及 `kubectl describe pod` 中的事件。
2. 写一个启动需要 40 秒的容器（`sh -c 'sleep 40; httpd -f -p 8080'`，镜像 busybox），分别用"只有 livenessProbe（failureThreshold 3、period 10）"和"加上 startupProbe"两种方式部署，对比结果。
3. 调整 `oom-demo` 的 memory limits，找到它刚好不被 OOMKilled 的值，并确认此时的 QoS 等级。
4. 在 `team-a` 命名空间创建一个 `replicas: 30` 的 Deployment，观察配额生效后实际创建了几个 Pod，并在 ReplicaSet 事件中找到原因。

## 自测

<details>
<summary>就绪探针失败和存活探针失败，分别会发生什么？</summary>

就绪探针失败：Pod 被标记为 NotReady，从 Service 的 EndpointSlice 中摘除，不再接收流量，但容器**不会重启**。存活探针失败：kubelet 按 `restartPolicy` **重启容器**，RESTARTS 计数加一。

</details>

<details>
<summary>为什么不建议在 livenessProbe 中检查数据库连接？</summary>

数据库故障时所有副本的存活探针会同时失败，全部被重启；重启又无法修复数据库，只会造成反复重启、启动风暴和更长的恢复时间。依赖可用性应该由 readinessProbe 或应用自身的降级逻辑处理。

</details>

<details>
<summary>一个容器 CPU 用量超过 limits 和内存超过 limits，现象有什么不同？</summary>

CPU 是可压缩资源，超限时被 CFS 限流，进程变慢但继续运行；内存是不可压缩资源，超限会被 OOM Killer 杀掉，状态为 `OOMKilled`、退出码 137。

</details>

<details>
<summary>一个 Pod 有两个容器，都设置了 CPU 和内存的 limits，但没写 requests，它的 QoS 是什么？</summary>

`Guaranteed`。未设置 requests 时会默认等于 limits，于是每个容器的 CPU 和内存 requests 都等于 limits，满足 Guaranteed 条件。

</details>

<details>
<summary>设置了 ResourceQuota 后，某个 Deployment 的 Pod 一直创建不出来，但 Deployment 本身没有报错，去哪里看原因？</summary>

Pod 是由 ReplicaSet 创建的，被配额拒绝的错误记录在 ReplicaSet 的事件里：`kubectl describe rs <name>`，可以看到 `exceeded quota` 或 `must specify limits` 之类的信息。

</details>

## 参考资料

- [Kubernetes 官方文档：配置存活、就绪和启动探针](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Kubernetes 官方文档：为 Pod 和容器管理资源](https://kubernetes.io/zh-cn/docs/concepts/configuration/manage-resources-containers/)
- [Kubernetes 官方文档：为容器和 Pod 分配内存资源](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/assign-memory-resource/)
- [Kubernetes 官方文档：Pod 服务质量类](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-qos/)
- [Kubernetes 官方文档：限制范围（LimitRange）](https://kubernetes.io/zh-cn/docs/concepts/policy/limit-range/)
- [Kubernetes 官方文档：资源配额](https://kubernetes.io/zh-cn/docs/concepts/policy/resource-quotas/)
- [Kubernetes 官方文档：调整分配给容器的 CPU 和内存资源](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/resize-container-resources/)
