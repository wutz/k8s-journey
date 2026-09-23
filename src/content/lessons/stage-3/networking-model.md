# 网络模型与 CNI

在 [Service 与服务发现](/learn/services) 里，我们只要写个 Service，流量就能到达 Pod。但是 Pod IP 从哪来？两个不在同一台机器上的 Pod 为什么能直接互 ping？访问一个根本不存在于任何网卡上的 ClusterIP，数据包是怎么被送到后端的？生产中大量"网络不通"的问题，都卡在对这几层机制的一知半解上。

这一课自底向上拆解 Kubernetes 网络：先讲网络模型的三条原则，再看 Pod 之间怎样通信（同节点、跨节点、overlay 与路由），接着是 CNI 规范、kube-proxy 的几种模式和 Cilium 的 eBPF 替代方案，最后是 CoreDNS 以及用 `kubectl debug` + netshoot 排查网络的方法。

## Kubernetes 网络模型：三条原则

Kubernetes 本身不实现 Pod 网络，它只规定了一个模型，由网络插件去实现：

1. **每个 Pod 有一个集群内唯一的 IP**，Pod 内所有容器共享这个 IP 和网络命名空间（Network Namespace）。
2. **所有 Pod 之间可以不经 NAT 直接通信**，无论是否在同一节点。
3. **节点上的代理（kubelet、系统守护进程）可以与该节点上所有 Pod 通信**。

这套"扁平网络"模型的好处是：应用看到的自己的 IP 和别人看到的一致，端口不会冲突，从虚拟机迁移过来的程序几乎不用改。代价是需要有人负责给 Pod 分配 IP、打通节点之间的路由——这就是 CNI 插件的工作。

在此之上，Kubernetes 还定义了三类"虚拟"网络：

| 地址段 | 谁分配 | 在哪里生效 |
|---|---|---|
| Pod CIDR | CNI 插件的 IPAM | 真实存在于 Pod 的网卡上 |
| Service CIDR（ClusterIP） | apiserver | 不在任何网卡上，只存在于 kube-proxy/eBPF 规则里 |
| 节点网络 | 基础设施 | 节点的物理网卡 |

三者不能重叠，也不能与公司内网其他网段冲突，这是 [生产集群规划](/learn/cluster-planning) 中网络规划的核心。

## Pod 之间是怎样通信的

### 同一节点：veth pair + 网桥或路由

每个 Pod 有自己的网络命名空间。CNI 插件创建一对 **veth pair**（虚拟网线），一端放进 Pod 命名空间命名为 `eth0`，另一端留在宿主机上。

```text
┌──────────────────────── 节点 192.168.1.11 ────────────────────────┐
│  ┌─ Pod A ────────┐          ┌─ Pod B ────────┐                   │
│  │ eth0 10.244.1.5│          │ eth0 10.244.1.6│                   │
│  └───────┬────────┘          └───────┬────────┘                   │
│       vethA                        vethB                          │
│          └──────────┬───────────────┘                             │
│              cni0 网桥 / 或宿主机路由表 + eBPF                      │
│                     │                                             │
│                  eth0 192.168.1.11 ──────────────► 物理网络         │
└───────────────────────────────────────────────────────────────────┘
```

Flannel 这类插件用 Linux 网桥把同节点的 veth 连起来；Calico 和 Cilium 则通常不用网桥，而是在宿主机上为每个 Pod IP 写一条路由（或由 eBPF 程序直接转发）。

### 跨节点：overlay 与原生路由

跨节点时，底层网络根本不认识 `10.244.x.x`，有两种办法：

**Overlay（隧道封装）**：把 Pod 之间的原始数据包封装进节点之间的 UDP 包（VXLAN 或 Geneve），对端节点解封装后再交给目标 Pod。

```text
Pod A 10.244.1.5 → Pod C 10.244.2.8
外层：192.168.1.11 → 192.168.1.12  UDP 8472 (VXLAN)
内层：10.244.1.5   → 10.244.2.8    TCP 80
```

- 优点：对底层网络零要求，只要节点之间 IP 通就行，适合云主机和不受控的网络。
- 缺点：每个包多 50 字节左右的封装头，要注意 MTU；封装/解封装有 CPU 开销。

