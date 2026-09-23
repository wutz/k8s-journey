# Job、CronJob 与 DaemonSet

Deployment 和 StatefulSet 管理的都是"一直运行"的服务：进程退出了就重启。但很多工作不是这样的：数据库迁移跑完就该结束，报表每天凌晨生成一次，日志采集器要在**每个节点**上各跑一份。这三类需求分别对应 Job、CronJob 和 DaemonSet。

学完这一课，你能用 Job 运行一次性和并行批处理任务，配置失败重试、超时与自动清理；用 CronJob 做带时区的定时任务并选择合适的并发策略；用 DaemonSet 在每个（或部分）节点上运行守护进程，并控制它的更新节奏。

## Job：运行到完成

### 最简单的 Job

```yaml title="job-pi.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: pi
spec:
  backoffLimit: 4                 # 最多重试 4 次（默认 6）
  activeDeadlineSeconds: 300      # 整个 Job 最多运行 5 分钟
  ttlSecondsAfterFinished: 600    # 结束 10 分钟后自动删除 Job 及其 Pod
  template:
    spec:
      restartPolicy: Never        # Job 只允许 Never 或 OnFailure
      containers:
        - name: pi
          image: perl:5.40
          command: ["perl", "-Mbignum=bpi", "-wle", "print bpi(2000)"]
```

```console
$ kubectl apply -f job-pi.yaml
$ kubectl get job pi -w
NAME   STATUS     COMPLETIONS   DURATION   AGE
pi     Running    0/1           5s         5s
pi     Complete   1/1           28s        28s
$ kubectl logs job/pi | head -c 60
3.14159265358979323846264338327950288419716939937510582097
```

Job 控制器的职责是：创建 Pod，观察它们是否**成功退出（退出码 0）**，直到成功次数达到要求。

### 失败与重试

```yaml title="job-fail.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: always-fail
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: fail
          image: busybox:1.36
          command: ["sh", "-c", "echo trying; exit 1"]
```

```bash
kubectl apply -f job-fail.yaml
kubectl get pods -l job-name=always-fail -w   # 依次出现 3 个 Error 的 Pod，间隔越来越长
kubectl describe job always-fail | tail -5    # Warning  BackoffLimitExceeded  Job has reached the specified backoff limit
```

几个关键点：

- 重试间隔按指数退避：10 秒、20 秒、40 秒……上限 6 分钟。
- `restartPolicy: Never` 时每次失败都会新建一个 Pod，失败 Pod 保留下来方便看日志；`OnFailure` 则在原 Pod 内重启容器，日志会被覆盖。排查问题阶段推荐 `Never`。
- `activeDeadlineSeconds` 优先级高于 `backoffLimit`：到时间了不管还剩几次重试都会终止。

> [!TIP] 更精细的失败处理
> 并非所有失败都值得重试。`podFailurePolicy`（要求 `restartPolicy: Never`）可以按退出码或 Pod 状况决定动作：例如退出码 42 表示"输入数据有误"，直接让整个 Job 失败；节点被驱逐导致的失败则忽略，不计入 `backoffLimit`：
>
> ```yaml
> podFailurePolicy:
>   rules:
>     - action: FailJob
>       onExitCodes:
>         operator: In
>         values: [42]
>     - action: Ignore
>       onPodConditions:
>         - type: DisruptionTarget
> ```

### 并行：completions 与 parallelism

| 字段 | 含义 |
|---|---|
| `completions` | 需要成功完成多少个 Pod，默认 1 |
| `parallelism` | 同时最多运行多少个 Pod，默认 1 |

```text
completions: 6, parallelism: 2

时间 ──▶
槽位1: [Pod-a ✓] [Pod-c ✓] [Pod-e ✓]
槽位2: [Pod-b ✓] [Pod-d ✓] [Pod-f ✓]      → 6/6 Complete
```

但普通模式下这 6 个 Pod 完全一样，它们怎么知道各自处理哪一部分数据？要么从外部工作队列里抢任务，要么用 Indexed Job。

### Indexed Job：给每个 Pod 分配编号

`completionMode: Indexed` 让每个 Pod 获得一个 0 到 `completions-1` 的索引，通过环境变量 `JOB_COMPLETION_INDEX` 传给容器，非常适合"把数据切成 N 片，每片一个 Pod"：

```yaml title="job-indexed.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: indexed-demo
spec:
  completions: 5
  parallelism: 2
  completionMode: Indexed
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              FILES="a.csv b.csv c.csv d.csv e.csv"
              i=0
              for f in $FILES; do
                if [ "$i" = "$JOB_COMPLETION_INDEX" ]; then
                  echo "index=$JOB_COMPLETION_INDEX processing $f on $(hostname)"
                fi
                i=$((i+1))
              done
              sleep 5
```

```bash
kubectl apply -f job-indexed.yaml
kubectl get pods -l job-name=indexed-demo \
  -L batch.kubernetes.io/job-completion-index
kubectl logs -l job-name=indexed-demo --prefix
```

同一索引失败重试时，新 Pod 仍拿到同一个索引。配合 `backoffLimitPerIndex` 还可以让每个索引独立计算重试次数，一片数据反复失败不会拖垮其他分片。

