# Service 与服务发现

[Deployment](/learn/deployments) 让我们有了一组会自愈、能滚动更新的 Pod。但新问题随之而来：Pod 的 IP 会随着重建而变化，副本还有好几个，客户端到底该连谁？Service 为一组 Pod 提供一个**稳定的虚拟 IP 和 DNS 名称**，并在它们之间做负载均衡。

学完这一课，你会掌握 ClusterIP、NodePort、LoadBalancer、ExternalName 和 Headless 五种 Service 的用途，理解 EndpointSlice 如何跟踪后端 Pod，会用集群 DNS 名称访问服务，并知道在 kind 里如何测试每一种。

## 为什么需要 Service

```text
客户端 ──?──▶ Pod 10.244.1.5   （明天可能变成 10.244.2.9）
          ──?──▶ Pod 10.244.2.3
          ──?──▶ Pod 10.244.1.8   （滚动更新时被删除）
```

直接连 Pod IP 有三个问题：IP 不固定；需要自己在多个副本间分流；需要知道哪些 Pod 当前是健康的。Service 把这三件事都解决了：

```text
                         ┌──────────────── Service web ────────────────┐
客户端 ──▶ web:80 ──────▶│ ClusterIP 10.96.120.15 (稳定)                │
                         │ selector: app=web                           │
                         └──────┬──────────────┬──────────────┬────────┘
                                ▼              ▼              ▼
                           Pod (Ready)    Pod (Ready)    Pod (Ready)
```

ClusterIP 是虚拟 IP，没有任何网卡真正拥有它。每个节点上的 kube-proxy 监听 Service 和 EndpointSlice 的变化，把规则写进 iptables/IPVS（或由 Cilium 等 CNI 用 eBPF 实现），把发往 ClusterIP 的流量转发到某个后端 Pod。细节在阶段 3 的[网络模型与 CNI](/learn/networking-model)里展开。

## 准备后端应用

我们用 `traefik/whoami`，它会在响应里打印处理请求的 Pod 名字，方便观察负载均衡：

```yaml title="whoami-deploy.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whoami
  template:
    metadata:
      labels:
        app: whoami
    spec:
      containers:
        - name: whoami
          image: traefik/whoami:v1.11
          ports:
            - name: http
              containerPort: 80
```

```bash
kubectl apply -f whoami-deploy.yaml
kubectl get pods -l app=whoami -o wide
```

## ClusterIP：集群内访问

`ClusterIP` 是默认类型，只能在集群内部访问。

```yaml title="whoami-svc.yaml"
apiVersion: v1
kind: Service
metadata:
  name: whoami
spec:
  type: ClusterIP
  selector:
    app: whoami           # 流量发给带这个标签且 Ready 的 Pod
  ports:
    - name: http
      port: 80            # Service 自己的端口
      targetPort: http    # Pod 的端口，可以写数字，也可以引用容器端口名
      protocol: TCP
```

```bash
kubectl apply -f whoami-svc.yaml
kubectl get svc whoami
```

```console
NAME     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
whoami   ClusterIP   10.96.120.15   <none>        80/TCP    5s
```

起一个临时 Pod 当客户端，连续请求几次：

```bash
kubectl run client --rm -it --image=busybox:1.36 --restart=Never -- \
  sh -c 'for i in 1 2 3 4 5 6; do wget -qO- http://whoami | grep Hostname; done'
```

```console
Hostname: whoami-7f9c6d8b5-kq2xz
Hostname: whoami-7f9c6d8b5-5tlm8
Hostname: whoami-7f9c6d8b5-kq2xz
Hostname: whoami-7f9c6d8b5-wr9vj
Hostname: whoami-7f9c6d8b5-5tlm8
Hostname: whoami-7f9c6d8b5-wr9vj
```

请求被分散到三个 Pod。

> [!TIP] targetPort 用端口名
> `targetPort: http` 引用的是容器里 `ports[].name`。以后容器端口改了，只需要改 Pod 模板，Service 不用动；不同版本的 Pod 甚至可以用不同端口号。

