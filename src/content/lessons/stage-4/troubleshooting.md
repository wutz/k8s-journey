# 故障排查方法论

"Pod 起不来""服务访问不通""节点挂了"是运维 Kubernetes 最常听到的三句话。新手排查往往凭直觉乱试：删 Pod、重启 kubelet、重装 CNI，碰巧好了也不知道为什么。有经验的人手里有一条固定的路径：先看状态，再看事件，再看日志，再进容器，再下到节点，每一步都排除一批可能性。

这一课把这条路径讲清楚：Pod 各种异常状态分别意味着什么、从哪里找证据；Service 不通和 DNS 解析失败怎样逐段排查；节点 NotReady 从哪几个方向入手；以及 `kubectl debug` 这个现代排查利器的用法。最后给出一张可以贴在工位上的排查清单，并在 kind 里亲手制造和排查几个故障。

## 排查的基本路径

```text
        ┌────────────── 现象：用户说"访问不了" ──────────────┐
        ▼                                                   │
  1. 入口层    Ingress / Gateway / LoadBalancer 是否有地址、规则是否匹配
        ▼
  2. Service   有没有 Endpoints？端口和 targetPort 对不对？
        ▼
  3. Pod       STATUS / READY / RESTARTS 是什么？describe 的 Events 说了什么？
        ▼
  4. 容器      logs、logs --previous、kubectl debug 进去看
        ▼
  5. 节点      kubelet / containerd / CNI / 磁盘 / 内核日志
        ▼
  6. 控制平面  apiserver / etcd / scheduler / controller-manager
```

两条原则：

- **自顶向下，逐段排除**。每一段都用证据确认"这一段没问题"再往下走，而不是跳到最怀疑的地方。
- **先收集证据，再动手修改**。删 Pod 会让 `--previous` 日志和事件一起消失；重启节点会清掉内核日志里的 OOM 记录。先把 `describe`、日志存下来。

## 工具箱

### 四个最常用的命令

```bash
kubectl get pod -o wide                          # 状态、重启次数、所在节点、Pod IP
kubectl describe pod <pod>                       # 最重要：底部的 Events
kubectl events --for pod/<pod>                   # 只看某个对象的事件（kubectl 1.26+）
kubectl logs <pod> -c <container> --previous     # 上一次（已崩溃）容器的日志
```

`describe` 输出里值得逐项看的字段：

| 字段 | 看什么 |
|---|---|
| `Status` / `Reason` | Pod 阶段，被驱逐时 Reason 为 `Evicted` |
| `State` / `Last State` | 当前与上一次容器状态，`Last State: Terminated` 带 `Reason` 和 `Exit Code` |
| `Restart Count` | 反复重启说明进程崩溃或探针失败 |
| `Conditions` | `PodScheduled`、`Initialized`、`ContainersReady`、`Ready` 哪一步是 False |
| `Events` | scheduler、kubelet 对这个 Pod 做了什么，报了什么错 |

> [!TIP] 事件只保留 1 小时
> Events 默认 1 小时后被删除。复盘更早的问题要靠 [可观测性](/learn/observability) 里持久化的事件和日志。同时看多个 Pod 的日志可以用 `stern <关键字>`。

### kubectl debug：进到容器和节点里

生产镜像通常是精简或 distroless 的，没有 shell、没有 `curl`、没有 `nslookup`，`kubectl exec` 进去什么也做不了。临时容器（Ephemeral Container）解决了这个问题：把一个带满工具的容器"挂"到目标 Pod 上，共享它的网络命名空间。

```bash
# 挂一个 netshoot 容器到 Pod 上，--target 让它共享目标容器的进程命名空间
kubectl debug -it mypod --image=nicolaka/netshoot --target=app
# 在里面可以：ss -lntp、curl localhost:8080、dig、tcpdump -i eth0、ps aux

# 复制一份 Pod 来调试（原 Pod 不受影响），并把启动命令改成 sh，适合 CrashLoop 的容器
kubectl debug mypod -it --copy-to=mypod-debug --container=app -- sh
```

`nicolaka/netshoot` 集成了 `curl`、`dig`、`nslookup`、`tcpdump`、`iperf3`、`ss`、`mtr` 等几十个网络工具，是排查网络问题的标准配置。离线环境记得提前把它同步到私有仓库。

