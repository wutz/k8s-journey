/* 第 2 阶段 · 第 6 课：调度：亲和性、污点与拓扑分布 */
(() => {
const COL = STAGES[2].color

// 小勾 / 小叉徽标
function mark(x, y, ok, a) {
  if (a <= 0) return
  withA(a, () => { ctx.save(); ctx.fillStyle = ok ? tint(C.green, .16) : tint(C.red, .14); ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ok ? check(x, y, 18, C.green, 1) : cross(x, y, 14, C.red, 1) })
}
// 两点间插值位置
const mv = (a, b, p) => { const e = E.inOut(clamp(p)); return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)] }
// 抖动（t0 起 dur 秒内衰减）
const shk = (t, t0, dur = .6) => t > t0 && t < t0 + dur ? Math.sin(t * 70) * 7 * (1 - (t - t0) / dur) : 0

// 场景 1：过滤 → 打分 → 绑定
const HARD = C.violet, SOFT = COL
const N1 = [
  ['control-plane', 'taint: control-plane:NoSchedule', false, '污点无法容忍'],
  ['worker', 'zone-a · disktype=ssd', true],
  ['worker2', 'zone-b · disktype=hdd', true],
  ['worker3', 'zone-c', false, 'zone-c 不在 [a, b] 中'],
]
const PH = [['① 过滤 Filter', 760], ['② 打分 Score', 1180], ['③ 绑定 Bind', 1600]]
const filter = {
  name: '过滤与打分', dur: 17, mood: 1,
  vo: [[0.6, '调度器分三步：过滤、打分、绑定。'],
    [5.6, '硬约束在过滤阶段生效，全不满足就 Pending。'],
    [11.0, '软偏好只加分，分最高的节点胜出。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], [1.6, 'pop'], [2.0, 'pop'], [2.6, 'tick'], [3.6, 'tick'], [4.6, 'tick'],
    [6.0, 'error'], [6.6, 'ok'], [7.2, 'ok'], [7.8, 'error'], [11.2, 'tick'], [12.2, 'pop'], [13.0, 'chime'], [13.6, 'whoosh'], [14.4, 'ok']],
  draw(t) {
    heading('调度器如何做决定', 140, 210, t, .2, { eyebrow: 'FILTER · SCORE · BIND', color: COL })
    const ph = t < 2.6 ? -1 : t < 5.6 ? Math.min(2, Math.floor(t - 2.6)) : t < 11 ? 0 : t < 13.4 ? 1 : 2
    PH.forEach(([s, x], i) => {
      const a = E.out(P(t, 1.2 + i * .4, 1.7 + i * .4)); if (a <= 0) return
      if (i) arrow(PH[i - 1][1] + 112, 300, x - 112, 300, a, C.hairD, 2)
      chip(s, x, 300, { size: 22, font: SANS, col: ph === i ? COL : C.mute, solid: ph === i, alpha: a })
    })
    // 待调度 Pod 与约束
    chip('required · zone In [a, b]', 290, 664, { size: 17, col: HARD, alpha: E.out(P(t, 1.0, 1.5)) })
    chip('preferred · disktype=ssd', 290, 710, { size: 17, col: SOFT, alpha: E.out(P(t, 1.2, 1.7)) })
    const nn = E.back(P(t, 14.4, 14.9))
    if (nn > 0) chip('spec.nodeName: worker', 290, 500, { size: 18, col: C.green, solid: true, alpha: clamp(nn) })
    // 节点行
    N1.forEach(([n, lab, ok, why], i) => {
      const y = 360 + i * 118, a = E.out(P(t, .8 + i * .2, 1.3 + i * .2)); if (a <= 0) return
      const ft = 6 + i * .6, dim = t >= ft + .3 && !ok ? .45 : 1, win1 = i === 1 && t >= 13
      withA(a * dim, () => {
        node(560, y, 520, 96, n, { tag: i === 0 ? 'NoSchedule' : null, accent: C.red })
        txt(lab, 584, y + 76, { size: 18, font: MONO, color: C.body })
        if (win1) panel(560, y, 520, 96, { r: 14, fill: hexA(C.green, .04), stroke: C.green, lw: 3, shadow: false })
      })
      mark(1140, y + 48, ok, E.out(P(t, ft, ft + .3)))
      if (!ok) withA(E.out(P(t, ft + .2, ft + .6)), () => txt(why, 1176, y + 55, { size: 20, color: C.red }))
      if (ok) {
        const b1 = E.out(P(t, 11.2 + (i - 1) * .2, 11.9 + (i - 1) * .2)), b2 = i === 1 ? E.out(P(t, 12.2, 12.8)) : 0
        if (b1 > 0) {
          withA(b1, () => {
            ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(1180, y + 34, 460, 28, 14); ctx.fill()
            ctx.fillStyle = tint(C.blue, .5); rr(1180, y + 34, 460 * .6 * b1, 28, 14); ctx.fill()
            if (b2 > 0) { ctx.fillStyle = COL; rr(1180 + 460 * .6 - 14, y + 34, 460 * .25 * b2 + 14, 28, 14); ctx.fill() }
            ctx.restore()
            txt(String(Math.round(60 * b1 + 25 * b2)), 1760, y + 58, { size: 28, weight: 700, font: MONO, color: win1 ? C.green : C.text, align: 'right' })
          })
          if (i === 1) withA(b2, () => txt('ssd +25', 1462, y + 22, { size: 17, font: MONO, color: COL }))
        }
      }
    })
    const bp = E.inOut(P(t, 13.6, 14.4))
    const pa = E.out(P(t, .6, 1.2))
    pod(lerp(290, 1010, bp), lerp(500, 546, bp), 120, { state: t >= 14.4 ? 'run' : 'pending', label: bp > 0 ? null : 'web', sub: bp > 0 ? null : 'Pending', scale: lerp(1, .42, bp), alpha: pa })
    chip('硬约束 → 过滤：不满足就剔除，全剔除则 Pending', 560, 850, { size: 18, font: SANS, align: 'left', col: HARD, alpha: E.out(P(t, 8.6, 9.1)) })
    chip('软偏好 → 打分：只加分，不剔除', 1780, 850, { size: 18, font: SANS, align: 'right', col: SOFT, alpha: E.out(P(t, 11.4, 11.9)) })
  },
}

// 场景 2：污点与容忍
const SLOT1 = [[270, 440], [510, 440], [270, 590], [510, 590]]
const SRC = [800, 800], BOUNCE = [950, 704], OLD = [840, 460], TOL = [1050, 460]
const TN = [1.8, 2.5, 3.2]
const EFF = [['NoSchedule', '不调度', '不受影响'], ['PreferNoSchedule', '尽量不调度', '不受影响'], ['NoExecute', '不调度', '驱逐']]
const taints = {
  name: '污点与容忍', dur: 16, mood: 2,
  vo: [[0.6, '污点让节点拒绝 Pod，除非 Pod 带着容忍。'],
    [5.6, 'NoExecute 更狠：已在运行的 Pod 也会被驱逐。', 'No Execute 更狠：已经在运行的 Pod 也会被驱逐。'],
    [10.8, '容忍不等于吸引，专用节点还要配亲和性。']],
  cues: [[0.4, 'whoosh'], [1.2, 'lock'], ...TN.map(t0 => [t0 + .5, 'thud']), [4.5, 'ok'], [5.8, 'tick'], [6.2, 'tick'], [6.6, 'tick'],
    [7.6, 'alarmSoft'], [8.3, 'poof'], [9.0, 'pop'], [11.0, 'pop'], [11.5, 'pop'], [12.0, 'pop'], [12.6, 'chime']],
  draw(t) {
    heading('污点与容忍：节点拒绝 Pod', 140, 210, t, .2, { eyebrow: 'TAINTS · TOLERATIONS', color: COL })
    const na = E.out(P(t, .5, 1)), ta = E.out(P(t, 1.2, 1.7)), noExec = t >= 7.6
    node(140, 300, 500, 380, 'worker', { alpha: na })
    node(700, 300, 500, 380, 'worker2', { alpha: na, tag: ta > 0 ? (noExec ? 'dedicated=gpu:NoExecute' : 'dedicated=gpu:NoSchedule') : null, accent: C.red })
    if (ta > 0) {
      withA(ta, () => panel(700, 300, 500, 380, { r: 14, fill: hexA(C.red, .025), stroke: hexA(C.red, .55), lw: 2.5, dash: [10, 8], shadow: false }))
      withA(ta, () => shield(950, 630, 30, C.red, .1))
      chip(`kubectl taint nodes worker2 dedicated=gpu:${noExec ? 'NoExecute' : 'NoSchedule'}`, 140, 730, { size: 18, align: 'left', col: noExec ? C.red : C.body, alpha: ta })
    }
    gpu(1140, 392, 40, C.violet, na)
    // 调度器出发点
    withA(win(t, .6, 10.4), () => chip('新 Pod', SRC[0], 846, { size: 18, font: SANS, col: C.mute }))
    // 普通 Pod：撞上污点后改去 worker
    TN.forEach((t0, i) => {
      if (t < t0) return
      const p1 = P(t, t0, t0 + .5), p2 = P(t, t0 + .6, t0 + 1.2)
      const pos = p2 > 0 ? mv(BOUNCE, SLOT1[i], p2) : mv(SRC, BOUNCE, p1)
      pod(pos[0], pos[1], 80, { state: C.blue, alpha: E.out(P(t, t0, t0 + .2)) })
      ring(BOUNCE[0], BOUNCE[1], P(t, t0 + .45, t0 + 1.1), C.red, 80)
      withA(win(t, t0 + .45, t0 + 1.3, .2), () => cross(BOUNCE[0] + 60, BOUNCE[1] - 10, 14, C.red, 1))
    })
    // 原有 Pod：NoExecute 时被驱逐，到 worker 重建
    const oa = t < 8.3 ? na : 0
    pod(OLD[0] + shk(t, 7.6, .7), OLD[1], 80, { state: C.teal, label: 'old', alpha: oa })
    poof(OLD[0], OLD[1], P(t, 8.3, 9.1), C.red)
    travel(OLD[0], OLD[1], SLOT1[3][0], SLOT1[3][1], P(t, 8.4, 9.0), C.teal, 7)
    if (t >= 9.0) pod(SLOT1[3][0], SLOT1[3][1], 80, { state: C.teal, label: 'old', scale: E.back(P(t, 9, 9.4)) })
    withA(win(t, 8.3, 10.6), () => chip('已运行也被驱逐', OLD[0], OLD[1] + 96, { size: 17, font: SANS, col: C.red, solid: true }))
    // 带容忍的 Pod：进入 worker2
    if (t >= 3.9) {
      const p = P(t, 3.9, 4.6), pos = mv(SRC, TOL, p)
      pod(pos[0], pos[1], 80, { state: C.violet, label: p >= 1 ? 'gpu-job' : null, alpha: E.out(P(t, 3.9, 4.1)) })
      ring(TOL[0], TOL[1], P(t, 4.5, 5.3), C.green, 90)
      chip('tolerations ✓', TOL[0], TOL[1] + 96, { size: 16, col: C.violet, alpha: E.out(P(t, 4.6, 5)) })
    }
    // effect 对照表
    const X = 1260, Y = 300, Wt = 520
    const tb = E.out(P(t, 5.4, 5.9))
    if (tb > 0) {
      withA(tb, () => {
        panel(X, Y, Wt, 380, { r: 18 })
        txt('effect', X + 24, Y + 50, { size: 18, font: MONO, color: C.mute })
        txt('新 Pod', X + 320, Y + 50, { size: 18, color: C.mute, align: 'center' })
        txt('已运行', X + 450, Y + 50, { size: 18, color: C.mute, align: 'center' })
        line(X, Y + 74, X + Wt, Y + 74, C.hair, 1)
      })
      const cur = t < 7.6 ? 0 : t < 10.8 ? 2 : -1
      EFF.forEach(([e, a, b], i) => {
        const ra = E.out(P(t, 5.8 + i * .4, 6.2 + i * .4)); if (ra <= 0) return
        const y = Y + 128 + i * 90, on = cur === i, c = i === 2 ? C.red : C.text
        withA(ra, () => {
          if (on) { ctx.save(); ctx.fillStyle = tint(i === 2 ? C.red : COL, .08); rr(X + 10, y - 40, Wt - 20, 76, 12); ctx.fill(); ctx.restore() }
          if (i) line(X + 20, y - 45, X + Wt - 20, y - 45, C.hair, 1)
          txt(e, X + 24, y + 7, { size: 19, font: MONO, color: i === 2 ? C.red : C.text, weight: 600 })
          txt(a, X + 320, y + 7, { size: 20, color: C.body, align: 'center' })
          txt(b, X + 450, y + 7, { size: 20, color: i === 2 ? C.red : C.body, align: 'center', weight: i === 2 ? 700 : 500 })
        })
      })
      void cur
    }
    // 容忍 ≠ 吸引：三者配合
    const fa = E.out(P(t, 10.8, 11.3))
    if (fa > 0) {
      txt('容忍 ≠ 吸引', 140, 822, { size: 28, weight: 700, color: C.violet, alpha: fa })
      let x = 360
      ;[['污点：挡住别人', C.red, 11.0], ['容忍：允许进入', C.violet, 11.5], ['节点亲和：把自己引过去', COL, 12.0]].forEach(([s, c, t0], i) => {
        const a = E.out(P(t, t0, t0 + .4))
        if (i) { txt('+', x + 16, 822, { size: 28, color: C.mute, align: 'center', alpha: a }); x += 34 }
        const w = chip(s, x + 12, 812, { size: 20, font: SANS, align: 'left', col: c, alpha: a }) || textW(s, 20) + 24
        x += w + 12
      })
      const ea = E.back(P(t, 12.6, 13))
      if (ea > 0) { txt('=', x + 16, 822, { size: 28, color: C.mute, align: 'center', alpha: clamp(ea) }); chip('专用节点', x + 46, 812, { size: 22, font: SANS, align: 'left', col: C.green, solid: true, alpha: clamp(ea) }) }
    }
  },
}

// 场景 3：反亲和与拓扑分布
const ZA = 1000, ZB = 1410
const zslot = (x0, k) => [x0 + 75 + (k % 3) * 110, 450 + Math.floor(k / 3) * 116]
const spread = {
  name: '拓扑分布', dur: 16, mood: 3,
  vo: [[0.6, '硬反亲和：一个节点一个副本，多余的 Pending。'],
    [5.6, '拓扑分布更灵活：只限制各区副本数之差。'],
    [10.8, 'maxSkew 为 1：3/3、4/3 可以，5/3 不行。', 'max Skew 为一：三比三、四比三可以，五比三不行。']],
  cues: [[0.4, 'whoosh'], [1.2, 'pop'], [1.8, 'pop'], [2.6, 'pop'], [3.2, 'error'], [3.5, 'error'], ...[0, 1, 2, 3, 4, 5].map(k => [6.0 + k * .45, 'pop']),
    [11.4, 'pop'], [11.8, 'ok'], [13.0, 'pop'], [13.5, 'error'], [14.6, 'chime']],
  draw(t) {
    heading('反亲和与拓扑分布：把副本打散', 140, 210, t, .2, { eyebrow: 'TOPOLOGY SPREAD', color: COL })
    // 左：podAntiAffinity
    const la = E.out(P(t, .5, 1)), leftDim = t >= 5.6 ? .55 : 1
    withA(leftDim, () => {
      chip('podAntiAffinity · required · hostname', 140, 300, { size: 17, align: 'left', col: HARD, alpha: la })
      node(140, 340, 360, 300, 'worker', { alpha: la })
      node(540, 340, 360, 300, 'worker2', { alpha: la })
      pod(320, 500, 90, { state: 'run', label: 'web-1', scale: E.back(P(t, 1.2, 1.6)) })
      pod(720, 500, 90, { state: 'run', label: 'web-2', scale: E.back(P(t, 1.8, 2.2)) })
      const r3 = E.out(P(t, 2.6, 3.0))
      if (r3 > 0) {
        curve(490, 740, 330, 580, 30, E.out(P(t, 2.9, 3.2)), hexA(C.red, .5), 2, { dash: [6, 6] })
        curve(550, 740, 710, 580, -30, E.out(P(t, 3.1, 3.4)), hexA(C.red, .5), 2, { dash: [6, 6] })
        mark(395, 640, false, E.out(P(t, 3.2, 3.4))); mark(645, 640, false, E.out(P(t, 3.5, 3.7)))
        pod(520 + shk(t, 3.2, .6), 770, 80, { state: 'pending', label: 'web-3', sub: 'Pending', alpha: r3 })
        withA(E.out(P(t, 4.0, 4.4)), () => { txt('每个节点都已有', 600, 764, { size: 18, color: C.red }); txt('app=web 的 Pod', 600, 790, { size: 18, font: MONO, color: C.red }) })
      }
    })
    withA(E.out(P(t, 5.4, 5.9)), () => line(950, 290, 950, 870, C.hair, 1.5))
    // 右：topologySpreadConstraints
    const ra = E.out(P(t, 5.6, 6.1))
    if (ra <= 0) return
    withA(ra, () => {
      chip('topologySpreadConstraints · maxSkew: 1 · zone', 1000, 300, { size: 17, align: 'left', col: COL })
      ;[[ZA, 'zone-a'], [ZB, 'zone-b']].forEach(([x0, z]) => {
        panel(x0, 340, 370, 300, { r: 18, fill: tint(COL, .03), stroke: hexA(COL, .5), dash: [10, 8], lw: 2, shadow: false })
        chip(z, x0 + 20, 368, { size: 16, align: 'left', col: COL })
      })
    })
    let na = 0, nb = 0
    for (let k = 0; k < 6; k++) {
      const t0 = 6.0 + k * .45; if (t < t0) continue
      const inA = k % 2 === 0, idx = Math.floor(k / 2), [x, y] = zslot(inA ? ZA : ZB, idx)
      const e = E.out(P(t, t0, t0 + .35))
      pod(x, y - lerp(40, 0, e), 76, { state: 'run', alpha: e })
      inA ? na++ : nb++
    }
    // 第 7 个：4/3 允许
    if (t >= 11.4) { const [x, y] = zslot(ZA, 3), e = E.out(P(t, 11.4, 11.75)); pod(x, y - lerp(40, 0, e), 76, { state: 'run', alpha: e }); na++; mark(x + 44, y - 36, true, E.out(P(t, 11.8, 12.1))) }
    // 第 8 个：5/3 拒绝
    const g = t >= 13.0 && t < 14.6
    if (g) {
      const [x, y] = zslot(ZA, 4), e = E.out(P(t, 13.0, 13.35))
      withA(lerp(.7, 0, P(t, 14.1, 14.6)), () => { pod(x + shk(t, 13.5, .6), y - lerp(40, 0, e), 76, { state: C.red, alpha: e }); mark(x + 44, y - 36, false, E.out(P(t, 13.5, 13.8))) })
    }
    // 计数与 skew
    const ca = E.out(P(t, 6.2, 6.7))
    const tryA = t >= 13.3 && t < 14.4 ? na + 1 : na, skew = Math.abs(tryA - nb), bad = skew > 1
    withA(ca, () => {
      txt(String(tryA), ZA + 185, 736, { size: 60, weight: 700, font: MONO, color: bad ? C.red : C.text, align: 'center' })
      txt(String(nb), ZB + 185, 736, { size: 60, weight: 700, font: MONO, color: C.text, align: 'center' })
      chip(`skew = |${tryA} − ${nb}| = ${skew} ${bad ? '> 1 → 拒绝' : '≤ 1 ✓'}`, 1390, 822, { size: 20, col: bad ? C.red : C.green, solid: bad })
    })
  },
}

// 场景 4：优先级与抢占
const LOW1 = [940, 460], LOW2 = [1260, 460], QUE = [1000, 780]
const TIERS = [['system-*-critical', '平台组件', '20 亿', C.amber], ['high-priority', '在线服务', '100000', C.violet], ['low-priority', '离线批处理', '1000', C.blue]]
const priority = {
  name: '优先级与抢占', dur: 16, mood: 4,
  vo: [[0.6, 'PriorityClass 给 Pod 一个整数优先级。', 'Priority Class 给 Pod 一个整数优先级。'],
    [5.6, '资源不足时，高优先级 Pod 会抢占低优先级的。'],
    [10.8, '至少分三档：平台组件、在线服务、离线批处理。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [2.4, 'pop'], [2.8, 'pop'], [5.8, 'pop'], [6.6, 'error'], [7.2, 'alarmSoft'], [7.8, 'poof'],
    [8.4, 'whoosh'], [9.1, 'ok'], [9.6, 'tick'], [11.0, 'tick'], [11.4, 'tick'], [11.8, 'tick'], [12.6, 'chime']],
  draw(t) {
    heading('优先级与抢占', 140, 210, t, .2, { eyebrow: 'PRIORITY · PREEMPTION', color: COL })
    // PriorityClass 卡片
    ;[['high-priority', 'value: 100000', C.violet, 300], ['low-priority', 'value: 1000', C.blue, 430]].forEach(([n, v, c, y], i) => {
      const a = E.out(P(t, 1.0 + i * .4, 1.5 + i * .4)); if (a <= 0) return
      withA(a * (t >= 10.8 ? .5 : 1), () => {
        panel(140 + lerp(-30, 0, a), y, 540, 110, { r: 16, stroke: hexA(c, .5) })
        chip('PriorityClass', 656, y + 30, { size: 15, align: 'right', col: C.mute })
        txt(n, 170, y + 50, { size: 26, weight: 700, font: MONO, color: c })
        txt(v, 170, y + 88, { size: 20, font: MONO, color: C.body })
      })
    })
    // 节点与 CPU
    const na = E.out(P(t, 1.8, 2.3))
    node(760, 290, 1020, 390, 'worker', { alpha: na, tag: 'CPU 8 核', accent: C.mute })
    const lowGone = t >= 7.8, vipIn = P(t, 8.4, 9.1)
    pod(LOW1[0], LOW1[1], 110, { state: C.blue, label: 'low-1', sub: 'Running', scale: E.back(P(t, 2.4, 2.8)) })
    if (!lowGone) pod(LOW2[0] + shk(t, 7.2, .6), LOW2[1], 110, { state: C.blue, label: 'low-2', sub: 'Running', scale: E.back(P(t, 2.8, 3.2)) })
    poof(LOW2[0], LOW2[1], P(t, 7.8, 8.6), C.blue)
    withA(win(t, 7.8, 8.8, .2), () => chip('Preempted', LOW2[0], LOW2[1] - 86, { size: 18, col: C.red, solid: true }))
    // 空位
    withA(na * (1 - P(t, 8.4, 8.8)), () => { ctx.save(); hexPath(1580, 460, 50); ctx.setLineDash([6, 6]); ctx.strokeStyle = C.faint; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
      txt('空闲', 1580, 537, { size: 17, color: C.mute, align: 'center' }) })
    // CPU 条
    const BX = 800, BW = 940, BY = 616
    withA(na, () => {
      txt('CPU requests', BX, 604, { size: 17, font: MONO, color: C.mute })
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(BX, BY, BW, 28, 14); ctx.fill()
      const l1 = E.out(P(t, 2.4, 2.9)) * .4, l2 = E.out(P(t, 2.8, 3.3)) * .4 * (1 - E.inOut(P(t, 7.8, 8.2))), vp = E.out(vipIn) * .4
      ctx.fillStyle = tint(C.blue, .55); rr(BX, BY, BW * l1, 28, 14); ctx.fill()
      if (l2 > 0) { ctx.fillStyle = tint(C.blue, .35); rr(BX + BW * .4, BY, BW * l2, 28, 14); ctx.fill() }
      if (vp > 0) { ctx.fillStyle = tint(C.violet, .6); rr(BX + BW * .4, BY, BW * vp, 28, 14); ctx.fill() }
      ctx.restore()
      txt(`${Math.round((l1 + l2 + vp) * 100)}%`, BX + BW - 12, 604, { size: 17, font: MONO, color: C.body, align: 'right' })
    })
    // vip 需要 40% 却只剩 20%
    withA(win(t, 6.2, 8.0, .3), () => {
      ctx.save(); rr(BX + BW * .8, BY - 4, BW * .2, 36, 12); ctx.setLineDash([6, 5]); ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
    })
    // 调度队列里的 vip
    const va = E.out(P(t, 5.6, 6.1))
    if (va > 0 && vipIn < 1) {
      const pos = mv(QUE, LOW2, vipIn)
      pod(pos[0], pos[1], lerp(80, 110, E.inOut(vipIn)), { state: C.violet, label: vipIn > 0 ? null : 'vip', sub: vipIn > 0 ? null : 'Pending', alpha: va })
      withA(E.out(P(t, 6.6, 7)) * (1 - P(t, 8.2, 8.5)), () => txt('需要 40% CPU，只剩 20%', 1060, 790, { size: 20, color: C.red }))
    }
    if (vipIn >= 1) pod(LOW2[0], LOW2[1], 110, { state: C.violet, label: 'vip', sub: 'Running' })
    // 被抢占的 low-2 重建后 Pending
    const ra = E.out(P(t, 9.6, 10.1))
    if (ra > 0) {
      pod(QUE[0], QUE[1], 80, { state: 'pending', label: 'low-2', sub: 'Pending', alpha: ra })
      withA(ra, () => txt('重建后资源不足，继续等待', 1060, 790, { size: 20, color: C.mute }))
    }
    withA(E.out(P(t, 5.6, 6.1)), () => txt('调度队列', 860, 786, { size: 18, color: C.mute, align: 'right' }))
    // 三档优先级
    TIERS.forEach(([n, d, v, c], i) => {
      const a = E.out(P(t, 11.0 + i * .4, 11.4 + i * .4)); if (a <= 0) return
      const y = 580 + i * 98
      withA(a, () => {
        panel(140 + lerp(-30, 0, a), y, 540, 84, { r: 14, stroke: hexA(c, .55), fill: tint(c, .05) })
        chip(n, 164, y + 42, { size: 17, align: 'left', col: c, solid: true })
        txt(d, 380, y + 50, { size: 20, color: C.text })
        txt(v, 656, y + 50, { size: 18, font: MONO, color: C.mute, align: 'right' })
      })
    })
  },
}

// 场景 5：cordon 与 drain
const DR = [
  { t: .8, cmd: 'kubectl cordon worker2' },
  { t: 1.9, out: 'node/worker2 cordoned', color: C.amber },
  { t: 2.6, cmd: 'kubectl get nodes' },
  { t: 3.4, out: 'worker2   Ready,SchedulingDisabled', color: C.amber },
  { t: 5.6, cmd: 'kubectl drain worker2 --ignore-daemonsets --delete-emptydir-data' },
  { t: 7.9, out: 'evicting pod web' },
  { t: 8.6, out: 'evicting pod api-b' },
  { t: 10.6, out: 'Cannot evict pod api-c: would violate', color: C.red, sfx: 'error' },
  { t: 10.9, out: "the pod's disruption budget. Retrying…", color: C.red },
  { t: 13.2, out: 'pod/api-c evicted', color: C.green },
  { t: 14.0, out: 'node/worker2 drained', color: C.green, sfx: 'ok' },
]
const NX1 = 1100, NX2 = 1460
const dslot = (x0, k) => [x0 + 90 + (k % 2) * 140, 410 + Math.floor(k / 2) * 136]
// [名称, 颜色, 旧位置(worker2 槽位), 驱逐时刻, 新位置(worker 槽位), 就绪时刻]
const MOVE = [['web', C.blue, 0, 8.2, 1, 9.3], ['api-b', C.violet, 1, 8.9, 2, 12.4], ['api-c', C.violet, 2, 13.2, 3, 14.4]]
const drain = {
  name: '节点维护', dur: 16, mood: 2,
  vo: [[0.6, '维护节点前，先 cordon 标记为不可调度。', '维护节点前，先 cordon，把它标记为不可调度。'],
    [5.6, 'drain 逐个驱逐 Pod，让它们去别处重建。'],
    [10.6, '驱逐遵守 PDB，可用副本不会低于下限。', '驱逐遵守 P D B，可用副本不会低于下限。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DR, 30), [2.0, 'lock'], [8.2, 'poof'], [8.9, 'poof'], [10.6, 'lock'], [12.4, 'ok'], [13.2, 'poof'], [14.6, 'chime']],
  draw(t) {
    heading('节点维护：cordon 与 drain', 140, 210, t, .2, { eyebrow: 'CORDON · DRAIN', color: COL })
    terminal(140, 280, 900, 440, t, DR, { size: 19, alpha: E.out(P(t, .3, .8)) })
    // 说明
    chip('--ignore-daemonsets：DaemonSet 的 Pod 跳过', 140, 772, { size: 17, align: 'left', col: C.mute, alpha: E.out(P(t, 7.6, 8.1)) })
    chip('维护完成后 kubectl uncordon worker2', 140, 826, { size: 17, align: 'left', col: COL, alpha: E.out(P(t, 14.4, 14.9)) })
    // 节点
    const na = E.out(P(t, .6, 1.1)), cord = E.out(P(t, 2.0, 2.4))
    node(NX1, 280, 320, 380, 'worker', { alpha: na })
    node(NX2, 280, 320, 380, 'worker2', { alpha: na, tag: cord > 0 ? 'SchedulingDisabled' : null, accent: C.amber })
    if (cord > 0) withA(cord, () => panel(NX2, 280, 320, 380, { r: 14, fill: hexA(C.amber, .04), stroke: hexA(C.amber, .7), lw: 2.5, dash: [10, 8], shadow: false }))
    // worker 上原有 api-a
    const [ax, ay] = dslot(NX1, 0)
    pod(ax, ay, 80, { state: C.violet, label: 'api-a', alpha: na })
    // DaemonSet Pod 不动
    const [dx, dy] = dslot(NX2, 3)
    pod(dx, dy, 80, { state: C.teal, label: t >= 7.9 ? 'ds · 保留' : 'ds', alpha: na })
    // 迁移中的 Pod
    MOVE.forEach(([n, c, from, te, to, tr]) => {
      const [fx, fy] = dslot(NX2, from), [tx, ty] = dslot(NX1, to)
      const blocked = n === 'api-c' && t >= 10.6 && t < 13.2
      if (t < te) pod(fx + shk(t, te - .5, .5) + (blocked ? shk(t, 10.6, .8) : 0), fy, 80, { state: c, label: n, alpha: na })
      if (blocked) withA(E.out(P(t, 10.6, 10.9)), () => { ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + 34, fy - 34, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore(); lock(fx + 34, fy - 38, 22, C.red) })
      poof(fx, fy, P(t, te, te + .8), c)
      travel(fx, fy, tx, ty, P(t, te + .05, te + .5), c, 7)
      if (t >= te + .5) pod(tx, ty, 80, { state: t >= tr ? c : 'pending', label: n, scale: E.back(P(t, te + .5, te + .9)) })
    })
    // PDB
    const avail = 1 + (t < 8.9 || t >= 12.4 ? 1 : 0) + (t < 13.2 || t >= 14.4 ? 1 : 0)
    const blocked = t >= 10.6 && t < 12.4
    const pa = E.out(P(t, 10.4, 10.9))
    if (pa > 0) {
      withA(pa, () => {
        panel(NX1, 700, 680, 170, { r: 16, stroke: blocked ? C.red : C.hair, lw: blocked ? 2.2 : 1.5, fill: blocked ? tint(C.red, .04) : C.panel })
        txt('PodDisruptionBudget', NX1 + 24, 744, { size: 20, font: MONO, weight: 600, color: C.text })
        txt('minAvailable: 2 · app=api', NX1 + 24, 784, { size: 18, font: MONO, color: C.body })
        txt(blocked ? '再驱逐就低于下限 → 等待' : '有余量 → 放行', NX1 + 24, 838, { size: 20, color: blocked ? C.red : C.green })
        txt('可用', NX1 + 520, 812, { size: 20, color: C.mute, align: 'right' })
        txt(`${avail}/3`, NX1 + 656, 818, { size: 44, weight: 700, font: MONO, color: avail <= 2 ? C.amber : C.green, align: 'right' })
      })
    }
  },
}

ANIM({
  id: 'scheduling',
  meta: { stage: 2, lesson: 6, of: 7, title: '调度：亲和性、污点与拓扑分布', summary: 'nodeSelector、亲和/反亲和、污点与容忍、topologySpreadConstraints、优先级。', next: '用 Helm 与 Kustomize 管理应用' },
  scenes: [
    lessonIntro({ tags: ['nodeAffinity', 'Taint', 'Toleration', 'topologySpread', 'PriorityClass'], vo: [[3.2, '调度：决定每个 Pod 落在哪个节点。']] }),
    filter, taints, spread, priority, drain,
    lessonOutro({
      points: ['硬约束在过滤阶段剔除节点，软偏好只打分', '污点挡住 Pod，容忍放行，亲和性吸引', '反亲和一节点一副本，拓扑分布限制副本差', '优先级决定抢占，cordon + drain 安全维护'],
      vo: [[0.8, '小结：硬约束过滤，软偏好打分。'], [5.4, '下一课，用 Helm 和 Kustomize 管理应用。']],
    }),
  ],
})
})()
