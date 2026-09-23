# 存储：Volume、PV、PVC 与 StorageClass

容器的文件系统是临时的：容器崩溃重启后，写进去的文件全部消失；同一个 Pod 里的两个容器也看不到彼此的文件。无状态的 Web 服务可以接受这一点，但数据库、上传目录、模型缓存不行。Kubernetes 用**卷（Volume）**解决容器间共享和数据留存，用 **PV / PVC / StorageClass** 把"存储从哪来"和"应用要多少存储"解耦。

学完这一课，你能区分临时卷与持久卷，看懂 PV、PVC、StorageClass 三者的关系，在 kind 自带的 local-path 存储上完成静态和动态供给，理解访问模式、回收策略和延迟绑定，并知道扩容与快照在什么条件下可用。

## 卷的两大类

```text
Volume（卷）
├── 临时卷（Ephemeral）：与 Pod 同生共死
│   ├── emptyDir           Pod 内容器共享的空目录
│   ├── configMap / secret / downwardAPI / projected   把配置"投射"成文件
│   └── 通用临时卷（ephemeral）  随 Pod 创建和删除的 PVC
└── 持久卷（Persistent）：生命周期独立于 Pod
    └── persistentVolumeClaim ──▶ PV ──▶ 真实存储（本地盘、NFS、Ceph、云盘……）
```

还有一个特殊的 `hostPath`，它直接挂载节点上的目录，既不算"临时"也谈不上"持久"，后面单独说。

## 临时卷

### emptyDir

Pod 被调度到节点时创建一个空目录，Pod 内所有容器都能挂载；**容器重启数据还在，Pod 删除数据就没了**。典型用途是 Sidecar 之间交换文件、缓存、临时计算目录。

```yaml title="emptydir-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-demo
spec:
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /data/log.txt; sleep 5; done"]
      volumeMounts:
        - name: shared
          mountPath: /data
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "tail -f /data/log.txt"]
      volumeMounts:
        - name: shared
          mountPath: /data
  volumes:
    - name: shared
      emptyDir:
        sizeLimit: 500Mi     # 超过后 Pod 会被驱逐
        # medium: Memory     # 使用 tmpfs，读写快，但计入容器内存用量
```

```bash
kubectl apply -f emptydir-demo.yaml
kubectl logs emptydir-demo -c reader -f
```

### projected：把多种来源投射到同一目录

[ConfigMap 与 Secret](/learn/configmaps-secrets) 里已经见过以卷方式挂载配置。`projected` 可以把 ConfigMap、Secret、downwardAPI 和 ServiceAccount 令牌合并挂到一个目录下：

```yaml title="projected-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: projected-demo
  labels:
    app: demo
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "ls -R /etc/app; sleep 3600"]
      volumeMounts:
        - name: all-in-one
          mountPath: /etc/app
          readOnly: true
  volumes:
    - name: all-in-one
      projected:
        sources:
          - downwardAPI:
              items:
                - path: labels
                  fieldRef:
                    fieldPath: metadata.labels
          - serviceAccountToken:        # 自动轮换的短期令牌
              path: token
              audience: vault
              expirationSeconds: 3600
```

实际上每个 Pod 默认挂载的 `/var/run/secrets/kubernetes.io/serviceaccount` 就是一个 projected 卷。

### hostPath：谨慎使用

`hostPath` 把节点上的文件或目录直接挂进容器。它的问题很明显：Pod 换了节点数据就"不见了"；容器能读写宿主机文件，安全风险大。

> [!DANGER] hostPath 的正确打开方式
> hostPath 只适合需要访问节点本身的系统组件，例如日志采集 DaemonSet 读取 `/var/log`、CNI 插件写 `/opt/cni/bin`。业务应用不要用它来"持久化数据"。挂载时尽量加 `readOnly: true`，生产集群通常用 Pod Security Standards 的 `baseline` / `restricted` 级别直接禁止它（见[工作负载安全加固](/learn/security)）。

## PV、PVC 与 StorageClass

### 为什么要分三层

