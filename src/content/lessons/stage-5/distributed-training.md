# 分布式训练与高性能网络

单机 8 卡装不下的模型，或者想把训练时间从一个月压到一周，就要多机训练。多机训练在 Kubernetes 上有两个层面的问题：一是**编排**，要把 N 个 Pod 作为一个整体创建出来，给每个 Pod 分配 rank，告诉它们主节点地址，并且能一起失败、一起重启；二是**网络**，每一步迭代都要在所有 GPU 之间做梯度同步（AllReduce），普通的以太网 + TCP 根本喂不饱 GPU，必须用 RDMA（Remote Direct Memory Access，远程直接内存访问）网络让数据绕过 CPU 和内核。

这一课先用 Kubeflow Trainer 解决编排问题，然后讲清 InfiniBand 与 RoCE、NVIDIA Network Operator 如何把 RDMA 网卡暴露给 Pod、hostNetwork 与 macvlan 两种组网方式的取舍，最后用 NCCL tests 做带宽验收，并给出 Megatron 多机训练的关键配置。

> [!NOTE] 本课需要的环境
> Kubeflow Trainer 的 PyTorch CPU 示例可以在 kind 里运行（建议 kind 节点分到 4 核 8GB 以上）。RDMA、NCCL 带宽测试和 Megatron 部分需要至少 2 台带 InfiniBand 或 RoCE 网卡的 8 卡 GPU 节点，并已按 [GPU 调度与 GPU Operator](/learn/gpu-operator) 装好 GPU Operator，按 [批调度](/learn/batch-scheduling) 装好 Kueue。

## 为什么需要训练 Operator

用普通的 Job 或 StatefulSet 也能拼出一个多机训练，但你需要自己处理：

- 给每个 Pod 注入 `MASTER_ADDR`、`NODE_RANK`、`WORLD_SIZE` 等环境变量；
- 创建 Headless Service，让 worker 之间能用稳定的 DNS 名互相找到；
- 一个 worker 失败时，整组重启，而不是只重启那一个（其他 rank 已经卡在集合通信里了）；
- MPI 作业还要分发 SSH 密钥、生成 hostfile、单独启动一个 launcher。

Kubeflow Trainer（v2，原 Training Operator）把这些做成了两个对象：

| 对象 | 谁来写 | 内容 |
| --- | --- | --- |
| `ClusterTrainingRuntime` / `TrainingRuntime` | 平台管理员 | 训练"模板"：用什么框架（torch、mpi、jax…）、Pod 结构、共享内存、sidecar、调度方式 |
| `TrainJob` | 算法工程师 | 引用一个 runtime，只填镜像、命令、节点数、每节点资源 |

底层它用 JobSet 创建一组 Job，Gang 语义交给 [Kueue](/learn/batch-scheduling) 或 Volcano。这种分工让用户只关心"跑什么"，而网络、存储、调度这些平台细节由管理员写在 runtime 里。

## 部署 Kubeflow Trainer

```bash
# 截至本文写作时的版本为 v2.2.0，以官方发布为准
helm install kubeflow-trainer oci://ghcr.io/kubeflow/charts/kubeflow-trainer \
  --version 2.2.0 -n kubeflow-system --create-namespace

kubectl get pods -n kubeflow-system
kubectl get clustertrainingruntimes
# NAME                AGE
# deepspeed-distributed ...
# mpi-distributed     ...
# torch-distributed   ...
```

chart 会一并安装 JobSet 控制器，并提供 torch、mpi、jax、paddle 等内置 runtime。

## 第一个 TrainJob

```yaml title="pytorch-simple.yaml"
apiVersion: trainer.kubeflow.org/v1alpha1
kind: TrainJob
metadata:
  name: pytorch-simple
  namespace: default
  labels:
    kueue.x-k8s.io/queue-name: gpu-local-queue     # 交给 Kueue 排队
spec:
  suspend: true
  runtimeRef:
    name: torch-distributed
  trainer:
    numNodes: 2
    image: docker.io/kubeflowkatib/pytorch-mnist:v1beta1-45c5727
    command:
      - python3
      - /opt/pytorch-mnist/mnist.py
      - --epochs=1
    resourcesPerNode:
      requests:
        cpu: "1"
        memory: 2Gi
```

