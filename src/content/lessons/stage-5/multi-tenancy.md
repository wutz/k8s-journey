# 多租户与平台工程

一个 GPU 集群往往要同时服务好几个团队：算法组要跑训练，推理组要上线服务，还有外部合作方需要临时用一批卡。每个团队都单独建一个集群，成本高、资源利用率低、运维人力翻倍；所有人挤在一个集群里用 cluster-admin，又迟早会有人误删别人的东西。多租户（Multi-tenancy）要回答的就是：**怎样让多个租户安全、公平地共享一套基础设施**。

这一课按隔离强度从弱到强介绍三种模式：命名空间租户、虚拟集群（vcluster、k3k）、托管控制平面（Kamaji），并给出团队在 GPU 集群上落地 vcluster 时总结的配置和坑。最后讲平台工程的另一半：用 GitOps 让所有租户配置可审计、可回滚。

> [!NOTE] 本课需要的环境
> 命名空间租户和 vcluster 的练习都可以在 kind 里完成（vcluster 的 Service 用默认的 ClusterIP 即可）。Kamaji 需要额外的虚拟机或物理机作为租户的工作节点，适合在有条件的实验环境里尝试。

## 隔离的三个层次

```text
隔离强度    弱 ─────────────────────────────────────────────→ 强

           命名空间租户           虚拟集群                 托管控制平面            独立集群
           Namespace + RBAC      vcluster / k3k          Kamaji                 每租户一套
           + Quota + NetPol      租户有自己的 apiserver，  租户有独立控制平面        完整集群
                                 Pod 跑在宿主集群节点上    和独立的工作节点
共享       控制平面、节点、CRD    节点、CNI、存储           管理集群（跑控制平面）     几乎不共享
```

| 模式 | 租户能做什么 | 不能做什么 | 适合 |
| --- | --- | --- | --- |
| 命名空间租户 | 在自己的命名空间里部署应用 | 装 CRD、Operator、Webhook，建集群级资源 | 同一公司内部团队、只部署应用 |
| 虚拟集群 | 拥有"自己的集群"：可以装 CRD、Helm chart，拿到 cluster-admin | 管理真实节点、改内核参数 | 需要装 Operator 的团队、开发测试环境、短期项目 |
| 托管控制平面 | 独立的控制平面 + 自己的节点 | — | 不同组织之间、需要节点级隔离的客户 |

选型的核心问题是：**租户需要集群级权限吗？租户之间互相信任吗？**

## 命名空间租户

这是 [标签、注解与命名空间](/learn/labels-namespaces)、[RBAC](/learn/rbac)、[工作负载安全加固](/learn/security) 几课内容的组合。一个租户命名空间的"标配"清单：

| 资源 | 作用 |
| --- | --- |
| Namespace（带 PSS 标签） | 边界；`pod-security.kubernetes.io/enforce: restricted` |
| RoleBinding | 把租户用户组绑定到内置的 `admin` 或 `edit` ClusterRole |
| ResourceQuota | 限制 CPU、内存、GPU、PVC、对象数量 |
| LimitRange | 给没写 requests/limits 的容器兜底默认值 |
| NetworkPolicy | 默认拒绝跨命名空间访问 |
| Kueue LocalQueue | 训练任务的排队入口（见 [批调度](/learn/batch-scheduling)） |

GPU 配额写法和普通资源不同，扩展资源只能限制 `requests.`：

```yaml title="tenant-quota.yaml"
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "64"
    requests.memory: 512Gi
    limits.memory: 512Gi
    requests.nvidia.com/gpu: "8"
    persistentvolumeclaims: "20"
```

租户多了以后，每个命名空间手写这一套很快就不可维护。社区有 Capsule、Hierarchical Namespaces 等项目把"租户"抽象成一个 CRD，自动生成上述资源；更常见的做法是把它们写成一个 Helm chart 或 Kustomize base，用 GitOps 批量下发（见本课最后一节）。

