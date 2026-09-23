# 工作负载安全加固

上一课用 RBAC 管住了"谁能对 API 做什么"。但攻击者往往不是从 API 进来的，而是从你的应用进来的：一个有漏洞的 Web 服务被拿到了 shell，接下来他能做什么，取决于这个容器以什么用户运行、能不能写文件系统、有哪些 Linux 能力（capabilities）、能访问哪些网络。默认配置下，这些答案通常都是"太多了"。

这一课从单个 Pod 到整个集群逐层加固：用 securityContext 收紧容器权限，用 Pod Security Admission 在命名空间级别强制执行标准，用 NetworkPolicy 和 CiliumNetworkPolicy 限制东西向和出口流量，再简要介绍镜像供应链安全、Secret 静态加密，以及用 ValidatingAdmissionPolicy 写自定义准入规则。

## securityContext：收紧容器权限

回忆 [容器基础](/learn/containers)：容器只是被 Namespace 和 cgroup 隔离的普通进程，和宿主机共享内核。容器内的 root 默认就是宿主机上 UID 0，只是被削减了部分能力。一旦出现内核漏洞或错误挂载，容器 root 离宿主机 root 只有一步之遥。

securityContext 可以写在 Pod 级（对所有容器生效）和容器级（覆盖 Pod 级）。一个加固良好的 Deployment 长这样：

```yaml title="hardened-web.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hardened-web
spec:
  replicas: 1
  selector:
    matchLabels: { app: hardened-web }
  template:
    metadata:
      labels: { app: hardened-web }
    spec:
      automountServiceAccountToken: false   # 不访问 API 就不挂 Token
      securityContext:                      # Pod 级
        runAsNonRoot: true
        runAsUser: 101
        runAsGroup: 101
        fsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: nginx
          image: nginxinc/nginx-unprivileged:1.27-alpine   # 监听 8080，以非 root 运行
          ports:
            - containerPort: 8080
          securityContext:                  # 容器级
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - { name: tmp, mountPath: /tmp }   # nginx 需要写缓存和 pid
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 128Mi }
      volumes:
        - name: tmp
          emptyDir: {}
```

逐项解释：

| 字段 | 作用 | 常见坑 |
|---|---|---|
| `runAsNonRoot: true` | kubelet 启动前检查，镜像用户是 UID 0 就拒绝启动 | 镜像用 `USER nginx` 这种用户名而非数字时 kubelet 无法校验，需同时写 `runAsUser` |
| `runAsUser` / `runAsGroup` | 指定进程 UID/GID | 应用要写的目录权限要匹配 |
| `fsGroup` | 挂载卷的属组改为该 GID，便于非 root 写卷 | 大卷递归改属组很慢，可设 `fsGroupChangePolicy: OnRootMismatch` |
| `allowPrivilegeEscalation: false` | 设置 `no_new_privs`，setuid 程序无法提权 | — |
| `readOnlyRootFilesystem: true` | 根文件系统只读，攻击者无法落地工具或篡改程序 | 需要写的目录用 `emptyDir` 挂载 |
| `capabilities.drop: [ALL]` | 去掉所有 Linux 能力 | 绑定 1024 以下端口需要 `add: [NET_BIND_SERVICE]` |
| `seccompProfile: RuntimeDefault` | 用运行时默认的 seccomp 配置过滤危险系统调用 | 极少数程序需要 `Localhost` 自定义配置 |
| `privileged: true` | 几乎等同于宿主机 root | 只给确实需要的系统组件（CNI、CSI、GPU 驱动） |

验证：

```bash
kubectl apply -f hardened-web.yaml
kubectl exec deploy/hardened-web -- id
# uid=101(nginx) gid=101(nginx) groups=101(nginx)
kubectl exec deploy/hardened-web -- touch /etc/hack
# touch: /etc/hack: Read-only file system
kubectl exec deploy/hardened-web -- grep -E 'CapEff|Seccomp|NoNewPrivs' /proc/1/status
# NoNewPrivs: 1   Seccomp: 2   CapEff: 0000000000000000
```

