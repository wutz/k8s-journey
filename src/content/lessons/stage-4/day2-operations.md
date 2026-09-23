# Day-2 运维：升级、扩容与 etcd 维护

集群部署上线是 Day-1，之后的几年都是 Day-2：Kubernetes 每 4 个月左右发布一个小版本，每个版本只维护约 14 个月，不升级就会失去安全修复；业务增长要加节点，硬件故障要下节点；etcd 的数据库在不停长大；证书默认一年过期。这些事每一件都不难，但每一件做错都可能让整个集群停摆。

这一课以 [Kubespray](/learn/kubespray) 部署的集群为例，讲清楚：升级前怎样做影响评估、版本能不能跳、升级命令怎么跑；节点维护时 cordon/drain 和 PodDisruptionBudget 怎么配合；工作节点和控制平面节点的增删；etcd 的备份、恢复、压缩和碎片整理；证书续期。

> [!NOTE] 所需环境
> 升级、扩缩容部分需要一套用 Kubespray 部署的多节点集群（虚拟机即可），kind 无法模拟。drain、PDB、etcd 快照与碎片整理、证书检查可以在 kind 中练习，见文末。

## Day-2 操作全景

| 操作 | 频率 | 工具 | 主要风险 |
|---|---|---|---|
| 小版本升级 | 每 4～12 个月 | Kubespray `upgrade-cluster.yml` | 破坏性变更、etcd 大版本、组件不兼容 |
| 节点维护（内核、驱动、硬件） | 随时 | `kubectl drain` + PDB | 服务中断、drain 卡住 |
| 扩容工作节点 | 按需 | `scale.yml` | 新节点配置漂移 |
| 下线节点 | 按需 | `remove-node.yml` | 有状态数据未迁移 |
| 扩容控制平面 | 少见 | `cluster.yml` / `recover-control-plane.yml` | etcd 成员变更失败 |
| etcd 备份 | 每天 | `etcdctl snapshot save` | 备份不可用却没人发现 |
| etcd 压缩与碎片整理 | 按告警 | `etcdctl compact / defrag` | 整理期间成员阻塞 |
| 证书续期 | 每年（或自动） | `kubeadm certs renew` | 忘记续期导致集群不可用 |

## 升级

### 版本跳跃规则

升级前先搞清楚"能不能一步到位"。三层规则同时生效：

1. **Kubernetes 本身不能跳小版本**。控制平面必须 1.33 → 1.34 → 1.35 逐个升级。版本偏差策略（Version Skew Policy）规定 kubelet 最多可以比 apiserver 旧 3 个小版本，但不能比它新，所以永远**先升控制平面，再升工作节点**。
2. **Kubespray 不能跳版本**。官方要求按 release tag 逐个升级，例如 2.29 → 2.30 → 2.31，每个 Kubespray 版本只保证从上一个版本升级过来的路径。
3. **组件自己的升级路径**。最典型的是 etcd：3.5 升 3.6 要求所有成员先到 3.5.26 及以上。

```text
Kubespray 2.29 ──▶ 2.30 ──────────▶ 2.31
K8s        1.33 ──▶ 1.34 ──────────▶ 1.35
etcd       3.5.x ─▶ 3.5.26（必须停留）─▶ 3.6.10（大版本，回退需按官方流程）
```

> [!WARNING] 不要跨版本"一步到位"
> 团队评估 Kubespray 2.30 → 2.31 时特别标注：etcd 从 3.5 升到 3.6 必须先经过 3.5.26+，因为 3.5.24～3.5.26 修复了多个会阻塞 3.6 升级的问题。落到 Kubespray 上就是"先升到 2.30（带 etcd 3.5.26），确认健康后再升 2.31"。想从更老的版本直接跳到最新，等于自己去踩官方没测过的路径。

### 升级影响评估

每次升级前，团队都会写一份影响评估：把 Kubespray 的发布说明、Kubernetes 的 CHANGELOG 和各组件的发布说明读一遍，按"对我们集群的影响"排序。以下是 2.30 → 2.31（Kubernetes 1.34 → 1.35）评估的核心结论，可以当作模板：

