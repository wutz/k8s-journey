# ReplicaSet 与 Deployment

[上一课](/learn/pods)的结尾我们看到，裸 Pod 被删掉就没了。真实的服务需要：始终保持 N 个副本在跑，挂了自动补；升级版本时不中断服务；新版本有问题能一键回退。这就是 ReplicaSet 和 Deployment 的工作。

学完这一课，你能用 Deployment 部署一个多副本应用，控制滚动更新的节奏，查看发布历史并回滚，并理解 Recreate、蓝绿、金丝雀这几种发布策略在 Kubernetes 里怎么实现。

## ReplicaSet：保证副本数

### 它做什么

ReplicaSet 只做一件事：**让匹配选择器的 Pod 数量始终等于 `replicas`**。少了就按模板创建，多了就删除。

```yaml title="web-rs.yaml"
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
spec:
  replicas: 3
  selector:                 # 我管理哪些 Pod
    matchLabels:
      app: web-rs
  template:                 # 不够时按这个模板创建 Pod
    metadata:
      labels:
        app: web-rs         # 必须能被上面的 selector 匹配
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

```bash
kubectl apply -f web-rs.yaml
kubectl get rs,pods -l app=web-rs
```

```console
NAME                     DESIRED   CURRENT   READY   AGE
replicaset.apps/web-rs   3         3         3       12s

NAME               READY   STATUS    RESTARTS   AGE
pod/web-rs-7xk2p   1/1     Running   0          12s
pod/web-rs-h9dqc   1/1     Running   0          12s
pod/web-rs-tl4mz   1/1     Running   0          12s
```

### 自愈与标签归属

删掉一个 Pod，立刻会有新的补上：

```bash
kubectl delete pod web-rs-7xk2p
kubectl get pods -l app=web-rs
```

```console
NAME           READY   STATUS              RESTARTS   AGE
web-rs-h9dqc   1/1     Running             0          1m
web-rs-q5v8n   0/1     ContainerCreating   0          1s
web-rs-tl4mz   1/1     Running             0          1m
```

ReplicaSet 靠**标签**认领 Pod。把某个 Pod 的标签改掉，它就"脱离"了 ReplicaSet，后者会再补一个新的：

```bash
kubectl label pod web-rs-h9dqc app=debug --overwrite
kubectl get pods -L app
```

```console
NAME           READY   STATUS    RESTARTS   AGE   APP
web-rs-h9dqc   1/1     Running   0          2m    debug
web-rs-q5v8n   1/1     Running   0          40s   web-rs
web-rs-tl4mz   1/1     Running   0          2m    web-rs
web-rs-zz8wd   1/1     Running   0          2s    web-rs
```

> [!TIP]
> 这是一个实用的排障技巧：把出问题的 Pod 从控制器里"摘出来"保留现场慢慢查，控制器会补一个健康的副本顶上，服务不受影响。

ReplicaSet 的局限在于**不会更新已有 Pod**：修改模板里的镜像只影响之后新建的 Pod。所以我们几乎不直接使用它，而是用更上层的 Deployment。

```bash
kubectl delete rs web-rs
kubectl delete pod -l app=debug
```

## Deployment：管理 ReplicaSet 的控制器

### 层级关系

```text
Deployment (web)
  │  管理多个版本的 ReplicaSet，负责滚动切换
  ├── ReplicaSet (web-5d8f7c9b6)   ← 当前版本，replicas=3
  │     ├── Pod web-5d8f7c9b6-abcde
  │     ├── Pod web-5d8f7c9b6-fghij
  │     └── Pod web-5d8f7c9b6-klmno
  └── ReplicaSet (web-7c4b9d8f5)   ← 旧版本，replicas=0，留作回滚
```

每次修改 Pod 模板（镜像、环境变量、资源等），Deployment 会创建一个新 ReplicaSet，逐步把新的调大、旧的调小。ReplicaSet 名字里的哈希来自 Pod 模板，对应 Pod 上的 `pod-template-hash` 标签。

### 创建 Deployment

```yaml title="web-deploy.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 4
  revisionHistoryLimit: 10       # 保留多少个旧 ReplicaSet 用于回滚（默认 10）
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                # 更新时最多比 replicas 多出几个 Pod
      maxUnavailable: 0          # 更新时最多允许几个 Pod 不可用
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.26
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f web-deploy.yaml
kubectl get deploy,rs,pods -l app=web
```

```console
NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/web   4/4     4            4           20s

NAME                             DESIRED   CURRENT   READY   AGE
replicaset.apps/web-6c9d5bb8f4   4         4         4       20s

