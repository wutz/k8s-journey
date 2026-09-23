# 镜像仓库与镜像分发

在笔记本上 `docker pull` 慢一点无所谓，到了生产集群，镜像就成了基础设施问题：内网节点根本连不上 Docker Hub；一个 30GB 的推理镜像被 100 个节点同时拉取，仓库出口带宽被打满；公司的私有镜像放在哪、谁能推谁能拉；镜像拉取超时导致 Pod 一直卡在 `ContainerCreating`。

这一课讲清生产集群的镜像链路：自建私有仓库怎么选（Registry 还是 Harbor），containerd 怎样配置镜像加速和私有仓库（`hosts.toml`），Pod 怎样用 `imagePullSecrets` 拉取私有镜像，以及怎样用 P2P（Spegel 或 Dragonfly）让节点之间互相分发镜像。

## 一次镜像拉取经过了什么

```text
kubelet ──CRI──▶ containerd
                    │ 1. 解析镜像名 docker.io/library/nginx:1.27
                    │ 2. 查 /etc/containerd/certs.d/docker.io/hosts.toml
                    ▼
        ┌─────────────────────────────┐
        │ 按顺序尝试 mirror：           │
        │   ① Spegel（本机/邻居节点）   │
        │   ② 内网镜像站               │
        │   ③ 上游 registry-1.docker.io │
        └─────────────────────────────┘
                    │ 3. 下载 manifest 与各层 blob
                    ▼
            解压到 snapshotter，创建容器
```

镜像名里的第一段是**仓库主机名**，省略时默认 `docker.io`。containerd 按主机名查找对应的 `hosts.toml`，依次尝试其中列出的镜像源，都失败才回源到上游。理解了这一点，本课后面的配置都是在这条链路上"插入一环"。

## 私有仓库选型：Registry 还是 Harbor

团队的选型结论是"缺省用 Registry，有明确需求再上 Harbor"：

| | Registry（缺省） | Harbor（备选） |
|---|---|---|
| 组件构成 | `registry:3` + 可选 Web UI，单 Deployment + 单 PVC | core / jobservice / portal / registry + PostgreSQL + Redis |
| 认证 | htpasswd Basic Auth，单一账号池 | 用户 / 项目 / 角色 RBAC，可对接 LDAP、OIDC |
| 多租户 | 无项目隔离，登录即可 pull / push / delete | 项目级权限与配额 |
| 上游镜像代理 | 不支持，需要手工同步镜像 | 支持 proxy cache，可代理 docker.io、nvcr.io 等 |
| 漏洞扫描 / 签名 | 无 | Trivy 扫描、镜像签名 |
| 仓库间复制 | 无 | 支持，可用于跨机房分发 |
| 资源开销 | 低 | 高，生产建议外接 PostgreSQL 与 Redis |

换成 Harbor 的典型场景：多团队需要项目隔离和统一认证；想用 proxy cache 代替逐个手工同步上游镜像；有安全合规要求（扫描、签名、保留策略）；需要统一托管 Helm Chart 等 OCI 制品。

### 部署 Registry 的生产要点

```yaml title="registry-deployment.yaml（节选）"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: registry
  namespace: registry
spec:
  replicas: 3                        # 多副本前提：PVC 是 RWX 共享存储
  selector:
    matchLabels: { app: registry }
  template:
    metadata:
      labels: { app: registry }
    spec:
      containers:
        - name: registry
          image: registry:3.0.0
          env:
            - name: REGISTRY_AUTH
              value: htpasswd
            - name: REGISTRY_AUTH_HTPASSWD_REALM
              value: Registry Realm
            - name: REGISTRY_AUTH_HTPASSWD_PATH
              value: /auth/htpasswd
            - name: REGISTRY_STORAGE_DELETE_ENABLED
              value: "true"
            - name: REGISTRY_HTTP_SECRET     # 多副本必须一致，生产改为引用 Secret
              valueFrom:
                secretKeyRef: { name: registry-http-secret, key: secret }
          volumeMounts:
            - { name: auth, mountPath: /auth, readOnly: true }
            - { name: data, mountPath: /var/lib/registry }
      volumes:
        - name: auth
          secret: { secretName: registry-auth }
        - name: data
          persistentVolumeClaim: { claimName: registry-data }
```

