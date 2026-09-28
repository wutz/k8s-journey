/* 第 2 阶段 · 第 3 课：StatefulSet 与有状态应用 */
(() => {
const COL = STAGES[2].color

// ---------- 场景 1：稳定身份 ----------
const DN = ['redis-7c9f8-xk2p9', 'redis-7c9f8-q8m4d', 'redis-7c9f8-z2w7c'], DX = [290, 530, 770]
const SX = [1150, 1390, 1630]
const identity = {
  name: '稳定身份', dur: 16, mood: 1,
  vo: [[0.6, 'Deployment 的副本名字随机、共用存储。'],
    [5.4, 'StatefulSet 按序号命名，每个副本一份 PVC。'],
    [10.8, 'redis-1 重建后，名字和数据都原样回来。', 'redis 1 重建后，名字和数据都原样回来。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.2, 'pop'], [1.4, 'pop'], [3.2, 'poof'], [4.2, 'pop'], [4.6, 'error'], [5.8, 'pop'], [6.3, 'pop'], [6.8, 'pop'], [7.4, 'tick'], [10.8, 'poof'], [12.0, 'pop'], [12.6, 'lock'], [13.2, 'chime']],
  draw(t) {
    heading('Deployment vs StatefulSet', 140, 210, t, .2, { eyebrow: 'STABLE IDENTITY', color: COL })
    // 左：Deployment
    const la = E.out(P(t, .6, 1))
    withA(la, () => {
      const w = chip('Deployment', 180, 296, { size: 22, col: C.blue, solid: t < 5.4, align: 'left' })
      txt('副本可互换', 180 + w + 14, 303, { size: 20, color: C.mute })
    })
    const va = E.out(P(t, 1.6, 2))
    DX.forEach((x, i) => {
      const a = E.out(P(t, 1 + i * .2, 1.4 + i * .2)); if (a <= 0) return
      let alpha = a, name = DN[i], sc = 1
      if (i === 1) {
        if (t >= 3.2 && t < 4.2) alpha = 0
        if (t >= 4.2) { name = 'redis-7c9f8-m4t2z'; sc = E.back(P(t, 4.2, 4.7)) }
      }
      if (alpha > 0) {
        pod(x, 440, 92, { state: C.blue, label: name, alpha, scale: sc })
        partialLine(x, 528, 530, 660, va * alpha, hexA(C.blue, .45), 2)
      }
    })
    poof(530, 440, P(t, 3.2, 4.2), C.blue)
    chip('名字变了', 530, 566, { size: 18, col: C.amber, font: SANS, alpha: E.out(P(t, 4.6, 5)) })
    cylinder(530, 690, 150, 44, C.blue, 'PVC data（共用一个）', va)
    // 分隔
    withA(la, () => line(940, 290, 940, 850, hexA(C.text, .1), 2, [6, 8]))
    // 右：StatefulSet
    withA(E.out(P(t, 5.4, 5.8)), () => {
      const w = chip('StatefulSet', 1000, 296, { size: 22, col: COL, solid: true, align: 'left' })
      txt('每个副本都有身份', 1000 + w + 14, 303, { size: 20, color: C.mute })
    })
    SX.forEach((x, i) => {
      const a = E.out(P(t, 5.8 + i * .5, 6.2 + i * .5)); if (a <= 0) return
      let alpha = a, sc = E.back(P(t, 5.8 + i * .5, 6.3 + i * .5)), link = E.out(P(t, 7 + i * .2, 7.4 + i * .2))
      if (i === 1) {
        if (t >= 10.8 && t < 12) alpha = 0
        if (t >= 12) sc = E.back(P(t, 12, 12.5))
        if (t >= 10.8) link = E.out(P(t, 12.6, 13))
      }
      if (alpha > 0) {
        pod(x, 440, 92, { state: 'run', label: `redis-${i}`, alpha, scale: sc })
        chip(i ? 'replica' : 'master', x, 548, { size: 16, col: i ? C.mute : COL, alpha })
      }
      if (link > 0) partialLine(x, 566, x, 656, link, hexA(C.teal, .7), 2.5)
      cylinder(x, 684, 110, 40, C.teal, `data-redis-${i}`, E.out(P(t, 6.8 + i * .2, 7.2 + i * .2)))
    })
    poof(1390, 440, P(t, 10.8, 11.8), C.green)
    ring(1390, 440, P(t, 12, 12.9), C.green, 130)
    withA(E.out(P(t, 13.2, 13.7)), () => {
      check(1030, 818, 26, C.green, 1)
      txt('同名重建，挂回 data-redis-1', 1060, 826, { size: 22, color: C.text, weight: 500 })
    })
    withA(E.out(P(t, 5, 5.4)), () => {
      cross(190, 818, 22, C.red, 1)
      txt('谁是主、谁是从，说不清', 220, 826, { size: 22, color: C.text, weight: 500 })
    })
  },
}

// ---------- 场景 2：Headless Service 与稳定 DNS ----------
const DNS = [
  { t: .8, cmd: 'nslookup redis-0.redis' },
  { t: 1.8, out: 'Name:    redis-0.redis.default.svc.cluster.local', color: C.mute },
  { t: 2.1, out: 'Address: 10.244.1.5', color: C.green, sfx: 'ok' },
  { t: 5.9, cmd: 'nslookup redis' },
  { t: 6.8, out: 'Address: 10.244.1.5', color: C.green },
  { t: 7.0, out: 'Address: 10.244.2.7', color: C.green },
  { t: 7.2, out: 'Address: 10.244.3.4', color: C.green, sfx: 'ok' },
]
const IPS = ['10.244.1.5', '10.244.2.7', '10.244.3.4'], HX = [1180, 1420, 1660]
const headless = {
  name: 'Headless Service', dur: 16, mood: 2,
  vo: [[0.6, 'Headless Service 为每个 Pod 提供 DNS 名。'],
    [5.8, '查服务名，直接返回全部 Pod 的 IP。'],
    [10.8, 'Pod 重建 IP 会变，但名字不变。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DNS, 30), [1.0, 'pop'], [2.2, 'zap'], [7.0, 'zap'], [10.8, 'poof'], [11.8, 'pop'], [12.6, 'tick'], [13.4, 'chime']],
  draw(t) {
    heading('Headless Service：每个 Pod 一个 DNS 名', 140, 210, t, .2, { eyebrow: 'STABLE NETWORK ID', color: COL })
    terminal(140, 280, 860, 400, t, DNS, { size: 22, title: 'dns-test · busybox', alpha: E.out(P(t, .4, .9)) })
    code(140, 712, 860, ['clusterIP: None      # Headless', 'serviceName: redis   # StatefulSet 指向它'], t, 1.2, { title: 'redis-sts.yaml', size: 21 })
    // 右侧：Service 与 Pod
    box(1420, 330, 360, 100, 'Service redis', 'clusterIP: None', COL, { alpha: E.out(P(t, 1, 1.4)), size: 26, hi: t > 5.8 && t < 10.8 })
    HX.forEach((x, i) => {
      const a = E.out(P(t, 1.2 + i * .2, 1.6 + i * .2)); if (a <= 0) return
      let alpha = a, sc = 1
      if (i === 0 && t >= 10.8) { alpha = t < 11.8 ? 0 : 1; sc = E.back(P(t, 11.8, 12.3)) }
      const on = (t >= 2.2 && t < 5.8 && i === 0) || (t >= 7 && t < 10.8) || (t >= 11.8 && i === 0)
      const lp = i === 0 ? E.out(P(t, 2.2, 2.7)) : E.out(P(t, 7, 7.5))
      if (lp > 0 && alpha > 0 && t < 10.8) partialLine(1420, 380, x, 494, lp, hexA(on ? COL : C.text, on ? .7 : .2), on ? 2.5 : 1.5)
      if (on && t < 10.8) travel(1420, 380, x, 494, P(t, i === 0 && t < 5.8 ? 2.2 : 7, (i === 0 && t < 5.8 ? 2.2 : 7) + .6), COL)
      if (alpha > 0) pod(x, 540, 84, { state: 'run', label: `redis-${i}`, alpha: alpha * a, scale: sc })
      withA(a, () => {
        chip(`redis-${i}.redis`, x, 636, { size: 18, col: COL, solid: on })
        if (i === 0 && t >= 11.8) {
          const k = E.out(P(t, 12.2, 12.6))
          txt(IPS[0], x, 686, { size: 18, font: MONO, color: C.mute, align: 'center', alpha: 1 - k })
          chip('10.244.2.9', x, 682, { size: 18, col: C.amber, alpha: k })
        } else if (!(i === 0 && t >= 10.8)) txt(IPS[i], x, 686, { size: 18, font: MONO, color: C.body, align: 'center' })
      })
    })
    poof(1180, 540, P(t, 10.8, 11.8), C.green)
    // 从节点按名字连主节点
    const rp = E.out(P(t, 12.8, 13.4))
    if (rp > 0) {
      curve(1420, 704, 1196, 708, -40, rp, hexA(C.violet, .75), 2, { dash: [7, 6] })
      curve(1660, 704, 1210, 714, -80, rp, hexA(C.violet, .75), 2, { dash: [7, 6] })
      withA(rp, () => txt('--replicaof redis-0.redis', 1540, 786, { size: 18, font: MONO, color: C.violet, align: 'center' }))
    }
    withA(E.out(P(t, 13.4, 13.9)), () => {
      check(1100, 830, 26, C.green, 1)
      txt('稳定的是名字，不是 IP', 1130, 838, { size: 24, color: C.text, weight: 600 })
    })
  },
}

// ---------- 场景 3：OrderedReady vs Parallel ----------
const X0 = 520, X1 = 1760, TMAX = 30
const tx = s => X0 + s / TMAX * (X1 - X0)
const order = {
  name: 'OrderedReady vs Parallel', dur: 16, mood: 3,
  vo: [[0.6, '默认 OrderedReady：前一个 Ready 才建下一个。'],
    [5.8, 'Parallel 同时创建，适合彼此独立的副本。'],
    [10.8, '它只影响扩缩容，而且创建后不能修改。']],
  cues: [[0.4, 'whoosh'], [1.4, 'pop'], [2.5, 'ok'], [3.8, 'ok'], [5.1, 'ok'], [6.2, 'pop'], [7.3, 'ok'], [7.6, 'chime'], [11.0, 'tick'], [11.6, 'tick'], [12.2, 'lock']],
  draw(t) {
    heading('podManagementPolicy：有序还是并行', 140, 210, t, .2, { eyebrow: 'POD MANAGEMENT', color: COL })
    const sim1 = clamp((t - 1.2) / 4.4) * 27, sim2 = clamp((t - 6) / 4.4) * 27
    ;[['OrderedReady', '默认 · 依次启动', 290, sim1, true, 1], ['Parallel', '同时启动', 580, sim2, false, 5.8]].forEach(([n, s, y, sim, ord, t0]) => {
      const a = E.out(P(t, t0 - .2, t0 + .3)); if (a <= 0) return
      withA(a, () => {
        panel(140, y, 1640, 260, { r: 18, stroke: (ord ? t < 5.8 : t >= 5.8 && t < 10.8) ? COL : C.hair, lw: 2 })
        chip(n, 170, y + 44, { size: 22, col: COL, solid: ord ? t < 5.8 : t >= 5.8 && t < 10.8, align: 'left' })
        txt(s, 170, y + 96, { size: 20, color: C.mute })
        for (let i = 0; i < 3; i++) {
          const ry = y + 70 + i * 62
          txt(`redis-${i}`, X0 - 24, ry + 7, { size: 20, font: MONO, align: 'right', color: C.text })
          ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.035)'; rr(X0, ry - 20, X1 - X0, 40, 10); ctx.fill(); ctx.restore()
          const st = ord ? i * 8 : 0, rd = st + 8
          if (sim > st) {
            const e = Math.min(sim, rd)
            ctx.save(); ctx.fillStyle = tint(C.amber, .25); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; rr(tx(st), ry - 20, tx(e) - tx(st), 40, 10); ctx.fill(); ctx.stroke(); ctx.restore()
            if (tx(e) - tx(st) > 110) txt('启动中', tx(st) + 14, ry + 6, { size: 17, color: C.amber })
            if (sim > rd) {
              const e2 = Math.min(sim, TMAX)
              ctx.save(); ctx.fillStyle = tint(C.green, .22); ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; rr(tx(rd), ry - 20, tx(e2) - tx(rd), 40, 10); ctx.fill(); ctx.stroke(); ctx.restore()
              check(tx(rd) + 22, ry, 20, C.green, clamp((sim - rd) / 1.2))
              if (tx(e2) - tx(rd) > 140) txt('Ready', tx(rd) + 42, ry + 6, { size: 17, color: C.green, font: MONO })
            }
          }
          // 等待箭头
          if (ord && i > 0 && sim > st) { withA(clamp((sim - st) / 1.5), () => arrow(tx(st), ry - 42, tx(st), ry - 22, 1, hexA(COL, .7), 2)) }
        }
        if (sim > 0 && sim < 27) line(tx(sim), y + 36, tx(sim), y + 240, hexA(C.text, .25), 2, [6, 6])
      })
    })
    // 总耗时对比
    chip('全部 Ready ≈ 24s', 170, 440, { size: 18, col: C.amber, font: SANS, align: 'left', alpha: E.out(P(t, 5.2, 5.6)) })
    chip('全部 Ready ≈ 8s', 170, 730, { size: 18, col: C.green, font: SANS, align: 'left', alpha: E.out(P(t, 7.4, 7.8)) })
    // 注意事项
    ;[['缩容反序：2 → 1 → 0', C.body], ['不影响滚动更新', C.body], ['创建后不可修改', C.red]].forEach(([s, c], i) => {
      chip(s, 140 + i * 300, 876, { size: 20, col: c, font: SANS, align: 'left', solid: i === 2, alpha: E.out(P(t, 11 + i * .6, 11.4 + i * .6)) })
    })
  },
}

// ---------- 场景 4：扩缩容与 PVC 保留 ----------
const PX = [360, 660, 960, 1260, 1560]
// 每个序号的 Pod 存在区间
const LIFE = [[[0, 99]], [[0, 99]], [[0, 7.6], [11.4, 99]], [[2.2, 6.8], [12.2, 99]], [[3.2, 6.0], [13.0, 99]]]
const scale = {
  name: '扩缩容与 PVC', dur: 16, mood: 2,
  vo: [[0.6, '扩容按序号依次创建，每个副本一份 PVC。'],
    [5.4, '缩容从大序号删起，PVC 默认保留。'],
    [10.8, '再次扩容，Pod 会挂回原来的 PVC。']],
  cues: [[0.4, 'whoosh'], [1.4, 'tick'], [2.2, 'pop'], [3.2, 'pop'], [5.4, 'tick'], [6.0, 'poof'], [6.8, 'poof'], [7.6, 'poof'], [8.2, 'lock'], [10.8, 'tick'], [11.4, 'pop'], [12.2, 'pop'], [13.0, 'pop'], [13.6, 'chime']],
  draw(t) {
    heading('volumeClaimTemplates：扩缩容与 PVC', 140, 210, t, .2, { eyebrow: 'SCALE & RETAIN', color: COL })
    const rep = t < 1.4 ? 3 : t < 5.4 ? 5 : t < 10.8 ? 2 : 5
    chip(`replicas: ${rep}`, 1780, 240, { size: 22, col: COL, solid: true, align: 'right', alpha: E.out(P(t, .6, 1)) })
    PX.forEach((x, i) => {
      const segs = LIFE[i]
      const born = segs[0][0]
      const bA = E.out(P(t, i < 3 ? .6 + i * .2 : born, (i < 3 ? .6 + i * .2 : born) + .4))
      // 空槽
      withA(E.out(P(t, .4, .8)), () => {
        ctx.save(); ctx.strokeStyle = hexA(C.text, .12); ctx.lineWidth = 2; ctx.setLineDash([6, 6]); rr(x - 120, 300, 240, 460, 18); ctx.stroke(); ctx.restore()
        txt(`序号 ${i}`, x, 334, { size: 18, color: C.mute, align: 'center' })
      })
      let alive = false, since = 0, died = -1
      segs.forEach(([a, b]) => { if (t >= a && t < b) { alive = true; since = a } if (t >= b && b < 99) died = b })
      if (alive) {
        const k = i < 3 && since === 0 ? E.back(P(t, .6 + i * .2, 1 + i * .2)) : E.back(P(t, since, since + .5))
        pod(x, 440, 92, { state: 'run', label: `redis-${i}`, scale: k, alpha: clamp(k) })
        const lk = since === 0 ? 1 : E.out(P(t, since + .4, since + .8))
        partialLine(x, 528, x, 612, lk * bA, hexA(C.teal, .7), 2.5)
      } else if (died > 0) poof(x, 440, P(t, died, died + 1), C.green)
      // PVC：一旦创建就一直存在
      if (t >= born || i < 3) {
        const orphan = !alive && t >= born
        cylinder(x, 644, 120, 42, orphan ? C.amber : C.teal, `data-redis-${i}`, bA * (orphan ? .75 : 1))
        if (orphan && died > 0) chip('保留', x, 752, { size: 18, col: C.amber, font: SANS, alpha: E.out(P(t, died + .6, died + 1)) })
        if (alive && since > 10) chip('挂回', x, 752, { size: 18, col: C.green, font: SANS, alpha: E.out(P(t, since + .6, since + 1)) })
      }
    })
    // 命令
    const cmd = t < 5.4 ? '--replicas=5' : t < 10.8 ? '--replicas=2' : '--replicas=5'
    withA(E.out(P(t, 1.2, 1.6)), () => {
      panel(140, 800, 1640, 64, { r: 14, fill: '#fff' })
      txt('❯', 168, 841, { size: 22, font: MONO, color: C.blue })
      txt('kubectl scale statefulset redis ' + cmd, 198, 841, { size: 22, font: MONO, color: C.text })
      txt(t < 5.4 ? '依次创建 redis-3、redis-4' : t < 10.8 ? '先删 redis-4，再删 3、2' : 'Pod 找回同名 PVC', 1750, 841, { size: 20, color: C.mute, align: 'right' })
    })
    withA(E.out(P(t, 14, 14.5)), () => txt('persistentVolumeClaimRetentionPolicy · whenScaled / whenDeleted：Retain（默认）| Delete', 140, 896, { size: 18, font: MONO, color: C.body }))
  },
}

// ---------- 场景 5：滚动更新与分区 ----------
const RX = [560, 960, 1360]
// 每个 Pod 的换版时刻 [时刻, 新版本]
const UPD = [[[4.5, '7.4.1'], [14.0, '7.4.2']], [[3.7, '7.4.1'], [12.2, '7.4.2']], [[2.9, '7.4.1'], [9.5, '7.4.2']]]
const VC = { '7.4': C.blue, '7.4.1': C.violet, '7.4.2': C.teal }
const RU = [
  { t: .8, cmd: 'kubectl set image statefulset/redis redis=redis:7.4.1-alpine' },
  { t: 6.0, cmd: 'kubectl patch statefulset redis --type merge --patch-file partition-patch.yaml' },
  { t: 8.0, cmd: 'kubectl set image statefulset/redis redis=redis:7.4.2-alpine' },
  { t: 11.4, out: '# redis-2 观察无误后：partition 调到 1，再调到 0', color: C.mute },
]
const rolling = {
  name: '滚动更新与分区', dur: 16, mood: 3,
  vo: [[0.6, '滚动更新从最大序号开始：2、1、0。'],
    [5.8, '设 partition 为 2，只有 redis-2 先升级。', '设 partition 为 2，只有 redis 2 先升级。'],
    [11.2, '观察无误，再把 partition 调到 1、0。']],
  cues: [[0.4, 'whoosh'], ...typeCues(RU, 45), ...UPD.flat().map(([a]) => [a, 'poof']), ...UPD.flat().map(([a]) => [a + .5, 'pop']), [7.0, 'lock'], [11.8, 'whoosh'], [13.6, 'whoosh'], [15.0, 'chime']],
  draw(t) {
    heading('RollingUpdate 与 partition', 140, 210, t, .2, { eyebrow: 'UPDATE STRATEGY', color: COL })
    RX.forEach((x, i) => {
      const a = E.out(P(t, .5 + i * .15, .9 + i * .15)); if (a <= 0) return
      let v = '7.4', last = -9
      UPD[i].forEach(([ut, nv]) => { if (t >= ut + .5) v = nv; if (t >= ut) last = ut })
      const gone = t >= last && t < last + .5
      poof(x, 420, P(t, last, last + .9), VC[v])
      if (!gone) pod(x, 420, 104, { state: VC[v], label: `redis-${i}`, alpha: a, scale: last > 0 ? E.back(P(t, last + .5, last + 1)) : 1 })
      withA(a, () => {
        chip(i ? 'replica' : 'master', x, 290, { size: 16, col: i ? C.mute : COL })
        chip(`redis:${v}-alpine`, x, 548, { size: 20, col: VC[v], solid: t >= last + .5 && t < last + 1.6 })
      })
    })
    // 滚动顺序
    const oa = E.out(P(t, 2.9, 3.3)) * (1 - E.out(P(t, 6, 6.4)))
    withA(oa, () => {
      arrow(1300, 596, 620, 596, clamp((t - 2.9) / 2.2), hexA(C.violet, .7), 2.5)
      txt('2 → 1 → 0：先从节点，最后主节点', 960, 628, { size: 20, color: C.violet, align: 'center' })
    })
    // partition 分隔线
    const part = t < 11.8 ? 2 : t < 13.6 ? 1 : 0
    const pa = E.out(P(t, 7, 7.5))
    if (pa > 0) {
      const target = [360, 760, 1160][part]
      const prev = [360, 760, 1160][Math.min(2, part + 1)]
      const mv = part === 2 ? 1 : E.inOut(P(t, part === 1 ? 11.8 : 13.6, (part === 1 ? 11.8 : 13.6) + .6))
      const px = lerp(prev, target, mv)
      withA(pa, () => {
        ctx.save(); ctx.fillStyle = hexA(C.teal, .07); rr(px, 330, 1560 - px, 260, 16); ctx.fill(); ctx.restore()
        line(px, 320, px, 600, C.teal, 3, [8, 6])
        chip(`partition: ${part}`, px, 610, { size: 20, col: C.teal, solid: true })
        txt('序号 ≥ partition 才更新', 1580, 612, { size: 18, color: C.teal, align: 'right' })
      })
    }
    terminal(140, 650, 1640, 230, t, RU, { size: 20, cps: 45, alpha: E.out(P(t, .4, .8)) })
  },
}

ANIM({
  id: 'statefulsets',
  meta: { stage: 2, lesson: 3, of: 7, title: 'StatefulSet 与有状态应用', summary: '稳定的网络标识和存储，部署一个多副本数据库。', next: 'Job、CronJob 与 DaemonSet' },
  scenes: [
    lessonIntro({ tags: ['Headless Service', 'volumeClaimTemplates', 'OrderedReady', 'partition'], vo: [[3.2, '数据库的每个副本，都有自己的名字和数据。']] }),
    identity, headless, order, scale, rolling,
    lessonOutro({
      points: ['名字、DNS、PVC 都跟着序号走', 'Headless Service：稳定的是名字不是 IP', 'OrderedReady 依次启动，缩容 PVC 默认保留', '从大序号滚动更新，partition 做金丝雀'],
      vo: [[0.8, '小结：StatefulSet 给副本稳定的身份。'], [5.6, '下一课，一次性任务与守护进程。']],
    }),
  ],
})
})()
