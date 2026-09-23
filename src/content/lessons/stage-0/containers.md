# 容器基础：从进程到镜像

Kubernetes 调度、重启、扩缩的最小"货物"是容器。如果把容器当成一个黑盒的"轻量虚拟机"，后面遇到 OOMKilled、镜像拉取失败、`CrashLoopBackOff` 时就只能靠猜。这一课把容器拆开来看：它就是一个被隔离、被限制的 Linux 进程，外加一个打包好的文件系统。

学完这一课，你能用 `unshare` 手工造一个"简陋容器"，说清楚镜像分层、OCI、containerd 和 CRI 之间的关系，并写出一个多阶段构建的 Dockerfile，理解镜像 tag 和 digest 的区别。

## 为什么需要容器

传统部署方式里，一台服务器上跑着多个应用，它们共享同一套系统库、同一个文件系统、同一个网络栈，常见问题包括：

- **依赖冲突**：应用 A 需要 Python 3.9，应用 B 需要 Python 3.12。
- **环境漂移**：开发机上能跑，测试环境缺个库就跑不起来。
- **互相干扰**：一个应用内存泄漏，把整台机器拖垮。

虚拟机能解决隔离问题，但每个虚拟机都要带一整个操作系统内核，启动以分钟计、开销以 GB 计。容器走了另一条路：**共享宿主机内核，只隔离进程能看到和能用到的东西**。启动以毫秒计，开销几乎等于进程本身。

## 容器 = 进程 + 隔离 + 限制

Linux 内核提供了两类机制，容器运行时只是把它们组合起来：

| 机制 | 解决的问题 | 例子 |
|---|---|---|
| Namespace（命名空间） | 进程**能看到**什么 | 独立的进程号、主机名、网络、挂载点 |
| cgroup（控制组，Control Group） | 进程**能用多少** | 最多 256 MB 内存、0.5 个 CPU |

再加上一个独立的根文件系统（来自镜像），就构成了一个容器。

### Namespace：隔离视图

Linux 目前有 8 种 Namespace，最常用的是：PID（进程号，容器里第一个进程 PID 为 1）、Mount（挂载点）、UTS（主机名）、Network（网卡、IP、路由、端口）、IPC（进程间通信）、User（用户 ID 映射），另外还有 Cgroup 和 Time。

> [!LAB] 用 unshare 造一个"容器"
> 以下命令需要在 **Linux** 上执行（macOS 用户可以在 Docker Desktop/OrbStack 的 Linux 虚拟机里，或者用 `docker run --rm -it --privileged ubuntu bash` 进入一个特权容器再试）。

先看看当前 shell 所在的 Namespace，每个链接后面的数字就是 Namespace 的 inode 编号：

```console
$ ls -l /proc/$$/ns | head -4
lrwxrwxrwx 1 user user 0 ... cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 user user 0 ... mnt -> 'mnt:[4026531841]'
lrwxrwxrwx 1 user user 0 ... net -> 'net:[4026531840]'
```

用 `unshare` 启动一个新 shell，同时创建新的 UTS、PID、Mount、Network Namespace：

