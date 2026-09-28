/* 第 2 阶段 · 第 2 课：存储：Volume、PV、PVC 与 StorageClass */
(() => {
const COL = STAGES[2].color

// 本地小工具：带图标的一行结论
const verdict = (ok, s, x, y, a, col) => {
  if (a <= 0) return
  withA(a, () => {
    if (ok) check(x + 14, y - 8, 26, col || C.green, 1); else cross(x + 14, y - 8, 22, col || C.red, 1)
    txt(s, x + 42, y, { size: 22, color: C.text, weight: 500 })
  })
}
// 本地小工具：小容器方块
const ctr = (cx, cy, name, col, a, bad) => withA(a, () => {
  panel(cx - 100, cy - 60, 200, 120, { r: 14, stroke: bad ? C.red : C.hair, fill: bad ? tint(C.red, .06) : '#fff' })
  cube(cx, cy - 12, 24, bad ? C.red : col)
  txt(name, cx, cy + 40, { size: 20, font: MONO, align: 'center', color: bad ? C.red : C.text })
})

// ---------- 场景 1：临时卷 vs 持久卷 ----------
const ephPer = {
  name: '临时卷 vs 持久卷', dur: 16, mood: 1,
  vo: [[0.6, 'emptyDir 与 Pod 同生共死。'],
    [4.4, '容器重启数据还在，Pod 删除就没了。'],
    [10.2, '持久卷独立于 Pod，重建后原样挂回。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [5.0, 'error'], [6.2, 'ok'], [8.2, 'poof'], [8.6, 'tick'], [10.8, 'poof'], [11.6, 'tick'], [12.8, 'pop'], [13.4, 'lock'], [14.2, 'chime']],
  draw(t) {
    heading('临时卷 vs 持久卷', 140, 210, t, .2, { eyebrow: 'EPHEMERAL vs PERSISTENT', color: COL })
    // 左：emptyDir
    const la = E.out(P(t, .6, 1.1)), gone = E.inOut(P(t, 8.2, 8.9))
    withA(la, () => {
      chip('emptyDir', 180, 296, { size: 22, col: COL, solid: true, align: 'left' })
      txt('随 Pod 创建和删除', 340, 303, { size: 20, color: C.mute })
    })
    withA(la * (1 - gone), () => {
      panel(180, 340, 700, 350, { r: 22, fill: tint(COL, .03), stroke: hexA(COL, .5), dash: [10, 8], lw: 2, shadow: false })
      txt('Pod · emptydir-demo', 204, 374, { size: 18, font: MONO, color: C.mute })
      const crash = t >= 5 && t < 6.2
      ctr(340 + (crash ? Math.sin(t * 60) * 5 * (1 - P(t, 5, 5.5)) : 0), 460, t >= 6.2 && t < 7.6 ? 'writer ↻' : 'writer', COL, E.out(P(t, 1, 1.4)), crash)
      ctr(720, 460, 'reader', C.violet, E.out(P(t, 1.3, 1.7)))
      cylinder(530, 590, 150, 44, C.teal, null, E.out(P(t, 1.6, 2.1)))
      withA(E.out(P(t, 1.6, 2.1)), () => {
        txt('/data', 444, 600, { size: 18, font: MONO, align: 'right', color: C.teal })
        partialLine(400, 522, 470, 568, 1, hexA(C.teal, .6), 2)
        partialLine(660, 522, 590, 568, 1, hexA(C.teal, .6), 2)
        const n = t < 5 ? Math.floor(clamp((t - 2) / 3) * 6) + 1 : t < 6.2 ? 7 : 7 + Math.floor(clamp((t - 6.2) / 2) * 3)
        chip(`log.txt · ${n} 行`, 640, 640, { size: 18, col: C.teal, align: 'left' })
      })
      if (t > 2.2 && !(t >= 5 && t < 6.2) && t < 8.2) flow(400, 522, 470, 568, t, C.teal, 2, 1, 0, 4)
      ring(340, 460, P(t, 5, 5.9), C.red, 140); ring(340, 460, P(t, 6.2, 7), C.green, 140)
    })
    poof(530, 590, P(t, 8.2, 9.2), C.teal); poof(340, 460, P(t, 8.3, 9.3), COL); poof(720, 460, P(t, 8.3, 9.3), C.violet)
    withA(E.out(P(t, 8.8, 9.4)), () => {
      panel(180, 340, 700, 350, { r: 22, fill: 'rgba(0,0,0,0)', stroke: hexA(C.text, .18), dash: [10, 8], lw: 2, shadow: false })
      txt('Pod 已删除', 530, 500, { size: 28, weight: 600, color: C.mute, align: 'center' })
      txt('/data/log.txt 随之清空', 530, 544, { size: 20, font: MONO, color: C.mute, align: 'center' })
    })
    verdict(true, '容器重启：/data 里的数据还在', 190, 760, E.out(P(t, 6.4, 6.9)))
    verdict(false, 'Pod 删除：emptyDir 一起消失', 190, 820, E.out(P(t, 8.6, 9.1)))
    // 右：PVC
    const ra = E.out(P(t, 1.8, 2.3)) * (t < 9.8 ? .4 : lerp(.4, 1, E.out(P(t, 9.8, 10.4))))
    withA(ra, () => {
      line(940, 290, 940, 850, hexA(C.text, .1), 2, [6, 8])
      chip('persistentVolumeClaim', 1000, 296, { size: 22, col: C.blue, solid: t > 9.8, align: 'left' })
    })
    const del = E.inOut(P(t, 10.8, 11.4)), back = E.out(P(t, 12.8, 13.3))
    const pa = ra * (t < 12.8 ? 1 - del : back)
    withA(pa, () => {
      panel(1040, 340, 700, 200, { r: 22, fill: tint(C.blue, .03), stroke: hexA(C.blue, .5), dash: [10, 8], lw: 2, shadow: false })
      txt(t >= 12.8 ? 'Pod · pvc-user（新建）' : 'Pod · pvc-user', 1064, 374, { size: 18, font: MONO, color: C.mute })
      ctr(1390, 450, 'app', C.blue, 1)
    })
    poof(1390, 450, P(t, 10.8, 11.8), C.blue)
    withA(E.out(P(t, 11.2, 11.6)) * (1 - back), () => {
      panel(1040, 340, 700, 200, { r: 22, fill: 'rgba(0,0,0,0)', stroke: hexA(C.text, .18), dash: [10, 8], lw: 2, shadow: false })
      txt('Pod 已删除', 1390, 450, { size: 26, weight: 600, color: C.mute, align: 'center' })
    })
    const link = t < 10.8 ? 1 : t < 13.4 ? 0 : E.out(P(t, 13.4, 13.9))
    withA(ra, () => {
      if (link > 0) partialLine(1390, 540, 1390, 574, link, hexA(C.blue, .7), 3)
      chip('PVC data', 1390, 596, { size: 20, col: C.blue })
      partialLine(1390, 618, 1390, 660, 1, hexA(C.teal, .6), 2)
      cylinder(1390, 700, 150, 44, C.teal, 'PV · pvc-5f0c')
      chip(`hello.txt · ${t >= 13.8 ? 2 : 1} 行`, 1500, 700, { size: 18, col: C.teal, align: 'left' })
      chip('数据保留', 1280, 700, { size: 18, col: C.green, align: 'right', font: SANS, alpha: E.out(P(t, 11.6, 12)) })
    })
    ring(1390, 596, P(t, 13.4, 14.2), C.blue, 120)
    verdict(true, '数据活得比 Pod 久', 1000, 830, E.out(P(t, 14.2, 14.7)))
  },
}

// ---------- 场景 2：三层解耦 ----------
const layers = {
  name: 'PV / PVC / StorageClass', dur: 17, mood: 2,
  vo: [[0.6, '开发者只写 PVC：要多大、怎么访问。'],
    [5.4, '管理员建 StorageClass，按需自动造出 PV。'],
    [10.8, 'PV 与 PVC 一对一绑定，Pod 只认 PVC。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.8, 'pop'], [5.6, 'pop'], [6.6, 'zap'], [7.6, 'tick'], [8.4, 'tick'], [11.0, 'lock'], [13.2, 'chime']],
  draw(t) {
    heading('PV、PVC 与 StorageClass', 140, 210, t, .2, { eyebrow: 'THREE LAYERS', color: COL })
    const dA = E.out(P(t, .6, 1.1)), aA = E.out(P(t, 5.4, 5.9))
    // 两条泳道
    withA(dA, () => {
      panel(140, 290, 1640, 210, { r: 20, fill: tint(C.blue, .03), stroke: hexA(C.blue, .3), shadow: false })
      txt('开发者', 176, 386, { size: 26, weight: 700, color: C.blue })
      txt('只写 PVC', 176, 422, { size: 18, color: C.mute })
    })
    withA(aA, () => {
      panel(140, 580, 1640, 250, { r: 20, fill: tint(C.violet, .03), stroke: hexA(C.violet, .3), shadow: false })
      txt('管理员', 176, 696, { size: 26, weight: 700, color: C.violet })
      txt('装 CSI · 建 SC', 176, 732, { size: 18, color: C.mute })
    })
    // 开发者：Pod → PVC
    box(470, 395, 230, 110, 'Pod', 'pvc-user', C.blue, { alpha: E.out(P(t, 1, 1.4)), size: 28 })
    arrow(590, 395, 668, 395, E.out(P(t, 1.5, 1.9)), hexA(C.text, .35), 2.5)
    const pv = E.out(P(t, 1.8, 2.3))
    withA(pv, () => {
      panel(680, 330, 300, 130, { r: 14, stroke: C.blue, lw: 2, fill: tint(C.blue, .05) })
      txt('PVC · data', 830, 372, { size: 24, weight: 600, align: 'center' })
      txt('1Gi · RWO', 830, 408, { size: 20, font: MONO, color: C.body, align: 'center' })
      txt('storageClassName: standard', 830, 440, { size: 16, font: MONO, color: C.mute, align: 'center' })
    })
    withA(E.out(P(t, 2.6, 3.1)), () => {
      txt('“我要 1Gi、单节点读写”', 1060, 388, { size: 26, color: C.text })
      txt('不关心存储在哪、用什么实现', 1060, 428, { size: 20, color: C.mute })
    })
    // 管理员：SC → PV → CSI → 真实存储
    box(470, 700, 250, 110, 'StorageClass', 'standard', C.violet, { alpha: E.out(P(t, 5.6, 6)), size: 26 })
    arrow(596, 700, 698, 700, E.out(P(t, 6.4, 6.9)), C.violet, 2.5)
    travel(596, 700, 698, 700, P(t, 6.4, 7.1), C.violet)
    withA(E.out(P(t, 6.6, 6.9)), () => txt('自动创建', 647, 680, { size: 16, color: C.violet, align: 'center' }))
    box(830, 700, 240, 110, 'PV', 'pvc-5f0c · 1Gi', C.teal, { alpha: E.out(P(t, 6.8, 7.2)), size: 28, hi: t > 11 })
    arrow(952, 700, 1048, 700, E.out(P(t, 7.4, 7.8)), hexA(C.text, .35), 2.5)
    box(1170, 700, 240, 110, 'CSI 驱动', '存储插件', C.amber, { alpha: E.out(P(t, 7.6, 8)), size: 26 })
    arrow(1292, 700, 1388, 700, E.out(P(t, 8.2, 8.6)), hexA(C.text, .35), 2.5)
    cylinder(1480, 690, 120, 44, C.teal, null, E.out(P(t, 8.4, 8.8)))
    withA(E.out(P(t, 8.6, 9.1)), () => {
      txt('真实存储', 1480, 770, { size: 20, align: 'center', color: C.text, weight: 600 })
      ;['本地盘', 'NFS', 'Ceph', '云盘'].forEach((s, i) => chip(s, 1600 + (i % 2) * 90, 660 + Math.floor(i / 2) * 50, { size: 16, col: C.mute, font: SANS }))
    })
    // 绑定 1:1
    const b = E.out(P(t, 11, 11.6))
    if (b > 0) {
      line(830, 460, 830, 460 + 185 * b, C.green, 3)
      withA(b, () => { chip('绑定 1 : 1', 830, 540, { size: 20, col: C.green, solid: true }) })
      ring(830, 540, P(t, 11, 11.8), C.green, 110)
    }
    withA(E.out(P(t, 13.2, 13.7)), () => txt('PVC 申请 2Gi，也能绑上整块 5Gi 的 PV —— 不会切分', 140, 872, { size: 20, color: C.body }))
  },
}

// ---------- 场景 3：动态供给与延迟绑定 ----------
const WF = [
  { t: .9, cmd: 'kubectl get pvc data' },
  { t: 2.0, out: 'NAME   STATUS    VOLUME     STORAGECLASS', color: C.mute },
  { t: 2.3, out: 'data   Pending              standard', color: C.amber },
  { t: 3.2, out: 'waiting for first consumer to be created', color: C.amber },
  { t: 7.8, cmd: 'kubectl get pvc data' },
  { t: 8.9, out: 'data   Bound     pvc-5f0c   standard', color: C.green, sfx: 'ok' },
]
const wffc = {
  name: '动态供给与延迟绑定', dur: 17, mood: 2,
  vo: [[0.6, '只建 PVC，它会停在 Pending，等第一个使用者。'],
    [5.8, 'Pod 调度到节点后，才在那里创建 PV。'],
    [10.8, '若用 Immediate，卷和 Pod 可能各在一边。']],
  cues: [[0.4, 'whoosh'], ...typeCues(WF, 30), [5.9, 'whoosh'], [6.8, 'thud'], [7.2, 'pop'], [11.2, 'pop'], [12.6, 'error'], [13.4, 'error'], [14.2, 'alarmSoft']],
  draw(t) {
    heading('动态供给：WaitForFirstConsumer', 140, 210, t, .2, { eyebrow: 'VOLUME BINDING MODE', color: COL })
    terminal(140, 280, 900, 380, t, WF, { size: 22, alpha: E.out(P(t, .4, .9)) * (1 - .5 * E.out(P(t, 10.8, 11.3))) })
    // 模式表
    const modeB = t >= 10.8
    ;[['WaitForFirstConsumer', 'Pod 调度后，在该节点供给', '本地盘', 0], ['Immediate', 'PVC 一创建就立刻供给', '网络存储', 1]].forEach(([m, d, bk, i]) => {
      const a = E.out(P(t, 1.2 + i * .3, 1.7 + i * .3)); if (a <= 0) return
      const y = 690 + i * 96, on = modeB ? i === 1 : i === 0
      withA(a * (on ? 1 : .55), () => {
        panel(140, y, 900, 80, { r: 14, stroke: on ? (i ? C.amber : COL) : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(i ? C.amber : COL, .06) : C.panel })
        chip(m, 164, y + 40, { size: 20, col: i ? C.amber : COL, solid: on, align: 'left' })
        txt(d, 480, y + 48, { size: 21, color: C.text })
        txt(bk, 1016, y + 48, { size: 18, color: C.mute, align: 'right' })
      })
    })
    // 右：两个节点
    const nA = E.out(P(t, .8, 1.3))
    node(1100, 430, 330, 430, 'worker', { alpha: nA, accent: COL })
    node(1450, 430, 330, 430, 'worker2', { alpha: nA, accent: COL })
    pod(1190, 530, 76, { state: 'run', alpha: nA }); pod(1340, 530, 76, { state: 'run', alpha: nA })
    chip('CPU 已满', 1265, 610, { size: 18, col: C.red, font: SANS, alpha: nA })
    // PVC 状态
    const bound = (t >= 8.9 && t < 10.8) || t >= 11.4
    withA(E.out(P(t, 1, 1.4)), () => {
      chip('PVC data', 1100, 300, { size: 20, col: C.blue, align: 'left' })
      chip(bound ? 'Bound' : 'Pending', 1240, 300, { size: 20, col: bound ? C.green : C.amber, solid: bound, align: 'left' })
    })
    const fa = 1 - E.out(P(t, 10.8, 11.2)), fb = E.out(P(t, 11, 11.4))
    // A：WaitForFirstConsumer
    if (fa > 0) withA(fa, () => {
      const m = E.inOut(P(t, 5.9, 6.8))
      const px = lerp(1615, 1615, m), py = lerp(340, 540, m)
      pod(px, py, 84, { state: m >= 1 ? 'run' : 'pending', label: 'pvc-user', alpha: E.out(P(t, 1.4, 1.8)) })
      if (m > 0 && m < 1) travel(1615, 360, 1615, 520, m, COL)
      ring(1615, 540, P(t, 6.8, 7.6), COL, 120)
      const v = E.out(P(t, 7.2, 7.7))
      if (v > 0) {
        partialLine(1615, 600, 1615, 668, v, hexA(C.teal, .7), 2.5)
        cylinder(1615, 700, 110, 40, C.teal, 'pvc-5f0c', v)
        txt('/var/local-path-provisioner', 1615, 806, { size: 16, font: MONO, color: C.mute, align: 'center', alpha: v })
      }
      chip('调度后再建卷', 1615, 360, { size: 18, col: COL, font: SANS, alpha: E.out(P(t, 7.6, 8)) * (m >= 1 ? 1 : 0) })
    })
    // B：Immediate 的死结
    if (fb > 0) withA(fb, () => {
      cylinder(1265, 710, 110, 40, C.amber, 'PV', E.out(P(t, 11.2, 11.6)))
      chip('先建好卷', 1265, 812, { size: 18, col: C.amber, font: SANS, alpha: E.out(P(t, 11.4, 11.8)) })
      pod(1615, 340, 84, { state: 'pending', alpha: 1 })
      const c1 = E.out(P(t, 12.2, 12.6)), c2 = E.out(P(t, 13, 13.4))
      curve(1570, 330, 1300, 480, -.25, c1, hexA(C.red, .7), 2.5, { dash: [8, 6] })
      withA(c1, () => { cross(1420, 400, 22, C.red, 1); txt('CPU 不足', 1420, 372, { size: 18, color: C.red, align: 'center' }) })
      partialLine(1615, 426, 1615, 530, c2, hexA(C.red, .7), 2.5, [8, 6])
      withA(c2, () => { cross(1615, 560, 22, C.red, 1); txt('卷不在这台', 1615, 612, { size: 18, color: C.red, align: 'center' }) })
      chip('永远 Pending', 1615, 404, { size: 18, col: C.red, solid: true, alpha: E.out(P(t, 14.2, 14.6)) })
    })
  },
}

// ---------- 场景 4：访问模式 ----------
const AM = [
  ['ReadWriteOnce', 'RWO', '单个节点读写挂载', '同节点多个 Pod 可共用', '块存储 · 本地盘 · 云盘', [[2, true], [1, false]], C.blue],
  ['ReadOnlyMany', 'ROX', '多个节点只读挂载', '', 'NFS · CephFS', [[1, 'ro'], [1, 'ro'], [1, 'ro']], C.teal],
  ['ReadWriteMany', 'RWX', '多个节点读写挂载', '', 'NFS · CephFS · GPFS', [[1, true], [1, true], [1, true]], C.violet],
  ['ReadWriteOncePod', 'RWOP', '整个集群只允许一个 Pod', 'v1.29 GA · 仅 CSI 卷', '严格单写者', [[2, 'one']], C.amber],
]
const access = {
  name: '访问模式', dur: 16, mood: 3,
  vo: [[0.6, 'RWO 限制的是节点，同节点多个 Pod 都能挂。'],
    [5.8, 'ROX 多节点只读，RWX 多节点读写。'],
    [10.8, '严格单写者用 RWOP，只允许一个 Pod。']],
  cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.2, 'pop'], [1.5, 'pop'], [1.8, 'pop'], [2.6, 'ok'], [3.4, 'error'], [6.0, 'tick'], [8.2, 'tick'], [11.0, 'lock'], [12.4, 'error']],
  draw(t) {
    heading('访问模式：限制的是节点还是 Pod', 140, 210, t, .2, { eyebrow: 'ACCESS MODES', color: COL })
    const cur = t < 5.8 ? [0] : t < 10.8 ? [1, 2] : [3]
    AM.forEach(([full, ab, d1, d2, bk, nodes, c], i) => {
      const a = E.out(P(t, .9 + i * .3, 1.4 + i * .3)); if (a <= 0) return
      const x = 140 + (i % 2) * 830, y = 280 + Math.floor(i / 2) * 310, on = cur.includes(i)
      const t0 = [1.8, 6, 8.2, 11][i]
      withA(a * (on ? 1 : .5), () => {
        panel(x, y, 810, 280, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        const w = chip(ab, x + 30, y + 50, { size: 24, col: c, solid: on, align: 'left' })
        txt(full, x + 30 + w + 14, y + 58, { size: 20, font: MONO, color: C.body })
        txt(d1, x + 30, y + 118, { size: 24, color: C.text, weight: 600 })
        if (d2) txt(d2, x + 30, y + 156, { size: 20, color: C.body })
        txt(bk, x + 30, y + 244, { size: 18, color: C.mute })
        // 示意图
        const vx = x + 610, vy = y + 60
        cylinder(vx, vy, 84, 28, c, null, 1)
        const nw = nodes.length === 2 ? 170 : 110, gap = 16, tot = nodes.length * nw + (nodes.length - 1) * gap
        let nx = vx - tot / 2
        nodes.forEach(([np, mode], j) => {
          ctx.save(); ctx.fillStyle = '#f6f6f7'; ctx.strokeStyle = C.hairD; ctx.lineWidth = 1.5; rr(nx, y + 150, nw, 110, 12); ctx.fill(); ctx.stroke(); ctx.restore()
          txt('node', nx + 10, y + 250, { size: 16, font: MONO, color: C.mute })
          for (let k = 0; k < np; k++) {
            const px = nx + nw * (np === 1 ? .5 : k === 0 ? .3 : .7), py = y + 200
            const ok = mode === true || mode === 'ro' || (mode === 'one' && k === 0) || (mode === false ? false : false)
            const lp = E.out(P(t, t0 + j * .25 + k * .5, t0 + .5 + j * .25 + k * .5))
            const col2 = ok ? c : C.red
            partialLine(vx, vy + 26, px, py - 26, lp, hexA(col2, ok ? .8 : .7), ok ? 2.5 : 2, ok && mode !== 'ro' ? null : [7, 6])
            pod(px, py, 46, { state: ok ? c : 'idle' })
            if (lp >= 1) { if (ok) { if (mode === 'ro') txt('ro', (vx + px) / 2 + 8, (vy + py) / 2, { size: 16, font: MONO, color: c }) } else cross((vx + px) / 2, (vy + py) / 2 + 4, 16, C.red, 1) }
          }
          nx += nw + gap
        })
      })
    })
  },
}

// ---------- 场景 5：回收策略 ----------
const PATCH = `kubectl patch pv disk1-worker --type json -p '[{"op":"remove","path":"/spec/claimRef"}]'`
const RL = [
  { t: 1.0, cmd: 'kubectl delete pvc static-claim' },
  { t: 6.6, cmd: 'kubectl get pv disk1-worker' },
  { t: 7.6, out: 'disk1-worker   5Gi   RWO   Retain   Released', color: C.amber },
  { t: 10.8, cmd: PATCH },
  { t: 14.1, out: 'persistentvolume/disk1-worker patched', color: C.green, sfx: 'ok' },
]
const reclaim = {
  name: '回收策略', dur: 16, mood: 3,
  vo: [[0.6, '删除 PVC 后，PV 如何处理由回收策略决定。'],
    [5.4, 'Delete 连数据一起删，Retain 留下 Released。'],
    [10.8, '管理员确认后删掉 claimRef，PV 才能复用。', '管理员确认后删掉 claim Ref，PV 才能复用。']],
  cues: [[0.4, 'whoosh'], ...typeCues(RL, 30), [2.2, 'poof'], [5.6, 'poof'], [5.8, 'poof'], [6.8, 'tick'], [8.4, 'whoosh'], [9.0, 'error'], [14.3, 'chime']],
  draw(t) {
    heading('回收策略：Delete 与 Retain', 140, 210, t, .2, { eyebrow: 'RECLAIM POLICY', color: COL })
    ;[['Delete', C.red, '动态供给默认', 140], ['Retain', C.green, '关键数据推荐', 980]].forEach(([pol, c, note, x], i) => {
      const a = E.out(P(t, .5 + i * .3, 1 + i * .3)); if (a <= 0) return
      const y = 270
      withA(a, () => {
        panel(x, y, 800, 320, { r: 20 })
        chip(`reclaimPolicy: ${pol}`, x + 30, y + 44, { size: 22, col: c, solid: true, align: 'left' })
        txt(note, x + 770, y + 51, { size: 18, color: C.mute, align: 'right' })
        // PVC
        const pg = E.out(P(t, 2.2, 2.7))
        if (pg < 1) withA(1 - pg, () => {
          panel(x + 40, y + 130, 190, 100, { r: 12, stroke: C.blue, lw: 2, fill: tint(C.blue, .05) })
          txt('PVC', x + 135, y + 172, { size: 24, weight: 600, align: 'center' })
          txt(i ? 'static-claim' : 'data', x + 135, y + 206, { size: 17, font: MONO, color: C.mute, align: 'center' })
        })
        poof(x + 135, y + 180, P(t, 2.2, 3), C.blue)
        const gA = pg * (i ? clamp(1 - E.out(P(t, 8, 8.4)) + E.out(P(t, 11, 11.4))) : 1)
        if (gA > 0) withA(gA, () => {
          panel(x + 40, y + 130, 190, 100, { r: 12, stroke: hexA(C.text, .2), lw: 2, dash: [6, 5], fill: 'rgba(0,0,0,0)', shadow: false })
          txt('PVC 已删除', x + 135, y + 188, { size: 20, align: 'center', color: C.mute })
        })
        const link = 1 - pg
        if (link > 0) partialLine(x + 232, y + 180, x + 318, y + 180, 1, hexA(C.text, .3 * link), 2.5)
        // PV
        const kill = i === 0 ? E.out(P(t, 5.6, 6.2)) : 0
        withA(1 - kill, () => {
          panel(x + 320, y + 120, 200, 120, { r: 14, stroke: C.teal, lw: 2, fill: tint(C.teal, .05) })
          txt('PV', x + 420, y + 166, { size: 26, weight: 600, align: 'center' })
          txt(i ? 'disk1-worker' : 'pvc-5f0c', x + 420, y + 202, { size: 17, font: MONO, color: C.mute, align: 'center' })
          const st = i === 0 ? 'Bound' : t < 6.8 ? 'Bound' : t < 14.3 ? 'Released' : 'Available'
          chip(st, x + 420, y + 272, { size: 20, col: st === 'Bound' ? C.green : st === 'Released' ? C.amber : C.green, solid: st !== 'Bound' })
          partialLine(x + 522, y + 180, x + 600, y + 180, 1, hexA(C.teal, .6), 2)
          cylinder(x + 670, y + 176, 110, 40, C.teal, null)
          txt('后端数据', x + 670, y + 254, { size: 18, color: C.body, align: 'center' })
        })
        if (i === 0) {
          poof(x + 420, y + 180, P(t, 5.6, 6.6), C.teal); poof(x + 670, y + 176, P(t, 5.8, 6.8), C.teal)
          withA(E.out(P(t, 6.2, 6.7)), () => {
            txt('PV 与后端存储一起删除', x + 420, y + 190, { size: 24, color: C.red, align: 'center', weight: 600 })
          })
        } else {
          chip('数据还在', x + 670, y + 110, { size: 18, col: C.green, font: SANS, alpha: E.out(P(t, 7, 7.4)) })
          // 新 PVC 想绑定，被拒
          const m = E.inOut(P(t, 8.4, 9)), rej = t >= 9 && t < 14.3
          const ga = E.out(P(t, 8.2, 8.6)) * (1 - E.out(P(t, 10.6, 11)))
          if (ga > 0) withA(ga, () => {
            const sx = lerp(x + 40, x + 90, m) + (rej ? Math.sin(t * 60) * 5 * (1 - P(t, 9, 9.6)) : 0)
            panel(sx, y + 130, 190, 100, { r: 12, stroke: C.red, lw: 2, dash: [6, 5], fill: tint(C.red, .04) })
            txt('新 PVC', sx + 95, y + 188, { size: 22, weight: 600, align: 'center', color: C.red })
            if (rej) cross(x + 296, y + 180, 20, C.red, 1)
          })
          chip('claimRef 仍指向旧 PVC', x + 180, y + 272, { size: 18, col: C.red, font: SANS, alpha: E.out(P(t, 9.2, 9.6)) * (1 - E.out(P(t, 14.1, 14.5))) })
          ring(x + 420, y + 272, P(t, 14.3, 15.1), C.green, 100)
        }
      })
    })
    terminal(140, 620, 1640, 260, t, RL, { size: 20, alpha: E.out(P(t, .6, 1)) })
  },
}

ANIM({
  id: 'storage-basics',
  meta: { stage: 2, lesson: 2, of: 7, title: '存储：Volume、PV、PVC 与 StorageClass', summary: '临时卷与持久卷、静态与动态供给、访问模式和回收策略。', next: 'StatefulSet 与有状态应用' },
  scenes: [
    lessonIntro({ tags: ['emptyDir', 'PV / PVC', 'StorageClass', 'accessModes', 'reclaimPolicy'], vo: [[3.2, '容器的文件是临时的，数据要放哪？']] }),
    ephPer, layers, wffc, access, reclaim,
    lessonOutro({
      points: ['emptyDir 随 Pod；PVC 的数据活得比 Pod 久', '开发者写 PVC，StorageClass 自动造 PV', '本地盘用 WaitForFirstConsumer 延迟绑定', 'RWO 限节点、RWOP 限 Pod，关键数据用 Retain'],
      vo: [[0.8, '小结：PVC 把应用和存储解耦。'], [5.6, '下一课，用 StatefulSet 部署有状态应用。']],
    }),
  ],
})
})()
