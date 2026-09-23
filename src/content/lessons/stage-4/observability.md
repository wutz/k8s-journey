# 可观测性：指标、日志与事件

集群跑起来之后，接下来的问题是"它现在好不好"。节点磁盘还剩多少？某个 Pod 为什么半夜重启了三次？etcd 离配额还有多远？没有可观测性（Observability），这些问题只能靠 `kubectl` 挨个去翻，而且很多答案在你去翻之前就已经消失了：Pod 被删了日志跟着没了，Event 默认只保留 1 小时。

这一课按生产实践搭一套完整的可观测性栈：用 VictoriaMetrics（兼容 Prometheus）采集和存储指标，用 Grafana 看图，用 Loki 或 VictoriaLogs 收集日志，用 kubernetes-event-exporter 把事件持久化，最后写几条真正有用的告警规则。学完你能说清每类信号该用什么工具，能给自己的应用接入监控和告警。

## 四类信号

| 信号 | 回答的问题 | 典型数据 | 常用工具 |
|---|---|---|---|
| 指标（Metrics） | 现在怎么样？趋势如何？ | CPU 使用率、请求 QPS、etcd DB 大小 | Prometheus、VictoriaMetrics |
| 日志（Logs） | 具体发生了什么？ | 应用输出的每一行文本 | Loki、VictoriaLogs、Elasticsearch |
| 事件（Events） | K8s 对这个对象做了什么？ | `FailedScheduling`、`BackOff`、`Killing` | kubernetes-event-exporter |
| 链路（Traces） | 一个请求经过了哪些服务、慢在哪？ | Span 树 | OpenTelemetry、Jaeger、Tempo |

排查问题的顺序通常是：**告警（来自指标）→ 看面板定位范围 → 查事件看 K8s 做了什么 → 查日志看应用说了什么 → 必要时看链路**。四类信号缺一个，排查就会在某一步卡住。

> [!NOTE] 事件为什么单独算一类
> Event 是 API 对象，存在 etcd 里，由 apiserver 的 `--event-ttl` 控制保留时间（默认 1 小时，Kubespray 里对应变量 `event_ttl_duration`）。它不是日志，也不是指标，但对排查 K8s 自身行为极其关键。凌晨三点发生的 `OOMKilling`，早上九点你用 `kubectl get events` 已经看不到了。

## 指标栈：为什么选 VictoriaMetrics

Prometheus 是云原生指标的事实标准：拉（Pull）模式抓取 `/metrics` 端点、PromQL 查询语言、Prometheus Operator 用 `ServiceMonitor`、`PrometheusRule` 等 CRD 声明式管理抓取和告警。社区的 kube-prometheus-stack 把这些打包在一起。

团队生产上选的是 **victoria-metrics-k8s-stack**，原因很实际：

- **资源占用低**：同样的指标量，VictoriaMetrics 的内存和磁盘占用明显少于 Prometheus，长期保留 30 天以上压力小。
- **兼容 Prometheus 生态**：支持 PromQL（及其扩展 MetricsQL），Grafana 按 Prometheus 数据源接入即可。
- **兼容 Prometheus Operator CRD**：VM Operator 会把 `ServiceMonitor`、`PodMonitor`、`PrometheusRule` 自动转换成自己的 `VMServiceScrape`、`VMPodScrape`、`VMRule`。第三方 Helm Chart 里自带的 ServiceMonitor 不用改就能用。

### 组件构成

```text
                    ┌──────────────┐
 node-exporter ─┐   │              │     ┌──────────┐
 kube-state-  ──┼──▶│   vmagent    │────▶│ vmsingle │◀── Grafana（看图）
   metrics      │   │ (抓取/转发)   │     │ (存储)    │
 kubelet/cAdvisor┤   └──────────────┘     └────┬─────┘
 apiserver/etcd ─┘          ▲                  │
                            │             ┌────▼────┐     ┌──────────────┐
       VMServiceScrape / ServiceMonitor   │ vmalert │────▶│ Alertmanager │──▶ 飞书/邮件/Webhook
       （声明抓取目标）                    │(规则计算)│     └──────────────┘
                                          └─────────┘
```

