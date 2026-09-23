# 控制平面深入：一个 Pod 的诞生

前面几个阶段我们一直在"用" Kubernetes：写 YAML、`kubectl apply`、看 Pod 跑起来。但当 Pod 卡在 `Pending`、Deployment 迟迟不滚动、`kubectl` 报 `the object has been modified` 时，只会用是不够的——你需要知道请求在集群里到底经过了哪些组件、每个组件在什么时候做了什么。

这一课沿着一次 `kubectl apply -f deploy.yaml` 走完全程：从 apiserver 的认证、授权、准入，到写入 etcd，再到控制器和调度器通过 list-watch 接力，最后 kubelet 调用 CRI、CNI、CSI 把容器真正跑起来。学完后你能画出这条链路，并在 kind 集群里亲眼看到每个控制平面组件。

## 全景：谁在做什么

在 [为什么需要 Kubernetes](/learn/why-kubernetes) 里我们见过架构图，这里换一个角度，按"数据流"重新画一遍：

```text
 kubectl apply
      │ HTTPS (REST)
      ▼
┌──────────────────────────── kube-apiserver ────────────────────────────┐
│ 认证 Authn → 授权 Authz → 变更准入 Mutating → Schema 校验 → 验证准入 Validating │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 写入（唯一能直接访问 etcd 的组件）
                                   ▼
                               ┌───────┐
                               │ etcd  │  ← Raft 多副本，存所有对象
                               └───────┘
                                   ▲ watch 事件经 apiserver 分发
        ┌──────────────────────────┼───────────────────────────┐
        │                          │                           │
┌───────┴────────────┐   ┌─────────┴─────────┐   ┌─────────────┴──────────┐
│ controller-manager │   │  kube-scheduler   │   │ kubelet（每个节点一个）   │
│ Deployment→RS→Pod  │   │ 为 Pod 选节点      │   │ CRI 起容器 / CNI 配网络   │
└────────────────────┘   │ 写 spec.nodeName  │   │ CSI 挂卷 / 上报 status    │
                         └───────────────────┘   └────────────────────────┘
```

记住两条铁律：

1. **只有 kube-apiserver 直接读写 etcd**。其他所有组件（包括 kubelet）都是 apiserver 的客户端。
2. **组件之间不互相调用**。scheduler 不会"通知" kubelet，controller 也不会"调用" scheduler。它们都只做一件事：watch 自己关心的对象，发现"期望状态 ≠ 实际状态"时，把自己的那一步结果写回 apiserver。这就是控制循环（Control Loop）。

## 第一站：kube-apiserver 的请求处理链

`kubectl apply` 本质上是一个 HTTPS 请求（首次是 `POST`，之后是 server-side apply 的 `PATCH` 或 client-side 的三方合并 `PATCH`）。加上 `-v=8` 就能看到：

```bash
kubectl apply -f deploy.yaml -v=8 2>&1 | grep -E 'GET|POST|PATCH|Response Status'
```

请求进入 apiserver 后依次经过：

| 阶段 | 做什么 | 失败时的典型报错 |
|---|---|---|
| 认证（Authentication） | 你是谁？客户端证书、Bearer Token、OIDC 等 | `401 Unauthorized` |
| 授权（Authorization） | 你能对这个资源做这个动作吗？通常是 Node + RBAC | `403 Forbidden ... cannot create resource` |
| 变更准入（Mutating Admission） | 修改对象：补默认 ServiceAccount、注入 sidecar、加默认值 | webhook 超时、`denied the request` |
| Schema 校验 | 字段类型、必填项是否合法 | `422 Unprocessable Entity` |
| 验证准入（Validating Admission） | 只判断放不放行：Pod Security、ResourceQuota、ValidatingAdmissionPolicy | `forbidden: violates PodSecurity ...` |
| 持久化 | 写入 etcd，分配新的 `resourceVersion` | `409 Conflict` |

认证和授权会在 [认证、授权与 RBAC](/learn/rbac) 展开，准入里的 Pod Security 与 ValidatingAdmissionPolicy 在 [工作负载安全加固](/learn/security) 展开。这里你只需要知道：**对象一旦通过这条链写进 etcd，apiserver 就返回成功**——此时 Pod 还一个都没创建。`kubectl apply` 返回 `deployment.apps/web created` 只代表"期望状态已记录"。

