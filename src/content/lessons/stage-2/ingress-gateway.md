# Ingress 与 Gateway API

[Service 与服务发现](/learn/services)解决了四层（TCP/UDP）的访问问题，但对外提供 Web 服务时，我们通常还需要：按域名和路径把请求分到不同服务、在入口统一做 HTTPS、按比例把一部分流量切到新版本。给每个服务都开一个 LoadBalancer 既浪费 IP 又没法做这些七层逻辑。Kubernetes 为此提供了两代 API：老牌的 **Ingress** 和新一代的 **Gateway API**。

学完这一课，你能看懂并编写 Ingress 与 IngressClass、为入口配置 TLS，理解 Gateway API 的 GatewayClass / Gateway / HTTPRoute 角色分工，在 kind 中实际跑通基于域名、路径、请求头的路由和按权重的流量切分，并知道新项目为什么应当优先选择 Gateway API。

## 七层入口的基本结构

```text
客户端 ──▶ LoadBalancer/NodePort ──▶ 入口控制器（Envoy/NGINX/Traefik…）
  app.example.com                        │ 按 Host / Path / Header 路由
                              ┌──────────┼──────────┐
                              ▼          ▼          ▼
                         Service web  Service api  Service v2
```

无论 Ingress 还是 Gateway API，Kubernetes 本身都**只定义 API，不负责转发流量**。真正处理请求的是你安装的控制器（Controller）：它监听这些 API 对象，把规则翻译成 Envoy、NGINX、HAProxy 等代理的配置。没装控制器时，创建 Ingress 或 Gateway 不会有任何效果。

## Ingress

### Ingress 资源

```yaml title="ingress-basic.yaml"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  ingressClassName: traefik          # 由哪个控制器处理
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix         # Prefix / Exact / ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

- `pathType: Prefix` 按路径段匹配：`/api` 匹配 `/api` 和 `/api/users`，但不匹配 `/apis`。`Exact` 必须完全相同。`ImplementationSpecific` 由控制器自行解释，尽量避免使用。
- 多条规则同时匹配时，最长的路径优先。
- 不写 `host` 的规则匹配所有域名。

### IngressClass

一个集群里可能同时装了多个入口控制器，IngressClass 告诉 Kubernetes 某个 Ingress 该由谁处理：

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: traefik
  annotations:
    ingressclass.kubernetes.io/is-default-class: "true"   # 未指定 ingressClassName 的 Ingress 默认用它
spec:
  controller: traefik.io/ingress-controller
```

IngressClass 通常由控制器的 Helm Chart 自动创建，你只需要在 Ingress 里写 `ingressClassName`。旧文档里的注解 `kubernetes.io/ingress.class` 已经废弃。

### 在 kind 中跑通 Ingress

我们用 Traefik 作为 Ingress 控制器（安装用到 Helm，下一课 [Helm 与 Kustomize](/learn/helm-kustomize) 会详细讲解，这里照做即可）：

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik -n traefik --create-namespace
kubectl get ingressclass           # 出现 traefik
```

部署两个后端服务：

```bash
kubectl create deployment web --image=traefik/whoami:v1.11
kubectl create deployment api --image=traefik/whoami:v1.11
kubectl expose deployment web --port=80
kubectl expose deployment api --port=80
kubectl apply -f ingress-basic.yaml
```

如果你按上一阶段启动了 cloud-provider-kind，Traefik 的 LoadBalancer Service 会拿到外部 IP；否则用端口转发访问：

```bash
kubectl -n traefik port-forward svc/traefik 8080:80 &
curl -H "Host: app.example.com" http://localhost:8080/api/users | grep Hostname   # api-xxx
curl -H "Host: app.example.com" http://localhost:8080/         | grep Hostname   # web-xxx
curl -H "Host: other.example.com" http://localhost:8080/ -o /dev/null -w "%{http_code}\n"   # 404
```

### TLS

TLS 证书以 `kubernetes.io/tls` 类型的 Secret 存放，Ingress 通过 `tls` 字段引用：

```bash
openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt -subj "/CN=app.example.com" \
  -addext "subjectAltName=DNS:app.example.com"
kubectl create secret tls app-tls --cert=tls.crt --key=tls.key
```

```yaml title="ingress-tls-patch.yaml"
spec:
  tls:
    - hosts: ["app.example.com"]
      secretName: app-tls          # 必须和 Ingress 在同一命名空间