## EndpointSlice：Service 背后的地址簿

Service 控制器持续根据选择器找出**就绪**的 Pod，把它们的 IP 和端口写进 EndpointSlice 对象：

```bash
kubectl get endpointslices -l kubernetes.io/service-name=whoami
```

```console
NAME           ADDRESSTYPE   PORTS   ENDPOINTS                            AGE
whoami-8hx2c   IPv4          80      10.244.1.4,10.244.2.5,10.244.1.5   2m
```

把 Deployment 缩到 1，再看一次，端点会立即减少；未就绪的 Pod（比如就绪探针失败）也会被标记为不可用，不再接收流量。

```bash
kubectl scale deploy whoami --replicas=1
kubectl get endpointslices -l kubernetes.io/service-name=whoami
kubectl scale deploy whoami --replicas=3
```

> [!NOTE] Endpoints 与 EndpointSlice
> 早期的 `Endpoints` 对象把一个 Service 的所有后端放在一个对象里，大规模时每次变更都要传输整个列表。EndpointSlice 把后端切成多个分片（默认每片最多 100 个），自 1.21 起 GA，已取代 Endpoints 成为 kube-proxy 的数据来源；Endpoints API 在 1.33 被标记为弃用。

`kubectl describe svc whoami` 看到的 `Endpoints:` 一行是排查"Service 不通"的第一站：如果为空，通常是选择器与 Pod 标签不匹配，或者 Pod 没有就绪。

## 集群 DNS

集群里的 CoreDNS 会为每个 Service 创建 DNS 记录：

| 记录 | 格式 | 示例 |
|---|---|---|
| Service A/AAAA | `<svc>.<ns>.svc.cluster.local` | `whoami.default.svc.cluster.local` → ClusterIP |
| 命名端口 SRV | `_<port-name>._<protocol>.<svc>.<ns>.svc.cluster.local` | `_http._tcp.whoami.default.svc.cluster.local` |
| Headless 下的 Pod | `<pod-hostname>.<svc>.<ns>.svc.cluster.local` | 用于 StatefulSet，见下文 |

由于[命名空间一课](/learn/labels-namespaces)讲过的搜索域，同命名空间用 `whoami` 即可，跨命名空间用 `whoami.default`：

```bash
kubectl run dns --rm -it --image=busybox:1.36 --restart=Never -- nslookup whoami.default
```

```console
Server:    10.96.0.10
Address:   10.96.0.10:53

Name:   whoami.default.svc.cluster.local
Address: 10.96.120.15
```

> [!NOTE]
> `cluster.local` 是默认的集群域名，可以在集群安装时修改。写配置时优先用短名或 `<svc>.<ns>`，这样换集群也不用改。

## NodePort：从节点端口访问

`NodePort` 在 ClusterIP 的基础上，在**每个节点**上打开同一个端口（默认范围 30000–32767），访问 `任一节点IP:nodePort` 即可到达 Service。

```yaml title="whoami-nodeport.yaml"
apiVersion: v1
kind: Service
metadata:
  name: whoami-np
spec:
  type: NodePort
  selector:
    app: whoami
  ports:
    - port: 80
      targetPort: http
      nodePort: 30080     # 不写则自动分配
```

```bash
kubectl apply -f whoami-nodeport.yaml
kubectl get svc whoami-np
```

```console
NAME        TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
whoami-np   NodePort   10.96.44.201   <none>        80:30080/TCP   3s
```

### 在 kind 里测试

kind 的"节点"其实是 Docker 容器，它们的 IP 在 Docker 网络里。最通用的办法是进入一个节点容器去访问：

```bash
docker exec kind-control-plane curl -s localhost:30080 | grep Hostname
```

Linux 主机上还可以直接访问节点容器 IP（`kubectl get nodes -o wide` 查看 `INTERNAL-IP`）；macOS/Windows 上 Docker 运行在虚拟机里，主机访问不到这些 IP。如果想从主机浏览器直接打开，需要在创建 kind 集群时配置端口映射：

