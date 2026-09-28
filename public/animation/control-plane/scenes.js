/* 第 3 阶段 · 第 1 课：控制平面深入：一个 Pod 的诞生 */
(() => {
const COL = STAGES[3].color
// 组件框：同 box()，但副标题至少 16px
function sbox(x, y, w, h, title, sub, col = C.blue, o = {}) {
  const { alpha = 1, hi = false, size = 26, fill } = o
  withA(alpha, () => {
    panel(x - w / 2, y - h / 2, w, h, { r: o.r || 14, fill: fill || (hi ? tint(col, .14) : '#fff'), stroke: hi ? col : hexA(col, .45), lw: hi ? 2.5 : 1.5 })
    txt(title, x, y + (sub ? -4 : size * .36), { size, weight: 600, align: 'center' })
    if (sub) txt(sub, x, y + size * 1.08, { size: Math.max(16, Math.round(size * .66)), font: MONO, color: C.mute, align: 'center' })
  })
}

// 虚线六边形：尚不存在的 Pod / 沙箱
const hexOutline = (x, y, s, col, a = 1) => withA(a, () => { ctx.save(); hexPath(x, y, s / 2); ctx.setLineDash([8, 7]); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore() })
// 折线箭头：pts 依次连接，p 为已绘制比例
function pathArrow(pts, p, color, w = 2.5) {
  if (p <= 0) return
  const segs = []; let tot = 0
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); tot += d }
  let rem = p * tot
  for (let i = 0; i < segs.length && rem > 0; i++) {
    const f = Math.min(1, rem / segs[i]); rem -= segs[i]
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    if (f >= 1 && i < segs.length - 1) line(x1, y1, x2, y2, color, w)
    else arrow(x1, y1, lerp(x1, x2, f), lerp(y1, y2, f), 1, color, w)
  }
}