```

```bash
kubectl patch ingress web --type merge --patch-file ingress-tls-patch.yaml
kubectl -n traefik port-forward svc/traefik 8443:443 &
curl -k --resolve app.example.com:8443:127.0.0.1 https://app.example.com:8443/ | grep Hostname
```

生产中不会手工签证书，而是用 cert-manager 自动从 Let's Encrypt 或内部 CA 签发和续期，见阶段 4 的[生产网络](/learn/production-networking)。

### Ingress 的局限

Ingress 从 2015 年设计至今，API 只覆盖了"按 Host 和 Path 转发 HTTP"这一最小公约数。其他需求——重写 URL、限流、金丝雀、超时、跨命名空间路由——全靠各控制器自己的**注解**实现，例如 `nginx.ingress.kubernetes.io/rewrite-target` 只有 ingress-nginx 认识，`traefik.ingress.kubernetes.io/router.middlewares` 只有 Traefik 认识。结果是：注解不可移植，换控制器就要重写；注解只是字符串，没有校验，拼错了静默失效；一个 Ingress 对象同时承载了基础设施配置（证书、监听端口）和应用路由，平台团队与应用团队的权限难以拆分。

> [!WARNING] ingress-nginx 已停止维护
> 社区最广泛使用的 ingress-nginx 控制器（`kubernetes/ingress-nginx`）已于 2026 年 3 月正式退役：不再发布新版本，也不再修复安全漏洞，仓库已归档为只读，Kubespray 等部署工具也已移除该组件。已有部署仍能运行，但会持续暴露在未修复的漏洞下。**新项目请优先选择 Gateway API**；如果必须继续使用 Ingress，从官方文档的[Ingress 控制器列表](https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress-controllers/)中选择仍在维护的实现，并用 [ingress2gateway](https://github.com/kubernetes-sigs/ingress2gateway) 工具规划迁移。注意 Ingress **API** 本身并未废弃，退役的只是这一个控制器。

## Gateway API

### 设计思路：按角色拆分

Gateway API 是 SIG Network 设计的新一代流量 API，以 CRD 形式发布（v1.0 起 GA，截至本文写作时最新版本为 v1.6，以官方发布为准）。它把 Ingress 一个对象干的事拆给三类角色：

```text
基础设施提供方   GatewayClass    "用哪种实现"（如 istio、envoy-gateway、cloud-provider-kind）
     │
集群运维        Gateway         "在哪监听"：端口、协议、域名、TLS 证书、允许哪些命名空间挂路由
     │  ▲ parentRefs
应用开发        HTTPRoute       "怎么路由"：匹配 Host/Path/Header，转发到哪些 Service、各占多少权重
                GRPCRoute / TLSRoute / TCPRoute / UDPRoute …
```

| 对比 | Ingress | Gateway API |
|---|---|---|
| 路由能力 | Host + Path | Host、Path、Header、Query、Method |
| 流量切分、重写、请求头修改 | 注解，各家不同 | 标准字段 |
| 协议 | HTTP/HTTPS | HTTP、gRPC、TLS、TCP、UDP |
| 跨命名空间 | 不支持 | Route 可挂到其他命名空间的 Gateway，由 Gateway 控制准入 |
| 角色分离 | 一个对象包揽 | GatewayClass / Gateway / Route 分属不同团队 |
| 状态反馈 | 很少 | 每个对象都有详细的 `status.conditions` |

### 在 kind 中实验

在 Service 一课我们用过 cloud-provider-kind 提供 LoadBalancer。它同时内置了一个 Gateway API 实现：启动后会自动安装 Gateway API 的 CRD，并注册名为 `cloud-provider-kind` 的 GatewayClass。

```bash
# Linux：以容器方式运行（macOS 可用 brew install cloud-provider-kind 后 sudo cloud-provider-kind）
# 版本号为截至本文写作时的最新版，请以项目发布页为准
docker run -d --name cloud-provider-kind --rm --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.11.1
kubectl get gatewayclass
# NAME                  CONTROLLER                           ACCEPTED
# cloud-provider-kind   kind.sigs.k8s.io/gateway-controller  True
```

### 创建 Gateway

集群运维在独立命名空间创建共享网关，并只允许带特定标签的命名空间挂载路由：

```yaml title="gateway.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: gateway-infra
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: gateway-infra
spec:
  gatewayClassName: cloud-provider-kind
  listeners:
    - name: http
      hostname: "*.example.com"
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              gateway-access: main-gateway
```

```console
$ kubectl apply -f gateway.yaml
$ kubectl get gateway -n gateway-infra
NAME           CLASS                 ADDRESS      PROGRAMMED   AGE
main-gateway   cloud-provider-kind   172.18.0.5   True         20s
```

### 部署两个版本的应用

```yaml title="echo-apps.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: demo
  labels:
    gateway-access: main-gateway      # 允许挂到 main-gateway
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo-v1
  namespace: demo