```yaml title="kind-config.yaml"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080   # 节点上的 NodePort
        hostPort: 30080        # 映射到主机端口
  - role: worker
  - role: worker
```

之后就能在主机上 `curl localhost:30080`。日常调试更简单的方式仍是 `kubectl port-forward svc/whoami 8080:80`。

## LoadBalancer：云上对外暴露

`LoadBalancer` 在 NodePort 的基础上，请求**外部负载均衡器**分配一个对外 IP。在云厂商集群里由云控制器（Cloud Controller Manager）创建云 LB；在裸金属集群里需要 MetalLB 之类的组件（阶段 4 [生产网络](/learn/production-networking)讲）。

```yaml title="whoami-lb.yaml"
apiVersion: v1
kind: Service
metadata:
  name: whoami-lb
spec:
  type: LoadBalancer
  selector:
    app: whoami
  ports:
    - port: 80
      targetPort: http
```

在没有 LB 实现的 kind 里，`EXTERNAL-IP` 会一直是 `<pending>`：

```console
NAME        TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
whoami-lb   LoadBalancer   10.96.87.33    <pending>     80:31547/TCP   10s
```

kind 官方提供了 [cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind)，在主机上运行它后，会为 LoadBalancer Service 分配 IP：

```bash
go install sigs.k8s.io/cloud-provider-kind@latest   # 也可下载发布的二进制
sudo cloud-provider-kind                            # 保持运行
kubectl get svc whoami-lb                           # EXTERNAL-IP 变为一个 172.18.x.x 地址
```

（macOS 上需要按项目 README 的说明额外处理网络访问，以其官方文档为准。）

## ExternalName：给外部服务起别名

`ExternalName` 不选择 Pod，也没有 ClusterIP，只是在 DNS 里返回一条 CNAME 记录：

```yaml title="external-db.yaml"
apiVersion: v1
kind: Service
metadata:
  name: database
spec:
  type: ExternalName
  externalName: db.example.com
```

集群内的应用统一连 `database`，外部数据库迁移或切换时只需改这一个对象。注意它是纯 DNS 层的转发：不做端口映射，HTTP Host 头和 TLS 证书校验看到的仍是 `database`，可能导致对方拒绝。

## Headless Service：直接拿到 Pod IP

把 `clusterIP` 设置为 `None`，就得到一个 Headless Service。它不分配虚拟 IP，不经过 kube-proxy，DNS 查询直接返回所有就绪 Pod 的 IP：

```yaml title="whoami-headless.yaml"
apiVersion: v1
kind: Service
metadata:
  name: whoami-headless
spec:
  clusterIP: None
  selector:
    app: whoami
  ports:
    - port: 80
      targetPort: http
```

```bash
kubectl apply -f whoami-headless.yaml
kubectl run dns --rm -it --image=busybox:1.36 --restart=Never -- nslookup whoami-headless
```

```console
Name:   whoami-headless.default.svc.cluster.local
Address: 10.244.1.4
Name:   whoami-headless.default.svc.cluster.local
Address: 10.244.2.5
Name:   whoami-headless.default.svc.cluster.local
Address: 10.244.1.5
```

适用于客户端要自己选择后端的场景：数据库集群的客户端、gRPC 客户端负载均衡，以及 StatefulSet 为每个 Pod 提供 `pod-0.svc` 这样的稳定域名（见 [StatefulSet](/learn/statefulsets)）。

## 五种类型对比

| 类型 | ClusterIP | 访问范围 | 典型用途 |
|---|---|---|---|
| `ClusterIP` | 有 | 集群内 | 服务间调用（最常用） |
| `NodePort` | 有 | 节点IP:端口 | 测试、配合外部 LB |
| `LoadBalancer` | 有 | 外部 LB IP | 云上对外暴露 TCP/UDP 服务 |
| `ExternalName` | 无 | DNS CNAME | 引用集群外服务 |
| Headless | 无（`None`） | DNS 返回 Pod IP | 有状态服务、客户端负载均衡 |

