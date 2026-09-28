/* 第 3 阶段 · 第 3 课：认证、授权与 RBAC */
(() => {
const COL = STAGES[3].color
// 组件框：同 box()，但副标题至少 16px
function sbox(x, y, w, h, title, sub, col = C.blue, o = {}) {
  const { alpha = 1, hi = false, size = 26, fill } = o
  withA(alpha, () => {
    panel(x - w / 2, y - h / 2, w, h, { r: o.r || 14, fill: fill || (hi ? tint(col, .14) : '#fff'), stroke: hi ? col : hexA(col, .45), lw: hi ? 2.5 : 1.5 })
    txt(title, x, y + (sub ? -4 : size * .36), { size, weight: 600, align: 'center' })
    if (sub) txt(sub, x, y + size * 1.08, { size: Math.max(16, Math.round(size * .66)), font: MONO, color: C.mute, align: 'center' })
  })
}
// 信息卡：标题 + 一行说明
function card(x, y, w, h, title, sub, col, a, on) {
  withA(a, () => {
    panel(x, y, w, h, { r: 18, stroke: on ? col : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(col, .06) : C.panel })
    txt(title, x + 30, y + 48, { size: 26, weight: 600, color: on ? col : C.text })
    txt(sub, x + 30, y + 88, { size: 20, color: C.body })
  })
}

// 场景 1：认证
const CRED = [
  ['X.509 客户端证书', 'CN=kubernetes-admin  O=kubeadm:cluster-admins', C.blue],
  ['ServiceAccount Token', 'sub: system:serviceaccount:dev:ci-bot', C.teal],
  ['OIDC ID Token', 'claims: email · groups（团队登录推荐）', C.amber],
]
const WHO = [
  { t: 6.0, cmd: 'kubectl auth whoami' },
  { t: 7.0, out: 'Username  kubernetes-admin', color: C.text },
  { t: 7.3, out: 'Groups    [kubeadm:cluster-admins', color: C.text },
  { t: 7.5, out: '           system:authenticated]', color: C.text },
]
const authn = {
  name: '认证', dur: 16, mood: 1,
  vo: [[0.6, 'K8s 里没有 User 对象，身份来自凭据。', 'Kubernetes 里没有 User 对象，身份来自凭据。'],
    [5.0, '证书 CN、Token 的 sub，映射成用户名和组。', '证书 C N、Token 的 sub，映射成用户名和组。'],
    [10.6, '全部认证失败，返回 401 或当作匿名用户。', '全部认证失败，返回四零一，或当作匿名用户。']],
  cues: [[0.4, 'whoosh'], [1.2, 'tick'], [1.8, 'error'], [2.2, 'pop'], [2.5, 'pop'], [2.8, 'pop'], [3.2, 'pop'],
    [5.2, 'zap'], [6.0, 'ok'], ...typeCues(WHO, 30), [8.6, 'zap'], [9.4, 'ok'], [10.8, 'zap'], [11.6, 'error'], [12.4, 'tick'], [13.2, 'tick']],
  draw(t) {
    heading('K8s 没有「用户」对象', 140, 210, t, .2, { eyebrow: 'AUTHENTICATION', color: COL })
    const act = t >= 5.0 && t < 8.6 ? 0 : t >= 8.6 && t < 10.6 ? 1 : -1
    // 左：三种凭据
    CRED.forEach(([n, s, c], i) => {
      const a = E.out(P(t, 2.2 + i * .3, 2.7 + i * .3)); if (a <= 0) return
      const y = 290 + i * 130, on = act === i
      withA(a * (act < 0 || on ? 1 : .55), () => {
        panel(140, y, 620, 112, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel })
        ctx.save(); ctx.fillStyle = c; rr(140, y + 22, 6, 68, 3); ctx.fill(); ctx.restore()
        txt(n, 172, y + 46, { size: 24, weight: 600 })
        txt(s, 172, y + 86, { size: 17, font: MONO, color: on ? c : C.body })
      })
      arrow(764, y + 56, 856, 470 + (y + 56 - 476) * .35, a, hexA(C.text, .25), 2)
    })
    // 中：认证插件
    const ba = E.out(P(t, 3.2, 3.7))
    const shake = t > 11.6 && t < 12.1 ? Math.sin(t * 70) * 6 : 0
    sbox(1000 + shake, 470, 280, 140, '认证插件', '依次尝试 · 任一成功', COL, { alpha: ba, hi: act >= 0, size: 28 })
    ;[[5.2, 6.0, 346, C.blue], [8.6, 9.4, 476, C.teal]].forEach(([a, b, y, c]) => { const p = P(t, a, b); if (p > 0 && p < 1) travel(764, y, 862, 470, E.inOut(p), c, 8) })
    // 右：认出的身份
    arrow(1142, 470, 1196, 470, E.out(P(t, 5.8, 6.1)), hexA(COL, .6), 2.5)
    terminal(1200, 290, 580, 250, t, WHO, { size: 20, title: '身份 = 用户名 + 组', alpha: Math.max(.45 * E.out(P(t, 3.6, 4.1)), E.out(P(t, 5.8, 6.2))) })
    chip('Username system:serviceaccount:dev:ci-bot', 1200, 590, { size: 17, col: C.teal, align: 'left', alpha: E.out(P(t, 9.4, 9.9)) })
    // 底部：没有 kubectl create user
    const ua = E.out(P(t, 1.2, 1.7))
    const w = chip('kubectl create user alice', 140, 820, { size: 20, col: C.mute, align: 'left', alpha: ua })
    withA(E.out(P(t, 1.8, 2.1)), () => {
      line(152, 820, 128 + w, 820, hexA(C.red, .8), 2.5)
      cross(164 + w, 820, 24, C.red)
      txt('没有 User 资源，用户由外部系统管理', 196 + w, 827, { size: 20, color: C.body })
    })
    // 失败：401 / 匿名
    withA(E.out(P(t, 10.8, 11.2)), () => chip('无效 / 缺失凭据', 450, 700, { size: 18, col: C.red }))
    const fp = P(t, 11.0, 11.6)
    if (fp > 0 && fp < 1) travel(542, 700, 870, 520, E.inOut(fp), C.red, 8)
    ring(1000, 470, P(t, 11.6, 12.6), C.red, 190)
    chip('全部失败 → 401 Unauthorized', 1200, 700, { size: 20, col: C.red, solid: true, align: 'left', alpha: E.out(P(t, 12.4, 12.9)) })
    chip('允许匿名时 → system:anonymous', 1200, 760, { size: 18, col: C.mute, align: 'left', alpha: E.out(P(t, 13.2, 13.7)) })
  },
}

// 场景 2：ServiceAccount 与投射 Token
const JWT = ['aud: [https://kubernetes.default.svc]', 'exp: 签发后约 1h', 'kubernetes.io:', '  pod: sa-demo', '  serviceaccount: default',
  'sub: system:serviceaccount:default:default']
const FILES = [['token', '短期 JWT'], ['ca.crt', 'apiserver 的 CA'], ['namespace', '当前命名空间']]
const PROPS = [['有时效', '约 1 小时，kubelet 自动轮换', 5.4, 1], ['绑定 Pod', 'Pod 删除，Token 立即失效', 6.8, 3], ['有受众', 'aud 限定用途，防止挪用', 8.2, 0]]
const token = {
  name: '投射 Token', dur: 16, mood: 2,
  vo: [[0.6, 'Pod 启动时，kubelet 挂载一个投射卷。'],
    [4.8, 'Token 约一小时过期，绑定 Pod，还带受众。'],
    [10.2, '旧的 Secret Token 永不过期；不需要就关掉挂载。']],
  cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.6, 'tick'], [1.9, 'tick'], [2.2, 'tick'], [2.6, 'pop'], [5.0, 'zap'],
    [5.4, 'pop'], [6.8, 'pop'], [8.2, 'pop'], [10.4, 'alarmSoft'], [12.4, 'lock'], [13.0, 'ok']],
  draw(t) {
    heading('ServiceAccount 与投射 Token', 140, 210, t, .2, { eyebrow: 'SERVICEACCOUNT', color: COL })
    // 左：Pod 与投射卷
    const la = E.out(P(t, .8, 1.3))
    withA(la, () => {
      panel(140, 280, 760, 290, { r: 18 })
      txt('/var/run/secrets/kubernetes.io/serviceaccount/', 380, 330, { size: 17, font: MONO, color: COL })
      line(370, 352, 880, 352, C.hair, 1)
      chip('SA: default', 250, 330, { size: 16, col: C.teal })
    })
    pod(250, 440, 110, { state: 'run', alpha: la, label: 'sa-demo', scale: E.back(P(t, .8, 1.3)) })
    FILES.forEach(([n, d], i) => {
      const a = E.out(P(t, 1.6 + i * .3, 2.0 + i * .3)); if (a <= 0) return
      const y = 400 + i * 56, on = i === 0 && t > 4.8 && t < 10.2
      if (on) { ctx.save(); ctx.globalAlpha *= E.out(P(t, 4.8, 5.2)); ctx.fillStyle = tint(COL, .12); rr(376, y - 30, 506, 44, 10); ctx.fill(); ctx.restore() }
      withA(a, () => {
        ctx.save(); ctx.strokeStyle = hexA(COL, .6); ctx.lineWidth = 2; rr(398, y - 22, 20, 26, 4); ctx.stroke(); ctx.restore()
        txt(n, 432, y, { size: 21, font: MONO, color: C.text })
        txt(d, 600, y, { size: 19, color: C.body })
      })
    })
    // 右：JWT 解码
    arrow(884, 400, 956, 400, E.out(P(t, 2.4, 2.8)), hexA(C.text, .35), 2.5)
    const cur = PROPS.reduce((k, p, i) => t >= p[2] ? i : k, -1)
    const hi = t >= 10.2 || cur < 0 ? [5] : [PROPS[cur][3]]
    code(960, 280, 820, JWT, t, 2.6, { title: 'token 解码 · JWT payload', size: 20, step: .15, hi: t < 3.6 ? [] : hi, hiColor: COL, alpha: E.out(P(t, 2.4, 2.8)) })
    // 三个特性
    PROPS.forEach(([n, s, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const x = 140 + i * 570
      card(x, 610, 500, 130, n, s, COL, a, cur === i && t < 10.2)
      if (i === 0) {
        const q = t < 6 ? 1 : 1 - ((t - 6) % 3.2) / 3.2
        withA(a, () => meter(x + 30, 718, 440, 8, q, q < .15 ? C.amber : COL))
      }
      if (i === 1) withA(a, () => check(x + 460, 658, 24, C.green, P(t, t0 + .4, t0 + .8)))
    })
    // 底部：旧式 Token 与关闭挂载
    const oa = E.out(P(t, 10.4, 10.9))
    const w = chip('旧式 Secret Token：永不过期', 140, 810, { size: 19, col: C.red, align: 'left', alpha: oa })
    withA(oa, () => txt('v1.24 起不再自动生成', 160 + w, 817, { size: 18, color: C.mute }))
    chip('automountServiceAccountToken: false', 1780, 810, { size: 19, col: C.green, solid: t > 13, align: 'right', alpha: E.out(P(t, 12.4, 12.9)) })
    withA(E.out(P(t, 12.4, 12.9)), () => lock(1780 - 470, 812, 26, C.green))
  },
}

