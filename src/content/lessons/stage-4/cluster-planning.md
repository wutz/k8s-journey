# 生产集群规划

在 kind 里建集群只要一条命令，建错了删掉重来也就几十秒。生产集群不一样：机器上架、IP 分好、DNS 发出去、业务跑起来以后，节点名、网段、控制平面数量这些决定基本改不动了，改就得停机迁移。很多"集群跑了半年突然出问题"的故障，根子都在规划阶段。比如 etcd 放在慢盘上，节点 MTU 不一致，Pod 网段和机房网段重叠。

这一课把团队在裸金属上建 K8s 集群的规划清单整理出来：节点角色与命名、高可用拓扑、网络和地址规划、操作系统初始化，以及上线前必须通过的 etcd 磁盘验收。学完你应该能拿出一份"集群规划表"，下一课直接交给 [Kubespray](/learn/kubespray) 去部署。

> [!NOTE] 本课需要的环境
> 规划和节点初始化针对真实的物理机或虚拟机（建议 Ubuntu 22.04/24.04），kind 里做不了。练习部分会给出能在笔记本上完成的替代做法，例如在本机磁盘上跑 fio 验收，或者用 kind 的节点标签模拟角色划分。

## 先定命名：地区、集群、节点、DNS

命名规范看上去是小事，可集群一多（开发、测试、生产、存储、数据库），没有规范的话，运维看到 `node-17` 根本不知道它在哪个机房、是什么角色、IP 是多少。团队的做法是按四层来命名。

### 地区与集群

| 层级 | 格式 | 示例 | 说明 |
| --- | --- | --- | --- |
| 地区机房 | `<地区缩写><机房序号>` | `bj1`、`sh2` | 序号可以跳过 4 |
| 集群 | `<用途><序号>` | `k8s1`、`dev1`、`rds1`、`ceph1` | 存储、数据库这类基础设施默认是多用户共享的 |

面向具体用户或项目的计算集群可以直接用项目全称加序号，例如 `apple1`。

### DNS 分层

服务域名统一用 `<service>.<cluster>.<region>.<domain>`：

```text
cr.dev1.bj1.example.com        # dev1 集群的镜像仓库
gf.k8s1.sh2.example.com        # k8s1 集群的 Grafana
s3.ceph1.bj1.example.com       # ceph1 存储集群的对象存储入口
redis-a1b2c3.rds1.bj1.example.com
```

这样的层级有两个好处。一是可以给整个集群签一张通配证书（`*.dev1.bj1.example.com`），配合 Ingress/Gateway 的 LoadBalancer IP 做一条泛解析，新服务上线不用再找 DNS 管理员。二是域名本身就说明了服务在哪儿。

如果同一个名字在内网和外网需要解析到不同地址，可以在地区后面加后缀区分：`cr.dev1.bj1-ext.example.com` 走公网，`cr.dev1.bj1-int.example.com` 走内网。不需要区分的就不要加。

### 节点命名与角色前缀

节点名格式为 `<两位角色缩写>-<IP 用 - 连接>`，看到名字就知道角色和地址：

| 前缀 | 角色 | 生产最少数量 | 示例 |
| --- | --- | --- | --- |
| `mn` | 控制平面（Management Node） | 3，最多 7，必须奇数 | `mn-192-168-0-1` |
| `ln` | 网络负载均衡（LB Node） | 2，可以和 mn 复用 | `ln-192-168-0-11` |
| `gn` | GPU 计算节点 | 按需 | `gn-192-168-1-1` |
| `cn` | CPU 计算节点 | 按需 | `cn-192-168-100-1` |
| `dn` | 数据库节点 | 3，推荐独立 | `dn-192-168-200-1` |
| `sn` | 存储节点 | 3，推荐独立 | `sn-192-168-201-1` |

也有团队用 `bj1mn01` 这种"机房+角色+序号"的风格，方便在 pdsh 里写成 `bj1mn[01-03]` 这样的范围。两种都行，关键是全公司统一。IP 风格的好处是排障时不用查 CMDB，坏处是节点换 IP 就得改名重新入集群。

