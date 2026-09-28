/* 第 0 阶段 · 第 2 课：容器基础：从进程到镜像 */
(() => {
const COL = STAGES[0].color

// 场景 1：Namespace —— 隔离视图
const NS_TERM = [
  { t: 1.0, cmd: 'sudo unshare -upnm -f --mount-proc bash' },
  { t: 5.8, cmd: 'ps aux' },
  { t: 6.4, out: 'PID  COMMAND', color: C.mute },
  { t: 6.6, out: '  1  bash', color: C.green, sfx: 'ok' },
  { t: 6.8, out: '  8  ps aux', color: C.body },
  { t: 11.0, cmd: 'hostname my-container' },
  { t: 12.0, cmd: 'ip addr' },
  { t: 12.6, out: '1: lo: <LOOPBACK> state DOWN', color: C.amber },
]
const PROCS = [['systemd', 1, 0], ['containerd', 812, 1], ['sshd', 903, 1], ['sudo unshare', 4212, 1], ['bash', 4213, 2]]
const NSS = [['PID', 1], ['UTS', 1], ['Network', 1], ['Mount', 1], ['IPC', 0], ['User', 0], ['Cgroup', 0], ['Time', 0]]
const ns = {
  name: 'Namespace 隔离', dur: 16, mood: 1,
  vo: [[0.6, '容器不是虚拟机，只是一个被隔离的进程。'],
    [5.6, '新的 PID 命名空间里，bash 成了 1 号进程。', '新的 PID 命名空间里，bash 成了一号进程。'],
    [11.0, '主机名、网络、挂载点，也各自独立一份。']],
  cues: [[0.4, 'whoosh'], ...typeCues(NS_TERM, 30), ...PROCS.map((_, i) => [1.4 + i * .25, 'tick']), [5.6, 'swell'], [11.2, 'pop'], [11.5, 'pop'], [11.8, 'pop']],
  draw(t) {
    heading('Namespace：隔离「看得见什么」', 140, 210, t, .2, { eyebrow: 'NAMESPACE', color: COL })
    terminal(140, 270, 840, 440, t, NS_TERM, { size: 24, alpha: E.out(P(t, .5, 1)) })
    // 左下：容器的公式
    withA(E.out(P(t, 2.2, 2.8)), () => {
      panel(140, 740, 840, 130, { r: 18, fill: tint(COL, .05), stroke: hexA(COL, .4) })
      let x = 176
      const part = (s, o, sub) => { const w = textW(s, o.size, { weight: o.weight }); txt(s, x, 808, o); if (sub) txt(sub, x + w / 2, 848, { size: 18, color: o.color, align: 'center' }); x += w + 16 }
      part('容器', { size: 30, weight: 700 }); part('=', { size: 30, color: C.mute })
      part('普通进程', { size: 30, weight: 600 }); part('+', { size: 30, color: C.mute })
      part('Namespace', { size: 30, weight: 700, color: COL }, '看得见什么'); part('+', { size: 30, color: C.mute })
      part('cgroup', { size: 30, weight: 700, color: C.amber }, '能用多少')
    })
    // 右侧：宿主机进程树
    const pa = E.out(P(t, .8, 1.3))
    withA(pa, () => {
      panel(1030, 270, 750, 600, { r: 18 })
      txt('宿主机上的进程', 1066, 322, { size: 24, weight: 600 })
      txt('PID', 1740, 322, { size: 18, font: MONO, color: C.mute, align: 'right' })
    })
    const inNs = E.out(P(t, 5.6, 6.4))
    const PY = i => i < 4 ? 376 + i * 54 : 632
    // 命名空间气泡
    if (inNs > 0) withA(inNs, () => {
      panel(1066, 580, 680, 96, { r: 18, fill: tint(COL, .07), stroke: COL, lw: 2, dash: [10, 8], shadow: false })
      chip('新 PID 命名空间', 1090, 580, { size: 17, font: SANS, col: COL, solid: true, align: 'left' })
    })
    PROCS.forEach(([n, pid, d], i) => {
      const a = E.out(P(t, 1.4 + i * .25, 1.8 + i * .25)); if (a <= 0) return
      const y = PY(i), x = 1066 + d * 36
      withA(a, () => {
        if (d) txt(i === 4 ? '└' : '├', x - 26, y, { size: 22, font: MONO, color: C.faint })
        dot(x + 8, y - 7, 6, i === 4 ? COL : C.mute, 0)
        txt(n, x + 26, y, { size: 24, font: MONO, color: i === 4 ? C.text : C.body, weight: i === 4 ? 600 : 500 })
        if (i < 4) txt(String(pid), 1740, y, { size: 22, font: MONO, color: C.mute, align: 'right' })
      })
    })
    // bash 的两个 PID
    const by = PY(4)
    withA(E.out(P(t, 2.6, 3)), () => {
      const k = inNs
      if (k < 1) txt('4213', 1740, by, { size: 22, font: MONO, color: C.mute, align: 'right', alpha: 1 - k })
      if (k > 0) withA(k, () => {
        txt('宿主机看', 1470, by - 22, { size: 16, color: C.mute, align: 'center' })
        txt('4213', 1470, by + 10, { size: 24, font: MONO, color: C.mute, align: 'center' })
        txt('容器里看', 1640, by - 22, { size: 16, color: COL, align: 'center' })
        txt('1', 1640, by + 20, { size: 44, weight: 700, font: MONO, color: COL, align: 'center' })
      })
    })
    if (t > 5.6 && t < 7) ring(1640, by, P(t, 5.8, 7), COL, 90)
    // 8 种命名空间
    withA(E.out(P(t, 10.8, 11.2)), () => txt('Linux 命名空间 · 本例开启了前 4 种', 1066, 730, { size: 18, color: C.body }))
    NSS.forEach(([n, on], i) => {
      const a = E.out(P(t, 10.8 + i * .12, 11.2 + i * .12)); if (a <= 0) return
      const x = 1066 + (i % 4) * 172, y = 776 + Math.floor(i / 4) * 52
      const lit = on && t > 11.2
      chip(n, x, y, { size: 20, align: 'left', col: lit ? COL : C.mute, solid: lit, alpha: a * (on ? 1 : .7) })
    })
  },
}

// 场景 2：cgroup —— 限制「用多少」
const CG_TERM = [
  { t: 1.0, cmd: 'sudo mkdir /sys/fs/cgroup/demo' },
  { t: 2.3, cmd: 'echo 50M | sudo tee /sys/fs/cgroup/demo/memory.max' },
  { t: 4.3, out: '50M', color: C.body },
  { t: 5.8, cmd: "python3 -c 'a = bytearray(100 * 2**20)'" },
  { t: 7.4, out: 'Killed', color: C.red, sfx: 'error' },
  { t: 8.0, cmd: 'grep oom_kill /sys/fs/cgroup/demo/memory.events' },
  { t: 9.9, out: 'oom_kill 1', color: C.amber },
]
const MAP = [['limits.memory: 128Mi', 'memory.max', '超限 → OOMKilled', C.red, 11.2], ['limits.cpu: 500m', 'cpu.max', '超限 → 被限流变慢', C.amber, 12.4]]
const cgroup = {
  name: 'cgroup 限额', dur: 16, mood: 3,
  vo: [[0.6, 'cgroup 给进程设上限：内存、CPU 各多少。'],
    [5.6, '上限 50M，程序要 100M，当场被杀掉。', '上限五十兆，程序要一百兆，当场被杀掉。'],
    [11.0, 'K8s 的 limits，最终就写进这些 cgroup 文件。', 'Kubernetes 的 limits，最终就写进这些 cgroup 文件。']],
  cues: [[0.4, 'whoosh'], ...typeCues(CG_TERM, 30), [7.4, 'impact'], [11.2, 'pop'], [12.4, 'pop'], [13.4, 'tick']],
  draw(t) {
    heading('cgroup：限制「用多少」', 140, 210, t, .2, { eyebrow: 'CGROUP V2', color: COL })
    terminal(140, 270, 1000, 400, t, CG_TERM, { size: 22, alpha: E.out(P(t, .5, 1)) })
    // 右侧：demo 组的内存条（整条 = 100M）
    const X0 = 1220, BW = 520, BY = 440, BH = 64, limX = X0 + BW / 2
    withA(E.out(P(t, .8, 1.3)), () => {
      panel(1180, 270, 600, 400, { r: 18 })
      txt('cgroup demo · 内存', 1216, 322, { size: 24, weight: 600 })
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(X0, BY, BW, BH, 14); ctx.fill(); ctx.restore()
      txt('每个 cgroup = /sys/fs/cgroup 下的一个目录', X0, 640, { size: 17, color: C.mute })
      ;[0, 50, 100].forEach(v => txt(v + 'M', X0 + BW * v / 100, BY + BH + 30, { size: 17, font: MONO, color: C.mute, align: v ? v === 100 ? 'right' : 'center' : 'left' }))
    })
    withA(E.out(P(t, 2.6, 3.2)), () => {
      line(limX, BY - 26, limX, BY + BH + 8, C.red, 3, [8, 6])
      chip('memory.max = 50M', limX, BY - 46, { size: 18, col: C.red })
    })
    // 申请 100M 的虚线轮廓
    withA(E.out(P(t, 5.8, 6.3)) * (1 - P(t, 9.6, 10.2)), () => {
      ctx.save(); ctx.strokeStyle = hexA(C.amber, .9); ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); rr(X0 - 4, BY - 4, BW + 8, BH + 8, 16); ctx.stroke(); ctx.restore()
      txt('程序想要 100M', X0 + BW - 16, BY + 42, { size: 20, font: MONO, color: C.amber, align: 'right' })
    })
    const kill = t >= 7.4
    const fill = t < 5.8 ? 0 : kill ? .5 * (1 - E.out(P(t, 7.6, 8.4))) : .5 * E.inOut(P(t, 5.9, 7.3))
    const shake = kill ? Math.sin(t * 70) * 6 * (1 - P(t, 7.4, 7.9)) : 0
    if (fill > 0) { ctx.save(); ctx.fillStyle = kill ? C.red : t > 6.9 ? C.amber : COL; rr(X0 + shake, BY, BW * fill, BH, 14); ctx.fill(); ctx.restore()
      if (fill > .12) txt(`${Math.round(fill * 100)}M`, X0 + 18 + shake, BY + 42, { size: 24, weight: 700, font: MONO, color: '#fff' }) }
    if (kill) {
      if (t < 8.6) poof(limX, BY + BH / 2, P(t, 7.4, 8.6), C.red)
      withA(E.out(P(t, 7.5, 7.9)), () => {
        chip('OOM Kill', X0, 580, { size: 24, col: C.red, solid: true, align: 'left' })
        txt('超出上限，内核直接杀掉进程', X0 + 150, 588, { size: 20, color: C.body })
      })
    } else withA(E.out(P(t, 3.2, 3.6)), () => txt('进程超过上限会怎样？', X0, 588, { size: 20, color: C.mute }))
    // 下方：K8s 字段 → cgroup 文件
    withA(E.out(P(t, 10.8, 11.3)), () => {
      panel(140, 700, 1640, 170, { r: 18, fill: tint(COL, .03), stroke: hexA(COL, .35) })
      txt('Pod 的 resources', 176, 740, { size: 17, color: C.mute }); txt('写进 cgroup 文件', 780, 740, { size: 17, color: C.mute }); txt('超限的后果', 1260, 740, { size: 17, color: C.mute })
    })
    MAP.forEach(([a, b, c, col, t0], i) => {
      const k = E.out(P(t, t0, t0 + .5)); if (k <= 0) return
      const y = 784 + i * 56
      withA(k, () => {
        chip(a, 176, y, { size: 22, col: C.blue, align: 'left' })
        arrow(560, y, 740, y, E.out(P(t, t0 + .2, t0 + .7)), C.faint, 2.5)
        chip(b, 780, y, { size: 22, col: COL, solid: true, align: 'left' })
        arrow(1030, y, 1220, y, E.out(P(t, t0 + .4, t0 + .9)), C.faint, 2.5)
        txt(c, 1260, y + 8, { size: 24, weight: 600, color: col })
      })
    })
  },
}

// 场景 3：镜像分层与写时复制
const LAYERS = [['debian:bookworm', '117 MB', 1.6], ['RUN apt-get install curl', '+45 MB', 2.6], ['COPY app /app', '+8 MB', 3.6]]
const LX = 900, LW = 700, LY = i => 700 - i * 76, CW = 216, CX = i => LX + i * (CW + 26), WY = 452
const COW = [['读', '直接读下面的只读层', C.blue, 11.2], ['写', '先把文件复制到可写层再改', C.amber, 11.9], ['删', '删掉容器，可写层一起消失', C.red, 14.0]]
const layers = {
  name: '镜像分层', dur: 17, mood: 2,
  vo: [[0.6, '镜像由一层层只读层叠成，每条指令一层。'],
    [5.6, '容器启动时，在最上面加一层可写层。'],
    [11.0, '改文件先复制到可写层，删掉容器就没了。']],
  cues: [[0.4, 'whoosh'], ...LAYERS.map(l => [l[2], 'thud']), [5.8, 'pop'], [6.2, 'pop'], [6.6, 'pop'], [11.2, 'tick'], [11.9, 'whoosh'], [12.8, 'ding3'], [14.0, 'poof']],
  draw(t) {
    heading('镜像分层与写时复制', 140, 210, t, .2, { eyebrow: 'IMAGE LAYERS', color: COL })
    const cur = LAYERS.filter(l => t >= l[2]).length - 1
    code(140, 270, 680, ['FROM debian:bookworm', 'RUN apt-get install -y curl', 'COPY app /app', 'CMD ["/app"]'], t, .6,
      { title: 'Dockerfile', size: 22, hi: t < 5.6 && cur >= 0 ? [cur] : [], hiColor: C.blue, alpha: E.out(P(t, .4, .9)) })
    // 左下：共享 → 写时复制
    const sw = E.inOut(P(t, 10.8, 11.2))
    withA(E.out(P(t, 1.6, 2.1)), () => panel(140, 580, 680, 290, { r: 18 }))
    withA(E.out(P(t, 1.6, 2.1)) * (1 - sw), () => {
      txt('磁盘占用', 176, 632, { size: 22, weight: 600 })
      txt(`${[117, 162, 170][Math.max(0, cur)]} MB`, 176, 708, { size: 52, weight: 700, font: MONO, color: C.blue })
      txt('镜像：3 个只读层', 176, 750, { size: 20, color: C.body })
      withA(E.out(P(t, 7.0, 7.5)), () => {
        txt('+ 3 个容器 ≈ 仍是 170 MB', 460, 708, { size: 24, weight: 600, color: C.amber })
        txt('只读层共用，不会变成 510 MB', 460, 750, { size: 20, color: C.body })
      })
      withA(E.out(P(t, 4.4, 5)), () => { lock(190, 816, 22, C.mute, 0); txt('只读层按内容寻址，拉过一次就能复用', 220, 826, { size: 20, color: C.mute }) })
    })
    withA(sw, () => {
      chip('写时复制 · Copy-on-Write', 176, 632, { size: 20, font: SANS, col: C.amber, solid: true, align: 'left' })
      COW.forEach(([k, d, col, t0], i) => withA(E.out(P(t, t0, t0 + .4)), () => {
        const y = 704 + i * 58
        chip(k, 176, y, { size: 22, font: SANS, col, align: 'left' })
        txt(d, 246, y + 8, { size: 23, color: C.text })
      }))
    })
    // 右侧：只读层堆叠
    LAYERS.forEach(([n, s, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = LY(i) - lerp(-40, 0, a)
      withA(a, () => {
        ctx.save(); ctx.fillStyle = tint(C.blue, .1 + i * .05); ctx.strokeStyle = hexA(C.blue, .5); ctx.lineWidth = 1.5; rr(LX, y, LW, 62, 12); ctx.fill(); ctx.stroke(); ctx.restore()
        txt(n, LX + 28, y + 40, { size: 22, font: MONO, color: C.text })
        txt(s, LX + LW - 60, y + 40, { size: 18, font: MONO, color: C.mute, align: 'right' })
        lock(LX + LW - 30, y + 31, 16, hexA(C.blue, .7), 0)
      })
    })
    const brace = (y1, y2, s1, s2, col, a) => withA(a, () => {
      const x = LX + LW + 22
      line(x, y1, x + 12, y1, hexA(col, .6), 2.5); line(x + 12, y1, x + 12, y2, hexA(col, .6), 2.5); line(x, y2, x + 12, y2, hexA(col, .6), 2.5)
      txt(s1, x + 32, (y1 + y2) / 2 - 4, { size: 24, weight: 600, color: col })
      txt(s2, x + 32, (y1 + y2) / 2 + 26, { size: 18, color: C.body })
    })
    brace(LY(2), LY(0) + 62, '镜像', '只读 · 共享', C.blue, E.out(P(t, 4.2, 4.8)))
    brace(WY, WY + 58, '容器', '各自一层', C.amber, E.out(P(t, 7.0, 7.5)) * (1 - 0 * t))
    // 容器与可写层
    const gone = E.inOut(P(t, 14, 14.6))
    ;['A', 'B', 'C'].forEach((n, i) => {
      const a = E.out(P(t, 5.8 + i * .4, 6.3 + i * .4)); if (a <= 0) return
      const x = CX(i), y = WY - lerp(24, 0, a)
      withA(a * (i === 0 ? 1 - gone : 1), () => {
        ctx.save(); ctx.fillStyle = tint(C.amber, .14); ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); rr(x, y, CW, 58, 12); ctx.fill(); ctx.stroke(); ctx.restore()
        if (!(i === 0 && t > 12.4)) txt('可写层', x + CW / 2, y + 37, { size: 20, color: C.amber, weight: 600, align: 'center' })
        cube(x + CW / 2, y - 70, 30, COL)
        txt('容器 ' + n, x + CW / 2, y - 16, { size: 20, weight: 600, align: 'center' })
      })
      if (i === 0 && t > 14 && t < 15.2) poof(x + CW / 2, y - 20, P(t, 14, 15.2), C.amber)
    })
    // 写时复制：文件从底层复制到容器 A 的可写层
    const fx = LX + 440, fy = LY(0) + 31
    withA(E.out(P(t, 11.2, 11.6)), () => chip('/etc/app.conf', fx, fy, { size: 16, col: C.blue }))
    if (t > 11.2 && t < 12.4) { const p = E.inOut(P(t, 11.2, 11.5)) * 0 + E.inOut(P(t, 11.9, 12.4)); if (p > 0) travel(fx, fy, CX(0) + CW / 2, WY + 29, p, C.amber, 9) }
    if (t > 12.4) withA(E.out(P(t, 12.4, 12.8)) * (1 - gone), () => chip('app.conf ✎', CX(0) + CW / 2, WY + 29, { size: 18, col: C.amber, solid: true }))
    if (t > 11.2 && t < 12) ring(fx, fy, P(t, 11.2, 12), C.blue, 70)
    withA(E.out(P(t, 14.6, 15.1)), () => {
      ctx.save(); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); rr(CX(0), WY, CW, 58, 12); ctx.stroke(); ctx.restore()
      txt('改动已丢失', CX(0) + CW / 2, WY + 37, { size: 20, color: C.mute, align: 'center' })
      chip('要持久化的数据 → 放进 Volume', LX, 812, { size: 22, font: SANS, col: C.red, align: 'left', pad: 16 })
    })
  },
}

