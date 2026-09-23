# 用 Helm 与 Kustomize 管理应用

到目前为止，我们都是手写 YAML 再 `kubectl apply`。一旦部署真实的组件，问题就来了：一个 Ingress 控制器或监控系统动辄几十个对象、上千行 YAML；开发、测试、生产环境之间只有副本数和镜像标签不同，却要维护三份几乎一样的文件；升级到新版本时，你还得搞清楚哪些对象该删、哪些该改。**Helm** 和 **Kustomize** 是社区解决这些问题的两种主流工具，思路截然不同，实践中经常配合使用。

学完这一课，你能用 Helm 安装、配置、升级和回滚第三方应用，看懂 Chart 模板的基本语法；用 Kustomize 的 base/overlay 管理多环境差异；并了解如何用 Helmwave 把"Helm Release + 覆盖值 + 附加资源"组织成可复现的声明式部署。

## 两种思路

| | Helm | Kustomize |
|---|---|---|
| 方式 | 模板渲染：YAML 里写 `{{ .Values.x }}`，用参数填充 | 叠加修补：对普通 YAML 打补丁，不引入模板语言 |
| 打包分发 | Chart，可发布到仓库或 OCI 镜像仓库 | 目录或 Git 地址 |
| 版本记录 | 有 Release 与修订历史，可回滚 | 无状态，只负责生成 YAML |
| 集成方式 | 独立命令行 `helm` | 内置于 `kubectl`（`kubectl apply -k`） |
| 适合 | 安装第三方软件；需要大量参数化的场景 | 自己维护的应用；对第三方输出做少量修改 |

一个简单的判断：**别人写好的软件用 Helm 装，自己的配置用 Kustomize 管**。

## Helm

### 核心概念

- **Chart**：一个应用的安装包，包含模板、默认值 `values.yaml` 和元数据 `Chart.yaml`。
- **Repository**：存放 Chart 的仓库。可以是传统的 HTTP 仓库（带 `index.yaml`），也可以是 OCI 镜像仓库（`oci://` 开头，和容器镜像放在一起）。
- **Release**：Chart 在集群中的一次安装实例。同一个 Chart 可以装多次，每次一个 Release 名。
- **Revision**：Release 每次升级或回滚都产生一个新修订版本，信息保存在 Release 所在命名空间的 Secret 中。

截至本文写作时，Helm 最新大版本是 Helm 4（v4.3），与 Helm 3 的 Chart 和常用命令保持兼容；Helm 2 时代的 Tiller 早已不复存在，Helm 直接使用你的 kubeconfig 权限。安装：

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash
helm version
```

### 安装第一个 Chart

以轻量的演示应用 podinfo 为例：

```bash
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm repo update
helm search repo podinfo/ --versions | head -5      # 查看可用版本
helm show values podinfo/podinfo | less              # 查看所有可配置项及默认值
```

`helm show values` 是使用任何 Chart 前最重要的一步：它就是这个 Chart 的"配置手册"。

```bash
helm install podinfo podinfo/podinfo \
  --namespace demo --create-namespace \
  --version 6.15.0 \
  --set replicaCount=2
helm list -n demo
kubectl -n demo get deploy,svc,pod
kubectl -n demo port-forward svc/podinfo 9898:9898 &
curl -s localhost:9898 | head
```

> [!TIP] 始终固定 Chart 版本
> 不写 `--version` 会安装最新版，今天和下个月执行同一条命令可能装出不同的东西。无论命令行还是编排文件，都要显式固定版本号。

### 用 values 文件覆盖配置

`--set` 适合临时改一两个值；正式的配置应写进 values 文件，纳入 Git 管理：

```yaml title="podinfo-values.yaml"
replicaCount: 3
ui:
  message: "来自 k8s-journey 的问候"
  color: "#34577c"
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    memory: 128Mi
```

```bash
helm upgrade podinfo podinfo/podinfo -n demo --version 6.15.0 -f podinfo-values.yaml
helm get values podinfo -n demo          # 查看这个 Release 用了哪些自定义值
helm history podinfo -n demo             # REVISION 1、2
```

合并优先级从低到高：Chart 自带的 `values.yaml` → 按顺序的多个 `-f` 文件 → `--set`。常见做法是 `-f values.yaml -f values-prod.yaml`，后者只写生产环境的差异。

> [!WARNING] upgrade 不会自动保留 --set 的值
> `helm upgrade` 默认以 Chart 默认值加上**本次命令**提供的值重新渲染。上次用 `--set` 设置、这次忘了带上的值会被还原成默认值。这正是应该把配置写进 values 文件的原因（`--reuse-values` 可以复用上次的值，但容易让配置变得不可追溯）。

### 升级、回滚与卸载

```bash
helm upgrade --install podinfo podinfo/podinfo -n demo \
  --version 6.15.0 -f podinfo-values.yaml --wait   # 不存在则安装，存在则升级；幂等，适合脚本
