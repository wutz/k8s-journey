/* 第 5 阶段 · 第 4 课：大模型推理服务 */
(() => {
const COL = STAGES[5].color
const PV = C.violet, DC = C.cyan

// 局部小工具：带刻度的区间括号
function bracket(x1, x2, y, s, a, col) {
  if (a <= 0) return
  withA(a, () => {
    line(x1, y - 10, x1, y + 10, col, 2); line(x2, y - 10, x2, y + 10, col, 2)
    partialLine(x1, y, x2, y, E.out(a), col, 2)
  })
  chip(s, (x1 + x2) / 2, y - 30, { size: 18, col, alpha: E.out(P(a, .4, 1)), font: SANS })
}
function sq(x, y, w, h, col, a = 1, s, o = {}) { // 圆角方块（token / 显存段）
  withA(a, () => {
    ctx.save(); rr(x, y, w, h, o.r ?? 8); ctx.fillStyle = o.fill || tint(col, .16); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
    if (s) txt(s, x + w / 2, y + h / 2 + (o.size || 24) * .36, { size: o.size || 24, align: 'center', font: o.font || SANS, color: o.color || C.text })
  })
}

// 场景 1：Prefill 与 Decode
const OUT = [...'容器编排平台，自动调度与扩容']
const TOK0 = 4.8, TOKDT = .62
const phases = {
  name: 'Prefill 与 Decode', dur: 16, mood: 1,
  vo: [[0.6, 'LLM 推理分两段：Prefill 和 Decode。'],
    [5.0, 'Prefill 一次算完整段输入，决定首字延迟。'],
    [10.6, 'Decode 逐个生成 token，间隔就是 TPOT。']],
  cues: [[0.6, 'whoosh'], [1.4, 'zap'], [4.4, 'ok'], ...OUT.map((_, i) => [TOK0 + i * TOKDT, 'tick']), [7.0, 'chime'], [5.6, 'pop'], [11.0, 'pop'], [12.4, 'ding2']],
  draw(t) {
    heading('推理的两个阶段：Prefill 与 Decode', 140, 210, t, .2, { eyebrow: 'PREFILL · DECODE', color: COL })
    // 输入 prompt
    const ia = E.out(P(t, .6, 1.2))
    for (let i = 0; i < 16; i++) {
      const x = 260 + i * 42, used = P(t, 1.4 + i * .05, 2.2 + i * .05)
      sq(x, 322, 34, 34, PV, ia * (1 - .55 * used), null, { r: 7 })
    }
    txt('输入 prompt：整段一次送入', 260 + 16 * 42 + 24, 348, { size: 22, color: C.body, alpha: ia })
    for (let i = 0; i < 16; i++) travel(277 + i * 42, 360, 480, 486, P(t, 1.4 + i * .05, 2.1 + i * .05), PV, 5)
    // Prefill 块
    const pa = E.out(P(t, 1.3, 1.8)), pf = E.inOut(P(t, 1.6, 4.4))
    withA(pa, () => {
      panel(260, 484, 440, 76, { r: 12, stroke: hexA(PV, .7), lw: 2 })
      ctx.save(); rr(260, 484, 440 * Math.max(.03, pf), 76, 12); ctx.fillStyle = tint(PV, .24); ctx.fill(); ctx.restore()
      txt('Prefill', 480, 531, { size: 28, weight: 600, align: 'center', color: PV })
    })
    // Decode token
    const nOut = OUT.filter((_, i) => t >= TOK0 + i * TOKDT).length
    OUT.forEach((ch, i) => {
      const t0 = TOK0 + i * TOKDT, k = E.back(P(t, t0, t0 + .3)); if (k <= 0) return
      const x = 720 + i * 70
      withA(clamp(k), () => sq(x, 492 + (1 - k) * 20, 58, 60, DC, 1, ch, { size: 26 }))
    })
    withA(E.out(P(t, TOK0, TOK0 + .4)), () => txt('Decode：每步生成一个 token', 1300, 628, { size: 18, color: DC, align: 'center', font: SANS }))
    // KV Cache 条
    const kvW = 440 * pf + OUT.reduce((s, _, i) => s + 70 * E.out(P(t, TOK0 + i * TOKDT, TOK0 + i * TOKDT + .3)), 0)
    if (pf > 0) {
      ctx.save(); rr(260, 578, Math.max(10, kvW), 18, 9); ctx.fillStyle = tint(COL, .3); ctx.fill(); ctx.strokeStyle = hexA(COL, .7); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
      txt('KV Cache', 244, 594, { size: 18, font: MONO, color: COL, align: 'right', alpha: pa })
    }
    // 时间轴
    withA(ia, () => {
      line(260, 664, 1720, 664, C.hairD, 2); arrowHead(1728, 664, 0, C.hairD, 12)
      txt('请求到达', 260, 696, { size: 18, color: C.mute }); txt('时间 →', 1728, 696, { size: 18, color: C.mute, align: 'right' })
    })
    // TTFT / TPOT
    bracket(260, 749, 452, 'TTFT · 首 token 延迟', P(t, 6.8, 7.6), COL)
    bracket(1239, 1309, 452, 'TPOT', P(t, 12.2, 12.9), DC)
    // 特性卡
    ;[[260, 'Prefill', '计算密集', '一次处理整段输入，生成 KV Cache', 'GPU 算力', PV, 5.6],
      [1020, 'Decode', '访存密集', '每步都要读全部权重和 KV Cache', '显存带宽', DC, 11.0]].forEach(([x, n, tag, d, m, c, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 722 + lerp(20, 0, a), 700, 150, { r: 18, stroke: hexA(c, .5) })
        const y = 722 + lerp(20, 0, a)
        chip(n, x + 28, y + 40, { size: 22, align: 'left', col: c, solid: true })
        chip(tag, x + 672, y + 40, { size: 18, align: 'right', col: c, font: SANS })
        txt(d, x + 28, y + 92, { size: 22, color: C.text })
        txt(m, x + 28, y + 128, { size: 18, color: C.mute })
        meter(x + 130, y + 118, 540, 12, .92 * E.out(P(t, t0 + .3, t0 + 1.4)), c)
      })
    })
  },
}

