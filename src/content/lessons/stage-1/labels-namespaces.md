# 标签、注解与命名空间

集群里的对象很快会多到几百上千个：不同应用、不同版本、不同环境、不同团队。Kubernetes 没有"文件夹"或"分组"这种层级结构，而是用两种轻量机制组织资源：**标签（Label）** 负责横向分类与选择，**命名空间（Namespace）** 负责纵向隔离。

学完这一课，你能用标签选择器筛选和批量操作资源，理解 Service、Deployment 如何靠标签"找到"它们的 Pod，知道注解该放什么，并会用命名空间划分环境、给命名空间设配额。

## 标签：给对象贴便签

### 为什么需要标签

想象你要回答这些问题："所有属于 `shop` 应用的 Pod？""所有 `canary` 版本的实例？""生产环境里前端层的资源？"对象名字没法承载这么多维度，而标签可以：它就是挂在 `metadata.labels` 下的键值对，一个对象可以有任意多个，多个对象可以共享同一个标签。

```yaml title="labeled-pods.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: web-prod
  labels:
    app: web
    tier: frontend
    env: prod
spec:
  containers:
    - name: nginx
      image: nginx:1.27
---
apiVersion: v1
kind: Pod
metadata:
  name: web-dev
  labels:
    app: web
    tier: frontend
    env: dev
spec:
  containers:
    - name: nginx
      image: nginx:1.27
---
apiVersion: v1
kind: Pod
metadata:
  name: api-prod
  labels:
    app: api
    tier: backend
    env: prod
spec:
  containers:
    - name: nginx
      image: nginx:1.27
```

```bash
kubectl apply -f labeled-pods.yaml
kubectl get pods --show-labels
```

```console
NAME       READY   STATUS    RESTARTS   AGE   LABELS
api-prod   1/1     Running   0          10s   app=api,env=prod,tier=backend
web-dev    1/1     Running   0          10s   app=web,env=dev,tier=frontend
web-prod   1/1     Running   0          10s   app=web,env=prod,tier=frontend
```

用 `-L` 把某些标签作为独立列展示，更清晰：

```bash
kubectl get pods -L app,env
```

```console
NAME       READY   STATUS    RESTARTS   AGE   APP   ENV
api-prod   1/1     Running   0          20s   api   prod
web-dev    1/1     Running   0          20s   web   dev
web-prod   1/1     Running   0          20s   web   prod
```

### 标签的语法

- 键可以有可选前缀：`前缀/名字`，前缀是 DNS 子域名，如 `app.kubernetes.io/name`。无前缀的键被视为用户私有。`kubernetes.io/` 和 `k8s.io/` 前缀保留给 Kubernetes 核心组件。
- 名字部分和值都不超过 63 个字符，以字母或数字开头结尾，中间可含 `-`、`_`、`.`。值可以为空。

### 增删改标签

```bash
kubectl label pod web-dev owner=alice             # 添加
kubectl label pod web-dev env=staging --overwrite # 修改已有标签需要 --overwrite
kubectl label pod web-dev owner-                  # 键后加减号表示删除
```

> [!TIP]
> 命令行改标签适合实验和排障。生产中请修改 YAML 再 `apply`，否则下次 apply 会把改动冲掉。

## 标签选择器

标签本身不做任何事，它的价值在于被**选择器（Selector）** 使用。

### 等值选择器（Equality-based）

支持 `=`（或 `==`）和 `!=`，多个条件用逗号连接，表示"与"：

```bash
kubectl get pods -l env=prod
kubectl get pods -l app=web,env!=prod
```

```console
NAME      READY   STATUS    RESTARTS   AGE
web-dev   1/1     Running   0          1m
```

### 集合选择器（Set-based）

支持 `in`、`notin`、存在（只写键）、不存在（`!键`）：

```bash
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l 'tier notin (backend)'
kubectl get pods -l 'owner'        # 有 owner 标签的
kubectl get pods -l '!owner'       # 没有 owner 标签的
```

选择器也能用于批量操作：

```bash
kubectl delete pods -l env=dev
kubectl logs -l app=web --prefix   # 一次看所有匹配 Pod 的日志
```

### 在 YAML 中的选择器

较老的资源（Service、ReplicationController）只支持等值选择器，写成简单的 map：

```yaml
selector:
  app: web
```

较新的资源（Deployment、ReplicaSet、Job、DaemonSet 等）支持 `matchLabels` 与 `matchExpressions`，两者之间是"与"关系：

```yaml
selector:
  matchLabels:
    app: web
  matchExpressions:
    - { key: env, operator: In, values: [prod, staging] }
    - { key: canary, operator: DoesNotExist }
```

