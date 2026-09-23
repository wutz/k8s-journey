# GPU 调度与 GPU Operator

前面的课里，Pod 申请的资源只有 CPU、内存和存储，这些 kubelet 天生就认识。GPU 不一样：kubelet 不知道节点上插了几张卡、是什么型号，容器运行时也不知道怎么把 `/dev/nvidia0` 和驱动库塞进容器。要让 `nvidia.com/gpu: 1` 这一行生效，节点上需要驱动、容器工具包、设备插件、特性发现等一整套组件，而且它们的版本必须互相匹配。

这一课从 Kubernetes 的设备插件（Device Plugin）机制讲起，然后介绍 NVIDIA GPU Operator 如何把这套组件打包成一个 Operator 统一管理，重点是生产里最容易踩坑的驱动策略和 NVLink 机器上的 Fabric Manager。最后讲调度打分怎么减少 GPU 碎片，以及 GPU 共享（time-slicing、MIG）和新一代的动态资源分配（DRA）。学完你应该能在一个 GPU 集群上装好 GPU Operator，跑通验证 Pod，并知道出了问题从哪查。

> [!NOTE] 本课需要的环境
> GPU Operator 的完整部署需要真实的 NVIDIA GPU 节点（Ubuntu 22.04/24.04，数据中心卡或消费级卡均可）。kind 里没有 GPU，练习部分会用"扩展资源"模拟 GPU 数量来观察调度行为，并在 kind 里体验 NFD 的节点特性标签。

## 为什么 GPU 需要额外的机制

回忆一下 [控制平面](/learn/control-plane) 那一课：调度器根据节点上报的 `status.allocatable` 做资源匹配，kubelet 负责把容器真正跑起来。CPU 和内存由 kubelet 通过 cgroup 直接管理，但 GPU 至少有三个问题要解决：

1. **发现**：节点上有几张卡，哪几张是健康的？
2. **上报**：怎样让调度器知道这个节点有 8 个 `nvidia.com/gpu`？
3. **注入**：容器启动时，怎样把对应的设备文件（`/dev/nvidia*`）、驱动的用户态库（`libcuda.so`）和 `nvidia-smi` 放进容器？

Kubernetes 用两套通用机制把这些事交给厂商实现：

| 机制 | 作用 | 对应的 NVIDIA 组件 |
| --- | --- | --- |
| 设备插件（Device Plugin） | 通过 gRPC 向 kubelet 注册一种扩展资源，汇报设备数量和健康状态，在容器创建时告诉 kubelet 该分配哪几个设备 | `nvidia-device-plugin` |
| 容器运行时钩子 / CDI | 在容器创建时注入设备节点和驱动库 | `nvidia-container-toolkit` |

设备插件注册后，节点就会多出一项资源：

```bash
kubectl get node gn-192-168-1-1 -o jsonpath='{.status.allocatable.nvidia\.com/gpu}'
# 8
```

扩展资源有几条和 CPU 不同的规则，写 YAML 时要记住：

- 只能是**整数**，不能写 `0.5`。想让多个 Pod 共用一张卡，要靠后面讲的 time-slicing 或 MIG。
- **不能超卖**。如果同时写 requests 和 limits，两者必须相等；通常只写 `limits`，requests 会自动等于 limits。
- 一个容器拿到哪几张卡由设备插件决定，Pod 自己不能指定"我要 0 号卡"。

```yaml title="gpu-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vectoradd
spec:
  restartPolicy: OnFailure
  containers:
    - name: cuda-vectoradd
      image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
      resources:
        limits:
          nvidia.com/gpu: 1
```

## NFD：先让节点"自我介绍"

GPU 集群里通常混着 CPU 节点和不同型号的 GPU 节点。GPU Operator 需要知道哪些节点装了 NVIDIA 卡，才能只在这些节点上部署驱动和插件。这件事交给节点特性发现（Node Feature Discovery，NFD）：它在每个节点跑一个 worker，读取 PCI 设备、CPU 指令集、内核版本等信息，然后以标签的形式写到节点上。

NVIDIA 的 PCI 厂商号是 `10de`，Mellanox（现 NVIDIA 网络）网卡是 `15b3`。NFD 发现后会打上这样的标签：

```text
feature.node.kubernetes.io/pci-10de.present=true     # 有 NVIDIA 设备
feature.node.kubernetes.io/pci-15b3.present=true     # 有 Mellanox 网卡
feature.node.kubernetes.io/kernel-version.full=6.8.0-45-generic
```