**原生路由（Native Routing / Direct Routing）**：不封装，而是让网络知道"`10.244.2.0/24` 在节点 192.168.1.12 上"。实现方式有：

- 所有节点在同一个二层网段时，每个节点直接写到其他节点 Pod 网段的路由（Flannel `host-gw`、Cilium `autoDirectNodeRoutes`）。
- 跨三层时，用 BGP 把 Pod 网段通告给物理交换机/路由器（Calico BGP、Cilium BGP Control Plane）。

原生路由性能更好、抓包更直观，但需要网络团队配合。

> [!PROD] 选型经验
> 自建机房、能掌控交换机的场景优先原生路由；云上或网络不受控时用 overlay。无论哪种，Pod CIDR 一旦规划好就不能改原有网段，只能追加。例如 Cilium 的 cluster-pool IPAM 在网段耗尽后，要在 `ipam.operator.clusterPoolIPv4PodCIDRList` 中新增一段，再重启 cilium-operator，新节点才能拿到 Pod 网段。

## CNI 规范

CNI（Container Network Interface）是一个非常简单的规范：**一个可执行文件 + 一份 JSON 配置**。容器运行时在创建 Pod 沙箱时：

1. 读取 `/etc/cni/net.d/` 下字典序第一个配置文件；
2. 调用 `/opt/cni/bin/` 下对应的插件二进制，通过环境变量传入 `CNI_COMMAND=ADD`、`CNI_NETNS`、`CNI_IFNAME` 等，stdin 传入 JSON 配置；
3. 插件完成网卡创建和 IP 分配，把结果（IP、路由）以 JSON 打印到 stdout。

Pod 删除时同样调用 `DEL`。一个最小的配置长这样：

```json title="10-mynet.conflist"
{
  "cniVersion": "1.0.0",
  "name": "mynet",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "cni0",
      "isGateway": true,
      "ipMasq": true,
      "ipam": { "type": "host-local", "subnet": "10.244.1.0/24" }
    },
    { "type": "portmap", "capabilities": { "portMappings": true } }
  ]
}
```

`plugins` 是链式调用（chaining）：先由 `bridge` 创建网卡，再由 `portmap` 处理 `hostPort`。实际的 Cilium、Calico 也是这样安装的：一个 DaemonSet 负责把二进制和配置写到每个节点的这两个目录。

在 kind 里看看默认的 kindnet 插件：

```bash
docker exec kind-worker ls /etc/cni/net.d/ /opt/cni/bin/
docker exec kind-worker cat /etc/cni/net.d/10-kindnet.conflist
```

> [!WARNING] "network plugin not ready"
> 新节点上 Pod 卡在 `ContainerCreating`，事件里有 `NetworkPluginNotReady` 或 `failed to setup network for sandbox`，几乎都是 CNI 的问题：CNI DaemonSet 没在这个节点上跑起来（被污点挡住、镜像拉不下来），或者 `/etc/cni/net.d/` 里残留了旧插件的配置排在前面。

## Service 的实现：kube-proxy

ClusterIP 是个"不存在"的 IP。每个节点上的 kube-proxy watch Service 和 EndpointSlice，把"访问 VIP:Port → 随机选一个后端 Pod"翻译成内核规则。数据包在离开客户端 Pod 所在节点之前就已经被 DNAT 成了真实 Pod IP。kube-proxy 有三种 Linux 模式：

| 模式 | 原理 | 特点 | 状态 |
|---|---|---|---|
| `iptables` | 每个 Service/端点一串 iptables 规则，用 `statistic` 模块随机选后端 | 最成熟；规则数随 Service 数线性增长，大集群更新慢 | 默认模式 |
| `ipvs` | 用内核 IPVS 做负载均衡，查找是哈希表 | 大规模下性能好，负载均衡算法多 | v1.35 起被标记为废弃 |
| `nftables` | 用 nftables 的 map/set 实现，匹配接近 O(1) | 规则更新和数据面性能都优于 iptables | v1.33 起 GA，官方推荐的新方向 |