| 变更项 | 影响 | 应对 |
|---|---|---|
| cgroup v1 默认拒绝启动（K8s 1.35 `FailCgroupV1=true`） | 最高：cgroup v1 节点 kubelet 直接起不来 | 逐节点确认 `stat -fc %T /sys/fs/cgroup` 输出 `cgroup2fs` |
| ingress-nginx addon 被移除（上游项目已归档） | 高 | 规划迁移到 Gateway API、Istio 或其他控制器 |
| etcd 3.5 → 3.6 大版本 | 高 | 分两步升级，升级前必须快照备份 |
| Dashboard addon 移除 | 中 | 改用 Headlamp |
| 移除 kubelet `--pod-infra-container-image` 标志 | 中 | 检查是否手动加过 |
| IPVS kube-proxy 模式废弃 | 中 | `kube_proxy_mode: ipvs` 的集群评估迁移到 nftables |
| StorageVersionMigration v1alpha1 移除 | 中 | 升级前删除该类资源，否则升级阻塞 |
| 变量重命名 `ssh_bastion_confing__name` → `ssh_bastion_config_name` | 低 | 覆盖过旧变量的，改名，否则静默失效 |

cgroup v1 这一条值得展开，它是"升级后节点全挂"级别的风险：

```bash
# 1. 确认 cgroup 版本：cgroup2fs 为 v2（正常），tmpfs 为 v1
stat -fc %T /sys/fs/cgroup

# 2. 是否曾被手动切回 v1
grep -rE "unified_cgroup_hierarchy" /etc/default/grub /etc/default/grub.d/*.cfg 2>/dev/null
```

Ubuntu 22.04/24.04、RHEL 9 默认都是 cgroup v2，RHEL 8 默认 v1。另外 cgroup v2 下还要确认工作负载兼容：OpenJDK 需要 8u372+/11.0.16+/17+，Node.js 需要 20.3.0+，否则程序读不到正确的内存限制；cgroup v2 的 OOM 默认杀整个 cgroup，而不是单个进程。

> [!PROD] 评估要落到"命中条件"
> 发布说明里的每一条变更，都要回答"我们的集群命中了吗"。例如 IPVS 废弃，只有 `kube_proxy_mode: ipvs` 的集群才需要处理；bastion 变量重命名，只有覆盖过旧变量的 inventory 才受影响。评估清单写成"条件 + 检查命令 + 处理方式"，下一个人才能照着执行。

### 执行升级

升级前的准备：

1. **备份 etcd**（见后文），并把快照拷到集群外。
2. 下载新版本 Kubespray，把旧 inventory 拷过去，用 `diff` 对比新版本 `inventory/sample/group_vars` 的变化，合并新增和改名的变量。
3. 在同样拓扑的测试集群上先跑一遍。

升级命令：

```bash
source .venv/bin/activate

# 整体升级（Kubespray 内部会先升 etcd 和控制平面，再分批升工作节点）
ansible-playbook -i inventory/mycluster/inventory.ini -b upgrade-cluster.yml \
  -e kube_version=1.35.4
```

生产上更推荐**分阶段**执行，每一步确认健康再继续：

```bash
# 第一步：只升 etcd 和控制平面
ansible-playbook -i inventory/mycluster/inventory.ini -b upgrade-cluster.yml \
  --limit "kube_control_plane:etcd"

# 第二步：分批升工作节点，例如先升一批非关键节点
ansible-playbook -i inventory/mycluster/inventory.ini -b upgrade-cluster.yml \
  --limit "gn-192-168-1-1*:gn-192-168-1-2*"
```

几个控制升级节奏的变量：

| 变量 | 作用 |
|---|---|
| `serial` | 工作节点每批并行升级的数量或比例，默认 `20%`，生产可设为 `1` |
| `drain_nodes` | 升级前是否 drain 节点，默认开启 |
| `drain_timeout` / `drain_grace_period` | drain 的超时与 Pod 优雅终止时间 |
| `upgrade_node_confirm` | 每个节点升级前等待人工确认 |
| `upgrade_node_pause_seconds` | 每个节点升级后暂停若干秒，便于观察 |

升级完成后逐项验证：`kubectl get nodes` 版本一致且 Ready；`kube-system` 下 Pod 全部 Running；etcd `endpoint health --cluster` 正常；监控面板上 apiserver 错误率和延迟没有异常。

## 节点维护：cordon、drain 与 PDB

给节点升级内核、换 GPU 驱动、修硬件，都要先把上面的 Pod 安全挪走：