`operator` 可选 `In`、`NotIn`、`Exists`、`DoesNotExist`。

> [!NOTE] 标签是 Kubernetes 的"胶水"
> Deployment 通过选择器找到它管理的 Pod，[Service](/learn/services) 通过选择器决定把流量发给哪些 Pod，节点亲和性通过节点标签决定调度位置。对象之间不是靠名字引用，而是靠标签松耦合。这也意味着：如果你手动给一个 Pod 打上了某个 Service 选择器匹配的标签，它就会开始接收流量。

### 推荐的标签

官方推荐一组通用标签，很多工具（Helm、Dashboard、监控）都认识它们：

| 键 | 示例 | 说明 |
|---|---|---|
| `app.kubernetes.io/name` | `mysql` | 应用名 |
| `app.kubernetes.io/instance` | `mysql-abcxyz` | 实例的唯一名称 |
| `app.kubernetes.io/version` | `5.7.21` | 版本 |
| `app.kubernetes.io/component` | `database` | 在架构中的组件 |
| `app.kubernetes.io/part-of` | `wordpress` | 所属的上层应用 |
| `app.kubernetes.io/managed-by` | `Helm` | 管理工具 |

## 注解：给机器看的备注

注解（Annotation）也是 `metadata` 下的键值对，语法和标签类似，但有两点不同：

- **不能用于选择**，没有注解选择器。
- 值可以很长（所有注解总计不超过 256 KiB），可以是任意字符串，包括 JSON。

所以它用来存放"描述性、给工具读"的信息：

```yaml
metadata:
  annotations:
    description: "订单服务前端，负责人 alice@example.com"
    kubernetes.io/change-cause: "升级到 nginx 1.27"
    prometheus.io/scrape: "true"
```

常见用途：构建与发布信息（Git commit、镜像摘要）、负责人联系方式、给 Ingress 控制器或监控系统的配置开关、`kubectl apply` 自己也会写 `kubectl.kubernetes.io/last-applied-configuration` 注解来记录上次应用的配置。

```bash
kubectl annotate pod web-prod description="生产前端"
kubectl describe pod web-prod | grep -A2 Annotations
```

> [!TIP] 标签还是注解？
> 一个简单判据：**需要按它筛选或被选择器引用的，放标签；只是记录信息的，放注解。** 标签值受长度和字符限制，不要往里塞 URL 或 JSON。

## 命名空间：虚拟的隔离区

### 为什么需要命名空间

同一个集群被多个团队、多个环境共享时，需要：避免名字冲突（两个团队都想叫 `web`）；按范围授权（dev 团队只能动 dev 的东西）；按范围限制资源用量。命名空间（Namespace）提供了这种作用域。

```bash
kubectl get namespaces
```

```console
NAME                 STATUS   AGE
default              Active   2d
kube-node-lease      Active   2d
kube-public          Active   2d
kube-system          Active   2d
local-path-storage   Active   2d
```

| 命名空间 | 用途 |
|---|---|
| `default` | 未指定命名空间时的默认位置 |
| `kube-system` | Kubernetes 系统组件（CoreDNS、kube-proxy 等） |
| `kube-public` | 所有人（包括未认证用户）可读，很少使用 |
| `kube-node-lease` | 节点心跳用的 Lease 对象 |
| `local-path-storage` | kind 自带的本地存储供给器（kind 特有） |

### 创建与使用

```yaml title="namespaces.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: dev
  labels:
    env: dev
---
apiVersion: v1
kind: Namespace
metadata:
  name: prod
  labels:
    env: prod
```

```bash
kubectl apply -f namespaces.yaml
kubectl run web --image=nginx:1.27 -n dev
kubectl run web --image=nginx:1.27 -n prod     # 同名不冲突
kubectl get pods -n dev
kubectl get pods -A -l run=web
```

```console
NAMESPACE   NAME   READY   STATUS    RESTARTS   AGE
dev         web    1/1     Running   0          8s
prod        web    1/1     Running   0          6s
```

也可以把命名空间写在对象的 `metadata.namespace` 里；或者切换当前 context 的默认命名空间，省得每次敲 `-n`：

```bash
kubectl config set-context --current --namespace=dev
```

### 命名空间不隔离什么

> [!WARNING] 命名空间不是安全边界
> 命名空间只隔离**名字和 API 权限作用域**。默认情况下，不同命名空间的 Pod 之间网络完全互通，也可能被调度到同一节点上。要做网络隔离需要 NetworkPolicy，要做权限隔离需要 RBAC，这些在阶段 3 讲解。

另外，并非所有资源都属于命名空间。Node、PersistentVolume、StorageClass、Namespace 本身都是集群级资源：

```bash
kubectl api-resources --namespaced=false
```

