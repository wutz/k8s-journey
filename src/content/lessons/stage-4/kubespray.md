# 用 Kubespray 部署高可用集群

上一课做完了[集群规划](/learn/cluster-planning)，手里有节点清单、VIP 和网段。接下来要把它变成一个真正的集群。用 kubeadm 手工一台台 `init`、`join` 当然可以，但生产集群还要装容器运行时、配 etcd、签证书、配内部负载均衡、装 CoreDNS……几十台机器手工做一遍很难保证一致，出了问题也没法复现。

Kubespray 是 Kubernetes SIGs 维护的一组 Ansible Playbook，把这些步骤全部写成了幂等的自动化任务。这一课按团队的实际流程走一遍：准备部署机、规划 inventory、改哪些关键变量以及为什么改、执行部署，然后是日常最常用的三件事：增量更新、扩容和重置。

> [!NOTE] 本课需要的环境
> 至少 1 台部署机加 3 台 Linux 节点（物理机或虚拟机均可，Ubuntu 22.04/24.04，每台 2 核 4 GB 以上），部署机能免密 ssh 到所有节点。kind 里没法运行 Kubespray。只有笔记本的话，可以用 Multipass、Vagrant 或 Lima 起 3 台虚拟机做实验。
>
> 本文以 Kubespray v2.31（默认 Kubernetes v1.35）为例，写作时的最新版本。变量名在不同版本之间会有变化，请以你所用版本的官方文档和 `inventory/sample` 为准。

## Kubespray 做了什么

```text
部署机（Ansible）                        目标节点
┌───────────────────────┐   ssh    ┌──────────────────────────────────┐
│ inventory.ini         │ ───────▶ │ 1. OS 准备：内核参数、依赖包     │
│ group_vars/           │          │ 2. 容器运行时：containerd/runc   │
│   all/*.yml           │          │ 3. etcd 集群（systemd 服务）     │
│   k8s_cluster/*.yml   │          │ 4. kubeadm init / join           │
│ cluster.yml           │          │ 5. 内部 LB（nginx 静态 Pod）     │
└───────────────────────┘          │ 6. CNI、CoreDNS、nodelocaldns    │
                                   │ 7. 可选插件：kube-vip、metrics…  │
                                   └──────────────────────────────────┘
```

它底层调用的还是 kubeadm，集群结构和 kubeadm 搭出来的完全一样。Kubespray 补齐的是 kubeadm 不管的部分，并保证每次执行结果一致。和 RKE2/k3s 这类单二进制发行版相比，它更慢，但可定制的地方多得多，适合裸金属和私有云上的生产集群。

## 准备部署机

