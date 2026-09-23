# CRD 与 Operator 模式

到这里你已经见过不少"不是 Kubernetes 自带"的资源：Cilium 的 `CiliumNetworkPolicy`、KEDA 的 `ScaledObject`、VPA 的 `VerticalPodAutoscaler`。它们和 Deployment 一样可以 `kubectl get`、`kubectl apply`，也受 RBAC 管控。这是怎么做到的？

答案是 **CRD（CustomResourceDefinition）** 加 **控制器**。CRD 让你向 apiserver 注册一种新的资源类型；控制器 watch 这种资源，把它的"期望状态"变成现实。把某个软件的部署、升级、备份、故障恢复等运维知识写进这样一个控制器，就叫 **Operator**。这一课先手写一个 CRD，理解 schema 校验和多版本，再讲控制器的 reconcile 模式，最后用 kubebuilder 勾勒一个最小 Operator，并看看生产中常用的几个 Operator。

## 为什么要扩展 API

假设你要在集群里跑 20 套 PostgreSQL。每套都需要 StatefulSet、Service、Secret、ConfigMap、备份 CronJob，主库挂了要做切换，升级大版本要按顺序操作。用 Helm 能解决"安装"，但解决不了"运行中持续维护"：没人会在凌晨 3 点主库宕机时帮你执行切换。

我们想要的是这样：

```yaml
apiVersion: db.example.com/v1
kind: PostgresCluster
metadata:
  name: orders
spec:
  version: "16"
  instances: 3
  storage: 100Gi
  backup:
    schedule: "0 2 * * *"
```

然后由一个程序 7×24 小时盯着它，自动创建、修复、升级、备份。这正是 Kubernetes 自己管理 Deployment 的方式——[控制平面深入](/learn/control-plane) 里的 Deployment 控制器，和你将要写的 Operator，本质上没有区别。

## CRD：注册一种新资源

### 最小可用的 CRD

```yaml title="crontab-crd.yaml"
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com      # 必须是 <plural>.<group>
spec:
  group: stable.example.com
  scope: Namespaced                      # 或 Cluster
  names:
    plural: crontabs
    singular: crontab
    kind: CronTab
    shortNames: ["ct"]
  versions:
    - name: v1
      served: true                       # 是否通过 API 提供这个版本
      storage: true                      # 在 etcd 中以哪个版本存储（有且仅有一个）
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: ["cronSpec", "image"]
              properties:
                cronSpec:
                  type: string
                  pattern: '^(\S+\s+){4}\S+$'
                image:
                  type: string
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
                  default: 1
                concurrencyPolicy:
                  type: string
                  enum: ["Allow", "Forbid", "Replace"]
                  default: Allow
              x-kubernetes-validations:
                - rule: "self.concurrencyPolicy != 'Allow' || self.replicas <= 3"
                  message: "replicas must be <= 3 when concurrencyPolicy is Allow"
            status:
              type: object
              properties:
                lastScheduleTime:
                  type: string
                  format: date-time
                phase:
                  type: string
      subresources:
        status: {}                       # 启用 /status 子资源
      additionalPrinterColumns:
        - name: Schedule
          type: string
          jsonPath: .spec.cronSpec
        - name: Phase
          type: string
          jsonPath: .status.phase
        - name: Age
          type: date
          jsonPath: .metadata.creationTimestamp
```

```bash
kubectl apply -f crontab-crd.yaml
kubectl get crd crontabs.stable.example.com
kubectl api-resources --api-group=stable.example.com
kubectl explain crontab.spec                 # schema 自动变成文档
```

### schema 校验在做什么

结构化 schema 是 `apiextensions.k8s.io/v1` 的强制要求，它让 apiserver 能像对待内置资源一样处理 CR：

- **类型与格式校验**：`type`、`pattern`、`enum`、`minimum/maximum`、`required`，不合法的请求直接返回 422。
- **默认值**：`default` 在写入时自动填充。
- **字段裁剪（Pruning）**：schema 中没定义的字段会被静默丢弃，防止拼错的字段悄悄存进去。确实需要任意内容的字段可用 `x-kubernetes-preserve-unknown-fields: true`。
- **CEL 校验规则**：`x-kubernetes-validations`（v1.29 GA）可以表达跨字段约束，还能用 `oldSelf` 实现"字段创建后不可修改"这类转换规则，例如 `rule: "self == oldSelf"`。

