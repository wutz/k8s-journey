# 大模型推理服务

把一个大语言模型（LLM）跑起来很容易，一条 `vllm serve` 就行；难的是把它变成一个稳定、便宜、能扛住流量的服务。大模型推理和普通 Web 服务有几处本质区别：单个副本就要占 1 到 16 张 GPU，启动要加载几十到几百 GB 的权重，每个请求的耗时从几百毫秒到几分钟不等，而且副本内部有 KV Cache 这种"状态"，同样的请求发给不同副本，性能能差好几倍。

这一课从单机部署 vLLM / SGLang 开始，然后用 LeaderWorkerSet（LWS）把一个副本扩展到多台机器，再介绍 Gateway API 推理扩展（Inference Extension）如何按 KV Cache 和队列长度做智能路由、Prefill/Decode 分离架构，以及把这些组合起来的 llm-d 项目。最后讲怎么用 EvalScope 做压测，拿数据说话。

> [!NOTE] 本课需要的环境
> 真实推理需要 GPU 节点和已安装的 GPU Operator（见 [GPU 调度与 GPU Operator](/learn/gpu-operator)），跨节点推理还需要 RDMA 网络（见 [分布式训练与高性能网络](/learn/distributed-training)）。推理网关部分可以在 kind 里用不需要 GPU 的模拟器 `llm-d-inference-sim` 完整体验。

## 推理服务的几个关键指标

压测和调优之前先统一语言：

| 指标 | 含义 | 影响因素 |
| --- | --- | --- |
| TTFT（Time To First Token） | 首 token 延迟，用户看到第一个字的时间 | 输入长度、排队、Prefill 算力、KV Cache 命中 |
| TPOT / ITL（Time Per Output Token） | 生成每个后续 token 的间隔 | Decode 阶段的显存带宽、批大小 |
| 吞吐（tokens/s） | 单位时间生成的 token 总数 | 并发、批处理、张量并行度 |
| 并发 | 同时在处理的请求数 | 显存（KV Cache 容量） |

LLM 推理分两个阶段：**Prefill** 一次性处理整段输入、生成 KV Cache，是计算密集型；**Decode** 每次生成一个 token，要反复读取全部权重和 KV Cache，是访存密集型。这两个阶段特性相反，后面的 PD 分离就是针对这一点做的。

## 单机部署：vLLM

vLLM 和 SGLang 是目前最主流的两个开源推理引擎，都提供 OpenAI 兼容的 HTTP 接口。单机单卡的部署就是一个普通的 Deployment 或 StatefulSet：

```yaml title="vllm-qwen.yaml"
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: qwen3-8b
spec:
  replicas: 4
  serviceName: qwen3-8b
  selector:
    matchLabels:
      app: qwen3-8b
  template:
    metadata:
      labels:
        app: qwen3-8b
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:v0.11.0
          command: ["vllm", "serve", "/models/Qwen3-8B"]
          args:
            - --served-model-name=Qwen3-8B
            - --max-model-len=32768
            - --gpu-memory-utilization=0.85
            - --tensor-parallel-size=1
          ports:
            - containerPort: 8000
          readinessProbe:
            httpGet: { path: /health, port: 8000 }
            periodSeconds: 10
          startupProbe:                        # 加载权重可能要几分钟
            httpGet: { path: /health, port: 8000 }
            failureThreshold: 60
            periodSeconds: 10
          resources:
            limits:
              nvidia.com/gpu: 1
          volumeMounts:
            - { name: models, mountPath: /models }
            - { name: dshm, mountPath: /dev/shm }
      volumes:
        - name: models
          persistentVolumeClaim:
            claimName: llm-model
        - name: dshm
          emptyDir:
            medium: Memory
            sizeLimit: 15Gi
```

几个要点：

- `--gpu-memory-utilization` 决定 vLLM 预留多少显存。除了权重，剩下的全部分给 KV Cache，这决定了能并发多少请求。
- `/dev/shm` 要用内存型 emptyDir 放大，多卡张量并行时进程间通信会用到。
- 一定要配 `startupProbe`（见 [健康检查与资源管理](/learn/probes-resources)），否则大模型加载期间就会被 liveness 杀掉。
- 模型权重放在共享的 PVC 上，所有副本复用同一份；团队的做法是先起一个带 `modelscope` 或 `huggingface-cli` 的临时 Pod，把模型下载到 PVC 里。

