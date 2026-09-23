# kubectl 与声明式 API

上一课你用 kind 建好了集群，还用 `kubectl` 部署了第一个应用。那时我们只是照着命令敲，这一课来把背后的东西讲清楚：Kubernetes 里的每样东西都是一个 **API 对象**，`kubectl` 只是一个把 YAML 翻译成 HTTP 请求、发给 API Server 的客户端。

学完这一课，你能看懂任何一份 Kubernetes YAML 的骨架，会用 `explain` 查字段、用 `--dry-run` 生成模板、用 `diff` 预览变更，并把 `kubectl` 调教得顺手。

## 一切皆 API 对象

### 为什么是"对象"

Kubernetes 的核心思想是**声明式（Declarative）**：你告诉集群"我想要什么状态"，控制器负责把现实调整到这个状态。要表达"想要的状态"，就需要一种统一的数据结构，这就是 API 对象。Pod、Deployment、Service、Node、Namespace……全都是对象，都存在 etcd 里，都通过 API Server 读写。

### 对象的五个顶层字段

几乎所有对象都长这样：

```yaml title="nginx-pod.yaml"
apiVersion: v1          # 这个对象属于哪个 API 组的哪个版本
kind: Pod               # 对象类型
metadata:               # 元数据：名字、命名空间、标签、注解……
  name: nginx
  namespace: default
  labels:
    app: nginx
spec:                   # 期望状态（Spec）：你想要什么，由你来写
  containers:
    - name: nginx
      image: nginx:1.27
      ports:
        - containerPort: 80
# status:               # 实际状态（Status）：由系统填写，你不需要写
```

| 字段 | 谁来写 | 含义 |
|---|---|---|
| `apiVersion` | 你 | `组/版本`，核心组省略组名，如 `v1`；其他如 `apps/v1`、`batch/v1`、`networking.k8s.io/v1` |
| `kind` | 你 | 资源类型，首字母大写的驼峰，如 `Deployment` |
| `metadata` | 你 + 系统 | `name`、`namespace`、`labels`、`annotations` 由你写；`uid`、`resourceVersion`、`creationTimestamp` 由系统生成 |
| `spec` | 你 | 期望状态 |
| `status` | 系统 | 实际状态，控制器持续更新 |

> [!NOTE] spec 与 status 就是控制循环的两端
> 控制器不停地比较 `spec`（想要的）和 `status`（现在的），发现不一致就采取行动。这就是上一阶段 [为什么需要 Kubernetes](/learn/why-kubernetes) 里讲的控制循环（Control Loop）。少数对象（如 ConfigMap、Secret）没有 `spec`，而是用 `data` 字段直接承载内容。

### 查看集群支持哪些资源

```bash
kubectl api-resources
```

```console
NAME                SHORTNAMES   APIVERSION      NAMESPACED   KIND
configmaps          cm           v1              true         ConfigMap
namespaces          ns           v1              false        Namespace
nodes               no           v1              false        Node
pods                po           v1              true         Pod
services            svc          v1              true         Service
deployments         deploy       apps/v1         true         Deployment
replicasets         rs           apps/v1         true         ReplicaSet
...
```

`SHORTNAMES` 列是简写，`kubectl get po` 等价于 `kubectl get pods`。`NAMESPACED` 说明资源是否属于某个命名空间，Node、Namespace 这类是集群级别的。

## kubectl explain：自带的字段手册

写 YAML 时最常见的问题是"这个字段叫什么、放在哪一层"。不用翻网页，直接问集群：

```bash
kubectl explain pod.spec.containers.ports
```

```console
KIND:       Pod
VERSION:    v1

FIELD: ports <[]ContainerPort>

DESCRIPTION:
    List of ports to expose from the container. ...

FIELDS:
  containerPort <integer> -required-
    Number of port to expose on the pod's IP address. ...
  hostIP        <string>
  hostPort      <integer>
  name          <string>
  protocol      <string>
```

加 `--recursive` 可以一次展开所有子字段，适合快速浏览结构：

```bash
kubectl explain deployment.spec --recursive | head -40
```

> [!TIP]
> `explain` 的内容来自集群本身的 OpenAPI 文档，所以它和你集群的版本完全一致，比网上搜来的老博客可靠。CRD 只要定义了 schema，同样可以 `explain`。

## 命令式与声明式

`kubectl` 支持三种管理对象的方式：

| 方式 | 示例 | 适用场景 |
|---|---|---|
| 命令式命令 | `kubectl create deployment web --image=nginx` | 临时实验、快速排障 |
| 命令式对象配置 | `kubectl create -f web.yaml` / `kubectl replace -f web.yaml` | 很少用 |
| 声明式对象配置 | `kubectl apply -f web.yaml` | 日常与生产的标准做法 |

命令式（Imperative）是"做这个动作"，声明式（Declarative）是"让它变成这样"。区别在第二次执行时最明显：