GPU Operator 和下一课会用到的 Network Operator 都依赖这些标签。两个 Operator 的 Helm chart 都自带一份 NFD，但**一个集群只应该有一套 NFD**，否则两份 NFD 会互相覆盖标签。团队的做法是单独部署 NFD，在两个 Operator 的 values 里都关掉内置的 NFD：

```yaml title="nfd-values.yaml"
enableNodeFeatureApi: true
priorityClassName: system-node-critical

worker:
  tolerations:
    - operator: "Exists"          # GPU 节点常带污点，worker 必须能调度上去
  config:
    sources:
      pci:
        deviceClassWhitelist:     # 只关心网卡（02xx）和显卡（03xx）
          - "02"
          - "0200"
          - "0207"
          - "0300"
          - "0302"
        deviceLabelFields:
          - vendor                # 标签只带厂商号，得到 pci-10de.present

master:
  config:
    extraLabelNs: ["nvidia.com", "node-role.kubernetes.io"]
```

`extraLabelNs` 允许 NFD 写 `node-role.kubernetes.io` 前缀的标签，这样就能用 NodeFeatureRule 按规则给节点打角色标签，而不用手工 `kubectl label`：

```yaml title="instance-type.yaml"
apiVersion: nfd.k8s-sigs.io/v1alpha1
kind: NodeFeatureRule
metadata:
  name: instance-type
spec:
  rules:
    - name: "gpu-node"
      labels:
        "node-role.kubernetes.io/gpu": "true"
        "node.kubernetes.io/instance-type": "8xh100-ib"
      matchFeatures:
        - feature: system.name
          matchExpressions:
            nodename: { op: InRegexp, value: ["^gn-"] }
```

新节点按 [生产集群规划](/learn/cluster-planning) 里的命名规范加入集群后，会自动带上角色和机型标签，后面 Kueue 的 ResourceFlavor 就靠这些标签区分 GPU 型号。

## GPU Operator 管了哪些东西

手工维护 GPU 节点意味着每台机器都要装驱动、装 nvidia-container-toolkit、改 containerd 配置、部署 device plugin 和监控，内核一升级驱动就可能失效。GPU Operator 把这些都写成了控制器（参见 [CRD 与 Operator 模式](/learn/crd-operator)），用一个 `ClusterPolicy` 资源描述期望状态：

```text
                    ClusterPolicy (gpu-operator 命名空间)
                              │
       ┌──────────┬───────────┼────────────┬─────────────┬──────────────┐
       ▼          ▼           ▼            ▼             ▼              ▼
   driver     toolkit    device-plugin    GFD       dcgm-exporter   mig-manager
 (可选,容器   (配置      (上报 nvidia.   (打 gpu.    (GPU 指标)     (切分 MIG)
  化驱动)    containerd)  com/gpu)      product 等
                                          标签)
       └──────────────────────── validator：逐层验证 ──────────────────────┘
```

这些组件都以 DaemonSet 形式只跑在 GPU 节点上，部署有先后依赖：驱动就绪后才装 toolkit，toolkit 就绪后才启动 device plugin，最后 validator 跑一个 CUDA 程序确认整条链路是通的。

GPU 特性发现（GPU Feature Discovery，GFD）会补充一批很有用的标签：

```text
nvidia.com/cuda.driver-version.full=580.95.05
nvidia.com/gpu.count=8
nvidia.com/gpu.product=NVIDIA-H100-80GB-HBM3
nvidia.com/mig.capable=true
```

业务需要特定型号时，用 `nodeSelector: {nvidia.com/gpu.product: NVIDIA-H100-80GB-HBM3}` 即可，不需要维护自己的型号标签。

## 驱动策略：宿主机驱动还是容器驱动

这是部署 GPU Operator 前最重要的决定。

| | 宿主机驱动（`driver.enabled: false`） | 容器化驱动（`driver.enabled: true`） |
| --- | --- | --- |
| 安装方式 | 在每台节点上执行 `.run` 或 apt 安装 | Operator 在 driver Pod 里编译并加载内核模块 |
| 节点上 `nvidia-smi` | 直接可用 | 需要 `chroot /run/nvidia/driver nvidia-smi` |
| 内核升级 | 需要重装或依赖 DKMS | Operator 自动为新内核重新编译 |
| 依赖外网/软件源 | 安装时需要 | driver Pod 每次启动都要装编译依赖，需要可用的 apt 源 |
| 故障排查 | 熟悉的 systemd、dmesg | 要进 driver Pod 排查 |
| 驱动升级 | 需要排空节点、重装 | 改 values 中的版本，Operator 滚动升级 |

