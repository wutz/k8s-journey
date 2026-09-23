# 生产网络：Cilium、MetalLB 与证书

[上一课](/learn/kubespray)用 Kubespray 部署完集群后，所有节点都是 `NotReady`，因为我们故意没让它装 CNI。这一课把一个裸金属集群的网络层补完整，分三步：用 Cilium 打通 Pod 网络，用 MetalLB 让 `type: LoadBalancer` 的 Service 在机房里拿到真实 IP，用 cert-manager 自动签发和续期 TLS 证书。然后是入口方案的选型：ingress-nginx 已经归档，新集群该用什么。

这几个组件在公有云上都由云厂商代劳，裸金属上要自己搞定。它们也是后面所有对外服务的基础。

> [!NOTE] 本课需要的环境
> - **Cilium**：需要真实节点（上一课的集群）。kind 里也能装 Cilium，但参数和生产不同，本课不展开。
> - **MetalLB L2**：kind 可以完整练习，下文有步骤。
> - **cert-manager**：自签名 CA 在 kind 里可以完整练习；ACME（Let's Encrypt）需要公网可达的域名，只能在生产环境验证。

## 组件目录约定

团队的每个集群组件都是一个独立目录，用同一套三件套管理：

```text
network/
├── cilium/
│   ├── helmwave.yml        # 装哪个 Chart、哪个版本、装到哪个命名空间
│   └── values.yml          # Chart 参数，只写和默认值不同的部分
├── metallb/
│   ├── helmwave.yml
│   ├── values.yml
│   ├── kustomization.yaml  # Chart 之外的自定义资源（地址池等）
│   └── ipaddresspool.yaml
└── cert-manager/
    ├── helmwave.yml
    ├── values.yml
    ├── kustomization.yaml
    └── clusterissuer.yaml
```