helm rollback podinfo 1 -n demo                   # 回滚到修订 1（会生成新的修订 3）
helm get manifest podinfo -n demo | less          # 查看实际下发的 YAML
helm uninstall podinfo -n demo
```

`--wait` 会等待资源就绪才返回，适合在 CI 中使用。注意：Chart 的 `crds/` 目录中的 CRD 只在首次安装时创建，`helm upgrade` 不会更新、`helm uninstall` 也不会删除，CRD 需要单独管理。

`helm template podinfo podinfo/podinfo --version 6.15.0 -f podinfo-values.yaml` 在本地渲染出最终 YAML，不连集群。可以用它审查 Chart 到底会创建什么，或者交给其他工具（如 Kustomize、GitOps 系统）继续处理。

### 模板入门

`helm create mychart` 生成的目录中，`Chart.yaml` 记录名称、Chart 版本（version）和应用版本（appVersion），`values.yaml` 是默认值，`templates/` 下是 `deployment.yaml`、`service.yaml` 等模板，以及存放可复用命名模板的 `_helpers.tpl`。

```yaml title="mychart/templates/deployment.yaml（节选）"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

- `.Values`、`.Chart`、`.Release` 是内置对象，分别对应 values、Chart.yaml 和 Release 信息（如 `.Release.Namespace`）。
- `include` 调用 `_helpers.tpl` 中定义的命名模板；`|` 是管道，`default` 提供缺省值。
- `toYaml ... | nindent 12` 把一段 values 原样转成 YAML 并缩进 12 格，是处理嵌套结构的惯用法；`{{-` 会去掉左侧空白。

```bash
helm lint mychart
helm template test mychart --set replicaCount=5 | grep replicas
```

模板写多了容易变成"用 YAML 编程"，可读性很差。对于自己的应用，下面的 Kustomize 往往更合适。

## Kustomize

### base 与 overlay

Kustomize 的核心文件是 `kustomization.yaml`，它声明"用哪些资源、做哪些修改"。典型的多环境目录：

```text
myapp/
├── base/                    所有环境共用的原始 YAML
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml     引用 ../../base，改副本数、加前缀
    └── prod/
        ├── kustomization.yaml
        └── patch-resources.yaml
```

```yaml title="base/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
labels:
  - pairs:
      app.kubernetes.io/part-of: myapp
    includeSelectors: false
```

`deployment.yaml` 和 `service.yaml` 就是普通的 YAML，可以直接用 [Deployment](/learn/deployments) 一课中的 `web` 示例。

```yaml title="overlays/prod/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: myapp-prod
resources:
  - ../../base
images:
  - {name: nginx, newTag: "1.27.3"}    # 把所有 nginx 镜像改成指定标签
replicas:
  - {name: web, count: 4}
patches:
  - path: patch-resources.yaml   # 策略性合并补丁（Strategic Merge Patch）
  - target: {kind: Service, name: web}   # JSON6902 补丁，精确操作某个字段
    patch: |-
      - op: replace
        path: /spec/type
        value: NodePort
configMapGenerator:
  - name: web-config
    literals:
      - LOG_LEVEL=warn
```

```yaml title="overlays/prod/patch-resources.yaml"
apiVersion: apps/v1
kind: Deployment
metadata: {name: web}
spec:
  template:
    spec:
      containers:
        - name: web
          resources:
            requests: {cpu: 200m, memory: 256Mi}
            limits: {memory: 256Mi}
```

策略性合并补丁看起来就是"原 YAML 的一个片段"，Kustomize 按 `name` 找到对应容器合并字段；JSON6902 补丁则用 `op`/`path` 精确地增删改，适合改列表中的某一项或删除字段。

```bash
kubectl kustomize overlays/prod          # 只渲染，查看结果
kubectl apply -k overlays/prod           # 渲染并应用
kubectl delete -k overlays/prod
```

> [!NOTE] configMapGenerator 的哈希后缀
> 生成的 ConfigMap 名字形如 `web-config-5t8k2h9m4c`，后缀是内容哈希，引用它的 Deployment 会被自动改写成新名字。于是**配置一变，Pod 模板就变，Deployment 自动滚动更新**，解决了 [ConfigMap 一课](/learn/configmaps-secrets)中"改了配置 Pod 不重启"的问题。

