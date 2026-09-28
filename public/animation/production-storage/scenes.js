/* 第 4 阶段 · 第 4 课：生产存储：CSI 选型与 Rook-Ceph */
(() => {
  const COL = STAGES[4].color
  const sq = (x, y, w, h, c, a = 1, r = 6) => withA(a, () => { ctx.save(); ctx.fillStyle = tint(c, .25); ctx.strokeStyle = c; ctx.lineWidth = 2; rr(x, y, w, h, r); ctx.fill(); ctx.stroke(); ctx.restore() })

  // 场景 1：选型
  const QS = [['访问模式', ['RWO · 单 Pod 读写', 'RWX · 多 Pod 共享']], ['高可用谁负责', ['存储层多副本', '应用自己复制']], ['存储在哪里', ['集群内自建', '集群外已有']]]
  const OPTS = [
    ['local-path', '本地盘', '缓存、自带复制的数据库', ['RWO']],
    ['nfs-csi', 'NFS', '已有高可用 NAS', ['RWX']],
    ['ceph-csi', '块 + 文件', '集群外已有独立 Ceph', ['RWO', 'RWX']],
    ['Rook', '块 + 文件 + 对象', 'K8s 节点上自建 Ceph', ['RWO', 'RWX']],
    ['JuiceFS', '文件', '云上 / 已有对象存储', ['RWX']],
    ['GPFS / Weka', '并行文件系统', 'AI 训练、HPC 高吞吐', ['RWX']],
  ]
  const select = {
    name: '选型三问', dur: 17, mood: 1,
    vo: [[0.6, '选 CSI 之前，先问三个问题。'],
      [5.6, '单 Pod 读写还是多 Pod 共享，决定了候选方案。'],
      [10.8, '数据库自带复制，再放三副本 Ceph 就写了 6 份。', '数据库自带复制，再放三副本 Ceph，就写了六份。']],
    cues: [[0.6, 'whoosh'], ...QS.map((_, i) => [.9 + i * .6, 'pop']), ...OPTS.map((_, i) => [3.2 + i * .25, 'tick']), [5.8, 'zap'], [8.2, 'zap'], [10.8, 'pop'],
      ...[0, 1, 2, 3, 4, 5].map(k => [11.8 + k * .15, 'tick']), [13.0, 'alarmSoft'], [14.2, 'ok']],
    draw(t) {
      heading('选型：先问三个问题', 140, 210, t, .2, { eyebrow: 'CSI SELECTION', color: COL })
      const mode = t >= 5.8 && t < 8.2 ? 'RWO' : t >= 8.2 && t < 10.6 ? 'RWX' : null
      const actQ = t >= 5.6 && t < 10.6 ? 0 : t >= 10.8 ? 1 : -1
      QS.forEach(([q, opts], i) => {
        const a = E.out(P(t, .8 + i * .6, 1.3 + i * .6)); if (a <= 0) return
        const y = 280 + i * 200, on = actQ === i
        withA(a, () => {
          panel(140, y, 560, 180, { r: 18, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .05) : C.panel })
          dot(190, y + 50, 20, on ? COL : C.faint, 0); txt(String(i + 1), 190, y + 58, { size: 22, weight: 700, color: '#fff', align: 'center' })
          txt(q, 228, y + 60, { size: 26, weight: 600 })
          let cx = 172
          opts.forEach((o, j) => {
            const hot = on && (i === 0 ? (mode === 'RWO' && j === 0) || (mode === 'RWX' && j === 1) : j === 1)
            cx += chip(o, cx, y + 126, { size: 19, col: hot ? COL : C.mute, solid: hot, align: 'left', font: SANS }) + 16
          })
        })
      })
      OPTS.forEach(([n, type, use, acc], i) => {
        const a = E.out(P(t, 3.2 + i * .25, 3.6 + i * .25)); if (a <= 0) return
        const x = 760 + (i % 2) * 520, y = 280 + Math.floor(i / 2) * 112
        const match = mode && acc.includes(mode)
        withA(a * (mode && !match ? .3 : 1), () => {
          panel(x, y, 500, 96, { r: 14, stroke: match ? COL : C.hair, lw: match ? 2.5 : 1.5 })
          txt(n, x + 24, y + 40, { size: 24, font: MONO, weight: 600 })
          chip(type, x + 476, y + 32, { size: 16, col: C.blue, align: 'right', font: SANS })
          txt(use, x + 24, y + 78, { size: 20, color: C.body })
          if (match) chip(mode, x + 476, y + 72, { size: 16, col: COL, solid: true, align: 'right' })
        })
      })
      // 数据库写放大
      withA(E.out(P(t, 10.8, 11.3)), () => {
        panel(760, 630, 1020, 240, { r: 18, stroke: hexA(C.red, .4) })
        txt('数据库主从 + 三副本 Ceph', 792, 674, { size: 22, weight: 600 })
        ;[['主', 730], ['从', 790]].forEach(([s, y], i) => {
          cylinder(830, y, 44, 36, C.blue, null)
          txt(s, 830, y + 7, { size: 16, color: C.blueD, align: 'center', weight: 600 })
          for (let k = 0; k < 3; k++) {
            const t0 = 11.8 + (i * 3 + k) * .15, p = E.back(P(t, t0, t0 + .3))
            arrow(860, y, 950 + k * 56, y, E.out(P(t, t0 - .2, t0)), hexA(C.red, .25), 1.5)
            if (p > 0) sq(956 + k * 56, y - 18, 40 * clamp(p), 36, C.red, clamp(p))
          }
        })
        txt(`写 ${[0, 1, 2, 3, 4, 5].filter(k => t >= 11.8 + k * .15).length} 份`, 1440, 764, { alpha: E.out(P(t, 11.8, 12.1)), size: 44, weight: 700, color: C.red, align: 'center' })
        txt('延迟也更高', 1440, 806, { size: 20, color: C.mute, align: 'center' })
        chip('✓ 团队做法：数据库用本地 NVMe，高可用交给数据库 Operator', 792, 846, { size: 18, col: C.green, align: 'left', font: SANS, alpha: E.out(P(t, 14.2, 14.6)) })
      })
    },
  }

  // 场景 2：WaitForFirstConsumer
  const bindPanel = (t, x, title, sub, col, t0, wffc) => {
    const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
    const volNode = wffc ? 1 : 0, tVol = t0 + (wffc ? 2.2 : 1.0), tPod = t0 + (wffc ? 1.0 : 2.4)
    withA(a, () => {
      panel(x, 280, 800, 440, { r: 18, stroke: hexA(col, .5) })
      chip(title, x + 32, 322, { size: 22, col, solid: true, align: 'left' })
      txt(sub, x + 768, 330, { size: 19, color: C.mute, align: 'right' })
      const bound = t >= tVol
      chip('PVC data', x + 400, 392, { size: 20, col: C.blue })
      chip(bound ? 'Bound' : 'Pending', x + 510, 392, { size: 18, col: bound ? C.green : C.amber, solid: bound, align: 'left', font: SANS })
      ;['node-a', 'node-b'].forEach((n, i) => node(x + 40 + i * 380, 470, 340, 200, n, { accent: C.blue }))
    })
    const vx = x + 40 + volNode * 380 + 100, px = x + 40 + 380 + 240
    // 卷
    const vp = E.back(P(t, tVol, tVol + .4))
    if (vp > 0) { arrow(x + 400, 414, vx, 464, E.out(P(t, tVol - .3, tVol)), hexA(C.teal, .5), 2, [6, 5]); withA(clamp(vp), () => { cylinder(vx, 584, 70 * clamp(vp), 56, C.teal, null); txt('卷', vx, 650, { size: 18, color: C.teal, align: 'center' }) }) }
    // Pod
    const pp = P(t, tPod, tPod + .7)
    if (pp > 0) {
      const py = lerp(420, 584, E.inOut(pp))
      const ok = wffc ? t >= t0 + 2.8 : null, bad = !wffc && t >= tPod + 1
      pod(px, py, 34, { state: bad ? 'fail' : ok ? 'run' : 'pending', shake: bad && t < tPod + 1.6 ? 1 : 0 })
      if (pp >= 1) txt('Pod', px, 650, { size: 18, color: C.mute, align: 'center' })
      if (bad) {
        curve(px - 40, 584, vx + 44, 584, 50, E.out(P(t, tPod + 1, tPod + 1.5)), hexA(C.red, .6), 2.5)
        cross(x + 400, 548, 18, C.red, E.out(P(t, tPod + 1.4, tPod + 1.7)))
        chip('卷在 node-a，Pod 挂不上', x + 400, 696, { size: 17, col: C.red, font: SANS, alpha: E.out(P(t, tPod + 1.6, tPod + 2)) })
      }
      if (ok) check(px + 50, 548, 24, C.green, P(t, t0 + 2.8, t0 + 3.2))
    }
  }
  const wffc = {
    name: 'WaitForFirstConsumer', dur: 16, mood: 2,
    vo: [[0.6, 'Immediate 先建卷，Pod 却可能调度到别的节点。'],
      [5.6, 'WaitForFirstConsumer 等 Pod 选好节点再建卷。', 'Wait For First Consumer，等 Pod 选好节点再建卷。'],
      [10.8, '注意，local-path 没有容量限制，能写满整块盘。', '注意，local path 没有容量限制，能写满整块盘。']],
    cues: [[0.6, 'whoosh'], [1.6, 'pop'], [3.0, 'whoosh'], [3.8, 'error'], [5.8, 'whoosh'], [6.6, 'whoosh'], [7.8, 'pop'], [8.4, 'ok'], [10.8, 'pop'], [13.4, 'alarm']],
    draw(t) {
      heading('本地盘：什么时候建卷', 140, 210, t, .2, { eyebrow: 'LOCAL-PATH', color: COL })
      bindPanel(t, 140, 'Immediate', '先建卷，再调度', C.red, .6, false)
      bindPanel(t, 980, 'WaitForFirstConsumer', '先调度，再建卷', C.green, 5.6, true)
      withA(E.out(P(t, 10.8, 11.3)), () => {
        panel(140, 750, 1640, 120, { r: 18, stroke: hexA(C.amber, .5), fill: tint(C.amber, .04) })
        txt('local-path 没有容量限制', 172, 800, { size: 24, weight: 600 })
        txt('storage: 10Gi 只是个标签', 172, 842, { size: 20, font: MONO, color: C.body })
        txt('/data1 整块盘', 900, 792, { size: 18, color: C.mute })
        const grow = E.inOut(P(t, 11.6, 13.4)), segs = [[.2, C.blue, 'vol-1'], [.15, C.teal, 'vol-2'], [lerp(.08, .65, grow), grow >= 1 ? C.red : C.amber, 'vol-3']]
        let sx = 900
        segs.forEach(([f, c, n]) => { sq(sx, 806, 840 * f - 3, 40, c, 1, 8); txt(n, sx + 840 * f / 2, 832, { size: 16, font: MONO, color: C.text, align: 'center' }); sx += 840 * f })
        chip('写满 → 同盘的卷一起挂', 1740, 790, { size: 17, col: C.red, align: 'right', font: SANS, alpha: E.out(P(t, 13.4, 13.8)) })
      })
    },
  }

  // 场景 3：Rook-Ceph
  const CEPH = [
    { t: 5.8, cmd: 'kubectl rook-ceph ceph -s' },
    { t: 6.8, out: 'osd: 5 osds: 5 up, 5 in        # 明明有 6 块盘', color: C.amber, sfx: 'alarmSoft' },
    { t: 11.6, cmd: 'kubectl -n rook-ceph rollout restart deploy/rook-ceph-operator' },
    { t: 14.8, out: 'health: HEALTH_OK   osd: 6 osds: 6 up, 6 in', color: C.green, sfx: 'ok' },
  ]
  const rook = {
    name: 'Rook-Ceph', dur: 17, mood: 3,
    vo: [[0.6, 'Rook 是 Ceph 的 Operator，组件都跑成 Pod。'],
      [5.8, 'OSD 比磁盘少？多半是盘上有残留，被跳过了。'],
      [11.2, '确认数据不要了就擦盘，再重启 operator。']],
    cues: [[0.6, 'pop'], [1.2, 'pop'], [1.8, 'whoosh'], ...[0, 1, 2].map(i => [2.4 + i * .2, 'tick']), [3.2, 'tick'], [3.4, 'tick'], ...[0, 1, 2, 3, 4].map(i => [4 + i * .2, 'pop']), [4.8, 'pop'],
      ...typeCues(CEPH, 30), [7.4, 'error'], [11.2, 'pop'], [13.8, 'shimmer']],
    draw(t) {
      heading('Rook-Ceph：在集群内自建分布式存储', 140, 210, t, .2, { eyebrow: 'ROOK-CEPH', color: COL })
      withA(E.out(P(t, .6, 1)), () => doc(260, 330, 220, 90, 'CephCluster', COL, { ext: '' }))
      box(960, 330, 560, 90, 'rook-ceph-operator', '监听 CephCluster / CephBlockPool / CephFilesystem', COL, { alpha: E.out(P(t, 1.2, 1.6)), size: 24 })
      if (t > 1.8) { arrow(372, 330, 676, 330, E.out(P(t, 1.8, 2.3)), hexA(COL, .6), 2.5); withA(E.out(P(t, 2, 2.4)), () => txt('watch', 524, 316, { size: 17, font: MONO, color: COL, align: 'center' })) }
      box(1610, 330, 340, 90, 'ceph-csi', 'rbd / cephfs · 每节点 plugin', C.blue, { alpha: E.out(P(t, 4.8, 5.2)), size: 24 })
      // 控制平面
      withA(E.out(P(t, 2.2, 2.6)), () => {
        panel(140, 410, 480, 230, { r: 18, stroke: hexA(C.violet, .45) })
        txt('控制平面节点', 172, 450, { size: 20, color: C.mute })
      })
      ;[0, 1, 2].forEach(i => pod(210 + i * 80, 520, 30, { state: C.violet, alpha: E.out(P(t, 2.4 + i * .2, 2.7 + i * .2)) }))
      ;[0, 1].forEach(i => pod(250 + i * 80, 596, 30, { state: C.blue, alpha: E.out(P(t, 3.2 + i * .2, 3.5 + i * .2)) }))
      withA(E.out(P(t, 2.6, 3)), () => txt('mon × 3', 440, 527, { size: 20, font: MONO, color: C.violet }))
      withA(E.out(P(t, 3.4, 3.8)), () => txt('mgr × 2', 440, 603, { size: 20, font: MONO, color: C.blue }))
      // 存储节点
      const fixed = t >= 13.8
      ;[0, 1, 2].forEach(i => {
        const a = E.out(P(t, 3.2 + i * .15, 3.6 + i * .15)); if (a <= 0) return
        const x = 660 + i * 380
        node(x, 410, 360, 230, 'sn-192-168-201-' + (i + 1), { alpha: a, accent: C.teal })
        ;[0, 1].forEach(d => {
          const cx = x + 100 + d * 160, bad = i === 2 && d === 1, n = i * 2 + d
          const up = bad ? fixed : t >= 4 + Math.min(n, 4) * .2
          withA(a, () => {
            cylinder(cx, 546, 60, 50, up ? C.teal : bad && t >= 7.2 ? C.red : C.faint, 'nvme' + d + 'n1')
            if (up) chip('osd.' + n, cx, 480, { size: 17, col: C.teal, solid: true, alpha: bad ? E.out(P(t, 13.8, 14.2)) : 1 })
            else if (bad && t >= 7.2) chip('旧分区 / LVM', cx, 480, { size: 16, col: C.red, font: SANS, alpha: E.out(P(t, 7.2, 7.6)) })
          })
          if (bad) { ring(cx, 546, P(t, 7.2, 8.2), C.red, 70); ring(cx, 546, P(t, 13.8, 14.8), C.teal, 80) }
        })
      })
      terminal(140, 670, 1000, 210, t, CEPH, { size: 19, alpha: E.out(P(t, 5.4, 5.8)), title: 'kubectl rook-ceph' })
      withA(E.out(P(t, 7.4, 7.9)), () => {
        panel(1180, 670, 600, 210, { r: 18, stroke: hexA(C.red, .45), fill: tint(C.red, .03) })
        txt('OSD 少于磁盘数？', 1212, 714, { size: 24, weight: 600 })
        txt('Rook 为防误删，跳过有残留的盘', 1212, 752, { size: 20, color: C.body })
        let cx = 1212
        ;['sgdisk --zap-all', 'dd', 'blkdiscard'].forEach((s, i) => { cx += chip(s, cx, 800, { size: 18, col: C.teal, align: 'left', alpha: E.out(P(t, 11.2 + i * .3, 11.6 + i * .3)) }) + 12 })
        txt('擦盘后重启 operator，重新扫描', 1212, 852, { size: 20, color: C.green, alpha: E.out(P(t, 12.4, 12.8)) })
      })
    },
  }

  // 场景 4：副本 vs 纠删码
  const ecScene = {
    name: '副本与纠删码', dur: 16, mood: 2,
    vo: [[0.6, '三副本最稳，但空间利用率只有三分之一。'],
      [5.6, '纠删码 8+3 切成 11 块，利用率约 73%。', '纠删码八加三，切成十一块，利用率约百分之七十三。'],
      [11.0, '但 8+3 至少要 11 台主机，节点少就用 4+2。', '但八加三至少要十一台主机，节点少就用四加二。']],
    cues: [[0.6, 'whoosh'], [1.0, 'pop'], [1.6, 'whoosh'], [2.6, 'tick'], [5.8, 'pop'], [6.4, 'zap'], [7.0, 'pop'], [8.0, 'whoosh'], [9.4, 'chime'], [11.0, 'pop'], [11.6, 'alarmSoft']],
    draw(t) {
      heading('块存储池：副本还是纠删码', 140, 210, t, .2, { eyebrow: 'ERASURE CODING', color: COL })
      // 三副本
      withA(E.out(P(t, .6, 1.1)), () => {
        const x = 140
        panel(x, 280, 800, 440, { r: 18, stroke: hexA(C.blue, .45) })
        chip('replicated · size 3', x + 32, 322, { size: 20, col: C.blue, solid: true, align: 'left' })
        sq(x + 300, 356, 200, 48, C.blue, E.out(P(t, 1, 1.4)), 8)
        txt('对象', x + 400, 388, { size: 20, color: C.blueD, align: 'center', alpha: E.out(P(t, 1, 1.4)) })
        ;[0, 1, 2].forEach(i => {
          const hx = x + 60 + i * 240
          panel(hx, 470, 200, 150, { r: 14, shadow: false })
          txt('host-' + (i + 1), hx + 100, 500, { size: 18, font: MONO, color: C.mute, align: 'center' })
          const p = P(t, 1.6 + i * .15, 2.3 + i * .15)
          if (p > 0 && p < 1) travel(x + 400, 404, hx + 100, 560, p, C.blue, 6)
          if (p >= 1) sq(hx + 30, 536, 140, 48, C.blue, E.out(P(t, 2.3 + i * .15, 2.6 + i * .15)), 8)
        })
        meter(x + 40, 676, 720, 20, .33 * E.out(P(t, 2.6, 3.4)), C.red, { label: '空间利用率', value: '33%', size: 18 })
      })
      // EC 8+3
      withA(E.out(P(t, 5.6, 6.1)), () => {
        const x = 980
        panel(x, 280, 800, 440, { r: 18, stroke: hexA(C.green, .45) })
        chip('erasureCoded · 8+3', x + 32, 322, { size: 20, col: C.green, solid: true, align: 'left' })
        for (let k = 0; k < 11; k++) {
          const par = k >= 8, cx = x + 70 + k * 60
          const split = E.inOut(P(t, 6.4, 7)), fall = E.inOut(P(t, 8 + k * .08, 8.7 + k * .08))
          const a = par ? E.out(P(t, 7 + (k - 8) * .15, 7.4 + (k - 8) * .15)) : 1
          const bx = par ? cx : lerp(x + 160 + k * 60, cx, split)
          const by = lerp(356, 540, fall)
          panel(cx - 2, 470, 60, 150, { r: 10, shadow: false })
          txt('h' + (k + 1), cx + 28, 500, { size: 16, font: MONO, color: C.mute, align: 'center' })
          sq(bx, by, 56 - (par ? 0 : 4 * (1 - split)), 48, par ? C.amber : C.green, a, 6)
          txt(par ? 'P' + (k - 7) : 'D' + (k + 1), bx + 28, by + 31, { size: 16, font: MONO, color: C.text, align: 'center', alpha: a })
        }
        withA(E.out(P(t, 8.8, 9.3)), () => { txt('8 个数据块', x + 70 + 4 * 60 - 2, 380, { size: 20, color: C.green, align: 'center' }); txt('3 个校验块', x + 70 + 9.5 * 60 - 2, 380, { size: 20, color: C.amber, align: 'center' }) })
        meter(x + 40, 676, 720, 20, .73 * E.out(P(t, 9.2, 10)), C.green, { label: '空间利用率', value: '≈ 73%', size: 18 })
      })
      withA(E.out(P(t, 11.0, 11.5)), () => {
        panel(140, 750, 1640, 120, { r: 18, stroke: hexA(COL, .5), fill: tint(COL, .04) })
        txt('8+3 = 11 块，默认故障域是主机 → 至少 11 台存储节点，否则 PG 无法 active+clean', 172, 798, { size: 22, color: C.text })
        txt('节点少：用 4+2（6 台）或副本池 · 团队组合：副本池存元数据 + EC 池存数据', 172, 842, { size: 20, color: C.body, alpha: E.out(P(t, 12.4, 12.8)) })
      })
    },
  }

  // 场景 5：VolumeSnapshot
  const snap = {
    name: 'VolumeSnapshot', dur: 16, mood: 4,
    vo: [[0.6, '装好快照控制器，就能给 PVC 打快照。'],
      [5.6, '恢复时新建 PVC，dataSource 指向快照。', '恢复时新建一个 PVC，data source 指向这个快照。'],
      [10.8, '快照和数据在同一集群，它不能代替备份。']],
    cues: [[0.6, 'pop'], [1.0, 'pop'], [1.6, 'whoosh'], [2.2, 'shimmer'], [5.8, 'whoosh'], [6.6, 'pop'], [7.4, 'ok'], [10.8, 'pop'], [11.6, 'impact'], [12.2, 'poof'], [13.0, 'pop'], [13.6, 'ok']],
    draw(t) {
      heading('VolumeSnapshot：快照与恢复', 140, 210, t, .2, { eyebrow: 'SNAPSHOT', color: COL })
      chip('前提：external-snapshotter CRD + snapshot-controller', 1780, 216, { size: 18, col: C.amber, align: 'right', font: SANS, alpha: E.out(P(t, .6, 1)) })
      cylinder(330, 390, 110, 96, C.blue, 'PVC data', E.out(P(t, 1, 1.4)))
      box(960, 390, 340, 120, 'VolumeSnapshot', 'data-snap-1', C.violet, { alpha: E.out(P(t, 2.0, 2.4)), size: 26, hi: t > 2 && t < 3.4 })
      ring(960, 390, P(t, 2.2, 3.2), C.violet, 220)
      if (t > 1.6) {
        arrow(400, 390, 784, 390, E.out(P(t, 1.6, 2.1)), hexA(C.violet, .6), 2.5)
        withA(E.out(P(t, 1.8, 2.2)), () => txt('source: data', 592, 372, { size: 18, font: MONO, color: C.violet, align: 'center' }))
      }
      chip('VolumeSnapshotClass · ceph-block-snap', 960, 486, { size: 17, col: C.violet, alpha: E.out(P(t, 2.8, 3.2)) })
      if (t > 5.8) {
        arrow(1136, 390, 1516, 390, E.out(P(t, 5.8, 6.4)), hexA(C.green, .6), 2.5)
        withA(E.out(P(t, 6, 6.4)), () => txt('dataSource: data-snap-1', 1326, 372, { size: 18, font: MONO, color: C.green, align: 'center' }))
        travel(1136, 390, 1516, 390, P(t, 5.9, 6.6), C.green, 7)
      }
      cylinder(1590, 390, 110, 96, C.green, 'PVC data-restore', E.out(P(t, 6.6, 7)))
      withA(E.out(P(t, 7.2, 7.6)), () => { line(1650, 390, 1712, 390, hexA(C.green, .5), 2, [5, 4]); txt('Pod', 1745, 444, { size: 18, color: C.mute, align: 'center' }) })
      pod(1745, 390, 28, { state: 'run', alpha: E.out(P(t, 7.2, 7.6)) })
      // 同一集群
      const broke = t >= 11.6, sh = t > 11.6 && t < 12.2 ? Math.sin(t * 80) * 6 : 0
      withA(E.out(P(t, 10.6, 11.1)), () => {
        panel(140 + sh, 580, 1040, 290, { r: 18, dash: [9, 7], stroke: broke ? C.red : C.hairD, fill: broke ? tint(C.red, .05) : C.panel, shadow: false, lw: 2 })
        txt('同一个 Ceph 集群', 172 + sh, 624, { size: 22, weight: 600, color: broke ? C.red : C.text })
        const g = 1 - P(t, 12.2, 12.8)
        cylinder(420 + sh, 720, 90, 70, C.blue, 'data', g)
        cylinder(700 + sh, 720, 90, 70, C.violet, 'data-snap-1', g)
        poof(420, 720, P(t, 12.2, 13), C.red); poof(700, 720, P(t, 12.2, 13), C.red)
        if (broke) cross(560, 716, 34, C.red, E.out(P(t, 11.6, 12)))
        txt('存储集群故障：数据和快照一起没', 660, 846, { size: 22, color: C.red, align: 'center', alpha: E.out(P(t, 12.6, 13)) })
      })
      withA(E.out(P(t, 13, 13.4)), () => {
        panel(1220, 580, 560, 290, { r: 18, stroke: hexA(C.green, .5), fill: tint(C.green, .04) })
        txt('备份：Velero 等', 1252, 624, { size: 22, weight: 600 })
        cylinder(1500, 720, 90, 70, C.green, '独立存储 / 异地')
        check(1640, 700, 30, C.green, P(t, 13.6, 14))
      })
    },
  }

  ANIM({
    id: 'production-storage',
    meta: { stage: 4, lesson: 4, of: 8, title: '生产存储：CSI 选型与 Rook-Ceph', summary: 'local-path、NFS、Ceph、GPFS 等 CSI 选型，Rook-Ceph 部署与快照。', next: '可观测性：指标、日志与事件' },
    scenes: [
      lessonIntro({ tags: ['CSI', 'local-path', 'Rook-Ceph', '纠删码', 'VolumeSnapshot'], vo: [[3.2, '生产存储：选对 CSI，再把 Ceph 跑稳。']] }),
      select, wffc, rook, ecScene, snap,
      lessonOutro({
        points: ['选型三问：RWO/RWX、谁做高可用、集群内外', '本地盘用 WaitForFirstConsumer，注意无配额', 'Rook：OSD 少了查残留，擦盘后重启 operator', 'EC 8+3 省空间但要 11 台；快照不是备份'],
        vo: [[0.8, '小结：先想清楚需求，再挑存储方案。'], [5.6, '下一课，可观测性：指标与日志。']],
      }),
    ],
  })
})()