调试节点时，`kubectl debug node` 会在该节点上起一个特权 Pod，宿主机根文件系统挂在 `/host`：

```bash
kubectl debug node/gn-192-168-1-11 -it --image=busybox
# 进去以后：
chroot /host                      # 切换到宿主机视角
journalctl -u kubelet --since "30 min ago" | tail -100
crictl ps -a | head
df -h /var/lib/containerd
```

> [!WARNING] 用完记得删除
> `kubectl debug node` 创建的 Pod 不会自动删除，名字形如 `node-debugger-<节点>-xxxxx`，排查完用 `kubectl delete pod` 清理。节点本身已经 NotReady 时这个方法用不了，只能 SSH 上去。

## Pod 状态逐个击破

### Pending：调度不上去

Pending 说明 Pod 还没被分配到节点（或者分配了但还没开始创建容器）。看 `describe` 里的 `FailedScheduling` 事件，scheduler 会逐条说明为什么每个节点都不合适：

```console
Warning  FailedScheduling  0/5 nodes are available: 2 Insufficient nvidia.com/gpu,
  3 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.
  preemption: 0/5 nodes are available: ...
```

| 事件关键字 | 原因 | 处理 |
|---|---|---|
| `Insufficient cpu/memory` | requests 超过节点可分配量 | 降低 requests、扩容，或看是否被其他 Pod 占满（`kubectl describe node` 的 Allocated resources） |
| `untolerated taint` | 节点有污点而 Pod 没容忍 | 加 toleration，或确认本来就不该调度过去 |
| `didn't match Pod's node affinity/selector` | nodeSelector/亲和性写错或节点缺 label | `kubectl get node --show-labels` 核对 |
| `pod has unbound immediate PersistentVolumeClaims` | PVC 没绑定 | 查 PVC 事件和 StorageClass、CSI 驱动 |
| `didn't match pod topology spread constraints` | 拓扑分布约束无法满足 | 放宽 `whenUnsatisfiable` 或补足域 |

调度相关概念回顾见 [调度](/learn/scheduling)。

### ImagePullBackOff / ErrImagePull

先看事件里的具体错误：

| 错误信息 | 原因 |
|---|---|
| `not found` / `manifest unknown` | 镜像名或 tag 写错，或者该架构没有对应镜像 |
| `401 Unauthorized` / `pull access denied` | 私有仓库缺少或错配 imagePullSecrets |
| `x509: certificate signed by unknown authority` | 节点不信任仓库证书，需在 `hosts.toml` 配置 CA |
| `http: server gave HTTP response to HTTPS client` | 明文 HTTP 仓库没有在 `hosts.toml` 中声明 |
| `context deadline exceeded` / `i/o timeout` | 网络不通或大镜像拉取超时 |

在节点上直接用 `crictl pull <镜像>` 复现，可以绕过 K8s 判断是不是节点侧的问题。镜像链路的配置细节见 [镜像仓库与镜像分发](/learn/registry)。

> [!PROD] 大镜像拉取超时
> 几十 GB 的 AI 镜像超出 kubelet 默认 2 分钟的 `runtimeRequestTimeout`，表现为反复 `context deadline exceeded`，而在节点上手动 `crictl pull` 却能成功。团队的做法是在 Kubespray 中设置 `kubelet_config_extra_args: { runtimeRequestTimeout: 15m }`，并部署 P2P 分发。

### CrashLoopBackOff：进程反复退出

CrashLoopBackOff 不是错误原因，而是 kubelet 的**重启退避状态**：容器退出后 kubelet 按 10s、20s、40s……（上限 5 分钟）的间隔重启。真正的原因在上一次容器的日志和退出码里：

```bash
kubectl logs mypod --previous
kubectl get pod mypod -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
```

| 退出码 | 含义 | 常见原因 |
|---|---|---|
| 0 | 正常退出 | 进程是一次性任务，却用 Deployment 部署；或主进程跑到后台去了 |
| 1 / 2 | 应用错误 | 配置缺失、连不上依赖、参数错误，看日志 |
| 126 / 127 | 命令不可执行 / 找不到 | `command` 写错、镜像里没有该程序 |
| 137 | 被 SIGKILL（128+9） | OOMKilled，或存活探针失败后超时被强杀 |
| 139 | 段错误（128+11） | 程序崩溃，镜像架构或依赖库不匹配 |
| 143 | 被 SIGTERM（128+15） | 被正常终止，常见于存活探针失败 |