## vcluster：在命名空间里跑一个集群

vcluster 在宿主集群的一个命名空间里运行一个 StatefulSet，里面是一套完整的控制平面（apiserver、controller-manager、数据存储）和一个 **syncer**。租户用 vcluster 的 kubeconfig 连上去，看到的是一个"空集群"，可以随意建命名空间、装 CRD。

```text
租户 kubectl ──→ vcluster apiserver（在宿主 ns: vc-team-a 里）
                        │
                   syncer 把"低层资源"同步到宿主集群
                        ▼
宿主集群 ns: vc-team-a
   Pod: web-x-default-x-vcluster        ← 真正跑在宿主节点上
   Service、PVC、ConfigMap（被引用的）   ← 同步下来
   Deployment、CRD、RBAC                ← 不同步，只存在于虚拟集群里
```

高层对象（Deployment、StatefulSet、CRD、各种 Operator）只存在于虚拟集群；只有 Pod、Service、PVC 等"真正需要资源"的对象被 syncer 改名后同步到宿主命名空间。因此租户即使拿到虚拟集群的 cluster-admin，在宿主集群里也只是一个命名空间里的普通 Pod。

### 生产配置

下面是团队给 GPU 租户使用的 vcluster values 的主要部分（截至本文写作时 vcluster v0.33.1）：

```yaml title="vcluster-values.yaml"
controlPlane:
  distro:
    k8s:
      enabled: true                 # 使用标准 K8s 组件，而不是 k3s
  backingStore:
    etcd:
      deploy:
        enabled: true               # 独立 etcd，3 副本
        statefulSet:
          highAvailability:
            replicas: 3
  statefulSet:
    highAvailability:
      replicas: 2
  coredns:
    deployment:
      replicas: 2
  service:
    spec:
      type: LoadBalancer            # 由 MetalLB 分配 IP，租户直接访问
  proxy:
    extraSANs:
      - team-a.k8s.example.com

exportKubeConfig:
  context: team-a
  server: https://team-a.k8s.example.com:443

sync:
  toHost:
    pods:
      enabled: true
  fromHost:
    nodes:
      enabled: true                 # 让租户看到真实节点（及 GPU 容量）
      selector:
        labels:
          node-pool: team-a         # 只同步分给该租户的节点
    storageClasses:
      enabled: true

policies:
  resourceQuota:
    enabled: true
    quota:
      requests.cpu: 128
      requests.memory: 1Ti
      requests.nvidia.com/gpu: 16
  limitRange:
    enabled: true
    default:
      cpu: "2"
      memory: 2Gi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
  podSecurityStandard: baseline
  networkPolicy:
    enabled: true
```

```bash
helm repo add loft https://charts.loft.sh
helm upgrade --install team-a loft/vcluster \
  -n vc-team-a --create-namespace --version 0.33.1 -f vcluster-values.yaml

# 取出 kubeconfig 交给租户
kubectl get secret vc-team-a -n vc-team-a --template='{{.data.config}}' | base64 -d > team-a.kubeconfig
kubectl --kubeconfig team-a.kubeconfig get nodes
```

`policies` 里的 ResourceQuota、LimitRange、NetworkPolicy 是创建在**宿主命名空间**上的，租户在虚拟集群里改不掉，这是真正的安全边界。

### 节点池：共享还是独占

vcluster 只隔离控制平面，Pod 仍然跑在宿主节点上。团队的做法是：

- **共享节点池**：同一组织内部的多个团队，共享一批节点，靠 quota 和 Kueue 分资源；
- **独占节点池**：不同组织（例如外部合作方），给租户划一批专用节点，打上 `node-pool=<租户>` 标签和污点，vcluster 通过 `sync.fromHost.nodes.selector` 只让租户看到这些节点，并把 Pod 固定调度过去。

