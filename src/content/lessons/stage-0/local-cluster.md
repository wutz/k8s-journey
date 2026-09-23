# 搭建本地实验集群

从下一阶段开始，每一课都要在真实的 K8s 集群上动手。生产集群需要多台机器，而学习阶段我们需要的是：**几十秒内能创建、搞坏了能随时重建、不花钱**的集群。

这一课安装 kubectl，用 kind 创建一个 1 个控制平面 + 2 个工作节点的本地集群，部署一个 nginx 并通过 port-forward 访问，最后学会清理。之后阶段 1～3 的所有例子都在这个集群里运行。

## 本地集群工具怎么选

| 工具 | 原理 | 特点 | 适合 |
|---|---|---|---|
| **kind** | 每个节点是一个容器 | 启动快、多节点容易、贴近上游 kubeadm 集群，K8s 社区自己用它做 CI | 学习、测试多节点特性，**本教程默认** |
| minikube | 虚拟机或容器 | 插件丰富（dashboard、ingress 一键启用），多节点支持较晚 | 单节点入门、需要虚拟机隔离 |
| k3d | 在容器里运行 k3s | k3s 是轻量发行版，资源占用最低 | 机器配置较低、边缘场景 |

本教程统一使用 kind，因为调度、污点、拓扑分布等内容需要多个节点，kind 的节点又是标准 kubeadm 部署出来的，和生产集群的组件布局一致。

## 安装 kubectl

kubectl 是 K8s 的命令行客户端，所有操作都通过它和 apiserver 通信。

> [!NOTE] 版本匹配
> kubectl 与集群 apiserver 的版本相差不能超过 1 个次版本。截至本文写作时，最新稳定版为 v1.37，kind v0.33 默认创建的集群也是 v1.37。以下命令会自动下载最新稳定版。

### macOS

用 Homebrew 最省事：

```console
$ brew install kubectl
```

或者手动下载二进制（Apple Silicon 把 `amd64` 换成 `arm64`）：

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
```

### Linux

```bash
# ARM 机器把 amd64 换成 arm64
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl
```

### 验证

```console
$ kubectl version --client
Client Version: v1.37.0
Kustomize Version: v5.x.x
```

### 配置自动补全（强烈推荐）

```bash
echo 'source <(kubectl completion bash)' >> ~/.bashrc   # bash
echo 'source <(kubectl completion zsh)' >> ~/.zshrc     # zsh
```

重新打开终端后，输入 `kubectl get po<Tab>` 就能补全。

## 安装 kind

```bash
# macOS
brew install kind

# Linux（ARM 机器把 amd64 换成 arm64）
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

装好后用 `kind version` 确认版本。

> [!TIP] 使用 Podman
> kind 默认使用 Docker。如果你用的是 Podman，在执行 kind 命令前设置 `export KIND_EXPERIMENTAL_PROVIDER=podman`。Linux 上 rootless Podman 需要额外配置 cgroup 委派，详见 kind 官方文档的 Rootless 章节。

## 用 kind 创建多节点集群

### 编写集群配置

kind 不带配置时只创建一个单节点集群。我们用配置文件声明 1 个控制平面 + 2 个工作节点：

```yaml title="kind-config.yaml"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: k8s-journey
nodes:
  - role: control-plane
    # 把宿主机的 30080 端口映射到控制平面节点，后续学 NodePort 时使用
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
  - role: worker
  - role: worker
```

有意思的是，这个配置文件本身就是声明式的：只描述要几个节点、什么角色，不关心怎么创建。

### 创建集群

```console
$ kind create cluster --config kind-config.yaml
Creating cluster "k8s-journey" ...
 ✓ Ensuring node image (kindest/node:v1.37.0) 🖼
 ✓ Preparing nodes 📦 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-k8s-journey"
```

第一次运行需要下载约 1 GB 的节点镜像，之后创建集群只需 30～60 秒。

> [!NOTE] 固定节点版本
> 需要某个特定 K8s 版本时，可以加 `--image kindest/node:v1.36.4` 这样的参数。每个 kind 版本支持的节点镜像列表（含 digest）见 kind 的 GitHub Releases 页面，推荐按 release 说明中带 `@sha256:` 的完整引用使用。

kind 创建完成后会自动把集群的访问凭据写入 `~/.kube/config`，并把当前上下文（context）切换到 `kind-k8s-journey`。

### 看看节点是什么

在宿主机上，每个 K8s 节点就是一个容器：

```console
$ docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
NAMES                        IMAGE                  PORTS
k8s-journey-control-plane    kindest/node:v1.37.0   0.0.0.0:30080->30080/tcp, 127.0.0.1:41235->6443/tcp
k8s-journey-worker           kindest/node:v1.37.0
k8s-journey-worker2          kindest/node:v1.37.0
```

`127.0.0.1:41235->6443` 就是 apiserver 暴露到宿主机的端口（端口号随机）。

## 查看集群信息

### cluster-info