> [!NOTE] 为什么准入要分两段
> 变更准入可能改动对象，必须先全部跑完，验证准入才能看到"最终形态"。所以顺序永远是 Mutating → Validating，验证类 webhook 不应该修改对象。

## 第二站：etcd——集群唯一的真相来源

etcd 是一个强一致的分布式键值存储。Kubernetes 把每个对象序列化（默认 protobuf）后存成一个 key，例如：

```text
/registry/deployments/default/web
/registry/pods/default/web-7c9d8f6b5-x2kqp
/registry/secrets/kube-system/bootstrap-token-abcdef
```

### Raft 与多数派

生产环境的 etcd 通常是 3 或 5 个成员，用 Raft 共识算法保证一致性：

- 成员中选出一个 **Leader**，所有写请求都由 Leader 追加到日志，再复制给 Follower。
- 只有 **多数派（quorum）** 确认后，这条写入才算提交。3 节点容忍 1 个故障，5 节点容忍 2 个。
- 失去多数派时 etcd 拒绝写入，整个集群的"期望状态"就冻结了：已经在跑的 Pod 不受影响，但任何新建、扩缩、调度都做不了。

| 成员数 | 多数派 | 可容忍故障 |
|---|---|---|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 4 | 3 | 1（和 3 一样，还多一份网络开销） |
| 5 | 3 | 2 |

所以 etcd 成员数总是奇数。Raft 对磁盘 fsync 延迟非常敏感，这就是 [生产集群规划](/learn/cluster-planning) 里要做 etcd 磁盘验收的原因。

### MVCC 与 revision

etcd 使用多版本并发控制（MVCC）：每次写入都产生一个全局递增的 **revision**，旧版本被保留直到被压缩（compact）。Kubernetes 对象上的 `metadata.resourceVersion`，就是这个对象最后一次修改时的 etcd revision。

> [!PROD] etcd 空间配额
> 历史版本不断累积会让 db 文件变大。etcd 默认后端配额 `--quota-backend-bytes` 为 2 GiB，官方建议不超过 8 GiB。超过配额会触发 `NOSPACE` 告警，报错 `etcdserver: mvcc: database space exceeded`，此时 etcd 只读，apiserver 所有写操作失败。应急处理是在每个成员上 `etcdctl compact` 当前 revision、`etcdctl defrag`、再 `etcdctl alarm disarm`；长期要调大配额并确认 apiserver 的自动压缩在工作。完整步骤见 [Day-2 运维](/learn/day2-operations)。

## 第三站：list-watch、resourceVersion 与乐观并发

如果每个控制器都定时轮询 apiserver，几千个 Pod 的集群早就被压垮了。Kubernetes 的做法是 **list-watch**：

1. 客户端先 `LIST` 一次拿到全量对象，以及这批数据对应的 `resourceVersion`（比如 `12345`）。
2. 然后发起 `WATCH ?resourceVersion=12345`，apiserver 把此后发生的 `ADDED` / `MODIFIED` / `DELETED` 事件以流的形式推给它。
3. 连接断开后，从最后收到的 resourceVersion 继续 watch，不丢事件。如果那个版本已经被 etcd 压缩掉，apiserver 返回 `410 Gone`，客户端必须重新 LIST。

你可以直接用 kubectl 观察原始 watch 流：

```bash
# 终端 1：以原始 JSON 事件流的形式 watch Pod
kubectl get pods --watch --output-watch-events -o custom-columns=NAME:.metadata.name,RV:.metadata.resourceVersion,NODE:.spec.nodeName,PHASE:.status.phase

# 终端 2：创建一个 Pod
kubectl run rv-demo --image=nginx:1.27
```

终端 1 会看到同一个 Pod 的多次 `MODIFIED`：先是 NODE 为空（刚创建），然后 NODE 被 scheduler 填上，再是 PHASE 从 `Pending` 变 `Running`。每一行的 RV 都在递增——这正是多个组件先后"接力"修改同一对象的痕迹。

### Informer：控制器里的本地缓存

client-go 把 list-watch 封装成 **Informer**：

```text
apiserver ──list/watch──► Reflector ──► DeltaFIFO ──► Indexer（本地缓存）
                                             │
                                             └──► 事件回调 ──► WorkQueue ──► Reconcile()
```