// 场景 4：容器运行时调用链
const CHAIN = [['kubelet', 'K8s 节点代理', C.blue, 330, 1.0], ['containerd', '高层运行时 · 管镜像', COL, 750, 2.2], ['runc', '低层运行时', C.violet, 1170, 5.8], ['Linux 内核', 'namespace · cgroup', C.text, 1590, 7.0]]
const LINKS = [['CRI · gRPC', 1.8], ['OCI 规范', 6.4], ['系统调用', 7.6]]
const ALT = [[1, '也可换成 CRI-O', 3.2], [2, '也可换成 crun · Kata', 8.4]]
const OCI = [['Image Spec', '镜像格式', 7.5], ['Runtime Spec', '怎么运行', 7.2], ['Distribution', '怎么推拉', 7.8]]
const DK = [['docker build 的镜像', '符合 OCI，照样能跑', C.green, 11.2, 0], ['dockershim', '1.24 起从 kubelet 移除', C.red, 12.4, 1], ['crictl', '节点上排障用它，代替 docker ps', C.violet, 13.4, 0]]
const runtime = {
  name: '运行时调用链', dur: 16, mood: 2,
  vo: [[0.6, 'kubelet 通过 CRI 接口，调用 containerd。'],
    [5.6, 'containerd 再调用 runc，由内核创建容器。'],
    [10.8, 'Docker 构建的镜像符合 OCI，照样能跑。']],
  cues: [[0.4, 'whoosh'], ...CHAIN.map(c => [c[4], 'pop']), [2.0, 'zap'], [6.6, 'zap'], [7.8, 'zap'], [7.2, 'tick'], [11.2, 'ok'], [12.4, 'error'], [13.4, 'tick']],
  draw(t, T) {
    heading('从 kubelet 到内核', 140, 210, t, .2, { eyebrow: 'CONTAINER RUNTIME', color: COL })
    const Y = 410
    withA(E.out(P(t, .5, 1)), () => {
      panel(140, 280, 1640, 300, { r: 22, fill: 'rgba(0,0,0,0.018)', stroke: C.hairD, dash: [10, 8], shadow: false })
      chip('一个工作节点', 172, 280, { size: 18, font: SANS, col: C.body, align: 'left' })
    })
    CHAIN.forEach(([n, s, col, x, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5))
      if (a < 1) withA(E.out(P(t, .6, 1.1)) * (1 - a), () => panel(x - 145, Y - 60, 290, 120, { r: 16, fill: 'rgba(0,0,0,0.015)', stroke: C.hairD, dash: [8, 7], shadow: false }))
      if (a <= 0) return
      const on = (t < 5.6 ? i <= 1 : t < 10.8 ? i >= 1 : false)
      box(x, Y + lerp(20, 0, a), 290, 120, n, s, col, { alpha: a, hi: on, size: 30 })
    })
    LINKS.forEach(([s, t0], i) => {
      const x1 = CHAIN[i][3] + 145, x2 = CHAIN[i + 1][3] - 145, p = E.out(P(t, t0, t0 + .5))
      arrow(x1 + 6, Y, x2 - 8, Y, p, hexA(C.text, .3), 2.5)
      withA(p, () => txt(s, (x1 + x2) / 2, Y - 20, { size: 16, font: MONO, color: C.mute, align: 'center' }))
      if (p >= 1 && t < 10.8) flow(x1 + 10, Y, x2 - 24, Y, T, CHAIN[i + 1][2], 2, .7, i * .3, 5)
    })
    ALT.forEach(([i, s, t0]) => withA(E.out(P(t, t0, t0 + .5)), () => txt(s, CHAIN[i][3], Y + 106, { size: 18, color: C.mute, align: 'center' })))
    withA(E.out(P(t, 8.8, 9.3)), () => txt('真正创建隔离的，是内核', CHAIN[3][3], Y + 106, { size: 18, color: C.body, align: 'center' }))
    // 左下：Docker 的位置
    withA(E.out(P(t, 10.8, 11.2)), () => {
      panel(140, 620, 800, 250, { r: 18 })
      txt('那 Docker 呢？', 176, 668, { size: 24, weight: 600 })
    })
    DK.forEach(([a, b, col, t0, x], i) => withA(E.out(P(t, t0, t0 + .4)), () => {
      const y = 722 + i * 50
      chip(a, 176, y, { size: 19, col, align: 'left' })
      if (x) line(186, y, 186 + textW(a, 19, { font: MONO }) + 4, y, C.red, 2.5)
      if (col === C.green) check(530, y, 22, C.green, P(t, t0 + .1, t0 + .5))
      txt(b, 560, y + 7, { size: 21, color: col === C.violet ? C.body : col })
    }))
    // 右下：OCI 三份规范
    withA(E.out(P(t, 7.0, 7.4)), () => {
      panel(980, 620, 800, 250, { r: 18, fill: tint(COL, .04), stroke: hexA(COL, .4) })
      chip('OCI', 1016, 668, { size: 22, col: COL, solid: true, align: 'left' })
      txt('开放容器标准：谁构建的镜像，谁都能跑', 1100, 676, { size: 21, color: C.body })
    })
    OCI.forEach(([n, d, t0], i) => {
      const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
      const x = 1016 + i * 248, on = t < 10.8 ? i === 1 : i !== 1
      withA(a, () => {
        panel(x, 712, 228, 128, { r: 14, stroke: on ? COL : C.hair, lw: on ? 2 : 1.5, fill: on ? tint(COL, .08) : C.panel, shadow: false })
        txt(n, x + 114, 766, { size: 21, weight: 600, font: MONO, align: 'center', color: on ? COL : C.text })
        txt(d, x + 114, 806, { size: 19, color: C.body, align: 'center' })
      })
    })
  },
}