## Pod Security Standards 与 Pod Security Admission

一个个 Pod 去检查 securityContext 不现实。Kubernetes 定义了三级 **Pod 安全标准（Pod Security Standards, PSS）**：

| 级别 | 含义 | 适用 |
|---|---|---|
| `privileged` | 不做任何限制 | 系统组件命名空间（kube-system、CNI、存储、GPU） |
| `baseline` | 禁止已知的提权方式：特权容器、hostNetwork/hostPID、hostPath、危险 capabilities 等 | 大部分普通应用的底线 |
| `restricted` | 在 baseline 之上要求非 root、禁止提权、drop ALL、seccomp | 安全要求高的业务，推荐目标 |

内置的 **Pod Security Admission（PSA）** 准入控制器执行这些标准，配置方式是给命名空间打标签，每个标签有三种模式：

- `enforce`：违规的 Pod 被拒绝创建。
- `audit`：允许，但在审计日志里记录。
- `warn`：允许，但给 kubectl 用户返回警告。

```bash
kubectl create namespace secure-apps
kubectl label namespace secure-apps \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=latest \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted
```

试着在里面跑一个普通 nginx：

```bash
kubectl run bad --image=nginx:1.27 -n secure-apps
# Error from server (Forbidden): pods "bad" is forbidden: violates PodSecurity "restricted:latest":
# allowPrivilegeEscalation != false (container "bad" must set securityContext.allowPrivilegeEscalation=false),
# unrestricted capabilities (container "bad" must set securityContext.capabilities.drop=["ALL"]),
# runAsNonRoot != true (pod or container "bad" must set securityContext.runAsNonRoot=true),
# seccompProfile (pod or container "bad" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
kubectl apply -f hardened-web.yaml -n secure-apps    # 通过
```

> [!TIP] 平滑上线 PSA
> 注意 `enforce` 只拦截 Pod 本身，Deployment 仍会创建成功，只是 ReplicaSet 建不出 Pod（在 `kubectl describe rs` 的事件里才看得到）。所以先只加 `warn` 和 `audit` 标签，观察一段时间；或者用服务端 dry-run 预演：
>
> ```bash
> kubectl label --dry-run=server --overwrite ns team-a pod-security.kubernetes.io/enforce=restricted
> ```
>
> 输出会列出该命名空间内所有现存的违规 Pod。清理完再打开 `enforce`。

## NetworkPolicy：默认拒绝，按需放行

默认情况下，集群内任何 Pod 都能访问任何 Pod。**NetworkPolicy** 让你像防火墙一样声明允许的流量。要点：

- NetworkPolicy 由 CNI 实现。kind 默认的 kindnet 从 v0.24 起支持基础 NetworkPolicy；Flannel 不支持；Cilium、Calico 支持。没有实现时策略静默无效。
- 一旦 Pod 被任何一条策略选中某个方向（Ingress/Egress），该方向就变成"默认拒绝 + 白名单"。
- 策略之间是并集，只有允许，没有拒绝。

推荐的模式是：每个命名空间先放一条默认拒绝，再逐条放行。

```yaml title="netpol-demo.yaml"
# 1. 默认拒绝 team-a 中所有 Pod 的入站和出站
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: team-a
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
---
# 2. 放行所有 Pod 访问集群 DNS，否则连域名都解析不了
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: team-a
spec:
  podSelector: {}
  policyTypes: ["Egress"]
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
          podSelector:
            matchLabels: { k8s-app: kube-dns }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
---
# 3. 只允许 app=frontend 的 Pod 访问 app=api 的 8080 端口
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-frontend
  namespace: team-a
spec:
  podSelector:
    matchLabels: { app: api }
  policyTypes: ["Ingress"]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: frontend }
      ports:
        - { protocol: TCP, port: 8080 }
---
# 4. frontend 的出站需要单独放行到 api
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-egress-api
  namespace: team-a
spec:
  podSelector:
    matchLabels: { app: frontend }
  policyTypes: ["Egress"]
  egress:
    - to:
        - podSelector:
            matchLabels: { app: api }
      ports:
        - { protocol: TCP, port: 8080 }
```