> [!WARNING] Cilium 下的 NetworkPolicy 坑
> 开启 `policies.networkPolicy` 后，团队在 Cilium 集群上遇到过三个问题：
>
> 1. **DNS 被拦**：允许访问 DNS 的出口规则如果同时写了 `to` 选择器，在使用 NodeLocal DNSCache 时会因为目标是节点本地地址而匹配不上。DNS 出口规则只写端口（53/UDP、53/TCP），不要限定目标。
> 2. **LoadBalancer 流量被拦**：从外部经 LoadBalancer 进入的流量，Cilium 看到的源身份可能是 `remote-node` 而不是外部 IP，`ipBlock` 规则不生效。允许 LB 入口的规则同样只写端口。
> 3. 修改策略后，用 `hubble observe --verdict DROPPED -n <宿主命名空间>` 确认到底是哪条策略丢的包（见 [生产网络](/learn/production-networking)）。

## k3k：Rancher 的虚拟集群

k3k（Kubernetes in Kubernetes）是 Rancher 推出的同类项目，每个虚拟集群是一个 `Cluster` 自定义资源，控制平面基于 K3s。它有两种模式：

| 模式 | 工作方式 | 特点 |
| --- | --- | --- |
| `shared` | 用虚拟 kubelet 把租户 Pod 调度到宿主节点上 | 和 vcluster 类似，资源利用率高 |
| `virtual` | 在宿主集群里以 Pod 形式运行完整的 K3s server 和 agent | 租户 Pod 跑在 agent Pod 里，隔离更强，开销更大 |

```yaml title="k3k-cluster.yaml"
apiVersion: k3k.io/v1beta1
kind: Cluster
metadata:
  name: team-b
  namespace: k3k-team-b
spec:
  mode: shared
  version: v1.34.1-k3s1
  servers: 3
  agents: 1
  persistence:
    type: dynamic
  tlsSANs:
    - team-b.k8s.example.com
  expose:
    ingress:
      ingressClassName: nginx
      annotations:
        nginx.ingress.kubernetes.io/ssl-passthrough: "true"
```

如果你的平台已经以 Rancher 为中心，k3k 集成度更好；否则 vcluster 的社区和文档更成熟。

## Kamaji：托管控制平面

虚拟集群的租户仍然和别人共享节点、内核和 CNI。如果租户是另一家公司，需要**自己的节点**，但你又不想为每个租户维护 3 台控制平面机器，可以用托管控制平面（Hosted Control Plane）：租户集群的 apiserver、controller-manager、scheduler 作为 Pod 跑在一个管理集群里，租户只提供工作节点。

Kamaji 就是这个思路的开源实现。每个租户集群是一个 `TenantControlPlane`：

```yaml title="tenant-control-plane.yaml"
apiVersion: kamaji.clastix.io/v1alpha1
kind: TenantControlPlane
metadata:
  name: tenant-c
  namespace: tenants
spec:
  controlPlane:
    deployment:
      replicas: 3
    service:
      serviceType: LoadBalancer
  kubernetes:
    version: v1.33.4
    kubelet:
      cgroupfs: systemd
    admissionControllers:
      - ResourceQuota
      - LimitRanger
  networkProfile:
    port: 6443
    certSANs:
      - tenant-c.k8s.example.com
    serviceCidr: 10.96.0.0/16
    podCidr: 10.244.0.0/16
    dnsServiceIPs:
      - 10.96.0.10
  addons:
    coreDNS: {}
    kubeProxy: {}
    konnectivity:
      server:
        port: 8132          # 控制平面与租户节点之间的反向隧道
```

Kamaji 依赖 cert-manager 签发证书，控制平面的数据存储在一个共享的 etcd（`kamaji-etcd`）或其他数据库里，多个租户共用一套存储集群，靠前缀隔离。部署完成后：

