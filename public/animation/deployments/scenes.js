/* 第 1 阶段 · 第 4 课：ReplicaSet 与 Deployment */
(() => {
  const COL = STAGES[1].color

  // 本地小工具：单行命令栏（逐字输入，只显示最近一条）
  function cmdBar(x, y, w, t, list, alpha = 1) {
    if (alpha <= 0) return
    let cur = null; for (const c of list) if (t >= c[0]) cur = c
    withA(alpha, () => {
      panel(x, y, w, 64, { r: 14, fill: '#ffffff' })
      txt('❯', x + 26, y + 41, { size: 22, font: MONO, color: C.blue })
      if (!cur) return
      const n = Math.floor((t - cur[0]) * 30), s = cur[1].slice(0, n)
      txt(s, x + 58, y + 41, { size: 22, font: MONO, color: C.text })
      if (n < cur[1].length || Math.floor(t * 2.2) % 2 === 0) {
        const cw = textW(s, 22, { font: MONO }); ctx.fillStyle = hexA(C.text, .7); ctx.fillRect(x + 60 + cw, y + 23, 12, 22)
      }
    })
  }
  const barCues = list => typeCues(list.map(([t, cmd]) => ({ t, cmd })), 30)
  // 名字中间的哈希段可单独着色
  function hashName(x, y, pre, hash, post, hl, o = {}) {
    const size = o.size || 18, f = { font: MONO }
    const w1 = textW(pre, size, f), w2 = textW(hash, size, f), w3 = textW(post, size, f)
    let x0 = o.left ? x : x - (w1 + w2 + w3) / 2
    const base = o.color || C.text, a = o.alpha ?? 1
    txt(pre, x0, y, { size, font: MONO, color: base, alpha: a }); x0 += w1
    if (hl > 0) { ctx.save(); ctx.globalAlpha *= a * hl; ctx.fillStyle = tint(C.amber, .18); rr(x0 - 3, y - size * .9, w2 + 6, size * 1.25, 5); ctx.fill(); ctx.restore() }
    txt(hash, x0, y, { size, font: MONO, color: hl > .5 ? C.amber : base, alpha: a, weight: hl > .5 ? 600 : 500 }); x0 += w2
    txt(post, x0, y, { size, font: MONO, color: base, alpha: a })
  }
  function ghostHex(x, y, s, a = 1) {
    withA(a, () => { ctx.save(); hexPath(x, y, s / 2); ctx.setLineDash([7, 7]); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; ctx.stroke(); ctx.restore() })
  }

  // 场景 1：ReplicaSet 自愈与标签认领
  const RS_CMDS = [[2.4, 'kubectl delete pod web-rs-7xk2p'], [5.8, 'kubectl label pod web-rs-h9dqc app=debug --overwrite'], [10.9, 'kubectl set image rs/web-rs nginx=nginx:1.28']]
  const replicaset = {
    name: 'ReplicaSet 自愈', dur: 16, mood: 2,
    vo: [[0.6, 'ReplicaSet 只做一件事：保持副本数。'],
      [5.6, '它靠标签认领 Pod，改掉标签就被摘出去。'],
      [10.8, 'RS 不会更新已有 Pod，所以要用 Deployment。', 'ReplicaSet 不会更新已有 Pod，所以要用 Deployment。']],
    cues: [[0.4, 'whoosh'], [0.7, 'pop'], [1.4, 'pop'], [1.7, 'pop'], [2.0, 'pop'], ...barCues(RS_CMDS), [3.7, 'poof'], [4.1, 'zap'], [4.6, 'pop'], [5.6, 'ok'], [7.8, 'tick'], [7.9, 'whoosh'], [8.3, 'zap'], [8.9, 'pop'], [9.9, 'ok'], [12.5, 'tick'], [12.9, 'alarmSoft']],
    draw(t, T) {
      heading('ReplicaSet：盯住副本数', 140, 210, t, .2, { eyebrow: 'REPLICASET', color: COL })
      let n = 3; if (t >= 3.7) n = 2; if (t >= 4.6) n = 3; if (t >= 7.8) n = 2; if (t >= 8.9) n = 3
      const a0 = E.out(P(t, .6, 1.1))
      box(960, 330, 380, 100, 'ReplicaSet', 'web-rs · replicas: 3', COL, { alpha: a0, hi: n < 3 })
      wheel(700, 330, 36, { p: P(t, .8, 1.8), rot: T * .5 + (P(t, 3.8, 4.8) + P(t, 7.8, 8.9)) * Math.PI * 4, color: COL })
      withA(a0, () => {
        chip(`CURRENT ${n} / DESIRED 3`, 1172, 305, { size: 18, align: 'left', col: n < 3 ? C.amber : C.green, solid: n < 3 })
        const nt = t >= 12.5
        chip(nt ? 'template: nginx:1.28' : 'template: nginx:1.27', 1172, 355, { size: 18, align: 'left', col: nt ? C.amber : C.mute, solid: nt && t < 13.4 })
      })
      // 选择器圈定的范围
      const ra = E.out(P(t, 1.0, 1.5))
      withA(ra, () => {
        panel(380, 420, 1180, 320, { r: 22, fill: tint(COL, .03), stroke: hexA(COL, .5), dash: [10, 8], shadow: false })
        chip('selector: app=web-rs', 410, 420, { size: 18, align: 'left', col: COL, solid: true })
      })
      const Y = 545
      const drawPod = (x, name, t0, st, lab, labCol, alpha = 1) => {
        const k = E.back(P(t, t0, t0 + .45)); if (k <= 0 || alpha <= 0) return
        pod(x, Y, 120, { state: st, scale: k, alpha })
        withA(alpha * clamp(k), () => {
          txt(name, x, Y + 86, { size: 18, font: MONO, align: 'center' })
          chip(lab, x, Y + 124, { size: 16, col: labCol })
          if (st === 'pending') txt('ContainerCreating', x, Y - 76, { size: 16, font: MONO, color: C.amber, align: 'center' })
        })
      }
      // 槽 0：被删除 → 补一个
      const g0 = 1 - E.out(P(t, 3.6, 3.9))
      if (t >= 3.6 && t < 4.6) ghostHex(670, Y, 120, E.out(P(t, 3.8, 4.1)))
      drawPod(670, 'web-rs-7xk2p', 1.4, 'run', 'app=web-rs', COL, g0)
      poof(670, Y, P(t, 3.7, 4.5), C.red)
      travel(960, 380, 670, 485, P(t, 4.1, 4.6), COL)
      drawPod(670, 'web-rs-q5v8n', 4.6, t < 5.6 ? 'pending' : 'run', 'app=web-rs', COL)
      ring(670, Y, P(t, 5.6, 6.4), C.green, 110)
      // 槽 1：一直在
      drawPod(960, 'web-rs-m3tqw', 1.7, 'run', 'app=web-rs', COL)
      // 槽 2：改标签 → 被摘出去 → 再补一个
      const mv = E.inOut(P(t, 7.9, 8.7)), dx = lerp(1250, 1690, mv)
      if (t >= 7.9 && t < 8.9) ghostHex(1250, Y, 120, E.out(P(t, 8.1, 8.4)))
      const relab = t >= 7.8
      drawPod(dx, 'web-rs-h9dqc', 2.0, 'run', relab ? 'app=debug' : 'app=web-rs', relab ? C.red : COL)
      ring(dx, Y + 124, P(t, 7.8, 8.5), C.red, 60)
      withA(E.out(P(t, 8.7, 9.2)), () => txt('脱离 RS，不再被管', 1690, Y + 172, { size: 18, color: C.mute, align: 'center' }))
      travel(960, 380, 1250, 485, P(t, 8.3, 8.9), COL)
      drawPod(1250, 'web-rs-zz8wd', 8.9, t < 9.9 ? 'pending' : 'run', 'app=web-rs', COL)
      ring(1250, Y, P(t, 9.9, 10.7), C.green, 110)
      // 已有 Pod 的镜像版本
      const ia = E.out(P(t, 11.0, 11.5))
      if (ia > 0) {
        const hl = t >= 12.8
        ;[670, 960, 1250, 1690].forEach(x => chip('nginx:1.27', x, 458, { size: 16, col: hl ? C.amber : C.mute, alpha: ia }))
      }
      cmdBar(380, 780, 1180, t, RS_CMDS, E.out(P(t, 2.0, 2.4)))
      withA(E.out(P(t, 12.9, 13.4)), () => chip('⚠ 模板改了，已有 Pod 仍是 1.27 —— RS 只管数量，不管版本', 960, 896, { size: 20, font: SANS, col: C.amber }))
    },
  }

  // 场景 2：Deployment → ReplicaSet → Pod
  const PODS = [[1250, 296, '2kq9x'], [1250, 400, '7vbnd'], [1250, 504, 'h4c2m'], [1250, 608, 'x8pwl']]
  const TPL = ['template:', '  metadata:', '    labels: {app: web}', '  spec:', '    containers:', '    - name: nginx', '      image: nginx:1.26']
  const GET = [
    { t: 11.0, cmd: 'kubectl get deploy web' },
    { t: 11.9, out: 'NAME   READY   UP-TO-DATE   AVAILABLE   AGE', color: C.mute },
    { t: 12.1, out: 'web    4/4     4            4           30s', color: C.text },
  ]
  const COLS = [['READY', 7, '就绪数 / 期望数', 12.4], ['UP-TO-DATE', 15, '已是最新模板', 13.6], ['AVAILABLE', 28, '就绪且可接流量', 14.8]]
  const hierarchy = {
    name: 'Deployment 层级', dur: 16, mood: 1,
    vo: [[0.6, 'Deployment 管 RS，RS 再管 Pod。', 'Deployment 管理 ReplicaSet，ReplicaSet 再管理 Pod。'],
      [5.6, '哈希来自 Pod 模板，模板一变就换新 RS。', '哈希来自 Pod 模板，模板一变，就生成新的 ReplicaSet。'],
      [10.8, '三列状态：就绪、已更新、可用。']],
    cues: [[0.4, 'whoosh'], [0.7, 'pop'], [1.9, 'pop'], ...PODS.map((_, i) => [2.9 + i * .2, 'pop']), [6.6, 'zap'], [7.4, 'tick'], [8.6, 'tick'], [9.0, 'pop'], ...typeCues(GET, 30), [12.4, 'tick'], [13.6, 'tick'], [14.8, 'tick']],
    draw(t) {
      heading('Deployment → ReplicaSet → Pod', 140, 210, t, .2, { eyebrow: 'HIERARCHY', color: COL })
      const hl = E.out(P(t, 7.2, 7.6)) * (1 - E.out(P(t, 10.4, 10.8)))
      box(330, 400, 300, 110, 'Deployment', 'web · replicas: 4', COL, { alpha: E.out(P(t, .6, 1.1)), hi: t >= .6 && t < 2.2 })
      const la = E.out(P(t, 1.3, 1.8))
      arrow(482, 400, 686, 400, la, hexA(C.text, .35), 2.5)
      withA(la, () => txt('管理', 584, 382, { size: 18, color: C.mute, align: 'center' }))
      const ra = E.out(P(t, 1.8, 2.3))
      box(860, 400, 340, 110, 'ReplicaSet', ' ', C.violet, { alpha: ra, hi: t >= 2.2 && t < 3.6 })
      hashName(860, 432, 'web-', '6c9d5bb8f4', '', hl, { size: 18, color: C.mute, alpha: ra })
      PODS.forEach(([x, y, id], i) => {
        const t0 = 2.9 + i * .2
        arrow(1032, 400, x - 52, y, E.out(P(t, t0 - .4, t0)), hexA(C.violet, .5), 2)
        const k = E.back(P(t, t0, t0 + .45)); if (k <= 0) return
        pod(x, y, 84, { state: 'run', scale: k })
        hashName(1310, y + 7, 'web-', '6c9d5bb8f4', '-' + id, hl, { size: 19, alpha: clamp(k), left: true })
      })
      // Pod 模板 → 哈希
      const ca = E.out(P(t, 5.4, 5.9))
      const up = t >= 8.6
      code(140, 560, 560, up ? [...TPL.slice(0, 6), '      image: nginx:1.27'] : TPL, t, 5.6, { title: 'spec.template · Pod 模板', size: 19, step: .08, hi: up ? [6] : t > 6.6 ? [0, 1, 2, 3, 4, 5, 6] : [], hiColor: up ? C.green : C.amber, alpha: ca })
      travel(700, 620, 860, 452, P(t, 6.6, 7.3), C.amber)
      withA(E.out(P(t, 6.9, 7.4)) * (1 - E.out(P(t, 10.4, 10.8))), () => chip('pod-template-hash', 860, 498, { size: 18, col: C.amber }))
      // 模板一变 → 新的 RS
      const na = E.out(P(t, 9.0, 9.5)) * (1 - E.out(P(t, 10.4, 10.8)))
      travel(700, 790, 730, 660, P(t, 8.7, 9.2), C.green)
      withA(na, () => {
        panel(730, 600, 340, 104, { r: 14, fill: tint(C.green, .05), stroke: C.green, lw: 2, dash: [8, 6] })
        txt('新 ReplicaSet', 900, 642, { size: 24, weight: 600, align: 'center' })
        hashName(900, 678, 'web-', '84b5f6d7c9', '', 1, { size: 18, color: C.mute })
        chip('模板一变 → 新哈希 → 新 RS', 900, 748, { size: 18, font: SANS, col: C.green })
      })
      // get deploy 三列
      const ta = E.out(P(t, 10.8, 11.2))
      terminal(760, 680, 1020, 200, t, GET, { size: 20, alpha: ta })
      const cw = textW('M', 17.6, { font: MONO })
      COLS.forEach(([n, off, s, t0], i) => {
        const a = E.out(P(t, t0, t0 + .35)); if (a <= 0) return
        const on = t >= t0 && (i === 2 || t < COLS[i + 1][3])
        if (on) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = tint(COL, .14); rr(760 + 28 + off * cw - 6, 680 + 124 - 22, n.length * cw + 12, 64, 8); ctx.fill(); ctx.restore() }
        withA(a * (on ? 1 : .6), () => {
          chip(n, 1320, 752 + i * 44, { size: 17, align: 'left', col: COL, solid: on })
          txt(s, 1320 + textW(n, 17, { font: MONO }) + 40, 759 + i * 44, { size: 20, color: C.text })
        })
      })
    },
  }

  // 场景 3：滚动更新
  const ROLL = [
    { t: .8, cmd: 'kubectl set image deploy/web nginx=nginx:1.27' },
    { t: 2.5, cmd: 'kubectl rollout status deploy/web' },
  ]
  const XS = [600, 760, 920, 1080], YO = 390, YN = 575
  const S = k => 3.8 + k * 1.8
  const rolling = {
    name: '滚动更新', dur: 17, mood: 3,
    vo: [[0.6, '改镜像，Deployment 开始滚动更新。'],
      [5.2, '多 1 个、少 0 个：先加后减，容量不降。', '最多多出一个，一个都不能少：先加后减，容量不降。'],
      [11.0, '新 RS 满 4 个，旧 RS 缩到 0，留作回滚。', '新 ReplicaSet 满 4 个，旧的缩到 0，留作回滚。']],
    cues: [[0.4, 'whoosh'], ...typeCues(ROLL, 30), ...[0, 1, 2, 3].flatMap(k => [[S(k), 'pop'], [S(k) + 1, 'tick'], [S(k) + 1.1, 'poof']]), [5.2, 'zap'], [11.0, 'chime']],
    draw(t, T) {
      heading('滚动更新：先加后减', 140, 210, t, .2, { eyebrow: 'ROLLING UPDATE', color: COL })
      const ra = E.out(P(t, .4, .9))
      const done = t >= 11
      // 两行 RS
      withA(ra, () => {
        chip('RS  web-6c9d5bb8f4', 140, YO - 18, { size: 18, align: 'left', col: COL })
        txt(done ? 'replicas: 0 · 留作回滚' : 'nginx:1.26 · 旧版本', 140, YO + 30, { size: 20, color: done ? C.amber : C.body })
        chip('RS  web-84b5f6d7c9', 140, YN - 18, { size: 18, align: 'left', col: C.green, alpha: E.out(P(t, 3.4, 3.8)) })
        txt('nginx:1.27 · 新版本', 140, YN + 30, { size: 20, color: C.body, alpha: E.out(P(t, 3.4, 3.8)) })
      })
      let total = 0, avail = 0, upd = 0
      XS.forEach((x, k) => {
        const s = S(k)
        // 旧 Pod
        const oa = 1 - E.out(P(t, s + 1.1, s + 1.5))
        if (t < s + 1.3) { total++; avail++ }
        if (oa < 1) ghostHex(x, YO, 100, ra * (1 - oa))
        pod(x, YO, 100, { state: COL, alpha: ra * oa, scale: E.back(P(t, .6 + k * .12, 1.0 + k * .12)) })
        poof(x, YO, P(t, s + 1.1, s + 1.9), COL)
        withA(win(t, s + 1.1, s + 1.9, .2), () => chip('−1', x + 52, YO - 52, { size: 16, col: C.red }))
        // 新 Pod
        if (t < s) { ghostHex(x, YN, 100, E.out(P(t, 3.4, 3.8))); return }
        total++
        const ready = t >= s + 1
        if (ready) { avail++; upd++ }
        pod(x, YN, 100, { state: ready ? 'run' : 'pending', scale: E.back(P(t, s, s + .4)) })
        ring(x, YN, P(t, s + 1, s + 1.8), C.green, 90)
        withA(win(t, s, s + .9, .2), () => chip('+1', x + 52, YN - 52, { size: 16, col: C.green }))
      })
      // 策略面板
      withA(E.out(P(t, 1.2, 1.7)), () => {
        panel(1300, 330, 480, 310, { r: 18 })
        txt('strategy: RollingUpdate', 1330, 378, { size: 20, font: MONO, weight: 600 })
        const on = t >= 5.2 && t < 11
        chip('maxSurge: 1', 1330, 426, { size: 18, align: 'left', col: C.green, solid: on })
        chip('maxUnavailable: 0', 1330, 474, { size: 18, align: 'left', col: C.amber, solid: on })
        meter(1330, 540, 420, 14, total / 5, total > 4 ? C.green : COL, { label: 'Pod 总数', value: `${total} / 上限 5`, size: 18 })
        meter(1330, 608, 420, 14, avail / 5, avail >= 4 ? C.green : C.red, { label: 'Available', value: `${avail} / 至少 4`, size: 18 })
      })
      // rollout status
      const st = upd < 4 ? `Waiting for deployment "web" rollout to finish: ${upd} out of 4 new replicas have been updated...` : `Waiting for deployment "web" rollout to finish: 4 of 4 updated replicas are available...`
      terminal(140, 670, 1640, 210, t, [...ROLL, { t: 3.8, out: st, color: C.amber }, { t: 11.0, out: 'deployment "web" successfully rolled out', color: C.green }], { size: 20, alpha: E.out(P(t, .4, .8)) })
    },
  }

  // 场景 4：历史与回滚
  const UNDO = [
    { t: .8, cmd: 'kubectl rollout history deploy/web' },
    { t: 2.1, out: 'REVISION  CHANGE-CAUSE', color: C.mute },
    { t: 2.4, out: '1         <none>', color: C.body },
    { t: 2.7, out: '2         升级到 nginx 1.27', color: COL },
    { t: 5.4, cmd: 'kubectl set image deploy/web nginx=nginx:9.9.9-not-exist' },
    { t: 7.6, out: 'web-5f7d9c8b6d-xq2lp   0/1   ImagePullBackOff', color: C.red, sfx: 'error' },
    { t: 10.8, cmd: 'kubectl rollout undo deploy/web' },
    { t: 12.0, out: 'deployment.apps/web rolled back', color: C.green, sfx: 'ok' },
  ]
  const REV = [[1150, 'REV 1', 'nginx:1.26', COL, 2.4], [1350, 'REV 2', 'nginx:1.27', COL, 2.7], [1550, 'REV 3', '9.9.9-not-exist', C.red, 7.4], [1740, 'REV 4', 'nginx:1.27', C.green, 12.2]]
  const undo = {
    name: '历史与回滚', dur: 16, mood: 4,
    vo: [[0.6, 'rollout history 记录每一次发布。'],
      [5.4, '坏镜像拉不下来，旧 Pod 一个没删。'],
      [10.8, 'undo 一键回滚，Git 里也要 revert。', 'undo 一键回滚，但记得在 Git 里也 revert。']],
    cues: [[0.4, 'whoosh'], ...typeCues(UNDO, 30), [2.4, 'pop'], [2.7, 'pop'], [7.4, 'pop'], [8.4, 'tick'], [12.1, 'poof'], [12.2, 'pop'], [13.2, 'alarmSoft']],
    draw(t, T) {
      heading('坏版本？rollout undo', 140, 210, t, .2, { eyebrow: 'ROLLOUT UNDO', color: COL })
      terminal(140, 270, 900, 390, t, UNDO, { size: 22, alpha: E.out(P(t, .4, .9)) })
      // 版本时间轴
      const last = REV.filter(r => t >= r[4]).length
      if (last > 0) { const x2 = REV[last - 1][0]; line(1150, 330, lerp(REV[Math.max(0, last - 2)][0], x2, E.out(P(t, REV[last - 1][4], REV[last - 1][4] + .4))), 330, C.hairD, 3) }
      REV.forEach(([x, n, img, c, t0], i) => {
        const k = E.back(P(t, t0, t0 + .4)); if (k <= 0) return
        const on = i === last - 1
        withA(clamp(k), () => {
          ctx.save(); ctx.fillStyle = on ? c : tint(c, .2); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, 330, 15 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
          txt(n, x, 376, { size: 18, font: MONO, weight: 600, align: 'center', color: C.text })
          txt(img, x, 402, { size: 16, font: MONO, align: 'center', color: i === 2 ? C.red : C.body })
        })
        if (i === 2) cross(x, 330, 12, '#ffffff', clamp(k))
      })
      curve(1350, 310, 1740, 310, -64, E.out(P(t, 12.2, 12.9)), C.green, 2, { dash: [6, 6] })
      withA(E.out(P(t, 12.7, 13.1)), () => chip('复用 REV 2 的模板', 1545, 268, { size: 16, font: SANS, col: C.green }))
      // Pod 们
      const pa = E.out(P(t, 1.0, 1.5))
      const OX = [1140, 1270, 1400, 1530], PY = 590
      OX.forEach((x, i) => pod(x, PY, 90, { state: 'run', alpha: pa, scale: E.back(P(t, 1.0 + i * .1, 1.4 + i * .1)) }))
      withA(pa, () => {
        chip('Service web', 1335, 468, { size: 18, col: COL, solid: true })
        OX.forEach(x => partialLine(1335, 486, x, PY - 50, 1, hexA(COL, .3), 1.5))
        line(1100, 654, 1570, 654, hexA(C.green, .5), 2)
        txt('4 个旧 Pod 照常服务', 1335, 690, { size: 20, color: C.text, align: 'center' })
      })
      if (pa > 0) OX.forEach((x, i) => flow(1335, 486, x, PY - 50, t, COL, 2, .7, i * .25, 3.5))
      const bad = t >= 7.6, ba = E.back(P(t, 7.4, 7.8)) * (1 - E.out(P(t, 12.0, 12.3)))
      pod(1690, PY, 90, { state: bad ? 'fail' : 'pending', scale: ba, alpha: clamp(ba), shake: bad && t < 12 ? Math.sin(t * 60) * 5 * (1 - P(t, 7.6, 8.4)) : 0 })
      poof(1690, PY, P(t, 12.1, 12.9), C.red)
      withA(clamp(ba) * E.out(P(t, 7.6, 7.9)), () => chip('ImagePullBackOff', 1690, PY + 72, { size: 16, col: C.red }))
      if (bad && t < 12) ring(1690, PY, P(t, 7.6, 8.5), C.red, 100)
      withA(E.out(P(t, 8.4, 8.9)), () => txt('maxUnavailable: 0 → 新 Pod 不就绪，就不删旧 Pod', 1440, 734, { size: 18, color: C.mute, align: 'center' }))
      // Git 提醒
      withA(E.out(P(t, 13.2, 13.7)), () => {
        panel(140, 764, 1640, 116, { r: 18, fill: tint(C.amber, .06), stroke: hexA(C.amber, .6), lw: 2 })
        txt('⚠ undo 只改了集群，Git 里仍是坏版本', 180, 812, { size: 24, weight: 600, color: C.text })
        txt('在 Git 里 revert 这次提交，否则下次 apply 或 GitOps 同步又会改回去', 180, 852, { size: 20, color: C.body })
      })
    },
  }

  // 场景 5：三种发布策略
  const PX = [140, 700, 1260], PW = 520
  const strategies = {
    name: '发布策略', dur: 16, mood: 2,
    vo: [[0.6, 'Recreate 先全删再重建，会中断服务。'],
      [5.6, '蓝绿：改 Service 选择器，一步切换。'],
      [10.8, '金丝雀：按副本比例，约一成流量试新版。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [2.2, 'poof'], [2.6, 'alarmSoft'], [3.4, 'pop'], [4.1, 'ok'], [5.8, 'pop'], [8.1, 'zap'], [8.4, 'chime'], [11.0, 'pop'], [12.2, 'tick']],
    draw(t, T) {
      heading('三种发布策略', 140, 210, t, .2, { eyebrow: 'STRATEGIES', color: COL })
      const cur = t < 5.6 ? 0 : t < 10.8 ? 1 : 2
      ;[['Recreate', '先全删，再全建', C.red, .6], ['蓝绿 Blue/Green', '两套环境，切 selector', COL, 5.6], ['金丝雀 Canary', '小比例先试新版', C.amber, 10.8]].forEach(([n, s, c, t0], i) => {
        const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
        const x0 = PX[i], cx = x0 + PW / 2, on = cur === i
        withA(a * (on ? 1 : .6), () => {
          panel(x0, 280 + lerp(24, 0, a), PW, 590, { r: 20, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .03) : C.panel })
          chip(n, x0 + 28, 330, { size: 22, align: 'left', col: c, solid: on, font: SANS })
          txt(s, x0 + 30, 386, { size: 20, color: C.body })
          if (i === 0) {
            // 旧的全删，新的再建
            ;[-165, -55, 55, 165].forEach((d, j) => {
              const oa = 1 - E.out(P(t, 2.1, 2.4))
              pod(cx + d, 474, 76, { state: COL, alpha: oa, scale: E.back(P(t, 1.0 + j * .1, 1.4 + j * .1)) })
              poof(cx + d, 474, P(t, 2.2, 3.0), COL)
              if (t >= 2.4 && t < 3.4) ghostHex(cx + d, 474, 76)
              pod(cx + d, 474, 76, { state: t < 4.0 ? 'pending' : 'run', scale: E.back(P(t, 3.4 + j * .08, 3.8 + j * .08)) })
            })
            const X0 = x0 + 40, CW = 440, yT = 612, yB = 732
            const lv = s => s < 2.2 ? 1 : s < 2.4 ? 1 - (s - 2.2) / .2 : s < 3.9 ? 0 : s < 4.1 ? (s - 3.9) / .2 : 1
            const xs = s => X0 + (s - 1.0) / 4.2 * CW
            txt('可用 Pod', X0, 592, { size: 18, color: C.mute })
            line(X0, yB, X0 + CW, yB, C.hairD, 1.5)
            const end = clamp(t, 1.0, 5.2)
            if (end > 1.0) {
              if (end > 2.4) { ctx.save(); ctx.fillStyle = tint(C.red, .14); ctx.fillRect(xs(2.3), yT, xs(Math.min(end, 4.0)) - xs(2.3), yB - yT); ctx.restore() }
              ctx.save(); ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath()
              for (let k = 0; k <= 60; k++) { const s = 1.0 + (end - 1.0) * k / 60; const X = xs(s), Y = lerp(yB, yT, lv(s)); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y) }
              ctx.stroke(); ctx.restore()
            }
            withA(E.out(P(t, 2.6, 3.0)), () => txt('服务中断', xs(3.15), 686, { size: 20, weight: 600, color: C.red, align: 'center' }))
            withA(E.out(P(t, 4.2, 4.6)), () => txt('适合不能新旧并存的应用', cx, 800, { size: 20, color: C.body, align: 'center' }))
          }
          if (i === 1) {
            const sw = E.inOut(P(t, 8.0, 8.5)), g = sw > .5
            chip('Service shop', cx, 438, { size: 20, col: COL, solid: true })
            chip(g ? 'selector: version=green' : 'selector: version=blue', cx, 486, { size: 18, col: g ? C.green : COL })
            ;[[-125, COL, 'blue · v1'], [125, C.green, 'green · v2']].forEach(([d, pc, lb], j) => {
              ;[-58, 0, 58].forEach((e, m) => pod(cx + d + e, 648, 54, { state: pc, scale: E.back(P(t, 6.0 + j * .3 + m * .08, 6.4 + j * .3 + m * .08)) }))
              txt(lb, cx + d, 710, { size: 18, font: MONO, align: 'center', color: C.text, alpha: E.out(P(t, 6.2, 6.6)) })
            })
            arrow(cx, 506, cx - 125, 604, 1 - sw, COL, 2.5)
            arrow(cx, 506, cx + 125, 604, sw, C.green, 2.5)
            if (t > 6.4) { if (sw < .5) flow(cx, 506, cx - 125, 604, t, COL, 3, .8, 0, 4); else flow(cx, 506, cx + 125, 604, t, C.green, 3, .8, 0, 4) }
            ring(cx + 125, 648, P(t, 8.4, 9.3), C.green, 120)
            withA(E.out(P(t, 8.6, 9.0)), () => { txt('瞬间切换，出问题立即切回', cx, 792, { size: 20, color: C.body, align: 'center' }); txt('代价：同时跑两套资源', cx, 828, { size: 18, color: C.mute, align: 'center' }) })
          }
          if (i === 2) {
            chip('Service shop', cx, 438, { size: 20, col: COL, solid: true })
            chip('selector: app=shop', cx, 486, { size: 18, col: COL })
            for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) pod(cx - 115 + (q - 1) * 56, 592 + r * 54, 46, { state: COL, scale: E.back(P(t, 11.0 + (r * 3 + q) * .05, 11.4 + (r * 3 + q) * .05)) })
            pod(cx + 130, 646, 66, { state: C.amber, scale: E.back(P(t, 11.6, 12.0)) })
            withA(E.out(P(t, 11.4, 11.8)), () => { txt('stable × 9', cx - 115, 762, { size: 18, font: MONO, align: 'center' }); txt('canary × 1', cx + 130, 762, { size: 18, font: MONO, align: 'center' }) })
            if (t > 12.2) { flow(cx, 506, cx - 115, 552, t, COL, 5, .7, 0, 4); flow(cx, 506, cx + 130, 604, t, C.amber, 1, .45, .3, 5) }
            withA(E.out(P(t, 12.2, 12.6)), () => chip('≈ 10% 流量到 canary', cx, 810, { size: 20, font: SANS, col: C.amber }))
            withA(E.out(P(t, 13.4, 13.8)), () => txt('精确控流：Argo Rollouts / Flagger', cx, 850, { size: 17, color: C.mute, align: 'center' }))
          }
        })
      })
    },
  }

  ANIM({
    id: 'deployments',
    meta: { stage: 1, lesson: 4, of: 6, title: 'ReplicaSet 与 Deployment', summary: '副本控制、滚动更新、回滚与发布策略。', next: 'Service 与服务发现' },
    scenes: [
      lessonIntro({ tags: ['ReplicaSet', 'Deployment', '滚动更新', 'rollout undo', '蓝绿 · 金丝雀'], vo: [[3.2, 'Deployment：让应用可扩缩、可升级、可回滚。']] }),
      replicaset, hierarchy, rolling, undo, strategies,
      lessonOutro({
        points: ['ReplicaSet 按标签保持副本数，不管升级', 'Deployment → RS → Pod，模板哈希区分版本', 'maxSurge / maxUnavailable 控制滚动节奏', 'rollout undo 回滚，Git 里同步 revert'],
        vo: [[0.8, '小结：日常用 Deployment，不直接用 RS。', '小结：日常用 Deployment，不直接用 ReplicaSet。'], [5.6, '下一课，用 Service 给 Pod 稳定的入口。']],
      }),
    ],
  })
})()