> [!PROD]
> 对外暴露 HTTP 服务时，通常不给每个服务开一个 LoadBalancer，而是用一个 Ingress / Gateway 统一入口，按域名和路径路由，见 [Ingress 与 Gateway API](/learn/ingress-gateway)。

## 会话保持：sessionAffinity

默认情况下每个连接独立选择后端。如果应用把会话存在本地内存里，可以让同一客户端 IP 的请求总是落到同一个 Pod：

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600    # 默认 10800（3 小时）
```

```bash
kubectl patch svc whoami -p '{"spec":{"sessionAffinity":"ClientIP"}}'
kubectl run client --rm -it --image=busybox:1.36 --restart=Never -- \
  sh -c 'for i in 1 2 3 4; do wget -qO- http://whoami | grep Hostname; done'
```

这次 4 次请求的 Hostname 全部相同。

> [!WARNING]
> `ClientIP` 亲和基于源 IP，经过 NAT 或代理后很多用户可能共享一个 IP，导致负载不均；Pod 重建后会话照样丢失。更好的做法是让应用无状态化，把会话放到 Redis 等外部存储里。

清理：

```bash
kubectl delete svc whoami whoami-np whoami-lb whoami-headless database --ignore-not-found
kubectl delete deploy whoami
```

## 动手练习

1. 部署 `whoami` 和 ClusterIP Service，用临时 Pod 连续请求 10 次，统计每个 Pod 各处理了多少次。
2. 故意把 Service 的 selector 改成 `app: whoam`（拼错），观察 `kubectl describe svc` 中的 Endpoints 和客户端报错，再改回来。
3. 在 kind 节点容器里用 `curl` 访问 NodePort Service；如果你使用 Linux，再从主机直接访问节点 IP。
4. 创建 Headless Service，对比它和普通 Service 的 `nslookup` 结果。
5. 在另一个命名空间里起一个客户端 Pod，分别用 `whoami`、`whoami.default`、`whoami.default.svc.cluster.local` 访问，看哪些能通。

## 自测

<details>
<summary>`port`、`targetPort`、`nodePort` 分别是什么？</summary>

`port` 是 Service 的 ClusterIP 上监听的端口；`targetPort` 是转发到 Pod 上的端口（可以是端口名）；`nodePort` 是 NodePort/LoadBalancer 类型在每个节点上开放的端口。

</details>

<details>
<summary>Service 创建了，但访问一直超时，第一步查什么？</summary>

查 `kubectl describe svc <name>` 或 EndpointSlice 是否有端点。没有端点说明选择器和 Pod 标签不匹配、或者 Pod 没有 Ready；有端点再检查 `targetPort` 是否对应容器真正监听的端口。

</details>

<details>
<summary>为什么 `ping` 一个 ClusterIP 通常不通，但 `curl` 可以？</summary>

ClusterIP 是虚拟 IP，kube-proxy 只为 Service 定义的协议和端口配置转发规则，没有网卡响应 ICMP。所以 ping 不通不代表 Service 有问题。

</details>

<details>
<summary>Headless Service 与普通 ClusterIP Service 的 DNS 结果有什么不同？</summary>

普通 Service 的 DNS 返回一个 ClusterIP，由 kube-proxy 负载均衡；Headless Service（`clusterIP: None`）的 DNS 直接返回所有就绪 Pod 的 IP，由客户端自行选择。

</details>

## 参考资料

- [Kubernetes 官方文档：服务（Service）](https://kubernetes.io/zh-cn/docs/concepts/services-networking/service/)
- [Kubernetes 官方文档：EndpointSlice](https://kubernetes.io/zh-cn/docs/concepts/services-networking/endpoint-slices/)
- [Kubernetes 官方文档：Service 与 Pod 的 DNS](https://kubernetes.io/zh-cn/docs/concepts/services-networking/dns-pod-service/)
- [Kubernetes 官方文档：虚拟 IP 和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
- [kind 文档：LoadBalancer](https://kind.sigs.k8s.io/docs/user/loadbalancer/)
