# 生产存储：CSI 选型与 Rook-Ceph

[存储基础](/learn/storage-basics)讲了 PV、PVC、StorageClass 的关系。kind 里默认的 `standard` StorageClass 背后是 local-path，数据就在节点磁盘上，节点挂了数据也就没了。生产集群要回答的问题复杂得多：数据要不要多副本？Pod 漂到别的节点还能不能读到？多个 Pod 能不能同时写？要不要快照？

这些能力都由 CSI（Container Storage Interface，容器存储接口）驱动提供，不同驱动差别很大。这一课先给出团队的选型表，然后按从简单到复杂的顺序讲本地盘、NFS 和 Rook-Ceph。Rook-Ceph 是重点，会把部署、池设计、日常运维和排障完整走一遍。最后是快照、商业/云原生文件系统，以及上线前的性能测试。

> [!NOTE] 本课需要的环境
> - **local-path、VolumeSnapshot**：kind 可以练习。kind 自带 local-path；快照可以用 csi-driver-host-path 模拟。
> - **nfs-csi**：需要一台 NFS 服务器，一台 Linux 虚拟机即可。
> - **Rook-Ceph**：至少 3 个节点，每个节点至少一块**空白**数据盘（虚拟机挂一块空虚拟盘也行）。kind 无法运行。
> - **GPFS、JuiceFS**：需要对应的存储系统，本课只讲接入要点。

## 选型：先问三个问题

1. **访问模式**：只需要单个 Pod 读写（RWO，块存储），还是要多个 Pod 共享（RWX，文件存储）？
2. **高可用由谁负责**：存储层多副本，还是应用自己复制（如 etcd、PostgreSQL 主从、Kafka）？
3. **存储在集群内还是集群外**：已经有 Ceph/NAS/并行文件系统，还是要在 K8s 节点上自建？

| 方案 | 类型 | 适用场景 | 不适用 |
| --- | --- | --- | --- |
| local-path | 本地盘，RWO | 缓存、自带复制的数据库、系统盘上的临时数据 | 需要数据随 Pod 漂移的场景 |
| nfs-csi | NFS，RWX | 已有高可用 NAS、小规模、开发环境 | 自建单点 NFS 跑生产 |
| ceph-csi | 块 + 文件 | 集群外已有独立 Ceph | — |
| Rook | 块 + 文件 + 对象 | 在 K8s 节点上自建 Ceph（融合部署） | 节点少于 3 台 |
| JuiceFS | 文件，RWX | 云上，或已有数据库 + 对象存储 | 对元数据延迟极敏感的场景 |
| GPFS / Weka | 并行文件系统 | AI 训练、HPC 高吞吐 | 预算有限（商业产品） |

> [!PROD] 数据库不一定要放分布式存储
> 数据库的主从复制已经提供了高可用，底下再叠一层三副本的 Ceph，写放大到 6 份，延迟也更高。团队的做法是数据库用本地 NVMe（local-path），高可用交给数据库自己的 Operator。分布式存储留给无法自己做复制的应用。

## local-path：本地 NVMe