试一下：

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: stable.example.com/v1
kind: CronTab
metadata:
  name: bad
spec:
  cronSpec: "every minute"
  image: busybox
  replicas: 20
  colour: red
EOF
# The CronTab "bad" is invalid:
# * spec.cronSpec: Invalid value: "every minute": spec.cronSpec in body should match '^(\S+\s+){4}\S+$'
# * spec.replicas: Invalid value: 20: spec.replicas in body should be less than or equal to 10
# * spec: Invalid value: "object": replicas must be <= 3 when concurrencyPolicy is Allow
```

最后一条来自 CEL 规则：`concurrencyPolicy` 没写，但默认值 `Allow` 已经在校验前被填充。

`colour` 字段不会报错，而是被裁剪掉——改成合法值后 apply 再 `kubectl get ct bad -o yaml` 看看它去哪了。

### status 子资源

启用 `subresources.status` 后，`spec` 和 `status` 走不同的端点：

- 用户通过主资源更新 `spec`，对 `status` 的修改会被忽略；
- 控制器通过 `/status` 子资源更新 `status`，对 `spec` 的修改会被忽略；
- 只有 `spec` 变化时 `metadata.generation` 才会递增。控制器把已处理的 generation 写到 `status.observedGeneration`，用户就能判断"我最新的改动是否已被处理"。

这套约定和 Deployment 完全一致，也方便用 RBAC 分别授权 `crontabs` 和 `crontabs/status`。

### 多版本与转换

API 总会演进：`v1alpha1` → `v1beta1` → `v1`。CRD 的 `versions` 可以列出多个版本：

- 同一时刻只能有一个 `storage: true` 的版本，etcd 中的对象以它为准。
- 客户端请求另一个版本时，apiserver 需要转换。字段完全兼容时用 `conversion.strategy: None`（只改 apiVersion）；字段有变化时需要部署一个 **转换 Webhook**（`strategy: Webhook`）。
- 旧版本可以设 `deprecated: true` 和 `deprecationWarning`，客户端使用时会收到警告。
- 切换存储版本后，etcd 中旧对象不会自动改写，需要做一次存储迁移（读出再写回），之后才能从 `status.storedVersions` 中去掉旧版本。

> [!WARNING] 删除 CRD 会删除所有 CR
> `kubectl delete crd crontabs.stable.example.com` 会级联删除集群中所有 CronTab 对象。对 cert-manager、Rook 这类 Operator，删除 CRD 可能等于删除所有证书配置或存储集群定义。卸载和升级 Operator 时务必先阅读官方文档，Helm 默认也不会在升级时更新或在卸载时删除 `crds/` 目录中的 CRD。

## 控制器模式与 Reconcile

CRD 只负责"存"，不负责"做"。光有 CRD，你创建的 CronTab 只是 etcd 里的一条记录。让它产生效果的是 **控制器**。

### 水平触发，而不是边沿触发

控制器的核心是 **Reconcile（调和）函数**：

```text
          ┌───────────────── watch 事件（CR、子资源变化）─────────────────┐
          ▼                                                              │
   WorkQueue（按 namespace/name 去重）                                    │
          │                                                              │
          ▼                                                              │
   Reconcile(namespace/name):                                            │
     1. 读取 CR 的当前 spec（期望状态）                                     │
     2. 读取它拥有的子资源（实际状态）                                       │
     3. 计算差异，创建/更新/删除子资源，使实际趋近期望 ──────────────────────┘
     4. 更新 CR 的 status
     5. 返回：成功 / 出错重试（指数退避）/ N 秒后再来
