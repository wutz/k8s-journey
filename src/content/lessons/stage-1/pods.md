# Pod：最小调度单元

Kubernetes 不直接调度容器，而是调度 Pod。Pod 是一个或多个容器的组合，它们共享网络和存储，总是被放到同一个节点上一起启停。理解了 Pod，后面的 Deployment、StatefulSet、Job 都只是"用不同方式管理一批 Pod"。

这一课你会学到 Pod 的生命周期、重启策略、多容器与 Init 容器模式（包括 1.29 起的原生 Sidecar），以及日常最常用的三个调试动作：看日志、进容器、端口转发。

## 为什么是 Pod 而不是容器

容器的设计原则是"一个容器一个进程"。但现实中经常有几个进程需要紧密配合：一个 Web 服务器加一个同步静态文件的助手，一个应用加一个日志收集代理。它们需要：

- 共享同一个网络命名空间：用 `localhost` 互相访问，对外只有一个 IP。
- 共享文件：一个写、一个读。
- 同生共死：一起调度到同一节点。

Pod 就是为此设计的"逻辑主机"。同一 Pod 内的容器共享 Network、IPC（可选 PID）命名空间，并可以挂载同一个 Volume。

```text
┌──────────────── Pod (IP: 10.244.1.5) ────────────────┐
│                                                       │
│  ┌─────────────┐   localhost   ┌─────────────┐        │
│  │  app 容器   │ ◀──────────▶ │ sidecar 容器 │        │
│  └──────┬──────┘               └──────┬──────┘        │
│         └──────── 共享 Volume ────────┘               │
│                                                       │
│  （pause 容器持有网络命名空间）                         │
└───────────────────────────────────────────────────────┘
```

> [!NOTE]
> 绝大多数 Pod 只有一个容器。只有当两个进程**必须**部署在一起时才放进同一个 Pod；如果它们可以独立扩缩容（比如 Web 和数据库），就应该拆成两个 Pod。

## 第一个 Pod

```yaml title="nginx-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports:
        - containerPort: 80
```

```bash
kubectl apply -f nginx-pod.yaml
kubectl get pod nginx -o wide
```

```console
NAME    READY   STATUS    RESTARTS   AGE   IP           NODE          NOMINATED NODE   READINESS GATES
nginx   1/1     Running   0          15s   10.244.2.3   kind-worker2  <none>           <none>
```

`READY 1/1` 表示 1 个容器中有 1 个就绪。

## 生命周期

### Pod 阶段（Phase）

`status.phase` 是 Pod 在生命周期中所处位置的粗略概括，只有五个值：

| 阶段 | 含义 |
|---|---|
| `Pending` | 已被集群接受，但还有容器没运行起来：在等调度、在拉镜像、在跑 Init 容器 |
| `Running` | 已绑定到节点，所有容器已创建，至少一个在运行（或正在启动/重启） |
| `Succeeded` | 所有容器都成功退出（退出码 0），且不会再重启 |
| `Failed` | 所有容器都已终止，至少一个失败退出 |
| `Unknown` | 无法获取 Pod 状态，通常是与节点通信失败 |

> [!WARNING] STATUS 列不等于 phase
> `kubectl get pods` 的 `STATUS` 列显示的是更细的原因，比如 `ContainerCreating`、`CrashLoopBackOff`、`ImagePullBackOff`、`Completed`、`Terminating`。它们不是 phase，而是从容器状态汇总出来的提示。`CrashLoopBackOff` 的 Pod，phase 往往仍然是 `Running`。

### 容器状态

每个容器有自己的状态：`Waiting`（等待中，带 reason）、`Running`、`Terminated`（带退出码和 reason）。查看方式：

```bash
kubectl get pod nginx -o jsonpath='{.status.containerStatuses[0].state}'
```

```console
{"running":{"startedAt":"2026-09-23T03:12:45Z"}}
```

### 重启策略（restartPolicy）

`spec.restartPolicy` 作用于 Pod 内所有普通容器：

| 值 | 行为 | 典型场景 |
|---|---|---|
| `Always`（默认） | 容器退出就重启，不管退出码 | 长期运行的服务 |
| `OnFailure` | 退出码非 0 才重启 | 批处理任务（Job） |
| `Never` | 从不重启 | 一次性任务、调试 |

重启不是立即的：kubelet 使用指数退避，间隔 10s、20s、40s……上限 5 分钟；容器稳定运行 10 分钟后退避计时重置。看到 `CrashLoopBackOff` 就是处于这种退避中。

动手观察一个不断崩溃的容器：

```yaml title="crash-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: crash
spec:
  restartPolicy: Always
  containers:
    - name: crash
      image: busybox:1.36
      command: ["sh", "-c", "echo starting; sleep 3; exit 1"]
```

```bash
kubectl apply -f crash-pod.yaml
kubectl get pod crash -w
```