```bash
kubectl create deployment web --image=nginx:1.27
kubectl create deployment web --image=nginx:1.27
# Error from server (AlreadyExists): deployments.apps "web" already exists
```

而 `apply` 可以反复执行，对象不存在就创建、存在就把差异合并进去，结果总是和文件一致。这让 YAML 文件可以放进 Git，成为"唯一事实来源"，也是后面 GitOps 的基础。

> [!PROD] 生产环境只用声明式
> 线上集群的每个对象都应该能在 Git 里找到对应的 YAML（或 Helm/Kustomize 模板）。用 `kubectl edit`、`kubectl scale` 做的临时修改，下一次 `apply` 就会被覆盖，也没人知道当时改了什么。

## 常用命令速览

### get：列出对象

```bash
kubectl get pods                    # 当前命名空间的 Pod
kubectl get pods -A                 # 所有命名空间
kubectl get pods -o wide            # 多显示 IP、所在节点
kubectl get deploy,svc              # 一次查多种资源
kubectl get pods -w                 # 持续观察变化（watch）
kubectl get pod nginx -o yaml       # 输出完整对象，包括 status
```

### describe：人类可读的详情 + 事件

```bash
kubectl describe pod nginx
```

`describe` 的精华在最后的 `Events` 段，Pod 起不来时第一眼就看这里：

```console
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  12s   default-scheduler  Successfully assigned default/nginx to kind-worker
  Normal  Pulling    11s   kubelet            Pulling image "nginx:1.27"
  Normal  Pulled     5s    kubelet            Successfully pulled image "nginx:1.27" in 6.1s
  Normal  Created    5s    kubelet            Created container nginx
  Normal  Started    5s    kubelet            Started container nginx
```

### apply 与 delete

```bash
kubectl apply -f nginx-pod.yaml     # 单个文件
kubectl apply -f ./manifests/       # 整个目录
kubectl delete -f nginx-pod.yaml    # 按文件删除
kubectl delete pod nginx            # 按名字删除
```

### 输出格式：-o yaml / json / jsonpath

`-o yaml` 看全部，`-o jsonpath` 精确取值，写脚本时非常好用：

```bash
# 取单个值
kubectl get pod nginx -o jsonpath='{.status.podIP}'

# 遍历列表：每个 Pod 输出"名字 节点"
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.nodeName}{"\n"}{end}'

# 自定义列，比 jsonpath 更易读
kubectl get pods -o custom-columns=NAME:.metadata.name,IP:.status.podIP,NODE:.spec.nodeName
```

```console
NAME    IP           NODE
nginx   10.244.1.3   kind-worker
```

## 生成模板：--dry-run=client -o yaml

没人能凭空记住 Deployment 的全部缩进。标准技巧是让 `kubectl` 帮你生成骨架，再手工修改：

```bash
kubectl create deployment web --image=nginx:1.27 --replicas=2 \
  --dry-run=client -o yaml > web.yaml
```

```yaml title="web.yaml"
apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: web
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: web
    spec:
      containers:
      - image: nginx:1.27
        name: nginx
        resources: {}
status: {}
```

把 `creationTimestamp: null`、`status: {}` 这类空字段删掉，就是一份干净的清单。同样的套路适用于很多资源：

```bash
kubectl run tmp --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600
kubectl create service clusterip web --tcp=80:80 --dry-run=client -o yaml
kubectl create configmap app-config --from-literal=LOG_LEVEL=debug --dry-run=client -o yaml
```

> [!NOTE] client 与 server 两种 dry-run
> `--dry-run=client` 只在本地渲染，不访问集群；`--dry-run=server` 会把请求发给 API Server 走完整的校验和准入流程但不落盘，能发现字段拼错、配额超限之类的问题。

## kubectl diff：改之前先看一眼

修改 `web.yaml` 里的副本数为 3、镜像为 `nginx:1.27-alpine`，先别急着 apply：

```bash
kubectl apply -f web.yaml       # 先创建
# 编辑 web.yaml 后：
kubectl diff -f web.yaml
```

```console
-  generation: 1
+  generation: 2
...
-  replicas: 2
+  replicas: 3
...
-      - image: nginx:1.27
+      - image: nginx:1.27-alpine
```

`diff` 把本地文件与集群里的实际对象（经过服务端 dry-run）对比。退出码为 0 表示无差异，1 表示有差异，大于 1 表示出错，所以可以放进 CI 流水线做变更检查。确认无误后再 `kubectl apply -f web.yaml`。

## kubeconfig 与 context

### kubectl 怎么知道连哪个集群

`kubectl` 读取 kubeconfig 文件，默认是 `~/.kube/config`，也可以用环境变量 `KUBECONFIG` 或 `--kubeconfig` 参数指定。kind 创建集群时自动把配置写进了这个文件。

kubeconfig 由三部分组成：