```

几条关键原则：

- **只看当前状态，不看事件内容**。Reconcile 的输入只有对象名，不关心"是新增还是修改"。无论错过多少事件，只要最终被调用一次，就能把状态纠正过来。这叫水平触发（Level-triggered）。
- **幂等**。同样的输入执行一次和执行十次结果相同。永远"确保存在"而不是"创建"。
- **用 ownerReferences 建立从属关系**。子资源设置 controller owner 后，删除 CR 时垃圾回收自动级联删除；子资源被改动时也会触发父对象的 Reconcile。
- **需要清理外部资源时用 Finalizer**。例如 CR 对应一个云上的负载均衡，删除 CR 前控制器要先删掉它，然后移除 finalizer，对象才真正消失。

### Operator 成熟度模型

Operator Framework 把 Operator 的能力分成五级，可用来评估一个开源 Operator 是否值得在生产中使用：

| 级别 | 名称 | 能力 |
|---|---|---|
| 1 | Basic Install | 自动化安装和配置 |
| 2 | Seamless Upgrades | 支持软件版本和 Operator 自身的平滑升级 |
| 3 | Full Lifecycle | 备份、恢复、故障切换等完整生命周期管理 |
| 4 | Deep Insights | 提供指标、告警、日志分析 |
| 5 | Auto Pilot | 自动扩缩、自动调优、异常自愈 |

只做到第 1 级的 Operator，本质上和 Helm Chart 差别不大；数据库类 Operator 至少要达到第 3 级才有意义。

## 用 kubebuilder 构建最小 Operator

[kubebuilder](https://book.kubebuilder.io/) 是 SIG API Machinery 维护的 Operator 脚手架，底层使用 [controller-runtime](https://github.com/kubernetes-sigs/controller-runtime)。它负责生成项目骨架、CRD YAML、RBAC 和 Webhook 配置，你只需要写类型定义和 Reconcile 逻辑。Operator SDK 的 Go 部分也构建在 kubebuilder 之上。

目标：定义一个 `WebApp` 资源，声明镜像和副本数，控制器自动维护对应的 Deployment 和 Service。

### 生成项目

```bash
# 需要 Go 与 kubebuilder，版本以官方发布为准
kubebuilder init --domain example.com --repo example.com/webapp-operator
kubebuilder create api --group apps --version v1alpha1 --kind WebApp --resource --controller
```

生成的主要目录：

```text
webapp-operator/
├── api/v1alpha1/
│   └── webapp_types.go          # ← 定义 Spec/Status，CRD schema 从这里生成
├── internal/controller/
│   └── webapp_controller.go     # ← 写 Reconcile 逻辑
├── cmd/main.go                  # Manager 启动入口：注册 scheme、控制器、健康检查、选主
├── config/
│   ├── crd/                     # make manifests 生成的 CRD YAML
│   ├── rbac/                    # 由 +kubebuilder:rbac 标记生成的 ClusterRole（含聚合角色）
│   ├── manager/                 # Operator 自身的 Deployment
│   └── samples/                 # 示例 CR
└── Makefile                     # make manifests / generate / install / run / deploy
```

### 定义类型

```go title="api/v1alpha1/webapp_types.go"
// WebAppSpec 定义期望状态
type WebAppSpec struct {
	// +kubebuilder:validation:MinLength=1
	Image string `json:"image"`

	// +kubebuilder:validation:Minimum=1
	// +kubebuilder:validation:Maximum=20
	// +kubebuilder:default=2
	Replicas int32 `json:"replicas,omitempty"`

	// +kubebuilder:default=8080
	Port int32 `json:"port,omitempty"`
}

// WebAppStatus 定义观察到的状态
type WebAppStatus struct {
	ReadyReplicas      int32              `json:"readyReplicas,omitempty"`
	ObservedGeneration int64              `json:"observedGeneration,omitempty"`
	Conditions         []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Image",type=string,JSONPath=`.spec.image`
// +kubebuilder:printcolumn:name="Ready",type=integer,JSONPath=`.status.readyReplicas`
type WebApp struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WebAppSpec   `json:"spec,omitempty"`
	Status WebAppStatus `json:"status,omitempty"`
}
```

`// +kubebuilder:` 开头的注释叫 **标记（Marker）**，`make manifests` 会把它们翻译成 CRD 中的 openAPIV3Schema、`subresources`、`additionalPrinterColumns`——和我们前面手写的 YAML 是同一回事。

### 编写 Reconcile

