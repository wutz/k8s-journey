/* 第 1 阶段 · 第 3 课：标签、注解与命名空间 */
(() => {
  const COL = STAGES[1].color
  // 二次曲线上的点（与 engine 的 curve 使用同一控制点公式）
  const qpt = (x1, y1, x2, y2, bend, u) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1
    const cx = mx - dy / L * bend, cy = my + dx / L * bend
    return [(1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2]
  }
  const curveFlow = (x1, y1, x2, y2, bend, t, color, count = 3, speed = .7, r = 5) => {
    for (let i = 0; i < count; i++) {
      const u = ((t * speed + i / count) % 1 + 1) % 1
      const [x, y] = qpt(x1, y1, x2, y2, bend, u)
      withA(Math.sin(u * Math.PI), () => dot(x, y, r, color, 8))
    }
  }
  // 竖直进出的三次曲线（选择器连线）
  const cpt = (x1, y1, x2, y2, u) => {
    const k = (y2 - y1) * .55, v = 1 - u
    return [v * v * v * x1 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x2, v * v * v * y1 + 3 * v * v * u * (y1 + k) + 3 * v * u * u * (y2 - k) + u * u * u * y2]
  }
  const vcurve = (x1, y1, x2, y2, p, color, w = 2.5, dash) => {
    if (p <= 0) return
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash)
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = cpt(x1, y1, x2, y2, i / 40 * p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.stroke(); ctx.restore()
    if (p >= 1) arrowHead(x2, y2, Math.PI / 2, color, 10)
  }
  const vflow = (x1, y1, x2, y2, t, color, count = 2, speed = .6, r = 5) => {
    for (let i = 0; i < count; i++) {
      const u = ((t * speed + i / count) % 1 + 1) % 1, [x, y] = cpt(x1, y1, x2, y2, u)
      withA(Math.sin(u * Math.PI), () => dot(x, y, r, color, 8))
    }
  }
  const keyCues =(t0, s, cps = 24) => { const c = []; for (let i = 0; i < s.length; i += 2) c.push([t0 + i / cps, 'key']); c.push([t0 + s.length / cps + .12, 'enter']); return c }

  // 场景 1：标签与选择器
  const PODS = [
    { n: 'web-prod', L: [['app', 'web'], ['tier', 'frontend'], ['env', 'prod']] },
    { n: 'web-dev', L: [['app', 'web'], ['tier', 'frontend'], ['env', 'dev']] },
    { n: 'api-prod', L: [['app', 'api'], ['tier', 'backend'], ['env', 'prod']] },
  ]
  const KEYC = { app: COL, tier: C.violet, env: C.teal }
  const Q = [
    { t: 1.0, s: '--show-labels', m: [0, 1, 2], k: [], g: -1 },
    { t: 5.8, s: '-l env=prod', m: [0, 2], k: ['env'], g: 0 },
    { t: 8.4, s: '-l app=web,env!=prod', m: [1], k: ['app', 'env'], g: 0 },
    { t: 11.2, s: "-l 'env in (prod,staging)'", m: [0, 2], k: ['env'], g: 1 },
    { t: 14.0, s: "-l 'tier notin (backend)'", m: [0, 1], k: ['tier'], g: 1 },
  ]
  Q.forEach(q => { q.r = q.t + q.s.length / 24 + .35 })
  const PREFIX = '❯ kubectl get pods '
  const selectors = {
    name: '标签与选择器', dur: 17, mood: 1,
    vo: [[0.6, '标签是贴在对象上的键值对，想贴几个都行。'],
      [5.6, '等值选择：= 和 !=，逗号表示“与”。', '等值选择：等于、不等于，逗号表示并且。'],
      [11.0, '集合选择：in、notin，还能判断键在不在。', '集合选择：in、not in，还能判断键在不在。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.0, 'pop'], [1.2, 'pop'], ...Q.flatMap(q => keyCues(q.t, q.s)), ...Q.slice(1).map(q => [q.r, 'ok']),
      ...[0, 1, 2].map(j => [2.0 + j * .35, 'tick'])],
    draw(t) {
      heading('标签与选择器', 140, 210, t, .2, { eyebrow: 'LABELS · SELECTORS', color: COL })
      let qi = -1; Q.forEach((q, i) => { if (t >= q.t) qi = i })
      const q = qi >= 0 ? Q[qi] : null
      // 命令栏
      withA(E.out(P(t, .5, 1)), () => {
        panel(300, 268, 1320, 76, { r: 38, fill: '#fff', stroke: hexA(COL, .4) })
        txt(PREFIX, 344, 318, { size: 28, font: MONO, color: C.mute })
        if (q) {
          const n = Math.floor(clamp((t - q.t) * 24, 0, q.s.length)), x0 = 344 + textW(PREFIX, 28, { font: MONO })
          txt(q.s.slice(0, n), x0, 318, { size: 28, font: MONO, weight: 600, color: C.text })
          if (n < q.s.length || Math.sin(t * 8) > 0) { ctx.save(); ctx.fillStyle = COL; ctx.fillRect(x0 + textW(q.s.slice(0, n), 28, { font: MONO, weight: 600 }) + 3, 294, 3, 32); ctx.restore() }
        }
        if (qi === 2) chip('逗号 = 且（AND）', 1588, 306, { size: 18, font: SANS, align: 'right', col: C.amber, alpha: E.out(P(t, Q[2].r, Q[2].r + .4)) })
      })
      // Pod 与标签
      const mAt = (i, j) => j < 1 ? 1 : Q[j].m.includes(i) ? 1 : .26
      PODS.forEach((p, i) => {
        const x = 480 + i * 480, y = 480
        const k = q ? E.out(P(t, q.r, q.r + .35)) : 0
        const al = qi >= 0 ? lerp(mAt(i, qi - 1), mAt(i, qi), k) : 1
        const on = qi >= 1 && q.m.includes(i) && t >= q.r
        const pa = E.back(P(t, .8 + i * .2, 1.3 + i * .2))
        withA(al, () => {
          pod(x, y, 130, { state: on ? C.green : COL, label: p.n, alpha: clamp(pa), scale: clamp(pa) })
          p.L.forEach(([kk, v], j) => {
            const ca = E.back(P(t, 2.0 + j * .35 + i * .08, 2.4 + j * .35 + i * .08)); if (ca <= 0) return
            const hot = on && q.k.includes(kk)
            chip(`${kk}=${v}`, x, 612 + j * 44, { size: 19, col: KEYC[kk], solid: hot, alpha: clamp(ca) })
          })
        })
        if (on) { check(x + 78, y - 70, 30, C.green, P(t, q.r, q.r + .35)); ring(x, y, P(t, q.r, q.r + .9), C.green, 120) }
      })
      // 运算符图例
      withA(E.out(P(t, 5.6, 6.1)), () => {
        const G = [['等值', ['=', '==', '!='], 560], ['集合', ['in', 'notin', 'key', '!key'], 1180]]
        G.forEach(([n, ops, gx], g) => {
          const on = q && q.g === g
          withA(on ? 1 : .5, () => {
            txt(n, gx, 842, { size: 24, weight: 600, color: on ? C.text : C.body })
            let x = gx + 70
            ops.forEach(o => { x += chip(o, x, 834, { size: 22, align: 'left', col: g ? C.violet : C.amber, solid: on }) + 12 })
          })
        })
      })
    },
  }

  // 场景 2：标签是胶水
  const PX = [620, 860, 1100], PY = 700
  const glue = {
    name: '标签是胶水', dur: 16, mood: 2,
    vo: [[0.6, 'Deployment、Service 都靠选择器找 Pod。'],
      [5.6, '对象之间不靠名字引用，而是靠标签松耦合。'],
      [10.8, '给 Pod 贴上匹配的标签，它就开始接流量。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.2, 'pop'], [1.6, 'pop'], [1.8, 'pop'], [2.0, 'pop'], [2.8, 'zap'], [3.8, 'zap'], [6.0, 'error'], [7.0, 'ok'], [11.0, 'pop'], [12.0, 'tick'], [12.6, 'zap'], [13.4, 'alarmSoft']],
    draw(t, T) {
      heading('标签是对象之间的“胶水”', 140, 210, t, .2, { eyebrow: 'LOOSE COUPLING', color: COL })
      const da = E.out(P(t, .6, 1.1)), sa = E.out(P(t, 1.0, 1.5))
      box(380, 350, 320, 110, 'Deployment', 'web', COL, { alpha: da, hi: t > 2.8 && t < 5.4 })
      withA(da, () => chip('selector: app=web, tier=frontend', 380, 440, { size: 17, col: COL }))
      box(1540, 350, 300, 110, 'Service', 'web', C.cyan, { alpha: sa, hi: t > 3.8 && t < 5.4 })
      withA(sa, () => chip('selector: app=web', 1540, 440, { size: 17, col: C.cyan }))
      // 三个受管 Pod
      PX.forEach((x, i) => {
        const k = E.back(P(t, 1.6 + i * .2, 2.1 + i * .2)); if (k <= 0) return
        pod(x, PY, 110, { state: COL, alpha: clamp(k), scale: clamp(k) })
        withA(clamp(k), () => { chip('app=web', x, PY + 90, { size: 17, col: COL }); chip('tier=frontend', x, PY + 130, { size: 17, col: C.violet }) })
      })
      // 选择器连线
      PX.forEach((x, i) => {
        vcurve(360 + i * 20, 458, x - 22, PY - 68, E.out(P(t, 2.8 + i * .12, 3.5 + i * .12)), hexA(COL, .7), 2.5)
        vcurve(1520 + i * 20, 458, x + 22, PY - 68, E.out(P(t, 3.8 + i * .12, 4.5 + i * .12)), hexA(C.cyan, .8), 2.5, [8, 6])
        if (t > 4.6) vflow(1520 + i * 20, 458, x + 22, PY - 68, t + i * .3, C.cyan, 2, .6, 5)
      })
      // 名字 vs 标签
      withA(win(t, 5.8, 10.6, .4), () => {
        const cx = 960, y0 = 320
        chip('name: web-7c9d4-kq2xz', cx, y0, { size: 20, col: C.mute })
        cross(cx + 150, y0, 22, C.red, E.out(P(t, 6.0, 6.3)))
        ctx.save(); ctx.strokeStyle = hexA(C.red, .7); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 128, y0); ctx.lineTo(lerp(cx - 128, cx + 128, E.out(P(t, 5.9, 6.3))), y0); ctx.stroke(); ctx.restore()
        withA(E.out(P(t, 6.8, 7.2)), () => {
          chip('labels: app=web', cx, y0 + 62, { size: 22, col: C.green, solid: true })
          txt('名字会变，标签稳定', cx, y0 + 118, { size: 20, color: C.body, align: 'center' })
        })
      })
      // 手动贴标签的 Pod
      const sx = 1340, ka = E.out(P(t, 11, 11.6))
      if (ka > 0) {
        pod(sx + lerp(120, 0, ka), PY, 110, { state: t > 12 ? C.cyan : C.faint, alpha: ka, label: 'debug' })
        const la = E.back(P(t, 12, 12.4))
        withA(clamp(la), () => chip('app=web', sx, PY + 110, { size: 17, col: COL, solid: t < 12.8 }))
        chip('无标签', sx, PY + 110, { size: 17, col: C.mute, alpha: ka * (1 - clamp(la * 2)) })
        vcurve(1580, 458, sx + 22, PY - 68, E.out(P(t, 12.6, 13.2)), hexA(C.cyan, .8), 2.5, [8, 6])
        if (t > 13.2) vflow(1580, 458, sx + 22, PY - 68, t, C.red, 2, .6, 6)
        ring(sx, PY, P(t, 13.2, 14.2), C.red, 110)
        withA(E.out(P(t, 13.4, 13.9)), () => chip('⚠ 立刻开始接收流量', 1440, PY - 24, { size: 18, font: SANS, col: C.red, align: 'left' }))
        withA(E.out(P(t, 13.8, 14.3)), () => {
          txt('Deployment 要 tier=frontend', 1440, PY + 22, { size: 18, color: C.body })
          txt('→ 它不算副本', 1440, PY + 50, { size: 18, color: C.body })
        })
      }
      withA(E.out(P(t, 14.2, 14.7)), () => txt('Service：简单 map，仅等值 · Deployment：matchLabels + matchExpressions', 960, 890, { size: 19, color: C.mute, align: 'center' }))
    },
  }

  // 场景 3：标签还是注解
  const ANN = ['metadata:', '  annotations:', '    description: "订单服务前端，负责人 alice"', '    kubernetes.io/change-cause: "升级到 nginx 1.27"', '    prometheus.io/scrape: "true"']
  const TOOLS = [['人 / Dashboard', '阅读说明与负责人', C.teal, 2], ['rollout history', 'CHANGE-CAUSE 列', COL, 3], ['Prometheus', '是否抓取指标', C.amber, 4]]
  const annotations = {
    name: '标签还是注解', dur: 16, mood: 2,
    vo: [[0.6, '注解也是键值对，但不能被选择器选中。'],
      [5.6, '存描述信息给工具读：发布记录、监控开关。'],
      [11.0, '要筛选就用标签，只是记录就用注解。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'pop'], [2.2, 'ok'], [3.4, 'error'], [5.8, 'tick'], [7.2, 'zap'], [7.8, 'zap'], [8.4, 'zap'], [11.2, 'chime']],
    draw(t) {
      heading('标签还是注解？', 140, 210, t, .2, { eyebrow: 'LABELS VS ANNOTATIONS', color: COL })
      const rule = t > 11
      ;[
        { x: 140, n: 'labels', c: COL, t0: .8, ok: true, a: '可被选择器筛选、引用', b: '值 ≤ 63 字符，字符受限', ex: 'env=prod' },
        { x: 980, n: 'annotations', c: C.violet, t0: 1.4, ok: false, a: '不能用于选择', b: '值可以很长、可放 JSON · 总计 ≤ 256 KiB', ex: '' },
      ].forEach((d, i) => {
        const a = E.out(P(t, d.t0, d.t0 + .5)); if (a <= 0) return
        const hot = rule && (Math.floor((t - 11) / 1.2) % 2 === i)
        withA(a, () => {
          panel(d.x, 272 + lerp(20, 0, a), 800, 212, { r: 18, stroke: hot ? d.c : hexA(d.c, .35), lw: hot ? 2.5 : 1.5, fill: hot ? tint(d.c, .05) : C.panel })
          chip('metadata.' + d.n, d.x + 30, 320, { size: 22, align: 'left', col: d.c, solid: true })
          if (d.ex) chip(d.ex, d.x + 770, 320, { size: 20, align: 'right', col: C.teal })
          const pa = P(t, d.t0 + .6, d.t0 + 1.0)
          if (d.ok) check(d.x + 50, 392, 30, C.green, pa); else cross(d.x + 50, 392, 22, C.red, E.out(pa))
          txt(d.a, d.x + 86, 401, { size: 26, weight: 600 })
          txt(d.b, d.x + 86, 450, { size: 22, color: C.body })
        })
      })
      // 选择器只看标签
      withA(E.out(P(t, 1.8, 2.2)) * (1 - E.out(P(t, 5.2, 5.6))), () => {
        panel(300, 540, 1320, 260, { r: 20 })
        ;[
          ['kubectl get pods -l app=web', 'labels: app=web', COL, 2.0, true, '匹配到 Pod'],
          ['kubectl get pods -l owner=alice', 'annotations: owner=alice', C.violet, 3.0, false, 'No resources found'],
        ].forEach(([cmd, key, c, t0, ok, res], i) => {
          const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
          const y = 610 + i * 120
          withA(a, () => {
            chip(cmd, 340, y, { size: 20, align: 'left', col: C.text })
            chip(key, 880, y, { size: 20, align: 'left', col: c })
          })
          arrow(760, y, 860, y, a, hexA(C.text, .35), 2.5)
          const r = E.out(P(t, t0 + .3, t0 + .6))
          if (ok) check(1250, y, 28, C.green, r); else cross(1250, y, 20, C.red, r)
          txt(res, 1284, y + 8, { size: 21, font: ok ? SANS : MONO, color: ok ? C.green : C.red, alpha: r })
        })
      })
      // 注解示例 → 读它的工具
      code(140, 530, 960, ANN, t, 5.8, { title: 'metadata.annotations', size: 20, step: .14, alpha: E.out(P(t, 5.5, 5.9)), hi: t > 7 && t < 11 ? [TOOLS[Math.min(2, Math.floor((t - 7) / .6))][3]] : [], hiColor: C.violet })
      TOOLS.forEach(([n, s, c, row], i) => {
        const t0 = 7.2 + i * .6, a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
        const ry = 530 + 96 + row * 32.4 - 7, by = 590 + i * 92
        curve(1104, ry, 1296, by, i === 0 ? -16 : 12, E.out(P(t, t0, t0 + .5)), hexA(c, .7), 2.2)
        withA(a, () => {
          panel(1300, by - 38, 480, 76, { r: 14, stroke: hexA(c, .45) })
          txt(n, 1326, by + 8, { size: 24, font: MONO, weight: 600, color: c })
          txt(s, 1754, by + 7, { size: 20, color: C.body, align: 'right' })
        })
      })
      withA(E.out(P(t, 11.2, 11.7)), () => {
        panel(360, 818, 1200, 64, { r: 32, fill: '#fff', stroke: C.hairD })
        txt('要按它筛选、被选择器引用 → 标签', 760, 860, { size: 24, weight: 600, align: 'center', color: COL })
        line(960, 832, 960, 868, C.hairD, 1.5)
        txt('只是记录信息 → 注解', 1260, 860, { size: 24, weight: 600, align: 'center', color: C.violet })
      })
    },
  }

  // 场景 4：命名空间
  const NS = [{ n: 'dev', x: 180, c: C.teal }, { n: 'prod', x: 740, c: C.amber }]
  const FQDN = [['web', 'Service', COL], ['prod', '命名空间', C.amber], ['svc', '固定', C.mute], ['cluster.local', '集群域', C.violet]]
  const namespaces = {
    name: '命名空间', dur: 17, mood: 3,
    vo: [[0.6, '命名空间划分名字作用域：dev、prod 都能有 web。'],
      [6.0, '同命名空间用短名，跨命名空间写 web.prod。', '同命名空间用短名，跨命名空间写 web 点 prod。'],
      [11.4, '但它不是安全边界：默认网络全通。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.2, 'pop'], [2.0, 'pop'], [2.6, 'pop'], [3.6, 'ok'], [6.4, 'zap'], [8.2, 'zap'], [11.6, 'alarmSoft'], [13.0, 'pop'], [13.4, 'pop']],
    draw(t, T) {
      heading('命名空间：给名字划作用域', 140, 210, t, .2, { eyebrow: 'NAMESPACE', color: COL })
      NS.forEach((ns, i) => {
        const a = E.out(P(t, .8 + i * .4, 1.3 + i * .4)); if (a <= 0) return
        withA(a, () => {
          panel(ns.x, 300, 520, 330, { r: 22, fill: tint(ns.c, .04), stroke: hexA(ns.c, .6), dash: [10, 7], lw: 2, shadow: false })
          chip('namespace: ' + ns.n, ns.x + 24, 300, { size: 20, align: 'left', col: ns.c, solid: true })
        })
        const k = E.back(P(t, 2.0 + i * .6, 2.5 + i * .6))
        pod(ns.x + 150, 470, 104, { state: ns.c, label: 'pod/web', alpha: clamp(k), scale: clamp(k) })
        box(ns.x + 380, 470, 200, 84, 'svc/web', '', ns.c, { alpha: clamp(k), size: 24 })
      })
      withA(E.out(P(t, 3.4, 3.8)) * (1 - E.out(P(t, 5.8, 6.2))), () => {
        chip('同名不冲突', 720, 670, { size: 22, font: SANS, col: C.green })
        check(626, 670, 24, C.green, P(t, 3.6, 4))
      })
      ;[['kubectl get svc web -n dev', 440, C.teal, 4.2], ['kubectl get svc web -n prod', 1000, C.amber, 4.6]].forEach(([s, x, c, t0]) =>
        chip(s, x, 760, { size: 20, col: c, alpha: E.out(P(t, t0, t0 + .4)) * (1 - E.out(P(t, 5.8, 6.2))) }))
      // DNS：短名 / 跨命名空间
      const dA = E.out(P(t, 6.2, 6.8)) * (1 - E.out(P(t, 11.2, 11.6)))
      if (dA > 0) withA(dA, () => {
        const sx = 330, sy = 470
        arrow(sx + 56, sy, 450, sy, E.out(P(t, 6.4, 6.9)), C.teal, 3)
        chip('web', 418, sy - 34, { size: 18, col: C.teal, alpha: E.out(P(t, 6.6, 7)) })
        curve(sx, sy + 70, 1120, 516, -130, E.out(P(t, 8.2, 9.2)), C.amber, 3)
        chip('web.prod', 720, 720, { size: 20, col: C.amber, solid: true, alpha: E.out(P(t, 8.6, 9)) })
      })
      withA(E.out(P(t, 6.8, 7.3)) * (1 - E.out(P(t, 11.2, 11.6))), () => {
        panel(180, 784, 1080, 100, { r: 14 })
        txt('/etc/resolv.conf · dev 里的 Pod', 206, 816, { size: 17, font: MONO, color: C.mute })
        let x = 206
        ;['search', 'dev.svc.cluster.local', 'svc.cluster.local', 'cluster.local'].forEach((s, i) => {
          const on = i === 1 && t < 8.2
          txt(s, x, 860, { size: 22, font: MONO, weight: on ? 700 : 500, color: i === 0 ? C.mute : on ? C.teal : C.text })
          x += textW(s, 22, { font: MONO, weight: on ? 700 : 500 }) + 16
        })
      })
      // FQDN 结构
      withA(E.out(P(t, 9.2, 9.7)) * (1 - E.out(P(t, 11.2, 11.6))), () => {
        panel(1300, 300, 480, 330, { r: 18 })
        txt('完整域名', 1330, 346, { size: 20, color: C.mute })
        let y = 400
        FQDN.forEach(([s, d, c], i) => {
          const a = E.out(P(t, 9.4 + i * .25, 9.8 + i * .25))
          withA(a, () => { chip(s, 1340, y, { size: 22, align: 'left', col: c, solid: i < 2 }); txt(d, 1750, y + 8, { size: 20, color: C.body, align: 'right' }) })
          y += 58
        })
      })
      // 不是安全边界
      const w = E.out(P(t, 11.6, 12.2))
      if (w > 0) {
        curve(430, 440, 790, 440, -80, w, C.red, 3, { dash: [10, 7] })
        if (t > 12.2) curveFlow(430, 440, 790, 440, -80, t, C.red, 3, .6, 6)
        withA(w, () => {
          panel(1300, 300, 480, 330, { r: 18, fill: tint(C.red, .05), stroke: hexA(C.red, .5) })
          txt('⚠ 命名空间不是安全边界', 1330, 352, { size: 26, weight: 600, color: C.red })
          txt('只隔离名字与 API 权限作用域', 1330, 396, { size: 20, color: C.body })
          txt('Pod 默认跨命名空间互通', 1330, 430, { size: 20, color: C.body })
        })
        withA(E.out(P(t, 13, 13.4)), () => { chip('NetworkPolicy', 1330, 500, { size: 20, align: 'left', col: C.violet }); txt('网络隔离', 1750, 507, { size: 20, color: C.body, align: 'right' }) })
        withA(E.out(P(t, 13.4, 13.8)), () => { chip('RBAC', 1330, 566, { size: 20, align: 'left', col: C.violet }); txt('权限隔离', 1750, 573, { size: 20, color: C.body, align: 'right' }) })
        withA(E.out(P(t, 14, 14.5)), () => {
          panel(180, 690, 1080, 110, { r: 16, stroke: hexA(C.red, .35) })
          txt('❯ kubectl delete namespace dev', 214, 736, { size: 22, font: MONO, color: C.text })
          txt('其中的 Pod、Service、ConfigMap… 全部级联删除', 214, 776, { size: 20, color: C.red })
        })
      }
    },
  }

  // 场景 5：ResourceQuota
  const QT = [
    { t: .9, cmd: 'kubectl apply -f dev-quota.yaml' },
    { t: 2.1, out: 'resourcequota/dev-quota created', color: C.green },
    { t: 2.6, cmd: 'kubectl run a --image=nginx:1.27 -n dev' },
    { t: 4.1, out: 'pod/a created', color: C.green },
    { t: 4.5, cmd: 'kubectl run b --image=nginx:1.27 -n dev' },
    { t: 6.0, out: 'pod/b created', color: C.green },
    { t: 6.4, cmd: 'kubectl run c --image=nginx:1.27 -n dev' },
    { t: 8.0, out: 'Error from server (Forbidden): pods "c" is forbidden:', color: C.red, sfx: 'error' },
    { t: 8.1, out: '  exceeded quota: dev-quota, requested: pods=1,', color: C.red },
    { t: 8.2, out: '  used: pods=3, limited: pods=3', color: C.red },
  ]
  const SLOTS = [['web', 0], ['a', 4.1], ['b', 6.0]]
  const quota = {
    name: 'ResourceQuota', dur: 15, mood: 3,
    vo: [[0.6, 'ResourceQuota 给命名空间设上限。', 'Resource Quota 给命名空间设上限。'],
      [5.4, 'Pod 数已到上限 3，再创建就被拒绝。'],
      [10.6, 'describe quota 随时查看用量。', '用 describe quota 随时查看用量。']],
    cues: [[0.4, 'whoosh'], ...typeCues(QT, 30), [4.1, 'pop'], [6.0, 'pop'], [7.9, 'whoosh'], [8.1, 'thud'], [10.8, 'pop'], [11.6, 'tick'], [12.0, 'tick'], [12.4, 'tick']],
    draw(t, T) {
      heading('ResourceQuota：给命名空间设上限', 140, 210, t, .2, { eyebrow: 'RESOURCE QUOTA', color: COL })
      terminal(140, 270, 900, 440, t, QT, { size: 20, alpha: E.out(P(t, .4, .9)) })
      // 命名空间 dev
      const na = E.out(P(t, .6, 1.1))
      withA(na, () => {
        panel(1080, 280, 700, 250, { r: 22, fill: tint(C.teal, .04), stroke: hexA(C.teal, .6), dash: [10, 7], lw: 2, shadow: false })
        chip('namespace: dev', 1104, 280, { size: 20, align: 'left', col: C.teal, solid: true })
        chip('hard: pods=3', 1756, 280, { size: 18, align: 'right', col: C.amber, alpha: E.out(P(t, 2.1, 2.5)) })
      })
      SLOTS.forEach(([n, t0], i) => {
        const x = 1200 + i * 160, y = 400
        withA(na * .6, () => { ctx.save(); ctx.strokeStyle = C.hairD; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; hexPath(x, y, 50); ctx.stroke(); ctx.restore() })
        const k = i === 0 ? na : E.back(P(t, t0, t0 + .45))
        pod(x, y, 100, { state: i === 0 ? C.teal : C.green, label: n, alpha: clamp(k), scale: clamp(k) })
      })
      // 第 4 个被拒
      const cx = 1680, cy = 400, fly = P(t, 7.6, 8.0)
      if (fly > 0) {
        const bounce = t > 8.0 ? Math.sin(P(t, 8.0, 8.6) * Math.PI) * 30 : 0
        const shake = t > 8 && t < 8.5 ? Math.sin(t * 70) * 6 : 0
        const alpha = 1 - E.in(P(t, 9.6, 10.2)) * .6
        pod(cx + shake, lerp(260, cy, E.out(fly)) - bounce, 100, { state: t > 8 ? C.red : C.faint, label: 'c', alpha })
        cross(cx, cy, 44, C.red, E.out(P(t, 8.05, 8.3)) * alpha)
        ring(cx, cy, P(t, 8.0, 8.9), C.red, 110)
      }
      // 用量条
      const used = t < 4.1 ? 1 : t < 6.0 ? 2 : 3
      withA(na, () => {
        const c = used === 3 ? C.red : used === 2 ? C.amber : C.teal
        meter(1080, 600, 700, 22, lerp(used - 1, used, E.out(P(t, [0, 4.1, 6.0][used - 1], [0, 4.1, 6.0][used - 1] + .4))) / 3, c, { label: 'pods 用量', value: `${used} / 3` })
      })
      // 配额清单 → describe 表
      code(1080, 660, 700, ['kind: ResourceQuota', 'metadata: {name: dev-quota, namespace: dev}', 'spec:', '  hard: {pods: "3", services: "5", configmaps: "10"}'], t, 1.2,
        { title: 'dev-quota.yaml', size: 18, step: .12, alpha: E.out(P(t, 1.0, 1.4)) * (1 - E.out(P(t, 10.3, 10.7))), hi: t > 2.1 ? [3] : [], hiColor: C.amber })
      // describe quota 表
      const ta = E.out(P(t, 10.8, 11.3))
      withA(ta, () => {
        panel(1080, 660, 700, 226, { r: 16 })
        txt('kubectl describe quota dev-quota -n dev', 1104, 696, { size: 17, font: MONO, color: C.mute })
        line(1080, 714, 1780, 714, C.hair, 1)
        ;[['Resource', 'Used', 'Hard'], ['configmaps', '1', '10'], ['pods', '3', '3'], ['services', '0', '5']].forEach((r, i) => {
          const y = 752 + i * 40, a = i === 0 ? 1 : E.out(P(t, 11.2 + i * .4, 11.6 + i * .4))
          if (i === 2 && a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = tint(C.red, .1); ctx.fillRect(1082, y - 28, 696, 40); ctx.restore() }
          const col = i === 0 ? C.mute : i === 2 ? C.red : C.text
          txt(r[0], 1110, y, { size: 21, font: MONO, color: col, alpha: a })
          txt(r[1], 1560, y, { size: 21, font: MONO, color: col, align: 'right', alpha: a })
          txt(r[2], 1740, y, { size: 21, font: MONO, color: col, align: 'right', alpha: a })
        })
      })
      withA(E.out(P(t, 12.6, 13.1)), () => {
        txt('pods=3 已包含之前的 web', 140, 770, { size: 21, color: C.body })
        txt('configmaps=1 是自动创建的 kube-root-ca.crt', 140, 806, { size: 21, color: C.body })
        txt('CPU / 内存配额 → 阶段 2《健康检查与资源管理》', 140, 846, { size: 19, color: C.mute })
      })
    },
  }

  ANIM({
    id: 'labels-namespaces',
    meta: { stage: 1, lesson: 3, of: 6, title: '标签、注解与命名空间', summary: '用标签选择器组织资源，用命名空间做隔离与配额。', next: 'ReplicaSet 与 Deployment' },
    scenes: [
      lessonIntro({ tags: ['Label', 'Selector', 'Annotation', 'Namespace', 'ResourceQuota'], vo: [[3.2, '标签、注解与命名空间：组织上千个对象。']] }),
      selectors, glue, annotations, namespaces, quota,
      lessonOutro({
        points: ['标签贴在对象上，选择器按标签筛选', 'Service、Deployment 靠标签找到 Pod', '要筛选用标签，只记录用注解', '命名空间隔离名字与配额，不隔离网络'],
        vo: [[0.8, '小结：标签横向分类，命名空间纵向隔离。'], [5.6, '下一课，ReplicaSet 与 Deployment。', '下一课，学习 ReplicaSet 与 Deployment。']],
      }),
    ],
  })
})()