> [!WARNING] 探针造成的"假崩溃"
> 应用启动要 60 秒，存活探针（livenessProbe）10 秒后就开始检查，结果每次还没启动完就被杀掉重启，日志看起来一切正常。事件里会有 `Liveness probe failed` 和 `Container app failed liveness probe, will be restarted`。慢启动应用用 startupProbe，见 [健康检查与资源管理](/learn/probes-resources)。

### OOMKilled：内存超限

```console
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
```

容器内存用量超过了 `limits.memory`，被内核的 OOM Killer 杀掉。处理方向：确认是真实需要（调大 limits）还是内存泄漏（看监控里内存曲线是否只涨不降）；Java、Node.js 等运行时要让堆大小感知容器限制。

两个容易混淆的情况：

- **节点级 OOM**：容器没到自己的 limit，但节点内存耗尽，内核杀掉了它。节点上 `dmesg -T | grep -i oom` 能看到记录，通常是节点上 Pod 的 limits 总和远超物理内存（超售）。
- **cgroup v2 行为变化**：cgroup v2 默认在 OOM 时杀掉整个容器 cgroup 里的所有进程，而 v1 只杀一个进程。多进程容器（例如带 worker 子进程的应用）在升级到 cgroup v2 后可能从"偶尔丢一个 worker"变成"整个容器重启"。

### Evicted：被节点驱逐

节点磁盘、内存或 inode 紧张时，kubelet 会按 QoS 等级驱逐 Pod，Pod 状态变为 `Failed`、Reason 为 `Evicted`，消息里写着是哪种资源不足：

```console
Status:   Failed
Reason:   Evicted
Message:  The node was low on resource: ephemeral-storage. Threshold quantity: ...
```

被驱逐的 Pod 对象不会自动删除，会堆积在列表里。处理根因（清理节点磁盘、给容器设置 `ephemeral-storage` 限制、日志轮转）后清理残留：

```bash
kubectl get pods -A --field-selector=status.phase=Failed
kubectl delete pods -A --field-selector=status.phase=Failed
```

### 其他卡住的状态

| 现象 | 优先检查 |
|---|---|
| `ContainerCreating` 很久 | 事件里是否有 `FailedMount`（存储）、`FailedCreatePodSandBox`（CNI） |
| `Terminating` 删不掉 | 节点是否失联；`finalizers` 是否有控制器没处理 |
| `Running` 但 `READY 0/1` | 就绪探针失败，Pod 不会进入 Service 的 Endpoints |
| `Init:CrashLoopBackOff` | Init 容器失败，`kubectl logs <pod> -c <init 容器名>` |

> [!PROD] 真实案例：GPU 容器里 nvidia-smi 突然失败
> 某个 GPU Pod 没有通过 `resources.limits` 申请 GPU，而是设置了环境变量 `NVIDIA_VISIBLE_DEVICES=all` 直接使用。运维在宿主机执行 `systemctl daemon-reload` 之后，这个 Pod 里 `nvidia-smi` 报 `Failed to initialize NVML: Unknown Error`。原因是 containerd 使用 systemd cgroup 驱动时，daemon-reload 会重写容器的 cgroup 设备权限，而没走资源申请路径的容器不会被 GPU Operator 修复。根本解决是规范地通过 `nvidia.com/gpu` 申请资源（或用 DRA 共享 GPU），不要用环境变量绕过调度。详见 [GPU 调度与 GPU Operator](/learn/gpu-operator)。

## Service 不通

按"客户端 → Service → Endpoints → Pod"逐段验证：

```bash
# 1. Service 有没有选中 Pod？ENDPOINTS 为空是最常见的原因
kubectl get svc web
kubectl get endpointslices -l kubernetes.io/service-name=web

# 2. 选择器和 Pod 的 label 是否一致
kubectl get svc web -o jsonpath='{.spec.selector}'
kubectl get pods --show-labels

# 3. 绕过 Service，直接访问 Pod IP 和 targetPort
kubectl debug -it <client-pod> --image=nicolaka/netshoot -- curl -sv http://<pod-ip>:8080/

# 4. 通过 DNS 名（即 ClusterIP）访问
kubectl debug -it <client-pod> --image=nicolaka/netshoot -- curl -sv http://web.default.svc.cluster.local/
```