```console
$ kubectl cluster-info
Kubernetes control plane is running at https://127.0.0.1:41235
CoreDNS is running at https://127.0.0.1:41235/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

### get nodes

```console
$ kubectl get nodes -o wide
NAME                        STATUS   ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE                         CONTAINER-RUNTIME
k8s-journey-control-plane   Ready    control-plane   2m    v1.37.0   172.18.0.4    Debian GNU/Linux 12 (bookworm)   containerd://2.x.x
k8s-journey-worker          Ready    <none>          90s   v1.37.0   172.18.0.2    Debian GNU/Linux 12 (bookworm)   containerd://2.x.x
k8s-journey-worker2         Ready    <none>          90s   v1.37.0   172.18.0.3    Debian GNU/Linux 12 (bookworm)   containerd://2.x.x
```

三个节点都是 `Ready`，容器运行时是 containerd，和 [容器基础](/learn/containers) 里讲的一致。

### 看看控制平面组件

上一课架构图里的组件，在 kind（以及 kubeadm 部署的集群）里都以 Pod 形式运行在 `kube-system` 命名空间：

```console
$ kubectl get pods -n kube-system
NAME                                                READY   STATUS    RESTARTS   AGE
coredns-xxxxxxxxxx-xxxxx                            1/1     Running   0          3m
etcd-k8s-journey-control-plane                      1/1     Running   0          3m
kindnet-xxxxx                                       1/1     Running   0          3m
kube-apiserver-k8s-journey-control-plane            1/1     Running   0          3m
kube-controller-manager-k8s-journey-control-plane   1/1     Running   0          3m
kube-proxy-xxxxx                                    1/1     Running   0          3m
kube-scheduler-k8s-journey-control-plane            1/1     Running   0          3m
...
```

- etcd、apiserver、controller-manager、scheduler 只在控制平面节点上运行（静态 Pod）。
- kube-proxy 和 kindnet（kind 默认的 CNI 插件）每个节点一个（DaemonSet）。
- kubelet 和 containerd 不是 Pod，而是节点上的系统进程，可以用 `docker exec k8s-journey-worker systemctl status kubelet` 查看。

## 部署第一个应用

### 创建 Deployment

先用命令行快速创建，下一阶段会改成 YAML：

```console
$ kubectl create deployment nginx --image=nginx:1.29 --replicas=2
deployment.apps/nginx created

$ kubectl get deployments
NAME    READY   UP-TO-DATE   AVAILABLE   AGE
nginx   2/2     2            2           20s

$ kubectl get pods -o wide
NAME                     READY   STATUS    RESTARTS   AGE   IP           NODE
nginx-7c5ddbdf54-4kx8p   1/1     Running   0          20s   10.244.1.2   k8s-journey-worker
nginx-7c5ddbdf54-wq9zt   1/1     Running   0          20s   10.244.2.2   k8s-journey-worker2
```

两个 Pod 被 scheduler 分配到了两个 worker 节点。控制平面节点默认带有污点（Taint），普通 Pod 不会调度上去，[调度](/learn/scheduling) 一课会讲原因。

### 体验自愈

删掉一个 Pod，看看控制循环如何补齐：

```console
$ kubectl delete pod nginx-7c5ddbdf54-4kx8p
$ kubectl get pods
NAME                     READY   STATUS    RESTARTS   AGE
nginx-7c5ddbdf54-9mfzl   1/1     Running   0          3s
nginx-7c5ddbdf54-wq9zt   1/1     Running   0          2m
```

### 创建 Service 并 port-forward 访问

Pod 的 IP 是集群内部地址，宿主机访问不到。先为 Deployment 创建一个 Service，给这组 Pod 一个稳定的访问入口：

```console
$ kubectl expose deployment nginx --port=80
service/nginx exposed