> [!PROD] 角色前缀要和标签对应
> 节点名只给人看，调度靠的是标签。部署完成后给节点打上和前缀一致的角色标签，例如 `node-role.kubernetes.io/storage=true`、`node-role.kubernetes.io/gpu=true`，后面 Rook-Ceph、GPU Operator 都靠这些标签选节点。

## 高可用拓扑

### 控制平面为什么是 3 或 5 台

etcd 用 Raft 协议，写入要多数成员确认才算成功。N 个成员最多能容忍 `(N-1)/2` 个故障：

| etcd 成员数 | 多数派 | 可容忍故障 |
| --- | --- | --- |
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 4 | 3 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

4 台和 3 台容错能力一样，却多了一台要参与投票的机器，写入延迟反而更高，所以控制平面总是奇数台。规模超过几百个节点，或者对可用性要求很高时用 5 台；7 台是上限，再多只会拖慢写入。

团队的拓扑是"堆叠式 etcd"（Stacked etcd）：etcd 和 apiserver、scheduler、controller-manager 一起跑在 3 台 mn 节点上。这种拓扑机器省、部署简单，Kubespray 默认也是这种。外置 etcd 拓扑要多 3 台机器，适合超大规模集群。

```text
                 VIP 192.168.0.100:6443  (kube-vip 或 keepalived)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 │ mn-…-0-1    │   │ mn-…-0-2    │   │ mn-…-0-3    │
 │ apiserver   │   │ apiserver   │   │ apiserver   │
 │ etcd        │◀─▶│ etcd        │◀─▶│ etcd        │
 │ sched / cm  │   │ sched / cm  │   │ sched / cm  │
 └─────────────┘   └─────────────┘   └─────────────┘
        ▲                 ▲                 ▲
        └──── 每个 worker 上的本地 nginx 代理 127.0.0.1:6443 ────┘
   gn-… / cn-… / sn-… 节点（kubelet、kube-proxy、CNI）
```

### apiserver 的负载均衡

三台 apiserver 需要一个统一入口，常见有三种做法：

1. **kube-vip**：以静态 Pod 方式跑在控制平面节点上，用 ARP 宣告一个 VIP，Kubespray 一个开关就能开。团队新集群都用它，下一课细讲。
2. **haproxy + keepalived**：传统方案，适合 kube-vip 用不了的环境，或者 LB 要放在独立的 ln 节点上时。
3. **硬件或云负载均衡**：机房有 F5 之类设备时直接用。

keepalived 方案有几个细节容易出错，下面是一个 3 节点的示例（haproxy 监听 7443，避免和本机 apiserver 的 6443 冲突）：

```text title="haproxy.cfg"
frontend apiserver
    bind *:7443
    mode tcp
    option tcplog
    default_backend apiserver

backend apiserver
    mode tcp
    option tcp-check
    balance roundrobin
    default-server inter 10s downinter 5s
    server mn-192-168-0-1 192.168.0.1:6443 check
    server mn-192-168-0-2 192.168.0.2:6443 check
    server mn-192-168-0-3 192.168.0.3:6443 check
```

```text title="keepalived.conf（mn-192-168-0-1，另外两台改 state/priority/src_ip）"
vrrp_script chk_haproxy {
    script 'killall -0 haproxy'   # 比 pidof 快
    interval 2
}

vrrp_instance apiserver-vip {
    interface eth0
    state MASTER            # 其余两台为 BACKUP
    priority 100            # 其余两台为 90、80
    virtual_router_id 52    # 同一二层网络内必须唯一
    virtual_ipaddress {
      192.168.0.100/24      # 掩码必须和物理网络一致
    }
    unicast_src_ip 192.168.0.1
    unicast_peer {
      192.168.0.2
      192.168.0.3
    }
    track_script {
        chk_haproxy
    }
}
```

> [!WARNING] keepalived 的三个坑
> - `virtual_router_id` 在同一个二层网络里必须唯一。数据中心里别的团队也跑 keepalived 的话，随手写 51 很容易撞车，表现为 VIP 在两个集群之间来回漂。建议在 1～255 之间随机挑一个，并登记下来。
> - VIP 的子网掩码要和物理网卡一致，写成 `/32` 在某些交换机环境下会导致其他网段访问不到。
> - 多数机房禁止组播，所以要用 `unicast_peer` 单播方式。

