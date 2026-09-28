/* 第 5 阶段 · 第 5 课：多租户与平台工程 */
(() => {
const COL = STAGES[5].color

function sq(x, y, w, h, col, a = 1, o = {}) { // 圆角色块
  if (a <= 0) return
  withA(a, () => { ctx.save(); rr(x, y, w, h, o.r ?? 10); ctx.fillStyle = o.fill || tint(col, .14); ctx.fill(); if (o.stroke !== false) { ctx.strokeStyle = o.border || hexA(col, .6); ctx.lineWidth = o.lw || 1.5; if (o.dash) ctx.setLineDash(o.dash); ctx.stroke() } ctx.restore() })
}
const rise = (a, d = 18) => lerp(d, 0, a)

// 场景 1：隔离的层次
const COLS = [
  ['命名空间租户', 'Namespace + RBAC', ['共享', '共享', '共享'], '控制平面、节点、CRD', '只部署应用', C.blue],
  ['虚拟集群', 'vcluster / k3k', ['虚拟 apiserver', '共享', '共享'], '节点、CNI、存储', '装 CRD，拿 cluster-admin', C.violet],
  ['托管控制平面', 'Kamaji', ['托管在管理集群', '租户自己的', '租户自己的'], '管理集群', '独立控制平面 + 自有节点', C.teal],
  ['独立集群', '每租户一套', ['独立', '独立', '独立'], '几乎不共享', '完整集群，成本最高', C.green],
]
const LAYERS = ['控制平面', '工作节点', 'CNI / 存储']
const spectrum = {
  name: '隔离的层次', dur: 17, mood: 1,
  vo: [[0.6, '多租户：让多个团队安全共享一套集群。'],
    [5.4, '隔离从弱到强：命名空间、虚拟集群、托管控制平面。'],
    [11.2, '选型看两点：要不要集群级权限，彼此是否信任。']],
  cues: [[0.6, 'whoosh'], [1.0, 'tick'], [1.3, 'tick'], [1.6, 'tick'], [1.9, 'tick'], [5.6, 'pop'], [6.8, 'pop'], [8.0, 'pop'], [9.2, 'pop'], [11.4, 'ding1'], [12.6, 'ding2']],
  draw(t) {
    heading('隔离的层次：从弱到强', 140, 210, t, .2, { eyebrow: 'ISOLATION', color: COL })
    const aa = E.out(P(t, .8, 1.4))
    withA(aa, () => {
      partialLine(560, 262, 1760, 262, aa, hexA(COL, .6), 3); arrowHead(1768, 262, 0, COL, 14)
      txt('隔离强度', 140, 270, { size: 22, weight: 600, color: COL })
      txt('弱', 520, 270, { size: 20, color: C.mute, align: 'right' }); txt('强', 1780, 300, { size: 20, color: C.mute, align: 'right' })
    })
    COLS.forEach(([name, sub, cells, shared, can, c], i) => {
      const x = 140 + i * 420, a = E.out(P(t, 1 + i * .3, 1.5 + i * .3)); if (a <= 0) return
      const on = E.out(P(t, 5.6 + i * 1.2, 6.2 + i * 1.2)), cur = t >= 5.6 + i * 1.2 && t < 6.8 + i * 1.2
      withA(a, () => {
        panel(x, 316 + rise(a), 380, 452, { r: 18, stroke: cur ? c : C.hair, lw: cur ? 2.5 : 1.5 })
        const y0 = 316 + rise(a)
        txt(name, x + 24, y0 + 48, { size: 28, weight: 600 })
        txt(sub, x + 24, y0 + 80, { size: 18, font: MONO, color: C.mute })
        cells.forEach((s, k) => {
          const y = y0 + 104 + k * 84, own = s !== '共享'
          sq(x + 20, y, 340, 72, own ? c : C.faint, 1, { fill: own ? tint(c, .06 + .14 * on) : 'rgba(0,0,0,0.035)', border: own ? hexA(c, .25 + .5 * on) : C.hair })
          txt(LAYERS[k], x + 38, y + 28, { size: 16, color: C.mute })
          txt(on > 0 ? s : '—', x + 38, y + 58, { size: 21, weight: own ? 600 : 400, color: own ? tint(c, 1) : C.body, alpha: own ? .4 + .6 * on : 1 })
        })
        withA(on, () => {
          txt('共享：' + shared, x + 24, y0 + 386, { size: 18, color: C.body })
          txt('租户能：' + can, x + 24, y0 + 420, { size: 18, color: c })
        })
      })
    })
    // 底部：租户 → 两个问题
    const q = E.out(P(t, 11.2, 11.8))
    withA(E.out(P(t, 1.4, 2)) * (1 - q), () => {
      let x = 140
      ;[['算法组 · 训练', C.blue], ['推理组 · 在线服务', C.violet], ['外部合作方 · 临时借卡', C.amber]].forEach(([s, c]) => { user(x + 14, 846, 11, c); x += chip(s, x + 40, 842, { size: 20, col: c, align: 'left', font: SANS }) + 70 })
      txt('→ 同一套 GPU 集群', x, 850, { size: 22, color: C.body })
    })
    chip('① 租户需要集群级权限吗？', 560, 842, { size: 24, col: COL, font: SANS, alpha: E.out(P(t, 11.4, 11.9)) })
    chip('② 租户之间互相信任吗？', 1360, 842, { size: 24, col: COL, font: SANS, alpha: E.out(P(t, 12.6, 13.1)) })
  },
}

// 场景 2：命名空间租户标配
const KIT = [
  ['RoleBinding', '租户组 → admin / edit', '绑定内置 ClusterRole', C.blue],
  ['ResourceQuota', '限制 CPU、内存、GPU', '还能限 PVC 与对象数', COL],
  ['LimitRange', '给容器兜底默认值', '没写 requests 也有', C.amber],
  ['NetworkPolicy', '默认拒绝跨命名空间', 'deny-all + 白名单', C.teal],
  ['LocalQueue', '训练任务排队入口', 'Kueue · 见「批调度」', C.violet],
]
const QY = [
  'kind: ResourceQuota',
  'metadata:',
  '  namespace: team-a',
  'spec:',
  '  hard:',
  '    requests.cpu: "64"',
  '    requests.memory: 512Gi',
  '    requests.nvidia.com/gpu: "8"',
]
const JOBS = [[11.6, 0, 4, 'job-a'], [12.6, 4, 4, 'job-b']]
const kit = {
  name: '命名空间租户', dur: 16, mood: 2,
  vo: [[0.6, '命名空间租户，是一套标配资源的组合。'],
    [5.6, 'RBAC 管权限，Quota 和 LimitRange 管资源。', 'RBAC 管权限，Quota 和 Limit Range 管资源。'],
    [10.8, 'GPU 配额只能写 requests 前缀。', 'GPU 配额只能写 requests 开头的键。']],
  cues: [[0.6, 'whoosh'], [1.0, 'pop'], ...KIT.map((_, i) => [1.6 + i * .35, 'tick']), [5.6, 'ding1'], [7.2, 'ding2'], [10.8, 'zap'], [11.6, 'pop'], [12.6, 'pop'], [13.8, 'error']],
  draw(t) {
    heading('命名空间租户：一套标配', 140, 210, t, .2, { eyebrow: 'NAMESPACE TENANT', color: COL })
    const fa = E.out(P(t, .6, 1.1))
    withA(fa, () => {
      panel(140, 280, 850, 590, { r: 24, fill: hexA(COL, .03), stroke: hexA(COL, .55), dash: [12, 9], lw: 2, shadow: false })
      chip('Namespace · team-a', 565, 280, { size: 20, col: COL, solid: true })
      chip('pod-security.kubernetes.io/enforce: restricted', 565, 336, { size: 17, col: C.red, alpha: E.out(P(t, 1, 1.4)) })
      txt('PSS 标签', 565, 376, { size: 16, color: C.mute, align: 'center', alpha: E.out(P(t, 1, 1.4)) })
    })
    const hi = i => (t >= 5.6 && t < 7.2 && i === 0) || (t >= 7.2 && t < 10.8 && (i === 1 || i === 2)) || (t >= 10.8 && i === 1)
    KIT.forEach(([n, d, s, c], i) => {
      const a = E.out(P(t, 1.6 + i * .35, 2.1 + i * .35)); if (a <= 0) return
      const x = 170 + (i % 2) * 410, y = 404 + Math.floor(i / 2) * 150 + rise(a), on = hi(i)
      withA(a, () => {
        panel(x, y, 380, 132, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .07) : C.panel })
        chip(n, x + 20, y + 34, { size: 19, col: c, solid: on, align: 'left' })
        txt(d, x + 20, y + 84, { size: 21, color: C.text })
        txt(s, x + 20, y + 114, { size: 16, color: C.mute })
      })
    })
    const ta = E.out(P(t, 3.6, 4.1))
    withA(ta, () => {
      panel(580, 704 + rise(ta), 380, 132, { r: 16, fill: hexA(C.text, .02), stroke: C.hairD, dash: [8, 7], shadow: false })
      txt('租户一多：做成 Helm / Kustomize', 600, 758 + rise(ta), { size: 19, color: C.body })
      txt('模板，用 GitOps 批量下发', 600, 790 + rise(ta), { size: 19, color: C.body })
    })
    // 右侧：GPU 配额
    code(1040, 270, 740, QY, t, 1.2, { title: 'tenant-quota.yaml', size: 20, step: .1, hi: t >= 10.8 ? [7] : t >= 7.2 ? [4] : [], hiColor: COL, alpha: E.out(P(t, 1, 1.5)) })
    const ga = E.out(P(t, 10.8, 11.3))
    withA(ga, () => {
      const lw = chip('limits.nvidia.com/gpu', 1040, 656, { size: 17, col: C.mute, align: 'left' })
      line(1052, 656, 1040 + lw - 12, 656, C.red, 2.5)
      txt('扩展资源只能限制 requests.', 1040 + lw + 20, 663, { size: 20, color: C.red })
      txt('team-a GPU 配额', 1040, 712, { size: 20, weight: 600 })
    })
    const used = JOBS.reduce((s, [a, , n]) => s + (t >= a ? n : 0), 0)
    withA(ga, () => txt(`已用 ${used} / 8`, 1780, 712, { size: 20, font: MONO, color: used >= 8 ? C.red : COL, align: 'right' }))
    for (let k = 0; k < 8; k++) {
      const j = JOBS.find(([a, s, n]) => t >= a && k >= s && k < s + n)
      const x = 1076 + k * 92, pk = j ? E.back(P(t, j[0] + (k - j[1]) * .06, j[0] + .3 + (k - j[1]) * .06)) : 0
      gpu(x, 762, 50 * (j ? lerp(.8, 1, clamp(pk)) : 1), j ? COL : C.faint, ga)
    }
    JOBS.forEach(([a, s, n, name]) => chip(`${name} · ${n} 卡`, 1076 + (s + n / 2 - .5) * 92, 816, { size: 16, col: COL, font: SANS, alpha: E.out(P(t, a, a + .3)) }))
    const rj = E.out(P(t, 13.8, 14.2))
    chip('job-c · 再要 2 卡 → exceeded quota，被拒绝', 1040, 864, { size: 17, col: C.red, solid: true, align: 'left', font: SANS, alpha: rj })
  },
}