spec:
  selector:
    matchLabels: {app: echo, version: v1}
  template:
    metadata:
      labels: {app: echo, version: v1}
    spec:
      containers:
        - name: echo
          image: registry.k8s.io/gateway-api/echo-basic:v20251204-v1.4.1
          env:
            - name: POD_NAME
              valueFrom: {fieldRef: {fieldPath: metadata.name}}
---
apiVersion: v1
kind: Service
metadata:
  name: echo-v1
  namespace: demo
spec:
  selector: {app: echo, version: v1}
  ports: [{port: 3000, targetPort: 3000}]
```

把上面的 Deployment 和 Service 复制一份，把所有 `v1` 改成 `v2`，一起 apply。echo-basic 会在响应 JSON 里返回处理请求的 `pod` 名，方便分辨版本。

### HTTPRoute：路由与流量切分

```yaml title="echo-route.yaml"
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: echo
  namespace: demo
spec:
  parentRefs:
    - name: main-gateway
      namespace: gateway-infra
  hostnames: ["echo.example.com"]
  rules:
    # 规则 1：带 X-Canary: true 请求头的测试流量全部去 v2
    - matches:
        - headers:
            - name: X-Canary
              value: "true"
      backendRefs:
        - name: echo-v2
          port: 3000
    # 规则 2：其余流量 90% 去 v1，10% 去 v2
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: echo-v1
          port: 3000
          weight: 90
        - name: echo-v2
          port: 3000
          weight: 10
```

```bash
kubectl apply -f echo-route.yaml
GW=$(kubectl -n gateway-infra get gateway main-gateway -o jsonpath='{.status.addresses[0].value}')

# 统计 100 次请求落到哪个版本
for i in $(seq 100); do
  curl -s --resolve echo.example.com:80:$GW http://echo.example.com/ | grep -o '"pod": "echo-v[12]'
done | sort | uniq -c
#   90 "pod": "echo-v1
#   10 "pod": "echo-v2      （大致比例）

curl -s -H "X-Canary: true" --resolve echo.example.com:80:$GW http://echo.example.com/ | grep pod
```

> [!NOTE] macOS / Windows 用户
> Docker Desktop 的容器网络在虚拟机里，宿主机无法直接访问 Gateway 的地址。cloud-provider-kind 会为网关启动一个 Envoy 容器并把端口映射到本机：用 `docker ps` 找到名字以 `kindccm-` 开头的容器及其映射端口，改为访问 `http://localhost:<端口>` 并用 `-H "Host: echo.example.com"` 指定域名。

金丝雀发布时只需逐步调整 `weight`（90/10 → 50/50 → 0/100），不需要像 [Deployment 一课](/learn/deployments)那样靠副本数比例近似。

### 排查：看 status

Gateway API 的每个对象都会回写状态，这是它比 Ingress 好排查的地方：

```bash
kubectl -n demo get httproute echo -o yaml | yq '.status.parents[].conditions'
```

- `Accepted: False`：路由没能挂到 Gateway，常见原因是命名空间没有 `gateway-access` 标签、或 `hostnames` 与 listener 的 `*.example.com` 不匹配。
- `ResolvedRefs: False, reason: BackendNotFound`：后端 Service 名字或端口写错。
- 跨命名空间引用**后端** Service 时，还需要目标命名空间创建 `ReferenceGrant` 显式授权。

### HTTPS 监听器

TLS 配置属于 Gateway（运维职责），应用侧的 HTTPRoute 无需改动：

```yaml
listeners:
  - name: https
    hostname: "*.example.com"
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
        - name: wildcard-example-com     # 与 Gateway 同命名空间的 TLS Secret
    # allowedRoutes 同 http 监听器
```

HTTPRoute 还支持 `filters` 做请求头修改（`RequestHeaderModifier`）、URL 重写（`URLRewrite`）、重定向（`RequestRedirect`，例如 HTTP 跳 HTTPS）和请求镜像，均为标准字段，具体支持程度见各实现的一致性报告。