团队的选择是**推荐宿主机驱动**。原因很实际：GPU 节点数量有限、内核版本锁定（见 [生产集群规划](/learn/cluster-planning)），驱动升级本来就是计划内变更；而容器化驱动在离线环境里要额外配置软件源，driver Pod 重启还会让节点上所有 GPU 业务中断。节点少、变更频繁、有统一镜像源的环境，容器化驱动更省事。

宿主机驱动安装前要先清理残留的旧驱动（`apt-get remove --purge '^nvidia-.*'` 或 `.run --uninstall`），再安装统一版本的驱动并用 `nvidia-smi` 确认。

> [!WARNING] NVLink / NVSwitch 机器必须装 Fabric Manager
> HGX H100/H200/B200/B300 这类 8 卡机器通过 NVSwitch 把 GPU 连在一起。NVSwitch 需要 `nvidia-fabricmanager` 服务完成初始化，**版本必须和驱动完全一致**，否则 CUDA 程序会报 `system not yet initialized`。
>
> ```bash
> apt install nvidia-fabricmanager-<driver-branch>
> systemctl enable --now nvidia-fabricmanager
> nvidia-smi -q -i 0 | grep -i -A 2 Fabric
> #   Fabric
> #     State   : Completed
> #     Status  : Success
> ```
>
> Blackwell（B200/B300）只支持 NVIDIA 开源内核模块（open kernel modules），需要安装 `nvidia-open-<branch>`，NVLink5 机型还要装 `nvlink5-<branch>` 相关软件包。具体包名以 NVIDIA 官方 Fabric Manager 文档为准。

### 容器化驱动的配置要点

如果选择让 Operator 管驱动，values 里常用的几项：

```yaml title="gpu-operator-values.yaml（容器化驱动部分）"
driver:
  enabled: true
  version: "580.95.05"
  repoConfig:
    configMapName: repo-config          # 指向内网 apt 源，离线环境必需
  kernelModuleConfig:
    name: kernel-module-params          # 自定义内核模块参数
  rdma:
    enabled: true                        # 有 IB/RoCE 且是数据中心卡时开启 GPUDirect RDMA
    useHostMofed: true                   # 网卡驱动（DOCA OFED）装在宿主机上
```

`kernel-module-params` 是 gpu-operator 命名空间里的一个 ConfigMap，键 `nvidia.conf` 的内容是模块参数，例如 `NVreg_EnableGpuFirmware=0`。这个参数关闭 GSP 固件，在部分驱动版本上可以绕开 GSP 相关的故障，按需使用。新版本 Operator 还提供 `driver.kernelModuleType`（`auto` / `open` / `proprietary`）选择开源或闭源内核模块，Blackwell 必须用 open。

> [!PROD] 不支持的操作系统
> GPU Operator 对宿主机操作系统有明确的支持列表。团队遇到过 Ubuntu 20.04 不再被支持的情况。部署前先对照官方 Platform Support 页面核对 OS、内核、容器运行时和 K8s 版本。

## 部署与验证

以宿主机驱动为例，关键 values 如下：

```yaml title="values.yaml"
nfd:
  enabled: false                    # 使用独立部署的 NFD

daemonsets:
  tolerations:                       # GPU 节点上的污点都要能容忍
    - operator: Exists
      effect: NoSchedule

driver:
  enabled: false
dcgmExporter:
  enabled: true
migManager:
  enabled: false
```

```bash
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm upgrade --install gpu-operator nvidia/gpu-operator \
  -n gpu-operator --create-namespace \
  --version v25.10.1 -f values.yaml      # 截至本文写作时的版本，以官方发布为准

kubectl get pods -n gpu-operator
```

所有 Pod Running、`nvidia-cuda-validator-*` 和 `nvidia-operator-validator-*` 显示 Completed/Running 后，跑一个真实的 CUDA 程序：

```bash
kubectl apply -f gpu-pod.yaml
kubectl logs -f cuda-vectoradd     # 最后一行应为 Test PASSED
```

### 常见故障：validator 起不来