```text
clusters:   集群列表（API Server 地址 + CA 证书）
users:      凭据列表（客户端证书 / token / 插件）
contexts:   上下文 = 某个 cluster + 某个 user + 默认 namespace
current-context: 当前用哪个 context
```

```bash
kubectl config get-contexts
```

```console
CURRENT   NAME        CLUSTER     AUTHINFO    NAMESPACE
*         kind-kind   kind-kind   kind-kind
```

（如果你在上一课给 kind 集群起了别的名字，context 会是 `kind-<名字>`。）

```bash
kubectl config use-context kind-kind                 # 切换集群
kubectl config set-context --current --namespace=dev # 修改当前 context 的默认命名空间
kubectl config view --minify                         # 只看当前 context 相关配置
```

> [!DANGER] 永远确认你连的是哪个集群
> 同时管理测试和生产集群时，最常见的事故就是在错误的 context 下执行了 `delete`。建议在 shell 提示符里显示当前 context，或使用下面提到的 kubie 这类工具把每个终端绑定到一个集群。

## 让 kubectl 更顺手

### 别名与自动补全

```bash title="~/.bashrc"
alias k=kubectl
source <(kubectl completion bash)
complete -o default -F __start_kubectl k   # 让别名 k 也能补全
```

zsh 用户把 `bash` 换成 `zsh`，写进 `~/.zshrc`：

```bash
source <(kubectl completion zsh)
```

之后 `k get po <Tab>` 就能补全 Pod 名字。

### 几个值得装的小工具

- [kubie](https://github.com/sbstp/kubie)：每个 shell 独立的 context/namespace，多集群时防误操作，`kubie ctx kind-kind`、`kubie ns kube-system`。
- [stern](https://github.com/stern/stern)：同时 tail 多个 Pod 的日志，`stern web` 会跟踪所有名字含 `web` 的 Pod。
- [Headlamp](https://headlamp.dev/)：图形化的集群浏览器，适合刚入门时直观地看对象关系。

## 动手练习

1. 用 `kubectl explain` 找出 Deployment 里控制"保留多少个历史版本"的字段叫什么、放在哪一层。
2. 用 `--dry-run=client -o yaml` 生成一个 `web` Deployment 的 YAML，清理掉空字段后 `apply`。
3. 修改文件里的镜像版本，先用 `kubectl diff` 预览，再 `apply`，最后用 `-o jsonpath` 取出当前镜像名确认。
4. 用 `custom-columns` 输出 `kube-system` 命名空间里所有 Pod 的名字和所在节点。
5. 配置好别名 `k` 和补全，并在提示符或 kubie 里显示当前 context。

## 自测

<details>
<summary>一个对象里，哪些字段由你写，哪些由系统写？</summary>

`apiVersion`、`kind`、`metadata.name/namespace/labels/annotations`、`spec` 由你写；`metadata.uid`、`resourceVersion`、`creationTimestamp` 以及整个 `status` 由系统生成和维护。

</details>

<details>
<summary>`kubectl create -f` 和 `kubectl apply -f` 有什么区别？</summary>

`create` 是命令式的，对象已存在时报 `AlreadyExists`；`apply` 是声明式的，可重复执行，不存在则创建，存在则把文件与现有对象的差异合并进去。

</details>

<details>
<summary>Deployment 的 apiVersion 为什么是 `apps/v1` 而 Pod 是 `v1`？</summary>

Pod 属于核心（core）API 组，核心组的组名为空，所以只写版本 `v1`；Deployment 属于 `apps` 组，写成 `组/版本`。可以用 `kubectl api-resources` 查看每种资源所属的组和版本。

</details>

<details>
<summary>`--dry-run=client` 和 `--dry-run=server` 分别能发现什么问题？</summary>

`client` 只在本地渲染对象，适合生成模板，发现不了服务端校验问题；`server` 会经过 API Server 的完整校验和准入控制，能发现字段非法、配额不足、准入策略拒绝等问题，但不会真正持久化。

</details>

## 参考资料

- [Kubernetes 官方文档：Kubernetes 对象](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/)
- [Kubernetes 官方文档：命令行工具 (kubectl)](https://kubernetes.io/zh-cn/docs/reference/kubectl/)
- [Kubernetes 官方文档：kubectl 快速参考](https://kubernetes.io/zh-cn/docs/reference/kubectl/quick-reference/)
- [Kubernetes 官方文档：JSONPath 支持](https://kubernetes.io/zh-cn/docs/reference/kubectl/jsonpath/)
- [Kubernetes 官方文档：使用配置文件对 Kubernetes 对象进行声明式管理](https://kubernetes.io/zh-cn/docs/tasks/manage-kubernetes-objects/declarative-config/)
- [Kubernetes 官方文档：使用 kubeconfig 文件组织集群访问](https://kubernetes.io/zh-cn/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