```console
$ sudo unshare --uts --pid --mount --net --fork --mount-proc bash
# hostname my-container
# hostname
my-container
# ps aux
USER   PID %CPU %MEM    VSZ   RSS TTY  STAT START TIME COMMAND
root     1  0.0  0.0   8964  5376 pts/0 S   10:00 0:00 bash
root     8  0.0  0.0  10884  4352 pts/0 R+  10:00 0:00 ps aux
# ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

几个现象值得注意：

- 改了主机名，但宿主机的主机名不受影响（UTS 隔离）。
- `ps` 只能看到两个进程，`bash` 的 PID 是 1（PID 隔离，`--mount-proc` 重新挂载了 `/proc`）。
- 网络里只有一个未启动的 `lo`，没有任何外网网卡（Network 隔离）。

另开一个终端执行 `ps -ef | grep unshare`，在宿主机上仍然能看到它，这只是一个普通进程。在第一个终端输入 `exit` 退出，所有 Namespace 随之销毁。

> [!NOTE]
> K8s 里一个 Pod 内的多个容器会**共享** Network、IPC、UTS Namespace，所以它们可以用 `localhost` 互相访问。这是 [Pod](/learn/pods) 一课的核心概念之一。

### cgroup：限制资源

Namespace 只管"看得见什么"，不管"用多少"。一个进程在独立 Namespace 里照样可以吃光宿主机内存。cgroup 负责资源限制和统计。现代发行版普遍使用 cgroup v2，所有控制器挂在统一的层级 `/sys/fs/cgroup` 下：

```console
$ stat -fc %T /sys/fs/cgroup
cgroup2fs
```

输出 `cgroup2fs` 表示 cgroup v2，`tmpfs` 表示 v1。手工创建一个 cgroup，限制内存为 50 MB：

```console
$ sudo mkdir /sys/fs/cgroup/demo
$ echo 50M | sudo tee /sys/fs/cgroup/demo/memory.max
$ echo 0 | sudo tee /sys/fs/cgroup/demo/memory.swap.max
$ sudo bash -c 'echo $$ > /sys/fs/cgroup/demo/cgroup.procs && python3 -c "a = bytearray(100 * 1024 * 1024)"'
Killed
$ grep oom_kill /sys/fs/cgroup/demo/memory.events
oom_kill 1
$ sudo rmdir /sys/fs/cgroup/demo
```

Python 试图分配 100 MB，超过 50 MB 上限，被内核的 OOM Killer 杀掉。这正是 K8s 里 Pod 状态显示 `OOMKilled` 的底层原因：你在 YAML 里写的 `resources.limits.memory`，最终会被 kubelet 和容器运行时写成 cgroup 的 `memory.max`。CPU 限制同理，对应 `cpu.max`。详见 [健康检查与资源管理](/learn/probes-resources)。

## 镜像：分层的文件系统

光有隔离和限制还不够，容器里的进程需要一个根文件系统：`/bin`、`/lib`、应用程序本身。**镜像**就是这个文件系统的打包格式。

### 分层与写时复制

镜像由若干只读的**层（Layer）**叠加而成，每一层是一个 tar 包，记录相对上一层的文件变化。运行容器时，运行时在最上面再加一个可写层，用 OverlayFS 这类联合文件系统把它们合并成一个目录视图：

```text
          容器视图 /  （合并后）
┌────────────────────────────────────┐
│  可写层（容器运行时新增/修改的文件）  │  ← 容器删除即消失
├────────────────────────────────────┤
│  Layer 3: COPY app /app            │  ┐
│  Layer 2: RUN apt-get install ...  │  ├ 只读，多个容器共享
│  Layer 1: 基础镜像 debian:bookworm  │  ┘
└────────────────────────────────────┘
```

好处有两个：

- **共享**：100 个基于同一基础镜像的容器，磁盘上只存一份基础层。
- **缓存**：构建和拉取时只处理变化的层。

修改只读层里的文件时，会先把文件复制到可写层再改，这叫写时复制（Copy-on-Write）。因此**容器里写入的数据在容器删除后就丢了**，需要持久化的数据要用卷，见 [存储](/learn/storage-basics)。

用 `docker image history` 可以看到每一层来自哪条指令：

```console
$ docker pull nginx:1.29
$ docker image history nginx:1.29 --format '{{.Size}}\t{{.CreatedBy}}' | head -5
```

### OCI 标准

早期"镜像"和"容器"几乎就等于 Docker。2015 年成立的 **OCI（Open Container Initiative，开放容器倡议）** 把它们标准化成三份规范：Image Spec（镜像格式：manifest、config、layers）、Runtime Spec（如何根据文件系统包 + 配置运行容器）、Distribution Spec（镜像仓库的 push/pull HTTP API）。所以用 Docker 构建的镜像，可以被 Podman、containerd、CRI-O 运行，也可以推送到任何兼容的仓库（Docker Hub、Harbor、GHCR 等）。

## 容器运行时：containerd 与 CRI

"容器运行时"这个词在不同语境下指不同层级的东西：

```text
 kubelet ──CRI(gRPC)──▶ containerd / CRI-O      高层运行时：拉镜像、管理快照、管理容器生命周期
                              │
                              ▼
                         runc / crun           低层运行时：按 OCI Runtime Spec 调用
                              │                           clone/unshare、写 cgroup
                              ▼
                        Linux 内核（Namespace、cgroup、OverlayFS）

 docker CLI ──▶ dockerd ──▶ containerd ──▶ runc  （Docker 的调用链）