| 现象 | 原因 |
|---|---|
| Endpoints 为空 | 选择器写错；Pod 未 Ready（就绪探针失败） |
| 直连 Pod IP 不通 | 应用只监听 `127.0.0.1`；`targetPort` 与容器端口不一致；NetworkPolicy 拦截 |
| Pod IP 通，ClusterIP 不通 | kube-proxy 或 Cilium 的 Service 规则异常，查对应组件日志 |
| 同节点通、跨节点不通 | CNI 跨节点隧道/路由问题，检查节点间防火墙和 MTU |

> [!WARNING] Cilium 的路由表冲突
> Cilium 会占用宿主机的若干路由表编号（例如 200、202、2004、2005）。如果宿主机网络配置（策略路由、多网卡）恰好也用了这些表，会出现诡异的跨节点不通。部署前核对宿主机 `ip rule` 和路由表，详见 [生产网络](/learn/production-networking)。

## DNS 解析失败

```bash
kubectl debug -it <pod> --image=nicolaka/netshoot --target=app
cat /etc/resolv.conf                                   # nameserver 是谁？search 和 ndots 是什么？
dig kubernetes.default.svc.cluster.local               # 集群内域名
dig example.com                                        # 集群外域名
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=50
```

几个关键认识：

- **`ndots:5` 的放大效应**：Pod 默认 `ndots:5`，查询 `api.example.com`（只有 2 个点）时会先依次拼上各个 search 域查询，全部失败后才查原名，一次解析变成 4～5 次。对外部域名调用频繁的应用，可以在域名末尾加 `.` 写成 FQDN，或在 Pod 的 `dnsConfig` 里调小 `ndots`。
- **NodeLocalDNS**：Kubespray 默认部署 NodeLocalDNS，Pod 的 nameserver 是节点本地的 `169.254.25.10`，由它缓存并转发给 CoreDNS。排查时要分清是本地缓存层还是 CoreDNS 层的问题。
- **上游 DNS 不可达**：节点无法访问外网 DNS 时，必须在 Kubespray 中配置 `upstream_dns_servers` 为内网 DNS，否则 CoreDNS 和 NodeLocalDNS 解析外部域名全部失败，甚至无法正常启动。

> [!PROD] 真实案例：一个域名配多个 IP，容器里却总是第一个
> 团队在 NodeLocalDNS 的 `hosts` 插件里给一个域名配了 3 个 IP 做简单负载均衡，结果容器里每次解析拿到的第一条记录都是同一个 IP，流量全部打到一台后端。原因是返回顺序固定，而大多数客户端只用第一条。解决办法是在该 server 块中加上 `loadbalance` 插件，让每次应答随机打乱记录顺序：
> ```text
> .:53 {
>     hosts {
>       192.168.4.1 app.example.com
>       192.168.4.2 app.example.com
>       192.168.4.3 app.example.com
>       fallthrough
>     }
>     cache 30
>     loadbalance
>     forward . 192.168.0.53
> }
> ```
> 用 Kubespray 管理时，这类自定义记录应该通过 `dns_etchosts` 等变量下发，而不是手改 ConfigMap，否则下次执行 playbook 会被覆盖。

## 节点 NotReady

节点失联约 40～50 秒后被标记为 NotReady（由 controller-manager 的 `node-monitor-grace-period` 控制），并被打上 `node.kubernetes.io/unreachable` 或 `not-ready` 污点。Pod 默认容忍这个污点 300 秒，之后才会被驱逐重建，这就是"节点挂了 5 分钟后 Pod 才迁走"的原因。

```bash
kubectl describe node gn-192-168-1-11      # 看 Conditions 和最后一次心跳时间
```

| Condition | 为 True 表示 |
|---|---|
| `Ready=False/Unknown` | kubelet 不健康或失联 |
| `MemoryPressure` | 可用内存低于驱逐阈值 |
| `DiskPressure` | 根分区或镜像分区空间/inode 不足 |
| `PIDPressure` | 进程数接近上限 |
| `NetworkUnavailable` | CNI 未就绪 |