[local-path-provisioner](https://github.com/rancher/local-path-provisioner) 在节点的指定目录下为每个 PVC 建一个子目录。团队用 Kustomize 远程引用上游清单，再打补丁：

```yaml title="storage/local-storage/kustomization.yaml"
resources:
  - github.com/rancher/local-path-provisioner/deploy?ref=v0.0.36
  - storageclass.yaml
patches:
  - path: patch.yaml
```

```yaml title="storage/local-storage/patch.yaml（节选）"
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-path-config
  namespace: local-path-storage
data:
  config.json: |-
    {
      "storageClassConfigs": {
        "local-path": {
          "nodePathMap": [{"node": "DEFAULT_PATH_FOR_NON_LISTED_NODES", "paths": ["/opt/local-path"]}]
        },
        "local-nvme": {
          "nodePathMap": [{"node": "DEFAULT_PATH_FOR_NON_LISTED_NODES", "paths": ["/data1/volumes"]}]
        }
      }
    }
```

```yaml title="storage/local-storage/storageclass.yaml"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-nvme
provisioner: rancher.io/local-path
parameters:
  configName: local-nvme
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
```

`WaitForFirstConsumer` 是本地盘的关键：PVC 先不绑定，等 Pod 被调度到某个节点后再在那个节点上建卷。用 `Immediate` 的话，卷可能建在 A 节点，Pod 却被调度到 B 节点，永远起不来。

> [!WARNING] local-path 没有容量限制
> PVC 里写的 `storage: 10Gi` 对 local-path 只是个标签，Pod 可以写满整块盘，把同盘的其他卷一起拖垮。需要硬限制时换用支持配额的方案（例如基于 LVM 的 CSI），或者给每类业务分独立的盘。

## nfs-csi：共享 NAS

机房已有高可用 NAS 时，[csi-driver-nfs](https://github.com/kubernetes-csi/csi-driver-nfs) 是最简单的 RWX 方案。它为每个 PVC 在共享目录下建一个子目录：

```yaml title="storage/nfs-csi/storageclass.yaml"
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: shared-nfs
provisioner: nfs.csi.k8s.io
parameters:
  server: nas.example.com
  share: /export/k8s
reclaimPolicy: Delete
volumeBindingMode: Immediate
mountOptions:
  - vers=3
  - nconnect=16     # 同一挂载点建立 16 条 TCP 连接，大幅提升吞吐
```

Chart 的 values 里把 controller 设成 2 副本即可。注意 nfs-csi 同样不强制容量限制，配额要靠 NAS 侧实现。

> [!WARNING] 自建 NFS 不要上生产
> 在一台 Linux 上 `apt install nfs-kernel-server` 很方便，但它是单点：服务器重启时所有挂载的 Pod 都会卡在 D 状态的 I/O 上，只能重启节点才能恢复。开发环境可以用，生产请用带双控制器的商业 NAS 或 CephFS。

## Rook-Ceph：在集群内自建分布式存储

Ceph 同时提供块存储（RBD）、文件存储（CephFS）和对象存储（RGW）。Rook 是 Ceph 的 Kubernetes Operator，把 Ceph 的 mon、mgr、osd、mds 都变成 Pod，由 `CephCluster` 等 CR 声明式管理。

```text
                ┌───────────── rook-ceph-operator ─────────────┐
                │  监听 CephCluster / CephBlockPool / CephFS CR │
                └──────────────────────┬───────────────────────┘
                                       ▼
  控制平面节点：mon × 3、mgr × 2        存储节点（node-role.kubernetes.io/storage）
                                       ├─ osd.0（/dev/nvme0n1）
  CSI：rbd / cephfs provisioner        ├─ osd.1（/dev/nvme1n1）
       + 每个节点的 csi plugin          └─ mds（CephFS 元数据）
```

### 部署

准备：至少 3 个存储节点，每台至少一块**没有分区、没有文件系统**的空盘，并打上标签：

```bash
kubectl label node sn-192-168-201-1 sn-192-168-201-2 sn-192-168-201-3 node-role.kubernetes.io/storage=true
lsblk -f        # 数据盘的 FSTYPE 列必须为空
```

Operator 同样用 Kustomize 引用上游 examples，截至本文写作时为 v1.19.x：

```yaml title="storage/rook/kustomization.yaml"
resources:
  - https://raw.githubusercontent.com/rook/rook/v1.19.4/deploy/examples/crds.yaml
  - https://raw.githubusercontent.com/rook/rook/v1.19.4/deploy/examples/common.yaml
  - https://raw.githubusercontent.com/rook/rook/v1.19.4/deploy/examples/csi-operator.yaml
  - https://raw.githubusercontent.com/rook/rook/v1.19.4/deploy/examples/operator.yaml
patches:
  - path: operator-patch.yaml   # operator 2 副本；CSI provisioner 放控制平面
```

然后是集群本身：

```yaml title="storage/rook/cephcluster.yaml（节选）"
apiVersion: ceph.rook.io/v1
kind: CephCluster
metadata:
  name: rook-ceph
  namespace: rook-ceph
spec:
  cephVersion:
    image: quay.io/ceph/ceph:v20.2.1
  dataDirHostPath: /var/lib/rook
  mon:
    count: 3
  network:
    provider: host
    addressRanges:
      public: ["192.168.201.0/24"]    # 客户端访问网
      cluster: ["192.168.202.0/24"]   # OSD 间复制网；只有一张网卡时删掉整个 network 段
  placement:
    all:
      nodeAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          nodeSelectorTerms:
            - matchExpressions:
                - key: node-role.kubernetes.io/storage
                  operator: Exists
    # mon、mgr 另设 placement 放到控制平面节点，此处省略
  resources:
    osd:
      requests: { cpu: "4", memory: 8Gi }
      limits: { memory: 16Gi }
  storage:
    useAllNodes: true
    useAllDevices: true
```

```bash
kubectl apply -k storage/rook
kubectl apply -f storage/rook/cephcluster.yaml
kubectl -n rook-ceph get cephcluster -w       # 等待 HEALTH_OK

# 安装 kubectl 插件，之后可以直接执行 ceph 命令
kubectl krew install rook-ceph
kubectl rook-ceph ceph -s
kubectl rook-ceph ceph osd tree
```

`network.provider: host` 让 Ceph 直接使用宿主机网络，绕过 CNI，性能明显更好，也能用上独立的复制网。

> [!WARNING] OSD 数量少于磁盘数
> 最常见的原因是磁盘上有残留：旧分区表、LVM、上一个 Ceph 集群的标签。Rook 为了防止误删数据，会跳过这些盘。看 prepare 日志确认原因：
>
> ```bash
> kubectl -n rook-ceph logs -l app=rook-ceph-osd-prepare -c provision --tail=50
> ```
>
> 清理磁盘后重启 operator（`kubectl -n rook-ceph rollout restart deploy/rook-ceph-operator`），它会重新扫描。日志提示 `belonging to a different ceph cluster` 时，要么手工擦盘，要么在 CephCluster 里设置 `cleanupPolicy.wipeDevicesFromOtherClusters: true`，但后者必须确认这些盘上的数据确实不要了。

### 块存储：RBD

团队用"副本池存元数据 + 纠删码池存数据"的组合：纠删码（Erasure Coding，EC）8+3 的空间利用率约 73%，远高于三副本的 33%。

```yaml title="storage/rook/rbd.yaml（节选）"
apiVersion: ceph.rook.io/v1
kind: CephBlockPool
metadata: { name: replicapool, namespace: rook-ceph }
spec:
  replicated: { size: 3, requireSafeReplicaSize: true }
---
apiVersion: ceph.rook.io/v1
kind: CephBlockPool
metadata: { name: ec-pool, namespace: rook-ceph }
spec:
  erasureCoded: { dataChunks: 8, codingChunks: 3 }
  parameters: { bulk: "true" }
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ceph-block
provisioner: rook-ceph.rbd.csi.ceph.com
parameters:
  clusterID: rook-ceph
  pool: replicapool          # RBD 镜像元数据
  dataPool: ec-pool          # 实际数据
  imageFeatures: layering
  csi.storage.k8s.io/fstype: ext4
  csi.storage.k8s.io/provisioner-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/provisioner-secret-namespace: rook-ceph
  csi.storage.k8s.io/node-stage-secret-name: rook-csi-rbd-node
  csi.storage.k8s.io/node-stage-secret-namespace: rook-ceph
  csi.storage.k8s.io/controller-expand-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/controller-expand-secret-namespace: rook-ceph
allowVolumeExpansion: true
reclaimPolicy: Delete
```

> [!PROD] EC 池的节点数要求
> 8+3 意味着每个对象切成 11 块分布在 11 个故障域（默认是主机）上，至少需要 11 台存储节点，否则 PG 永远无法 `active+clean`。节点少时用 4+2（6 台）或者直接用副本池。Ceph 新版本对 EC 做了性能优化，可以通过 `osd_pool_default_flag_ec_optimizations` 为新建的 EC 池开启，具体以所用版本的文档为准。

### 文件存储：CephFS

CephFS 提供 RWX 卷，适合多个 Pod 共享数据集、模型文件。它需要一个元数据池、一个或多个数据池，以及 MDS（元数据服务器）：

```yaml title="storage/rook/cephfs.yaml（节选）"
apiVersion: ceph.rook.io/v1
kind: CephFilesystem
metadata: { name: shared-ceph, namespace: rook-ceph }
spec:
  metadataPool:
    deviceClass: ssd
    replicated: { size: 3 }
  dataPools:
    - name: replicated
      replicated: { size: 3 }
    - name: ec
      erasureCoded: { dataChunks: 4, codingChunks: 2 }
  preserveFilesystemOnDelete: true   # 误删 CR 时保留数据
  metadataServer:
    activeCount: 1
    activeStandby: true
    resources:
      limits: { memory: 32Gi }
```

MDS 会把元数据缓存在内存里，每个文件或目录约占几 KB。千万级小文件的场景，MDS 内存给少了会频繁换出，`ls` 一个目录都要好几秒，所以团队至少给 32 GiB。多租户时每个租户一个独立的文件系统或数据池，方便做配额和隔离。

### 日常运维

| 操作 | 做法 |
| --- | --- |
| 加盘 | 插入空盘后 operator 自动创建 OSD（`useAllDevices: true` 时） |
| 节点离线 | Ceph 默认 10 分钟后把 OSD 标记为 out 并开始数据恢复；计划内维护先 `ceph osd set noout` |
| 加速恢复 | `ceph config set osd osd_mclock_override_recovery_settings true`，再调大 `osd_max_backfills`，恢复完记得还原 |
| PG 数不涨 | `ceph osd pool autoscale-status` 为空时，多半是 `.mgr` 池和其他池用了不同的 CRUSH 规则，用 `ceph osd pool set .mgr crush_rule <规则>` 统一 |
| Dashboard | `kubectl -n rook-ceph port-forward svc/rook-ceph-mgr-dashboard 8443`，admin 密码在 `rook-ceph-dashboard-password` Secret 里 |

移除一台存储节点上的 OSD：

```bash
kubectl drain sn-192-168-201-3 --ignore-daemonsets --delete-emptydir-data
kubectl -n rook-ceph scale deploy rook-ceph-operator --replicas=0   # 防止 operator 把 OSD 拉回来
kubectl -n rook-ceph scale deploy rook-ceph-osd-5 --replicas=0
kubectl rook-ceph ceph osd down osd.5
kubectl rook-ceph rook purge-osd 5 --force
kubectl -n rook-ceph scale deploy rook-ceph-operator --replicas=2
kubectl rook-ceph ceph -s          # 等数据恢复完成、HEALTH_OK 后再处理下一个
```

### 彻底删除

> [!DANGER] 下面的操作会销毁所有数据
> 只在测试集群或确认要重建时执行。

```bash
kubectl rook-ceph destroy-cluster          # 按提示输入 yes-really-destroy-cluster
kubectl delete -k storage/rook
# 每个存储节点上：
rm -rf /var/lib/rook
sgdisk --zap-all /dev/nvme0n1
dd if=/dev/zero of=/dev/nvme0n1 bs=1M count=100 oflag=direct
blkdiscard /dev/nvme0n1                    # SSD 额外执行
```

忘了擦盘是重装后 OSD 起不来的头号原因。

## 快照：VolumeSnapshot

CSI 快照是标准 API，但默认不安装。需要先装 [external-snapshotter](https://github.com/kubernetes-csi/external-snapshotter) 的 CRD 和 snapshot-controller（截至本文写作时 v8.x）：

```bash
kubectl apply -k "https://github.com/kubernetes-csi/external-snapshotter/client/config/crd?ref=v8.2.0"
kubectl apply -k "https://github.com/kubernetes-csi/external-snapshotter/deploy/kubernetes/snapshot-controller?ref=v8.2.0"
```

```yaml title="snapshot.yaml"
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: ceph-block-snap
driver: rook-ceph.rbd.csi.ceph.com
parameters:
  clusterID: rook-ceph
  csi.storage.k8s.io/snapshotter-secret-name: rook-csi-rbd-provisioner
  csi.storage.k8s.io/snapshotter-secret-namespace: rook-ceph
deletionPolicy: Delete
---
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: data-snap-1
spec:
  volumeSnapshotClassName: ceph-block-snap
  source:
    persistentVolumeClaimName: data
---
# 从快照恢复成一个新 PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-restore
spec:
  storageClassName: ceph-block
  dataSource:
    name: data-snap-1
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: [ReadWriteOnce]
  resources:
    requests: { storage: 10Gi }
```

快照和数据在同一个存储集群里，存储集群坏了快照也一起没，所以它**不能代替备份**。跨集群备份（如 Velero）放在 [Day-2 运维](/learn/day2-operations)。

## 更多选择：GPFS 与 JuiceFS

**IBM Storage Scale（GPFS）** 是 AI 训练集群常见的并行文件系统，通过 IBM 的 CSI Operator 接入，StorageClass 的 provisioner 是 `spectrumscale.csi.ibm.com`。接入前的准备比一般 CSI 多：在 GPFS GUI 上创建属于 `CsiAdmin` 组的用户；文件系统开启配额（`mmchfs -Q yes`）和 `--filesetdf`，让每个 PVC 对应的 fileset 显示自己的容量；需要挂载的节点打上 `scale=true` 标签，并且在 GPFS 管理 API 里状态为 HEALTHY。

**JuiceFS** 把元数据放数据库、数据放对象存储，适合云上或者已有对象存储的环境。元数据引擎按规模选：千万级文件以内用 Redis，十亿级用 PostgreSQL，更大规模用 TiKV。它的 CSI 以"Mount Pod"方式挂载，可以通过 `mountPodPatch` 调整 `--buffer-size`、`--cache-size` 等参数，本地缓存盘对读性能影响很大。

## 上线前做性能测试

存储上线前一定要测出基线，出问题时才有对比。团队用 [elbencho](https://github.com/breuner/elbencho)，它一个工具覆盖了 fio（块）、mdtest（元数据）、ior（多节点吞吐）的场景：

```bash
# 裸盘顺序写：48 线程、4M 块、直接 I/O，同时在另一个终端看 iostat -xm 1
elbencho -w -b 4M -t 48 --direct -s 100g /dev/nvme0n1

# 在文件系统上测多节点带宽：先在每个客户端节点启动服务
elbencho --service
# 再从一台机器统一发起
elbencho --hosts cn-192-168-3-50,cn-192-168-3-51 -w -r -b 4M -t 16 --direct \
  -s 20g -n 1 -N 4 --base10 /mnt/shared/bench
# 4K 随机 IOPS
elbencho --hosts cn-192-168-3-50,cn-192-168-3-51 -r -b 4k --rand --iodepth 10 \
  -t 16 --direct --timelimit 120 -s 20g -n 1 -N 4 /mnt/shared/bench
```

一块企业级 NVMe 顺序写一般能到几 GB/s。某块盘明显偏低时，先查 PCIe 链路有没有降速：

```bash
lspci -vvv -s <设备地址> | grep -E 'LnkCap|LnkSta'   # LnkSta 出现 downgraded 说明降速
```

对象存储（RGW、MinIO 等 S3 接口）用 [warp](https://github.com/minio/warp) 测试。

## 动手练习

1. 在 kind 里查看 `kubectl get sc standard -o yaml`，确认 provisioner 和 `volumeBindingMode`。创建一个 PVC，观察它在 Pod 创建前一直是 `Pending`，然后用 `docker exec` 进入对应的 kind 节点，找到卷在节点上的实际目录。
2. 在 kind 里安装 [csi-driver-host-path](https://github.com/kubernetes-csi/csi-driver-host-path)（仓库的 `deploy/kubernetes-latest/deploy.sh` 会一并安装快照 CRD 和 controller），用它的 StorageClass 创建 PVC 并写入文件，打一个 VolumeSnapshot，再从快照恢复出新 PVC，验证文件内容一致。
3. 有一台 Linux 虚拟机的话，装 NFS 服务端和 nfs-csi，创建一个 RWX 的 PVC，让两个 Pod 同时挂载并写入同一个文件，观察结果。
4. 有 3 台带空盘的虚拟机的话，按本文部署 Rook-Ceph（副本数可以降到 2，EC 换成副本池），用 `kubectl rook-ceph ceph -s` 确认 `HEALTH_OK`，然后故意删掉一个 OSD Pod，观察 Ceph 状态的变化和恢复过程。
5. 用 elbencho 或 fio 分别测试本机磁盘的 4M 顺序写带宽和 4K 随机读 IOPS，记录下来作为基线。

## 自测

<details>
<summary>local-path 的 StorageClass 为什么要用 WaitForFirstConsumer？</summary>

本地卷只存在于某一个节点上。`Immediate` 会在 Pod 调度之前就选节点建卷，调度器随后可能把 Pod 放到另一个节点，导致 Pod 永远无法挂载。`WaitForFirstConsumer` 让调度器先选好 Pod 的节点，再在该节点上创建卷。

</details>

<details>
<summary>Rook 部署后 OSD 数量比磁盘少，怎么排查？</summary>

看 `rook-ceph-osd-prepare` Pod 中 `provision` 容器的日志，通常是磁盘上有残留的分区、文件系统、LVM 或者旧 Ceph 集群的标签，Rook 为保护数据跳过了它。确认数据可以丢弃后擦盘（`sgdisk --zap-all`、`dd`、SSD 再 `blkdiscard`），然后重启 operator 触发重新扫描。

</details>

<details>
<summary>纠删码 8+3 的池至少需要多少台存储节点？为什么？</summary>

至少 11 台。每个对象被切成 8 个数据块和 3 个校验块，默认故障域是主机，11 块必须分布在 11 台不同主机上。主机不够时 PG 无法达到 `active+clean`。

</details>

<details>
<summary>有了 VolumeSnapshot，还需要备份吗？</summary>

需要。快照和原始数据在同一个存储集群里，存储集群故障、误删存储池时快照会一起丢失。快照适合快速回滚和克隆，备份要把数据复制到独立的存储系统或异地。

</details>

<details>
<summary>为什么数据库通常不放在 Ceph 上？</summary>

数据库自己有主从复制做高可用，再放在三副本 Ceph 上会产生多份冗余写入，延迟也比本地 NVMe 高很多。更常见的做法是数据库用本地盘，高可用交给数据库 Operator，分布式存储留给无法自己做复制的应用。

</details>

## 参考资料

- [Kubernetes 官方文档：存储类](https://kubernetes.io/zh-cn/docs/concepts/storage/storage-classes/)
- [Kubernetes 官方文档：卷快照](https://kubernetes.io/zh-cn/docs/concepts/storage/volume-snapshots/)
- [Kubernetes 官方文档：CSI 卷克隆](https://kubernetes.io/zh-cn/docs/concepts/storage/volume-pvc-datasource/)
- [Kubernetes CSI 开发者文档：驱动列表](https://kubernetes-csi.github.io/docs/drivers.html)
- [Rook 官方文档](https://rook.io/docs/rook/latest-release/)
- [Rook：Ceph 常见问题排查](https://rook.io/docs/rook/latest-release/Troubleshooting/ceph-common-issues/)
- [Ceph 官方文档：纠删码](https://docs.ceph.com/en/latest/rados/operations/erasure-code/)
- [local-path-provisioner](https://github.com/rancher/local-path-provisioner)
- [csi-driver-nfs](https://github.com/kubernetes-csi/csi-driver-nfs)
- [external-snapshotter](https://github.com/kubernetes-csi/external-snapshotter)
- [IBM Storage Scale CSI 文档](https://www.ibm.com/docs/en/scalecsi)
- [JuiceFS CSI 驱动文档](https://juicefs.com/docs/zh/csi/introduction/)
- [elbencho](https://github.com/breuner/elbencho)
