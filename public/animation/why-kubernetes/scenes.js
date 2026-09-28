/* 第 0 阶段 · 第 3 课：为什么需要 Kubernetes */
(() => {
const COL = STAGES[0].color
const circ = (x, y, r, fill) => { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
const ghost = (x, y, w, h, a = 1, r = 14) => withA(a, () => panel(x, y, w, h, { r, fill: 'rgba(0,0,0,0.015)', stroke: C.hairD, dash: [8, 8], shadow: false }))

// 场景 1：手工运维
const RUN = [
  { t: 1.0, cmd: 'ssh node1 docker run -d hello-app:v2' },
  { t: 2.4, cmd: 'ssh node2 docker run -d hello-app:v2' },
  { t: 3.8, cmd: 'ssh node3 docker run -d hello-app:v2' },
  { t: 6.2, out: '[03:17] node2 无响应，hello-app 已停止', color: C.red },
  { t: 7.4, out: '# 没有人去重启它 ……', color: C.mute },
  { t: 11.0, out: '# 扩容、发布、回滚：全靠手写脚本', color: C.mute },
]
const UP = [2.2, 3.6, 5.0], DOWN = 6.0
const PAIN = [['放置', '放哪台？', 1.4], ['故障恢复', '挂了谁重启？', 6.6], ['扩容', '忙时加几台？', 11.2], ['服务发现', 'IP 变了咋办？', 11.5], ['发布', '怎么不停机？', 11.8], ['配置', '散落在各台', 12.1], ['资源隔离', '谁抢了内存？', 12.4]]
const manual = {
  name: '手工运维', dur: 16, mood: 1,
  vo: [[0.6, '三台机器，靠 ssh 一台台 docker run。'],
    [5.6, '半夜一台宕机，容器没了，也没人管。'],
    [11.0, '放置、恢复、扩容、发布，全得自己扛。']],
  cues: [[0.4, 'whoosh'], ...typeCues(RUN, 30), ...UP.map(s => [s, 'pop']), [DOWN, 'error'], [DOWN + .2, 'poof'], [6.8, 'alarmSoft'], ...PAIN.slice(2).map(p => [p[2], 'tick'])],
  draw(t, T) {
    heading('手工运维：一台台 docker run', 140, 210, t, .2, { eyebrow: 'BEFORE K8S', color: COL })
    terminal(140, 270, 780, 310, t, RUN, { size: 20, alpha: E.out(P(t, .5, 1)) })
    ;[0, 1, 2].forEach(i => {
      const x = 960 + i * 280, a = E.out(P(t, .7 + i * .15, 1.2 + i * .15)); if (a <= 0) return
      const down = i === 1 && t >= DOWN
      const shake = down ? Math.sin(t * 70) * 6 * (1 - P(t, DOWN, DOWN + .5)) : 0
      node(x + shake, 270, 260, 310, `node${i + 1}`, { alpha: a, state: down ? 'down' : 'ok' })
      const up = E.back(P(t, UP[i], UP[i] + .5))
      if (!down && up > 0) withA(a * clamp(up), () => {
        cube(x + 130, 420, 40 * clamp(up), C.blue)
        txt('hello-app:v2', x + 130, 510, { size: 17, font: MONO, color: C.text, align: 'center' })
        chip('Running', x + 130, 548, { size: 16, col: C.green })
      })
      if (i === 1) {
        poof(x + 130, 420, P(t, DOWN, DOWN + .8), C.red)
        if (down) withA(E.out(P(t, DOWN + .3, DOWN + .8)), () => {
          cross(x + 130, 420, 56, C.red)
          txt('容器丢失', x + 130, 510, { size: 22, weight: 600, color: C.red, align: 'center' })
          txt('没人自动重启', x + 130, 548, { size: 18, color: C.mute, align: 'center' })
          chip('凌晨 03:17', x + 130, 336, { size: 18, col: C.red })
        })
        ring(x + 130, 420, P(t, DOWN, DOWN + 1), C.red, 150)
      }
    })
    // 痛点清单
    const pa = E.out(P(t, .8, 1.3))
    withA(pa, () => {
      panel(140, 620, 1640, 250, { r: 18 })
      txt('这些都得你自己解决', 176, 668, { size: 22, weight: 600, color: C.text })
      withA(E.out(P(t, 12.8, 13.4)), () => txt('K8s 把它们都自动化了', 1744, 668, { size: 22, weight: 600, color: COL, align: 'right' }))
    })
    const cw = 212, gap = 14
    PAIN.forEach(([n, q, t0], i) => {
      const x = 176 + i * (cw + gap), y = 700, on = E.out(P(t, t0, t0 + .4))
      const col = i === 1 ? C.red : C.amber
      withA(pa, () => {
        if (on < 1) ghost(x, y, cw, 140, 1 - on)
        if (on > 0) withA(on, () => {
          panel(x, y + lerp(12, 0, on), cw, 140, { r: 14, fill: tint(col, .07), stroke: hexA(col, .5), shadow: false })
          txt(n, x + cw / 2, y + 58 + lerp(12, 0, on), { size: 26, weight: 600, color: col, align: 'center' })
          txt(q, x + cw / 2, y + 104 + lerp(12, 0, on), { size: 20, color: C.body, align: 'center' })
        })
        else txt(n, x + cw / 2, y + 80, { size: 22, color: C.faint, align: 'center' })
      })
    })
  },
}

// 场景 2：命令式 vs 声明式
const STEPS = ['ssh node1 docker run …', 'ssh node2 docker run …', 'ssh node3 docker run …']
const YAML = ['apiVersion: apps/v1', 'kind: Deployment', 'metadata: {name: hello}', 'spec:', '  replicas: 3      # 期望状态', '  template:', '    spec:', '      containers:', '      - image: nginx:1.29']
const GAIN = [['幂等', 'apply 十次 = apply 一次', 11.0], ['可版本化', '进 Git：评审、回滚、GitOps', 11.6], ['自愈', '实际偏离期望，自动拉回', 12.2]]
const declarative = {
  name: '命令式 vs 声明式', dur: 16, mood: 2,
  vo: [[0.6, '命令式一步步下指令，执行完就结束。'],
    [5.6, '声明式只写结果：我要 3 个副本。', '声明式只写结果：我要三个副本。'],
    [11.0, '重复提交也安全，能进 Git，还能自愈。']],
  cues: [[0.4, 'whoosh'], ...STEPS.map((_, i) => [1.4 + i * .6, 'tick']), [3.4, 'thud'], [5.6, 'whoosh'], ...YAML.map((_, i) => [5.8 + i * .12, 'key']), [6.8, 'ding2'], ...GAIN.map(g => [g[2], 'pop']), [13.8, 'ok']],
  draw(t, T) {
    heading('命令式 vs 声明式', 140, 210, t, .2, { eyebrow: 'IMPERATIVE vs DECLARATIVE', color: COL })
    // 命令式
    const la = E.out(P(t, .5, 1)), ld = t > 5.6 ? lerp(1, .6, E.out(P(t, 5.6, 6.2))) : 1
    withA(la * ld, () => {
      panel(140, 280, 780, 400, { r: 18 })
      chip('命令式 · 告诉它怎么做', 176, 330, { size: 22, font: SANS, col: C.amber, align: 'left', pad: 16 })
      STEPS.forEach((s, i) => {
        const a = E.out(P(t, 1.0 + i * .6, 1.4 + i * .6)); if (a <= 0) return
        const y = 400 + i * 62
        withA(a, () => {
          circ(196, y - 7, 18, tint(C.amber, .16))
          txt(String(i + 1), 196, y + 1, { size: 20, weight: 700, font: MONO, color: C.amber, align: 'center' })
          txt(s, 232, y + 1, { size: 22, font: MONO, color: C.text })
          check(860, y - 7, 24, C.green, P(t, 1.4 + i * .6, 1.8 + i * .6))
        })
      })
      withA(E.out(P(t, 3.4, 3.9)), () => {
        line(176, 576, 884, 576, C.hair, 1)
        txt('执行完就结束', 176, 626, { size: 28, weight: 600, color: C.text })
        txt('之后状态再变，它一概不知', 400, 626, { size: 22, color: C.mute })
      })
    })
    // 声明式
    const ya = E.out(P(t, 5.4, 5.9))
    if (ya < 1) ghost(980, 280, 800, 396, 1 - ya)
    code(980, 280, 800, YAML, t, 5.8, { title: 'hello.yaml', size: 22, lh: 34, hi: t > 6.8 ? [4] : [], hiColor: COL, alpha: ya })
    withA(ya, () => chip('声明式 · 告诉它要什么', 1752, 308, { size: 20, font: SANS, col: COL, align: 'right', solid: t > 6.8 && t < 11 }))
    if (t > 6.8 && t < 11) ring(1380, 505, P(t, 6.8, 7.8), COL, 90)
    withA(E.out(P(t, 8.4, 9)), () => {
      chip('spec：你写下的期望', 1752, 578, { size: 18, col: COL, align: 'right' })
      chip('status：集群的实际', 1752, 624, { size: 18, col: C.blue, align: 'right' })
    })
    // 三个好处
    const cw = 526, ga = E.out(P(t, .8, 1.3))
    GAIN.forEach(([n, d, t0], i) => {
      const x = 140 + i * (cw + 31), y = 720, on = E.out(P(t, t0, t0 + .5))
      if (on < 1) ghost(x, y, cw, 150, ga * (1 - on), 16)
      if (on <= 0) { withA(ga, () => txt(n, x + 28, y + 88, { size: 26, color: C.faint })); return }
      withA(on, () => {
        panel(x, y + lerp(16, 0, on), cw, 150, { r: 16, stroke: hexA(COL, .45), fill: tint(COL, .04) })
        const oy = lerp(16, 0, on)
        txt(n, x + 28, y + 58 + oy, { size: 28, weight: 600, color: COL })
        txt(d, x + 28, y + 108 + oy, { size: 20, color: C.body })
        const vx = x + cw - 90, vy = y + 62 + oy
        if (i === 0) {
          const k = Math.max(1, countUp(10, t, t0 + .3, t0 + 2.6))
          chip(`apply ×${k}`, vx, vy - 18, { size: 16, col: C.mute })
          ;[-38, 0, 38].forEach(dx => pod(vx + dx, vy + 34, 34, { state: 'run' }))
        } else if (i === 1) {
          line(vx - 50, vy + 6, vx + 50, vy + 6, C.hairD, 3)
          ;[-50, 0, 50].forEach((dx, k) => { const p = E.back(P(t, t0 + .4 + k * .3, t0 + .7 + k * .3)); if (p > 0) { circ(vx + dx, vy + 6, 11 * clamp(p), '#fff'); ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(vx + dx, vy + 6, 11 * clamp(p), 0, Math.PI * 2); ctx.stroke(); ctx.restore() } })
          txt('main', vx + 50, vy + 44, { size: 16, font: MONO, color: C.violet, align: 'center' })
        } else {
          const bad = t > t0 + .6 && t < t0 + 1.6
          pod(vx, vy + 8, 60, { state: bad ? 'fail' : 'run' })
          if (t > t0 + 1.6) ring(vx, vy + 8, P(t, t0 + 1.6, t0 + 2.4), C.green, 70)
        }
      })
    })
  },
}

// 场景 3：控制循环
const LC = [540, 570], LR = 210
const STG = [['① 观察', 'watch', -90], ['② 比较', 'diff', 30], ['③ 行动', 'act', 150]]
const DEL = 7.1, NEW = 11.4, READY = 13.2
const KT = [
  { t: 5.6, cmd: 'kubectl delete pod hello-6d4b8f9c7b-m2rld' },
  { t: 11.0, cmd: 'kubectl get pods' },
  { t: 11.9, out: 'hello-6d4b8f9c7b-2xkqp   1/1   Running             3m', color: C.green },
  { t: 12.0, out: 'hello-6d4b8f9c7b-7hz9w   1/1   Running             3m', color: C.green },
  { t: 12.1, out: 'hello-6d4b8f9c7b-vn4tc   0/1   ContainerCreating   2s', color: C.amber },
]
const loop = {
  name: '控制循环', dur: 17, mood: 3,
  vo: [[0.6, '控制器不停循环：观察、比较、再行动。'],
    [5.6, '删掉一个 Pod，实际 2 个，少于期望 3 个。', '删掉一个 Pod，实际两个，少于期望三个。'],
    [11.0, '它马上补建一个，这个过程叫调谐。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [1.6, 'pop'], ...typeCues(KT, 30), [DEL, 'poof'], [7.6, 'alarmSoft'], [NEW, 'pop'], [READY, 'ok'], [13.6, 'chime']],
  draw(t, T) {
    heading('控制循环：观察 → 比较 → 行动', 140, 210, t, .2, { eyebrow: 'CONTROL LOOP', color: COL })
    const la = E.out(P(t, .5, 1))
    // 环
    withA(la, () => {
      ctx.save(); ctx.strokeStyle = hexA(COL, .3); ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(LC[0], LC[1], LR, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      STG.forEach(([, , deg]) => { const a = (deg + 60) * Math.PI / 180; arrowHead(LC[0] + Math.cos(a) * LR, LC[1] + Math.sin(a) * LR, a + Math.PI / 2, hexA(COL, .6), 14) })
    })
    const ang = t > 1.8 ? (-90 + (t - 1.8) * 120) : -90
    const pos = ((ang + 90) % 360 + 360) % 360
    if (t > 1.8) { const r = ang * Math.PI / 180; dot(LC[0] + Math.cos(r) * LR, LC[1] + Math.sin(r) * LR, 10, COL, 18) }
    STG.forEach(([n, s, deg], i) => {
      const a = E.back(P(t, 1.0 + i * .3, 1.5 + i * .3)); if (a <= 0) return
      const r = deg * Math.PI / 180, x = LC[0] + Math.cos(r) * LR, y = LC[1] + Math.sin(r) * LR
      const d = Math.abs(((pos - i * 120) % 360 + 540) % 360 - 180)
      const hot = t > 1.8 && d < 30
      withA(clamp(a), () => box(x, y, 220, 88, n, s, i === 2 && t > NEW - .4 && t < READY ? C.amber : COL, { hi: hot, size: 26 }))
    })
    // 中心状态
    const st = t < DEL + .2 ? 0 : t < NEW ? 1 : t < READY + .2 ? 2 : 3
    const ct = [['期望 3 = 实际 3', '一致，无事可做', C.green], ['期望 3 ≠ 实际 2', '发现偏差', C.red], ['创建 1 个 Pod', '拉回期望状态', C.amber], ['调谐 Reconcile', '持续进行，永不停止', COL]][st]
    const ts = [1.8, DEL + .2, NEW, READY + .2][st]
    withA(E.out(P(t, ts, ts + .4)) * la, () => {
      txt(ct[0], LC[0], LC[1] + 8, { size: st === 3 ? 30 : 26, weight: 600, color: ct[2], align: 'center' })
      txt(ct[1], LC[0], LC[1] + 44, { size: 18, color: C.mute, align: 'center' })
    })
    withA(E.out(P(t, 14.0, 14.6)), () => chip('类比恒温器：设定 26°C，偏离了就自动调', LC[0], 846, { size: 20, font: SANS, col: C.body, pad: 16 }))
    // 右侧：Deployment 状态
    const ra = E.out(P(t, .6, 1.1))
    withA(ra, () => {
      panel(1000, 280, 780, 340, { r: 18 })
      txt('Deployment/hello', 1030, 324, { size: 20, font: MONO, color: C.text })
      line(1000, 346, 1780, 346, C.hair, 1)
      txt('期望  spec.replicas', 1030, 392, { size: 20, font: MONO, color: C.body })
      txt('3', 1748, 394, { size: 30, weight: 700, font: MONO, color: COL, align: 'right' })
      const n = t < DEL ? 3 : t < READY ? 2 : 3
      txt('实际  status.readyReplicas', 1030, 436, { size: 20, font: MONO, color: C.body })
      txt(String(n), 1748, 438, { size: 30, weight: 700, font: MONO, color: n < 3 ? C.red : C.green, align: 'right' })
    })
    const PODS = [['2xkqp', 1190], ['m2rld', 1390], ['7hz9w', 1590]]
    PODS.forEach(([s, x], i) => {
      const a = ra * E.back(P(t, 1.0 + i * .2, 1.4 + i * .2))
      if (i === 1) {
        if (t < DEL) pod(x, 520, 100, { state: 'run', label: s, alpha: ra, shake: t > DEL - .5 ? Math.sin(t * 60) * 4 : 0 })
        poof(x, 520, P(t, DEL, DEL + .8), C.red)
        if (t >= DEL && t < NEW) withA(E.out(P(t, DEL + .3, DEL + .8)), () => { ctx.save(); ctx.strokeStyle = hexA(C.red, .6); ctx.lineWidth = 2.5; ctx.setLineDash([8, 7]); hexPath(x, 520, 50); ctx.stroke(); ctx.restore(); txt('缺 1 个', x, 597, { size: 18, color: C.red, align: 'center' }) })
        if (t >= NEW) { const k = E.back(P(t, NEW, NEW + .5)); pod(x, 520, 100, { state: t < READY ? 'pending' : 'run', label: 'vn4tc', scale: clamp(k) }); ring(x, 520, P(t, READY, READY + 1), C.green, 110) }
      } else pod(x, 520, 100, { state: 'run', label: s, alpha: clamp(a) })
    })
    terminal(1000, 640, 780, 230, t, KT, { size: 19, alpha: E.out(P(t, 5.2, 5.6)) })
    if (t < 5.6) ghost(1000, 640, 780, 230, ra * (1 - P(t, 5.2, 5.6)))
  },
}

// 场景 4：架构全景
const API = [780, 415]
const WN = i => 140 + i * 560
const arch = {
  name: '架构全景', dur: 17, mood: 2,
  vo: [[0.6, '控制平面负责决策，apiserver 是唯一入口；'],
    [5.6, 'etcd 存状态，调度器和控制器各司其职。'],
    [11.0, '工作节点上，kubelet 调 containerd 跑 Pod。']],
  cues: [[0.4, 'whoosh'], [1.2, 'impact'], [2.4, 'tick'], [5.6, 'pop'], [6.6, 'pop'], [7.4, 'pop'], [8.2, 'pop'], [11.0, 'whoosh'], [11.3, 'pop'], [11.6, 'pop'], [11.9, 'pop'], [12.6, 'zap'], [14.0, 'tick'], [14.3, 'tick'], [14.6, 'tick']],
  draw(t, T) {
    heading('K8s 架构全景', 140, 210, t, .2, { eyebrow: 'ARCHITECTURE', color: COL })
    // 插件
    { let x = 1780; ['metrics-server', 'CNI', 'CoreDNS'].forEach((n, i) => { const w = chip(n, x, 200, { size: 18, col: C.violet, align: 'right', alpha: E.out(P(t, 14.0 + (2 - i) * .3, 14.4 + (2 - i) * .3)) }); x -= (w || textW(n, 18, { font: MONO }) + 24) + 12 })
      withA(E.out(P(t, 14.0, 14.4)), () => txt('插件', x - 4, 207, { size: 20, color: C.mute, align: 'right' })) }
    // 控制平面
    const ca = E.out(P(t, .5, 1))
    withA(ca, () => {
      panel(140, 280, 1640, 270, { r: 20, fill: tint(COL, .03), stroke: hexA(COL, .4), shadow: false })
      chip('控制平面 Control Plane', 172, 280, { size: 18, font: SANS, col: COL, solid: true, align: 'left' })
    })
    // 占位
    withA(ca * (1 - P(t, 5.4, 5.8)), () => { ghost(245, 350, 130, 130); txt('etcd', 310, 424, { size: 20, font: MONO, color: C.faint, align: 'center' }) })
    ;[[1080, 322, 330, 76, 6.4], [1080, 432, 330, 76, 7.2], [1480, 360, 270, 110, 8.0]].forEach(([x, y, w, h, t0]) => ghost(x, y, w, h, ca * (1 - P(t, t0, t0 + .4))))
    // 连线
    const la = E.out(P(t, 5.8, 6.3))
    withA(la, () => { line(420, 415, API[0] - 162, 415, hexA(COL, .5), 2.5); arrowHead(API[0] - 162, 415, 0, hexA(COL, .6), 12); arrowHead(420, 415, Math.PI, hexA(COL, .6), 12) })
    ;[[360, 6.8], [470, 7.6]].forEach(([y, t0]) => {
      const p = E.out(P(t, t0, t0 + .5)); if (p <= 0) return
      partialLine(1080, y, API[0] + 160, lerp(y, 415, .7), p, hexA(COL, .5), 2.5, [7, 6])
    })
    withA(E.out(P(t, 7.0, 7.5)), () => txt('watch', 1010, 424, { size: 17, font: MONO, color: C.mute, align: 'center' }))
    // 组件
    box(API[0], API[1], 320, 110, 'kube-apiserver', '唯一入口 · REST', COL, { alpha: E.out(P(t, 1.2, 1.7)), hi: t < 5.6 || t > 14.6, size: 28 })
    ring(API[0], API[1], P(t, 1.2, 2.2), COL, 220)
    cylinder(310, 400, 130, 90, C.blue, 'etcd', E.out(P(t, 5.6, 6.1)))
    withA(E.out(P(t, 6.0, 6.5)), () => txt('集群状态 · 唯一数据源', 310, 520, { size: 16, color: C.mute, align: 'center' }))
    box(1245, 360, 330, 80, 'kube-scheduler', '给 Pod 选节点', C.blue, { alpha: E.out(P(t, 6.6, 7.1)), size: 24 })
    box(1245, 470, 330, 80, 'controller-manager', '维持期望状态', C.blue, { alpha: E.out(P(t, 7.4, 7.9)), size: 24 })
    withA(E.out(P(t, 8.2, 8.7)), () => {
      panel(1480, 360, 270, 110, { r: 14, fill: '#fff', stroke: C.hairD, dash: [7, 6], shadow: false })
      txt('cloud-controller-manager', 1615, 404, { size: 17, font: MONO, align: 'center', color: C.body })
      txt('可选 · 对接云厂商', 1615, 440, { size: 17, align: 'center', color: C.mute })
    })
    // 工作节点
    ;[0, 1, 2].forEach(i => {
      const x = WN(i), a = E.out(P(t, 11.0 + i * .3, 11.5 + i * .3))
      if (a < 1) ghost(x, 600, 520, 270, (1 - a) * E.out(P(t, .8, 1.3)))
      if (a < 1) withA((1 - a) * E.out(P(t, .8, 1.3)), () => txt(`工作节点 node-${i + 1}`, x + 260, 745, { size: 22, color: C.faint, align: 'center' }))
      if (a <= 0) return
      node(x, 600 + lerp(16, 0, a), 520, 270, `node-${i + 1}`, { alpha: a, tag: '工作节点', accent: COL })
      ;[['kubelet', COL], ['kube-proxy', C.blue], ['containerd', C.violet]].forEach(([n, c], k) => chip(n, x + 30, 690 + k * 58, { size: 20, col: c, align: 'left', alpha: E.out(P(t, 11.8 + i * .2 + k * .15, 12.2 + i * .2 + k * .15)) }))
      ;[[380, 710], [460, 710], [420, 790]].forEach(([dx, dy], k) => { if (i === 2 && k === 2) return; const p = E.back(P(t, 12.6 + i * .2 + k * .15, 13.0 + i * .2 + k * .15)); pod(x + dx, dy, 64, { state: 'run', scale: clamp(p) }) })
      // kubelet ↔ apiserver
      const p = E.out(P(t, 12.0 + i * .2, 12.5 + i * .2))
      if (p > 0) {
        const kx = x + 34 + textW('kubelet', 20, { font: MONO }) + 30
        partialLine(kx - 10, 690, kx, 690, clamp(p * 4), hexA(COL, .45), 2.5)
        partialLine(kx, 690, kx, 575, clamp(p * 1.2 - .2), hexA(COL, .45), 2.5)
        if (p >= 1) flow(kx, 690, kx, 575, t, COL, 2, .5, i * .3, 4)
      }
    })
    { const p = E.out(P(t, 12.4, 13.0))
      if (p > 0) {
        const kx = textW('kubelet', 20, { font: MONO }) + 64
        partialLine(API[0], 575, WN(0) + kx, 575, p, hexA(COL, .45), 2.5); partialLine(API[0], 575, WN(2) + kx, 575, p, hexA(COL, .45), 2.5)
        partialLine(API[0], 575, API[0], 470, p, hexA(COL, .45), 2.5)
        if (p >= 1) flow(API[0], 575, API[0], 470, t, COL, 2, .6, 0, 4)
        chip('kubelet ↔ apiserver', 1120, 575, { size: 16, col: COL, alpha: E.out(P(t, 12.8, 13.3)) })
      } }
  },
}

// 场景 5：一次 apply 的全过程
const HUB = [700, 575]
const SP = { kubectl: [290, 360], cm: [700, 340], sch: [1110, 360], etcd: [260, 740], node: [1060, 785] }
const edgeOf = k => { const [x, y] = SP[k], dx = x - HUB[0], dy = y - HUB[1], L = Math.hypot(dx, dy); return [HUB[0] + dx / L * 90, HUB[1] + dy / L * 70, x - dx / L * 80, y - dy / L * 60] }
const FL = [ // [spoke, dir(1=向外 -1=向内), t0, t1, step]
  ['kubectl', -1, 1.0, 1.6, 0], ['etcd', 1, 1.7, 2.3, 0],
  ['cm', 1, 4.8, 5.2, 1], ['cm', -1, 5.3, 5.7, 1], ['etcd', 1, 5.8, 6.1, 1],
  ['cm', 1, 6.4, 6.8, 2], ['cm', -1, 6.9, 7.3, 2], ['etcd', 1, 7.4, 7.7, 2],
  ['sch', 1, 8.0, 8.4, 3], ['sch', -1, 8.5, 8.9, 3], ['etcd', 1, 9.0, 9.3, 3],
  ['node', 1, 9.6, 10.1, 4],
  ['node', -1, 11.6, 12.1, 5], ['etcd', 1, 12.2, 12.5, 5],
]
const ST = [['kubectl apply', '校验后写入 etcd', 1.0], ['Deployment 控制器', '创建 ReplicaSet', 4.8], ['ReplicaSet 控制器', '创建 3 个 Pod 对象', 6.4], ['scheduler', '选节点，写入 nodeName', 8.0], ['kubelet', '调 containerd 启动容器', 9.6], ['kubelet', '上报 status：Running', 11.6]]
const FIN = 13.0
const apply = {
  name: '一次 apply', dur: 16, mood: 3,
  vo: [[0.6, 'apply 之后，apiserver 先把它写进 etcd。'],
    [4.8, '控制器层层创建，调度器给 Pod 选节点，'],
    [9.4, 'kubelet 拉起容器，再上报状态。'],
    [12.9, '所有组件只和 apiserver 通信。']],
  cues: [[0.4, 'whoosh'], ...ST.map(s => [s[2], 'tick']), ...FL.filter(f => f[1] < 0).map(f => [f[3], 'pop']), [10.3, 'pop'], [11.2, 'ok'], [FIN, 'chime']],
  draw(t, T) {
    heading('一次 apply 背后发生了什么', 140, 210, t, .2, { eyebrow: 'WATCH-DRIVEN', color: COL })
    withA(E.out(P(t, FIN, FIN + .5)), () => chip('组件互不直连 · 都 watch apiserver', 1780, 200, { size: 20, font: SANS, col: COL, solid: true, align: 'right', pad: 16 }))
    const cur = ST.filter(s => t >= s[2]).length - 1, fin = t >= FIN
    // 辐条
    const sa = E.out(P(t, .5, 1))
    Object.keys(SP).forEach(k => {
      const [x1, y1, x2, y2] = edgeOf(k)
      const act = FL.some(f => f[0] === k && t >= f[2] - .1 && t <= f[3] + .2)
      withA(sa, () => line(x1, y1, x2, y2, act || fin ? hexA(COL, .6) : C.hairD, act ? 3 : 2))
      if (fin) flow(x1, y1, x2, y2, t, COL, 3, .6, k.length * .13, 4)
    })
    FL.forEach(([k, d, a, b]) => { const [x1, y1, x2, y2] = edgeOf(k); const p = P(t, a, b); d > 0 ? travel(x1, y1, x2, y2, p, COL) : travel(x2, y2, x1, y1, p, COL) })
    // 节点
    box(HUB[0], HUB[1], 300, 110, 'kube-apiserver', 'REST · watch', COL, { alpha: E.out(P(t, .5, 1)), hi: true, size: 28 })
    box(SP.kubectl[0], SP.kubectl[1], 220, 84, 'kubectl', 'apply -f', C.body, { alpha: E.out(P(t, .6, 1.1)), hi: cur === 0 && !fin, size: 26 })
    box(SP.cm[0], SP.cm[1], 330, 84, 'controller-manager', cur === 2 ? 'ReplicaSet 控制器' : 'Deployment 控制器', C.blue, { alpha: E.out(P(t, .7, 1.2)), hi: (cur === 1 || cur === 2) && !fin, size: 24 })
    box(SP.sch[0], SP.sch[1], 240, 84, 'scheduler', '选节点', C.blue, { alpha: E.out(P(t, .8, 1.3)), hi: cur === 3 && !fin, size: 26 })
    cylinder(SP.etcd[0], SP.etcd[1] - 20, 110, 70, C.blue, null, E.out(P(t, .9, 1.4)))
    withA(E.out(P(t, .9, 1.4)), () => txt('etcd', SP.etcd[0], SP.etcd[1] + 66, { size: 20, font: MONO, align: 'center' }))
    // etcd 里的对象
    const objs = [['Deployment/hello', 2.3], ['ReplicaSet/hello-6d4b…', 6.1], [t < 9.3 ? 'Pod ×3 · 未调度' : t < 12.5 ? 'Pod ×3 → node-1' : 'Pod ×3 · Running', 7.7]]
    objs.forEach(([s, t0], i) => chip(s, 350, 772 + i * 42, { size: 16, align: 'left', col: i === 2 && t > 12.5 ? C.green : C.body, alpha: E.out(P(t, t0, t0 + .4)) }))
    // 工作节点
    const na = E.out(P(t, 1.0, 1.5))
    const [nx, ny] = SP.node
    withA(na, () => {
      node(nx - 200, ny - 80, 400, 160, 'node-1', {})
      chip('kubelet', nx - 176, ny, { size: 18, col: COL, align: 'left', solid: (cur === 4 || cur === 5) && !fin })
      chip('containerd', nx - 176, ny + 46, { size: 18, col: C.violet, align: 'left' })
    })
    ;[0, 1, 2].forEach(k => { const p = E.back(P(t, 10.2 + k * .2, 10.6 + k * .2)); pod(nx + 36 + k * 62, ny + 24, 52, { state: t < 11.2 ? 'pending' : 'run', scale: clamp(p) }) })
    if (t > 11.2) ring(nx + 98, ny + 24, P(t, 11.2, 12), C.green, 110)
    // 步骤清单
    withA(E.out(P(t, .6, 1.1)), () => panel(1300, 280, 480, 590, { r: 18 }))
    ST.forEach(([n, s, t0], i) => {
      const a = E.out(P(t, t0 - .2, t0 + .3)), y = 298 + i * 94, on = i === cur && !fin
      withA(E.out(P(t, .6, 1.1)), () => {
        if (a <= 0) { txt(String(i + 1), 1350, y + 54, { size: 22, font: MONO, color: C.faint, align: 'center' }); return }
        withA(a, () => {
          ctx.save(); ctx.fillStyle = on ? tint(COL, .12) : 'rgba(0,0,0,0.025)'; rr(1318, y, 444, 82, 12); ctx.fill(); ctx.restore()
          circ(1350, y + 41, 18, on ? COL : tint(COL, .16))
          txt(String(i + 1), 1350, y + 49, { size: 20, weight: 700, font: MONO, color: on ? '#fff' : COL, align: 'center' })
          txt(n, 1386, y + 34, { size: 22, weight: 600, font: i === 0 || i >= 3 ? MONO : SANS, color: on ? COL : C.text })
          txt(s, 1386, y + 66, { size: 18, color: C.body })
        })
      })
    })
  },
}

ANIM({
  id: 'why-kubernetes',
  meta: { stage: 0, lesson: 3, of: 4, title: '为什么需要 Kubernetes', summary: '从单机容器到集群编排：声明式、控制循环与 K8s 架构全景。', next: '搭建本地实验集群' },
  scenes: [
    lessonIntro({ tags: ['声明式 API', '控制循环', '调谐', '架构全景', 'apiserver'], vo: [[3.2, '告诉它你想要什么，它负责一直做到。']] }),
    manual, declarative, loop, arch, apply,
    lessonOutro({
      points: ['命令式执行完就结束，声明式持续维持', '控制循环：观察 → 比较 → 行动', '控制平面做决策，工作节点跑容器', '所有组件只和 apiserver 通信'],
      vo: [[0.8, '小结：声明期望，交给控制循环。'], [5.6, '下一课，在本机搭一个实验集群。']],
    }),
  ],
})
})()