```bash
kubectl get tcp -n tenants        # tcp 是 TenantControlPlane 的短名
kubectl get secret tenant-c-admin-kubeconfig -n tenants \
  -o jsonpath='{.data.admin\.conf}' | base64 -d > tenant-c.kubeconfig

# 针对租户集群生成 join 命令，再到租户的机器上执行输出的 kubeadm join
kubeadm --kubeconfig=tenant-c.kubeconfig token create --print-join-command
```

工作节点加入后还有两件事：租户集群里没有 CNI，需要自行安装（例如 Cilium）；如果开启了 kubelet 的 `serverTLSBootstrap`，要审批节点的 CSR（`kubectl certificate approve`），否则 `kubectl logs/exec` 和 metrics-server 都用不了。

> [!PROD] 控制平面变成了"工作负载"
> 托管控制平面把几十个租户的 apiserver 集中到一个管理集群里，好处是升级、备份、监控都能批量做；代价是管理集群和共享 etcd 成了所有租户的单点。管理集群要按 [生产集群规划](/learn/cluster-planning) 的高可用标准建设，etcd 要独立的高性能磁盘和定期备份（见 [Day-2 运维](/learn/day2-operations)）。

## GitOps：平台配置的唯一来源

有了多租户，平台上的配置会迅速膨胀：几十个命名空间的 quota、RBAC、NetworkPolicy，十几个 vcluster 的 values，GPU Operator、Kueue、网关这些平台组件的版本。靠人手 `kubectl apply` 和 `helm upgrade`，很快就没人说得清集群现在的状态是怎么来的。

GitOps 的原则是：

1. **声明式**：系统的期望状态全部以声明式配置描述；
2. **版本化**：这些配置存在 Git 里，Git 是唯一可信来源；
3. **自动拉取**：集群里的代理持续从 Git 拉取期望状态并应用，而不是由 CI 往集群推；
4. **持续调谐**：代理不断比较实际状态和期望状态，发现漂移就纠正或告警。

这和 Kubernetes 控制器的"期望状态 + 调谐循环"是同一个思想（见 [为什么需要 Kubernetes](/learn/why-kubernetes)），只是把期望状态从 etcd 往前推到了 Git。

两个主流实现：

| | Argo CD | Flux |
| --- | --- | --- |
| 核心对象 | `Application`、`ApplicationSet` | `GitRepository`、`Kustomization`、`HelmRelease` |
| 界面 | 自带 Web UI，直观展示同步状态和资源树 | 以 CLI 和 CRD 为主，UI 需另装 |
| 多集群 | 一个 Argo CD 管多个集群 | 通常每个集群一个 Flux |
| 适合 | 需要可视化、给租户自助查看 | 偏好纯声明式、轻量 |

一个典型的平台仓库结构：

```text
platform-gitops/
├── infrastructure/              # 平台组件：gpu-operator、kueue、kgateway ...
│   ├── base/
│   └── clusters/prod/
├── tenants/
│   ├── _template/               # 租户标配：ns、quota、rbac、netpol、localqueue
│   ├── team-a/                  # kustomization 引用模板 + 覆盖配额
│   └── team-b/
└── vclusters/
    ├── team-a/values.yaml
    └── partner-x/values.yaml
```

新租户入驻变成一次 Pull Request：复制模板、改配额、评审、合并，Argo CD 或 Flux 自动创建所有资源。回收租户就是删除目录。变更历史、审批记录、回滚都由 Git 天然提供。

> [!TIP]
> Secret 不能明文进 Git。常见方案是 Sealed Secrets、SOPS 加密，或者用 External Secrets Operator 从 Vault 等外部密钥系统同步。

## 动手练习

