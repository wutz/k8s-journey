/* 第 0 阶段 · 第 4 课：搭建本地实验集群 */
(() => {
const COL = STAGES[0].color
const circ = (x, y, r, fill) => { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
const ghost = (x, y, w, h, a = 1, r = 14) => withA(a, () => panel(x, y, w, h, { r, fill: 'rgba(0,0,0,0.015)', stroke: C.hairD, dash: [8, 8], shadow: false }))
const strokeRR = (x, y, w, h, r, col, lw = 2, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); rr(x, y, w, h, r); ctx.stroke(); ctx.restore() }

// 场景 1：工具选择 + kind 的原理
const TOOLS = [
  ['kind', '每个节点是一个容器', '多节点容易 · 贴近 kubeadm 集群'],
  ['minikube', '虚拟机或容器', '插件丰富 · 适合单节点入门'],
  ['k3d', '在容器里运行 k3s', '轻量发行版 · 资源占用最低'],
]
const KN = ['control-plane', 'worker', 'worker2']
const KX = i => 848 + i * 306
const tools = {
  name: 'kind 原理', dur: 16, mood: 1,
  vo: [[0.6, '本地集群工具有 kind、minikube 和 k3d。'],
    [5.6, 'kind 把每个节点都跑成一个 Docker 容器，'],
    [11.0, 'apiserver 端口映射到本机，kubectl 直连。']],
  cues: [[0.4, 'whoosh'], ...TOOLS.map((_, i) => [1.0 + i * .4, 'pop']), [3.6, 'ding2'], [5.6, 'whoosh'], ...KN.map((_, i) => [5.9 + i * .4, 'thud']), [7.8, 'pop'], [8.1, 'pop'], [8.4, 'pop'], [11.2, 'tick'], [11.9, 'zap'], [13.4, 'ok']],
  draw(t, T) {
    heading('选工具：kind 把节点跑成容器', 140, 210, t, .2, { eyebrow: 'LOCAL CLUSTER TOOLS', color: COL })
    // 左：三种工具
    TOOLS.forEach(([n, how, fit], i) => {
      const a = E.out(P(t, 1.0 + i * .4, 1.5 + i * .4)); if (a <= 0) return
      const x = 140, y = 280 + i * 200, w = 640, h = 180, kind = i === 0
      const pick = kind && t > 3.6
      const dim = !kind && t > 5.6 ? lerp(1, .5, E.out(P(t, 5.6, 6.2))) : 1
      withA(a * dim, () => {
        panel(x + lerp(-24, 0, a), y, w, h, { r: 18, stroke: pick ? COL : C.hair, lw: pick ? 2.5 : 1.5, fill: pick ? tint(COL, .05) : C.panel })
        const ox = lerp(-24, 0, a)
        txt(n, x + 32 + ox, y + 58, { size: 32, weight: 600, font: MONO, color: pick ? COL : C.text })
        txt(how, x + 32 + ox, y + 108, { size: 22, color: C.text })
        txt(fit, x + 32 + ox, y + 148, { size: 19, color: C.mute })
        if (kind) chip('本教程默认', x + w - 28 + ox, y + 48, { size: 18, font: SANS, col: COL, solid: pick, align: 'right', alpha: E.out(P(t, 3.6, 4.0)), pad: 14 })
        // 小图标
        const ix = x + w - 110 + ox, iy = y + 122
        if (i === 0) [-44, 0, 44].forEach(dx => cube(ix + dx, iy, 15, COL))
        else if (i === 1) { strokeRR(ix - 42, iy - 34, 84, 56, 8, C.hairD, 2.5); line(ix - 16, iy + 30, ix + 16, iy + 30, C.hairD, 3); cube(ix, iy - 6, 13, C.blue) }
        else { strokeRR(ix - 46, iy - 32, 92, 60, 10, C.hairD, 2, [5, 5]); txt('k3s', ix, iy + 6, { size: 18, font: MONO, weight: 600, color: C.violet, align: 'center' }) }
      })
      if (pick) ring(x + w - 110, y + 122, P(t, 3.6, 4.6), COL, 120)
    })
    // 右：宿主机里的 3 个节点容器
    const ha = E.out(P(t, 5.5, 6.0))
    if (ha < 1) ghost(820, 280, 960, 590, (1 - ha) * E.out(P(t, .8, 1.3)), 18)
    withA((1 - ha) * E.out(P(t, .8, 1.3)), () => txt('宿主机 · Docker', 1300, 585, { size: 24, color: C.faint, align: 'center' }))
    withA(ha, () => {
      panel(820, 280, 960, 590, { r: 18, fill: tint(C.blue, .03), stroke: hexA(C.blue, .35) })
      txt('宿主机 · Docker', 852, 326, { size: 24, weight: 600, color: C.text })
      txt('docker ps：k8s-journey-*', 1752, 326, { size: 18, font: MONO, color: C.mute, align: 'right' })
      line(820, 348, 1780, 348, hexA(C.blue, .2), 1)
    })
    KN.forEach((n, i) => {
      const a = E.out(P(t, 5.9 + i * .4, 6.4 + i * .4)); if (a <= 0) return
      const x = KX(i), y = 372 + lerp(16, 0, a), w = 290, h = 340
      node(x, y, w, h, n, { alpha: a, tag: i ? '工作节点' : '控制平面', accent: i ? C.blue : COL })
      withA(a, () => {
        chip('kindest/node:v1.37.0', x + w / 2, y + 78, { size: 16, col: C.blue })
        txt('systemd', x + 22, y + 132, { size: 18, font: MONO, color: C.mute })
        chip('kubelet', x + 22, y + 172, { size: 18, col: COL, align: 'left' })
        chip('containerd', x + 22, y + 216, { size: 18, col: C.violet, align: 'left' })
      })
      ;[0, 1].forEach(k => { const p = E.back(P(t, 7.8 + i * .3 + k * .15, 8.2 + i * .3 + k * .15)); pod(x + 80 + k * 110, y + 286, 58, { state: 'run', scale: clamp(p), alpha: a }) })
    })
    withA(E.out(P(t, 8.8, 9.4)), () => txt('Pod 是节点容器里的容器', 1300, 748, { size: 20, color: C.body, align: 'center' }))
    // 端口映射
    const pa = E.out(P(t, 11.2, 11.7))
    withA(pa, () => {
      const cx = KX(0) + 145
      chip('127.0.0.1:41235 → 6443', cx, 812, { size: 18, col: COL, solid: t > 11.9 })
      arrow(cx, 792, cx, 722, E.out(P(t, 11.4, 11.9)), hexA(COL, .8), 2.5)
      chip('kubectl', 1470, 812, { size: 20, col: C.violet })
      arrow(1414, 812, cx + 142, 812, E.out(P(t, 11.6, 12.1)), hexA(C.violet, .7), 2.5)
      txt('apiserver 端口 · 宿主机端口号随机', 1300, 856, { size: 17, color: C.mute, align: 'center' })
    })
    if (t > 11.9) flow(1414, 812, KX(0) + 290, 812, t, C.violet, 3, .7, 0, 4)
  },
}

// 场景 2：一份配置文件 + 一条命令
const KCFG = ['kind: Cluster', 'apiVersion: kind.x-k8s.io/v1alpha4', 'name: k8s-journey', 'nodes:', '  - role: control-plane', '    extraPortMappings:', '      - containerPort: 30080', '        hostPort: 30080', '  - role: worker', '  - role: worker']
const MK = [
  { t: 5.6, cmd: 'kind create cluster --config kind-config.yaml' },
  { t: 7.3, out: 'Creating cluster "k8s-journey" ...', color: C.body },
  { t: 7.7, out: ' ✓ Ensuring node image (kindest/node:v1.37.0)', color: C.green, sfx: 'tick' },
  { t: 8.1, out: ' ✓ Preparing nodes', color: C.green, sfx: 'tick' },
  { t: 8.5, out: ' ✓ Starting control-plane', color: C.green, sfx: 'tick' },
  { t: 8.9, out: ' ✓ Installing CNI', color: C.green, sfx: 'tick' },
  { t: 9.3, out: ' ✓ Joining worker nodes', color: C.green, sfx: 'tick' },
  { t: 9.9, out: 'Set kubectl context to "kind-k8s-journey"', color: COL, sfx: 'ok' },
  { t: 11.2, cmd: 'kubectl get nodes' },
  { t: 12.0, out: 'NAME                        STATUS   ROLES', color: C.mute },
  { t: 12.2, out: 'k8s-journey-control-plane   Ready    control-plane', color: C.text, sfx: 'pop' },
  { t: 12.4, out: 'k8s-journey-worker          Ready    <none>', color: C.text, sfx: 'pop' },
  { t: 12.6, out: 'k8s-journey-worker2         Ready    <none>', color: C.text, sfx: 'pop' },
]
const create = {
  name: '声明式建集群', dur: 17, mood: 2,
  vo: [[0.6, '一份 kind-config.yaml，声明 3 个节点。', '一份 kind 配置文件，声明三个节点。'],
    [5.6, 'kind create 一条命令，几十秒建好集群，'],
    [11.0, '上下文自动切换，3 个节点都 Ready。', '上下文自动切换，三个节点都 Ready。']],
  cues: [[0.4, 'whoosh'], ...KCFG.map((_, i) => [.9 + i * .12, 'key']), [2.2, 'ding1'], [3.0, 'ding2'], [3.8, 'tick'], ...typeCues(MK, 30), [10.4, 'lock'], [13.0, 'chime']],
  draw(t, T) {
    heading('一份配置，一条命令', 140, 210, t, .2, { eyebrow: 'KIND CREATE CLUSTER', color: COL })
    const ca = E.out(P(t, .5, 1))
    const hi = t > 2.2 && t < 5.6 ? (t < 3.0 ? [4] : t < 3.8 ? [4, 8, 9] : [4, 5, 6, 7, 8, 9]) : []
    code(140, 280, 720, KCFG, t, .9, { title: 'kind-config.yaml', size: 20, lh: 32, hi, hiColor: COL, alpha: ca })
    withA(E.out(P(t, 2.2, 2.6)), () => chip('1 个控制平面', 836, 499, { size: 17, font: SANS, col: COL, align: 'right' }))
    withA(E.out(P(t, 3.0, 3.4)), () => chip('2 个工作节点', 836, 643, { size: 17, font: SANS, col: COL, align: 'right' }))
    withA(E.out(P(t, 3.8, 4.2)), () => chip('端口映射 · 学 NodePort 时用', 836, 579, { size: 17, font: SANS, col: C.blue, align: 'right' }))
    // kubeconfig
    const ka = E.out(P(t, 10.0, 10.5))
    if (ka < 1) ghost(140, 720, 720, 150, (1 - ka) * ca, 16)
    if (ka < 1) withA((1 - ka) * ca, () => txt('~/.kube/config', 500, 804, { size: 22, font: MONO, color: C.faint, align: 'center' }))
    withA(ka, () => {
      panel(140, 720 + lerp(14, 0, ka), 720, 150, { r: 16, stroke: hexA(COL, .45), fill: tint(COL, .04) })
      const oy = lerp(14, 0, ka)
      txt('~/.kube/config', 172, 764 + oy, { size: 20, font: MONO, color: C.mute })
      txt('current-context:', 172, 810 + oy, { size: 22, font: MONO, color: C.blue })
      chip('kind-k8s-journey', 172 + textW('current-context:', 22, { font: MONO }) + 16, 803 + oy, { size: 22, col: COL, align: 'left', solid: t > 10.4 && t < 11.4 })
      txt('delete / apply 前先确认当前上下文', 172, 850 + oy, { size: 18, color: C.red })
    })
    // 终端
    terminal(900, 280, 880, 590, t, MK, { size: 19, alpha: E.out(P(t, .7, 1.2)) })
    withA(win(t, 2.4, 5.6, .5), () => {
      txt('只描述要几个节点、什么角色', 1340, 560, { size: 26, color: C.faint, align: 'center' })
      txt('不关心怎么创建', 1340, 606, { size: 26, color: C.faint, align: 'center' })
    })
    withA(E.out(P(t, 7.6, 8.1)), () => chip('首次下载约 1 GB 节点镜像 · 之后 30～60 秒', 1752, 836, { size: 17, font: SANS, col: C.mute, align: 'right' }))
    ;[0, 1, 2].forEach(i => { const s = 12.2 + i * .2; if (t > s) { check(1740, 280 + 92 + (10 + i) * 30.4 - 7, 22, C.green, P(t, s, s + .4)) } })
  },
}

// 场景 3：集群里跑着什么
const NX = i => 140 + i * 560, NY = 280, NW = 520, NH = 570
const STATIC = [['etcd', 130, 410], ['kube-apiserver', 380, 410], ['kube-scheduler', 130, 522], ['kube-controller-manager', 380, 522]]
const inside = {
  name: '集群里的组件', dur: 16, mood: 2,
  vo: [[0.6, '控制平面组件，都以静态 Pod 形式运行；'],
    [5.6, 'kube-proxy 和 kindnet，每个节点一个；'],
    [11.0, 'kubelet 和 containerd 则是系统进程。']],
  cues: [[0.4, 'whoosh'], ...STATIC.map((_, i) => [1.4 + i * .35, 'pop']), [3.4, 'ding2'], [5.6, 'whoosh'], ...[0, 1, 2].map(i => [6.0 + i * .3, 'pop']), ...[0, 1, 2].map(i => [7.4 + i * .3, 'pop']), [8.6, 'shimmer'], [11.2, 'thud'], [11.5, 'thud'], [11.8, 'thud'], [13.2, 'ok']],
  draw(t, T) {
    heading('集群里跑着什么', 140, 210, t, .2, { eyebrow: 'KUBE-SYSTEM', color: COL })
    const cmd = t < 11 ? 'kubectl get pods -n kube-system' : 'docker exec k8s-journey-worker systemctl status kubelet'
    withA(E.out(P(t, .8, 1.3)) * (t < 11 ? 1 - P(t, 10.6, 11) : E.out(P(t, 11, 11.4))), () => chip(cmd, 1780, 196, { size: 18, col: C.body, align: 'right', pad: 14 }))
    ;[0, 1, 2].forEach(i => {
      const x = NX(i), a = E.out(P(t, .5 + i * .2, 1.0 + i * .2)); if (a <= 0) return
      node(x, NY + lerp(16, 0, a), NW, NH, ['k8s-journey-control-plane', 'k8s-journey-worker', 'k8s-journey-worker2'][i], { alpha: a, tag: i ? '工作节点' : '控制平面', accent: i ? C.blue : COL })
      withA(a, () => {
        // 静态 Pod 区
        txt(i ? '业务 Pod 会调度到这里' : '静态 Pod · 只在控制平面', x + 26, NY + 84, { size: 18, color: i ? C.faint : COL, weight: i ? 500 : 600 })
        if (i) { ghost(x + 26, NY + 104, NW - 52, 218, 1, 12) }
        line(x + 20, NY + 346, x + NW - 20, NY + 346, C.hair, 1)
      })
    })
    STATIC.forEach(([n, dx, y], k) => {
      const p = E.back(P(t, 1.4 + k * .35, 1.8 + k * .35)); if (p <= 0) return
      pod(NX(0) + dx, y, 66, { state: COL, label: n, scale: clamp(p) })
    })
    if (t > 3.4 && t < 5.6) withA(win(t, 3.4, 5.6, .3), () => strokeRR(NX(0) + 14, NY + 54, NW - 28, 284, 14, hexA(COL, .7), 2.5, [8, 6]))
    // DaemonSet 区
    ;[0, 1, 2].forEach(i => {
      const x = NX(i)
      withA(E.out(P(t, .9, 1.4)), () => txt('每个节点一个', x + 26, NY + 382, { size: 18, color: t > 5.6 ? C.blue : C.faint, weight: 600 }))
      ;[['kube-proxy', 150, 6.0], ['kindnet', 370, 7.4]].forEach(([n, dx, t0]) => {
        const p = E.back(P(t, t0 + i * .3, t0 + .4 + i * .3))
        if (p <= 0) { withA(E.out(P(t, .9, 1.4)), () => { ctx.save(); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); hexPath(x + dx, NY + 428, 26); ctx.stroke(); ctx.restore() }); return }
        pod(x + dx, NY + 428, 54, { state: C.blue, label: n, scale: clamp(p) })
      })
    })
    withA(E.out(P(t, 8.6, 9.1)) * (1 - P(t, 10.8, 11.2)), () => {
      strokeRR(NX(0) + 14, NY + 356, 1640 - 28, 140, 14, hexA(C.blue, .7), 2.5, [8, 6])
      chip('DaemonSet', 960, NY + 356, { size: 18, col: C.blue, solid: true })
    })
    // 系统进程
    ;[0, 1, 2].forEach(i => {
      const x = NX(i), p = E.out(P(t, 11.2 + i * .3, 11.7 + i * .3))
      const y = NY + 506
      if (p <= 0) { withA(E.out(P(t, .9, 1.4)), () => ghost(x + 20, y, NW - 40, 48, 1, 10)); return }
      withA(p, () => {
        ctx.save(); ctx.fillStyle = tint(C.violet, .1); rr(x + 20, y, NW - 40, 48, 10); ctx.fill(); ctx.strokeStyle = hexA(C.violet, .5); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
        txt('systemd', x + 40, y + 31, { size: 17, font: MONO, color: C.mute })
        chip('kubelet', x + 150, y + 24, { size: 17, col: COL, align: 'left', solid: t > 13.2 && i === 1 })
        chip('containerd', x + 268, y + 24, { size: 17, col: C.violet, align: 'left' })
        txt('非 Pod', x + NW - 40, y + 31, { size: 17, color: C.violet, align: 'right', weight: 600 })
      })
    })
    if (t > 13.2) ring(NX(1) + 190, NY + 530, P(t, 13.2, 14.2), COL, 90)
  },
}

// 场景 4：部署 nginx · 调度 · 自愈
const DEP = [1240, 360], SCH = [1600, 360]
const WX = i => 140 + i * 560, WY = 640
const A_DST = [WX(1) + 260, 768], B_DST = [WX(2) + 260, 768]
const DEL = 12.5, NEWT = 13.0, NEWR = 14.8
const DK = [
  { t: .8, cmd: 'kubectl create deployment nginx --image=nginx:1.29 --replicas=2' },
  { t: 3.1, out: 'deployment.apps/nginx created', color: C.green },
  { t: 6.6, cmd: 'kubectl get pods -o wide' },
  { t: 7.6, out: 'NAME                     STATUS    IP           NODE', color: C.mute },
  { t: 7.7, out: 'nginx-7c5ddbdf54-4kx8p   Running   10.244.1.2   k8s-journey-worker', color: C.text },
  { t: 7.8, out: 'nginx-7c5ddbdf54-wq9zt   Running   10.244.2.2   k8s-journey-worker2', color: C.text },
  { t: 11.0, cmd: 'kubectl delete pod nginx-7c5ddbdf54-4kx8p' },
  { t: DEL, out: 'pod "nginx-7c5ddbdf54-4kx8p" deleted', color: C.mute },
]
const podAt = (x0, y0, x1, y1, t, t0, t1, tr, o) => {
  if (t < t0) return
  const p = E.inOut(P(t, t0 + .2, t1)), s = lerp(46, 76, p)
  const x = lerp(x0, x1, p), y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * 60
  pod(x, y, s, { state: t > tr ? 'run' : 'pending', scale: clamp(E.back(P(t, t0, t0 + .3))), ...o })
  if (t > tr && t < tr + 1) ring(x, y, P(t, tr, tr + 1), C.green, 70)
}
const deploy = {
  name: '部署 nginx', dur: 17, mood: 3,
  vo: [[0.6, '一条命令，部署 2 个 nginx 副本。', '一条命令，部署两个 nginx 副本。'],
    [5.6, '控制平面有污点，Pod 只落在两个 worker 上。'],
    [11.0, '删掉一个，控制循环马上补一个新的。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DK, 30), [3.2, 'pop'], [3.4, 'whoosh'], [5.4, 'ok'], [5.7, 'ok'], [5.9, 'zap'], [6.4, 'error'], [DEL, 'poof'], [DEL + .3, 'alarmSoft'], [NEWT, 'pop'], [NEWR, 'ok'], [15.2, 'chime']],
  draw(t, T) {
    heading('部署第一个应用', 140, 210, t, .2, { eyebrow: 'FIRST DEPLOYMENT', color: COL })
    terminal(140, 280, 920, 330, t, DK, { size: 18, alpha: E.out(P(t, .5, 1)) })
    // 控制面对象
    const ready = t < 5.4 ? 0 : t < 5.7 ? 1 : t < DEL ? 2 : t < NEWR ? 1 : 2
    const da = E.out(P(t, 3.1, 3.6))
    if (da < 1) { ghost(DEP[0] - 150, DEP[1] - 50, 300, 100, 1 - da); ghost(SCH[0] - 150, SCH[1] - 50, 300, 100, 1 - da) }
    box(DEP[0], DEP[1], 300, 100, 'Deployment/nginx', `READY ${ready}/2`, COL, { alpha: da, size: 24, hi: (t > DEL && t < NEWR) })
    box(SCH[0], SCH[1], 300, 100, 'kube-scheduler', '给 Pod 选节点', C.blue, { alpha: E.out(P(t, 3.3, 3.8)), size: 24, hi: (t > 3.4 && t < 4.9) || (t > NEWT && t < NEWT + 1.4) })
    withA(E.out(P(t, 3.3, 3.8)), () => arrow(DEP[0] + 156, DEP[1], SCH[0] - 156, SCH[1], 1, hexA(C.blue, .6), 2.5))
    withA(E.out(P(t, 3.6, 4.1)), () => txt('replicas: 2', DEP[0], DEP[1] + 90, { size: 18, font: MONO, color: C.mute, align: 'center' }))
    // 节点
    ;[0, 1, 2].forEach(i => {
      const x = WX(i), a = E.out(P(t, .6 + i * .15, 1.1 + i * .15)); if (a <= 0) return
      node(x, WY, 520, 230, ['control-plane', 'worker', 'worker2'][i], { alpha: a, tag: i ? '工作节点' : '控制平面', accent: i ? C.blue : COL })
      if (i === 0) withA(a, () => {
        const hot = t > 5.8 && t < 11
        lock(x + 110, WY + 138, 54, hot ? C.red : C.faint)
        chip('污点 NoSchedule', x + 180, WY + 118, { size: 20, font: SANS, col: hot ? C.red : C.mute, align: 'left', solid: hot && t < 7.2 })
        txt('普通 Pod 不调度到这里', x + 180, WY + 170, { size: 18, color: C.mute })
      })
    })
    if (t > 5.9 && t < 11) {
      const p = E.out(P(t, 5.9, 6.4)), a = 1 - P(t, 10.4, 11)
      withA(a, () => {
        const x1 = SCH[0] - 150, y1 = SCH[1] + 20, x2 = WX(0) + 360, y2 = WY - 14
        partialLine(x1, y1, lerp(x1, x2, .96), lerp(y1, y2, .96), p, hexA(C.red, .6), 2.5, [8, 7])
        if (t > 6.4) cross(x2, y2 - 6, 30, C.red, E.out(P(t, 6.4, 6.7)))
      })
    }
    // Pod
    const lab = (s, ip) => ({ label: s, sub: ip })
    if (t < DEL + .1) podAt(DEP[0], DEP[1] + 50, A_DST[0], A_DST[1], t, 3.2, 4.6, 5.4, t > 4.6 ? lab('…-4kx8p', '10.244.1.2') : {})
    poof(A_DST[0], A_DST[1], P(t, DEL, DEL + .8), C.red)
    podAt(DEP[0], DEP[1] + 50, B_DST[0], B_DST[1], t, 3.5, 4.9, 5.7, t > 4.9 ? lab('…-wq9zt', '10.244.2.2') : {})
    podAt(DEP[0], DEP[1] + 50, A_DST[0], A_DST[1], t, NEWT, NEWT + 1.4, NEWR, t > NEWT + 1.4 ? lab('…-9mfzl', 'new') : {})
    withA(E.out(P(t, NEWR, NEWR + .5)), () => chip('自愈：自动补齐', A_DST[0] + 150, A_DST[1] - 6, { size: 18, font: SANS, col: C.green }))
  },
}

// 场景 5：Service + port-forward
const SV = [1360, 430], PF = [620, 430], AP = [990, 430], CL = [250, 430]
const PODS = [[1680, 360, '…-9mfzl'], [1680, 505, '…-wq9zt']]
const FK = [
  { t: .8, cmd: 'kubectl expose deployment nginx --port=80' },
  { t: 2.4, out: 'service/nginx exposed', color: C.green },
  { t: 5.6, cmd: 'kubectl port-forward service/nginx 8080:80' },
  { t: 7.2, out: 'Forwarding from 127.0.0.1:8080 -> 80', color: C.body },
  { t: 7.8, cmd: 'curl -s localhost:8080 | grep title' },
  { t: 9.2, out: '<title>Welcome to nginx!</title>', color: C.green, sfx: 'ok' },
]
const WARN = ['流量经 apiserver 中转', '只连一个 Pod，不做负载均衡', '断线后不会自动重连']
const access = {
  name: '访问与调试', dur: 16, mood: 3,
  vo: [[0.6, 'expose 给这组 Pod 一个稳定的 Service；'],
    [5.6, 'port-forward 转发到本机，curl 就能访问。'],
    [11.0, '但它只连一个 Pod，只适合调试。']],
  cues: [[0.4, 'whoosh'], ...typeCues(FK, 30), [2.4, 'pop'], [6.9, 'pop'], [7.2, 'pop'], [8.1, 'zap'], [11.0, 'alarmSoft'], ...WARN.map((_, i) => [11.6 + i * .5, 'tick']), [13.6, 'ding3']],
  draw(t, T) {
    heading('访问应用：Service + port-forward', 140, 210, t, .2, { eyebrow: 'PORT-FORWARD', color: COL })
    // 集群边界
    const ba = E.out(P(t, .5, 1))
    withA(ba, () => {
      strokeRR(830, 290, 950, 290, 18, hexA(COL, .45), 2, [9, 7])
      chip('kind 集群内部', 870, 290, { size: 17, font: SANS, col: COL, align: 'left' })
    })
    // Service + Pods
    const sa = E.out(P(t, 2.4, 2.9))
    if (sa < 1) ghost(SV[0] - 150, SV[1] - 55, 300, 110, (1 - sa) * ba)
    box(SV[0], SV[1], 300, 110, 'Service nginx', 'ClusterIP 10.96.145.23', COL, { alpha: sa, size: 26, hi: t > 2.4 && t < 5.6 })
    withA(E.out(P(t, 3.0, 3.5)), () => txt('稳定入口 · 端口 80', SV[0], SV[1] + 92, { size: 18, color: C.mute, align: 'center' }))
    PODS.forEach(([x, y, n], k) => {
      pod(x, y, 64, { state: 'run', label: n, alpha: ba })
      const one = k === 0
      const la = E.out(P(t, 2.8, 3.3)); if (la <= 0) return
      const x1 = SV[0] + 152, x2 = x - 38
      const off = t > 8.1 && !one
      withA(la * (off ? .35 : 1), () => line(x1, SV[1], x2, y, hexA(COL, .55), 2.5, off ? [6, 6] : undefined))
      if (t < 8.1 && t > 3.3) flow(x1, SV[1], x2, y, t, COL, 2, .6, k * .5, 4)
    })
    if (t > 11.8) cross(1590, 470, 26, C.red, E.out(P(t, 11.8, 12.1)))
    withA(E.out(P(t, 1.2, 1.7)) * (1 - P(t, 5.4, 5.9)), () => txt('Pod IP 是集群内部地址，宿主机访问不到', 1305, 552, { size: 18, color: C.amber, align: 'center' }))
    // 本机链路
    const pa = E.out(P(t, 6.9, 7.4))
    const ca = E.out(P(t, 7.8, 8.3))
    if (pa < 1) { ghost(PF[0] - 140, PF[1] - 55, 280, 110, (1 - pa) * ba); ghost(CL[0] - 110, CL[1] - 55, 220, 110, (1 - ca) * ba) }
    box(CL[0], CL[1], 220, 110, 'curl', 'localhost:8080', C.violet, { alpha: ca, size: 26 })
    box(PF[0], PF[1], 280, 110, 'port-forward', 'kubectl · 8080→80', C.violet, { alpha: pa, size: 26, hi: t > 7.2 && t < 11 })
    box(AP[0], AP[1], 260, 110, 'kube-apiserver', '中转', t > 11.6 ? C.amber : C.blue, { alpha: E.out(P(t, 6.0, 6.5)), size: 24, hi: t > 11.6 && t < 14 })
    const seg = [[CL[0] + 112, PF[0] - 142], [PF[0] + 142, AP[0] - 132], [AP[0] + 132, SV[0] - 152]]
    seg.forEach(([a, b], k) => {
      const al = k === 0 ? ca : k === 1 ? pa : E.out(P(t, 6.4, 6.9))
      withA(al, () => arrow(a, CL[1], b, CL[1], 1, hexA(k ? COL : C.violet, .6), 2.5))
    })
    if (t > 8.1 && t < 10.4) travelPath([[CL[0] + 112, 430], [PF[0], 430], [AP[0], 430], [SV[0], 430], [PODS[0][0] - 38, PODS[0][1]]], P(t, 8.1, 9.2), C.violet)
    if (t > 9.2) withA(E.out(P(t, 9.2, 9.6)) * (1 - P(t, 10.8, 11.2)), () => bubble('Welcome to nginx!', CL[0], 350, { col: C.green }))
    // 终端
    terminal(140, 620, 900, 250, t, FK, { size: 18, alpha: E.out(P(t, .6, 1.1)) })
    // 注意事项
    const wa = E.out(P(t, 11.0, 11.5))
    if (wa < 1) ghost(1080, 620, 700, 250, (1 - wa) * ba, 16)
    withA(wa, () => {
      panel(1080, 620 + lerp(14, 0, wa), 700, 250, { r: 16, stroke: hexA(C.amber, .6), fill: tint(C.amber, .06) })
      const oy = lerp(14, 0, wa)
      chip('WARNING', 1112, 664 + oy, { size: 16, col: C.amber, solid: true, align: 'left' })
      txt('port-forward 只用于调试', 1240, 672 + oy, { size: 24, weight: 600, color: C.amber })
      WARN.forEach((s, i) => withA(E.out(P(t, 11.6 + i * .5, 12.0 + i * .5)), () => {
        dot(1122, 720 + i * 40 + oy, 4, C.amber, 0)
        txt(s, 1140, 727 + i * 40 + oy, { size: 20, color: C.text })
      }))
      withA(E.out(P(t, 13.6, 14.1)), () => txt('正式暴露：NodePort · LoadBalancer · Ingress', 1112, 846 + oy, { size: 19, color: C.body }))
    })
  },
}

ANIM({
  id: 'local-cluster',
  meta: { stage: 0, lesson: 4, of: 4, title: '搭建本地实验集群', summary: '安装 kubectl，用 kind 创建多节点集群，部署第一个应用。', next: 'kubectl 与声明式 API' },
  scenes: [
    lessonIntro({ tags: ['kubectl', 'kind', 'kind-config.yaml', '静态 Pod', 'port-forward'], vo: [[3.2, '几十秒建好，搞坏了随时重建。']] }),
    tools, create, inside, deploy, access,
    lessonOutro({
      points: ['kind：每个节点都是一个容器', '一份 kind-config.yaml 声明整个集群', '控制平面组件以静态 Pod 运行', 'port-forward 只用于调试'],
      vo: [[0.8, '小结：本地集群，随建随删。'], [5.6, '下一课，学 kubectl 与声明式 API。']],
    }),
  ],
})
})()