// 场景 3：vcluster
const HIGH = ['Deployment web', 'StatefulSet db', 'CRD', 'RBAC']
const LOW = [['Pod web-x', 'Pod web-x-default-x-vcluster'], ['Service web', 'Service web-x-default-x-vcluster'], ['PVC data', 'PVC data-x-default-x-vcluster']]
const vcluster = {
  name: 'vcluster', dur: 17, mood: 3,
  vo: [[0.6, 'vcluster 在一个命名空间里跑整套控制平面。', 'V cluster 在一个命名空间里跑整套控制平面。'],
    [5.6, 'syncer 只把 Pod 等低层对象同步到宿主。', 'syncer 只把 Pod 这类低层对象同步到宿主。'],
    [11.2, '宿主侧的配额，租户改不掉，这才是真边界。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], [2.4, 'pop'], [5.6, 'tick'], [6.0, 'tick'], [7.0, 'zap'], [7.5, 'zap'], [8.0, 'zap'], [8.8, 'thud'], [11.2, 'lock'], [12.6, 'pop'], [13.8, 'error']],
  draw(t) {
    heading('vcluster：命名空间里的集群', 140, 210, t, .2, { eyebrow: 'VIRTUAL CLUSTER', color: COL })
    const va = E.out(P(t, .6, 1.1)), ha = E.out(P(t, 1.2, 1.7))
    chip('❯ 租户 kubectl · cluster-admin', 140, 290, { size: 18, col: C.text, align: 'left', alpha: va })
    arrow(260, 306, 260, 376, va, hexA(C.text, .4), 2)
    withA(va, () => {
      panel(140, 340, 720, 480, { r: 22, fill: hexA(C.violet, .03), stroke: hexA(C.violet, .55), dash: [12, 9], lw: 2, shadow: false })
      chip('虚拟集群 team-a · 租户视角', 540, 340, { size: 18, col: C.violet, solid: true, font: SANS })
      box(500, 418, 640, 64, 'apiserver · controller-manager · 数据存储', null, C.violet, { size: 21 })
    })
    withA(ha, () => {
      panel(1100, 340, 680, 480, { r: 22, stroke: C.hairD })
      chip('宿主集群 · ns: vc-team-a', 1440, 340, { size: 18, col: C.text, solid: true, bg: C.text })
    })
    // 控制平面本身就是宿主 ns 里的 StatefulSet
    const sa = E.out(P(t, 2.4, 2.9))
    chip('StatefulSet team-a · 运行虚拟控制平面', 1128, 404, { size: 17, col: C.violet, align: 'left', font: SANS, alpha: sa })
    withA(sa, () => line(820, 418, 1124, 404, hexA(C.violet, .45), 2, [6, 6]))
    // 高层 / 低层对象
    const oa = E.out(P(t, 5.6, 6.1))
    withA(oa, () => {
      txt('高层对象 · 只留在虚拟集群', 170, 496, { size: 18, color: C.mute })
      txt('低层对象 · 同步到宿主', 530, 496, { size: 18, color: C.mute })
    })
    HIGH.forEach((s, i) => {
      const a = E.out(P(t, 5.6 + i * .15, 6 + i * .15)), w = chip(s, 170, 546 + i * 58, { size: 18, col: C.violet, align: 'left', alpha: a })
      chip('不同步', 170 + w + 10, 546 + i * 58, { size: 15, col: C.mute, align: 'left', font: SANS, alpha: E.out(P(t, 8.8, 9.2)) })
    })
    LOW.forEach(([v, h], i) => {
      const y = 546 + i * 58, a = E.out(P(t, 6 + i * .15, 6.4 + i * .15))
      chip(v, 530, y, { size: 18, col: C.teal, align: 'left', alpha: a })
      const t0 = 7 + i * .5
      travelPath([[700, y], [980, 600], [1126, 500 + i * 56]], P(t, t0, t0 + .9), C.teal, 7)
      chip(h, 1128, 500 + i * 56, { size: 17, col: C.teal, align: 'left', alpha: E.out(P(t, t0 + .8, t0 + 1.1)) })
    })
    box(980, 600, 170, 84, 'syncer', '改名后同步', C.teal, { size: 24, alpha: E.out(P(t, 6.6, 7)), hi: t > 7 && t < 9 })
    withA(E.out(P(t, 9, 9.5)), () => txt('↑ 这些对象真正跑在宿主节点上', 1130, 662, { size: 17, color: C.mute }))
    // 宿主侧策略
    const pa = E.out(P(t, 11.2, 11.7))
    withA(pa, () => {
      sq(1120, 700, 640, 104, COL, 1, { fill: tint(COL, .06), r: 14 })
      lock(1154, 752, 30, COL)
      txt('policies · 建在宿主命名空间', 1186, 736, { size: 18, color: COL, weight: 600 })
      let x = 1186
      ;['ResourceQuota GPU ≤ 16', 'LimitRange', 'NetworkPolicy'].forEach(s => { x += chip(s, x, 776, { size: 16, col: COL, align: 'left' }) + 10 })
    })
    // 租户试图超额
    const ba = E.out(P(t, 12.6, 13))
    chip('Pod big-job · 32 GPU', 170, 782, { size: 18, col: C.red, align: 'left', alpha: ba })
    travelPath([[400, 782], [980, 660], [1112, 752]], P(t, 13, 13.8), C.red, 9)
    ring(1120, 752, P(t, 13.8, 14.6), C.red, 90)
    cross(1092, 752, 26, C.red, E.out(P(t, 13.8, 14)))
    chip('✗ 超出宿主配额：租户在虚拟集群里改不掉', 1440, 862, { size: 19, col: C.red, font: SANS, alpha: E.out(P(t, 14, 14.4)) })
  },
}

// 场景 4：Kamaji
const TCPS = ['tenant-a', 'tenant-b', 'tenant-c']
const kamaji = {
  name: 'Kamaji', dur: 16, mood: 3,
  vo: [[0.6, '租户是另一家公司？给它独立的控制平面。'],
    [5.4, 'Kamaji 把控制平面当成 Pod，跑在管理集群里。'],
    [11.0, '租户只提供工作节点，通过隧道连回来。']],
  cues: [[0.6, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [2.8, 'pop'], [5.4, 'whoosh'], [5.8, 'pop'], [6.2, 'pop'], [7.6, 'shimmer'], [11.0, 'zap'], ...typeCues([{ t: 11.8, cmd: 'kubectl get tcp -n tenants' }], 30), [13.4, 'ok']],
  draw(t) {
    heading('Kamaji：托管控制平面', 140, 210, t, .2, { eyebrow: 'HOSTED CONTROL PLANE', color: COL })
    const ma = E.out(P(t, 5.4, 5.9))
    withA(ma, () => {
      panel(140, 280, 1000, 590, { r: 24, fill: hexA(C.teal, .03), stroke: hexA(C.teal, .55), lw: 2, shadow: false })
      chip('管理集群 · Kamaji', 640, 280, { size: 19, col: C.teal, solid: true, font: SANS })
    })
    TCPS.forEach((n, i) => {
      const t0 = i === 2 ? 2.8 : 5.8 + i * .4, a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const x = 170 + i * 320, y = 318 + rise(a), me = i === 2
      withA(a, () => {
        panel(x, y, 300, 300, { r: 16, stroke: me ? COL : C.hair, lw: me ? 2.5 : 1.5 })
        txt('TenantControlPlane', x + 150, y + 34, { size: 16, color: C.mute, align: 'center' })
        chip(n, x + 150, y + 68, { size: 20, col: me ? COL : C.teal, solid: me })
        ;['apiserver', 'controller-manager', 'scheduler'].forEach((s, k) => {
          pod(x + 46, y + 128 + k * 60, 42, { state: me ? COL : C.teal })
          txt(s, x + 80, y + 134 + k * 60, { size: 18, font: MONO, color: C.text })
        })
      })
    })
    // 共享 etcd
    const ea = E.out(P(t, 7.4, 8))
    TCPS.forEach((_, i) => partialLine(320 + i * 320, 618, 640 + (i - 1) * 60, 690, ea, hexA(C.teal, .5), 2, [5, 5]))
    cylinder(640, 736, 200, 50, C.teal, null, ea)
    withA(ea, () => txt('kamaji-etcd · 多租户共用，按前缀隔离', 640, 852, { size: 19, color: C.body, align: 'center' }))
    // 租户的机器
    const na = E.out(P(t, 1, 1.5))
    ;[0, 1].forEach(k => {
      const a = E.out(P(t, 1 + k * .4, 1.5 + k * .4)); if (a <= 0) return
      const y = 350 + k * 160
      node(1220, y, 560, 136, `tenant-c-node-${k + 1}`, { alpha: a, tag: '租户自有', accent: COL })
      withA(a, () => {
        chip('kubelet', 1244, y + 88, { size: 17, col: C.blue, align: 'left' })
        chip('CNI：租户自装', 1344, y + 88, { size: 17, col: C.mute, align: 'left', font: SANS })
        for (let j = 0; j < 3; j++) pod(1616 + j * 52, y + 88, 38, { state: 'run' })
      })
    })
    const ka = E.out(P(t, 11, 11.5))
    withA(na * (1 - ka), () => txt('另一家公司：要自己的节点', 1500, 318, { size: 20, color: C.body, align: 'center' }))
    chip('konnectivity 反向隧道 :8132', 1500, 314, { size: 18, col: COL, alpha: ka })
    ;[418, 578].forEach((y, k) => {
      partialLine(1110, 458, 1220, y, ka, hexA(COL, .6), 2.5, [7, 6])
      if (ka > .9) flow(1110, 458, 1220, y, t, COL, 2, .7, k * .5, 4)
    })
    terminal(1220, 690, 560, 180, t, [
      { t: 11.8, cmd: 'kubectl get tcp -n tenants' },
      { t: 13.0, out: 'NAME       VERSION   STATUS', color: C.mute },
      { t: 13.4, out: 'tenant-c   v1.33.4   Ready', color: C.green },
    ], { size: 18, title: '管理集群', alpha: E.out(P(t, 11.4, 11.9)) })
  },
}

// 场景 5：GitOps
const TREE = ['platform-gitops/', '├── infrastructure/', '├── tenants/', '│   ├── _template/', '│   ├── team-a/', '│   ├── team-b/', '│   └── team-c/', '└── vclusters/']
const RES = ['Namespace', 'ResourceQuota', 'RoleBinding', 'NetworkPolicy', 'LocalQueue']
const PRIN = [['声明式', 0.8], ['版本化', 5.2], ['自动拉取', 7.4], ['持续调谐', 11.8]]
const gitops = {
  name: 'GitOps', dur: 16, mood: 4,
  vo: [[0.6, '配置一多，就用 GitOps 作唯一可信来源。', '配置一多，就用 Git Ops 作唯一可信来源。'],
    [5.2, '新租户入驻就是一次 PR，合并后自动创建。', '新租户入驻就是一次 P R，合并后自动创建。'],
    [10.6, '有人手改集群，代理会发现漂移并纠正。']],
  cues: [[0.6, 'whoosh'], [1.0, 'tick'], [5.2, 'pop'], [6.8, 'ok'], [7.4, 'zap'], ...RES.map((_, i) => [8.2 + i * .2, 'tick']), [10.8, 'key'], [11.4, 'alarmSoft'], [12.6, 'zap'], [13.4, 'chime']],
  draw(t) {
    heading('GitOps：Git 是唯一可信来源', 140, 210, t, .2, { eyebrow: 'GITOPS', color: COL })
    // 仓库
    const ra = E.out(P(t, .6, 1.1)), merged = t >= 6.8
    withA(ra, () => {
      panel(140, 270, 560, 440, { r: 16 })
      txt('Git · 平台仓库', 166, 306, { size: 17, color: C.mute }); line(140, 326, 700, 326, C.hair, 1)
      TREE.forEach((s, i) => {
        const nw = i === 6, a = nw ? E.out(P(t, 6.8, 7.2)) : 1, y = 372 + i * 42
        if (nw && a > 0) sq(150, y - 30, 540, 42, C.green, a, { fill: tint(C.green, .12), stroke: false, r: 8 })
        txt(s, 170, y, { size: 21, font: MONO, color: nw ? C.green : i === 2 || i === 4 || i === 5 ? C.text : C.body, alpha: a })
        if (nw) chip('+ 新租户', 670, y - 8, { size: 15, col: C.green, align: 'right', font: SANS, alpha: a })
      })
    })
    // PR
    const pa = E.out(P(t, 5.2, 5.7))
    withA(pa, () => {
      panel(140, 740 + rise(pa), 560, 116, { r: 16, stroke: hexA(merged ? C.violet : C.green, .6), lw: 2 })
      chip(merged ? 'Merged' : 'Open', 166, 780 + rise(pa), { size: 17, col: merged ? C.violet : C.green, solid: true, align: 'left' })
      txt('PR #42 · 新租户 team-c', 280, 788 + rise(pa), { size: 22, weight: 600 })
      txt('复制模板 → 改配额 → 评审 → 合并', 166, 834 + rise(pa), { size: 18, color: C.mute })
    })
    // Argo CD
    const aa = E.out(P(t, 1, 1.5))
    const drift = t >= 11.2 && t < 13.4
    box(940, 440, 240, 116, 'Argo CD', 'GitOps 代理', C.amber, { size: 28, alpha: aa, hi: t >= 7.4 && t < 8.6 || t >= 12.4 && t < 13.4 })
    chip(drift ? 'OutOfSync' : 'Synced', 940, 522, { size: 17, col: drift ? C.amber : C.green, solid: true, alpha: aa })
    withA(aa, () => {
      arrow(706, 440, 820, 440, 1, hexA(C.amber, .7), 2.5)
      txt('拉取', 763, 426, { size: 18, color: C.amber, align: 'center' })
      arrow(1060, 440, 1172, 440, 1, hexA(C.amber, .7), 2.5)
      txt('应用', 1116, 426, { size: 18, color: C.amber, align: 'center' })
    })
    travel(706, 460, 820, 460, P(t, 7.4, 7.9), C.green, 7)
    travel(1060, 460, 1172, 460, P(t, 7.9, 8.3), C.green, 7)
    travel(1060, 460, 1172, 460, P(t, 12.6, 13.2), C.amber, 7)
    // 原则
    PRIN.forEach(([s, t0], i) => {
      const on = t >= t0
      chip(s, 940, 612 + i * 58, { size: 20, col: on ? COL : C.mute, solid: on && t < t0 + 1.6, font: SANS, alpha: E.out(P(t, 1.2 + i * .15, 1.6 + i * .15)) })
    })
    // 集群
    const ca = E.out(P(t, 1.2, 1.7))
    withA(ca, () => {
      panel(1180, 270, 600, 520, { r: 18, stroke: C.hairD })
      txt('集群 · prod', 1206, 308, { size: 20, weight: 600 })
      chip('ns: team-a', 1206, 352, { size: 17, col: C.blue, align: 'left' }); chip('ns: team-b', 1350, 352, { size: 17, col: C.blue, align: 'left' })
    })
    const na = E.out(P(t, 8, 8.4))
    withA(na, () => {
      panel(1206, 392, 548, 372, { r: 16, fill: hexA(C.green, .04), stroke: hexA(C.green, .6), dash: [9, 7], shadow: false })
      chip('ns: team-c', 1480, 392, { size: 18, col: C.green, solid: true })
    })
    RES.forEach((s, i) => {
      const a = E.out(P(t, 8.2 + i * .2, 8.6 + i * .2)); if (a <= 0) return
      const y = 452 + i * 60, q = i === 1
      const bad = q && drift, fix = q && t >= 13.4
      withA(a, () => {
        sq(1232, y - 24, 496, 48, bad ? C.amber : C.green, 1, { fill: tint(bad ? C.amber : C.green, .08) })
        txt(s, 1252, y + 7, { size: 19, font: MONO, color: C.text })
        if (q) txt(bad ? 'gpu: 8 → 16（手改）' : 'gpu: 8', 1712, y + 7, { size: 17, font: MONO, color: bad ? C.amber : C.mute, align: 'right' })
        if (!bad) check(1700 - (q ? 90 : 0), y, 20, C.green, 1)
      })
      if (fix) ring(1480, y, P(t, 13.4, 14.2), C.green, 200)
    })
    // 手动改动
    const ua = win(t, 10.6, 13.2, .4)
    user(1216, 838, 13, C.body, ua)
    chip('kubectl edit quota', 1246, 840, { size: 18, col: C.amber, align: 'left', alpha: ua })
    txt('漂移已纠正：以 Git 为准', 1780, 848, { size: 20, color: C.green, align: 'right', alpha: E.out(P(t, 13.4, 13.8)) })
  },
}

ANIM({
  id: 'multi-tenancy',
  meta: { stage: 5, lesson: 5, of: 6, title: '多租户与平台工程', summary: '命名空间租户、vcluster 虚拟集群、托管控制平面与 GitOps。', next: '认证考试与持续成长' },
  scenes: [
    lessonIntro({ tags: ['Namespace 租户', 'ResourceQuota', 'vcluster', 'Kamaji', 'GitOps'], vo: [[3.2, '让多个团队安全、公平地共享集群。']] }),
    spectrum, kit, vcluster, kamaji, gitops,
    lessonOutro({
      points: ['隔离从弱到强：命名空间 → 虚拟集群 → 托管控制平面', '命名空间租户：RBAC + Quota + LimitRange + NetPol', 'vcluster：策略建在宿主侧，才是真边界', 'GitOps：Git 为唯一来源，持续调谐'],
      vo: [[0.8, '小结：按信任程度，选合适的隔离层次。'], [5.6, '下一课，认证考试与持续成长。']],
    }),
  ],
})
})()
