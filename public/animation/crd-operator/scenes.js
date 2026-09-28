/* 第 3 阶段 · 第 6 课：CRD 与 Operator 模式 */
(() => {
const COL = STAGES[3].color

// 二次贝塞尔上的点（与 engine 的 curve 同一参数化）
function qpt(x1, y1, x2, y2, bend, u) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1
  const cx = mx - dy / L * bend, cy = my + dx / L * bend
  return [(1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2]
}

// 场景 1：为什么要扩展 API
const PG = ['apiVersion: db.example.com/v1', 'kind: PostgresCluster', 'metadata:', '  name: orders', 'spec:',
  '  version: "16"', '  instances: 3', '  storage: 100Gi', '  backup:', '    schedule: "0 2 * * *"']
const KIDS = [['StatefulSet', 'orders', '3 个实例'], ['Service', 'orders-rw', '读写入口'], ['Secret', 'orders-app', '账号密码'],
  ['ConfigMap', 'orders-conf', '参数配置'], ['CronJob', 'orders-backup', '每天 02:00 备份']]
const whyApi = {
  name: '为什么扩展 API', dur: 16, mood: 1,
  vo: [[0.6, '只想写一份 PostgresCluster，声明要什么。'],
    [5.8, '剩下的 StatefulSet、Service、备份，都由它创建。'],
    [11.0, 'Helm 只管安装，Operator 7×24 持续维护。', 'Helm 只管安装，Operator 七乘二十四小时持续维护。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], [3.0, 'pop'], [3.4, 'shimmer'], ...KIDS.map((_, k) => [6.0 + k * .45, 'pop']),
    [11.0, 'pop'], [11.4, 'ok'], [12.4, 'whoosh'], [13.0, 'tick'], [13.8, 'error'], [14.4, 'ok'], [15.0, 'chime']],
  draw(t) {
    heading('为什么要扩展 API：把运维知识写成代码', 140, 210, t, .2, { eyebrow: 'WHY OPERATOR', color: COL })
    code(140, 280, 600, PG, t, .8, { title: 'orders.yaml · 我们只想写这个', size: 20, hi: t > 2.4 && t < 5.8 ? [1] : [], hiColor: COL, alpha: E.out(P(t, .6, 1.1)) })
    // Operator
    const oA = E.out(P(t, 3.2, 3.7))
    arrow(750, 487, 826, 487, E.out(P(t, 3.0, 3.5)), hexA(C.text, .35), 2.5)
    withA(E.out(P(t, 3.0, 3.5)), () => txt('watch', 788, 470, { size: 17, font: MONO, color: C.mute, align: 'center' }))
    if (t > 3.0 && t < 5.8) flow(750, 506, 826, 506, t, COL, 2, .9, 0, 4)
    withA(oA, () => {
      panel(836, 420, 250, 134, { r: 20, fill: tint(COL, .08), stroke: COL, lw: 2.5 })
      wheel(890, 487, 34, { p: 1, color: COL, rot: t * .9 })
      txt('Operator', 936, 480, { size: 28, weight: 700, color: COL })
      txt('7×24 盯着', 936, 514, { size: 18, color: C.body })
    })
    // 子资源
    KIDS.forEach(([kind, name, desc], k) => {
      const t0 = 6.0 + k * .45, a = E.out(P(t, t0, t0 + .45)); if (a <= 0) return
      const y0 = 290 + k * 82
      arrow(1086, 487, 1176, y0 + 33, E.out(P(t, t0, t0 + .4)), hexA(COL, .45), 2)
      withA(a, () => {
        panel(1180 + lerp(30, 0, a), y0, 600, 66, { r: 14 })
        chip(kind, 1202 + lerp(30, 0, a), y0 + 33, { size: 19, align: 'left', col: C.blue })
        txt(name, 1392 + lerp(30, 0, a), y0 + 40, { size: 20, font: MONO, color: C.text })
        txt(desc, 1756 + lerp(30, 0, a), y0 + 40, { size: 18, color: C.mute, align: 'right' })
      })
    })
    // 底部：Helm vs Operator
    const sA = E.out(P(t, 10.8, 11.3))
    withA(sA, () => panel(140, 722, 1640, 150, { r: 18 }))
    withA(E.out(P(t, 11.0, 11.4)), () => {
      chip('Helm', 166, 764, { size: 20, align: 'left', col: C.mute, font: SANS })
      dot(380, 764, 7, C.green, 6)
      check(380, 764, 22, C.green, P(t, 11.3, 11.7))
      txt('install', 400, 771, { size: 18, font: MONO, color: C.body })
      line(480, 764, 1740, 764, hexA(C.text, .18), 2, [6, 8])
      txt('装完就不管了', 1110, 752, { size: 18, color: C.mute, align: 'center' })
    })
    const oR = E.out(P(t, 12.4, 12.8))
    withA(oR, () => {
      chip('Operator', 166, 830, { size: 20, align: 'left', col: COL, solid: true, font: SANS })
      const p = E.inOut(P(t, 12.4, 15.4)), xe = lerp(380, 1740, p)
      line(380, 830, xe, 830, COL, 3); dot(xe, 830, 6, COL, 10)
      if (t > 12.8) flow(380, 830, xe, 830, t, COL, 5, .6, 0, 3.5)
    })
    const M = [[760, 13.0, '02:00 备份', C.teal], [1150, 13.8, t < 14.4 ? '03:00 主库宕机' : '03:00 自动切换 ✓', t < 14.4 ? C.red : C.green], [1540, 15.0, '升级 16 → 17', C.blue]]
    M.forEach(([x, t0, s, c]) => chip(s, x, 830, { size: 18, col: c, solid: false, font: SANS, alpha: E.out(P(t, t0, t0 + .35)) }))
    ring(1150, 830, P(t, 13.8, 14.6), C.red, 90)
  },
}

// 场景 2：CRD 注册新资源
const CRD = ['apiVersion: apiextensions.k8s.io/v1', 'kind: CustomResourceDefinition', 'metadata:', '  name: crontabs.stable.example.com',
  'spec:', '  group: stable.example.com', '  scope: Namespaced', '  names:', '    plural: crontabs', '    kind: CronTab',
  '    shortNames: ["ct"]', '  versions: [{ name: v1, storage: true }]']
const GET = [
  { t: 10.4, cmd: 'kubectl get ct' },
  { t: 11.2, out: 'NAME      SCHEDULE      PHASE    AGE', color: C.mute },
  { t: 11.5, out: 'nightly   0 2 * * *     Active   5s', color: C.text },
  { t: 12.6, cmd: 'kubectl explain crontab.spec' },
]
const crd = {
  name: 'CRD 注册新资源', dur: 16, mood: 2,
  vo: [[0.6, 'CRD 向 apiserver 注册一种新资源。'],
    [5.6, 'apiserver 立刻多出一组 REST 端点。'],
    [10.4, '从此可以 kubectl get，也能用 RBAC 管控。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], [1.6, 'pop'], [2.6, 'tick'], [5.8, 'shimmer'], [7.2, 'pop'], ...typeCues(GET, 30), [11.5, 'ok'], [13.6, 'tick']],
  draw(t) {
    heading('CRD：向 apiserver 注册一种新资源', 140, 210, t, .2, { eyebrow: 'CUSTOM RESOURCE DEFINITION', color: COL })
    const hi = t < 2.6 ? [] : t < 5.6 ? [3] : t < 10.4 ? [5, 8] : [10]
    code(140, 280, 740, CRD, t, .8, { title: 'crontab-crd.yaml', size: 20, hi, hiColor: COL, alpha: E.out(P(t, .6, 1.1)) })
    withA(E.out(P(t, 2.8, 3.3)) * (1 - P(t, 5.4, 5.8)), () => chip('name 必须是 <plural>.<group>', 860, 318, { size: 18, col: COL, align: 'right' }))
    // apiserver 资源树
    const tA = E.out(P(t, 1.6, 2.1))
    withA(tA, () => {
      panel(940, 280, 840, 330, { r: 18 })
      txt('kube-apiserver', 968, 322, { size: 18, font: MONO, color: C.mute })
      chip('REST', 1756, 316, { size: 16, align: 'right', col: C.blue })
      line(940, 342, 1780, 342, C.hair, 1)
      txt('/apis', 972, 390, { size: 22, font: MONO, color: C.text, weight: 600 })
    })
    const G = [['apps/v1', 'deployments  statefulsets', 1.9, C.body], ['batch/v1', 'jobs  cronjobs', 2.1, C.body], ['stable.example.com/v1', 'crontabs', 5.8, COL]]
    let last = 396
    G.forEach(([g, r, t0, c], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 438 + i * 50; last = y - 7
      withA(a, () => {
        line(996, y - 7, 1014, y - 7, hexA(C.text, .25), 2)
        if (i === 2) { ctx.save(); ctx.fillStyle = tint(COL, .12); rr(1012, y - 30, 740, 38, 10); ctx.fill(); ctx.restore() }
        txt(g, 1024, y, { size: 22, font: MONO, color: i === 2 ? COL : C.text, weight: i === 2 ? 600 : 500 })
        txt(r, 1330, y, { size: 20, font: MONO, color: c })
        if (i === 2) chip('NEW', 1740, y - 11, { size: 16, align: 'right', col: COL, solid: true })
      })
    })
    withA(tA, () => line(996, 400, 996, last, hexA(C.text, .25), 2))
    ring(1160, 538, P(t, 5.8, 6.8), COL, 140)
    chip('/apis/stable.example.com/v1/namespaces/*/crontabs', 968, 574, { size: 18, align: 'left', col: COL, alpha: E.out(P(t, 7.2, 7.7)) })
    terminal(940, 640, 840, 230, t, GET, { size: 22, alpha: E.out(P(t, 9.8, 10.3)) })
    withA(E.out(P(t, 12.8, 13.3)), () => chip('RBAC 资源名：crontabs · crontabs/status', 1756, 806, { size: 17, align: 'right', col: C.violet, font: SANS }))
    chip('CRD 只负责「存」：CR 只是 etcd 里的一条记录', 140, 812, { size: 20, align: 'left', col: C.amber, font: SANS, alpha: E.out(P(t, 13.6, 14.1)) })
  },
}

// 场景 3：schema 校验
const BAD = ['apiVersion: stable.example.com/v1', 'kind: CronTab', 'metadata:', '  name: bad', 'spec:',
  '  cronSpec: "every minute"', '  image: busybox', '  replicas: 20', '  colour: red']
const ERR = [['spec.cronSpec · pattern', '"every minute" 不是 5 段 cron 表达式', 5.4, 5],
  ['spec.replicas · maximum: 10', '20 超过上限', 6.6, 7],
  ['spec · CEL 规则', '默认 Allow 时，replicas 必须 ≤ 3', 7.8, 4]]
const schema = {
  name: 'schema 校验', dur: 16, mood: 3,
  vo: [[0.6, '结构化 schema 让 apiserver 替你把关。'],
    [5.2, '格式、范围、CEL 跨字段规则，不合法直接拒绝。'],
    [10.6, '未定义的字段被裁剪，缺省值自动填充。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], [2.2, 'pop'], [3.0, 'whoosh'], [4.2, 'thud'], ...ERR.map(e => [e[2], 'error']), [10.4, 'pop'], [10.8, 'poof'], [12.6, 'pop'], [13.2, 'ok'], [14.2, 'chime']],
  draw(t) {
    heading('schema 校验：不合法的 CR 进不了 etcd', 140, 210, t, .2, { eyebrow: 'OPENAPI SCHEMA', color: COL })
    const hi = ERR.filter(e => t >= e[2] && t < 10.4).map(e => e[3])
    code(140, 280, 600, BAD, t, .8, { title: 'bad.yaml', size: 22, hi, hiColor: C.red, alpha: E.out(P(t, .6, 1.1)) })
    // colour 被裁剪
    const pr = E.out(P(t, 10.8, 11.4))
    if (pr > 0) {
      const ly = 280 + 96 + 8 * 22 * 1.62, w = textW('  colour: red', 22, { font: MONO })
      ctx.save(); ctx.globalAlpha = pr * .6; ctx.fillStyle = '#fff'; ctx.fillRect(144, ly - 26, 592, 34); ctx.restore()
      partialLine(208, ly - 7, 208 + w + 6, ly - 7, pr, C.red, 3)
      chip('裁剪', 700, ly - 8, { size: 16, col: C.amber, align: 'right', font: SANS, alpha: pr })
    }
    // schema 闸门
    const gA = E.out(P(t, 2.2, 2.7))
    withA(gA, () => {
      shield(880, 460, 66, t >= 4.2 && t < 5.4 ? C.red : COL)
      txt('schema', 880, 470, { size: 20, font: MONO, weight: 600, color: t >= 4.2 && t < 5.4 ? C.red : COL, align: 'center' })
      txt('apiserver 校验', 880, 580, { size: 18, color: C.body, align: 'center' })
    })
    arrow(750, 460, 808, 460, E.out(P(t, 2.6, 3.0)), hexA(C.text, .35), 2.5)
    if (t < 4.2) travel(752, 460, 820, 460, P(t, 3.0, 4.0), COL)
    else if (t < 5.0) travel(820, 460, 752, 460, P(t, 4.2, 5.0), C.red)
    ring(880, 460, P(t, 4.2, 5.2), C.red, 110)
    chip('HTTP 422', 880, 624, { size: 18, col: C.red, solid: true, alpha: E.out(P(t, 4.2, 4.6)) })
    // 错误列表
    const eA = E.out(P(t, 4.4, 4.9))
    withA(eA, () => {
      panel(1020, 280, 760, 410, { r: 18, stroke: hexA(C.red, .35) })
      txt('The CronTab "bad" is invalid:', 1046, 324, { size: 20, font: MONO, color: C.red, weight: 600 })
      line(1020, 346, 1780, 346, C.hair, 1)
    })
    ERR.forEach(([k, d, t0], i) => {
      const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
      const y0 = 356 + i * 110
      withA(a, () => {
        if (i) line(1046, y0 - 4, 1754, y0 - 4, C.hair, 1)
        cross(1066, y0 + 44, 22, C.red, 1)
        txt(k, 1100, y0 + 36, { size: 20, font: MONO, color: C.red })
        txt(d, 1100, y0 + 74, { size: 20, color: C.body })
      })
    })
    // 底部：裁剪 / 默认值
    withA(E.out(P(t, 10.4, 10.9)), () => {
      panel(140, 730, 1640, 140, { r: 18 })
      line(960, 752, 960, 848, C.hair, 1.5)
      chip('字段裁剪 Pruning', 166, 772, { size: 18, align: 'left', col: C.amber, font: SANS })
      chip('默认值 default', 988, 772, { size: 18, align: 'left', col: C.green, font: SANS })
    })
    withA(pr, () => {
      const w = textW('colour: red', 22, { font: MONO })
      txt('colour: red', 168, 838, { size: 22, font: MONO, color: C.mute })
      line(164, 831, 172 + w, 831, C.red, 3)
      txt('schema 里没定义 → 静默丢弃', 370, 838, { size: 20, color: C.body })
    })
    withA(E.out(P(t, 12.6, 13.1)), () => {
      txt('+ concurrencyPolicy: Allow', 990, 838, { size: 22, font: MONO, color: C.green })
      txt('写入时自动填充', 1754, 838, { size: 20, color: C.body, align: 'right' })
    })
    withA(E.out(P(t, 14.0, 14.5)), () => chip('所以 CEL 看到的是 Allow', 1754, 772, { size: 17, align: 'right', col: C.mute, font: SANS }))
  },
}

// 场景 4：Reconcile 调和循环
const SCALE = [
  { t: 5.2, cmd: 'kubectl apply -f webapp-sample.yaml' },
  { t: 6.4, out: 'webapp.example.com/webapp-sample created', color: C.body },
  { t: 9.8, cmd: 'kubectl scale deploy webapp-sample --replicas=5' },
  { t: 11.5, out: 'deployment.apps/webapp-sample scaled' },
  { t: 15.6, out: '# 片刻之后', color: C.mute },
  { t: 15.8, out: 'webapp-sample   READY 3/3   ← 被调回', color: C.green },
]
const RC = [1560, 445, 300, 445, -90] // 回路曲线
const reconcile = {
  name: 'Reconcile 循环', dur: 18, mood: 2,
  vo: [[0.6, 'CRD 只负责存，让它生效的是控制器。'],
    [5.2, '事件进队列去重，Reconcile 对比期望和实际。'],
    [10.6, '手动改成 5 个副本？它马上又调回 3 个。'],
    [15.2, '只看当前状态，这叫水平触发。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.0, 'pop'], [1.4, 'pop'], [1.8, 'pop'], [2.2, 'pop'], [5.4, 'tick'], [5.6, 'tick'], [5.8, 'tick'], [7.2, 'zap'], [8.6, 'pop'],
    ...typeCues(SCALE, 30), [11.6, 'pop'], [11.8, 'pop'], [12.0, 'alarmSoft'], [13.9, 'zap'], [15.0, 'poof'], [15.8, 'ok'], [16.0, 'tick'], [16.3, 'tick'], [16.6, 'chime']],
  draw(t) {
    heading('控制器：Reconcile 调和循环', 140, 210, t, .2, { eyebrow: 'RECONCILE LOOP', color: COL })
    chip('Webapp CR · spec.replicas: 3', 300, 300, { size: 18, col: COL, alpha: E.out(P(t, .8, 1.2)) })
    const rHi = (t > 7.2 && t < 8.2) || (t > 13.9 && t < 14.9)
    const B = [[300, 280, 'watch', 'CR · 子资源事件', C.blue, 1.0], [700, 280, 'WorkQueue', 'ns/name 去重', C.violet, 1.4],
      [1110, 300, 'Reconcile()', rHi ? (t > 13 ? '期望 3 · 实际 5' : '期望 3 · 实际 0') : '期望 vs 实际', COL, 1.8], [1560, 300, 'Deployment', 'owner: Webapp', C.teal, 2.2]]
    B.forEach(([x, w, n, s, c, t0], i) => box(x, 390, w, 110, n, s, i === 2 && t > 13.9 && t < 14.9 ? C.amber : c,
      { alpha: E.out(P(t, t0, t0 + .5)), size: 26, hi: (i === 2 && rHi) || (i === 3 && t > 8.6 && t < 9.4) || (i === 1 && t > 5.4 && t < 6.6) }))
    ;[[440, 560, 1.2], [840, 960, 1.6], [1260, 1410, 2.0]].forEach(([a, b, t0]) => arrow(a, 390, b - 4, 390, E.out(P(t, t0, t0 + .5)), hexA(C.text, .3), 2.5))
    curve(...RC, E.inOut(P(t, 2.8, 3.6)), hexA(C.text, .25), 2, { dash: [7, 7] })
    chip('子资源变化也会触发', 930, 524, { size: 17, col: C.mute, font: SANS, alpha: E.out(P(t, 3.4, 3.8)) })
    // 第一次调和：3 个事件去重成 1 个
    ;[5.4, 5.6, 5.8].forEach(t0 => { const p = P(t, t0, t0 + .6); if (p > 0 && p < 1) travel(440, 390, 560, 390, p, C.blue) })
    const trip = (t0, c) => {
      let p = P(t, t0, t0 + .5); if (p > 0 && p < 1) travel(840, 390, 960, 390, p, c)
      p = P(t, t0 + 1.6, t0 + 2.1); if (p > 0 && p < 1) travel(1260, 390, 1410, 390, p, c)
    }
    trip(6.6, COL)
    // 手动 scale 后：回路事件
    const cp = P(t, 12.0, 12.9)
    if (cp > 0 && cp < 1) { const [x, y] = qpt(...RC, E.inOut(cp)); dot(x, y, 8, C.amber, 12) }
    const qp = P(t, 13.0, 13.4); if (qp > 0 && qp < 1) travel(440, 390, 560, 390, qp, C.amber)
    trip(13.4, C.amber)
    // 终端
    terminal(140, 590, 900, 280, t, SCALE, { size: 21, alpha: E.out(P(t, 4.8, 5.3)) })
    // Pods 面板
    withA(E.out(P(t, 1.0, 1.5)), () => {
      panel(1100, 590, 680, 280, { r: 18 })
      txt('webapp-sample · Pods', 1124, 628, { size: 18, font: MONO, color: C.mute })
      if (t < 8.6) txt('Deployment 尚未创建', 1440, 702, { size: 20, color: C.faint, align: 'center', alpha: 1 - P(t, 8.2, 8.6) })
    })
    for (let k = 0; k < 5; k++) {
      const born = k < 3 ? 8.6 + k * .2 : 11.6 + (k - 3) * .2
      const s = E.back(P(t, born, born + .4)); if (s <= 0) continue
      const x = 1170 + k * 100
      if (k >= 3 && t > 15.0) { poof(x, 694, P(t, 15.0, 15.8), C.amber); continue }
      pod(x, 694, 66, { state: k < 3 ? 'run' : 'pending', scale: s, alpha: clamp(s) })
    }
    const st = t < 8.6 ? null : t < 11.6 ? ['期望 3 · 实际 3', C.green] : t < 15.2 ? ['期望 3 · 实际 5 → 删掉 2 个', C.amber] : ['期望 3 · 实际 3 ✓', C.green]
    if (st) txt(st[0], 1124, 786, { size: 20, color: st[1], weight: 600 })
    let cx = 1124
    ;['水平触发', '幂等', 'ownerReferences'].forEach((s, i) => { const w = chip(s, cx, 832, { size: 18, align: 'left', col: COL, font: i === 2 ? MONO : SANS, alpha: E.out(P(t, 16.0 + i * .3, 16.4 + i * .3)) }); cx += (w || textW(s, 18) + 24) + 12 })
  },
}

// 场景 5：成熟度与常见 Operator
const LV = [['Basic', 'Install', '安装配置'], ['Seamless', 'Upgrades', '平滑升级'], ['Full', 'Lifecycle', '备份 · 故障切换'], ['Deep', 'Insights', '指标 · 告警'], ['Auto', 'Pilot', '自动调优 · 自愈']]
const OPS = [['cert-manager', 'Certificate', 'TLS 证书自动签发与续期'], ['Rook', 'CephCluster', '在集群里运维 Ceph 存储'],
  ['GPU Operator', 'ClusterPolicy', 'GPU 驱动、Device Plugin、监控'], ['Prometheus Operator', 'ServiceMonitor', '声明式管理抓取与告警'],
  ['CloudNativePG', 'Cluster · Backup', 'PostgreSQL 高可用与备份']]
const maturity = {
  name: '成熟度与生态', dur: 15, mood: 1,
  vo: [[0.6, 'Operator 能力分五级，从安装到自动驾驶。'],
    [5.6, '只会安装的和 Helm 差不多，数据库至少要到三级。'],
    [10.4, 'cert-manager、Rook、GPU Operator 都是典型。', 'cert manager、Rook、GPU Operator，都是典型。']],
  cues: [[0.4, 'whoosh'], ...LV.map((_, k) => [0.9 + k * .35, 'ding' + k]), [1.6, 'pop'], [2.2, 'pop'], [2.8, 'pop'], [5.8, 'tick'], [7.8, 'ok'],
    ...OPS.map((_, i) => [10.4 + i * .3, 'pop']), [12.8, 'shimmer']],
  draw(t) {
    heading('Operator 成熟度与常见 Operator', 140, 210, t, .2, { eyebrow: 'CAPABILITY LEVELS', color: COL })
    // 台阶
    LV.forEach(([n1, n2, d], k) => {
      const a = E.out(P(t, .9 + k * .35, 1.4 + k * .35)); if (a <= 0) return
      const x = 140 + k * 176, top = 740 - (150 + k * 80), h = 740 - top
      const on = (k === 0 && t > 5.6 && t < 8.2) || (k === 2 && t > 7.8)
      withA(a, () => {
        const yy = top + lerp(24, 0, a)
        panel(x, yy, 168, h - (yy - top), { r: 14, fill: tint(COL, .05 + k * .04), stroke: on ? COL : hexA(COL, .35), lw: on ? 3 : 1.5, shadow: false })
        txt(String(k + 1), x + 18, yy + 46, { size: 36, weight: 700, color: COL })
        txt(n1, x + 18, yy + 80, { size: 20, weight: 600, color: C.text })
        txt(n2, x + 18, yy + 104, { size: 20, weight: 600, color: C.text })
        txt(d, x + 18, yy + 134, { size: 18, color: C.body })
      })
    })
    withA(E.out(P(t, 2.6, 3.1)), () => {
      line(140, 764, 1000, 764, C.hairD, 2); arrowHead(1000, 764, 0, C.hairD, 12)
      txt('自动化程度 →', 1000, 798, { size: 18, color: C.mute, align: 'right' })
      txt('Operator Framework 能力模型', 140, 798, { size: 18, color: C.mute })
    })
    chip('≈ Helm Chart', 224, 560, { size: 18, col: C.amber, font: SANS, alpha: E.out(P(t, 5.8, 6.3)) })
    chip('数据库类至少到这里', 576, 400, { size: 18, col: COL, font: SANS, solid: true, alpha: E.out(P(t, 7.8, 8.3)) })
    ring(576, 520, P(t, 7.8, 8.8), COL, 140)
    // 右侧：公式 + 常见 Operator
    withA(E.out(P(t, 1.4, 1.9)), () => {
      panel(1080, 280, 700, 112, { r: 18, fill: tint(COL, .05), stroke: hexA(COL, .4) })
      let x = 1106
      txt('Operator', x, 346, { size: 30, weight: 700, color: C.text }); x += textW('Operator', 30, { weight: 700 }) + 18
      txt('=', x, 346, { size: 30, color: C.mute }); x += 36
      ;[['CRD', COL, 1.6], ['控制器', C.blue, 2.2], ['运维知识', C.amber, 2.8]].forEach(([s, c, t0], i) => {
        if (i) { txt('+', x, 346, { size: 28, color: C.mute, alpha: E.out(P(t, t0, t0 + .3)) }); x += 30 }
        const w = chip(s, x, 336, { size: 22, col: c, align: 'left', font: SANS, alpha: E.out(P(t, t0, t0 + .4)) }) || textW(s, 22) + 24
        x += w + 14
      })
    })
    const cur = t < 12.8 ? -1 : Math.floor((t - 12.8) / .45) % 5
    OPS.forEach(([n, r, d], i) => {
      const a = E.out(P(t, 10.4 + i * .3, 10.9 + i * .3)); if (a <= 0) return
      const y0 = 416 + i * 90, on = cur === i
      withA(a, () => {
        const dx = lerp(40, 0, a)
        panel(1080 + dx, y0, 700, 80, { r: 14, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .05) : C.panel })
        chip(n, 1104 + dx, y0 + 26, { size: 18, align: 'left', col: COL, solid: true, font: SANS })
        chip(r, 1756 + dx, y0 + 26, { size: 16, align: 'right', col: C.mute })
        txt(d, 1104 + dx, y0 + 66, { size: 20, color: C.body })
      })
    })
  },
}

ANIM({
  id: 'crd-operator',
  meta: { stage: 3, lesson: 6, of: 6, title: 'CRD 与 Operator 模式', summary: '扩展 Kubernetes API，理解 Operator 如何把运维知识写成代码。', next: '生产集群规划' },
  scenes: [
    lessonIntro({ tags: ['CRD', 'OpenAPI schema', 'CEL', 'Reconcile', 'Operator'], vo: [[3.2, '怎样让 K8s 认识一种新资源？', '怎样让 Kubernetes 认识一种新资源？']] }),
    whyApi, crd, schema, reconcile, maturity,
    lessonOutro({
      points: ['CRD 注册新资源，apiserver 自动提供 REST 端点', 'schema：类型校验、默认值、字段裁剪、CEL', 'Reconcile：水平触发、幂等、ownerReferences', 'Operator = CRD + 控制器 + 运维知识'],
      vo: [[0.8, '小结：Operator 把运维知识写成代码。'], [5.6, '下一课，生产集群规划。']],
    }),
  ],
})
})()