### 引用远程资源

`resources` 可以直接写 URL 或 Git 地址，适合"用上游的 YAML，只做少量修改"。团队部署 local-path-provisioner 就是这样做的：引用上游固定版本的 YAML，再用补丁把它改成双副本并固定到控制平面节点：

```yaml title="storage/local-storage/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.36/deploy/local-path-storage.yaml
patches:
  - path: patch.yaml    # replicas: 2、控制平面亲和性与容忍、多个 StorageClass 的路径映射
```

同样的手法也用于安装 Gateway API CRD：`resources: [https://github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.5.1]`，`ref` 固定版本。

### 在 Kustomize 中使用 Helm Chart

`helmCharts` 字段让 Kustomize 先调用 Helm 渲染 Chart，再对结果打补丁，适合"Chart 缺一个参数，但我又不想 fork"的情况：

```yaml title="podinfo-kustomize/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: demo
helmCharts:
  - name: podinfo
    repo: https://stefanprodan.github.io/podinfo
    version: 6.15.0
    releaseName: podinfo
    valuesInline:
      replicaCount: 2
patches:
  - target: {kind: Deployment, name: podinfo}
    patch: |-
      - op: add
        path: /spec/template/spec/priorityClassName
        value: high                 # 调度一课中创建的 PriorityClass
```

渲染命令是 `kubectl kustomize --enable-helm podinfo-kustomize`，需要本机安装 `helm` 并显式加 `--enable-helm`。注意这种方式只使用 Helm 的渲染能力，产生的资源**不是** Helm Release，`helm list` 看不到，也没有 `helm rollback`。

## Helmwave：声明式地编排 Release

