/* 第 2 阶段 · 第 5 课：Ingress 与 Gateway API */
(() => {
const COL = STAGES[2].color

// 沿折线移动的数据包（带淡入淡出），p: 0→1
function pkt(pts, p, col, r = 7) { if (p <= 0 || p >= 1) return; withA(Math.min(1, p * 8, (1 - p) * 8), () => travelPath(pts, p, col, r)) }
// 小勾 / 小叉徽标
function mark(x, y, ok, a) {
  if (a <= 0) return
  withA(a, () => { ctx.save(); ctx.fillStyle = ok ? tint(C.green, .16) : tint(C.red, .14); ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ok ? check(x, y, 18, C.green, 1) : cross(x, y, 14, C.red, 1) })
}

// 场景 1：七层入口的基本结构
const SVC = [['web', 440, C.blue], ['api', 600, C.teal], ['v2', 760, C.violet]]
const REQ = ['按域名 / 路径分流', '入口统一 HTTPS', '按比例切流量']
const entry = {
  name: '七层入口', dur: 16, mood: 1,
  vo: [[0.6, '对外服务要按域名、路径分流，统一 HTTPS。'],
    [5.6, '给每个服务开 LB，既浪费 IP，又只懂四层。', '每个服务都开 LoadBalancer，浪费 IP，还只懂四层。'],
    [10.6, 'K8s 只定义 API，真正转发的是入口控制器。', 'Kubernetes 只定义 API，真正转发流量的是入口控制器。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], [1.8, 'tick'], [2.2, 'tick'], [2.6, 'tick'], [5.8, 'pop'], [6.1, 'pop'], [6.4, 'pop'], [8.4, 'error'],
    [10.6, 'whoosh'], [11.1, 'pop'], [11.5, 'pop'], [12.2, 'zap'], [13.6, 'chime']],
  draw(t) {
    heading('七层流量入口：一个入口，多条路由', 140, 210, t, .2, { eyebrow: 'L7 ENTRY', color: COL })
    // 客户端
    const ua = E.out(P(t, .6, 1.2))
    user(250, 560, 30, C.body, ua)
    chip('app.example.com', 250, 664, { size: 18, col: C.mute, alpha: ua })
    // 需求清单
    REQ.forEach((s, i) => {
      const a = E.out(P(t, 1.8 + i * .4, 2.3 + i * .4)); if (a <= 0) return
      const x = 700 + i * 300, bad = t > 8.4 && t < 10.6, good = t > 13.6
      chip(s, x, 300, { size: 20, font: SANS, col: good ? C.green : bad ? C.red : C.body, alpha: a })
      mark(x + textW(s, 20) / 2 + 36, 300, good, bad ? E.out(P(t, 8.4, 8.8)) : good ? E.out(P(t, 13.6, 14)) : 0)
    })
    // 后端 Service
    SVC.forEach(([n, y, c], i) => box(1600, y, 280, 96, n, 'Service', c, { alpha: E.out(P(t, 1.2 + i * .2, 1.7 + i * .2)), size: 26 }))
    // 反例：每个服务一个 LoadBalancer
    const b = win(t, 5.6, 10.6, .5)
    withA(b, () => {
      SVC.forEach(([n, y, c], i) => {
        const k = E.out(P(t, 5.8 + i * .3, 6.3 + i * .3))
        partialLine(290, 560, 790, y, k, hexA(C.text, .25), 2)
        partialLine(1010, y, 1460, y, k, hexA(C.text, .25), 2)
        box(900, y, 220, 84, 'LoadBalancer', `IP 203.0.113.${11 + i}`, t > 8.4 ? C.red : C.amber, { alpha: k, size: 22 })
        if (t > 6.6 && t < 8.4) pkt([[290, 560], [790, y], [1010, y], [1460, y]], ((t - 6.6) * .7 + i * .3) % 1, c)
      })
      chip('3 个外部 IP · 只做四层 · 无法按路径路由', 900, 852, { size: 20, font: SANS, col: C.red, alpha: E.out(P(t, 8.4, 8.9)) })
    })
    // 正解：一个 LB + 入口控制器
    const c = E.out(P(t, 10.8, 11.4))
    if (c > 0) {
      withA(c, () => {
        line(290, 560, 520, 600, hexA(C.text, .3), 2.5)
        line(720, 600, 880, 600, hexA(C.text, .3), 2.5)
        SVC.forEach(([n, y, cc], i) => { const k = E.out(P(t, 11.5 + i * .15, 12 + i * .15)); partialLine(1200, 600, 1460, y, k, hexA(cc, .55), 2.5)
          chip(['/', '/api', 'Header'][i], lerp(1200, 1460, .55), lerp(600, y, .55) - 18, { size: 16, col: cc, alpha: k }) })
      })
      if (t > 12.6) SVC.forEach(([n, y, cc], i) => pkt([[290, 560], [520, 600], [720, 600], [880, 600], [1200, 600], [1460, y]], ((t - 12.6) * .45 + i / 3) % 1, cc))
      box(620, 600, 200, 84, 'LB', 'NodePort / LB', C.body, { alpha: c, size: 24 })
      box(1040, 600, 320, 150, '入口控制器', 'Envoy · NGINX · Traefik', COL, { alpha: E.out(P(t, 11.1, 11.6)), hi: t > 12.2, size: 30 })
      const da = E.out(P(t, 11.5, 12))
      doc(1040, 404, 220, 92, 'Ingress', COL, { alpha: da, sub: 'Gateway / HTTPRoute' })
      arrow(1040, 452, 1040, 520, E.out(P(t, 12.2, 12.7)), COL, 2.5, [6, 6])
      chip('watch → 翻译成代理配置', 1066, 486, { size: 16, align: 'left', col: COL, alpha: E.out(P(t, 12.4, 12.9)) })
      txt('没装控制器，创建 Ingress / Gateway 没有任何效果', 1040, 730, { size: 20, color: C.mute, align: 'center', alpha: E.out(P(t, 13.8, 14.4)) })
    }
  },
}

// 场景 2：Ingress 规则与匹配
const ING = [
  'kind: Ingress',
  'metadata: {name: web}',
  'spec:',
  '  ingressClassName: traefik',
  '  rules:',
  '    - host: app.example.com',
  '      http:',
  '        paths:',
  '          - path: /api',
  '            pathType: Prefix',
  '            backend: {service: {name: api, port: …}}',
  '          - path: /',
  '            pathType: Prefix',
  '            backend: {service: {name: web, port: …}}',
]
const RT = [
  [2.2, 'GET app.example.com/api/users', 'api', C.green, '最长路径优先：/api 胜过 /'],
  [3.8, 'GET app.example.com/', 'web', C.green, '/ 兜底其余所有路径'],
  [6.2, 'GET app.example.com/apis', 'web', C.amber, 'Prefix 按路径段匹配：/api ≠ /apis'],
  [8.2, 'GET other.example.com/', '404', C.red, '没有匹配的 host 规则'],
]
const rules = {
  name: 'Ingress 规则', dur: 16, mood: 2,
  vo: [[0.6, 'Ingress 按 Host 和 Path 把请求分给 Service。'],
    [5.8, 'Prefix 按路径段匹配：/api 不匹配 /apis。', 'Prefix 按路径段匹配：斜杠 api，不匹配斜杠 apis。'],
    [11.2, 'ingressClassName 指定由哪个控制器处理。', 'ingress class name，指定由哪个控制器来处理。']],
  cues: [[0.4, 'whoosh'], ...RT.map(r => [r[0], 'tick']), ...RT.map(r => [r[0] + .9, r[3] === C.red ? 'error' : 'ok']), [11.2, 'pop'], [11.8, 'chime']],
  draw(t) {
    heading('Ingress：按 Host 与 Path 路由', 140, 210, t, .2, { eyebrow: 'INGRESS', color: COL })
    const hi = t >= 11.2 ? [3] : t >= 8.2 ? [5] : t >= 6.2 ? [8] : t >= 3.8 ? [11, 12, 13] : t >= 2.2 ? [8, 9, 10] : []
    const hc = t >= 11.2 ? COL : t >= 8.2 ? C.red : t >= 6.2 ? C.amber : C.green
    code(140, 270, 780, ING, t, .5, { title: 'ingress-basic.yaml', size: 19, step: .07, hi, hiColor: hc })
    withA(E.out(P(t, 1.4, 1.9)), () => { txt('请求', 1004, 312, { size: 20, color: C.mute }); txt('匹配到', 1756, 312, { size: 20, color: C.mute, align: 'right' }) })
    RT.forEach(([t0, req, res, c, note], i) => {
      const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
      const y = 372 + i * 98, on = t >= t0 && t < (RT[i + 1] ? RT[i + 1][0] : 11.2)
      withA(a, () => {
        panel(980 + lerp(30, 0, a), y - 42, 800, 84, { r: 14, stroke: on ? c : C.hair, lw: on ? 2.2 : 1.5, fill: on ? tint(c, .05) : C.panel })
        txt(req, 1004, y - 4, { size: 21, font: MONO, color: C.text })
        txt(note, 1004, y + 26, { size: 17, color: c === C.green ? C.body : c, alpha: E.out(P(t, t0 + .6, t0 + 1)) })
        const ra = E.back(P(t, t0 + .8, t0 + 1.2))
        if (ra > 0) chip(res === '404' ? '404 Not Found' : 'Service ' + res, 1756, y, { size: 20, align: 'right', col: c, solid: res === '404', alpha: clamp(ra) })
      })
      travel(1420, y - 10, 1580, y, P(t, t0 + .3, t0 + .9), c, 6)
    })
    // IngressClass
    const k = E.out(P(t, 11.4, 12))
    if (k > 0) {
      curve(922, 440, 980, 790, -40, k, hexA(COL, .6), 2.2)
      withA(k, () => {
        panel(980, 744, 800, 124, { r: 16, stroke: COL, lw: 2, fill: tint(COL, .05) })
        chip('IngressClass · traefik', 1004, 780, { size: 20, align: 'left', col: COL, solid: true })
        txt('controller: traefik.io/ingress-controller', 1004, 842, { size: 19, font: MONO, color: C.body })
        chip('is-default-class', 1756, 780, { size: 16, align: 'right', col: C.mute })
      })
    }
  },
}

// 场景 3：Ingress 的局限
const ANN = [
  'kind: Ingress',
  'metadata:',
  '  annotations:',
  '    nginx.ingress.kubernetes.io/rewrite-target: /',
  '    nginx.ingress.kubernetes.io/canary-weight: "10"',
  '    traefik.ingress.kubernetes.io/router.middlewares: …',
  'spec:',
  '  tls: …            # 证书、端口：基础设施',
  '  rules: …          # 路由：应用团队',
]
const limits = {
  name: 'Ingress 的局限', dur: 16, mood: 2,
  vo: [[0.6, '重写、限流、金丝雀，Ingress 全靠注解。'],
    [5.6, '注解各家不同，不可移植，拼错也静默失效。'],
    [10.8, 'ingress-nginx 已退役，新项目优先选 Gateway API。', 'ingress nginx 已退役，新项目优先选 Gateway API。']],
  cues: [[0.4, 'whoosh'], [1.6, 'tick'], [2.4, 'ok'], [2.8, 'error'], [3.6, 'ok'], [4.0, 'error'], [5.8, 'pop'], [6.6, 'pop'], [7.4, 'pop'], [10.8, 'thud'], [11.2, 'lock'], [13, 'chime']],
  draw(t) {
    heading('Ingress 的局限：一切靠注解', 140, 210, t, .2, { eyebrow: 'LIMITS', color: COL })
    const hi = t > 7.4 && t < 10.8 ? [7, 8] : t > 5.8 && t < 10.8 ? [3, 4, 5] : t > 1.6 && t < 5.6 ? [3, 4, 5] : []
    code(140, 280, 820, ANN, t, .5, { title: 'web-ingress.yaml', size: 19, step: .08, hi, hiColor: t > 7.4 ? C.violet : C.amber })
    // 两个控制器
    const retired = E.out(P(t, 10.8, 11.3))
    const CT = [['ingress-nginx', 380, 'kubernetes/ingress-nginx'], ['Traefik', 580, 'traefik.io/ingress-controller']]
    CT.forEach(([n, y, s], i) => box(1460, y, 380, 110, n, s, i ? C.blue : C.green, { alpha: E.out(P(t, 1 + i * .3, 1.5 + i * .3)) * (i === 0 ? lerp(1, .45, retired) : 1), size: 28 }))
    // 注解 → 控制器：认 / 不认
    const rowY = r => 280 + 96 + r * 30.8 - 6
    const L = [[3, 0, true, 2.2], [3, 1, false, 2.6], [5, 1, true, 3.4], [5, 0, false, 3.8]]
    L.forEach(([r, ci, ok, t0]) => {
      const p = E.out(P(t, t0, t0 + .5)); if (p <= 0) return
      const y1 = rowY(r), y2 = CT[ci][1] + (ok ? 0 : ci ? -24 : 24)
      withA(win(t, t0, 10.6, .4), () => {
        curve(962, y1, 1266, y2, 0, p, ok ? hexA(C.green, .6) : hexA(C.red, .5), 2.2, { dash: ok ? null : [6, 6] })
        mark(lerp(962, 1266, .62), lerp(y1, y2, .62), ok, E.out(P(t, t0 + .4, t0 + .7)))
      })
    })
    withA(win(t, 2.8, 10.6), () => txt('只有 ingress-nginx 认识 nginx.* 注解', 1460, 470, { size: 18, color: C.red, align: 'center', alpha: E.out(P(t, 2.8, 3.2)) }))
    // 三个问题
    ;['注解不可移植：换控制器就要重写', '只是字符串：拼错静默失效', '基础设施与路由混在一个对象'].forEach((s, i) => {
      const a = E.out(P(t, 5.8 + i * .8, 6.3 + i * .8)); if (a <= 0) return
      const x = 140 + i * 420
      withA(a, () => { panel(x, 700 + lerp(20, 0, a), 400, 76, { r: 14, fill: tint(C.red, .05), stroke: hexA(C.red, .4) })
        txt(s, x + 200, 746 + lerp(20, 0, a), { size: 20, align: 'center', color: C.text }) })
    })
    // 退役印章
    if (retired > 0) {
      withA(retired, () => {
        ctx.save(); ctx.translate(1460, 380); ctx.rotate(-.12); ctx.scale(lerp(1.6, 1, E.out(P(t, 10.9, 11.3))), lerp(1.6, 1, E.out(P(t, 10.9, 11.3))))
        rr(-150, -30, 300, 60, 10); ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill()
        txt('已退役 · 2026.03', 0, 11, { size: 28, weight: 700, color: C.red, align: 'center' }); ctx.restore()
      })
      chip('Ingress API 本身并未废弃', 1460, 470, { size: 18, font: SANS, col: C.mute, alpha: E.out(P(t, 12, 12.5)) })
      const g = E.back(P(t, 13, 13.5))
      if (g > 0) { withA(clamp(g), () => { panel(1220, 800, 480, 76, { r: 38, fill: tint(COL, .12), stroke: COL, lw: 2.5 }); txt('新项目 → Gateway API', 1460, 850, { size: 26, weight: 600, color: COL, align: 'center' }) }) }
    }
  },
}

// 场景 4：Gateway API 角色分工
const TIER = [
  ['GatewayClass', '基础设施方', '用哪种实现', 'istio · envoy-gateway · cloud-provider-kind', C.violet],
  ['Gateway', '集群运维', '在哪监听', ':80 / :443 · *.example.com · TLS · allowedRoutes', C.blue],
  ['HTTPRoute', '应用开发', '怎么路由', 'Host / Path / Header → Service · weight', COL],
]
const CMP = [['路由匹配', 'Host + Path', '+ Header / Query'], ['切流 / 重写', '各家注解', '标准字段'], ['协议', 'HTTP(S)', '+ gRPC / TCP / UDP'],
  ['跨命名空间', '不支持', 'Gateway 控制准入'], ['状态反馈', '很少', 'status.conditions']]
const roles = {
  name: 'Gateway API', dur: 16, mood: 3,
  vo: [[0.6, 'Gateway API 把入口的职责拆给三类角色。'],
    [5.6, 'Class 选实现，Gateway 定监听，Route 管路由。', 'Gateway Class 选实现，Gateway 定监听，Route 管路由。'],
    [10.8, '匹配、切流、多协议，全是标准字段。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.5, 'pop'], [2.0, 'pop'], [5.8, 'tick'], [7.4, 'tick'], [9.0, 'tick'], [9.6, 'zap'], ...CMP.map((_, i) => [11 + i * .35, 'tick']), [13.4, 'chime']],
  draw(t) {
    heading('Gateway API：按角色拆分', 140, 210, t, .2, { eyebrow: 'ROLES', color: COL })
    const cur = t < 5.6 ? -1 : t < 7.4 ? 0 : t < 9 ? 1 : t < 10.8 ? 2 : -1
    TIER.forEach(([n, who, what, ex, c], i) => {
      const a = E.out(P(t, 1 + i * .5, 1.5 + i * .5)); if (a <= 0) return
      const y = 280 + i * 190, on = cur === i
      withA(a * (cur < 0 || on ? 1 : .5), () => {
        panel(140 + lerp(-30, 0, a), y, 860, 150, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel })
        user(210, y + 70, 14, c, 1)
        txt(who, 210, y + 128, { size: 17, color: C.mute, align: 'center' })
        chip(n, 280, y + 50, { size: 24, align: 'left', col: c, solid: on })
        txt('「' + what + '」', 990 - 20, y + 58, { size: 24, weight: 600, color: c, align: 'right' })
        txt(ex, 282, y + 112, { size: 19, font: MONO, color: C.body })
      })
    })
    // 引用关系
    const r1 = E.out(P(t, 9.6, 10.1)), r2 = E.out(P(t, 9.9, 10.4))
    curve(1004, 660 + 75, 1004, 470 + 75, -50, r1, hexA(COL, .7), 2.5)
    withA(r1, () => txt('parentRefs', 1048, 648, { size: 17, font: MONO, color: COL }))
    curve(1004, 470 + 75, 1004, 280 + 75, -50, r2, hexA(C.blue, .7), 2.5)
    withA(r2, () => txt('gatewayClassName', 1048, 458, { size: 17, font: MONO, color: C.blue }))
    // 对比表
    const ta = E.out(P(t, 10.8, 11.3))
    if (ta > 0) {
      const X = 1230, Wt = 550
      withA(ta, () => {
        panel(X, 280, Wt, 520, { r: 18 })
        txt('Ingress', X + 262, 330, { size: 19, font: MONO, color: C.mute, align: 'center' })
        txt('Gateway API', X + 436, 330, { size: 19, font: MONO, color: COL, align: 'center', weight: 600 })
        line(X, 352, X + Wt, 352, C.hair, 1)
      })
      CMP.forEach(([k, a, b], i) => {
        const ra = E.out(P(t, 11 + i * .35, 11.4 + i * .35)); if (ra <= 0) return
        const y = 400 + i * 84
        withA(ra, () => {
          if (i) line(X + 20, y - 42, X + Wt - 20, y - 42, C.hair, 1)
          txt(k, X + 24, y + 6, { size: 19, color: C.text, weight: 600 })
          txt(a, X + 262, y + 6, { size: 17, font: MONO, color: C.mute, align: 'center' })
          wrap(b, X + 436, y + 6 - (textW(b, 17, { font: MONO }) > 200 ? 12 : 0), 210, { size: 17, font: MONO, color: COL, align: 'center', lh: 24 })
        })
      })
    }
  },
}

// 场景 5：HTTPRoute 流量切分
const RTE = [
  'kind: HTTPRoute',
  'spec:',
  '  parentRefs: [{name: main-gateway}]',
  '  hostnames: ["echo.example.com"]',
  '  rules:',
  '    - matches:',
  '        - headers: [{name: X-Canary, value: "true"}]',
  '      backendRefs: [{name: echo-v2, port: 3000}]',
  '    - matches: [{path: {type: PathPrefix, value: /}}]',
  '      backendRefs:',
  '        - {name: echo-v1, port: 3000, weight: 90}',
  '        - {name: echo-v2, port: 3000, weight: 10}',
]
// v2 的权重随时间变化：90/10 → 50/50 → 0/100
const w2At = t => t < 11.6 ? 10 : t < 13.4 ? lerp(10, 50, E.inOut(P(t, 11.6, 12.2))) : lerp(50, 100, E.inOut(P(t, 13.4, 14)))
const split = {
  name: '流量切分', dur: 17, mood: 4,
  vo: [[0.6, 'HTTPRoute 用 weight 字段按比例切流。'],
    [5.6, '带 X-Canary 请求头的测试流量，全部去 v2。', '带 X Canary 请求头的测试流量，全部去 v2。'],
    [11.0, '逐步调权重直到 0/100，发布就完成了。', '逐步调整权重，直到零比一百，发布就完成了。']],
  cues: [[0.4, 'whoosh'], [1.2, 'pop'], [1.5, 'pop'], [1.8, 'pop'], [5.8, 'zap'], [11.6, 'tick'], [13.4, 'tick'], [14.2, 'ok'], [15, 'chime']],
  draw(t) {
    heading('HTTPRoute：请求头路由与按权重切流', 140, 210, t, .2, { eyebrow: 'TRAFFIC SPLIT', color: COL })
    const hi = t >= 11 ? [10, 11] : t >= 5.6 ? [5, 6, 7] : t >= 1.4 ? [10, 11] : []
    const w2c = Math.round(w2At(t)), rows = RTE.map((r, i) => i === 10 ? r.replace('90', 100 - w2c) : i === 11 ? r.replace('10', w2c) : r)
    code(140, 270, 720, rows, t, .4, { title: 'echo-route.yaml', size: 19, step: .07, hi, hiColor: t >= 5.6 && t < 11 ? C.amber : COL })
    const GX = 1120, GY = 540, V1 = [1620, 400], V2 = [1620, 680], IN = [920, 540]
    const a = E.out(P(t, 1.2, 1.7))
    const w2 = w2At(t), w1 = 100 - w2
    withA(a, () => {
      line(IN[0], IN[1], GX - 130, GY, hexA(C.text, .25), 2.5)
      line(GX + 130, GY - 20, V1[0] - 130, V1[1], hexA(C.blue, .7), 2 + w1 * .1)
      line(GX + 130, GY + 20, V2[0] - 130, V2[1], hexA(C.violet, .7), 2 + w2 * .1)
    })
    // 请求流：每 0.22s 一个；5.6~10.8 之间是带请求头的金丝雀测试
    let n1 = 0, n2 = 0
    for (let k = 0; k < 70; k++) {
      const s = 2.4 + k * .22, p = P(t, s, s + 1.1); if (s > 16) break
      const canary = s >= 5.8 && s < 10.2
      const ww = w2At(s), to2 = canary || (k * 37 % 100) < ww
      const tg = to2 ? V2 : V1
      if (t >= s + 1.1 && !canary && s < 5.6) { to2 ? n2++ : n1++ }
      if (p > 0 && p < 1) {
        pkt([IN, [GX - 130, GY], [GX + 130, GY + (to2 ? 20 : -20)], [tg[0] - 130, tg[1]]], p, canary ? C.amber : to2 ? C.violet : C.blue, canary ? 8 : 6)
      }
    }
    box(GX, GY, 260, 120, 'main-gateway', 'Gateway', COL, { alpha: a, size: 26 })
    box(V1[0], V1[1], 260, 110, 'echo-v1', 'Service', C.blue, { alpha: E.out(P(t, 1.5, 2)), size: 26 })
    box(V2[0], V2[1], 260, 110, 'echo-v2', 'Service', C.violet, { alpha: E.out(P(t, 1.8, 2.3)), size: 26 })
    chip(`weight ${Math.round(w1)}`, 1370, 440, { size: 18, col: C.blue, alpha: E.out(P(t, 2.2, 2.6)) })
    chip(`weight ${Math.round(w2)}`, 1370, 640, { size: 18, col: C.violet, alpha: E.out(P(t, 2.4, 2.8)) })
    // 计数（前 3 秒的样本）
    withA(E.out(P(t, 3.4, 3.8)) * (1 - E.out(P(t, 5.4, 5.8))), () => {
      txt(`${n1} 次`, V1[0], V1[1] + 96, { size: 22, font: MONO, color: C.blue, align: 'center' })
      txt(`${n2} 次`, V2[0], V2[1] + 96, { size: 22, font: MONO, color: C.violet, align: 'center' })
    })
    // 请求头标签
    const ca = win(t, 5.8, 10.6)
    chip('X-Canary: true', GX, GY - 96, { size: 18, col: C.amber, solid: true, alpha: ca })
    withA(ca, () => txt('规则 1 命中 → 100% 去 v2', V2[0], V2[1] + 96, { size: 20, color: C.amber, align: 'center' }))
    // 权重进度条
    const sa = E.out(P(t, 11, 11.5))
    if (sa > 0) {
      withA(sa, () => {
        const X = 920, Y = 820, Wd = 860
        ctx.save(); rr(X, Y, Wd, 26, 13); ctx.fillStyle = tint(C.blue, .3); ctx.fill(); rr(X + Wd * w1 / 100, Y, Wd * w2 / 100, 26, 13); ctx.fillStyle = tint(C.violet, .45); ctx.fill(); ctx.restore()
        txt(`v1 ${Math.round(w1)}`, X, Y - 14, { size: 18, font: MONO, color: C.blue })
        txt(`v2 ${Math.round(w2)}`, X + Wd, Y - 14, { size: 18, font: MONO, color: C.violet, align: 'right' })
        ;['90/10', '50/50', '0/100'].forEach((s, i) => chip(s, X + Wd * [.1, .5, 1][i] - (i === 2 ? 36 : 0), Y + 13, { size: 15, col: C.text, alpha: E.out(P(t, [11, 12.2, 14][i], [11.4, 12.6, 14.4][i])) }))
        chip('发布完成 · 改回 100/0 即回滚', X + Wd / 2, Y - 40, { size: 18, font: SANS, col: C.green, alpha: E.out(P(t, 14.2, 14.7)) })
      })
    }
  },
}

ANIM({
  id: 'ingress-gateway',
  meta: { stage: 2, lesson: 5, of: 7, title: 'Ingress 与 Gateway API', summary: '七层流量入口：Ingress 的用法与局限，新一代 Gateway API。', next: '调度：亲和性、污点与拓扑分布' },
  scenes: [
    lessonIntro({ tags: ['Ingress', 'IngressClass', 'Gateway API', 'HTTPRoute', 'weight'], vo: [[3.2, '七层入口：从 Ingress 走向 Gateway API。']] }),
    entry, rules, limits, roles, split,
    lessonOutro({
      points: ['K8s 只定义入口 API，控制器负责转发', 'Ingress：按 Host + Path 路由，IngressClass 选控制器', 'Ingress 靠注解扩展，ingress-nginx 已退役', 'Gateway API：角色拆分，权重切流是标准字段'],
      vo: [[0.8, '小结：新项目的七层入口，优先 Gateway API。'], [5.4, '下一课，学习调度：亲和、污点与拓扑。']],
    }),
  ],
})
})()