```bash
kubectl logs -n gpu-operator nvidia-cuda-validator-xxxxx -c cuda-validation
# Failed to allocate device vector A (error code system not yet initialized)!
```

这几乎总是 Fabric Manager 的问题。排查路径：

1. 宿主机驱动：`systemctl status nvidia-fabricmanager`；容器驱动：进 driver Pod 执行 `ps auxf | grep fabric`。
2. 查看 Fabric Manager 日志，如果看到 `NV_WARN_NOTHING_TO_DO`，说明它没有找到 NVSwitch。
3. 执行 `ls -l /proc/driver/nvidia-nvswitch/devices/`，目录为空说明硬件层面没识别到 NVSwitch，需要找硬件厂商。

## GPU 监控：DCGM Exporter

GPU 的故障比 CPU 多得多：ECC 错误、显存行重映射失败、XID 错误、NVLink 降速。DCGM Exporter 把 NVIDIA DCGM 采集的指标暴露成 Prometheus 格式，可以用 [可观测性](/learn/observability) 那课的 VictoriaMetrics 抓取。

默认指标集比较精简，团队用 ConfigMap 自定义了一份 CSV，重点多采了这些：

| 指标 | 含义 | 用途 |
| --- | --- | --- |
| `DCGM_FI_DEV_GPU_UTIL` | GPU 利用率 | 基础监控（只反映"有 kernel 在跑"的时间占比） |
| `DCGM_FI_PROF_SM_ACTIVE`、`DCGM_FI_PROF_PIPE_TENSOR_ACTIVE` | SM 与 Tensor Core 活跃度 | 判断训练是否真正把卡用满 |
| `DCGM_FI_DEV_FB_USED` | 显存使用 | 推理服务容量规划 |
| `DCGM_FI_DEV_XID_ERRORS` | 最近一次 XID 错误码 | 硬件/驱动故障告警 |
| `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL` | 双比特 ECC 错误 | 出现即应下线维修 |
| `DCGM_FI_DEV_ROW_REMAP_FAILURE` | 显存行重映射失败 | 显存损坏 |
| `DCGM_FI_DEV_NVLINK_BANDWIDTH_TOTAL` | NVLink 带宽 | 多卡通信监控 |

自定义 CSV 放在 ConfigMap 里，通过 values 中的 `dcgmExporter.config.name` 引用。

> [!TIP]
> `GPU_UTIL` 为 100% 不代表算力用满了，只要有一个 kernel 在跑就算"忙"。评估训练效率时看 `PROF_SM_ACTIVE` 和 `PROF_PIPE_TENSOR_ACTIVE` 更准确。

## 调度打分：让 GPU 少碎片

默认调度器的 `NodeResourcesFit` 插件使用 `LeastAllocated` 打分，倾向于把 Pod 分散到最空的节点。对 Web 服务这很合理，对 GPU 却是灾难：8 个单卡任务可能被分到 8 台机器上，每台只剩 7 张卡，这时来一个要整机 8 卡的训练任务就排不进去了。

解决办法是改成 `MostAllocated`（装箱，bin-packing），并提高 GPU 的权重。用 Kubespray 部署的集群可以在 inventory 里配置调度器 profile（见 [用 Kubespray 部署高可用集群](/learn/kubespray)）：

```yaml title="inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml"
kube_scheduler_profiles:
  - schedulerName: default-scheduler
    pluginConfig:
      - name: NodeResourcesFit
        args:
          scoringStrategy:
            type: MostAllocated
            resources:
              - name: cpu
                weight: 1
              - name: memory
                weight: 1
              - name: nvidia.com/gpu
                weight: 5
```

它最终会渲染成 kube-scheduler 的 `KubeSchedulerConfiguration`（`apiVersion: kubescheduler.config.k8s.io/v1`）。GPU 权重设为 5，意味着"GPU 用得多的节点"在打分中占主导，单卡任务会优先塞满已经有任务的节点，把整机留给大任务。

> [!WARNING]
> `MostAllocated` 是全局生效的。CPU 业务也会被尽量挤在少数节点上，单节点故障的影响面变大。如果集群里 CPU 业务很多，可以考虑为 GPU 业务单独配置一个 scheduler profile（不同 `schedulerName`），或者把 GPU 节点和 CPU 节点用污点隔开。

## GPU 共享

一张 80GB 的卡跑一个小模型推理或者 Jupyter 调试，大部分算力都闲着。GPU Operator 提供两种共享方式。