```

- **runc**：OCI 运行时的参考实现，干的就是上面 `unshare` + cgroup 那些事。
- **containerd**：从 Docker 中拆分出来的高层运行时，现为 CNCF 毕业项目，负责镜像管理和容器生命周期。
- **CRI（Container Runtime Interface，容器运行时接口）**：K8s 定义的 gRPC 接口。kubelet 只通过 CRI 和运行时对话，任何实现了 CRI 的运行时（containerd、CRI-O）都能接入。

> [!NOTE] dockershim 的移除
> K8s 早期内置了一个叫 dockershim 的适配层来调用 Docker。v1.24 起 dockershim 被移除，节点上直接使用 containerd 或 CRI-O。这**不影响**你用 Docker 构建镜像，因为镜像遵循 OCI 标准，任何运行时都能运行。

kind 的节点镜像里运行的就是 containerd。在下一课搭好集群后，可以进入节点用 `crictl` 查看：

```console
$ docker exec -it k8s-journey-worker crictl ps
```

## 写一个 Dockerfile

下面用一个 Go 写的小 HTTP 服务演示构建流程。新建目录 `hello-app`，放两个文件：

```go title="main.go"
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		host, _ := os.Hostname()
		fmt.Fprintf(w, "Hello from %s, version=%s\n", host, os.Getenv("APP_VERSION"))
	})
	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

```dockerfile title="Dockerfile.single"
FROM golang:1.25
WORKDIR /src
COPY main.go .
RUN go mod init hello && go build -o /hello .
ENV APP_VERSION=v1
EXPOSE 8080
CMD ["/hello"]
```

构建并运行：

```console
$ docker build -f Dockerfile.single -t hello-app:single .
$ docker run -d --name hello -p 8080:8080 hello-app:single
$ curl localhost:8080
Hello from 3f2a9c1b7d4e, version=v1
$ docker rm -f hello
```

返回的主机名是容器 ID，这就是 UTS Namespace 的效果。

几个指令要点：`RUN`、`COPY` 会产生新层；`EXPOSE` 只是声明，不会真的开放端口；`ENTRYPOINT` / `CMD` 分别对应 K8s 容器定义中的 `command` / `args`。

## 多阶段构建

看一下刚才镜像的大小：

```console
$ docker images hello-app
REPOSITORY   TAG      IMAGE ID       SIZE
hello-app    single   8c1d2e3f4a5b   900MB
```

900 MB 左右，因为整个 Go 编译工具链都在里面，而运行时只需要一个几 MB 的二进制文件。**多阶段构建（Multi-stage Build）** 允许在一个 Dockerfile 里用多个 `FROM`，只把最终产物复制到干净的运行镜像中：

```dockerfile title="Dockerfile"
# 阶段一：编译
FROM golang:1.25 AS build
WORKDIR /src
COPY main.go .
RUN go mod init hello && CGO_ENABLED=0 go build -ldflags="-s -w" -o /hello .

# 阶段二：运行
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /hello /hello
ENV APP_VERSION=v2
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/hello"]
```

```console
$ docker build -t hello-app:v2 .
$ docker images hello-app
REPOSITORY   TAG      IMAGE ID       SIZE
hello-app    v2       1a2b3c4d5e6f   9MB
hello-app    single   8c1d2e3f4a5b   900MB
```

- `CGO_ENABLED=0` 生成静态链接的二进制，不依赖 libc。
- distroless 镜像只包含运行所需的最少文件，没有 shell 和包管理器，攻击面小。
- `USER nonroot` 以非 root 用户运行，和 [工作负载安全加固](/learn/security) 中的 `runAsNonRoot` 呼应。

> [!PROD] 生产镜像的几条经验
> - 用多阶段构建，运行镜像选 distroless、alpine 或 `*-slim`。
> - 把变化少的指令（安装依赖）放前面、变化多的（复制源码）放后面，充分利用层缓存。
> - 配合 `.dockerignore` 排除 `.git`、`node_modules` 等无关文件。
> - 不要把密码、密钥写进镜像，任何一层里出现过的文件都能被提取出来，即使后面的层删掉了它。

## 镜像名、tag 与 digest

一个完整的镜像引用长这样：