[helmwave](https://docs.helmwave.app/) 是一个声明式的 Helm 编排工具，作用类似 helmfile：把 `helm repo add`、`helm upgrade --install` 的参数写进文件，进 Git 管理。一个典型的 `helmwave.yml`：

```yaml title="network/metallb/helmwave.yml"
project: metallb

repositories:
  - name: metallb
    url: https://metallb.github.io/metallb

releases:
  - name: metallb
    namespace: metallb-system
    create_namespace: true
    chart:
      name: metallb/metallb
      version: 0.15.3
    values:
      - values.yml
    wait: true
```

部署流程固定为两步：

```bash
cd network/metallb
helmwave up --build            # 安装/升级 Chart
kubectl apply -k .             # 应用 Chart 之外的 CR（依赖 Chart 带的 CRD，所以放第二步）
```

这样 Chart 版本、参数和自定义资源都能在 Git 里 review，升级就是改 `version` 再跑一遍。不用 helmwave 的话，换成 `helm upgrade --install -f values.yml` 也是同样的结构。Helm 和 Kustomize 本身见 [Helm 与 Kustomize](/learn/helm-kustomize)。

## Cilium：Pod 网络

Cilium 用 eBPF 实现 Pod 网络、Service 转发和网络策略，是目前生产集群最主流的 CNI 之一。截至本文写作时团队使用 1.19.x，请以 [官方 Releases](https://github.com/cilium/cilium/releases) 为准。

```yaml title="network/cilium/values.yml"
# apiserver 地址：指向 Kubespray 在每个节点上的本地 nginx 代理
k8sServiceHost: "127.0.0.1"
k8sServicePort: "6443"

# 保留 kube-proxy，Cilium 只负责 Pod 网络和策略
kubeProxyReplacement: "false"

ipam:
  mode: cluster-pool
  operator:
    clusterPoolIPv4PodCIDRList: ["172.24.0.0/13"]   # 与 kube_pods_subnet 一致
    clusterPoolIPv4MaskSize: 24                     # 与 kube_network_node_prefix 一致

cni:
  chainingMode: portmap   # 配合 kube-proxy 支持 hostPort
  exclusive: false        # 允许共存其他 CNI（如 Multus、Spiderpool 做 RDMA 网卡）

bpf:
  enableTCX: false        # 规避 TCX 程序残留的问题，见下文

operator:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-role.kubernetes.io/control-plane
                operator: Exists
```

装好后节点应在一两分钟内变成 `Ready`：

```bash
kubectl -n kube-system rollout status ds/cilium
kubectl get nodes
cilium status          # 需要单独安装 cilium CLI
```

几个参数背后都有坑：

**`k8sServiceHost: 127.0.0.1`**：Cilium 启动时 ClusterIP 还不能用（Service 转发还没就绪），所以必须直接告诉它 apiserver 的真实地址。填某台 master 的 IP 会引入单点；填 `auto` 同样会解析成单个 master 地址。Kubespray 已经在每个节点上放了一个 `127.0.0.1:6443` 的 nginx 代理，转发到所有 apiserver，用它最稳。

**`ipam.mode: cluster-pool`**：由 cilium-operator 从列表里给每个节点切一个 `/24`。Pod 网段用完时，**只能在列表末尾追加新网段**，然后重启 operator：

```bash
kubectl -n kube-system rollout restart deployment/cilium-operator
```

**`kubeProxyReplacement`**：Cilium 可以完全替代 kube-proxy，性能更好，也能绕开 IPVS 废弃的问题。但替代后 Service 相关的行为全部由 Cilium 负责，排障方式也要跟着变。团队目前保守地保留 kube-proxy，新集群可以评估开启。

> [!WARNING] 升级 Cilium 前检查这几件事
> - **路由表冲突**：Cilium 会占用编号为 200、202、2004、2005 的策略路由表。如果宿主机的网络配置（例如多网卡的策略路由）已经用了这些编号，会出现诡异的丢包。部署前用 `ip rule` 和 `ip route show table all` 检查。
> - **TCX 残留**：在较新的内核上 Cilium 默认用 TCX 挂载 BPF 程序。团队遇到过卸载/重装后旧的 TCX 程序没被清理、导致流量异常的问题（上游 issue cilium#44194），所以暂时关闭 `enableTCX`。上游修复后可以恢复默认。
> - 一次只跨一个小版本，先看 Upgrade Notes。

## MetalLB：给 LoadBalancer Service 分配 IP

在云上，`type: LoadBalancer` 的 Service 会自动得到一个云负载均衡器。裸金属上没有这个东西，Service 会永远卡在 `<pending>`。MetalLB 补的就是这一块：从你预留的地址池里分配 IP，并向网络宣告这个 IP 在哪台节点上。

它有两种宣告模式：

| 模式 | 原理 | 优点 | 局限 |
| --- | --- | --- | --- |
| L2 | 选一个节点用 ARP 回应"这个 IP 在我这" | 不需要网络设备配合 | 单个 IP 的流量都进同一个节点，只有故障切换，没有负载均衡 |
| BGP | 各节点和交换机建立 BGP 会话宣告路由 | 真正的多节点 ECMP 负载均衡 | 需要网络团队配合配置交换机 |

团队用 L2 模式，入口流量不大时足够用。

```yaml title="network/metallb/values.yml"
controller:
  affinity: &cp-affinity
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-role.kubernetes.io/control-plane
                operator: Exists
  tolerations: &cp-tolerations
    - operator: Exists
speaker:
  affinity: *cp-affinity
  tolerations: *cp-tolerations
  ignoreExcludeLB: true   # 控制平面节点默认带"排除外部 LB"的标签，这里忽略它
```

speaker 只放在控制平面节点上，是为了让入口流量固定落在少数几台稳定的机器上，也方便网络团队做 ACL。

```yaml title="network/metallb/ipaddresspool.yaml"
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default
  namespace: metallb-system
spec:
  addresses:
    - 192.168.10.200-192.168.10.210   # 向网管申请、不在 DHCP 范围内的地址
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
spec:
  ipAddressPools: ["default"]
```

需要固定 IP 的服务（例如 Gateway，DNS 泛解析要指向它），用注解指定：

```yaml
metadata:
  annotations:
    metallb.io/loadBalancerIPs: 192.168.10.210
```

> [!WARNING] 控制平面节点的排除标签
> kubeadm 会给控制平面节点打上 `node.kubernetes.io/exclude-from-external-load-balancers` 标签，MetalLB 默认不会在这些节点上宣告 IP。如果 speaker 只跑在控制平面上又没设置 `ignoreExcludeLB: true`，Service 能拿到 IP，但 ARP 没人回应，表现为"IP 分配了却 ping 不通"。

### 排查 L2 不通

```bash
# 1. 这个 IP 当前由哪个节点宣告
kubectl -n metallb-system get servicel2statuses.metallb.io

# 2. speaker 日志里有没有宣告记录
kubectl -n metallb-system logs -l app.kubernetes.io/component=speaker | grep serviceAnnounced

# 3. 在同网段的另一台机器上看 ARP 是否有回应，MAC 是否是宣告节点的
arping -I eth0 192.168.10.210

# 4. 在宣告节点上抓 ARP 包
tcpdump -ni eth0 arp and host 192.168.10.210
```

> [!PROD] externalTrafficPolicy: Local
> 默认的 `Cluster` 策略下，流量进入宣告节点后可能再被转发到其他节点的 Pod，客户端源 IP 会被 SNAT 掉。设成 `Local` 可以保留客户端 IP（网关做访问日志、限流时需要），但 L2 模式下只有运行着后端 Pod 的节点才会宣告，所以必须保证 speaker 所在节点上有后端副本，否则服务直接不可达。

## cert-manager：自动化证书

cert-manager 以 CRD 的方式管理证书：你声明一个 `Certificate`（或者在 Ingress/Gateway 上加注解），它向 `Issuer`/`ClusterIssuer` 申请证书，存进 Secret，并在过期前自动续期。

```yaml title="network/cert-manager/values.yml"
crds:
  enabled: true          # 让 Chart 安装 CRD
replicaCount: 2
podDisruptionBudget:
  enabled: true
webhook:
  replicaCount: 2
  podDisruptionBudget:
    enabled: true
cainjector:
  replicaCount: 2
  podDisruptionBudget:
    enabled: true
```

webhook 默认只有 1 个副本。它挂掉时，所有 cert-manager CR 的创建和修改都会被 apiserver 拒绝，所以生产上要 2 副本加 PDB。

### 生产：Let's Encrypt ACME

```yaml title="network/cert-manager/clusterissuer.yaml"
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          gatewayHTTPRoute:    # 需在 values 中设置 config.enableGatewayAPI: true；用 Ingress 时改为 ingress.ingressClassName
            parentRefs:
              - name: main-gateway
                namespace: istio-system
                kind: Gateway
```

HTTP-01 验证要求 Let's Encrypt 能从公网访问 `http://<域名>/.well-known/acme-challenge/...`，所以域名必须解析到公网可达的入口。内网域名或者需要通配证书（`*.dev1.bj1.example.com`）时，要改用 DNS-01，由 cert-manager 调用 DNS 服务商的 API 写 TXT 记录。

签发卡住时顺着资源链往下查：

```bash
kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe challenge -n <ns> <name>    # 通常能看到具体的失败原因
```

> [!WARNING] 先用 staging 环境调试
> Let's Encrypt 生产环境有严格的速率限制（同一域名每周的证书数量等），反复失败会被临时封禁。调试时把 `server` 换成 `https://acme-staging-v02.api.letsencrypt.org/directory`，流程跑通后再切到生产。

### 内网：自建 CA

纯内网服务用不了 ACME，可以让 cert-manager 当一个私有 CA：先用 `SelfSigned` 签一张根证书，再用它创建 `CA` 类型的 Issuer。下面的练习就在 kind 里完整走一遍。

## 入口：从 Ingress 到 Gateway API

有了 LoadBalancer IP 和证书，还差一个七层入口把域名路由到各个服务。团队过去用 ingress-nginx，配合一个 LoadBalancer IP 和一条 `*.dev1.bj1.example.com` 泛解析，新服务只要写一个 Ingress 就能上线。

> [!WARNING] ingress-nginx 已归档
> Kubernetes 社区的 ingress-nginx 项目已于 2026 年 3 月停止维护并归档，不再发布安全修复，Kubespray v2.31 也移除了对应插件。存量集群应该规划迁移，新集群不要再用。

替代方案是 **Gateway API**，它是 Ingress 的官方后继者，把"基础设施负责的 Gateway"和"应用团队负责的 HTTPRoute"拆成两种资源。团队在不同集群用过两个实现：

| 实现 | 特点 | 适合 |
| --- | --- | --- |
| Istio（Sidecar 模式） | 同时提供服务网格能力：mTLS、流量治理 | 需要网格的集群 |
| kgateway（原 Gloo） | 基于 Envoy 的轻量网关，只做南北向 | 只需要入口的集群 |

用 Istio 时，一个共享 Gateway 加上按命名空间授权的写法：

```yaml title="gateway.yaml"
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: istio-system
  annotations:
    metallb.io/loadBalancerIPs: 192.168.10.210
spec:
  gatewayClassName: istio
  listeners:
    - name: https
      hostname: "*.dev1.bj1.example.com"
      port: 443
      protocol: HTTPS
      tls:
        certificateRefs:
          - name: wildcard-dev1-tls
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              gateway-access: "true"   # 只有打了这个标签的命名空间能挂路由
```

```yaml title="httproute.yaml"
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: grafana
  namespace: monitoring
spec:
  parentRefs:
    - name: main-gateway
      namespace: istio-system
  hostnames: ["gf.dev1.bj1.example.com"]
  rules:
    - backendRefs:
        - name: grafana
          port: 80
```

Istio 的 Ambient 模式不需要 Sidecar，资源开销更小。但团队有集群用 Spiderpool 给 Pod 挂 RDMA 网卡，它和 Ambient 不兼容，所以统一选了 Sidecar 模式。选型前要先确认你的 CNI 组合是否受支持。Gateway API 的概念见 [Ingress 与 Gateway API](/learn/ingress-gateway)。

## 顺带一提：按域名限制出站

Cilium 除了标准 NetworkPolicy，还支持按 FQDN 控制出站流量，这是原生 NetworkPolicy 做不到的。比如只允许某个命名空间访问 GitHub：

```yaml title="cnp-fqdn.yaml"
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-github-only
  namespace: ci
spec:
  endpointSelector: {}
  egress:
    - toFQDNs:
        - matchName: github.com
        - matchPattern: "*.githubusercontent.com"
    # 必须放行 DNS，并让 Cilium 代理 DNS 查询，才能学到域名对应的 IP
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports: [{ port: "53", protocol: ANY }]
          rules:
            dns: [{ matchPattern: "*" }]
    # 开了 nodelocaldns 时，DNS 实际发往本机
    - toEntities: ["host"]
      toPorts:
        - ports: [{ port: "53", protocol: ANY }]
          rules:
            dns: [{ matchPattern: "*" }]
```

漏掉最后一段是常见错误：开启 nodelocaldns 后 Pod 的 DNS 请求发往节点本地地址，只放行 kube-dns 会导致解析全部超时。更多策略写法见 [安全](/learn/security)。

## 动手练习

1. **kind 里跑 MetalLB L2**。创建 kind 集群后查出 kind 网络的网段，从中划一段作为地址池：

   ```bash
   docker network inspect kind -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
   # 假设输出 172.18.0.0/16，就用 172.18.255.200-172.18.255.250
   helm repo add metallb https://metallb.github.io/metallb
   helm install metallb metallb/metallb -n metallb-system --create-namespace --wait
   ```

   仿照本文写 `IPAddressPool` 和 `L2Advertisement` 并 apply，然后 `kubectl create deploy web --image=nginx && kubectl expose deploy web --port=80 --type=LoadBalancer`，确认 `EXTERNAL-IP` 分配成功。Linux 上可以直接 `curl` 这个 IP；macOS 上宿主机访问不到 kind 网络，用 `docker run --rm --network kind curlimages/curl <IP>` 验证。
2. 在第 1 题基础上给 Service 加 `metallb.io/loadBalancerIPs` 注解指定一个固定 IP，再用 `kubectl -n metallb-system get servicel2statuses.metallb.io` 查看是哪个节点在宣告。
3. **kind 里跑自签 CA**。安装 cert-manager（`helm install cert-manager oci://quay.io/jetstack/charts/cert-manager -n cert-manager --create-namespace --set crds.enabled=true`），然后依次创建：`SelfSigned` 类型的 ClusterIssuer；一张 `isCA: true` 的根证书 Certificate（放在 cert-manager 命名空间）；引用该根证书 Secret 的 `CA` 类型 ClusterIssuer；最后用这个 CA Issuer 为 `demo.example.com` 签一张证书。用 `kubectl get secret <name> -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -issuer -dates` 检查签发者和有效期。
4. 把第 3 题中 Certificate 的 `duration` 设成 `1h`、`renewBefore` 设成 `55m`，观察几分钟后 `kubectl get certificate` 中的 `REVISION` 是否增加，理解自动续期。
5. 思考题：你的集群需要给内网 50 个服务提供 HTTPS，它们都在 `*.dev1.bj1.example.com` 下。用 HTTP-01 还是 DNS-01？一张通配证书还是 50 张证书？各有什么取舍？

## 自测

<details>
<summary>为什么 Cilium 的 k8sServiceHost 要填 127.0.0.1？</summary>

Cilium 启动时 Service 转发还没就绪，不能通过 ClusterIP 访问 apiserver，必须给它一个真实地址。填某台 master IP 或 `auto` 都会形成单点；Kubespray 在每个节点上部署了监听 `127.0.0.1:6443` 的 nginx 代理，转发到所有 apiserver，天然高可用。

</details>

<details>
<summary>MetalLB 分配了 IP，但从外面 ping 不通，可能是什么原因？</summary>

常见原因：speaker 所在节点带有 `exclude-from-external-load-balancers` 标签且没设 `ignoreExcludeLB`；地址池不在节点所在的二层网段；`externalTrafficPolicy: Local` 但宣告节点上没有后端 Pod；IP 和其他设备冲突。用 `servicel2statuses`、speaker 日志、`arping` 和 `tcpdump` 逐层确认。

</details>

<details>
<summary>MetalLB L2 模式能做负载均衡吗？</summary>

不能。L2 模式下一个 IP 同一时刻只由一个节点通过 ARP 响应，所有流量都进这个节点，MetalLB 只提供故障切换。需要多节点分担流量要用 BGP 模式配合交换机 ECMP，或者在前面再放一层硬件负载均衡。

</details>

<details>
<summary>什么时候必须用 DNS-01 而不是 HTTP-01？</summary>

申请通配证书时，或者域名只在内网解析、Let's Encrypt 无法从公网访问时。DNS-01 通过在 DNS 上写 TXT 记录来证明域名所有权，不需要入口对公网开放，但需要 cert-manager 有 DNS 服务商的 API 权限。

</details>

<details>
<summary>新集群的七层入口为什么不再选 ingress-nginx？</summary>

社区版 ingress-nginx 已经归档，不再有安全修复，Kubespray 也移除了对应插件。Gateway API 是 Ingress 的官方后继者，角色划分更清晰（Gateway 归平台、HTTPRoute 归应用），Istio、kgateway、Cilium 等都有实现。

</details>

## 参考资料

- [Kubernetes 官方文档：网络插件](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [Kubernetes 官方文档：Gateway API](https://kubernetes.io/zh-cn/docs/concepts/services-networking/gateway/)
- [Kubernetes 官方文档：Service 的 LoadBalancer 类型](https://kubernetes.io/zh-cn/docs/concepts/services-networking/service/#loadbalancer)
- [Cilium 官方文档](https://docs.cilium.io/en/stable/)
- [Cilium：DNS 策略与 toFQDNs](https://docs.cilium.io/en/stable/security/dns/)
- [MetalLB 官方文档](https://metallb.universe.tf/)
- [MetalLB：问题排查](https://metallb.universe.tf/troubleshooting/)
- [cert-manager 官方文档](https://cert-manager.io/docs/)
- [cert-manager：CA Issuer](https://cert-manager.io/docs/configuration/ca/)
- [Let's Encrypt：速率限制](https://letsencrypt.org/docs/rate-limits/)
- [Gateway API 官方站点](https://gateway-api.sigs.k8s.io/)
- [Istio：Gateway API](https://istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/)
- [kgateway 官方文档](https://kgateway.dev/docs/)
- [helmwave 官方文档](https://docs.helmwave.app/)
