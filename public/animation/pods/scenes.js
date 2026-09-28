/* 第 1 阶段 · 第 2 课：Pod：最小调度单元 */
const COL = STAGES[1].color

// 场景 1：为什么是 Pod
const whyPod = {
  name: '为什么是 Pod', dur: 16, mood: 1,
  vo: [[0.6, 'K8s 不直接调度容器，而是调度 Pod。', 'Kubernetes 不直接调度容器，而是调度 Pod。'],
    [5.4, '同一 Pod 里的容器共享网络与存储，用 localhost 互访。'],
    [11.0, '它们总被放到同一个节点上，同生共死。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], [1.6, 'pop'], [5.6, 'zap'], [7.6, 'pop'], [8.6, 'tick'], [11.0, 'thud'], [13.0, 'chime']],
  draw(t) {
    heading('为什么是 Pod，而不是容器', 140, 210, t, .2, { eyebrow: 'WHY POD', color: COL })
    const nA = E.out(P(t, 11, 11.8))
    if (nA > 0) node(420, 262, 1080, 620, 'kind-worker2', { alpha: nA, tag: '同一节点', accent: COL })
    const a = E.out(P(t, .6, 1.4))
    withA(a, () => {
      panel(520, 322, 880, 520, { r: 26, fill: tint(COL, .04), stroke: hexA(COL, .55), dash: [12, 9], lw: 2, shadow: false })
      chip('Pod · IP 10.244.1.5', 960, 322, { size: 22, col: COL, solid: true })
    })
    ;[['app', 750, 1.2], ['sidecar', 1170, 1.6]].forEach(([n, x, t0]) => {
      const k = E.back(P(t, t0, t0 + .5)); if (k <= 0) return
      withA(clamp(k), () => {
        panel(x - 150, 400, 300, 190, { r: 16 })
        cube(x, 490, 34 * k, n === 'app' ? COL : C.violet)
        txt(n + ' 容器', x, 566, { size: 22, font: MONO, align: 'center' })
      })
    })
    // localhost 互访
    const lp = E.out(P(t, 5.6, 6.3))
    arrow(960, 495, 906, 495, lp, COL, 2.5); arrow(960, 495, 1014, 495, lp, COL, 2.5)
    withA(lp, () => txt('localhost', 960, 470, { size: 17, font: MONO, color: COL, align: 'center' }))
    if (t > 6.3) flow(906, 520, 1014, 520, t, COL, 3, .9, 0, 4)
    // 共享卷
    const va = E.out(P(t, 7.6, 8.3))
    partialLine(750, 590, 904, 706, va, hexA(C.teal, .6), 2)
    partialLine(1170, 590, 1016, 706, va, hexA(C.teal, .6), 2)
    cylinder(960, 720, 120, 46, C.teal, '共享 Volume', va)
    chip('pause 容器 · 持有网络命名空间', 548, 806, { size: 16, align: 'left', col: C.mute, alpha: E.out(P(t, 8.6, 9.2)) })
    // 同生共死：一起脉动
    ring(750, 490, P(t, 13, 14.2), COL, 150); ring(1170, 490, P(t, 13, 14.2), C.violet, 150)
  },
}

// 场景 2：生命周期
const phase = {
  name: '生命周期', dur: 17, mood: 2,
  vo: [[0.6, 'Pod 从 Pending 开始：等待调度、拉取镜像。'],
    [5.6, '容器跑起来就进入 Running，READY 变成 1/1。'],
    [10.6, '全部成功退出是 Succeeded，有容器失败就是 Failed。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], ...typeCues([{ t: 1.4, cmd: 'kubectl get pod nginx -w' }], 30), [3, 'tick'], [4.2, 'tick'], [5.8, 'ok'], [11, 'chime'], [12.2, 'error']],
  draw(t) {
    heading('Pod 的生命周期', 140, 210, t, .2, { eyebrow: 'PHASE', color: COL })
    const cur = t < 5.6 ? 0 : t < 10.6 ? 1 : 2
    const B = [
      ['Pending', '等调度 · 拉镜像', C.amber, 400, 410, 1.0, cur === 0],
      ['Running', '至少一个容器在运行', C.green, 900, 410, 1.3, cur === 1],
      ['Succeeded', '全部退出码为 0', C.teal, 1480, 320, 10.4, t >= 10.6 && t < 12],
      ['Failed', '有容器失败退出', C.red, 1480, 500, 11.8, t >= 12],
    ]
    B.forEach(([n, s, c, x, y, t0, hi]) => box(x, y, 300, 112, n, s, c, { alpha: E.out(P(t, t0, t0 + .5)), hi, size: 30 }))
    arrow(556, 410, 744, 410, E.out(P(t, 5.2, 5.8)), hexA(C.text, .35), 2.5)
    travel(556, 410, 744, 410, P(t, 5.2, 5.9), C.green)
    arrow(1056, 392, 1324, 334, E.out(P(t, 10.4, 11)), C.teal, 2.5)
    travel(1056, 392, 1324, 334, P(t, 10.4, 11.1), C.teal)
    arrow(1056, 428, 1324, 486, E.out(P(t, 11.8, 12.4)), C.red, 2.5)
    travel(1056, 428, 1324, 486, P(t, 11.8, 12.5), C.red)
    withA(E.out(P(t, 13.2, 13.8)), () => txt('kubectl 的 STATUS 列是更细的原因，不等于 phase', 1480, 604, { size: 18, color: C.mute, align: 'center' }))
    terminal(400, 620, 1080, 250, t, [
      { t: 1.4, cmd: 'kubectl get pod nginx -w' },
      { t: 2.6, out: 'NAME    READY   STATUS              RESTARTS   AGE', color: C.mute },
      { t: 3.0, out: 'nginx   0/1     Pending             0          0s', color: C.amber },
      { t: 4.2, out: 'nginx   0/1     ContainerCreating   0          2s', color: C.amber },
      { t: 5.8, out: 'nginx   1/1     Running             0          15s', color: C.green },
    ], { size: 22, alpha: E.out(P(t, 1, 1.5)) })
  },
}

// 场景 3：重启策略与退避
const EV = [[2.6, 'run'], [4.2, 'fail'], [5.6, 'run'], [6.9, 'fail'], [8.8, 'run'], [10.0, 'fail']]
const restart = {
  name: '重启策略', dur: 18, mood: 3,
  vo: [[0.6, 'restartPolicy 决定容器退出以后怎么办。'],
    [5.4, 'Always 总是重启，OnFailure 失败才重启，Never 不重启。'],
    [11.4, '反复崩溃时重启间隔成倍拉长，这就是 CrashLoopBackOff。']],
  cues: [[0.6, 'whoosh'], [1.2, 'tick'], [1.6, 'tick'], [2.0, 'tick'], [2.6, 'pop'], ...EV.filter(e => e[1] === 'fail').map(e => [e[0], 'error']),
    ...[0, 1, 2, 3, 4].map(i => [12.4 + i * .6, 'tick']), [11.4, 'alarmSoft']],
  draw(t) {
    heading('restartPolicy 与指数退避', 140, 210, t, .2, { eyebrow: 'RESTART', color: COL })
    const cur = t < 5.4 ? -1 : t < 7.3 ? 0 : t < 9 ? 1 : t < 11 ? 2 : 0
    ;[['Always', '任何退出都重启', '默认'], ['OnFailure', '退出码非 0 才重启', 'Job'], ['Never', '从不重启', '一次性任务']].forEach(([n, s, tag], i) => {
      const a = E.out(P(t, 1.2 + i * .4, 1.7 + i * .4)); if (a <= 0) return
      const y = 340 + i * 124, on = cur === i
      withA(a * (cur < 0 || on ? 1 : .55), () => {
        panel(140 + lerp(-30, 0, a), y - 46, 660, 92, { r: 16, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .06) : C.panel })
        chip(n, 172, y, { size: 24, align: 'left', col: COL, solid: on })
        txt(s, 380, y + 9, { size: 26, color: C.text })
        chip(tag, 776, y, { size: 16, align: 'right', col: C.mute })
      })
    })
    // 崩溃的 Pod
    let st = 'idle', k = -1; EV.forEach(([a, s], i) => { if (t >= a) { st = s; k = i } })
    const loop = t >= 11.4
    const shake = st === 'fail' ? Math.sin(t * 70) * 7 * (1 - P(t - EV[k][0], 0, .5)) : 0
    const pa = E.out(P(t, 2.2, 2.8))
    pod(1340, 400, 150, { state: st === 'idle' ? 'pending' : st, label: 'crash', sub: st === 'run' ? 'Running' : loop ? 'CrashLoopBackOff' : st === 'fail' ? 'Error' : 'Pending', alpha: pa, shake })
    EV.forEach(([a, s]) => { if (s === 'fail') ring(1340, 400, P(t, a, a + .9), C.red, 160) })
    const rs = EV.filter(([a, s], i) => i > 0 && s === 'run' && t >= a).length
    chip(`RESTARTS ${rs}`, 1340, 588, { size: 20, col: rs ? C.amber : C.mute, alpha: pa })
    chip('CrashLoopBackOff', 1340, 272, { size: 24, col: C.red, solid: true, alpha: E.out(P(t, 11.4, 11.9)) })
    // 退避时间轴
    withA(E.out(P(t, 12, 12.5)), () => txt('重启间隔：指数增长，上限 5 分钟；稳定运行 10 分钟后重置', 940, 680, { size: 20, color: C.body }))
    let x = 940
    ;[['10s', 70], ['20s', 100], ['40s', 140], ['80s', 190], ['160s', 250]].forEach(([s, w], i) => {
      const p = E.out(P(t, 12.4 + i * .6, 12.9 + i * .6)); if (p <= 0) { x += w; return }
      ctx.save(); ctx.fillStyle = tint(C.amber, .1 + i * .06); rr(x + 3, 712, (w - 6) * p, 34, 8); ctx.fill(); ctx.restore()
      withA(p, () => txt(s, x + w / 2, 736, { size: 17, font: MONO, color: C.amber, align: 'center' }))
      dot(x, 729, 6, C.red, 6); x += w
    })
    chip('≤ 5m', 1720, 729, { size: 18, col: C.red, alpha: E.out(P(t, 15.4, 15.9)) })
  },
}

// 场景 4：调试三件套
const DBG = [
  { t: .8, cmd: 'kubectl logs -f nginx' },
  { t: 2.0, out: '10.244.0.1 - "GET / HTTP/1.1" 200 615' },
  { t: 2.4, out: '10.244.0.1 - "GET /favicon.ico" 404 153' },
  { t: 5.0, cmd: 'kubectl exec -it nginx -- sh' },
  { t: 6.2, out: '# nginx -v', color: C.text },
  { t: 6.6, out: 'nginx version: nginx/1.27.2', color: C.green },
  { t: 8.0, cmd: 'kubectl port-forward pod/nginx 8080:80' },
  { t: 9.5, out: 'Forwarding from 127.0.0.1:8080 -> 80', color: C.cyan },
  { t: 10.6, cmd: 'kubectl logs crash --previous' },
  { t: 11.8, out: 'starting', color: C.body },
  { t: 12.1, out: 'Error: exit status 1', color: C.red, sfx: 'error' },
]
const debug = {
  name: '调试三件套', dur: 16, mood: 2,
  vo: [[0.6, '排查问题的三件套：logs 看日志，'],
    [5.0, 'exec 进到容器里，port-forward 把端口转到本机。'],
    [10.6, '容器崩了，用 --previous 看上一次的日志。', '容器崩了，用 previous 参数看上一次的日志。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DBG, 30), [9.6, 'ok']],
  draw(t) {
    heading('调试三件套', 140, 210, t, .2, { eyebrow: 'DEBUG', color: COL })
    terminal(140, 280, 1000, 570, t, DBG, { size: 24, alpha: E.out(P(t, .4, .9)) })
    const cur = t < 5 ? 0 : t < 8 ? 1 : t < 10.6 ? 2 : 0
    ;[['logs', '看日志 · -f 跟踪 · --previous', C.blue], ['exec', '进容器执行命令', C.violet], ['port-forward', 'localhost:8080 → Pod:80', C.cyan]].forEach(([n, s, c], i) => {
      const a = E.out(P(t, .6 + i * .3, 1.1 + i * .3)); if (a <= 0) return
      const y = 290 + i * 190, on = cur === i
      withA(a * (on ? 1 : .6), () => {
        panel(1200, y, 580, 160, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel })
        chip('kubectl ' + n, 1232, y + 52, { size: 22, align: 'left', col: c, solid: on })
        txt(s, 1234, y + 118, { size: 22, color: C.body, font: i === 2 ? MONO : SANS })
      })
    })
    if (cur === 2) flow(1560, 598, 1740, 598, t, C.cyan, 3, 1, 0, 4)
  },
}

// 场景 5：Init 容器与原生 Sidecar
const ROWS = [
  ['init: wait-db', 0, .2, C.amber, '按顺序执行'],
  ['init: migrate', .2, .38, C.amber, '跑完才退出'],
  ['sidecar: log-agent', .38, 1, C.violet, 'restartPolicy: Always'],
  ['app: web', .5, 1, COL, '主容器'],
]
const sidecar = {
  name: 'Init 与 Sidecar', dur: 16, mood: 3,
  vo: [[0.6, 'Init 容器按顺序跑完，主容器才会启动。'],
    [6.0, '1.29 起的原生 Sidecar 先启动，陪主容器一直运行。'],
    [11.4, '日志收集、代理这类辅助进程，就放进 Sidecar。']],
  cues: [[0.4, 'whoosh'], [1.4, 'tick'], [3.4, 'ok'], [5.4, 'ok'], [6.2, 'pop'], [7.6, 'pop'], [11.6, 'chime']],
  draw(t) {
    heading('Init 容器与原生 Sidecar', 140, 210, t, .2, { eyebrow: 'MULTI-CONTAINER', color: COL })
    const X0 = 560, X1 = 1760, p = t < 6 ? P(t, 1.2, 6) * .42 : .42 + P(t, 6, 13.5) * .58
    const ax = E.out(P(t, .6, 1.2))
    withA(ax, () => {
      line(X0, 780, X1, 780, C.hairD, 2); arrowHead(X1, 780, 0, C.hairD, 12)
      txt('时间 →', X1, 818, { size: 18, color: C.mute, align: 'right' })
      txt('Pod 启动', X0, 818, { size: 18, color: C.mute })
    })
    ROWS.forEach(([n, a, b, c, note], i) => {
      const y = 330 + i * 112, ra = E.out(P(t, .8 + i * .2, 1.3 + i * .2)); if (ra <= 0) return
      withA(ra, () => {
        txt(n, X0 - 30, y + 8, { size: 22, font: MONO, align: 'right', color: C.text })
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.035)'; rr(X0, y - 26, X1 - X0, 52, 12); ctx.fill(); ctx.restore()
        const e = Math.min(b, p); if (e <= a) return
        ctx.save(); ctx.fillStyle = tint(c, .22); ctx.strokeStyle = c; ctx.lineWidth = 2; rr(X0 + a * (X1 - X0), y - 26, (e - a) * (X1 - X0), 52, 12); ctx.fill(); ctx.stroke(); ctx.restore()
        if (b < 1 && p >= b) check(X0 + b * (X1 - X0) - 26, y, 26, c, P(p, b, b + .03))
        if (e - a > .16) txt(note, X0 + a * (X1 - X0) + 20, y + 7, { size: 18, font: MONO, color: c })
      })
    })
    // 播放头
    if (ax > 0) { const px = X0 + p * (X1 - X0); line(px, 280, px, 780, hexA(C.text, .25), 2, [6, 6]); dot(px, 780, 6, C.text, 0) }
    callout(X0 + .38 * (X1 - X0), 584, X0 + .38 * (X1 - X0) - 40, 860, '先于主容器启动', P(t, 7.6, 8.4), C.violet, { align: 'right' })
  },
}

ANIM({
  id: 'pods',
  meta: { stage: 1, lesson: 2, of: 6, title: 'Pod：最小调度单元', summary: 'Pod 的生命周期、重启策略、多容器与 Init 容器，以及看日志、进容器、端口转发。', next: '标签、注解与命名空间' },
  scenes: [
    lessonIntro({ tags: ['Pod', 'Phase', 'restartPolicy', 'Sidecar', 'kubectl logs'], vo: [[3.2, 'Pod：Kubernetes 最小的调度单元。']] }),
    whyPod, phase, restart, debug, sidecar,
    lessonOutro({
      points: ['Pod 是调度单元：容器共享网络与存储', 'Phase：Pending → Running → Succeeded / Failed', 'restartPolicy + 指数退避 = CrashLoopBackOff', 'logs / exec / port-forward 三件套调试'],
      vo: [[0.8, '小结：Pod 是所有工作负载的基石。'], [5.6, '下一课，用标签和命名空间组织资源。']],
    }),
  ],
})