// 场景 2：单机 vLLM
const VY = [
  'kind: StatefulSet',
  'spec:',
  '  replicas: 4',
  '  containers:',
  '    - image: vllm/vllm-openai:v0.11.0',
  '      args:',
  '        - --gpu-memory-utilization=0.85',
  '        - --max-model-len=32768',
  '      startupProbe:',
  '        failureThreshold: 60',
  '        periodSeconds: 10',
  '      resources:',
  '        limits: {nvidia.com/gpu: 1}',
]
const vllm = {
  name: '单机 vLLM', dur: 16, mood: 2,
  vo: [[0.6, '单机部署：一个 StatefulSet 跑 vLLM。', '单机部署：一个 StatefulSet 跑 V L L M。'],
    [5.2, '显存除了权重，剩下的都分给 KV Cache。'],
    [10.4, '加载权重要几分钟，一定要配 startupProbe。', '加载权重要几分钟，一定要配 startup probe。']],
  cues: [[0.6, 'whoosh'], [0.9, 'tick'], [2.2, 'pop'], [2.4, 'pop'], [2.6, 'pop'], [2.8, 'pop'], [3.4, 'shimmer'], [5.6, 'zap'], [6.6, 'pop'],
    [12.3, 'error'], [14.1, 'error'], [15.0, 'ok']],
  draw(t) {
    heading('单机部署：vLLM on StatefulSet', 140, 210, t, .2, { eyebrow: 'SINGLE NODE', color: COL })
    const hi = t < 5.2 ? [0, 2] : t < 10.4 ? [6] : [8, 9, 10]
    code(140, 270, 820, VY, t, .8, { title: 'vllm-qwen.yaml', size: 21, step: .1, hi, hiColor: COL, alpha: E.out(P(t, .6, 1.1)) })
    // A · 4 个副本共享 PVC
    const R = 1040
    ;[0, 1, 2, 3].forEach(i => {
      const k = E.back(P(t, 2.2 + i * .2, 2.7 + i * .2)); if (k <= 0) return
      const x = 1090 + i * 140
      pod(x, 330, 78, { state: 'gpu', label: 'qwen3-8b-' + i, alpha: clamp(k), scale: k })
      partialLine(x, 410, x, 440, E.out(P(t, 3.2, 3.6)), hexA(C.teal, .6), 2)
    })
    const ca = E.out(P(t, 3.2, 3.8))
    partialLine(1090, 440, 1690, 440, ca, hexA(C.teal, .6), 2)
    partialLine(1690, 392, 1690, 440, ca, hexA(C.teal, .6), 2)
    cylinder(1690, 340, 84, 56, C.teal, null, ca)
    withA(ca, () => txt('PVC · llm-model', 1690, 290, { size: 16, font: MONO, color: C.teal, align: 'center' }))
    withA(E.out(P(t, 3.6, 4.2)), () => txt('4 个副本共享一份模型权重', R, 482, { size: 20, color: C.body }))
    // B · 显存划分
    const ba = E.out(P(t, 5.4, 5.9)), kv = E.inOut(P(t, 6.6, 8))
    withA(ba, () => {
      txt('GPU 显存 · 80GB', R, 540, { size: 22, weight: 600 })
      chip('--gpu-memory-utilization=0.85', 1780, 533, { size: 16, col: COL, align: 'right' })
      ctx.save(); rr(R, 560, 740, 56, 10); ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill(); ctx.restore()
      sq(R, 560, 740 * .2, 56, PV, E.out(P(t, 5.6, 6)), '权重 16GB', { size: 18 })
      if (kv > 0) sq(R + 148, 560, 481 * kv, 56, COL, 1, kv > .6 ? 'KV Cache' : null, { size: 20 })
      txt('预留', R + 740 * .925, 594, { size: 18, color: C.mute, align: 'center' })
      line(R + 629, 552, R + 629, 624, hexA(C.text, .4), 2, [5, 5])
    })
    withA(E.out(P(t, 8, 8.6)), () => txt('KV Cache 越大，能并发的请求越多', R, 652, { size: 20, color: C.body }))
    // C · startupProbe
    const sa = E.out(P(t, 10.4, 10.9))
    withA(sa, () => {
      txt('启动：加载权重可能要几分钟', R, 708, { size: 22, weight: 600 })
      txt('只配 liveness', R, 764, { size: 20, color: C.body })
      txt('+ startupProbe', R, 832, { size: 20, font: MONO, color: C.text })
      ;[742, 810].forEach(y => { ctx.save(); rr(1230, y, 550, 30, 15); ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill(); ctx.restore() })
    })
    if (t > 10.8) {
      const c = (t - 10.8) % 1.8, n = Math.floor((t - 10.8) / 1.8), f = Math.min(c / 1.5, 1) * .38, dead = c > 1.5
      sq(1230, 742, Math.max(30, 550 * f), 30, dead ? C.red : C.amber, 1, null, { r: 15 })
      if (dead) cross(1230 + 550 * .38 + 30, 757, 22, C.red)
      chip(`被杀 ×${n + (dead ? 1 : 0)}`, 1780, 757, { size: 16, col: C.red, align: 'right', alpha: n || dead ? 1 : 0 })
      const g = E.inOut(P(t, 11.2, 15))
      sq(1230, 810, Math.max(30, 550 * g), 30, g >= 1 ? C.green : C.amber, 1, g > .5 && g < 1 ? '60 × 10s 宽限' : null, { r: 15, size: 16, font: MONO })
      if (g >= 1) { check(1745, 825, 24, '#fff', P(t, 15, 15.3)) }
    }
  },
}