> [!NOTE] IPVS 的去向
> IPVS 模式多年来与 iptables 行为存在细节差异，维护者人手有限。社区已明确将 nftables 作为取代 iptables 和 IPVS 的方向，IPVS 模式在 v1.35 被标记为废弃（仍可用，未来版本会移除）。新集群不建议再选 IPVS；如果不用 kube-proxy 替代方案，优先评估 nftables。请以你所用版本的发布说明为准。

查看你的 kind 集群 kube-proxy 用的是什么模式，以及 iptables 模式下一个 Service 的规则链：

```bash
kubectl -n kube-system get cm kube-proxy -o jsonpath='{.data.config\.conf}' | grep -E '^mode'
kubectl create deployment web --image=nginx:1.27 --replicas=2
kubectl expose deployment web --port=80
docker exec kind-worker iptables-save -t nat | grep -E 'default/web'
# KUBE-SERVICES  -d 10.96.x.x/32 -p tcp --dport 80 -j KUBE-SVC-XXXX
# KUBE-SVC-XXXX  -m statistic --mode random --probability 0.5 -j KUBE-SEP-AAAA
# KUBE-SEP-AAAA  -j DNAT --to-destination 10.244.1.5:80
```

读懂这三跳（`KUBE-SERVICES` → `KUBE-SVC-*` → `KUBE-SEP-*` DNAT），你就明白 ClusterIP 为什么 ping 不通：规则只匹配了 TCP/UDP 的特定端口，ICMP 没有对应的 DNAT。

kind 创建集群时也可以直接指定 nftables 模式：

```yaml title="kind-nftables.yaml"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  kubeProxyMode: nftables
nodes:
  - role: control-plane
  - role: worker
```

之后可以用 `docker exec kind-worker nft list table ip kube-proxy` 观察规则。

## Cilium：用 eBPF 替代 kube-proxy