## 网络与地址规划

### 物理网络要求

- 所有节点至少 10Gb 以太网内网互联，节点间 `ping` 延迟应小于 0.05 ms。
- 存储节点额外配一张至少 10Gb 的网卡专门做数据复制（Ceph 的 cluster network），存储性能提升会非常明显。
- 负载均衡节点如果要对外提供服务，需要至少 1Gb 的公网接入；只对内服务可以不要。
- GPU 训练集群还需要 InfiniBand/RoCE 高速网络，放到 [分布式训练与高性能网络](/learn/distributed-training) 再讲。

### 地址规划表

部署前把下面这张表填好，并和网络管理员确认没有冲突：

| 地址段 | 示例 | 用途 | 注意事项 |
| --- | --- | --- | --- |
| 节点网络 | `192.168.0.0/16` | 物理机 IP | 机房分配 |
| apiserver VIP | `192.168.0.100` | kube-vip / keepalived | 必须和节点在同一二层网络，且不在 DHCP 范围内 |
| LoadBalancer 地址池 | `192.168.10.200-192.168.10.210` | MetalLB 分配给 Service | 向网管申请，预留给 Ingress/Gateway |
| Service CIDR | `172.23.0.0/16` | ClusterIP | 集群内部使用，但不能和任何要访问的网段重叠 |
| Pod CIDR | `172.24.0.0/13` | Pod IP | 按"节点数 × 每节点子网"计算，留足余量 |

Pod CIDR 的容量要算清楚。例如 Pod CIDR 是 `172.24.0.0/13`、每个节点分 `/24`，最多能容纳 2^(24-13) = 2048 个节点，每个节点 254 个 Pod IP。Cilium 的 cluster-pool 模式后续可以追加新网段，但**已有网段不能改**。

> [!WARNING] 网段重叠是最隐蔽的故障
> Service CIDR 和 Pod CIDR 虽然只在集群内有效，但如果和某个要访问的内网段重叠（比如存储网、办公网、Docker 默认的 `172.17.0.0/16`），Pod 访问那个网段的流量会被集群路由吃掉，表现为"某些地址就是不通"，很难排查。规划时把机房所有在用网段列出来逐一比对。

### 网卡名与 MTU 必须一致

CNI（比如 Cilium）和 kube-vip 都要指定网卡名，所有节点网卡名不统一的话配置就没法写。物理机的网卡名往往是 `enp94s0f0` 这类跟硬件插槽有关的名字，可以用 netplan 按 MAC 地址改名：

```yaml title="/etc/netplan/00-installer-config.yaml"
network:
  ethernets:
    eth0:
      match:
        macaddress: fa:16:3e:f1:c3:fd
      set-name: eth0
      addresses:
        - 192.168.0.1/16
      routes:
        - to: default
          via: 192.168.255.254
      nameservers:
        addresses: [192.168.255.53]
```

MTU 不一致会出现"小包通、大包不通"的现象：`ping` 正常、`curl` 小页面正常，传大文件或 TLS 握手却卡住。上线前逐台检查：

```bash
pdsh -w ^all ip link show eth0 | grep mtu
```

## 节点初始化

### 用 pdsh 批量管理

几十台机器逐台 ssh 不现实。团队统一在一台管理机上用 pdsh 并行执行命令，出于安全考虑，所有 ssh 都从这台机器发起：

```bash
apt install -y pdsh

cat > all <<'EOF'
mn-192-168-0-[1-3]
gn-192-168-1-[1-3]
EOF

# 让 pdsh 使用 ssh 而不是默认的 rsh
cat > /etc/profile.d/pdsh.sh <<'EOF'
export PDSH_RCMD_TYPE=ssh
export PDSH_REMOTE_PDCP_PATH=pdcp
EOF
source /etc/profile.d/pdsh.sh

ssh-keygen -t ed25519                  # 没有密钥时生成
pdsh -w ^all -R exec ssh-copy-id %h    # 分发公钥
pdsh -w ^all uname -r | sort           # 检查内核版本是否一致
pdcp -w ^all 80-inotify.conf /etc/sysctl.d/   # pdcp 批量拷贝文件
```

