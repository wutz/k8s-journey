/* 第 5 阶段 · 第 3 课：分布式训练与高性能网络 */
(() => {
const COL = STAGES[5].color
const sp = s => s.replace(/K8s/g, 'Kubernetes').replace(/nccl-tests/g, 'NCCL tests').replace(/busbw/g, '总线带宽')
const V = (a, s, o) => [a, s, o || sp(s)]
// 本地辅助：GPU 芯片（标签 16px）
const G = (x, y, s, col, a = 1, lbl) => { gpu(x, y, s, col, a); if (lbl) withA(a, () => txt(lbl, x, y + 6, { size: 16, font: MONO, align: 'center', color: col })) }
const NA = 'gn-10-243-145-103', NB = 'gn-10-243-145-105'

// 场景 1：Kubeflow Trainer 编排
const trainer = {
  name: 'Trainer 编排', dur: 16, mood: 1,
  vo: [V(0.6, '管理员写 Runtime，用户只写 TrainJob。'),
    V(5.6, 'JobSet 建出一组 Pod，注入 rank 和主节点地址。'),
    V(11.0, '一个 worker 失败，整组一起重启。')],
  cues: [[0.6, 'whoosh'], [0.9, 'pop'], [2.5, 'pop'], [3.8, 'tick'], [5.8, 'zap'], [6.4, 'pop'], [6.7, 'pop'], ...[0, 1, 2, 3].map(i => [7.2 + i * .45, 'tick']), [8.2, 'pop'],
    [11.4, 'error'], [12.4, 'whoosh'], [13.4, 'ok'], [13.8, 'chime']],
  draw(t) {
    heading('TrainJob：只写「跑什么」', 140, 210, t, .2, { eyebrow: 'KUBEFLOW TRAINER', color: COL })
    // 左：两份对象
    withA(E.out(P(t, .8, 1.3)), () => {
      panel(140, 280, 580, 240, { r: 18, stroke: hexA(C.violet, .5) })
      chip('平台管理员', 172, 318, { size: 18, font: SANS, col: C.violet, solid: true, align: 'left' })
      txt('ClusterTrainingRuntime', 172, 384, { size: 30, weight: 600 })
      txt('name: torch-distributed', 172, 424, { size: 20, font: MONO, color: C.violet })
      txt('torchrun 启动 · Pod 模板 · 网络注解 · 调度', 172, 478, { size: 19, color: C.body })
    })
    withA(E.out(P(t, 2.4, 2.9)), () => {
      panel(140, 580, 580, 290, { r: 18, stroke: hexA(COL, .5) })
      chip('算法工程师', 172, 618, { size: 18, font: SANS, col: COL, solid: true, align: 'left' })
      txt('TrainJob', 172, 684, { size: 30, weight: 600 })
      ;['runtimeRef: torch-distributed', 'numNodes: 2', 'image · command · resources'].forEach((s, i) =>
        txt(s, 172, 732 + i * 40, { size: 20, font: MONO, color: i < 2 ? C.text : C.mute, alpha: E.out(P(t, 3 + i * .3, 3.4 + i * .3)) }))
    })
    const ref = E.out(P(t, 3.8, 4.3))
    arrow(430, 578, 430, 526, ref, C.violet, 2.5)
    withA(ref, () => txt('引用', 450, 560, { size: 18, color: C.violet }))
    // 中：JobSet
    arrow(724, 575, 834, 575, E.out(P(t, 5.6, 6)), hexA(C.text, .35), 2.5)
    box(960, 575, 240, 110, 'JobSet', '一组 Job', C.blue, { alpha: E.out(P(t, 5.8, 6.3)), size: 30, hi: t > 5.8 && t < 6.8 })
    chip('+ Headless Service', 960, 672, { size: 18, col: C.blue, alpha: E.out(P(t, 8.2, 8.7)) })
    withA(E.out(P(t, 8.4, 8.9)), () => txt('worker 用稳定 DNS 互相找到', 960, 716, { size: 18, color: C.mute, align: 'center' }))
    // 右：两个 Pod 与注入的环境变量
    const fail = t >= 11.4 && t < 12.4, restart = t >= 12.4 && t < 13.4
    for (let i = 0; i < 2; i++) {
      const y = 300 + i * 300, a = E.out(P(t, 6.4 + i * .3, 6.9 + i * .3)); if (a <= 0) continue
      arrow(1082, 575 + (i ? 16 : -16), 1176, y + 125, E.out(P(t, 6.0 + i * .3, 6.5 + i * .3)), hexA(C.blue, .5), 2)
      const bad = fail && i === 1, wait = fail && i === 0
      const st = bad ? 'fail' : wait ? 'pending' : restart ? 'idle' : 'run'
      const stCol = STATE[st]
      withA(a, () => {
        panel(1180, y, 600, 250, { r: 18, stroke: bad ? C.red : C.hair, lw: bad ? 2.5 : 1.5, fill: bad ? tint(C.red, .05) : C.panel })
        chip(bad ? 'Error' : wait ? '卡在 AllReduce' : restart ? 'Restarting' : 'Running', 1756, y + 36, { size: 17, col: stCol, align: 'right', font: bad || restart || !wait ? MONO : SANS })
        const env = ['PET_NNODES=2', 'PET_NPROC_PER_NODE=8', `PET_NODE_RANK=${i}`, 'PET_MASTER_ADDR=node-0-0']
        env.forEach((s, k) => txt(s, 1370, y + 66 + k * 44, { size: 21, font: MONO, color: k === 2 ? COL : C.text, alpha: E.out(P(t, 7.2 + k * .45, 7.6 + k * .45)) }))
      })
      pod(1275, y + 110, 110, { state: st, label: `node-0-${i}`, alpha: a, shake: bad ? Math.sin(t * 60) * 6 * (1 - P(t, 11.4, 12)) : 0 })
      if (restart) ring(1275, y + 110, P(t, 12.4, 13.3), C.blue, 140)
      if (t >= 13.4) ring(1275, y + 110, P(t, 13.4, 14.2), C.green, 120)
    }
    chip('一起失败，一起重启', 960, 812, { size: 20, font: SANS, col: C.green, solid: true, alpha: E.out(P(t, 13.8, 14.3)) })
  },
}

// 场景 2：TCP 与 GPUDirect RDMA
const LAY = [['GPU 显存', 'HBM', C.violet], ['主机内存', 'DRAM', C.blue], ['内核协议栈', 'TCP/IP', C.amber], ['网卡', 'mlx5 · 400G', C.teal]]
const LY = i => 360 + i * 110
const rdma = {
  name: 'RDMA 数据路径', dur: 17, mood: 2,
  vo: [V(0.6, '普通 TCP 要经过主机内存和内核，反复拷贝。'),
    V(6.8, 'GPUDirect RDMA：网卡直接读写显存。'),
    V(11.8, '承载 RDMA 的有 InfiniBand 和 RoCE。')],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3].map(i => [1 + i * .15, 'tick']), [1.6, 'whoosh'], [3.2, 'alarmSoft'], [6.9, 'zap'], [7.6, 'whoosh'], [8.4, 'chime'],
    [12.0, 'pop'], [12.6, 'pop'], [14.2, 'tick']],
  draw(t) {
    heading('TCP 还是 RDMA', 140, 210, t, .2, { eyebrow: 'GPUDIRECT RDMA', color: COL })
    const R = E.out(P(t, 6.8, 7.4)) // RDMA 阶段
    ;[[140, NA, 1], [1320, NB, -1]].forEach(([x, name, dir], h) => {
      const a = E.out(P(t, .6 + h * .15, 1.1 + h * .15))
      node(x, 270, 460, 500, name, { alpha: a, accent: COL })
      LAY.forEach(([n, s, c], i) => {
        const la = E.out(P(t, 1 + i * .15, 1.4 + i * .15)) * a; if (la <= 0) return
        const mid = i === 1 || i === 2
        const bx = h ? x + 30 : x + 60
        withA(la * (mid ? 1 - R * .65 : 1), () => {
          const hot = t > 1.6 && t < 6.6
          panel(bx, LY(i) - 38, 370, 76, { r: 12, fill: tint(c, hot || !mid && R > 0 ? .1 : .05), stroke: hexA(c, hot ? .9 : .5), lw: hot ? 2 : 1.5, shadow: false })
          txt(n, bx + 22, LY(i) + 9, { size: 24, weight: 600 })
          txt(s, bx + 348, LY(i) + 8, { size: 18, font: MONO, color: c, align: 'right' })
        })
        if (mid && R > 0) withA(R * la, () => line(bx + 10, LY(i), bx + 360, LY(i), hexA(C.text, .35), 2))
      })
    })
    // 两台之间的链路
    const lk = E.out(P(t, 1.2, 1.8))
    withA(lk, () => {
      line(600, LY(3), 1320, LY(3), C.hairD, 5)
      txt(t < 11.8 ? '400G 计算网络' : 'InfiniBand / RoCE v2', 960, LY(3) + 44, { size: 20, font: t < 11.8 ? SANS : MONO, color: C.mute, align: 'center' })
    })
    // TCP 路径
    const tcpA = 1 - E.out(P(t, 6.4, 6.9))
    const tcp = [[385, LY(0)], [385, LY(1)], [385, LY(2)], [385, LY(3)], [1535, LY(3)], [1535, LY(2)], [1535, LY(1)], [1535, LY(0)]]
    // 只在方框之间的空隙画线，避免压住文字
    withA(tcpA * E.out(P(t, 1.6, 2)), () => {
      for (const x of [385, 1535]) for (let i = 0; i < 3; i++) line(x, LY(i) + 38, x, LY(i + 1) - 38, hexA(C.amber, .8), 3, [6, 5])
      line(570, LY(3), 1350, LY(3), hexA(C.amber, .8), 3, [6, 5])
    })
    for (let k = 0; k < 2; k++) travelPath(tcp, P(t, 1.8 + k * 2, 3.8 + k * 2), C.amber, 9)
    withA(tcpA * E.out(P(t, 3.0, 3.5)), () => {
      chip('CPU 参与 · 多次内存拷贝', 960, 400, { size: 22, font: SANS, col: C.amber, solid: true })
      txt('GPU 大量时间在等网络', 960, 460, { size: 20, color: C.body, align: 'center' })
    })
    // RDMA 路径：GPU 显存 → 网卡 直通
    const rd = [[200, LY(0)], [172, LY(0)], [172, LY(3)], [200, LY(3)], [570, LY(3)], [1350, LY(3)], [1720, LY(3)], [1748, LY(3)], [1748, LY(0)], [1720, LY(0)]]
    const seg = pts => { for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], hexA(COL, .8), 4) }
    withA(R, () => { seg(rd.slice(0, 4)); seg(rd.slice(4, 6)); seg(rd.slice(6)) })
    if (t > 7.4) for (let k = 0; k < 4; k++) { const p = ((t - 7.4) * .45 + k / 4) % 1; travelPath(rd, p, COL, 8) }
    chip('GPUDirect RDMA', 960, 340, { size: 24, col: COL, solid: true, alpha: E.out(P(t, 7.2, 7.7)) })
    withA(E.out(P(t, 8.2, 8.7)), () => {
      txt('绕过 CPU 和内核', 960, 412, { size: 28, weight: 600, align: 'center' })
      txt('远端网卡直接写入对端显存', 960, 456, { size: 20, color: C.body, align: 'center' })
    })
    // IB vs RoCE
    ;[['InfiniBand', '专用交换机 · Subnet Manager 管理', C.blue, 140, 12.0], ['RoCE v2', '以太网 + PFC/ECN 无损 · 要 IP 与 GID', C.teal, 990, 12.6]].forEach(([n, s, c, x, t0]) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 796 + lerp(20, 0, a), 790, 84, { r: 16, fill: tint(c, .06), stroke: hexA(c, .6) })
        txt(n, x + 28, 850 + lerp(20, 0, a), { size: 26, weight: 600, color: c })
        txt(s, x + 762, 848 + lerp(20, 0, a), { size: 20, color: C.body, align: 'right' })
      })
    })
    withA(E.out(P(t, 14.2, 14.7)), () => txt('NCCL_IB_GID_INDEX 选「RoCE v2 + 正确 IP」那一条', 960, 560, { size: 19, font: MONO, color: C.teal, align: 'center' }))
  },
}