SSH 登录节点后按顺序检查：

```bash
systemctl status kubelet containerd
journalctl -u kubelet --since "1 hour ago" | grep -iE "error|fail" | tail -50
df -h / /var/lib/containerd /var/lib/kubelet ; df -i /
timedatectl                                  # 时间是否同步
dmesg -T | tail -50                          # 内核错误、OOM、网卡掉线
```

常见根因：磁盘写满（日志、镜像堆积）、containerd 卡死、kubelet 证书过期、节点时间严重漂移导致证书校验失败（内网节点必须配置可达的 NTP 服务器）、CNI Pod 在该节点上异常、网络中断。

## 控制平面级故障

`kubectl` 本身报错时，问题在控制平面：

| 现象 | 方向 |
|---|---|
| `connection refused` / 超时 | apiserver 未运行或 VIP 漂移失败，在控制平面节点上 `crictl ps -a \| grep apiserver` |
| `x509: certificate has expired` | 证书过期，`kubeadm certs check-expiration` |
| 读正常、写报 `database space exceeded` | etcd 触发 NOSPACE，需要 compact + defrag |
| 新 Pod 一直 Pending 且无事件 | scheduler 异常 |
| Deployment 改了不生效、副本数不变 | controller-manager 异常 |

后两者在高可用集群中可以看 Lease 确认谁是 leader：`kubectl -n kube-system get lease`。etcd 和证书的处理见 [Day-2 运维](/learn/day2-operations)。

## 排查清单

| 现象 | 第一条命令 | 重点看 | 常见根因 |
|---|---|---|---|
| Pending | `kubectl describe pod` | FailedScheduling 事件 | 资源不足、污点、亲和性、PVC 未绑定 |
| ImagePullBackOff | `kubectl describe pod` | 拉取错误原文 | tag 错误、凭据、证书、超时 |
| CrashLoopBackOff | `kubectl logs --previous` | 日志末尾、退出码 | 配置错误、依赖不可用、探针过严 |
| OOMKilled | `kubectl describe pod` | Last State、limits | limits 太小、内存泄漏 |
| Evicted | `kubectl describe pod` | Message 中的资源类型 | 节点磁盘或内存压力 |
| Running 但不 Ready | `kubectl describe pod` | Readiness probe 事件 | 探针路径/端口错误、依赖未就绪 |
| Service 不通 | `kubectl get endpointslices` | 是否为空 | 选择器错误、Pod 未 Ready、targetPort 错误 |
| DNS 失败 | `dig` + CoreDNS 日志 | resolv.conf、上游 DNS | 上游不可达、ndots 放大、CoreDNS 异常 |
| 节点 NotReady | `kubectl describe node` | Conditions、心跳 | kubelet/containerd 异常、磁盘满、证书/时间 |
| kubectl 失败 | `kubectl get --raw /readyz?verbose` | 失败的检查项 | apiserver、etcd、证书 |

## 动手练习

以下练习全部可以在 kind 集群中完成。

1. **制造四种 Pod 故障并逐一诊断**：
   ```bash
   kubectl run bad-image --image=nginx:no-such-tag
   kubectl run crash --image=busybox:1.36 -- sh -c 'echo starting; sleep 3; exit 3'
   kubectl run too-big --image=nginx:1.27 --overrides='{"spec":{"containers":[{"name":"too-big","image":"nginx:1.27","resources":{"requests":{"cpu":"100"}}}]}}'
   kubectl run oom --image=polinux/stress --overrides='{"spec":{"containers":[{"name":"oom","image":"polinux/stress","command":["stress","--vm","1","--vm-bytes","250M","--vm-hang","1"],"resources":{"limits":{"memory":"100Mi"}}}]}}'
   ```
   对每个 Pod，只用 `describe`、`logs --previous` 和 jsonpath 找出根因和退出码，写成一句话结论。
