# ConfigMap 与 Secret

同一个镜像要跑在开发、测试、生产三套环境里，数据库地址、日志级别、功能开关各不相同。把配置打进镜像意味着每个环境一个镜像，改一个参数就要重新构建发布；把密码写进 Deployment YAML 又会让它出现在 Git 里。Kubernetes 用 **ConfigMap** 存放普通配置、用 **Secret** 存放敏感信息，让镜像与配置解耦。

学完这一课，你能用多种方式创建 ConfigMap 和 Secret，通过环境变量或卷把它们注入 Pod，搞清楚改了配置之后 Pod 里什么时候会变、什么时候不会，并知道生产中管理 Secret 的正确思路。

## ConfigMap

### 创建方式

ConfigMap 就是一组键值对，值可以是一个短字符串，也可以是一整个配置文件。

**声明式 YAML**（推荐，可以进 Git）：

```yaml title="app-config.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  FEATURE_NEW_UI: "true"
  app.properties: |
    server.port=8080
    cache.ttl=300
```

**命令式创建**，常配合 `--dry-run=client -o yaml` 生成 YAML：

```bash
# 从字面值
kubectl create configmap demo-literal --from-literal=LOG_LEVEL=debug --from-literal=REGION=cn

# 从文件：键默认是文件名，值是文件内容
echo 'worker_processes 2;' > nginx.conf
kubectl create configmap demo-file --from-file=nginx.conf

# 从目录：目录下每个文件一个键
kubectl create configmap demo-dir --from-file=./conf.d/

# 从 env 文件：每行 KEY=VALUE 一个键
printf 'DB_HOST=db.example.com\nDB_PORT=5432\n' > db.env
kubectl create configmap demo-env --from-env-file=db.env
```

```bash
kubectl get configmap demo-env -o jsonpath='{.data}'
# {"DB_HOST":"db.example.com","DB_PORT":"5432"}
```

> [!NOTE]
> ConfigMap 的值都是字符串，YAML 里的 `true`、`5432` 要加引号。单个 ConfigMap 不能超过 1 MiB，它不适合存放大文件。二进制内容可以放在 `binaryData` 字段（base64 编码）。

### 注入方式一：环境变量

```yaml title="env-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: env-demo
spec:
  restartPolicy: Never
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "env | sort | grep -E 'LOG|FEATURE|DB_'; sleep 3600"]
      env:
        - name: LOG_LEVEL                 # 单个键，可以改名
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
        - name: FEATURE_X
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NOT_EXIST
              optional: true              # 键不存在也允许启动
      envFrom:
        - configMapRef:                   # 整个 ConfigMap 的键全部导入
            name: demo-env
          prefix: CFG_                    # 可选前缀
```

```bash
kubectl apply -f app-config.yaml -f env-demo.yaml
kubectl logs env-demo
```

```console
CFG_DB_HOST=db.example.com
CFG_DB_PORT=5432
LOG_LEVEL=info
```

`envFrom` 会导入所有键，但键名不是合法环境变量名的会被跳过（比如上面的 `app.properties`）。如果引用的 ConfigMap 或键不存在且没有标记 `optional: true`，容器会卡在 `CreateContainerConfigError`。

### 注入方式二：卷挂载

配置文件类的内容更适合以文件形式挂载，每个键变成目录下的一个文件：

```yaml title="volume-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: volume-demo
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: config
          mountPath: /etc/app            # 整个 ConfigMap 挂成目录
          readOnly: true
        - name: config
          mountPath: /opt/app.properties # 只把一个键挂成单个文件
          subPath: app.properties
  volumes:
    - name: config
      configMap:
        name: app-config
        # items:                         # 可选：只挑部分键，并指定文件名
        #   - key: app.properties
        #     path: application.properties
```

```bash
kubectl apply -f volume-demo.yaml
kubectl exec volume-demo -- ls -la /etc/app
```