```bash
# 标记不可调度，已有 Pod 不受影响
kubectl cordon gn-192-168-1-11

# 驱逐 Pod：DaemonSet 的 Pod 驱逐了也会马上回来，所以跳过；
# 使用 emptyDir 的 Pod 数据会丢，需要显式确认
kubectl drain gn-192-168-1-11 --ignore-daemonsets --delete-emptydir-data --timeout=10m

# ……维护……

# 恢复调度
kubectl uncordon gn-192-168-1-11
```

`drain` 用的是 Eviction API，会尊重 **PodDisruptionBudget（PDB）**：PDB 声明"这个应用在自愿中断时至少保留多少个可用副本"，驱逐会让它低于这个值时，驱逐请求被拒绝，drain 就会等待重试。

```yaml title="web-pdb.yaml"
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web
spec:
  minAvailable: 2          # 或 maxUnavailable: 1
  selector:
    matchLabels:
      app: web
```

> [!WARNING] PDB 让 drain 永远卡住
> 常见的坑是 `minAvailable` 等于副本数（例如 3 副本配 `minAvailable: 3`），或者单副本应用配了 `minAvailable: 1`。这样的 PDB 不允许任何一个 Pod 被驱逐，drain 会一直重试直到超时，Kubespray 升级也会卡在这个节点。PDB 要留出余量，单副本应用本来就无法做到零中断，不要给它配 PDB。

> [!PROD] 有状态服务要额外处理
> 存储节点（例如 Rook-Ceph 的 OSD 节点）下线前，除了 drain，还要先让存储系统把该节点的数据迁走，例如先把 OSD 标记 out、等待数据重平衡完成。只 drain 不迁数据，等于让副本数静默下降。详见 [生产存储](/learn/production-storage)。

## 扩容与缩容

### 添加工作节点

1. 新节点按 [生产集群规划](/learn/cluster-planning) 的规范完成 OS 初始化，确保安装节点能免密 SSH。
2. 把节点加入 `inventory.ini` 的 `[kube_node]` 组。
3. 先刷新所有节点的 facts，再只对新节点执行 `scale.yml`：

```bash
ansible-playbook -i inventory/mycluster/inventory.ini -b playbooks/facts.yml
ansible-playbook -i inventory/mycluster/inventory.ini -b scale.yml \
  --limit=gn-192-168-1-21,gn-192-168-1-22
```

先跑 `facts.yml` 是因为 `--limit` 只会收集被限定节点的 facts，而配置模板（例如 nginx-proxy、/etc/hosts）需要引用其他节点的信息。

> [!TIP] 真实报错：ipwrap filter 未定义
> 团队在 Kubespray 2.29 扩容时遇到 `AnsibleFilterError: Unrecognized type ... for ipwrap filter`，卡在 `Write nginx-proxy configuration` 任务。原因是控制平面节点缺少访问地址变量，解决方法是在 inventory 里给控制平面节点补上 `main_access_ip`，值与 `ansible_host` 一致：
> ```ini
> [kube_control_plane]
> mn-192-168-3-21 ansible_host=192.168.3.21 main_access_ip=192.168.3.21 ip=192.168.3.21 etcd_member_name=etcd1
> ```

### 下线节点

```bash
# 正常下线：会 drain、停止服务、清理节点并从集群删除
ansible-playbook -i inventory/mycluster/inventory.ini -b remove-node.yml \
  -e node=gn-192-168-1-21

# 节点已经宕机无法 SSH：跳过 reset，强制移除
ansible-playbook -i inventory/mycluster/inventory.ini -b remove-node.yml \
  -e node=gn-192-168-1-21 -e reset_nodes=false -e allow_ungraceful_removal=true
```

执行成功后再把节点从 `inventory.ini` 删掉。顺序反了，playbook 就找不到要删的节点。

### 扩容控制平面

控制平面扩容涉及 etcd 成员变更，是风险最高的扩容操作。团队曾把一个单控制平面集群（Kubespray 2.28）扩成 3 节点 HA，采用的是官方文档"恢复控制平面"的思路：把新节点当作"坏掉的节点"加入 `broken_*` 组，让 playbook 以恢复的逻辑安全地添加 etcd 成员。