// 场景 3：Network Operator 与两种组网
const netop = {
  name: 'Network Operator', dur: 17, mood: 2,
  vo: [V(0.6, 'NicClusterPolicy 部署 RDMA 设备插件。', 'Nic Cluster Policy 部署 RDMA 设备插件。'),
    V(5.6, 'hostNetwork 最简单，但一台只能跑一个作业。', 'host network 最简单，但一台只能跑一个作业。'),
    V(11.0, 'macvlan 让每个 Pod 有独立的 RDMA IP。', 'mac VLAN 让每个 Pod 有独立的 RDMA IP。')],
  cues: [[0.6, 'whoosh'], [0.8, 'pop'], [1.8, 'pop'], [2.8, 'ok'], [3.6, 'tick'], [5.8, 'whoosh'], [6.2, 'pop'], [7.6, 'pop'], [8.4, 'error'],
    [11.2, 'whoosh'], [11.8, 'pop'], [12.2, 'pop'], [13.2, 'ok'], [14.4, 'chime']],
  draw(t) {
    heading('Network Operator：把 RDMA 网卡交给 Pod', 140, 210, t, .2, { eyebrow: 'NETWORK OPERATOR', color: COL })
    // 顶部：NicClusterPolicy → 设备插件 → 节点资源
    box(310, 340, 340, 100, 'NicClusterPolicy', 'rdmaSharedDevicePlugin', COL, { alpha: E.out(P(t, .7, 1.2)), size: 27, hi: t < 2 && t > .7 })
    chip('依赖宿主机 DOCA OFED 驱动', 310, 418, { size: 16, font: SANS, col: C.mute, alpha: E.out(P(t, 3.6, 4.1)) })
    arrow(484, 340, 626, 340, E.out(P(t, 1.4, 1.9)), hexA(COL, .6), 2.5)
    box(820, 340, 380, 100, 'rdma-shared-dev-plugin', 'DaemonSet · vendors 15b3', C.violet, { alpha: E.out(P(t, 1.7, 2.2)), size: 27, hi: t > 1.8 && t < 2.8 })
    arrow(1014, 340, 1092, 340, E.out(P(t, 2.4, 2.8)), hexA(C.violet, .6), 2.5)
    chip('allocatable · rdma/hca: 63', 1104, 322, { size: 24, col: C.violet, solid: true, align: 'left', alpha: E.back(clamp(P(t, 2.8, 3.3))) })
    withA(E.out(P(t, 3.2, 3.7)), () => txt('最多 63 个容器共享访问 · 不是 SR-IOV', 1106, 382, { size: 19, color: C.body }))
    // 下方两种组网
    const panes = [[140, 'hostNetwork: true', C.amber, 'GID index = 3', 5.6], [990, 'macvlan + nv-ipam', C.teal, 'GID index = 7', 11.0]]
    panes.forEach(([x, n, c, gid, t0], k) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      withA(a, () => {
        panel(x, 470, 790, 400, { r: 20 })
        chip(n, x + 32, 508, { size: 21, col: c, solid: true, align: 'left' })
        chip(gid, x + 758, 508, { size: 17, col: c, align: 'right' })
        ctx.save(); rr(x + 50, 760, 690, 56, 12); ctx.fillStyle = tint(C.teal, .1); ctx.fill(); ctx.strokeStyle = hexA(C.teal, .7); ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
        txt(k ? 'bond0 · 宿主机 RDMA 网卡' : 'bond0 · 192.168.10.11（宿主机 IP）', x + 76, 796, { size: 20, font: k ? SANS : MONO, color: C.text })
      })
    })
    // hostNetwork：第二个作业端口冲突
    ;[['job-a', 380, 6.2], ['job-b', 690, 7.6]].forEach(([n, x, t0], i) => {
      if (P(t, t0, t0 + .5) <= 0) return
      const k = E.back(clamp(P(t, t0, t0 + .5)))
      const bad = i === 1 && t >= 8.4
      pod(x, 640, 96, { state: bad ? 'fail' : 'run', label: n, alpha: clamp(k), scale: clamp(k), shake: bad ? Math.sin(t * 60) * 5 * (1 - P(t, 8.4, 9)) : 0 })
      chip('192.168.10.11', x, 562, { size: 17, col: bad ? C.red : C.amber, alpha: clamp(k) })
      withA(clamp(k), () => line(x, 722, x, 756, hexA(bad ? C.red : C.amber, .7), 3, bad ? [6, 6] : null))
      if (bad) cross(x, 739, 22, C.red, E.out(P(t, 8.4, 8.7)))
    })
    chip('端口冲突', 535, 640, { size: 19, font: SANS, col: C.red, solid: true, alpha: E.out(P(t, 8.5, 8.9)) })
    withA(E.out(P(t, 9.2, 9.7)), () => txt('无需额外组件 · 一台只能跑一个作业 · 隔离差', 535, 848, { size: 19, color: C.mute, align: 'center' }))
    // macvlan：各自独立 IP
    ;[['job-a', 1230, 11.8, '192.168.0.9'], ['job-b', 1540, 12.2, '192.168.0.10']].forEach(([n, x, t0, ip]) => {
      if (P(t, t0, t0 + .5) <= 0) return
      const k = E.back(clamp(P(t, t0, t0 + .5)))
      pod(x, 640, 96, { state: 'run', label: n, alpha: clamp(k), scale: clamp(k) })
      chip(ip, x, 562, { size: 17, col: C.teal, alpha: clamp(k) })
      partialLine(x, 722, x, 756, E.out(P(t, t0 + .4, t0 + .9)), hexA(C.teal, .8), 3)
      if (t >= 13.2) check(x + 62, 604, 26, C.green, P(t, 13.2, 13.6))
    })
    withA(E.out(P(t, 12.8, 13.3)), () => txt('Multus 挂第二块网卡', 1385, 700, { size: 18, color: C.teal, align: 'center' }))
    withA(E.out(P(t, 14.4, 14.9)), () => txt('同节点可并行多个作业 · 适合生产', 1385, 848, { size: 19, color: C.mute, align: 'center' }))
  },
}

