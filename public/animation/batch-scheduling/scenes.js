/* 第 5 阶段 · 第 2 课：批调度：Kueue、Volcano 与 Gang 调度 */
(() => {
const COL = STAGES[5].color
// 旁白读法：Kueue 读作 Queue
const sp = s => s.replace(/Kueue/g, 'Queue').replace(/K8s/g, 'Kubernetes').replace(/team-a/g, 'team A').replace(/team-b/g, 'team B')
const V = (a, s, o) => [a, s, o || sp(s)]
const JA = C.cyan, JB = C.violet

// 场景 1：Gang 调度
const GP = (px, g, k) => [px + 80 + g * 180 + k * 40, 410]
const gang = {
  name: 'Gang 调度', dur: 16, mood: 1,
  vo: [V(0.6, '分布式训练的每个 worker 必须同时在线。'),
    V(5.4, '逐个调度时，两个任务各占一半卡，互相死等。'),
    V(10.6, 'Gang 调度全有或全无：A 整组先跑，B 整组排队。')],
  cues: [[0.6, 'whoosh'], [1.3, 'pop'], [1.6, 'pop'], [2.4, 'shimmer'], ...[0, 1, 2, 3].map(i => [5.6 + i * .4, 'pop']), [7.6, 'error'],
    [10.8, 'zap'], ...[0, 1, 2, 3].map(i => [11.0 + i * .25, 'pop']), [11.8, 'lock'], [13.4, 'ok'], [13.8, 'whoosh'], [14.6, 'chime']],
  draw(t) {
    heading('Gang：一组 Pod 全有或全无', 140, 210, t, .2, { eyebrow: 'GANG SCHEDULING', color: COL })
    ;[0, 1].forEach(side => {
      const px = side ? 990 : 140
      const focus = side ? (t < 10.4 ? .5 : 1) : (t < 10.4 ? 1 : .55)
      const pa = E.out(P(t, .6 + side * .2, 1.1 + side * .2))
      // 每个卡组的归属：-1 空，0 = A，1 = B
      const own = [-1, -1, -1, -1], podSt = [[0, 0, 0, 0], [0, 0, 0, 0]] // 0 idle 1 run 2 pending 3 done
      let evict = 0
      if (!side) {
        ;[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([j, i], g) => { if (t >= 5.6 + g * .4) { own[g] = j; podSt[j][i] = 1 } })
        if (t >= 7.2) for (let j = 0; j < 2; j++) for (let i = 2; i < 4; i++) podSt[j][i] = 2
      } else {
        for (let g = 0; g < 4; g++) if (t >= 11.0 + g * .25) { own[g] = 0; podSt[0][g] = 1 }
        if (t >= 11.8) for (let i = 0; i < 4; i++) podSt[1][i] = 2
        if (t >= 13.4) { for (let g = 0; g < 4; g++) { own[g] = -1; podSt[0][g] = 3 } evict = P(t, 13.4, 14.2) }
        for (let g = 0; g < 4; g++) if (t >= 14.0 + g * .15) { own[g] = 1; podSt[1][g] = 1 }
      }
      withA(pa * focus, () => {
        panel(px, 270, 790, 600, { r: 22 })
        if (!side) chip('逐个调度 · 默认调度器', px + 32, 312, { size: 21, font: SANS, col: C.amber, align: 'left' })
        else chip('Gang · 全有或全无', px + 32, 312, { size: 21, font: SANS, col: COL, solid: true, align: 'left' })
        txt('集群空闲 16 卡', px + 758, 320, { size: 19, color: C.mute, align: 'right' })
        for (let g = 0; g < 4; g++) {
          const o = own[g], col = o < 0 ? C.faint : o ? JB : JA
          ctx.save(); rr(px + 50 + g * 180, 376, 180 - 20, 68, 12); ctx.fillStyle = o < 0 ? 'rgba(0,0,0,0.025)' : tint(col, .06); ctx.fill(); ctx.strokeStyle = o < 0 ? C.hair : hexA(col, .5); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
          for (let k = 0; k < 4; k++) { const [x, y] = GP(px, g, k); gpu(x, y, 30, col, 1) }
          if (o >= 0) txt(`${o ? 'b' : 'a'}-${side ? g : Math.floor(g / 2)}`, px + 130 + g * 180, 472, { size: 17, font: MONO, color: col, align: 'center' })
          if (side && t >= 13.4) poof(px + 130 + g * 180, 410, evict, JA)
        }
        ;[[JA, 'Job A', 580], [JB, 'Job B', 740]].forEach(([col, n, y], j) => {
          txt(n, px + 40, y - 4, { size: 26, weight: 600, color: C.text })
          txt('4 Pod × 4 卡', px + 40, y + 28, { size: 18, color: C.mute })
          for (let i = 0; i < 4; i++) {
            const x = px + 300 + i * 125, k = E.back(clamp(P(t, 1.3 + j * .3 + i * .08, 1.7 + j * .3 + i * .08)))
            const st = podSt[j][i]
            const state = st === 1 ? (side ? 'run' : col) : st === 2 ? 'pending' : st === 3 ? C.teal : 'idle'
            pod(x, y, 84, { state, label: `${j ? 'b' : 'a'}-${i}`, alpha: clamp(k) * (st === 3 ? .45 : 1), scale: clamp(k) })
          }
          // 互联：每个 rank 都要和其他 rank 通信
          const ma = E.out(P(t, 2.4, 3.4)) * (1 - .7 * E.out(P(t, 4.8, 5.4)))
          if (ma > 0) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) curve(px + 300 + a * 125, y - 44, px + 300 + b * 125, y - 44, -(b - a) * 22, 1, hexA(col, .45 * ma), 2, { head: false })
        })
      })
      // 数据包：Pod → 卡组
      if (!side) [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([j, i], g) => travel(px + 300 + i * 125, j ? 740 : 580, px + 130 + g * 180, 410, P(t, 5.2 + g * .4, 5.6 + g * .4), j ? JB : JA))
      else {
        for (let g = 0; g < 4; g++) travel(px + 300 + g * 125, 580, px + 130 + g * 180, 410, P(t, 10.6 + g * .25, 11.0 + g * .25), JA)
        for (let g = 0; g < 4; g++) travel(px + 300 + g * 125, 740, px + 130 + g * 180, 410, P(t, 13.6 + g * .15, 14.0 + g * .15), JB)
      }
    })
    // 左：死锁
    const dA = E.out(P(t, 7.6, 8.1)) * (t < 10.4 ? 1 : .55)
    withA(dA, () => {
      ctx.save(); rr(180, 366, 710, 88, 14); ctx.strokeStyle = hexA(C.red, .5 + .3 * Math.sin(t * 6)); ctx.lineWidth = 2.5; ctx.setLineDash([10, 7]); ctx.stroke(); ctx.restore()
    })
    chip('死锁：16 卡占满，两个任务都跑不起来', 535, 842, { size: 20, font: SANS, col: C.red, solid: true, alpha: dA })
    // 右：B 整组排队
    const qA = E.out(P(t, 11.8, 12.3)) * (1 - E.out(P(t, 14.0, 14.4)))
    withA(qA, () => {
      panel(1230, 690, 530, 130, { r: 16, fill: 'rgba(0,0,0,0)', stroke: hexA(C.amber, .8), dash: [10, 7], lw: 2, shadow: false })
      chip('整组排队，不占卡', 1495, 690, { size: 18, font: SANS, col: C.amber })
    })
    chip('A 跑完 → B 整组启动', 1385, 842, { size: 20, font: SANS, col: C.green, solid: true, alpha: E.out(P(t, 14.6, 15.0)) })
  },
}

// 场景 2：准入层 vs 调度层
const layers = {
  name: '准入层与调度层', dur: 16, mood: 2,
  vo: [V(0.6, 'Gang 可以做在两层：准入层，或调度层。'),
    V(5.6, 'Kueue 资源不够时不建 Pod，只挂起 Job。'),
    V(10.6, '调度层的 Pod 反复重试，事件刷到 40 万条。')],
  cues: [[0.6, 'whoosh'], [1.4, 'tick'], [5.8, 'pop'], [6.6, 'whoosh'], [7.2, 'pop'], [8.4, 'lock'], [9.2, 'ok'],
    [10.8, 'swell'], ...[0, 1, 2, 3, 4, 5].map(i => [11.8 + i * .5, 'tick']), [14.6, 'alarmSoft']],
  draw(t) {
    heading('在哪一层做 Gang', 140, 210, t, .2, { eyebrow: 'ADMISSION vs SCHEDULING', color: COL })
    // 左：Kueue 准入层
    const L = 140, R = 990
    withA(E.out(P(t, .6, 1.1)) * (t < 10.4 ? 1 : .6), () => {
      panel(L, 270, 790, 600, { r: 22, stroke: t >= 5.6 && t < 10.4 ? COL : C.hair, lw: t >= 5.6 && t < 10.4 ? 2 : 1.5 })
      chip('准入层 · Kueue', L + 32, 312, { size: 21, font: SANS, col: COL, solid: true, align: 'left' })
    })
    withA(E.out(P(t, 1.2, 1.7)), () => {
      txt('任务要 48 卡 · 集群只有 24 卡', L + 32, 372, { size: 21, color: C.body, alpha: t < 10.4 ? 1 : .6 })
      txt('任务要 48 卡 · 集群只有 24 卡', R + 32, 372, { size: 21, color: C.body, alpha: t < 5.4 || t >= 10.4 ? 1 : .6 })
    })
    // 开场：两层各自的职责
    withA(E.out(P(t, 1.8, 2.3)) * (1 - E.out(P(t, 5.4, 5.8))), () => {
      lock(L + 395, 500, 90, COL)
      txt('Pod 创建之前：放不放行', L + 395, 640, { size: 28, weight: 600, align: 'center' })
      txt('资源不够就整个挂起', L + 395, 684, { size: 21, color: C.mute, align: 'center' })
    })
    withA(E.out(P(t, 2.6, 3.1)) * (1 - E.out(P(t, 10.4, 10.8))) * (t < 5.4 ? 1 : .6), () => {
      pod(R + 330, 500, 96, { state: 'pending' }); arrow(R + 390, 500, R + 480, 500, 1, hexA(C.amber, .7), 2.5); node(R + 490, 450, 150, 100, 'node', { accent: C.amber })
      txt('Pod 创建之后：放到哪台', R + 395, 640, { size: 28, weight: 600, align: 'center' })
      txt('凑不齐 minMember 就都 Pending', R + 395, 684, { size: 21, color: C.mute, align: 'center' })
    })
    const lf = t < 10.4 ? 1 : .6
    withA(lf, () => {
      doc(L + 190, 510, 230, 150, 'train-48', COL, { alpha: E.out(P(t, 5.8, 6.3)), size: 24 })
      chip('suspend: true', L + 190, 620, { size: 19, col: COL, alpha: E.out(P(t, 6.2, 6.6)) })
      arrow(L + 318, 510, L + 412, 510, E.out(P(t, 6.6, 7.1)), hexA(COL, .7), 2.5)
      box(L + 570, 510, 290, 110, 'Workload', '等待配额', COL, { alpha: E.out(P(t, 7.0, 7.5)), size: 28, hi: t >= 7.2 && t < 10.4 })
      const zA = E.out(P(t, 8.4, 8.9))
      withA(zA, () => {
        line(L + 32, 680, L + 758, 680, C.hair, 1)
        txt('0', L + 110, 800, { size: 96, weight: 700, color: COL, align: 'center' })
        txt('个 Pod 被创建', L + 170, 768, { size: 26, weight: 600 })
        txt('调度器、etcd 都没有额外压力', L + 170, 808, { size: 20, color: C.mute })
      })
      check(L + 720, 776, 40, C.green, P(t, 9.2, 9.7))
    })
    // 右：调度层
    const rf = t < 5.4 || t >= 10.4 ? 1 : .6
    withA(E.out(P(t, .8, 1.3)) * rf, () => {
      panel(R, 270, 790, 600, { r: 22, stroke: t >= 10.4 ? C.amber : C.hair, lw: t >= 10.4 ? 2 : 1.5 })
      chip('调度层 · Volcano / Coscheduling', R + 32, 312, { size: 21, font: SANS, col: C.amber, align: 'left' })
    })
    const loop = t >= 11.6 ? Math.floor((t - 11.6) * 2) : -1
    for (let i = 0; i < 48; i++) {
      const a = E.out(P(t, 10.8 + i * .015, 11.2 + i * .015)); if (a <= 0) continue
      const x = R + 70 + (i % 8) * 54, y = 410 + Math.floor(i / 8) * 50
      const flash = loop >= 0 && ((t - 11.6) * 2) % 1 < .35
      pod(x, y, 40, { state: 'pending', alpha: a * rf, scale: flash ? 1.12 : 1 })
    }
    withA(E.out(P(t, 11.0, 11.4)), () => {
      txt('48 个 Pod 全部 Pending', R + 70 + 3.5 * 54, 710,{ size: 19, color: C.amber, align: 'center' })
      // 调度循环
      const cx = R + 640, cy = 560
      ctx.save(); ctx.strokeStyle = C.hair; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.stroke()
      if (t >= 11.6) { ctx.strokeStyle = C.amber; ctx.lineCap = 'round'; ctx.beginPath(); const a0 = (t - 11.6) * Math.PI * 4; ctx.arc(cx, cy, 70, a0, a0 + 1.4); ctx.stroke() }
      ctx.restore()
      txt('调度器', cx, cy - 4, { size: 22, weight: 600, align: 'center' })
      txt('每轮重试', cx, cy + 26, { size: 17, color: C.mute, align: 'center' })
      line(R + 32, 780, R + 758, 780, C.hair, 1)
      txt('FailedScheduling 事件', R + 32, 830, { size: 21, color: C.body })
      const n = Math.round(412000 * Math.pow(P(t, 11.6, 14.6), 1.6))
      txt(n.toLocaleString('en-US'), R + 758, 834, { size: 38, weight: 700, font: MONO, color: C.red, align: 'right' })
    })
    for (let k = 0; k < 6; k++) ring(R + 640, 560, P(t, 11.8 + k * .5, 12.6 + k * .5), C.amber, 110)
    chip('apiserver / etcd 压力大', R + 640, 688, { size: 18, font: SANS, col: C.red, solid: true, alpha: E.out(P(t, 14.6, 15.0)) })
  },
}

// 场景 3：Kueue 工作流
const X4 = [300, 720, 1140, 1560], Y1 = 400, Y2 = 720
const flowS = {
  name: 'Kueue 工作流', dur: 17, mood: 2,
  vo: [V(0.6, 'Job 带上队列标签，以挂起状态提交。'),
    V(5.8, 'Kueue 为它建 Workload，在 ClusterQueue 排队。', 'Queue 为它建 Workload，在 Cluster Queue 排队。'),
    V(11.2, '配额够了才解除挂起，Pod 交给调度器。')],
  cues: [[0.6, 'pop'], [1.4, 'tick'], [2.4, 'whoosh'], [2.9, 'pop'], [6.0, 'whoosh'], [6.5, 'pop'], [7.2, 'whoosh'], [7.7, 'pop'], [8.4, 'tick'], [9.4, 'swell'], [10.2, 'ok'],
    [11.4, 'pop'], [11.9, 'tick'], [12.2, 'tick'], [12.9, 'pop'], [13.1, 'pop'], [13.8, 'whoosh'], [14.4, 'chime']],
  draw(t) {
    heading('Kueue：先排队，再放行', 140, 210, t, .2, { eyebrow: 'KUEUE FLOW', color: COL })
    const B1 = [['Job', 'suspend: true', .6, C.blue], ['Workload', 'nvidia.com/gpu: 8', 2.8, COL], ['LocalQueue', 'ns: team-a', 6.4, COL], ['ClusterQueue', 'nominalQuota: 24', 7.6, COL]]
    const cur = t < 2.8 ? 0 : t < 6.4 ? 1 : t < 7.6 ? 2 : t < 11.2 ? 3 : -1
    B1.forEach(([n, s, t0, c], i) => box(X4[i], Y1, 300, 112, n, s, c, { alpha: E.out(P(t, t0, t0 + .5)), size: 28, hi: cur === i }))
    chip('kueue.x-k8s.io/queue-name', X4[0], 488, { size: 17, col: C.blue, alpha: E.out(P(t, 1.4, 1.9)) })
    code(140, 560, 620, ['apiVersion: batch/v1', 'kind: Job', 'metadata:', '  labels:', '    kueue.x-k8s.io/queue-name: team-a', 'spec:', '  suspend: true'], t, 1.0,
      { title: 'train-job.yaml', size: 19, hi: [4, 6], alpha: E.out(P(t, .9, 1.3)) * (1 - E.out(P(t, 12.2, 12.6))) })
    chip('一个 Job 对应一个', X4[1], 488, { size: 17, font: SANS, col: COL, alpha: E.out(P(t, 3.4, 3.9)) })
    chip('命名空间级 · 用户可见', X4[2], 488, { size: 17, font: SANS, col: COL, alpha: E.out(P(t, 6.8, 7.3)) })
    chip('集群级 · 3 台 × 8 卡', X4[3], 488, { size: 17, font: SANS, col: COL, alpha: E.out(P(t, 8.0, 8.5)) })
    ;[[2.4, 0], [6.0, 1], [7.2, 2]].forEach(([t0, i]) => {
      arrow(X4[i] + 154, Y1, X4[i + 1] - 158, Y1, E.out(P(t, t0, t0 + .4)), hexA(COL, .7), 2.5)
      travel(X4[i] + 154, Y1, X4[i + 1] - 158, Y1, P(t, t0, t0 + .6), COL)
    })
    // 配额检查
    arrow(X4[3], 460 + 46, X4[3], 640, E.out(P(t, 8.4, 8.8)), hexA(COL, .7), 2.5)
    const mA = E.out(P(t, 8.6, 9.0))
    withA(mA, () => {
      const f = (16 + 8 * E.inOut(P(t, 9.4, 10.0))) / 24
      meter(X4[3] - 150, 700, 300, 24, f, f >= 1 ? C.green : COL, { label: 'GPU 配额', value: `${Math.round(f * 24)} / 24` })
      txt('已用 16 + 申请 8', X4[3], 760, { size: 18, color: C.mute, align: 'center' })
    })
    chip('Admitted', X4[3], 812, { size: 22, col: C.green, solid: true, alpha: E.back(clamp(P(t, 10.2, 10.6))) })
    // 解除挂起
    const sA = E.out(P(t, 11.4, 11.9))
    arrow(X4[3] - 162, Y2, 1358, Y2, sA, hexA(C.green, .8), 2.5)
    withA(sA, () => {
      panel(930, 630, 420, 180, { r: 16, fill: tint(C.green, .05), stroke: hexA(C.green, .6), lw: 2 })
      txt('Job · suspend: false', 956, 676, { size: 24, font: MONO, color: C.text })
      txt('按 ResourceFlavor 落到 H100 节点', 956, 786, { size: 18, color: C.mute })
    })
    chip('+ nodeSelector', 956, 732, { size: 18, col: C.green, align: 'left', alpha: E.out(P(t, 11.9, 12.3)) })
    chip('+ tolerations', 1140, 732, { size: 18, col: C.green, align: 'left', alpha: E.out(P(t, 12.2, 12.6)) })
    arrow(926, Y2, 790, Y2, E.out(P(t, 12.6, 13.0)), hexA(C.green, .8), 2.5)
    ;[0, 1].forEach(i => { const k = E.back(clamp(P(t, 12.9 + i * .2, 13.3 + i * .2))); pod(610 + i * 130, Y2 - 10, 90, { state: t >= 14.4 ? 'run' : 'pending', label: `worker-${i}`, alpha: clamp(k), scale: clamp(k) }) })
    arrow(548, Y2 - 10, 456, Y2 - 10, E.out(P(t, 13.8, 14.2)), hexA(C.blue, .7), 2.5)
    travel(548, Y2 - 10, 456, Y2 - 10, P(t, 13.8, 14.4), C.blue)
    box(300, Y2 - 10, 300, 112, 'kube-scheduler', '普通调度', C.blue, { alpha: E.out(P(t, 13.6, 14.0)), size: 28, hi: t >= 14.4 })
    withA(E.out(P(t, 15.0, 15.5)), () => txt('资源不足时，Job 停在挂起状态，一个 Pod 都不建', 960, 876, { size: 20, color: C.body, align: 'center' }))
  },
}

// 场景 4：Cohort 借用与回收
const CX = i => 420 + i * 78, RA = 430, RB = 640
const cell = (i, y, col, a = 1, dash) => withA(a, () => { ctx.save(); rr(CX(i), y - 34, 66, 68, 10); ctx.fillStyle = col ? tint(col, .2) : 'rgba(0,0,0,0.03)'; ctx.fill(); ctx.strokeStyle = col ? col : C.hair; ctx.lineWidth = col ? 2 : 1.5; if (dash) ctx.setLineDash([7, 5]); ctx.stroke(); ctx.restore() })
const bracket = (i0, i1, y, s, col, a) => withA(a, () => { const x0 = CX(i0) + 4, x1 = CX(i1) + 62; line(x0, y, x1, y, hexA(col, .7), 2); line(x0, y - 8, x0, y, hexA(col, .7), 2); line(x1, y - 8, x1, y, hexA(col, .7), 2); txt(s, (x0 + x1) / 2, y + 26, { size: 18, font: MONO, color: col, align: 'center' }) })
const cohort = {
  name: 'Cohort 借用', dur: 17, mood: 3,
  vo: [V(0.6, '同一 Cohort 的队列，可以互借闲置配额。'),
    V(5.8, 'team-a 保底 16 卡，最多再借 8 卡。'),
    V(11.0, 'team-b 要用时，整个驱逐借来的 Workload。')],
  cues: [[0.6, 'whoosh'], [1.6, 'pop'], [2.4, 'pop'], [3.4, 'tick'], [6.2, 'whoosh'], [6.8, 'pop'], [7.8, 'lock'], [8.8, 'error'],
    [11.2, 'pop'], [12.0, 'impact'], [12.6, 'whoosh'], [13.2, 'pop'], [13.6, 'pop'], [14.4, 'chime']],
  draw(t) {
    heading('Cohort：借闲置配额，用时收回', 140, 210, t, .2, { eyebrow: 'COHORT', color: COL })
    withA(E.out(P(t, .6, 1.1)), () => {
      panel(140, 270, 1640, 570, { r: 22, fill: tint(COL, .025), stroke: hexA(COL, .5), dash: [12, 8], lw: 2, shadow: false })
      chip('cohort: gpu-pool', 172, 306, { size: 20, col: COL, solid: true, align: 'left' })
      txt('两个 ClusterQueue 共享闲置配额', 1748, 314, { size: 19, color: C.mute, align: 'right' })
      ;[['team-a', RA, JA, true], ['team-b', RB, JB, false]].forEach(([n, y, col, lim]) => {
        txt(n, 172, y - 6, { size: 28, weight: 600, font: MONO, color: col })
        txt('nominalQuota 16', 172, y + 24, { size: 17, font: MONO, color: C.mute })
        if (lim) txt('borrowingLimit 8', 172, y + 48, { size: 17, font: MONO, color: C.mute })
      })
    })
    const back = t >= 12.0, bFill = i => t >= 13.0 + i * .06
    // 行 A：自有 16 卡
    for (let i = 0; i < 16; i++) {
      const a = E.out(P(t, .8 + i * .03, 1.2 + i * .03))
      cell(i, RA, t >= (i < 8 ? 1.6 : 2.4) ? JA : null, a)
    }
    // 行 B：借出 / 自用
    const ev = P(t, 12.0, 12.6)
    for (let i = 0; i < 16; i++) {
      const a = E.out(P(t, 1.0 + i * .03, 1.4 + i * .03))
      const lent = i < 8 && t >= 6.8 + i * .05 && !back
      cell(i, RB, bFill(i) ? JB : lent ? JA : null, a, lent)
      if (i < 8 && back) poof(CX(i) + 33, RB, ev, JA)
    }
    for (let i = 0; i < 8; i++) travel(CX(i) + 33, RA + 34, CX(i) + 33, RB - 34, P(t, 6.2 + i * .05, 6.8 + i * .05), JA, 6)
    bracket(0, 7, RA + 54, 'wl-1 · 8 卡', JA, E.out(P(t, 1.8, 2.2)))
    bracket(8, 15, RA + 54, 'wl-2 · 8 卡', JA, E.out(P(t, 2.6, 3.0)))
    bracket(0, 7, RB + 54, 'wl-3 · 借用 8 卡', JA, E.out(P(t, 7.0, 7.4)) * (1 - E.out(P(t, 12.0, 12.4))))
    bracket(0, 15, RB + 54, 'team-b 训练 · 16 卡', JB, E.out(P(t, 13.8, 14.2)))
    // 占用计数
    const used = t >= 6.8 && !back ? 24 : t >= 2.4 ? 16 : t >= 1.6 ? 8 : 0
    withA(E.out(P(t, 1.2, 1.6)), () => {
      txt(`${used}/16${used > 16 ? '+8' : ''}`, 1760, RA + 8, { size: 22, font: MONO, color: used > 16 ? C.amber : JA, align: 'right' })
      txt(`${t >= 13.8 ? 16 : 0}/16`, 1760, RB + 8, { size: 22, font: MONO, color: JB, align: 'right' })
    })
    chip('空闲 16 卡', CX(15) + 66, RB - 62, { size: 18, font: SANS, col: C.mute, align: 'right', alpha: E.out(P(t, 3.4, 3.8)) * (1 - E.out(P(t, 6.2, 6.6))) })
    // 借用上限
    const lA = E.out(P(t, 7.8, 8.2)) * (1 - E.out(P(t, 12.0, 12.4)))
    withA(lA, () => {
      const x = CX(8) - 6
      line(x, RB - 50, x, RB + 44, C.amber, 3, [8, 6])
      chip('borrowingLimit', x + 12, RB - 62, { size: 17, col: C.amber, align: 'left' })
    })
    chip('wl-4 继续排队：超出借用上限', 960, 790, { size: 20, font: SANS, col: C.amber, alpha: E.out(P(t, 8.8, 9.2)) * (1 - E.out(P(t, 10.8, 11.2))) })
    // 回收
    chip('team-b 提交 16 卡任务', 960, 790, { size: 20, font: SANS, col: JB, solid: true, alpha: E.out(P(t, 11.2, 11.5)) * (1 - E.out(P(t, 11.8, 12.0))) })
    chip('reclaimWithinCohort: Any → 驱逐整个 wl-3', 960, 790, { size: 20, col: C.red, solid: true, alpha: E.out(P(t, 12.0, 12.3)) * (1 - E.out(P(t, 14.2, 14.5))) })
    chip('wl-3 回到队列，等配额再准入', 960, 790, { size: 20, font: SANS, col: C.green, solid: true, alpha: E.out(P(t, 14.4, 14.8)) })
  },
}

// 场景 5：选型与共存
const TB = [['工作层', '准入层', '调度层', '调度层'], ['资源不足时', '0 个 Pod', '全组 Pending', '全组 Pending'], ['抢占粒度', '整个 Workload', 'PodGroup', '不支持']]
const TX = [140, 380, 590, 800]
const KCFG = ['integrations:', '  frameworks:', '  - batch/job', '  - jobset.x-k8s.io/jobset', '  # 不要加 pod / deployment']
const choose = {
  name: '选型与共存', dur: 16, mood: 3,
  vo: [V(0.6, '选型：Kueue 首选，Volcano 备选。'),
    V(5.4, '两者共存时，Kueue 不要启用 pod 集成。'),
    V(10.8, '否则它的 webhook 会截走 Volcano 的 Pod。', '否则它的 web hook 会截走 Volcano 的 Pod。')],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2].map(i => [1.4 + i * .4, 'tick']), [3.2, 'chime'], [5.6, 'pop'], [6.6, 'tick'], [7.4, 'alarmSoft'],
    [11.0, 'pop'], [11.6, 'whoosh'], [12.2, 'error'], [13.4, 'tick'], [13.9, 'tick']],
  draw(t) {
    heading('选型与共存陷阱', 140, 210, t, .2, { eyebrow: 'CHOOSE', color: COL })
    // 左：对比表
    const rec = E.out(P(t, 3.0, 3.5))
    withA(E.out(P(t, .6, 1.1)), () => {
      if (rec > 0) withA(rec, () => panel(TX[1] - 16, 280, 206, 440, { r: 18, fill: tint(COL, .07), stroke: COL, lw: 2.5, shadow: false }))
      ;['Kueue', 'Volcano', 'Coscheduling'].forEach((n, i) => txt(n, TX[i + 1], 330, { size: 25, weight: 600 }))
      line(140, 356, 1000, 356, C.hairD, 1.5)
    })
    TB.forEach((r, i) => {
      const a = E.out(P(t, 1.4 + i * .4, 1.9 + i * .4)); if (a <= 0) return
      const y = 420 + i * 84
      withA(a, () => {
        txt(r[0], TX[0], y, { size: 20, color: C.mute })
        r.slice(1).forEach((s, k) => txt(s, TX[k + 1], y, { size: 21, color: k === 0 ? C.text : C.body }))
        line(140, y + 34, 1000, y + 34, C.hair, 1)
      })
    })
    ;[['首选', COL, true], ['备选', C.amber, false], ['仅学习演示', C.mute, false]].forEach(([s, c, solid], i) =>
      chip(s, TX[i + 1], 670, { size: 20, font: SANS, col: c, solid, align: 'left', alpha: E.back(clamp(P(t, 3.0 + i * .2, 3.4 + i * .2))) }))
    withA(E.out(P(t, 13.4, 13.9)), () => txt('· kubectl get queue 查到的是 Kueue 的 LocalQueue，Volcano 用 q', 140, 780, { size: 19, color: C.body }))
    withA(E.out(P(t, 13.9, 14.4)), () => txt('· Volcano 跑 TrainJob：先建 PodGroup（minMember: 2）', 140, 822, { size: 19, color: C.body }))
    // 右：Kueue 配置
    code(1060, 280, 720, KCFG, t, 5.6, { title: 'kueue values.yaml', size: 20, hi: [4], hiColor: C.red, alpha: E.out(P(t, 5.5, 5.9)) })
    // 右下：截走 Pod
    const dA = E.out(P(t, 11.0, 11.5))
    withA(dA, () => {
      pod(1120, 670, 90, { state: t >= 12.2 ? 'pending' : C.amber, label: 'volcano Pod' })
      box(1380, 670, 240, 100, 'Kueue webhook', 'pod 集成', C.red, { size: 25, hi: t >= 12.2 })
      box(1660, 670, 200, 100, 'Volcano', 'scheduler', C.amber, { size: 25 })
    })
    arrow(1168, 670, 1256, 670, E.out(P(t, 11.6, 12.0)), hexA(C.red, .8), 2.5)
    travel(1168, 670, 1256, 670, P(t, 11.6, 12.1), C.red)
    arrow(1502, 670, 1556, 670, dA, hexA(C.amber, .6), 2.5, [6, 5])
    cross(1529, 670, 28, C.red, E.out(P(t, 12.2, 12.5)))
    chip('Pod 被挂起，永远到不了 volcano-scheduler', 1420, 800, { size: 19, font: SANS, col: C.red, solid: true, alpha: E.out(P(t, 12.4, 12.9)) })
  },
}

ANIM({
  id: 'batch-scheduling',
  meta: { stage: 5, lesson: 2, of: 6, title: '批调度：Kueue、Volcano 与 Gang 调度', summary: '队列与配额、公平共享、PodGroup 全有或全无调度。', next: '分布式训练与高性能网络' },
  scenes: [
    lessonIntro({ tags: ['Gang', 'Kueue', 'ClusterQueue', 'Cohort', 'Volcano'], vo: [V(3.2, '训练任务要整组调度，还要排队和配额。')] }),
    gang, layers, flowS, cohort, choose,
    lessonOutro({
      points: ['Gang：一组 Pod 全有或全无，避免死锁', 'Kueue 在准入层排队：资源不足时 0 个 Pod', 'ClusterQueue 配额 + Cohort 借用与收回', '共存时 Kueue 不启用 pod / deployment 集成'],
      vo: [V(0.8, '小结：批调度靠整组准入和队列配额。'), V(5.6, '下一课，分布式训练与高性能网络。')],
    }),
  ],
})
})()