## 生产选型

> [!PROD] 生产中的 Gateway API
> - cloud-provider-kind 只用于学习。生产环境从 [Gateway API 实现列表](https://gateway-api.sigs.k8s.io/implementations/)中选择，常见的有 Envoy Gateway、Istio、kgateway、Cilium、Traefik、NGINX Gateway Fabric 等。团队实践中使用 Istio 和 kgateway 提供 Gateway API，POC 验证结论是 Gateway API 可以完全替代原有 Ingress 用法。
> - Gateway API 的 CRD 需要单独安装且版本要与实现匹配。团队的做法是在部署网关的编排文件里先用 Kustomize 引用官方 CRD，例如 `resources: [https://github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.5.1]`，再安装控制器，具体组织方式见下一课。
> - 裸金属集群中 Gateway 的 LoadBalancer 地址由 MetalLB 分配，建议固定 IP，避免重建后 DNS 失效；证书由 cert-manager 管理。
> - 共享网关的 `allowedRoutes` 不要用 `from: All`，用 `Selector` 或 `Same` 控制哪些团队能挂路由。

## 动手练习

1. 在 Traefik 上完成 Ingress 实验后，给 `web` Deployment 缩容到 0，观察访问 `/` 返回什么状态码。
2. 在 HTTPRoute 中增加一条规则：路径 `/v2` 前缀的请求全部去 `echo-v2`，并验证它与权重规则的优先级。
3. 把 `demo` 命名空间的 `gateway-access` 标签删掉，查看 HTTPRoute 的 status 如何变化、请求返回什么。
4. 把权重改为 0/100 完成"发布"，再改回 100/0 完成"回滚"，体会与修改 Deployment 镜像的区别。

## 自测

<details>
<summary>创建了 Ingress 对象但访问没有任何效果，最可能缺少什么？</summary>

缺少 Ingress 控制器，或者 Ingress 的 `ingressClassName` 与已安装控制器的 IngressClass 不匹配。Kubernetes 只存储 Ingress 对象，真正转发流量的是控制器。

</details>

<details>
<summary>Ingress 的 pathType: Prefix 写 /api，请求 /apis 会匹配吗？</summary>

不会。Prefix 按 `/` 分隔的路径段匹配，`/api` 只匹配 `/api` 以及 `/api/` 开头的路径。

</details>

<details>
<summary>Gateway API 中 GatewayClass、Gateway、HTTPRoute 分别由哪类角色管理？</summary>

GatewayClass 由基础设施提供方定义（选择哪种网关实现）；Gateway 由集群运维管理（监听端口、域名、证书、允许哪些命名空间挂载路由）；HTTPRoute 由应用开发者管理（具体的路由规则和后端）。

</details>

<details>
<summary>为什么说 Gateway API 的流量切分比 Ingress 更好用？</summary>

Gateway API 在 `backendRefs` 中用标准的 `weight` 字段表达权重，任何符合规范的实现都能识别，并且有状态反馈；Ingress 没有标准字段，只能依赖各控制器的私有注解，换控制器就要重写，且拼写错误不会报错。

</details>

<details>
<summary>HTTPRoute 已创建，但 status 中 Accepted 为 False，应该检查哪些地方？</summary>

检查 `parentRefs` 的名字与命名空间是否正确；Route 所在命名空间是否被 Gateway listener 的 `allowedRoutes` 允许（例如是否有所需标签）；`hostnames` 是否与 listener 的 `hostname` 相交；以及协议类型是否匹配（HTTPRoute 只能挂到 HTTP/HTTPS listener）。

</details>

## 参考资料

- [Kubernetes 官方文档：Ingress](https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress/)
- [Kubernetes 官方文档：Ingress 控制器](https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress-controllers/)
- [Kubernetes 官方文档：Gateway API](https://kubernetes.io/zh-cn/docs/concepts/services-networking/gateway/)
- [Gateway API 项目文档](https://gateway-api.sigs.k8s.io/)
- [Gateway API 文档：流量切分](https://gateway-api.sigs.k8s.io/guides/traffic-splitting/)
- [Kubernetes 博客：Ingress NGINX Retirement: What You Need to Know](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
- [Kubernetes 博客：Experimenting with Gateway API using kind](https://kubernetes.io/blog/2026/01/28/experimenting-gateway-api-with-kind/)
- [cloud-provider-kind 项目主页](https://github.com/kubernetes-sigs/cloud-provider-kind)