踩过的坑逐条列出：

- **多副本要 RWX 存储**。只有 RWO 存储就老老实实单副本；`REGISTRY_HTTP_SECRET` 各副本不一致会导致分片上传失败。
- **htpasswd 必须是 bcrypt 格式**（`htpasswd -Bbn user pass`），Secret 的 key 必须叫 `htpasswd`。真实密码文件不要提交进 Git。
- **Basic Auth 必须配 TLS**。明文 HTTP 只适合隔离的可信内网或临时测试。
- **大镜像过 Ingress** 要检查网关的 body size、连接超时和空闲超时，否则大层上传到一半被断开。
- **删除 manifest 不释放空间**。需要停写后执行 `registry garbage-collect`，写入进行中做 GC 可能删掉正在上传的层。

> [!WARNING] 安全 GC 的最小流程
> 先把 registry 缩到 0 停止写入，再起 1 个副本执行 `registry garbage-collect /etc/docker/registry/config.yml`，最后恢复副本数。更稳妥的做法是停流量后用一个专门的 Job 挂载同一个 PVC 执行 GC。

团队在共享存储上对 Registry 做过基准测试，作为量级参考：10GB 镜像 push 约 42 秒、pull 约 56 秒；20GB 镜像 push 约 68 秒、pull 约 84 秒。实际结果取决于存储和网络，上线前应在自己的环境复测。

### Harbor 的生产要点

- `externalURL` 必须与客户端实际访问地址一致，`docker login` 的认证重定向依赖它，填错会出现"登录成功但 push 401"。
- 默认单层 layer 上限约 128GB，AI 镜像可能超出，团队通过 core 的 `BEEGO_MAX_UPLOAD_SIZE_BYTES` 和 `BEEGO_MAX_MEMORY_BYTES` 调到了 500GiB。
- 在 JuiceFS、NFS 这类非强一致文件系统上跑多实例 `harbor-registry`，同步镜像时会报 `blob upload invalid`。
- 用 Istio 作为 Ingress 时，TLS Secret 必须放在 `istio-system` 命名空间，`certSource: auto` 生成在 `harbor` 命名空间的 Secret Istio 找不到。

> [!PROD] 用 Harbor 做上游代理缓存
> 为 `docker.io`、`ghcr.io`、`nvcr.io`、`registry.k8s.io` 等分别创建"仓库管理 → 目标"，再为每个上游建一个开启"镜像代理"的公开项目。节点拉 `cr.example.com/docker.io/library/nginx:1.27` 时，Harbor 首次回源并缓存，之后全部命中内网。

## containerd 镜像加速：hosts.toml

containerd 从 1.5 开始推荐用 `config_path` 目录下的 `hosts.toml` 配置每个仓库的镜像源，旧的 `registry.mirrors` 写法已废弃。目录结构是"一个仓库主机名一个子目录"：

```text
/etc/containerd/certs.d/
├── docker.io/hosts.toml
├── registry.k8s.io/hosts.toml
├── nvcr.io/hosts.toml
└── cr.example.com/
    ├── hosts.toml
    └── ca.crt
```

主配置里要指向这个目录（containerd 2.x 的 CRI 镜像插件名是 `io.containerd.cri.v1.images`，1.x 是 `io.containerd.grpc.v1.cri`）：

```toml title="/etc/containerd/config.toml（containerd 2.x 节选）"
[plugins."io.containerd.cri.v1.images".registry]
  config_path = "/etc/containerd/certs.d"
```

一个典型的 `hosts.toml`：

```toml title="/etc/containerd/certs.d/docker.io/hosts.toml"
server = "https://registry-1.docker.io"      # 所有 mirror 都失败时回源

[host."https://mirror.example.com/v2/docker.io"]
  capabilities = ["pull", "resolve"]
  override_path = true                        # URL 已含 /v2 路径时必须设置
```

私有仓库的两种情况：

```toml title="/etc/containerd/certs.d/cr.example.com/hosts.toml（企业 CA 签发）"
server = "https://cr.example.com"

[host."https://cr.example.com"]
  capabilities = ["pull", "resolve", "push"]
  ca = "/etc/containerd/certs.d/cr.example.com/ca.crt"
```