### time-slicing：时间片轮转

device plugin 把一张物理卡"虚报"成 N 份，多个 Pod 轮流使用。配置写在 ConfigMap 里：

```yaml title="time-slicing-config.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: time-slicing-config
  namespace: gpu-operator
data:
  any: |-
    version: v1
    sharing:
      timeSlicing:
        resources:
          - name: nvidia.com/gpu
            replicas: 4
```

```bash
kubectl patch clusterpolicies.nvidia.com/cluster-policy --type merge \
  -p '{"spec":{"devicePlugin":{"config":{"name":"time-slicing-config","default":"any"}}}}'
```

生效后，一台 8 卡节点会上报 `nvidia.com/gpu: 32`。time-slicing **没有显存隔离和故障隔离**：一个 Pod 把显存吃满，其他 Pod 会 OOM；一个 Pod 触发 GPU 错误，同卡的 Pod 都受影响。只适合开发、测试、低负载推理。

### MIG：硬件切分

多实例 GPU（Multi-Instance GPU，MIG）是 A100、H100、H200、B200 等数据中心卡的硬件功能，把一张卡切成最多 7 个实例，每个实例有独立的 SM、显存和缓存，彼此隔离。GPU Operator 的 mig-manager 根据节点标签切分：

```bash
# 把节点上的 H100 都切成 7 个 1g.10gb 实例
kubectl label node gn-192-168-1-1 nvidia.com/mig.config=all-1g.10gb --overwrite
```

使用 `mixed` 策略时，Pod 按规格申请：

```yaml
resources:
  limits:
    nvidia.com/mig-1g.10gb: 1
```

| | time-slicing | MIG |
| --- | --- | --- |
| 支持的卡 | 几乎所有 | 仅部分数据中心卡 |
| 显存隔离 | 无 | 有 |
| 故障隔离 | 无 | 有 |
| 切分粒度 | 任意份数 | 固定几种规格 |
| 切换代价 | 改 ConfigMap | 需要节点上无 GPU 业务，重新切分 |

## 下一代：动态资源分配（DRA）

设备插件模型有天生的局限：资源只是一个整数计数器，Pod 无法表达"我要两张在同一 NVSwitch 下、显存至少 40GB 的卡"，也无法在多个容器或 Pod 之间共享同一个设备。

动态资源分配（Dynamic Resource Allocation，DRA）是 Kubernetes 为此设计的新 API，在 1.34 进入 GA（`resource.k8s.io/v1`）。它借鉴了 PV/PVC 的思路：

| DRA 对象 | 类比 | 作用 |
| --- | --- | --- |
| `DeviceClass` | StorageClass | 管理员定义一类设备和筛选条件 |
| `ResourceSlice` | 节点上报的 PV | 驱动发布每个节点上有哪些设备及其属性 |
| `ResourceClaim` / `ResourceClaimTemplate` | PVC | 工作负载声明需要什么设备 |

```yaml title="dra-gpu.yaml"
apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata:
  name: single-gpu
spec:
  spec:
    devices:
      requests:
        - name: gpu
          exactly:
            deviceClassName: gpu.nvidia.com
---
apiVersion: v1
kind: Pod
metadata:
  name: dra-demo
spec:
  resourceClaims:
    - name: gpu
      resourceClaimTemplateName: single-gpu
  containers:
    - name: cuda
      image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
      resources:
        claims:
          - name: gpu
```

使用 DRA 需要安装厂商的 DRA 驱动（NVIDIA 的是 `k8s-dra-driver-gpu`），它和传统 device plugin 目前还处在并存过渡阶段。截至本文写作时，生产上大多数 GPU 集群仍以 device plugin 为主；DRA 值得在新集群里评估，尤其是需要按属性选卡或共享设备的场景。

## 动手练习

