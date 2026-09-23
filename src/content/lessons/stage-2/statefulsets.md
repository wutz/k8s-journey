# StatefulSet 与有状态应用

Deployment 假设所有副本都一样：名字随机、谁先谁后无所谓、共享同一份（或者没有）存储，删掉一个换一个新的就行。但数据库集群不是这样：主节点和从节点角色不同，从节点要知道去哪里找主节点，每个副本都有自己的数据目录，重建后必须拿回原来那份数据。

StatefulSet 为这类应用提供**稳定的网络标识**、**稳定的独立存储**和**有序的部署与更新**。学完这一课，你能解释 StatefulSet 与 Deployment 的差异，用 Headless Service 和 volumeClaimTemplates 部署一个一主两从的 Redis，并掌握有序启动、并行启动和分区滚动更新。

## Deployment 不够用在哪

用 Deployment 跑三副本 Redis 会遇到这些问题：

| 需求 | Deployment | StatefulSet |
|---|---|---|
| Pod 名字 | `redis-7c9f8-xk2p9`，重建后变化 | `redis-0`、`redis-1`、`redis-2`，重建后不变 |
| DNS 名称 | 只有 Service 名 | 每个 Pod 一个：`redis-0.redis.<ns>.svc.cluster.local` |
| 存储 | 所有副本共用同一个 PVC（或没有） | 每个副本自动创建独立 PVC，重建后重新挂回 |
| 启动顺序 | 同时启动 | 默认按 0 → 1 → 2 依次启动，前一个 Ready 才启动下一个 |
| 缩容顺序 | 随机 | 从序号最大的开始 |

## 核心组成

```text
             Headless Service "redis"（clusterIP: None）
             为每个 Pod 提供 DNS 记录
                 │
 StatefulSet "redis" (replicas: 3, serviceName: redis)
   ├── redis-0 ──▶ PVC data-redis-0 ──▶ PV
   ├── redis-1 ──▶ PVC data-redis-1 ──▶ PV
   └── redis-2 ──▶ PVC data-redis-2 ──▶ PV
```

- **Headless Service**：[Service 与服务发现](/learn/services)里讲过，`clusterIP: None` 的 Service 不做负载均衡，DNS 直接返回 Pod IP。StatefulSet 的 `spec.serviceName` 指向它后，每个 Pod 都会获得 `<pod名>.<service名>` 形式的稳定 DNS 名称。
- **volumeClaimTemplates**：PVC 模板。控制器为每个序号创建名为 `<模板名>-<pod名>` 的 PVC，Pod 重建后按名字找回自己的 PVC。
- **序号（ordinal）**：Pod 名字末尾的数字，从 0 开始。应用可以依据序号决定自己的角色。

## 实战：一主两从的 Redis

我们用最朴素的方式搭一个 Redis 主从：`redis-0` 当主节点，其他副本通过稳定的 DNS 名 `redis-0.redis` 复制主节点数据。

```yaml title="redis-sts.yaml"
apiVersion: v1
kind: Service
metadata:
  name: redis
  labels:
    app: redis
spec:
  clusterIP: None           # Headless
  selector:
    app: redis
  ports:
    - name: redis
      port: 6379
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis        # 必须指向上面的 Headless Service
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7.4-alpine
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          command:
            - sh
            - -c
            - |
              if [ "${POD_NAME##*-}" = "0" ]; then
                exec redis-server --appendonly yes --dir /data
              else
                exec redis-server --appendonly yes --dir /data \
                  --replicaof redis-0.redis 6379
              fi
          ports:
            - name: redis
              containerPort: 6379
          readinessProbe:
            exec:
              command: ["redis-cli", "ping"]
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: standard
        resources:
          requests:
            storage: 1Gi
```

`${POD_NAME##*-}` 是 shell 语法，取最后一个 `-` 之后的部分，也就是序号。

```console
$ kubectl apply -f redis-sts.yaml
$ kubectl get pods -l app=redis -w
NAME      READY   STATUS              RESTARTS   AGE
redis-0   0/1     ContainerCreating   0          2s
redis-0   1/1     Running             0          8s
redis-1   0/1     Pending             0          0s     # redis-0 Ready 之后才开始
redis-1   1/1     Running             0          7s
redis-2   0/1     Pending             0          0s
redis-2   1/1     Running             0          6s
$ kubectl get pvc
NAME           STATUS   VOLUME     CAPACITY   ACCESS MODES   STORAGECLASS
data-redis-0   Bound    pvc-...    1Gi        RWO            standard
data-redis-1   Bound    pvc-...    1Gi        RWO            standard
data-redis-2   Bound    pvc-...    1Gi        RWO            standard
```

### 验证稳定网络标识

