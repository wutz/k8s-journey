/* 第 4 阶段 · 第 3 课：生产网络：Cilium、MetalLB 与证书 */
(() => {
  const COL = STAGES[4].color

  // 场景 1：Cilium
  const CIL = ['# apiserver：每个节点上的本地 nginx 代理', 'k8sServiceHost: "127.0.0.1"', 'k8sServicePort: "6443"', 'kubeProxyReplacement: "false"', 'ipam:',
    '  mode: cluster-pool', '  operator:', '    clusterPoolIPv4PodCIDRList: ["172.24.0.0/13"]', '    clusterPoolIPv4MaskSize: 24']
  const OPT = [
    ['10.233.0.1:443', 'ClusterIP：Service 转发还没就绪', false, 5.8],
    ['192.168.3.21:6443', '只填一台 master：单点', false, 7.2],
    ['127.0.0.1:6443', '本机 nginx → 3 个 apiserver', true, 8.6],
  ]
  const cilium = {
    name: 'Cilium', dur: 16, mood: 1,
    vo: [[0.6, 'Cilium 一装好，节点就变成 Ready。'],
      [5.4, 'apiserver 地址指向本机代理，避免单点。'],
      [10.8, 'Pod 网段用完了，只能在列表末尾追加。']],
    cues: [[0.6, 'whoosh'], [2.2, 'pop'], [2.8, 'ok'], [3.05, 'tick'], [3.3, 'tick'], ...OPT.map(o => [o[3] + .6, o[2] ? 'ok' : 'error']), [10.8, 'pop'],
      ...[0, 1, 2, 3, 4, 5].map(i => [11.2 + i * .3, 'tick']), [13.6, 'chime']],
    draw(t) {
      heading('Cilium：eBPF 驱动的 Pod 网络', 140, 210, t, .2, { eyebrow: 'CNI', color: COL })
      const hi = t < 5.4 ? [] : t < 10.8 ? [1, 2] : [7, 8]
      code(140, 280, 780, CIL, t, .5, { title: 'network/cilium/values.yml', size: 20, step: .08, hi, hiColor: t < 10.8 ? C.violet : C.teal })
      // 节点：NotReady → Ready
      ;['mn-192-168-3-21', 'cn-192-168-3-50', 'gn-192-168-3-60'].forEach((n, i) => {
        const a = E.out(P(t, .8 + i * .15, 1.3 + i * .15)); if (a <= 0) return
        const x = 140 + i * 266, y = 700, ready = t >= 2.8 + i * .25
        node(x, y, 248, 150, n, { alpha: a, accent: COL })
        withA(a, () => {
          const k = E.back(P(t, 2.2 + i * .1, 2.6 + i * .1))
          if (k > 0) pod(x + 180, y + 92, 26 * clamp(k), { state: 'run', alpha: clamp(k) })
          chip(ready ? 'Ready' : 'NotReady', x + 22, y + 96, { size: 18, col: ready ? C.green : C.amber, solid: ready, align: 'left', font: SANS })
          txt('cilium-agent', x + 180, y + 136, { size: 16, font: MONO, color: C.violet, align: 'center', alpha: clamp(k) })
        })
        ring(x + 124, y + 96, P(t, 2.8 + i * .25, 3.8 + i * .25), C.green, 130)
      })
      // apiserver 地址选择
      withA(E.out(P(t, 5.2, 5.7)), () => {
        panel(960, 280, 820, 380, { r: 18 })
        txt('cilium-agent 启动时怎么找到 apiserver？', 992, 326, { size: 22, weight: 600 })
        box(1080, 480, 180, 96, 'cilium-agent', 'DaemonSet', C.violet, { size: 22 })
      })
      OPT.forEach(([addr, why, ok, t0], i) => {
        const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
        const y = 400 + i * 96, c = ok ? C.green : C.red
        arrow(1170, 480, 1290, y, E.out(P(t, t0, t0 + .5)), hexA(c, .6), 2.5, ok ? null : [7, 6])
        travel(1170, 480, 1290, y, P(t, t0, t0 + .6), c, 6)
        withA(a, () => {
          panel(1300, y - 38, 452, 76, { r: 12, stroke: hexA(c, t >= t0 + .6 ? .7 : .25), fill: t >= t0 + .6 ? tint(c, .05) : '#fff' })
          txt(addr, 1322, y - 6, { size: 20, font: MONO, color: C.text })
          txt(why, 1322, y + 24, { size: 17, color: ok ? C.green : C.red })
        })
        if (t >= t0 + .6) ok ? check(1724, y, 26, C.green, P(t, t0 + .6, t0 + 1)) : cross(1724, y, 20, C.red, E.out(P(t, t0 + .6, t0 + .9)))
      })
      if (t > 9.4) flow(1170, 480, 1290, 592, t, C.green, 3, 1, 0, 4)
      // cluster-pool IPAM
      withA(E.out(P(t, 10.6, 11.1)), () => {
        panel(960, 690, 820, 180, { r: 18 })
        txt('cluster-pool：operator 给每个节点切一个 /24', 992, 730, { size: 21, color: C.text })
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(992, 758, 520, 44, 10); ctx.fill(); ctx.restore()
        txt('172.24.0.0/13', 1252, 842, { size: 17, font: MONO, color: C.mute, align: 'center' })
      })
      for (let k = 0; k < 12; k++) {
        const p = E.back(P(t, 11.2 + k * .15, 11.5 + k * .15)); if (p <= 0) continue
        const cc = [C.violet, C.blue, C.teal][k % 3]
        ctx.save(); ctx.globalAlpha *= clamp(p); ctx.fillStyle = tint(cc, .3); ctx.strokeStyle = cc; ctx.lineWidth = 1.5; rr(996 + k * 43, 762, 39, 36, 6); ctx.fill(); ctx.stroke(); ctx.restore()
      }
      withA(E.out(P(t, 13.4, 13.9)), () => {
        panel(1536, 758, 212, 44, { r: 10, fill: tint(C.green, .08), stroke: C.green, dash: [7, 5], shadow: false, lw: 2 })
        txt('+ 末尾追加', 1642, 787, { size: 18, color: C.green, align: 'center', weight: 600 })
        txt('再重启 operator', 1642, 842, { size: 17, color: C.mute, align: 'center' })
      })
    },
  }

  // 场景 2：MetalLB L2
  const SVC = [
    { t: 1.0, cmd: 'kubectl get svc -n istio-system' },
    { t: 2.0, out: 'NAME           TYPE           EXTERNAL-IP', color: C.mute },
    { t: 2.3, out: 'main-gateway   LoadBalancer   <pending>', color: C.amber },
    { t: 6.4, out: 'main-gateway   LoadBalancer   192.168.10.210', color: C.green, sfx: 'ok' },
  ]
  const MN = ['mn-192-168-3-21', 'mn-192-168-3-22', 'mn-192-168-3-23']
  const arpScene = (t, holderAt, o = {}) => {
    // 右侧：客户端 + 3 个控制平面节点
    const cx = 1370, cy = 360
    user(cx, cy, 18, C.body, E.out(P(t, o.a0, o.a0 + .4)))
    withA(E.out(P(t, o.a0, o.a0 + .4)), () => txt('同网段客户端', cx + 44, cy + 10, { size: 18, color: C.mute }))
    MN.forEach((n, i) => {
      const a = E.out(P(t, o.a0 + .2 + i * .15, o.a0 + .6 + i * .15)); if (a <= 0) return
      const x = 990 + i * 266, y = 660, down = o.down != null && i === o.down && t >= o.tDown
      node(x, y, 248, 176, n.replace('192-168-3-', '…-'), { alpha: a, state: down ? 'down' : 'ok', accent: COL })
      withA(a, () => {
        chip('speaker', x + 22, y + 72, { size: 17, col: down ? C.red : COL, align: 'left' })
        txt('MAC …:' + (21 + i), x + 22, y + 118, { size: 17, font: MONO, color: C.mute })
        if (o.label) chip('exclude-from-…-lb', x + 22, y + 152, { size: 16, col: C.red, align: 'left', alpha: o.labelA(t) })
      })
      if (down) cross(x + 210, y + 96, 26, C.red, E.out(P(t, o.tDown, o.tDown + .3)))
    })
    return { cx, cy }
  }
  const metallb = {
    name: 'MetalLB L2', dur: 17, mood: 2,
    vo: [[0.6, '裸金属上，LoadBalancer 的 IP 会一直 pending。'],
      [5.6, 'MetalLB 从地址池分配 IP，由一个节点回应 ARP。'],
      [11.0, '这台挂了别的节点接管，L2 只有故障切换。']],
    cues: [[0.6, 'whoosh'], ...typeCues(SVC, 30), [5.8, 'pop'], [6.2, 'chime'], [7.2, 'whoosh'], [8.4, 'pop'], [11.2, 'powerDown'], [12.0, 'zap'], [12.4, 'ok'], [13.6, 'tick'], [14.0, 'tick']],
    draw(t) {
      heading('MetalLB：裸金属上的 LoadBalancer', 140, 210, t, .2, { eyebrow: 'LOAD BALANCER', color: COL })
      terminal(140, 280, 780, 250, t, SVC, { size: 20, alpha: E.out(P(t, .6, 1.1)), title: 'kubectl' })
      // 地址池
      withA(E.out(P(t, 5.4, 5.9)), () => {
        panel(140, 560, 780, 140, { r: 18 })
        txt('IPAddressPool · 192.168.10.200-210', 172, 600, { size: 20, font: MONO, color: C.text })
        for (let k = 0; k <= 10; k++) {
          const sel = k === 10 && t >= 6.2, x = 172 + k * 66
          ctx.save(); ctx.fillStyle = sel ? tint(C.green, .3) : 'rgba(0,0,0,0.04)'; ctx.strokeStyle = sel ? C.green : C.hair; ctx.lineWidth = sel ? 2.5 : 1.5; rr(x, 626, 58, 48, 8); ctx.fill(); ctx.stroke(); ctx.restore()
          txt('.' + (200 + k), x + 29, 657, { size: 16, font: MONO, color: sel ? C.green : C.mute, align: 'center' })
        }
      })
      ring(861, 650, P(t, 6.2, 7.2), C.green, 80)
      // L2 vs BGP
      withA(E.out(P(t, 13.4, 13.9)), () => {
        panel(140, 730, 780, 140, { r: 18 })
        ;[['L2 · ARP', '单节点承接流量，只能故障切换', COL], ['BGP · ECMP', '多节点负载均衡，需交换机配合', C.blue]].forEach(([n, s, c], i) => {
          const a = E.out(P(t, 13.6 + i * .4, 14 + i * .4))
          withA(a, () => { chip(n, 172 + i * 380, 772, { size: 19, col: c, solid: i === 0, align: 'left' }); txt(s, 172 + i * 380, 832, { size: 20, color: C.body }) })
        })
      })
      // 右侧 ARP 图
      withA(E.out(P(t, 5.6, 6)), () => panel(960, 280, 820, 590, { r: 18, fill: tint(COL, .025), stroke: hexA(COL, .3) }))
      const { cx, cy } = arpScene(t, 0, { a0: 5.8, down: 0, tDown: 11.2 })
      const holder = t < 11.2 ? 0 : t < 12.0 ? -1 : 1
      // ARP 广播
      if (t > 7.0 && t < 8.8) {
        withA(win(t, 7.0, 8.8, .3), () => bubble('谁有 192.168.10.210？', cx, cy - 36 + 0, { size: 19, font: MONO }))
        MN.forEach((_, i) => travel(cx, cy + 50, 1114 + i * 266, 660, P(t, 7.4, 8.2), C.amber, 6))
      }
      if (holder >= 0) {
        const t0 = holder === 0 ? 8.4 : 12.0, nx = 1114 + holder * 266
        arrow(nx, 656, cx + 10, cy + 56, E.out(P(t, t0, t0 + .5)), hexA(C.green, .7), 2.5)
        withA(E.out(P(t, t0 + .3, t0 + .7)), () => chip(`在我这 · MAC …:${21 + holder}`, (nx + cx) / 2 + 20, 520, { size: 18, col: C.green, font: SANS }))
        ring(nx, 740, P(t, t0, t0 + 1), C.green, 140)
        if (t > t0 + .8) flow(cx - 10, cy + 56, nx - 10, 656, t, COL, 4, .9, 0, 5)
      }
    },
  }

  // 场景 3：IP 分配了却 ping 不通
  const PING = [
    { t: 1.2, cmd: 'arping -I eth0 192.168.10.210' },
    { t: 2.4, out: 'Timeout', color: C.red, sfx: 'error' },
    { t: 3.2, out: 'Timeout', color: C.red },
    { t: 11.0, cmd: 'arping -I eth0 192.168.10.210' },
    { t: 12.3, out: 'Unicast reply from 192.168.10.210 [52:54:00:3a:1f:21]', color: C.green, sfx: 'ok' },
  ]
  const pitfall = {
    name: '排除标签的坑', dur: 16, mood: 4,
    vo: [[0.6, 'Service 拿到了 IP，却 ping 不通？'],
      [4.6, 'kubeadm 给控制平面打了排除 LB 的标签。', 'kubeadm 给控制平面节点打了排除负载均衡的标签。'],
      [10.4, '给 speaker 加上 ignoreExcludeLB，ARP 就有回应了。', '给 speaker 加上 ignore exclude LB，ARP 就有回应了。']],
    cues: [[0.4, 'whoosh'], ...typeCues(PING, 30), [1.6, 'whoosh'], [4.8, 'alarmSoft'], [5.2, 'pop'], [5.4, 'pop'], [5.6, 'pop'], [10.2, 'pop'], [11.4, 'poof']],
    draw(t) {
      heading('IP 分配了，却 ping 不通', 140, 210, t, .2, { eyebrow: 'PITFALL', color: COL })
      // 左：示意图
      withA(E.out(P(t, .4, .9)), () => panel(140, 280, 820, 360, { r: 18 }))
      const fixed = t >= 11.4
      withA(E.out(P(t, .6, 1)), () => { user(250, 440, 20, C.body); txt('客户端', 250, 530, { size: 18, color: C.mute, align: 'center' }) })
      MN.forEach((n, i) => {
        const a = E.out(P(t, .7 + i * .15, 1.1 + i * .15)); if (a <= 0) return
        const y = 300 + i * 110
        node(480, y, 450, 96, n, { alpha: a, accent: COL })
        withA(a, () => {
          chip('speaker', 502, y + 68, { size: 16, col: COL, align: 'left' })
          const la = E.out(P(t, 4.9 + i * .2, 5.3 + i * .2))
          if (la > 0) withA(la * (fixed ? .4 : 1), () => chip('exclude-from-external-lb', 600, y + 68, { size: 16, col: C.red, align: 'left' }))
          if (fixed && i === 0) chip('已忽略', 908, y + 20, { size: 16, font: SANS, col: C.green, solid: true, align: 'right', alpha: E.out(P(t, 11.4, 11.8)) })
        })
        travel(290, 440, 476, y + 48, P(t, 1.6, 2.3), C.amber, 6)
        if (t > 2.3 && t < 4.4) withA(win(t, 2.3, 4.4, .3), () => txt('?', 950, y + 60, { size: 28, weight: 700, color: C.amber, align: 'right' }))
      })
      if (fixed) {
        arrow(476, 348, 290, 432, E.out(P(t, 11.6, 12.1)), C.green, 2.5)
        check(250, 360, 28, C.green, P(t, 12.3, 12.7))
      }
      if (t > 2.4 && t < 10.8) withA(win(t, 2.4, 10.8, .4), () => chip('ARP 无人应答', 250, 590, { size: 18, col: C.red, font: SANS }))
      terminal(1000, 280, 780, 360, t, PING, { size: 20, alpha: E.out(P(t, .8, 1.2)), title: '同网段的另一台机器' })
      // 左下：原因
      withA(E.out(P(t, 4.8, 5.3)), () => {
        panel(140, 670, 820, 200, { r: 18, stroke: hexA(C.red, .45), fill: tint(C.red, .03) })
        txt('kubeadm 给控制平面节点打的标签', 172, 712, { size: 20, color: C.mute })
        txt('node.kubernetes.io/exclude-from-external-load-balancers', 172, 758, { size: 18, font: MONO, color: C.red })
        txt('MetalLB 默认不在这些节点上宣告 IP', 172, 812, { size: 22, color: C.text })
        txt('speaker 只跑在控制平面 → 没人回应 ARP', 172, 848, { size: 20, color: C.body })
      })
      // 右下：修复
      withA(E.out(P(t, 10, 10.4)), () => code(1000, 670, 780, ['# network/metallb/values.yml', 'speaker:', '  ignoreExcludeLB: true'], t, 10.1, { title: '修复', size: 22, hi: t > 10.6 ? [2] : [], hiColor: C.green }))
    },
  }

  // 场景 4：cert-manager
  const CHAIN = [['Certificate', '你来声明'], ['ClusterIssuer', 'letsencrypt-prod'], ['Order', 'ACME 订单'], ['Challenge', 'HTTP-01'], ['Secret', 'tls.crt / tls.key']]
  const certm = {
    name: 'cert-manager', dur: 16, mood: 2,
    vo: [[0.6, '声明 Certificate，cert-manager 签好证书存进 Secret。'],
      [5.8, 'HTTP-01 要公网可达，通配证书得用 DNS-01。', 'HTTP 01 要求公网可达，通配证书得用 DNS 01。'],
      [11.2, '先用 staging 调通，webhook 要 2 副本加 PDB。', '先用 staging 环境调通，webhook 要两副本加 PDB。']],
    cues: [[0.6, 'whoosh'], ...CHAIN.map((_, i) => [1 + i * .75, 'pop']), [4.6, 'lock'], [5.0, 'shimmer'], [6.0, 'pop'], [8.2, 'pop'], [11.4, 'alarmSoft'], [13.2, 'pop']],
    draw(t) {
      heading('cert-manager：证书自动签发与续期', 140, 210, t, .2, { eyebrow: 'CERTIFICATES', color: COL })
      CHAIN.forEach(([n, s], i) => {
        const x = 280 + i * 340, t0 = 1 + i * .75, a = E.out(P(t, t0, t0 + .4))
        const c = i === 4 ? C.green : i === 1 ? COL : C.blue
        box(x, 420, 280, 116, n, s, c, { alpha: a, size: 26, hi: t >= t0 && t < t0 + 1.2 })
        if (i) { arrow(x - 200, 420, x - 144, 420, E.out(P(t, t0 - .2, t0 + .2)), hexA(C.text, .35), 2.5); travel(x - 200, 420, x - 144, 420, P(t, t0 - .3, t0 + .1), c, 6) }
      })
      withA(E.out(P(t, 4.6, 5)), () => { ctx.save(); ctx.globalAlpha *= 1; lock(1640, 330, 36, C.green, 0); ctx.restore() })
      // 自动续期回路（在链条下方）
      const lp = E.inOut(P(t, 4.8, 5.8))
      if (lp > 0) {
        curve(1640, 480, 280, 480, -110, lp, hexA(C.green, .6), 2.5)
        withA(E.out(P(t, 5.4, 5.8)), () => chip('⟳ 到期前自动续期', 960, 536, { size: 18, col: C.green, font: SANS }))
      }
      // HTTP-01 / DNS-01
      ;[['HTTP-01', 'http://<域名>/.well-known/acme-challenge/…', 'Let\'s Encrypt 从公网回访：域名必须公网可达', C.blue, 6.0],
        ['DNS-01', 'TXT _acme-challenge.dev1.bj1.example.com', '调 DNS 服务商 API：通配证书、内网域名', C.violet, 8.2]].forEach(([n, s, note, c, t0], i) => {
        const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
        const x = 140 + i * 840
        withA(a, () => {
          panel(x, 580 + lerp(16, 0, a), 800, 140, { r: 16, stroke: hexA(c, .5) })
          chip(n, x + 30, 620, { size: 20, col: c, solid: true, align: 'left' })
          txt(s, x + 30, 666, { size: 18, font: MONO, color: C.text })
          txt(note, x + 30, 702, { size: 20, color: C.body })
        })
      })
      globe(900, 625, 22, C.blue, E.out(P(t, 6.4, 6.8)))
      if (t > 6.8 && t < 10.8) flow(870, 625, 720, 625, t, C.blue, 3, 1, 0, 4)
      // 生产提示
      ;[['先用 staging 调通', '生产环境有速率限制，反复失败会被临时封禁', C.amber, 11.4], ['webhook：2 副本 + PDB', '它挂了，所有 cert-manager CR 都改不了', C.red, 13.2]].forEach(([n, s, c, t0], i) => {
        const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
        const x = 140 + i * 840
        withA(a, () => {
          panel(x, 750, 800, 120, { r: 16, fill: tint(c, .05), stroke: hexA(c, .5) })
          txt(n, x + 30, 796, { size: 24, weight: 600, color: C.text })
          txt(s, x + 30, 842, { size: 20, color: C.body })
        })
      })
    },
  }

  // 场景 5：Gateway API
  const gateway = {
    name: 'Gateway API', dur: 17, mood: 3,
    vo: [[0.6, 'ingress-nginx 已归档，新集群改用 Gateway API。'],
      [5.8, 'Gateway 归基础设施，挂泛域名证书和固定 IP。'],
      [11.2, '打了标签的命名空间，才能挂上 HTTPRoute。']],
    cues: [[0.6, 'whoosh'], [1.6, 'error'], [3.4, 'whoosh'], [6.0, 'pop'], [7.0, 'lock'], [9.0, 'pop'], [11.6, 'ok'], [12.8, 'error'], [13.6, 'whoosh'], [14.6, 'chime']],
    draw(t) {
      heading('入口：从 Ingress 到 Gateway API', 140, 210, t, .2, { eyebrow: 'GATEWAY API', color: COL })
      // 顶部：ingress-nginx 归档
      withA(E.out(P(t, .6, 1.1)), () => {
        panel(140, 280, 1640, 84, { r: 16, fill: tint(C.red, .03), stroke: hexA(C.red, .35) })
        txt('ingress-nginx', 176, 332, { size: 26, font: MONO, color: C.mute })
        const sw = E.inOut(P(t, 1.4, 2)); if (sw > 0) line(170, 322, 170 + 200 * sw, 322, C.red, 3)
        txt('2026-03 停止维护并归档 · Kubespray v2.31 已移除', 420, 330, { size: 21, color: C.red, alpha: E.out(P(t, 1.8, 2.2)) })
        chip('→ Gateway API', 1748, 322, { size: 22, col: C.green, solid: true, align: 'right', font: SANS, alpha: E.out(P(t, 3.4, 3.8)) })
      })
      // DNS / 客户端
      withA(E.out(P(t, 5.8, 6.2)), () => {
        panel(140, 400, 300, 300, { r: 18 })
        globe(290, 490, 42, C.blue)
        txt('*.dev1.bj1.example.com', 290, 580, { size: 17, font: MONO, align: 'center' })
        txt('↓ DNS 泛解析', 290, 616, { size: 17, color: C.mute, align: 'center' })
        chip('192.168.10.210', 290, 660, { size: 18, col: COL })
      })
      // Gateway
      withA(E.out(P(t, 6.0, 6.5)), () => {
        panel(500, 400, 420, 470, { r: 18, stroke: COL, lw: 2.5, fill: tint(COL, .04) })
        chip('基础设施团队', 896, 432, { size: 16, col: COL, align: 'right', font: SANS })
        txt('Gateway', 530, 446, { size: 30, weight: 600 })
        txt('main-gateway · istio-system', 530, 486, { size: 18, font: MONO, color: C.mute })
        ;[['listener', ':443 HTTPS'], ['hostname', '*.dev1.bj1.example.com'], ['tls', 'wildcard-dev1-tls'], ['allowedRoutes', 'gateway-access: "true"']].forEach(([k, v], i) => {
          const a = E.out(P(t, 6.6 + i * .5, 7 + i * .5)), y = 552 + i * 76
          withA(a, () => { txt(k, 530, y, { size: 17, color: C.mute }); txt(v, 530, y + 30, { size: 19, font: MONO, color: i === 3 && t > 11.2 ? C.green : C.text }) })
        })
        lock(880, 700, 26, C.green, 0)
      })
      // 命名空间
      ;[['monitoring', true, 9.0], ['sandbox', false, 12.4]].forEach(([ns, ok, t0], i) => {
        const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
        const y = 400 + i * 250, c = ok ? C.green : C.red
        withA(a, () => {
          panel(1000, y, 780, 220, { r: 18, stroke: hexA(ok ? C.blue : C.hairD, .6), dash: ok ? null : [8, 6], shadow: ok })
          txt('ns ' + ns, 1030, y + 42, { size: 22, font: MONO, weight: 600 })
          chip(ok ? 'gateway-access: "true"' : '无标签', 1756, y + 34, { size: 16, col: ok ? C.green : C.mute, align: 'right' })
          chip('应用团队', 1030, y + 188, { size: 16, col: C.blue, align: 'left', font: SANS })
          panel(1030, y + 70, 420, 90, { r: 12, stroke: hexA(C.blue, .5) })
          txt('HTTPRoute', 1052, y + 104, { size: 20, weight: 600 })
          txt(ok ? 'gf.dev1.bj1.example.com' : 'test.dev1.bj1.example.com', 1052, y + 140, { size: 17, font: MONO, color: C.mute })
          if (ok) {
            box(1640, y + 115, 220, 90, 'grafana', 'Service :80', C.teal, { size: 22 })
            arrow(1450, y + 115, 1526, y + 115, E.out(P(t, t0 + .4, t0 + .8)), hexA(C.teal, .6), 2.5)
          }
        })
        // 挂到 Gateway
        const tA = ok ? 11.4 : 12.8, py = y + 115
        const ap = E.out(P(t, tA, tA + .5))
        if (ap > 0) arrow(1030, py, 924, py < 640 ? py : 760, ap, hexA(c, .7), 2.5, ok ? null : [7, 6])
        if (t >= tA + .5) ok ? check(975, py - 30, 24, C.green, P(t, tA + .5, tA + .9)) : cross(975, py - 34, 20, C.red, E.out(P(t, tA + .5, tA + .8)))
        if (!ok) withA(E.out(P(t, tA + .6, tA + 1)), () => chip('未授权，不接受', 1570, y + 115, { size: 18, col: C.red, font: SANS }))
      })
      // 请求走一遍
      if (t > 13.6) {
        travelPath([[440, 550], [500, 550], [920, 515], [1030, 515], [1450, 515], [1530, 515]], P(t, 13.6, 14.8), COL, 8)
        if (t > 14.8) flow(440, 560, 500, 560, t, COL, 2, 1, 0, 4)
      }
    },
  }

  ANIM({
    id: 'production-networking',
    meta: { stage: 4, lesson: 3, of: 8, title: '生产网络：Cilium、MetalLB 与证书', summary: '安装 Cilium 的坑、裸金属 LoadBalancer、cert-manager 自动签发证书。', next: '生产存储：CSI 选型与 Rook-Ceph' },
    scenes: [
      lessonIntro({ tags: ['Cilium', 'MetalLB', 'cert-manager', 'Gateway API'], vo: [[3.2, '生产网络：Pod 网络、入口 IP 和证书。']] }),
      cilium, metallb, pitfall, certm, gateway,
      lessonOutro({
        points: ['Cilium：apiserver 指向本机 127.0.0.1:6443', 'MetalLB L2：地址池 + ARP 宣告，仅故障切换', '控制平面上的 speaker 要 ignoreExcludeLB', 'cert-manager 签证书，Gateway API 做入口'],
        vo: [[0.8, '小结：网络、入口、证书，一条链路打通。'], [5.6, '下一课，生产存储：CSI 与 Rook-Ceph。', '下一课，生产存储：CSI 与 Rook Ceph。']],
      }),
    ],
  })
})()