> [!PROD] 模型加载是冷启动的瓶颈
> 一个 70B 的 FP16 模型约 140GB。从网络存储加载时，副本启动时间主要花在读权重上。扩容慢会让 HPA 失去意义。生产上常见的做法是：模型放在高带宽并行文件系统上、节点本地预热缓存、或者使用引擎的分片加载功能。评估存储时要实测"N 个副本同时冷启动"的场景。

## 跨节点推理：LeaderWorkerSet

DeepSeek-R1（671B）这样的模型，FP8 权重也要约 700GB，单机 8 张 80GB 的卡放不下，一个副本必须跨两台机器：机内张量并行（TP=8），机间流水线并行（PP=2）。

这时的"副本"已经不是一个 Pod，而是**一组 Pod**：一个 leader 负责对外服务和协调，若干 worker 提供算力。它们必须一起创建、一起调度、一起重启，扩容也要按组扩。Deployment 和 StatefulSet 都表达不了这个语义，于是 SIG Apps 做了 LeaderWorkerSet（LWS）：

```text
LeaderWorkerSet (replicas: 2, size: 2)
 ├── 组 0：vllm-0 (leader)  +  vllm-0-1 (worker)   ← 一个完整的模型副本，16 卡
 └── 组 1：vllm-1 (leader)  +  vllm-1-1 (worker)   ← 另一个副本
Service 只选 leader，请求进 leader，leader 通过 Ray 调度到本组所有 GPU
```

```yaml title="vllm-lws.yaml（节选）"
apiVersion: leaderworkerset.x-k8s.io/v1
kind: LeaderWorkerSet
metadata:
  name: vllm
spec:
  replicas: 1
  leaderWorkerTemplate:
    size: 2                                  # 每组 1 leader + 1 worker
    restartPolicy: RecreateGroupOnPodRestart # 任一 Pod 重启，整组重建
    leaderTemplate:
      metadata:
        labels:
          role: leader
      spec:
        containers:
          - name: vllm-leader
            image: vllm/vllm-openai:v0.8.5.post1
            command: ["sh", "-c"]
            args:
              - bash /vllm-workspace/examples/online_serving/multi-node-serving.sh leader
                  --ray_cluster_size=$(LWS_GROUP_SIZE);
                python3 -m vllm.entrypoints.openai.api_server --port 8080
                  --model /models/DeepSeek-R1
                  --tensor-parallel-size 8 --pipeline-parallel-size 2
            resources:
              limits:
                nvidia.com/gpu: "8"
                rdma/hca: 1
    workerTemplate:
      spec:
        containers:
          - name: vllm-worker
            image: vllm/vllm-openai:v0.8.5.post1
            command: ["sh", "-c"]
            args:
              - bash /vllm-workspace/examples/online_serving/multi-node-serving.sh worker
                  --ray_address=$(LWS_LEADER_ADDRESS)
            resources:
              limits:
                nvidia.com/gpu: "8"
                rdma/hca: 1
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-leader
spec:
  type: LoadBalancer
  selector:
    leaderworkerset.sigs.k8s.io/name: vllm
    role: leader
  ports:
    - port: 8080
      targetPort: 8080
```

LWS 会注入 `LWS_LEADER_ADDRESS`（leader 的稳定 DNS 名）、`LWS_GROUP_SIZE`、`LWS_WORKER_INDEX` 等环境变量，引擎用它们组建 Ray 集群或 NCCL 通信组。省略的部分（`/dev/shm`、模型卷、`IPC_LOCK`）和上一节相同。

```bash
curl http://192.168.1.240:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "/models/DeepSeek-R1", "messages": [{"role": "user", "content": "你好"}]}'
```

> [!WARNING]
> 跨节点推理对网络极其敏感，PP 每一步都要在机间传激活值。没有 RDMA 的集群上跨节点推理几乎不可用。另外 `RecreateGroupOnPodRestart` 意味着 worker 一个容器崩溃就会让整组重新加载模型，停机时间是分钟级，副本数至少要 2。