```toml title="/etc/containerd/certs.d/192.168.3.111:5000/hosts.toml（内网明文 HTTP）"
server = "http://192.168.3.111:5000"

[host."http://192.168.3.111:5000"]
  capabilities = ["pull", "resolve"]
```

`hosts.toml` 修改后**不需要重启 containerd**，下次拉取即生效；但改 `config.toml` 需要重启。

### 用 Kubespray 统一下发

手工改每个节点不可持续。Kubespray 用 `containerd_registries_mirrors` 变量生成上面这些文件：

```yaml title="inventory/mycluster/group_vars/all/containerd.yml"
containerd_discard_unpacked_layers: false   # Spegel 需要，见下文

containerd_registries_mirrors:
  - prefix: docker.io
    mirrors:
      - host: https://mirror.example.com/v2/docker.io
        capabilities: ["pull", "resolve"]
        skip_verify: false
        override_path: true
  - prefix: nvcr.io
    mirrors:
      - host: https://mirror.example.com/v2/nvcr.io
        capabilities: ["pull", "resolve"]
        skip_verify: false
        override_path: true
```

然后只跑 containerd 相关的任务：`ansible-playbook -i inventory/mycluster/inventory.ini -b cluster.yml --tags=containerd`（先用 `--list-tags` 确认你所用版本的 tag 名）。

> [!PROD] 大镜像拉取超时
> AI 镜像动辄几十 GB，kubelet 默认的 `runtimeRequestTimeout`（2 分钟）内拉不完会报 `context deadline exceeded`，Pod 反复重试。团队在 Kubespray 里设置 `kubelet_config_extra_args: { runtimeRequestTimeout: 15m }`。另外 kubelet 默认串行拉取镜像（`serializeImagePulls: true`），一个大镜像会阻塞同节点其他 Pod 的拉取，可按需开启并行拉取并用 `maxParallelImagePulls` 限制并发数。

## imagePullSecrets：Pod 拉取私有镜像

`hosts.toml` 解决"去哪拉"，认证则通常交给 K8s 的 `imagePullSecrets`，这样凭据按命名空间隔离，不需要写到节点上。

```bash
kubectl create secret docker-registry regcred \
  --docker-server=cr.example.com \
  --docker-username=ci-bot \
  --docker-password='<密码>' \
  -n demo
```

```yaml title="private-pod.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: private-app
  namespace: demo
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: cr.example.com/team-a/app:1.0.0
```

每个 Pod 都写一遍很烦，可以挂到命名空间的默认 ServiceAccount 上，该命名空间里未指定 ServiceAccount 的 Pod 都会自动带上：

```bash
kubectl -n demo patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "regcred"}]}'
```

> [!WARNING] 常见误区
> - `--docker-server` 必须和镜像名里的主机名**完全一致**，包括端口，`cr.example.com:443` 和 `cr.example.com` 不算同一个。
> - Secret 是命名空间级别的，跨命名空间需要各建一份（可用 External Secrets、Reflector 这类工具同步）。
> - 镜像已经在节点缓存里且 `imagePullPolicy: IfNotPresent` 时，即使凭据错误 Pod 也能启动，换个节点就失败，这类"时好时坏"要先想到这一点。

Kubespray 也提供 `containerd_registry_auth` 变量把凭据写进节点 containerd 配置，适合"整个集群都能拉"的基础镜像仓库，但凭据会落在每个节点的配置文件里，按需取舍。

## 镜像 P2P：Spegel 与 Dragonfly

私有仓库解决了"内网有源"，但 100 个节点同时拉同一个 20GB 镜像，仓库仍要吐出 2TB 流量。P2P 分发让节点之间互相提供已有的镜像层。

| | Spegel（缺省） | Dragonfly（备选） |
|---|---|---|
| 组件构成 | 单个 DaemonSet | manager / scheduler / seed client / client + MySQL + Redis |
| 原理 | 节点间互为镜像源，复用 containerd 本地已有的层，无中心 | 独立 P2P 网络，seed client 统一回源 |
| 运行时 | 仅 containerd | containerd、Docker、CRI-O 等 |
| 预热（preheat） | 不支持，只能命中集群内已拉过的层 | 支持，首次拉取也能加速 |
| 分发对象 | 容器镜像 | 容器镜像、模型权重、数据集等任意文件 |
| 资源开销 | 低 | 高 |