```bash
kubectl apply -f pytorch-simple.yaml
kubectl get trainjob
kubectl get pods -l trainer.kubeflow.org/trainjob-name=pytorch-simple
kubectl logs -f -l trainer.kubeflow.org/trainjob-name=pytorch-simple --max-log-requests 4
```

`torch-distributed` runtime 会用 `torchrun` 启动你的命令，并给每个 Pod 注入这些变量：

| 环境变量 | 含义 |
| --- | --- |
| `PET_NNODES` | 节点数（numNodes） |
| `PET_NPROC_PER_NODE` | 每节点进程数，通常等于 GPU 数 |
| `PET_NODE_RANK` | 当前 Pod 的序号 |
| `PET_MASTER_ADDR` / `PET_MASTER_PORT` | rank 0 的地址和端口 |

`PET_` 前缀是 torchrun（原 PyTorch Elastic）的约定。训练脚本不需要改代码，`torch.distributed.init_process_group()` 会自动读取。

> [!WARNING] 不要设置 spec.managedBy
> 在 TrainJob 上设置 `spec.managedBy` 是给 MultiKueue（跨集群分发）用的，单集群 Kueue 场景设置了会导致 TrainJob 控制器不再管理这个作业。接入 Kueue 只需要 `queue-name` 标签和 `suspend: true`。

MPI 作业用法类似，引用 `mpi-distributed` runtime，`numProcPerNode` 决定每节点几个 slot，命令直接写 `mpirun ...`。

## RDMA 网络基础

一次 AllReduce 要把每张卡的梯度汇总再分发回去。以 70B 模型为例，每一步通信量是几百 GB 级别，网络带宽直接决定 GPU 有多少时间在空等。

```text
普通 TCP：   GPU 显存 → 主机内存 → 内核协议栈 → 网卡 → ... → 对端内核 → 主机内存 → GPU
RDMA：       GPU 显存 → 网卡 ───────────────────────────→ 对端网卡 → GPU 显存
             （GPUDirect RDMA：网卡直接读写显存，绕过 CPU 和内核）
```

承载 RDMA 的网络有两种：

| | InfiniBand（IB） | RoCE v2（RDMA over Converged Ethernet） |
| --- | --- | --- |
| 物理网络 | 专用 IB 交换机和线缆 | 普通以太网交换机，需要配置无损（PFC/ECN） |
| 寻址 | LID/GUID，由 Subnet Manager 管理 | IP 地址，RDMA 包封装在 UDP 里 |
| 性能与稳定性 | 最好，开箱即用 | 接近 IB，但依赖交换机调优 |
| 成本 | 高 | 较低，可复用以太网运维经验 |
| Pod 需要 | RDMA 设备 | RDMA 设备 + 网卡上的 IP（GID 与 IP 绑定） |

一台典型的 8 卡训练机会配 8 张 400G 计算网卡（每张 GPU 对应一张，称为"轨道"，rail），再加 1～2 张存储/管理网卡。NCCL 会自动把 GPU 和同一 PCIe 交换芯片下的网卡配对。

RoCE 里还有一个关键概念 **GID**（Global Identifier）：每个 RDMA 设备有一张 GID 表，每条对应一个 IP 地址和 RoCE 版本。NCCL 需要通过 `NCCL_IB_GID_INDEX` 选择"RoCE v2 + 正确 IP"的那一条。

```bash
show_gids | grep v2
# DEV      PORT  INDEX  GID                                      IPv4           VER
# mlx5_0   1     3      0000:0000:0000:0000:0000:ffff:c0a8:0a0b  192.168.10.11  v2
```

## Network Operator：把 RDMA 设备交给 Pod