// 场景 3：RBAC 四对象
const ROLE = ['kind: Role', 'metadata:', '  name: pod-reader', '  namespace: dev', 'rules:', '- apiGroups: [""]', '  resources: [pods, pods/log]', '  verbs: [get, list, watch]']
const SUBJ = [['User alice', 380], ['Group dev-team', 455], ['ServiceAccount ci-bot', 530]]
const PRIN = [['只有允许', '没有 deny 规则', COL], ['取并集', '所有绑定的权限相加', C.blue], ['默认拒绝', '没授予的一律 403', C.red]]
const rbac4 = {
  name: 'RBAC 四对象', dur: 17, mood: 2,
  vo: [[0.6, 'RBAC 只有四种对象：两种角色，两种绑定。'],
    [5.6, 'Role 写规则：哪些 API 组、资源、动词。', 'Role 写规则：哪些 A P I 组、资源、动词。'],
    [11.2, '规则只有允许，权限取并集，其余一律拒绝。']],
  cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.2, 'pop'], [1.6, 'pop'], [1.9, 'pop'], [2.4, 'tick'], [2.9, 'tick'], [3.2, 'tick'], [3.5, 'tick'],
    [5.6, 'zap'], [6.6, 'tick'], [7.6, 'tick'], [8.6, 'tick'], [11.4, 'pop'], [12.0, 'pop'], [12.6, 'error'], [13.6, 'chime']],
  draw(t) {
    heading('RBAC：四个对象', 140, 210, t, .2, { eyebrow: 'AUTHORIZATION', color: COL })
    const ha = E.out(P(t, .8, 1.3))
    withA(ha, () => {
      txt('定义「能做什么」', 290, 306, { size: 18, color: C.mute, align: 'center' })
      txt('定义「谁」获得它', 700, 306, { size: 18, color: C.mute, align: 'center' })
      txt('subjects', 1060, 306, { size: 18, font: MONO, color: C.mute, align: 'center' })
    })
    const roleHi = t > 5.6 && t < 11
    sbox(290, 380, 300, 96, 'Role', '命名空间内', C.blue, { alpha: E.out(P(t, .9, 1.4)), hi: roleHi, size: 26 })
    sbox(290, 530, 300, 96, 'ClusterRole', '集群级 · 可复用', COL, { alpha: E.out(P(t, 1.2, 1.7)), size: 26 })
    sbox(700, 380, 340, 96, 'RoleBinding', '命名空间内', C.teal, { alpha: E.out(P(t, 1.6, 2.1)), size: 26 })
    sbox(700, 530, 340, 96, 'ClusterRoleBinding', '全集群生效', C.teal, { alpha: E.out(P(t, 1.9, 2.4)), size: 26 })
    const ra = E.out(P(t, 2.4, 2.9))
    arrow(528, 380, 444, 380, ra, hexA(C.text, .4), 2.5); arrow(528, 530, 444, 530, ra, hexA(C.text, .4), 2.5)
    withA(ra, () => { txt('roleRef', 486, 364, { size: 16, font: MONO, color: C.mute, align: 'center' }); txt('roleRef', 486, 514, { size: 16, font: MONO, color: C.mute, align: 'center' }) })
    SUBJ.forEach(([s, y], i) => {
      const a = E.out(P(t, 2.9 + i * .3, 3.4 + i * .3)); if (a <= 0) return
      ;[380, 530].forEach(by => partialLine(872, by, 936, y, a, hexA(C.teal, .35), 1.5))
      chip(s, 940, y, { size: 19, col: C.text, align: 'left', alpha: a })
    })
    // 右：Role YAML
    const hi = t < 6.6 ? [] : t < 7.6 ? [5] : t < 8.6 ? [6] : t < 11 ? [7] : []
    code(1280, 280, 500, ROLE, t, 5.6, { title: 'pod-reader.yaml', size: 19, step: .12, hi, hiColor: C.blue, alpha: Math.max(.45 * E.out(P(t, 3.4, 3.9)), E.out(P(t, 5.4, 5.8))) })
    chip('"" = core 组（apiVersion: v1）', 1280, 680, { size: 17, col: C.mute, align: 'left', alpha: E.out(P(t, 7.0, 7.5)) })
    chip('子资源单独授权：pods/log', 1280, 734, { size: 17, col: C.mute, align: 'left', alpha: E.out(P(t, 8.0, 8.5)) })
    chip('verbs：get · list · watch · create …', 1280, 788, { size: 17, col: C.blue, align: 'left', alpha: E.out(P(t, 9.0, 9.5)) })
    // 底：三条原则
    PRIN.forEach(([n, s, c], i) => {
      const a = E.out(P(t, 11.4 + i * .6, 11.9 + i * .6)); if (a <= 0) return
      card(140 + i * 370, 650, 340, 150, n, s, c, a, t > 13.6 || (t > 11.4 + i * .6 && t < 12 + i * .6))
    })
    ring(1060, 725, P(t, 12.6, 13.4), C.red, 140)
  },
}