缺省选 Spegel：集群用 containerd，要加速的是"同一镜像在多节点间的重复拉取"。需要预热（推理服务大规模扩容时首次拉取也要快）、分发模型权重等非镜像文件、或运行时不是 containerd 时，换 Dragonfly。**两者部署其一即可**，改用 Dragonfly 前先卸载 Spegel。

### Spegel 的工作方式与节点要求

Spegel 在每个节点上运行，通过 containerd 的 API 知道本机有哪些镜像层，并用 Kademlia DHT 向其他节点广播。它把自己作为 mirror 写进每个节点的 `hosts.toml`，排在最前面，找不到的层再落到后面的镜像源。

```yaml title="spegel/values.yml"
spegel:
  prependExisting: true          # 保留已有 hosts.toml 里的 mirror，Spegel 插到最前面
  mirroredRegistries:
    - https://docker.io
    - https://ghcr.io
    - https://registry.k8s.io
    - https://nvcr.io
    - https://quay.io
    - https://cr.example.com     # 私有仓库也要加进来才会被 P2P 加速
```

> [!WARNING] containerd 不能丢弃已解压的层
> Spegel 要把本地的层分享给别人，前提是节点上还保留着压缩层内容。containerd 的 `discard_unpacked_layers = true` 会在解压后删除压缩层，Spegel 就无物可分享。用 Kubespray 部署时设置 `containerd_discard_unpacked_layers: false`。根据团队对 Kubespray 2.30 的评估，containerd 2.1 及以后改用 Transfer Service，该配置不再生效，默认行为已满足 Spegel 需求；具体以你所用版本的发布说明为准。

验证 Spegel 是否生效：

```bash
kubectl -n spegel port-forward svc/spegel 9090
# 浏览器访问 http://localhost:9090/debug/web
# "Last Mirror Success" 显示具体时间而不是 Pending，说明已经从邻居节点拉到过层
```

## 动手练习

以下练习在 kind 中完成，参考了 kind 官方的本地仓库指南。

1. 启动一个带认证的本地仓库，并接入 kind 的网络：
   ```bash
   mkdir -p /tmp/reg-auth
   docker run --rm --entrypoint htpasswd httpd:2 -Bbn demo demo123 > /tmp/reg-auth/htpasswd
   docker run -d --name kind-registry --restart=always -p 127.0.0.1:5001:5000 \
     -v /tmp/reg-auth:/auth \
     -e REGISTRY_AUTH=htpasswd -e REGISTRY_AUTH_HTPASSWD_REALM=demo \
     -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd registry:3
   docker network connect kind kind-registry
   curl -i http://127.0.0.1:5001/v2/                 # 预期 401
   curl -i -u demo:demo123 http://127.0.0.1:5001/v2/ # 预期 200
   ```
2. 集群内的节点通过 Docker 网络名 `kind-registry:5000` 访问这个仓库。它是明文 HTTP，要为每个节点写一份 `hosts.toml` 告诉 containerd 用 http：
   ```bash
   for node in $(kind get nodes); do
     docker exec "$node" mkdir -p /etc/containerd/certs.d/kind-registry:5000
     printf 'server = "http://kind-registry:5000"\n\n[host."http://kind-registry:5000"]\n  capabilities = ["pull", "resolve"]\n' | \
       docker exec -i "$node" tee /etc/containerd/certs.d/kind-registry:5000/hosts.toml
   done
   docker exec kind-control-plane grep -n config_path /etc/containerd/config.toml
   ```
   如果最后一条命令没有输出，说明你的 kind 节点镜像没有启用 `config_path`，需要按 kind 本地仓库指南在集群配置里加 `containerdConfigPatches` 重建集群。