如果 Pod 里直接写 NFS 服务器地址、Ceph monitor 列表，应用 YAML 就和具体存储绑死了，换个环境就得改。Kubernetes 把职责拆开：

| 对象 | 谁来创建 | 类比 |
|---|---|---|
| PersistentVolume（PV） | 管理员或自动供给 | 集群里一块实际存在的"盘" |
| PersistentVolumeClaim（PVC） | 应用开发者 | 一张"我要 10Gi、可读写"的申请单 |
| StorageClass（SC） | 管理员 | 一类存储的"模板"，告诉集群如何按需造出 PV |

```text
开发者:  Pod ──volumes──▶ PVC (10Gi, RWO, storageClassName: standard)
                              │ 绑定（1:1）
管理员:                        ▼
         StorageClass ──自动创建──▶ PV ──▶ CSI 驱动 ──▶ 真实存储
```

存储系统通过 **CSI（Container Storage Interface）** 驱动接入 Kubernetes。管理员部署 CSI 驱动、创建 StorageClass；开发者只写 PVC。

### kind 自带的存储

kind 预装了 Rancher 的 [local-path-provisioner](https://github.com/rancher/local-path-provisioner)，并把它注册为默认 StorageClass：

```console
$ kubectl get storageclass
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false
```

它会在 Pod 所在节点的 `/var/local-path-provisioner` 下为每个 PVC 建一个目录。数据只在那台节点上，适合实验、缓存或自带多副本的数据库，不适合需要跨节点漂移的数据。

## 动态供给

绝大多数时候你只需要写 PVC：

```yaml title="pvc-dynamic.yaml"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: standard     # 省略则使用默认 StorageClass
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: pvc-user
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo hello >> /data/hello.txt; sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data
```

```console
$ kubectl apply -f pvc-dynamic.yaml
$ kubectl get pvc data
NAME   STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS
data   Bound    pvc-5f0c...                                1Gi        RWO            standard
$ kubectl get pv
$ kubectl get pod pvc-user -o wide                 # 记下 NODE
$ docker exec k8s-journey-worker ls /var/local-path-provisioner   # 换成上一步的节点名
```

删掉 Pod 再重建，`/data/hello.txt` 会多一行——数据活得比 Pod 久。

### volumeBindingMode：为什么 PVC 一开始是 Pending

如果你先只创建 PVC，会看到它停在 `Pending`，事件里写着 `waiting for first consumer to be created before binding`。这是 `WaitForFirstConsumer` 延迟绑定在起作用：

| 模式 | 行为 | 适用 |
|---|---|---|
| `Immediate` | PVC 一创建就供给 PV | 网络存储，任意节点都能挂载 |
| `WaitForFirstConsumer` | 等到使用它的 Pod 被调度后，再在**该节点/可用区**上供给 | 本地盘、分可用区的云盘 |

如果本地盘用 `Immediate`，可能出现"卷建在节点 A，Pod 却因为 CPU 不足只能去节点 B"的死结。延迟绑定让调度器把 Pod 的约束和存储拓扑一起考虑。

## 静态供给

动态供给之前，管理员需要预先手工创建 PV。今天静态供给仍用于"接入已有数据"，例如一个已经存在的 NFS 目录，或一块指定的本地盘。下面用 `local` 类型卷模拟：

```bash
docker exec k8s-journey-worker mkdir -p /mnt/disk1
docker exec k8s-journey-worker sh -c 'echo "pre-existing data" > /mnt/disk1/readme.txt'
```

```yaml title="static-pv.yaml"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-manual
provisioner: kubernetes.io/no-provisioner   # 不自动供给
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: disk1-worker
spec:
  capacity:
    storage: 5Gi
  accessModes: ["ReadWriteOnce"]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-manual
  local:
    path: /mnt/disk1
  nodeAffinity:                       # local 卷必须声明它在哪个节点
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values: ["k8s-journey-worker"]
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: static-claim
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: local-manual
  resources:
    requests:
      storage: 2Gi                    # 小于等于 PV 容量即可匹配
---
apiVersion: v1
kind: Pod
metadata:
  name: static-user
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "cat /data/readme.txt; sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: static-claim
```

```bash
kubectl apply -f static-pv.yaml
kubectl logs static-user            # pre-existing data
kubectl get pod static-user -o wide # 一定在 k8s-journey-worker 上
```

注意 PVC 申请 2Gi，拿到的却是整个 5Gi 的 PV：PV 与 PVC 是一对一绑定，不会切分。

## 访问模式

`accessModes` 描述卷能以什么方式被挂载，能否支持取决于存储后端：

| 模式 | 缩写 | 含义 | 典型后端 |
|---|---|---|---|
| ReadWriteOnce | RWO | 被**单个节点**读写挂载（同节点多个 Pod 都可以用） | 块存储、本地盘、云盘 |
| ReadOnlyMany | ROX | 多个节点只读挂载 | NFS、CephFS |
| ReadWriteMany | RWX | 多个节点读写挂载 | NFS、CephFS、GPFS 等文件系统 |
| ReadWriteOncePod | RWOP | 整个集群只允许**一个 Pod** 读写挂载（v1.29 GA，仅 CSI 卷） | 需要严格单写者的场景 |

> [!WARNING] RWO 不等于"只有一个 Pod"
> RWO 限制的是节点。两个 Pod 调度到同一个节点时可以同时挂载同一个 RWO 卷，这对不支持并发写的应用（如 SQLite）可能造成数据损坏。需要严格单写者时使用 RWOP。

## 回收策略

PVC 删除后，绑定的 PV 怎么处理由 `reclaimPolicy`（在 PV 上是 `persistentVolumeReclaimPolicy`）决定：

- **Delete**：删除 PV 和后端真实存储。动态供给的默认值。
- **Retain**：保留 PV 和数据，PV 变为 `Released` 状态，不会自动被新 PVC 绑定，需要管理员处理。

```bash
kubectl delete pod static-user
kubectl delete pvc static-claim
kubectl get pv disk1-worker     # STATUS: Released，数据还在节点上
# 管理员确认数据可复用后，清除 claimRef 让 PV 重新变为 Available
kubectl patch pv disk1-worker --type json -p '[{"op":"remove","path":"/spec/claimRef"}]'
```

> [!PROD] 重要数据的 StorageClass 用 Retain
> 数据库等关键数据建议单独建一个 `reclaimPolicy: Retain` 的 StorageClass。误删 PVC（或误删整个命名空间）时，后端数据仍然保留，可以手工恢复。也可以对已有 PV 执行 `kubectl patch pv <name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'`。

## 自定义 StorageClass

StorageClass 的字段大多由 CSI 驱动解释。一个典型的生产 StorageClass：

```yaml title="storageclass-example.yaml"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-retain
provisioner: rancher.io/local-path   # 生产中换成你的 CSI 驱动名，如 rbd.csi.ceph.com
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: false          # local-path 不支持扩容
# parameters: {}                     # 驱动相关参数，如 Ceph 池名、文件系统类型
```

团队的生产集群里，同一个 local-path-provisioner 还会通过配置文件映射出多个 StorageClass：`local-path` 用系统盘，`local-nvme` 指向挂载在 `/data1` 的 NVMe 盘，另一个指向共享文件系统。应用按性能需求选择 `storageClassName` 即可。完整的选型（NFS、Ceph、GPFS 等）在阶段 4 的[生产存储](/learn/production-storage)中展开。

## 扩容与快照

### 卷扩容

当 StorageClass 设置了 `allowVolumeExpansion: true` 且 CSI 驱动支持时，直接修改 PVC 的容量即可：

```bash
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
kubectl get pvc data -w     # 观察 CAPACITY 变化与 conditions
```

扩容只能变大不能缩小；文件系统扩展通常可以在线完成。kind 的 local-path 不支持扩容，执行上面的命令会被拒绝，可以借此看看报错信息。

### 卷快照

卷快照（VolumeSnapshot）为 PVC 创建时间点副本，可用于备份或以快照为数据源创建新 PVC：

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: data-snap-1
spec:
  volumeSnapshotClassName: csi-rbd-snapclass
  source:
    persistentVolumeClaimName: data
```

快照需要三样东西：快照 CRD 与 snapshot-controller（不随 Kubernetes 默认安装）、支持快照的 CSI 驱动、以及 VolumeSnapshotClass。local-path 不支持快照，阶段 4 会在 Rook-Ceph 上实际操作。

## 动手练习

1. 部署 `emptydir-demo`，在它所在的节点上执行 `docker exec <节点名> sh -c 'crictl stop $(crictl ps --name writer -q)'` 让 writer 容器重启，确认日志文件还在；再删除 Pod 重建，确认文件消失。
2. 只创建 `pvc-dynamic.yaml` 中的 PVC 部分，观察 `Pending` 状态与事件；再创建 Pod，看 PVC 何时变为 `Bound`、PV 建在哪个节点。
3. 删除动态供给的 PVC，确认 PV 和节点上的目录都被清理（Delete 策略）；对比静态 PV 的 Retain 行为。
4. 删除 `pvc-user` Pod（保留 PVC），给它加上 `nodeSelector`，指定一个与 PV 所在节点不同的 `kubernetes.io/hostname` 后重建，观察 Pod 状态和事件中的 `volume node affinity conflict`，并解释原因。

## 自测

<details>
<summary>emptyDir 中的数据在什么情况下会丢失？</summary>

Pod 被删除或被驱逐、调度到其他节点时丢失。容器崩溃重启不会丢失，因为 emptyDir 的生命周期跟随 Pod 而不是容器。

</details>

<details>
<summary>PV、PVC、StorageClass 分别由谁创建，它们之间是什么关系？</summary>

StorageClass 由管理员创建，描述一类存储及其供给方式；PVC 由开发者创建，声明需要的容量和访问模式；PV 代表实际存储，可以由管理员手工创建（静态供给），也可以由 StorageClass 对应的供给器根据 PVC 自动创建（动态供给）。PV 和 PVC 一对一绑定，Pod 通过 PVC 使用存储。

</details>

<details>
<summary>本地盘的 StorageClass 为什么应该使用 WaitForFirstConsumer？</summary>

本地卷只能在所在节点使用。Immediate 模式下卷可能先建在某个节点，而 Pod 由于资源或亲和性约束无法调度到那个节点，从而永远 Pending。WaitForFirstConsumer 让调度器先选定 Pod 的节点，再在该节点上供给卷。

</details>

<details>
<summary>ReadWriteOnce 和 ReadWriteOncePod 有什么区别？</summary>

RWO 限制卷只能被一个**节点**读写挂载，同一节点上的多个 Pod 仍可以同时使用；RWOP 限制整个集群只有一个 **Pod** 能使用该卷，仅支持 CSI 卷。

</details>

<details>
<summary>PVC 被删除后，Retain 策略的 PV 为什么不能直接被新的 PVC 绑定？</summary>

PV 进入 `Released` 状态，`spec.claimRef` 仍然指向旧的 PVC，里面还保留着旧数据。Kubernetes 不会自动把可能含有他人数据的卷交给新申请者，需要管理员确认后清理数据或删除 `claimRef`，PV 才会回到 `Available`。

</details>

## 参考资料

- [Kubernetes 官方文档：卷](https://kubernetes.io/zh-cn/docs/concepts/storage/volumes/)
- [Kubernetes 官方文档：临时卷](https://kubernetes.io/zh-cn/docs/concepts/storage/ephemeral-volumes/)
- [Kubernetes 官方文档：投射卷](https://kubernetes.io/zh-cn/docs/concepts/storage/projected-volumes/)
- [Kubernetes 官方文档：持久卷](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/)
- [Kubernetes 官方文档：存储类](https://kubernetes.io/zh-cn/docs/concepts/storage/storage-classes/)
- [Kubernetes 官方文档：动态卷制备](https://kubernetes.io/zh-cn/docs/concepts/storage/dynamic-provisioning/)
- [Kubernetes 官方文档：卷快照](https://kubernetes.io/zh-cn/docs/concepts/storage/volume-snapshots/)
- [local-path-provisioner 项目主页](https://github.com/rancher/local-path-provisioner)
