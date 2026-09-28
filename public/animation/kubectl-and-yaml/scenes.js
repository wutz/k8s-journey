/* 第 1 阶段 · 第 1 课：kubectl 与声明式 API */
(() => {
  const COL = STAGES[1].color

  // 场景 1：一切皆 API 对象
  const POD_YAML = ['apiVersion: v1', 'kind: Pod', 'metadata:', '  name: nginx', '  labels:', '    app: nginx', 'spec:', '  containers:', '    - name: nginx', '      image: nginx:1.27', '# status:  由系统填写，你不用写']
  const FIELDS = [
    ['apiVersion', '组/版本 · v1、apps/v1', '你', 5.6, [0]],
    ['kind', '资源类型 · Pod、Deployment…', '你', 6.8, [1]],
    ['metadata', '名字、命名空间、标签、注解', '你 + 系统', 7.8, [2, 3, 4, 5]],
    ['spec', '期望状态：你想要什么', '你', 9.0, [6, 7, 8, 9]],
    ['status', '实际状态：现在是什么样', '系统', 10.8, [10]],
  ]
  const OBJS = ['Pod', 'Deployment', 'Service', 'Node', 'Namespace', 'ConfigMap', 'Secret', 'ReplicaSet']
  const objects = {
    name: '一切皆对象', dur: 16, mood: 1,
    vo: [[0.6, 'K8s 里的每样东西，都是一个 API 对象。', 'Kubernetes 里的每样东西，都是一个 API 对象。'],
      [5.6, 'apiVersion、kind、metadata、spec 由你来写。', 'API version、kind、metadata、spec，由你来写。'],
      [10.8, 'status 由系统填写，控制器让现实追上 spec。']],
    cues: [[0.4, 'whoosh'], ...OBJS.map((_, i) => [1.2 + i * .28, 'pop']), [4.9, 'poof'], ...FIELDS.map(f => [f[3], 'tick']), [12.4, 'zap'], [13.6, 'chime']],
    draw(t, T) {
      heading('一切皆 API 对象', 140, 210, t, .2, { eyebrow: 'API OBJECTS', color: COL })
      let cur = -1; FIELDS.forEach((f, i) => { if (t >= f[3]) cur = i })
      code(140, 270, 640, POD_YAML, t, .6, { title: 'nginx-pod.yaml', size: 22, step: .1, hi: cur >= 0 ? FIELDS[cur][4] : [], hiColor: cur === 4 ? C.violet : COL })
      // 对象家族 → etcd
      withA(win(t, .8, 5.4, .5), () => {
        const cx = 1300, cy = 540
        cylinder(cx, cy, 170, 90, C.amber, 'etcd')
        txt('都存在 etcd，都经 API Server 读写', cx, cy + 270, { size: 22, color: C.body, align: 'center', alpha: E.out(P(t, 3.6, 4.2)) })
        OBJS.forEach((s, i) => {
          const k = E.back(P(t, 1.2 + i * .28, 1.6 + i * .28)); if (k <= 0) return
          const a = -Math.PI / 2 + i / OBJS.length * Math.PI * 2 + Math.sin(T * .4) * .04
          const x = cx + Math.cos(a) * 360, y = cy - 20 + Math.sin(a) * 190
          chip(s, x, y, { size: 22, col: [COL, C.violet, C.cyan, C.teal][i % 4], alpha: clamp(k) })
          const q = P(t, 2.6 + i * .12, 3.4 + i * .12); travel(x, y, cx, cy - 20, q, COL, 5)
        })
      })
      // 五个顶层字段
      FIELDS.forEach(([n, s, who, t0], i) => {
        const a = E.out(P(t, t0, t0 + .45)); if (a <= 0) return
        const y = 280 + i * 108, on = cur === i, sys = who === '系统', c = sys ? C.violet : COL
        withA(a * (on ? 1 : .62), () => {
          panel(860 + lerp(40, 0, a), y, 740, 88, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel, dash: sys ? [8, 6] : undefined })
          chip(n, 892, y + 44, { size: 24, align: 'left', col: c, solid: on })
          txt(s, 1110, y + 53, { size: 24, color: C.text })
          chip(who, 1576, y + 44, { size: 18, align: 'right', col: sys ? C.violet : C.mute, font: SANS })
        })
      })
      // 控制循环：对比 spec 与 status
      const lp = E.out(P(t, 12.4, 13.2))
      if (lp > 0) {
        const wx = 1700, wy = 708
        curve(1604, 604, wx - 6, wy - 44, -30, lp, COL, 2.5)
        curve(wx - 6, wy + 44, 1604, 820, -30, E.out(P(t, 13, 13.8)), C.violet, 2.5)
        wheel(wx, wy, 36, { p: P(t, 12.6, 13.8), rot: T * .8, color: COL })
        withA(E.out(P(t, 13.2, 13.8)), () => { txt('控制器', wx, wy + 96, { size: 20, color: C.body, align: 'center' }); txt('对比 → 调整', wx, wy + 122, { size: 17, color: C.mute, align: 'center' }) })
        ring(wx, wy, P(t, 13.6, 14.6), COL, 110)
      }
    },
  }

  // 场景 2：kubectl 是客户端 · kubeconfig
  const CTX = [
    { t: 11.4, cmd: 'kubectl config get-contexts' },
    { t: 12.5, out: 'CURRENT   NAME         CLUSTER     NAMESPACE', color: C.mute },
    { t: 12.8, out: '*         kind-kind    kind-kind   default', color: C.green },
    { t: 13.1, out: '          prod-admin   prod        default', color: C.red },
  ]
  const client = {
    name: 'kubectl 与 kubeconfig', dur: 17, mood: 2,
    vo: [[0.6, 'kubectl 只是客户端，把 YAML 变成 HTTP 请求。'],
      [5.9, 'context 就是：集群 + 用户 + 默认命名空间。', 'context 就是集群、用户，加上默认命名空间。'],
      [11.2, '删东西之前，先确认当前连的是哪个集群。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.2, 'pop'], [1.6, 'pop'], [2.0, 'pop'], [2.8, 'zap'], [3.6, 'zap'], [4.4, 'ok'], [6.2, 'pop'], [7.0, 'pop'], [7.8, 'pop'], [9.4, 'chime'], ...typeCues(CTX, 30), [14.4, 'alarmSoft']],
    draw(t, T) {
      heading('kubectl 只是一个 API 客户端', 140, 210, t, .2, { eyebrow: 'CLIENT · KUBECONFIG', color: COL })
      const Y = 365
      doc(250, Y, 150, 116, 'web.yaml', COL, { alpha: E.out(P(t, .8, 1.2)) })
      box(660, Y, 250, 110, 'kubectl', '客户端', COL, { alpha: E.out(P(t, 1.2, 1.6)), hi: t > 5.4 && t < 11 })
      box(1130, Y, 270, 110, 'API Server', 'kube-apiserver', C.violet, { alpha: E.out(P(t, 1.6, 2.0)) })
      cylinder(1560, Y, 150, 76, C.amber, 'etcd', E.out(P(t, 2.0, 2.4)))
      arrow(330, Y, 530, Y, E.out(P(t, 2.4, 2.9)), hexA(C.text, .35), 2.5)
      arrow(790, Y, 990, Y, E.out(P(t, 2.8, 3.3)), C.violet, 2.5)
      arrow(1270, Y, 1480, Y, E.out(P(t, 3.6, 4.1)), C.amber, 2.5)
      withA(E.out(P(t, 3, 3.5)), () => { chip('HTTPS · POST /apis/apps/v1', 890, Y - 46, { size: 16, col: C.violet }); txt('REST 请求', 890, Y + 36, { size: 17, color: C.mute, align: 'center' }) })
      withA(E.out(P(t, 3.8, 4.3)), () => txt('持久化', 1375, Y + 36, { size: 17, color: C.mute, align: 'center' }))
      travel(330, Y, 530, Y, P(t, 2.4, 3.1), COL); travel(790, Y, 990, Y, P(t, 2.9, 3.7), C.violet); travel(1270, Y, 1480, Y, P(t, 3.7, 4.4), C.amber)
      if (t > 4.4) { flow(790, Y + 14, 990, Y + 14, t, C.violet, 3, .7, 0, 3.5) }
      // kubeconfig
      const ka = E.out(P(t, 5.4, 5.9))
      if (ka > 0) {
        partialLine(660, Y + 56, 660, 520, ka, hexA(COL, .5), 2, [6, 6])
        withA(ka, () => chip('读取 ~/.kube/config', 676, 470, { size: 16, align: 'left', col: COL }))
      }
      const hiK = t < 7.0 ? [0] : t < 7.8 ? [1] : t < 11.2 ? [2, 3, 4, 5, 6] : [7]
      code(140, 520, 820, ['clusters:   [ API Server 地址 + CA 证书 ]', 'users:      [ 客户端证书 / token ]', 'contexts:', '- name: kind-kind', '  cluster: kind-kind', '  user: kind-kind', '  namespace: default', 'current-context: kind-kind'],
        t, 5.6, { title: '~/.kube/config', size: 20, step: .12, hi: t > 5.6 ? hiK : [], hiColor: t < 11.2 ? COL : C.amber, alpha: ka })
      // context = cluster + user + ns
      const ea = E.out(P(t, 6.0, 6.5))
      withA(ea * (1 - E.out(P(t, 10.9, 11.3))), () => {
        panel(1020, 560, 760, 250, { r: 18, fill: tint(COL, .04), stroke: hexA(COL, .4) })
        txt('context  =', 1060, 700, { size: 30, font: MONO, weight: 600, color: COL })
        ;[['cluster', '连哪个集群', C.violet], ['user', '用谁的身份', C.teal], ['namespace', '默认命名空间', C.amber]].forEach(([n, s, c], i) => {
          const k = E.back(P(t, 6.2 + i * .8, 6.6 + i * .8)); if (k <= 0) return
          const x = [1350, 1500, 1665][i]
          withA(clamp(k), () => { chip(n, x, 672, { size: 18, col: c, solid: i === (t < 7.0 ? 0 : t < 7.8 ? 1 : 2) && t < 9.2 }); txt(s, x, 724, { size: 18, color: C.body, align: 'center' }) })
          if (i > 0) txt('+', x - [0, 75, 83][i], 681, { size: 26, color: C.mute, align: 'center', alpha: clamp(k) })
        })
      })
      // get-contexts
      terminal(1020, 540, 760, 250, t, CTX, { size: 20, alpha: E.out(P(t, 11.1, 11.5)) })
      withA(E.out(P(t, 14.2, 14.7)), () => {
        chip('⚠ 在错误的 context 下 delete，是最常见的事故', 1400, 840, { size: 20, font: SANS, col: C.red })
      })
    },
  }

  // 场景 3：命令式 vs 声明式
  const IMP = [
    { t: 1.0, cmd: 'kubectl create deployment web --image=nginx:1.27' },
    { t: 2.8, out: 'deployment.apps/web created', color: C.green },
    { t: 3.4, cmd: 'kubectl create deployment web --image=nginx:1.27' },
    { t: 5.2, out: 'Error from server (AlreadyExists):', color: C.red, sfx: 'error' },
    { t: 5.3, out: '  deployments.apps "web" already exists', color: C.red },
  ]
  const DEC = [
    { t: 5.8, cmd: 'kubectl apply -f web.yaml' },
    { t: 6.8, out: 'deployment.apps/web created', color: C.green },
    { t: 7.4, cmd: 'kubectl apply -f web.yaml' },
    { t: 8.4, out: 'deployment.apps/web unchanged', color: C.green, sfx: 'ok' },
    { t: 8.9, out: '# 改了文件再 apply → configured', color: C.mute },
  ]
  const declarative = {
    name: '命令式与声明式', dur: 16, mood: 2,
    vo: [[0.6, '命令式是“做个动作”，重复 create 就报错。'],
      [5.6, '声明式 apply 可以反复执行，结果总与文件一致。'],
      [10.8, 'YAML 放进 Git，就成了唯一事实来源。']],
    cues: [[0.4, 'whoosh'], ...typeCues(IMP, 30), ...typeCues(DEC, 30), [11.2, 'pop'], [11.8, 'zap'], [12.6, 'chime']],
    draw(t, T) {
      heading('命令式 vs 声明式', 140, 210, t, .2, { eyebrow: 'IMPERATIVE · DECLARATIVE', color: COL })
      const la = E.out(P(t, .5, 1)), ra = lerp(.4, 1, E.out(P(t, 5.4, 5.9))) * E.out(P(t, .8, 1.3))
      withA(la, () => chip('命令式 · 做这个动作', 140, 292, { size: 22, align: 'left', font: SANS, col: C.amber }))
      terminal(140, 320, 800, 280, t, IMP, { size: 20, alpha: la })
      cross(900, 292, 30, C.red, E.out(P(t, 5.2, 5.5)))
      withA(ra, () => chip('声明式 · 让它变成这样', 980, 292, { size: 22, align: 'left', font: SANS, col: COL }))
      terminal(980, 320, 800, 280, t, DEC, { size: 20, alpha: ra })
      check(1744, 292, 34, C.green, P(t, 8.4, 8.8))
      // Git → apply → 集群
      const g = E.out(P(t, 11, 11.5))
      withA(g, () => {
        doc(470, 770, 130, 104, 'web.yaml', COL)
        chip('Git 仓库', 470, 692, { size: 18, font: SANS, col: C.text })
      })
      arrow(560, 770, 1120, 770, E.out(P(t, 11.6, 12.3)), COL, 3)
      travel(560, 770, 1120, 770, P(t, 11.7, 12.5), COL)
      if (t > 12.5) flow(560, 770, 1120, 770, t, COL, 4, .5, 0, 4)
      withA(E.out(P(t, 11.8, 12.3)), () => chip('kubectl apply -f', 840, 730, { size: 18, col: COL }))
      wheel(1210, 770, 52, { p: P(t, 12, 13.2), rot: T * .4, color: COL })
      withA(E.out(P(t, 12.6, 13.2)), () => {
        txt('唯一事实来源', 1320, 762, { size: 30, weight: 600 })
        txt('Single Source of Truth · GitOps 的基础', 1320, 800, { size: 19, color: C.body })
      })
    },
  }

  // 场景 4：explain 与 dry-run
  const EXP = [
    { t: .9, cmd: 'kubectl explain pod.spec.containers.ports' },
    { t: 2.5, out: 'FIELD: ports <[]ContainerPort>', color: C.text },
    { t: 2.8, out: 'FIELDS:', color: C.mute },
    { t: 3.1, out: '  containerPort <integer> -required-', color: COL },
    { t: 3.4, out: '  hostPort      <integer>', color: C.body },
    { t: 3.7, out: '  protocol      <string>', color: C.body },
    { t: 5.8, cmd: 'kubectl create deploy web --image=nginx:1.27 \\' },
    { t: 7.5, out: '    --replicas=2 --dry-run=client -o yaml > web.yaml', color: C.text },
  ]
  const GEN = ['apiVersion: apps/v1', 'kind: Deployment', 'metadata:', '  creationTimestamp: null', '  labels: {app: web}', '  name: web', 'spec:', '  replicas: 2', '  selector:', '    matchLabels: {app: web}', '  template: …', 'status: {}']
  const scaffold = {
    name: 'explain 与 dry-run', dur: 16, mood: 3,
    vo: [[0.6, '字段叫什么、放哪一层？用 explain 问集群。'],
      [5.6, '加上 dry-run 和 -o yaml，自动生成模板。', '加上 dry-run 和 o yaml 参数，自动生成模板。'],
      [10.8, 'client 只在本地渲染，server 走完整校验。']],
    cues: [[0.4, 'whoosh'], ...typeCues(EXP, 30), [7.7, 'zap'], [9.4, 'tick'], [9.7, 'tick'], [11.2, 'pop'], [12.0, 'pop']],
    draw(t) {
      heading('explain 查字段 · dry-run 出模板', 140, 210, t, .2, { eyebrow: 'EXPLAIN · DRY-RUN', color: COL })
      terminal(140, 270, 900, 410, t, EXP, { size: 22, alpha: E.out(P(t, .4, .9)) })
      withA(E.out(P(t, 3.2, 3.7)) * (1 - E.out(P(t, 6.8, 7.4))), () => {
        chip('字段手册来自集群自己的 OpenAPI', 1100, 360, { size: 22, font: SANS, align: 'left', col: COL })
        chip('<integer>  字段类型', 1100, 440, { size: 20, align: 'left', col: C.teal })
        chip('-required-  必填字段', 1100, 510, { size: 20, align: 'left', col: C.amber })
        chip('--recursive  看整棵字段树', 1100, 580, { size: 20, align: 'left', col: C.violet })
      })
      travel(1040, 590, 1100, 520, P(t, 7.6, 8.2), COL, 7)
      code(1100, 270, 680, GEN, t, 7.9, { title: 'web.yaml', alpha: E.out(P(t, 7.4, 7.9)), size: 20, step: .09, hi: t > 9.3 ? [3, 11] : [], hiColor: C.red })
      withA(E.out(P(t, 9.4, 9.9)), () => chip('删掉 null / {} 空字段 → 一份干净的清单', 1440, 800, { size: 18, font: SANS, col: C.red }))
      ;[['--dry-run=client', '只在本地渲染，不访问集群', C.teal], ['--dry-run=server', '走完整校验与准入，但不落盘', C.violet]].forEach(([n, s, c], i) => {
        const a = E.out(P(t, 11 + i * .7, 11.5 + i * .7)); if (a <= 0) return
        const x = 140 + i * 460
        withA(a, () => {
          panel(x, 710 + lerp(20, 0, a), 440, 140, { r: 16, stroke: hexA(c, .5) })
          chip(n, x + 28, 752 + lerp(20, 0, a), { size: 20, align: 'left', col: c, solid: true })
          txt(s, x + 30, 818 + lerp(20, 0, a), { size: 21, color: C.text })
        })
      })
    },
  }

  // 场景 5：diff 再 apply
  const DIFF = [
    { t: .9, cmd: 'kubectl diff -f web.yaml' },
    { t: 2.0, out: '-  replicas: 2', color: C.red },
    { t: 2.3, out: '+  replicas: 3', color: C.green },
    { t: 2.8, out: '-      - image: nginx:1.27', color: C.red },
    { t: 3.1, out: '+      - image: nginx:1.27-alpine', color: C.green },
    { t: 5.8, cmd: 'echo $?' },
    { t: 6.5, out: '1', color: C.amber, sfx: 'tick' },
    { t: 10.9, cmd: 'kubectl apply -f web.yaml' },
    { t: 12.0, out: 'deployment.apps/web configured', color: C.green, sfx: 'ok' },
  ]
  const diff = {
    name: 'diff 再 apply', dur: 16, mood: 3,
    vo: [[0.6, '改完文件先别急着 apply，用 diff 看一眼。'],
      [5.6, '退出码 1 表示有差异，适合放进 CI。', '退出码 1 表示有差异，适合放进 CI 流水线。'],
      [10.8, '确认无误，再 apply 让集群跟上。']],
    cues: [[0.4, 'whoosh'], ...typeCues(DIFF, 30), [1.6, 'zap'], [8.4, 'pop'], [12.6, 'chime']],
    draw(t, T) {
      heading('改之前，先 diff 一眼', 140, 210, t, .2, { eyebrow: 'KUBECTL DIFF', color: COL })
      const ta = E.out(P(t, .4, .9))
      terminal(140, 270, 960, 500, t, DIFF, { size: 22, alpha: ta })
      // 差异行底色
      DIFF.forEach((L, i) => {
        if (!L.out || !/^[-+]/.test(L.out)) return
        const a = E.out(P(t, L.t, L.t + .3)); if (a <= 0) return
        const ly = 270 + 92 + i * 22 * 1.6
        ctx.save(); ctx.globalAlpha *= a * ta; ctx.fillStyle = hexA(L.color, .09); ctx.fillRect(142, ly - 24, 956, 34); ctx.restore()
      })
      // 本地 vs 集群
      const da = E.out(P(t, 1.4, 1.9))
      doc(1300, 380, 180, 136, 'web.yaml', COL, { sub: '本地文件', alpha: da })
      doc(1650, 380, 180, 136, 'web', C.violet, { sub: '集群中的对象', ext: 'live', alpha: E.out(P(t, 1.7, 2.2)) })
      withA(E.out(P(t, 1.8, 2.3)), () => {
        line(1400, 370, 1550, 370, hexA(C.text, .35), 2.5); arrowHead(1550, 370, 0, hexA(C.text, .35), 12); arrowHead(1400, 370, Math.PI, hexA(C.text, .35), 12)
        txt('服务端 dry-run 对比', 1475, 480, { size: 19, color: C.mute, align: 'center' })
      })
      if (t > 2 && t < 5.4) flow(1405, 390, 1545, 390, t, C.violet, 3, 1, 0, 3.5)
      // 退出码
      withA(E.out(P(t, 5.8, 6.3)), () => txt('退出码', 1200, 548, { size: 20, color: C.mute }))
      ;[['0', '无差异', C.green], ['1', '有差异', C.amber], ['>1', '出错', C.red]].forEach(([n, s, c], i) => {
        const a = E.out(P(t, 6 + i * .2, 6.4 + i * .2)); if (a <= 0) return
        const y = 572 + i * 70, on = i === 1 && t > 6.5
        withA(a * (on || t < 6.5 ? 1 : .55), () => {
          panel(1200, y, 580, 58, { r: 14, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .08) : C.panel })
          chip(n, 1236, y + 29, { size: 20, col: c, solid: on, align: 'left' })
          txt(s, 1320, y + 37, { size: 22, color: C.text })
        })
      })
      withA(E.out(P(t, 8.4, 8.9)), () => chip('CI 流水线 · 变更检查门禁', 1490, 820, { size: 20, font: SANS, col: C.amber }))
      // apply 后：集群跟上
      const ok = E.out(P(t, 12, 12.6))
      if (ok > 0) {
        ring(1650, 380, P(t, 12, 13.2), C.green, 180)
        withA(ok, () => { ctx.save(); ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(1726, 318, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore() })
        check(1726, 318, 26, '#ffffff', P(t, 12.1, 12.6))
      }
    },
  }

  ANIM({
    id: 'kubectl-and-yaml',
    meta: { stage: 1, lesson: 1, of: 6, title: 'kubectl 与声明式 API', summary: 'API 对象的结构、kubectl 常用命令、explain / dry-run / diff 工作流。', next: 'Pod：最小调度单元' },
    scenes: [
      lessonIntro({ tags: ['API 对象', 'spec / status', 'kubeconfig', 'explain', 'dry-run · diff'], vo: [[3.2, 'kubectl 与声明式 API：看懂每一份 YAML。']] }),
      objects, client, declarative, scaffold, diff,
      lessonOutro({
        points: ['五个顶层字段：spec 你写，status 系统写', 'kubectl 读 kubeconfig，请求发给 API Server', 'apply 可重复执行，YAML 进 Git', 'explain 查字段 · dry-run 出模板 · diff 预览'],
        vo: [[0.8, '小结：一切皆对象，声明式是日常标准。'], [5.6, '下一课，认识最小调度单元 Pod。']],
      }),
    ],
  })
})()