控制器读数据时读的是本地缓存（Lister），不打 apiserver；只有写的时候才发请求。同一进程里的多个控制器还共享 Informer（SharedInformerFactory），这就是一个 controller-manager 能跑几十个控制器的原因。我们在 [CRD 与 Operator 模式](/learn/crd-operator) 里会自己写一个。

### 乐观并发：409 Conflict 从哪来

两个客户端同时改一个对象怎么办？Kubernetes 不加锁，而是用 **乐观并发控制（Optimistic Concurrency）**：`UPDATE` 请求会带上你读取时的 `resourceVersion`，如果 etcd 里的版本已经变了，写入失败并返回 `409 Conflict`。

```bash
kubectl get deploy web -o yaml > web.yaml
kubectl scale deploy web --replicas=5      # 别人抢先改了
kubectl replace -f web.yaml                # 带着旧 resourceVersion 写回
# Error from server (Conflict): Operation cannot be fulfilled on deployments.apps "web":
# the object has been modified; please apply your changes to the latest version and try again
```

控制器遇到 409 的标准做法是：重新读最新版本、重新计算、重新提交。你自己写脚本时也应该这样做，而不是删掉 `resourceVersion` 强行覆盖。

## 第四站：控制器接力——Deployment 到 Pod

Deployment 写进 etcd 后，kube-controller-manager 里的控制器开始接力：

1. **Deployment 控制器** watch 到新 Deployment，发现没有匹配的 ReplicaSet，于是创建一个 ReplicaSet（名字带 pod-template-hash）。
2. **ReplicaSet 控制器** watch 到新 ReplicaSet，`replicas: 3` 但匹配的 Pod 为 0，于是创建 3 个 Pod 对象。此时 Pod 的 `spec.nodeName` 为空。
3. 每个对象都通过 `metadata.ownerReferences` 指向上一级，垃圾回收控制器据此做级联删除。

```bash
kubectl get pod -l app=web -o jsonpath='{.items[0].metadata.ownerReferences}' | jq
```

所有这些"创建"都是回到 apiserver、走完整认证授权准入链的普通写请求——控制器也是 apiserver 的客户端，controller-manager 有自己的证书和 RBAC 权限。

## 第五站：kube-scheduler 的过滤与打分

scheduler watch 的是 `spec.nodeName` 为空的 Pod。它把 Pod 放进调度队列，逐个处理，每次调度分两大阶段：

```text
调度周期（串行）                                        绑定周期（可并行）
PreFilter → Filter → PostFilter → PreScore → Score → Reserve → Permit → PreBind → Bind
             │           │                    │
         排除不合格节点  都不合格时尝试抢占     给剩余节点打分（0-100）加权求和
```

- **Filter（过滤）**：排除放不下的节点。例如 `NodeResourcesFit`（requests 是否放得下）、`NodeAffinity`、`TaintToleration`、`VolumeBinding`、`PodTopologySpread`。
- **Score（打分）**：对剩余节点打分。例如 `NodeResourcesBalancedAllocation`、`ImageLocality`（节点上已有镜像加分）、`InterPodAffinity`。
- **PostFilter**：没有节点通过过滤时，默认插件 `DefaultPreemption` 尝试驱逐低优先级 Pod 腾位置。
- **Bind**：选中节点后，scheduler 调用 Pod 的 `binding` 子资源，把 `spec.nodeName` 写回 apiserver。

所以 Pod `Pending` 时第一件事永远是看事件：

```bash
kubectl describe pod <pod> | sed -n '/Events/,$p'
# Warning  FailedScheduling  0/3 nodes are available: 1 node(s) had untolerated taint
# {node-role.kubernetes.io/control-plane: }, 2 Insufficient cpu. preemption: 0/3 nodes are
# available: 3 No preemption victims found for incoming pod.
```

这句话就是 Filter 阶段每个插件的"否决理由"汇总。各插件的调优在 [调度：亲和性、污点与拓扑分布](/learn/scheduling) 已经讲过。

## 第六站：kubelet 与 CRI / CNI / CSI

每个节点上的 kubelet watch 的是 `spec.nodeName == 自己` 的 Pod（通过 field selector）。发现新 Pod 后：

