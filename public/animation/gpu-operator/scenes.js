/* 第 5 阶段 · 第 1 课：GPU 调度与 GPU Operator */
(() => {
const COL = STAGES[5].color
const NODE = 'gn-10-243-145-103'
// 本地辅助：GPU 芯片（标签 16px）
const G = (x, y, s, col, a = 1, lbl) => { gpu(x, y, s, col, a); if (lbl) withA(a, () => txt(lbl, x, y + 6, { size: 16, font: MONO, align: 'center', color: col })) }

// 场景 1：设备插件
const plugin = {
  name: '设备插件', dur: 16, mood: 1,
  vo: [[0.6, 'kubelet 不认识 GPU，要靠设备插件。'],
    [5.6, '插件经 gRPC 注册，节点多出 8 个 GPU 资源。'],
    [10.8, 'Pod 申请整数张卡，设备和驱动库注入容器。']],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [1.2 + i * .12, 'tick']), [2.6, 'error'], [5.8, 'pop'], [6.4, 'zap'], [7.4, 'ok'],
    [10.9, 'pop'], [12.2, 'whoosh'], [12.8, 'tick'], [13.2, 'tick'], [13.6, 'tick'], [14.2, 'chime']],
  draw(t, T) {
    heading('GPU 需要额外的机制', 140, 210, t, .2, { eyebrow: 'DEVICE PLUGIN', color: COL })
    const nA = E.out(P(t, .6, 1.2))
    node(140, 270, 860, 600, NODE, { alpha: nA, tag: 'GPU 节点', accent: COL })
    const known = P(t, 6.4, 7.2)
    for (let g = 0; g < 8; g++) {
      const a = E.out(P(t, 1.2 + g * .12, 1.6 + g * .12)); if (a <= 0) continue
      const gx = 315 + (g % 4) * 170, gy = 390 + Math.floor(g / 4) * 120
      const lit = P(t, 6.4 + g * .08, 6.8 + g * .08) > 0
      const used = g === 0 && t > 12.2
      G(gx, gy, 80, used ? C.violet : lit ? COL : C.faint, a * nA, `GPU${g}`)
    }
    // kubelet 与 device plugin
    box(330, 720, 280, 104, 'kubelet', t < 6.4 ? 'nvidia.com/gpu = ?' : 'nvidia.com/gpu = 8', C.blue, { alpha: E.out(P(t, 1.8, 2.4)) * nA, size: 28, hi: t > 7.2 && t < 10.8 })
    withA(E.out(P(t, 2.6, 3)) * (1 - E.out(P(t, 6.4, 6.8))), () => chip('看不见 GPU', 330, 636, { size: 18, col: C.red, font: SANS }))
    box(790, 720, 320, 104, 'device-plugin', 'DaemonSet', COL, { alpha: E.out(P(t, 5.8, 6.3)), size: 28, hi: t >= 6.4 && t < 7.4 })
    const ra = E.out(P(t, 6.4, 7))
    arrow(630, 720, 474, 720, ra, COL, 3)
    travel(630, 720, 474, 720, P(t, 6.4, 7.1), COL)
    withA(ra, () => txt('gRPC 注册', 552, 700, { size: 17, color: COL, align: 'center' }))
    // 插件发现卡
    withA(E.out(P(t, 6.2, 6.6)) * (1 - known), () => { for (let g = 0; g < 4; g++) line(790, 668, 315 + g * 170, 560, hexA(COL, .35), 1.5, [6, 6]) })
    const al = E.out(P(t, 7.4, 7.9))
    chip(`allocatable · nvidia.com/gpu: ${countUp(8, t, 7.4, 8.4)}`, 570, 830, { size: 20, col: COL, solid: t > 8.4, alpha: al })

    // 右侧：三个问题
    ;[['发现', '节点上有几张卡？', 6.8], ['上报', '调度器怎么知道有 8 张？', 7.6], ['注入', '设备文件和驱动库怎么进容器？', 13.6]].forEach(([k, s, done], i) => {
      const a = E.out(P(t, 1.4 + i * .3, 1.9 + i * .3)); if (a <= 0) return
      const y = 290 + i * 96, ok = t >= done
      withA(a, () => {
        panel(1080 + lerp(30, 0, a), y, 700, 80, { r: 16, stroke: ok ? COL : C.hair, lw: ok ? 2 : 1.5, fill: ok ? tint(COL, .05) : C.panel })
        chip(k, 1112, y + 40, { size: 22, align: 'left', col: ok ? COL : C.mute, solid: ok, font: SANS })
        txt(s, 1210, y + 49, { size: 24, color: C.text })
        if (ok) check(1740, y + 40, 26, COL, P(t, done, done + .4))
      })
    })
    // Pod 与注入
    const pa = E.out(P(t, 10.8, 11.4))
    withA(pa, () => {
      panel(1080, 590, 700, 244, { r: 18, fill: tint(C.violet, .04), stroke: hexA(C.violet, .5), dash: [10, 8], lw: 2, shadow: false })
      chip('Pod · cuda-vectoradd', 1110, 590, { size: 20, col: C.violet, solid: true, align: 'left' })
      txt('limits:', 1112, 656, { size: 22, font: MONO, color: C.mute })
      txt('nvidia.com/gpu: 1', 1210, 656, { size: 22, font: MONO, color: C.violet })
      cube(1690, 690, 30, C.violet)
    })
    travel(315, 390, 1690, 690, P(t, 12.2, 13), C.violet)
    ;['/dev/nvidia0', 'libcuda.so', 'nvidia-smi'].forEach((s, i) => chip(s, 1112 + i * 206, 740, { size: 19, col: C.violet, align: 'left', alpha: E.back(clamp(P(t, 12.8 + i * .4, 13.2 + i * .4))) }))
    txt('由 nvidia-container-toolkit 注入', 1112, 800, { size: 18, color: C.mute, alpha: E.out(P(t, 13.8, 14.3)) })
    ;['只能是整数', '不能超卖', '不能指定第几号卡'].forEach((s, i) => chip(s, 1080 + i * 180 + (i === 2 ? 20 : 0), 872, { size: 18, font: SANS, col: C.amber, align: 'left', alpha: E.out(P(t, 14.2 + i * .25, 14.6 + i * .25)) }))
  },
}