3. 从宿主机经 `localhost:5001` 推送镜像，在集群里用 `kind-registry:5000` 拉取：
   ```bash
   docker login localhost:5001 -u demo -p demo123
   docker pull nginx:1.27 && docker tag nginx:1.27 localhost:5001/demo/nginx:1.27
   docker push localhost:5001/demo/nginx:1.27
   kubectl run nosecret --image=kind-registry:5000/demo/nginx:1.27
   ```
   观察 `nosecret` 进入 `ErrImagePull`，`kubectl describe` 里能看到 401。然后创建 `docker-registry` 类型的 Secret（`--docker-server=kind-registry:5000`，要和镜像名里的主机名一致），写一个带 `imagePullSecrets` 的 Pod，确认它能 Running。
4. 把 Secret patch 到 `default` ServiceAccount 上，再 `kubectl run` 一个不写 imagePullSecrets 的 Pod，用 `kubectl get pod -o yaml` 看它是否被自动注入了 `imagePullSecrets`。
5. 在节点上执行 `docker exec kind-worker crictl images`，找到刚才的镜像；再用 `crictl rmi` 删除它，理解"节点缓存 + IfNotPresent"对凭据问题的掩盖作用。

## 自测

<details>
<summary>什么情况下应该从 Registry 换成 Harbor？</summary>

需要多团队项目隔离和 RBAC、对接 LDAP/OIDC；需要上游镜像代理缓存；需要漏洞扫描、签名、保留策略或跨机房复制；需要统一托管 Helm Chart 等 OCI 制品。只是单集群内部 push/pull，Registry 更轻、运维成本更低。

</details>

<details>
<summary>`hosts.toml` 里的 `override_path = true` 什么时候需要？</summary>

当 mirror 的 URL 已经包含了 `/v2/...` 路径（例如 `https://mirror.example.com/v2/docker.io`）时需要。默认情况下 containerd 会自动在 host 后面拼接 `/v2`，设置 `override_path` 后直接使用你写的完整路径。

</details>

<details>
<summary>删除了 Registry 里的镜像 tag，为什么磁盘空间没有减少？</summary>

删除 manifest 只是去掉引用，层数据（blob）还在存储里。需要在停止写入的情况下执行 `registry garbage-collect` 才会清理无引用的 blob。写入进行中做 GC 可能误删正在上传的层。

</details>

<details>
<summary>Spegel 和 Dragonfly 的核心区别是什么？各自适合什么场景？</summary>

Spegel 无中心，复用各节点 containerd 已有的层，只加速"集群里已经有人拉过"的镜像，组件轻；Dragonfly 有独立的调度和 seed 回源，支持预热、任意文件分发和多种运行时，但组件多、需要 MySQL 和 Redis。重复拉取加速选 Spegel；推理大规模扩容首拉加速、模型权重分发选 Dragonfly。

</details>

<details>
<summary>同一个 Deployment 的 Pod，在 A 节点正常运行，调度到 B 节点就 ImagePullBackOff，可能是什么原因？</summary>

最常见的是凭据问题被节点缓存掩盖：A 节点之前拉过这个镜像，`IfNotPresent` 策略下不再访问仓库；B 节点需要真正拉取，此时 imagePullSecrets 缺失或错误就暴露出来。其他可能：B 节点的 `hosts.toml`/CA 证书没有配置、B 节点到仓库网络不通。

</details>

## 参考资料

- [Kubernetes 官方文档：镜像](https://kubernetes.io/zh-cn/docs/concepts/containers/images/)
- [Kubernetes 官方文档：从私有仓库拉取镜像](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/pull-image-private-registry/)
- [Kubernetes 官方文档：为服务账号添加 ImagePullSecrets](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-service-account/#add-imagepullsecrets-to-a-service-account)
- [containerd：Registry Configuration（hosts.toml）](https://github.com/containerd/containerd/blob/main/docs/hosts.md)
- [kind：Local Registry](https://kind.sigs.k8s.io/docs/user/local-registry/)
- [CNCF Distribution（Registry）文档](https://distribution.github.io/distribution/)
- [Harbor 文档](https://goharbor.io/docs/)
- [Spegel](https://github.com/spegel-org/spegel)
- [Dragonfly 文档](https://d7y.io/docs/)
- [Kubespray：containerd 配置](https://github.com/kubernetes-sigs/kubespray/blob/master/docs/CRI/containerd.md)