NVIDIA Network Operator 之于网卡，就像 GPU Operator 之于 GPU。它依赖宿主机上已安装 DOCA OFED（原 MLNX OFED）驱动，负责部署 RDMA 设备插件、Multus、容器网络插件和 IPAM。

```yaml title="network-operator-values.yaml"
nfd:
  enabled: false        # 复用集群里唯一的一套 NFD
```

```bash
# 截至本文写作时 v26.1.0，以官方发布为准
helm install network-operator nvidia/network-operator \
  -n network-operator --create-namespace --version v26.1.0 -f network-operator-values.yaml
```

安装后通过 `NicClusterPolicy` 声明要部署哪些组件。最简单的是 RDMA 共享设备插件：

```yaml title="nic-cluster-policy.yaml"
apiVersion: mellanox.com/v1alpha1
kind: NicClusterPolicy
metadata:
  name: nic-cluster-policy
spec:
  rdmaSharedDevicePlugin:
    image: k8s-rdma-shared-dev-plugin
    repository: nvcr.io/nvidia/mellanox
    version: network-operator-v26.1.0
    config: |
      {
        "configList": [
          {
            "resourceName": "hca",
            "rdmaHcaMax": 63,
            "selectors": { "vendors": ["15b3"] }
          }
        ]
      }
```

节点上会出现 `rdma/hca: 63`，意思是这些 Mellanox 网卡的 RDMA 设备可以被最多 63 个容器**共享**访问（这是"共享"模式，不是 SR-IOV 虚拟网卡）。

## 两种组网方式：hostNetwork 与 macvlan

Pod 默认的网络是 CNI（如 Cilium）提供的 overlay，里面没有 RDMA 设备的 IP。对 IB 来说，只要把 RDMA 设备交给容器就能通信；对 RoCE 来说，还要让 Pod 能使用计算网卡上的 IP，有两种做法：

### hostNetwork：最简单

```yaml
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
  containers:
    - name: nccl
      securityContext:
        capabilities:
          add: ["IPC_LOCK"]        # RDMA 需要锁定内存
      resources:
        limits:
          nvidia.com/gpu: 8
          rdma/hca: 1
```

Pod 直接使用宿主机网卡和 IP，GID index 与宿主机一致（示例中是 3）。优点是不需要任何额外组件；缺点是端口会和宿主机、其他 hostNetwork Pod 冲突，**一台节点同时只能跑一个这类作业**，而且安全隔离差。

### macvlan + nv-ipam：Pod 有自己的 RDMA IP

通过 Multus 给 Pod 增加第二块网卡，这块网卡是在宿主机 RDMA 网卡上创建的 macvlan 子接口，IP 从 nv-ipam 分配：

```yaml title="macvlan-network.yaml"
apiVersion: nv-ipam.nvidia.com/v1alpha1
kind: IPPool
metadata:
  name: hca
  namespace: network-operator
spec:
  subnet: 192.168.0.0/20
  perNodeBlockSize: 8           # 每个节点预分配 8 个 IP
  gateway: 192.168.0.1
  nodeSelector:
    nodeSelectorTerms:
      - matchExpressions:
          - key: feature.node.kubernetes.io/pci-15b3.present
            operator: In
            values: ["true"]
---
apiVersion: mellanox.com/v1alpha1
kind: MacvlanNetwork
metadata:
  name: hca
spec:
  networkNamespace: network-operator
  master: bond0
  mode: bridge
  mtu: 0
  ipam: |
    {
      "type": "nv-ipam",
      "poolName": "hca"
    }
```

这需要在 NicClusterPolicy 里额外启用 `secondaryNetwork`（CNI 插件与 Multus）和 `nvIpam`。Pod 通过注解挂上这块网卡：

```yaml
metadata:
  annotations:
    k8s.v1.cni.cncf.io/networks: network-operator/hca
```