// 场景 3：LeaderWorkerSet
const lws = {
  name: 'LeaderWorkerSet', dur: 17.5, mood: 3,
  vo: [[0.6, '671B 的大模型，单机 8 卡放不下。', '6710 亿参数的模型，单机 8 卡放不下。'],
    [4.8, 'LWS 把一组 Pod 当成一个副本。'],
    [8.6, 'Service 只选中 leader。'],
    [12.2, '任一 Pod 重启，整组重建、重新加载。']],
  cues: [[0.6, 'whoosh'], [0.9, 'tick'], [1.3, 'tick'], [2.6, 'error'], [4.8, 'pop'], [5.2, 'pop'], [6.0, 'shimmer'], [7.0, 'zap'], [8.6, 'pop'], [9.6, 'tick'],
    [12.2, 'error'], [13.0, 'poof'], [13.6, 'whoosh'], [15.6, 'chime']],
  draw(t, T) {
    heading('跨节点推理：LeaderWorkerSet', 140, 210, t, .2, { eyebrow: 'MULTI-NODE', color: COL })
    // 容量对比
    const b1 = E.inOut(P(t, .8, 2)), b2 = E.inOut(P(t, 1.2, 2.3))
    withA(E.out(P(t, .6, 1)), () => {
      txt('DeepSeek-R1 FP8 权重 ≈ 700GB', 540, 296, { size: 20, align: 'right', color: C.text })
      txt('单机 8 × 80GB = 640GB', 540, 338, { size: 20, align: 'right', color: C.text })
      meter(560, 282, 700 * b1, 18, 1, C.red)
      meter(560, 324, 640 * b2, 18, 1, PV)
    })
    withA(E.out(P(t, 2.6, 3)), () => { line(1200, 272, 1200, 352, hexA(C.red, .6), 2, [5, 5]); chip('放不下 → 一个副本要跨 2 台机器', 1300, 312, { size: 20, col: C.red, align: 'left', font: SANS }) })
    // 状态
    const st = t < 12.2 ? 0 : t < 13 ? 1 : t < 15.6 ? 2 : 3
    const reload = E.inOut(P(t, 13.6, 15.6))
    // 组边框
    const ga = E.out(P(t, 5.8, 6.4))
    withA(ga, () => {
      panel(360, 395, 1380, 380, { r: 26, fill: hexA(COL, .04), stroke: hexA(COL, .55), dash: [12, 9], lw: 2, shadow: false })
      chip('LWS 组 0 · 一个模型副本 · 16 卡', 1050, 395, { size: 18, col: COL, solid: true, font: SANS })
    })
    ;[[390, '10.243.145.103', 'vllm-0 · leader', 4.8], [1110, '10.243.145.105', 'vllm-0-1 · worker', 5.2]].forEach(([x, name, pn, t0], j) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 420
      node(x, y, 600, 330, name, { alpha: a, tag: 'GPU × 8', accent: PV })
      withA(a, () => {
        const bad = st === 1 && j === 1, sh = bad ? Math.sin(T * 70) * 6 * (1 - P(t, 12.2, 12.8)) : 0
        const lab = st === 1 ? (j ? 'vllm-0-1 · Error' : pn) : st === 2 ? pn.split(' ')[0] + ' · 重建中' : pn
        const lc = bad ? C.red : st === 2 ? C.amber : j ? C.blue : COL
        chip(lab, x + 300 + sh, y + 82, { size: 20, col: lc, solid: st !== 2 })
        for (let k = 0; k < 8; k++) {
          const gx = x + 120 + (k % 4) * 120, gy = y + 158 + Math.floor(k / 4) * 84
          const gk = E.back(P(t, t0 + .2 + k * .05, t0 + .5 + k * .05))
          const col = st === 1 && j === 1 ? C.red : st === 2 ? (reload > (k + 1) / 9 ? PV : C.faint) : PV
          const fade = st === 1 ? 1 : st === 2 ? lerp(.35, 1, reload) : 1
          gpu(gx, gy, 48 * clamp(gk), col, clamp(gk) * fade)
        }
        if (st === 2) { meter(x + 120, y + 294, 360, 14, reload, C.amber); txt('加载模型…', x + 500, y + 306, { size: 18, color: C.amber, align: 'left' }) }
        else chip(j ? 'TP = 8 · 机内张量并行' : 'TP = 8 · 机内张量并行', x + 300, y + 300, { size: 18, col: PV, font: SANS, alpha: E.out(P(t, 6.4, 6.9)) })
      })
      if (st === 1 && j === 1) ring(x + 300, y + 200, P(t, 12.2, 13), C.red, 260)
    })
    // PP 跨机
    const pa = E.out(P(t, 7, 7.5))
    if (pa > 0 && st !== 2) {
      withA(pa, () => { chip('PP = 2', 1050, 548, { size: 16, col: DC }); txt('RDMA', 1050, 640, { size: 16, font: MONO, color: DC, align: 'center' }) })
      flow(990, 590, 1110, 590, t, DC, 3, 1.2, 0, 5); flow(1110, 604, 990, 604, t, DC, 3, 1.2, .5, 4)
    }
    // Service → leader
    const sa = E.out(P(t, 8.6, 9.1))
    box(220, 590, 150, 100, 'Service', 'role=leader', C.blue, { size: 24, alpha: sa })
    arrow(295, 590, 390, 590, sa, C.blue, 2.5)
    if (sa > .9 && st !== 2) flow(300, 590, 390, 590, t, C.blue, 2, .8, 0, 4)
    withA(E.out(P(t, 9.4, 9.9)), () => txt('Service 不指向 worker：它只参与计算', 1740, 836, { size: 18, color: C.mute, align: 'right' }))
    // 底部要点
    const chips = [['env: LWS_LEADER_ADDRESS', C.blue, 9.6, MONO], ['restartPolicy: RecreateGroupOnPodRestart', C.red, 12.6, MONO]]
    let x = 360
    chips.forEach(([s, c, t0, f]) => { const w = chip(s, x, 830, { size: 18, col: c, align: 'left', font: f, alpha: E.out(P(t, t0, t0 + .4)) }); x += (w || textW(s, 18, { font: f }) + 24) + 20 })
  },
}