NAME                       READY   STATUS    RESTARTS   AGE
pod/web-6c9d5bb8f4-2kq9x   1/1     Running   0          20s
pod/web-6c9d5bb8f4-8wmtz   1/1     Running   0          20s
pod/web-6c9d5bb8f4-fp7bn   1/1     Running   0          20s
pod/web-6c9d5bb8f4-rx5lc   1/1     Running   0          20s
```

`READY` 是就绪数/期望数，`UP-TO-DATE` 是已更新到最新模板的副本数，`AVAILABLE` 是可对外服务的副本数。

扩缩容只需要改 `replicas` 再 apply；临时实验也可以 `kubectl scale deploy web --replicas=6`。

> [!WARNING] selector 创建后不可修改
> `apps/v1` 中 Deployment 的 `spec.selector` 是不可变的，且必须匹配 `template.metadata.labels`。想换选择器只能删了重建，所以一开始就要设计好标签。

## 滚动更新

### maxSurge 与 maxUnavailable

`RollingUpdate`（默认策略）用两个参数控制节奏，可以写整数或百分比，默认都是 `25%`：

| 参数 | 含义 | 调大的效果 |
|---|---|---|
| `maxSurge` | 更新过程中，Pod 总数最多可以超出 `replicas` 多少 | 更快，但临时占用更多资源 |
| `maxUnavailable` | 更新过程中，最多有多少副本可以不可用 | 更快，但服务容量下降 |

两者不能同时为 0。常见组合：

- `maxSurge: 1, maxUnavailable: 0`：先起一个新的、就绪后再删一个旧的，容量始终不低于期望值，最稳妥。
- `maxSurge: 0, maxUnavailable: 1`：先删再建，不额外占资源，适合资源紧张的集群。
- `maxSurge: 100%, maxUnavailable: 0`：一次性起齐新版本再切，接近蓝绿，资源翻倍。

> [!PROD] 就绪探针决定滚动更新是否安全
> Deployment 以 Pod 的 **Ready** 状态判断新副本是否可用。如果没有配置就绪探针（readinessProbe），容器一启动就被视为就绪，应用还没初始化完成就会收到流量、旧 Pod 就会被删掉。生产中一定要配置探针，详见[健康检查与资源管理](/learn/probes-resources)。

### 触发一次更新

先在另一个终端观察 Pod 变化：

```bash
kubectl get pods -l app=web -w
```

然后把镜像改为 `nginx:1.27`，并用注解记录变更原因：

```bash
kubectl set image deploy/web nginx=nginx:1.27
kubectl annotate deploy/web kubernetes.io/change-cause="升级到 nginx 1.27"
kubectl rollout status deploy/web
```

```console
Waiting for deployment "web" rollout to finish: 1 out of 4 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 2 out of 4 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 3 out of 4 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 1 old replicas are pending termination...
deployment "web" successfully rolled out
```

> [!NOTE]
> 这里为了演示用了命令式的 `set image`。日常工作中应当修改 YAML 里的 `image` 并 `apply`，同时把 `kubernetes.io/change-cause` 注解写在 YAML 的 `metadata.annotations` 里。

更新完成后 `kubectl get rs -l app=web` 会看到两个 ReplicaSet：新的 `web-84b5f6d7c9` 有 4 个副本，旧的 `web-6c9d5bb8f4` 副本数为 0，留作回滚。

`rollout status` 会阻塞到发布完成或失败，常用在 CI/CD 里作为发布门禁。如果新 Pod 迟迟无法就绪，超过 `progressDeadlineSeconds`（默认 600 秒）后 Deployment 会被标记为 `ProgressDeadlineExceeded`，`rollout status` 以非零退出码返回。注意 Kubernetes 本身**不会自动回滚**。

## 发布历史与回滚

### 查看历史

```bash
kubectl rollout history deploy/web
```

```console
deployment.apps/web
REVISION  CHANGE-CAUSE
1         <none>
2         升级到 nginx 1.27
```

加 `--revision=1` 可以查看某个版本的 Pod 模板。

### 模拟一次失败的发布

```bash
kubectl set image deploy/web nginx=nginx:9.9.9-not-exist
kubectl annotate deploy/web kubernetes.io/change-cause="错误的镜像" --overwrite
kubectl get pods -l app=web
```

```console
NAME                   READY   STATUS             RESTARTS   AGE
web-5f7d9c8b6d-xq2lp   0/1     ImagePullBackOff   0          30s
web-84b5f6d7c9-4gk8s   1/1     Running            0          3m
web-84b5f6d7c9-9mnbv   1/1     Running            0          3m
web-84b5f6d7c9-ct7wd   1/1     Running            0          3m
web-84b5f6d7c9-lz2rq   1/1     Running            0          3m
```

因为 `maxUnavailable: 0`，新 Pod 起不来时旧 Pod 一个都不会被删，服务完全不受影响，这就是保守参数的价值。

### 回滚

```bash
kubectl rollout undo deploy/web                  # 回到上一个版本
kubectl rollout undo deploy/web --to-revision=1  # 回到指定版本
kubectl rollout status deploy/web
```

回滚本质上是把旧版本的 Pod 模板重新应用一次，会产生一个新的 revision 号，旧 ReplicaSet 被重新扩容。

> [!WARNING] 回滚与声明式的冲突
> `rollout undo` 修改的是集群里的对象，你 Git 里的 YAML 仍然是坏版本，下一次 `apply` 又会把坏版本发出去。生产中推荐的做法是在 Git 里 revert 再重新发布，`undo` 只作为紧急止血手段。

### 暂停与恢复

需要连续修改多处（镜像、环境变量、资源）但只想触发一次滚动时：

```bash
kubectl rollout pause deploy/web
# ……多次修改……
kubectl rollout resume deploy/web
```

`kubectl rollout restart deploy/web` 则会在不改配置的情况下重建所有 Pod（常用于让 Pod 重新读取挂载的配置）。

## Recreate 策略

有些应用不允许新旧版本同时运行，例如会做不兼容数据库迁移的单实例服务，或者要独占某个存储卷。这时用 `Recreate`：先把旧 Pod 全部删掉，再创建新的。

```yaml title="recreate-snippet.yaml"
spec:
  strategy:
    type: Recreate
