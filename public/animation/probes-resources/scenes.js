/* 第 2 阶段 · 第 1 课：健康检查与资源管理 */
(() => {
const COL = STAGES[2].color

// ---------- 场景 1：三种探针 ----------
const X0 = 600, X1 = 1760
const pOf = t => t < 9.5 ? P(t, 1.2, 9.5) * .4 : .4 + P(t, 9.5, 15.2) * .6
const tOf = p => p <= .4 ? 1.2 + p / .4 * 8.3 : 9.5 + (p - .4) / .6 * 5.7
const XP = p => X0 + p * (X1 - X0)
const ST = [0, 1, 2, 3, 4, 5].map(k => .04 + .065 * k) // startup 探测点：前 5 次失败，第 6 次成功
const ST_END = ST[5]
const RD = []; for (let p = .44; p < .99; p += .07) RD.push(p)
const LV = []; for (let p = .47; p < .99; p += .12) LV.push(p)
const LANES = [
  ['startupProbe', '启动完成了吗？', '超过阈值 → 重启', C.violet, 330, ST],
  ['readinessProbe', '现在能接流量吗？', '失败 → 摘除流量', C.amber, 470, RD],
  ['livenessProbe', '容器还活着吗？', '失败 → 重启容器', C.red, 610, LV],
]
const probes = {
  name: '三种探针', dur: 16, mood: 1,
  vo: [[0.6, '探针是 kubelet 对容器的定期诊断。'],
    [5.2, 'startupProbe 先确认启动完成，期间屏蔽另外两种。'],
    [11.0, '之后 liveness 管重启，readiness 管流量。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], [1.0, 'tick'], [1.2, 'tick'], ...ST.map((p, k) => [tOf(p), k < 5 ? 'tick' : 'ok']), [9.5, 'pop'],
    ...RD.slice(0, 3).map(p => [tOf(p), 'tick']), [11.1, 'chime'], [12.2, 'pop']],
  draw(t) {
    heading('三种探针：kubelet 的定期诊断', 140, 210, t, .2, { eyebrow: 'PROBES', color: COL })
    const p = pOf(t), px = XP(p)
    const ax = E.out(P(t, .6, 1.2))
    withA(ax, () => {
      line(X0, 700, X1, 700, C.hairD, 2); arrowHead(X1, 700, 0, C.hairD, 12)
      txt('时间 →', X1, 736, { size: 18, color: C.mute, align: 'right' })
      txt('容器启动', X0, 736, { size: 18, color: C.mute })
    })
    const res = E.out(P(t, 11, 11.6))
    LANES.forEach(([n, q, r, c, y, ticks], i) => {
      const a = E.out(P(t, .8 + i * .2, 1.3 + i * .2)); if (a <= 0) return
      withA(a, () => {
        txt(n, X0 - 30, y - 2, { size: 24, font: MONO, align: 'right', color: C.text })
        txt(q, X0 - 30, y + 28, { size: 18, align: 'right', color: C.mute, alpha: 1 - res })
        txt(r, X0 - 30, y + 28, { size: 18, align: 'right', color: c, weight: 600, alpha: i === 0 ? 0 : res })
        if (i === 0) txt(r, X0 - 30, y + 28, { size: 18, align: 'right', color: C.mute, alpha: res })
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.035)'; rr(X0, y - 30, X1 - X0, 60, 12); ctx.fill(); ctx.restore()
        if (i === 0) {
          const e = Math.min(p, ST_END); if (e > 0) {
            ctx.save(); ctx.fillStyle = tint(c, .16); ctx.strokeStyle = hexA(c, .8); ctx.lineWidth = 2; rr(X0, y - 30, e * (X1 - X0), 60, 12); ctx.fill(); ctx.stroke(); ctx.restore()
          }
          if (p > ST_END + .01) chip('启动完成', XP(ST_END) + 24, y, { size: 18, col: C.green, align: 'left', font: SANS, alpha: E.out(P(t, tOf(ST_END), tOf(ST_END) + .4)) })
        } else {
          if (p > .02 && p < .4 + .05) withA(1 - P(p, .4, .45), () => {
            ctx.save(); ctx.strokeStyle = hexA(C.faint, .7); ctx.lineWidth = 2; ctx.setLineDash([8, 8]); rr(X0, y - 30, XP(.4) - X0, 60, 12); ctx.stroke(); ctx.restore()
            txt('被 startupProbe 屏蔽', (X0 + XP(.4)) / 2, y + 7, { size: 18, color: C.faint, align: 'center' })
          })
          if (p > .4) { ctx.save(); ctx.fillStyle = tint(c, .12); ctx.strokeStyle = hexA(c, .6); ctx.lineWidth = 2; rr(XP(.4), y - 30, (p - .4) * (X1 - X0), 60, 12); ctx.fill(); ctx.stroke(); ctx.restore() }
        }
        ticks.forEach((tp, k) => {
          if (p < tp) return
          const k2 = E.back(P(t, tOf(tp), tOf(tp) + .35)), x = XP(tp)
          if (i === 0 && k < 5) { cross(x, y, 18 * k2, C.red, 1); txt('503', x, y - 38, { size: 16, font: MONO, color: C.red, align: 'center', alpha: clamp(k2) }) }
          else if (i === 0) { ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 18 * clamp(k2), 0, Math.PI * 2); ctx.fill(); ctx.restore(); check(x, y, 26, C.green, P(t, tOf(tp), tOf(tp) + .35)); txt('200', x, y - 38, { size: 16, font: MONO, color: C.green, align: 'center', alpha: clamp(k2) }) }
          else dot(x, y, 8 * clamp(k2), C.green, 8)
          ring(x, y, P(t, tOf(tp), tOf(tp) + .7), i === 0 && k < 5 ? C.red : C.green, 50)
        })
      })
    })
    // 播放头
    if (ax > 0 && p > 0 && p < 1) { line(px, 280, px, 700, hexA(C.text, .25), 2, [6, 6]); dot(px, 700, 6, C.text, 0) }
    // 检查方式
    const ma = E.out(P(t, 1.8, 2.4))
    withA(ma, () => {
      txt('检查方式', 140, 828, { size: 20, color: C.mute })
      let x = 250
      ;[['httpGet', '200–399'], ['tcpSocket', '端口可连'], ['exec', '退出码 0'], ['grpc', '健康检查协议']].forEach(([m, s], i) => {
        const w = chip(m, x, 821, { size: 20, col: COL, align: 'left', alpha: E.out(P(t, 1.8 + i * .2, 2.3 + i * .2)) })
        txt(s, x + w + 12, 828, { size: 18, color: C.body, alpha: E.out(P(t, 1.8 + i * .2, 2.3 + i * .2)) })
        x += w + textW(s, 18) + 52
      })
    })
  },
}

// ---------- 场景 2：就绪 vs 存活 ----------
const readyLive = {
  name: '就绪 vs 存活', dur: 17, mood: 2,
  vo: [[0.6, '就绪探针失败：摘除流量，但不重启。'],
    [5.8, '存活探针失败：kubelet 直接重启容器。'],
    [11.0, '别在 liveness 里查数据库，否则会全体重启。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [2.4, 'alarmSoft'], [3.4, 'poof'], [6.6, 'error'], [7.8, 'thud'], [8.8, 'ok'], [9.4, 'pop'],
    [11.0, 'whoosh'], [12.6, 'error'], [13.2, 'alarm'], [15.0, 'chime']],
  draw(t) {
    heading('就绪探针 vs 存活探针', 140, 210, t, .2, { eyebrow: 'READINESS vs LIVENESS', color: COL })
    const A = E.out(P(t, .6, 1.2))
    const sx = 330, sy = 560
    // B 的状态：ready → notready(2.4) → dead(6.6) → restarting(7.8) → ready(8.8)
    const bNot = t >= 2.4 && t < 8.8, bDead = t >= 6.6 && t < 7.8, bBoot = t >= 7.8 && t < 8.8
    const bState = bDead ? 'fail' : bBoot ? 'pending' : bNot ? 'pending' : 'run'
    const restarts = t >= 7.8 ? 1 : 0
    withA(A, () => {
      box(sx, sy - 120, 260, 110, 'Service', 'web', COL, { size: 30 })
      // EndpointSlice
      panel(sx - 150, sy - 30, 300, 210, { r: 14 })
      txt('EndpointSlice', sx - 126, sy + 8, { size: 17, font: MONO, color: C.mute })
      line(sx - 150, sy + 24, sx + 150, sy + 24, C.hair, 1)
      txt('10.244.1.5  web-a', sx - 126, sy + 70, { size: 20, font: MONO, color: C.text })
      const gone = bNot ? E.out(P(t, 3.2, 3.7)) * (1 - E.out(P(t, 9.2, 9.7))) : 0
      withA(1 - gone * .75, () => txt('10.244.2.7  web-b', sx - 126, sy + 120, { size: 20, font: MONO, color: C.text }))
      if (gone > 0) line(sx - 128, sy + 113, lerp(sx - 128, sx + 110, gone), sy + 113, C.red, 2.5)
      chip('摘除', sx + 124, sy + 113, { size: 16, col: C.red, alpha: gone, font: SANS })
    })
    const pa = [960, 420], pb = [960, 720]
    // 流量
    if (A > 0) {
      arrow(sx + 130, sy - 130, pa[0] - 90, pa[1], A, hexA(C.text, .3), 2.5)
      const bl = !bNot
      arrow(sx + 130, sy - 110, pb[0] - 90, pb[1], A, bl ? hexA(C.text, .3) : hexA(C.faint, .6), 2.5, bl ? null : [8, 8])
      if (t > 1.2) flow(sx + 130, sy - 130, pa[0] - 90, pa[1], t, COL, 4, .8, 0, 5)
      if (t > 1.2 && bl) flow(sx + 130, sy - 110, pb[0] - 90, pb[1], t, COL, 4, .8, .5, 5)
    }
    const shake = bDead ? Math.sin(t * 70) * 7 * (1 - P(t, 6.6, 7.1)) : 0
    pod(pa[0], pa[1], 150, { state: 'run', label: 'web-a', alpha: E.out(P(t, 1, 1.5)) })
    pod(pb[0], pb[1], 150, { state: bState, label: 'web-b', alpha: E.out(P(t, 1.3, 1.8)), shake })
    ring(pb[0], pb[1], P(t, 2.4, 3.3), C.amber, 150); ring(pb[0], pb[1], P(t, 6.6, 7.5), C.red, 170); ring(pb[0], pb[1], P(t, 8.8, 9.6), C.green, 150)
    // 状态卡
    const sa = E.out(P(t, 1.5, 2))
    withA(sa, () => {
      ;[[pa, 'READY 1/1', C.green, 'RESTARTS 0', C.mute], [pb, bNot ? 'READY 0/1' : 'READY 1/1', bNot ? C.amber : C.green, `RESTARTS ${restarts}`, restarts ? C.red : C.mute]].forEach(([q, r1, c1, r2, c2]) => {
        chip(r1, q[0] + 110, q[1] - 22, { size: 20, col: c1, align: 'left' })
        chip(r2, q[0] + 110, q[1] + 24, { size: 20, col: c2, align: 'left' })
      })
    })
    chip('不重启', pb[0] + 110, pb[1] + 74, { size: 18, col: C.amber, font: SANS, align: 'left', alpha: E.out(P(t, 3.6, 4)) * (1 - P(t, 6.4, 6.8)) })
    if (restarts) ring(pb[0] + 200, pb[1] + 24, P(t, 7.8, 8.6), C.red, 80)
    // 右侧：事件 → 反模式
    const ev = win(t, .8, 11.2, .4)
    withA(ev, () => {
      panel(1300, 290, 480, 560, { r: 16 })
      txt('kubectl describe pod web-b', 1326, 330, { size: 17, font: MONO, color: C.mute })
      line(1300, 350, 1780, 350, C.hair, 1)
      ;[[2.6, 'Readiness probe failed', 'HTTP probe failed: 403', C.amber, '→ 摘除流量，容器照常运行'], [6.8, 'Liveness probe failed', 'container web failed', C.red, '→ kubelet 重启容器']].forEach(([t0, a1, a2, c, note], i) => {
        const k = E.out(P(t, t0, t0 + .4)); if (k <= 0) return
        const y = 400 + i * 200
        withA(k, () => {
          chip('Warning', 1326, y, { size: 16, col: c, align: 'left' })
          txt(a1, 1326, y + 44, { size: 21, font: MONO, color: C.text })
          txt(a2, 1326, y + 78, { size: 18, font: MONO, color: c })
          txt(note, 1326, y + 120, { size: 20, color: C.body, alpha: E.out(P(t, t0 + .8, t0 + 1.2)) })
        })
      })
    })
    // 反模式：liveness 检查数据库
    const bad = E.out(P(t, 11.2, 11.8))
    withA(bad, () => {
      panel(1300, 290, 480, 560, { r: 16, stroke: hexA(C.red, .5), fill: tint(C.red, .03) })
      txt('反模式：liveness 查数据库', 1326, 334, { size: 22, weight: 600, color: C.red })
      const dbDown = t >= 12.6
      cylinder(1540, 700, 120, 56, dbDown ? C.red : C.teal, 'database')
      cross(1540, 700, 40, C.red, E.out(P(t, 12.6, 12.9)))
      ;[1400, 1540, 1680].forEach((x, i) => {
        const sh = t > 13.2 && t < 14.4 ? Math.sin(t * 60 + i) * 5 : 0
        partialLine(x, 470, 1540, 640, E.out(P(t, 11.6 + i * .15, 12.1 + i * .15)), dbDown ? hexA(C.red, .6) : hexA(C.text, .3), 2, [6, 6])
        pod(x + sh, 440, 80, { state: t > 13.2 ? 'fail' : 'run', alpha: E.out(P(t, 11.4 + i * .1, 11.9 + i * .1)) })
        ring(x, 440, P(t, 13.2 + i * .1, 14 + i * .1), C.red, 90)
      })
      chip('全部副本同时重启 = 雪崩', 1540, 530, { size: 18, col: C.red, solid: true, font: SANS, alpha: E.out(P(t, 13.4, 13.9)) })
      txt('liveness 只查进程自身', 1540, 808, { size: 20, color: C.green, align: 'center', weight: 600, alpha: E.out(P(t, 15, 15.5)) })
    })
  },
}

// ---------- 场景 3：requests 与 limits ----------
const RES = ['resources:', '  requests:', '    cpu: 250m', '    memory: 128Mi', '  limits:', '    cpu: "1"', '    memory: 256Mi']
const BLK = [['pod-a', 1, COL], ['pod-b', 1.5, C.blue], ['pod-c', 1, C.violet]]
const reqLim = {
  name: 'requests 与 limits', dur: 17, mood: 2,
  vo: [[0.6, 'requests 是调度依据，limits 是运行时上限。'],
    [5.8, 'CPU 超限只会被限流，进程变慢但不会死。'],
    [11.2, '内存超限直接 OOMKilled，退出码 137。', '内存超限会被直接 OOM Killed，退出码一三七。']],
  cues: [[0.4, 'whoosh'], [1.6, 'thud'], [2.2, 'thud'], [2.8, 'thud'], [3.8, 'pop'], [4.6, 'error'], [6.0, 'tick'], [8.4, 'alarmSoft'], [11.4, 'tick'], [13.8, 'boom'], [14.0, 'error']],
  draw(t) {
    heading('requests 与 limits', 140, 210, t, .2, { eyebrow: 'RESOURCES', color: COL })
    const hi = t < 5.8 ? [1, 2, 3] : t < 11.2 ? [4, 5] : [4, 6]
    code(140, 280, 560, RES, t, .5, { title: 'deployment.yaml · resources', size: 22, step: .08, hi, hiColor: t < 5.8 ? COL : t < 11.2 ? C.amber : C.red, alpha: E.out(P(t, .4, .8)) })
    // 节点可分配量
    const na = E.out(P(t, 1.2, 1.7))
    withA(na, () => {
      node(140, 650, 560, 230, 'worker · Allocatable 4 CPU', { accent: COL })
      const bx = 170, by = 740, bw = 400, u = bw / 4
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(bx, by, bw, 50, 10); ctx.fill(); ctx.restore()
      for (let k = 1; k < 4; k++) line(bx + k * u, by - 6, bx + k * u, by + 56, hexA(C.text, .12), 1, [4, 4])
      let x = bx
      BLK.forEach(([n, c, col], i) => {
        const k = E.back(P(t, 1.6 + i * .6, 2 + i * .6)), w = c * u
        if (k > 0) withA(clamp(k), () => {
          ctx.save(); ctx.fillStyle = tint(col, .22); ctx.strokeStyle = col; ctx.lineWidth = 2; rr(x + 2, lerp(by - 50, by, clamp(k)) + 2, w - 4, 46, 8); ctx.fill(); ctx.stroke(); ctx.restore()
          txt(`${n} ${c}`, x + w / 2, lerp(by - 50, by, clamp(k)) + 32, { size: 18, font: MONO, align: 'center', color: C.text })
        })
        x += w
      })
      // 新 Pod 放不下：只剩 0.5 核
      const d = E.out(P(t, 3.8, 4.5)), fail = t >= 4.6
      if (d > 0) withA(d, () => {
        const px = lerp(700, 584, d) + (fail ? Math.sin(t * 50) * 4 * (1 - P(t, 4.6, 5.2)) : 0)
        ctx.save(); ctx.fillStyle = fail ? tint(C.red, .14) : tint(C.amber, .2); ctx.strokeStyle = fail ? C.red : C.amber; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); rr(px, by + 2, 100, 46, 8); ctx.fill(); ctx.stroke(); ctx.restore()
        txt('pod-d 1', px + 50, by + 32, { size: 18, font: MONO, align: 'center', color: fail ? C.red : C.text })
      })
      txt('Pending · Insufficient cpu', 170, 850, { size: 20, font: MONO, color: C.red, alpha: E.out(P(t, 4.6, 5)) })
      txt('空闲 0.5', bx + 3.75 * u, 724, { size: 16, color: C.mute, align: 'center', alpha: E.out(P(t, 3.4, 3.8)) })
    })
    // CPU：限流
    const cx = 780, cw = 1000
    const cv = P(t, 6, 10)
    withA(E.out(P(t, 5.8, 6.3)), () => {
      const f = s => Math.min(.62, .18 + s * 1.1 + Math.sin(s * 30) * .04)
      chart(cx, 280, cw, 280, f, cv, C.amber, { title: 'CPU 用量', threshold: .62 })
      txt('limits: 1 核', cx + cw - 24, 280 + 280 - 20 - .62 * 200 - 12, { size: 18, font: MONO, color: C.red, align: 'right' })
      const th = E.out(P(t, 8.2, 8.8))
      withA(th, () => {
        ctx.save(); ctx.fillStyle = hexA(C.amber, .1); ctx.fillRect(cx + 20 + .4 * (cw - 40), 280 + 60, .6 * (cw - 40) * cv, 280 - 20 - .62 * 200 - 60); ctx.restore()
        chip('throttled · 被 CFS 限流', cx + 20 + .7 * (cw - 40), 370, { size: 20, col: C.amber, font: SANS })
      })
      chip('可压缩 · 变慢不死', cx + 200, 316, { size: 18, col: C.mute, font: SANS, align: 'left', alpha: E.out(P(t, 9.4, 9.9)) })
    })
    // 内存：OOMKilled
    const mv = P(t, 11.4, 13.8)
    withA(E.out(P(t, 11.2, 11.7)), () => {
      const f = s => .1 + s * .5
      chart(cx, 600, cw, 280, f, mv, t >= 13.8 ? C.red : C.violet, { title: '内存用量', threshold: .6 })
      txt('limits: 256Mi', cx + 250, 600 + 280 - 20 - .6 * 200 - 12, { size: 18, font: MONO, color: C.red })
      const kx = cx + 20 + (cw - 40), ky = 600 + 280 - 20 - .6 * 200
      const b = E.back(P(t, 13.8, 14.3))
      if (b > 0) { ring(kx - 10, ky, P(t, 13.8, 14.8), C.red, 120); cross(kx - 10, ky, 34 * clamp(b), C.red, 1) }
      chip('OOMKilled · exit 137', cx + cw - 70, 826, { size: 22, col: C.red, solid: true, align: 'right', alpha: E.out(P(t, 14, 14.4)) })
      chip('不可压缩 · 直接被杀', cx + 200, 636, { size: 18, col: C.mute, font: SANS, align: 'left', alpha: E.out(P(t, 14.6, 15.1)) })
    })
  },
}

// ---------- 场景 4：QoS 等级 ----------
const QOS = [
  ['Guaranteed', C.green, '每个容器 CPU 与内存的', 'requests = limits', [.7, .7], '③ 最后'],
  ['Burstable', C.amber, '设置了部分 requests/limits', '但不满足 Guaranteed', [.35, .8], '② 其次'],
  ['BestEffort', C.red, '所有容器都没设置', '任何 requests/limits', [0, 0], '① 最先'],
]
const qos = {
  name: 'QoS 等级', dur: 16, mood: 3,
  vo: [[0.6, 'K8s 按 requests 和 limits 自动划分 QoS。', 'Kubernetes 按 requests 和 limits，自动划分 QoS 等级。'],
    [5.8, '全部相等是 Guaranteed，全不设是 BestEffort。'],
    [10.8, '节点内存紧张时，BestEffort 最先被驱逐。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [1.8, 'pop'], [6.0, 'tick'], [8.2, 'tick'], [10.8, 'alarmSoft'], [12.0, 'poof'], [12.3, 'poof'], [13.2, 'tick'], [14.2, 'lock']],
  draw(t) {
    heading('QoS 等级：资源紧张时先牺牲谁', 140, 210, t, .2, { eyebrow: 'QOS CLASS', color: COL })
    const cur = t < 5.8 ? -1 : t < 8.2 ? 0 : t < 10.8 ? 2 : -1
    QOS.forEach(([n, c, s1, s2, [rq, lm], rank], i) => {
      const a = E.out(P(t, 1 + i * .4, 1.5 + i * .4)); if (a <= 0) return
      const x = 140 + i * 560, w = 520, on = cur === i
      withA(a * (cur < 0 || on ? 1 : .5), () => {
        panel(x, 290 + lerp(30, 0, a), w, 450, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        chip(n, x + 30, 340, { size: 26, col: c, solid: on, align: 'left' })
        txt(s1, x + 30, 410, { size: 22, color: C.body })
        txt(s2, x + 30, 446, { size: 22, color: C.text, font: i === 0 ? MONO : SANS, weight: i === 0 ? 600 : 500 })
        // requests / limits 示意
        ;[['requests', rq], ['limits', lm]].forEach(([k, v], j) => {
          const y = 500 + j * 52
          txt(k, x + 30, y + 17, { size: 18, font: MONO, color: C.mute })
          if (v > 0) meter(x + 150, y, 330, 22, v * E.out(P(t, 1.6 + i * .4, 2.4 + i * .4)), c)
          else { ctx.save(); ctx.strokeStyle = C.hairD; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; rr(x + 150, y, 330, 22, 11); ctx.stroke(); ctx.restore(); txt('未设置', x + 315, y + 18, { size: 16, color: C.mute, align: 'center' }) }
        })
      })
      // Pods
      const evict = i === 2 ? P(t, 12, 12.8) : 0
      ;[0, 1].forEach(k => {
        const px = x + 160 + k * 200, py = 660
        if (evict < 1) pod(px + (i === 1 && t > 13.2 && t < 13.8 ? Math.sin(t * 60) * 5 : 0), py, 90, { state: c, alpha: a * (1 - evict) * (cur < 0 || cur === i ? 1 : .5) })
        if (i === 2) poof(px, py, P(t, 12 + k * .3, 12.8 + k * .3), c)
      })
      if (i === 0) withA(E.out(P(t, 14.2, 14.7)), () => shield(x + 260, 660, 38, C.green, .12))
      chip(rank, x + w - 24, 340, { size: 20, col: c, solid: true, align: 'right', font: SANS, alpha: E.out(P(t, [14.2, 13.2, 11.6][i], [14.2, 13.2, 11.6][i] + .4)) })
    })
    withA(E.out(P(t, 12.1, 12.5)), () => txt('被驱逐', 1260 + 260, 668, { size: 24, color: C.red, align: 'center', weight: 600 }))
    // 节点内存压力
    const ma = E.out(P(t, 10.8, 11.3))
    withA(ma, () => {
      const v = lerp(.55, .96, E.out(P(t, 10.9, 11.8)))
      meter(140, 800, 1640, 22, v, v > .9 ? C.red : C.amber, { label: '节点内存压力', value: Math.round(v * 100) + '%' })
      txt('kubelet 驱逐排序：用量是否超出 requests → Pod 优先级 → 超出多少', 140, 866, { size: 18, color: C.mute })
    })
  },
}

// ---------- 场景 5：LimitRange 与 ResourceQuota ----------
const QM = [['requests.cpu', 4, 3.6, '4'], ['limits.memory', 16, 12, '16Gi'], ['pods', 20, 20, '20']]
const guard = {
  name: 'LimitRange 与 Quota', dur: 16, mood: 3,
  vo: [[0.6, 'LimitRange 管单个容器：补默认值、卡上下限。'],
    [6.0, '超出上限的容器，创建时就会被拒绝。'],
    [10.6, 'ResourceQuota 管总和，给命名空间划预算。']],
  cues: [[0.4, 'whoosh'], [1.2, 'pop'], [2.4, 'zap'], [3.2, 'ok'], [6.2, 'pop'], [7.4, 'error'], [10.8, 'tick'], [11.2, 'tick'], [11.6, 'tick'], [13.4, 'alarmSoft'], [14.0, 'error']],
  draw(t) {
    heading('LimitRange 与 ResourceQuota', 140, 210, t, .2, { eyebrow: 'NAMESPACE GUARDRAILS', color: COL })
    const A = E.out(P(t, .5, 1))
    withA(A, () => {
      panel(140, 270, 1640, 610, { r: 24, fill: tint(COL, .03), stroke: hexA(COL, .5), dash: [12, 9], lw: 2, shadow: false })
      chip('namespace: team-a', 180, 270, { size: 20, col: COL, solid: true, align: 'left' })
      line(1000, 310, 1000, 850, hexA(COL, .25), 2, [6, 8])
      txt('管「单个」', 190, 340, { size: 20, color: C.mute })
      txt('管「总和」', 1040, 340, { size: 20, color: C.mute })
    })
    // LimitRange 闸门
    const gx = 520
    withA(E.out(P(t, .8, 1.3)), () => {
      ctx.save(); ctx.fillStyle = tint(C.violet, .14); ctx.strokeStyle = C.violet; ctx.lineWidth = 2.5; rr(gx - 18, 380, 36, 300, 18); ctx.fill(); ctx.stroke(); ctx.restore()
      chip('LimitRange', gx, 712, { size: 20, col: C.violet, solid: true })
      txt('default 500m/256Mi · max 2Gi', gx, 756, { size: 17, font: MONO, color: C.violet, align: 'center' })
    })
    // Pod 1：没写 resources → 补默认值
    const m1 = E.inOut(P(t, 1.2, 3.2)), x1 = lerp(250, 800, m1)
    const passed = x1 > gx
    pod(x1, 470, 110, { state: passed ? 'run' : 'idle', label: 'nolimit', alpha: E.out(P(t, 1.1, 1.5)) })
    ring(gx, 470, P(t, 2.3, 3.1), C.violet, 110)
    if (t > 1.1) {
      if (!passed) chip('resources: {}', x1, 590, { size: 18, col: C.mute })
      else withA(E.out(P(t, 2.4, 2.9)), () => {
        chip('requests 100m / 128Mi', x1, 590, { size: 17, col: C.green })
        chip('limits 500m / 256Mi', x1, 630, { size: 17, col: C.green })
      })
    }
    // Pod 2：limits.memory 4Gi → 拒绝
    const m2 = E.inOut(P(t, 6.2, 7.4)), x2 = lerp(250, gx - 86, m2), rej = t >= 7.4
    const sh = rej ? Math.sin(t * 60) * 6 * (1 - P(t, 7.4, 8)) : 0
    pod(x2 + sh, 610, 110, { state: rej ? 'fail' : 'idle', label: 'toobig', alpha: E.out(P(t, 6, 6.4)) })
    chip('memory 4Gi', x2, 530, { size: 17, col: rej ? C.red : C.mute, alpha: E.out(P(t, 6, 6.4)) })
    cross(gx + 60, 610, 34, C.red, E.out(P(t, 7.4, 7.7)))
    withA(E.out(P(t, 7.8, 8.3)), () => {
      panel(180, 790, 780, 60, { r: 12, fill: tint(C.red, .06), stroke: hexA(C.red, .5), shadow: false })
      txt('Error: maximum memory per Container is 2Gi', 204, 828, { size: 19, font: MONO, color: C.red })
    })
    // ResourceQuota
    withA(E.out(P(t, 10.6, 11.1)), () => {
      chip('ResourceQuota · team-a-quota', 1040, 400, { size: 20, col: COL, solid: true, align: 'left' })
      QM.forEach(([k, hard, used, hs], i) => {
        const v = used / hard * E.out(P(t, 10.8 + i * .4, 12.8 + i * .3)), y = 480 + i * 90
        const full = v > .99
        const u = k === 'pods' ? Math.round(v * hard) : k === 'requests.cpu' ? (v * hard).toFixed(1) : Math.round(v * hard) + 'Gi'
        meter(1040, y, 700, 20, v, full ? C.red : v > .8 ? C.amber : COL, { label: k, value: `${u} / ${hs}`, size: 20 })
      })
      // 第 21 个 Pod 被拒
      const k = E.back(P(t, 13.4, 13.9)), rej2 = t >= 14
      if (k > 0) {
        pod(1160 + (rej2 ? Math.sin(t * 60) * 6 * (1 - P(t, 14, 14.6)) : 0), 790, 80, { state: rej2 ? 'fail' : 'idle', alpha: clamp(k) })
        chip('exceeded quota: pods=20', 1230, 776, { size: 18, col: C.red, align: 'left', alpha: E.out(P(t, 14, 14.4)) })
        txt('错误记在 ReplicaSet 事件里', 1232, 824, { size: 18, color: C.mute, alpha: E.out(P(t, 14.6, 15)) })
      }
    })
  },
}

ANIM({
  id: 'probes-resources',
  meta: { stage: 2, lesson: 1, of: 7, title: '健康检查与资源管理', summary: '三种探针、requests/limits、QoS 等级、LimitRange 与 ResourceQuota。', next: '存储：Volume、PV、PVC 与 StorageClass' },
  scenes: [
    lessonIntro({ tags: ['livenessProbe', 'readinessProbe', 'requests/limits', 'QoS', 'ResourceQuota'], vo: [[3.2, '进程活着，不等于服务可用。']] }),
    probes, readyLive, reqLim, qos, guard,
    lessonOutro({
      points: ['startup / readiness / liveness 各司其职', 'requests 管调度，limits 管运行时上限', 'CPU 超限被限流，内存超限 OOMKilled', 'QoS 定驱逐顺序，LimitRange + Quota 做治理'],
      vo: [[0.8, '小结：探针管健康，资源声明管公平。'], [5.6, '下一课，给应用接上持久存储。']],
    }),
  ],
})
})()
