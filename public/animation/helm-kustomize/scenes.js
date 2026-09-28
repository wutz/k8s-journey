/* 第 2 阶段 · 第 7 课：用 Helm 与 Kustomize 管理应用 */
(() => {
const COL = STAGES[2].color
const HELM = C.blue, KUS = C.violet

// 小勾 / 小叉徽标
function mark(x, y, ok, a) {
  if (a <= 0) return
  withA(a, () => { ctx.save(); ctx.fillStyle = ok ? tint(C.green, .16) : tint(C.red, .14); ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ok ? check(x, y, 18, C.green, 1) : cross(x, y, 14, C.red, 1) })
}
// 文件卡片：rows 为字符串，或 {s, parts:[[文本,颜色]...], col, hi, ha}
function card(x, y, w, title, rows, o = {}) {
  const { a = 1, size = 18, lh = 36 } = o
  const h = 60 + rows.length * lh + 16
  withA(a, () => {
    panel(x, y, w, h, { r: 14, stroke: o.stroke || C.hair, lw: o.lw || 1.5, fill: o.fill || C.panel })
    txt(title, x + 24, y + 35, { size: 16, font: MONO, color: o.tc || C.mute })
    line(x, y + 54, x + w, y + 54, C.hair, 1)
    rows.forEach((r, i) => {
      const R = typeof r === 'string' ? { s: r } : r
      const top = y + 62 + i * lh, by = top + lh / 2 + size * .36
      if (R.hi && (R.ha ?? 1) > 0) { ctx.save(); ctx.fillStyle = hexA(R.hi, .13 * (R.ha ?? 1)); rr(x + 8, top + 2, w - 16, lh - 4, 8); ctx.fill(); ctx.restore() }
      if (R.parts) { let xx = x + 24; R.parts.forEach(([s, c]) => { txt(s, xx, by, { size, font: MONO, color: c || C.text }); xx += textW(s, size, { font: MONO }) }) }
      else txt(R.s, x + 24, by, { size, font: MONO, color: R.col || C.text })
    })
  })
  return h
}
const rowY = (y, i, lh = 36) => y + 62 + i * lh + lh / 2

// 场景 1：两种思路
const idea = {
  name: '两种思路', dur: 16, mood: 1,
  vo: [[0.6, 'Helm 用模板加参数，渲染出最终 YAML。'],
    [5.6, 'Kustomize 不写模板，给普通 YAML 打补丁。'],
    [10.8, '别人的软件用 Helm 装，自己的配置用 Kustomize 管。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.6, 'pop'], [2.6, 'zap'], [4.0, 'ok'], [5.8, 'pop'], [6.6, 'pop'], [7.6, 'zap'], [9.0, 'ok'], [11.0, 'tick'], [11.6, 'tick'], [13.2, 'chime']],
  draw(t) {
    heading('两种思路：模板渲染 vs 叠加补丁', 140, 210, t, .2, { eyebrow: 'HELM · KUSTOMIZE', color: COL })
    const helmOn = t < 5.6 || t >= 10.8, kusOn = t >= 5.6
    // 分隔线与栏标题
    withA(E.out(P(t, .6, 1.1)), () => {
      line(965, 290, 965, 870, C.hair, 2)
      chip('Helm · 模板渲染', 140, 288, { size: 22, align: 'left', font: SANS, col: HELM, solid: t < 5.6 })
    })
    chip('Kustomize · 叠加补丁', 1010, 288, { size: 22, align: 'left', font: SANS, col: KUS, solid: t >= 5.6 && t < 10.8, alpha: E.out(P(t, 5.6, 6.1)) })
    // —— Helm：模板 + values → YAML
    const fill = E.out(P(t, 3.3, 3.7))
    withA(helmOn ? 1 : .5, () => {
      card(140, 330, 420, 'templates/deployment.yaml', [
        { parts: [['replicas: ', C.blue], ['{{ .Values.replicas }}', C.amber]], hi: C.amber, ha: fill },
        { parts: [['image: nginx:', C.blue], ['{{ .Values.tag }}', C.amber]], hi: C.amber, ha: fill },
      ], { a: E.out(P(t, 1, 1.5)) })
      card(140, 530, 420, 'values.yaml', [
        { parts: [['replicas: ', C.blue], ['3', C.text]] },
        { parts: [['tag: ', C.blue], ['"1.27"', C.text]] },
      ], { a: E.out(P(t, 1.6, 2.1)) })
      // 参数飞入占位符
      ;[0, 1].forEach(i => travel(250 + i * 10, rowY(530, i), 300 + i * 40, rowY(330, i), E.inOut(P(t, 2.6 + i * .2, 3.3 + i * .2)), C.amber, 7))
      const r = E.out(P(t, 3.8, 4.3))
      curve(564, rowY(330, 0) + 18, 656, 470, 0, r, hexA(HELM, .6), 2.2)
      curve(564, rowY(530, 0) + 18, 656, 520, 0, r, hexA(HELM, .6), 2.2)
      card(660, 420, 260, '渲染结果', [
        { parts: [['replicas: ', C.blue], ['3', C.text]], hi: C.green },
        { parts: [['image: ', C.blue], ['nginx:1.27', C.text]], hi: C.green },
      ], { a: r, stroke: hexA(C.green, .5) })
      chip('helm template', 790, 612, { size: 16, col: C.mute, alpha: E.out(P(t, 4.4, 4.9)) })
    })
    // —— Kustomize：base + patch → YAML
    const kp = E.out(P(t, 7.6, 8.2))
    withA(kusOn ? 1 : 0, () => {
      card(1010, 330, 420, 'base/deployment.yaml', [
        { parts: [['replicas: ', C.blue], ['1', C.text]], hi: C.red, ha: kp * .8 },
        { parts: [['image: ', C.blue], ['nginx:1.26', C.text]], hi: C.red, ha: kp * .8 },
      ], { a: E.out(P(t, 5.8, 6.3)) })
      card(1010, 530, 420, 'overlays/prod/kustomization.yaml', [
        { parts: [['replicas: ', C.blue], ['[{name: web, count: 4}]', KUS]] },
        { parts: [['images: ', C.blue], ['[{newTag: "1.27.3"}]', KUS]] },
      ], { a: E.out(P(t, 6.6, 7.1)), stroke: hexA(KUS, .5) })
      withA(E.out(P(t, 6.8, 7.2)), () => txt('普通 YAML，没有模板语法', 1220, 510, { size: 17, color: C.mute, align: 'center' }))
      const r = E.out(P(t, 8.4, 8.9))
      curve(1434, rowY(330, 0) + 18, 1516, 470, 0, kp, hexA(KUS, .6), 2.2)
      curve(1434, rowY(530, 0) + 18, 1516, 520, 0, kp, hexA(KUS, .6), 2.2)
      card(1520, 420, 260, '合并结果', [
        { parts: [['replicas: ', C.blue], ['4', C.text]], hi: C.green },
        { parts: [['image: ', C.blue], ['…:1.27.3', C.text]], hi: C.green },
      ], { a: r, stroke: hexA(C.green, .5) })
      chip('kubectl apply -k', 1650, 612, { size: 16, col: C.mute, alpha: E.out(P(t, 9, 9.5)) })
    })
    // —— 适用场景
    ;[[140, 780, HELM, '别人写好的软件 → Helm', 'Chart 打包分发 · Release 历史 · 可回滚', 11], [1010, 770, KUS, '自己维护的配置 → Kustomize', '内置于 kubectl · 无状态 · 不引入模板', 11.6]].forEach(([x, w, c, s1, s2, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 720 + lerp(20, 0, a), w, 140, { r: 18, stroke: hexA(c, .5), lw: 2, fill: hexA(c, .04) })
        txt(s1, x + 32, 776 + lerp(20, 0, a), { size: 28, weight: 600, color: c })
        txt(s2, x + 32, 824 + lerp(20, 0, a), { size: 20, color: C.body })
      })
    })
    const k = E.back(P(t, 13.2, 13.7))
    if (k > 0) chip('实践中经常配合使用', 965, 720, { size: 18, font: SANS, col: COL, solid: true, alpha: clamp(k) })
  },
}

// 场景 2：Chart、Release 与 Revision
const HL = [
  { t: 1.4, cmd: 'helm install podinfo podinfo/podinfo --version 6.15.0' },
  { t: 3.4, out: 'STATUS: deployed   REVISION: 1', color: C.green },
  { t: 5.6, cmd: 'helm upgrade podinfo podinfo/podinfo -f values.yaml' },
  { t: 7.6, out: 'Release "podinfo" has been upgraded   REVISION: 2', color: C.green },
  { t: 10.0, cmd: 'helm rollback podinfo 1' },
  { t: 11.2, out: 'Rollback was a success!   REVISION: 3', color: C.green },
]
const REV = [[1120, 'install', 3.4, HELM], [1370, 'upgrade', 7.6, C.violet], [1620, 'rollback → 1', 11.2, HELM]]
const release = {
  name: 'Chart 与 Release', dur: 16, mood: 2,
  vo: [[0.6, 'Chart 是安装包，装进集群就是一个 Release。'],
    [5.6, '每次升级产生一个新修订，记录在 Secret 里。'],
    [10.6, '回滚到修订 1，会生成新的修订 3。']],
  cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.2, 'pop'], [1.6, 'pop'], ...typeCues(HL, 30), [2.4, 'zap'], [3.4, 'ok'], [7.6, 'ok'], [11.2, 'ok'], [12.6, 'pop'], [13.4, 'chime']],
  draw(t) {
    heading('Chart、Release 与 Revision', 140, 210, t, .2, { eyebrow: 'HELM', color: COL })
    // 仓库
    box(290, 395, 300, 150, 'Repository', 'HTTP · oci://', HELM, { alpha: E.out(P(t, .9, 1.4)), size: 28 })
    // Chart
    const ca = E.out(P(t, 1.2, 1.7))
    withA(ca, () => {
      panel(540, 300, 340, 190, { r: 16, stroke: hexA(HELM, .45) })
      chip('Chart · podinfo 6.15.0', 564, 336, { size: 18, align: 'left', col: HELM })
      ;[['Chart.yaml', '元数据'], ['values.yaml', '默认值'], ['templates/', '模板']].forEach(([f, d], i) => {
        txt(f, 568, 392 + i * 36, { size: 19, font: MONO, color: C.text })
        txt(d, 856, 392 + i * 36, { size: 18, color: C.mute, align: 'right' })
      })
    })
    arrow(444, 395, 532, 395, ca, hexA(C.text, .3), 2.5)
    // Release
    const ra = E.out(P(t, 1.6, 2.1))
    arrow(884, 395, 972, 395, ra, hexA(C.text, .3), 2.5)
    travelPath([[290, 395], [710, 395], [1120, 420]], P(t, 2.4, 3.4), HELM, 8)
    const cur = t >= 11.2 ? 2 : t >= 7.6 ? 1 : t >= 3.4 ? 0 : -1
    withA(ra, () => {
      panel(980, 300, 800, 190, { r: 16, stroke: hexA(COL, .5), lw: 2 })
      txt('Release · podinfo', 1004, 342, { size: 22, weight: 600 })
      chip('namespace: demo', 1756, 336, { size: 16, align: 'right', col: C.mute })
      line(1120, 420, 1620, 420, C.hair, 3)
      REV.forEach(([x, lbl, t0, c], i) => {
        const a = E.back(P(t, t0, t0 + .45)); if (a <= 0) return
        const on = cur === i
        withA(clamp(a), () => {
          ctx.save(); ctx.fillStyle = on ? c : tint(c, .14); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, 420, 28 * clamp(a, 0, 1.2), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
          txt(String(i + 1), x, 430, { size: 26, weight: 700, font: MONO, color: on ? '#fff' : c, align: 'center' })
          txt(lbl, x, 474, { size: 18, font: MONO, color: on ? C.text : C.mute, align: 'center' })
        })
        if (on) ring(x, 420, P(t, t0, t0 + .9), c, 70)
      })
      // 回滚 = 修订 1 的内容
      const rb = E.out(P(t, 11.4, 12))
      curve(1140, 394, 1600, 394, -44, rb, hexA(HELM, .55), 2.2, { dash: [6, 6] })
    })
    // 终端
    terminal(140, 540, 1000, 330, t, HL, { size: 19, alpha: E.out(P(t, 1, 1.5)) })
    // 右下：修订保存在哪 / 本地渲染
    const s1 = E.out(P(t, 8.2, 8.7))
    withA(s1, () => {
      panel(1180, 540 + lerp(20, 0, s1), 600, 150, { r: 16 })
      txt('修订历史存在 Release 命名空间的 Secret', 1208, 586 + lerp(20, 0, s1), { size: 20, color: C.text, weight: 600 })
      chip(`sh.helm.release.v1.podinfo.v${cur >= 2 ? 3 : 2}`, 1208, 644 + lerp(20, 0, s1), { size: 18, align: 'left', col: COL })
    })
    const s2 = E.out(P(t, 12.6, 13.1))
    withA(s2, () => {
      panel(1180, 720 + lerp(20, 0, s2), 600, 150, { r: 16 })
      txt('helm history podinfo', 1208, 766 + lerp(20, 0, s2), { size: 20, font: MONO, color: C.text })
      txt('1 superseded · 2 superseded · 3 deployed', 1208, 812 + lerp(20, 0, s2), { size: 18, font: MONO, color: C.body })
      txt('始终用 --version 固定 Chart 版本', 1208, 848 + lerp(20, 0, s2), { size: 17, color: C.amber })
    })
  },
}

