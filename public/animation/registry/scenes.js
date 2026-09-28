/* 第 4 阶段 · 第 6 课：镜像仓库与镜像分发 */
(() => {
const COL = STAGES[4].color

// 场景 1：一次镜像拉取经过了什么
const MIR = [['①', 'Spegel', '本机 / 邻居节点', C.violet], ['②', '内网镜像站', 'mirror.example.com', C.teal], ['③', '上游仓库', 'registry-1.docker.io', C.blue]]
const MY = [370, 480, 590]
const LAY = ['manifest', 'layer 1', 'layer 2', 'layer 3']
const pull = {
  name: '一次拉取', dur: 17, mood: 1,
  vo: [[0.6, 'kubelet 经 CRI 让 containerd 拉镜像。', 'kubelet 通过 CRI 让 containerd 拉镜像。'],
    [4.8, '按主机名找到 hosts.toml，依次尝试镜像源。', '按主机名找到 hosts toml，依次尝试镜像源。'],
    [9.0, 'Spegel 没有，就去内网镜像站。'],
    [12.4, '拿到 manifest 和各层，解压后启动容器。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'tick'], [1.6, 'pop'], [3.0, 'key'], [4.8, 'tick'], [5.4, 'pop'], [6.0, 'pop'], [6.4, 'pop'], [6.8, 'pop'],
    [8.8, 'whoosh'], [9.6, 'error'], [10.0, 'whoosh'], [10.8, 'ok'], ...LAY.map((_, i) => [12.4 + i * .35, 'pop']), [14.6, 'chime']],
  draw(t) {
    heading('一次镜像拉取经过了什么', 140, 210, t, .2, { eyebrow: 'PULL PATH', color: COL })
    const ka = E.out(P(t, .8, 1.3))
    box(250, 370, 220, 90, 'kubelet', '节点代理', C.blue, { alpha: ka, size: 28 })
    const ca = E.out(P(t, 1.4, 1.9))
    arrow(362, 370, 486, 370, ca, hexA(C.text, .35), 2.5)
    withA(ca, () => txt('CRI', 424, 354, { size: 18, font: MONO, color: C.mute, align: 'center' }))
    box(620, 370, 260, 100, 'containerd', '容器运行时', COL, { alpha: E.out(P(t, 1.6, 2.1)), size: 30, hi: t >= 1.6 && t < 4.8 })
    // 解析镜像名
    const na = E.out(P(t, 3.0, 3.5))
    if (na > 0) withA(na, () => {
      txt('解析镜像名', 140, 468, { size: 18, color: C.mute })
      const seg = [['docker.io', COL], ['/library/nginx', C.text], [':1.27', C.blue]]
      const ws = seg.map(([s]) => textW(s, 30, { font: MONO, weight: 600 }))
      let x = 440 - ws.reduce((a, b) => a + b) / 2
      const hx = x, hp = E.out(P(t, 4.8, 5.3))
      if (hp > 0) { ctx.save(); ctx.globalAlpha *= hp; ctx.fillStyle = tint(COL, .2); rr(x - 8, 490, ws[0] + 16, 46, 10); ctx.fill(); ctx.restore() }
      seg.forEach(([s, c], i) => { txt(s, x, 523, { size: 30, font: MONO, color: c, weight: 600 }); x += ws[i] })
      withA(hp, () => txt('仓库主机名 · 省略时默认 docker.io', hx - 8, 572, { size: 18, color: C.body }))
    })
    const da = E.out(P(t, 5.4, 5.9))
    arrow(440, 588, 440, 632, da, hexA(COL, .6), 2.5)
    doc(440, 680, 600, 84, '/etc/containerd/certs.d/docker.io/hosts.toml', COL, { alpha: da, ext: '.toml', size: 19 })
    // mirror 列表
    const la = E.out(P(t, 5.8, 6.4))
    withA(la, () => txt('按顺序尝试 mirror', 1000, 306, { size: 20, color: C.mute }))
    partialLine(750, 370, 1000, 370, la, hexA(C.text, .25), 2)
    partialLine(900, 370, 900, 590, la, hexA(C.text, .25), 2)
    partialLine(900, 480, 1000, 480, la, hexA(C.text, .25), 2)
    partialLine(900, 590, 1000, 590, la, hexA(C.text, .25), 2)
    MIR.forEach(([n, name, sub, c], i) => {
      const a = E.out(P(t, 6.0 + i * .4, 6.5 + i * .4)); if (a <= 0) return
      const y = MY[i]
      const st = i === 0 ? (t >= 9.6 ? 'miss' : '') : i === 1 ? (t >= 10.8 ? 'hit' : '') : (t >= 11.2 ? 'skip' : '')
      const on = (i === 0 && t >= 8.8 && t < 9.6) || (i === 1 && t >= 10 && t < 10.8) || st === 'hit'
      withA(a, () => {
        panel(1000, y - 45, 780, 90, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: st === 'hit' ? tint(c, .08) : C.panel })
        txt(n, 1042, y + 10, { size: 28, color: c, align: 'center', weight: 600 })
        txt(name, 1080, y + 9, { size: 26, weight: 600, color: st === 'miss' ? C.mute : C.text })
        txt(sub, 1250, y + 8, { size: 19, font: MONO, color: C.mute })
        if (st === 'miss') chip('未命中', 1756, y, { size: 18, col: C.red, align: 'right', font: SANS })
        if (st === 'hit') chip('命中', 1756, y, { size: 18, col: C.green, align: 'right', solid: true, font: SANS })
        if (st === 'skip') chip('都失败才回源', 1756, y, { size: 18, col: C.blue, align: 'right', font: SANS })
      })
    })
    travelPath([[750, 370], [1000, 370]], P(t, 8.8, 9.5), C.violet)
    ring(1000, 370, P(t, 9.5, 10.2), C.red, 60)
    travelPath([[750, 370], [900, 370], [900, 480], [1000, 480]], P(t, 10.0, 10.8), C.teal)
    // manifest 与各层 → snapshotter → 容器
    const sa = E.out(P(t, 12.2, 12.7))
    LAY.forEach((s, i) => {
      const p = E.inOut(P(t, 12.4 + i * .35, 13.0 + i * .35)); if (p <= 0) return
      chip(s, lerp(1390, 1040 + i * 120, p), lerp(528, 690, p), { size: 17, col: i ? C.teal : C.violet, alpha: clamp(p * 3) })
    })
    arrow(1250, 712, 1250, 740, E.out(P(t, 13.8, 14.1)), hexA(C.green, .6), 2.5)
    box(1250, 790, 320, 90, 'snapshotter', '解压各层', C.green, { alpha: sa, size: 28, hi: t >= 13.8 && t < 14.8 })
    const pa = E.back(P(t, 14.6, 15.1))
    arrow(1412, 790, 1556, 790, E.out(P(t, 14.3, 14.7)), hexA(C.green, .6), 2.5)
    pod(1620, 790, 110, { state: 'run', label: 'nginx:1.27', alpha: clamp(pa), scale: clamp(pa) })
    ring(1620, 790, P(t, 14.8, 15.8), C.green, 120)
    withA(E.out(P(t, 15.2, 15.7)), () => txt('本课后面的配置，都是在这条链路上「插入一环」', 140, 820, { size: 21, color: C.body }))
  },
}

// 场景 2：Registry 还是 Harbor
const FEAT = [
  ['认证', 'htpasswd · 单一账号池', 'RBAC · LDAP / OIDC'],
  ['多租户', '无项目隔离', '项目级权限与配额'],
  ['上游代理', '不支持 · 手工同步', 'proxy cache 代理上游'],
  ['扫描 · 签名', '无', 'Trivy 扫描 · 镜像签名'],
  ['资源开销', '低 · 单 Deployment + PVC', '高 · 需 PostgreSQL + Redis'],
]
const HB = [['core', 1150, 400], ['portal', 1290, 400], ['jobservice', 1150, 466], ['registry', 1290, 466]]
const choose = {
  name: 'Registry 与 Harbor', dur: 16, mood: 2,
  vo: [[0.6, '私有仓库二选一：Registry 或 Harbor。'],
    [4.6, 'Registry 就一个服务加一块存储，很轻。'],
    [8.6, 'Harbor 带 RBAC、代理缓存和漏洞扫描。', 'Harbor 带权限、代理缓存和漏洞扫描。'],
    [12.4, '缺省用 Registry，有需求再上 Harbor。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.6, 'pop'], ...HB.map((_, i) => [1.8 + i * .15, 'tick']), [2.4, 'pop'], ...FEAT.map((_, i) => [4.6 + i * .5, 'tick']), [8.6, 'shimmer'], [12.4, 'chime']],
  draw(t) {
    heading('私有仓库：Registry 还是 Harbor', 140, 210, t, .2, { eyebrow: 'REGISTRY VS HARBOR', color: COL })
    const la = E.out(P(t, .8, 1.3)), ra = E.out(P(t, 1.6, 2.1))
    const lh = (t >= 4.6 && t < 8.6) || t >= 12.4, rh = t >= 8.6 && t < 12.4
    ;[[140, 'Registry', '缺省', C.blue, la, lh], [1060, 'Harbor', '备选', C.teal, ra, rh]].forEach(([x, n, tag, c, a, on]) => withA(a, () => {
      panel(x, 280, 720, 486, { r: 20, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .04) : C.panel })
      txt(n, x + 36, 338, { size: 34, weight: 600 })
      chip(tag, x + 684, 326, { size: 18, col: c, align: 'right', solid: tag === '缺省', font: SANS })
    }))
    // 左：单服务 + 单 PVC
    withA(la, () => {
      box(330, 430, 240, 76, 'registry:3', null, C.blue, { size: 26 })
      line(450, 430, 505, 430, hexA(C.blue, .5), 2)
      cylinder(560, 425, 110, 56, C.blue, 'PVC')
    })
    // 右：多组件 + 外部依赖
    HB.forEach(([n, x, y], i) => box(x, y, 130, 54, n, null, C.teal, { alpha: E.out(P(t, 1.8 + i * .15, 2.2 + i * .15)), size: 20 }))
    withA(E.out(P(t, 2.4, 2.9)), () => {
      line(1355, 433, 1428, 433, hexA(C.teal, .5), 2)
      cylinder(1480, 425, 100, 56, C.teal, 'PostgreSQL')
      cylinder(1650, 425, 100, 56, C.teal, 'Redis')
    })
    // 对比行
    FEAT.forEach(([k, l, r], i) => {
      const a = E.out(P(t, 4.6 + i * .5, 5.1 + i * .5)); if (a <= 0) return
      const y = 566 + i * 44
      withA(a, () => {
        if (i) { line(170, y - 29, 830, y - 29, C.hair, 1); line(1090, y - 29, 1750, y - 29, C.hair, 1) }
        txt(k, 960, y, { size: 20, color: C.mute, align: 'center' })
        txt(l, 500, y, { size: 22, color: C.body, align: 'center' })
        txt(r, 1420, y, { size: 22, color: rh ? C.text : C.body, align: 'center', weight: rh ? 600 : 500 })
      })
    })
    chip('缺省 Registry，有明确需求再上 Harbor', 960, 838, { size: 26, col: COL, color: C.text, font: SANS, alpha: E.out(P(t, 12.4, 12.9)) })
  },
}

// 场景 3：hosts.toml
const TREE = ['├─ docker.io/hosts.toml', '├─ registry.k8s.io/hosts.toml', '├─ nvcr.io/hosts.toml', '└─ cr.example.com/', '    ├─ hosts.toml', '    └─ ca.crt']
const HT = ['server = "https://registry-1.docker.io"', '', '[host."https://mirror.example.com/v2/docker.io"]', '  capabilities = ["pull", "resolve"]', '  override_path = true']
const hosts = {
  name: 'hosts.toml', dur: 16, mood: 3,
  vo: [[0.6, '按主机名分目录，每个目录一份 hosts.toml。', '按主机名分目录，每个目录一份 hosts toml。'],
    [5.0, 'server 是回源地址，host 是镜像源。'],
    [9.2, 'hosts.toml 改完无需重启即生效。', 'hosts toml 改完，无需重启就生效。'],
    [12.8, 'Kubespray 用一个变量下发到所有节点。']],
  cues: [[0.4, 'whoosh'], ...TREE.map((_, i) => [.8 + i * .15, 'tick']), [2.6, 'pop'], [3.0, 'whoosh'], [5.0, 'pop'], [6.6, 'pop'], [8.0, 'pop'], [9.4, 'ok'], [10.2, 'alarmSoft'], [12.6, 'whoosh'], [13.4, 'chime']],
  draw(t) {
    heading('hosts.toml：一个主机名一个目录', 140, 210, t, .2, { eyebrow: 'HOSTS.TOML', color: COL })
    // 目录树
    const ta = E.out(P(t, .6, 1.1))
    withA(ta, () => {
      panel(140, 280, 600, 340, { r: 16 })
      txt('/etc/containerd/certs.d/', 170, 326, { size: 21, font: MONO, weight: 600, color: C.text })
      line(140, 348, 740, 348, C.hair, 1)
      const hp = E.out(P(t, 2.6, 3.0))
      if (hp > 0) { ctx.save(); ctx.globalAlpha *= hp; ctx.fillStyle = tint(COL, .18); ctx.fillRect(142, 362, 596, 40); ctx.restore() }
    })
    TREE.forEach((s, i) => txt(s, 172, 390 + i * 40, { size: 21, font: MONO, color: i === 0 && t >= 2.6 ? C.text : C.body, alpha: E.out(P(t, .8 + i * .15, 1.2 + i * .15)) }))
    arrow(744, 382, 792, 382, E.out(P(t, 2.8, 3.2)), hexA(COL, .6), 2.5)
    // hosts.toml 内容
    const hi = t >= 5.0 && t < 6.6 ? [0] : t >= 6.6 && t < 8.0 ? [2, 3] : t >= 8.0 && t < 9.2 ? [4] : []
    code(800, 280, 980, HT, t, 3.0, { title: 'docker.io/hosts.toml', size: 21, lh: 36, alpha: E.out(P(t, 2.9, 3.4)), hi, hiColor: COL })
    chip('全部 mirror 失败时回源', 1756, 369, { size: 17, col: C.blue, align: 'right', font: SANS, alpha: E.out(P(t, 5.0, 5.4)) })
    chip('按顺序尝试的镜像源', 1756, 441, { size: 17, col: C.teal, align: 'right', font: SANS, alpha: E.out(P(t, 6.6, 7.0)) })
    chip('URL 已含 /v2 时必须设置', 1756, 513, { size: 17, col: C.violet, align: 'right', font: SANS, alpha: E.out(P(t, 8.0, 8.4)) })
    // 生效方式
    ;[['hosts.toml 改动', '下次拉取即生效，无需重启', C.green, true], ['config.toml 改动', '需要重启 containerd', COL, false]].forEach(([n, s, c, ok], i) => {
      const t0 = 9.4 + i * .8, a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 660 + i * 112
      withA(a, () => {
        panel(140, y, 600, 96, { r: 16, stroke: hexA(c, .55), fill: tint(c, .06) })
        if (ok) check(190, y + 48, 32, c, P(t, t0 + .2, t0 + .6))
        else txt('!', 190, y + 60, { size: 36, weight: 700, color: c, align: 'center' })
        txt(n, 232, y + 42, { size: 23, font: MONO, weight: 600 })
        txt(s, 232, y + 76, { size: 20, color: C.body })
      })
    })
    // Kubespray 统一下发
    code(800, 650, 980, ['containerd_registries_mirrors:', '  - prefix: docker.io', '    mirrors:', '      - host: https://mirror.example.com/v2/docker.io'], t, 12.8,
      { title: 'Kubespray · group_vars/all/containerd.yml', size: 20, lh: 32, alpha: E.out(P(t, 12.6, 13.1)), hi: t >= 13.4 ? [0] : [], hiColor: C.blue })
    chip('生成每个节点的 hosts.toml', 1756, 739, { size: 17, col: C.blue, align: 'right', font: SANS, alpha: E.out(P(t, 13.4, 13.8)) })
  },
}

// 场景 4：imagePullSecrets
const SEC = [
  { t: 1.0, cmd: 'kubectl create secret docker-registry regcred \\' },
  { t: 2.8, out: '    --docker-server=cr.example.com \\', color: C.text },
  { t: 3.0, out: '    --docker-username=ci-bot --docker-password=*** -n demo', color: C.body },
  { t: 5.4, cmd: 'kubectl -n demo patch serviceaccount default \\' },
  { t: 7.0, out: `    -p '{"imagePullSecrets": [{"name": "regcred"}]}'`, color: C.text },
]
const secrets = {
  name: 'imagePullSecrets', dur: 17, mood: 2,
  vo: [[0.6, '凭据存成 docker-registry 类型的 Secret。', '凭据存成 docker registry 类型的 Secret。'],
    [5.4, '挂到默认 ServiceAccount，Pod 自动带上。', '挂到默认 Service Account，Pod 自动带上。'],
    [9.6, '有缓存能跑，换个节点就报 401。'],
    [13.4, '--docker-server 要和镜像主机名完全一致。', 'docker server 要和镜像主机名完全一致。']],
  cues: [[0.4, 'whoosh'], ...typeCues(SEC, 30), [5.6, 'pop'], [7.2, 'lock'], [7.8, 'whoosh'], [8.8, 'ok'], [9.6, 'pop'], [9.9, 'pop'], [10.2, 'ok'], [10.6, 'whoosh'], [11.4, 'error'], [12.0, 'alarmSoft'], [13.4, 'pop'], [14.0, 'ok'], [14.4, 'error']],
  draw(t) {
    heading('imagePullSecrets：Pod 拉取私有镜像', 140, 210, t, .2, { eyebrow: 'IMAGEPULLSECRETS', color: COL })
    terminal(140, 280, 1000, 270, t, SEC, { size: 20, alpha: E.out(P(t, .5, 1)) })
    chip('必须与镜像主机名完全一致', 596, 398, { size: 17, col: C.red, align: 'left', font: SANS, alpha: E.out(P(t, 13.4, 13.8)) })
    // 命名空间 demo：SA 自动注入
    const nsa = E.out(P(t, 5.6, 6.1))
    withA(nsa, () => {
      panel(1180, 280, 600, 270, { r: 18, dash: [10, 8], stroke: hexA(C.blue, .5), fill: tint(C.blue, .03), shadow: false })
      chip('namespace: demo', 1210, 280, { size: 17, col: C.blue, align: 'left' })
      box(1330, 390, 220, 84, 'ServiceAccount', 'default', C.blue, { size: 25 })
    })
    const ka = E.out(P(t, 7.2, 7.6))
    withA(ka, () => {
      line(1330, 432, 1330, 458, hexA(COL, .6), 2)
      lock(1276, 482, 22, COL)
      chip('regcred', 1300, 482, { size: 18, col: COL, color: C.text, align: 'left' })
    })
    const ia = E.out(P(t, 7.8, 8.3))
    arrow(1444, 390, 1592, 390, ia, hexA(C.blue, .55), 2.5)
    withA(ia, () => txt('自动注入', 1518, 372, { size: 16, color: C.mute, align: 'center' }))
    travel(1444, 390, 1600, 390, P(t, 8.0, 8.8), COL, 7)
    pod(1660, 392, 96, { state: t >= 8.8 ? 'run' : 'pending', label: 'private-app', alpha: ia })
    chip('imagePullSecrets ✓', 1660, 508, { size: 16, col: C.green, alpha: E.out(P(t, 8.8, 9.2)) })
    // 时好时坏：节点缓存掩盖凭据问题
    ;[[140, 'gn-192-168-1-11', ['镜像已在本地缓存', C.green], 'IfNotPresent · 不访问仓库'], [620, 'gn-192-168-1-12', ['本地没有这个镜像', COL], '真正去仓库拉取']].forEach(([x, n, [c1, cc], c2], i) => {
      const a = E.out(P(t, 9.6 + i * .3, 10.1 + i * .3)); if (a <= 0) return
      node(x, 590, 440, 270, n, { alpha: a })
      withA(a, () => {
        chip(c1, x + 28, 674, { size: 17, col: cc, color: C.text, align: 'left', font: SANS })
        chip(c2, x + 28, 720, { size: 17, col: C.mute, align: 'left', font: SANS })
        if (i === 0) {
          const ok = t >= 10.2
          pod(x + 330, 745, 90, { state: ok ? 'run' : 'pending', label: 'app' })
          txt(ok ? 'Running' : 'Pending', x + 330, 836, { size: 16, font: MONO, color: ok ? C.green : C.amber, align: 'center' })
        } else {
          const bad = t >= 12.0, sh = bad ? Math.sin(t * 70) * 6 * (1 - P(t, 12, 12.5)) : 0
          pod(x + 330, 745, 90, { state: bad ? 'fail' : 'pending', label: 'app', shake: sh })
          txt(bad ? 'ImagePullBackOff' : 'Pulling…', x + 330, 836, { size: 16, font: MONO, color: bad ? C.red : C.amber, align: 'center' })
          ring(x + 330, 745, P(t, 12, 12.9), C.red, 110)
        }
      })
    })
    check(530, 640, 26, C.green, P(t, 10.2, 10.6))
    // 私有仓库
    const ga = E.out(P(t, 10.4, 10.9))
    box(1250, 660, 240, 84, 'cr.example.com', '私有仓库', C.violet, { alpha: ga, size: 25 })
    arrow(1064, 676, 1126, 660, ga, hexA(C.text, .3), 2)
    travel(1064, 676, 1128, 660, P(t, 10.6, 11.3), COL, 6)
    travel(1128, 690, 1064, 706, P(t, 11.4, 12.0), C.red, 6)
    chip('HTTP 401 Unauthorized', 1250, 742, { size: 17, col: C.red, alpha: E.out(P(t, 11.4, 11.8)) })
    // 主机名匹配规则
    const ma = E.out(P(t, 13.4, 13.9))
    withA(ma, () => {
      panel(1420, 590, 360, 270, { r: 16 })
      txt('凭据按主机名匹配', 1446, 632, { size: 20, color: C.text, weight: 600 })
      txt('image: cr.example.com/team-a/app', 1446, 672, { size: 16, font: MONO, color: C.mute })
      txt('--docker-server 取值', 1446, 712, { size: 16, font: MONO, color: C.mute })
      chip('cr.example.com', 1446, 756, { size: 19, col: C.green, align: 'left' })
      chip('cr.example.com:443', 1446, 818, { size: 19, col: C.red, align: 'left' })
    })
    check(1740, 756, 26, C.green, P(t, 14.0, 14.4))
    cross(1740, 818, 22, C.red, E.out(P(t, 14.4, 14.7)))
  },
}

// 场景 5：P2P 分发
const NX = c => 220 + c * 140, NRX = c => 1110 + c * 140, NY = [520, 630]
function mini(x, y, p, c, done) {
  panel(x - 55, y - 40, 110, 80, { r: 12, shadow: false, fill: '#ffffff', stroke: done ? hexA(c, .6) : C.hair })
  cube(x, y - 4, 13, done ? c : C.faint)
  ctx.save(); rr(x - 40, y + 22, 80, 8, 4); ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fill()
  if (p > 0) { rr(x - 40, y + 22, 80 * clamp(p), 8, 4); ctx.fillStyle = c; ctx.fill() }
  ctx.restore()
}
const p2p = {
  name: 'P2P 分发', dur: 16, mood: 4,
  vo: [[0.6, '100 节点各拉 20GB，仓库要吐出 2TB。', '一百个节点各拉 20 GB，仓库要吐出 2 TB。'],
    [5.2, 'Spegel 让节点之间互相分享已有的层。'],
    [9.4, 'Dragonfly 支持预热和任意文件。'],
    [13.0, '两者部署其一，缺省选 Spegel。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.6, 'swell'], [3.2, 'alarmSoft'], [5.4, 'pop'], [6.0, 'whoosh'], [7.0, 'shimmer'], [8.8, 'pop'], [9.6, 'pop'], [13.0, 'chime']],
  draw(t) {
    heading('P2P 分发：节点之间互相给', 140, 210, t, .2, { eyebrow: 'P2P DISTRIBUTION', color: COL })
    // 左：直连仓库
    const la = E.out(P(t, .8, 1.3))
    withA(la, () => {
      txt('直连仓库', 140, 300, { size: 22, weight: 600, color: C.text })
      box(500, 360, 260, 76, 'Registry', null, C.violet, { size: 28 })
      meter(650, 380, 200, 12, E.out(P(t, 1.6, 2.6)), C.red, { label: '出口', value: t >= 2.2 ? '2 TB' : '', size: 18 })
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        const x = NX(c), y = NY[r], k = r * 5 + c
        if (t > 1.6) { line(500, 398, x, y - 40, hexA(C.red, .16), 1.5); flow(500, 398, x, y - 40, t, C.red, 2, .5, rnd(k), 3.5) }
        mini(x, y, P(t, 1.6, 16) * (.42 + rnd(k + 3) * .12), C.red, false)
      }
    })
    withA(E.out(P(t, 3.2, 3.7)), () => txt('100 节点 × 20GB = 2TB 出口流量', 500, 710, { size: 22, color: C.red, align: 'center', weight: 600 }))
    withA(la, () => line(930, 290, 930, 700, C.hair, 1.5, [8, 8]))
    // 右：Spegel
    const ra = E.out(P(t, 5.4, 5.9))
    withA(ra, () => {
      txt('P2P · Spegel', 1000, 300, { size: 22, weight: 600, color: C.text })
      box(1390, 360, 260, 76, 'Registry', null, C.violet, { size: 28 })
      meter(1540, 380, 200, 12, E.out(P(t, 6.0, 6.8)) * .1, C.teal, { label: '出口', value: t >= 6.4 ? '≈ 20 GB' : '', size: 18 })
      if (t > 6.0 && t < 7.6) { line(1390, 398, NRX(0), NY[0] - 40, hexA(C.teal, .3), 2); flow(1390, 398, NRX(0), NY[0] - 40, t, C.teal, 3, .9, 0, 4) }
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        const x = NRX(c), y = NY[r], d = c + r, t0 = c + r === 0 ? 6.0 : 6.8 + d * .35 + rnd(c * 7 + r) * .3
        const p = P(t, t0, t0 + (d ? 1.1 : 1.4))
        if (d && t > t0 && p < 1) {
          const [sx, sy] = c > 0 ? [NRX(c - 1) + 55, y] : [x, NY[0] + 40]
          const [ex, ey] = c > 0 ? [x - 55, y] : [x, y - 40]
          line(sx, sy, ex, ey, hexA(C.teal, .35), 2); flow(sx, sy, ex, ey, t, C.teal, 2, 1.2, 0, 3.5)
        }
        mini(x, y, p, C.teal, p >= 1)
      }
    })
    withA(E.out(P(t, 7.6, 8.1)), () => txt('节点之间互相分享已有的层', 1390, 710, { size: 22, color: C.teal, align: 'center', weight: 600 }))
    // 两种方案
    const one = t >= 13.0
    ;[[140, 'Spegel', '缺省', C.teal, '单个 DaemonSet · 无中心 · 复用本地层', 'containerd_discard_unpacked_layers: false', 8.8],
      [980, 'Dragonfly', '备选', C.violet, '支持预热 · 模型权重等任意文件', 'manager / scheduler / seed + MySQL + Redis', 9.6]].forEach(([x, n, tag, c, s, k, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const on = one && i === 0
      withA(a, () => {
        panel(x, 746, 800, 126, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel })
        txt(n, x + 32, 786, { size: 26, weight: 600 })
        chip(tag, x + 48 + textW(n, 26, { weight: 600 }), 777, { size: 16, col: c, align: 'left', solid: i === 0, font: SANS })
        txt(s, x + 32, 822, { size: 20, color: C.body })
        txt(k, x + 32, 854, { size: 17, font: MONO, color: C.mute })
      })
    })
    chip('两者只部署其一', 960, 710, { size: 20, col: COL, color: C.text, font: SANS, alpha: E.out(P(t, 13.0, 13.5)) })
  },
}

ANIM({
  id: 'registry',
  meta: { stage: 4, lesson: 6, of: 8, title: '镜像仓库与镜像分发', summary: 'Registry 与 Harbor 选型、P2P 分发（Spegel / Dragonfly）、镜像加速。', next: 'Day-2 运维：升级、扩容与 etcd 维护' },
  scenes: [
    lessonIntro({ tags: ['Registry', 'Harbor', 'hosts.toml', 'imagePullSecrets', 'Spegel'], vo: [[3.2, '镜像从哪来、怎么拉得快，是生产集群的基础设施。']] }),
    pull, choose, hosts, secrets, p2p,
    lessonOutro({
      points: ['缺省用 Registry，有明确需求再上 Harbor', 'hosts.toml 按主机名配置镜像源，改完即生效', 'imagePullSecrets 管凭据，主机名要完全一致', 'P2P 分发：缺省 Spegel，需要预热换 Dragonfly'],
      vo: [[0.8, '小结：镜像链路上的每一环，都可以加速。'], [5.6, '下一课，Day-2 运维：升级与 etcd 维护。', '下一课，Day 2 运维：升级与 etcd 维护。']],
    }),
  ],
})
})()
