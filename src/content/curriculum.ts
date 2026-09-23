// 课程大纲：唯一的元数据来源。正文放在 src/content/lessons/<stage.id>/<slug>.md
export type Lesson = {
  slug: string
  title: string
  summary: string
  minutes: number
}

export type Stage = {
  id: string
  index: number
  name: string
  level: string
  tagline: string
  goal: string
  lessons: Lesson[]
}

export const stages: Stage[] = [
  {
    id: 'stage-0',
    index: 0,
    name: '启程',
    level: 'Prerequisites',
    tagline: '搞懂容器，搭好实验环境',
    goal: '理解容器与 Kubernetes 要解决的问题，在自己电脑上跑起第一个集群。',
    lessons: [
      { slug: 'welcome', title: '学习路线与使用指南', summary: '这套教程怎么学、每个阶段学到什么程度、需要准备什么。', minutes: 10 },
      { slug: 'containers', title: '容器基础：从进程到镜像', summary: 'Namespace、cgroup、镜像分层、容器运行时，写出第一个 Dockerfile。', minutes: 35 },
      { slug: 'why-kubernetes', title: '为什么需要 Kubernetes', summary: '从单机容器到集群编排：声明式、控制循环与 K8s 架构全景。', minutes: 25 },
      { slug: 'local-cluster', title: '搭建本地实验集群', summary: '安装 kubectl，用 kind 创建多节点集群，部署第一个应用。', minutes: 30 },
    ],
  },
  {
    id: 'stage-1',
    index: 1,
    name: '入门',
    level: 'Beginner',
    tagline: '掌握核心对象',
    goal: '能用 YAML 声明式地部署一个无状态 Web 应用，并对外提供服务。',
    lessons: [
      { slug: 'kubectl-and-yaml', title: 'kubectl 与声明式 API', summary: 'API 对象的结构、kubectl 常用命令、explain / dry-run / diff 工作流。', minutes: 35 },
      { slug: 'pods', title: 'Pod：最小调度单元', summary: 'Pod 的生命周期、多容器模式、Init 容器，以及怎样看日志、进容器。', minutes: 40 },
      { slug: 'labels-namespaces', title: '标签、注解与命名空间', summary: '用标签选择器组织资源，用命名空间做隔离与配额。', minutes: 25 },
      { slug: 'deployments', title: 'ReplicaSet 与 Deployment', summary: '副本控制、滚动更新、回滚与发布策略。', minutes: 40 },
      { slug: 'services', title: 'Service 与服务发现', summary: 'ClusterIP、NodePort、LoadBalancer、Headless，以及集群 DNS。', minutes: 40 },
      { slug: 'configmaps-secrets', title: 'ConfigMap 与 Secret', summary: '把配置和敏感信息从镜像里解耦出来，环境变量与卷两种注入方式。', minutes: 30 },
    ],
  },
  {
    id: 'stage-2',
    index: 2,
    name: '进阶',
    level: 'Intermediate',
    tagline: '让应用可靠地跑起来',
    goal: '能为真实应用配置健康检查、资源、存储、调度和入口流量，并用 Helm / Kustomize 管理。',
    lessons: [
      { slug: 'probes-resources', title: '健康检查与资源管理', summary: '三种探针、requests/limits、QoS 等级、LimitRange 与 ResourceQuota。', minutes: 40 },
      { slug: 'storage-basics', title: '存储：Volume、PV、PVC 与 StorageClass', summary: '临时卷与持久卷、静态与动态供给、访问模式和回收策略。', minutes: 45 },
      { slug: 'statefulsets', title: 'StatefulSet 与有状态应用', summary: '稳定的网络标识和存储，部署一个多副本数据库。', minutes: 35 },
      { slug: 'jobs-daemonsets', title: 'Job、CronJob 与 DaemonSet', summary: '一次性任务、定时任务，以及每个节点一个的守护进程。', minutes: 30 },
      { slug: 'ingress-gateway', title: 'Ingress 与 Gateway API', summary: '七层流量入口：Ingress 的用法与局限，新一代 Gateway API。', minutes: 40 },
      { slug: 'scheduling', title: '调度：亲和性、污点与拓扑分布', summary: 'nodeSelector、亲和/反亲和、污点与容忍、topologySpreadConstraints、优先级。', minutes: 40 },
      { slug: 'helm-kustomize', title: '用 Helm 与 Kustomize 管理应用', summary: 'Chart、values、release；Kustomize 的 base/overlay；Helmwave 组合编排。', minutes: 40 },
    ],
  },
  {
    id: 'stage-3',
    index: 3,
    name: '原理',
    level: 'Advanced',
    tagline: '深入内部机制',
    goal: '理解控制平面、网络、安全和扩展机制是怎样工作的，能解释"为什么"。',
    lessons: [
      { slug: 'control-plane', title: '控制平面深入：一个 Pod 的诞生', summary: 'apiserver、etcd、scheduler、controller-manager、kubelet 如何协作。', minutes: 45 },
      { slug: 'networking-model', title: '网络模型与 CNI', summary: 'Pod 网络三原则、CNI 插件、kube-proxy 的 iptables/IPVS 与 Cilium eBPF。', minutes: 50 },
      { slug: 'rbac', title: '认证、授权与 RBAC', summary: 'User 与 ServiceAccount、Role/ClusterRole、最小权限实践。', minutes: 40 },
      { slug: 'security', title: '工作负载安全加固', summary: 'securityContext、Pod Security Standards、NetworkPolicy 与按 FQDN 限制出口。', minutes: 45 },
      { slug: 'autoscaling', title: '自动扩缩容', summary: 'metrics-server、HPA、VPA 与集群节点自动扩缩。', minutes: 35 },
      { slug: 'crd-operator', title: 'CRD 与 Operator 模式', summary: '扩展 Kubernetes API，理解 Operator 如何把运维知识写成代码。', minutes: 40 },
    ],
  },
  {
    id: 'stage-4',
    index: 4,
    name: '生产',
    level: 'Production',
    tagline: '部署和运维真实集群',
    goal: '能规划、部署并长期运维一个高可用的生产集群，出了问题知道从哪里查。',
    lessons: [
      { slug: 'cluster-planning', title: '生产集群规划', summary: '节点角色与命名规范、高可用拓扑、网络规划、etcd 磁盘验收。', minutes: 40 },
      { slug: 'kubespray', title: '用 Kubespray 部署高可用集群', summary: 'inventory 规划、关键变量、kube-vip、离线部署、扩容与重置。', minutes: 60 },
      { slug: 'production-networking', title: '生产网络：Cilium、MetalLB 与证书', summary: '安装 Cilium 的坑、裸金属 LoadBalancer、cert-manager 自动签发证书。', minutes: 50 },
      { slug: 'production-storage', title: '生产存储：CSI 选型与 Rook-Ceph', summary: 'local-path、NFS、Ceph、GPFS 等 CSI 选型，Rook-Ceph 部署与快照。', minutes: 55 },
      { slug: 'observability', title: '可观测性：指标、日志与事件', summary: 'VictoriaMetrics + Grafana、日志采集、事件持久化与告警。', minutes: 50 },
      { slug: 'registry', title: '镜像仓库与镜像分发', summary: 'Registry 与 Harbor 选型、P2P 分发（Spegel / Dragonfly）、镜像加速。', minutes: 35 },
      { slug: 'day2-operations', title: 'Day-2 运维：升级、扩容与 etcd 维护', summary: '版本升级评估、节点增删、控制平面扩容、etcd 备份与碎片整理。', minutes: 50 },
      { slug: 'troubleshooting', title: '故障排查方法论', summary: '从 Pod 到节点到集群的排查路径，kubectl debug 与常见故障案例。', minutes: 50 },
    ],
  },
  {
    id: 'stage-5',
    index: 5,
    name: '专家',
    level: 'Expert',
    tagline: '构建 AI 与平台级能力',
    goal: '能在 K8s 上建设 GPU/AI 平台和多租户平台，并持续跟进社区演进。',
    lessons: [
      { slug: 'gpu-operator', title: 'GPU 调度与 GPU Operator', summary: 'Device Plugin、NFD、GPU Operator、驱动策略与 GPU 共享。', minutes: 50 },
      { slug: 'batch-scheduling', title: '批调度：Kueue、Volcano 与 Gang 调度', summary: '队列与配额、公平共享、PodGroup 全有或全无调度。', minutes: 45 },
      { slug: 'distributed-training', title: '分布式训练与高性能网络', summary: 'Kubeflow Trainer、RDMA/RoCE、Network Operator、NCCL 带宽测试。', minutes: 55 },
      { slug: 'llm-inference', title: '大模型推理服务', summary: 'vLLM / SGLang 部署、LeaderWorkerSet 跨节点推理、推理网关与 llm-d。', minutes: 55 },
      { slug: 'multi-tenancy', title: '多租户与平台工程', summary: '命名空间租户、vcluster 虚拟集群、托管控制平面与 GitOps。', minutes: 45 },
      { slug: 'next-steps', title: '认证考试与持续成长', summary: 'CKA / CKAD / CKS 备考、跟进社区与版本演进的方法。', minutes: 20 },
    ],
  },
]

export type LessonRef = Lesson & { stage: Stage; index: number }

export const allLessons: LessonRef[] = stages.flatMap((stage) =>
  stage.lessons.map((lesson) => ({ ...lesson, stage, index: 0 })),
).map((l, index) => ({ ...l, index }))

export function findLesson(slug: string) {
  const i = allLessons.findIndex((l) => l.slug === slug)
  if (i === -1) return undefined
  return { lesson: allLessons[i], prev: allLessons[i - 1], next: allLessons[i + 1] }
}

export const totalMinutes = allLessons.reduce((sum, l) => sum + l.minutes, 0)