| 组件 | 作用 |
|---|---|
| VM Operator | 管理 VM 系列 CRD，并转换 Prometheus Operator CRD |
| vmagent | 按 Scrape 对象抓取指标，写入存储 |
| vmsingle | 单节点存储与查询（规模大时换 vmcluster） |
| vmalert + Alertmanager | 计算告警规则、路由和发送通知 |
| node-exporter | DaemonSet，采集节点 CPU、内存、磁盘、网络 |
| kube-state-metrics | 把 K8s 对象状态转成指标，例如 Pod 是否 Ready、Deployment 副本数 |
| Grafana | 面板，chart 自带一批 K8s 常用 Dashboard |

### 生产部署

团队仓库里用 Helmwave 管理这个 chart（Helmwave 见 [用 Helm 与 Kustomize 管理应用](/learn/helm-kustomize)）：

```yaml title="helmwave.yml"
releases:
  - name: vm
    namespace: vm
    create_namespace: true
    chart:
      name: oci://ghcr.io/victoriametrics/helm-charts/victoria-metrics-k8s-stack
      version: 0.70.0   # 截至本文写作时的版本，以官方发布为准
    values:
      - values.yml
```

关键的 values 取舍，每一条都来自踩过的坑：

```yaml title="values.yml"
vmsingle:
  spec:
    retentionPeriod: 30d            # 保留 30 天
    storage:
      storageClassName: shared-cs   # 换成集群里实际可用的 StorageClass
      resources:
        requests:
          storage: 1Ti
    extraArgs:
      search.maxQueryDuration: 1m
      search.maxConcurrentRequests: '120'
      maxLabelsPerTimeseries: "1024"   # 默认 label 数上限较低，pod 全量 label 会被截断
      memory.allowedPercent: '90'      # 容器内由 limits 兜底，不必给宿主机留余量

victoria-metrics-operator:
  operator:
    disable_prometheus_converter: false  # 开启 Prometheus CRD 转换
    enable_converter_ownership: true     # 删除 ServiceMonitor 时联动删除转换出来的对象

kube-state-metrics:
  metricLabelsAllowlist:
    - nodes=[node.kubernetes.io/cpu,nvidia.com/gpu,node-role.kubernetes.io/maintenance]
    - pods=[*]
```

> [!PROD] kube-state-metrics 默认不带业务 label
> `kube_pod_labels` 默认只有 name 和 namespace。想在 Grafana 里按 `app`、`team` 聚合，或者按节点是否有 GPU 做筛选，必须用 `metricLabelsAllowlist` 显式放行。`pods=[*]` 很方便，但 label 基数大的集群要评估内存；对节点只放行你真正会用来筛选的几个 label。

转换功能依赖 Prometheus Operator 的 CRD 定义本身存在于集群里（否则第三方 chart 创建 ServiceMonitor 会直接报 "no matches for kind"）。团队的做法是额外装一份"精简版"CRD：

```yaml title="prometheus/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - https://github.com/prometheus-operator/prometheus-operator/releases/download/v0.88.1/stripped-down-crds.yaml
```

```bash
helmwave up --build
kubectl apply -k prometheus
```

Grafana 单独部署时，团队给它开了 2 副本、持久化，并通过亲和性固定到控制平面节点上，避免和 GPU 业务抢资源：

```yaml title="grafana/values.yml"
replicas: 2
persistence:
  enabled: true
  size: 100Gi
tolerations:
  - operator: "Exists"
    effect: "NoSchedule"
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node-role.kubernetes.io/control-plane
              operator: Exists
```

> [!WARNING] Grafana 多副本要共享数据库
> Grafana 默认用 SQLite 存面板和用户。多副本时每个副本各有一份 SQLite，改了面板会"时有时无"。多副本需要配置外部 MySQL/PostgreSQL，或者把面板全部做成 ConfigMap/Provisioning 由 Git 管理，Grafana 本身无状态。

