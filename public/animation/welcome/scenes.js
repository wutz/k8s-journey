/* 第 0 阶段 · 第 1 课：学习路线与使用指南 */
(() => {
const COL = STAGES[0].color

// 场景 1：为什么要按路线学
const TERMS = [
  // [词, 散落 x, 散落 y, 路线序号]
  ['容器', 320, 380, 0], ['Service', 1020, 330, 3], ['CNI', 1150, 720, 4], ['Pod', 700, 440, 1],
  ['生产集群', 1640, 340, 7], ['kube-proxy', 1580, 740, 5], ['标签', 480, 650, 2], ['网络排障', 1400, 500, 6],
]
const RX = k => 250 + k * 204, RY = 540
const RY_CHIP = k => k % 2 ? RY + 80 : RY - 80
const DEPS = [[3, 1, 5.4], [6, 1, 5.9], [2, 7, 7.8], [5, 7, 8.3]] // from → to（TERMS 索引）
const SEG = [[0, 0, 0], [1, 3, 1], [4, 6, 3], [7, 7, 4]] // 路线分段：[起, 止, 阶段]
// 把连线两端收到标签边框外
const edge = (s, ux, uy) => { const hw = textW(s, 28) / 2 + 22, hh = 28; return Math.min(hw / Math.max(1e-3, Math.abs(ux)), hh / Math.max(1e-3, Math.abs(uy))) + 8 }
const shorten = (a, b, pa, pb) => { const [x1, y1] = pa, [x2, y2] = pb, L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, d1 = edge(TERMS[a][0], ux, uy), d2 = edge(TERMS[b][0], ux, uy); return [x1 + ux * d1, y1 + uy * d1, x2 - ux * d2, y2 - uy * d2] }
const route = {
  name: '为什么按路线学', dur: 16, mood: 1,
  vo: [[0.6, 'K8s 知识点多，而且彼此交织。', 'Kubernetes 知识点多，而且彼此交织。'],
    [5.2, '想懂 Service，得先懂 Pod 和标签。'],
    [10.4, '所以课程按依赖排成一条线，前课为后课铺路。']],
  cues: [[0.6, 'whoosh'], ...TERMS.map((_, i) => [1.0 + i * .22, 'pop']), ...DEPS.map(d => [d[2], 'zap']), [10.6, 'whoosh'], [12.2, 'tick'], [12.5, 'tick'], [12.8, 'tick'], [13.1, 'tick'], [13.6, 'chime']],
  draw(t, T) {
    heading('为什么要按路线学', 140, 210, t, .2, { eyebrow: 'WHY A ROADMAP', color: COL })
    const m = E.inOut(P(t, 10.6, 12)) // 散落 → 排成路线
    const pos = TERMS.map(([s, x, y, k], i) => {
      const fx = x + Math.sin(T * .8 + i * 1.7) * 10 * (1 - m), fy = y + Math.cos(T * .7 + i) * 8 * (1 - m)
      return [lerp(fx, RX(k), m), lerp(fy, RY_CHIP(k), m)]
    })
    withA(win(t, 1.8, 10.6, .5), () => txt('零散地看：每个词都眼熟，连起来却不会用', W / 2, 860, { size: 24, color: C.mute, align: 'center' }))
    // 依赖箭头
    withA(1 - P(t, 10.4, 10.9), () => DEPS.forEach(([a, b, t0]) => {
      const p = E.out(P(t, t0, t0 + .6)); if (p <= 0) return
      const [x1, y1, x2, y2] = shorten(a, b, pos[a], pos[b])
      curve(x1, y1, x2, y2, 24, p, C.amber, 2.5)
      if (p >= 1 && a === 3) withA(E.out(P(t, 6.4, 6.9)), () => chip('先修', (x1 + x2) / 2 - 10, (y1 + y2) / 2 - 36, { size: 16, font: SANS, col: C.amber }))
    }))
    // 路线轨道
    const ra = E.out(P(t, 11.2, 12.2))
    if (ra > 0) {
      SEG.forEach(([k0, k1, si], j) => {
        const col = STAGES[si].color, xa = RX(k0) - 70, xb = RX(k1) + 70
        const p = E.out(P(t, 11.2 + j * .25, 12 + j * .25)); if (p <= 0) return
        ctx.save(); ctx.fillStyle = tint(col, .18); rr(xa, RY - 9, (xb - xa) * p, 18, 9); ctx.fill(); ctx.restore()
        withA(E.out(P(t, 12.2 + j * .3, 12.7 + j * .3)), () => txt(`阶段 ${si} · ${STAGES[si].t1}`, (xa + xb) / 2, RY + 180, { size: 22, weight: 600, color: col, align: 'center' }))
      })
      TERMS.forEach(([, , , k]) => {
        withA(ra, () => { line(RX(k), RY, RX(k), RY_CHIP(k) + (k % 2 ? -22 : 22), hexA(COL, .4), 2); dot(RX(k), RY, 7, C.panel, 0); ctx.save(); ctx.strokeStyle = COL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(RX(k), RY, 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore() })
      })
      if (t > 12.4) { const p = ((t - 12.4) / 3.2) % 1; dot(lerp(RX(0), RX(7), E.inOut(p)), RY, 10, COL, 18) }
      withA(E.out(P(t, 13.6, 14.2)), () => txt('第一次学：按顺序走 · 有基础：跳到对应阶段', W / 2, 860, { size: 24, color: C.body, align: 'center' }))
    }
    TERMS.forEach(([s], i) => {
      const k = E.back(P(t, 1.0 + i * .22, 1.4 + i * .22)); if (k <= 0) return
      const hot = t > 5.2 && t < 10.6 && ((i === 3 || i === 6 || i === 1) || (t > 7.6 && (i === 2 || i === 5 || i === 7)))
      const tgt = i === 1 || i === 7
      const [x, y] = pos[i]
      withA(clamp(k), () => chip(s, x, y, { size: 28, col: m > .5 ? COL : hot ? (tgt ? C.amber : C.text) : C.body, font: SANS, solid: hot && tgt, pad: 20 }))
    })
  },
}

// 场景 2：六个阶段的路线图
const GOALS = [['理解容器原理', '跑起本地集群'], ['用 YAML 部署', 'Web 应用并暴露'], ['健康检查、存储', '调度、Helm'], ['看懂控制面', '网络、安全、扩展'], ['部署和运维', '高可用生产集群'], ['GPU / AI 训练', '多租户平台']]
const ST0 = [1.0, 1.9, 2.8, 6.0, 6.9, 7.8]
const roadmap = {
  name: '六个阶段', dur: 17, mood: 2,
  vo: [[0.6, '全程 6 个阶段：启程、入门、进阶，'],
    [5.6, '再到原理、生产、专家，一步步走进生产。'],
    [11.0, '阶段 0 到 3 本地就能跑，4、5 需要多台机器。', '阶段零到三本地就能跑，四和五需要多台机器。']],
  cues: [[0.4, 'whoosh'], ...ST0.map((s, i) => [s, 'ding' + i]), [11.2, 'tick'], [12.2, 'tick'], [13.2, 'chime']],
  draw(t, T) {
    heading('六个阶段的路线图', 140, 210, t, .2, { eyebrow: 'ROADMAP', color: COL })
    const cw = 250, gap = 22, x0 = 140, y0 = 290, ch = 380
    // 连接轨道
    partialLine(x0 + cw / 2, y0 + 70, x0 + 5 * (cw + gap) + cw / 2, y0 + 70, E.out(P(t, .8, 8.6)), C.hairD, 3, [4, 10])
    STAGES.forEach((S, i) => {
      const a = E.out(P(t, ST0[i], ST0[i] + .5)); if (a <= 0) return
      const x = x0 + i * (cw + gap), y = y0 + lerp(30, 0, a)
      const cur = (t < 5.6 ? i <= 2 : t < 11 ? i >= 3 : false)
      const dim = t >= 11 && t < 14 ? ((t < 12.2 ? i <= 3 : i >= 4) ? 1 : .5) : 1
      withA(a * dim, () => {
        panel(x, y, cw, ch, { r: 18, stroke: cur ? S.color : C.hair, lw: cur ? 2.5 : 1.5, fill: cur ? tint(S.color, .06) : C.panel })
        ctx.save(); ctx.fillStyle = tint(S.color, .16); ctx.beginPath(); ctx.arc(x + cw / 2, y + 70, 38, 0, Math.PI * 2); ctx.fill(); ctx.restore()
        txt(S.no, x + cw / 2, y + 84, { size: 38, weight: 700, font: MONO, color: S.color, align: 'center' })
        txt(S.t1, x + cw / 2, y + 162, { size: 36, weight: 600, align: 'center' })
        txt(S.lv, x + cw / 2, y + 196, { size: 16, font: MONO, color: S.color, align: 'center', track: 2 })
        line(x + 30, y + 222, x + cw - 30, y + 222, C.hair, 1)
        txt('学完能做到', x + 24, y + 258, { size: 17, color: C.mute })
        GOALS[i].forEach((g, k) => txt(g, x + 24, y + 296 + k * 34, { size: 22, color: C.text }))
      })
      if (t > ST0[i] && t < ST0[i] + 1) ring(x + cw / 2, y0 + 70, P(t, ST0[i], ST0[i] + 1), S.color, 90)
    })
    // 环境需求分组
    const g1 = E.out(P(t, 11.2, 11.8)), g2 = E.out(P(t, 12.2, 12.8))
    const by = y0 + ch + 60
    const bd = i => t >= 12.2 && t < 14 && i === 0 ? .5 : 1
    const bracket = (xa, xb, s, col, a) => withA(a * bd(col === COL ? 0 : 1), () => {
      line(xa, by - 20, xa, by, hexA(col, .7), 2.5); line(xb, by - 20, xb, by, hexA(col, .7), 2.5); line(xa, by, xb, by, hexA(col, .7), 2.5)
      chip(s, (xa + xb) / 2, by + 44, { size: 22, font: SANS, col, pad: 16 })
    })
    bracket(x0 + 10, x0 + 4 * (cw + gap) - gap - 10, '本机 kind 集群即可 · 8 GB 内存起步', COL, g1)
    bracket(x0 + 4 * (cw + gap) + 10, x0 + 6 * (cw + gap) - gap - 10, '多台 Linux 机器 · GPU 节点', C.amber, g2)
  },
}

// 场景 3：每课的固定结构 + 提示框
const SECS = [['为什么需要', C.blue], ['是什么', C.blue], ['怎么用', C.blue], ['生产注意事项', C.amber], ['动手练习', COL], ['自测', COL], ['参考资料', COL]]
const SEC_T = [1.0, 1.9, 2.8, 3.7, 6.0, 6.8, 7.6]
const BOXES = [['NOTE', '说明', '补充背景，跳过不影响主线', C.blue], ['TIP', '提示', '更省事的做法、常用技巧', C.green], ['WARNING', '注意', '容易踩坑，操作前读一遍', C.amber],
  ['DANGER', '危险', '可能丢数据或让集群不可用', C.red], ['LAB', '动手实验', '跟着敲命令的完整步骤', C.violet], ['PROD', '生产实践', '来自真实生产集群的经验', C.teal]]
const structure = {
  name: '每课结构', dur: 16, mood: 2,
  vo: [[0.6, '每课按为什么、是什么、怎么用来展开，'],
    [5.6, '结尾固定有动手练习、自测和参考资料。'],
    [10.8, '六种提示框，颜色和含义都是固定的。']],
  cues: [[0.4, 'whoosh'], ...SEC_T.map(s => [s, 'tick']), [10.8, 'whoosh'], ...BOXES.map((_, i) => [11.6 + i * .35, 'pop'])],
  draw(t, T) {
    heading('每一课的固定结构', 140, 210, t, .2, { eyebrow: 'LESSON ANATOMY', color: COL })
    const mv = E.inOut(P(t, 10.8, 11.8))
    const px = lerp(620, 140, mv), pw = 680, py = 270, ph = 600
    const pa = E.out(P(t, .5, 1))
    withA(pa, () => {
      panel(px, py, pw, ph, { r: 18 })
      ctx.save(); ctx.fillStyle = '#f6f6f7'; rr(px + 1, py + 1, pw - 2, 46, [17, 17, 0, 0]); ctx.fill(); ctx.restore()
      ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => dot(px + 26 + i * 20, py + 24, 6, c, 0))
      txt('/learn/pods', px + pw / 2, py + 30, { size: 16, font: MONO, color: C.mute, align: 'center' })
    })
    const cur = SEC_T.filter(s => t >= s).length - 1
    SECS.forEach(([s, col], i) => {
      const a = E.out(P(t, SEC_T[i], SEC_T[i] + .4)); if (a <= 0) return
      const y = py + 76 + i * 68 + (i >= 4 ? 22 : 0), on = i === cur && t < 10.8
      withA(a, () => {
        ctx.save(); ctx.fillStyle = on ? tint(col, .12) : 'rgba(0,0,0,0.025)'; rr(px + 24, y, pw - 48, 58, 10); ctx.fill(); ctx.restore()
        ctx.save(); ctx.fillStyle = col; rr(px + 24, y, 6, 58, 3); ctx.fill(); ctx.restore()
        txt(s, px + 50, y + 38, { size: 24, weight: 600, color: on ? col : C.text })
        const sx = px + 70 + textW(s, 24, { weight: 600 })
        for (let k = 0; k < 3; k++) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.07)'; rr(sx + k * 96, y + 24, 80 - k * 14, 10, 5); ctx.fill(); ctx.restore() }
                if (i >= 4) check(px + pw - 54, y + 29, 24, COL, P(t, SEC_T[i] + .2, SEC_T[i] + .6))
      })
    })
    withA(E.out(P(t, 5.8, 6.2)), () => { const y = py + 76 + 4 * 68 + 5; line(px + 24, y, px + pw - 24, y, C.hairD, 1.5, [6, 6]); chip('每课结尾', px + pw / 2, y, { size: 16, font: SANS, col: COL }) })
    // 主线 / 巩固 注解
    const side = (y1, y2, s1, s2, col, a) => withA(a * (1 - P(t, 10.4, 10.9)), () => {
      const x = px + pw + 40
      line(x, y1, x + 14, y1, hexA(col, .6), 2.5); line(x + 14, y1, x + 14, y2, hexA(col, .6), 2.5); line(x, y2, x + 14, y2, hexA(col, .6), 2.5)
      txt(s1, x + 44, (y1 + y2) / 2 - 6, { size: 28, weight: 600, color: col })
      txt(s2, x + 44, (y1 + y2) / 2 + 34, { size: 21, color: C.body })
    })
    side(py + 76, py + 76 + 3 * 68 + 58, '主线', '从问题出发，一路讲到生产', C.blue, E.out(P(t, 4.1, 4.7)))
    side(py + 76 + 4 * 68 + 22, py + 76 + 6 * 68 + 22 + 58, '巩固', '做一遍 · 测一遍 · 再深挖', COL, E.out(P(t, 8.0, 8.6)))
    // 提示框图例
    BOXES.forEach(([k, n, d, col], i) => {
      const a = E.out(P(t, 11.6 + i * .35, 12.1 + i * .35)); if (a <= 0) return
      const x = 900 + (i % 2) * 450, y = 290 + Math.floor(i / 2) * 190
      withA(a, () => {
        panel(x + lerp(30, 0, a), y, 420, 160, { r: 14, fill: tint(col, .07), stroke: hexA(col, .45) })
        ctx.save(); ctx.fillStyle = col; rr(x + lerp(30, 0, a), y, 7, 160, 3); ctx.fill(); ctx.restore()
        chip(k, x + 34 + lerp(30, 0, a), y + 44, { size: 18, col, solid: true, align: 'left' })
        txt(n, x + 34 + lerp(30, 0, a) + textW(k, 18, { font: MONO }) + 44, y + 52, { size: 26, weight: 600, color: col })
        txt(d, x + 34 + lerp(30, 0, a), y + 114, { size: 21, color: C.body })
      })
    })
  },
}

// 场景 4：建议节奏
const WX0 = 460, WX1 = 1720, WEEKS = 16, WX = w => WX0 + (WX1 - WX0) * w / WEEKS
const BARS = [['阶段 0～1', 0, 2, 2, '约 2 周', COL, 1.4], ['阶段 2～3', 2, 6, 6, '约 4 周', C.cyan, 5.8], ['阶段 4～5', 6, 10, 14, '4～8 周', C.amber, 8.2]]
const pace = {
  name: '建议节奏', dur: 16, mood: 2,
  vo: [[0.6, '每周 5 到 6 小时：阶段 0 到 1 约两周，', '每周五到六小时：阶段零到一，大约两周，'],
    [5.6, '阶段 2 到 3 约四周，4 到 5 要四到八周。', '阶段二到三约四周，四到五要四到八周。'],
    [10.8, '宁可慢一点，也要把动手练习做一遍。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.6, 'tick'], [6.0, 'tick'], [8.4, 'tick'], [11.4, 'tick'], [12.0, 'tick'], [12.6, 'tick'], [13.4, 'ok']],
  draw(t, T) {
    heading('建议的学习节奏', 140, 210, t, .2, { eyebrow: 'PACE', color: COL })
    chip('每周 5～6 小时', 1780, 196, { size: 22, font: SANS, col: COL, align: 'right', alpha: E.out(P(t, 1, 1.5)), pad: 16 })
    const ga = E.out(P(t, .6, 1.2))
    withA(ga, () => {
      for (let w = 0; w <= WEEKS; w += 2) {
        line(WX(w), 290, WX(w), 600, w ? 'rgba(0,0,0,0.05)' : C.hairD, w ? 1 : 2)
        txt(`${w}`, WX(w), 634, { size: 18, font: MONO, color: C.mute, align: 'center' })
      }
      txt('周', WX1 + 30, 634, { size: 18, color: C.mute })
    })
    BARS.forEach(([n, a, b, c, lab, col, t0], i) => {
      const y = 320 + i * 94, ra = E.out(P(t, .9 + i * .25, 1.4 + i * .25)); if (ra <= 0) return
      withA(ra, () => { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.03)'; rr(WX0, y, WX1 - WX0, 54, 12); ctx.fill(); ctx.restore() })
      withA(ra, () => txt(n, WX0 - 30, y + 36, { size: 26, weight: 600, align: 'right' }))
      const p = E.out(P(t, t0, t0 + 1.2)); if (p <= 0) return
      ctx.save(); ctx.fillStyle = tint(col, .25); ctx.strokeStyle = col; ctx.lineWidth = 2
      rr(WX(a), y, Math.max(24, (WX(b) - WX(a)) * p), 54, 12); ctx.fill(); ctx.stroke(); ctx.restore()
      if (c > b) { const q = E.out(P(t, t0 + .9, t0 + 1.9)); if (q > 0) { ctx.save(); ctx.strokeStyle = hexA(col, .8); ctx.lineWidth = 2; ctx.setLineDash([8, 7]); rr(WX(b), y, (WX(c) - WX(b)) * q, 54, 12); ctx.fillStyle = tint(col, .08); ctx.fill(); ctx.stroke(); ctx.restore() } }
      withA(E.out(P(t, t0 + .8, t0 + 1.2)), () => txt(lab, WX(c) + 18, y + 36, { size: 26, weight: 600, color: col }))
      if (i === 2) withA(E.out(P(t, t0 + 1.6, t0 + 2.2)), () => txt('视有没有实验机器', WX(b) + 14, y + 86, { size: 18, color: C.mute }))
    })
    // 动手练习清单
    const la = E.out(P(t, 10.8, 11.3))
    withA(la, () => {
      panel(140, 700, 1640, 150, { r: 18, stroke: hexA(COL, .45), fill: tint(COL, .04) })
      txt('每课结尾 · 动手练习', 176, 748, { size: 22, weight: 600, color: COL })
      ;['按步骤敲一遍命令', '改参数看变化', '故意搞坏再修好'].forEach((s, i) => {
        const x = 176 + i * 400, y = 806
        ctx.save(); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; rr(x, y - 22, 36, 36, 8); ctx.stroke(); ctx.restore()
        check(x + 18, y - 4, 24, COL, P(t, 11.4 + i * .6, 11.8 + i * .6))
        txt(s, x + 52, y + 5, { size: 24, color: C.text })
      })
      const done = t > 13.4
      chip(done ? '✓ 已完成' : '标记为已完成', 1740, 790, { size: 22, font: SANS, col: COL, solid: done, align: 'right', pad: 18 })
      withA(E.out(P(t, 13.6, 14)), () => txt('进度保存在浏览器本地', 1740, 842, { size: 17, color: C.mute, align: 'right' }))
    })
    if (t > 13.4) ring(1650, 790, P(t, 13.4, 14.3), COL, 120)
  },
}

// 场景 5：实验环境
const TERM = [
  { t: 10.8, cmd: "docker version --format '{{.Server.Version}}'" },
  { t: 12.6, out: '28.x.x', color: C.green },
  { t: 13.0, cmd: 'docker run --rm hello-world' },
  { t: 14.3, out: 'Hello from Docker!', color: C.green, sfx: 'ok' },
  { t: 14.5, out: 'This message shows that your installation', color: C.body },
  { t: 14.6, out: 'appears to be working correctly.', color: C.body },
]
const SW = [['Docker / Podman', '容器运行环境，kind 依赖它', C.blue], ['kind', '把节点跑成容器的本地集群', COL], ['kubectl', 'K8s 命令行客户端', C.violet], ['VS Code', '编辑 YAML · 装 YAML 插件', C.cyan]]
const lab = {
  name: '实验环境', dur: 16, mood: 3,
  vo: [[0.6, '一台 8 GB 以上内存的电脑，推荐 16 GB。'],
    [5.6, '装好 Docker 或 Podman，kind 靠它运行节点。'],
    [10.8, '跑一下 hello-world，确认容器环境可用。']],
  cues: [[0.4, 'whoosh'], [1.2, 'tick'], [2.6, 'tick'], [3.8, 'pop'], [4.1, 'pop'], [4.4, 'pop'], ...SW.map((_, i) => [5.8 + i * .5, 'pop']), ...typeCues(TERM, 30)],
  draw(t, T) {
    heading('准备实验环境', 140, 210, t, .2, { eyebrow: 'LAB SETUP', color: COL })
    // 硬件
    const ha = E.out(P(t, .6, 1.1))
    withA(ha, () => {
      panel(140, 270, 640, 600, { r: 18 })
      txt('硬件', 176, 322, { size: 26, weight: 600 })
      const mem = E.out(P(t, 1.2, 2.4))
      meter(176, 400, 568, 22, mem * 8 / 16, COL, { label: '内存', value: `${countUp(8, t, 1.2, 2.4)} GB 起步` })
      withA(E.out(P(t, 2.2, 2.8)), () => {
        ctx.save(); ctx.fillStyle = hexA(COL, .22); rr(176 + 284, 400, 284 * E.out(P(t, 2.2, 3)), 22, 11); ctx.fill(); ctx.restore()
        line(176 + 568, 390, 176 + 568, 432, C.green, 2.5)
        txt('推荐 16 GB', 744, 462, { size: 18, font: MONO, color: C.green, align: 'right' })
        txt('3 节点 kind 空载 ≈ 2～3 GB', 176, 462, { size: 18, color: C.mute })
      })
      meter(176, 540, 568, 22, E.out(P(t, 2.6, 3.4)) * .4, C.cyan, { label: '剩余磁盘', value: '≥ 20 GB' })
      txt('系统', 176, 630, { size: 20, color: C.body })
      ;[['macOS', 176], ['Linux', 316], ['Windows · WSL2', 446]].forEach(([s, x], i) => chip(s, x, 676, { size: 20, align: 'left', col: C.body, alpha: E.out(P(t, 3.8 + i * .3, 4.2 + i * .3)) }))
      withA(E.out(P(t, 4.6, 5)), () => wrap('macOS / Windows 上 Docker 跑在 Linux 虚拟机里，至少分给它 4 GB 内存、2 个 CPU', 176, 750, 568, { size: 20, color: C.amber, lh: 30 }))
    })
    // 软件
    SW.forEach(([n, d, col], i) => {
      const a = E.out(P(t, 5.8 + i * .5, 6.3 + i * .5)); if (a <= 0) return
      const x = 840 + (i % 2) * 480, y = 270 + Math.floor(i / 2) * 120
      const hot = i === 0 && t > 5.6 && t < 10.8
      withA(a, () => {
        panel(x, y + lerp(20, 0, a), 460, 100, { r: 16, stroke: hot ? col : hexA(col, .4), lw: hot ? 2.5 : 1.5, fill: hot ? tint(col, .06) : C.panel })
        chip(n, x + 24, y + 34 + lerp(20, 0, a), { size: 20, col, align: 'left', solid: hot })
        txt(d, x + 26, y + 80 + lerp(20, 0, a), { size: 20, color: C.body })
      })
    })
    terminal(840, 516, 940, 354, t, TERM, { size: 22, alpha: E.out(P(t, 10.4, 10.9)) })
  },
}

ANIM({
  id: 'welcome',
  meta: { stage: 0, lesson: 1, of: 4, title: '学习路线与使用指南', summary: '这套教程怎么学、每个阶段学到什么程度、需要准备什么。', next: '容器基础：从进程到镜像' },
  scenes: [
    lessonIntro({ tags: ['6 个阶段', '36 课', '动手实验', '自测', 'kind'], vo: [[3.2, '一条从零走到生产的 K8s 学习路线。', '一条从零走到生产的 Kubernetes 学习路线。']] }),
    route, roadmap, structure, pace, lab,
    lessonOutro({
      points: ['6 个阶段，按依赖顺序一路铺垫', '每课：为什么 → 是什么 → 怎么用 → 生产', '动手练习 + 自测，一个都别跳', '8 GB 内存 + Docker + kind 就能开工'],
      vo: [[0.8, '小结：按路线走，边学边动手。'], [5.6, '下一课，把容器拆开看个明白。']],
    }),
  ],
})
})()