```bash
kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- nslookup redis-0.redis
kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- nslookup redis
# 第一条返回 redis-0 一个 IP；第二条返回全部三个 Pod 的 IP
```

### 验证主从复制

```bash
kubectl exec redis-0 -- redis-cli set greeting "hello from master"
kubectl exec redis-1 -- redis-cli get greeting        # hello from master
kubectl exec redis-2 -- redis-cli info replication | head -5
# role:slave
# master_host:redis-0.redis
# master_link_status:up
kubectl exec redis-1 -- redis-cli set foo bar         # READONLY You can't write against a read only replica.
```

### 验证稳定存储

```bash
kubectl get pod redis-0 -o wide     # 记下 IP 和节点
kubectl delete pod redis-0
kubectl get pod redis-0 -o wide -w  # 同名 Pod 重建，IP 可能变化，但仍挂载 data-redis-0
kubectl exec redis-0 -- redis-cli get greeting   # 数据还在（AOF 持久化到 PVC）
```

Pod IP 变了没关系，从节点连的是 DNS 名 `redis-0.redis`，会自动重新解析到新 IP。这正是"稳定网络标识"的价值：**稳定的是名字，不是 IP**。

> [!WARNING] 这是教学示例，不是高可用 Redis
> 主节点挂掉后，上面的部署不会自动把从节点提升为主节点，写入会中断直到 `redis-0` 恢复。生产中的 Redis 需要 Sentinel 或 Redis Cluster，PostgreSQL 需要 Patroni 之类的高可用组件。StatefulSet 只提供身份和存储这些"积木"，**故障转移、备份、扩容时的数据重平衡都要应用自己或 Operator 来做**。这也是阶段 3 [CRD 与 Operator 模式](/learn/crd-operator)要解决的问题。

## 扩缩容与 PVC 保留

```bash
kubectl scale statefulset redis --replicas=5   # 依次创建 redis-3、redis-4
kubectl scale statefulset redis --replicas=2   # 先删 redis-4，再删 redis-3、redis-2
kubectl get pvc                                # data-redis-2/3/4 仍然存在
```

缩容或删除 StatefulSet 时，PVC **默认保留**，防止误删数据；再次扩容时 Pod 会挂回原来的 PVC。这个行为可以通过 `persistentVolumeClaimRetentionPolicy` 调整：

```yaml
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain   # 删除 StatefulSet 时：Retain（默认）或 Delete
    whenScaled: Delete    # 缩容时：Retain（默认）或 Delete
```

> [!PROD] 删除 StatefulSet 前先想清楚数据
> `whenDeleted: Delete` 会在删除 StatefulSet 时一并删除 PVC，配合 StorageClass 的 `reclaimPolicy: Delete`，数据就彻底没了。数据库类负载建议保持默认的 Retain，并在 StorageClass 层也使用 Retain。

## Pod 管理策略：有序与并行

`podManagementPolicy` 控制扩缩容时 Pod 的创建和删除顺序：

- `OrderedReady`（默认）：严格按序号依次创建，前一个 Running 且 Ready 才创建下一个；缩容反序进行。适合有主从依赖、需要依次加入集群的应用。
- `Parallel`：同时创建或删除所有 Pod，不等待。适合每个副本彼此独立、只需要稳定标识和存储的应用（例如某些分片存储、分布式训练的 worker），启动更快。

```yaml
spec:
  podManagementPolicy: Parallel
```

注意这个策略只影响扩缩容，不影响滚动更新；而且它是创建后不可修改的字段。

> [!TIP] OrderedReady 下的"卡住"
> 如果某个 Pod 一直不 Ready（例如镜像拉不下来），OrderedReady 会停在那里，后面的 Pod 都不会创建。排查时先看序号最小的那个非 Ready Pod。

## 更新策略

### RollingUpdate：从大序号到小序号

默认的 `RollingUpdate` 策略会**从序号最大的 Pod 开始**逐个删除重建，每个 Pod 更新完成并 Ready 后才处理下一个：

```bash
kubectl set image statefulset/redis redis=redis:7.4.1-alpine
kubectl rollout status statefulset/redis
kubectl get pods -l app=redis -w   # redis-2 → redis-1 → redis-0
```

先更新从节点、最后更新主节点，正好符合多数数据库的升级习惯。

### 分区更新：金丝雀式升级

`rollingUpdate.partition` 表示"只更新序号 **大于等于** partition 的 Pod"，小于它的保持旧版本，即使被删除重建也还是旧版本：

```yaml title="partition-patch.yaml"
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 2
```

```bash
kubectl patch statefulset redis --type merge --patch-file partition-patch.yaml
kubectl set image statefulset/redis redis=redis:7.4.2-alpine
kubectl get pods -l app=redis \
  -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image
# redis-0  redis:7.4.1-alpine
# redis-1  redis:7.4.1-alpine
# redis-2  redis:7.4.2-alpine      ← 只有它升级了
```