// 场景 5：多阶段构建与镜像引用
const DF = ['# 构建阶段：带完整工具链', 'FROM golang:1.25 AS build', 'WORKDIR /src', 'COPY . .', 'RUN CGO_ENABLED=0 go build -o /hello', '# 运行阶段：只带二进制', 'FROM gcr.io/distroless/static-debian12:nonroot', 'COPY --from=build /hello /hello', 'ENTRYPOINT ["/hello"]']
const REF = [['registry.example.com/', '仓库地址', C.blue], ['team/hello-app', '镜像名', C.violet], [':v2', '标签 · 可变', C.amber], ['@sha256:4e1f…9a', '摘要 · 不可变', COL]]
const multistage = {
  name: '多阶段构建', dur: 17, mood: 4,
  vo: [[0.6, '多阶段构建：先在大镜像里编译，'],
    [5.6, '只把二进制拷进精简镜像，900M 变 9M。', '只把二进制拷进精简镜像，九百兆变九兆。'],
    [11.0, '生产别用 latest，固定版本号或 digest。']],
  cues: [[0.4, 'whoosh'], [1.6, 'tick'], [3.0, 'swell'], [6.2, 'whoosh'], [7.0, 'ding4'], [8.6, 'ok'], [11.2, 'pop'], [11.6, 'pop'], [12.0, 'pop'], [12.4, 'lock'], [13.4, 'error']],
  draw(t) {
    heading('多阶段构建，小而安全', 140, 210, t, .2, { eyebrow: 'MULTI-STAGE BUILD', color: COL })
    const hi = t < 5.6 ? [1, 2, 3, 4] : t < 11 ? [6, 7, 8] : []
    code(140, 270, 900, DF, t, .6, { title: 'Dockerfile', size: 20, lh: 32, hi, hiColor: t < 5.6 ? C.blue : COL, alpha: E.out(P(t, .4, .9)) })
    // 右侧：体积对比
    const bx = 1100, bw = 680
    withA(E.out(P(t, 1.4, 1.9)), () => {
      txt('构建镜像 golang:1.25', bx, 320, { size: 22, weight: 600 })
      ctx.save(); ctx.fillStyle = tint(C.blue, .25); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; rr(bx, 342, bw * E.out(P(t, 1.6, 3.4)), 56, 12); ctx.fill(); ctx.stroke(); ctx.restore()
      txt(`${countUp(900, t, 1.6, 3.4)} MB`, bx + 24, 380, { size: 24, weight: 700, font: MONO, color: C.blue })
      txt('编译器 · 源码 · 缓存', bx, 432, { size: 18, color: C.mute })
    })
    withA(E.out(P(t, 6.2, 6.6)), () => {
      txt('最终镜像 distroless', bx, 510, { size: 22, weight: 600 })
      if (t > 6.8) { ctx.save(); ctx.fillStyle = tint(COL, .35); ctx.strokeStyle = COL; ctx.lineWidth = 2; rr(bx, 532, Math.max(14, bw * .01), 56, 8); ctx.fill(); ctx.stroke(); ctx.restore() }
      if (t < 6.8) panel(bx, 532, bw, 56, { r: 12, fill: 'rgba(0,0,0,0.015)', stroke: C.hairD, dash: [8, 7], shadow: false })
      else txt(`${countUp(9, t, 7, 8.2)} MB`, bx + 36, 570, { size: 24, weight: 700, font: MONO, color: COL })
      txt('只有二进制 · 无 shell · 非 root', bx, 622, { size: 18, color: C.mute })
    })
    if (t > 6.0 && t < 6.85) { doc(lerp(bx + 200, bx + 7, E.inOut(P(t, 6, 6.8))), lerp(372, 560, E.inOut(P(t, 6, 6.8))), 44, 54, '', COL, { ext: 'bin' }) }
    withA(E.out(P(t, 8.4, 8.9)), () => chip('↓ 99%', 1780, 570, { size: 26, col: COL, solid: true, align: 'right' }))
    // 下方：两阶段流水线 → 镜像引用拆解
    withA(E.out(P(t, .8, 1.3)), () => panel(140, 690, 1640, 180, { r: 18 }))
    withA(1 - P(t, 10.4, 10.9), () => {
      const f = (t0) => E.out(P(t, t0, t0 + .5))
      ;[[960, 6.2], [1500, 8.6]].forEach(([x, t0]) => withA(E.out(P(t, 1.2, 1.7)) * (1 - f(t0)), () => panel(x - 200, 728, 400, 104, { r: 16, fill: 'rgba(0,0,0,0.015)', stroke: C.hairD, dash: [8, 7], shadow: false })))
      box(420, 780, 400, 104, '构建阶段', 'golang:1.25 · 编译', C.blue, { alpha: f(1.0) * (t > 7.2 ? .45 : 1), hi: t < 5.6, size: 26 })
      withA(E.out(P(t, 7.2, 7.6)), () => chip('用完即弃', 420, 718, { size: 16, font: SANS, col: C.mute }))
      arrow(626, 780, 750, 780, f(5.8), hexA(C.text, .3), 2.5)
      withA(f(5.8), () => txt('只拷 /hello', 688, 764, { size: 16, font: MONO, color: C.mute, align: 'center' }))
      if (t > 5.8 && t < 6.8) doc(lerp(640, 740, E.inOut(P(t, 5.9, 6.7))), 796, 30, 38, '', COL, { ext: 'bin' })
      box(960, 780, 400, 104, '运行阶段', 'distroless · 9 MB', COL, { alpha: f(6.2), hi: t >= 5.6, size: 26 })
      arrow(1166, 780, 1290, 780, f(8.4), hexA(C.text, .3), 2.5)
      box(1500, 780, 400, 104, '推送到镜像仓库', '只分发最终镜像', C.violet, { alpha: f(8.6), size: 26 })
    })
    if (t > 10.8) {
      const size = 28
      let x = 180
      withA(E.out(P(t, 10.9, 11.3)), () => txt('镜像引用', 180, 728, { size: 18, color: C.mute }))
      REF.forEach(([s, lab, col], i) => {
        const w = textW(s, size, { font: MONO }), a = E.out(P(t, 11.2 + i * .4, 11.6 + i * .4))
        withA(a, () => {
          ctx.save(); ctx.fillStyle = tint(col, .12); rr(x - 2, 746, w + 4, 46, 8); ctx.fill(); ctx.restore()
          txt(s, x, 779, { size, font: MONO, color: col, weight: 600 })
          line(x + 4, 804, x + w - 4, 804, hexA(col, .6), 2)
          txt(lab, x + w / 2, 836, { size: 19, color: col, align: 'center', weight: 600 })
        })
        if (i === 3) { if (t > 12.4) lock(x + w + 34, 768, 20, COL, 0) }
        x += w
      })
      withA(E.out(P(t, 13.4, 13.9)), () => {
        line(1300, 720, 1300, 840, C.hair, 1.5)
        const cw = chip(':latest', 1340, 768, { size: 24, col: C.red, align: 'left' })
        line(1350, 768, 1340 + cw - 10, 768, C.red, 3)
        txt('别用：会被悄悄覆盖', 1340 + cw + 28, 762, { size: 21, color: C.red })
        txt('出问题回滚不了', 1340 + cw + 28, 796, { size: 21, color: C.body })
      })
    }
  },
}

ANIM({
  id: 'containers',
  meta: { stage: 0, lesson: 2, of: 4, title: '容器基础：从进程到镜像', summary: 'Namespace、cgroup、镜像分层、容器运行时，写出第一个 Dockerfile。', next: '为什么需要 Kubernetes' },
  scenes: [
    lessonIntro({ tags: ['Namespace', 'cgroup', '镜像分层', 'CRI', 'Dockerfile'], vo: [[3.2, '容器，就是被隔离、被限制的进程。']] }),
    ns, cgroup, layers, runtime, multistage,
    lessonOutro({
      points: ['Namespace 隔离视图，cgroup 限制资源', '镜像 = 只读层叠加 + 容器可写层', 'kubelet → CRI → containerd → runc → 内核', '多阶段构建瘦身，生产固定版本或 digest'],
      vo: [[0.8, '小结：容器就是加了隔离和限制的进程。'], [5.6, '下一课，看看为什么需要 K8s。', '下一课，看看为什么需要 Kubernetes。']],
    }),
  ],
})
})()