```

代价是更新期间服务**完全中断**。

## 蓝绿与金丝雀

Deployment 原生只支持滚动和重建两种策略，但借助标签和 [Service](/learn/services) 的选择器，可以组合出更多发布方式。

### 蓝绿发布（Blue/Green）

同时运行两套完整的 Deployment，Service 只指向其中一套，切换时改 Service 的选择器：

```text
                    selector: app=shop, version=blue
Service shop ───────────────▶ Deployment shop-blue  (v1, 4 副本)
                              Deployment shop-green (v2, 4 副本，已就绪待命)

切换：把 Service 的 selector 改成 version=green，瞬间全量切换；
回退：改回 version=blue。
```

优点是切换和回退都是瞬时的；缺点是资源翻倍。

### 金丝雀发布（Canary）

两个 Deployment 共享 Service 选择器用的标签，按副本数比例分流：

```yaml title="canary.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-stable
spec:
  replicas: 9
  selector:
    matchLabels: { app: shop, track: stable }
  template:
    metadata:
      labels: { app: shop, track: stable }
    spec:
      containers:
        - name: nginx
          image: nginx:1.26
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-canary
spec:
  replicas: 1
  selector:
    matchLabels: { app: shop, track: canary }
  template:
    metadata:
      labels: { app: shop, track: canary }
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

Service 只用 `app: shop` 选择，于是大约 10% 的请求会落到金丝雀版本。观察指标没问题后，逐步调大 canary、调小 stable，最后把 stable 升级到新版本。

> [!PROD]
> 按副本数分流粒度粗、无法按用户或请求头分流。生产中精细的金丝雀通常借助 Ingress/Gateway API 的按权重路由（见 [Ingress 与 Gateway API](/learn/ingress-gateway)），或者 Argo Rollouts、Flagger 这类渐进式交付工具自动完成分析和推进。

清理：

```bash
kubectl delete deploy web shop-stable shop-canary --ignore-not-found
```

## 动手练习

1. 创建 `web-rs.yaml`，删除一个 Pod 观察自愈，再通过修改标签把一个 Pod 从 ReplicaSet 里"摘出来"。
2. 部署 `web-deploy.yaml`，分别用 `maxSurge: 1, maxUnavailable: 0` 和 `maxSurge: 0, maxUnavailable: 1` 做一次升级，用 `kubectl get pods -w` 对比 Pod 数量的变化过程。
3. 发布一个不存在的镜像版本，确认服务仍有 4 个可用副本，然后用 `rollout undo` 回滚，并查看 `rollout history` 的 revision 变化。
4. 把策略改为 `Recreate` 再升级一次，观察是否出现所有 Pod 同时 `Terminating` 的时刻。
5. 部署 `canary.yaml`，把 `shop-canary` 扩到 3、`shop-stable` 缩到 7，思考流量比例的变化。

## 自测

<details>
<summary>Deployment、ReplicaSet、Pod 三者是什么关系？</summary>

Deployment 管理 ReplicaSet，每个 Pod 模板版本对应一个 ReplicaSet；ReplicaSet 通过标签选择器管理 Pod，保证副本数。滚动更新就是 Deployment 调大新 ReplicaSet、调小旧 ReplicaSet 的过程。

</details>

<details>
<summary>`replicas: 4, maxSurge: 25%, maxUnavailable: 25%` 时，更新过程中 Pod 数量的上下限是多少？</summary>

`maxSurge` 向上取整为 1，`maxUnavailable` 向下取整为 1。所以总 Pod 数最多 5 个，可用 Pod 最少 3 个。

</details>

<details>
<summary>发布卡住了，Kubernetes 会自动回滚吗？</summary>

不会。超过 `progressDeadlineSeconds` 后只会把 Deployment 的 `Progressing` 条件标记为 `False`（原因 `ProgressDeadlineExceeded`），需要人工或 CI/CD 工具执行回滚。

</details>

<details>
<summary>什么情况下应该用 Recreate 而不是 RollingUpdate？</summary>

当新旧版本不能同时运行时：例如不兼容的数据结构迁移、单实例独占的存储卷或许可证。代价是更新期间服务中断。

</details>

## 参考资料

- [Kubernetes 官方文档：Deployments](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes 官方文档：ReplicaSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/replicaset/)
- [Kubernetes 官方文档：使用 Deployment 运行一个无状态应用](https://kubernetes.io/zh-cn/docs/tasks/run-application/run-stateless-application-deployment/)
- [Kubernetes 官方文档：kubectl rollout](https://kubernetes.io/zh-cn/docs/reference/kubectl/generated/kubectl_rollout/)