```console
lrwxrwxrwx    1 root     root            20 Sep 23 06:10 FEATURE_NEW_UI -> ..data/FEATURE_NEW_UI
lrwxrwxrwx    1 root     root            16 Sep 23 06:10 LOG_LEVEL -> ..data/LOG_LEVEL
lrwxrwxrwx    1 root     root            21 Sep 23 06:10 app.properties -> ..data/app.properties
drwxr-xr-x    2 root     root           100 Sep 23 06:10 ..2026_09_23_06_10_12.123456789
lrwxrwxrwx    1 root     root            32 Sep 23 06:10 ..data -> ..2026_09_23_06_10_12.123456789
```

注意这些符号链接，它们是下一节热更新机制的关键。

> [!WARNING] 挂载会覆盖整个目录
> 把 ConfigMap 挂到 `/etc/nginx` 这样已有内容的目录，原来的文件会全部"消失"（被挂载点遮住）。只想放一个文件进去时，使用 `subPath` 或挂到一个独立目录。

## 修改配置后会发生什么

这是新手最容易踩坑的地方。修改 ConfigMap：

```bash
kubectl patch configmap app-config -p '{"data":{"LOG_LEVEL":"debug","app.properties":"server.port=9090\n"}}'
```

然后分别检查三处：

```bash
kubectl exec volume-demo -- cat /etc/app/LOG_LEVEL          # 卷挂载
kubectl exec volume-demo -- cat /opt/app.properties         # subPath 挂载
kubectl exec env-demo -- printenv LOG_LEVEL                 # 环境变量
```

| 注入方式 | 修改后是否更新 | 说明 |
|---|---|---|
| 卷挂载（整个目录） | **会**，有延迟 | kubelet 定期同步，通常一分钟左右内生效 |
| `subPath` 挂载 | **不会** | 挂载的是某一时刻的文件，需要重启 Pod |
| `env` / `envFrom` | **不会** | 环境变量只在容器启动时读取一次 |

卷挂载能更新，是因为 kubelet 把新内容写进一个新的时间戳目录，再原子地切换 `..data` 符号链接；`subPath` 直接绑定了旧文件，自然感知不到切换。

> [!TIP] 文件更新了，应用不一定会用
> 即使文件变了，应用也要自己监听文件变化并重新加载（例如 Nginx 需要 reload）。最稳妥的通用做法是配置变更后触发一次滚动重启：`kubectl rollout restart deploy/<name>`。Helm/Kustomize 还有"把配置哈希写进 Pod 注解或 ConfigMap 名字"的技巧，配置一变就自动触发滚动更新，在 [Helm 与 Kustomize](/learn/helm-kustomize) 中讲。

## Secret

### Secret 只是 base64

Secret 的用法与 ConfigMap 几乎一样，只是专门用来放密码、令牌、证书，Kubernetes 会对它区别对待：默认不在 `describe` 中显示值、只发送给需要它的节点、在节点上以 tmpfs（内存）存储、可以用 RBAC 单独控制读取权限。

```bash
kubectl create secret generic db-cred \
  --from-literal=username=app \
  --from-literal=password='S3cr3t!'
kubectl get secret db-cred -o yaml
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-cred
type: Opaque
data:
  password: UzNjcjN0IQ==
  username: YXBw
```

```bash
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d
# S3cr3t!
```

> [!DANGER] base64 不是加密
> 任何能读取这个 Secret 对象的人都能一键解码。默认情况下 Secret 在 etcd 里也是明文存储的。**不要把包含 Secret 的 YAML 提交到 Git**，也不要把 `get secrets` 权限随意授予他人。

写 YAML 时可以用 `stringData` 直接填明文，API Server 会帮你转成 base64 存进 `data`：

```yaml title="db-cred.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: db-cred
type: Opaque
stringData:
  username: app
  password: "S3cr3t!"
```

### 内置类型