`-w ^all` 表示从文件 `all` 读取主机列表。`pdsh ... | dshbak -c` 可以把输出相同的节点合并显示，节点一多非常好用。

### 初始化清单

团队把下面这些步骤写成了一个脚本（按需注释掉不需要的项），新节点入网后先跑一遍：

| 项目 | 做法 | 为什么 |
| --- | --- | --- |
| 主机名 | `hostnamectl set-hostname mn-192-168-0-1` | 节点名就是 K8s 的 Node 名 |
| 时间同步 | chrony 或 systemd-timesyncd 指向内网 NTP | 时间漂移会导致证书校验失败、etcd 异常 |
| 关闭 swap | `swapoff -a` 并注释 fstab | kubelet 默认要求关闭 swap |
| cgroup v2 | `stat -fc %T /sys/fs/cgroup` 应输出 `cgroup2fs` | K8s 1.35 起 kubelet 默认拒绝在 cgroup v1 上启动 |
| 锁定内核 | 升级到统一版本后 `apt-mark hold` 内核包 | 避免自动升级内核导致 GPU 驱动、存储内核模块失效 |
| 关闭自动更新 | 停用 `unattended-upgrades` | 自动更新会在半夜重启 containerd 或升级内核 |
| inotify 上限 | `fs.inotify.max_user_instances=1280` 等 | 否则 `kubectl logs -f` 报 `too many open files` |
| 安装 socat | `apt install -y socat` | `kubectl port-forward` 依赖它 |
| 禁用密码登录 | `PasswordAuthentication no` | 只允许管理机密钥登录 |
| 防火墙 | 集群节点间放通；存储节点限制 22 端口来源 | 见下文 |

时间同步和内核锁定的具体命令：

```bash
# 时间同步（Ubuntu，timesyncd）
pdsh -w ^all "sed -i 's/^#\?NTP=.*/NTP=ntp.example.com/' /etc/systemd/timesyncd.conf"
pdsh -w ^all systemctl restart systemd-timesyncd
pdsh -w ^all timedatectl timesync-status | dshbak -c

# 锁定当前内核，禁止被自动升级
pdsh -w ^all "dpkg -l | awk '/^ii +linux-(image|headers|modules)-[0-9]/{print \$2}' | xargs apt-mark hold"
```

```ini title="/etc/sysctl.d/80-inotify.conf"
fs.inotify.max_user_instances=1280
fs.inotify.max_user_watches=655360
```

