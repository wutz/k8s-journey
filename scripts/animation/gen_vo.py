#!/usr/bin/env python3
"""重新生成动画的中文旁白，并写回 public/animation/player.html 中内嵌的 VO_DATA。

用法（需要 uv；无需其它依赖）：
    python3 scripts/animation/gen_vo.py

- 语音：Microsoft Edge 神经语音（edge-tts），默认 zh-CN-XiaoxiaoNeural（女声）
- 每句写在对应场景的时间点上（相对场景开头的秒数）；若读得比留给它的时间长，
  会自动小幅加快语速（最多 +22%），仍放不下时在输出里标记 OVER，需要缩短文案
- 字幕文字与旁白一致；spoken 用于替换缩写的读法（如 K8s → Kubernetes）
- 时长用 macOS 自带的 afinfo 测量
"""
import base64, json, pathlib, re, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PLAYER = ROOT / 'public/animation/player.html'
VOICE = 'zh-CN-XiaoxiaoNeural'
MAX_RATE = 22
# 各场景时长（秒），需与 player.html 中 SCENES 的 dur 保持一致
DUR = [9, 25, 26, 26, 26, 28, 26, 15]

# (场景序号, 场景内开始时间, 参考结束时间, 字幕/文案, 读法覆盖)
L=[
(0,3.2,8.8,"从第一个 Pod，到生产级集群——一段从零到专业的航程。",None),
(1,3.4,8.5,"故事总从一句话开始：「在我电脑上明明能跑。」",None),
(1,8.6,13.5,"容器把应用和依赖打包成镜像，到哪都一样运行。",None),
(1,13.6,18.5,"可当容器成百上千，谁来调度、重启、扩容？",None),
(1,18.6,24.8,"答案是 Kubernetes。先用 kind，在本机搭一个实验集群。",None),
(2,3.3,8.0,"声明式 API：你描述想要什么，K8s 负责让它成真。","声明式 API：你描述想要什么，Kubernetes 负责让它成真。"),
(2,8.1,12.0,"第一个 Pod 诞生了，它是最小的调度单元。",None),
(2,12.1,16.0,"标签与命名空间，让海量对象井然有序。",None),
(2,16.1,21.0,"Deployment 守住期望副本数：一个倒下，立刻补上。",None),
(2,21.1,25.8,"再用 Service 暴露出去，流量均匀分发到每个副本。",None),
(3,3.3,8.0,"探针检查健康，requests 和 limits 划定资源边界。",None),
(3,8.1,13.0,"PV 与 PVC，让数据比 Pod 活得更久。",None),
(3,13.1,17.0,"有状态、定时、守护进程，各有控制器。",None),
(3,17.1,22.0,"Ingress 是统一入口，按域名和路径把流量送到对的服务。",None),
(3,22.1,25.8,"Helm 把整套 YAML 打包成可回滚的发布。",None),
(4,3.3,8.7,"跟随一个 Pod 的诞生：请求抵达 API Server，写入 etcd，","跟随一个 Pod 的诞生：请求抵达 API Server，写入 E T C D，"),
(4,8.8,14.0,"调度器选好节点，kubelet 拉起容器——一切靠 watch 与调谐。",None),
(4,14.1,20.0,"每个 Pod 都有独立 IP，CNI 让它们跨节点直接互通。",None),
(4,20.1,25.8,"认证、授权、RBAC——最小权限，是安全的起点。",None),
(5,3.3,10.0,"生产集群从规划开始：三个控制面组成高可用，Kubespray 自动铺开。",None),
(5,10.1,15.0,"Cilium 管网络，MetalLB 分配 IP，证书自动轮换。","Cilium 管网络，Metal L B 分配 IP，证书自动轮换。"),
(5,15.1,19.0,"Rook-Ceph 提供三副本存储，坏盘自愈。","Rook Ceph 提供三副本存储，坏盘自愈。"),
(5,19.1,24.0,"凌晨三点节点宕机，告警响起，Pod 自动迁移。",None),
(5,24.1,27.8,"可观测性让你知道去哪里看，才敢安心入睡。",None),
(6,3.3,9.0,"GPU Operator 让每一张显卡，都能被 K8s 发现和调度。","GPU Operator 让每一张显卡，都能被 Kubernetes 发现和调度。"),
(6,9.1,15.0,"Kueue 与 Volcano 批调度：训练任务要么全员到齐，要么一起等待。","Queue 与 Volcano 批调度：训练任务要么全员到齐，要么一起等待。"),
(6,15.1,20.0,"分布式训练借助 RDMA 高速网络，多卡协同如一。",None),
(6,20.1,25.8,"最后，把大模型推理稳稳托管在集群之上，按需弹性伸缩。",None),
(7,6.8,10.5,"六个阶段，三十七节课，约二十五小时。",None),
(7,10.5,14.3,"只需一台电脑和一个终端，现在就启程。",None),
]


def budget(i):
    s, a = L[i][0], L[i][1]
    if i + 1 < len(L) and L[i + 1][0] == s:
        return L[i + 1][1] - a - 0.12
    return DUR[s] - a + 0.2


def duration(f):
    o = subprocess.run(['afinfo', f], capture_output=True, text=True).stdout
    return float(re.search(r'estimated duration: ([\d.]+)', o).group(1))


def tts(text, rate, f):
    for _ in range(4):  # 网络偶发失败时重试
        r = subprocess.run(['uvx', 'edge-tts', '--voice', VOICE, f'--rate=+{rate}%', '--text', text,
                            '--write-media', f], capture_output=True)
        if r.returncode == 0:
            return
    raise SystemExit(r.stderr.decode())


def main():
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, (s, a, _b, cap, spoken) in enumerate(L):
            f, win, rate = f'{tmp}/l{i:02d}.mp3', budget(i), 0
            while True:
                tts(spoken or cap, rate, f)
                d = duration(f)
                if d <= win or rate >= MAX_RATE:
                    break
                rate = min(MAX_RATE, rate + max(4, int((d / win - 1) * 100) + 3))
            print(f'{i:02d} 场景{s} {a:5.1f}s 可用 {win:4.1f}s 实际 {d:4.2f}s 语速 +{rate}%' + ('' if d <= win else '  <-- OVER'))
            out.append(dict(s=s, a=a, d=round(d, 2), text=cap, b64=base64.b64encode(open(f, 'rb').read()).decode()))
    html = PLAYER.read_text()
    data = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    html, n = re.subn(r'const VO_DATA=\[.*?\];\n', lambda m: f'const VO_DATA={data};\n', html, count=1, flags=re.S)
    assert n == 1, '未在 player.html 中找到 VO_DATA'
    PLAYER.write_text(html)
    print(f'已写入 {PLAYER.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