```console
NAME    READY   STATUS             RESTARTS      AGE
crash   1/1     Running            0             2s
crash   0/1     Error              0             5s
crash   1/1     Running            1 (2s ago)    7s
crash   0/1     Error              1 (5s ago)    10s
crash   0/1     CrashLoopBackOff   1 (13s ago)   22s
```

把 `restartPolicy` 改成 `Never` 再试（Pod 的大部分 spec 不可修改，需要先删除再创建），会看到它停在 `Error`，phase 为 `Failed`。

## 看日志、进容器、端口转发

### kubectl logs

```bash
kubectl logs nginx                 # 当前日志
kubectl logs -f nginx              # 持续跟踪
kubectl logs nginx --tail=20       # 最后 20 行
kubectl logs crash --previous      # 上一次（已崩溃）容器实例的日志，排查 CrashLoop 必备
kubectl logs mypod -c sidecar      # 多容器 Pod 需要用 -c 指定容器
```

### kubectl exec

```bash
kubectl exec nginx -- nginx -v            # 执行单条命令
kubectl exec -it nginx -- sh              # 打开交互式 shell
```

```console
$ kubectl exec -it nginx -- sh
# curl -s localhost | head -4
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
```

> [!TIP]
> 很多生产镜像（distroless）里没有 shell，`exec` 进不去。这时可以用 `kubectl debug -it <pod> --image=busybox:1.36 --target=<容器名>` 挂一个临时容器（Ephemeral Container）进去调试，阶段 4 的[故障排查](/learn/troubleshooting)会详细讲。

### kubectl port-forward

Pod IP 只在集群内可达。想从你的笔记本上访问，最简单的是端口转发：

```bash
kubectl port-forward pod/nginx 8080:80
```

```console
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
```

另开一个终端执行 `curl localhost:8080` 即可。`port-forward` 只用于调试，不是对外暴露服务的方式，那是 [Service](/learn/services) 的工作。

## 多容器 Pod：Sidecar 模式

### 传统 Sidecar

下面的 Pod 里，`writer` 每秒往共享卷写日志，`reader` 像日志代理一样读出来：

```yaml title="sidecar-classic.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: logger
spec:
  volumes:
    - name: logs
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /var/log/app.log; sleep 1; done"]
      volumeMounts:
        - name: logs
          mountPath: /var/log
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "tail -F /var/log/app.log"]
      volumeMounts:
        - name: logs
          mountPath: /var/log
```

```bash
kubectl apply -f sidecar-classic.yaml
kubectl logs logger -c reader --tail=3
```

```console
Wed Sep 23 03:20:11 UTC 2026
Wed Sep 23 03:20:12 UTC 2026
Wed Sep 23 03:20:13 UTC 2026
```

这种写法有两个老问题：普通容器之间**没有启动顺序保证**，主容器可能先于代理启动；在 Job 里，主容器结束了，Sidecar 还在跑，Pod 就永远不会完成。

### 原生 Sidecar（1.29+）

Kubernetes 1.28 引入、1.29 起默认开启（1.33 GA）的原生 Sidecar 容器解决了这两个问题。写法是：**放在 `initContainers` 里，并设置 `restartPolicy: Always`**。

```yaml title="sidecar-native.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: logger-native
spec:
  volumes:
    - name: logs
      emptyDir: {}
  initContainers:
    - name: reader
      image: busybox:1.36
      restartPolicy: Always          # 这一行让它成为 Sidecar
      command: ["sh", "-c", "touch /var/log/app.log; tail -F /var/log/app.log"]
      volumeMounts:
        - name: logs
          mountPath: /var/log
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "for i in 1 2 3 4 5; do date >> /var/log/app.log; sleep 1; done"]
      volumeMounts:
        - name: logs
          mountPath: /var/log
```

原生 Sidecar 的行为：

- 按 `initContainers` 中的顺序启动，启动后（若配置了 startupProbe 则需通过）才继续启动后面的容器，所以它一定先于主容器就绪。
- 与主容器同时长期运行，退出会被单独重启。
- 主容器全部结束后，Sidecar 会被自动终止，不再阻塞 Job 完成；Pod 终止时，Sidecar 在主容器之后才停止。

```bash
kubectl apply -f sidecar-native.yaml
kubectl get pod logger-native
```

```console
NAME            READY   STATUS    RESTARTS   AGE
logger-native   2/2     Running   0          4s
```

## Init 容器

Init 容器（不带 `restartPolicy: Always` 的那种）在主容器启动前**按顺序逐个运行、必须成功退出**。常用于：等待依赖服务就绪、下载配置或数据、执行数据库迁移、准备文件权限。

```yaml title="init-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  volumes:
    - name: html
      emptyDir: {}
  initContainers:
    - name: prepare
      image: busybox:1.36
      command: ["sh", "-c", "echo '<h1>prepared by init</h1>' > /work/index.html; sleep 5"]
      volumeMounts:
        - name: html
          mountPath: /work
  containers:
    - name: nginx
      image: nginx:1.27
      volumeMounts:
        - name: html
          mountPath: /usr/share/nginx/html
```