// 场景 2：NFD 与 GPU Operator
const LBL = [['feature.node.kubernetes.io/', 'pci-10de.present=true', '有 NVIDIA 设备', 1.6], ['feature.node.kubernetes.io/', 'pci-15b3.present=true', '有 Mellanox 网卡', 2.4], ['nvidia.com/', 'gpu.product=H100-80GB-HBM3', 'GFD 补充', 9.6]]
const DS = [['driver', '可选', 7.0], ['toolkit', 'containerd', 7.8], ['device-plugin', 'nvidia.com/gpu', 8.6], ['GFD', 'gpu.product', 9.3], ['dcgm-exporter', 'GPU 指标', 9.8]]
const operator = {
  name: 'NFD 与 Operator', dur: 16, mood: 2,
  vo: [[0.6, 'NFD 先给节点打标签，标出哪台有 NVIDIA 卡。'],
    [6.0, 'GPU Operator 用 ClusterPolicy 逐层部署组件。'],
    [11.4, '最后 validator 跑 CUDA 程序，验证整条链路。']],
  cues: [[0.6, 'whoosh'], [1.6, 'tick'], [2.4, 'tick'], [3.6, 'pop'], [6.1, 'impact'], ...DS.map(d => [d[2], 'pop']), [9.6, 'tick'], [11.5, 'whoosh'], [13.2, 'ok'], [13.8, 'chime']],
  draw(t) {
    heading('NFD + GPU Operator', 140, 210, t, .2, { eyebrow: 'CLUSTERPOLICY', color: COL })
    const nA = E.out(P(t, .6, 1.2))
    node(140, 270, 580, 560, NODE, { alpha: nA, tag: 'NFD worker', accent: C.teal })
    withA(nA, () => txt('读取 PCI 设备 · CPU · 内核', 170, 348, { size: 20, color: C.mute }))
    LBL.forEach(([pre, k, note, t0], i) => {
      const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
      const y = 400 + i * 116, col = i === 2 ? COL : C.teal
      withA(a, () => {
        panel(170 + lerp(-20, 0, a), y, 520, 92, { r: 14, fill: tint(col, .06), stroke: hexA(col, .5), shadow: false })
        txt(pre, 192, y + 34, { size: 17, font: MONO, color: C.mute })
        txt(k, 192, y + 68, { size: 21, font: MONO, color: col })
        txt(note, 670, y + 34, { size: 17, color: col, align: 'right' })
      })
    })
    chip('一个集群只装一套 NFD', 430, 790, { size: 19, font: SANS, col: C.amber, alpha: E.out(P(t, 3.6, 4.1)) })
    // ClusterPolicy 树
    const cA = E.out(P(t, 6.0, 6.6))
    box(1280, 330, 380, 100, 'ClusterPolicy', '按 pci-10de 标签选 GPU 节点', COL, { alpha: cA, hi: true, size: 30 })
    arrow(728, 540, 804, 540, E.out(P(t, 6.2, 6.8)), hexA(C.teal, .6), 2.5)
    DS.forEach(([n, s, t0], i) => {
      const x = 900 + i * 196, y = 540
      partialLine(1280, 380, x, y - 52, E.out(P(t, 6.4 + i * .08, 7 + i * .08)), hexA(COL, .35), 2)
      const on = t >= t0
      box(x, y, 176, 104, '', '', on ? COL : C.faint, { alpha: E.out(P(t, 6.5 + i * .08, 7 + i * .08)), hi: on && t < t0 + .8 })
      withA(E.out(P(t, 6.5 + i * .08, 7 + i * .08)), () => { txt(n, x, y - 4, { size: n.length > 8 ? 21 : 24, weight: 600, align: 'center' }); txt(s, x, y + 30, { size: 16, font: MONO, color: C.mute, align: 'center' }) })
      if (on) ring(x, y, P(t, t0, t0 + .8), COL, 110)
    })
    // 依赖顺序
    ;[0, 1].forEach(i => { const x = 900 + i * 196; arrow(x + 50, 620, x + 146, 620, E.out(P(t, DS[i + 1][2] - .3, DS[i + 1][2])), COL, 2.5) })
    withA(E.out(P(t, 8.8, 9.3)), () => txt('驱动 → toolkit → 插件：按依赖先后就绪', 900 - 90, 668, { size: 19, color: C.body }))
    withA(E.out(P(t, 9.9, 10.4)), () => txt('都是 DaemonSet，只跑在 GPU 节点', 1780, 668, { size: 19, color: C.mute, align: 'right' }))
    // validator
    const vA = E.out(P(t, 11.4, 11.9)), vp = E.inOut(P(t, 11.8, 13.2))
    withA(vA, () => {
      panel(810, 712, 970, 76, { r: 38, fill: '#fff', stroke: vp >= 1 ? C.green : C.hair, lw: vp >= 1 ? 2.5 : 1.5 })
      ctx.save(); rr(812, 714, 966 * vp, 72, 36); ctx.fillStyle = tint(C.green, .16); ctx.fill(); ctx.restore()
      txt('validator：逐层验证', 850, 760, { size: 24, weight: 600 })
      txt(vp >= 1 ? 'nvidia-cuda-validator  Completed' : 'running…', 1740, 758, { size: 20, font: MONO, color: vp >= 1 ? C.green : C.mute, align: 'right' })
    })
    chip('cuda-vectoradd → Test PASSED', 1295, 850, { size: 22, col: C.green, solid: true, alpha: E.back(clamp(P(t, 13.8, 14.3))) })
  },
}