删除命名空间会**级联删除其中的所有对象**，操作前务必确认。

### 命名空间与 DNS

每个 Service 都会得到一个 DNS 名称，格式为：

```text
<service-name>.<namespace>.svc.cluster.local
```

同一命名空间内的 Pod 用短名 `web` 就能访问；跨命名空间必须带上命名空间，比如 `web.prod` 或完整的 `web.prod.svc.cluster.local`。这是因为 Pod 的 `/etc/resolv.conf` 里配置了按自身命名空间优先的搜索域：

```bash
kubectl exec -n dev web -- cat /etc/resolv.conf
```

```console
search dev.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

后面的 [Service 与服务发现](/learn/services) 一课会实际验证这些 DNS 名称。

## ResourceQuota 简介

命名空间的另一个作用是承载资源配额。ResourceQuota 可以限制一个命名空间里对象的**数量**和**资源总量**：

```yaml title="dev-quota.yaml"
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: dev
spec:
  hard:
    pods: "3"
    configmaps: "10"
    services: "5"
```

```bash
kubectl apply -f dev-quota.yaml
kubectl run a --image=nginx:1.27 -n dev
kubectl run b --image=nginx:1.27 -n dev
kubectl run c --image=nginx:1.27 -n dev
```

```console
pod/a created
pod/b created
Error from server (Forbidden): pods "c" is forbidden: exceeded quota: dev-quota, requested: pods=1, used: pods=3, limited: pods=3
```

```bash
kubectl describe quota dev-quota -n dev
```

```console
Name:       dev-quota
Namespace:  dev
Resource    Used  Hard
--------    ----  ----
configmaps  1     10
pods        3     3
services    0     5
```

（`pods` 的 3 个包括前面创建的 `web`；`configmaps` 已用 1 个，是每个命名空间自动创建的 `kube-root-ca.crt`。）

对 CPU、内存的配额需要配合 Pod 的 requests/limits 一起理解，放在阶段 2 的[健康检查与资源管理](/learn/probes-resources)里详细讲。

清理：

```bash
kubectl config set-context --current --namespace=default   # 先切回 default
kubectl delete -f labeled-pods.yaml --ignore-not-found
kubectl delete namespace dev prod
```

## 动手练习

1. 创建本课的三个带标签的 Pod，用一条集合选择器命令列出 `env` 为 `prod` 或 `staging`、且没有 `owner` 标签的 Pod。
2. 手动给 `web-dev` 加上 `canary=true` 标签，再用 `-L canary` 列出所有 Pod 观察结果，最后删除这个标签。
3. 给一个 Pod 添加一个包含 JSON 字符串的注解，用 `-o jsonpath` 把它读出来。
4. 创建 `team-a` 命名空间，设置最多 2 个 Pod 的配额，验证第 3 个 Pod 被拒绝，并用 `describe quota` 查看用量。
5. 在 `dev` 和 `prod` 各跑一个 Pod，分别 `cat /etc/resolv.conf`，对比 search 行的差异。

## 自测

<details>
<summary>标签和注解都可以挂任意键值对，什么时候用哪个？</summary>

需要被选择器筛选或引用（Service、Deployment、调度）的信息用标签；只供人或工具阅读的描述性信息（负责人、构建信息、工具配置）用注解。注解不能被选择，但值可以更长、格式更自由。

</details>

<details>
<summary>`-l 'env in (prod,staging),tier!=backend'` 选中了什么？</summary>

`env` 标签值是 `prod` 或 `staging`，并且 `tier` 不等于 `backend` 的对象。注意 `!=` 也会选中**根本没有** `tier` 标签的对象。

</details>

<details>
<summary>dev 命名空间的 Pod 如何访问 prod 命名空间里名为 `api` 的 Service？</summary>

使用 `api.prod`，或完整域名 `api.prod.svc.cluster.local`。只写 `api` 会按搜索域解析为 `api.dev.svc.cluster.local`。

</details>

<details>
<summary>把两个团队放进不同命名空间，能阻止它们的 Pod 互相访问吗？</summary>

不能。命名空间只隔离名字和 API 权限作用域，默认网络是全通的。要阻止互访需要 NetworkPolicy（且 CNI 支持），权限隔离需要 RBAC。

</details>

## 参考资料

- [Kubernetes 官方文档：标签和选择算符](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/labels/)
- [Kubernetes 官方文档：注解](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/annotations/)
- [Kubernetes 官方文档：推荐使用的标签](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/common-labels/)
- [Kubernetes 官方文档：名字空间](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/namespaces/)
- [Kubernetes 官方文档：资源配额](https://kubernetes.io/zh-cn/docs/concepts/policy/resource-quotas/)