`helm install` 是命令式的：装了什么、用的哪个版本和哪些参数，都藏在某个人的 shell 历史里。团队中常见的做法是把 Release 写成声明文件，由工具统一执行。Helmfile 和 [Helmwave](https://docs.helmwave.app/) 是这类工具的代表，团队选用 Helmwave（截至本文写作时 v0.44）。

### 每个组件一个目录

团队仓库中每个组件一个目录，约定三件套：

```text
network/metallb/
├── helmwave.yml          声明仓库、Chart、版本、命名空间、values 文件
├── values.yml            对 Chart 默认值的覆盖（只写差异）
└── kustomization.yaml    Chart 之外的附加资源（引用 default-pool.yaml 等 CR）
```

```yaml title="network/metallb/helmwave.yml"
repositories:
  - {name: metallb, url: https://metallb.github.io/metallb}
releases:
  - name: metallb
    namespace: metallb-system
    create_namespace: true
    chart: {name: metallb/metallb, version: 0.15.3}
    values: [values.yml]
```

`values.yml` 里只写必须改的内容，例如把 controller 固定到控制平面节点（写法见[调度](/learn/scheduling)一课）。而 MetalLB 的 IP 地址池是 CRD 对象，不属于 Chart，放进 Kustomize：

```yaml title="network/metallb/default-pool.yaml"
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata: {name: default, namespace: metallb-system}
spec:
  addresses:
    - 192.168.10.200-192.168.10.210    # 向数据中心管理员申请的空闲地址段
```

部署流程固定为"先 Chart，等就绪，再附加资源"：

```bash
helmwave up --build        # build 生成执行计划（.helmwave/），up 执行安装或升级
kubectl wait -n metallb-system --for=condition=ready pod -l app.kubernetes.io/instance=metallb
kubectl apply -k .
# 卸载时反序
kubectl delete -k . && helmwave down
```

### 多 Release、依赖与生命周期钩子

复杂组件会有多个 Release 和前置步骤。团队部署 kgateway 的编排文件（镜像仓库地址已替换）：

```yaml title="network/kgateway/helmwave.yml"
registries:
  - host: registry.example.com          # OCI Chart 所在的内部镜像仓库
lifecycle:
  pre_up:                               # 安装前先装 Gateway API CRD（Kustomize 远程引用）
    - kubectl apply -k gateway-api
  post_down:
    - kubectl delete -k gateway-api
releases:
  - name: kgateway-crds
    namespace: kgateway-system
    create_namespace: true
    chart:
      name: oci://registry.example.com/kgateway-dev/charts/kgateway-crds
      version: v2.1.1
  - name: kgateway
    namespace: kgateway-system
    chart:
      name: oci://registry.example.com/kgateway-dev/charts/kgateway
      version: v2.1.1
    values: [values.yml]
    depends_on: [kgateway-crds]         # 等 CRD Release 完成后再装控制器
```

这个文件体现了三个工具的分工：**Helm** 负责安装与升级第三方软件；**Kustomize** 负责上游 YAML 和 Chart 之外的资源；**Helmwave** 把它们的顺序和版本固定下来，使整个组件可以一条命令复现。

> [!PROD] 生产中的包管理习惯
> - Chart 版本、镜像标签、CRD 的 `ref` 全部固定，升级时在 Git 中修改并评审。
> - values 文件只写与默认值的差异，升级 Chart 前用 `helm show values` 对比新旧默认值，用 `helm template` 预览渲染结果。
> - 离线或网络受限的集群，把 Chart 推送到内部 OCI 仓库（`helm push`），Helmwave 通过 `registries` 登录后拉取。
> - 进一步可以交给 Argo CD 或 Flux 这类 GitOps 工具持续同步，它们原生支持 Helm 和 Kustomize。

## 动手练习

1. 用 Helm 安装 podinfo，通过 values 文件修改 `ui.message` 和 `ui.color`，浏览器访问 port-forward 地址查看效果；然后回滚到第一个修订。
2. 升级时只用 `--set replicaCount=4`，不带 values 文件，再用 `helm get values` 查看 `ui.message` 发生了什么。
3. 为 [Deployment](/learn/deployments) 一课的 `web` 应用建立 `base`、`overlays/dev`、`overlays/prod` 三个目录，dev 使用 1 个副本并加 `namePrefix: dev-`，prod 使用 4 个副本和资源补丁，分别用 `kubectl kustomize` 对比输出。
4. 在 overlay 中加入 `configMapGenerator`，并在 Deployment 中通过 `envFrom` 引用它，修改其中一个值后重新 `apply -k`，观察 Deployment 是否触发滚动更新。
5. 安装 Helmwave，为 podinfo 写一个 `helmwave.yml` + `values.yml`，用 `helmwave up --build` 部署、`helmwave down` 卸载。

## 自测

<details>
<summary>Helm 的 Chart、Release、Revision 分别是什么？</summary>

Chart 是应用的安装包（模板 + 默认值 + 元数据）；Release 是 Chart 在集群中的一次安装实例，有自己的名字和命名空间；Revision 是 Release 的修订版本，每次安装、升级、回滚都会递增，可用于 `helm rollback`。

</details>

<details>
<summary>多个 -f 和 --set 同时使用时，哪个值最终生效？</summary>

优先级从低到高依次是：Chart 的默认 values.yaml、按命令行顺序的各个 `-f` 文件（后面的覆盖前面的）、`--set` 参数。`--set` 最终生效。

</details>

<details>
<summary>为什么修改了 Chart 里的 CRD，helm upgrade 后集群中的 CRD 却没有变化？</summary>

Helm 只在首次安装时创建 `crds/` 目录中的 CRD，升级时不会更新，卸载时也不会删除，以免误删 CRD 导致所有自定义资源丢失。因此许多项目单独提供 CRD Chart（如 kgateway-crds）或需要用 kubectl/Kustomize 单独管理 CRD。

</details>

<details>
<summary>Kustomize 的策略性合并补丁和 JSON6902 补丁有什么区别？</summary>

策略性合并补丁写成目标资源的一个 YAML 片段，按字段合并，列表元素按 `name` 等键匹配，直观易读；JSON6902 补丁用 `op`、`path`、`value` 精确描述增、删、改、替换操作，适合删除字段或修改列表中特定位置的元素，需要用 `target` 指定目标资源。

</details>

<details>
<summary>在团队的组件目录中，helmwave.yml、values.yml、kustomization.yaml 各负责什么？</summary>

`helmwave.yml` 声明要安装的 Chart 仓库、Chart 名、固定版本、命名空间、依赖和钩子；`values.yml` 保存对 Chart 默认值的覆盖；`kustomization.yaml` 管理 Chart 之外的资源，例如 MetalLB 的 IP 地址池或 Gateway API CRD，在 Chart 安装就绪后用 `kubectl apply -k` 应用。

</details>

## 参考资料

- [Helm 官方文档（中文）](https://helm.sh/zh/docs/)
- [Helm 官方文档：Chart 模板指南](https://helm.sh/zh/docs/chart_template_guide/)
- [Kubernetes 官方文档：使用 Kustomize 对 Kubernetes 对象进行声明式管理](https://kubernetes.io/zh-cn/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Kustomize 文档（中文）](https://kubectl.docs.kubernetes.io/zh/)
- [Kustomize 文档：helmCharts](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/helmcharts/)
- [Helmwave 文档](https://docs.helmwave.app/)
- [podinfo 项目主页](https://github.com/stefanprodan/podinfo)