// 场景 1：apiserver 请求处理链
const STG = [
  ['认证', 'Authn', C.blue, '401 Unauthorized'],
  ['授权', 'Authz · RBAC', C.cyan, '403 Forbidden'],
  ['变更准入', 'Mutating', COL, 'denied the request'],
  ['Schema 校验', 'Schema', C.amber, '422 Unprocessable'],
  ['验证准入', 'Validating', C.pink, 'violates PodSecurity'],
]
const SX = i => 495 + i * 240
const pipeline = {
  name: '请求处理链', dur: 16, mood: 1,
  vo: [[0.6, 'kubectl apply 就是一次 HTTPS 请求。'],
    [4.8, '依次过认证、授权、准入，任一关不过就被拒。'],
    [10.2, '写进 etcd 就返回成功，此时 Pod 还一个都没有。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.1, 'pop'], ...STG.map((_, i) => [1.5 + i * .3, 'tick']), [2.8, 'zap'],
    ...STG.map((_, i) => [5.1 + i * .8, 'tick']), [9.5, 'thud'], [10.8, 'ok'], [12.4, 'poof']],
  draw(t) {
    heading('kube-apiserver 的请求处理链', 140, 210, t, .2, { eyebrow: 'REQUEST PIPELINE', color: COL })
    const Y = 450
    // kubectl
    chip('kubectl apply', 230, Y, { size: 22, col: C.text, alpha: E.out(P(t, .8, 1.2)) })
    // apiserver 外框
    const pa = E.out(P(t, 1.0, 1.5))
    withA(pa, () => {
      panel(370, Y - 100, 1210, 200, { r: 22, fill: tint(COL, .04), stroke: hexA(COL, .5), dash: [12, 9], lw: 2, shadow: false })
      chip('kube-apiserver', 975, Y - 100, { size: 20, col: COL, solid: true })
    })
    arrow(322, Y, 368, Y, E.out(P(t, 2.6, 3.0)), hexA(C.text, .4), 2.5)
    withA(E.out(P(t, 2.8, 3.3)), () => txt('HTTPS · POST / PATCH', 230, Y - 44, { size: 17, font: MONO, color: C.mute, align: 'center' }))
    // 数据包穿过各关
    const pp = P(t, 4.8, 9.4), px = lerp(322, 1630, E.inOut(pp))
    STG.forEach(([n, s, c, err], i) => {
      const a = E.out(P(t, 1.5 + i * .3, 2.0 + i * .3)); if (a <= 0) return
      const passed = t > 4.8 && px >= SX(i) - 30
      box(SX(i), Y, 210, 120, n, s, c, { alpha: a, hi: passed, size: 26 })
      if (passed) check(SX(i) + 80, Y - 38, 22, c, P(t, 4.8 + (i + .6) * .8, 5.2 + (i + .6) * .8))
      if (i < 4) arrow(SX(i) + 106, Y, SX(i + 1) - 106, Y, a, hexA(C.text, .25), 2)
      // 失败时的报错
      const ea = E.out(P(t, 5.1 + i * .8, 5.6 + i * .8))
      withA(ea, () => {
        line(SX(i), Y + 62, SX(i), Y + 132, hexA(C.red, .35), 2, [5, 5])
        chip(err, SX(i), Y + 158, { size: 17, col: C.red })
      })
    })
    withA(E.out(P(t, 5.0, 5.5)), () => txt('失败时', 385, Y + 165, { size: 20, color: C.red, align: 'right' }))
    // 变更准入先改对象，验证准入只判断放不放行
    withA(E.out(P(t, 7.4, 7.9)) * (1 - P(t, 10, 10.4)), () => txt('先 Mutating 改对象，再 Validating 看最终形态', 975, Y + 224, { size: 20, color: C.body, align: 'center' }))
    if (pp > 0 && pp < 1) travel(322, Y, 1630, Y, pp, COL, 9)
    else if (pp <= 0 && t > 3) dot(322, Y, 8, COL, 12)
    // etcd
    const ca = E.out(P(t, 1.8, 2.4))
    arrow(1582, Y, 1626, Y, ca, hexA(C.text, .4), 2.5)
    cylinder(1690, Y, 120, 80, C.teal, 'etcd', ca)
    ring(1690, Y, P(t, 9.4, 10.5), C.teal, 140)
    chip('resourceVersion: 12345', 1690, Y - 110, { size: 17, col: C.teal, alpha: E.out(P(t, 9.8, 10.3)), align: 'right' })
    // 返回 created
    const rp = E.inOut(P(t, 10.6, 11.6))
    pathArrow([[1690, Y + 90], [1690, 730], [230, 730], [230, Y + 28]], rp, C.green, 2.5)
    withA(E.out(P(t, 11.2, 11.7)), () => {
      chip('deployment.apps/web created', 975, 730, { size: 20, col: C.green, solid: true })
    })
    // Pod 还不存在
    const ea = E.out(P(t, 12.4, 13))
    ;[0, 1, 2].forEach(i => hexOutline(630 + i * 80, 830, 60, C.faint, ea))
    withA(ea, () => {
      txt('Pod × 0', 860, 838, { size: 22, font: MONO, color: C.mute })
      txt('只代表「期望状态」已记录，后面的事都是异步的', 1000, 838, { size: 22, color: C.body })
    })
  },
}

// 场景 2：etcd 与 Raft 多数派
const MX = [300, 560, 820]
const raft = {
  name: 'etcd 与 Raft', dur: 16, mood: 2,
  vo: [[0.6, 'etcd 用 Raft 共识，所有写入先交给 Leader。'],
    [5.4, '多数派确认才算提交，3 节点能容忍 1 个故障。'],
    [10.6, '失去多数派，etcd 拒绝写入，期望状态被冻结。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [1.6, 'pop'], [2.2, 'zap'], [5.6, 'zap'], [7.0, 'ok'], [8.2, 'error'],
    [8.8, 'zap'], [9.9, 'ok'], [10.8, 'error'], [11.4, 'zap'], [12.4, 'alarmSoft'], [14.0, 'chime']],
  draw(t) {
    heading('etcd：集群唯一的真相来源', 140, 210, t, .2, { eyebrow: 'ETCD · RAFT', color: COL })
    const down = [t > 10.8, false, t > 8.2]
    const aa = E.out(P(t, .6, 1.1))
    box(560, 320, 280, 70, 'kube-apiserver', null, COL, { alpha: aa, size: 24 })
    withA(aa, () => txt('唯一直连 etcd 的组件', 716, 328, { size: 18, color: C.mute }))
    MX.forEach((x, i) => {
      const a = E.out(P(t, 1.0 + i * .3, 1.5 + i * .3)); if (a <= 0) return
      const d = down[i], col = d ? C.red : C.teal
      withA(d ? .55 : 1, () => cylinder(x, 530, 130, 80, col, null, a))
      if (d) cross(x, 530, 44, C.red, E.out(P(t, i === 0 ? 10.8 : 8.2, (i === 0 ? 10.8 : 8.2) + .3)))
      withA(a, () => {
        txt(`etcd-${i + 1}`, x, 648, { size: 20, font: MONO, align: 'center', color: d ? C.red : C.text })
        chip(i === 1 ? 'Leader' : 'Follower', x, 684, { size: 16, col: i === 1 ? COL : C.mute, solid: i === 1 })
      })
    })
    // 写入：apiserver → Leader → Follower
    const writes = [[2.2, 5.6, 7.0], [8.8, 9.3, 9.9], [11.4, 11.9, 12.4]]
    writes.forEach(([w0, r0, c0], k) => {
      travel(560, 358, 560, 468, P(t, w0, w0 + .6), COL, 8)
      const ok = k < 2, la = E.out(P(t, w0 + .6, w0 + .9)) * (1 - P(t, c0 + 1.2, c0 + 1.5))
      if (la > 0) chip(t < c0 ? `entry #${k + 1} · 待确认` : ok ? `entry #${k + 1} · 已提交` : `entry #${k + 1} · 拒绝`, 560, 424, { size: 16, col: t < c0 ? C.amber : ok ? C.green : C.red, alpha: la })
      ;[0, 2].forEach(i => {
        if (down[i] && t > r0 - .2) return
        travel(i === 0 ? 490 : 630, 530, i === 0 ? 370 : 750, 530, P(t, r0, r0 + .5), COL, 7)
        travel(i === 0 ? 370 : 750, 548, i === 0 ? 490 : 630, 548, P(t, r0 + .5, c0), C.green, 6)
      })
    })
    ;[0, 2].forEach(i => { const a = E.out(P(t, 5.4, 5.8)); withA(a * (down[i] ? .3 : 1), () => { line(i === 0 ? 372 : 632, 520, i === 0 ? 488 : 748, 520, hexA(COL, .3), 2, [6, 6]) }) })
    // 多数派计数
    const k = t < 7 ? 0 : t < 9.9 ? 1 : t < 12.4 ? 2 : 3
    const acks = [0, 3, 2, 1][k]
    withA(E.out(P(t, 5.6, 6.1)), () => {
      txt('多数派确认', 140, 780, { size: 22, color: C.body })
      ;[0, 1, 2].forEach(i => { const on = i < acks
        ctx.save(); ctx.beginPath(); ctx.arc(330 + i * 48, 772, 15, 0, Math.PI * 2); ctx.fillStyle = on ? (acks >= 2 ? C.green : C.red) : 'rgba(0,0,0,0.07)'; ctx.fill(); ctx.restore() })
      txt('需要 ≥ 2 / 3', 490, 780, { size: 20, font: MONO, color: C.mute })
    })
    if (k > 0) {
      const ok = acks >= 2, tk = [0, 7, 9.9, 12.4][k]
      chip(ok ? `✓ 已提交  ${acks}/3` : '✗ 无法提交  1/3', 140, 840, { size: 22, col: ok ? C.green : C.red, solid: !ok, align: 'left', alpha: E.out(P(t, tk, tk + .3)), font: SANS })
      withA(E.out(P(t, 13.0, 13.5)), () => txt('新建 / 扩缩 / 调度全部失败；已运行的 Pod 不受影响', 360, 848, { size: 20, color: C.red }))
    }
    // 右侧：成员数与容错
    const ta = E.out(P(t, 1.8, 2.4))
    withA(ta, () => {
      panel(1080, 290, 700, 470, { r: 18 })
      ;['成员数', '多数派', '可容忍故障'].forEach((s, i) => txt(s, 1210 + i * 240, 350, { size: 22, color: C.mute, align: 'center' }))
      line(1100, 372, 1760, 372, C.hair, 1.5)
      ;[[1, 1, 0], [3, 2, 1], [4, 3, 1], [5, 3, 2]].forEach((r, i) => {
        const y = 430 + i * 82
        const hi = (i === 1 && t > 5.4 && t < 13.6) || ((i === 1 || i === 3) && t > 13.6)
        const dim = i === 2 && t > 13.6
        if (hi) { ctx.save(); ctx.fillStyle = tint(COL, .12); rr(1096, y - 40, 668, 72, 12); ctx.fill(); ctx.restore() }
        r.forEach((v, j) => txt(String(v), 1210 + j * 240, y + 10, { size: 32, weight: 600, font: MONO, align: 'center', color: dim ? C.faint : hi ? COL : C.text }))
      })
    })
    withA(E.out(P(t, 13.8, 14.4)), () => {
      txt('4 个成员的容错和 3 个一样 → 成员数总是奇数', 1430, 810, { size: 22, color: C.body, align: 'center' })
    })
  },
}

// 场景 3：list-watch 接力
const WL = [
  { t: 5.8, cmd: 'kubectl get pods -w --output-watch-events' },
  { t: 7.4, out: 'EVENT     NAME       RV    NODE         PHASE', color: C.mute },
  { t: 7.8, out: 'ADDED     web-x2kqp  1201  <none>       Pending', color: C.amber, sfx: 'pop' },
  { t: 9.8, out: 'MODIFIED  web-x2kqp  1203  kind-worker  Pending', color: C.cyan, sfx: 'pop' },
  { t: 12.2, out: 'MODIFIED  web-x2kqp  1210  kind-worker  Running', color: C.green, sfx: 'ok' },
]
const HUB = { cm: [300, 360], sch: [820, 360], kl: [820, 780], api: [560, 570] }
const watch = {
  name: 'list-watch 接力', dur: 17, mood: 2,
  vo: [[0.6, '组件之间不互相调用，只和 apiserver 打交道。'],
    [5.8, '各自 watch 关心的对象，把自己那一步写回去。'],
    [11.2, '同一个 Pod 被接力修改，resourceVersion 不断递增。', '同一个 Pod 被接力修改，resource version 不断递增。']],
  cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.3, 'pop'], [1.6, 'pop'], [1.9, 'pop'], [3.2, 'error'], ...typeCues(WL, 30), [13.2, 'chime']],
  draw(t) {
    heading('list-watch：组件只通过 apiserver 接力', 140, 210, t, .2, { eyebrow: 'CONTROL LOOP', color: COL })
    const act = t >= 12.2 ? 'kl' : t >= 9.8 ? 'sch' : t >= 7.8 ? 'cm' : null
    const [ax, ay] = HUB.api
    // 连线
    const la = E.out(P(t, 1.6, 2.2))
    const ends = { cm: [[300, 405], [470, 522]], sch: [[820, 405], [650, 522]], kl: [[820, 735], [650, 618]] }
    Object.entries(ends).forEach(([k, [a, b]]) => {
      partialLine(a[0], a[1], b[0], b[1], la, hexA(C.text, .22), 2.5)
      if (t > 5.8) flow(b[0], b[1], a[0], a[1], t, hexA(C.blue, .7), 3, .5, k.length * .2, 4) // watch 事件
      if (act === k) { const t0 = { cm: 7.8, sch: 9.8, kl: 12.2 }[k]; travel(a[0], a[1], b[0], b[1], P(t, t0 - .7, t0), C.amber, 8) } // 写回
    })
    partialLine(340, 722, 470, 618, la, hexA(C.teal, .6), 2.5)
    // 不直接通信
    const xa = E.out(P(t, 3.0, 3.5))
    withA(xa, () => {
      line(880, 410, 880, 730, hexA(C.red, .5), 2.5, [8, 8])
      cross(880, 570, 32, C.red)
      txt('不直接通信', 910, 578, { size: 20, color: C.red })
    })
    // 组件
    box(ax, ay, 280, 96, 'kube-apiserver', 'watch 事件分发', COL, { alpha: E.out(P(t, .8, 1.3)), size: 26, hi: true })
    ;[['cm', 'controller-manager', 'Deployment → RS → Pod', 300, 1.2], ['sch', 'kube-scheduler', '写 spec.nodeName', 260, 1.5], ['kl', 'kubelet', 'CRI · CNI · CSI', 260, 1.8]].forEach(([k, n, s, w, t0]) => {
      const [x, y] = HUB[k]
      sbox(x, y, w, 90, n, s, k === 'kl' ? C.green : k === 'sch' ? C.cyan : C.amber, { alpha: E.out(P(t, t0, t0 + .5)), hi: act === k, size: 24 })
    })
    cylinder(300, 770, 110, 60, C.teal, 'etcd', E.out(P(t, 2.0, 2.5)))
    // 终端：原始 watch 流
    terminal(1040, 290, 740, 360, t, WL, { size: 22, alpha: E.out(P(t, 3.8, 4.3)) })
    withA(E.out(P(t, 13.0, 13.5)), () => chip('RV  1201 → 1203 → 1210', 1410, 604, { size: 22, col: COL }))
    // LIST + WATCH
    const lw = E.out(P(t, 6.4, 7.0))
    withA(lw, () => {
      chip('LIST 全量 + RV', 1040, 720, { size: 20, col: C.blue, align: 'left' })
      arrow(1240, 720, 1290, 720, 1, hexA(C.text, .35), 2)
      chip('WATCH 增量事件', 1300, 720, { size: 20, col: C.blue, align: 'left' })
      txt('断线从最后的 RV 续传 · 410 Gone 就重新 LIST', 1040, 784, { size: 20, color: C.body })
    })
  },
}