// 场景 3：values 合并优先级
const LAYER = [
  ['Chart 默认 values.yaml', 'replicaCount: 1  message: hello', C.mute, 1.0],
  ['-f values.yaml', 'replicaCount: 2  message: 问候', HELM, 2.0],
  ['-f values-prod.yaml', 'replicaCount: 3', C.violet, 3.0],
  ['--set replicaCount=5', '命令行临时覆盖', C.amber, 4.0],
]
const layY = i => 750 - i * 120
const values = {
  name: 'values 优先级', dur: 16, mood: 3,
  vo: [[0.6, '合并顺序：默认值、-f 文件，最后是 --set。', '合并顺序：默认值，f 参数文件，最后 set 参数。'],
    [5.8, '后面的覆盖前面的，--set 优先级最高。', '后面的覆盖前面的，set 参数优先级最高。'],
    [10.6, 'upgrade 不保留上次的 --set，值会被还原。', 'upgrade 不会保留上次的 set 参数，值会被还原。']],
  cues: [[0.4, 'whoosh'], ...LAYER.map(l => [l[3] + .3, 'thud']), [6.0, 'tick'], [7.4, 'tick'], [10.8, 'key'], [11.6, 'poof'], [12.0, 'error'], [13.0, 'alarmSoft']],
  draw(t) {
    heading('values 的合并优先级', 140, 210, t, .2, { eyebrow: 'VALUES', color: COL })
    const drop = t >= 11.6, gone = E.out(P(t, 11.6, 12.1))
    // 优先级轴
    withA(E.out(P(t, .6, 1)), () => {
      arrow(160, 830, 160, 300, 1, hexA(C.text, .25), 2.5)
      txt('低', 160, 862, { size: 18, color: C.mute, align: 'center' })
      txt('高', 196, 312, { size: 18, color: C.mute, align: 'center' })
    })
    LAYER.forEach(([f, s, c, t0], i) => {
      const a = E.out(P(t, t0, t0 + .45)); if (a <= 0) return
      const y = layY(i) - lerp(60, 0, a), top = i === 3 ? 1 - gone : 1
      const win_ = i === 3 && t >= 5.8 && !drop
      withA(a * top, () => {
        panel(210, y, 700, 96, { r: 16, stroke: win_ ? c : hexA(c, .45), lw: win_ ? 2.5 : 1.5, fill: i === 3 ? hexA(c, .06) : C.panel })
        txt(f, 238, y + 58, { size: 22, font: MONO, weight: 600, color: i === 0 ? C.body : c })
        txt(s, 886, y + 57, { size: 18, font: i === 3 ? SANS : MONO, color: C.body, align: 'right' })
      })
      if (i === 3 && drop) {
        poof(560, layY(3) + 48, P(t, 11.6, 12.4), C.amber)
        const g = E.out(P(t, 12.0, 12.5)), gy = layY(3)
        withA(g, () => {
          panel(210, gy, 700, 96, { r: 16, stroke: hexA(C.red, .5), lw: 1.8, dash: [8, 7], fill: hexA(C.red, .03), shadow: false })
          txt(f, 238, gy + 58, { size: 22, font: MONO, weight: 600, color: C.mute })
          line(234, gy + 50, 238 + textW(f, 22, { font: MONO, weight: 600 }) + 4, gy + 50, C.red, 2.5)
          txt('本次 upgrade 没再传入', 886, gy + 57, { size: 18, color: C.red, align: 'right' })
        })
      }
    })
    chip('只写生产环境的差异', 896, layY(2) - 4, { size: 16, font: SANS, col: C.violet, align: 'right', alpha: E.out(P(t, 7.4, 7.9)) })
    // 最终生效的值
    const eff = t < 2.3 ? 1 : t < 3.3 ? 2 : t < 4.3 ? 3 : drop && t >= 12 ? 3 : 5
    const src = eff === 5 ? '--set' : eff === 3 ? 'values-prod.yaml' : eff === 2 ? 'values.yaml' : '默认值'
    const ea = E.out(P(t, 1.2, 1.7))
    const bad = t >= 12
    withA(ea, () => {
      panel(1000, 300, 780, 290, { r: 18, stroke: bad ? hexA(C.red, .6) : hexA(COL, .5), lw: 2 })
      txt('最终生效', 1028, 344, { size: 20, color: C.mute })
      txt('replicaCount', 1028, 440, { size: 26, font: MONO, color: C.blue })
      txt(String(eff), 1470, 452, { size: 76, weight: 700, font: MONO, color: bad ? C.red : C.text, align: 'center' })
      chip('← ' + src, 1756, 430, { size: 16, align: 'right', col: bad ? C.red : eff === 5 ? C.amber : eff === 3 ? C.violet : C.mute })
      line(1020, 488, 1760, 488, C.hair, 1)
      const m = t < 2.3 ? 'hello' : '问候'
      txt('message', 1028, 546, { size: 26, font: MONO, color: C.blue })
      txt(m, 1470, 550, { size: 32, weight: 600, color: C.text, align: 'center' })
      chip('← ' + (t < 2.3 ? '默认值' : 'values.yaml'), 1756, 538, { size: 16, align: 'right', col: t < 2.3 ? C.mute : HELM })
    })
    ring(1470, 430, P(t, 4.3, 5.1), C.amber, 110)
    ring(1470, 430, P(t, 12, 12.8), C.red, 110)
    // upgrade 没带 --set
    const ua = E.out(P(t, 10.6, 11.1))
    withA(ua, () => {
      panel(1000, 630, 780, 72, { r: 14, fill: '#ffffff' })
      txt('❯', 1024, 674, { size: 18, font: MONO, color: C.blue })
      txt('helm upgrade … -f values.yaml -f values-prod.yaml', 1052, 674, { size: 18, font: MONO, color: C.text })
    })
    const wa = E.out(P(t, 12.8, 13.3))
    withA(wa, () => {
      panel(1000, 730 + lerp(20, 0, wa), 780, 140, { r: 16, stroke: hexA(C.red, .5), fill: hexA(C.red, .04) })
      txt('上次 --set 的 5 被还原成 3', 1028, 782 + lerp(20, 0, wa), { size: 26, weight: 600, color: C.red })
      txt('正式配置写进 values 文件，纳入 Git 管理', 1028, 830 + lerp(20, 0, wa), { size: 20, color: C.body })
    })
  },
}

