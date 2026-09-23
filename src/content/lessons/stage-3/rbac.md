# 认证、授权与 RBAC

到目前为止，我们一直用 kind 生成的 kubeconfig 操作集群——它拥有 `cluster-admin` 权限，什么都能做。真实团队里不可能人人都是管理员：开发只该动自己的命名空间，CI 流水线只该更新特定的 Deployment，监控组件只需要读权限。一旦某个凭据泄露，权限越小，损失越小。

上一课讲过，每个请求进入 apiserver 首先要过"认证"和"授权"两关。这一课把这两关讲透：Kubernetes 怎么识别"你是谁"（证书、Token、OIDC、ServiceAccount），怎么决定"你能做什么"（RBAC 的 Role、ClusterRole 和绑定），最后实战为一位开发者生成一份只能操作单个命名空间的 kubeconfig。

## 认证：Kubernetes 没有"用户"对象

第一个反直觉的事实：**Kubernetes 里没有 User 资源**。你不能 `kubectl create user`。apiserver 只负责从请求携带的凭据中"认出"一个身份，身份包含：

- 用户名（username），如 `alice` 或 `system:serviceaccount:dev:ci-bot`
- 用户组（groups），如 `dev-team`、`system:authenticated`
- 可选的 UID 和额外字段

用户本身由外部系统管理（证书签发机构、身份提供商）。唯一例外是 **ServiceAccount**，它是给 Pod 里的程序用的、由 Kubernetes 自己管理的身份。

### 常见认证方式

| 方式 | 身份从哪来 | 适用场景 |
|---|---|---|
| X.509 客户端证书 | 证书的 `CN` 为用户名，`O` 为组 | 管理员、控制平面组件、kubelet |
| ServiceAccount Token（JWT） | apiserver 签发，`sub` 为 `system:serviceaccount:<ns>:<name>` | Pod 内程序、CI 系统 |
| OIDC Token | 身份提供商（Keycloak、Dex、企业 SSO）签发的 ID Token | 团队成员日常登录 |
| 认证 Webhook | 外部服务校验 Token 后返回身份 | 云厂商 IAM 集成 |

apiserver 可以同时启用多种方式，依次尝试，任一成功即认证通过。全部失败时，如果允许匿名访问，请求会被当作 `system:anonymous` 用户，否则返回 `401`。

看看你当前是谁：

```bash
kubectl auth whoami
# ATTRIBUTE   VALUE
# Username    kubernetes-admin
# Groups      [kubeadm:cluster-admins system:authenticated]
```

kind 的管理员凭据就是一张证书：

```bash
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' \
  | base64 -d | openssl x509 -noout -subject
# subject=O = kubeadm:cluster-admins, CN = kubernetes-admin
```

> [!WARNING] 证书用户的致命缺点
> Kubernetes 不支持吊销客户端证书（没有 CRL/OCSP 检查）。一张证书泄露后，在过期前都有效，只能通过删除它所绑定的 RBAC 权限来止损——如果它属于 `system:masters` 组，甚至无法止损，因为该组会绕过 RBAC。所以证书只适合少数管理员和组件，**团队成员应该用 OIDC**，离职时在身份提供商那边禁用即可。

### OIDC 简介