## 推理网关：为什么普通负载均衡不够

Service 或普通 Ingress 按轮询、随机或连接数分发请求。对 LLM 来说这很浪费：

- **KV Cache 前缀复用**：多轮对话、共享的长 system prompt，如果请求落在已经缓存了这段前缀的副本上，Prefill 几乎可以跳过，TTFT 会下降一个数量级。轮询会把它们打散。
- **负载不均**：一个请求可能只生成 10 个 token，也可能生成 8000 个。按请求数均衡时，某些副本的队列会越排越长。
- **多模型、多 LoRA**：同一个入口背后可能有多个模型，要根据请求体里的 `model` 字段路由。

Gateway API 推理扩展（Gateway API Inference Extension，GIE）是 SIG Network 的项目，它在 [Gateway API](/learn/ingress-gateway) 基础上增加了一个 `InferencePool` 后端类型，以及一个**端点选择器**（Endpoint Picker，EPP）。网关（Istio、kgateway、Envoy Gateway 等）每收到一个请求，就通过 ext-proc 协议问 EPP 该发给哪个 Pod，EPP 根据各副本上报的 KV Cache 命中情况、队列长度、LoRA 加载情况打分。

```text
Client → Gateway (Envoy) ──ext-proc──→ EPP（打分：前缀命中、队列、KV 使用率）
             │                              │
             └──────── 转发到选中的 Pod ←────┘
                     InferencePool（label 选中的一组 vLLM Pod）
```

### 部署

先装网关实现。以 kgateway 为例，它需要先装 Gateway API 与 GIE 的 CRD：

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml
kubectl apply -k "https://github.com/kubernetes-sigs/gateway-api-inference-extension/config/crd?ref=v1.0.2"

# 截至本文写作时 kgateway v2.1.1，需要开启 inferenceExtension
helm upgrade -i kgateway-crds oci://cr.kgateway.dev/kgateway-dev/charts/kgateway-crds \
  -n kgateway-system --create-namespace --version v2.1.1
helm upgrade -i kgateway oci://cr.kgateway.dev/kgateway-dev/charts/kgateway \
  -n kgateway-system --version v2.1.1 --set inferenceExtension.enabled=true
```

然后用官方 chart 创建 InferencePool 和 EPP，并声明 Gateway 与 HTTPRoute：

```bash
helm install qwen3-8b oci://registry.k8s.io/gateway-api-inference-extension/charts/inferencepool \
  --version v1.0.2 \
  --set inferencePool.modelServers.matchLabels.app=qwen3-8b \
  --set inferenceExtension.replicas=2
```

```yaml title="gateway.yaml"
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: inference-gateway
spec:
  gatewayClassName: kgateway          # 用 Istio 则为 istio
  listeners:
    - name: http
      port: 80
      protocol: HTTP
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: qwen3-8b
spec:
  parentRefs:
    - name: inference-gateway
  rules:
    - backendRefs:
        - group: inference.networking.k8s.io
          kind: InferencePool
          name: qwen3-8b
      timeouts:
        request: 300s                 # 长输出请求，默认超时会被网关截断