```text
kubelet
  │ 1. 准入检查（节点资源、hostPort 冲突等）
  │ 2. CSI：等待卷 attach，调用 CSI 节点插件 NodeStageVolume / NodePublishVolume 挂载
  │ 3. CRI：RunPodSandbox ──► 容器运行时（containerd）创建 pause 容器与网络命名空间
  │                              │
  │                              └─► CNI 插件：ADD，给 netns 配 IP、路由（Cilium / Calico …）
  │ 4. CRI：PullImage → CreateContainer → StartContainer（先 init 容器，再主容器）
  │ 5. 执行探针，把 Pod IP、容器状态、Conditions 写回 status
  ▼
apiserver（status 子资源）
```

三个接口把 kubelet 和具体实现解耦：

| 接口 | 全称 | 负责 | 常见实现 |
|---|---|---|---|
| CRI | Container Runtime Interface | 沙箱和容器的生命周期、镜像 | containerd、CRI-O |
| CNI | Container Network Interface | 给 Pod 网络命名空间配网络 | Cilium、Calico、Flannel |
| CSI | Container Storage Interface | 卷的创建、挂载、快照 | Ceph CSI、local-path、NFS CSI |

注意 CNI 不是 kubelet 直接调的，而是由容器运行时在创建沙箱时调用。常见的 `failed to create pod sandbox ... network plugin not ready` 就发生在这一步，下一课 [网络模型与 CNI](/learn/networking-model) 会细讲。

kubelet 把 `status.phase: Running`、`podIP` 写回后，Endpoints/EndpointSlice 控制器 watch 到就绪的 Pod，把它加入 Service 后端——一个 Pod 至此才算真正"诞生"并开始接流量。

## 静态 Pod：控制平面如何启动自己

这里有个鸡生蛋的问题：apiserver 本身也是 Pod，那它是谁调度的？答案是 **静态 Pod（Static Pod）**。kubelet 除了从 apiserver 获取 Pod，还会监视本地目录（kubeadm 默认 `/etc/kubernetes/manifests`），直接运行其中的 Pod 清单，不需要 apiserver 和 scheduler 参与。

- apiserver 起来后，kubelet 会为每个静态 Pod 创建一个只读的 **镜像 Pod（Mirror Pod）**，所以你在 `kubectl get pod -n kube-system` 里能看到它们，名字带节点后缀。
- 用 `kubectl delete` 删镜像 Pod 没用，kubelet 会马上重建；要修改就改节点上的清单文件，kubelet 检测到变化后会重启该 Pod。

> [!WARNING]
> 修改 `/etc/kubernetes/manifests/kube-apiserver.yaml` 时不要在这个目录下留备份文件（如 `kube-apiserver.yaml.bak`），kubelet 会把目录里所有清单都当成静态 Pod 运行。备份请放到别的目录。

## 用 kind 观察控制平面

> [!LAB] 进入控制平面节点
> 以下操作基于 [搭建本地实验集群](/learn/local-cluster) 中创建的 kind 集群（集群名 `kind`，节点容器名 `kind-control-plane`）。

1. 列出控制平面组件，注意名字都带 `-kind-control-plane` 后缀，说明是镜像 Pod：

```bash
kubectl get pods -n kube-system -o wide
kubectl get pod -n kube-system kube-apiserver-kind-control-plane \
  -o jsonpath='{.metadata.annotations.kubernetes\.io/config\.source}{"\n"}'
# file   ← 来源是本地文件，即静态 Pod
```

2. kind 的节点本身是个容器，进去看看静态 Pod 清单和容器运行时：

```bash
docker exec -it kind-control-plane bash
ls /etc/kubernetes/manifests/
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
crictl ps --name 'kube-|etcd'
grep -E 'admission|authorization-mode|etcd-servers' /etc/kubernetes/manifests/kube-apiserver.yaml
```

3. 直接访问 etcd，看看 Kubernetes 对象在里面长什么样：

```bash
kubectl -n kube-system exec etcd-kind-control-plane -- etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/namespaces/default --prefix --keys-only

kubectl -n kube-system exec etcd-kind-control-plane -- etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint status -w table
```

`endpoint status` 输出里的 `RAFT TERM`、`RAFT INDEX`、`IS LEADER` 就是上面讲的 Raft 状态。