## 接入你的应用：ServiceMonitor

应用只要暴露 `/metrics`，写一个 ServiceMonitor 告诉采集器"去抓哪个 Service 的哪个端口"：

```yaml title="demo-servicemonitor.yaml"
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: demo-app
  namespace: demo
spec:
  selector:
    matchLabels:
      app: demo-app          # 选中 Service 的 label，不是 Pod 的
  endpoints:
    - port: metrics          # Service 里端口的 name，不是数字
      interval: 30s
      path: /metrics
```

VM Operator 会自动生成同名 `VMServiceScrape`。也可以直接写 VM 的 CRD，团队给 GPU 的 DCGM exporter 就是这么接的：

```yaml title="dcgm-vmservicescrape.yaml"
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMServiceScrape
metadata:
  name: dcgm-exporter
  namespace: gpu-operator
spec:
  namespaceSelector:
    matchNames: [gpu-operator]
  selector:
    matchLabels:
      app: nvidia-dcgm-exporter
  endpoints:
    - port: gpu-metrics
```

> [!TIP] 抓不到数据先看三件事
> 1. ServiceMonitor 的 `selector` 选中的是 **Service** 的 label；2. `port` 写的是端口**名字**；3. 在 vmagent 的 `/targets` 页面（port-forward 到 8429 端口）看目标是否出现、状态是否 up。

## 关键指标与 SLO

指标成千上万，真正值得盯的就几类。下面是生产集群里最常用的一组，括号里是对应的 PromQL 思路：

| 对象 | 关注点 | 指标/表达式 |
|---|---|---|
| apiserver | 可用性 | 5xx 比例：`sum(rate(apiserver_request_total{code=~"5.."}[5m])) / sum(rate(apiserver_request_total[5m]))` |
| apiserver | 延迟 | `histogram_quantile(0.99, sum by (le, verb) (rate(apiserver_request_duration_seconds_bucket{verb!~"WATCH\|CONNECT"}[5m])))` |
| etcd | 容量 | `etcd_mvcc_db_total_size_in_bytes / etcd_server_quota_backend_bytes` |
| etcd | 磁盘 | WAL fsync p99（`etcd_disk_wal_fsync_duration_seconds_bucket`）应低于 10ms |
| etcd | 稳定性 | `increase(etcd_server_leader_changes_seen_total[1h])` 频繁切主说明磁盘或网络有问题 |
| 节点 | 资源 | `node_filesystem_avail_bytes`、`node_memory_MemAvailable_bytes`、`node_load1` |
| 节点 | 状态 | `kube_node_status_condition{condition="Ready",status="true"} == 0` |
| 工作负载 | 重启 | `increase(kube_pod_container_status_restarts_total[1h])` |
| GPU | 利用率/显存 | `DCGM_FI_DEV_GPU_UTIL`、`DCGM_FI_DEV_FB_USED`（详见 [GPU 调度与 GPU Operator](/learn/gpu-operator)） |