```ini title="inventory.ini（扩容期间）"
[kube_control_plane]
mn-192-168-3-21 ansible_host=192.168.3.21 etcd_member_name=etcd1
mn-192-168-3-22 ansible_host=192.168.3.22 etcd_member_name=etcd2
mn-192-168-3-23 ansible_host=192.168.3.23 etcd_member_name=etcd3

[etcd:children]
kube_control_plane

[broken_etcd]
mn-192-168-3-22 ansible_host=192.168.3.22 etcd_member_name=etcd2
mn-192-168-3-23 ansible_host=192.168.3.23 etcd_member_name=etcd3

[broken_kube_control_plane]
mn-192-168-3-22 ansible_host=192.168.3.22
mn-192-168-3-23 ansible_host=192.168.3.23
```

```bash
ansible-playbook -i inventory/mycluster/inventory.ini -b playbooks/facts.yml
ansible-playbook -i inventory/mycluster/inventory.ini -b recover-control-plane.yml \
  --limit=etcd,kube_control_plane -e etcd_retries=10
```

成功后**立即删除** `broken_*` 两个组，避免以后误触发恢复逻辑；然后用 `etcdctl member list` 确认 3 个成员都是 `started`。

> [!WARNING] 版本差异很大，先读对应版本的文档
> - 控制平面扩容的推荐做法在 Kubespray 各版本间有变化，官方 `docs/operations/nodes.md` 中也给出了用 `cluster.yml` 添加控制平面节点的流程，务必以你所用版本的文档为准。
> - 从 2.30 起，新控制平面节点**必须追加在 `kube_control_plane` 组的末尾**，不再支持加在开头。
> - 2.28.0 存在 `ETCD_INITIAL_CLUSTER` 多余引号导致 etcd 起不来的 bug，需要打上游修复补丁。
> - etcd 成员数保持奇数，1 → 3 → 5，不要停在 2 或 4。

## etcd 维护

etcd 保存了集群的全部状态，丢了 etcd 就等于丢了集群。Kubespray 默认以 systemd 服务（`etcd_deployment_type: host`）运行 etcd，连接参数写在 `/etc/etcd.env`，下面的命令都先加载它：

```bash
set -a && source /etc/etcd.env && set +a   # 导出 ETCDCTL_ENDPOINTS / CACERT / CERT / KEY
etcdctl endpoint status --cluster -w table
etcdctl endpoint health --cluster
```

### 快照备份

```bash
etcdctl snapshot save /backup/etcd-$(date +%Y%m%d-%H%M).db
etcdutl snapshot status /backup/etcd-20260923-0300.db -w table
```

快照只需在一个健康成员上做。生产要求：

- 每天定时备份（systemd timer 或 CronJob），**拷贝到集群外**的存储，保留多份。
- 每次升级、控制平面变更前额外备份一次。
- 定期在测试环境做恢复演练。没恢复过的备份不算备份。

> [!NOTE] etcd 3.6 的工具变化
> `etcdctl snapshot status` 和 `etcdctl snapshot restore` 在 3.5 中已经废弃，3.6 中移除，改用离线工具 `etcdutl`。脚本里写死旧命令的，升级 etcd 后会失败。

### 从快照恢复

恢复是灾难场景下的最后手段，会把整个集群状态回退到快照时刻。大致流程：

1. 停掉所有控制平面节点的 kube-apiserver 和所有 etcd 成员。
2. 在**每个**成员上用同一份快照恢复出新的数据目录：
   ```bash
   etcdutl snapshot restore /backup/etcd.db \
     --name etcd1 \
     --initial-cluster etcd1=https://192.168.3.21:2380,etcd2=https://192.168.3.22:2380,etcd3=https://192.168.3.23:2380 \
     --initial-advertise-peer-urls https://192.168.3.21:2380 \
     --data-dir /var/lib/etcd-restore
   ```
3. 把原数据目录挪走备份，用新目录替换，启动 etcd，确认集群健康后再启动 apiserver。

Kubespray 在 `docs/operations/recover-control-plane.md` 中也提供了基于 playbook 的恢复流程，适合部分控制平面节点损坏、仍有健康成员的场景。

### 压缩、碎片整理与配额

etcd 用 MVCC 保存每个 key 的历史版本，每次对象更新都产生新的 revision。旧版本需要**压缩（compact）**才能被标记为可回收，而压缩后的空闲空间还要经过**碎片整理（defrag）**才会真正从数据库文件里还给磁盘。