// 场景 4：nccl-tests 带宽验收
const TERM4 = [
  { t: 1.0, cmd: 'mpirun -np 16 all_reduce_perf -b 8 -e 8G -f 2 -g 1' },
  { t: 3.0, out: '#       size   algbw   busbw  #wrong', color: C.mute },
  { t: 3.4, out: '  4294967296   185.2   347.2       0', color: C.text },
  { t: 3.8, out: '  8589934592   186.0   348.8       0', color: C.text },
  { t: 4.4, out: '# Out of bounds values : 0 OK', color: C.green, sfx: 'ok' },
]
const nccl = {
  name: 'NCCL 带宽验收', dur: 16, mood: 3,
  vo: [V(0.6, '用 nccl-tests 跑两机十六卡 AllReduce。'),
    V(5.8, '看大消息的 busbw，能直接比硬件带宽。', '看大消息的总线带宽，能直接和硬件带宽比较。'),
    V(10.8, '348.8 比 400，约 87%，属于可接受。', '三百四十八点八比四百，约百分之八十七，属于可接受。')],
  cues: [[0.4, 'whoosh'], ...typeCues(TERM4, 30), [6.0, 'tick'], [6.6, 'pop'], [8.2, 'pop'], [11.0, 'whoosh'], [12.6, 'impact'], [13.0, 'ok'], [14.2, 'tick']],
  draw(t) {
    heading('nccl-tests：看 busbw', 140, 210, t, .2, { eyebrow: 'BANDWIDTH', color: COL })
    const TS = 20
    terminal(140, 270, 1020, 300, t, TERM4, { size: TS, title: 'launcher · 2 节点 × 8 卡', alpha: E.out(P(t, .4, .9)) })
    // 高亮 busbw 列
    const hA = E.out(P(t, 6.0, 6.5))
    if (hA > 0) {
      ctx.save(); ctx.font = `500 ${TS * .88}px ${MONO}`
      const x0 = 168 + ctx.measureText('  4294967296   185.2   ').width, w = ctx.measureText('347.2').width
      ctx.restore()
      const y1 = 270 + 92 + TS * 1.6 * 2 // 第一行数据的基线
      withA(hA, () => { ctx.save(); rr(x0 - 10, y1 - 24, w + 20, TS * 1.6 + 36, 8); ctx.strokeStyle = COL; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore()
        txt('← 大消息的 busbw', 640, y1 + 20, { size: 20, color: COL, weight: 600 }) })
    }
    // 公式
    withA(E.out(P(t, 6.4, 6.9)), () => {
      panel(140, 600, 1020, 270, { r: 18 })
      txt('busbw = algbw × 2(n−1)/n', 172, 666, { size: 30, font: MONO, color: COL, weight: 600 })
      txt('消除了 GPU 数量的影响，可以直接和硬件带宽比较', 172, 712, { size: 20, color: C.body })
      line(172, 740, 1128, 740, C.hair, 1)
    })
    withA(E.out(P(t, 8.2, 8.7)), () => {
      txt('理论峰值 = 8 张网卡 × 400 Gb/s ÷ 8 = 400 GB/s', 172, 792, { size: 22, font: MONO, color: C.text })
      txt('每张 GPU 配一张计算网卡（一条轨道）', 172, 834, { size: 19, color: C.mute })
    })
    // 右：仪表
    const gA = E.out(P(t, 10.8, 11.3))
    const cx = 1500, cy = 590, r = 170
    const ang = pct => Math.PI + clamp((pct - 60) / 40) * Math.PI
    withA(gA, () => {
      panel(1220, 270, 560, 600, { r: 20 })
      txt('busbw / 理论峰值', 1500, 318, { size: 22, weight: 600, align: 'center' })
      ;[[60, 80, C.red], [80, 90, C.amber], [90, 100, C.green]].forEach(([a, b, c]) => {
        ctx.save(); ctx.strokeStyle = hexA(c, .8); ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(cx, cy, r, ang(a) + .01, ang(b) - .01); ctx.stroke(); ctx.restore()
      })
      ;[80, 90].forEach(p => { const a = ang(p); txt(p + '%', cx + Math.cos(a) * (r + 40), cy + Math.sin(a) * (r + 40) + 6, { size: 18, font: MONO, color: C.mute, align: 'center' }) })
    })
    const pct = lerp(60, 87.2, E.out(P(t, 11.2, 12.6)))
    if (gA > 0) withA(gA, () => {
      const a = ang(pct)
      line(cx, cy, cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30), C.text, 5)
      dot(cx, cy, 10, C.text, 0)
    })
    withA(E.out(P(t, 12.6, 13)), () => {
      txt('87%', cx, 670, { size: 56, weight: 700, color: C.amber, align: 'center' })
      txt('348.8 / 400 GB/s', cx, 710, { size: 22, font: MONO, color: C.body, align: 'center' })
    })
    if (t > 12.6) ring(cx, cy, P(t, 12.6, 13.6), C.amber, 200)
    chip('可接受 · 优秀要 ≥ 90%', cx, 760, { size: 20, font: SANS, col: C.amber, solid: true, alpha: E.out(P(t, 13.0, 13.4)) })
    withA(E.out(P(t, 14.2, 14.7)), () => {
      txt('日志出现 NET/Socket = 退回了 TCP', cx, 814, { size: 19, font: MONO, color: C.red, align: 'center' })
      txt('查 rdma/hca、IPC_LOCK 与 GID index', cx, 848, { size: 19, color: C.mute, align: 'center' })
    })
  },
}