| type | 用途 | 创建命令 |
|---|---|---|
| `Opaque` | 任意数据（默认） | `kubectl create secret generic` |
| `kubernetes.io/tls` | TLS 证书与私钥（`tls.crt`/`tls.key`） | `kubectl create secret tls` |
| `kubernetes.io/dockerconfigjson` | 私有镜像仓库凭据 | `kubectl create secret docker-registry` |
| `kubernetes.io/service-account-token` | ServiceAccount 长期令牌 | 一般不手动创建 |

私有镜像仓库凭据的用法：

```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=robot --docker-password='xxxx'
# 然后在 Pod 的 spec.imagePullSecrets 里引用：[{name: regcred}]
```

### 在 Pod 中使用

与 ConfigMap 对称，把 `configMapKeyRef` 换成 `secretKeyRef`，`configMap` 卷换成 `secret` 卷：

```yaml title="secret-demo.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: secret-demo
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo user=$DB_USER; ls -l /etc/db; sleep 3600"]
      env:
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: db-cred
              key: username
      volumeMounts:
        - name: cred
          mountPath: /etc/db
          readOnly: true
  volumes:
    - name: cred
      secret:
        secretName: db-cred
        defaultMode: 0400          # 文件权限，只读
```

```bash
kubectl apply -f secret-demo.yaml
kubectl logs secret-demo
```

```console
user=app
total 0
lrwxrwxrwx    1 root     root            15 Sep 23 06:30 password -> ..data/password
lrwxrwxrwx    1 root     root            15 Sep 23 06:30 username -> ..data/username
```

> [!TIP] 优先以文件方式使用 Secret
> 环境变量容易泄露：会被子进程继承、可能被应用在崩溃时打印进日志、`kubectl describe` 或监控工具也可能把它展示出来。以只读文件挂载的 Secret 更安全，而且支持自动更新（`subPath` 除外）。

## 不可变的 ConfigMap 与 Secret

设置 `immutable: true` 后，`data` 不能再修改，只能删除重建：

```yaml title="app-config-v2.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
immutable: true
data:
  LOG_LEVEL: "warn"
```

```bash
kubectl apply -f app-config-v2.yaml
kubectl patch configmap app-config-v2 -p '{"data":{"LOG_LEVEL":"debug"}}'
```

```console
The ConfigMap "app-config-v2" is invalid: data: Forbidden: field is immutable when `immutable` is set
```

好处有两点：防止误改导致线上故障；kubelet 不再需要 watch 这些对象，集群里 ConfigMap/Secret 很多时能明显减轻 API Server 负担。配合"每次变更生成带版本号的新名字，再更新 Deployment 引用"的做法，配置变更就和镜像变更一样走滚动发布、可以回滚。

## 生产中的 Secret 管理

> [!PROD] 三道防线
> 1. **静态加密（Encryption at Rest）**：配置 API Server 的 `--encryption-provider-config`，让 Secret 在写入 etcd 前加密。推荐使用 KMS v2 provider 对接外部密钥管理服务，而不是把密钥明文写在控制平面节点上。托管集群通常已默认开启或提供开关。
> 2. **最小权限**：用 RBAC 严格控制谁能 `get`/`list`/`watch` Secret。注意：能在某命名空间创建 Pod 的人，就能把该命名空间的任何 Secret 挂载进 Pod 读出来。详见 [RBAC](/learn/rbac)。
> 3. **不进 Git 明文**：Git 里只保存"引用"或加密后的内容。

让 Secret 不以明文进 Git 的常见方案：