```text
registry.example.com/team/hello-app:v2@sha256:4e1f...9a
└──────┬───────────┘ └──────┬─────┘ └┬┘ └─────┬──────┘
    仓库地址            仓库路径      tag     digest
```

- 省略仓库地址时默认是 Docker Hub `docker.io`，`nginx` 等价于 `docker.io/library/nginx`。
- **tag** 是一个可变的标签，同一个 `v2` 今天和明天可以指向不同内容。省略时默认为 `latest`。
- **digest** 是镜像 manifest 内容的 SHA-256 哈希，内容不变它就不变，内容一变它必然变。

查看镜像的 digest：

```console
$ docker pull nginx:1.29
$ docker image inspect nginx:1.29 --format '{{index .RepoDigests 0}}'
nginx@sha256:...
```

用 digest 拉取可以保证拿到的是一模一样的内容：

```console
$ docker pull nginx@sha256:<上一步输出的哈希>
```

> [!WARNING] 不要在生产中使用 latest
> `latest` 不代表"最新"，只是一个默认名字。它会让你说不清线上到底跑的是哪个版本，回滚也无从下手。K8s 中镜像 tag 为 `latest` 时，`imagePullPolicy` 默认会变成 `Always`。生产环境请使用明确的版本 tag，对安全要求高的场景固定 digest。

## 动手练习

1. 在 Linux 环境里用 `sudo unshare --uts --pid --net --mount --fork --mount-proc bash` 进入新的 Namespace，修改主机名并执行 `ps aux`、`ip addr`，对比宿主机的输出。
2. 用 cgroup v2 创建一个 `memory.max=30M` 的组，在里面运行一个分配 50 MB 内存的程序，观察 `memory.events` 中的 `oom_kill` 计数。
3. 按本课步骤分别构建 `hello-app:single` 和 `hello-app:v2`，对比镜像大小和 `docker image history` 的层数。
4. 用 `docker run -e APP_VERSION=v3 -p 8080:8080 hello-app:v2` 运行容器，验证环境变量覆盖了镜像里的默认值。
5. 查出 `nginx:1.29` 的 digest，用 `nginx@sha256:...` 的形式再拉一次。

## 自测

<details>
<summary>Namespace 和 cgroup 分别解决什么问题？</summary>

Namespace 控制进程**能看到**什么（进程号、网络、挂载点、主机名等），实现隔离；cgroup 控制进程**能用多少**资源（CPU、内存、IO 等），实现限制与统计。

</details>

<details>
<summary>容器里写入的文件，为什么删除容器后就没了？</summary>

镜像层是只读的，容器运行时在最上面加了一个可写层，所有修改都写在这层（写时复制）。可写层的生命周期和容器一样，容器删除它就被删除。需要持久化的数据应使用卷。

</details>

<details>
<summary>K8s 移除了 dockershim，用 Docker 构建的镜像还能在 K8s 上跑吗？</summary>

能。镜像遵循 OCI Image Spec，containerd、CRI-O 等 CRI 运行时都能运行。移除的只是 kubelet 调用 Docker 引擎的适配层，与镜像格式无关。

</details>

<details>
<summary>多阶段构建为什么能显著减小镜像？</summary>

最终镜像只包含最后一个 `FROM` 阶段的层。编译工具链、源码、中间产物都留在前面的构建阶段，只用 `COPY --from=` 把需要的产物复制过去。

</details>

<details>
<summary>tag 和 digest 有什么区别？生产环境该用哪个？</summary>

tag 是可变的名字，可以被重新指向新内容；digest 是 manifest 内容的哈希，不可变。生产环境至少使用明确的版本 tag，禁止 `latest`；要求严格可复现时固定 digest。

</details>

## 参考资料

- [Kubernetes 官方文档：容器](https://kubernetes.io/zh-cn/docs/concepts/containers/)
- [Kubernetes 官方文档：镜像](https://kubernetes.io/zh-cn/docs/concepts/containers/images/)
- [Kubernetes 官方文档：容器运行时接口（CRI）](https://kubernetes.io/zh-cn/docs/concepts/containers/cri/)
- [Kubernetes 官方文档：容器运行时](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/)
- [Kubernetes 官方文档：关于 cgroup v2](https://kubernetes.io/zh-cn/docs/concepts/architecture/cgroups/)
- [Open Container Initiative](https://opencontainers.org/)
- [Docker 文档：Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