// 场景 3：驱动策略 + Fabric Manager
const ROWS3 = [['安装方式', '.run / apt 装在节点', 'driver Pod 里编译加载'], ['节点上 nvidia-smi', '直接可用', '需要 chroot 进去'], ['内核升级', '重装或靠 DKMS', '自动重新编译'], ['离线环境', '安装时需要软件源', '每次启动都要 apt 源'], ['驱动升级', '排空节点后重装', '改 values 滚动升级']]
const TERM3 = [
  { t: 6.6, cmd: 'nvidia-smi | head -3' },
  { t: 7.6, out: 'NVIDIA-SMI 580.95.05   Driver Version: 580.95.05', color: C.green },
  { t: 10.9, cmd: 'kubectl logs nvidia-cuda-validator-x7k2p' },
  { t: 12.4, out: 'Failed to allocate device vector A', color: C.red, sfx: 'error' },
  { t: 12.7, out: '(error code system not yet initialized)!', color: C.red },
  { t: 13.4, cmd: 'systemctl enable --now nvidia-fabricmanager' },
  { t: 15.1, out: 'Fabric  State: Completed  Status: Success', color: C.green, sfx: 'ok' },
]
const driver = {
  name: '驱动策略', dur: 17, mood: 2,
  vo: [[0.6, '部署前最重要的决定：驱动装在哪里。'],
    [5.6, '团队推荐宿主机驱动：变更可控，排查熟悉。'],
    [10.8, 'NVSwitch 机器还要装同版本的 Fabric Manager。']],
  cues: [[0.6, 'whoosh'], [1.2, 'pop'], ...ROWS3.map((_, i) => [1.8 + i * .3, 'tick']), [5.7, 'chime'], ...typeCues(TERM3, 30), [14.2, 'alarmSoft']],
  draw(t) {
    heading('驱动策略：宿主机 还是 容器', 140, 210, t, .2, { eyebrow: 'DRIVER', color: COL })
    const X0 = 140, XA = 380, XB = 690, XE = 1000
    const rec = E.out(P(t, 5.6, 6.2))
    // 表头
    withA(E.out(P(t, 1.0, 1.5)), () => {
      if (rec > 0) withA(rec, () => panel(XA - 8, 272, XB - XA + 8, 520, { r: 18, fill: tint(COL, .07), stroke: COL, lw: 2.5, shadow: false }))
      txt('宿主机驱动', XA + 14, 318, { size: 28, weight: 600 })
      txt('driver.enabled: false', XA + 14, 350, { size: 17, font: MONO, color: C.mute })
      txt('容器化驱动', XB + 20, 318, { size: 28, weight: 600 })
      txt('driver.enabled: true', XB + 20, 350, { size: 17, font: MONO, color: C.mute })
      line(X0, 372, XE, 372, C.hairD, 1.5)
    })
    ROWS3.forEach(([k, a, b], i) => {
      const al = E.out(P(t, 1.8 + i * .3, 2.3 + i * .3)); if (al <= 0) return
      const y = 420 + i * 72
      withA(al, () => {
        txt(k, X0, y, { size: 21, color: C.mute })
        txt(a, XA + 14, y, { size: 22, color: C.text })
        txt(b, XB + 20, y, { size: 22, color: C.text })
        if (i < 4) line(X0, y + 30, XE, y + 30, C.hair, 1)
      })
    })
    chip('✓ 团队推荐', XA + (XB - XA) / 2, 792, { size: 20, font: SANS, col: COL, solid: true, alpha: rec })
    withA(E.out(P(t, 7.2, 7.8)), () => wrap('GPU 节点少、内核锁定，驱动升级本就是计划内变更；driver Pod 重启会中断整节点业务。', X0, 850, 860, { size: 19, color: C.body, lh: 28 }))
    terminal(1060, 270, 720, 420, t, TERM3, { size: 19, title: NODE, alpha: E.out(P(t, 6.0, 6.5)) })
    // Fabric Manager 警告
    withA(E.out(P(t, 14.0, 14.5)), () => {
      panel(1060, 730, 720, 96, { r: 16, fill: tint(C.amber, .08), stroke: C.amber, lw: 2 })
      txt('⚠ Fabric Manager 版本必须与驱动完全一致', 1090, 774, { size: 24, weight: 600, color: C.text })
      txt('HGX H100 / H200 / B200 · NVSwitch 初始化', 1090, 808, { size: 17, font: MONO, color: C.amber })
    })
  },
}