// 场景 4：推理网关
const PODS = [['vllm-0', 'B', 2, .55], ['vllm-1', 'A', 1, .4], ['vllm-2', 'C', 5, .8]]
const PY = [380, 560, 740]
const RR = [[1.4, 0], [2.6, 1], [3.8, 2]]
const EB = [6.2, 7.9, 9.5, 13.8]
const SC = [.31, .92, .18]
const gateway = {
  name: '推理网关', dur: 17, mood: 3,
  vo: [[0.6, '普通负载均衡只会轮询，打散了 KV 缓存。'],
    [5.6, '推理网关每收到请求，都先问 EPP 发给谁。', '推理网关每收到请求，都先问 E P P 发给谁。'],
    [10.8, 'EPP 按前缀命中、队列和 KV 使用率打分。', 'E P P 按前缀命中、队列和 KV 使用率打分。']],
  cues: [[0.6, 'whoosh'], ...RR.map(([a, i]) => [a + 1.2, i === 1 ? 'ok' : 'error']), [5.8, 'pop'], ...EB.flatMap(a => [[a + .6, 'tick'], [a + .9, 'zap'], [a + 1.8, 'ok']]), [8.6, 'chime'], [11.4, 'ding1'], [12.2, 'ding2'], [13.0, 'ding3']],
  draw(t, T) {
    heading('推理网关：按 KV Cache 路由', 140, 210, t, .2, { eyebrow: 'INFERENCE GATEWAY', color: COL })
    const epp = t >= 5.6, eA = E.out(P(t, 5.6, 6.2))
    // 客户端 / 网关
    const a0 = E.out(P(t, .6, 1.1))
    user(210, 600, 28, C.body, a0)
    withA(a0, () => txt('Client', 210, 700, { size: 18, font: MONO, color: C.mute, align: 'center' }))
    box(560, 600, 230, 110, 'Gateway', 'Envoy · kgateway', C.blue, { size: 26, alpha: a0 })
    chip(epp ? 'EPP 选择 · 前缀感知' : '轮询 / 随机', 560, 700, { size: 18, col: epp ? COL : C.mute, font: SANS, alpha: a0 })
    // EPP
    withA(eA, () => {
      panel(380, 282 + lerp(20, 0, eA), 360, 158, { r: 16, stroke: COL, lw: 2.5, fill: tint(COL, .05) })
      txt('EPP · 端点选择器', 560, 326 + lerp(20, 0, eA), { size: 24, weight: 600, align: 'center' })
      const F = ['前缀命中', '队列长度', 'KV 使用率']; let fx = 404
      F.forEach((s, i) => { const on = t >= 11.4 + i * .8 && t < 16; const w = chip(s, fx, 392, { size: 17, col: on ? COL : C.mute, solid: on, align: 'left', font: SANS }); fx += w + 10 })
      line(530, 440, 530, 545, hexA(COL, .5), 2, [5, 5]); line(590, 440, 590, 545, hexA(COL, .5), 2, [5, 5])
      chip('ext-proc', 668, 492, { size: 15, col: COL })
    })
    // InferencePool
    const pA = E.out(P(t, .8, 1.3))
    withA(pA, () => {
      panel(1090, 290, 690, 560, { r: 24, fill: hexA(PV, .03), stroke: hexA(PV, .5), dash: [10, 8], lw: 2, shadow: false })
      chip(epp ? 'InferencePool · app=qwen3-8b' : 'Service 后端', 1435, 290, { size: 17, col: PV, solid: true })
    })
    PODS.forEach(([n, pre, q, kv], i) => {
      const y = PY[i], a = E.out(P(t, 1 + i * .15, 1.5 + i * .15)); if (a <= 0) return
      pod(1170, y, 88, { state: 'gpu', label: n, alpha: a })
      partialLine(675, 600, 1116, y, a, hexA(C.text, .12), 2)
      withA(a, () => {
        panel(1250, y - 58, 500, 116, { r: 14, stroke: C.hair })
        const hiP = t >= 11.4 && t < 16 && t < 12.2, hiQ = t >= 12.2 && t < 13, hiK = t >= 13 && t < 16
        chip(`KV 前缀 ${pre}`, 1272, y - 22, { size: 18, col: pre === 'A' ? COL : C.mute, solid: pre === 'A' && hiP, align: 'left' })
        // 队列：命中会暂时加长
        const extra = epp ? EB.filter(b => i === 1 && t > b + 1.8 && t < b + 4).length : 0
        txt('队列', 1272, y + 34, { size: 18, color: hiQ ? COL : C.mute })
        for (let k = 0; k < q + extra; k++) sq(1322 + k * 22, y + 20, 16, 18, hiQ ? COL : C.amber, 1, null, { r: 4 })
        txt('KV', 1480, y + 34, { size: 18, font: MONO, color: hiK ? COL : C.mute })
        meter(1515, y + 24, 210, 12, kv, hiK ? COL : kv > .7 ? C.red : C.teal)
      })
    })
    // 轮询阶段的请求
    RR.forEach(([a, i]) => {
      travel(250, 600, 445, 600, P(t, a, a + .5), COL, 8)
      travel(675, 600, 1116, PY[i], P(t, a + .5, a + 1.2), COL, 8)
      const r = P(t, a + 1.2, a + 2.2), hit = i === 1
      ring(1170, PY[i], r, hit ? C.green : C.red, 90)
      chip(hit ? '命中缓存' : 'Prefill 重算', 1728, PY[i] - 22, { size: 16, col: hit ? C.green : C.red, align: 'right', font: SANS, alpha: win(t, a + 1.2, epp ? 5.6 : a + 4.4, .3) })
    })
    withA(E.out(P(t, .9, 1.3)) * (1 - eA), () => txt('请求都带着同一段 system prompt（前缀 A）', 1435, 876, { size: 18, color: C.mute, align: 'center' }))
    // EPP 阶段的请求
    EB.forEach(a => {
      travel(250, 600, 445, 600, P(t, a, a + .5), COL, 8)
      travel(530, 545, 530, 440, P(t, a + .5, a + .8), COL, 7)
      travel(590, 440, 590, 545, P(t, a + .9, a + 1.2), COL, 7)
      travel(675, 600, 1116, PY[1], P(t, a + 1.2, a + 1.8), COL, 8)
      ring(1170, PY[1], P(t, a + 1.8, a + 2.6), C.green, 90)
      SC.forEach((s, i) => chip('score ' + s.toFixed(2), 1728, PY[i] - 22, { size: 16, col: i === 1 ? C.green : C.mute, solid: i === 1, align: 'right', alpha: win(t, a + .7, a + 1.9, .2) }))
    })
    withA(E.out(P(t, 8.6, 9.1)), () => chip('前缀命中：TTFT 降一个数量级', 560, 780, { size: 20, col: C.green, font: SANS }))
  },
}