后端数据库有配额 `--quota-backend-bytes`，默认 2GB，官方建议不超过 8GB。超过配额后 etcd 触发 `NOSPACE` 告警，进入只读和删除模式，拒绝一切写入。

> [!PROD] 真实案例：database space exceeded
> 团队的集群出现 `etcdserver: mvcc: database space exceeded`：Pod 无法创建，kubectl 所有修改操作失败。短期处理：
> ```bash
> set -a && source /etc/etcd.env && set +a
> etcdctl endpoint status -w table --cluster
> etcdctl alarm list                                   # 看到 alarm:NOSPACE
>
> rev=$(etcdctl endpoint status -w json | jq '.[0].Status.header.revision')
> etcdctl compact "$rev"                               # 压缩是集群级操作，执行一次即可
> etcdctl defrag                                       # 碎片整理按成员执行，在每个节点上各执行一次
> etcdctl alarm disarm                                 # 解除告警，恢复写入
> ```
> 长期处理：把配额调到 8GB。Kubespray 在 `group_vars/all/etcd.yml` 中设置 `etcd_quota_backend_bytes: "8589934592"`；已有集群可修改所有控制节点 `/etc/etcd.env` 中的 `ETCD_QUOTA_BACKEND_BYTES` 后**逐个**重启 etcd。确认生效：
> ```bash
> curl -s --cert $ETCDCTL_CERT --key $ETCDCTL_KEY --cacert $ETCDCTL_CACERT \
>   $ETCDCTL_ENDPOINTS/metrics | grep quota
> # etcd_server_quota_backend_bytes 8.589934592e+09
> ```

几点补充：

- kube-apiserver 默认每 5 分钟自动 compact 一次（`--etcd-compaction-interval`），所以日常数据库变大通常是**碎片**而不是历史版本堆积，定期 defrag 比手动 compact 更重要。
- defrag 期间该成员会阻塞读写。**逐个成员**执行，先整理 follower，最后整理 leader，业务低峰期操作。
- 数据库异常增长往往有源头：频繁更新的大对象（巨大的 ConfigMap、CRD 状态）、失控的控制器反复写入、海量 Event。只做 defrag 治标不治本，要结合 [可观测性](/learn/observability) 里的 etcd 容量告警尽早发现。

## 证书续期

kubeadm 签发的组件证书（apiserver、controller-manager、scheduler 的客户端证书等）有效期 1 年，CA 证书 10 年。证书过期后 kubectl 报 `x509: certificate has expired`，组件之间无法通信。

```bash
# 在控制平面节点上查看到期时间
kubeadm certs check-expiration

# 手动续期全部证书，之后需要重启控制平面静态 Pod 使其加载新证书
kubeadm certs renew all
```

Kubespray 设置 `auto_renew_certificates: true` 后，会在控制平面节点上安装一个 systemd 定时器（默认每月第一个周一凌晨），自动续期证书并重启控制平面组件。可以用 `systemctl list-timers | grep k8s-certs-renew` 确认。

> [!TIP] 其他证书
> - kubelet 的客户端证书默认自动轮换，无需手动处理。
> - 升级 Kubernetes 时 kubeadm 会顺带续期证书，这也是"定期升级"的附带好处。
> - Kubespray 以 host 模式部署的 etcd 使用自己的证书（在 `/etc/ssl/etcd/ssl/` 下），不归 kubeadm 管理，用 `openssl x509 -enddate -noout -in <证书>` 单独确认有效期。
> - 把证书到期时间纳入监控告警，比依赖记忆可靠得多。

## 动手练习

以下练习使用一个 1 控制平面 + 2 工作节点的 kind 集群。

1. **PDB 与 drain**：部署 3 副本的 nginx Deployment，创建 `minAvailable: 3` 的 PDB，然后 `kubectl drain kind-worker --ignore-daemonsets --timeout=60s`，观察 drain 为什么失败。把 PDB 改成 `minAvailable: 2` 再试，最后 `uncordon`。
2. **etcd 快照**：kind 的 etcd 以静态 Pod 运行，证书在 `/etc/kubernetes/pki/etcd/`：
   ```bash
   ectl() {
     kubectl -n kube-system exec etcd-kind-control-plane -- etcdctl \
       --endpoints=https://127.0.0.1:2379 \
       --cacert=/etc/kubernetes/pki/etcd/ca.crt \
       --cert=/etc/kubernetes/pki/etcd/server.crt \
       --key=/etc/kubernetes/pki/etcd/server.key "$@"
   }
   ectl endpoint status -w table
   ectl snapshot save /var/lib/etcd/snap.db
   kubectl -n kube-system exec etcd-kind-control-plane -- etcdutl snapshot status /var/lib/etcd/snap.db -w table
   docker exec kind-control-plane ls -lh /var/lib/etcd/snap.db
   ```