团队用 [uv](https://docs.astral.sh/uv/) 管理 Python 虚拟环境，比系统 pip 干净，也不会污染部署机：

```bash
export KUBESPRAY_VERSION=2.31.0

# 安装 uv（参考官方安装说明）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 下载指定版本的 kubespray，不要直接用 master 分支
curl -LO https://github.com/kubernetes-sigs/kubespray/archive/refs/tags/v${KUBESPRAY_VERSION}.tar.gz
tar zxf v${KUBESPRAY_VERSION}.tar.gz && cd kubespray-${KUBESPRAY_VERSION}

uv venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements.txt

# 从 sample 复制出自己的 inventory
cp -r inventory/sample inventory/mycluster
```

> [!PROD] inventory 放进 Git 单独管理
> `inventory/mycluster` 才是真正属于你的部分，Kubespray 源码本身不用改。团队把每个 Kubespray 版本验证过的 inventory 放在自己的 Git 仓库里（例如 `kubespray-2.31.0/inventory/mycluster`），部署时复制进解压好的 Kubespray 目录。升级 Kubespray 时对比新旧 `inventory/sample` 的差异，把新增的变量合并进来。

## 规划 inventory

### inventory.ini

```ini title="inventory/mycluster/inventory.ini"
[kube_control_plane]
mn-192-168-3-21 ansible_host=192.168.3.21 etcd_member_name=etcd1
mn-192-168-3-22 ansible_host=192.168.3.22 etcd_member_name=etcd2
mn-192-168-3-23 ansible_host=192.168.3.23 etcd_member_name=etcd3

[etcd:children]
kube_control_plane

[kube_node]
cn-192-168-3-50 ansible_host=192.168.3.50
cn-192-168-3-51 ansible_host=192.168.3.51
gn-192-168-3-60 ansible_host=192.168.3.60
```

- 第一列是主机名，Kubespray 会把它设成节点的 hostname 和 K8s Node 名，所以直接用规划好的名字。
- `kube_control_plane`：HA 至少 3 台，必须是奇数；非 HA 就 1 台。
- `etcd:children` 指向 `kube_control_plane`，即堆叠式 etcd。`etcd_member_name` 在 etcd 成员中必须唯一。
- 节点有多张网卡、希望 K8s 绑在非默认网卡上时，可以加 `ip=10.x.x.x` 变量。

可以用 `ansible-inventory` 检查分组是否符合预期：

```bash
ansible-inventory -i inventory/mycluster/inventory.ini --graph
ansible -i inventory/mycluster/inventory.ini all -m ping -u root
```

### group_vars 结构

```text
inventory/mycluster/group_vars/
├── all/
│   ├── all.yml          # 代理、上游 DNS、NTP
│   ├── containerd.yml   # 镜像加速、运行时参数
│   ├── etcd.yml         # etcd 部署方式、配额
│   └── offline.yml      # 离线/私有镜像源
└── k8s_cluster/
    ├── k8s-cluster.yml  # 版本、网段、kube-proxy、DNS、调度器……
    ├── addons.yml       # kube-vip、metrics-server 等插件开关
    └── k8s-net-*.yml    # 各种 CNI 的参数
```

下面按文件讲团队实际改动的变量。

## 关键变量

### all.yml：节点连不了外网时

```yaml title="group_vars/all/all.yml"
# 节点访问不了公网 DNS 时，CoreDNS 和 nodelocaldns 会起不来
upstream_dns_servers:
  - 192.168.255.53

# 节点只能通过代理出网（常见于 GPU 机房）
http_proxy: "http://192.168.3.1:3128"
https_proxy: "http://192.168.3.1:3128"
no_proxy: "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,localhost,.example.com"

# 访问不了公网 NTP 时要改成内网 NTP，否则时间漂移会导致证书问题
ntp_enabled: true
ntp_servers:
  - "ntp.example.com iburst"
```

### etcd.yml：调大配额

```yaml title="group_vars/all/etcd.yml"
etcd_deployment_type: host        # etcd 以 systemd 服务运行，不是静态 Pod
etcd_data_dir: /var/lib/etcd      # 这块盘要先通过 fio 验收
etcd_quota_backend_bytes: "8589934592"   # 8 GiB，默认只有 2 GiB
```

etcd 数据库达到配额会触发 `mvcc: database space exceeded`，进入只读状态，apiserver 所有写操作都会失败。集群里 CRD 和事件多的话 2 GiB 很快就不够，8 GiB 是官方建议的上限。

### containerd.yml：镜像加速

```yaml title="group_vars/all/containerd.yml"
# Spegel（P2P 镜像分发）需要保留解压前的镜像层
containerd_discard_unpacked_layers: false

containerd_registries_mirrors:
  - prefix: docker.io
    mirrors:
      - host: https://mirror.example.com/v2/docker.io
        capabilities: ["pull", "resolve"]
        skip_verify: false
        override_path: true
  - prefix: registry.k8s.io
    mirrors:
      - host: https://mirror.example.com/v2/registry.k8s.io
        capabilities: ["pull", "resolve"]
        skip_verify: false
        override_path: true
```

`override_path: true` 表示 host 里已经包含完整的 API 路径，containerd 不再自动补 `/v2`，适合"一个域名下用路径区分多个上游"的镜像站。镜像站和 Spegel 放到 [镜像仓库与镜像分发](/learn/registry) 一课展开。

### k8s-cluster.yml：核心配置

```yaml title="group_vars/k8s_cluster/k8s-cluster.yml"
# 网段：部署后改不了，务必和网络管理员确认
kube_service_addresses: 172.23.0.0/16
kube_pods_subnet: 172.24.0.0/13
kube_network_node_prefix: 24

# 不让 Kubespray 装 CNI，部署后单独用 Helm 装 Cilium
kube_network_plugin: cni
kube_owner: root                  # Cilium 需要以 root 身份写 /etc/cni、/opt/cni

# kube-proxy
kube_proxy_mode: ipvs
kube_proxy_strict_arp: true       # kube-vip 和 MetalLB 的 ARP 模式依赖它

# DNS
dns_mode: coredns
enable_nodelocaldns: true
nodelocaldns_ip: 169.254.25.10

# 下载：只让第一个控制平面节点下载，再分发给其他节点
download_run_once: true
local_release_dir: "/root/.cache/kubespray"

# 证书每月自动续期（kubeadm 证书默认一年过期）
auto_renew_certificates: true

# 大镜像（几十 GB 的 AI 镜像）拉取容易超过默认的 2 分钟
kubelet_config_extra_args:
  runtimeRequestTimeout: 15m
```

逐个解释一下为什么这么配。

**`kube_network_plugin: cni`**：Kubespray 自带 Cilium 安装，但它渲染的参数有限，跟进上游版本也慢。设成 `cni` 以后 Kubespray 只装 CNI 基础插件，不装任何网络方案，节点会一直处于 `NotReady`，直到你用 Helm 装好 Cilium。这样 Cilium 的版本和参数完全由自己的 `values.yml` 掌控，升级 Cilium 也不需要跑 Kubespray。具体安装见 [生产网络](/learn/production-networking)。

**`kube_proxy_mode: ipvs` 与 `kube_proxy_strict_arp`**：IPVS 模式用内核哈希表做 Service 转发，Service 数量多的时候比 iptables 快。IPVS 会把所有 ClusterIP 绑到 `kube-ipvs0` 这张虚拟网卡上，默认情况下节点会对这些 IP 响应 ARP 请求，这会和 kube-vip、MetalLB 的 ARP 宣告冲突。`strict_arp: true` 会设置 `arp_ignore=1`、`arp_announce=2`，让节点只响应真正配在物理网卡上的地址。

> [!WARNING] IPVS 模式已被废弃
> Kubernetes v1.35 起 kube-proxy 的 IPVS 模式被标记为废弃，启动时会打印警告，未来版本会移除。官方推荐的替代是 v1.33 GA 的 **nftables** 模式（`kube_proxy_mode: nftables`）。新集群建议直接评估 nftables；老集群升级到 1.35 时要把迁移列入计划。另一条路是让 Cilium 完全接管 Service 转发（kube-proxy replacement），见下一课。

**`enable_nodelocaldns`**：在每个节点上跑一个 DNS 缓存（DaemonSet，监听链路本地地址 `169.254.25.10`），Pod 的 `/etc/resolv.conf` 指向它。这样绝大多数 DNS 查询在本机就能命中缓存，不用经过 conntrack 转发到 CoreDNS，也避开了 conntrack 竞争导致的 DNS 偶发 5 秒超时。内部域名需要交给内网 DNS 解析时，可以用 `nodelocaldns_external_zones` 按域名配置转发。

**`download_run_once`**：默认每个节点各自下载二进制和镜像。几十台节点同时去公网拉 kubelet、etcd 镜像，很容易被限速。打开以后由第一个控制平面节点下载，再通过 Ansible 分发，只需要这一台能上网。

### 调度器：优先把一台 GPU 节点塞满

默认调度器用 `LeastAllocated` 打分，倾向把 Pod 打散到最空闲的节点。对 GPU 集群这恰恰不好：8 个单卡任务分散到 8 台机器上，之后来一个要 8 卡的训练任务，就找不到一台完整空闲的机器了。

团队的做法是改成 `MostAllocated`（装箱策略，Bin Packing），并给 GPU 更高权重：

```yaml title="group_vars/k8s_cluster/k8s-cluster.yml"
kube_scheduler_profiles:
  - schedulerName: default-scheduler
    pluginConfig:
      - name: NodeResourcesFit
        args:
          scoringStrategy:
            type: MostAllocated
            resources:
              - name: cpu
                weight: 1
              - name: memory
                weight: 1
              - name: nvidia.com/gpu
                weight: 5
```

这会渲染成调度器的 `KubeSchedulerConfiguration`。效果是：新 Pod 优先放到 GPU 已经用得最多、但还放得下的节点上，把完整的空闲节点留给大任务。纯 CPU 的 Web 服务集群一般不需要这么配，打散反而有利于容灾。原理见[调度](/learn/scheduling)一课和官方的资源装箱文档。

### addons.yml：kube-vip 做 apiserver 高可用

Kubespray 的 apiserver 高可用其实有两层：

```text
集群外（kubectl、CI）──▶ VIP 192.168.3.101:6443 ──▶ 当前持有 VIP 的控制平面节点
                           （kube-vip，外部 LB）

每个 worker 上的 kubelet/kube-proxy ──▶ 127.0.0.1:6443 ──▶ nginx 静态 Pod ──▶ 3 个 apiserver
                           （Kubespray 内置的内部 LB）
```

节点内部组件访问 apiserver 走本机的 nginx 代理，天然高可用，不依赖 VIP。VIP 是给集群外面用的。团队用 kube-vip 提供这个 VIP：

```yaml title="group_vars/k8s_cluster/addons.yml"
kube_vip_enabled: true
kube_vip_controlplane_enabled: true   # 为控制平面提供 VIP
kube_vip_arp_enabled: true            # 用 ARP（二层）宣告
kube_vip_address: 192.168.3.101       # 向网管申请的空闲 IP，和节点同网段
kube_vip_interface: eth0              # 宿主机上实际的网卡名

metrics_server_enabled: true
```

> [!WARNING] kube_vip_interface 要写真实设备名
> 节点用了 VLAN 子接口时，`ip addr` 里看到的是 `bond0.3100@bond0`，这里要填 `bond0.3100`，不能填 `bond0`，也不能带 `@` 后缀。填错的话 kube-vip 静态 Pod 会启动失败或者 VIP 绑不上，而 Kubespray 的任务仍可能显示成功，直到你从外面连 VIP 才发现不通。

需要从公网访问 apiserver 时，把公网 IP 或域名加进证书的 SAN，并且只对白名单放开 6443：

```yaml
supplementary_addresses_in_ssl_keys:
  - 203.0.113.10
  - api.k8s1.bj1.example.com
```

### offline.yml：离线与私有镜像源

机房完全不能访问外网时，需要把 Kubespray 用到的二进制文件和镜像同步到内网，再改写下载地址：

```yaml title="group_vars/all/offline.yml"
registry_host: "registry.example.com"
files_repo: "https://files.example.com/kubespray/2.31.0"

kube_image_repo: "{{ registry_host }}/registry.k8s.io"
docker_image_repo: "{{ registry_host }}/docker.io"
quay_image_repo: "{{ registry_host }}/quay.io"
github_image_repo: "{{ registry_host }}/ghcr.io"

kubeadm_download_url: "{{ files_repo }}/dl.k8s.io/release/v{{ kube_version }}/bin/linux/{{ image_arch }}/kubeadm"
kubelet_download_url: "{{ files_repo }}/dl.k8s.io/release/v{{ kube_version }}/bin/linux/{{ image_arch }}/kubelet"
etcd_download_url: "{{ files_repo }}/github.com/etcd-io/etcd/releases/download/v{{ etcd_version }}/etcd-v{{ etcd_version }}-linux-{{ image_arch }}.tar.gz"
containerd_download_url: "{{ files_repo }}/github.com/containerd/containerd/releases/download/v{{ containerd_version }}/containerd-{{ containerd_version }}-linux-{{ image_arch }}.tar.gz"
# ……其余 *_download_url 同理
```

`files_repo` 下的目录结构保持和原始 URL 一致（`dl.k8s.io/...`、`github.com/...`），这样只替换前缀就行。Kubespray 仓库里的 `contrib/offline/` 提供了生成文件清单和镜像清单的脚本，可以用它把所需文件一次性拉下来。

## 执行部署

```bash
source .venv/bin/activate
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b cluster.yml
```

`-u root` 指定 ssh 用户，`-b`（become）表示用 sudo 提权。一个 5 节点集群全量部署大约 20～40 分钟，取决于网络。部署完成后：

```bash
# 从第一个控制平面节点拿 kubeconfig
scp root@192.168.3.21:/root/.kube/config ~/.kube/k8s1.config
# 把 server 地址改成 VIP
sed -i 's#server: https://.*:6443#server: https://192.168.3.101:6443#' ~/.kube/k8s1.config

export KUBECONFIG=~/.kube/k8s1.config
kubectl get nodes
```

此时所有节点都是 `NotReady`，这是正常的，因为还没装 CNI。装好 Cilium 以后就会变成 `Ready`。

> [!TIP] 失败了就再跑一遍
> Kubespray 的任务是幂等的。网络抖动、镜像拉取超时导致的失败，修好原因后直接重新执行同一条命令即可，不需要先 reset。加 `-v` 或 `-vvv` 可以看到更详细的输出。

## 日常操作

### 增量更新：用 --tags 只跑一部分

全量执行 `cluster.yml` 很慢。只改了某个组件的变量时，用 tag 只执行相关任务：

```bash
# 查看所有可用的 tag
ansible-playbook -i inventory/mycluster/inventory.ini cluster.yml --list-tags

# 例如只更新 CoreDNS / nodelocaldns 的配置
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b cluster.yml --tags=coredns,nodelocaldns
```

> [!WARNING] 改网段、改 CNI 不是"再跑一遍"能解决的
> `kube_service_addresses`、`kube_pods_subnet`、`cluster_name`、`container_manager` 这类变量在集群创建后就固定了，改了再跑 Playbook 轻则失败，重则让集群进入半新半旧的状态。这类变更只能重建集群并迁移业务。

### 扩容 worker 节点

```bash
# 1. 把新节点加进 inventory.ini 的 [kube_node]
# 2. 刷新所有节点的 facts（scale 需要其他节点的信息）
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b playbooks/facts.yml
# 3. 只对新节点执行 scale
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b scale.yml \
  --limit=gn-192-168-3-61,gn-192-168-3-62
```

`--limit` 很关键，不加的话 Ansible 会把所有节点都过一遍，既慢又有风险。下线节点用 `remove-node.yml -e node=<节点名>`，它会先 drain 再清理，详见 [Day-2 运维](/learn/day2-operations)。

### 扩容控制平面

控制平面扩容（比如从 1 台扩到 3 台）**不能用 `scale.yml`**，因为它不会正确更新 etcd 成员列表。团队验证过的做法是把新节点当作"坏掉的节点"交给 `recover-control-plane.yml` 恢复：

```ini title="inventory.ini（新节点 22、23 已加入 kube_control_plane，另临时增加 broken_* 分组）"
[broken_etcd]
mn-192-168-3-22 ansible_host=192.168.3.22 etcd_member_name=etcd2
mn-192-168-3-23 ansible_host=192.168.3.23 etcd_member_name=etcd3

[broken_kube_control_plane]
mn-192-168-3-22
mn-192-168-3-23
```

```bash
# 先备份 etcd！
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b playbooks/facts.yml
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b recover-control-plane.yml \
  --limit=etcd,kube_control_plane -e etcd_retries=10
```

成功后**立刻删除 `broken_*` 分组**，避免以后误触发恢复逻辑。然后在任一控制平面节点上确认 etcd 有 3 个 `started` 成员：

```bash
set -a && source /etc/etcd.env && set +a
etcdctl member list -w table
```

> [!PROD] 先查已知问题再动手
> 控制平面变更是 Kubespray 里最容易踩到版本 bug 的操作。动手前先去 Issues 和 Release Notes 搜一下所用版本的已知问题，并且一定先做 etcd 快照。

### 重置集群

```bash
ansible-playbook -i inventory/mycluster/inventory.ini -u root -b reset.yml
```

`reset.yml` 会停掉所有服务，删除 `/etc/kubernetes`、`/var/lib/etcd`、容器和 CNI 配置，把节点还原到部署前的状态。它会先让你输入 `yes` 确认。

> [!DANGER] reset 会清空 etcd 数据
> 在生产 inventory 上执行 `reset.yml` 就等于删除整个集群。只想移除某个节点时一定用 `remove-node.yml`，或者给 reset 加 `--limit`。建议把生产 inventory 和测试 inventory 放在不同目录，执行前核对 `-i` 参数。

### 升级前做影响评估

每次升级 Kubespray（对应升级 Kubernetes）之前，团队会写一份影响评估清单。以 v2.30 → v2.31 为例，影响比较大的几项是：

| 变更 | 影响 |
| --- | --- |
| kubelet 默认拒绝在 cgroup v1 上启动 | 老系统升级后 kubelet 起不来，先确认所有节点是 cgroup v2 |
| etcd 3.5 → 3.6 | 大版本升级，务必先备份 |
| ingress-nginx 插件被移除（上游项目已归档） | 需要换成其他入口方案，见下一课 |
| kube-proxy IPVS 模式废弃 | 评估迁移到 nftables |

升级流程本身（`upgrade-cluster.yml`、逐个小版本升级）放在 [Day-2 运维](/learn/day2-operations) 讲。

## 动手练习

1. 在部署机上按"准备部署机"一节装好 Kubespray v2.31 的虚拟环境，用 `ansible-playbook -i inventory/sample/inventory.ini cluster.yml --list-tags` 列出所有 tag，找出和 CoreDNS、etcd、kube-vip 相关的 tag。这一步不需要真实节点。
2. 仿照本文写一份 3 控制平面 + 2 worker 的 `inventory.ini`，用 `ansible-inventory --graph` 检查分组，确认 `etcd` 组里正好是 3 台控制平面节点。
3. 有 3 台虚拟机的话，按本文的变量（`kube_network_plugin: cni`、kube-vip、nodelocaldns）部署一个集群，确认节点处于 `NotReady`，再在 [下一课](/learn/production-networking) 装完 Cilium 后看它变成 `Ready`。
4. 在部署好的集群上执行 `kubectl -n kube-system get cm kube-proxy -o yaml | grep -A3 ipvs`，找到 `strictARP: true`；在节点上执行 `ip addr show kube-ipvs0`，观察 ClusterIP 是怎样绑在虚拟网卡上的。
5. 对照调度器配置，推演：3 台 8 卡 GPU 节点，依次提交 6 个单卡 Pod，在 `LeastAllocated` 和 `MostAllocated` 两种策略下分别会怎样分布？之后再来一个 8 卡任务，哪种策略能调度成功？

## 自测

<details>
<summary>为什么设置 kube_network_plugin: cni，而不是直接用 Kubespray 的 cilium 选项？</summary>

设成 `cni` 后 Kubespray 只安装 CNI 基础插件，不装网络方案，Cilium 由自己的 Helm Chart 和 `values.yml` 单独管理。这样 Cilium 的版本和参数完全可控，升级 Cilium 也不需要重跑 Kubespray。代价是部署完成后、装 Cilium 之前，节点处于 `NotReady`。

</details>

<details>
<summary>kube_proxy_strict_arp 解决什么问题？</summary>

IPVS 模式把所有 ClusterIP 绑在 `kube-ipvs0` 上，默认节点会响应这些地址的 ARP 请求，和 kube-vip、MetalLB 的 ARP 宣告冲突，导致 VIP 被错误的节点"抢走"。strict ARP 会设置 `arp_ignore`/`arp_announce`，让节点只响应物理网卡上真正配置的地址。

</details>

<details>
<summary>已经有了 kube-vip 提供的 VIP，为什么每个节点还有一个本地 nginx？</summary>

两者用途不同。本地 nginx（Kubespray 内置的内部 LB）供节点上的 kubelet、kube-proxy 访问 apiserver，每个节点自己转发到三个 apiserver，不依赖任何 VIP，所以天然高可用。kube-vip 的 VIP 是给集群外部（kubectl、CI 系统）使用的统一入口。

</details>

<details>
<summary>扩容 worker 和扩容控制平面分别用什么 Playbook？</summary>

worker 用 `playbooks/facts.yml` 刷新 facts 后执行 `scale.yml --limit=<新节点>`。控制平面扩容需要变更 etcd 成员，用 `recover-control-plane.yml`：把新节点临时放进 `broken_etcd` 和 `broken_kube_control_plane` 分组，执行完成后删除这两个分组。操作前先备份 etcd。

</details>

<details>
<summary>MostAllocated 调度策略适合什么场景？</summary>

适合 GPU 这类昂贵、需要整机分配的资源。它让新 Pod 优先填满已经部分占用的节点，把完整空闲的节点留给多卡大任务，减少资源碎片。普通无状态 Web 服务集群通常保留默认的 `LeastAllocated`，把 Pod 打散更有利于容灾。

</details>

## 参考资料

- [Kubespray 官方文档](https://kubespray.io/)
- [Kubespray GitHub 仓库](https://github.com/kubernetes-sigs/kubespray)
- [Kubespray：增删节点](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/operations/nodes.md)
- [Kubespray：离线环境](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/operations/offline-environment.md)
- [Kubernetes 官方文档：使用 Kubespray 安装 Kubernetes](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubespray/)
- [Kubernetes 官方文档：调度器配置](https://kubernetes.io/zh-cn/docs/reference/scheduling/config/)
- [Kubernetes 官方文档：扩展资源的资源装箱](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/resource-bin-packing/)
- [Kubernetes 官方文档：在 Kubernetes 集群中使用 NodeLocal DNSCache](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/nodelocaldns/)
- [kube-vip 官方文档](https://kube-vip.io/)