> [!NOTE] 大规模批处理
> 分布式训练、需要"要么全部启动要么都不启动"的任务，单靠 Job 不够。阶段 5 的[批调度](/learn/batch-scheduling)会介绍 Kueue、Volcano 以及 JobSet 这类更高层的抽象。

### 清理已完成的 Job

完成的 Job 和它的 Pod 不会自动删除，时间长了 `kubectl get pods` 会被 Completed 的 Pod 刷屏，etcd 里也堆满对象。设置 `ttlSecondsAfterFinished`，由 TTL 控制器在 Job 结束（成功或失败）后自动级联删除。手动清理则用 `kubectl delete job <name>`，Pod 会一并删除。

## CronJob：定时任务

CronJob 按 Cron 表达式周期性地创建 Job，关系是 CronJob → Job → Pod。

```yaml title="cronjob-report.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: report
spec:
  schedule: "*/1 * * * *"          # 分 时 日 月 周；这里每分钟一次，方便观察
  timeZone: "Asia/Shanghai"         # 不写则使用 kube-controller-manager 所在时区
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 60
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 1
      ttlSecondsAfterFinished: 3600
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: report
              image: busybox:1.36
              command: ["sh", "-c", "date; echo generating report; sleep 90"]
```

```bash
kubectl apply -f cronjob-report.yaml
kubectl get cronjob report
kubectl get jobs -w                 # 每分钟一个，但因为 sleep 90 + Forbid，会跳过部分调度
kubectl create job report-manual --from=cronjob/report   # 立即手动触发一次
```

### 并发策略

任务执行时间可能比调度间隔还长。`concurrencyPolicy` 决定上一次还没跑完时怎么办：

| 策略 | 行为 | 适用 |
|---|---|---|
| `Allow`（默认） | 允许多个 Job 同时运行 | 任务彼此独立、幂等 |
| `Forbid` | 上一次未结束则跳过本次 | 报表、备份等不能重叠的任务 |
| `Replace` | 终止正在运行的 Job，用新的替换 | 只关心最新一次结果 |

### 时区与错过的调度

- `timeZone` 字段接受 IANA 时区名，如 `Asia/Shanghai`、`UTC`。**不要**在 `schedule` 里写 `CRON_TZ=` 或 `TZ=`，Kubernetes 不支持并会拒绝。
- `startingDeadlineSeconds`：如果因为控制器宕机等原因错过了调度时间，超过这个秒数就不再补跑。
- 如果错过的调度次数超过 100 次（且没有设置 `startingDeadlineSeconds`），CronJob 会记录错误并不再补跑，因此长时间暂停后恢复的 CronJob 最好设置这个字段。
- 临时停用：`kubectl patch cronjob report -p '{"spec":{"suspend":true}}'`。

> [!WARNING] 任务必须幂等
> CronJob 只保证"大约"在计划时间创建 Job，极端情况下可能创建两次，也可能一次都没创建。任务逻辑应当是幂等的，重复执行不会造成重复扣款、重复发送之类的问题。

## DaemonSet：每个节点一个

### 为什么需要它

有些组件天然是"每个节点一份"的：日志采集（Fluent Bit、Vector）、节点监控（node-exporter）、CNI 插件（Cilium agent）、存储插件（CSI node 组件）、GPU 设备插件。用 Deployment 无法保证每个节点恰好一个，新节点加入时也不会自动补上。DaemonSet 会在每个符合条件的节点上运行一个 Pod，节点加入就创建、节点移除就回收。

```yaml title="node-agent.yaml"
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: node-agent
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1            # 一次更新一个节点（默认值）
  template:
    metadata:
      labels:
        app: node-agent
    spec:
      tolerations:                 # 容忍控制平面污点，让控制平面节点也运行
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: agent
          image: busybox:1.36
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          command:
            - sh
            - -c
            - while true; do echo "$NODE_NAME has $(ls /host/var/log/pods | wc -l) pod log dirs"; sleep 30; done
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              memory: 32Mi
          volumeMounts:
            - name: varlog
              mountPath: /host/var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

```console
$ kubectl apply -f node-agent.yaml
$ kubectl -n kube-system get ds node-agent
NAME         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
node-agent   3         3         3       3            3           <none>          20s
$ kubectl -n kube-system get pods -l app=node-agent -o wide
$ kubectl -n kube-system logs -l app=node-agent --prefix
```

去掉 `tolerations` 再 apply，DESIRED 会变成 2：控制平面节点带有 `node-role.kubernetes.io/control-plane:NoSchedule` 污点。污点与容忍的细节在[调度](/learn/scheduling)一课讲解。

### 只在部分节点运行

用 `nodeSelector` 或节点亲和性限定范围，例如只在 GPU 节点上运行设备插件：

```yaml
spec:
  template:
    spec:
      nodeSelector:
        gpu: "true"