3. **碎片整理**：用一个循环创建再删除 500 个 ConfigMap，前后对比 `endpoint status` 里的 DB SIZE；执行 `ectl defrag` 后再看一次，理解 compact 和 defrag 分别解决什么问题。
4. **证书检查**：执行 `docker exec kind-control-plane kubeadm certs check-expiration`，找出最早过期的证书和 CA 的有效期。
5. **写一份升级评估**：假设你的集群要从当前 Kubernetes 版本升级到下一个小版本，阅读官方发布博客的"弃用与移除"部分，按"变更 / 是否命中 / 检查命令 / 处理方式"四列写出至少 3 条。

## 自测

<details>
<summary>集群当前是 Kubernetes 1.33，能否直接升级到 1.35？Kubespray 2.29 能否直接升级到 2.31？</summary>

都不能。Kubernetes 控制平面必须逐个小版本升级（1.33 → 1.34 → 1.35）；Kubespray 也要求按 release 逐个升级（2.29 → 2.30 → 2.31）。另外还要关注组件自身的路径，例如 etcd 3.5 升 3.6 需先到 3.5.26+。

</details>

<details>
<summary>为什么升级时要先升控制平面，再升工作节点？</summary>

版本偏差策略规定 kubelet 不能比 kube-apiserver 新，但可以旧最多 3 个小版本。先升控制平面，整个过程中始终满足"apiserver ≥ kubelet"的约束。

</details>

<details>
<summary>kubectl drain 一直卡住并反复打印 "Cannot evict pod as it would violate the pod's disruption budget"，该怎么排查？</summary>

用 `kubectl get pdb -A` 找到对应 PDB，看 `ALLOWED DISRUPTIONS` 是否为 0。常见原因：`minAvailable` 等于副本数、单副本应用配了 PDB、应用本身有 Pod 不健康导致可用数已经不够。修正 PDB 或先修复不健康的 Pod，而不是用 `--disable-eviction` 强行绕过。

</details>

<details>
<summary>etcd 报 database space exceeded 后，compact、defrag、alarm disarm 各起什么作用？顺序能不能换？</summary>

compact 丢弃指定 revision 之前的历史版本（集群级，执行一次）；defrag 把空闲空间真正还给磁盘，缩小数据库文件（按成员逐个执行）；alarm disarm 解除 NOSPACE 告警恢复写入。必须先释放空间再解除告警，否则数据库仍超配额，很快会再次触发告警。

</details>

<details>
<summary>用 remove-node.yml 下线一台已经断电的节点，需要加什么参数？inventory 什么时候修改？</summary>

加 `-e reset_nodes=false -e allow_ungraceful_removal=true`，跳过对该节点的 SSH 清理。playbook 执行成功后，再把该节点从 inventory 中删除。

</details>

## 参考资料

- [Kubernetes 官方文档：版本偏差策略](https://kubernetes.io/zh-cn/releases/version-skew-policy/)
- [Kubernetes 官方文档：安全地清空一个节点](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/safely-drain-node/)
- [Kubernetes 官方文档：干扰（Disruptions）与 PodDisruptionBudget](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/disruptions/)
- [Kubernetes 官方文档：为 Kubernetes 运行 etcd 集群](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [Kubernetes 官方文档：使用 kubeadm 进行证书管理](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Kubespray：Upgrading Kubernetes in Kubespray](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/operations/upgrades.md)
- [Kubespray：Adding/replacing a node](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/operations/nodes.md)
- [Kubespray：Recovering the control plane](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/operations/recover-control-plane.md)
- [etcd：Maintenance（compact、defrag、配额）](https://etcd.io/docs/v3.6/op-guide/maintenance/)
- [etcd：Disaster recovery](https://etcd.io/docs/v3.6/op-guide/recovery/)
- [etcd：Upgrade etcd from v3.5 to v3.6](https://etcd.io/docs/v3.6/upgrades/upgrade_3_6/)
- [Kubernetes v1.35 发布博客](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/)