$ kubectl get service nginx
NAME    TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
nginx   ClusterIP   10.96.145.23   <none>        80/TCP    5s
```

然后用 `kubectl port-forward` 把本机端口转发到 Service：

```console
$ kubectl port-forward service/nginx 8080:80
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
```

保持这个终端不关，另开一个终端访问：

```console
$ curl -s localhost:8080 | grep title
<title>Welcome to nginx!</title>
```

在浏览器打开 <http://localhost:8080> 也能看到 nginx 欢迎页。按 `Ctrl+C` 停止转发。

> [!WARNING]
> port-forward 是调试工具：流量经过 apiserver 中转，并且它实际只会连到 Service 背后的**某一个** Pod，不做负载均衡，断线后也不会自动重连。对外正式提供服务要用 NodePort、LoadBalancer 或 Ingress，见 [Service 与服务发现](/learn/services) 和 [Ingress 与 Gateway API](/learn/ingress-gateway)。

## 清理

删除本课创建的资源：

```console
$ kubectl delete service,deployment nginx
```

集群本身可以一直保留，供后续课程使用。关机或 Docker 重启后，kind 节点容器会随 Docker 自动启动。需要彻底删除集群时：

```console
$ kind delete cluster --name k8s-journey
Deleting cluster "k8s-journey" ...
```

> [!TIP] 随时重建
> 集群被折腾坏了不必排查半天，`kind delete cluster --name k8s-journey && kind create cluster --config kind-config.yaml`，一分钟后就是一个全新的集群。建议把 `kind-config.yaml` 保存在固定目录。

## 其他工具速览

如果 kind 在你的环境里有问题，也可以用下面两个工具创建等价的 3 节点集群，后续课程的 kubectl 命令完全通用：

```bash
minikube start --nodes 3 --driver=docker     # 删除：minikube delete
k3d cluster create k8s-journey --agents 2    # 删除：k3d cluster delete k8s-journey
```

注意：k3s 默认使用 Traefik 作为 Ingress、local-path 作为存储，与 kind 的默认组件不同，部分课程输出会有差异。

## 管理多个集群：kubeconfig 与 context

kubectl 通过 `~/.kube/config`（kubeconfig）知道该连哪个集群。同时有多个集群时：

```bash
kubectl config get-contexts                  # 列出所有上下文，* 为当前
kubectl config use-context kind-k8s-journey  # 切换
```

> [!DANGER] 确认你操作的是哪个集群
> 工作中你的 kubeconfig 里可能同时有测试集群和生产集群。执行 `delete`、`apply` 前务必用 `kubectl config current-context` 确认当前上下文。很多事故都源于"以为自己连的是测试环境"。

## 动手练习

1. 按本课步骤安装 kubectl 和 kind，用 `kind-config.yaml` 创建 `k8s-journey` 集群，确认 3 个节点都是 `Ready`。
2. 执行 `kubectl get pods -n kube-system -o wide`，找出 etcd、apiserver、scheduler、controller-manager 分别运行在哪个节点上。
3. 部署 `nginx:1.29` 的 Deployment（3 个副本），观察 Pod 在两个 worker 上的分布；删除其中一个 Pod，观察新 Pod 被创建。
4. 创建 Service 并用 `kubectl port-forward` 在浏览器访问 nginx 欢迎页。
5. 用 `kind delete cluster` 删除集群再重新创建，记录重建所需时间。

## 自测

<details>
<summary>kind 集群的"节点"在宿主机上是什么？</summary>

是运行 `kindest/node` 镜像的容器。每个容器里运行着 systemd、kubelet 和 containerd，业务 Pod 以"容器中的容器"方式运行在其中。

</details>

<details>
<summary>kubectl 怎么知道要连接哪个集群？</summary>

读取 kubeconfig 文件（默认 `~/.kube/config`，可用 `KUBECONFIG` 环境变量或 `--kubeconfig` 参数指定）中的当前上下文（current-context），上下文关联了集群地址和用户凭据。kind 创建集群时会自动写入并切换上下文。

</details>

<details>
<summary>为什么部署的 nginx Pod 没有被调度到控制平面节点？</summary>

控制平面节点默认带有 `node-role.kubernetes.io/control-plane:NoSchedule` 污点，没有配置相应容忍（Toleration）的普通 Pod 不会被调度上去，以保护控制平面组件的资源。

</details>

<details>
<summary>在 kind 集群里，etcd、kube-apiserver 以什么形式运行？kubelet 呢？</summary>

etcd、kube-apiserver、kube-controller-manager、kube-scheduler 都以静态 Pod（Static Pod）形式运行在控制平面节点的 `kube-system` 命名空间；kubelet 是节点上由 systemd 管理的系统进程，不是 Pod。

</details>

<details>
<summary>可以用 port-forward 作为长期对外暴露服务的方式吗？</summary>

不可以。port-forward 流量经 apiserver 中转、只连一个 Pod、不做负载均衡、断开后不会自动恢复，只适合本地调试。正式暴露服务应使用 NodePort、LoadBalancer Service 或 Ingress/Gateway。

</details>

## 参考资料

- [Kubernetes 官方文档：安装工具](https://kubernetes.io/zh-cn/docs/tasks/tools/)
- [Kubernetes 官方文档：在 Linux 系统中安装并设置 kubectl](https://kubernetes.io/zh-cn/docs/tasks/tools/install-kubectl-linux/)
- [Kubernetes 官方文档：在 macOS 系统上安装和设置 kubectl](https://kubernetes.io/zh-cn/docs/tasks/tools/install-kubectl-macos/)
- [Kubernetes 官方文档：使用端口转发来访问集群中的应用](https://kubernetes.io/zh-cn/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)
- [Kubernetes 官方文档：kubectl 快速参考](https://kubernetes.io/zh-cn/docs/reference/kubectl/quick-reference/)
- [kind 快速开始](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [kind 配置说明](https://kind.sigs.k8s.io/docs/user/configuration/)
- [minikube 入门](https://minikube.sigs.k8s.io/docs/start/)
- [k3d 文档](https://k3d.io/)