| | hostNetwork | macvlan |
| --- | --- | --- |
| 额外组件 | 无 | Multus、macvlan CNI、IPAM |
| Pod IP | 宿主机 IP | 独立 IP |
| 同节点并行作业 | 不行（端口冲突） | 可以 |
| RoCE GID index | 与宿主机一致（示例为 3） | 要重新查（示例为 7） |
| 适用 | 验收测试、单作业独占 | 生产多作业共享 |

> [!PROD] 多网卡场景用 Spiderpool
> 8 轨道的机器要给 Pod 挂 8 块 RDMA 网卡，逐个写 MacvlanNetwork 和 IPPool 很繁琐。团队生产上用的是 Spiderpool：它同样提供 RDMA 共享设备插件（按网卡 deviceID 选择），并为每个轨道创建一个 `NetworkAttachmentDefinition`（hca1～hca8），Pod 注解里一次列出 8 个网络，资源里申请 `rdma/hca1` 到 `rdma/hca8` 各 1 个。

### 连通性测试

先在两个 Pod 之间跑 perftest，确认 RDMA 本身是通的：

```bash
# Pod A（服务端）
ib_send_bw -x 3 -d mlx5_bond_0
# Pod B（客户端）
ib_send_bw -x 3 -d mlx5_bond_0 192.168.10.11
```

`-x` 是 GID index，`-d` 是 RDMA 设备名（用 `ibv_devices` 查看）。400G 网卡单流通常能跑到 360～390 Gb/s；如果只有几 Gb/s，多半是走了 TCP 或者 GID 选错了。

## NCCL tests：集群带宽验收

perftest 只测单个网卡。真实训练用的是 NCCL 集合通信，验收应该用官方的 nccl-tests。团队把它写成一个 MPI 的 TrainingRuntime，launcher 执行：

```bash title="launcher 命令（2 节点 × 8 卡）"
mpirun -np 16 -bind-to none \
  -x NCCL_SOCKET_IFNAME=eth0 \
  -x NCCL_IB_HCA=mlx5 \
  -x NCCL_IB_GID_INDEX=3 \
  -x NCCL_ALGO=Ring \
  -x NCCL_DEBUG=INFO \
  /opt/nccl-tests/build/all_reduce_perf -b 8 -e 8G -f 2 -g 1
```

runtime 的关键点：

- `mpiImplementation: OpenMPI`，`numProcPerNode: 8`，`runLauncherAsNode: false`（launcher 单独一个 Pod，不占 GPU）；
- worker Pod 里跑 sshd（示例用 2222 端口，配 readinessProbe 等 sshd 就绪），SSH 密钥由 Trainer 自动生成并挂到 `sshAuthMountPath`；
- 扩到 N 个节点时，`numNodes: N`，`-np` 改成 `N × 8`。

读结果时看最后几行大消息的 `busbw`：

```text
#       size    count   type   redop    time   algbw   busbw  #wrong
  4294967296  1073741824 float  sum   ...   185.2   347.2       0
  8589934592  2147483648 float  sum   ...   186.0   348.8       0
# Out of bounds values : 0 OK
# Avg bus bandwidth    : 150.3
```

`busbw`（总线带宽）= `algbw × 2(n-1)/n`，它消除了 GPU 数量对算法的影响，可以直接和硬件带宽比较。理论峰值按"网卡数 × 单口速率 ÷ 8"估算：8 张 400G 网卡是 8 × 400 ÷ 8 = 400 GB/s。

| busbw / 理论峰值 | 评价 |
| --- | --- |
| ≥ 90% | 优秀 |
| 80%～90% | 可接受 |
| < 80% | 异常，需排查 |

通过标准：`Out of bounds values: 0 OK`、`#wrong` 全为 0、大消息 busbw 达到峰值的 90% 以上。验收之后还要跑一轮**压力测试**：`-b 8G -e 8G -i 0` 固定 8GB 消息长时间循环，观察带宽是否稳定、有无网卡 flap 或 XID 错误。