观察 `redis-2` 一段时间没有问题后，把 partition 依次调到 1、0，完成全部升级。发现问题就把镜像改回去，影响范围只有一个副本。

另外两个相关设置：

- `rollingUpdate.maxUnavailable`：允许一次更新多个 Pod，加快大规模 StatefulSet 的更新（该字段 v1.35 起为 Beta 并默认开启，以你所用版本的官方文档为准）。
- `type: OnDelete`：控制器不主动更新，只有你手动删除某个 Pod 时它才以新模板重建。适合必须人工逐台操作的数据库升级。

### 回滚的一个坑

如果新版本的 Pod 始终无法 Ready（例如配置错误），把模板改回旧版本后，StatefulSet **不会自动删除那个卡住的坏 Pod**，需要手动 `kubectl delete pod` 让它按旧模板重建。这是为了避免在有状态应用上做出可能损坏数据的自动操作。

## 生产注意事项

> [!PROD] StatefulSet 在生产中的几点经验
> - **优先使用成熟的 Operator 或 Helm Chart**（如 CloudNativePG、各类 Redis Operator），而不是手写 StatefulSet 管理数据库。
> - 为 StatefulSet 配置 **PodDisruptionBudget**，避免节点维护（`kubectl drain`）时同时驱逐多数副本导致集群失去法定人数。
> - 使用本地盘时，Pod 与数据绑定在节点上：节点永久故障后，需要手工删除 PVC 让 Pod 在别处重建，再由应用层复制数据。
> - 配合 Pod 反亲和让副本分散在不同节点，详见[调度](/learn/scheduling)一课。

## 动手练习

1. 部署上面的 Redis，删除 `redis-1` 的 Pod，确认它重建后仍是从节点，数据自动同步。
2. 把 `podManagementPolicy` 改为 `Parallel` 的新 StatefulSet（取名 `redis-par`），扩容到 5，观察和 OrderedReady 的区别。
3. 用 partition 做一次分阶段升级：先只升级 `redis-2`，再全部升级，最后把镜像改回原版本。
4. 删除整个 StatefulSet（`kubectl delete sts redis`），确认 PVC 仍在；重新 apply 后用 `redis-cli get greeting` 验证数据回来了。
5. 清理：删除 StatefulSet、Service 后，再手动删除 `data-redis-*` PVC。

## 自测

<details>
<summary>StatefulSet 为什么需要一个 Headless Service？</summary>

StatefulSet 通过 `serviceName` 关联的 Headless Service 为每个 Pod 创建稳定的 DNS 记录 `<pod名>.<service名>.<命名空间>.svc.cluster.local`。普通 ClusterIP Service 只提供一个负载均衡的虚拟 IP，无法定位到具体某个副本，而主从复制、集群成员发现都需要按名字找到特定副本。

</details>

<details>
<summary>redis-0 被删除重建后，它的 IP、名字和数据哪些会变？</summary>

名字不变（仍是 `redis-0`），数据不变（重新挂载同名 PVC `data-redis-0`），IP 通常会变。其他组件应该通过 DNS 名而不是 IP 访问它。

</details>

<details>
<summary>把 StatefulSet 从 5 副本缩到 2 副本，哪些 Pod 会被删除？PVC 会怎样？</summary>

按序号从大到小删除 `redis-4`、`redis-3`、`redis-2`。默认 `whenScaled: Retain`，它们的 PVC 保留，下次扩容时重新挂回。

</details>

<details>
<summary>partition 设为 2、副本数为 3 时更新镜像，哪些 Pod 会被更新？</summary>

只有序号大于等于 2 的 `redis-2` 会被更新；`redis-0` 和 `redis-1` 保持旧版本，即使被删除重建也使用旧模板。

</details>

<details>
<summary>什么情况下适合把 podManagementPolicy 设为 Parallel？</summary>

副本之间没有启动顺序依赖、只需要稳定身份和独立存储时，例如彼此独立的分片、需要同时启动的分布式任务。Parallel 可以显著缩短扩容和启动时间，但不影响滚动更新顺序。

</details>

## 参考资料

- [Kubernetes 官方文档：StatefulSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes 官方文档：StatefulSet 基础](https://kubernetes.io/zh-cn/docs/tutorials/stateful-application/basic-stateful-set/)
- [Kubernetes 官方文档：Service 与 Pod 的 DNS](https://kubernetes.io/zh-cn/docs/concepts/services-networking/dns-pod-service/)
- [Kubernetes 官方文档：为应用程序设置干扰预算](https://kubernetes.io/zh-cn/docs/tasks/run-application/configure-pdb/)
- [Redis 官方文档：Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