```bash
kubectl apply -f init-demo.yaml
kubectl get pod init-demo -w
```

```console
NAME        READY   STATUS            RESTARTS   AGE
init-demo   0/1     Init:0/1          0          2s
init-demo   0/1     PodInitializing   0          8s
init-demo   1/1     Running           0          9s
```

```bash
kubectl exec init-demo -- curl -s localhost
# <h1>prepared by init</h1>
```

如果 Init 容器失败，kubelet 会按 Pod 的 `restartPolicy` 重试（`Never` 时整个 Pod 直接 `Failed`），状态显示为 `Init:Error` 或 `Init:CrashLoopBackOff`。查看它的日志要用 `kubectl logs init-demo -c prepare`。

## 为什么不直接用裸 Pod

到目前为止我们都在直接创建 Pod（称为裸 Pod，Naked Pod）。试一下：

```bash
kubectl delete pod nginx
kubectl get pod nginx
# Error from server (NotFound): pods "nginx" not found
```

Pod 被删掉就没了，没有任何东西会把它重建。更糟的是：

- 节点宕机或被驱逐时，裸 Pod 不会被迁移到其他节点。
- 不能扩缩容，不能滚动升级；Pod 的大部分 `spec` 字段创建后不可修改。
- 每个 Pod 的名字和 IP 都是临时的，重建后都会变。

所以生产中几乎从不直接创建 Pod，而是通过控制器管理：无状态服务用 [Deployment](/learn/deployments)，有状态服务用 StatefulSet，一次性任务用 Job，每节点一个用 DaemonSet。你写的 Pod 模板会原样出现在这些控制器的 `spec.template` 里，所以这一课的内容一点都不会浪费。

> [!PROD]
> 生产 Pod 还应配置健康检查探针、资源 requests/limits 和安全上下文，这些在阶段 2 的[健康检查与资源管理](/learn/probes-resources)和阶段 3 的[工作负载安全加固](/learn/security)中讲解。

清理本课资源：

```bash
kubectl delete pod crash logger logger-native init-demo --ignore-not-found
```

## 动手练习

1. 创建 `crash-pod.yaml`，观察 RESTARTS 次数和退避间隔的增长，并用 `kubectl logs --previous` 查看上一次的输出。
2. 分别用 `Always`、`OnFailure`、`Never` 运行一个 `exit 0` 的容器，对比 `STATUS` 和 `phase`。
3. 写一个 Init 容器，用 `until nslookup mydb; do sleep 2; done` 等待一个不存在的 Service，观察 Pod 停在什么状态。
4. 把 `sidecar-classic.yaml` 改造成原生 Sidecar 写法，并用 `kubectl get pod -o jsonpath='{.status.initContainerStatuses[*].name}'` 确认 Sidecar 出现在哪个状态列表里。
5. 用 `port-forward` 把 `init-demo` 的 80 端口转发到本机 8080，在浏览器里打开。

## 自测

<details>
<summary>同一个 Pod 里的两个容器怎么互相通信？</summary>

它们共享网络命名空间，直接用 `localhost:<端口>` 访问即可；也可以通过共享 Volume 交换文件。注意两个容器不能监听同一个端口。

</details>

<details>
<summary>Pod 显示 `CrashLoopBackOff`，它的 phase 是什么？该怎么排查？</summary>

phase 通常仍是 `Running`（`restartPolicy: Always` 下容器会被反复重启）。排查顺序：`kubectl describe pod` 看 Events 和上次的退出码，`kubectl logs <pod> --previous` 看崩溃前的日志。

</details>

<details>
<summary>原生 Sidecar 与普通 Init 容器在写法和行为上有什么区别？</summary>

写法上都放在 `initContainers` 里，原生 Sidecar 多了 `restartPolicy: Always`。行为上普通 Init 容器必须运行到成功退出，后面的容器才会启动；原生 Sidecar 启动后就继续后面的流程，并与主容器一起长期运行，主容器结束后它会被自动终止。

</details>

<details>
<summary>为什么生产中不直接创建裸 Pod？</summary>

裸 Pod 被删除或所在节点故障后不会被重建，也无法扩缩容和滚动升级。应该用 Deployment 等控制器来管理 Pod，由控制器保证副本数和更新流程。

</details>

## 参考资料

- [Kubernetes 官方文档：Pod](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/)
- [Kubernetes 官方文档：Pod 的生命周期](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/)
- [Kubernetes 官方文档：Init 容器](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/init-containers/)
- [Kubernetes 官方文档：边车容器](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/sidecar-containers/)
- [Kubernetes 官方文档：使用端口转发来访问集群中的应用](https://kubernetes.io/zh-cn/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)