// 场景 4：base 与 overlay
const TREE = [
  ['myapp/', 0, C.text], ['├─ base/', 0, C.text], ['│  ├─ kustomization.yaml', 1, C.body], ['│  ├─ deployment.yaml', 1, C.body], ['│  └─ service.yaml', 1, C.body],
  ['└─ overlays/', 0, C.text], ['   ├─ dev/kustomization.yaml', 2, C.body], ['   └─ prod/', 3, C.body], ['      ├─ kustomization.yaml', 3, C.body], ['      └─ patch-resources.yaml', 3, C.body],
]
const HASH = ['web-config-5t8k2h9m4c', 'web-config-7f2m9c4b6d']
const overlay = {
  name: 'base 与 overlay', dur: 16, mood: 2,
  vo: [[0.6, 'base 放各环境共用的 YAML，overlay 只写差异。'],
    [5.6, 'prod 改镜像标签和副本数，再打资源补丁。'],
    [10.6, '配置一变，名字里的哈希就变，Pod 自动滚动更新。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [2.0, 'pop'], [5.8, 'zap'], [7.4, 'zap'], [8.4, 'ok'], [10.8, 'pop'], [12.0, 'key'], [12.6, 'tick'], [13.4, 'whoosh'], [14.6, 'chime']],
  draw(t) {
    heading('Kustomize：base 与 overlay', 140, 210, t, .2, { eyebrow: 'KUSTOMIZE', color: COL })
    const grp = t < 5.6 ? 1 : t < 7.2 ? 2 : t < 10.6 ? 3 : -1
    // 目录树
    const ta = E.out(P(t, .6, 1.1))
    withA(ta, () => {
      panel(140, 280, 540, 470, { r: 18 })
      TREE.forEach(([s, g, c], i) => {
        const y = 330 + i * 40, on = g === grp || (grp === 1 && i === 1) || (grp === 3 && i === 7)
        if (on) { ctx.save(); ctx.fillStyle = hexA(grp === 1 ? C.blue : KUS, .1); rr(152, y - 26, 516, 36, 8); ctx.fill(); ctx.restore() }
        txt(s, 170, y, { size: 19, font: MONO, color: on ? C.text : c, alpha: E.out(P(t, .8 + i * .08, 1.1 + i * .08)) })
      })
    })
    // base
    const ba = E.out(P(t, 1.0, 1.5))
    card(760, 380, 400, 'base · Deployment', ['name: web', 'replicas: 1', 'image: nginx:1.27', 'cpu: 100m'], { a: ba, size: 19, stroke: hexA(C.blue, .45) })
    // 两个 overlay 输出
    const da = E.out(P(t, 5.8, 6.3)), pa = E.out(P(t, 7.4, 7.9))
    curve(1164, 450, 1276, 372, -20, da, hexA(KUS, .6), 2.2)
    chip('dev', 1210, 384, { size: 16, col: KUS, alpha: da })
    card(1280, 280, 500, 'overlays/dev 输出', [
      { s: 'name: dev-web', hi: KUS }, 'replicas: 1', 'image: nginx:1.27'], { a: da, size: 19 })
    curve(1164, 560, 1276, 640, 20, pa, hexA(KUS, .6), 2.2)
    chip('prod', 1210, 632, { size: 16, col: KUS, alpha: pa })
    const ph = E.out(P(t, 8.2, 8.7))
    card(1280, 520, 500, 'overlays/prod 输出', [
      { s: 'namespace: myapp-prod', hi: KUS, ha: ph }, { s: 'replicas: 4', hi: KUS, ha: ph }, { s: 'image: nginx:1.27.3', hi: KUS, ha: ph }, { s: 'cpu: 200m', hi: KUS, ha: ph }], { a: pa, size: 19 })
    ;[['namespace', 0], ['replicas', 1], ['images', 2], ['patches', 3]].forEach(([s, i]) => chip(s, 1756, rowY(520, i), { size: 15, align: 'right', col: KUS, alpha: E.out(P(t, 8.4 + i * .2, 8.8 + i * .2)) }))
    // configMapGenerator：哈希后缀触发滚动更新
    const ga = E.out(P(t, 10.6, 11.1))
    if (ga > 0) {
      const chg = E.out(P(t, 12.0, 12.4)), roll = P(t, 13.4, 14.6)
      withA(ga, () => {
        panel(140, 776, 1640, 104, { r: 18, stroke: hexA(COL, .5), fill: hexA(COL, .03) })
        txt('configMapGenerator', 170, 836, { size: 20, font: MONO, weight: 600, color: COL })
        chip(chg > .5 ? 'LOG_LEVEL=debug' : 'LOG_LEVEL=warn', 500, 828, { size: 18, col: chg > .5 ? C.amber : C.body })
        arrow(606, 828, 676, 828, 1, hexA(C.text, .3), 2)
        chip(chg > .5 ? HASH[1] : HASH[0], 690, 828, { size: 20, align: 'left', col: chg > .5 ? C.amber : COL, solid: t > 12 && t < 12.9 })
        arrow(972, 828, 1042, 828, E.out(P(t, 12.6, 13.1)), hexA(C.text, .3), 2)
        withA(E.out(P(t, 12.6, 13.1)), () => txt('Deployment 引用自动改名 → Pod 模板变化', 1056, 836, { size: 20, color: C.body }))
      })
      ;[0, 1].forEach(k => {
        const x = 1680 + k * 60, old = 1 - E.out(P(roll, k * .35, k * .35 + .4)), nw = E.out(P(roll, k * .35 + .2, k * .35 + .6))
        pod(x, 828, 46, { state: 'run', alpha: ga * old * (1 - nw) + 0, scale: 1 })
        if (nw > 0) pod(x, 828, 46, { state: C.amber, alpha: nw, scale: lerp(.6, 1, nw) })
      })
    }
  },
}

// 场景 5：Helmwave 编排
const HW = [
  'lifecycle:',
  '  pre_up: [kubectl apply -k gateway-api]',
  'releases:',
  '  - name: kgateway-crds',
  '    chart: {name: oci://…/kgateway-crds, version: v2.1.1}',
  '  - name: kgateway',
  '    chart: {name: oci://…/kgateway, version: v2.1.1}',
  '    values: [values.yml]',
  '    depends_on: [kgateway-crds]',
]
const RUN = [
  { t: 2.6, cmd: 'helmwave up --build' },
  { t: 4.0, out: '✔ pre_up   kubectl apply -k gateway-api', color: KUS },
  { t: 5.8, out: '✔ release  kgateway-crds   deployed', color: HELM },
  { t: 8.0, out: '✔ release  kgateway        deployed', color: HELM },
  { t: 9.4, cmd: 'kubectl apply -k .' },
]
const STEP = [
  ['pre_up 钩子', 'Gateway API CRD（远程引用，ref 固定版本）', 'Kustomize', KUS, 3.4, 4.0, [1]],
  ['kgateway-crds', 'CRD Release · OCI Chart v2.1.1', 'Helm', HELM, 5.0, 5.8, [3, 4]],
  ['kgateway', '控制器 Release · values.yml 只写差异', 'Helm', HELM, 7.0, 8.0, [5, 6, 7, 8]],
  ['附加资源', 'Chart 之外的 CR，就绪后再 apply', 'Kustomize', KUS, 9.4, 10.2, []],
]
const helmwave = {
  name: 'Helmwave 编排', dur: 16, mood: 4,
  vo: [[0.6, 'Helmwave 把 Release 写成声明文件。'],
    [5.2, '先装 CRD，depends_on 保证控制器后装。', '先装 CRD，depends on 保证控制器在它之后安装。'],
    [10.8, 'Helm 装软件，Kustomize 补资源，Helmwave 定顺序。']],
  cues: [[0.4, 'whoosh'], ...typeCues(RUN, 30), ...STEP.map(s => [s[5], 'ok']), [7.0, 'zap'], [10.8, 'pop'], [11.4, 'pop'], [12.0, 'pop'], [13.2, 'chime']],
  draw(t) {
    heading('Helmwave：把部署步骤写成声明', 140, 210, t, .2, { eyebrow: 'HELMWAVE', color: COL })
    let cur = -1; STEP.forEach((s, i) => { if (t >= s[4]) cur = i })
    const hi = cur >= 0 && t < 10.8 ? STEP[cur][6] : []
    code(140, 270, 780, HW, t, .5, { title: 'network/kgateway/helmwave.yml', size: 18, step: .07, hi, hiColor: cur >= 0 ? STEP[cur][3] : COL })
    terminal(140, 640, 780, 240, t, RUN, { size: 18, alpha: E.out(P(t, 2.2, 2.7)) })
    // 执行流水线
    const SX = 1060, SW = 700
    STEP.forEach(([n, d, tool, c, t0, t1], i) => {
      const a = E.out(P(t, 1.0 + i * .25, 1.5 + i * .25)); if (a <= 0) return
      const y = 300 + i * 135, on = cur === i && t < 10.8, done = t >= t1
      const role = t >= 10.8 ? (tool === 'Helm' ? E.out(P(t, 11.4, 11.8)) : E.out(P(t, 12.0, 12.4))) : 0
      withA(a * (cur < 0 || i <= cur || t >= 10.8 ? 1 : .5), () => {
        panel(SX + lerp(30, 0, a), y, SW, 105, { r: 16, stroke: on || role > 0 ? c : C.hair, lw: on || role > 0 ? 2.5 : 1.5, fill: on ? hexA(c, .06) : role > 0 ? hexA(c, .05 * role) : C.panel })
        ctx.save(); ctx.fillStyle = done ? c : tint(c, .14); ctx.beginPath(); ctx.arc(SX + 50, y + 52, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore()
        if (done) check(SX + 50, y + 52, 22, '#ffffff', P(t, t1, t1 + .3))
        else txt(String(i + 1), SX + 50, y + 61, { size: 22, weight: 700, font: MONO, color: c, align: 'center' })
        txt(n, SX + 92, y + 46, { size: 24, weight: 600, font: MONO, color: C.text })
        txt(d, SX + 92, y + 82, { size: 18, color: C.body })
        chip(tool, SX + SW - 24, y + 36, { size: 16, align: 'right', col: c, solid: role > .5 })
      })
      if (i < 3) arrow(SX + 50, y + 108, SX + 50, y + 132, a, hexA(C.text, .25), 2)
      if (on) ring(SX + 50, y + 52, P(t, t0, t0 + .9), c, 60)
    })
    chip('depends_on', SX + 80, 300 + 2 * 135 - 15, { size: 15, align: 'left', col: C.amber, alpha: E.out(P(t, 7.0, 7.4)) * (1 - E.out(P(t, 10.6, 11))) })
    // 分工总结
    const fa = E.out(P(t, 13.0, 13.5))
    withA(fa, () => {
      panel(1036, 282, 748, 580, { r: 22, stroke: hexA(COL, .7), lw: 2, dash: [10, 8], fill: 'rgba(0,0,0,0)', shadow: false })
      chip('Helmwave：顺序 + 版本，一条命令复现', 1410, 282, { size: 18, font: SANS, col: COL, solid: true })
    })
  },
}

ANIM({
  id: 'helm-kustomize',
  meta: { stage: 2, lesson: 7, of: 7, title: '用 Helm 与 Kustomize 管理应用', summary: 'Chart、values、release；Kustomize 的 base/overlay；Helmwave 组合编排。', next: '控制平面深入：一个 Pod 的诞生' },
  scenes: [
    lessonIntro({ tags: ['Helm', 'Chart', 'values', 'Kustomize', 'Helmwave'], vo: [[3.2, 'Helm 与 Kustomize：管理应用的两种思路。']] }),
    idea, release, values, overlay, helmwave,
    lessonOutro({
      points: ['Helm：模板 + values 渲染，Release 可升级回滚', 'values 优先级：默认值 < -f 文件 < --set', 'Kustomize：base 共用，overlay 只写差异', 'Helmwave 固定顺序与版本，一条命令复现'],
      vo: [[0.8, '小结：装软件用 Helm，管配置用 Kustomize。'], [5.4, '下一课，看一个 Pod 的诞生。']],
    }),
  ],
})
})()