| 方案 | 思路 |
|---|---|
| [External Secrets Operator](https://external-secrets.io/) | 真正的密钥存放在 Vault、AWS Secrets Manager、阿里云 KMS 等外部系统；集群里写一个 `ExternalSecret` 对象声明"从哪里取、生成什么 Secret"，Operator 负责同步和定期刷新 |
| Sealed Secrets | 用集群公钥加密出 `SealedSecret`，可以安全地提交到 Git，只有集群里的控制器能解密 |
| SOPS | 用 age/KMS 加密 YAML 中的值，在 GitOps 工具部署时解密 |
| Secrets Store CSI Driver | 以 CSI 卷的方式把外部密钥直接挂进 Pod，可以不落地为 Secret 对象 |

External Secrets 的对象大致长这样（仅示意，需要先安装 Operator 并配置 `SecretStore`）：

```yaml title="external-secret.yaml"
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: db-cred
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: db-cred            # 生成的 Kubernetes Secret 名字
  data:
    - secretKey: password
      remoteRef:
        key: prod/db
        property: password
```

具体选型与部署会在后续阶段结合 GitOps 讨论，截至本文写作时各项目的 API 版本以其官方文档为准。

清理：

```bash
kubectl delete pod env-demo volume-demo secret-demo --ignore-not-found
kubectl delete configmap app-config app-config-v2 demo-literal demo-file demo-dir demo-env --ignore-not-found
kubectl delete secret db-cred regcred --ignore-not-found
```

## 动手练习

1. 用 `--from-env-file` 创建一个 ConfigMap，通过 `envFrom` 注入 Pod，并加上 `prefix` 验证变量名。
2. 创建 `volume-demo`，修改 ConfigMap 后每隔 10 秒查看一次三种注入方式的值，记录卷挂载大约多久生效。
3. 让 Pod 引用一个不存在的 ConfigMap，观察 `kubectl get pod` 的 STATUS 和 `describe` 里的事件；再加上 `optional: true` 对比。
4. 创建一个 Secret，分别用 `-o jsonpath` + `base64 -d` 和 `kubectl exec` 读出它的值，体会"base64 不是加密"。
5. 创建一个 `immutable: true` 的 ConfigMap，尝试修改它，然后通过"新建 v2 + 修改 Deployment 引用"的方式完成一次配置变更。

## 自测

<details>
<summary>修改 ConfigMap 后，哪些注入方式能在 Pod 中自动看到新值？</summary>

只有以卷挂载（且没有使用 `subPath`）的方式会被 kubelet 自动更新，有一定延迟。`env`/`envFrom` 和 `subPath` 挂载都不会更新，需要重建 Pod，例如 `kubectl rollout restart`。

</details>

<details>
<summary>Secret 和 ConfigMap 在存储上有本质区别吗？</summary>

默认没有：两者都存在 etcd 中，Secret 的值只是 base64 编码。区别在于 Secret 在节点上存放在 tmpfs、默认不在输出中展示、可以单独授权，以及可以配合静态加密。真正的保护依赖静态加密、RBAC 和外部密钥管理。

</details>

<details>
<summary>为什么推荐以文件而不是环境变量使用 Secret？</summary>

环境变量会被子进程继承，容易被日志、崩溃转储或调试工具泄露，且无法热更新；文件挂载可以设置只读权限、位于内存文件系统，并且会随 Secret 更新。

</details>

<details>
<summary>`immutable: true` 有什么好处？</summary>

防止误修改导致线上故障；kubelet 不必 watch 这些对象，降低 API Server 负载。配合带版本号的命名，配置变更可以走滚动发布和回滚。

</details>

## 参考资料

- [Kubernetes 官方文档：ConfigMap](https://kubernetes.io/zh-cn/docs/concepts/configuration/configmap/)
- [Kubernetes 官方文档：Secret](https://kubernetes.io/zh-cn/docs/concepts/configuration/secret/)
- [Kubernetes 官方文档：配置 Pod 使用 ConfigMap](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-pod-configmap/)
- [Kubernetes 官方文档：Kubernetes Secret 良好实践](https://kubernetes.io/zh-cn/docs/concepts/security/secrets-good-practices/)
- [Kubernetes 官方文档：静态加密机密数据](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/encrypt-data/)
- [External Secrets Operator 文档](https://external-secrets.io/latest/)