> [!WARNING] namespaceSelector 与 podSelector 的"与"和"或"
> 在同一个 `- to:` 列表项里同时写 `namespaceSelector` 和 `podSelector`（如上面第 2 条）表示"**且**"：kube-system 命名空间中的 kube-dns Pod。如果写成两个列表项（各自前面有 `-`），则是"**或**"：kube-system 中的所有 Pod，或者本命名空间中的 kube-dns Pod。一个短横线之差，含义完全不同。

用 NodeLocal DNSCache 的集群，DNS 请求发往节点本地地址，还需要额外放行到该地址（用 `ipBlock`）。

## CiliumNetworkPolicy：按域名限制出口

标准 NetworkPolicy 只能按 IP 段（`ipBlock`）限制出口。但外部服务的 IP 经常变化（CDN、云服务），按 IP 写白名单几乎不可维护。Cilium 的 `toFQDNs` 可以按域名放行：它代理 Pod 的 DNS 查询，记录"这个域名解析出了哪些 IP"，并动态放行这些 IP。

下面的策略让 `app=net-tools` 的 Pod 只能访问一个软件镜像站和 `*.example.com`：

```yaml title="fqdn-egress.yaml"
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: fqdn-egress
spec:
  endpointSelector:
    matchLabels:
      app: net-tools
  egress:
    # 允许访问的域名
    - toFQDNs:
        - matchName: mirrors.tuna.tsinghua.edu.cn
        - matchPattern: "*.example.com"
    # 允许访问集群 DNS，并让 Cilium 的 DNS 代理检查所有查询
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s:k8s-app: kube-dns
      toPorts:
        - ports:
            - { port: "53", protocol: ANY }
          rules:
            dns:
              - matchPattern: "*"
    # 使用 NodeLocal DNSCache 时，DNS 请求发往宿主机，也要放行
    - toEntities:
        - host
      toPorts:
        - ports:
            - { port: "53", protocol: ANY }
          rules:
            dns:
              - matchPattern: "*"
```

```bash
kubectl apply -f fqdn-egress.yaml
kubectl run net-tools --image=nicolaka/netshoot --labels=app=net-tools -- sleep infinity
kubectl exec net-tools -- curl -sI --max-time 5 https://mirrors.tuna.tsinghua.edu.cn   # 200
kubectl exec net-tools -- curl -sI --max-time 5 https://www.github.com                # 超时
```

关键在于 DNS 规则里的 `rules.dns`：**必须让 DNS 流量经过 Cilium 的 DNS 代理**，它才能学到域名与 IP 的映射。只放行 53 端口而不写 `rules.dns`，toFQDNs 就永远匹配不上。这个实验需要一个安装了 Cilium 的集群，可以使用 [网络模型与 CNI](/learn/networking-model) 中创建的 kind 集群。

> [!PROD] 出口管控的生产经验
> - 需要访问外部 API 的工作负载（例如在线推理服务调用第三方模型 API、CI 拉依赖）很适合用 toFQDNs 做白名单，防止被入侵后向任意地址外传数据。
> - `matchPattern: "*.example.com"` 不匹配 `example.com` 本身，需要的话两者都写。
> - 注意 Pod 内应用的 DNS 缓存：若应用在策略生效前已缓存 IP，而 Cilium 未见过这次查询，流量会被拒绝，重启 Pod 即可。

## 镜像与供应链安全

容器里跑的是镜像，镜像来源不可信，前面所有加固都打折扣。常见措施：