// 场景 4：调度：Filter → Score → Bind
const ND = [
  ['kind-control-plane', .35, 'taint: control-plane', 'untolerated taint', null],
  ['kind-worker', .9, null, 'Insufficient cpu', null],
  ['kind-worker2', .55, null, null, 64],
  ['kind-worker3', .3, 'nginx 镜像已缓存', null, 88],
]
const NX = i => 520 + i * 320
const sched = {
  name: '调度', dur: 16, mood: 3,
  vo: [[0.6, 'scheduler 只处理 nodeName 为空的 Pod。', 'scheduler 只处理 node name 为空的 Pod。'],
    [5.2, 'Filter 排除放不下的节点，Score 再给剩下的打分。'],
    [10.6, '选中后通过 Bind 写回 nodeName，调度完成。', '选中后通过 Bind 写回 node name，调度完成。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], ...ND.map((_, i) => [1.6 + i * .25, 'tick']), [5.6, 'error'], [6.4, 'error'], [8.0, 'tick'], [8.4, 'tick'], [9.8, 'ding3'], [10.8, 'whoosh'], [11.6, 'lock'], [12.0, 'ok']],
  draw(t) {
    heading('kube-scheduler：先过滤，再打分', 140, 210, t, .2, { eyebrow: 'SCHEDULING', color: COL })
    // 阶段指示
    const ph = t < 5.2 ? -1 : t < 7.8 ? 0 : t < 10.6 ? 1 : 2
    let sx = 1300
    ;['Filter', 'Score', 'Bind'].forEach((s, i) => {
      const w = chip(s, sx, 200, { size: 20, col: COL, solid: ph === i, align: 'left', alpha: E.out(P(t, .8 + i * .2, 1.2 + i * .2)) })
      if (i < 2) withA(E.out(P(t, 1, 1.4)), () => arrowHead(sx + w + 26, 200, 0, C.faint, 12))
      sx += w + 44
    })
    // 节点
    ND.forEach(([n, cpu, tag, why, score], i) => {
      const a = E.out(P(t, 1.6 + i * .25, 2.1 + i * .25)); if (a <= 0) return
      const x = NX(i), out = why && t > (i === 0 ? 5.6 : 6.4)
      const win_ = i === 3 && t > 9.8
      withA(a * (out ? .45 : 1), () => {
        node(x, 300, 290, 480, n, { accent: COL })
        if (win_) { ctx.save(); rr(x, 300, 290, 480, 14); ctx.strokeStyle = COL; ctx.lineWidth = 3; ctx.stroke(); ctx.restore() }
        meter(x + 24, 410, 242, 14, cpu, cpu > .8 ? C.red : C.blue, { label: 'CPU requests', value: Math.round(cpu * 100) + '%', size: 18 })
        if (tag) chip(tag, x + 145, 474, { size: 16, col: i === 0 ? C.amber : C.green })
      })
      if (out) {
        const k = E.out(P(t, i === 0 ? 5.6 : 6.4, (i === 0 ? 5.6 : 6.4) + .35))
        cross(x + 145, 600, 60, C.red, k)
        chip(why, x + 145, 720, { size: 17, col: C.red, alpha: k })
      }
      if (score) {
        const sa = E.out(P(t, 8.0 + (i - 2) * .4, 8.5 + (i - 2) * .4)) * (i === 3 ? 1 - P(t, 10.8, 11.2) : 1)
        withA(sa, () => {
          txt('Score', x + 145, 560, { size: 18, color: C.mute, align: 'center' })
          txt(String(countUp(score, t, 8.0 + (i - 2) * .4, 9.2 + (i - 2) * .4)), x + 145, 624, { size: 52, weight: 600, font: MONO, align: 'center', color: i === 3 ? COL : C.text })
          meter(x + 40, 660, 210, 12, score / 100 * P(t, 8, 9.4), i === 3 ? COL : C.blueL)
        })
      }
    })
    if (t > 9.8 && t < 11.6) chip('✓ 得分最高', NX(3) + 145, 720, { size: 18, col: COL, solid: true, alpha: E.out(P(t, 9.8, 10.2)) * (1 - P(t, 11.3, 11.6)), font: SANS })
    // 待调度的 Pod → 绑定到节点
    const bp = E.inOut(P(t, 10.8, 11.6))
    const px = lerp(280, NX(3) + 145, bp), py = lerp(560, 600, bp), ps = lerp(130, 96, bp)
    const bound = t > 11.6
    withA(E.out(P(t, .9, 1.4)) * (1 - P(t, 10.6, 10.9)), () => chip('调度队列', 280, 420, { size: 18, col: C.amber }))
    pod(px, py, ps, { state: bound ? 'run' : 'pending', label: bp > 0 ? null : 'web-x2kqp', sub: bp > 0 ? null : 'nodeName: ""', alpha: E.out(P(t, 1.0, 1.5)), scale: E.back(P(t, 1.0, 1.5)) })
    if (bound) chip('nodeName: kind-worker3', NX(3) + 145, 720, { size: 16, col: C.green, alpha: E.out(P(t, 11.6, 12)) })
    withA(E.out(P(t, 12.0, 12.5)), () => {
      chip('POST pods/binding', 280, 560, { size: 18, col: COL })
      txt('写回 apiserver', 280, 604, { size: 18, color: C.mute, align: 'center' })
    })
    withA(E.out(P(t, 13.2, 13.8)), () => txt('Pod 卡在 Pending？先看 describe 里的 FailedScheduling 事件：它就是 Filter 的否决理由', 960, 850, { size: 22, color: C.body, align: 'center' }))
  },
}

// 场景 5：kubelet 与 CRI / CNI / CSI
const STEPS = [
  ['准入检查', '节点资源 · hostPort 冲突', C.mute, 1.8],
  ['CSI 挂载卷', 'NodeStage / NodePublish', C.amber, 5.0],
  ['CRI 创建沙箱', 'RunPodSandbox → CNI ADD', C.cyan, 6.6],
  ['CRI 启动容器', 'PullImage → Create → Start', COL, 10.2],
  ['写回 status', 'podIP · phase: Running', C.green, 12.4],
]
const kubelet = {
  name: 'kubelet', dur: 15, mood: 3,
  vo: [[0.6, 'kubelet 发现分给自己的 Pod，开始干活。'],
    [5.0, 'CSI 挂卷，CRI 建沙箱，再由 CNI 配 IP。'],
    [10.2, '拉镜像、启动容器，把状态写回 apiserver。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [2.3, 'tick'], [2.8, 'tick'], [3.3, 'ok'], ...STEPS.map(s => [s[3], 'tick']), [5.4, 'pop'], [7.0, 'pop'], [8.0, 'zap'], [10.8, 'pop'], [11.2, 'pop'], [12.6, 'zap'], [13.2, 'chime']],
  draw(t) {
    heading('kubelet：调 CRI、CNI、CSI 把容器跑起来', 140, 210, t, .2, { eyebrow: 'KUBELET', color: COL })
    let cur = -1; STEPS.forEach((s, i) => { if (t >= s[3]) cur = i })
    STEPS.forEach(([n, s, c, t0], i) => {
      const a = E.out(P(t, .8 + i * .15, 1.3 + i * .15)); if (a <= 0) return
      const y = 300 + i * 104, on = cur === i, done = cur > i
      withA(a * (cur < 0 || on || done ? 1 : .55), () => {
        panel(140, y, 610, 84, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .08) : C.panel })
        ctx.save(); ctx.fillStyle = on || done ? c : 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.arc(184, y + 42, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore()
        txt(String(i + 1), 184, y + 49, { size: 20, weight: 600, align: 'center', color: on || done ? '#fff' : C.mute, font: MONO })
        txt(n, 222, y + 38, { size: 24, weight: 600 })
        txt(s, 222, y + 66, { size: 17, font: MONO, color: C.mute })
      })
    })
    // 节点
    const na = E.out(P(t, .9, 1.4))
    node(820, 290, 960, 580, 'kind-worker', { alpha: na, tag: 'kubelet', accent: COL })
    const PX = 1290, PY = 590
    // 收到 Pod，做准入检查
    const wa = E.out(P(t, 1.0, 1.5)) * (1 - P(t, 4.8, 5.2))
    withA(wa, () => {
      chip('watch · spec.nodeName = kind-worker', PX, 360, { size: 18, col: COL })
      doc(PX - 180, 560, 190, 150, 'web-x2kqp', COL, { sub: 'Pod spec', size: 20 })
      ;['CPU / 内存够用', 'hostPort 不冲突', '节点无压力驱逐'].forEach((s, i) => {
        const k = P(t, 2.2 + i * .5, 2.6 + i * .5)
        check(PX + 10, 510 + i * 50, 24, C.green, k)
        withA(E.out(k), () => txt(s, PX + 36, 518 + i * 50, { size: 20, color: C.body }))
      })
    })
    // CSI 卷
    const va = E.out(P(t, 5.2, 5.8))
    cylinder(990, 700, 110, 50, C.amber, null, va)
    withA(va, () => chip('CSI · 卷已挂载', 990, 780, { size: 18, col: C.amber }))
    partialLine(1045, 690, PX - 70, 630, E.out(P(t, 7.0, 7.6)), hexA(C.amber, .6), 2.5, [6, 5])
    // containerd
    const ra = E.out(P(t, 6.6, 7.1))
    withA(ra, () => { chip('containerd · CRI', PX, 380, { size: 20, col: C.cyan }); arrow(PX, 400, PX, 500, E.out(P(t, 6.8, 7.3)), hexA(C.cyan, .6), 2.5) })
    // 沙箱 → Pod
    const started = t > 10.6
    if (!started) {
      hexOutline(PX, PY, 170, C.cyan, E.out(P(t, 7.0, 7.5)))
      withA(E.out(P(t, 7.2, 7.7)), () => txt('pause 沙箱', PX, PY + 8, { size: 18, font: MONO, color: C.cyan, align: 'center' }))
    }
    pod(PX, PY, 170, { state: t > 12.6 ? 'run' : 'pending', alpha: E.out(P(t, 10.6, 11.1)), scale: E.back(P(t, 10.6, 11.2)), n: 2 })
    // CNI
    const cn = E.out(P(t, 7.8, 8.3))
    withA(cn, () => {
      chip('CNI 插件 · ADD', 1600, 540, { size: 18, col: C.teal })
      txt('由运行时调用', 1600, 580, { size: 17, color: C.mute, align: 'center' })
    })
    arrow(1500, 552, PX + 92, 582, E.out(P(t, 8.0, 8.5)), hexA(C.teal, .7), 2.5)
    chip('10.244.1.5', PX, PY + 124, { size: 20, col: C.teal, solid: true, alpha: E.out(P(t, 8.4, 8.8)) })
    // 写回 status
    const sa = E.out(P(t, 12.4, 13))
    withA(sa, () => {
      chip('status → apiserver', 1600, 380, { size: 18, col: C.green, solid: true })
      chip('phase: Running', 1600, 720, { size: 18, col: C.green })
    })
    curve(PX + 70, PY - 70, 1560, 404, -40, E.out(P(t, 12.4, 13)), C.green, 2.5)
  },
}

ANIM({
  id: 'control-plane',
  meta: { stage: 3, lesson: 1, of: 6, title: '控制平面深入：一个 Pod 的诞生', summary: 'apiserver、etcd、scheduler、controller-manager、kubelet 如何协作。', next: '网络模型与 CNI' },
  scenes: [
    lessonIntro({ tags: ['apiserver', 'etcd · Raft', 'list-watch', 'scheduler', 'kubelet'], vo: [[3.2, '沿着一次 kubectl apply，看 Pod 如何诞生。']] }),
    pipeline, raft, watch, sched, kubelet,
    lessonOutro({
      points: ['请求链：认证 → 授权 → 准入 → 写入 etcd', 'etcd 靠 Raft 多数派，成员数取奇数', '组件只经 apiserver，用 list-watch 接力', 'scheduler 过滤打分，kubelet 调 CRI/CNI/CSI'],
      vo: [[0.8, '小结：一个 Pod 的诞生，是多个组件的接力。'], [5.6, '下一课，深入网络模型与 CNI。']],
    }),
  ],
})
})()