1. 在 kind 集群里用扩展资源模拟 GPU：执行 `kubectl patch node kind-worker --subresource=status --type=json -p '[{"op":"add","path":"/status/capacity/nvidia.com~1gpu","value":"4"}]'`，确认 `kubectl describe node kind-worker` 中出现 `nvidia.com/gpu: 4`。然后创建 5 个各申请 1 张"卡"的 Pod（镜像用 `registry.k8s.io/pause:3.10`），观察第 5 个为什么 Pending。
2. 在上一步的基础上，尝试把 Pod 的 `requests` 写成 `nvidia.com/gpu: 0.5`，以及让 requests 和 limits 不相等，记录 apiserver 返回的错误信息。
3. 用 Helm 在 kind 里安装 NFD（`helm install nfd oci://registry.k8s.io/nfd/charts/node-feature-discovery -n nfd --create-namespace`），查看节点上出现了哪些 `feature.node.kubernetes.io/` 标签，再写一条 NodeFeatureRule，给名字以 `worker` 结尾的节点打上 `node-role.kubernetes.io/gpu=true`。
4. 如果你有 GPU 节点：部署 GPU Operator，跑通 `cuda-vectoradd`，再用 `kubectl get node -o json` 找出 GFD 打的 `nvidia.com/gpu.product` 标签。
5. 画一张对比表：你所在团队的 GPU 节点更适合宿主机驱动还是容器化驱动？写出三条理由。

## 自测

<details>
<summary>kubelet 是怎样知道节点上有几张 GPU 的？</summary>

通过设备插件机制。`nvidia-device-plugin` 以 DaemonSet 运行，通过 kubelet 的 gRPC 接口注册 `nvidia.com/gpu` 资源并汇报设备列表和健康状态，kubelet 再把数量写入节点的 `status.capacity/allocatable`。容器创建时，kubelet 调用插件的 Allocate 接口得到要注入的设备。

</details>

<details>
<summary>为什么一个集群里只应该有一套 NFD？</summary>

GPU Operator 和 Network Operator 的 chart 都可以自带 NFD。如果都开启，会有两套 NFD worker/master 同时管理节点上的 `feature.node.kubernetes.io/` 标签，互相覆盖或删除对方的标签，导致 Operator 的组件时有时无。应单独部署 NFD，并在两个 Operator 的 values 里设置 `nfd.enabled: false`。

</details>

<details>
<summary>cuda-validator 报 "system not yet initialized"，最可能是什么原因？怎样确认？</summary>

多半是 NVSwitch 机器上的 Fabric Manager 没有启动或版本和驱动不一致。用 `systemctl status nvidia-fabricmanager`（容器驱动则进 driver Pod 查进程）确认服务状态，用 `nvidia-smi -q -i 0 | grep -A 2 Fabric` 看 State 是否为 Completed；如果 Fabric Manager 报 `NOTHING_TO_DO`，检查 `/proc/driver/nvidia-nvswitch/devices/` 是否为空，为空则是硬件未识别。

</details>

<details>
<summary>为什么 GPU 集群要把调度打分改成 MostAllocated？</summary>

默认的 LeastAllocated 会把小任务分散到各个节点，导致每台机器都剩几张零散的卡，需要整机 8 卡的任务反而调度不上。MostAllocated 把小任务尽量集中到已使用的节点，保留完整的空闲节点给大任务，减少碎片。给 `nvidia.com/gpu` 更高的权重，让 GPU 使用量主导打分。

</details>

<details>
<summary>time-slicing 和 MIG 应该怎么选？</summary>

需要显存和故障隔离、卡型支持（A100/H100 等）的生产推理或多租户场景用 MIG；开发调试、低负载、卡型不支持 MIG 的场景用 time-slicing。time-slicing 没有显存隔离，一个 Pod 吃满显存会影响同卡其他 Pod。

</details>

## 参考资料

- [Kubernetes 官方文档：设备插件](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/)
- [Kubernetes 官方文档：调度 GPU](https://kubernetes.io/zh-cn/docs/tasks/manage-gpus/scheduling-gpus/)
- [Kubernetes 官方文档：动态资源分配](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/dynamic-resource-allocation/)
- [Kubernetes 官方文档：资源装箱（Bin Packing）](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/resource-bin-packing/)
- [Kubernetes 官方文档：调度器配置](https://kubernetes.io/zh-cn/docs/reference/scheduling/config/)
- [Node Feature Discovery 官方文档](https://kubernetes-sigs.github.io/node-feature-discovery/)
- [NVIDIA GPU Operator 官方文档](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/index.html)
- [NVIDIA GPU Operator：GPU 时间片共享](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-sharing.html)
- [NVIDIA Fabric Manager 用户指南](https://docs.nvidia.com/datacenter/tesla/fabric-manager-user-guide/index.html)
- [NVIDIA DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter)
- [NVIDIA DRA Driver for GPUs](https://github.com/NVIDIA/k8s-dra-driver-gpu)
