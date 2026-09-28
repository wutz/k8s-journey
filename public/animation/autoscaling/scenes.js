/* 第 3 阶段 · 第 5 课：自动扩缩容 */
(() => {
const COL = STAGES[3].color

// 竖向用量柱（x,y 为左上角，frac 0..1）
function vbar(x, y, w, h, frac, color, a = 1) {
  withA(a, () => {
    ctx.save(); rr(x, y, w, h, 10); ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill()
    const fh = h * clamp(frac); if (fh > 0) { rr(x, y + h - fh, w, fh, 10); ctx.fillStyle = tint(color, .55); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke() }
    ctx.restore()
  })
}

// 场景 1：三层扩缩
const layers = {
  name: '三层扩缩', dur: 16, mood: 1,
  vo: [[0.6, '扩缩分三层：HPA 改副本数，VPA 改资源请求。'],
    [5.8, '节点不够了，再由 CA 或 Karpenter 加机器。', '节点不够了，再由 Cluster Autoscaler 或 Karpenter 加机器。'],
    [11.0, 'VPA 建议先用 Off 模式，别和 HPA 抢同一指标。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [2.0, 'pop'], [2.7, 'pop'], [3.4, 'pop'], [3.2, 'pop'], [4.0, 'shimmer'], [6.0, 'pop'], [6.6, 'alarmSoft'], [8.0, 'thud'], [8.8, 'whoosh'], [9.6, 'ok'], [11.2, 'pop'], [12.4, 'error']],
  draw(t, T) {
    heading('三层扩缩：副本、资源、节点', 140, 210, t, .2, { eyebrow: 'THREE LAYERS', color: COL })
    const cols = [['HPA', '横向 · 改副本数', 140, 1.0], ['VPA', '纵向 · 改 requests', 700, 3.2], ['CA / Karpenter', '节点 · 改节点数', 1260, 6.0]]
    cols.forEach(([n, s, x, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 280 + lerp(20, 0, a), 520, 440, { r: 18 })
        chip(n, x + 28, 322, { size: 22, align: 'left', col: COL, solid: true })
        txt(s, x + 28, 380, { size: 22, color: C.body })
      })
    })
    // HPA：副本 2 → 5
    if (t > 1.0) {
      const n = 2 + Math.floor(clamp(P(t, 2.0, 3.8)) * 3.01)
      for (let k = 0; k < 5; k++) {
        const born = k < 2 ? 1.2 : 2.0 + (k - 2) * .7
        const s = E.back(P(t, born, born + .4))
        pod(210 + k * 95, 530, 76, { state: 'run', scale: s, alpha: clamp(s) })
      }
      withA(E.out(P(t, 1.2, 1.7)), () => {
        txt('replicas', 168, 648, { size: 20, font: MONO, color: C.mute })
        txt(String(n), 290, 650, { size: 30, font: MONO, weight: 700, color: COL })
        txt('按 CPU / 内存 / 自定义指标', 168, 692, { size: 18, color: C.mute })
      })
    }
    // VPA：requests 变大
    if (t > 3.2) {
      const g = E.inOut(P(t, 4.0, 5.2))
      pod(860, 530, lerp(90, 130, g), { state: 'run', alpha: E.out(P(t, 3.3, 3.7)) })
      withA(E.out(P(t, 3.5, 4)), () => {
        meter(980, 500, 190, 16, lerp(.3, .75, g), COL, { label: 'cpu', value: `${Math.round(lerp(200, 500, g))}m`, size: 18 })
        meter(980, 580, 190, 16, lerp(.35, .6, g), C.teal, { label: '内存', value: `${Math.round(lerp(256, 448, g))}Mi`, size: 18 })
        txt('Recommender 根据历史用量给出建议', 728, 692, { size: 18, color: C.mute })
      })
    }
    // CA：Pending → 新节点
    if (t > 6.0) {
      const nodeA = E.out(P(t, 6.0, 6.5))
      ;[0, 1].forEach(k => {
        node(1284 + k * 162, 420, 150, 180, `node-${k + 1}`, { alpha: nodeA })
        ;[0, 1].forEach(j => pod(1328 + k * 162 + j * 62, 520, 50, { state: 'run', alpha: nodeA }))
      })
      const nA = E.out(P(t, 8.0, 8.5))
      withA(nodeA * (1 - nA), () => { panel(1608, 420, 150, 180, { r: 14, dash: [8, 7], shadow: false, fill: 'rgba(255,255,255,0.4)' }) })
      node(1608, 420 + lerp(-30, 0, nA), 150, 180, 'node-3', { alpha: nA, accent: C.green })
      ring(1683, 510, P(t, 8.0, 9.0), C.green, 120)
      chip('+1 节点', 1683, 650, { size: 18, col: C.green, alpha: E.out(P(t, 9.6, 10.0)) })
      const mv = E.inOut(P(t, 8.8, 9.6))
      const px = 1683, py = lerp(670, 520, mv)
      pod(px, py, 50, { state: t < 9.6 ? 'pending' : 'run', alpha: E.out(P(t, 6.6, 7)), shake: t < 8 ? Math.sin(T * 30) * 2 : 0 })
      withA(E.out(P(t, 6.6, 7)) * (1 - P(t, 8.8, 9.2)), () => txt('Pending：资源不足', 1600, 678, { size: 18, color: C.amber, align: 'right' }))
    }
    // 底部提醒
    const bA = E.out(P(t, 11.0, 11.5))
    withA(bA, () => {
      panel(140, 752, 1640, 118, { r: 16, fill: tint(COL, .04), stroke: hexA(COL, .35), shadow: false })
      chip('VPA updateMode: Off', 170, 811, { size: 20, align: 'left', col: COL })
      txt('只出建议，不动 Pod，最安全', 440, 818, { size: 22, color: C.text })
    })
    withA(E.out(P(t, 12.2, 12.7)), () => {
      chip('HPA', 1060, 811, { size: 20, col: COL }); txt('+', 1112, 819, { size: 26, color: C.mute, align: 'center' }); chip('VPA', 1164, 811, { size: 20, col: C.teal })
      txt('同时盯 CPU / 内存 → 互相打架', 1216, 818, { size: 22, color: C.red })
      cross(1112, 811, 34, hexA(C.red, .8), E.out(P(t, 12.4, 12.8)))
    })
  },
}

// 场景 2：metrics-server
const TOP = [
  { t: 8.0, cmd: 'kubectl top pod' },
  { t: 9.0, out: 'NAME                     CPU(cores)   MEMORY(bytes)', color: C.mute },
  { t: 9.3, out: 'php-apache-7d9f8c-x2kqp  248m         12Mi', color: C.text },
]
const metrics = {
  name: 'metrics-server', dur: 15, mood: 2,
  vo: [[0.6, 'metrics-server 定时从各节点 kubelet 抓取资源用量，', 'metrics server 定时从各节点 kubelet 抓取资源用量，'],
    [5.8, '再经 API 聚合层，交给 HPA 和 kubectl top。'],
    [10.8, '它只在内存里存最新一个样本，不是监控系统。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [1.6, 'pop'], [2.4, 'pop'], [3.0, 'zap'], [3.6, 'tick'], [5.0, 'pop'], [5.6, 'zap'], [6.4, 'pop'], [6.8, 'pop'], ...typeCues(TOP, 30), [11.0, 'tick']],
  draw(t, T) {
    heading('metrics-server：扩缩容的数据来源', 140, 210, t, .2, { eyebrow: 'RESOURCE METRICS', color: COL })
    // kubelets
    ;[0, 1, 2].forEach(k => box(270, 330 + k * 120, 260, 92, `kubelet · node-${k + 1}`, '/metrics/resource', C.blue, { alpha: E.out(P(t, 1.0 + k * .3, 1.5 + k * .3)), size: 25 }))
    // metrics-server
    const mA = E.out(P(t, 2.4, 2.9))
    box(720, 450, 300, 180, '', '', COL, { alpha: mA, hi: t > 3 && t < 5 })
    withA(mA, () => {
      txt('metrics-server', 720, 402, { size: 24, weight: 600, align: 'center' })
      ctx.save(); ctx.fillStyle = tint(COL, .08); rr(600, 424, 240, 60, 10); ctx.fill(); ctx.restore()
      const v = 180 + Math.round(60 * Math.sin(Math.floor(T / 1.2) * 1.7))
      txt('最新样本', 622, 461, { size: 18, color: C.mute })
      txt(`${v}m`, 818, 462, { size: 22, font: MONO, weight: 600, color: COL, align: 'right' })
      txt('只在内存中', 720, 516, { size: 17, color: C.mute, align: 'center' })
    })
    withA(E.out(P(t, 3.0, 3.5)), () => [0, 1, 2].forEach(k => line(400, 330 + k * 120, 570, 450, hexA(C.blue, .25), 2, [6, 6])))
    if (t > 3.0) [0, 1, 2].forEach(k => flow(400, 330 + k * 120, 570, 450, t + k * .3, C.blue, 3, .7, 0, 5))
    chip('每 15 秒抓一次', 485, 290, { size: 18, col: C.blue, alpha: E.out(P(t, 3.6, 4.0)) })
    // apiserver
    const aA = E.out(P(t, 5.0, 5.5))
    box(1180, 450, 320, 130, 'kube-apiserver', 'metrics.k8s.io · 聚合层', C.blue, { alpha: aA, size: 25 })
    withA(aA, () => arrow(870, 450, 1020, 450, E.out(P(t, 5.0, 5.6)), hexA(C.text, .3), 2.5))
    if (t > 5.6) flow(870, 450, 1016, 450, t, COL, 3, .8, 0, 5)
    // consumers
    ;[['HPA 控制器', '按指标算副本数', 360, 6.4], ['kubectl top', '看 Pod / 节点用量', 540, 6.8]].forEach(([n, s, y, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      box(1590, y, 340, 110, n, s, COL, { alpha: a, size: 25 })
      withA(a, () => arrow(1340, 450, 1416, y, E.out(P(t, t0, t0 + .5)), hexA(C.text, .3), 2.5))
      if (t > t0 + .5) flow(1340, 450, 1416, y, t, COL, 2, .8, 0, 4)
    })
    terminal(140, 640, 1000, 220, t, TOP, { size: 20, alpha: E.out(P(t, 7.6, 8.0)) })
    withA(E.out(P(t, 11.0, 11.5)), () => {
      panel(1200, 640, 580, 220, { r: 16, fill: tint(C.amber, .06), stroke: hexA(C.amber, .45) })
      txt('不是监控系统', 1230, 696, { size: 24, weight: 600, color: C.text })
      txt('不存历史、不做告警', 1230, 752, { size: 21, color: C.body })
      txt('历史与自定义指标 → Prometheus', 1230, 804, { size: 21, color: C.body })
    })
  },
}

// 场景 3：HPA 算法
const hpaAlgo = {
  name: 'HPA 算法', dur: 17, mood: 3,
  vo: [[0.6, 'HPA 每 15 秒，按这个公式算一次期望副本数。'],
    [5.8, '3 个副本 CPU 90%，目标 60%，就扩到 5 个。', '三个副本 CPU 百分之九十，目标六十，就扩到五个。'],
    [11.0, '利用率按 requests 计算，偏差 10% 以内不动作。', '利用率按 requests 计算，偏差百分之十以内不动作。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [2.2, 'pop'], [2.5, 'pop'], [2.8, 'pop'], [3.0, 'tick'], [6.0, 'tick'], [7.0, 'tick'], [8.0, 'chime'], [8.6, 'pop'], [9.0, 'pop'], [11.2, 'tick'], [12.2, 'tick'], [13.2, 'tick']],
  draw(t, T) {
    heading('HPA 算法：期望副本数怎么来', 140, 210, t, .2, { eyebrow: 'HPA ALGORITHM', color: COL })
    // 公式
    withA(E.out(P(t, 1.0, 1.6)), () => {
      panel(140, 272, 1640, 170, { r: 18, fill: tint(COL, .04), stroke: hexA(COL, .35), shadow: false })
      txt('期望副本数 = ceil( 当前副本数 × 当前指标值 ÷ 目标指标值 )', 960, 336, { size: 34, weight: 600, align: 'center', color: C.text })
    })
    const sA = E.out(P(t, 6.0, 6.5))
    withA(sA, () => {
      let x = 960 - 300
      const parts = [['ceil( 3 × 90% ÷ 60% )', C.body, 6.0], [' = ceil(4.5)', C.body, 7.0], [' = 5', COL, 8.0]]
      const ws = parts.map(p => textW(p[0], 30, { font: MONO }))
      x = 960 - ws.reduce((a, b) => a + b, 0) / 2
      parts.forEach(([s, c, t0], i) => { txt(s, x, 406, { size: 30, font: MONO, weight: i === 2 ? 700 : 500, color: c, alpha: E.out(P(t, t0, t0 + .4)) }); x += ws[i] })
    })
    // Pods 与 CPU 柱
    const n = t >= 8.6 ? 5 : 3
    const util = lerp(90, 54, E.inOut(P(t, 9.0, 10.2)))
    const X0 = 190, GAP = 176
    const TY = 520, TH = 220
    withA(E.out(P(t, 2.0, 2.5)), () => {
      const ty = TY + TH * (1 - .6)
      line(X0 - 30, ty, X0 + 4 * GAP + 86, ty, hexA(C.red, .6), 2, [8, 7])
      txt('目标 60%', X0 + 4 * GAP + 96, ty + 7, { size: 18, color: C.red })
    })
    for (let k = 0; k < 5; k++) {
      const born = k < 3 ? 2.2 + k * .3 : 8.6 + (k - 3) * .4
      const a = E.out(P(t, born, born + .4)); if (a <= 0) continue
      const x = X0 + k * GAP
      const u = t < 8.6 ? util : (k < 3 ? util : lerp(0, util, E.out(P(t, born, born + 1.2))))
      const hot = u > 66
      vbar(x, TY, 56, TH, u / 100 * a, hot ? C.red : C.green)
      txt(`${Math.round(u)}%`, x + 28, TY - 14, { size: 20, font: MONO, align: 'center', color: hot ? C.red : C.green, alpha: a })
      pod(x + 28, TY + TH + 60, 64, { state: 'run', scale: E.back(P(t, born, born + .4)), alpha: a, label: `pod-${k + 1}` })
      if (k >= 3) ring(x + 28, TY + TH + 60, P(t, born, born + .8), C.green, 70)
    }
    // 规则卡片
    ;[['目标：averageUtilization: 60', '当前值 = 所有 Pod 的平均利用率', 3.0], ['利用率 = 实际用量 ÷ requests', '容器没写 requests 就算不出来', 11.2], ['容差 ±10%', '比值在 0.9 ~ 1.1 之间不扩不缩', 12.2], ['多个指标', '各算一遍，取最大值', 13.2]].forEach(([h, s, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 478 + i * 100
      withA(a, () => {
        panel(1130 + lerp(30, 0, a), y, 650, 86, { r: 14 })
        txt(h, 1156, y + 36, { size: 22, weight: 600, color: C.text })
        txt(s, 1156, y + 68, { size: 18, color: C.mute })
      })
    })
  },
}

// 场景 4：behavior 扩快缩慢
const BEH = ['behavior:', '  scaleUp:', '    stabilizationWindowSeconds: 0', '    policies: Percent 100% / 15s', '              Pods 4 / 15s', '  scaleDown:', '    stabilizationWindowSeconds: 300', '    policies: Percent 20% / 60s']
const load = s => s < .1 ? .22 : s < .14 ? lerp(.22, .92, (s - .1) / .04) : s < .42 ? .92 + .03 * Math.sin(s * 60) : s < .46 ? lerp(.92, .18, (s - .42) / .04) : .18
const REP = [[0, 1], [.15, 2], [.19, 4], [.23, 8], [.72, 7], [.78, 6], [.84, 5], [.9, 4], [.96, 3]]
const repAt = s => { let r = 1; REP.forEach(([a, v]) => { if (s >= a) r = v }); return r }
const behavior = {
  name: '扩快缩慢', dur: 16, mood: 3,
  vo: [[0.6, '流量来了，扩容要快：每 15 秒最多翻一倍。'],
    [5.8, '流量走了，缩容要慢：先稳定观察 5 分钟，'],
    [10.6, '再每分钟最多缩 20%，避免副本来回抖动。', '再每分钟最多缩百分之二十，避免副本来回抖动。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.6, 'pop'], [2.4, 'swell'], [5.8, 'pop'], [3.0, 'ding1'], [3.5, 'ding2'], [4.0, 'ding3'], [6.5, 'powerDown'], [7.2, 'tick'], [10.4, 'ding3'], [11.2, 'ding2'], [12.0, 'ding1'], [12.8, 'ding0'], [13.6, 'ding0']],
  draw(t, T) {
    heading('behavior：扩容要快，缩容要慢', 140, 210, t, .2, { eyebrow: 'SCALING BEHAVIOR', color: COL })
    const X = 140, Y = 280, Wd = 980, Hd = 590
    const cx0 = X + 70, cx1 = X + Wd - 30, cy0 = Y + Hd - 60, cy1 = Y + 70
    const vis = clamp(P(t, 1.2, 14.4))
    const sx = s => lerp(cx0, cx1, s)
    withA(E.out(P(t, .8, 1.3)), () => {
      panel(X, Y, Wd, Hd, { r: 16 })
      line(cx0, cy0, cx1, cy0, C.hairD, 2); line(cx0, cy0, cx0, cy1, C.hairD, 2)
      txt('时间 →', cx1, cy0 + 36, { size: 18, color: C.mute, align: 'right' })
      ctx.save(); ctx.fillStyle = tint(C.amber, .5); rr(X + 30, Y + 22, 18, 12, 3); ctx.fill(); ctx.restore()
      txt('CPU 负载', X + 56, Y + 34, { size: 18, color: C.body })
      line(X + 170, Y + 28, X + 200, Y + 28, COL, 4); txt('副本数', X + 208, Y + 34, { size: 18, color: C.body })
    })
    // 稳定窗口
    withA(E.out(P(vis, .46, .5)), () => {
      ctx.save(); ctx.fillStyle = tint(C.blue, .07); ctx.fillRect(sx(.46), cy1, sx(Math.min(vis, .72)) - sx(.46), cy0 - cy1); ctx.restore()
      txt('稳定窗口 300s', sx(.59), cy0 - 110, { size: 18, color: C.blue, align: 'center' })
    })
    // 负载面积
    if (vis > 0) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx0, cy0)
      for (let k = 0; k <= 120; k++) { const s = k / 120 * vis; ctx.lineTo(sx(s), cy0 - load(s) * (cy0 - cy1)) }
      ctx.lineTo(sx(vis), cy0); ctx.closePath(); ctx.fillStyle = tint(C.amber, .22); ctx.fill(); ctx.restore()
      // 副本阶梯
      ctx.save(); ctx.beginPath(); ctx.strokeStyle = COL; ctx.lineWidth = 4; ctx.lineJoin = 'round'
      let prev = null
      for (let k = 0; k <= 300; k++) { const s = k / 300 * vis; const y = cy0 - repAt(s) / 9 * (cy0 - cy1); if (prev === null) ctx.moveTo(sx(s), y); else { ctx.lineTo(sx(s), prev); ctx.lineTo(sx(s), y) } prev = y }
      ctx.stroke(); ctx.restore()
      const r = repAt(vis), hy = cy0 - r / 9 * (cy0 - cy1)
      dot(sx(vis), hy, 7, COL, 12)
      chip(`${r}`, sx(vis) + 28, hy - 22, { size: 18, col: COL, solid: true })
    }
    withA(E.out(P(vis, .23, .27)), () => callout(sx(.2), cy0 - 4 / 9 * (cy0 - cy1), sx(.3), cy1 + 100, '1 → 2 → 4 → 8', 1, COL, { align: 'left' }))
    withA(E.out(P(vis, .74, .78)), () => txt('每分钟最多 −20%', sx(.86), cy0 - 8.4 / 9 * (cy0 - cy1), { size: 18, color: COL, align: 'center' }))
    // YAML
    const hi = t < 5.8 ? [1, 2, 3, 4] : t < 10.4 ? [5, 6] : [7]
    code(1180, 280, 600, BEH, t, 1.2, { title: 'HPA spec（简写）', size: 20, hi: t > 1.8 ? hi : [], hiColor: COL, alpha: E.out(P(t, 1.0, 1.5)) })
    chip('用了 HPA，Deployment 就别写 replicas', X + Wd - 24, Y + 28, { size: 18, col: C.amber, align: 'right', font: SANS, alpha: E.out(P(t, 13.4, 13.9)) })
    ;[['扩容 ↑', '立即响应', '每 15s 最多翻倍', C.green, 1180, 1.6], ['缩容 ↓', '先稳 5 分钟', '每分钟最多 −20%', C.blue, 1490, 5.8]].forEach(([h, a1, a2, c, x, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 660 + lerp(20, 0, a), 290, 210, { r: 16, fill: tint(c, .05), stroke: hexA(c, .45) })
        txt(h, x + 26, 716, { size: 28, weight: 700, color: c })
        txt(a1, x + 26, 772, { size: 22, color: C.text })
        txt(a2, x + 26, 820, { size: 20, color: C.body })
      })
    })
  },
}

// 场景 5：节点扩缩
const nodes = {
  name: '节点扩缩', dur: 16, mood: 4,
  vo: [[0.6, 'Pod 因资源不足一直 Pending，就是加节点的信号。'],
    [5.8, 'CA 按节点组扩容，Karpenter 直接挑合适机型。', 'Cluster Autoscaler 按节点组扩容，Karpenter 直接挑机型。'],
    [11.0, '事件驱动的负载，还可以用 KEDA 缩到零。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [2.4, 'alarmSoft'], [3.2, 'pop'], [4.4, 'zap'], [6.0, 'pop'], [7.0, 'pop'], [7.6, 'tick'], [8.6, 'pop'], [9.2, 'thud'], [9.8, 'whoosh'], [10.5, 'ok'], [11.2, 'pop'], [12.0, 'zap'], [13.0, 'zap']],
  draw(t, T) {
    heading('节点自动扩缩：CA 与 Karpenter', 140, 210, t, .2, { eyebrow: 'NODE AUTOSCALING', color: COL })
    // 集群
    const cA = E.out(P(t, .8, 1.3))
    withA(cA, () => { panel(140, 280, 800, 440, { r: 20, fill: tint(C.blue, .03), stroke: hexA(C.blue, .3), dash: [10, 8], shadow: false }); chip('集群', 164, 280, { size: 18, col: C.blue, align: 'left' }) })
    ;[0, 1].forEach(k => {
      const a = E.out(P(t, 1.0 + k * .4, 1.5 + k * .4)); if (a <= 0) return
      node(170 + k * 250, 320, 230, 220, `node-${k + 1}`, { alpha: a, tag: '满', accent: C.amber })
      ;[0, 1, 2].forEach(j => pod(210 + k * 250 + j * 75, 440, 56, { state: 'run', alpha: a }))
    })
    // 新节点
    const nA = E.out(P(t, 9.2, 9.7))
    withA(cA * (1 - nA), () => { panel(670, 320, 240, 220, { r: 14, dash: [8, 7], shadow: false, fill: 'rgba(255,255,255,0.4)' }); txt('？', 790, 444, { size: 40, color: C.faint, align: 'center' }) })
    node(670, 320 + lerp(-30, 0, nA), 240, 220, 'node-3', { alpha: nA, tag: '新增', accent: C.green })
    ring(790, 440, P(t, 9.2, 10.2), C.green, 150)
    // Pending Pods
    ;[0, 1].forEach(j => {
      const a = E.out(P(t, 2.4 + j * .2, 2.8 + j * .2)); if (a <= 0) return
      const mv = E.inOut(P(t, 9.8 + j * .2, 10.5 + j * .2))
      const x = lerp(300 + j * 110, 745 + j * 90, mv), y = lerp(630, 440, mv)
      pod(x, y, 60, { state: mv >= 1 ? 'run' : 'pending', alpha: a, shake: t < 9.8 ? Math.sin(T * 26 + j) * 2 : 0 })
    })
    withA(E.out(P(t, 2.6, 3)) * (1 - P(t, 9.8, 10.2)), () => {
      txt('Pending', 500, 622, { size: 22, font: MONO, color: C.amber, weight: 600 })
      txt('FailedScheduling: Insufficient cpu', 500, 656, { size: 17, font: MONO, color: C.mute })
    })
    // 信号箭头
    withA(E.out(P(t, 3.2, 3.6)) * (1 - P(t, 10.4, 10.8)), () => { chip('扩容信号：不可调度的 Pod', 540, 690, { size: 18, font: SANS, col: C.amber }) })
    arrow(940, 500, 992, 500, E.out(P(t, 4.4, 4.9)), C.amber, 3)
    chip('✓ 2 个 Pod 已调度到 node-3', 540, 640, { size: 20, font: SANS, col: C.green, alpha: E.out(P(t, 10.8, 11.2)) })
    // CA 卡片
    const caA = E.out(P(t, 6.0, 6.5))
    withA(caA, () => {
      panel(1000, 280, 780, 210, { r: 18, stroke: t > 6 && t < 7 ? COL : C.hair })
      chip('Cluster Autoscaler', 1028, 322, { size: 20, col: COL, solid: true, align: 'left' })
      txt('按预定义节点组扩容：同规格 +1', 1028, 382, { size: 22, color: C.text })
      txt('先模拟调度确认有用；缩容时遵守 PDB', 1028, 420, { size: 18, color: C.mute })
      ;[0, 1, 2].forEach(k => {
        const a = k < 2 ? 1 : E.back(P(t, 8.6, 9.0)); if (a <= 0) return
        withA(clamp(a), () => { ctx.save(); ctx.fillStyle = k < 2 ? tint(C.blue, .12) : tint(C.green, .18); ctx.strokeStyle = k < 2 ? C.blue : C.green; ctx.lineWidth = 2; rr(1540 + k * 74, 360, 60, 80, 8); ctx.fill(); ctx.stroke(); ctx.restore(); txt('4C', 1570 + k * 74, 408, { size: 16, font: MONO, align: 'center', color: C.body }) })
      })
    })
    // Karpenter 卡片
    const kA = E.out(P(t, 7.0, 7.5))
    withA(kA, () => {
      panel(1000, 510, 780, 210, { r: 18 })
      chip('Karpenter', 1028, 552, { size: 20, col: C.teal, solid: true, align: 'left' })
      txt('看 Pending Pod 的需求，现挑实例类型', 1028, 612, { size: 22, color: C.text })
      txt('空闲时合并节点（consolidation）省钱', 1028, 650, { size: 18, color: C.mute })
      ;['m7i.large', 'c7i.2xlarge', 'g6.xlarge'].forEach((s, k) => {
        const on = k === 1 && t > 7.6
        chip(s, 1320 + k * 180, 690, { size: 16, col: on ? C.teal : C.mute, solid: on, alpha: E.out(P(t, 7.2 + k * .15, 7.6 + k * .15)) })
      })
    })
    // KEDA
    const eA = E.out(P(t, 11.2, 11.7))
    withA(eA, () => {
      panel(140, 752, 1640, 118, { r: 16, fill: tint(COL, .04), stroke: hexA(COL, .35), shadow: false })
      chip('KEDA', 170, 811, { size: 22, col: COL, solid: true, align: 'left' })
      txt('按队列长度等事件扩缩', 270, 819, { size: 22, color: C.text })
    })
    const stops = [['0', 1000], ['1', 1260], ['N', 1560]]
    stops.forEach(([s, x], i) => withA(E.out(P(t, 11.6 + i * .3, 12 + i * .3)), () => { ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = COL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, 811, 26, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); txt(s, x, 821, { size: 26, font: MONO, weight: 700, color: COL, align: 'center' }) }))
    withA(E.out(P(t, 12.0, 12.4)), () => { arrow(1030, 811, 1230, 811, E.out(P(t, 12.0, 12.5)), COL, 2.5); txt('KEDA 负责', 1130, 790, { size: 17, color: C.body, align: 'center' }) })
    withA(E.out(P(t, 13.0, 13.4)), () => { arrow(1290, 811, 1530, 811, E.out(P(t, 13.0, 13.5)), C.teal, 2.5); txt('生成 HPA 负责', 1410, 790, { size: 17, color: C.body, align: 'center' }) })
  },
}

ANIM({
  id: 'autoscaling',
  meta: { stage: 3, lesson: 5, of: 6, title: '自动扩缩容', summary: 'metrics-server、HPA、VPA 与集群节点自动扩缩。', next: 'CRD 与 Operator 模式' },
  scenes: [
    lessonIntro({ tags: ['metrics-server', 'HPA', 'VPA', 'Cluster Autoscaler', 'KEDA'], vo: [[3.2, '流量翻倍的时候，谁来加副本、加机器？']] }),
    layers, metrics, hpaAlgo, behavior, nodes,
    lessonOutro({
      points: ['HPA 改副本，VPA 改 requests，CA 改节点', 'metrics-server 只存最新值，供 HPA 与 top', '期望副本 = ceil(当前副本 × 当前值 ÷ 目标值)', '扩容要快、缩容要慢；Pending 触发加节点'],
      vo: [[0.8, '小结：三层扩缩，各管一层。'], [5.6, '下一课，CRD 与 Operator 模式。']],
    }),
  ],
})
})()