> [!PROD] SELinux / AppArmor 与防火墙
> 团队在计算集群上关闭了 SELinux/AppArmor 和主机防火墙（ufw/firewalld），因为网络隔离交给 Cilium 的 NetworkPolicy 负责，主机防火墙和 CNI 的 iptables/eBPF 规则叠在一起时很难排查。这是一种取舍，不是必须的。如果安全合规要求开启，就要按官方的[端口和协议列表](https://kubernetes.io/zh-cn/docs/reference/networking/ports-and-protocols/)逐一放通 6443、2379-2380、10250 等端口，以及 CNI 自己用的端口。存储节点对外提供服务，至少要限制 22 端口只允许管理网段访问：
>
> ```bash
> ufw default allow incoming
> ufw allow from 192.168.16.0/20 to any port 22
> ufw deny 22
> ufw enable
> ```

### BIOS 与性能模式

对延迟敏感的集群（存储、数据库、分布式训练），BIOS 也要统一设置。团队的清单主要有这几项：

- **打开**：Turbo Mode、超线程（Hyper-Threading）、NUMA、Above 4G Decoding（GPU 大 BAR 需要）。
- **关闭**：PCIe ASPM 省电、C1E 等深度 C-State（节点间 ping 延迟大于 0.05 ms 时关闭）。
- **视情况关闭**：Intel VT-d / IOMMU、SR-IOV。不跑虚拟机、不需要网卡直通时可以关掉，因为 IOMMU 会影响 GPU Direct RDMA 性能。需要 KubeVirt 或 SR-IOV 时则必须打开。

系统里用 tuned 切到低延迟模式，并检查超线程：

```bash
pdsh -w ^all 'apt install -y tuned && systemctl enable --now tuned'
pdsh -w ^all tuned-adm profile latency-performance
pdsh -w ^all 'lscpu | grep "Thread(s) per core"'   # 应为 2
```

### 上线前的基础测试

```bash
# 两两之间测带宽：一台启 server，另一台做 client，并测反向
pdsh -w ^all 'apt install -y iperf'
iperf -s                                   # 在 192.168.0.2 上
iperf -c 192.168.0.2 -P 8 -i 1             # 在 192.168.0.1 上，上行
iperf -c 192.168.0.2 -P 8 -i 1 -R          # 下行
```

10Gb 网卡实测应该在 9.4 Gbit/s 左右。明显偏低的话，先查网线/光模块，再看网卡协商速率（`ethtool eth0`）。

## etcd 磁盘验收

etcd 每次写入都要把 WAL（Write-Ahead Log，预写日志）`fsync` 到磁盘后才能确认，而且多数成员都要完成这一步。磁盘慢一点，整个控制平面都会跟着慢：

```text
WAL fsync 慢 ──▶ 写请求变慢 ──▶ apiserver 卡顿 ──▶ kubectl 超时
      │
      └── 超过心跳间隔 ──▶ follower 认为 leader 失联 ──▶ 重新选举 ──▶ 短暂不可用
```

### 硬件要求

| 项目 | 要求 |
| --- | --- |
| 磁盘类型 | NVMe SSD 优先，SATA SSD 可接受 |
| 独占 | etcd 数据目录独占一块盘，不和系统盘、日志盘共享 |
| 禁止 | 机械盘、NAS、SAN、iSCSI、Ceph RBD、NFS |

### 用 fio 测 WAL fsync

这是部署前唯一能独立验证的硬指标，**不达标不要上线**。fio 版本需要 3.5 以上：

```bash
mkdir -p /var/lib/etcd
fio --rw=write --ioengine=sync --fdatasync=1 \
    --directory=/var/lib/etcd \
    --size=22m --bs=2300 \
    --name=etcd-disk-test
```

- `--fdatasync=1`：每次写完都 fsync，模拟 etcd 写 WAL 的行为，这是核心。
- `--bs=2300`：接近 etcd WAL 条目的典型大小。
- `--size=22m`：产生约一万个样本，p99 才有统计意义。
- `--directory`：必须指向 etcd 实际使用的数据目录所在的盘。

看输出里的 `fsync/fdatasync/sync_file_range` → `sync percentiles (usec)` 一段：

```text
  sync percentiles (usec):
   | 99.00th=[ 2376]    ← 2.4 ms，合格
   | 99.50th=[ 9634]
   | 99.90th=[15795]
```

**99.00th 小于 10000 usec（10 ms）即通过。** fio 是隔离测试，etcd 实际运行时还有其他 I/O，所以测出来接近 10 ms 的盘就说明余量不足，建议换盘。

> [!PROD] 上线后持续盯住这几个指标
> - `etcd_disk_wal_fsync_duration_seconds` p99 < 10 ms
> - `etcd_disk_backend_commit_duration_seconds` p99 < 25 ms（boltdb 刷盘，部署前测不了）
> - `etcd_server_leader_changes_seen_total` 应长期不增长
>
> 官方告警规则的阈值是 WAL fsync p99 > 500 ms，这时候集群早就严重劣化了，所以自己的告警要按上面的运行目标来定。监控搭建见 [可观测性](/learn/observability)。

如果 fio 通过但运行后 fsync 仍然很高，通常是同节点有其他 I/O 在抢盘。控制平面节点不要跑 I/O 密集型负载，必要时可以用 `ionice -c2 -n0 -p $(pgrep etcd)` 提高 etcd 的 I/O 优先级。

## 动手练习

1. 为一个"3 控制平面 + 4 GPU 节点 + 3 存储节点"的集群写一份规划表：地区/集群名、每台节点的节点名、apiserver VIP、MetalLB 地址池、Service CIDR 和 Pod CIDR，并算出 Pod CIDR 最多能容纳多少节点。
2. 在一台 Linux 机器（或虚拟机）上安装 fio，分别在系统盘和一个 tmpfs 目录（`/dev/shm`）上跑上面的 etcd 测试命令，对比 99.00th 的结果，思考为什么 tmpfs 不能用来放 etcd。
3. 用 kind 模拟角色划分：创建 1 控制平面 + 3 worker 的集群，把 worker 分别打上 `node-role.kubernetes.io/gpu=true` 和 `node-role.kubernetes.io/storage=true`，然后用 `kubectl get nodes -L node-role.kubernetes.io/gpu,node-role.kubernetes.io/storage` 查看。
4. 在你的机器上检查三项：`stat -fc %T /sys/fs/cgroup` 的输出、`ip link` 中主网卡的 MTU、`timedatectl` 中 NTP 是否同步。

## 自测

<details>
<summary>控制平面为什么不用 4 台？</summary>

etcd 需要多数派（N/2+1）确认写入。4 台的多数派是 3，只能容忍 1 台故障，和 3 台一样；但写入时要多等一台确认，延迟更高，故障面也更大。所以控制平面总是 3、5、7 这样的奇数。

</details>

<details>
<summary>etcd 磁盘验收看哪个指标？合格线是多少？</summary>

用 fio 以 `--fdatasync=1 --bs=2300` 模拟 WAL 写入，看 `sync percentiles` 的 99.00th，小于 10 ms（10000 usec）为合格。接近 10 ms 说明余量不足，应换更快的盘。

</details>

<details>
<summary>节点 MTU 不一致会有什么现象？</summary>

典型现象是小包能通、大包不通：ping 和短请求正常，大文件传输、TLS 握手或跨节点的 Pod 通信会卡住或超时。叠加 CNI 隧道封装后问题会更明显。上线前应该用 `pdsh` 批量检查所有节点主网卡的 MTU。

</details>

<details>
<summary>Pod CIDR 用完了怎么办？规划时怎么避免？</summary>

已有网段不能修改。Cilium 的 cluster-pool 模式可以在 `clusterPoolIPv4PodCIDRList` 里追加新网段，然后重启 cilium-operator。规划时按"最大节点数 × 每节点子网"预留，并确认它和机房所有在用网段都不重叠。

</details>

<details>
<summary>为什么生产节点要锁定内核并关闭自动更新？</summary>

GPU 驱动、存储内核模块（如 GPFS、Ceph 客户端）和 eBPF 程序都与内核版本强相关。自动升级内核可能导致这些模块在重启后加载失败；自动更新还可能在业务高峰期重启 containerd。内核升级应作为有计划的变更，逐台滚动进行。

</details>

## 参考资料

- [Kubernetes 官方文档：生产环境](https://kubernetes.io/zh-cn/docs/setup/production-environment/)
- [Kubernetes 官方文档：高可用拓扑选项](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/ha-topology/)
- [Kubernetes 官方文档：大规模集群的注意事项](https://kubernetes.io/zh-cn/docs/setup/best-practices/cluster-large/)
- [Kubernetes 官方文档：端口和协议](https://kubernetes.io/zh-cn/docs/reference/networking/ports-and-protocols/)
- [Kubernetes 官方文档：关于 cgroup v2](https://kubernetes.io/zh-cn/docs/concepts/architecture/cgroups/)
- [Kubernetes 官方文档：安装 kubeadm（节点前置要求）](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
- [etcd 官方文档：硬件推荐](https://etcd.io/docs/v3.6/op-guide/hardware/)
- [etcd 官方文档：性能](https://etcd.io/docs/v3.6/op-guide/performance/)
- [etcd 官方文档：调优](https://etcd.io/docs/v3.6/tuning/)
- [fio 官方文档](https://fio.readthedocs.io/en/latest/)
- [keepalived 官方文档](https://www.keepalived.org/manpage.html)