// 场景 4：MostAllocated 装箱
const NX = [140, 710, 1280], NY = 330
const slot = (n, g) => [NX[n] + 85 + (g % 4) * 110, NY + 115 + Math.floor(g / 4) * 105]
const binpack = {
  name: '装箱打分', dur: 17, mood: 3,
  vo: [[0.6, '默认打分倾向把单卡任务分散到各节点。'],
    [5.8, '每台都剩零散的卡，8 卡任务反而排不进。'],
    [10.6, '改成 MostAllocated 装箱，GPU 权重设为 5。']],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3, 4, 5].map(i => [1.4 + i * .5, 'pop']), [6.4, 'whoosh'], [7.2, 'error'], [10.6, 'zap'], ...[0, 1, 2, 3, 4, 5].map(i => [11.1 + i * .25, 'pop']), [13.6, 'impact'], [14.4, 'chime']],
  draw(t, T) {
    heading('调度打分：让 GPU 少碎片', 140, 210, t, .2, { eyebrow: 'BIN-PACKING', color: COL })
    const B = t >= 10.5
    withA(E.out(P(t, .6, 1.1)), () => {
      if (!B) chip('LeastAllocated · 默认：挑最空的节点', 140, 290, { size: 20, font: SANS, col: C.blue, align: 'left' })
      else chip('MostAllocated · nvidia.com/gpu weight: 5', 140, 290, { size: 20, col: COL, solid: true, align: 'left', alpha: E.out(P(t, 10.6, 11)) })
    })
    const names = ['gn-10-243-145-103', 'gn-10-243-145-105', 'gn-10-243-145-106']
    // 占用情况
    const occ = [[], [], []]
    if (!B) { for (let i = 0; i < 6; i++) if (t >= 1.4 + i * .5) occ[i % 3].push(Math.floor(i / 3)) }
    else { for (let i = 0; i < 6; i++) if (t >= 11.1 + i * .25) occ[0].push(i) }
    const bigOn = t >= 13.6
    const fade = B ? E.out(P(t, 10.5, 10.9)) : 1 - E.out(P(t, 10.1, 10.5))
    for (let n = 0; n < 3; n++) {
      node(NX[n], NY, 500, 330, names[n], { alpha: E.out(P(t, .7 + n * .15, 1.2 + n * .15)), tag: `空闲 ${8 - occ[n].length - (bigOn && n === 1 ? 8 : 0)}`, accent: COL })
      for (let g = 0; g < 8; g++) {
        const [x, y] = slot(n, g); const a = E.out(P(t, 1 + n * .15, 1.4 + n * .15))
        const used = occ[n].includes(g), big = bigOn && n === 1
        G(x, y, 70, big ? C.violet : used ? C.cyan : C.faint, a * (used ? fade : 1), big ? 'train' : used ? '1卡' : `GPU${g}`)
      }
    }
    // 小任务飞入
    for (let i = 0; i < 6; i++) {
      const t0 = B ? 11.1 + i * .25 : 1.4 + i * .5, [x, y] = B ? slot(0, i) : slot(i % 3, Math.floor(i / 3))
      travel(960, 300, x, y, P(t, t0 - .45, t0), C.cyan, 8)
    }
    // 8 卡大任务
    const jA = E.out(P(t, 6.2, 6.7)) * (1 - E.out(P(t, 10.1, 10.5))) + (B ? E.out(P(t, 12.8, 13.2)) : 0)
    const jy = 770, jx = B ? lerp(960, 960, 0) : 960
    withA(jA * (bigOn ? 1 - E.out(P(t, 13.6, 14)) : 1), () => {
      panel(jx - 170, jy - 40, 340, 80, { r: 18, fill: tint(C.violet, .08), stroke: C.violet, lw: 2 })
      txt('train · 整机 8 卡', jx, jy + 9, { size: 26, weight: 600, align: 'center' })
    })
    if (!B) {
      for (let n = 0; n < 3; n++) {
        const tx = NX[n] + 250, p = E.out(P(t, 6.6 + n * .15, 7.1 + n * .15))
        arrow(960, 730, tx, 672, p * (1 - E.out(P(t, 10.1, 10.5))), hexA(C.red, .6), 2, [7, 7])
        cross(tx, 690, 26, C.red, E.out(P(t, 7.2, 7.5)) * (1 - E.out(P(t, 10.1, 10.5))))
      }
      chip('Pending · 每台只剩 6 张', 1400, 770, { size: 22, col: C.red, solid: true, font: SANS, alpha: E.out(P(t, 7.4, 7.9)) * (1 - E.out(P(t, 10.1, 10.5))) })
    } else {
      travel(960, 730, NX[1] + 250, NY + 165, P(t, 13.0, 13.6), C.violet, 10)
      if (bigOn) ring(NX[1] + 250, NY + 165, P(t, 13.6, 14.6), C.violet, 320)
      chip('Running · 整机 8 卡', 960, 770, { size: 24, col: C.green, solid: true, font: SANS, alpha: E.out(P(t, 13.8, 14.2)) })
      chip('小任务塞满一台', NX[0] + 250, 720, { size: 19, font: SANS, col: C.cyan, alpha: E.out(P(t, 12.8, 13.2)) })
      chip('完整空闲，留给下一个大任务', NX[2] + 250, 720, { size: 19, font: SANS, col: C.green, alpha: E.out(P(t, 14.4, 14.8)) })
    }
    withA(E.out(P(t, 15, 15.5)), () => txt('注意：MostAllocated 全局生效，CPU 业务也会被挤在少数节点', 960, 850, { size: 20, color: C.mute, align: 'center' }))
  },
}