4. 看 scheduler 和 controller-manager 的领导者选举。多副本控制平面中它们只有一个实例在干活，靠 Lease 对象抢锁：

```bash
kubectl get lease -n kube-system
kubectl get lease -n kube-system kube-scheduler -o jsonpath='{.spec.holderIdentity}{"\n"}'
```

## 动手练习

1. 在终端 1 运行 `kubectl get events -w`，终端 2 执行 `kubectl create deployment web --image=nginx:1.27 --replicas=2`，按时间顺序写下 `ScalingReplicaSet`、`SuccessfulCreate`、`Scheduled`、`Pulling`、`Started` 分别是哪个组件发出的。
2. 停掉调度器：进入 `kind-control-plane`，把 `kube-scheduler.yaml` 移到 `/tmp`。然后创建一个 Deployment，观察 Pod 一直 `Pending` 且没有任何调度事件；移回文件后 Pod 立即被调度。
3. 在 scheduler 停掉时，手工创建一个带 `spec.nodeName: kind-worker` 的 Pod，它能跑起来吗？为什么？
4. 用 `kubectl get deploy web -o yaml` 导出后执行 `kubectl scale`，再 `kubectl replace` 导出的文件，复现 409 Conflict。
5. 用 `etcdctl get /registry/deployments/default/web` 读取原始数据，观察它为什么看起来是乱码（提示：protobuf）。

## 自测

<details>
<summary>kubectl apply 返回 created 之后，Pod 就一定已经在节点上存在了吗？</summary>

不一定。`created` 只表示 Deployment 对象通过了认证、授权、准入并写入 etcd。之后还要经过 Deployment 控制器创建 ReplicaSet、ReplicaSet 控制器创建 Pod、scheduler 绑定节点、kubelet 通过 CRI 拉镜像启动容器，每一步都是异步的，任何一步都可能卡住。

</details>

<details>
<summary>为什么说 scheduler 和 kubelet 之间没有直接通信？scheduler 选好节点后 kubelet 是怎么知道的？</summary>

scheduler 只是通过 `binding` 子资源把 `spec.nodeName` 写回 apiserver。kubelet 一直 watch 着 `spec.nodeName` 等于自己的 Pod，apiserver 推送了 `MODIFIED` 事件，kubelet 于是开始创建容器。两者通过 apiserver 中的对象状态解耦。

</details>

<details>
<summary>3 节点 etcd 挂了 2 个，集群会怎样？</summary>

失去多数派，etcd 无法提交写入（也无法进行线性一致读）。apiserver 的写请求全部失败，无法创建、扩缩、调度任何东西；已经运行的容器由 kubelet 和运行时维持，业务流量通常不中断，但出现故障不会被自愈。

</details>

<details>
<summary>watch 时收到 410 Gone 是什么意思，客户端该怎么办？</summary>

请求的 resourceVersion 太旧，对应的历史已经被 etcd 压缩或超出 apiserver watch 缓存窗口，无法从那个点继续推送事件。客户端必须重新 LIST 拿到新的全量数据和 resourceVersion，再重新 WATCH。client-go 的 Reflector 会自动完成这件事。

</details>

<details>
<summary>静态 Pod 能被 kubectl delete 删除吗？怎样才能真正停掉它？</summary>

不能。`kubectl` 看到的是 kubelet 创建的镜像 Pod，删除后 kubelet 会马上重建。要停掉它，需要在对应节点上把清单文件从 kubelet 的静态 Pod 目录（kubeadm 默认 `/etc/kubernetes/manifests`）中移走。

</details>

## 参考资料

- [Kubernetes 官方文档：Kubernetes 组件](https://kubernetes.io/zh-cn/docs/concepts/overview/components/)
- [Kubernetes 官方文档：Kubernetes API 概念（watch、resourceVersion）](https://kubernetes.io/zh-cn/docs/reference/using-api/api-concepts/)
- [Kubernetes 官方文档：控制器](https://kubernetes.io/zh-cn/docs/concepts/architecture/controller/)
- [Kubernetes 官方文档：调度框架](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/scheduling-framework/)
- [Kubernetes 官方文档：创建静态 Pod](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/static-pod/)
- [Kubernetes 官方文档：操作 Kubernetes 中的 etcd 集群](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [Raft 共识算法可视化](https://raft.github.io/)