// 场景 5：PD 分离与 llm-d
const pd = {
  name: 'PD 分离与 llm-d', dur: 16, mood: 4,
  vo: [[0.6, '长输入的 Prefill 会卡住同批 Decode。'],
    [5.4, 'PD 分离把两段拆开，KV 经 RDMA 传过去。', 'P D 分离把两段拆开，KV 经 RDMA 传过去。'],
    [10.8, 'llm-d 把引擎、网关和部署形态组合起来。', 'L L M D 把引擎、网关和部署形态组合起来。']],
  cues: [[0.6, 'whoosh'], [2.1, 'alarmSoft'], [3.6, 'alarmSoft'], [5.4, 'whoosh'], [6.0, 'pop'], [6.3, 'pop'], [6.6, 'pop'], [7.4, 'zap'], [8.4, 'zap'], [9.2, 'ok'],
    [11.2, 'ding0'], [11.6, 'ding1'], [12.0, 'ding2'], [12.4, 'ding3'], [13.2, 'chime']],
  draw(t, T) {
    heading('PD 分离，与 llm-d', 140, 210, t, .2, { eyebrow: 'DISAGGREGATION', color: COL })
    // A · 混跑时的 TPOT 毛刺
    const aA = win(t, .5, 5.6, .5)
    if (aA > 0) withA(aA, () => {
      const g = (s, c) => Math.exp(-Math.pow((s - c) / .022, 2))
      const f = s => .2 + .025 * Math.sin(s * 70) + .62 * g(s, .38) + .55 * g(s, .7)
      chart(340, 300, 1240, 400, f, E.inOut(P(t, .8, 4.6)), DC, { title: 'Decode 的 TPOT · Prefill 与 Decode 同进程混跑', threshold: .5 })
      ;[[.38, 2.1], [.7, 3.6]].forEach(([s, t0]) => chip('长输入 Prefill 插入', 360 + s * 1200, 384, { size: 17, col: PV, font: SANS, alpha: E.out(P(t, t0, t0 + .3)) }))
      txt('同一批次里，长 Prefill 占满算力，Decode 只能等待', 960, 770, { size: 24, color: C.body, align: 'center', alpha: E.out(P(t, 2.4, 2.9)) })
      txt('毛刺：Decode 被卡住', 1560, 640, { size: 18, color: C.red, align: 'right', alpha: E.out(P(t, 3.8, 4.3)) })
    })
    // B · PD 分离架构
    const bA = E.out(P(t, 5.4, 6))
    if (bA > 0) withA(bA, () => {
      box(330, 500, 220, 100, 'router', 'sglang_router', C.blue, { size: 26, alpha: E.out(P(t, 5.8, 6.2)) })
      ;[390, 610].forEach((y, i) => box(850, y, 270, 104, 'Prefill-' + i, '计算密集 · 生成 KV', PV, { size: 26, alpha: E.out(P(t, 6.1 + i * .3, 6.5 + i * .3)), hi: t > 7.2 && t < 9.2 }))
      box(1380, 500, 270, 110, 'Decode', '访存密集 · 逐 token', DC, { size: 26, alpha: E.out(P(t, 6.6, 7)), hi: t > 8.8 })
      const la = E.out(P(t, 6.8, 7.3))
      ;[390, 610].forEach(y => { arrow(440, 500 + (y - 500) * .2, 715, y, la, hexA(C.blue, .6), 2.5); arrow(985, y, 1245, 500 + (y - 500) * .25, la, PV, 3.5) })
      withA(la, () => { chip('RDMA 传 KV Cache', 1110, 408, { size: 16, col: PV }); chip('2 Prefill : 1 Decode · 各自扩缩', 850, 300, { size: 18, col: C.mute, font: SANS }) })
      // 请求流
      travel(200, 500, 440, 500, P(t, 7, 7.4), COL, 8)
      ;[390, 610].forEach((y, i) => {
        travel(440, 500, 715, y, P(t, 7.2 + i * .3, 7.7 + i * .3), COL, 7)
        for (let k = 0; k < 3; k++) { const q = P(t, 8.2 + i * .3 + k * .18, 8.9 + i * .3 + k * .18); if (q > 0 && q < 1) { const e = E.inOut(q); sq(lerp(985, 1245, e) - 11, lerp(y, 500 + (y - 500) * .25, e) - 11, 22, 22, PV, Math.sin(q * Math.PI), null, { r: 5, fill: tint(PV, .5) }) } }
      })
      // 输出 token
      for (let k = 0; k < 6; k++) { const a = E.back(P(t, 9.2 + k * .35, 9.5 + k * .35)); if (a > 0) sq(1540 + k * 38, 486, 30, 30, DC, clamp(a), null, { r: 6 }) }
      withA(E.out(P(t, 9.2, 9.6)), () => txt('逐 token 输出 →', 1540, 548, { size: 16, color: DC }))
      chip('前提：实例间有 RDMA', 1380, 690, { size: 17, col: C.amber, font: SANS, alpha: E.out(P(t, 9.4, 9.9)) })
    })
    // C · llm-d
    const cA = E.out(P(t, 10.8, 11.3))
    withA(cA, () => {
      panel(330, 770 + lerp(20, 0, cA), 1320, 96, { r: 20, stroke: hexA(COL, .6), lw: 2, fill: tint(COL, .04) })
      chip('llm-d', 370, 818 + lerp(20, 0, cA), { size: 24, col: COL, solid: true, align: 'left' })
      const parts = [['引擎 · vLLM', PV], ['路由 · GIE EPP', COL], ['部署 · LWS / PD 分离', C.blue], ['网关 · Istio / kgateway', C.teal]]
      let x = 520
      parts.forEach(([s, c], i) => { const w = chip(s, x, 818 + lerp(20, 0, cA), { size: 19, col: c, align: 'left', font: SANS, alpha: E.out(P(t, 11.2 + i * .4, 11.6 + i * .4)) }); x += (w || textW(s, 19) + 24) + 24 })
    })
  },
}

ANIM({
  id: 'llm-inference',
  meta: { stage: 5, lesson: 4, of: 6, title: '大模型推理服务', summary: 'vLLM / SGLang 部署、LeaderWorkerSet 跨节点推理、推理网关与 llm-d。', next: '多租户与平台工程' },
  scenes: [
    lessonIntro({ tags: ['vLLM', 'TTFT / TPOT', 'LeaderWorkerSet', '推理网关', 'PD 分离'], vo: [[3.2, '把大模型变成稳定、高效的推理服务。']] }),
    phases, vllm, lws, gateway, pd,
    lessonOutro({
      points: ['Prefill 决定 TTFT，Decode 决定 TPOT', 'vLLM：显存留给 KV Cache，必配 startupProbe', 'LWS：一组 Pod 一个副本，出错整组重建', '推理网关 EPP：按前缀与负载挑 Pod'],
      vo: [[0.8, '小结：大模型推理，要围绕 KV Cache 来调度。'], [5.6, '下一课，多租户与平台工程。']],
    }),
  ],
})
})()