1. 在 kind 里创建命名空间 `team-a`，按本课的"标配清单"写齐 ResourceQuota、LimitRange、RoleBinding 和一条默认拒绝的 NetworkPolicy，用 `kubectl auth can-i --as` 验证租户用户的权限边界。
2. 在 kind 里安装 vcluster（Service 用 ClusterIP，用 `vcluster connect` 访问），在虚拟集群里创建一个 Deployment，然后在宿主集群的命名空间里观察同步下来的 Pod 名称，并确认 Deployment 本身不在宿主集群里。
3. 给 vcluster 开启 `policies.resourceQuota`，在虚拟集群里用 cluster-admin 尝试删除或绕过配额，验证限制是否仍然生效。
4. 在 kind 里安装 Argo CD，把练习 1 的租户资源放进一个 Git 仓库，用一个 `Application` 同步过来；然后手动 `kubectl edit` 修改 quota，观察 Argo CD 如何报告漂移。
5. 为你的组织设计一份多租户方案：哪些租户用命名空间，哪些用虚拟集群，节点池如何划分，说明理由。

## 自测

<details>
<summary>命名空间租户和虚拟集群的根本区别是什么？</summary>

命名空间租户共享同一个控制平面，租户不能创建 CRD、Webhook 等集群级资源，也不能拥有 cluster-admin。虚拟集群给每个租户一个独立的 apiserver 和数据存储，租户可以在里面做任何集群级操作，但这些操作只影响虚拟集群；实际运行的 Pod 被同步到宿主集群的一个命名空间里，受宿主侧策略约束。

</details>

<details>
<summary>vcluster 的 syncer 会把哪些对象同步到宿主集群？为什么这样设计？</summary>

只同步 Pod、Service、PVC、被 Pod 引用的 ConfigMap/Secret 等需要真实资源的低层对象，Deployment、CRD、RBAC 等高层对象只留在虚拟集群。这样宿主集群只需要承担"运行 Pod"的职责，租户的控制器、Operator 和权限都被限制在虚拟集群内，不会污染宿主集群。

</details>

<details>
<summary>vcluster 的 ResourceQuota 为什么要通过 policies 配置，而不是让租户自己在虚拟集群里创建？</summary>

`policies` 里的配额创建在宿主集群的命名空间上，而同步下来的 Pod 实际在那里运行，所以宿主侧的配额才是真正生效的边界。租户在虚拟集群里有 cluster-admin，自己创建的 ResourceQuota 也可以自己删除，起不到限制作用。

</details>

<details>
<summary>什么情况下应该选择托管控制平面（如 Kamaji）而不是虚拟集群？</summary>

当租户之间互不信任、需要节点级隔离（独立内核、独立 CNI、独立硬件），或者租户要自带工作节点时。托管控制平面给每个租户独立的控制平面和独立节点，同时把控制平面集中托管在管理集群里，比每租户一套完整集群更省机器和运维成本。

</details>

<details>
<summary>GitOps 的"拉取模式"相比 CI 推送到集群有什么好处？</summary>

集群内的代理主动从 Git 拉取，CI 系统不需要持有集群的高权限凭据，攻击面更小；代理持续比较实际与期望状态，能发现并纠正手工修改造成的漂移；所有变更都经过 Git 的评审和记录，可以审计和回滚。

</details>

## 参考资料

- [Kubernetes 官方文档：多租户](https://kubernetes.io/zh-cn/docs/concepts/security/multi-tenancy/)
- [Kubernetes 官方文档：资源配额](https://kubernetes.io/zh-cn/docs/concepts/policy/resource-quotas/)
- [Kubernetes 官方文档：网络策略](https://kubernetes.io/zh-cn/docs/concepts/services-networking/network-policies/)
- [Kubernetes 官方文档：Pod 安全性标准](https://kubernetes.io/zh-cn/docs/concepts/security/pod-security-standards/)
- [vcluster 官方文档](https://www.vcluster.com/docs)
- [k3k 项目](https://github.com/rancher/k3k)
- [Kamaji 官方文档](https://kamaji.clastix.io/)
- [OpenGitOps 原则](https://opengitops.dev/)
- [Argo CD 官方文档](https://argo-cd.readthedocs.io/)
- [Flux 官方文档](https://fluxcd.io/flux/)