```go title="internal/controller/webapp_controller.go"
// +kubebuilder:rbac:groups=apps.example.com,resources=webapps,verbs=get;list;watch;update;patch
// +kubebuilder:rbac:groups=apps.example.com,resources=webapps/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=services,verbs=get;list;watch;create;update;patch;delete

func (r *WebAppReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	// 1. 读取 CR；已被删除则什么都不做（子资源由 ownerReferences 级联删除）
	var app appsv1alpha1.WebApp
	if err := r.Get(ctx, req.NamespacedName, &app); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// 2. 确保 Deployment 存在且与 spec 一致（幂等：CreateOrUpdate）
	deploy := &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: app.Name, Namespace: app.Namespace}}
	op, err := controllerutil.CreateOrUpdate(ctx, r.Client, deploy, func() error {
		labels := map[string]string{"app.kubernetes.io/name": app.Name}
		deploy.Spec.Replicas = &app.Spec.Replicas
		deploy.Spec.Selector = &metav1.LabelSelector{MatchLabels: labels}
		deploy.Spec.Template.Labels = labels
		deploy.Spec.Template.Spec.Containers = []corev1.Container{{
			Name:  "app",
			Image: app.Spec.Image,
			Ports: []corev1.ContainerPort{{ContainerPort: app.Spec.Port}},
		}}
		// 设置 controller owner：删除 WebApp 时 Deployment 被级联删除
		return controllerutil.SetControllerReference(&app, deploy, r.Scheme)
	})
	if err != nil {
		return ctrl.Result{}, err // 返回错误 → 自动指数退避重试
	}
	log.Info("reconciled deployment", "operation", op)

	// 3. Service 同理（省略）

	// 4. 回写 status（走 /status 子资源）
	app.Status.ReadyReplicas = deploy.Status.ReadyReplicas
	app.Status.ObservedGeneration = app.Generation
	if err := r.Status().Update(ctx, &app); err != nil {
		return ctrl.Result{}, err // 409 冲突也会在这里被重试
	}
	return ctrl.Result{}, nil
}

// SetupWithManager 声明要 watch 什么
func (r *WebAppReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&appsv1alpha1.WebApp{}).     // 主资源变化 → Reconcile 它
		Owns(&appsv1.Deployment{}).      // 子资源变化 → Reconcile 其 owner
		Owns(&corev1.Service{}).
		Complete(r)
}
```

注意这段代码中体现的控制器原则：不区分创建还是更新，每次都"确保"；错误直接返回让框架重试；`Owns()` 让别人手工改了 Deployment 副本数时，控制器立刻被唤醒并改回去。`r.Get` 读的是 Informer 本地缓存，写操作才访问 apiserver。

### 运行与部署

```bash
make manifests generate      # 根据标记生成 CRD、RBAC 和 DeepCopy 代码
make install                 # 把 CRD 安装到当前 kubeconfig 指向的集群
make run                     # 在本机以当前 kubeconfig 运行控制器，便于调试

kubectl apply -f config/samples/apps_v1alpha1_webapp.yaml
kubectl get webapp,deploy
kubectl scale deploy webapp-sample --replicas=5   # 控制器会把它改回 spec 中的值

# 正式部署：构建镜像并加载到 kind
make docker-build IMG=webapp-operator:dev
kind load docker-image webapp-operator:dev
make deploy IMG=webapp-operator:dev
```

`make deploy` 部署的 Operator 以 Deployment 运行，默认开启领导者选举（Lease），多副本时只有一个在执行 Reconcile。

> [!TIP] 写 Operator 之前先问自己
> - 能否用现成的 Operator 或 Helm Chart 解决？自研 Operator 意味着长期维护一套分布式系统代码。
> - 需要"持续维护"吗？如果只是模板化安装，Helm/Kustomize 更简单。
> - 只是想给某个资源加默认值或校验？ValidatingAdmissionPolicy / MutatingAdmissionPolicy 就够了。

## 生产中常见的 Operator