OIDC 流程是：用户在浏览器登录企业 SSO，拿到一个签名的 ID Token；kubectl 带着它访问 apiserver；apiserver 用 IdP 的公钥验签，从 Token 的 claim（如 `email`、`groups`）中取出用户名和组。kubectl 侧通常使用 [kubelogin](https://github.com/int128/kubelogin) 插件自动完成登录和刷新。

新版本推荐通过结构化认证配置（`--authentication-config` 指定的 `AuthenticationConfiguration` 文件，v1.34 GA）来配置，支持多个 IdP 和 CEL 表达式映射 claim，并且可以热加载，不用再改 apiserver 启动参数。

## ServiceAccount 与投射 Token

每个命名空间都会自动创建一个名为 `default` 的 ServiceAccount，Pod 未指定时就用它。Pod 启动时，kubelet 会把一个 **投射卷（Projected Volume）** 挂载到 `/var/run/secrets/kubernetes.io/serviceaccount/`，里面有：

- `token`：一个短期、绑定到该 Pod 的 JWT
- `ca.crt`：apiserver 的 CA 证书
- `namespace`：当前命名空间

```bash
kubectl run sa-demo --image=busybox:1.36 --restart=Never -- sleep 3600
kubectl exec sa-demo -- cat /var/run/secrets/kubernetes.io/serviceaccount/token \
  | cut -d. -f2 | base64 -d 2>/dev/null; echo
# {"aud":["https://kubernetes.default.svc.cluster.local"],"exp":...,
#  "kubernetes.io":{"namespace":"default","pod":{"name":"sa-demo",...},
#  "serviceaccount":{"name":"default",...}},"sub":"system:serviceaccount:default:default"}
```

这个 Token 有三个关键特性：

1. **有时效**：默认约 1 小时有效（kubelet 会在过期前自动轮换并更新文件），客户端库需要定期重读文件。
2. **绑定对象**：绑定到这个 Pod，Pod 删除后 Token 立即失效。
3. **有受众（audience）**：可以为特定用途签发不同受众的 Token，防止被拿去访问其他服务。

> [!NOTE] 旧式 Secret Token
> v1.24 之前，每个 ServiceAccount 会自动生成一个 `kubernetes.io/service-account-token` 类型的 Secret，里面的 Token 永不过期。现在已不再自动生成，但仍可以手动创建这种 Secret（下面实战会用到），适合给集群外部的长期系统使用。它的风险是永不过期，务必做好保管和轮换；能用短期 Token 就用短期 Token。

不需要访问 API 的 Pod，最好关闭自动挂载：

```yaml title="no-token-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: no-token
spec:
  automountServiceAccountToken: false
  containers:
    - name: app
      image: nginx:1.27
```

临时需要一个短期 Token（比如调试或给外部系统用）时：

```bash
kubectl create token default --duration=10m
```

## 授权：RBAC 的四个对象

认证之后是授权。apiserver 常用的授权模式是 `Node,RBAC`：Node 授权器专门管 kubelet 的权限，其他都交给 RBAC（Role-Based Access Control）。RBAC 只有四种对象：

```text
            定义"能做什么"                     定义"谁"获得它
┌───────────────────────────────┐   ┌────────────────────────────────────┐
│ Role         （命名空间内）      │◄──│ RoleBinding        （命名空间内）      │
│ ClusterRole  （集群级 / 可复用） │◄──│ ClusterRoleBinding （全集群生效）      │
└───────────────────────────────┘   └────────────────────────────────────┘
                                         subjects: User / Group / ServiceAccount
```

RBAC 规则 **只有允许，没有拒绝**，权限是所有绑定的并集。默认一切拒绝。

### Role 与规则

```yaml title="pod-reader.yaml"
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
  - apiGroups: [""]              # "" 表示 core 组（apiVersion: v1 的资源）
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]          # apiVersion: apps/v1 的资源
    resources: ["deployments"]
    resourceNames: ["web"]       # 只允许操作名为 web 的 Deployment
    verbs: ["get", "patch"]
```

写规则时怎么知道 apiGroup 和资源名？用 `kubectl api-resources`：

```bash
kubectl api-resources -o wide | grep -E '^NAME|^pods |^deployments |^storageclasses '
# NAME             SHORTNAMES  APIVERSION           NAMESPACED  KIND          VERBS
# pods             po          v1                   true        Pod           [create delete ... watch]
# deployments      deploy      apps/v1              true        Deployment    [...]
# storageclasses   sc          storage.k8s.io/v1    false       StorageClass  [...]
```

- `APIVERSION` 为 `v1` → `apiGroups: [""]`；为 `apps/v1` → `apiGroups: ["apps"]`。
- `NAMESPACED=true` 的资源用 Role 授权；`false`（Node、Namespace、StorageClass、PV）只能用 ClusterRole + ClusterRoleBinding。
- 子资源单独授权：`pods/log`、`pods/exec`、`pods/portforward`、`deployments/scale`。

> [!DANGER] 这些权限等同于提权
> - `pods/exec`：能进入容器，拿到其中挂载的所有 Secret 和 Token。
> - 在某命名空间 `create pods`：可以挂载该命名空间任意 Secret、使用任意 ServiceAccount。
> - `secrets` 的 `list`/`watch`：`list` 会返回 Secret 的完整内容，不只是名字。
> - `escalate`、`bind`、`impersonate` 动词，以及对 RBAC 对象本身的写权限。
> - 通配符 `*`：将来新增的资源也会自动包含进来。

### ClusterRole 的两种用法

ClusterRole 不属于任何命名空间，有两种用法：

1. 配合 **ClusterRoleBinding**：在全集群生效，例如只读所有命名空间。
2. 配合 **RoleBinding**：只在该 RoleBinding 所在命名空间生效。这样定义一次 ClusterRole，就能在多个命名空间复用。

Kubernetes 内置了几个面向用户的 ClusterRole，优先复用它们：

| ClusterRole | 能力 |
|---|---|
| `view` | 命名空间内只读，不能看 Secret |
| `edit` | 读写大部分资源（含 Secret），不能改 RBAC |
| `admin` | 命名空间内全部权限，包括 Role/RoleBinding，不能改 ResourceQuota 和命名空间本身 |
| `cluster-admin` | 超级管理员 |

```bash
# 把内置 edit 角色授予 dev 命名空间中的 alice
kubectl create rolebinding alice-edit --clusterrole=edit --user=alice -n dev
```

### 聚合 ClusterRole

`view`、`edit`、`admin` 怎么知道你后来安装的 CRD？答案是 **聚合（Aggregation）**：这几个 ClusterRole 带有 `aggregationRule`，控制器会把所有带特定标签的 ClusterRole 规则自动合并进来。

```yaml title="aggregate-to-view.yaml"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: crontabs-view
  labels:
    rbac.authorization.k8s.io/aggregate-to-view: "true"
    rbac.authorization.k8s.io/aggregate-to-edit: "true"
    rbac.authorization.k8s.io/aggregate-to-admin: "true"
rules:
  - apiGroups: ["stable.example.com"]
    resources: ["crontabs"]
    verbs: ["get", "list", "watch"]
```

apply 之后执行 `kubectl get clusterrole view -o yaml | grep -A3 crontabs`，就能看到规则已经合并进去。好的 Operator 安装时都会附带这样的聚合角色，[CRD 与 Operator 模式](/learn/crd-operator) 中的 kubebuilder 也会自动生成。

## 用 kubectl auth can-i 验证权限

写完 RBAC 一定要验证，而不是等用户来报错：

```bash
# 我自己能做什么
kubectl auth can-i create deployments -n dev
kubectl auth can-i --list -n dev

# 模拟其他身份（需要 impersonate 权限，管理员默认有）
kubectl auth can-i list secrets -n dev --as=alice
kubectl auth can-i get pods -n dev --as=system:serviceaccount:dev:ci-bot
kubectl auth can-i create pods --as=bob --as-group=dev-team -n dev

# 反查：谁能删除 dev 里的 Pod（需要安装 kubectl-who-can 插件）
kubectl who-can delete pods -n dev
```

`--as` 还能用于任何 kubectl 命令，例如 `kubectl get pods -n dev --as=alice`，这是排查 403 最快的办法。

## 实战：为开发者创建受限 kubeconfig

需求：开发者小王只能在 `team-a` 命名空间内读写应用资源，能看到集群有哪些命名空间（便于 `kubectx`/`kubens` 这类工具使用），其他一概不能碰。

团队的做法是把"代表人员身份的 ServiceAccount"集中放在一个专门的命名空间里管理（比如 `sa-management`），权限通过 Binding 授予到目标命名空间——**RoleBinding 创建在哪个命名空间，权限就在哪个命名空间生效**，与 ServiceAccount 所在命名空间无关。

> [!NOTE]
> 对人员而言 OIDC 是更好的长期方案。没有 IdP 的小团队、或需要给外部系统一份固定凭据时，下面的 ServiceAccount 方案简单可行。

```yaml title="dev-wang.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: sa-management
---
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: dev-wang
  namespace: sa-management
---
# 长期 Token：手动创建 service-account-token 类型的 Secret
apiVersion: v1
kind: Secret
type: kubernetes.io/service-account-token
metadata:
  name: dev-wang
  namespace: sa-management
  annotations:
    kubernetes.io/service-account.name: dev-wang
---
# 集群级：只读命名空间列表
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: namespace-viewer
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: dev-wang-namespace-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: namespace-viewer
subjects:
  - kind: ServiceAccount
    name: dev-wang
    namespace: sa-management
---
# 命名空间级：复用内置 edit 角色，只在 team-a 生效
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-wang-edit
  namespace: team-a
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: edit
subjects:
  - kind: ServiceAccount
    name: dev-wang
    namespace: sa-management
```

```bash
kubectl apply -f dev-wang.yaml

# 验证权限
SA=system:serviceaccount:sa-management:dev-wang
kubectl auth can-i create deployments -n team-a --as=$SA   # yes
kubectl auth can-i create deployments -n default --as=$SA  # no
kubectl auth can-i list namespaces --as=$SA                # yes
kubectl auth can-i delete nodes --as=$SA                   # no
```

然后生成 kubeconfig：

```bash
CLUSTER=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' \
  | base64 -d > ca.crt
TOKEN=$(kubectl get secret dev-wang -n sa-management -o jsonpath='{.data.token}' | base64 -d)

export KUBECONFIG=./dev-wang.kubeconfig
kubectl config set-cluster "$CLUSTER" --server="$SERVER" \
  --certificate-authority=ca.crt --embed-certs=true
kubectl config set-credentials dev-wang --token="$TOKEN"
kubectl config set-context dev-wang@"$CLUSTER" --cluster="$CLUSTER" \
  --user=dev-wang --namespace=team-a
kubectl config use-context dev-wang@"$CLUSTER"
unset KUBECONFIG
```

生成的文件结构大致如下：

```yaml title="dev-wang.kubeconfig"
apiVersion: v1
kind: Config
clusters:
  - name: kind-kind
    cluster:
      certificate-authority-data: LS0tLS1CRUdJTi...   # 不要用 insecure-skip-tls-verify
      server: https://192.168.x.x:6443
contexts:
  - name: dev-wang@kind-kind
    context:
      cluster: kind-kind
      namespace: team-a
      user: dev-wang
current-context: dev-wang@kind-kind
users:
  - name: dev-wang
    user:
      token: eyJhbGciOiJSUzI1NiIs...
```

测试：

```bash
kubectl --kubeconfig=dev-wang.kubeconfig create deployment web --image=nginx:1.27
kubectl --kubeconfig=dev-wang.kubeconfig get pods -n kube-system
# Error from server (Forbidden): pods is forbidden: User "system:serviceaccount:sa-management:dev-wang"
# cannot list resource "pods" in API group "" in the namespace "kube-system"
```

> [!PROD] 生产注意
> - kubeconfig 里要带上 CA 证书，不要用 `insecure-skip-tls-verify: true`，否则连接可能被中间人劫持。
> - 回收权限：删除 Secret 即吊销 Token；删除 RoleBinding 即回收权限。人员离职时两者都要删。
> - 把这些 YAML 用 Kustomize 管理并纳入 Git，每个人员一个目录，权限变更走代码评审。
> - 定期用 `kubectl auth can-i --list --as=...` 审计，警惕对 `*` 资源或 `*` 动词的授权。

## 动手练习

1. 执行 `kubectl auth whoami`，然后用 `openssl` 解析 kind 管理员证书，找出你属于哪个组，再查 `kubectl get clusterrolebinding -o wide | grep <组名>` 看看这个组绑定了什么。
2. 按实战部分为 `dev-wang` 生成 kubeconfig，验证它能在 `team-a` 创建 Deployment，但不能查看 `kube-system` 的 Pod。
3. 给 `dev-wang` 追加一个只读查看 `team-b` 命名空间的权限（提示：RoleBinding 到内置 `view`）。
4. 创建一个 ServiceAccount `pod-lister` 并运行一个使用它的 Pod，在 Pod 内用 `curl` 带着投射 Token 访问 `https://kubernetes.default.svc/api/v1/namespaces/default/pods`，先看到 403，授权后再看到 200。
5. 创建一个带 `aggregate-to-view` 标签的 ClusterRole，确认它的规则出现在内置 `view` 中。

## 自测

<details>
<summary>为什么不能用 kubectl create user 创建用户？Kubernetes 如何知道请求者是谁？</summary>

Kubernetes 没有 User 资源，普通用户由外部系统管理。apiserver 通过认证插件从请求凭据中提取身份：证书的 CN/O、OIDC Token 中的 claim、ServiceAccount JWT 的 `sub` 等。只有 ServiceAccount 是 Kubernetes 内部管理的身份对象。

</details>

<details>
<summary>一个 ClusterRole 被 RoleBinding 引用，权限在哪个范围内生效？</summary>

只在该 RoleBinding 所在的命名空间内生效。这是复用 ClusterRole（如内置的 `edit`、`view`）为多个命名空间授权的标准做法。

</details>

<details>
<summary>现在的 Pod 里挂载的 ServiceAccount Token 和旧版 Secret 里的 Token 有什么区别？</summary>

投射 Token 有过期时间（kubelet 自动轮换）、绑定到具体 Pod（Pod 删除即失效）、带有 audience；旧版 `service-account-token` 类型 Secret 中的 Token 永不过期，只能通过删除 Secret 吊销，泄露风险更大。

</details>

<details>
<summary>RBAC 能不能写一条"禁止删除 Pod"的规则？</summary>

不能。RBAC 只有允许规则，最终权限是所有绑定的并集。要实现"禁止"，只能不授予对应权限；如果需要基于对象内容做拒绝，应使用准入控制（如 ValidatingAdmissionPolicy）。

</details>

<details>
<summary>给开发者 pods/exec 权限有什么风险？</summary>

exec 进入容器后可以读取容器内挂载的所有 Secret 和 ServiceAccount Token，从而以该 ServiceAccount 的身份访问 API，可能获得比开发者本人更高的权限。应只在必要的命名空间授予，并配合审计日志。

</details>

## 参考资料

- [Kubernetes 官方文档：用户认证](https://kubernetes.io/zh-cn/docs/reference/access-authn-authz/authentication/)
- [Kubernetes 官方文档：使用 RBAC 鉴权](https://kubernetes.io/zh-cn/docs/reference/access-authn-authz/rbac/)
- [Kubernetes 官方文档：服务账号](https://kubernetes.io/zh-cn/docs/concepts/security/service-accounts/)
- [Kubernetes 官方文档：为 Pod 配置服务账号](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-service-account/)
- [Kubernetes 官方文档：基于角色的访问控制良好实践](https://kubernetes.io/zh-cn/docs/concepts/security/rbac-good-practices/)
- [Kubernetes 官方文档：使用 kubeconfig 文件组织集群访问](https://kubernetes.io/zh-cn/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
