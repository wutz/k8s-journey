/* 第 5 阶段 · 第 6 课：认证考试与持续成长（全课程最后一课） */
(() => {
const COL = STAGES[5].color

function sq(x, y, w, h, col, a = 1, o = {}) { // 圆角色块
  if (a <= 0) return
  withA(a, () => { ctx.save(); rr(x, y, w, h, o.r ?? 10); ctx.fillStyle = o.fill || tint(col, .14); ctx.fill(); if (o.stroke !== false) { ctx.strokeStyle = o.border || hexA(col, .6); ctx.lineWidth = o.lw || 1.5; if (o.dash) ctx.setLineDash(o.dash); ctx.stroke() } ctx.restore() })
}
const rise = (a, d = 18) => lerp(d, 0, a)

// 场景 1：三门认证
const CERTS = [
  ['CKA', 'Certified Kubernetes Administrator', '集群管理员', ['安装与升级', 'etcd 备份恢复', '网络 · 存储 · 调度', '故障排查'], '本教程阶段 1～4', C.blue, 5.8],
  ['CKAD', 'Certified Kubernetes App Developer', '应用开发者', ['Pod 设计 · 配置', '探针 · 发布', 'Service · Job', 'Helm'], '本教程阶段 1～2', C.green, 7.3],
  ['CKS', 'Certified Kubernetes Security Specialist', '安全工程师', ['集群加固', 'RBAC · PSS', 'NetworkPolicy', '供应链 · 运行时'], 'RBAC、安全加固两课', C.red, 8.8],
]
const certs = {
  name: '三门认证', dur: 16, mood: 1,
  vo: [[0.6, 'CNCF 三门认证，都是真实终端里的实操考试。', 'C N C F 三门认证，都是真实终端里的实操考试。'],
    [5.8, 'CKA 管集群，CKAD 管应用，CKS 管安全。', 'C K A 管集群，C K A D 管应用，C K S 管安全。'],
    [11.0, '注意：考 CKS 要先持有有效的 CKA。', '注意：考 C K S 要先持有有效的 C K A。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], [1.6, 'pop'], [2.0, 'pop'], [3.0, 'key'], [5.8, 'ding1'], [7.3, 'ding2'], [8.8, 'ding3'], [11.2, 'zap'], [12.4, 'chime']],
  draw(t) {
    heading('CNCF 三门 Kubernetes 认证', 140, 210, t, .2, { eyebrow: 'CERTIFICATION', color: COL })
    const ba = E.out(P(t, 2.8, 3.3))
    let x = 960 - 470
    withA(ba, () => { ;['在线监考', '真实集群终端', '约 2 小时', '完成一系列实操任务'].forEach((s, i) => { x += chip(s, x, 290, { size: 20, col: i === 3 ? COL : C.text, font: SANS, align: 'left', solid: i === 3 }) + 14 }) })
    chip('不是选择题', 1450, 290, { size: 18, col: C.mute, font: SANS, align: 'left', alpha: ba })
    CERTS.forEach(([n, full, who, focus, map, c, t0], i) => {
      const a = E.out(P(t, 1.2 + i * .4, 1.7 + i * .4)); if (a <= 0) return
      const x0 = 140 + i * 560, y0 = 340 + rise(a), on = t >= t0 && t < t0 + 1.5
      withA(a, () => {
        panel(x0, y0, 520, 380, { r: 20, stroke: on ? c : C.hair, lw: on ? 3 : 1.5, fill: on ? tint(c, .05) : C.panel })
        sq(x0, y0, 520, 10, c, 1, { r: 5, fill: c, stroke: false })
        txt(n, x0 + 32, y0 + 82, { size: 52, weight: 700, color: c })
        txt(full, x0 + 32, y0 + 114, { size: 16, font: MONO, color: C.mute })
        txt('面向：' + who, x0 + 32, y0 + 162, { size: 22, color: C.text, weight: 600 })
        focus.forEach((s, k) => chip(s, x0 + 32 + (k % 2) * 236, y0 + 210 + Math.floor(k / 2) * 50, { size: 18, col: c, font: SANS, align: 'left' }))
        line(x0 + 32, y0 + 300, x0 + 488, y0 + 300, C.hair, 1.5)
        txt('对应：' + map, x0 + 32, y0 + 342, { size: 19, color: C.body })
      })
    })
    // CKS 需先有 CKA
    const pa = E.out(P(t, 11.2, 12))
    curve(410, 724, 1500, 724, 70, pa, hexA(C.red, .7), 3, { dash: [9, 7] })
    const ca = E.out(P(t, 12.2, 12.6))
    chip('CKS 需先持有有效的 CKA · CKA 与 CKAD 无先后', 960, 808, { size: 20, col: C.red, font: SANS, solid: true, alpha: ca })
    withA(E.out(P(t, 13.2, 13.6)), () => txt('考纲、时长、考试版本、价格会调整，报名前以官方页面为准', 960, 862, { size: 18, color: C.mute, align: 'center' }))
  },
}

// 场景 2：练速度
const TERM = [
  { t: 1.0, cmd: 'alias k=kubectl' },
  { t: 2.2, cmd: 'source <(kubectl completion bash)' },
  { t: 4.8, cmd: 'export do="--dry-run=client -o yaml"' },
  { t: 6.6, cmd: 'k create deploy web --image=nginx --replicas=3 $do > web.yaml' },
  { t: 9.2, out: '✓ web.yaml 骨架已生成，改几行就能 apply', color: C.green },
  { t: 10.4, cmd: 'kubectl config use-context k8s-c2' },
  { t: 11.9, out: 'Switched to context "k8s-c2".', color: C.cyan },
  { t: 13.2, cmd: 'k explain pod.spec.containers.securityContext' },
]
const TIPS = [['alias k + 命令补全', 1.0, C.blue], ['dry-run 生成 YAML 骨架', 4.8, C.green], ['每道题先切换上下文', 10.4, C.red], ['忘了字段：k explain', 13.2, C.violet]]
const speed = {
  name: '练速度', dur: 17, mood: 2,
  vo: [[0.6, '实操考试最大的敌人是时间。'],
    [4.6, '设好别名，用 dry-run 生成 YAML 骨架。', '设好别名，用 dry run 生成 YAML 骨架。'],
    [10.4, '每道题先切换上下文，改错集群最丢分。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], ...typeCues(TERM, 30), [10.6, 'alarmSoft']],
  draw(t) {
    heading('备考：不只练会，更要练快', 140, 210, t, .2, { eyebrow: 'SPEED', color: COL })
    terminal(140, 280, 1000, 590, t, TERM, { size: 21, title: '考试终端', alpha: E.out(P(t, .4, .9)) })
    // 计时环
    const ra = E.out(P(t, .6, 1.2)), left = 1 - P(t, 1, 17) * .35
    withA(ra, () => {
      ctx.save(); ctx.lineWidth = 16; ctx.lineCap = 'round'
      ctx.strokeStyle = C.hair; ctx.beginPath(); ctx.arc(1480, 400, 96, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = left < .75 ? C.amber : COL; ctx.beginPath(); ctx.arc(1480, 400, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke(); ctx.restore()
      txt('约 2 小时', 1480, 412, { size: 30, weight: 700, align: 'center' })
      txt('限时完成一系列任务', 1480, 538, { size: 19, color: C.mute, align: 'center' })
    })
    TIPS.forEach(([s, t0, c], i) => {
      const a = E.out(P(t, t0, t0 + .4)), y = 574 + i * 66, on = t >= t0 && (i === 3 || t < TIPS[i + 1][1])
      if (a <= 0) return
      withA(a, () => {
        sq(1200, y, 580, 54, c, 1, { fill: on ? tint(c, .14) : C.panel, border: on ? c : C.hair, lw: on ? 2 : 1.5, r: 12 })
        txt(String(i + 1), 1228, y + 36, { size: 20, font: MONO, weight: 700, color: c })
        txt(s, 1260, y + 36, { size: 21, color: C.text, weight: on ? 600 : 400 })
      })
    })
    withA(E.out(P(t, 12, 12.4)), () => txt('改错集群：最常见的丢分原因', 1780, 870, { size: 19, color: C.red, align: 'right', weight: 600 }))
  },
}

// 场景 3：版本节奏
const M = m => 380 + m * 40
const LANE = i => 330 + i * 58
const release = {
  name: '版本节奏', dur: 16, mood: 3,
  vo: [[0.6, 'K8s 约每 4 个月发一个小版本。', 'Kubernetes 约每四个月发一个小版本。'],
    [5.2, '每个版本只有约 14 个月的补丁支持。', '每个版本只有约十四个月的补丁支持。'],
    [10.4, '一年不升级，就可能掉出支持期。']],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3, 4, 5].map(i => [1 + i * .45, 'tick']), [3.4, 'pop'], [5.2, 'swell'], [7.4, 'pop'], [10.6, 'beat'], [13.8, 'error'], [14.6, 'alarmSoft']],
  draw(t) {
    heading('约 4 个月一版，约 14 个月支持', 140, 210, t, .2, { eyebrow: 'RELEASE CADENCE', color: COL })
    const aa = E.out(P(t, .6, 1.1))
    withA(aa, () => {
      line(M(0), 680, M(34), 680, C.hairD, 2); arrowHead(M(34) + 8, 680, 0, C.hairD, 12)
      for (let m = 0; m <= 32; m += 4) { line(M(m), 674, M(m), 686, C.hairD, 2); txt(String(m), M(m), 712, { size: 18, font: MONO, color: C.mute, align: 'center' }) }
      txt('月', M(34) + 10, 712, { size: 18, color: C.mute, align: 'right' })
    })
    const pm = t < 10.6 ? -1 : lerp(0, 16, E.inOut(P(t, 10.6, 14.4)))
    const dead = pm >= 14
    for (let i = 0; i < 6; i++) {
      const y = LANE(i), da = E.out(P(t, 1 + i * .45, 1.4 + i * .45)); if (da <= 0) continue
      const g = E.out(P(t, 5.4 + i * .15, 6.6 + i * .15)), c = i === 0 && dead ? C.red : COL
      withA(da, () => {
        txt(i ? `v1.N+${i}` : 'v1.N', 350, y + 7, { size: 19, font: MONO, align: 'right', color: i === 0 ? C.text : C.body, weight: i === 0 ? 600 : 400 })
        if (g > 0) sq(M(4 * i), y - 18, 40 * 14 * g, 36, c, 1, { fill: tint(c, i === 0 && dead ? .22 : .12 + .03 * (5 - i)), r: 18 })
        dot(M(4 * i), y, 8, c, 8)
      })
    }
    // 4 个月一版
    const bk = win(t, 3.2, 10.4)
    withA(bk, () => {
      line(M(0), 754, M(4), 754, COL, 2); line(M(0), 744, M(0), 764, COL, 2); line(M(4), 744, M(4), 764, COL, 2)
      txt('≈ 4 个月一版 · 每年约 3 个', M(4) + 20, 761, { size: 20, color: COL, weight: 600 })
    })
    chip('≈ 14 个月补丁支持', M(14) + 16, LANE(0), { size: 19, col: COL, font: SANS, align: 'left', alpha: E.out(P(t, 7.2, 7.7)) })
    // 你的集群一直不升级
    if (pm >= 0) {
      const x = M(pm)
      const lc = hexA(dead ? C.red : C.text, .5), gap = pm > 14.2 // 越过「14 个月」标签时让开
      if (gap) { line(x, 290, x, 312, lc, 2.5, [7, 6]); line(x, 350, x, 690, lc, 2.5, [7, 6]) } else line(x, 290, x, 690, lc, 2.5, [7, 6])
      chip(dead ? `第 ${Math.round(pm)} 个月 · 已脱离支持` : `你的集群 v1.N · 第 ${Math.round(pm)} 个月`, x, 286, { size: 18, col: dead ? C.red : C.text, solid: dead, font: SANS, align: pm > 8 ? 'right' : 'left' })
    }
    withA(E.out(P(t, 14.4, 14.8)), () => {
      txt('没有安全修复；落后越多，一次升级要跨越的废弃 API 越多', 960, 842, { size: 21, color: C.red, align: 'center' })
    })
  },
}

// 场景 4：KEP 与废弃 API
const STG = [['KEP 提案', '动机 · 设计 · 毕业标准', 300, C.violet, .8], ['alpha', 'Feature Gate 默认关闭', 720, C.amber, 5.0], ['beta', '收集反馈，逐步成熟', 1140, C.blue, 6.4], ['GA', '稳定，可放心依赖', 1560, C.green, 7.8]]
const KT = [
  { t: 10.6, cmd: 'kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis' },
  { t: 12.4, out: 'apiserver_requested_deprecated_apis{group="batch",version="v1beta1",', color: C.amber },
  { t: 12.6, out: '    resource="cronjobs",removed_release="1.25"} 1', color: C.amber },
]
const kep = {
  name: 'KEP 与废弃 API', dur: 17, mood: 3,
  vo: [[0.6, '每个重要功能，都始于一份 KEP。', '每个重要功能，都始于一份 K E P。'],
    [4.8, '经过 alpha、beta 到 GA，每阶段至少一个版本。', '经过 alpha、beta 到 G A，每阶段至少一个版本。'],
    [10.4, '升级前，先扫描仍在调用的废弃 API。']],
  cues: [[0.6, 'whoosh'], [0.9, 'pop'], [5.0, 'ding1'], [6.4, 'ding2'], [7.8, 'ding4'], [8.4, 'ok'], ...typeCues(KT, 34), [12.4, 'alarmSoft']],
  draw(t) {
    heading('KEP：功能如何毕业；升级前查废弃 API', 140, 210, t, .2, { eyebrow: 'ENHANCEMENTS', color: COL })
    STG.forEach(([n, s, x, c, t0], i) => {
      const a = E.out(P(t, .8 + i * .3, 1.3 + i * .3)), on = t >= t0 && t < t0 + 1.4
      box(x, 360, 320, 96, n, s, c, { alpha: a, hi: on || (i === 3 && t >= 7.8), size: 30 })
      if (i < 3) {
        arrow(x + 164, 360, x + 256, 360, a, hexA(C.text, .35), 2.5)
        withA(a, () => txt(i ? '≥ 1 个版本' : '实现', x + 210, 336, { size: 16, color: C.mute, align: 'center' }))
      }
    })
    withA(E.out(P(t, 1.6, 2)), () => txt('kubernetes/enhancements 仓库公开讨论', 140, 452, { size: 18, font: MONO, color: C.mute }))
    // 例子：功能在流水线上的位置
    const rows = [
      ['DRA 动态资源分配', 1560, 5.0, 8.4, '1.34 GA', C.green],
      ['Workload API · 原生 Gang', 720, 5.6, 6.8, 'alpha', C.amber],
    ]
    rows.forEach(([n, to, t0, t1, st, c], i) => {
      const y = 508 + i * 64, a = E.out(P(t, t0 - .4, t0)); if (a <= 0) return
      withA(a, () => line(300, y, 1560, y, C.hair, 2, [4, 8]))
      const p = E.inOut(P(t, t0, t1)), x = lerp(300, to, p), done = t >= t1
      const w = chip(done ? `${n} · ${st}` : n, x, y, { size: 19, col: done ? c : C.violet, solid: done, font: SANS, alpha: a, align: to > 1400 && done ? 'right' : 'center' })
      if (done && to > 1400) ring(x - w / 2, y, P(t, t1, t1 + .8), c, 60)
    })
    const ga = E.out(P(t, 8.6, 9))
    chip('Gateway API 推理扩展', 300, 636, { size: 19, col: C.teal, font: SANS, alpha: ga })
    withA(ga, () => txt('独立子项目，快速迭代 · 依赖未 GA 的功能，就订阅它的 KEP', 450, 643, { size: 19, color: C.body }))
    // 废弃 API 扫描
    terminal(140, 690, 1180, 184, t, KT, { size: 18, title: '升级前检查', alpha: E.out(P(t, 10.2, 10.6)) })
    const sa = E.out(P(t, 13.6, 14))
    withA(sa, () => {
      txt('也可以：', 1360, 744, { size: 19, color: C.mute })
      chip('kubent', 1360, 790, { size: 19, col: COL, align: 'left' }); chip('Pluto', 1480, 790, { size: 19, col: COL, align: 'left' })
      txt('扫描集群与清单里的旧 API', 1360, 846, { size: 19, color: C.body })
    })
  },
}

// 场景 5：参与社区
const SIGS = [['SIG Scheduling', '调度器 · Kueue', C.blue], ['SIG Network', 'Service · Gateway API', C.teal], ['SIG Node', 'kubelet · DRA', C.green],
  ['SIG Apps', '工作负载 · LWS · JobSet', C.violet], ['WG Batch', 'AI / 批处理负载', C.amber], ['WG Serving', '推理服务负载', COL]]
const STEPS = [['旁听例会', '纪要与录像公开'], ['提问与回答', 'Slack · 论坛'], ['报告 issue', '最小复现步骤'], ['文档与翻译', 'zh-cn 本地化'], ['贡献代码', 'good first issue']]
const community = {
  name: '参与社区', dur: 16, mood: 4,
  vo: [[0.6, 'K8s 由一个个 SIG 按领域维护。', 'Kubernetes 由一个个兴趣小组按领域维护。'],
    [5.2, '参与由浅入深：从旁听例会到贡献代码。'],
    [10.6, '把你踩过的坑写出来，也是一种贡献。']],
  cues: [[0.6, 'whoosh'], ...SIGS.map((_, i) => [1.0 + i * .25, 'tick']), ...STEPS.map((_, i) => [5.4 + i * .8, `ding${i}`]), [10.8, 'pop'], [12.2, 'shimmer']],
  draw(t) {
    heading('社区：SIG 与由浅入深的参与', 140, 210, t, .2, { eyebrow: 'COMMUNITY', color: COL })
    SIGS.forEach(([n, s, c], i) => {
      const a = E.out(P(t, 1 + i * .25, 1.5 + i * .25)); if (a <= 0) return
      const x = 140 + (i % 2) * 390, y = 280 + Math.floor(i / 2) * 128 + rise(a)
      withA(a, () => {
        panel(x, y, 370, 110, { r: 16 })
        chip(n, x + 22, y + 36, { size: 19, col: c, solid: i < 4, align: 'left' })
        txt(s, x + 24, y + 86, { size: 20, color: C.body })
      })
    })
    withA(E.out(P(t, 3, 3.5)), () => {
      txt('SIG = 特别兴趣小组 · WG = 工作组', 140, 700, { size: 19, color: C.mute })
    })
    const ka = E.out(P(t, 12.6, 13.1))
    withA(ka, () => {
      sq(140, 740, 760, 120, C.amber, 1, { fill: tint(C.amber, .07), r: 16 })
      txt('KubeCon + CloudNativeCon', 170, 790, { size: 22, weight: 600, color: C.text })
      txt('会后演讲视频全部公开：看一线团队的生产经验', 170, 834, { size: 19, color: C.body })
    })
    // 台阶
    STEPS.forEach(([n, s], i) => {
      const a = E.out(P(t, 5.4 + i * .8, 5.9 + i * .8)); if (a <= 0) return
      const x = 980 + i * 160, top = 820 - (i + 1) * 92 + rise(a, 24), c = [C.blue, C.teal, C.amber, C.violet, COL][i]
      withA(a, () => {
        sq(x + 4, top, 152, 866 - top, c, 1, { fill: tint(c, .1 + i * .02), r: 12 })
        chip(String(i + 1), x + 80, top + 30, { size: 17, col: c, solid: true })
        txt(n, x + 80, top + 78, { size: 21, weight: 600, align: 'center', color: C.text })
        txt(s, x + 80, top + 108, { size: 16, align: 'center', color: C.body })
      })
    })
    // 攀登者
    const k = clamp((t - 5.6) / .8, 0, 4), ki = Math.floor(k), fr = E.inOut(k - ki)
    const pos = i => [980 + i * 160 + 80, 820 - (i + 1) * 92 - 34]
    if (t > 5.9) {
      const [x0, y0] = pos(ki), [x1, y1] = pos(Math.min(4, ki + 1))
      user(lerp(x0, x1, fr), lerp(y0, y1, fr) - Math.sin(fr * Math.PI) * 26, 12, C.text)
    }
    // 写出来
    const wa = E.out(P(t, 10.8, 11.3))
    withA(wa, () => {
      panel(980, 280, 460, 150, { r: 16, stroke: hexA(COL, .6), lw: 2 })
      txt('✎ 把自己的经验写出来', 1004, 326, { size: 22, weight: 600, color: COL })
      txt('排障过程 · 选型对比 · 压测数据', 1004, 370, { size: 19, color: C.body })
      txt('帮助别人，也梳理自己', 1004, 404, { size: 19, color: C.mute })
    })
  },
}

ANIM({
  id: 'next-steps',
  meta: { stage: 5, lesson: 6, of: 6, title: '认证考试与持续成长', summary: 'CKA / CKAD / CKS 备考、跟进社区与版本演进的方法。' },
  scenes: [
    lessonIntro({ tags: ['CKA / CKAD / CKS', 'dry-run', 'Release Notes', 'KEP', 'SIG'], vo: [[3.2, '学完只是起点：考认证，跟版本，进社区。']] }),
    certs, speed, release, kep, community,
    lessonOutro({
      points: ['三门认证 CKA / CKAD / CKS：都是实操', '考纲当清单：练速度，先切上下文', '约 4 个月一版：读 Release Notes，查废弃 API', '读 KEP、跟 SIG，把经验写出来'],
      vo: [[0.8, '小结：学完只是起点，持续学习才是关键。'], [5.6, '恭喜走完全程，祝你的集群一直健康。']],
    }),
  ],
})
})()