```

> [!TIP] 按模型名路由
> 多个模型共用一个网关时，可以部署 GIE 的 Body Based Router（bbr）。它从请求体的 `model` 字段取出模型名，写到 `X-Gateway-Model-Name` 请求头，HTTPRoute 再用 header 匹配把请求发给不同的 InferencePool。

## PD 分离

前面说过 Prefill 是计算密集、Decode 是访存密集。放在同一个进程里，一个长输入的 Prefill 会卡住同批所有请求的 Decode，TPOT 出现毛刺。PD 分离（Prefill/Decode Disaggregation）把两个阶段放到不同的实例上：Prefill 实例算完 KV Cache，通过 RDMA 传给 Decode 实例继续生成。两类实例可以按负载分别扩缩，比例也能调（例如 2 个 Prefill 配 1 个 Decode）。

一个 PD 分离服务由三类角色组成，而且有启动依赖：

| 角色 | 作用 | SGLang 中的启动参数 |
| --- | --- | --- |
| router / scheduler | 接收请求，先发 Prefill 再发 Decode | `sglang_router.launch_router --pd-disaggregation --prefill <url> <bootstrap-port> --decode <url>` |
| prefill | 计算 KV Cache 并通过 RDMA 发出 | `--disaggregation-mode prefill --disaggregation-bootstrap-port 34000` |
| decode | 接收 KV Cache，逐 token 生成 | `--disaggregation-mode decode` |

用 LWS 或多个 Deployment 描述这种"多角色、有依赖、每个角色又可能跨节点"的服务很吃力。团队用的是 SGLang 社区的 RoleBasedGroup（RBG，`workloads.x-k8s.io/v1alpha1`）：在一个对象里声明多个角色、各自的副本数和 `dependencies`（router 等 prefill 和 decode 就绪后再启动），每个角色可以是单 Pod，也可以是 LWS 式的一组 Pod。

> [!PROD] PD 分离不是默认选项
> PD 分离要求 Prefill 与 Decode 实例之间有 RDMA 网络（团队用 Spiderpool 给每个 Pod 挂了 RDMA 网卡传 KV Cache），部署和排障复杂度明显上升。它主要在大模型、长输入、高并发且对 TPOT 稳定性敏感的场景下收益明显。中小模型先用"多副本 + 推理网关"，用压测数据证明瓶颈后再考虑 PD 分离。

## llm-d：把这些组合起来

llm-d 是 Red Hat、Google、IBM 等发起的开源项目，目标是提供一套"Kubernetes 原生的分布式推理参考架构"。它本身不是一个新引擎，而是把前面这些组件组合成经过验证的方案：

- 引擎：vLLM；
- 路由：基于 GIE 的 EPP，扩展了 KV Cache 感知、前缀感知等打分器；
- 部署形态：单机多副本、LWS 跨节点、PD 分离、宽专家并行（Wide EP）等"well-lit path"；
- 网关：Istio 或 kgateway。

它的 `llm-d-infra` chart 负责部署网关等基础设施，各种部署形态以 helmfile 示例的方式提供。最适合入门的是 **inference-sim** 示例：它用 `ghcr.io/llm-d/llm-d-inference-sim` 模拟一个 vLLM，接口和指标都一样，但不需要 GPU，可以在 kind 里完整跑通"网关 → EPP → 模型服务"的链路。

同类的还有 SGLang 社区的 OME（Open Model Engine），它以"模型"和"运行时"为核心抽象，依赖 cert-manager 和 LWS。截至本文写作时这些项目迭代都很快，选型前请阅读各自最新的发布说明。

## 压测：EvalScope

没有数据的调优都是猜。团队用 ModelScope 的 EvalScope 做推理压测：

```bash
pip install 'evalscope[perf]'

evalscope perf \
  --url "http://192.168.1.241/v1/chat/completions" \
  --api openai \
  --model Qwen3-32B \
  --tokenizer-path Qwen/Qwen3-32B \
  --dataset random \
  --min-prompt-length 4096 --max-prompt-length 4096 \
  --min-tokens 1024 --max-tokens 1024 \
  --parallel 1 10 50 100 150 200 \
  --number 2 20 100 200 300 400 \
  --extra-args '{"ignore_eos": true}'