[Cilium](https://cilium.io/) 是基于 eBPF 的 CNI。eBPF 允许把经过校验的小程序挂到内核的网络钩子上（tc、XDP、socket），直接在内核里做转发、负载均衡和策略判断，不再依赖 iptables 链。

Cilium 可以同时承担三件事：

- **CNI**：分配 Pod IP，支持 overlay（VXLAN/Geneve）和原生路由。
- **kube-proxy 替代**（`kubeProxyReplacement=true`）：在 socket 层做 Service 负载均衡，客户端 `connect()` 时直接把 VIP 换成后端地址，连 DNAT 都省了。
- **网络策略与可观测**：基于身份（Identity，由 Pod 标签派生）的 L3-L7 策略，以及 Hubble 流量可视化。下一课的 [工作负载安全加固](/learn/security) 会用到 CiliumNetworkPolicy。

> [!LAB] 在 kind 中安装 Cilium 并替换 kube-proxy
> 需要本机已装 helm。Cilium 版本截至本文写作时为 1.18 系列，请以 [官方发布](https://github.com/cilium/cilium/releases) 为准。

```yaml title="kind-cilium.yaml"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true   # 不装 kindnet
  kubeProxyMode: none       # 不装 kube-proxy
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

```bash
kind create cluster --name cilium --config kind-cilium.yaml
kubectl get nodes          # 此时节点都是 NotReady：没有 CNI

helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium --namespace kube-system \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=cilium-control-plane \
  --set k8sServicePort=6443 \
  --set ipam.mode=kubernetes \
  --set image.pullPolicy=IfNotPresent

kubectl -n kube-system rollout status ds/cilium
kubectl get nodes          # 变为 Ready
kubectl -n kube-system exec ds/cilium -- cilium-dbg status | grep KubeProxyReplacement
kubectl -n kube-system exec ds/cilium -- cilium-dbg service list
```

为什么必须设置 `k8sServiceHost`？因为没有 kube-proxy 时，`kubernetes` 这个 ClusterIP 在 Cilium 就绪之前是不可达的，Cilium 自己必须直连 apiserver 地址，否则就是死锁。

> [!PROD] 生产中安装 Cilium 的几个坑
> - `k8sServiceHost` 要填一个高可用的 apiserver 地址：Kubespray 部署的集群推荐 `127.0.0.1`（每个节点上的本地 nginx 代理会转发到所有 apiserver），也可以填 VIP；不建议用 `auto`，它从 `kube-public/cluster-info` 读到的通常是单个 master 地址。
> - Cilium 会占用若干策略路由表（如 200、202、2004、2005），如果宿主机上已有其他网络配置使用了相同编号，会导致网络异常。
> - 某些内核与 Cilium 版本组合下，TCX 挂载方式的 BPF 程序存在清理问题，遇到时可以设置 `bpf.enableTCX=false` 回退到传统 tc 挂载。
> - 即便暂时保留 kube-proxy（`kubeProxyReplacement=false`），Cilium 作为 CNI 与策略引擎仍然工作良好，可以分步迁移。
>
> 完整部署见 [生产网络：Cilium、MetalLB 与证书](/learn/production-networking)。

## 集群 DNS：CoreDNS 与 NodeLocal DNSCache

Service 有了 VIP，还需要名字。CoreDNS 以 Deployment 运行在 `kube-system`，它的 Service 名叫 `kube-dns`（历史原因），ClusterIP 通常是 Service CIDR 的第 10 个地址。kubelet 会把它写进每个 Pod 的 `/etc/resolv.conf`：

```bash
kubectl run -it --rm dns-test --image=busybox:1.36 --restart=Never -- cat /etc/resolv.conf
# search default.svc.cluster.local svc.cluster.local cluster.local
# nameserver 10.96.0.10
# options ndots:5
```

注意 `ndots:5`：名字中点少于 5 个时，会先依次拼接 search 域去查。所以 Pod 里访问 `api.example.com` 会先查 `api.example.com.default.svc.cluster.local` 等 3 个不存在的名字，最后才查原始域名，一次解析变成 4 对（A + AAAA）查询。高频访问外部域名的应用可以在域名末尾加 `.`（写成 FQDN），或者在 Pod 的 `dnsConfig` 中把 `ndots` 调小。

**NodeLocal DNSCache** 在每个节点以 DaemonSet 跑一个 DNS 缓存，监听一个链路本地地址（官方示例是 `169.254.20.10`，Kubespray 默认 `169.254.25.10`），Pod 的 DNS 请求先到本机缓存：

- 避开了 conntrack 表对 UDP DNS 的竞争问题（经典的"DNS 偶发 5 秒超时"）；
- 缓存命中时不出节点，延迟和 CoreDNS 负载都大幅降低；
- 到上游 CoreDNS 用 TCP，更可靠。

大规模生产集群强烈建议开启。

## 用 kubectl debug + netshoot 排查

生产镜像通常很精简，连 `curl` 都没有。[netshoot](https://github.com/nicolaka/netshoot) 是一个装满网络工具（dig、curl、tcpdump、iperf3、ss、mtr）的镜像，配合 `kubectl debug` 可以附着到目标 Pod 的网络命名空间：

```bash
# 在目标 Pod 中注入临时容器，共享其网络命名空间
kubectl debug -it pod/web-xxxx --image=nicolaka/netshoot --target=nginx -- bash
# 在里面：
ss -lntp                              # 看容器监听了哪些端口
curl -sv http://web.default.svc       # 走 Service
dig +search web                        # 走 search 域解析
tcpdump -i eth0 -nn port 80            # 抓 Pod 进出流量

# 在节点的宿主网络命名空间里调试（节点的根文件系统挂载在 /host）
kubectl debug node/kind-worker -it --image=nicolaka/netshoot
ip route; iptables-save -t nat | head
```

排查"访问 Service 不通"的顺序建议：

```text
1. Pod IP 直连通吗？    不通 → CNI / NetworkPolicy / 应用没监听
2. Service 有端点吗？   kubectl get endpointslice -l kubernetes.io/service-name=web
                        空 → selector 写错或 Pod 未 Ready
3. ClusterIP 通吗？     不通 → kube-proxy / Cilium 规则
4. 域名能解析吗？       不能 → CoreDNS / NodeLocal DNS / 网络策略拦截了 53 端口
```

## 动手练习

1. 在默认 kind 集群中，找到一个 Pod 在宿主机上对应的 veth 网卡（提示：Pod 内 `cat /sys/class/net/eth0/iflink` 得到对端 ifindex，再在节点上 `ip link | grep '^<ifindex>:'`）。
2. 跟踪一个 Service 的 iptables 规则链：从 `KUBE-SERVICES` 找到 `KUBE-SVC-*`，再找到每个 `KUBE-SEP-*`，把副本数从 2 扩到 3，观察概率值怎样变化。
3. 按本课 LAB 创建一个无 kube-proxy 的 Cilium 集群，确认 `kubectl -n kube-system get ds kube-proxy` 不存在，但 Service 仍然可以访问。
4. 在 Pod 中执行 `dig +search +showsearch api.github.com`，数一数实际发出了几次查询；再改用 `api.github.com.` 对比。
5. 用 `kubectl debug` + netshoot 对一个 nginx Pod 抓包，同时在另一个 Pod 里 curl 它的 Service，确认抓到的目标地址是 Pod IP 而不是 ClusterIP。

## 自测

<details>
<summary>为什么 ping ClusterIP 通常不通，但 curl ClusterIP:端口 可以？</summary>

ClusterIP 不绑定在任何网卡上，只是 kube-proxy（或 eBPF）规则中的匹配条件。规则只针对 Service 声明的协议和端口做 DNAT，ICMP 包没有匹配的规则，也没有任何网卡会响应它。（IPVS 模式会把 VIP 绑在 `kube-ipvs0` 虚拟网卡上，因此有时能 ping 通，这是实现差异，不应依赖。）

</details>

<details>
<summary>overlay 和原生路由各适合什么场景？overlay 需要特别注意什么？</summary>

overlay 对底层网络没有要求，适合云主机或无法配置交换机的环境；原生路由没有封装开销、排查直观，适合能与网络团队协作、能配置路由或 BGP 的自建机房。overlay 需要注意 MTU：封装头会占用约 50 字节，Pod 网卡的 MTU 必须相应调小，否则大包会被分片或丢弃。

</details>

<details>
<summary>CNI 插件是被谁、在什么时候调用的？</summary>

由容器运行时（如 containerd）在 kubelet 通过 CRI 调用 `RunPodSandbox` 创建 Pod 沙箱时调用，命令是 `ADD`；删除沙箱时调用 `DEL`。运行时从 `/etc/cni/net.d/` 读取配置，执行 `/opt/cni/bin/` 下的插件二进制。

</details>

<details>
<summary>新集群要选 kube-proxy 模式，为什么不推荐 IPVS 了？</summary>

IPVS 模式已在 v1.35 被标记为废弃，未来会移除；社区选择 nftables 作为 iptables 和 IPVS 的继任者，nftables 在 v1.33 已 GA，性能与 IPVS 相当且行为与 iptables 模式一致。如果使用 Cilium 等 eBPF 方案，则可以完全不部署 kube-proxy。

</details>

<details>
<summary>用 Cilium 替代 kube-proxy 时，为什么必须配置 k8sServiceHost？</summary>

没有 kube-proxy 时，`kubernetes` Service 的 ClusterIP 要靠 Cilium 自己来实现。Cilium 启动时还没就绪，无法通过 ClusterIP 访问 apiserver，形成死锁，所以必须给它一个可以直连的 apiserver 地址（本地代理或 VIP）。

</details>

## 参考资料

- [Kubernetes 官方文档：集群网络系统](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/networking/)
- [Kubernetes 官方文档：Kubernetes 网络模型](https://kubernetes.io/zh-cn/docs/concepts/services-networking/)
- [Kubernetes 官方文档：虚拟 IP 和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
- [Kubernetes 官方文档：Service 与 Pod 的 DNS](https://kubernetes.io/zh-cn/docs/concepts/services-networking/dns-pod-service/)
- [Kubernetes 官方文档：在 Kubernetes 集群中使用 NodeLocal DNSCache](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/nodelocaldns/)
- [Kubernetes 官方文档：调试运行中的 Pod](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-application/debug-running-pod/)
- [CNI 规范](https://github.com/containernetworking/cni/blob/main/SPEC.md)
- [Cilium 文档：Kubernetes Without kube-proxy](https://docs.cilium.io/en/stable/network/kubernetes/kubeproxy-free/)
- [The Kubernetes Networking Guide](https://www.tkng.io/)