// 场景 5：GPU 共享
const share = {
  name: 'GPU 共享', dur: 16, mood: 3,
  vo: [[0.6, 'time-slicing 把一张卡虚报成多份，轮流使用。'],
    [5.8, '但没有显存隔离：一个 Pod 吃满，邻居 OOM。'],
    [10.8, 'MIG 把卡硬件切成最多 7 份，彼此隔离。']],
  cues: [[0.6, 'whoosh'], ...[0, 1, 2, 3].map(i => [1.2 + i * .2, 'pop']), [3.6, 'tick'], [6.4, 'alarmSoft'], [7.6, 'error'], [10.8, 'whoosh'], ...[0, 1, 2, 3, 4, 5, 6].map(i => [11.2 + i * .15, 'tick']), [13.0, 'error'], [14.0, 'ok']],
  draw(t, T) {
    heading('GPU 共享：time-slicing 与 MIG', 140, 210, t, .2, { eyebrow: 'SHARING', color: COL })
    // 左：time-slicing
    const lA = E.out(P(t, .6, 1.1))
    withA(lA, () => {
      panel(140, 270, 780, 600, { r: 22 })
      chip('time-slicing', 172, 312, { size: 22, col: C.cyan, solid: true, align: 'left' })
      txt('replicas: 4', 888, 320, { size: 20, font: MONO, color: C.cyan, align: 'right' })
    })
    const hog = P(t, 6.2, 7.6), bad = t >= 7.6
    const act = Math.floor(t * 2.6) % 4
    for (let i = 0; i < 4; i++) {
      const x = 260 + i * 180, k = E.back(clamp(P(t, 1.2 + i * .2, 1.6 + i * .2)))
      const on = !bad && t > 2 && act === i
      pod(x, 440, 110, { state: bad && i !== 2 ? 'fail' : i === 2 && hog > 0 ? C.amber : on ? 'run' : 'idle', label: `pod-${i}`, alpha: clamp(k), scale: clamp(k) * (on ? 1.08 : 1), shake: bad && i !== 2 ? Math.sin(t * 60) * 5 * (1 - P(t, 7.6, 8.2)) : 0 })
      if (on) partialLine(x, 560, x, 610, 1, hexA(C.green, .7), 3)
    }
    withA(lA, () => {
      ctx.save(); rr(200, 612, 660, 70, 12); ctx.fillStyle = tint(C.text, .06); ctx.fill(); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
      txt('一张 H100 80GB · 时间片轮转', 530, 656, { size: 22, weight: 600, align: 'center' })
      const f = bad ? 1 : .18 + hog * .82
      meter(200, 740, 660, 20, f, bad ? C.red : hog > 0 ? C.amber : C.cyan, { label: '显存（所有 Pod 共用）', value: `${Math.round(f * 80)} / 80 GB` })
    })
    chip('8 卡节点上报 nvidia.com/gpu: 32', 530, 820, { size: 19, col: C.cyan, alpha: E.out(P(t, 3.6, 4.1)) * (1 - E.out(P(t, 7.4, 7.8))) })
    chip('无显存隔离 · 无故障隔离', 530, 820, { size: 20, font: SANS, col: C.red, solid: true, alpha: E.out(P(t, 7.8, 8.3)) })
    // 右：MIG
    const rA = E.out(P(t, 10.8, 11.3))
    withA(rA, () => {
      panel(1000, 270, 780, 600, { r: 22 })
      chip('MIG · 硬件切分', 1032, 312, { size: 22, col: C.violet, solid: true, align: 'left', font: SANS })
      txt('A100 / H100 / B200', 1748, 320, { size: 18, font: MONO, color: C.violet, align: 'right' })
      ctx.save(); rr(1040, 600, 700, 90, 12); ctx.strokeStyle = C.hairD; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
    })
    for (let i = 0; i < 7; i++) {
      const a = E.out(P(t, 11.2 + i * .15, 11.6 + i * .15)); if (a <= 0) continue
      const x = 1050 + i * 98, fail = i === 3 && t >= 13
      const col = fail ? C.red : t >= 14 ? C.green : C.violet
      withA(a, () => {
        ctx.save(); rr(x, 610, 88, 70, 8); ctx.fillStyle = tint(col, .16); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
        txt('1g.10gb', x + 44, 652, { size: 16, font: MONO, color: col, align: 'center' })
        pod(x + 44, 460, 76, { state: fail ? 'fail' : t >= 14 ? 'run' : C.violet, alpha: a, shake: fail ? Math.sin(t * 60) * 4 * (1 - P(t, 13, 13.6)) : 0 })
        line(x + 44, 500, x + 44, 606, hexA(col, .4), 2, [5, 5])
      })
    }
    if (t >= 13) ring(1050 + 3 * 98 + 44, 460, P(t, 13, 14), C.red, 120)
    withA(E.out(P(t, 12.2, 12.7)), () => txt('每份独立的 SM · 显存 · 缓存', 1390, 740, { size: 22, color: C.body, align: 'center' }))
    chip('一份出错，其他照常运行', 1390, 820, { size: 20, font: SANS, col: C.green, solid: true, alpha: E.out(P(t, 14, 14.5)) })
  },
}