| Operator | 管理对象 | 代表性 CRD | 本教程中的位置 |
|---|---|---|---|
| [cert-manager](https://cert-manager.io/) | TLS 证书的签发与自动续期（ACME/Let's Encrypt、自建 CA） | `Issuer`、`ClusterIssuer`、`Certificate` | [生产网络](/learn/production-networking) |
| [Rook](https://rook.io/) | 在 K8s 中部署和运维 Ceph 分布式存储 | `CephCluster`、`CephBlockPool`、`CephFilesystem` | [生产存储](/learn/production-storage) |
| [NVIDIA GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/) | GPU 驱动、容器工具包、Device Plugin、DCGM 监控 | `ClusterPolicy`、`NVIDIADriver` | [GPU 调度与 GPU Operator](/learn/gpu-operator) |
| Prometheus Operator | Prometheus/Alertmanager 实例及抓取配置 | `ServiceMonitor`、`PrometheusRule` | [可观测性](/learn/observability) |
| CloudNativePG | PostgreSQL 高可用集群、备份与恢复 | `Cluster`、`Backup` | — |

以 cert-manager 为例：你只声明一个 `Certificate`（域名、签发者、存放证书的 Secret 名），它的控制器就会完成 ACME 验证、生成私钥、把证书写进 Secret，并在过期前自动续期——这就是"把运维知识写成代码"。

## 动手练习

1. 应用本课的 `crontab-crd.yaml`，用 `kubectl explain crontab.spec --recursive` 查看生成的文档，再创建一个合法的 CronTab，用 `kubectl get ct` 观察自定义列。
2. 故意提交违反 CEL 规则（`concurrencyPolicy: Allow` 且 `replicas: 5`）的对象，读懂报错；再添加一条 `self == oldSelf` 的规则让 `image` 字段创建后不可修改，并验证。
3. 为 CronTab 编写一个带 `rbac.authorization.k8s.io/aggregate-to-view: "true"` 标签的 ClusterRole，确认绑定了内置 `view` 的用户能读取 CronTab（回顾 [认证、授权与 RBAC](/learn/rbac)）。
4. 用 kubebuilder 生成 WebApp 项目并补全 Reconcile，`make run` 后手动删除它创建的 Deployment，观察控制器日志与 Deployment 的重建。
5. 列出你的集群里所有 CRD（`kubectl get crd`），挑一个看看它属于哪个 Operator，以及它的 `versions` 与 `storedVersions`。

## 自测

<details>
<summary>只创建了 CRD 而没有部署控制器，创建一个 CR 会发生什么？</summary>

CR 会通过校验并存入 etcd，可以正常 get/list/watch，但不会产生任何实际效果——没有程序读取它并据此行动。CRD 只扩展 API 的"存储与接口"，行为来自控制器。

</details>

<details>
<summary>为什么说 Reconcile 应该是"水平触发"和"幂等"的？</summary>

控制器可能错过事件、重启、或被同一对象的多次变更合并为一次调用。如果逻辑依赖事件类型（"收到创建事件就创建"），错过事件就会导致状态永久不一致。Reconcile 每次都读取当前完整状态并计算差异，执行多少次都收敛到同一结果，因此可以放心地重试和重复执行。

</details>

<details>
<summary>status 子资源有什么用？metadata.generation 和 status.observedGeneration 的关系是什么？</summary>

status 子资源把 spec 和 status 的写入分开：用户改 spec，控制器改 status，互不覆盖，也能分别授权。只有 spec 变化时 generation 才递增；控制器处理完后把 generation 写入 observedGeneration。两者相等说明最新的期望已被控制器处理过。

</details>

<details>
<summary>在 WebApp 控制器中，为什么要调用 SetControllerReference，并在 SetupWithManager 中写 Owns(&appsv1.Deployment{})？</summary>

SetControllerReference 在 Deployment 上设置指向 WebApp 的 ownerReference：删除 WebApp 时垃圾回收会级联删除 Deployment；同时 `Owns()` 让控制器 watch Deployment，任何 Deployment 变化都会映射回其 owner WebApp 并触发 Reconcile，从而纠正被手动改动的子资源。

</details>

<details>
<summary>为什么卸载一个 Operator 时要特别小心 CRD？</summary>

删除 CRD 会级联删除该类型的所有 CR。对 Rook 等 Operator 而言，CR 代表的是存储集群等关键定义，控制器可能据此清理底层资源，导致数据丢失。应按官方卸载流程操作，并在删除前备份 CR。

</details>

## 参考资料

- [Kubernetes 官方文档：定制资源](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Kubernetes 官方文档：使用 CustomResourceDefinition 扩展 Kubernetes API](https://kubernetes.io/zh-cn/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
- [Kubernetes 官方文档：CRD 的版本](https://kubernetes.io/zh-cn/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/)
- [Kubernetes 官方文档：Operator 模式](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/operator/)
- [Kubernetes 官方文档：控制器](https://kubernetes.io/zh-cn/docs/concepts/architecture/controller/)
- [The Kubebuilder Book](https://book.kubebuilder.io/)
- [Operator Framework：Operator Capability Levels](https://sdk.operatorframework.io/docs/overview/operator-capabilities/)