apiserver 的 SLO 常定为"非长连接请求 p99 < 1s、成功率 > 99.9%"，这也是社区 [Kubernetes SLO](https://github.com/kubernetes/community/blob/master/sig-scalability/slos/slos.md) 的口径。etcd 的磁盘指标和 [生产集群规划](/learn/cluster-planning) 里的 fio 验收直接对应：验收时 fsync 达标，上线后要持续监控它有没有劣化。

## 告警规则

告警规则用 `PrometheusRule`（或 `VMRule`）声明。chart 已经内置了大量社区规则，下面补几条团队实际用得上的：

```yaml title="cluster-alerts.yaml"
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cluster-extra
  namespace: vm
spec:
  groups:
    - name: cluster-extra.rules
      rules:
        - alert: EtcdDbNearQuota
          expr: etcd_mvcc_db_total_size_in_bytes / etcd_server_quota_backend_bytes > 0.8
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "etcd {{ $labels.instance }} DB 已用配额 {{ $value | humanizePercentage }}"
            description: "超过配额会触发 NOSPACE alarm，集群拒绝写入。尽快 compact + defrag。"
        - alert: NodeDiskAlmostFull
          expr: |
            node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs"}
              / node_filesystem_size_bytes < 0.10
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "{{ $labels.instance }} {{ $labels.mountpoint }} 可用空间低于 10%"
        - alert: PodCrashLooping
          expr: max_over_time(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}[5m]) >= 1
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "{{ $labels.namespace }}/{{ $labels.pod }} 持续 CrashLoopBackOff"
```

写告警的几条原则：

- **告警要可行动**。收到告警的人应该知道下一步做什么，`description` 里写清楚处理方向或 runbook 链接。
- **用 `for` 过滤抖动**。一次瞬时尖峰不值得半夜叫醒人。
- **分级路由**。`critical` 走电话/即时通讯，`warning` 走工作群或邮件，由 Alertmanager 的 `route` 按 `severity` 分发。
- **告警也要被监控**。定期检查 vmalert 的规则是否在正常计算，Alertmanager 能否发出去（很多团队配一条永远触发的 `Watchdog` 告警做心跳）。

> [!PROD] 真实案例：etcd 容量告警救命
> 团队遇到过 `etcdserver: mvcc: database space exceeded`：etcd 触发 NOSPACE alarm 后只读不写，Pod 无法创建、kubectl 修改全部失败。如果有 `EtcdDbNearQuota` 告警，本可以在 80% 时就处理。处理步骤见 [Day-2 运维](/learn/day2-operations)。

## 日志：两套方案

容器日志由容器运行时写到节点的 `/var/log/pods/` 下，节点上的 DaemonSet 采集器读取这些文件、附加 K8s 元数据（namespace、pod、container），再发给后端存储。

```text
Pod stdout/stderr ─▶ /var/log/pods/<ns>_<pod>_<uid>/<container>/*.log
                                    │
                          采集器 DaemonSet（promtail / fluent-bit）
                                    │  附加 namespace、pod、node 等标签
                                    ▼
                         Loki / VictoriaLogs  ◀── Grafana 查询
```

团队维护了两套方案，结论是"写入和查询上 VictoriaLogs 更灵活"：

| | Loki + promtail | VictoriaLogs + fluent-bit |
|---|---|---|
| 存储后端 | 多副本模式必须用对象存储（S3 等） | 本地 PV 即可 |
| 部署模式 | single-binary / simple-scalable / distributed | 单节点 chart 起步 |
| 索引方式 | 只索引 label，正文靠暴力扫描 | 字段全文索引，查询灵活 |
| Grafana 接入 | 原生数据源 | 需安装 victorialogs-datasource 插件 |
| 运维复杂度 | 组件多，限流参数多 | 低 |

### Loki 的要点

Loki 有三种部署模式，**只有 single-binary 且副本数为 1 时才能用本地文件系统**，其余模式都要对象存储。团队生产用 SimpleScalable（read/write/backend 各 3 副本）+ S3：

```yaml title="loki/values/prod.yml（节选）"
deploymentMode: SimpleScalable
loki:
  schemaConfig:
    configs:
      - from: 2024-04-01
        store: tsdb
        object_store: s3
        schema: v13
        index: { prefix: loki_index_, period: 24h }
  storage:
    type: s3
    s3:
      endpoint: "s3.example.com"
      accessKeyId: "..."
      secretAccessKey: "..."
      s3ForcePathStyle: true
  limits_config:
    ingestion_rate_mb: 20
    ingestion_burst_size_mb: 100
    per_stream_rate_limit: 6MB        # 默认 3MB，日志量大的 Pod 会被限流丢日志
    per_stream_rate_limit_burst: 50MB
    max_line_size: 256kb
    max_line_size_truncate: true      # 超长行截断而不是整行丢弃
```

> [!WARNING] Loki 丢日志常常是被限流了
> 训练任务、批处理这类"一秒刷几千行"的 Pod 很容易撞上 `per_stream_rate_limit`，采集端会看到 429。调大限流前先想想：这些日志真的需要全部存下来吗？

### VictoriaLogs 的要点

VictoriaLogs 的单节点 chart 可以一并部署 fluent-bit 采集器（新版本 chart 内置的采集器可能变化，升级前核对 values）。团队的配置：存储 2Ti、保留 60 天，服务端固定在控制平面节点，采集器容忍所有污点以覆盖每个节点：

```yaml title="vl/values/prod.yml（合并后节选）"
server:
  persistentVolume:
    enabled: true
    size: 2Ti
  extraArgs:
    retentionPeriod: 60d
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: 8, memory: 8Gi }
fluent-bit:
  enabled: true
  tolerations:
    - effect: NoSchedule
      operator: Exists        # GPU 节点、控制平面节点通常带污点，漏掉就收不到这些节点的日志
```

Grafana 需要装插件才能查 VictoriaLogs，在 Grafana 的 values 里加环境变量：

```yaml
env:
  GF_INSTALL_PLUGINS: https://github.com/VictoriaMetrics/victorialogs-datasource/releases/download/v0.3.0/victorialogs-datasource-v0.3.0.zip;victorialogs-datasource
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: victorialogs-datasource
```

然后添加数据源，URL 填 `http://vl-victoria-logs-single-server.vm.svc:9428`。离线环境要把插件包放到内网文件服务器上。

## 事件持久化：kubernetes-event-exporter

kubernetes-event-exporter 监听 apiserver 的 Event，按路由规则转发到各种后端。团队把事件写进 VictoriaLogs，并打上 `classify=k8s-event` 标签，和普通日志共用一个查询入口：

```yaml title="event-exporter/config.yaml（节选）"
logLevel: info
logFormat: json
maxEventAgeSeconds: 60
route:
  routes:
    - match:
        - receiver: "victorialogs"
receivers:
  - name: "victorialogs"
    webhook:
      endpoint: http://vl-victoria-logs-single-server:9428/insert/jsonline?_stream_fields=cluster,classify,namespace&_msg_field=msg&_time_field=time
      layout:
        cluster:   "{{ .ClusterName }}"
        classify:  "k8s-event"
        time:      "{{ .FirstTimestamp.Format \"2006-01-02T15:04:05Z\" }}"
        namespace: "{{ .InvolvedObject.Namespace }}"
        msg:       "{{ .Message }}"
        type:      "{{ .Type }}"
        reason:    "{{ .Reason }}"
        count:     "{{ .Count }}"
        kind:      "{{ .InvolvedObject.Kind }}"
        name:      "{{ .InvolvedObject.Name }}"
        host:      "{{ .Source.Host }}"
```

`_stream_fields` 决定 VictoriaLogs 按哪些字段划分日志流，选低基数的字段（集群、分类、命名空间）；Pod 名这种高基数字段放普通字段即可。

> [!TIP] 用事件做告警
> 事件进了日志系统后，可以对 `reason` 做统计：某个命名空间 10 分钟内 `FailedScheduling` 超过 N 次、任何 `OOMKilling` 事件，都是很好的告警信号。

## 链路追踪：一笔带过

链路追踪需要应用代码埋点（或借助服务网格、eBPF 自动注入），对平台团队来说更多是"提供基础设施"：部署 OpenTelemetry Collector 统一接收 OTLP 数据，后端选 Jaeger、Grafana Tempo 或 VictoriaTraces。Loki 的 values 里 `tracing.enabled: true` 就是让 Loki 自己也上报链路。刚起步时先把指标、日志、事件做扎实，收益远大于链路。

## 动手练习

以下练习可以在 kind 集群中完成（建议 worker 节点至少 4GB 内存）。

1. 用 Helm 安装精简版指标栈：
   ```bash
   helm repo add vm https://victoriametrics.github.io/helm-charts/
   helm repo update
   helm install vmks vm/victoria-metrics-k8s-stack -n vm --create-namespace
   kubectl -n vm get pods -w
   ```
   等全部 Running 后，用 `kubectl -n vm get svc` 找到 grafana Service 并 port-forward，从同名 Secret 的 `admin-password` 取密码登录，打开自带的 Kubernetes 面板。
2. port-forward vmagent 的 8429 端口访问 `/targets`，找出哪些目标是 down 的。提示：kind 里 kube-scheduler、kube-controller-manager、etcd 的指标端口只监听 127.0.0.1，这正是生产中"控制平面组件抓不到"的典型原因。
3. 部署一个暴露 `/metrics` 的应用（例如 `quay.io/brancz/prometheus-example-app:v0.5.0`，端口 8080），给它写 Service 和 ServiceMonitor，然后 `kubectl get vmservicescrape -A` 确认被自动转换，最后在 Grafana Explore 里查到 `http_requests_total`。
4. 应用上面的 `PodCrashLooping` 规则，把 `for` 改成 `1m`，再创建一个 `command: ["sh","-c","exit 1"]` 的 Pod，观察 vmalert 页面告警从 pending 变成 firing。
5. 执行 `kubectl get events -A --sort-by=.lastTimestamp`，记下最早一条事件的时间，思考：如果故障发生在两小时前，这些信息还在吗？

## 自测

<details>
<summary>为什么说 Event 需要单独持久化，而不能指望 kubectl get events？</summary>

Event 存在 etcd 中，apiserver 的 `--event-ttl` 默认 1 小时后就删除。故障复盘时往往已经超过这个时间。用 kubernetes-event-exporter 把事件写进日志系统，才能事后查询和做统计告警。

</details>

<details>
<summary>第三方 Helm Chart 自带 ServiceMonitor，在 VictoriaMetrics 栈里能用吗？需要什么前提？</summary>

能用。VM Operator 默认开启 Prometheus 转换，会把 ServiceMonitor/PodMonitor/PrometheusRule 转成 VMServiceScrape/VMPodScrape/VMRule。前提是集群里已经安装了 Prometheus Operator 的 CRD 定义，否则创建 ServiceMonitor 时会报找不到该资源类型。

</details>

<details>
<summary>Loki 什么情况下可以不用对象存储？</summary>

只有 single-binary 模式且副本数为 1 时才能用本地文件系统。SimpleScalable 和 distributed 模式都必须使用 S3、GCS 等对象存储。

</details>

<details>
<summary>采集器 DaemonSet 为什么通常要配置 `tolerations: [{operator: Exists, effect: NoSchedule}]`？</summary>

控制平面节点、GPU 节点、维护中的节点常带 NoSchedule 污点。不容忍这些污点，采集器就不会调度到这些节点上，这些节点的日志和指标会整片缺失，而且很难被察觉。

</details>

<details>
<summary>etcd 容量告警该用什么表达式？阈值为什么不设成 100%？</summary>

`etcd_mvcc_db_total_size_in_bytes / etcd_server_quota_backend_bytes`。到 100% 时 etcd 已经触发 NOSPACE alarm 拒绝写入，集群已经故障了；80% 左右告警，留出做 compact 和 defrag 的时间。

</details>

## 参考资料

- [Kubernetes 官方文档：Kubernetes 系统组件指标](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/system-metrics/)
- [Kubernetes 官方文档：日志架构](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/logging/)
- [Kubernetes 官方文档：资源监控工具](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/resource-usage-monitoring/)
- [Kubernetes 官方文档：kube-state-metrics 中的指标](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/kube-state-metrics/)
- [VictoriaMetrics：victoria-metrics-k8s-stack Helm Chart](https://docs.victoriametrics.com/helm/victoria-metrics-k8s-stack/)
- [VictoriaMetrics Operator：Prometheus 集成与 CRD 转换](https://docs.victoriametrics.com/operator/integrations/prometheus/)
- [VictoriaLogs 文档](https://docs.victoriametrics.com/victorialogs/)
- [Grafana Loki 文档](https://grafana.com/docs/loki/latest/)
- [kubernetes-event-exporter](https://github.com/resmoio/kubernetes-event-exporter)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
- [OpenTelemetry 文档](https://opentelemetry.io/docs/)