> [!TIP] 带宽不达标的常见原因
> 用 `NCCL_DEBUG=INFO` 看日志里的 `NET/IB` 行。如果出现 `NET/Socket`，说明 NCCL 退回了 TCP，检查 `rdma/hca` 资源和 `IPC_LOCK`；如果只用了部分网卡，检查 `NCCL_IB_HCA`；带宽只有一半，检查 GID index、交换机 PFC 配置和 GPU/网卡的 PCIe 拓扑（`nvidia-smi topo -m`）。

同一个 runtime 思路也可以用来跑 `nvbandwidth`，测单机内 GPU 与主机、GPU 与 GPU 之间的带宽，在新机器上线时和 NCCL tests 一起作为硬件验收项。

## 实战：Megatron 多机训练的关键配置

下面是 2 节点 × 8 卡、8 轨道 RoCE 上运行 Megatron-LM 的 TrainJob 关键片段（Spiderpool 组网）：

```yaml title="megatron-trainjob.yaml（节选）"
spec:
  runtimeRef:
    name: torch-distributed
  trainer:
    numNodes: 2
    numProcPerNode: 8
    image: nvcr.io/nvidia/pytorch:25.01-py3
    resourcesPerNode:
      limits:
        nvidia.com/gpu: 8
        rdma/hca1: 1
        rdma/hca2: 1
        # ... 直到 rdma/hca8
    env:
      - { name: NCCL_IB_DISABLE, value: "0" }
      - { name: NCCL_IB_HCA, value: "mlx5" }
      - { name: NCCL_IB_GID_INDEX, value: "7" }        # macvlan 下 RoCE v2 + Pod IP 的那一条
      - { name: NCCL_IB_QPS_PER_CONNECTION, value: "8" }
      - { name: NCCL_SOCKET_IFNAME, value: "eth0" }    # 引导连接走 Pod 主网卡
```

8 块 RDMA 网卡的 Multus 注解属于平台细节，团队把它写在自定义 TrainingRuntime 的 Pod 模板里，用户的 TrainJob 不用关心：

```yaml title="TrainingRuntime 中 node Pod 模板的注解（节选）"
metadata:
  annotations:
    k8s.v1.cni.cncf.io/networks: >-
      spiderpool/hca1,spiderpool/hca2,spiderpool/hca3,spiderpool/hca4,
      spiderpool/hca5,spiderpool/hca6,spiderpool/hca7,spiderpool/hca8
```

> [!WARNING] 多机 RoCE 作业要用满 8 卡
> 在共享 RDMA 设备 + macvlan 的组网下，同一台机器上每多一个作业实例，GID 表就会多出一组条目，index 自动递增，`NCCL_IB_GID_INDEX` 写死的值就对不上了；同时每个轨道子网的 IP 也有限。团队的约定是：**跨节点的 RoCE 作业一律按整机 8 卡申请**，小于 8 卡的任务只在单机内跑。

并行策略也要和拓扑对齐：

- **张量并行（TP）** 通信最密集，必须限制在单机内，TP = 8 走 NVLink；
- **流水线并行（PP）** 跨节点，PP 需要能整除节点数；
- 剩下的维度是 **数据并行（DP）** = 总卡数 ÷ (TP × PP)。

数据集和 checkpoint 放在所有节点共享的 PVC 上（挂到 `/workspace`）。多机训练的 checkpoint 动辄几百 GB，写入时所有 rank 同时落盘，对存储的并发写带宽要求很高，这也是 AI 集群普遍选用 GPFS、JuiceFS、3FS、WEKA、VAST 等并行文件系统而不是 NFS 的原因（见 [生产存储](/learn/production-storage)）。

## 动手练习