ANIM({
  id: 'gpu-operator',
  meta: { stage: 5, lesson: 1, of: 6, title: 'GPU 调度与 GPU Operator', summary: 'Device Plugin、NFD、GPU Operator、驱动策略与 GPU 共享。', next: '批调度：Kueue、Volcano 与 Gang 调度' },
  scenes: [
    lessonIntro({ tags: ['Device Plugin', 'NFD', 'GPU Operator', 'MostAllocated', 'MIG'], vo: [[3.2, '让 K8s 看见并调度每一张 GPU。', '让 Kubernetes 看见并调度每一张 GPU。']] }),
    plugin, operator, driver, binpack, share,
    lessonOutro({
      points: ['设备插件上报 nvidia.com/gpu，只能整数申请', 'GPU Operator 按依赖部署，validator 验收', '推荐宿主机驱动，NVSwitch 要 Fabric Manager', 'MostAllocated 减碎片；time-slicing / MIG 共享'],
      vo: [[0.8, '小结：让 K8s 认识并用好每一张 GPU。', '小结：让 Kubernetes 认识并用好每一张 GPU。'], [5.6, '下一课，用 Kueue 和 Volcano 做批调度。', '下一课，用 Queue 和 Volcano 做批调度。']],
    }),
  ],
})
})()