- **固定版本，最好用摘要**：`image: nginx@sha256:...` 而不是 `nginx:latest`，保证部署的内容不可被替换。
- **最小化基础镜像**：distroless、alpine、scratch，攻击面和漏洞数量都少得多，也没有 shell 供攻击者使用。
- **漏洞扫描**：在 CI 中用 [Trivy](https://trivy.dev/) 等工具扫描镜像，高危漏洞阻断发布；镜像仓库（如 Harbor）也可以在推送时扫描。
- **签名与验证**：用 [Sigstore cosign](https://docs.sigstore.dev/) 给镜像签名，在集群准入阶段用 Kyverno 或 Sigstore policy-controller 验证签名，只允许运行来自可信流水线的镜像。
- **只允许私有仓库**：用准入策略限制镜像必须来自公司内部仓库（下文 ValidatingAdmissionPolicy 的例子）。仓库建设见 [镜像仓库与镜像分发](/learn/registry)。

## Secret 静态加密

[ConfigMap 与 Secret](/learn/configmaps-secrets) 一课提到 Secret 只是 base64 编码。默认情况下它以明文存储在 etcd 中，拿到 etcd 数据或备份文件的人就能读出所有 Secret。apiserver 支持 **静态加密（Encryption at Rest）**：

```yaml title="encryption-config.yaml"
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: ["secrets"]
    providers:
      - kms:                         # 推荐：外部 KMS（v2），密钥不落在控制平面节点上
          apiVersion: v2
          name: my-kms
          endpoint: unix:///var/run/kms-plugin.sock
      - aescbc:                      # 或者本地密钥（密钥文件仍在控制平面节点上）
          keys:
            - name: key1
              secret: <32 字节随机数的 base64>
      - identity: {}                 # 放最后，用于读取尚未加密的旧数据
```

通过 apiserver 的 `--encryption-provider-config` 参数启用后，新写入的 Secret 会被加密；已存在的 Secret 需要执行 `kubectl get secrets -A -o json | kubectl replace -f -` 重写一遍。可以用 `etcdctl get /registry/secrets/<ns>/<name>` 验证，加密后的数据以 `k8s:enc:` 前缀开头。Kubespray 等部署工具通常提供一个开关直接开启。

## ValidatingAdmissionPolicy：用 CEL 写准入规则

PSA 只覆盖 Pod 安全字段。如果要实现"镜像只能来自内部仓库""Deployment 必须带 owner 标签""副本数不能超过 10"这类规则，过去需要部署一个准入 Webhook（或 Kyverno、OPA Gatekeeper）。从 v1.30 起 GA 的 **ValidatingAdmissionPolicy** 让你直接用 CEL 表达式在 apiserver 内完成校验，无需额外服务：

```yaml title="vap-image-registry.yaml"
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: trusted-registry
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments", "statefulsets", "daemonsets"]
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          c.image.startsWith('registry.example.com/'))
      messageExpression: >-
        'all images must come from registry.example.com, got: ' +
        object.spec.template.spec.containers.map(c, c.image).join(', ')
    - expression: "has(object.metadata.labels) && 'owner' in object.metadata.labels"
      message: "label 'owner' is required"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: trusted-registry-binding
spec:
  policyName: trusted-registry
  validationActions: ["Deny"]      # 可先用 ["Warn", "Audit"] 灰度
  matchResources:
    namespaceSelector:
      matchLabels:
        policy.example.com/trusted-registry: "enabled"
```

```bash
kubectl apply -f vap-image-registry.yaml
kubectl label ns team-a policy.example.com/trusted-registry=enabled
kubectl create deployment evil --image=docker.io/library/nginx:1.27 -n team-a
# error: failed to create deployment: deployments.apps "evil" is forbidden:
# ValidatingAdmissionPolicy 'trusted-registry' with binding 'trusted-registry-binding' denied request:
# all images must come from registry.example.com, got: docker.io/library/nginx:1.27
```

Policy（规则是什么）与 Binding（对谁生效、违规怎么处理）分离，同一个策略可以用不同的 Binding 在测试命名空间只告警、在生产命名空间直接拒绝。需要修改对象（例如自动注入默认值）时，可以关注 MutatingAdmissionPolicy，它在较新版本中也已进入稳定阶段，请以你所用版本的文档为准。

## 动手练习

1. 部署本课的 `hardened-web`，然后逐个删除 securityContext 中的字段，用 `grep Cap /proc/1/status` 和 `id` 观察变化。
2. 创建一个打了 `enforce=restricted` 标签的命名空间，尝试部署一个普通 `nginx:1.27` 的 Deployment，找出 Pod 没有被创建的原因在哪里能看到。
3. 在 `team-a` 部署 frontend、api 两个 Deployment 和本课的四条 NetworkPolicy，验证 frontend 能访问 api，而随手 `kubectl run` 的测试 Pod 不能。再删掉 `allow-dns`，观察现象。
4. 在 Cilium 集群中应用 `fqdn-egress.yaml`，把 `rules.dns` 那部分删掉再测试一次，解释为什么放行的域名也访问不通了。
5. 部署本课的 ValidatingAdmissionPolicy，把 `validationActions` 改成 `["Warn"]`，观察 kubectl 输出的变化。

## 自测

<details>
<summary>设置了 runAsNonRoot: true，但镜像的 Dockerfile 里写的是 USER nginx，Pod 能启动吗？</summary>

不能。kubelet 无法把用户名 `nginx` 解析为 UID 来确认它不是 0，会报错 `container has runAsNonRoot and image has non-numeric user (nginx), cannot verify user is non-root`。解决方法是在 Dockerfile 中写数字 UID，或在 securityContext 中显式设置 `runAsUser`。

</details>

<details>
<summary>给命名空间加了 enforce=restricted 标签后，已经在运行的违规 Pod 会被删除吗？</summary>

不会。PSA 是准入控制器，只在创建（和部分更新）时检查。已有 Pod 继续运行，但下次重建时会被拒绝。打标签时 kubectl 会给出现存违规 Pod 的警告，可以先用 `--dry-run=server` 预演。

</details>

<details>
<summary>只给某个 Pod 加了一条 Ingress 类型的 NetworkPolicy，它的出站流量会受影响吗？</summary>

不会。NetworkPolicy 按方向生效：只有 `policyTypes` 中包含 Egress 的策略选中了该 Pod，它的出站才变为默认拒绝。所以"默认拒绝全部"的策略要同时写 Ingress 和 Egress。

</details>

<details>
<summary>CiliumNetworkPolicy 的 toFQDNs 为什么必须配合带 dns 规则的 53 端口放行？</summary>

toFQDNs 的原理是由 Cilium 的 DNS 代理观察 Pod 的 DNS 查询和响应，把域名解析出的 IP 动态加入白名单。只有带 `rules.dns` 的规则才会让 DNS 流量经过代理；否则 Cilium 不知道域名对应哪些 IP，toFQDNs 永远匹配不到。

</details>

<details>
<summary>ValidatingAdmissionPolicy 和准入 Webhook 相比有什么优势？</summary>

它在 apiserver 进程内用 CEL 求值，不需要部署、维护和高可用一个外部 Webhook 服务，没有网络调用的延迟和 Webhook 故障导致集群无法写入的风险；策略和绑定是普通 API 对象，可以用 GitOps 管理，并支持 Warn/Audit 灰度。复杂的逻辑（需要访问外部数据等）仍需要 Webhook。

</details>

## 参考资料

- [Kubernetes 官方文档：为 Pod 或容器配置安全上下文](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/security-context/)
- [Kubernetes 官方文档：Pod 安全性标准](https://kubernetes.io/zh-cn/docs/concepts/security/pod-security-standards/)
- [Kubernetes 官方文档：Pod 安全性准入](https://kubernetes.io/zh-cn/docs/concepts/security/pod-security-admission/)
- [Kubernetes 官方文档：网络策略](https://kubernetes.io/zh-cn/docs/concepts/services-networking/network-policies/)
- [Kubernetes 官方文档：静态加密机密数据](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/encrypt-data/)
- [Kubernetes 官方文档：验证准入策略（ValidatingAdmissionPolicy）](https://kubernetes.io/zh-cn/docs/reference/access-authn-authz/validating-admission-policy/)
- [Kubernetes 官方文档：安全检查清单](https://kubernetes.io/zh-cn/docs/concepts/security/security-checklist/)
- [Cilium 文档：DNS based policies](https://docs.cilium.io/en/stable/security/dns/)
