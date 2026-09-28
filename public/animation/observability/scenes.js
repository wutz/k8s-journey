/* 第 4 阶段 · 第 5 课：可观测性：指标、日志与事件 */
(() => {
const COL = STAGES[4].color

// 场景 1：四类信号与排查顺序
const SIG = [
  ['METRICS', '指标', '现在怎么样？趋势如何？', 'VictoriaMetrics', C.blue],
  ['LOGS', '日志', '具体发生了什么？', 'Loki / VictoriaLogs', C.teal],
  ['EVENTS', '事件', 'K8s 对对象做了什么？', 'event-exporter', COL],
  ['TRACES', '链路', '请求经过哪些服务、慢在哪？', 'OpenTelemetry', C.violet],
]
function sigArt(i, x, y, w, t, c, p) {
  if (p <= 0) return
  if (i === 0) { // 折线
    ctx.save(); ctx.beginPath()
    for (let k = 0; k <= 60; k++) { const s = k / 60 * p, v = .3 + .22 * Math.sin(s * 7 + 1) + .3 * s; const X = x + s * w, Y = y + 76 - v * 70; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y) }
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
  } else if (i === 1) { // 一行行日志
    ;[.92, .64, .82, .5].forEach((f, k) => { const yy = y + 6 + k * 19
      ctx.save(); ctx.fillStyle = tint(c, .45); rr(x, yy, 56 * p, 10, 5); ctx.fill(); ctx.fillStyle = tint(c, .18); rr(x + 64, yy, (w - 64) * f * p, 10, 5); ctx.fill(); ctx.restore() })
  } else if (i === 2) {
    withA(p, () => { chip('FailedScheduling', x, y + 18, { size: 16, col: c, align: 'left' }); chip('BackOff', x + 190, y + 18, { size: 16, col: c, align: 'left' }); chip('OOMKilling', x, y + 62, { size: 16, col: C.red, align: 'left' }) })
  } else { // span 瀑布
    ;[[0, 1], [.08, .55], [.2, .46], [.56, .94]].forEach(([a, b], k) => { const yy = y + 4 + k * 19
      ctx.save(); ctx.fillStyle = tint(c, .2 + k * .1); rr(x + a * w, yy, (b - a) * w * p, 12, 6); ctx.fill(); ctx.restore() })
  }
}
const signals = {
  name: '四类信号', dur: 16, mood: 1,
  vo: [[0.5, '可观测性有四类信号。'],
    [3.6, '指标看趋势，日志看细节，事件看集群动作，链路看慢在哪。'],
    [10.2, '排查顺序：告警、面板、事件、日志，最后是链路。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.2, 'pop'], [1.6, 'pop'], [2.0, 'pop'], [3.8, 'tick'], [5.2, 'tick'], [6.6, 'tick'], [8.4, 'tick'],
    ...[0, 1, 2, 3, 4].map(i => [10.5 + i * .8, 'ding' + i])],
  draw(t) {
    heading('四类信号，各答一个问题', 140, 210, t, .2, { eyebrow: 'FOUR SIGNALS', color: COL })
    const cur = t < 3.6 ? -1 : t < 5.0 ? 0 : t < 6.4 ? 1 : t < 8.2 ? 2 : t < 10.2 ? 3 : -1
    SIG.forEach(([en, cn, q, tool, c], i) => {
      const a = E.out(P(t, .8 + i * .4, 1.3 + i * .4)); if (a <= 0) return
      const x = 140 + i * 415, y = 280 + lerp(24, 0, a), on = cur === i
      withA(a * (cur < 0 || on ? 1 : .5), () => {
        panel(x, y, 395, 330, { r: 20, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        txt(en, x + 32, y + 46, { size: 16, font: MONO, color: c, track: 3 })
        txt(cn, x + 32, y + 98, { size: 40, weight: 600 })
        sigArt(i, x + 32, y + 124, 330, t, c, E.out(P(t, 1.2 + i * .4, 2.4 + i * .4)))
        txt(q, x + 32, y + 250, { size: 22, color: on ? C.text : C.body })
        chip(tool, x + 32, y + 294, { size: 17, col: c, align: 'left' })
      })
    })
    // 排查顺序
    withA(E.out(P(t, 10.2, 10.6)), () => txt('排查顺序', 140, 690, { size: 20, color: C.mute }))
    const ST = [['告警', '指标', C.blue], ['看面板', '指标', C.blue], ['查事件', '事件', COL], ['查日志', '日志', C.teal], ['看链路', '链路', C.violet]]
    ST.forEach(([n, s, c], i) => {
      const t0 = 10.5 + i * .8, a = E.back(P(t, t0, t0 + .45)); if (a <= 0) return
      const x = 304 + i * 328
      if (i > 0) arrow(x - 328 + 118, 762, x - 122, 762, E.out(P(t, t0 - .2, t0 + .2)), hexA(C.text, .3), 2.5)
      withA(clamp(a), () => box(x, 762, 220, 84, n, s, c, { size: 26, hi: t >= t0 && t < t0 + .8 }))
    })
    withA(E.out(P(t, 14.4, 15)), () => txt('四类信号缺一个，排查就会在某一步卡住', 960, 858, { size: 20, color: C.body, align: 'center' }))
  },
}

// 场景 2：VictoriaMetrics 指标栈
const SRC = [['node-exporter', '节点资源'], ['kube-state-metrics', '对象状态'], ['kubelet / cAdvisor', '容器用量'], ['apiserver / etcd', '控制平面']]
const vmstack = {
  name: '指标栈', dur: 17, mood: 2,
  vo: [[0.6, '指标栈选用 VictoriaMetrics，兼容 Prometheus。'],
    [5.4, 'vmagent 抓取指标，写进 vmsingle 存储。', 'VM agent 抓取指标，写进 VM single。'],
    [9.4, 'Grafana 看图，vmalert 计算告警。', 'Grafana 看图，VM alert 计算告警。'],
    [13.0, '现成的 ServiceMonitor 会被自动转换。']],
  cues: [[0.4, 'whoosh'], ...[0, 1, 2, 3].map(i => [1.2 + i * .35, 'pop']), [5.4, 'pop'], [6.8, 'thud'], [9.4, 'pop'], [10.8, 'pop'], [11.6, 'pop'], [12.2, 'ding2'], [13.2, 'pop'], [13.8, 'zap'], [14.4, 'chime']],
  draw(t) {
    heading('VictoriaMetrics 指标栈', 140, 210, t, .2, { eyebrow: 'METRICS STACK', color: COL })
    // 采集源
    SRC.forEach(([n, s], i) => {
      const a = E.out(P(t, 1.2 + i * .35, 1.7 + i * .35)); if (a <= 0) return
      const y = 330 + i * 92
      box(290 + lerp(-30, 0, a), y, 300, 76, n, s, C.blue, { alpha: a, size: 22 })
      const la = E.out(P(t, 5.6, 6.2))
      partialLine(440, y, 600, 465, la, hexA(C.blue, .35), 2)
      if (t > 6.2) flow(440, y, 600, 465, t, C.blue, 3, .7, i * .22, 4)
    })
    // vmagent
    const ga = E.back(P(t, 5.4, 5.9))
    if (ga > 0) withA(clamp(ga), () => box(720, 465, 240, 100, 'vmagent', '抓取 · 转发', COL, { hi: t >= 5.4 && t < 9.4, size: 28 }))
    // vmsingle
    const sa = E.out(P(t, 6.6, 7.2))
    arrow(842, 462, 960, 450, sa, hexA(COL, .6), 2.5)
    if (t > 7.2) flow(842, 462, 960, 450, t, COL, 2, .8, 0, 4)
    cylinder(1060, 440, 180, 110, COL, null, sa)
    withA(sa, () => { txt('vmsingle', 1060, 590, { size: 24, weight: 600, align: 'center' }); txt('存储 · 保留 30d', 1060, 618, { size: 17, font: MONO, color: C.mute, align: 'center' }) })
    // Grafana
    const fa = E.out(P(t, 9.4, 9.9))
    box(1470, 350, 280, 90, 'Grafana', '面板 · 看图', C.teal, { alpha: fa, size: 26, hi: t >= 9.4 && t < 10.8 })
    arrow(1328, 360, 1162, 418, fa, hexA(C.teal, .6), 2.5)
    withA(fa, () => txt('查询', 1245, 372, { size: 18, color: C.teal, align: 'center' }))
    if (t > 9.9) flow(1160, 420, 1328, 362, t, C.teal, 2, .7, 0, 4)
    // vmalert → Alertmanager → 通知
    const va = E.out(P(t, 10.8, 11.3))
    arrow(1060, 634, 1060, 712, va, hexA(C.red, .55), 2.5)
    box(1060, 758, 240, 84, 'vmalert', '规则计算', C.red, { alpha: va, size: 24, hi: t >= 10.8 && t < 13 })
    const ma = E.out(P(t, 11.6, 12.1))
    arrow(1182, 758, 1308, 758, ma, hexA(C.red, .55), 2.5)
    box(1440, 758, 260, 84, 'Alertmanager', '路由 · 发送', C.red, { alpha: ma, size: 24 })
    const na = E.out(P(t, 12.2, 12.6))
    arrow(1572, 758, 1628, 758, na, hexA(C.red, .55), 2.5)
    chip('飞书 / 邮件', 1702, 758, { size: 18, font: SANS, col: C.red, alpha: na })
    // ServiceMonitor 自动转换
    doc(330, 780, 240, 84, 'ServiceMonitor', C.violet, { alpha: E.out(P(t, 13.2, 13.7)), sub: 'Prometheus CRD', size: 21 })
    const ca = E.out(P(t, 13.8, 14.3))
    arrow(454, 780, 574, 780, ca, C.violet, 2.5)
    withA(ca, () => txt('VM Operator 转换', 514, 850, { size: 18, color: C.violet, align: 'center' }))
    doc(700, 780, 240, 84, 'VMServiceScrape', COL, { alpha: ca, sub: 'VM CRD', size: 21 })
    const da = E.out(P(t, 14.4, 15))
    arrow(700, 736, 716, 520, da, hexA(COL, .6), 2, [7, 6])
    withA(da, () => txt('声明抓取目标', 726, 636, { size: 18, color: C.body }))
  },
}

// 场景 3：告警规则
const fEt = s => .34 + .56 * s + .018 * Math.sin(s * 26)
let sCross = 1; for (let k = 0; k <= 400; k++) { if (fEt(k / 400) > .8) { sCross = k / 400; break } }
const V0 = 1, V1 = 10.5, tC = V0 + sCross * (V1 - V0), tF = tC + 2.8
const alerting = {
  name: '告警规则', dur: 16, mood: 3,
  vo: [[0.6, '告警规则用 PrometheusRule 声明。'],
    [4.4, '盯住 etcd 用量与配额之比。'],
    [8.6, '过了阈值先 pending，持续满 for 才 firing。', '过了阈值先是 pending，持续满 for 的时长才 firing。'],
    [13.0, 'Alertmanager 按级别分发通知。', 'Alert manager 按级别分发通知。']],
  cues: [[0.4, 'whoosh'], [1.0, 'tick'], [tC, 'alarmSoft'], [tC + 1, 'tick'], [tC + 2, 'tick'], [tF, 'alarm'], [13.2, 'pop'], [13.8, 'zap'], [14.4, 'ding3']],
  draw(t) {
    heading('告警：阈值 + for + 分级路由', 140, 210, t, .2, { eyebrow: 'ALERTING', color: COL })
    const st = t < tC ? 0 : t < tF ? 1 : 2
    // 曲线
    const cha = E.out(P(t, .6, 1.1))
    withA(cha, () => {
      const vis = P(t, V0, V1), v = fEt(vis)
      chart(140, 280, 900, 310, fEt, vis, st === 2 ? C.red : st === 1 ? C.amber : C.blue, { title: 'etcd DB 用量 / 配额', threshold: .8 })
      const ty = 280 + 310 - 20 - .8 * 230
      chip('0.8', 1020, ty, { size: 16, col: C.red, align: 'right' })
      txt(`${Math.round(v * 100)}%`, 1020, 318, { size: 24, font: MONO, weight: 600, color: st ? (st === 2 ? C.red : C.amber) : C.blue, align: 'right' })
      if (vis > 0) dot(160 + vis * 860, 280 + 310 - 20 - clamp(v) * 230, 7, st === 2 ? C.red : st === 1 ? C.amber : C.blue, 12)
    })
    // 规则
    const hi = t >= tC && t < tF ? [3] : t >= 13 ? [4] : t >= 4.4 && t < tC ? [1, 2] : []
    code(140, 616, 900, ['- alert: EtcdDbNearQuota', '  expr: etcd_mvcc_db_total_size_in_bytes', '    / etcd_server_quota_backend_bytes > 0.8', '  for: 10m', '  labels: { severity: critical }'],
      t, 1.0, { title: 'PrometheusRule · cluster-alerts.yaml', size: 19, lh: 30, alpha: E.out(P(t, .9, 1.4)), hi, hiColor: st === 2 ? C.red : C.amber })
    // 状态机
    const sa = E.out(P(t, 1.4, 1.9))
    ;[['inactive', C.mute], ['pending', C.amber], ['firing', C.red]].forEach(([n, c], i) => {
      const x = 1215 + i * 230, on = st === i
      withA(sa, () => {
        panel(x - 95, 292, 190, 76, { r: 38, fill: on ? tint(c, .16) : C.panel, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5 })
        txt(n, x, 339, { size: 24, font: MONO, weight: 600, color: on ? c : C.mute, align: 'center' })
        if (i) arrowHead(x - 102, 330, 0, hexA(C.text, .3), 11)
      })
    })
    if (st === 2) ring(1675, 330, P(t, tF, tF + 1), C.red, 140)
    withA(sa, () => {
      const fp = P(t, tC, tF)
      meter(1120, 440, 650, 16, fp, fp >= 1 ? C.red : C.amber, { label: 'for: 10m（持续满足才触发）', value: fp >= 1 ? '已满足' : fp > 0 ? '计时中…' : '—', size: 20 })
    })
    // 路由
    const ra = E.out(P(t, 13.2, 13.7))
    box(1445, 560, 320, 80, 'Alertmanager', 'route by severity', C.red, { alpha: ra, size: 24 })
    const ea = E.out(P(t, 13.8, 14.3))
    partialLine(1400, 602, 1290, 682, ea, hexA(C.red, .7), 2.5)
    partialLine(1490, 602, 1620, 682, ea, hexA(C.amber, .45), 2)
    travel(1400, 602, 1290, 690, P(t, 14.2, 15), C.red)
    ;[['critical', '电话 · 即时通讯', C.red, 1270, true], ['warning', '工作群 · 邮件', C.amber, 1620, false]].forEach(([n, s, c, x, on]) => {
      withA(ea * (on ? 1 : .6), () => {
        panel(x - 150, 690, 300, 110, { r: 16, stroke: on ? c : hexA(c, .4), lw: on ? 2.5 : 1.5, fill: on ? tint(c, .08) : C.panel })
        chip(n, x, 726, { size: 18, col: c, solid: on })
        txt(s, x, 778, { size: 22, color: C.body, align: 'center' })
      })
    })
    withA(E.out(P(t, 14.6, 15.1)), () => txt('80% 就告警，留出 compact + defrag 的时间', 1445, 850, { size: 18, color: C.mute, align: 'center' }))
  },
}

// 场景 4：日志采集
const NODES = [['worker', null, C.blue], ['gpu-node', 'GPU · 污点', C.violet], ['control-plane', '污点', C.red]]
const logs = {
  name: '日志采集', dur: 17, mood: 2,
  vo: [[0.6, '容器日志写在节点的 /var/log/pods 下。', '容器日志写在节点的 var log pods 目录下。'],
    [5.0, '采集器 DaemonSet 读文件，发往日志后端。'],
    [9.6, '带污点的节点要加容忍，否则整片缺日志。'],
    [13.4, 'VictoriaLogs 查询更灵活，运维更轻。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.1, 'pop'], [1.4, 'pop'], [1.8, 'tick'], [5.2, 'pop'], [5.8, 'error'], [6.2, 'pop'], [9.8, 'tick'], [10.8, 'pop'], [11.1, 'pop'], [11.6, 'ok'], [13.4, 'pop'], [13.8, 'pop']],
  draw(t) {
    heading('日志：节点文件 → 采集器 → 后端', 140, 210, t, .2, { eyebrow: 'LOGS', color: COL })
    const tol = t >= 10.8
    NODES.forEach(([n, tag, c], i) => {
      const a = E.out(P(t, .8 + i * .3, 1.3 + i * .3)); if (a <= 0) return
      const x = 140 + i * 300, y = 285
      node(x, y, 280, 300, n, { alpha: a, tag, accent: c })
      withA(a, () => {
        pod(x + 64, y + 118, 66, { state: i === 1 ? 'gpu' : 'run' })
        const fa = E.out(P(t, 1.6 + i * .2, 2.2 + i * .2))
        arrow(x + 102, y + 118, x + 128, y + 118, fa, hexA(C.text, .35), 2)
        withA(fa, () => {
          panel(x + 134, y + 80, 128, 78, { r: 10, shadow: false, fill: C.soft })
          txt('*.log', x + 148, y + 104, { size: 16, font: MONO, color: C.mute })
          ;[.8, .55, .7].forEach((f, k) => { ctx.save(); ctx.fillStyle = tint(C.teal, .3); rr(x + 148, y + 116 + k * 12, 100 * f * P(t, 1.8 + i * .2, 3 + i * .2), 6, 3); ctx.fill(); ctx.restore() })
        })
        // 采集器
        const ok = i === 0 ? t >= 5.2 : tol
        const cy = y + 252
        if (ok) {
          const k = E.back(P(t, i === 0 ? 5.2 : 10.8 + (i - 1) * .3, (i === 0 ? 5.2 : 10.8 + (i - 1) * .3) + .45))
          arrow(x + 198, y + 162, x + 198, cy - 22, clamp(k), hexA(C.teal, .5), 2)
          withA(clamp(k), () => chip('fluent-bit', x + 198, cy, { size: 18, col: C.teal, solid: true }))
        } else if (t >= 5.8) {
          withA(E.out(P(t, 5.8, 6.2)), () => {
            panel(x + 124, cy - 22, 148, 44, { r: 22, fill: tint(C.red, .06), stroke: hexA(C.red, .6), dash: [6, 5], shadow: false })
            txt('未调度 · 缺日志', x + 198, cy + 7, { size: 17, color: C.red, align: 'center' })
          })
        }
      })
    })
    // 后端 + Grafana
    const ba = E.out(P(t, 6.2, 6.7))
    box(580, 740, 480, 90, '日志后端', 'Loki / VictoriaLogs', C.teal, { alpha: ba, size: 26 })
    NODES.forEach((_, i) => {
      const x = 140 + i * 300 + 198, on = i === 0 ? t >= 6.4 : t >= 11.4
      if (!on) return
      partialLine(x, 560, lerp(x, 580, .5), 694, E.out(P(t, i ? 11.2 : 6.4, (i ? 11.2 : 6.4) + .5)), hexA(C.teal, .35), 2)
      flow(x, 560, lerp(x, 580, .5), 694, t, C.teal, 3, .8, i * .3, 4)
    })
    const gra = E.out(P(t, 7.2, 7.7))
    arrow(906, 740, 822, 740, gra, hexA(C.teal, .6), 2.5)
    box(1000, 740, 180, 80, 'Grafana', '查询', C.teal, { alpha: gra, size: 24 })
    // 右侧：路径 + 容忍 + 两套方案
    withA(E.out(P(t, 1.2, 1.7)), () => {
      panel(1110, 285, 670, 96, { r: 16 })
      txt('日志文件路径', 1136, 322, { size: 18, color: C.mute })
      txt('/var/log/pods/<ns>_<pod>_<uid>/<c>/*.log', 1136, 358, { size: 19, font: MONO, color: C.text })
    })
    code(1110, 404, 670, ['fluent-bit:', '  tolerations:', '    - operator: Exists', '      effect: NoSchedule'], t, 9.8,
      { title: 'values.yml', size: 20, lh: 32, alpha: E.out(P(t, 9.6, 10.1)), hi: t >= 10.4 ? [2, 3] : [], hiColor: C.teal })
    ;[['Loki + promtail', ['只索引 label', '多副本要 S3']], ['VictoriaLogs', ['字段全文索引', '本地 PV 即可']]].forEach(([n, rows], i) => {
      const a = E.out(P(t, 13.4 + i * .4, 13.9 + i * .4)); if (a <= 0) return
      const x = 1110 + i * 345, on = i === 1 && t >= 14.4
      withA(a, () => {
        panel(x, 660, 325, 200, { r: 16, stroke: on ? C.teal : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(C.teal, .06) : C.panel })
        txt(n, x + 26, 708, { size: 24, weight: 600 })
        rows.forEach((r, k) => { dot(x + 32, 756 + k * 44, 4, i ? C.teal : C.mute, 0); txt(r, x + 48, 763 + k * 44, { size: 21, color: C.body }) })
      })
    })
  },
}

// 场景 5：事件持久化
const X = h => 300 + h * 155
const EVTS = [[3.0, 'OOMKilling', C.red, 0], [3.4, 'BackOff', C.amber, 1], [8.3, 'Scheduled', C.green, 0]]
const events = {
  name: '事件持久化', dur: 16, mood: 4,
  vo: [[0.6, 'Event 存在 etcd 里，默认只保留 1 小时。', 'Event 存在 etcd 里，默认只保留一小时。'],
    [5.8, '凌晨三点的 OOM，早上九点就查不到了。'],
    [10.4, 'event-exporter 把事件写进日志系统长期保存。', 'event exporter 把事件写进日志系统，长期保存。']],
  cues: [[0.4, 'whoosh'], [1.8, 'pop'], [2.0, 'pop'], [2.8, 'poof'], [3.1, 'poof'], [7.9, 'pop'], ...typeCues([{ t: 8.4, cmd: 'kubectl get events -A' }], 30), [9.4, 'error'], [10.6, 'whoosh'], [11.0, 'pop'], [11.3, 'pop'], [11.6, 'pop'], ...typeCues([{ t: 12.4, cmd: '_stream:{classify="k8s-event"} reason:OOMKilling' }], 30), [14.2, 'ok']],
  draw(t) {
    heading('事件：只活 1 小时，要持久化', 140, 210, t, .2, { eyebrow: 'EVENTS', color: COL })
    const ph = lerp(2.5, 9, P(t, 1.0, 8.2))
    const ta = E.out(P(t, .5, 1))
    withA(ta, () => {
      for (let h = 0; h <= 9; h++) { txt(`${String(h).padStart(2, '0')}:00`, X(h), 312, { size: 16, font: MONO, color: C.mute, align: 'center' }); line(X(h), 324, X(h), 332, C.hairD, 2) }
      txt('etcd', 280, 392, { size: 20, font: MONO, color: C.text, align: 'right' })
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.035)'; rr(X(0), 342, X(9) - X(0), 80, 14); ctx.fill(); ctx.restore()
      // 已过去的时间
      ctx.save(); ctx.fillStyle = hexA(C.blue, .05); rr(X(0), 342, X(ph) - X(0), 80, 14); ctx.fill(); ctx.restore()
    })
    // etcd 中的事件
    EVTS.forEach(([h, n, c, row]) => {
      if (ph < h) return
      const age = ph - h, y = row ? 402 : 362
      const gone = age > 1
      if (!gone) {
        withA(E.out(clamp(age / .15)), () => chip(n, X(h), y, { size: 16, col: c }))
        ctx.save(); ctx.fillStyle = hexA(COL, .55); rr(X(h), 426, (X(h + Math.min(1, age)) - X(h)), 6, 3); ctx.fill(); ctx.restore()
      } else poof(X(h), y, clamp((age - 1) / .5), c)
    })
    withA(ta * E.out(P(t, 2.0, 2.4)), () => txt('--event-ttl=1h', X(4) + 10, 450, { size: 16, font: MONO, color: COL }))
    // 播放头
    if (ta > 0) { line(X(ph), 330, X(ph), 432, hexA(C.text, .35), 2, [6, 5]); dot(X(ph), 330, 6, C.text, 0) }
    // 早上九点查询
    terminal(140, 640, 800, 220, t, [
      { t: 8.4, cmd: 'kubectl get events -A' },
      { t: 9.2, out: 'LAST SEEN   TYPE     REASON      OBJECT', color: C.mute },
      { t: 9.4, out: '42m         Normal   Scheduled   pod/web-7c9f', color: C.body },
    ], { size: 22, alpha: E.out(P(t, 7.9, 8.3)) })
    withA(E.out(P(t, 9.4, 9.9)), () => { cross(178, 836, 12, C.red, P(t, 9.4, 9.9)); txt('03:00 的 OOMKilling 已被删除', 202, 843, { size: 20, color: C.red }) })
    // event-exporter → VictoriaLogs
    const va = E.out(P(t, 10.4, 10.9))
    withA(va, () => {
      txt('VictoriaLogs', 280, 540, { size: 17, font: MONO, color: C.teal, align: 'right' })
      ctx.save(); ctx.fillStyle = tint(C.teal, .12); ctx.strokeStyle = hexA(C.teal, .5); ctx.lineWidth = 1.5; rr(X(0), 500, X(9) - X(0), 80, 14); ctx.fill(); ctx.stroke(); ctx.restore()
      chip('event-exporter', X(1.2), 462, { size: 16, col: C.teal, solid: true })
      txt('保留 60 天 →', X(9) - 16, 568, { size: 16, font: MONO, color: C.teal, align: 'right' })
    })
    EVTS.forEach(([h, n, c, row], i) => {
      const t0 = 11 + i * .3, p = P(t, t0, t0 + .5); if (p <= 0) return
      const y0 = row ? 402 : 362, y1 = row ? 558 : 521
      if (p < 1) travel(X(h), y0, X(h), y1, p, C.teal, 6)
      withA(E.out(P(t, t0 + .4, t0 + .6)), () => chip(n, X(h), y1, { size: 16, col: c }))
    })
    terminal(980, 640, 800, 220, t, [
      { t: 12.4, cmd: '_stream:{classify="k8s-event"} reason:OOMKilling' },
      { t: 14.2, out: '03:00  Warning  OOMKilling  Node/gn-192-168-1-11', color: C.red },
    ], { size: 22, title: 'Grafana Explore · VictoriaLogs', alpha: E.out(P(t, 12, 12.4)) })
  },
}

ANIM({
  id: 'observability',
  meta: { stage: 4, lesson: 5, of: 8, title: '可观测性：指标、日志与事件', summary: 'VictoriaMetrics + Grafana、日志采集、事件持久化与告警。', next: '镜像仓库与镜像分发' },
  scenes: [
    lessonIntro({ tags: ['VictoriaMetrics', 'Grafana', 'VictoriaLogs', 'Events', 'Alerting'], vo: [[3.2, '集群好不好，要靠指标、日志和事件来回答。']] }),
    signals, vmstack, alerting, logs, events,
    lessonOutro({
      points: ['四类信号：指标、日志、事件、链路', 'VictoriaMetrics 兼容 Prometheus 与其 CRD', '告警要可行动：阈值 + for + 分级路由', '采集器要容忍污点，事件要持久化'],
      vo: [[0.8, '小结：指标发现问题，事件和日志定位原因。'], [5.6, '下一课，搭建镜像仓库与镜像分发。']],
    }),
  ],
})
})()
