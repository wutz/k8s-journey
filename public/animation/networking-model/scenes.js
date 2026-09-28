/* 第 3 阶段 · 第 2 课：网络模型与 CNI */
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

// 折线箭头：pts 依次连接，p 为已绘制比例
function pathArrow(pts, p, color, w = 2.5) {
  if (p <= 0) return
  const segs = []; let tot = 0
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); tot += d }
  let rem = p * tot
  for (let i = 0; i < segs.length && rem > 0; i++) {
    const f = Math.min(1, rem / segs[i]); rem -= segs[i]
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    if (f >= 1 && i < segs.length - 1) line(x1, y1, x2, y2, color, w)
    else arrow(x1, y1, lerp(x1, x2, f), lerp(y1, y2, f), 1, color, w)
  }
}

// 场景 1：三条原则
const RULES = [
  ['每个 Pod 一个 IP', 'IP-per-Pod，容器共享它'],
  ['Pod ↔ Pod 不经 NAT', '跨节点也能看到真实源 IP'],
  ['节点 ↔ Pod 直通', '主机进程可直接访问 Pod'],
]
const rules = {
  name: '三条原则', dur: 15, mood: 1,
  vo: [[0.6, 'K8s 网络模型只有三条规则。', 'Kubernetes 网络模型只有三条规则。'],
    [4.8, '每个 Pod 一个独立 IP，Pod 之间直连，不做 NAT。'],
    [10.4, '节点也能直接访问 Pod，实现交给 CNI 插件。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.1, 'pop'], [1.6, 'tick'], [1.9, 'tick'], [2.2, 'tick'],
    [4.9, 'pop'], [5.2, 'pop'], [5.5, 'pop'], [7.0, 'zap'], [9.0, 'ok'], [10.6, 'zap'], [11.6, 'ok'], [12.6, 'chime']],
  draw(t) {
    heading('Pod 网络的三条原则', 140, 210, t, .2, { eyebrow: 'NETWORK MODEL', color: COL })
    const cur = t < 4.8 ? -1 : t < 7 ? 0 : t < 10.4 ? 1 : 2
    // 两个节点
    ;[[140, 'node-1', '192.168.1.11', '10.244.1.0/24', .8], [1060, 'node-2', '192.168.1.12', '10.244.2.0/24', 1.1]].forEach(([x, n, ip, cidr, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      node(x, 280, 720, 360, n, { alpha: a })
      chip('podCIDR ' + cidr, x + 706, 300, { size: 16, col: COL, align: 'right', alpha: a, pad: 10 })
      chip('eth0 ' + ip, x + 360, 612, { size: 16, col: C.mute, alpha: a })
    })
    const la = E.out(P(t, 1.3, 1.8))
    line(860, 612, 1060, 612, hexA(C.text, .3 * la), 2.5)
    withA(la, () => txt('节点网络', 960, 598, { size: 16, color: C.mute, align: 'center' }))
    // Pod 与 IP
    ;[[330, '10.244.1.5', 1.0], [670, '10.244.1.6', 1.2], [1250, '10.244.2.8', 1.4]].forEach(([x, ip, t0], i) => {
      const k = E.back(P(t, t0, t0 + .5))
      pod(x, 450, 110, { state: 'run', alpha: clamp(k), scale: k })
      chip(ip, x, 548, { size: 18, col: COL, solid: cur === 0, alpha: E.out(P(t, 4.9 + i * .3, 5.3 + i * .3)) })
    })
    // 主机进程
    sbox(1590, 450, 240, 120, '主机进程', 'kubelet · curl', C.teal, { alpha: E.out(P(t, 1.6, 2.1)), hi: cur === 2, size: 24 })
    // Pod → Pod 直连
    const pp = P(t, 7.0, 9.0)
    if (pp > 0 && pp < 1) travelPath([[330, 450], [330, 612], [1250, 612], [1250, 450]], E.inOut(pp), COL, 9)
    withA(E.out(P(t, 7.2, 7.7)), () => chip('src 10.244.1.5 → dst 10.244.2.8', 960, 668, { size: 17, col: COL }))
    ring(1250, 450, P(t, 9.0, 10), C.green, 110)
    // 节点 → Pod
    const hp = E.out(P(t, 10.6, 11.4))
    arrow(1468, 450, 1312, 450, hp, C.teal, 3)
    if (t > 11.4) flow(1468, 474, 1312, 474, t, C.teal, 3, .9, 0, 4)
    // 三张原则卡
    RULES.forEach(([h, s], i) => {
      const a = E.out(P(t, 1.6 + i * .3, 2.1 + i * .3)); if (a <= 0) return
      const x = 140 + i * 570, on = cur === i, done = cur > i
      withA(a * (cur < 0 || on || done ? 1 : .55), () => {
        panel(x, 720, 500, 140, { r: 18, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .06) : C.panel })
        chip(String(i + 1), x + 44, 772, { size: 20, col: COL, solid: on || done, font: SANS })
        txt(h, x + 78, 781, { size: 26, weight: 600 })
        txt(s, x + 78, 826, { size: 20, color: C.body })
        if (done || (on && i === 2 && t > 11.6)) check(x + 460, 772, 24, C.green, 1)
      })
    })
    chip('实现交给 CNI 插件：Flannel · Calico · Cilium', 1780, 200, { size: 20, col: COL, align: 'right', alpha: E.out(P(t, 12.6, 13.1)) })
  },
}

// 场景 2：overlay 与原生路由
function miniTopo(px, t, a, col, solid, t0) {
  withA(a, () => {
    if (solid) line(400 + px - 140, 400, 660 + px - 140, 400, hexA(col, .6), 3)
    else {
      line(400 + px - 140, 400, 660 + px - 140, 400, hexA(col, .16), 30)
      line(400 + px - 140, 386, 660 + px - 140, 386, hexA(col, .6), 2, [8, 6])
      line(400 + px - 140, 414, 660 + px - 140, 414, hexA(col, .6), 2, [8, 6])
    }
    sbox(px + 160, 400, 200, 84, 'node-1', '192.168.1.11', C.text, { size: 22 })
    sbox(px + 620, 400, 200, 84, 'node-2', '192.168.1.12', C.text, { size: 22 })
  })
  if (t > t0 && a > .5) { const q = ((t - t0) % 1.6) / 1.6; if (q < .8) travel(px + 262, 400, px + 518, 400, q / .8, col, 8) }
}
const overlay = {
  name: 'overlay 与路由', dur: 17, mood: 2,
  vo: [[0.6, '跨节点有两条路，一是 overlay 隧道。'],
    [5.4, '原始包被套上一层 UDP 外壳，头部多约 50 字节。'],
    [10.8, '二是原生路由：直接把对端 Pod 网段路由过去。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'pop'], [2.2, 'tick'], [5.6, 'zap'], [6.4, 'thud'], [7.6, 'tick'], [8.4, 'tick'],
    [10.9, 'whoosh'], [11.4, 'pop'], ...typeCues([{ t: 11.6, cmd: 'ip route' }], 30), [12.0, 'tick'], [13.0, 'ok'], [13.6, 'tick'], [14.2, 'tick']],
  draw(t) {
    heading('跨节点：overlay 还是原生路由', 140, 210, t, .2, { eyebrow: 'OVERLAY VS ROUTING', color: COL })
    const dimL = 1 - .4 * E.out(P(t, 10.8, 11.4)), dimR = .45 + .55 * E.out(P(t, 10.8, 11.4))
    // ---- 左：overlay ----
    const la = E.out(P(t, .6, 1.1))
    withA(la * dimL, () => {
      panel(140, 280, 780, 600, { r: 22, stroke: t < 10.8 ? hexA(C.amber, .7) : C.hair, lw: t < 10.8 ? 2 : 1.5 })
      chip('Overlay · VXLAN / Geneve', 170, 322, { size: 20, col: C.amber, solid: true, align: 'left' })
    })
    miniTopo(140, t, la * dimL, C.amber, false, 1.6)
    // 内层包 + 外层封装
    const ia = E.out(P(t, 2.0, 2.5)), k = E.inOut(P(t, 5.6, 6.6))
    withA(ia * dimL, () => {
      if (k > 0) {
        const ox = lerp(210, 180, k), oy = lerp(600, 500, k), ow = lerp(640, 700, k), oh = lerp(110, 230, k)
        ctx.save(); rr(ox, oy, ow, oh, 16); ctx.fillStyle = tint(C.amber, .1 * k); ctx.fill(); ctx.strokeStyle = hexA(C.amber, k); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore()
        const ta = P(k, .6, 1)
        txt('外层 IP  192.168.1.11 → 192.168.1.12', 206, 542, { size: 20, font: MONO, color: C.text, alpha: ta })
        txt('UDP 8472 · VXLAN 头', 206, 578, { size: 18, font: MONO, color: C.amber, alpha: ta })
      }
      ctx.save(); rr(210, 600, 640, 110, 14); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = COL; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
      txt('内层 IP  10.244.1.5 → 10.244.2.8', 236, 644, { size: 20, font: MONO, color: C.text })
      txt('TCP 80 · 原始数据', 236, 682, { size: 18, font: MONO, color: COL })
      chip('封装头约 +50 B · Pod MTU 要调小', 180, 786, { size: 18, col: C.amber, align: 'left', alpha: E.out(P(t, 7.6, 8.1)) })
      chip('适合：云上 / 底层网络不受控', 180, 840, { size: 18, col: C.mute, align: 'left', alpha: E.out(P(t, 8.4, 8.9)) })
    })
    // ---- 右：原生路由 ----
    const ra = E.out(P(t, 1.0, 1.5))
    withA(ra * dimR, () => {
      panel(1000, 280, 780, 600, { r: 22, stroke: t >= 10.8 ? hexA(C.green, .7) : C.hair, lw: t >= 10.8 ? 2 : 1.5 })
      chip('原生路由 · host-gw / BGP', 1030, 322, { size: 20, col: C.green, solid: true, align: 'left' })
    })
    miniTopo(1000, t, ra * dimR, C.green, true, t >= 11.4 ? 11.4 : 1e9)
    const rt = E.out(P(t, 11.4, 11.9))
    withA(rt, () => {
      panel(1040, 496, 700, 200, { r: 14, fill: '#fff' })
      txt('node-1 ❯', 1066, 536, { size: 18, font: MONO, color: C.mute })
      const cmd = 'ip route'.slice(0, Math.floor((t - 11.6) * 30))
      txt(cmd, 1160, 536, { size: 18, font: MONO, color: C.text })
      line(1040, 556, 1740, 556, C.hair, 1)
      const r1 = E.out(P(t, 12.0, 12.3)), r2 = E.out(P(t, 12.3, 12.6))
      if (t > 13.0) { ctx.save(); ctx.globalAlpha *= E.out(P(t, 13.0, 13.4)); ctx.fillStyle = tint(C.green, .14); ctx.fillRect(1042, 572, 696, 40); ctx.restore() }
      txt('10.244.2.0/24 via 192.168.1.12 dev eth0', 1066, 600, { size: 19, font: MONO, color: C.text, alpha: r1 })
      txt('10.244.3.0/24 via 192.168.1.13 dev eth0', 1066, 648, { size: 19, font: MONO, color: C.body, alpha: r2 })
    })
    chip('无封装 · 性能好 · 排查直观', 1040, 786, { size: 18, col: C.green, align: 'left', alpha: E.out(P(t, 13.6, 14.1)) })
    chip('适合：能配交换机 / BGP 的自建机房', 1040, 840, { size: 18, col: C.mute, align: 'left', alpha: E.out(P(t, 14.2, 14.7)) })
  },
}

// 场景 3：CNI 规范
const CONF = ['{', '  "cniVersion": "1.0.0",', '  "name": "mynet",', '  "plugins": [', '    { "type": "bridge",', '      "bridge": "cni0",',
  '      "ipam": { "type": "host-local",', '        "subnet": "10.244.1.0/24" } },', '    { "type": "portmap" }', '  ]', '}']
const cni = {
  name: 'CNI 规范', dur: 16, mood: 2,
  vo: [[0.6, 'Pod 建沙箱时，运行时去读 CNI 配置目录。'],
    [5.2, '按文件名排第一的配置，调用对应的插件程序。'],
    [10.4, '插件建网卡、分 IP，把结果返回给运行时。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'tick'], [2.0, 'pop'], [3.0, 'tick'], [5.4, 'tick'], [5.8, 'zap'], [6.6, 'tick'], [7.0, 'tick'], [7.6, 'pop'],
    [10.6, 'zap'], [11.2, 'pop'], [11.8, 'ok'], [12.6, 'chime']],
  draw(t) {
    heading('CNI：运行时调用的网络插件', 140, 210, t, .2, { eyebrow: 'CONTAINER NETWORK INTERFACE', color: COL })
    // containerd
    const ca = E.out(P(t, .6, 1.1))
    withA(ca, () => txt('kubelet → CRI RunPodSandbox', 290, 312, { size: 17, font: MONO, color: C.mute, align: 'center' }))
    sbox(290, 395, 260, 110, 'containerd', 'CRI 运行时', C.teal, { alpha: ca, hi: t > 10.4 && t < 13, size: 26 })
    // /etc/cni/net.d/
    arrow(422, 395, 496, 395, E.out(P(t, 1.2, 1.6)), hexA(C.text, .4), 2.5)
    const da = E.out(P(t, 1.2, 1.7))
    withA(da, () => {
      panel(500, 290, 520, 210, { r: 16 })
      txt('/etc/cni/net.d/', 528, 336, { size: 20, font: MONO, color: C.text })
      line(500, 356, 1020, 356, C.hair, 1)
      const pick = E.out(P(t, 5.4, 5.8))
      if (pick > 0) { ctx.save(); ctx.globalAlpha *= pick; ctx.fillStyle = tint(C.amber, .16); ctx.fillRect(502, 372, 516, 42); ctx.restore() }
      txt('10-bridge.conflist', 528, 400, { size: 20, font: MONO, color: C.text })
      txt('99-loopback.conf', 528, 452, { size: 20, font: MONO, color: C.mute })
      chip('字典序第一', 992, 394, { size: 16, col: C.amber, align: 'right', alpha: pick })
    })
    arrow(1022, 394, 1078, 394, E.out(P(t, 2.0, 2.4)), hexA(C.text, .4), 2.5)
    code(1080, 280, 700, CONF, t, 2.2, { title: '10-bridge.conflist', size: 18, step: .08, hi: t > 10.6 ? [6, 7] : t > 5.4 ? [4] : [], hiColor: t > 10.6 ? C.green : C.amber, alpha: E.out(P(t, 2.0, 2.4)) })
    // 调用插件二进制
    const cp = E.inOut(P(t, 5.8, 6.6))
    pathArrow([[290, 452], [290, 650], [578, 650]], cp, COL, 2.5)
    chip('env CNI_COMMAND=ADD', 312, 540, { size: 17, col: COL, align: 'left', alpha: E.out(P(t, 6.6, 7)) })
    chip('stdin ← 网络配置 JSON', 312, 588, { size: 17, col: COL, align: 'left', alpha: E.out(P(t, 7.0, 7.4)) })
    sbox(760, 650, 360, 100, 'bridge 插件', '/opt/cni/bin/bridge', COL, { alpha: E.out(P(t, 2.8, 3.3)) * (t < 7.4 ? .45 : 1), hi: t > 7.6 && t < 12, size: 24 })
    // 尚无网络的沙箱
    const ga = E.out(P(t, 3.2, 3.7)) * (1 - E.out(P(t, 10.8, 11.2)))
    withA(ga, () => {
      ctx.save(); hexPath(1440, 790, 48); ctx.setLineDash([8, 7]); ctx.strokeStyle = hexA(C.text, .4); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore()
      chip('新沙箱 netns · 只有 lo', 1500, 790, { size: 17, col: C.mute, align: 'left' })
    })
    ring(760, 650, P(t, 7.6, 8.6), COL, 220)
    // 结果：网桥 + veth + IP
    arrow(942, 660, 1036, 772, E.out(P(t, 10.6, 11.1)), hexA(COL, .7), 2.5)
    const ra = E.out(P(t, 11.0, 11.5))
    withA(ra, () => {
      chip('cni0 网桥', 1100, 790, { size: 18, col: C.text })
      line(1162, 790, 1386, 790, COL, 3)
      txt('veth pair', 1274, 774, { size: 16, font: MONO, color: C.mute, align: 'center' })
    })
    pod(1440, 790, 96, { state: 'run', alpha: ra, scale: E.back(P(t, 11.0, 11.5)) })
    chip('10.244.1.5/24', 1500, 790, { size: 18, col: COL, solid: true, align: 'left', alpha: E.out(P(t, 11.6, 12)) })
    chip('stdout → containerd：ips、routes', 760, 760, { size: 17, col: C.green, alpha: E.out(P(t, 12.4, 12.9)) })
    withA(E.out(P(t, 13.4, 13.9)), () => txt('删除沙箱时同样调用，命令为 DEL', 760, 820, { size: 18, color: C.body, align: 'center' }))
  },
}

// 场景 4：kube-proxy
const Y4 = 440
const kproxy = {
  name: 'kube-proxy', dur: 17, mood: 3,
  vo: [[0.6, 'ClusterIP 是虚拟 IP，没有任何网卡持有它。', 'Cluster IP 是虚拟 IP，没有任何网卡持有它。'],
    [5.4, 'kube-proxy 在每个节点写规则，把它 DNAT 到 Pod。', 'kube proxy 在每个节点写规则，把它 D NAT 到 Pod。'],
    [11.0, '规则多了 iptables 会变慢，新版推荐 nftables。', '规则多了 IP tables 会变慢，新版推荐 NF tables。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.2, 'pop'], [1.6, 'zap'], [2.8, 'error'], [5.6, 'pop'], [5.9, 'pop'], [6.2, 'pop'], [6.5, 'pop'],
    [7.0, 'zap'], [8.4, 'lock'], [9.0, 'ok'], [11.2, 'tick'], [11.6, 'tick'], [12.0, 'tick'], [13.4, 'chime']],
  draw(t) {
    heading('kube-proxy：把 ClusterIP 翻译成 Pod IP', 140, 210, t, .2, { eyebrow: 'SERVICE PROXY', color: COL })
    const ca = E.out(P(t, .8, 1.3))
    pod(220, Y4, 110, { state: 'run', alpha: ca, label: 'client' })
    // 阶段一：不存在的 VIP
    const gA = E.out(P(t, 1.2, 1.7)) * (1 - E.out(P(t, 5.2, 5.8)))
    withA(gA, () => {
      ctx.save(); ctx.beginPath(); ctx.arc(960, Y4, 90, 0, Math.PI * 2); ctx.setLineDash([10, 8]); ctx.strokeStyle = hexA(C.text, .4); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore()
      txt('10.96.0.10', 960, Y4 + 2, { size: 24, font: MONO, align: 'center' })
      txt('ClusterIP', 960, Y4 + 32, { size: 17, font: MONO, color: C.mute, align: 'center' })
      chip('dst 10.96.0.10:80', 580, Y4 - 60, { size: 18, col: COL })
      chip('没有网卡持有它 · ping 不通', 960, Y4 + 140, { size: 18, col: C.red, alpha: E.out(P(t, 2.8, 3.3)) })
      chip('ClusterIP 来自 Service CIDR 10.96.0.0/12', 960, Y4 + 250, { size: 18, col: C.mute, alpha: E.out(P(t, 3.6, 4.1)) })
    })
    const gp = P(t, 1.6, 2.8)
    if (gp > 0 && gp < 1 && t < 5.2) travel(290, Y4, 866, Y4, E.inOut(gp), COL, 9)
    if (t >= 2.8 && t < 5.2) cross(960, Y4 - 125, 26, C.red, E.out(P(t, 2.8, 3.1)))
    // 阶段二：iptables 三跳
    const B = [[620, Y4, 'KUBE-SERVICES', '匹配 VIP:80', C.blue, 5.6], [980, Y4, 'KUBE-SVC-XXXX', '随机选后端', COL, 5.9],
      [1340, Y4 - 90, 'KUBE-SEP-AAAA', 'DNAT', C.teal, 6.2], [1340, Y4 + 90, 'KUBE-SEP-BBBB', 'DNAT', C.teal, 6.5]]
    const hit = t > 7 && t < 11
    B.forEach(([x, y, n, s, c, t0], i) => sbox(x, y, 250, 100, n, s, c, { alpha: E.out(P(t, t0, t0 + .5)), hi: hit && i !== 3, size: 21 }))
    const aa = E.out(P(t, 6.2, 6.8))
    arrow(282, Y4, 492, Y4, aa, hexA(C.text, .3), 2.5); arrow(748, Y4, 852, Y4, aa, hexA(C.text, .3), 2.5)
    arrow(1108, Y4 - 20, 1212, Y4 - 80, aa, hexA(C.text, .3), 2.5); arrow(1108, Y4 + 20, 1212, Y4 + 80, aa, hexA(C.text, .3), 2.5)
    withA(aa, () => { txt('p=0.5', 1150, Y4 - 72, { size: 16, font: MONO, color: C.mute, align: 'center' }); txt('p=0.5', 1150, Y4 + 86, { size: 16, font: MONO, color: C.mute, align: 'center' }) })
    ;[[Y4 - 90, '10.244.1.5:80'], [Y4 + 90, '10.244.2.8:80']].forEach(([y, ip], i) => {
      pod(1540, y, 72, { state: 'run', alpha: aa })
      txt(ip, 1590, y + 7, { size: 18, font: MONO, color: C.text, alpha: aa })
      arrow(1466, y, 1500, y, aa, hexA(C.text, .3), 2)
    })
    const fp = P(t, 7.0, 9.0)
    if (fp > 0 && fp < 1) travelPath([[282, Y4], [980, Y4], [1340, Y4 - 90], [1540, Y4 - 90]], E.inOut(fp), COL, 9)
    chip('DNAT → 10.244.1.5:80', 1340, 290, { size: 18, col: C.teal, solid: true, alpha: E.out(P(t, 8.4, 8.9)) })
    ring(1540, Y4 - 90, P(t, 9, 10), C.green, 90)
    // 三种模式
    const M = [['iptables', '默认', C.mute, '规则按链顺序逐条匹配'], ['ipvs', 'v1.35 起废弃', C.red, '内核 IPVS · 哈希查找'], ['nftables', 'v1.33 GA · 推荐', C.green, 'map / set 匹配接近 O(1)']]
    M.forEach(([n, st, c, d], i) => {
      const a = E.out(P(t, 11.2 + i * .4, 11.7 + i * .4)); if (a <= 0) return
      const x = 140 + i * 570, on = i === 2 && t > 13.4
      withA(a, () => {
        panel(x, 680, 500, 160, { r: 18, stroke: on ? C.green : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(C.green, .06) : C.panel })
        chip(n, x + 30, 728, { size: 24, col: COL, align: 'left', solid: on })
        chip(st, x + 470, 728, { size: 16, col: c, align: 'right' })
        txt(d, x + 32, 800, { size: 21, color: C.body })
      })
    })
  },
}

// 场景 5：Cilium eBPF
const LAY = [[330, 'app 进程', 'connect(10.96.0.10:80)', C.blue], [450, 'eBPF · socket 钩子', 'cgroup/connect4', COL],
  [570, 'TCP/IP 协议栈', '直接发往后端 Pod', C.teal], [690, 'netfilter / iptables', '没有 kube-proxy 规则', C.faint]]
const cilium = {
  name: 'Cilium eBPF', dur: 15, mood: 3,
  vo: [[0.6, 'Cilium 用 eBPF，可以完全替代 kube-proxy。', 'Cilium 用 e B P F，可以完全替代 kube proxy。'],
    [5.0, '在 connect 时就改写目标地址，不再逐包 DNAT。', '在 connect 时就改写目标地址，不再逐包 D NAT。'],
    [10.2, '还带来基于身份的策略，和 Hubble 可观测。']],
  cues: [[0.4, 'whoosh'], [0.8, 'pop'], [1.4, 'tick'], [1.7, 'tick'], [2.0, 'tick'], [2.3, 'tick'], [5.2, 'zap'], [6.0, 'shimmer'], [7.4, 'pop'], [8.2, 'ok'],
    [10.4, 'pop'], [10.8, 'pop'], [11.2, 'pop'], [12.4, 'chime']],
  draw(t) {
    heading('Cilium：用 eBPF 替代 kube-proxy', 140, 210, t, .2, { eyebrow: 'EBPF', color: COL })
    code(140, 280, 620, ['kubeProxyReplacement: true', 'k8sServiceHost: 127.0.0.1', 'k8sServicePort: 6443'], t, .8, { title: 'helm values · cilium', size: 20, step: .2, hi: [0], hiColor: COL, alpha: E.out(P(t, .6, 1.1)) })
    withA(E.out(P(t, 2.4, 2.9)), () => txt('无 kube-proxy 时须直连 apiserver，否则死锁', 140, 510, { size: 18, color: C.mute }))
    // 对比
    ;[[560, 'kube-proxy', '每个包经 netfilter 做 DNAT', C.mute, 7.4, false], [712, 'Cilium eBPF', 'connect() 时改写一次，之后直达', COL, 8.2, true]].forEach(([y, n, s, c, t0, on]) => {
      withA(E.out(P(t, t0, t0 + .5)), () => {
        panel(140, y, 620, 128, { r: 16, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .06) : C.panel })
        chip(n, 170, y + 40, { size: 20, col: c, solid: on, align: 'left' })
        txt(s, 172, y + 98, { size: 22, color: on ? C.text : C.body })
      })
    })
    // 右：内核分层
    LAY.forEach(([y, n, s, c, ], i) => {
      const a = E.out(P(t, 1.4 + i * .3, 1.9 + i * .3)); if (a <= 0) return
      const sub = i === 1 && t > 5.4 ? '10.96.0.10:80 → 10.244.2.8:80' : s
      sbox(1180, y, 560, 88, n, sub, c, { alpha: a * (i === 3 ? .6 : 1), hi: (i === 1 && t > 5.2) || (i === 0 && t > 3 && t < 5.2), size: 22 })
      if (i < 3) arrow(1180, y + 46, 1180, y + 72, a, hexA(C.text, .25), 2)
    })
    ring(1180, 450, P(t, 5.2, 6.2), COL, 300)
    // 侧轨：目标地址变化
    const ta = E.out(P(t, 3.0, 3.5))
    withA(ta, () => line(1500, 300, 1500, 730, hexA(C.text, .18), 2, [6, 6]))
    const dp = P(t, 3.2, 7.2)
    if (dp > 0 && dp < 1) { const y = lerp(310, 700, E.inOut(dp)); dot(1500, y, 8, y > 470 ? C.green : COL, 12) }
    chip('dst 10.96.0.10:80', 1520, 330, { size: 16, col: COL, align: 'left', alpha: ta })
    chip('dst 10.244.2.8:80', 1520, 570, { size: 16, col: C.green, align: 'left', alpha: E.out(P(t, 5.8, 6.3)) })
    chip('跳过', 1520, 690, { size: 16, col: C.mute, align: 'left', alpha: E.out(P(t, 6.6, 7.1)) })
    // 身份策略与可观测
    let x = 900
    ;[['Identity：由 Pod 标签派生', COL], ['L3–L7 网络策略', C.blue], ['Hubble 流量可视', C.teal]].forEach(([s, c], i) => {
      const a = E.out(P(t, 10.4 + i * .4, 10.9 + i * .4))
      const w = chip(s, x, 810, { size: 18, col: c, align: 'left', alpha: a })
      x += (w || textW(s, 18, { font: MONO }) + 24) + 16
    })
  },
}

ANIM({
  id: 'networking-model',
  meta: { stage: 3, lesson: 2, of: 6, title: '网络模型与 CNI', summary: 'Pod 网络三原则、CNI 插件、kube-proxy 的 iptables/IPVS 与 Cilium eBPF。', next: '认证、授权与 RBAC' },
  scenes: [
    lessonIntro({ tags: ['Pod IP', 'VXLAN', 'CNI', 'kube-proxy', 'eBPF'], vo: [[3.2, 'Pod IP 从哪来？ClusterIP 又是怎么通的？', 'Pod IP 从哪来？Cluster IP 又是怎么通的？']] }),
    rules, overlay, cni, kproxy, cilium,
    lessonOutro({
      points: ['三原则：每 Pod 一 IP，Pod 与节点直连无 NAT', '跨节点：overlay 封装，或原生路由直达', 'CNI：运行时读 net.d，调用插件执行 ADD', 'kube-proxy 做 DNAT；nftables 推荐，Cilium 可替代'],
      vo: [[0.8, '小结：Pod 靠 CNI 连通，Service 靠规则转发。'], [5.6, '下一课，认证、授权与 RBAC。']],
    }),
  ],
})
})()