```

- `--parallel` 和 `--number` 一一对应，依次测不同并发下的表现，输出每档的 TTFT、TPOT、吞吐和 P99。
- `ignore_eos` 强制每个请求都生成满 1024 个 token，结果才可比较。
- 固定输入输出长度，便于和其他配置对比。

> [!WARNING] 对比网关效果不要用随机数据集
> `random` 数据集的每个请求都是随机 token，没有任何可复用的前缀，推理网关的前缀感知路由完全发挥不出来，结果和直连 Service 差不多。要比较"推理网关 vs 普通 Service"，应使用有真实前缀重复的数据集（如长文本问答、多轮对话数据集），或者 GIE 项目提供的 benchmark 工具。

## 动手练习

1. 在 kind 里安装 LWS（参考官方安装文档），用 `registry.k8s.io/pause:3.10` 镜像创建一个 `replicas: 2, size: 3` 的 LeaderWorkerSet，观察 Pod 命名规律和标签；手动删除一个 worker Pod，看整组是否被重建。
2. 在 kind 里部署 `llm-d-inference-sim` 作为模型服务（3 个副本），安装 kgateway 和 InferencePool chart，通过 Gateway 发送 `/v1/chat/completions` 请求，查看 EPP 的日志，找出它为每个请求选择了哪个 Pod。
3. 用 EvalScope 对上一步的 Gateway 地址和直连 Service 地址各压测一轮（并发 1、10、50），比较结果，并解释为什么模拟器上差异可能不明显。
4. 如果你有 GPU：部署 vLLM 单卡服务，把 `--gpu-memory-utilization` 从 0.85 调到 0.95，用同样的压测参数比较最大并发和 TTFT 的变化。
5. 给一个 70B 模型、预计峰值 200 并发的业务写一份部署方案：每副本几卡、需要几个副本、是否需要推理网关和 PD 分离，并写出你要压测验证的指标。

## 自测

<details>
<summary>为什么大模型推理的 Pod 一定要配置 startupProbe？</summary>

推理引擎启动时要把几十到几百 GB 的权重读入显存，耗时可能是几分钟。如果只配 livenessProbe，在加载期间探测会失败，kubelet 会反复重启容器，模型永远加载不完。startupProbe 成功之前不执行 liveness 检查，可以给加载留出足够时间。

</details>

<details>
<summary>LeaderWorkerSet 解决了 Deployment 和 StatefulSet 解决不了的什么问题？</summary>

它把"一组 Pod"作为副本单位：一个 leader 加若干 worker 共同组成一个模型实例，按组创建、按组扩缩，任一成员失败时可以整组重建（`RecreateGroupOnPodRestart`），并注入 leader 地址和组大小等环境变量。Deployment/StatefulSet 的副本单位是单个 Pod，无法表达组内依赖和整组重启。

</details>

<details>
<summary>推理网关的 EPP 相比普通负载均衡多考虑了哪些因素？</summary>

EPP 会从各模型服务 Pod 获取实时指标，按 KV Cache 前缀命中、排队请求数、KV Cache 使用率、已加载的 LoRA 等因素为候选 Pod 打分，把请求发给最合适的 Pod。普通负载均衡只看连接数或轮询，不知道请求的前缀能否复用，也不知道各副本的实际负载。

</details>

<details>
<summary>什么是 PD 分离？它需要什么前提条件？</summary>

把推理的 Prefill（计算密集）和 Decode（访存密集）两个阶段拆到不同的实例上运行，Prefill 实例生成的 KV Cache 通过高速网络传给 Decode 实例。好处是两个阶段互不干扰、可以独立扩缩；前提是实例之间有 RDMA 等高带宽低延迟网络，并且有能编排多角色依赖关系的部署工具，如 RBG。

</details>

<details>
<summary>用随机数据集压测，为什么看不出推理网关的效果？</summary>

推理网关的主要收益来自前缀感知路由，即把前缀相同的请求发到已缓存这段 KV 的副本，减少重复 Prefill。随机数据集的请求之间没有公共前缀，缓存命中率接近零，路由策略的差异就体现不出来。

</details>

## 参考资料

- [Kubernetes 官方文档：配置存活、就绪和启动探针](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Kubernetes 官方文档：Gateway API](https://kubernetes.io/zh-cn/docs/concepts/services-networking/gateway/)
- [Kubernetes 博客：Gateway API Inference Extension 介绍](https://kubernetes.io/blog/2025/06/05/introducing-gateway-api-inference-extension/)
- [Gateway API Inference Extension 官方文档](https://gateway-api-inference-extension.sigs.k8s.io/)
- [LeaderWorkerSet 官方文档](https://lws.sigs.k8s.io/)
- [vLLM 文档](https://docs.vllm.ai/)
- [SGLang 文档](https://docs.sglang.ai/)
- [RoleBasedGroup 项目](https://github.com/sgl-project/rbg)
- [llm-d 项目](https://llm-d.ai/)
- [kgateway 文档](https://kgateway.dev/docs/)
- [OME 项目](https://github.com/sgl-project/ome)
- [EvalScope 性能压测文档](https://evalscope.readthedocs.io/zh-cn/latest/user_guides/stress_test/index.html)