2. **Service 选择器错误**：`kubectl create deployment web --image=nginx:1.27 --replicas=2`，再手写一个 `selector: {app: wbe}` 的 Service。用 `kubectl get endpointslices` 发现问题，修正后用 netshoot 验证可以访问。
3. **DNS 排查**：`kubectl run -it --rm dns --image=nicolaka/netshoot -- sh`，查看 `/etc/resolv.conf`，分别 `dig kubernetes.default` 和 `dig +search kubernetes.default`，对比结果，理解 search 域和 ndots 的作用。
4. **kubectl debug**：部署一个 distroless 镜像的 Pod（例如 `registry.k8s.io/pause:3.10`），尝试 `kubectl exec` 进去失败后，用 `kubectl debug -it <pod> --image=busybox:1.36 --target=<容器名>` 挂载临时容器，再用 `kubectl debug node/kind-worker -it --image=busybox:1.36` 进入节点查看 `/host/var/log/pods`。
5. **节点 NotReady**：执行 `docker exec kind-worker systemctl stop kubelet`，用 `kubectl get nodes -w` 观察多久变为 NotReady，`kubectl describe node kind-worker` 查看污点；5 分钟后观察该节点上 Deployment 的 Pod 是否被重建。最后 `docker exec kind-worker systemctl start kubelet` 恢复，并删除练习中创建的资源。

## 自测

<details>
<summary>CrashLoopBackOff 本身是故障原因吗？应该去哪里找真正的原因？</summary>

不是。它只表示容器反复退出、kubelet 正在按指数退避重启它。真正原因要看 `kubectl logs --previous`（上一次运行的日志）和 `lastState.terminated` 里的 `reason`、`exitCode`，以及 describe 事件中是否有探针失败。

</details>

<details>
<summary>退出码 137 一定是 OOMKilled 吗？</summary>

不一定。137 表示进程被 SIGKILL（128+9）。OOMKilled 会在 `lastState.terminated.reason` 中明确写出；如果 reason 不是 OOMKilled，还可能是存活探针失败后优雅终止超时被强杀，或者节点级 OOM、人为 kill。

</details>

<details>
<summary>Service 的 ClusterIP 访问不通，第一步应该检查什么？为什么？</summary>

先检查 EndpointSlice 是否有地址。Endpoints 为空时无论网络多正常都不可能通，而它为空的原因通常是选择器与 Pod label 不一致，或 Pod 未通过就绪探针，这两个都是最常见、最容易确认的问题。

</details>

<details>
<summary>节点宕机后，为什么上面的 Pod 要过好几分钟才在其他节点重建？</summary>

节点先要经过 `node-monitor-grace-period`（约 40～50 秒）才被标记为 NotReady 并打上 unreachable 污点；Pod 默认对该污点有 300 秒的 `tolerationSeconds`，超时后才被驱逐，控制器随后在其他节点重建。对恢复时间敏感的应用可以调小该容忍时间。

</details>

<details>
<summary>镜像是 distroless 的，没有 shell，怎么在 Pod 里抓包或测试网络？</summary>

用 `kubectl debug -it <pod> --image=nicolaka/netshoot --target=<容器名>` 挂一个临时容器，它与目标容器共享网络命名空间（加 `--target` 后还共享进程命名空间），可以在里面使用 tcpdump、curl、dig 等工具，不需要修改或重建原 Pod。

</details>

## 参考资料

- [Kubernetes 官方文档：监控、日志和调试](https://kubernetes.io/zh-cn/docs/tasks/debug/)
- [Kubernetes 官方文档：调试 Pod](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-application/debug-pods/)
- [Kubernetes 官方文档：调试运行中的 Pod](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-application/debug-running-pod/)
- [Kubernetes 官方文档：调试 Service](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-application/debug-service/)
- [Kubernetes 官方文档：调试 DNS 问题](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/dns-debugging-resolution/)
- [Kubernetes 官方文档：集群故障排查](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/)
- [Kubernetes 官方文档：节点压力驱逐](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/node-pressure-eviction/)
- [Kubernetes 官方文档：在 Kubernetes 集群中使用 NodeLocal DNSCache](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/nodelocaldns/)
- [Kubernetes 官方文档：Pod 的生命周期](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/)
- [nicolaka/netshoot](https://github.com/nicolaka/netshoot)
- [CoreDNS：loadbalance 插件](https://coredns.io/plugins/loadbalance/)
- [NVIDIA GPU Operator Issue #503：daemon-reload 后容器丢失 GPU 访问](https://github.com/NVIDIA/gpu-operator/issues/503)
