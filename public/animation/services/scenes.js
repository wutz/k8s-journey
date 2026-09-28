/* 第 1 阶段 · 第 5 课：Service 与服务发现 */
(() => {
  const COL = STAGES[1].color

  // 本地小工具：横向括线（x1→x2），左端挂标签，后接说明
  function bracket(x1, x2, y, label, desc, col, a) {
    if (a <= 0) return
    withA(a, () => {
      const p = E.out(a)
      line(x1, y, lerp(x1, x2, p), y, hexA(col, .55), 2.5)
      line(x1, y - 10, x1, y + 10, hexA(col, .55), 2.5)
      if (p > .98) line(x2, y - 10, x2, y + 10, hexA(col, .55), 2.5)
      const w = chip(label, x1 + 14, y, { size: 18, align: 'left', col, solid: true })
      ctx.save(); ctx.fillStyle = C.panel; ctx.fillRect(x1 + 20 + w, y - 14, textW(desc, 18) + 20, 28); ctx.restore()
      txt(desc, x1 + 28 + w, y + 7, { size: 18, color: C.body })
    })
  }

  // 场景 1：为什么需要 Service
  const P1 = [[1080, 360, '10.244.1.5'], [1080, 560, '10.244.2.3'], [1080, 760, '10.244.1.8']]
  const PROB = [['IP 不固定', '稳定 VIP + DNS 名', 3.2, 7.4], ['多个副本怎么分流', '自动负载均衡', 4.0, 7.9], ['谁是健康的', '只转发给 Ready Pod', 4.8, 8.4]]
  const why = {
    name: '为什么需要 Service', dur: 16, mood: 1,
    vo: [[0.6, 'Pod IP 会变，副本又多，客户端该连谁？'],
      [5.6, 'Service 给一组 Pod 稳定的虚拟 IP 和名字。'],
      [10.8, '节点上的 kube-proxy 把 VIP 流量转给 Pod。', '每个节点上的 kube-proxy，把虚拟 IP 的流量转发给 Pod。']],
    cues: [[0.4, 'whoosh'], [0.7, 'pop'], [1.0, 'pop'], [1.2, 'pop'], [1.4, 'pop'], [3.0, 'poof'], [3.2, 'tick'], [3.7, 'pop'], [4.0, 'tick'], [4.6, 'error'], [4.8, 'tick'], [5.8, 'zap'], [6.4, 'pop'], [7.4, 'ok'], [7.9, 'ok'], [8.4, 'ok'], [9.4, 'chime'], [11.0, 'pop'], [11.6, 'zap'], [13.4, 'tick']],
    draw(t, T) {
      heading('Pod 会变，入口不能变', 140, 210, t, .2, { eyebrow: 'WHY SERVICE', color: COL })
      const ca = E.out(P(t, .6, 1.1))
      user(260, 530, 30, C.body, ca)
      withA(ca, () => txt('客户端', 260, 640, { size: 20, color: C.body, align: 'center' }))
      // Pod 列
      const newIp = t >= 3.7
      P1.forEach(([x, y, ip], i) => {
        const t0 = 1.0 + i * .2
        let st = 'run'
        if (i === 1 && t >= 4.6 && t < 9.4) st = 'fail'
        if (i === 2) {
          const old = 1 - E.out(P(t, 3.0, 3.3))
          if (old > 0 && t < 3.7) { pod(x, y, 110, { state: 'run', scale: E.back(P(t, t0, t0 + .45)), alpha: old }); txt(ip, x + 72, y + 8, { size: 22, font: MONO, alpha: old * ca }) }
          poof(x, y, P(t, 3.0, 3.8), C.red)
          if (newIp) {
            const k = E.back(P(t, 3.7, 4.1))
            pod(x, y, 110, { state: t < 4.4 ? 'pending' : 'run', scale: k })
            withA(clamp(k), () => chip('10.244.2.9', x + 70, y, { size: 20, align: 'left', col: t < 7.4 ? C.amber : C.mute, solid: t < 5.6 }))
            if (t < 7.4) withA(clamp(k), () => txt('重建后换了 IP', x + 72, y + 42, { size: 17, color: C.amber }))
          }
          return
        }
        const k = E.back(P(t, t0, t0 + .45))
        pod(x, y, 110, { state: st, scale: k, shake: st === 'fail' && t < 5.0 ? Math.sin(T * 60) * 3 : 0 })
        withA(clamp(k), () => txt(ip, x + 72, y + 8, { size: 22, font: MONO }))
        if (i === 1 && st === 'fail') withA(clamp(k), () => txt('NotReady', x + 72, y + 42, { size: 17, font: MONO, color: C.red }))
      })
      ring(1080, 560, P(t, 9.4, 10.2), C.green, 100)
      // 阶段 A：直连 Pod IP
      const pa = E.out(P(t, 1.2, 1.7)) * (1 - E.out(P(t, 5.4, 5.9)))
      if (pa > 0) withA(pa, () => {
        P1.forEach(([x, y], i) => {
          const broke = i === 2 && t >= 3.0
          const c = broke ? C.red : hexA(C.mute, .7)
          arrow(300, 560, x - 64, y, 1, c, 2, [8, 7])
          const mx = (300 + x - 64) / 2, my = (560 + y) / 2
          if (broke) cross(mx, my, 24, C.red)
          else chip('?', mx, my, { size: 18, col: C.mute })
        })
      })
      // 三个问题 → 被 Service 解决
      PROB.forEach(([q, s, t0, t1], i) => {
        const a = E.out(P(t, t0, t0 + .45)); if (a <= 0) return
        const done = t >= t1, y = 300 + i * 116, c = done ? C.green : C.amber
        withA(a, () => {
          panel(1400, y, 380, 96, { r: 16, stroke: hexA(c, .6), lw: 2, fill: tint(c, .05) })
          chip(done ? '✓' : String(i + 1), 1432, y + 48, { size: 20, col: c, solid: true, font: SANS })
          txt(done ? s : q, 1476, y + 57, { size: 24, weight: 600, color: C.text })
        })
      })
      // 阶段 B：Service 出场
      const sa = E.out(P(t, 5.8, 6.3))
      if (sa > 0) {
        box(680, 560, 320, 120, 'Service whoami', 'ClusterIP 10.96.120.15', COL, { alpha: sa, hi: t < 7.2 })
        withA(sa, () => chip('selector: app=whoami', 680, 650, { size: 16, col: COL }))
        arrow(300, 560, 514, 560, E.out(P(t, 6.2, 6.6)), COL, 2.5)
        withA(E.out(P(t, 6.4, 6.8)), () => chip('whoami:80', 408, 522, { size: 16, col: COL }))
        P1.forEach(([x, y], i) => {
          const ok = i !== 1 || t >= 9.4
          arrow(842, 560, x - 64, y, E.out(P(t, 6.4 + i * .15, 6.9 + i * .15)), ok ? hexA(COL, .6) : hexA(C.mute, .35), 2, ok ? undefined : [6, 6])
          if (t > 7.2 && ok) flow(842, 560, x - 64, y, t, COL, 3, .6, i * .3, 4)
        })
        if (t > 7.0) flow(300, 560, 514, 560, t, COL, 3, .7, 0, 4)
      }
      // 阶段 C：kube-proxy
      const ka = E.out(P(t, 11.0, 11.5))
      if (ka > 0) {
        withA(ka, () => {
          panel(140, 760 + lerp(20, 0, ka), 800, 120, { r: 18, stroke: hexA(C.violet, .5), fill: tint(C.violet, .04) })
          txt('kube-proxy', 176, 806 + lerp(20, 0, ka), { size: 26, weight: 600, font: MONO, color: C.violet })
          chip('每个节点一份', 404, 798 + lerp(20, 0, ka), { size: 17, font: SANS, col: C.violet })
          txt('iptables / IPVS：10.96.120.15:80 → PodIP:80', 176, 852 + lerp(20, 0, ka), { size: 20, font: MONO, color: C.body })
        })
        partialLine(680, 760, 680, 670, E.out(P(t, 11.6, 12.1)), hexA(C.violet, .6), 2.5, [6, 6])
        travel(680, 760, 680, 672, P(t, 11.8, 12.4), C.violet)
      }
      withA(E.out(P(t, 13.4, 13.9)), () => chip('VIP 没有网卡：ping 不通，curl 能通', 1590, 760, { size: 18, font: SANS, col: C.violet }))
    },
  }

  // 场景 2：ClusterIP 与端口
  const SVC = ['apiVersion: v1', 'kind: Service', 'metadata:', '  name: whoami', 'spec:', '  type: ClusterIP', '  selector:', '    app: whoami', '  ports:', '    - name: http', '      port: 80', '      targetPort: http']
  const P2 = [[1560, 300, 'kq2xz'], [1560, 400, '5tlm8'], [1560, 500, 'wr9vj']]
  const HITS = [0, 1, 0, 2, 1, 2]
  const HT = HITS.map((_, k) => 12.9 + k * .35)
  const LOOP = [
    { t: 10.6, cmd: 'for i in $(seq 6); do wget -qO- whoami | grep Hostname; done' },
    ...HITS.map((p, k) => ({ t: HT[k], out: 'Hostname: whoami-7f9c6d8b5-' + P2[p][2], color: [COL, C.violet, C.teal][p] })),
  ]
  const clusterip = {
    name: 'ClusterIP 与端口', dur: 16, mood: 2,
    vo: [[0.6, 'ClusterIP 是默认类型，只在集群内可达。', 'ClusterIP 是默认类型，只在集群内部可以访问。'],
      [5.6, 'port 是 Service 端口，targetPort 指向容器。', 'port 是 Service 自己的端口，target port 指向容器端口。'],
      [10.8, '连请求六次，流量分散到三个 Pod。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], ...P2.map((_, i) => [1.4 + i * .2, 'pop']), [3.0, 'tick'], [5.8, 'tick'], [7.6, 'tick'], [9.0, 'pop'], ...typeCues(LOOP, 30), ...HT.map(x => [x, 'tick']), [14.9, 'chime']],
    draw(t, T) {
      heading('ClusterIP：集群内的稳定入口', 140, 210, t, .2, { eyebrow: 'CLUSTERIP', color: COL })
      const hi = t < 3 ? [5] : t < 5.6 ? [6, 7] : t < 7.6 ? [10] : t < 10.6 ? [11] : []
      code(140, 270, 700, SVC, t, .5, { title: 'whoami-svc.yaml', size: 20, step: .07, hi: t > 1.2 ? hi : [], hiColor: t >= 7.6 ? C.teal : COL })
      // 右侧示意
      const sa = E.out(P(t, .8, 1.3))
      box(1100, 400, 300, 110, 'Service whoami', '10.96.120.15', COL, { alpha: sa })
      withA(sa, () => {
        const pp = t >= 5.6
        chip(pp ? 'port: 80' : 'type: ClusterIP · 集群内可达', 1100, 322, { size: 18, col: pp ? COL : C.mute, solid: pp && t < 7.6, font: pp ? MONO : SANS })
      })
      withA(E.out(P(t, 3.0, 3.4)), () => chip('selector: app=whoami', 1100, 490, { size: 18, col: COL, solid: t < 5.6 }))
      const cnt = [0, 0, 0]
      HITS.forEach((p, k) => { if (t >= HT[k]) cnt[p]++ })
      P2.forEach(([x, y, id], i) => {
        const t0 = 1.4 + i * .2
        arrow(1252, 400, x - 46, y, E.out(P(t, t0 + .4, t0 + .8)), hexA(COL, .5), 2)
        const k = E.back(P(t, t0, t0 + .45)); if (k <= 0) return
        pod(x, y, 80, { state: 'run', scale: k })
        withA(clamp(k), () => txt('…-' + id, 1612, y + 7, { size: 20, font: MONO }))
        if (cnt[i] > 0) chip('×' + cnt[i], 1712, y, { size: 18, align: 'left', col: [COL, C.violet, C.teal][i], solid: true })
      })
      withA(E.out(P(t, 7.6, 8.0)), () => chip('targetPort: http → 容器 80', 1380, 280, { size: 18, col: C.teal, solid: t < 10.6 }))
      // 负载均衡的请求
      HITS.forEach((p, k) => {
        const [x, y] = P2[p]
        travel(1252, 400, x - 46, y, P(t, HT[k] - .35, HT[k]), [COL, C.violet, C.teal][p], 6)
        ring(x, y, P(t, HT[k], HT[k] + .6), [COL, C.violet, C.teal][p], 60)
      })
      // TIP
      const ta = E.out(P(t, 9.0, 9.5))
      withA(ta, () => {
        panel(140, 776, 700, 104, { r: 16, stroke: hexA(C.teal, .5), fill: tint(C.teal, .05) })
        txt('TIP · targetPort 可以写端口名', 170, 816, { size: 22, weight: 600, color: C.teal })
        txt('容器端口改了只动 Pod 模板，Service 不用改', 170, 854, { size: 20, color: C.body })
      })
      terminal(900, 580, 880, 300, t, LOOP, { size: 19, alpha: E.out(P(t, 10.3, 10.7)), title: 'client Pod · sh' })
    },
  }

  // 场景 3：EndpointSlice
  const EP = [
    { ip: '10.244.1.4', py: 310, slot: 0, tin: 2.0, tout: 11.3, pin: 1.0 },
    { ip: '10.244.2.5', py: 405, slot: 1, tin: 2.4, tout: 6.3, pin: 1.2 },
    { ip: '10.244.1.5', py: 500, slot: 2, tin: 2.8, tout: 6.3, pin: 1.4 },
    { ip: '10.244.2.7', py: 405, slot: 1, tin: 9.3, tout: 11.3, pin: 8.6 },
    { ip: '10.244.1.9', py: 500, slot: 2, tin: 9.7, tout: 11.3, pin: 8.6, nr: true },
  ]
  const EPT = [
    { t: 4.6, cmd: 'kubectl scale deploy whoami --replicas=1' },
    { t: 6.1, out: 'deployment.apps/whoami scaled', color: C.green },
    { t: 7.0, cmd: 'kubectl scale deploy whoami --replicas=3' },
    { t: 8.5, out: 'deployment.apps/whoami scaled', color: C.green },
    { t: 11.4, cmd: 'kubectl describe svc whoami' },
    { t: 12.5, out: 'Selector:          app=whoam', color: C.red },
    { t: 12.8, out: 'Endpoints:         <none>', color: C.red, sfx: 'alarmSoft' },
  ]
  const slices = {
    name: 'EndpointSlice', dur: 16, mood: 3,
    vo: [[0.6, '控制器把就绪 Pod 的地址写进 EndpointSlice。'],
      [5.6, '缩容或未就绪，地址就从表里摘掉。'],
      [10.8, 'Service 不通？先看 Endpoints 是否为空。']],
    cues: [[0.4, 'whoosh'], [0.7, 'pop'], [1.0, 'pop'], [1.2, 'pop'], [1.4, 'pop'], [2.0, 'tick'], [2.4, 'tick'], [2.8, 'tick'], ...typeCues(EPT, 30), [6.3, 'poof'], [8.6, 'pop'], [9.3, 'tick'], [9.7, 'tick'], [10.8, 'error'], [11.3, 'poof'], [13.6, 'pop']],
    draw(t) {
      heading('EndpointSlice：Service 的地址簿', 140, 210, t, .2, { eyebrow: 'ENDPOINTSLICE', color: COL })
      const typo = t >= 10.8
      const sa = E.out(P(t, .6, 1.1))
      box(290, 400, 300, 110, 'Service whoami', ' ', COL, { alpha: sa, hi: typo && t < 12 })
      withA(sa, () => {
        txt('selector: app=', 172, 432, { size: 17, font: MONO, color: C.mute })
        txt(typo ? 'whoam' : 'whoami', 172 + textW('selector: app=', 17, { font: MONO }), 432, { size: 17, font: MONO, color: typo ? C.red : COL, weight: 600 })
      })
      ring(290, 400, P(t, 10.8, 11.6), C.red, 150)
      // Service → Slice
      const la = E.out(P(t, 1.4, 1.8))
      arrow(442, 400, 516, 400, la, typo ? C.red : hexA(COL, .6), 2.5)
      withA(la, () => txt('写入', 479, 382, { size: 16, color: C.mute, align: 'center' }))
      // Slice 面板
      const pa = E.out(P(t, 1.2, 1.7))
      withA(pa, () => {
        panel(520, 270, 640, 270, { r: 18, fill: '#ffffff', stroke: hexA(C.violet, .45) })
        chip('EndpointSlice · whoami-8hx2c', 544, 300, { size: 18, align: 'left', col: C.violet, solid: true })
        txt('kube-proxy 只转发给 ready 端点', 840, 522, { size: 17, color: C.mute, align: 'center', alpha: E.out(P(t, 3.6, 4.1)) })
      })
      EP.forEach(e => {
        const a = E.out(P(t, e.tin, e.tin + .35)) * (1 - E.out(P(t, e.tout + .3, e.tout + .8))); if (a <= 0) return
        const y = 356 + e.slot * 52, c = e.nr ? C.amber : C.green
        travel(1290, e.py, 1140, y, P(t, e.tin - .45, e.tin), c, 6)
        withA(a, () => {
          ctx.save(); ctx.fillStyle = tint(c, .08); rr(544, y - 22, 592, 44, 10); ctx.fill(); ctx.restore()
          txt(e.ip + ':80', 566, y + 8, { size: 22, font: MONO, color: C.text })
          chip(e.nr ? 'ready: false' : 'ready', 1122, y, { size: 16, align: 'right', col: c })
          const s = E.out(P(t, e.tout, e.tout + .3))
          if (s > 0) line(560, y, lerp(560, 1120, s), y, C.red, 2.5)
        })
      })
      withA(E.out(P(t, 13.6, 14.1)), () => chip('空 → 选择器不匹配，或 Pod 没就绪', 840, 410, { size: 20, font: SANS, col: C.red, solid: true }))
      // Pod 列
      EP.forEach((e, i) => {
        const k = E.back(P(t, e.pin, e.pin + .45)); if (k <= 0) return
        const gone = i === 1 || i === 2 ? 1 - E.out(P(t, 6.3, 6.6)) : 1
        if (gone <= 0) return
        const st = e.nr ? 'pending' : (i >= 3 && t < 9.3 ? 'pending' : 'run')
        pod(1330, e.py, 76, { state: st, scale: k, alpha: gone * (typo ? .55 : 1) })
        withA(clamp(k) * gone, () => {
          txt(e.ip, 1385, e.py + 7, { size: 20, font: MONO, alpha: typo ? .55 : 1 })
          if (e.nr && t > 9.3) chip('readiness ✗', 1532, e.py, { size: 16, align: 'left', col: C.amber })
        })
      })
      ;[1, 2].forEach(i => poof(1330, EP[i].py, P(t, 6.3, 7.0), C.mute))
      terminal(140, 570, 1640, 310, t, EPT, { size: 20, alpha: E.out(P(t, 4.2, 4.6)) })
    },
  }

  // 场景 4：集群 DNS 与 Headless
  const SEG = [['whoami', COL, '服务名'], ['.', C.mute], ['default', C.violet, '命名空间'], ['.', C.mute], ['svc', C.mute, '固定'], ['.', C.mute], ['cluster.local', C.teal, '集群域']]
  const NS1 = [
    { t: 5.8, cmd: 'nslookup whoami' },
    { t: 6.6, out: 'Server:   10.96.0.10', color: C.mute },
    { t: 6.9, out: 'Name:     whoami.default.svc.cluster.local', color: C.text },
    { t: 7.2, out: 'Address:  10.96.120.15', color: COL, sfx: 'ok' },
  ]
  const NS2 = [
    { t: 10.9, cmd: 'nslookup whoami-headless' },
    { t: 11.9, out: 'Address:  10.244.1.4', color: C.green },
    { t: 12.2, out: 'Address:  10.244.2.5', color: C.green },
    { t: 12.5, out: 'Address:  10.244.1.5', color: C.green },
    { t: 13.4, out: '# StatefulSet · gRPC 客户端负载均衡', color: C.mute },
  ]
  const PIPS = ['10.244.1.4', '10.244.2.5', '10.244.1.5']
  const dns = {
    name: 'DNS 与 Headless', dur: 16, mood: 1,
    vo: [[0.6, 'CoreDNS 为每个 Service 生成 DNS 记录。'],
      [5.6, '普通 Service，解析出一个 ClusterIP。'],
      [10.8, 'Headless 不分配 VIP，直接返回 Pod IP。', 'Headless Service 不分配虚拟 IP，直接返回 Pod IP。']],
    cues: [[0.4, 'whoosh'], ...SEG.map((_, k) => [0.8 + k * .25, 'tick']), [3.4, 'pop'], [3.8, 'pop'], ...typeCues(NS1, 30), [7.6, 'zap'], ...typeCues(NS2, 30), [11.9, 'pop'], [12.2, 'pop'], [12.5, 'pop'], [12.8, 'zap']],
    draw(t, T) {
      heading('集群 DNS：用名字找服务', 140, 210, t, .2, { eyebrow: 'CLUSTER DNS', color: COL })
      // 域名拆解
      const fs = 46, ws = SEG.map(s => textW(s[0], fs, { font: MONO, weight: 600 }))
      let x = 960 - ws.reduce((a, b) => a + b, 0) / 2
      SEG.forEach(([s, c, lab], k) => {
        const a = E.out(P(t, .8 + k * .25, 1.2 + k * .25))
        txt(s, x, 316 + lerp(14, 0, a), { size: fs, font: MONO, weight: 600, color: c, alpha: a })
        if (lab) withA(a, () => { line(x + 4, 336, x + ws[k] - 4, 336, hexA(c, .5), 2); txt(lab, x + ws[k] / 2, 364, { size: 20, color: C.body, align: 'center' }) })
        x += ws[k]
      })
      withA(E.out(P(t, 3.4, 3.8)), () => chip('同命名空间：whoami', 760, 412, { size: 18, font: SANS, col: COL }))
      withA(E.out(P(t, 3.8, 4.2)), () => chip('跨命名空间：whoami.default', 1160, 412, { size: 18, font: SANS, col: C.violet }))
      // 左：普通 Service
      const la = E.out(P(t, 5.4, 5.8))
      terminal(140, 450, 800, 250, t, NS1, { size: 20, alpha: lerp(.0, 1, la), title: 'ClusterIP Service' })
      const da = E.out(P(t, 7.6, 8.1))
      if (da > 0) {
        withA(da, () => chip('VIP 10.96.120.15', 290, 790, { size: 18, col: COL, solid: true }))
        ;[735, 790, 845].forEach((y, i) => {
          arrow(390, 790, 730, y, E.out(P(t, 7.9 + i * .1, 8.4 + i * .1)), hexA(COL, .5), 2)
          pod(760, y, 48, { state: 'run', scale: E.back(P(t, 8.0 + i * .1, 8.4 + i * .1)) })
          if (t > 8.6) flow(390, 790, 730, y, t, COL, 2, .6, i * .33, 3.5)
        })
        wheel(560, 790, 20, { p: P(t, 8.0, 8.6), rot: T * .8, color: C.violet })
        withA(E.out(P(t, 8.4, 8.9)), () => { txt('经 kube-proxy', 812, 782, { size: 19, color: C.body }); txt('再分流', 812, 810, { size: 19, color: C.body }) })
      }
      // 右：Headless
      const ra = E.out(P(t, 10.4, 10.9))
      terminal(980, 450, 800, 250, t, NS2, { size: 20, alpha: ra, title: 'clusterIP: None · Headless' })
      const ha = E.out(P(t, 12.8, 13.3))
      if (ha > 0) {
        withA(ha, () => chip('client', 1100, 790, { size: 18, col: C.text }))
        ;[735, 790, 845].forEach((y, i) => {
          arrow(1150, 790, 1374, y, E.out(P(t, 12.9 + i * .1, 13.4 + i * .1)), hexA(C.green, .6), 2)
          pod(1400, y, 48, { state: 'run', scale: E.back(P(t, 12.9 + i * .1, 13.3 + i * .1)) })
          withA(ha, () => txt(PIPS[i], 1440, y + 6, { size: 18, font: MONO }))
        })
        withA(E.out(P(t, 13.4, 13.9)), () => { txt('客户端', 1590, 782, { size: 19, color: C.body }); txt('自己挑 Pod', 1590, 810, { size: 19, color: C.body }) })
      }
    },
  }

  // 场景 5：NodePort · LoadBalancer · ExternalName
  const NODES = [300, 400, 500]
  const PODS5 = [340, 440, 540]
  const expose = {
    name: '对外暴露与别名', dur: 17, mood: 2,
    vo: [[0.6, 'NodePort 在每个节点上开同一个端口。'],
      [5.6, 'LoadBalancer 再向云要一个外部 IP。', 'LoadBalancer 再向云厂商申请一个外部 IP。'],
      [10.8, 'ExternalName 只是 DNS 里的一条 CNAME。', 'ExternalName 只是 DNS 里的一条 C name 记录。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.0, 'tick'], [1.6, 'pop'], [1.8, 'pop'], [2.0, 'pop'], [2.4, 'tick'], [2.8, 'pop'], [5.8, 'pop'], [6.2, 'zap'], [6.4, 'tick'], [7.4, 'tick'], [9.6, 'ok'], [11.0, 'pop'], [11.6, 'zap'], [12.2, 'pop'], [13.6, 'tick']],
    draw(t, T) {
      heading('从集群外访问：层层叠加', 140, 210, t, .2, { eyebrow: 'NODEPORT · LOADBALANCER · EXTERNALNAME', color: COL })
      const dim = 1 - .45 * E.out(P(t, 10.8, 11.3))
      withA(dim, () => {
        // ClusterIP 核心
        const sa = E.out(P(t, .8, 1.3))
        box(1200, 440, 280, 110, 'Service', 'ClusterIP :80', COL, { alpha: sa })
        PODS5.forEach((y, i) => {
          arrow(1342, 440, 1536, y, E.out(P(t, 1.0 + i * .1, 1.4 + i * .1)), hexA(COL, .5), 2)
          pod(1580, y, 76, { state: 'run', scale: E.back(P(t, 1.0 + i * .1, 1.4 + i * .1)) })
          if (t > 2.2) flow(1342, 440, 1536, y, t, COL, 2, .6, i * .3, 3.5)
        })
        // NodePort：每个节点同一端口
        withA(E.out(P(t, 1.4, 1.8)), () => chip('nodePort 范围 30000–32767', 800, 584, { size: 17, col: C.teal }))
        NODES.forEach((y, i) => {
          const a = E.out(P(t, 1.6 + i * .2, 2.0 + i * .2)); if (a <= 0) return
          withA(a, () => {
            panel(650, y - 40, 300, 80, { r: 14, fill: '#ffffff', stroke: hexA(C.teal, .5) })
            txt('node-' + (i + 1), 674, y + 8, { size: 21, font: MONO, weight: 600 })
            chip(':30080', 928, y, { size: 18, align: 'right', col: C.teal, solid: t > 2.4 && t < 5.4 })
          })
          arrow(950, y, 1058, 440, E.out(P(t, 2.2 + i * .1, 2.6 + i * .1)), hexA(C.teal, .6), 2)
          if (t > 3.0) flow(950, y, 1058, 440, t, C.teal, 2, .6, i * .3, 3.5)
        })
        withA(E.out(P(t, 2.8, 3.2)), () => chip('PORT(S)  80:30080/TCP', 1200, 530, { size: 17, col: C.teal }))
        // LoadBalancer
        const lb = E.out(P(t, 5.8, 6.3))
        if (lb > 0) {
          user(190, 430, 26, C.body, lb)
          withA(lb, () => txt('外部用户', 190, 530, { size: 18, color: C.body, align: 'center' }))
          box(430, 440, 200, 110, 'Cloud LB', 'EXTERNAL-IP', C.violet, { alpha: lb, hi: t < 7.2 })
          arrow(226, 440, 326, 440, E.out(P(t, 6.2, 6.6)), C.violet, 2.5)
          NODES.forEach((y, i) => {
            arrow(532, 440, 648, y, E.out(P(t, 6.4 + i * .1, 6.8 + i * .1)), hexA(C.violet, .6), 2)
            if (t > 7.0) flow(532, 440, 648, y, t, C.violet, 2, .6, i * .3, 3.5)
          })
          if (t > 6.8) flow(226, 440, 326, 440, t, C.violet, 2, .7, 0, 3.5)
          const got = t >= 9.6
          withA(E.out(P(t, 7.4, 7.8)), () => {
            chip(got ? '172.18.0.5' : '<pending>', 430, 528, { size: 18, col: got ? C.green : C.amber, solid: got && t < 10.8 })
            txt(got ? 'cloud-provider-kind 分配' : 'kind 里没有 LB 实现', 430, 574, { size: 17, color: got ? C.green : C.amber, align: 'center' })
          })
          ring(430, 528, P(t, 9.6, 10.4), C.green, 80)
        }
        // 叠加关系
        bracket(1040, 1780, 640, 'ClusterIP', '集群内访问', COL, P(t, 1.0, 1.6))
        bracket(620, 1780, 684, 'NodePort', '+ 每个节点开端口', C.teal, P(t, 2.4, 3.0))
        bracket(300, 1780, 728, 'LoadBalancer', '+ 外部 LB 的 IP', C.violet, P(t, 6.4, 7.0))
      })
      // ExternalName
      const ea = E.out(P(t, 11.0, 11.5))
      if (ea > 0) {
        withA(ea, () => {
          panel(140, 770 + lerp(20, 0, ea), 1640, 110, { r: 18, stroke: hexA(C.amber, .55), fill: tint(C.amber, .05), lw: 2 })
          const y = 825 + lerp(20, 0, ea)
          pod(210, y, 56, { state: 'run' })
          chip('database', 400, y, { size: 20, col: C.amber, solid: true })
          txt('type: ExternalName', 400, y + 44, { size: 16, font: MONO, color: C.mute, align: 'center' })
          chip('db.example.com', 800, y, { size: 20, col: C.text })
        })
        const y = 825
        arrow(246, y, 336, y, E.out(P(t, 11.4, 11.8)), hexA(C.amber, .7), 2.5)
        arrow(470, y, 710, y, E.out(P(t, 11.8, 12.3)), hexA(C.amber, .7), 2.5)
        withA(E.out(P(t, 12.0, 12.4)), () => txt('CNAME', 590, y - 14, { size: 17, font: MONO, color: C.amber, align: 'center' }))
        withA(E.out(P(t, 12.6, 13.1)), () => {
          txt('不选 Pod · 没有 ClusterIP · 不做端口映射', 1000, y - 6, { size: 21, color: C.text })
          txt('Host 头与 TLS 校验看到的仍是 database', 1000, y + 28, { size: 18, color: C.mute })
        })
      }
      withA(E.out(P(t, 13.6, 14.1)), () => chip('对外 HTTP 通常走 Ingress / Gateway', 1590, 270, { size: 17, font: SANS, col: C.mute }))
    },
  }

  ANIM({
    id: 'services',
    meta: { stage: 1, lesson: 5, of: 6, title: 'Service 与服务发现', summary: 'ClusterIP、NodePort、LoadBalancer、Headless，以及集群 DNS。', next: 'ConfigMap 与 Secret' },
    scenes: [
      lessonIntro({ tags: ['ClusterIP', 'EndpointSlice', '集群 DNS', 'NodePort · LB', 'Headless'], vo: [[3.2, 'Service：给一组 Pod 一个稳定入口。']] }),
      why, clusterip, slices, dns, expose,
      lessonOutro({
        points: ['Service = 稳定 VIP + DNS 名 + 负载均衡', 'EndpointSlice 只收录就绪的 Pod', '<svc>.<ns>.svc.cluster.local → ClusterIP', 'NodePort、LB 层层叠加；Headless 直给 Pod IP'],
        vo: [[0.8, '小结：Service 解决了 Pod 地址不固定。'], [5.6, '下一课，用 ConfigMap 和 Secret 管配置。']],
      }),
    ],
  })
})()