// 场景 4：ClusterRole 的两种用法
const NS = ['team-a', 'team-b', 'default']
function nsTile(x, y, name, a, st) { // st: 0 未知 / 1 授权 / -1 无权限
  withA(a, () => {
    panel(x, y, 240, 124, { r: 16, dash: [8, 6], stroke: st > 0 ? C.green : C.hairD, lw: st > 0 ? 2.5 : 1.5, fill: st > 0 ? tint(C.green, .08) : C.panel, shadow: false })
    txt('ns/' + name, x + 20, y + 34, { size: 18, font: MONO, color: st < 0 ? C.mute : C.text })
    pod(x + 70, y + 82, 44, { state: st > 0 ? 'run' : 'idle', alpha: st < 0 ? .45 : 1 })
    pod(x + 130, y + 82, 44, { state: st > 0 ? 'run' : 'idle', alpha: st < 0 ? .45 : 1 })
    if (st > 0) check(x + 206, y + 30, 22, C.green, 1)
    if (st < 0) cross(x + 206, y + 30, 20, hexA(C.red, .8))
  })
}
const BUILTIN = [['view', '只读，不含 Secret'], ['edit', '读写，不能改 RBAC'], ['admin', '命名空间内全部权限'], ['cluster-admin', '超级管理员']]
const crole = {
  name: 'ClusterRole 两种用法', dur: 16, mood: 3,
  vo: [[0.6, 'ClusterRole 能被两种绑定引用。', 'Cluster Role 能被两种绑定引用。'],
    [4.4, 'RoleBinding 绑：只在所在命名空间生效。', 'Role Binding 绑：只在所在命名空间生效。'],
    [8.4, 'ClusterRoleBinding 绑：全集群生效。', 'Cluster Role Binding 绑：全集群生效。'],
    [12.2, '优先复用内置的 view、edit、admin。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'tick'], [1.6, 'pop'], [2.0, 'pop'], [4.6, 'zap'], [5.8, 'ok'], [6.6, 'error'],
    [8.6, 'zap'], [9.6, 'ok'], [9.9, 'ok'], [10.2, 'ok'], [12.4, 'pop'], [12.7, 'pop'], [13.0, 'pop'], [13.3, 'pop'], [14.0, 'chime']],
  draw(t) {
    heading('ClusterRole 的两种用法', 140, 210, t, .2, { eyebrow: 'CLUSTERROLE', color: COL })
    sbox(960, 318, 360, 92, 'ClusterRole: view', '定义一次 · 到处复用', COL, { alpha: E.out(P(t, .8, 1.3)), hi: true, size: 26 })
    const L = t >= 4.4, R = t >= 8.4
    sbox(520, 450, 340, 88, 'RoleBinding', 'namespace: team-a', C.teal, { alpha: E.out(P(t, 1.6, 2.1)) * (L ? 1 : .55), hi: L && t < 8.4, size: 25 })
    sbox(1400, 450, 340, 88, 'ClusterRoleBinding', '无命名空间 · 全集群', C.teal, { alpha: E.out(P(t, 2.0, 2.5)) * (R ? 1 : .55), hi: R && t < 12.2, size: 25 })
    // 角色 → 绑定
    partialLine(820, 350, 600, 406, E.out(P(t, 4.4, 4.9)), hexA(COL, .6), 2.5)
    partialLine(1100, 350, 1320, 406, E.out(P(t, 8.4, 8.9)), hexA(COL, .6), 2.5)
    // 命名空间
    NS.forEach((n, i) => {
      const a = E.out(P(t, 1.2 + i * .15, 1.7 + i * .15))
      const lx = 140 + i * 260, rx = 1020 + i * 260
      nsTile(lx, 560, n, a, i === 0 ? (t >= 5.8 ? 1 : 0) : (t >= 6.6 ? -1 : 0))
      nsTile(rx, 560, n, a, t >= 9.6 + i * .3 ? 1 : 0)
      arrow(1400, 496, rx + 120, 554, E.out(P(t, 9.0 + i * .2, 9.5 + i * .2)), hexA(C.green, .7), 2.5)
    })
    arrow(520, 496, 260, 554, E.out(P(t, 5.0, 5.6)), hexA(C.green, .7), 2.5)
    withA(E.out(P(t, 6.6, 7.1)), () => txt('其他命名空间：无权限', 660, 720, { size: 18, color: C.mute, align: 'center' }))
    withA(E.out(P(t, 10.4, 10.9)), () => txt('所有命名空间：只读', 1400, 720, { size: 18, color: C.green, align: 'center' }))
    // 内置角色
    BUILTIN.forEach(([n, d], i) => {
      const a = E.out(P(t, 12.4 + i * .3, 12.9 + i * .3)); if (a <= 0) return
      const x = 140 + i * 413
      withA(a, () => {
        panel(x, 760, 390, 104, { r: 16, stroke: i === 0 ? hexA(COL, .6) : C.hair })
        chip(n, x + 24, 794, { size: 20, col: i === 3 ? C.red : COL, align: 'left', solid: i === 0 })
        txt(d, x + 26, 846, { size: 20, color: C.body })
      })
    })
  },
}

// 场景 5：kubectl auth can-i
const SA = '$SA'
const CAN = [
  { t: .8, cmd: 'SA=system:serviceaccount:sa-management:dev-wang' },
  { t: 2.2, cmd: `kubectl auth can-i create deployments -n team-a --as=${SA}` },
  { t: 3.8, out: 'yes', color: C.green, sfx: 'ok' },
  { t: 4.2, cmd: `kubectl auth can-i create deployments -n default --as=${SA}` },
  { t: 5.8, out: 'no', color: C.red, sfx: 'error' },
  { t: 6.2, cmd: `kubectl auth can-i list namespaces --as=${SA}` },
  { t: 7.5, out: 'yes', color: C.green, sfx: 'ok' },
  { t: 7.9, cmd: `kubectl auth can-i delete nodes --as=${SA}` },
  { t: 9.1, out: 'no', color: C.red, sfx: 'error' },
  { t: 10.2, cmd: `kubectl get pods -n kube-system --as=${SA}` },
  { t: 11.5, out: 'Error from server (Forbidden): pods is forbidden:', color: C.red, sfx: 'alarmSoft' },
  { t: 11.7, out: 'User "system:serviceaccount:sa-management:dev-wang" cannot list pods', color: C.red },
]
const PERM = [['team-a 读写应用', 'RoleBinding → edit', 3.8, true], ['default 创建 Deployment', '没有绑定', 5.8, false],
  ['查看命名空间列表', 'ClusterRoleBinding', 7.5, true], ['删除节点', '没有绑定', 9.1, false]]
const cani = {
  name: 'can-i 验证', dur: 15, mood: 3,
  vo: [[0.6, '写完权限，用 can-i 模拟身份来验证。', '写完权限，用 can i 模拟身份来验证。'],
    [4.4, 'dev-wang 只能改 team-a，能看命名空间列表。', 'dev wang 只能改 team a，能看命名空间列表。'],
    [10.0, '越权访问 kube-system，直接 403 Forbidden。', '越权访问 kube system，直接返回四零三 Forbidden。']],
  cues: [[0.4, 'whoosh'], ...typeCues(CAN, 40), [12.6, 'chime']],
  draw(t) {
    heading('用 kubectl auth can-i 验证', 140, 210, t, .2, { eyebrow: 'VERIFY', color: COL })
    terminal(140, 280, 1040, 560, t, CAN, { size: 20, cps: 40, title: '--as 模拟身份', alpha: E.out(P(t, .4, .9)) })
    // 右：权限表
    const pa = E.out(P(t, 1.2, 1.7))
    withA(pa, () => {
      panel(1240, 280, 540, 390, { r: 18 })
      txt('dev-wang 的有效权限', 1270, 328, { size: 22, weight: 600 })
      line(1240, 350, 1780, 350, C.hair, 1)
    })
    PERM.forEach(([n, s, t0, ok], i) => {
      const y = 400 + i * 72, a = E.out(P(t, 1.6 + i * .2, 2.1 + i * .2)); if (a <= 0) return
      const done = t >= t0
      withA(a, () => {
        txt(n, 1270, y, { size: 21, color: done ? C.text : C.body })
        txt(s, 1270, y + 26, { size: 16, font: MONO, color: C.mute })
      })
      if (done) ok ? check(1740, y - 4, 26, C.green, P(t, t0, t0 + .4)) : cross(1740, y - 4, 22, C.red, E.out(P(t, t0, t0 + .3)))
      else withA(a, () => dot(1740, y - 4, 5, C.hairD, 0))
    })
    chip('403 Forbidden', 1240, 720, { size: 22, col: C.red, solid: true, align: 'left', alpha: E.out(P(t, 11.5, 12)) })
    withA(E.out(P(t, 12.6, 13.1)), () => {
      txt('排查 403 最快：任意命令加 --as', 1240, 790, { size: 20, color: C.body })
      txt('删 RoleBinding 即回收权限', 1240, 830, { size: 20, color: C.body })
    })
  },
}

ANIM({
  id: 'rbac',
  meta: { stage: 3, lesson: 3, of: 6, title: '认证、授权与 RBAC', summary: 'User 与 ServiceAccount、Role/ClusterRole、最小权限实践。', next: '工作负载安全加固' },
  scenes: [
    lessonIntro({ tags: ['认证', 'ServiceAccount', 'Role', 'RoleBinding', 'can-i'], vo: [[3.2, '你是谁？你能做什么？apiserver 的两道关。', '你是谁？你能做什么？API Server 的两道关。']] }),
    authn, token, rbac4, crole, cani,
    lessonOutro({
      points: ['身份来自凭据：证书、Token、OIDC，没有 User 对象', '投射 Token：短期、绑定 Pod、带受众', 'RBAC 四对象：只允许、取并集、默认拒绝', 'ClusterRole + RoleBinding：按命名空间复用'],
      vo: [[0.8, '小结：认证认出你，RBAC 决定你能做什么。'], [5.6, '下一课，工作负载安全加固。']],
    }),
  ],
})
})()