// 场景 5：并行策略对齐拓扑
const NX5 = [140, 1000]
const gpos = (n, g) => [NX5[n] + 130 + (g % 4) * 173, g < 4 ? 390 : 570]
const para = {
  name: '并行策略', dur: 16, mood: 3,
  vo: [V(0.6, '通信最密的 TP 留在机内，走 NVLink。', '通信最密的张量并行留在机内，走 NVLink。'),
    V(5.6, '流水线并行 PP 跨节点，走 RDMA 网络。', '流水线并行跨节点，走 RDMA 网络。'),
    V(10.8, '剩下的是数据并行：总卡数除以 TP 乘 PP。', '剩下的是数据并行，等于总卡数除以 TP 乘 PP。')],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [.9 + i * .1, 'tick']), [2.2, 'zap'], [5.8, 'whoosh'], [6.6, 'pop'], [8.4, 'whoosh'], [11.0, 'pop'], [12.4, 'impact'], [13.8, 'alarmSoft'], [14.6, 'chime']],
  draw(t) {
    heading('并行策略要对齐拓扑', 140, 210, t, .2, { eyebrow: 'TP · PP · DP', color: COL })
    const pp = t >= 5.6
    ;[NA, NB].forEach((name, n) => {
      const a = E.out(P(t, .6 + n * .15, 1.1 + n * .15))
      node(NX5[n], 270, 780, 380, name, { alpha: a, accent: C.cyan, tag: pp ? `PP stage ${n} · ${n ? '后' : '前'}半层` : undefined })
      const tp = E.out(P(t, 2.0, 2.5))
      withA(a, () => {
        ctx.save(); rr(NX5[n] + 60, 462, 660, 36, 10); ctx.fillStyle = tint(C.violet, .06 + tp * .1); ctx.fill(); ctx.strokeStyle = hexA(C.violet, .3 + tp * .6); ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
        txt('NVLink / NVSwitch', NX5[n] + 390, 487, { size: 17, font: MONO, color: C.violet, align: 'center', alpha: tp })
      })
      for (let g = 0; g < 8; g++) {
        const [x, y] = gpos(n, g), ga = E.out(P(t, .9 + g * .1, 1.3 + g * .1)) * a; if (ga <= 0) continue
        line(x, g < 4 ? y + 44 : y - 44, x, g < 4 ? 462 : 498, hexA(C.violet, .25 + tp * .4), 2)
        G(x, y, 84, tp > 0 ? C.violet : C.faint, ga, `GPU${g}`)
      }
      // 流动点避开中间的文字
      const cxn = NX5[n] + 390
      if (t > 2.4) for (const [a1, a2] of [[NX5[n] + 76, cxn - 120], [cxn + 120, NX5[n] + 704]]) { flow(a1, 480, a2, 480, t, C.violet, 3, 1.3, 0, 4); flow(a2, 480, a1, 480, t, C.violet, 3, 1.3, .5, 4) }
      chip('TP = 8 · 机内 NVLink', NX5[n] + 390, 694, { size: 20, font: SANS, col: C.violet, solid: true, alpha: E.out(P(t, 2.6 + n * .2, 3.0 + n * .2)) })
    })
    // 跨节点 8 条 RDMA 轨道
    const ra = E.out(P(t, 5.8, 6.3))
    for (let i = 0; i < 8; i++) {
      const y = 332 + i * 40
      withA(ra, () => line(920, y, 1000, y, hexA(C.teal, .7), 3))
      if (t > 6.3) flow(920, y, 1000, y, t, C.teal, 2, .6, i * .13, 4)
    }
    chip('PP = 2 · 跨机 8 × 400G RDMA', 960, 752, { size: 20, font: SANS, col: C.teal, solid: true, alpha: ra })
    // 激活值前向、梯度反向
    travel(620, 390, 1300, 390, P(t, 8.4, 9.4), C.teal, 10)
    travel(1300, 570, 620, 570, P(t, 9.4, 10.4), C.amber, 10)
    withA(E.out(P(t, 8.4, 8.8)) * (1 - E.out(P(t, 10.6, 11))), () => txt('激活值 → · ← 梯度', 960, 822, { size: 19, color: C.body, align: 'center' }))
    // DP 公式
    withA(E.out(P(t, 11.0, 11.5)), () => txt('DP = 总卡数 ÷ (TP × PP)', 960, 826, { size: 26, font: MONO, color: C.text, align: 'center', weight: 600 }))
    withA(E.out(P(t, 12.4, 12.8)), () => { chip('= 16 ÷ (8 × 2) = 1', 1160, 816, { size: 22, col: COL, solid: true, align: 'left' }) })
    if (t > 12.4) { ring(530, 460, P(t, 12.4, 13.4), COL, 400); ring(1390, 460, P(t, 12.4, 13.4), COL, 400) }
    chip('跨节点 RoCE 作业一律整机 8 卡', 960, 880, { size: 19, font: SANS, col: C.amber, alpha: E.out(P(t, 13.8, 14.3)) })
  },
}

ANIM({
  id: 'distributed-training',
  meta: { stage: 5, lesson: 3, of: 6, title: '分布式训练与高性能网络', summary: 'Kubeflow Trainer、RDMA/RoCE、Network Operator、NCCL 带宽测试。', next: '大模型推理服务' },
  scenes: [
    lessonIntro({ tags: ['Kubeflow Trainer', 'RDMA', 'RoCE', 'Network Operator', 'NCCL'], vo: [V(3.2, '多机训练：编排之外，网络决定速度。')] }),
    trainer, rdma, netop, nccl, para,
    lessonOutro({
      points: ['Runtime 管平台细节，TrainJob 只写跑什么', 'GPUDirect RDMA 绕过 CPU 与内核', 'rdma/hca 设备 + hostNetwork 或 macvlan 组网', 'busbw 验收带宽；TP 在机内，PP 跨机'],
      vo: [V(0.8, '小结：编排靠 Trainer，速度靠 RDMA。'), V(5.6, '下一课，大模型推理服务。')],
    }),
  ],
})
})()
