/* 第 3 阶段 · 第 4 课：工作负载安全加固 */
(() => {
const COL = STAGES[3].color

// 命名空间虚线框
const nsBox = (x, y, w, h, label, col, a) => withA(a, () => {
  panel(x, y, w, h, { r: 22, fill: tint(col, .035), stroke: hexA(col, .5), dash: [12, 9], lw: 2, shadow: false })
  chip(label, x + 24, y, { size: 18, col, align: 'left' })
})
// 二次曲线上的点 / 沿曲线流动的点
function qp(x1, y1, x2, y2, bend, u) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1
  const cx = mx - dy / L * bend, cy = my + dx / L * bend
  return [(1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2]
}
function qflow(x1, y1, x2, y2, bend, t, color, count = 4, speed = .7) {
  for (let i = 0; i < count; i++) { const p = ((t * speed + i / count) % 1 + 1) % 1; const [x, y] = qp(x1, y1, x2, y2, bend, p); withA(Math.sin(p * Math.PI), () => dot(x, y, 5, color, 8)) }
}

// 场景 1：securityContext
const SC_ROWS = ['# Pod 级', 'securityContext:', '  runAsNonRoot: true', '  runAsUser: 101', '  seccompProfile: { type: RuntimeDefault }',
  '# 容器级', 'securityContext:', '  allowPrivilegeEscalation: false', '  readOnlyRootFilesystem: true', '  capabilities: { drop: ["ALL"] }']
const SC_TERM = [
  { t: 6.4, cmd: 'kubectl exec deploy/hardened-web -- id' },
  { t: 7.6, out: 'uid=101(nginx) gid=101(nginx) groups=101(nginx)', color: C.green },
  { t: 10.9, cmd: 'kubectl exec deploy/hardened-web -- touch /etc/hack' },
  { t: 12.4, out: 'touch: /etc/hack: Read-only file system', color: C.red, sfx: 'lock' },
  { t: 12.9, cmd: 'kubectl exec deploy/hardened-web -- grep CapEff /proc/1/status' },
  { t: 14.6, out: 'CapEff:  0000000000000000', color: COL, sfx: 'ok' },
]
const SC_FLIP = [['运行用户', 'root · UID 0', 'UID 101', 7.6], ['提权', 'setuid 可提权', 'no_new_privs', 8.6], ['系统调用', '不过滤', 'seccomp 过滤', 9.6],
  ['根文件系统', '可写', '只读', 12.4], ['Capabilities', '默认能力集', 'drop ALL', 14.6]]
const secCtx = {
  name: 'securityContext', dur: 16, mood: 2,
  vo: [[0.6, '容器里的 root，就是宿主机的 UID 0。'],
    [5.4, 'securityContext 让它以非 root 运行、禁止提权。', 'security context 让它以非 root 运行、禁止提权。'],
    [10.6, '根文件系统只读，Linux 能力全部去掉。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [2.2, 'alarmSoft'], ...typeCues(SC_TERM, 40), ...SC_FLIP.map(f => [f[3], 'tick'])],
  draw(t, T) {
    heading('securityContext：收紧容器权限', 140, 210, t, .2, { eyebrow: 'SECURITY CONTEXT', color: COL })
    const hi = t < 5.4 ? [] : t < 8.6 ? [2, 3] : t < 9.6 ? [7] : t < 10.6 ? [4] : t < 13.4 ? [8] : [9]
    code(140, 280, 720, SC_ROWS, t, 1.0, { title: 'hardened-web.yaml · 节选', size: 22, hi, hiColor: COL, alpha: E.out(P(t, .8, 1.3)) })
    withA(E.out(P(t, 12.6, 13.2)), () => txt('需要写的目录（/tmp）用 emptyDir 挂载', 150, 780, { size: 20, color: C.mute }))
    // 容器与宿主机内核
    const flips = SC_FLIP.filter(f => t >= f[3]).length
    withA(E.out(P(t, 1.2, 1.8)), () => {
      panel(940, 280, 280, 270, { r: 16 })
      txt('nginx 容器', 1080, 318, { size: 20, font: MONO, align: 'center', color: C.body })
      if (flips) withA(E.out(P(t, 7.6, 8.2)), () => shield(1080, 400, 56 + flips * 4, C.green, .08 + flips * .03))
      cube(1080, 410, 38, flips ? C.green : C.red)
      const safe = t >= 7.6
      chip(safe ? 'UID 101' : 'UID 0 = root', 1080, 470, { size: 18, col: safe ? C.green : C.red, solid: !safe })
      ctx.save(); ctx.fillStyle = '#eeeef0'; rr(956, 502, 248, 34, 8); ctx.fill(); ctx.restore()
      txt('宿主机内核（共享）', 1080, 525, { size: 17, color: C.body, align: 'center' })
      if (!safe && t > 2.2) { const k = .5 + .5 * Math.sin(T * 8); line(1080, 486, 1080, 502, hexA(C.red, .5 + .5 * k), 4); ring(1080, 519, P(t, 2.2, 3.4), C.red, 90) }
    })
    // 状态对比
    SC_FLIP.forEach(([n, a, b, t0], i) => {
      const ra = E.out(P(t, 1.4 + i * .15, 1.9 + i * .15)); if (ra <= 0) return
      const y = 305 + i * 58, on = t >= t0
      withA(ra, () => {
        panel(1250, y - 24, 530, 48, { r: 12, stroke: on ? hexA(C.green, .5) : C.hair, fill: on ? tint(C.green, .05) : C.panel, shadow: false })
        txt(n, 1272, y + 7, { size: 20, color: C.body, font: i === 4 ? MONO : SANS })
        const k = E.back(P(t, t0, t0 + .4))
        if (!on) chip(a, 1764, y, { size: 17, align: 'right', col: C.red })
        else withA(clamp(k), () => chip(b, 1764, y, { size: 17, align: 'right', col: C.green, solid: true }))
      })
    })
    terminal(940, 590, 840, 290, t, SC_TERM, { size: 20, cps: 40, alpha: E.out(P(t, 5.8, 6.3)) })
  },
}

// 场景 2：Pod Security Standards / Admission
const TIERS = [['privileged', '不做任何限制', '系统组件：CNI / CSI / GPU', C.red], ['baseline', '禁止已知提权方式', '特权容器 · hostPath · hostNetwork', C.amber],
  ['restricted', '再要求非 root · drop ALL', 'seccomp · 禁止提权 · 推荐目标', C.green]]
const MODES = [['enforce=restricted', '违规即拒绝创建'], ['warn=restricted', '返回 kubectl 警告'], ['audit=restricted', '记入审计日志']]
const pss = {
  name: 'Pod 安全标准', dur: 16, mood: 3,
  vo: [[0.6, 'Pod 安全标准分三级，一级比一级严格。'],
    [5.4, '给命名空间打上 enforce 标签，由 PSA 执行。', '给命名空间打上 enforce 标签，由 Pod Security Admission 执行。'],
    [10.6, '普通 nginx 被拒之门外，加固过的顺利通过。']],
  cues: [[0.4, 'whoosh'], [1.2, 'tick'], [1.7, 'tick'], [2.2, 'tick'], [2.6, 'pop'], [3.2, 'pop'], [3.5, 'pop'], [3.8, 'pop'], [5.6, 'lock'], [6.1, 'pop'], [6.5, 'pop'], [6.9, 'pop'],
    [10.8, 'pop'], [11.5, 'thud'], [11.7, 'error'], [13.2, 'poof'], [13.6, 'pop'], [14.6, 'ok']],
  draw(t, T) {
    heading('Pod Security Standards 与 PSA', 140, 210, t, .2, { eyebrow: 'POD SECURITY ADMISSION', color: COL })
    TIERS.forEach(([n, d, s, c], i) => {
      const a = E.out(P(t, 1.2 + i * .5, 1.7 + i * .5)); if (a <= 0) return
      const y = 300 + i * 124, on = t >= 5.4 && i === 2
      withA(a * (t >= 5.4 && !on ? .55 : 1), () => {
        panel(140 + lerp(-30, 0, a), y, 580, 106, { r: 16, stroke: on ? c : hexA(c, .4), lw: on ? 2.5 : 1.5, fill: on ? tint(c, .07) : C.panel })
        chip(n, 166, y + 36, { size: 21, align: 'left', col: c, solid: on })
        txt(d, 166, y + 84, { size: 21, color: C.text })
        txt(s, 700, y + 43, { size: 16, color: C.mute, align: 'right' })
        for (let k = 0; k < i; k++) lock(690 - k * 30, y + 76, 20, hexA(c, .8))
      })
    })
    // 命名空间：先是未打标签，再打上 PSA 标签
    const nA = E.out(P(t, 2.6, 3.2))
    nsBox(1000, 290, 780, 580, 'namespace: secure-apps', COL, nA)
    withA(nA * (1 - P(t, 5.2, 5.6)), () => {
      chip('未打标签', 1030, 396, { size: 18, align: 'left', col: C.mute })
      txt('默认按 privileged 处理：什么都能建', 1030, 460, { size: 21, color: C.body })
      ;[0, 1, 2].forEach(k => pod(1160 + k * 170, 640, 90, { state: k === 1 ? 'fail' : 'run', label: ['web', 'privileged', 'app'][k], alpha: E.out(P(t, 3.2 + k * .3, 3.6 + k * .3)) }))
    })
    withA(E.out(P(t, 5.4, 5.8)), () => txt('pod-security.kubernetes.io/…', 1030, 352, { size: 17, font: MONO, color: C.mute }))
    MODES.forEach(([m, d], i) => {
      const a = E.out(P(t, 6.1 + i * .4, 6.5 + i * .4)); if (a <= 0) return
      const y = 396 + i * 54
      chip(m, 1030, y, { size: 18, align: 'left', col: i ? C.mute : COL, solid: i === 0, alpha: a })
      txt(d, 1300, y + 7, { size: 20, color: C.body, alpha: a })
    })
    // 门：命名空间左边界
    if (t > 5.6) withA(E.out(P(t, 5.6, 6)), () => { glow(hexA(COL, .5), 14, () => line(1000, 480, 1000, 850, COL, 5)); lock(1000, 600, 34, COL) })
    // 普通 nginx 被拒
    if (t > 10.8 && t < 13.6) {
      const inA = E.out(P(t, 10.8, 11.5)), back = E.out(P(t, 11.5, 12.1))
      const x = lerp(lerp(850, 930, inA), 840, back)
      const shake = t > 11.5 && t < 12.1 ? Math.sin(t * 70) * 6 * (1 - P(t, 11.5, 12.1)) : 0
      pod(x, 600, 100, { state: t < 11.5 ? 'pending' : 'fail', label: 'nginx:1.27', alpha: E.out(P(t, 10.8, 11.1)) * (1 - P(t, 13.1, 13.4)), shake })
      poof(840, 600, P(t, 13.2, 13.9), C.red)
      ring(950, 600, P(t, 11.5, 12.3), C.red, 110)
    }
    const eA = E.out(P(t, 11.7, 12.2))
    withA(eA, () => {
      panel(140, 690, 820, 180, { r: 14, fill: tint(C.red, .05), stroke: hexA(C.red, .5) })
      txt('Error from server (Forbidden): violates PodSecurity', 164, 728, { size: 19, font: MONO, color: C.red })
      txt('"restricted:latest"', 164, 758, { size: 19, font: MONO, color: C.red })
      ;['allowPrivilegeEscalation != false', 'unrestricted capabilities', 'runAsNonRoot != true', 'seccompProfile'].forEach((s, i) =>
        txt('· ' + s, 164 + (i % 2) * 420, 800 + Math.floor(i / 2) * 36, { size: 17, font: MONO, color: C.body, alpha: E.out(P(t, 12 + i * .15, 12.4 + i * .15)) }))
    })
    // 加固过的顺利通过
    if (t > 13.6) {
      const p = P(t, 13.6, 14.6), e = E.inOut(p)
      const x = lerp(850, 1390, e), y = lerp(600, 690, e)
      pod(x, y, 110, { state: t < 14.6 ? 'idle' : 'run', label: 'hardened-web', sub: t >= 14.6 ? 'Running' : '', scale: E.back(P(t, 13.6, 14)) })
      ring(1390, 690, P(t, 14.6, 15.5), C.green, 140)
    }
  },
}

// 场景 3：NetworkPolicy
const NP = { F: [760, 430, 'frontend'], T: [760, 740, 'test'], A: [1120, 585, 'api'], D: [1590, 585, 'kube-dns'] }
const EDGES = [['F', 'A', 0, 'app'], ['T', 'A', 0, 'deny'], ['F', 'T', 0, 'deny', [760, 500], [760, 684]], ['F', 'D', -70, 'dns'], ['T', 'D', 70, 'dns'], ['A', 'D', 0, 'dns']]
const POLS = [['default-deny-all', '拒绝全部入站和出站', 'Ingress+Egress', C.red, 5.6], ['allow-dns', '所有 Pod 可访问 kube-dns:53', 'Egress', C.teal, 10.6],
  ['api-allow-frontend', 'api 只接收 frontend 的 8080', 'Ingress', C.green, 12.2], ['frontend-egress-api', 'frontend 出站放行到 api', 'Egress', C.green, 13.0]]
const netpol = {
  name: 'NetworkPolicy', dur: 16, mood: 3,
  vo: [[0.6, '默认情况下，任何 Pod 都能访问任何 Pod。'],
    [5.4, '先放一条默认拒绝，所有流量被切断。'],
    [10.6, '再逐条放行：DNS，以及 frontend 到 api。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.3, 'pop'], [1.6, 'pop'], [2.0, 'pop'], [5.6, 'powerDown'], [5.9, 'thud'], ...POLS.slice(1).map(p => [p[4], 'tick']), [10.9, 'zap'], [13.2, 'ok'], [14.2, 'error']],
  draw(t, T) {
    heading('NetworkPolicy：默认拒绝，按需放行', 140, 210, t, .2, { eyebrow: 'NETWORK POLICY', color: COL })
    nsBox(620, 290, 700, 580, 'namespace: team-a', COL, E.out(P(t, .6, 1.1)))
    nsBox(1400, 470, 380, 240, 'kube-system', C.mute, E.out(P(t, .8, 1.3)))
    // 图例与说明
    withA(E.out(P(t, 1.4, 2)), () => {
      line(1420, 340, 1470, 340, C.green, 3); txt('放行', 1482, 347, { size: 19, color: C.body })
      line(1580, 340, 1630, 340, hexA(C.red, .7), 3, [7, 6]); txt('拒绝', 1642, 347, { size: 19, color: C.body })
      txt('由 CNI 实现：无实现则静默无效', 1590, 408, { size: 18, color: C.mute, align: 'center' })
    })
    // 连线
    const ea = E.out(P(t, 1.0, 1.6))
    EDGES.forEach(([a, b, bend, kind, p1, p2], i) => {
      const [x1, y1] = p1 || NP[a], [x2, y2] = p2 || NP[b]
      const allowed = (kind === 'dns' && t >= 10.8) || (kind === 'app' && t >= 13.2)
      const open = t < 5.6
      const col = open ? C.blueL : allowed ? C.green : hexA(C.red, .55)
      withA(ea, () => {
        curve(x1, y1, x2, y2, bend, 1, col, allowed ? 3 : 2.5, { head: false, dash: open || allowed ? null : [8, 7] })
        if (open) qflow(x1, y1, x2, y2, bend, t + i * .3, C.blue, 3, .6)
        if (allowed) qflow(x1, y1, x2, y2, bend, t + i * .2, C.green, 4, .7)
        if (!open && !allowed) { const [mx, my] = qp(x1, y1, x2, y2, bend, .5); const k = E.back(P(t, 5.8 + i * .08, 6.2 + i * .08)); if (k > 0) { ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 15 * k, 0, 7); ctx.fill(); ctx.restore(); cross(mx, my, 16 * k, C.red) } }
      })
    })
    chip(':8080', 940, 490, { size: 18, col: C.green, alpha: E.out(P(t, 13.2, 13.6)) })
    ring(940, 662, P(t, 14.2, 15.2), C.red, 90)
    // Pods
    Object.entries(NP).forEach(([k, [x, y, n]], i) => {
      const s = E.back(P(t, 1.0 + i * .3, 1.4 + i * .3))
      pod(x, y, 100, { state: k === 'D' ? 'idle' : 'run', label: n, scale: s, alpha: clamp(s) })
    })
    ring(970, 580, P(t, 5.6, 6.6), C.red, 380)
    // 策略卡片
    withA(win(t, 1.4, 5.8, .4), () => { panel(140, 300, 420, 120, { r: 14, dash: [8, 7], shadow: false, fill: 'rgba(255,255,255,0.6)' }); txt('没有任何策略 → 全通', 350, 368, { size: 22, color: C.mute, align: 'center' }) })
    POLS.forEach(([n, d, typ, c, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 300 + i * 142
      withA(a, () => {
        panel(140 + lerp(-30, 0, a), y, 420, 120, { r: 14 })
        ctx.save(); ctx.fillStyle = c; rr(140 + lerp(-30, 0, a), y + 16, 6, 88, 3); ctx.fill(); ctx.restore()
        txt(n, 166, y + 46, { size: 21, font: MONO, color: C.text })
        txt(d, 166, y + 90, { size: 19, color: C.body })
        chip(typ, 544, y + 18, { size: 14, align: 'right', col: c })
      })
    })
    chip('策略取并集 · 只有允许，没有拒绝', 1590, 790, { size: 20, font: SANS, col: COL, alpha: E.out(P(t, 14.4, 14.9)) })
  },
}

// 场景 4：CiliumNetworkPolicy toFQDNs
const fqdn = {
  name: '按域名管出口', dur: 16, mood: 2,
  vo: [[0.6, '标准策略只能按 IP 段限制出口，可 IP 常变。'],
    [5.4, 'Cilium 的 toFQDNs 按域名放行，先代理 DNS 查询，', 'Cilium 的 to FQDNs 按域名放行，先代理 DNS 查询，'],
    [10.8, '学到解析出的 IP，再动态加入白名单。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [1.8, 'pop'], [2.2, 'zap'], [3.0, 'ok'], [3.4, 'tick'], [4.0, 'zap'], [4.6, 'error'], [5.6, 'pop'], [6.2, 'zap'], [7.2, 'zap'], [8.1, 'zap'], [9.0, 'zap'],
    [11.0, 'zap'], [11.6, 'lock'], [12.4, 'zap'], [13.3, 'ok'], [14.0, 'zap'], [14.7, 'error']],
  draw(t, T) {
    heading('CiliumNetworkPolicy：按 FQDN 限制出口', 140, 210, t, .2, { eyebrow: 'EGRESS · TOFQDNS', color: COL })
    const PX = 260, PY = 560, GX = 1240
    pod(PX, PY, 130, { state: 'run', label: 'net-tools', sub: 'app=net-tools', scale: E.back(P(t, 1.0, 1.4)), alpha: E.out(P(t, 1.0, 1.2)) })
    // 外部目标
    const learned = t >= 11.6, changed = t >= 3.4
    ;[['mirrors.tuna.tsinghua.edu.cn', 560], ['www.github.com', 760]].forEach(([d, y], i) => {
      const a = E.out(P(t, 1.4 + i * .4, 1.9 + i * .4)); if (a <= 0) return
      withA(a, () => {
        panel(1300, y - 50, 480, 100, { r: 16 })
        globe(1350, y, 24, C.blue)
        txt(d, 1394, y - 6, { size: 21, font: MONO, color: C.text })
        if (i) txt('不在白名单', 1394, y + 28, { size: 17, color: C.mute })
        else txt('A → 203.0.113.' + (changed ? '57' : '10'), 1394, y + 28, { size: 17, font: MONO, color: learned ? C.green : changed ? C.amber : C.body })
      })
    })
    ring(1540, 560, P(t, 3.4, 4.2), C.amber, 150)
    // 出口闸门
    withA(E.out(P(t, 1.8, 2.4)), () => {
      line(GX, 480, GX, 850, hexA(COL, .55), 4, [10, 8])
      lock(GX, 452, 30, COL, (t >= 2.4 && t < 3.0) || (t >= 12.6 && t < 13.3) ? 1 : 0)
      txt('出口', GX, 882, { size: 18, color: COL, align: 'center' })
    })
    // 第一段：按 IP 写死的规则
    withA(win(t, 1.8, 5.8, .4), () => chip('ipBlock: 203.0.113.10/32', 760, 480, { size: 20, col: C.amber }))
    if (t > 2.2 && t < 3.6) { withA(1 - P(t, 3.2, 3.6), () => line(PX + 65, PY, 1300, 560, hexA(C.green, .35), 2.5)); travel(PX + 65, PY, 1300, 560, P(t, 2.2, 3.0), C.green, 9) }
    if (t > 4.0 && t < 5.8) {
      const p = P(t, 4.0, 4.6)
      withA(1 - P(t, 5.4, 5.8), () => {
        line(PX + 65, PY, lerp(PX + 65, GX - 10, p), PY, hexA(C.red, .35), 2.5)
        if (p < 1) dot(lerp(PX + 65, GX - 10, p), PY, 9, C.red, 14); else cross(GX, PY, 30, C.red)
      })
    }
    withA(win(t, 4.6, 5.8, .3), () => txt('CDN 换了 IP → 按 IP 写的规则失效', 760, 650, { size: 21, color: C.red, align: 'center' }))
    // DNS 代理与 kube-dns
    const dA = E.out(P(t, 5.4, 6))
    box(700, 360, 360, 104, 'Cilium DNS 代理', 'rules.dns 检查查询', COL, { alpha: dA, hi: t > 6.2 && t < 12, size: 26 })
    box(1060, 360, 200, 84, 'kube-dns', ':53', C.mute, { alpha: dA, size: 25 })
    withA(dA, () => { line(880, 360, 960, 360, hexA(C.text, .25), 2, [6, 6]); line(PX + 50, PY - 60, 520, 392, hexA(C.text, .2), 2, [6, 6]) })
    travel(PX + 50, PY - 60, 520, 392, P(t, 6.2, 7.1), COL, 8)
    travel(880, 360, 960, 360, P(t, 7.2, 7.9), COL, 8)
    travel(960, 360, 880, 360, P(t, 8.1, 8.8), C.green, 8)
    travel(520, 392, PX + 50, PY - 60, P(t, 9.0, 9.9), C.green, 8)
    withA(win(t, 6.2, 8.1, .3), () => chip('mirrors.tuna… A?', 330, 380, { size: 17, col: COL }))
    withA(win(t, 8.1, 10.6, .3), () => chip('A 203.0.113.57', 330, 380, { size: 17, col: C.green }))
    // 学到的白名单
    withA(E.out(P(t, 11.0, 11.5)), () => {
      arrow(700, 412, 700, 712, E.out(P(t, 11.0, 11.6)), hexA(COL, .7), 2.5)
      panel(500, 716, 400, 140, { r: 14, stroke: hexA(COL, .5) })
      txt('放行 IP 表（eBPF）', 524, 752, { size: 19, color: COL })
      withA(E.out(P(t, 11.6, 12)), () => { txt('203.0.113.57', 524, 796, { size: 21, font: MONO, color: C.text }); txt('← mirrors.tuna…', 524, 830, { size: 17, font: MONO, color: C.mute }) })
    })
    // 真正的出口流量
    if (t > 12.4) { line(PX + 65, PY, 1300, 560, hexA(C.green, .35), 2.5); travel(PX + 65, PY, 1300, 560, P(t, 12.4, 13.3), C.green, 9) }
    chip('200', 1760, 588, { size: 18, col: C.green, solid: true, align: 'right', alpha: E.out(P(t, 13.3, 13.7)) })
    if (t > 14.0) {
      const p = P(t, 14.0, 14.7), x = lerp(PX + 60, GX - 10, E.inOut(p)), y = lerp(PY + 30, 745, E.inOut(p))
      line(PX + 60, PY + 30, x, y, hexA(C.red, .35), 2.5)
      if (p < 1) dot(x, y, 9, C.red, 14)
      else { cross(GX, 745, 30, C.red); ring(GX, 745, P(t, 14.7, 15.5), C.red, 90) }
    }
    chip('超时', 1760, 788, { size: 18, col: C.red, solid: true, align: 'right', alpha: E.out(P(t, 14.7, 15.1)) })
  },
}

// 场景 5：ValidatingAdmissionPolicy
const vap = {
  name: '准入策略 VAP', dur: 15, mood: 3,
  vo: [[0.6, '想要自定义规则？比如镜像只能来自内部仓库。'],
    [5.4, 'ValidatingAdmissionPolicy 用 CEL 直接校验。', 'Validating Admission Policy，用 CEL 直接校验。'],
    [10.4, 'Policy 定规则，Binding 定范围和处理方式。']],
  cues: [[0.4, 'whoosh'], [1.2, 'pop'], [1.8, 'pop'], [5.6, 'shimmer'], [6.6, 'zap'], [7.3, 'error'], [8.4, 'zap'], [9.2, 'ok'], [10.6, 'tick'], [11.2, 'tick'], [12.0, 'pop'], [12.4, 'pop']],
  draw(t, T) {
    heading('ValidatingAdmissionPolicy：用 CEL 写准入规则', 140, 210, t, .2, { eyebrow: 'ADMISSION POLICY', color: COL })
    // 请求
    const req = [['evil', 'docker.io/library/nginx:1.27', 350, C.red, 6.6, 1.2], ['web', 'registry.example.com/web:1.0', 520, C.green, 8.4, 1.6]]
    req.forEach(([n, img, y, c, t0, a0]) => {
      const a = E.out(P(t, a0, a0 + .5)); if (a <= 0) return
      const done = t >= t0 + .7
      withA(a, () => {
        panel(140, y - 56, 430, 112, { r: 14, stroke: done ? hexA(c, .6) : C.hair })
        txt('Deployment ' + n, 164, y - 14, { size: 22, font: MONO, weight: 600 })
        txt(img, 164, y + 24, { size: 17, font: MONO, color: C.body })
        if (done) { if (c === C.red) cross(540, y - 20, 24, C.red); else check(540, y - 20, 30, C.green, P(t, t0 + .7, t0 + 1)) }
      })
    })
    // apiserver：先是一句需求，再换成 CEL
    const aA = E.out(P(t, 1.8, 2.4)), cel = E.out(P(t, 5.6, 6.2))
    withA(aA, () => {
      panel(660, 280, 700, 250, { r: 18, fill: tint(COL, .04), stroke: hexA(COL, .5), lw: 2 })
      txt('kube-apiserver · 准入阶段', 690, 322, { size: 22, weight: 600, color: C.text })
      withA(cel, () => chip('trusted-registry', 1336, 316, { size: 16, col: COL, align: 'right' }))
      panel(690, 350, 640, 150, { r: 12, fill: '#fff', shadow: false })
      withA(1 - cel, () => {
        txt('需求：所有镜像必须来自', 1010, 408, { size: 24, color: C.text, align: 'center' })
        txt('registry.example.com/', 1010, 452, { size: 24, font: MONO, color: COL, align: 'center' })
      })
      withA(cel, () => {
        txt('object.spec.template.spec.containers.all(c,', 712, 396, { size: 19, font: MONO, color: C.text })
        txt("  c.image.startsWith('registry.example.com/'))", 712, 432, { size: 19, font: MONO, color: COL })
        txt('CEL 表达式 · 在 apiserver 进程内求值，无需 Webhook', 712, 478, { size: 17, color: C.mute })
      })
      withA(1 - cel, () => txt('怎么表达？以前要写一个准入 Webhook 服务', 1010, 518, { size: 19, color: C.mute, align: 'center' }))
    })
    // 评估结果
    const lit = t > 6.9 && t < 8 ? C.red : t > 8.7 && t < 9.8 ? C.green : null
    if (lit) withA(.9, () => { ctx.save(); rr(690, 350, 640, 150, 12); ctx.strokeStyle = lit; ctx.lineWidth = 3; ctx.stroke(); ctx.restore() })
    travel(570, 350, 690, 420, P(t, 6.6, 7.2), C.red, 9)
    travel(570, 520, 690, 440, P(t, 8.4, 9.0), C.green, 9)
    withA(E.out(P(t, 7.3, 7.7)), () => {
      panel(660, 560, 700, 64, { r: 12, fill: tint(C.red, .05), stroke: hexA(C.red, .45), shadow: false })
      txt('denied: all images must come from registry.example.com', 684, 600, { size: 18, font: MONO, color: C.red })
    })
    // etcd
    withA(E.out(P(t, 2.2, 2.8)), () => { cylinder(1580, 430, 150, 110, C.blue, 'etcd'); arrow(1360, 430, 1490, 430, 1, hexA(C.text, .25), 2) })
    travel(1360, 430, 1500, 430, P(t, 9.0, 9.6), C.green, 9)
    ring(1580, 430, P(t, 9.2, 10.2), C.green, 130)
    // Policy / Binding
    const pA = E.out(P(t, 10.6, 11.1)), bA = E.out(P(t, 11.2, 11.7))
    withA(pA, () => {
      panel(140, 700, 560, 170, { r: 16, stroke: hexA(COL, .5) })
      chip('ValidatingAdmissionPolicy', 164, 738, { size: 18, col: COL, align: 'left', solid: true })
      txt('规则是什么：CEL 表达式 + 报错信息', 164, 800, { size: 21, color: C.text })
      txt('matchConstraints：Deployment 等', 164, 838, { size: 18, color: C.mute })
    })
    withA(bA, () => {
      arrow(700, 785, 790, 785, E.out(P(t, 11.2, 11.6)), hexA(COL, .6), 2.5)
      panel(800, 700, 980, 170, { r: 16, stroke: hexA(COL, .5) })
      chip('ValidatingAdmissionPolicyBinding', 824, 738, { size: 18, col: COL, align: 'left' })
      txt('对谁生效、违规怎么处理', 824, 800, { size: 21, color: C.text })
      txt('matchResources · validationActions', 824, 838, { size: 18, font: MONO, color: C.mute })
    })
    ;[['测试命名空间', 'Warn', C.amber, 12.0], ['生产命名空间', 'Deny', C.red, 12.4]].forEach(([n, m, c, t0], i) => {
      const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
      const x = 1340 + i * 240
      withA(a, () => { txt(n, x, 804, { size: 19, color: C.body, align: 'center' }); chip(m, x, 842, { size: 18, col: c, solid: true }) })
    })
  },
}

ANIM({
  id: 'security',
  meta: { stage: 3, lesson: 4, of: 6, title: '工作负载安全加固', summary: 'securityContext、Pod Security Standards、NetworkPolicy 与按 FQDN 限制出口。', next: '自动扩缩容' },
  scenes: [
    lessonIntro({ tags: ['securityContext', 'PSA', 'NetworkPolicy', 'toFQDNs', 'VAP'], vo: [[3.2, '攻击者从应用进来之后，还能做什么？']] }),
    secCtx, pss, netpol, fqdn, vap,
    lessonOutro({
      points: ['securityContext：非 root、只读、drop ALL', 'PSA：命名空间标签 enforce=restricted', 'NetworkPolicy：默认拒绝，逐条放行', 'toFQDNs 管出口，VAP 用 CEL 写准入规则'],
      vo: [[0.8, '小结：从容器权限到网络出口，逐层加固。'], [5.6, '下一课，让应用随流量自动扩缩。']],
    }),
  ],
})
})()