```

```bash
kubectl label node k8s-journey-worker gpu=true   # 打上标签后 DaemonSet 立刻在该节点创建 Pod
kubectl label node k8s-journey-worker gpu-       # 删除标签后 Pod 被回收
```

DaemonSet 还会自动为 Pod 添加一组容忍，例如 `node.kubernetes.io/not-ready`、`node.kubernetes.io/unreachable`（NoExecute）以及 `disk-pressure`、`memory-pressure`、`unschedulable` 等，确保节点出问题或被 cordon 时守护进程依然在岗。

### 更新策略

| 策略 | 行为 |
|---|---|
| `RollingUpdate`（默认） | 修改模板后自动逐节点替换。`maxUnavailable` 控制同时不可用的节点数（可写百分比）；`maxSurge` 允许先在节点上启动新 Pod 再删旧 Pod，减少中断 |
| `OnDelete` | 只有手动删除旧 Pod 时才创建新版本，适合需要逐台人工确认的关键组件 |

```bash
kubectl -n kube-system set image ds/node-agent agent=busybox:1.37
kubectl -n kube-system rollout status ds/node-agent
kubectl -n kube-system rollout history ds/node-agent
kubectl -n kube-system rollout undo ds/node-agent
```

> [!PROD] DaemonSet 的资源账
> DaemonSet 的开销要乘以节点数。生产集群里 CNI、kube-proxy、日志、监控、存储、GPU 等 DaemonSet 加起来，每个节点可能固定占用 1～2 核和数 GB 内存。规划节点容量时要把这部分扣掉，并为关键 DaemonSet 设置较高的 PriorityClass（如 `system-node-critical`），保证它们不会因为节点资源紧张而无法调度。大规模集群中 `maxUnavailable` 可以用百分比（如 `10%`）加快更新。

## 动手练习

1. 运行 `job-pi.yaml`，修改 `completions: 4, parallelism: 2`（需要先删除旧 Job，因为 Job 模板不可修改），观察 Pod 的创建节奏。
2. 修改 `job-fail.yaml`，加入 `podFailurePolicy`，让退出码 42 直接 `FailJob`，把命令改为 `exit 42`，对比 Job 失败所需的时间。
3. 部署 `cronjob-report.yaml`，观察几分钟，分别把 `concurrencyPolicy` 改为 `Allow` 和 `Replace`，看同时存在的 Job 数量有何变化。
4. 部署 `node-agent` DaemonSet，然后用 `kubectl cordon k8s-journey-worker2` 标记节点不可调度，观察 DaemonSet Pod 是否受影响；最后 `uncordon` 恢复。

## 自测

<details>
<summary>Job 的 Pod 模板为什么不能使用 restartPolicy: Always？</summary>

`Always` 意味着容器退出后无论成功与否都会重启，Pod 永远不会进入"成功完成"状态，Job 也就无法判断任务是否结束。Job 只允许 `Never` 或 `OnFailure`。

</details>

<details>
<summary>completions: 10、parallelism: 3 的 Job 是怎么执行的？</summary>

同时最多运行 3 个 Pod，每有一个成功完成就补上一个新的，直到累计 10 个 Pod 成功完成，Job 进入 Complete 状态。

</details>

<details>
<summary>Indexed Job 中每个 Pod 如何知道自己该处理哪一部分数据？</summary>

每个 Pod 被分配一个 0 到 completions-1 的索引，通过环境变量 `JOB_COMPLETION_INDEX`（以及注解和 `batch.kubernetes.io/job-completion-index` 标签）传入，程序据此选择对应的数据分片。

</details>

<details>
<summary>每小时执行的备份任务有时会运行超过一小时，concurrencyPolicy 应该怎么选？</summary>

选 `Forbid`：上一次备份还没结束时跳过本次，避免两个备份同时运行争抢资源或互相覆盖。如果只关心最新一次结果、旧任务可以放弃，才考虑 `Replace`。

</details>

<details>
<summary>一个 DaemonSet 在 3 节点的 kind 集群里 DESIRED 只有 2，最可能的原因是什么？</summary>

控制平面节点带有 `node-role.kubernetes.io/control-plane:NoSchedule` 污点，DaemonSet 的 Pod 没有对应的容忍，所以不会在控制平面节点上运行。也可能是 `nodeSelector` 或节点亲和性排除了某个节点。

</details>

## 参考资料

- [Kubernetes 官方文档：Job](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/job/)
- [Kubernetes 官方文档：使用索引作业完成静态工作分配下的并行处理](https://kubernetes.io/zh-cn/docs/tasks/job/indexed-parallel-processing-static/)
- [Kubernetes 官方文档：使用 Pod 失效策略处理可重试和不可重试的 Pod 失效](https://kubernetes.io/zh-cn/docs/tasks/job/pod-failure-policy/)
- [Kubernetes 官方文档：已完成 Job 的自动清理](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/ttlafterfinished/)
- [Kubernetes 官方文档：CronJob](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/cron-jobs/)
- [Kubernetes 官方文档：使用 CronJob 运行自动化任务](https://kubernetes.io/zh-cn/docs/tasks/job/automated-tasks-with-cron-jobs/)
- [Kubernetes 官方文档：DaemonSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/daemonset/)
- [Kubernetes 官方文档：对 DaemonSet 执行滚动更新](https://kubernetes.io/zh-cn/docs/tasks/manage-daemon/update-daemon-set/)