1. 在 kind 里安装 Kubeflow Trainer，提交 `pytorch-simple.yaml`（去掉 Kueue 标签和 `suspend`），查看两个 Pod 的日志，找出 `PET_NODE_RANK` 分别是多少。
2. 在 [批调度](/learn/batch-scheduling) 练习的 Kueue 环境中，保留标签和 `suspend: true` 重新提交，把 ClusterQueue 的 cpu 配额调到只够 1 个节点，观察 TrainJob 整体排队而不是只起一个 Pod。
3. 用 `kubectl get clustertrainingruntime torch-distributed -o yaml` 读一遍内置 runtime，说说它的 `mlPolicy`、`template` 分别定义了什么。
4. 如果你有 RDMA 集群：部署一个带 `IPC_LOCK` 的 hostNetwork DaemonSet，在两个节点间跑 `ib_write_bw`，再跑 2 节点的 nccl-tests，按本课的公式计算 busbw 占理论峰值的比例。
5. 给一个 4 节点 × 8 卡、要训练 70B 模型的作业设计 TP/PP/DP，说明理由。

## 自测

<details>
<summary>TrainingRuntime 和 TrainJob 为什么要拆成两个对象？</summary>

职责分离。TrainingRuntime 由平台管理员维护，封装框架启动方式、Pod 结构、网络注解、共享内存、调度集成等平台细节；TrainJob 由用户编写，只描述镜像、命令、节点数和资源。用户不需要懂 RDMA 和 Gang 调度，管理员也能统一升级运行时。

</details>

<details>
<summary>RoCE 和 InfiniBand 相比，在 Kubernetes 里多了哪些麻烦？</summary>

RoCE 基于以太网，RDMA 通信需要网卡上的 IP，GID 和 IP 绑定。Pod 要么使用 hostNetwork 直接用宿主机 IP，要么通过 Multus 挂 macvlan 子接口并用 IPAM 分配 IP；还必须设置正确的 `NCCL_IB_GID_INDEX`，而且交换机需要配置无损网络（PFC/ECN）。IB 只需要把 RDMA 设备交给容器。

</details>

<details>
<summary>hostNetwork 和 macvlan 两种 RDMA 组网方式各适合什么场景？</summary>

hostNetwork 不需要额外组件，适合硬件验收和独占节点的作业，但一个节点同时只能跑一个作业（端口冲突），隔离性差。macvlan 给每个 Pod 独立 IP，同一节点可以并行多个作业，适合生产，但需要 Multus、CNI 插件和 IPAM，并要重新确认 GID index。

</details>

<details>
<summary>nccl-tests 结果里的 busbw 为什么比 algbw 更适合做验收指标？</summary>

algbw 是"消息大小 ÷ 耗时"，会随参与的 GPU 数量变化，难以和硬件比较。busbw 按 AllReduce 的通信量乘以 2(n-1)/n 进行校正，反映的是每条链路实际承载的带宽，可以直接与网卡总带宽比较。一般大消息的 busbw 达到理论峰值 90% 以上视为优秀。

</details>

<details>
<summary>为什么张量并行应该限制在单机内？</summary>

张量并行把单层的矩阵计算切到多张卡上，每一层前向和反向都要做集合通信，通信频率和数据量都是最大的。单机内 GPU 之间走 NVLink/NVSwitch，带宽是跨机 RDMA 网络的数倍；跨机做 TP 会让 GPU 大量时间在等网络。

</details>

## 参考资料

- [Kubernetes 官方文档：Job](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/job/)
- [Kubernetes 官方文档：网络插件](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [Kubeflow Trainer 官方文档](https://www.kubeflow.org/docs/components/trainer/)
- [JobSet 项目](https://jobset.sigs.k8s.io/)
- [NVIDIA Network Operator 项目](https://github.com/Mellanox/network-operator)
- [Multus CNI](https://github.com/k8snetworkplumbingwg/multus-cni)
- [Spiderpool 官方文档](https://spidernet-io.github.io/spiderpool/)
- [NCCL Tests](https://github.com/NVIDIA/nccl-tests)
- [NCCL Tests：性能指标说明](https://github.com/NVIDIA/nccl-tests/blob/master/doc/PERFORMANCE.md)
- [NCCL 环境变量](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html)
- [nvbandwidth](https://github.com/NVIDIA/nvbandwidth)
- [Megatron-LM](https://github.com/NVIDIA/Megatron-LM)
