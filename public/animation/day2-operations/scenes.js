/* 第 4 阶段 · 第 7 课：Day-2 运维：升级、扩容与 etcd 维护 */
(() => {
const COL = STAGES[4].color
const bk = p => p <= 0 ? 0 : E.back(p)

// 场景 1：版本跳跃规则
const LANES = [
  ['K8s', '控制平面逐个小版本', ['1.33', '1.34', '1.35'], C.blue, '不能跳小版本'],
  ['Kubespray', '按 release tag 逐个', ['2.29', '2.30', '2.31'], C.violet, '逐个 release 升级'],
  ['etcd', '组件自己的升级路径', ['3.5.x', '3.5.26', '3.6.10'], C.teal, '大版本 · 升前快照'],
]
const LX = [660, 1020, 1380], LY = [370, 480, 590]
const stepT = (i, k) => 1.4 + i * .3 + k * 1.1
const SKX = v => 300 + (v - 31) * 192
const skew = {
  name: '版本规则', dur: 17, mood: 1,
  vo: [[0.5, '升级有三层版本规则，同时生效。'],
    [4.2, '1.33 不能直接到 1.35，Kubespray 同理。'],
    [8.6, 'etcd 先停在 3.5.26，再升 3.6。'],
    [12.4, 'kubelet 不能比 apiserver 新，先升控制平面。']],
  cues: [[0.4, 'whoosh'], ...[0, 1, 2].map(i => [0.8 + i * .25, 'pop']), ...[0, 1, 2].flatMap(i => [0, 1].map(k => [stepT(i, k), 'tick'])),
    [4.4, 'whoosh'], [5.2, 'error'], [5.6, 'whoosh'], [6.4, 'error'], [8.8, 'ding2'], [12.3, 'pop'], [12.7, 'pop'], [13.2, 'ding3'], [14.2, 'error'], [15.0, 'pop'], [15.4, 'ok']],
  draw(t) {
    heading('升级：不能跳版本', 140, 210, t, .2, { eyebrow: 'UPGRADE PATH', color: COL })
    const cur = t < 4.2 ? -1 : t < 5.4 ? 0 : t < 8.6 ? 1 : t < 12.2 ? 2 : -1
    LANES.forEach(([n, sub, vs, c, note], i) => {
      const a = E.out(P(t, .7 + i * .25, 1.2 + i * .25)); if (a <= 0) return
      const y = LY[i], on = cur === i
      withA(a * (cur < 0 || on ? 1 : .45), () => {
        panel(140, y - 42, 1640, 84, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        txt(n, 172, y - 2, { size: 26, weight: 600 })
        txt(sub, 172, y + 26, { size: 16, color: C.mute })
        for (let k = 0; k < 2; k++) {
          const ts = stepT(i, k)
          arrow(LX[k] + 64, y, LX[k + 1] - 64, y, E.out(P(t, ts, ts + .5)), hexA(c, .5), 2.5)
          travel(LX[k] + 64, y, LX[k + 1] - 64, y, P(t, ts, ts + .6), c, 6)
        }
        vs.forEach((v, k) => {
          const reached = k === 0 || t >= stepT(i, k - 1) + .6
          chip(v, LX[k], y, { size: 24, col: c, solid: reached, alpha: reached ? 1 : .5 })
        })
        withA(E.out(P(t, 3.8 + i * .15, 4.2 + i * .15)), () => txt(note, 1480, y + 7, { size: 20, color: C.body }))
      })
    })
    // 跳版本：红色虚线弧 + 叉
    ;[[0, 4.4], [1, 5.6]].forEach(([i, t0]) => {
      const y = LY[i] - 22, p = E.out(P(t, t0, t0 + .7)); if (p <= 0) return
      withA(1 - P(t, 8.3, 8.8), () => {
        curve(LX[0] + 10, y, LX[2] - 10, y, -80, p, C.red, 2.5, { dash: [8, 6] })
        if (t >= t0 + .8) { ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(LX[1], y - 40, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore(); cross(LX[1], y - 40, 20, C.red, E.out(P(t, t0 + .8, t0 + 1))) }
      })
    })
    // etcd 必须停留在 3.5.26
    const ha = bk(P(t, 8.8, 9.3))
    if (ha > 0) {
      ring(LX[1], LY[2], P(t, 8.8, 9.9), COL, 110)
      withA(clamp(ha), () => chip('先停留 · 3.5.26+', 1200, LY[2], { size: 17, font: SANS, col: COL, solid: true }))
    }
    // 版本偏差
    const sa = E.out(P(t, 11.6, 12.1))
    withA(sa, () => {
      panel(140, 664, 1640, 212, { r: 18 })
      txt('版本偏差策略 · Version Skew Policy', 172, 704, { size: 18, color: C.mute })
      line(SKX(31) - 40, 800, SKX(36) + 40, 800, C.hairD, 2)
      for (let v = 31; v <= 36; v++) { line(SKX(v), 792, SKX(v), 808, C.hairD, 2); txt('1.' + v, SKX(v), 842, { size: 18, font: MONO, color: v === 36 ? C.red : C.mute, align: 'center' }) }
    })
    const bp = E.out(P(t, 13.2, 14.0))
    if (bp > 0) {
      const w = (SKX(35) - SKX(32)) * bp
      ctx.save(); ctx.fillStyle = tint(C.green, .35); rr(SKX(35) - w, 791, w, 18, 9); ctx.fill(); ctx.restore()
      withA(bp, () => txt('kubelet 可以旧 ≤ 3 个小版本', (SKX(32) + SKX(35)) / 2, 764, { size: 20, color: C.green, align: 'center' }))
    }
    const apa = bk(P(t, 12.7, 13.2))
    if (apa > 0) withA(clamp(apa), () => { dot(SKX(35), 800, 9, C.blue, 10); chip('apiserver 1.35', SKX(35), 752, { size: 18, col: C.blue, solid: true }) })
    const na = E.out(P(t, 14.2, 14.6))
    withA(na, () => { cross(SKX(36), 800, 22, C.red, 1); txt('kubelet 不能更新', SKX(36), 764, { size: 18, color: C.red, align: 'center' }) })
    const oa = E.out(P(t, 15.0, 15.5))
    box(1600, 724, 300, 64, '① 控制平面 + etcd', null, C.blue, { size: 22, alpha: oa, hi: t >= 15 })
    arrow(1600, 758, 1600, 788, E.out(P(t, 15.3, 15.6)), hexA(C.text, .35), 2.5)
    box(1600, 822, 300, 64, '② 工作节点', null, C.green, { size: 22, alpha: E.out(P(t, 15.4, 15.9)) })
  },
}

// 场景 2：分阶段升级
const CPN = ['mn-192-168-3-21', 'mn-192-168-3-22', 'mn-192-168-3-23']
const WKN = Array.from({ length: 10 }, (_, i) => 'gn-192-168-1-' + (11 + i))
const cpT = i => 3.0 + i * 1.3
const wkT = i => 10.6 + Math.floor(i / 2) * 1.0
const RL = [
  { t: .8, cmd: 'ansible-playbook -i inventory.ini -b upgrade-cluster.yml --limit "kube_control_plane:etcd"' },
  { t: 7.3, out: 'PLAY RECAP  mn-192-168-3-2[1:3]  ok=512  changed=87  unreachable=0  failed=0', color: C.green },
  { t: 8.4, cmd: 'ansible-playbook -i inventory.ini -b upgrade-cluster.yml --limit "gn-192-168-1-1*:gn-192-168-1-2*"' },
]
function mini(x, y, name, t0, t, a, busy) {
  const st = t < t0 ? 0 : t < t0 + .7 ? 1 : 2
  const c = st === 2 ? C.green : st === 1 ? COL : C.mute
  withA(a, () => {
    panel(x, y, 176, 124, { r: 12, shadow: false, stroke: st ? c : C.hair, lw: st ? 2 : 1.5, fill: st === 1 ? tint(COL, .08) : st === 2 ? tint(C.green, .05) : '#ffffff' })
    txt(name, x + 88, y + 32, { size: 16, font: MONO, color: C.text, align: 'center' })
    chip(st === 2 ? 'v1.35.4' : 'v1.34', x + 88, y + 70, { size: 18, col: c, solid: st === 2 })
    txt(st === 1 ? busy : 'Ready', x + 88, y + 110, { size: 16, color: st === 1 ? COL : st === 2 ? C.green : C.mute, align: 'center' })
  })
  if (st === 2) ring(x + 88, y + 62, P(t, t0 + .7, t0 + 1.3), C.green, 54)
}
const rolling = {
  name: '分阶段升级', dur: 16, mood: 2,
  vo: [[0.6, '生产上分阶段升级，每步确认健康。'],
    [4.6, '第一步只升 etcd 和控制平面，逐台进行。'],
    [8.8, '第二步分批升工作节点，每批 20%。', '第二步分批升工作节点，每批两成。'],
    [12.6, '每台先 drain，升完再恢复调度。']],
  cues: [[0.4, 'whoosh'], ...typeCues(RL, 50), ...[0, 1, 2].flatMap(i => [[cpT(i), 'tick'], [cpT(i) + .7, 'ding' + i]]), [7.3, 'ok'],
    ...[0, 1, 2, 3, 4].flatMap(b => [[wkT(b * 2), 'tick'], [wkT(b * 2) + .7, 'pop']]), [15.4, 'chime']],
  draw(t) {
    heading('分阶段升级：先控制平面，再分批工作节点', 140, 210, t, .2, { eyebrow: 'ROLLING UPGRADE', color: COL })
    terminal(140, 280, 1640, 190, t, RL, { size: 20, cps: 50, alpha: E.out(P(t, .4, .8)) })
    const ca = E.out(P(t, 1.0, 1.5)), stage1 = t >= 2.8 && t < 8.4
    withA(ca, () => {
      panel(140, 500, 600, 370, { r: 18, stroke: stage1 ? C.blue : C.hair, lw: stage1 ? 2.5 : 1.5, fill: stage1 ? tint(C.blue, .04) : C.panel })
      txt('① 控制平面 + etcd · 逐台', 168, 542, { size: 20, weight: 600 })
    })
    CPN.forEach((n, i) => mini(160 + i * 196, 570, n, cpT(i), t, ca, '升级中'))
    withA(E.out(P(t, 3.2, 3.7)) * ca, () => txt('一台 Ready 了才动下一台', 168, 750, { size: 20, color: C.body }))
    withA(E.out(P(t, 7.3, 7.8)), () => chip('etcd endpoint health --cluster  ✓', 168, 808, { size: 17, align: 'left', col: C.green }))
    const wa = E.out(P(t, 1.3, 1.8)), stage2 = t >= 8.4
    withA(wa * (stage2 ? 1 : .55), () => {
      panel(780, 500, 1000, 370, { r: 18, stroke: stage2 ? C.green : C.hair, lw: stage2 ? 2.5 : 1.5, fill: stage2 ? tint(C.green, .03) : C.panel })
      txt('② 工作节点 · serial: 20%（每批 2 台）', 808, 542, { size: 20, weight: 600 })
    })
    WKN.forEach((n, i) => mini(800 + (i % 5) * 196, 570 + Math.floor(i / 5) * 146, n, wkT(i), t, wa * (stage2 ? 1 : .55), 'drain · 升级'))
  },
}

// 场景 3：drain 与 PDB
const DL = [
  { t: .8, cmd: 'kubectl drain gn-192-168-1-11 --ignore-daemonsets --delete-emptydir-data' },
  { t: 2.8, out: 'node/gn-192-168-1-11 cordoned', color: COL },
  { t: 4.8, out: 'evicting pod default/web-a', color: C.body },
  { t: 6.8, out: 'evicting pod default/web-b', color: C.body },
  { t: 8.6, out: 'node/gn-192-168-1-11 drained', color: C.green, sfx: 'ok' },
]
function podStat(t) {
  if (t >= 13.6) return [3, 1]
  if (t >= 9.4) return [3, 0]
  if ((t >= 4.8 && t < 6.2) || (t >= 6.8 && t < 8.2)) return [2, 0]
  return [3, 1]
}
const drain = {
  name: 'drain 与 PDB', dur: 17, mood: 3,
  vo: [[0.6, 'drain 先 cordon，再逐个驱逐 Pod。'],
    [4.4, 'PDB 要求至少 2 个可用，一次只能驱逐一个。'],
    [9.4, 'minAvailable 等于副本数，drain 就永远卡住。', 'min available 等于副本数，drain 就永远卡住。'],
    [13.6, 'PDB 要留余量，维护完再 uncordon。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DL, 40), [2.8, 'lock'], [4.8, 'poof'], [5.7, 'pop'], [6.2, 'ok'], [6.8, 'poof'], [7.7, 'pop'], [8.2, 'ok'],
    [9.4, 'alarmSoft'], [10.4, 'error'], [11.4, 'tick'], [12.4, 'tick'], [13.6, 'chime'], [14.0, 'ok']],
  draw(t) {
    heading('drain 与 PodDisruptionBudget', 140, 210, t, .2, { eyebrow: 'NODE MAINTENANCE', color: COL })
    terminal(140, 280, 1000, 236, t, DL, { size: 19, cps: 40, alpha: E.out(P(t, .4, .8)) })
    // PDB
    const mv = t >= 9.4 && t < 13.6 ? 3 : 2
    const hc = mv === 3 ? C.red : t >= 13.6 ? C.green : COL
    code(1180, 280, 600, ['kind: PodDisruptionBudget', 'spec:', `  minAvailable: ${mv}`, '  selector: {matchLabels: {app: web}}'], t, 3.6,
      { title: 'web-pdb.yaml', size: 19, lh: 30, alpha: E.out(P(t, 3.4, 3.9)), hi: (t >= 4.4 && t < 6.8) || t >= 9.4 ? [2] : [], hiColor: hc })
    const [av, al] = podStat(t)
    chip(`可用 ${av}/3 · ALLOWED DISRUPTIONS ${al}`, 1480, 534, { size: 18, font: SANS, col: al ? C.green : C.red, alpha: E.out(P(t, 4.2, 4.6)) })
    // 节点
    const na = E.out(P(t, .9, 1.4))
    node(140, 590, 440, 280, 'gn-192-168-1-11', { alpha: na })
    node(620, 590, 440, 280, 'gn-192-168-1-12', { alpha: na })
    const cord = t >= 2.8 && t < 13.6
    withA(na, () => {
      if (cord) panel(140, 590, 440, 280, { r: 14, fill: 'rgba(0,0,0,0)', stroke: COL, lw: 2.5, dash: [10, 8], shadow: false })
      chip(cord ? 'SchedulingDisabled' : 'Ready', 568, 610, { size: 16, align: 'right', pad: 8, col: cord ? COL : C.green, solid: t >= 13.6 })
      chip('Ready', 1048, 610, { size: 16, align: 'right', pad: 8, col: C.green })
    })
    if (cord) ring(360, 730, P(t, 2.8, 3.8), COL, 200)
    const sub = (s, x, c) => txt(s, x, 806, { size: 16, color: c || C.mute, align: 'center', alpha: na })
    // node 11
    ;[['web-a', 230, 4.8], ['web-b', 360, 6.8]].forEach(([n, x, te]) => {
      if (t < te) { pod(x, 720, 70, { state: 'run', label: n, alpha: na }); sub('Running', x, C.green) }
      else poof(x, 720, P(t, te, te + .6), C.green)
    })
    pod(490, 720, 70, { state: 'idle', label: 'cilium', alpha: na }); sub('DaemonSet · 跳过', 490)
    // 迁移
    ;[[230, 840, 4.9], [360, 970, 6.9]].forEach(([x1, x2, t0]) => travelPath([[x1, 700], [x1, 660], [x2, 660], [x2, 700]], P(t, t0, t0 + .8), C.green, 7))
    // node 12
    pod(710, 720, 70, { state: 'run', label: 'web-c', alpha: na }); sub('Running', 710, C.green)
    ;[['web-d', 840, 5.7, 6.2], ['web-e', 970, 7.7, 8.2]].forEach(([n, x, ta, tr]) => {
      const k = bk(P(t, ta, ta + .4)); if (k <= 0) return
      pod(x, 720, 70, { state: t < tr ? 'pending' : 'run', label: n, scale: clamp(k, 0, 1.2) })
      sub(t < tr ? 'Pending' : 'Running', x, t < tr ? COL : C.green)
      if (t >= tr) ring(x, 720, P(t, tr, tr + .8), C.green, 80)
    })
    // 维护中 / uncordon
    const ma = E.out(P(t, 9.0, 9.4))
    if (t < 13.6) chip('维护中：内核 / 驱动', 295, 720, { size: 18, font: SANS, col: COL, alpha: ma })
    else chip('uncordon · 恢复调度', 295, 720, { size: 18, font: SANS, col: C.green, solid: true, alpha: bk(P(t, 13.6, 14.0)) })
    // minAvailable = 副本数：永远卡住
    const fa = E.out(P(t, 9.6, 10.1)) * lerp(1, .35, P(t, 13.6, 14.1))
    withA(fa, () => {
      panel(1140, 590, 640, 280, { r: 16, stroke: hexA(C.red, .6), lw: 2, fill: tint(C.red, .04) })
      txt('若 minAvailable = 副本数 3', 1168, 634, { size: 20, weight: 600, color: C.red })
      const ph = t >= 10.4 ? (t - 10.4) % 1 : 1
      for (let k = 0; k < 3; k++) pod(1204 + k * 82, 706, 52, { state: 'run', shake: k === 0 && ph < .4 && t < 13.6 ? Math.sin(t * 70) * 5 * (1 - ph / .4) : 0 })
      if (t >= 10.4 && t < 13.6) cross(1204, 664, 18, C.red, 1 - ph)
      chip('ALLOWED DISRUPTIONS 0', 1440, 706, { size: 17, col: C.red, solid: true, align: 'left' })
      wrap("Cannot evict pod as it would violate the pod's disruption budget.", 1168, 780, 590, { size: 17, font: MONO, color: C.red, lh: 26 })
      const n = t >= 10.4 ? Math.min(4, Math.floor(t - 10.4) + 1) : 0
      txt(`drain 重试中 ×${n}`, 1752, 848, { size: 16, color: C.mute, align: 'right' })
    })
  },
}

// 场景 4：etcd 快照
const BL = [
  { t: .9, cmd: 'set -a && source /etc/etcd.env && set +a' },
  { t: 4.6, cmd: 'etcdctl snapshot save /backup/etcd-$(date +%Y%m%d-%H%M).db' },
  { t: 6.6, out: 'Snapshot saved at /backup/etcd-20260923-0300.db', color: C.green },
  { t: 7.2, cmd: 'etcdutl snapshot status /backup/etcd-20260923-0300.db -w table' },
  { t: 9.3, out: 'HASH 5c3a9e1f · REVISION 1842137 · TOTAL KEYS 3120 · SIZE 96 MB', color: C.body },
]
const backup = {
  name: 'etcd 快照', dur: 15, mood: 2,
  vo: [[0.6, '先加载 /etc/etcd.env 里的连接参数。', '先加载 etcd.env 文件里的连接参数。'],
    [4.6, 'snapshot save 在一个健康成员上做。', '快照只需在一个健康成员上做。'],
    [8.8, '备份要拷到集群外，保留多份。'],
    [12.0, '没恢复过的备份，不算备份。']],
  cues: [[0.4, 'whoosh'], ...typeCues(BL, 40), ...[0, 1, 2, 3].map(k => [1.6 + k * .2, 'pop']), [5.0, 'whoosh'], [6.6, 'ok'], [8.8, 'whoosh'], [9.3, 'pop'], [9.6, 'pop'], [10.0, 'pop'], [12.0, 'pop'], [12.5, 'chime']],
  draw(t) {
    heading('etcd 快照：备份并拷到集群外', 140, 210, t, .2, { eyebrow: 'BACKUP', color: COL })
    terminal(140, 280, 1100, 262, t, BL, { size: 20, cps: 40, alpha: E.out(P(t, .4, .8)) })
    const ea = E.out(P(t, 1.3, 1.8)), eon = t >= 1.3 && t < 4.6
    withA(ea, () => {
      panel(1280, 280, 500, 262, { r: 14, stroke: eon ? C.teal : C.hair, lw: eon ? 2.5 : 1.5, fill: eon ? tint(C.teal, .04) : C.panel })
      txt('/etc/etcd.env', 1308, 322, { size: 18, font: MONO, color: C.mute })
      line(1280, 342, 1780, 342, C.hair, 1)
      txt('set -a：全部导出', 1752, 427, { size: 18, color: C.mute, align: 'right' })
    })
    ;['ETCDCTL_ENDPOINTS', 'ETCDCTL_CACERT', 'ETCDCTL_CERT', 'ETCDCTL_KEY'].forEach((s, k) =>
      chip(s, 1308, 378 + k * 44, { size: 18, align: 'left', col: C.teal, alpha: E.out(P(t, 1.6 + k * .2, 2.0 + k * .2)) }))
    // 健康成员 → 快照文件
    const ma = E.out(P(t, 2.6, 3.1))
    cylinder(300, 710, 150, 100, C.teal, 'mn-192-168-3-21', ma)
    chip('健康成员', 300, 604, { size: 16, font: SANS, col: C.green, alpha: ma })
    arrow(385, 710, 560, 710, E.out(P(t, 5.0, 5.6)), hexA(C.teal, .6), 2.5)
    travel(385, 710, 560, 710, P(t, 5.0, 6.6), C.teal)
    doc(720, 710, 300, 130, 'etcd-20260923-0300.db', C.teal, { ext: 'snapshot', sub: '96 MB', size: 17, alpha: bk(P(t, 6.4, 6.9)) })
    // 集群外存储（多份）
    const sa = E.out(P(t, 8.8, 9.3))
    arrow(880, 710, 975, 710, sa, hexA(C.blue, .6), 2.5)
    travel(880, 710, 975, 710, P(t, 9.0, 9.8), C.blue)
    withA(sa * .6, () => { panel(985 + 16, 655 - 16, 290, 110, { r: 14, stroke: hexA(C.blue, .3), shadow: false }); panel(985 + 8, 655 - 8, 290, 110, { r: 14, stroke: hexA(C.blue, .4), shadow: false }) })
    box(1130, 710, 290, 110, '集群外存储', 'S3 / NAS · 保留多份', C.blue, { size: 26, alpha: sa, hi: t >= 8.8 && t < 12 })
    const w1 = chip('每天定时备份', 985, 846, { size: 18, font: SANS, align: 'left', col: C.blue, alpha: E.out(P(t, 9.6, 10)) })
    chip('升级 / 控制平面变更前额外备份', 985 + w1 + 14, 846, { size: 18, font: SANS, align: 'left', col: COL, alpha: E.out(P(t, 10.0, 10.4)) })
    // 恢复演练
    const ra = E.out(P(t, 12.0, 12.5))
    arrow(1285, 710, 1400, 710, ra, hexA(C.green, .6), 2.5)
    box(1580, 710, 340, 110, '恢复演练', '测试环境定期做', C.green, { size: 26, alpha: ra, hi: t >= 12 })
    check(1712, 690, 30, C.green, P(t, 12.5, 13.0))
  },
}

// 场景 5：compact、defrag 与配额
const GB = 940 / 2.4, BX = 170, QX = BX + 2 * GB, LIVE = .6
const MEM = [['mn-192-168-3-22', 'follower'], ['mn-192-168-3-23', 'follower'], ['mn-192-168-3-21', 'leader']]
const dfT = i => 9.2 + i * 1.0
const memSize = (i, t) => lerp(2.0, LIVE, E.inOut(P(t, dfT(i), dfT(i) + .8)))
const CT = [3.8, 5.4, 9.0, 13.0]
function dbBar(x, y, w, h, size, cp, frame) {
  const sc = w / 2.4
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; rr(x, y, w, h, 10); ctx.fill()
  ctx.fillStyle = tint(C.teal, .5); rr(x, y, LIVE * sc, h, 10); ctx.fill(); ctx.restore()
  const x1 = x + LIVE * sc + 3, w1 = (size - LIVE) * sc - 3
  if (w1 > 2) {
    withA(1 - cp, () => { ctx.save(); ctx.fillStyle = tint(C.body, .3); rr(x1, y, w1, h, 10); ctx.fill(); ctx.restore() })
    withA(cp, () => { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.025)'; ctx.strokeStyle = hexA(C.body, .5); ctx.lineWidth = 2; ctx.setLineDash([7, 6]); rr(x1 + 1, y + 1, w1 - 2, h - 2, 9); ctx.fill(); ctx.stroke(); ctx.restore() })
  }
  if (frame) { ctx.save(); ctx.strokeStyle = frame; ctx.lineWidth = 2.5; rr(x - 3, y - 3, size * sc + 6, h + 6, 12); ctx.stroke(); ctx.restore() }
}
const defrag = {
  name: '压缩与碎片整理', dur: 17, mood: 4,
  vo: [[0.6, 'etcd 数据库超过配额，就拒绝一切写入。'],
    [4.6, 'compact 丢旧版本，defrag 才还空间。'],
    [9.0, 'defrag 逐个成员，最后才是 leader。'],
    [13.0, '最后 alarm disarm，写入恢复。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], [1.4, 'pop'], [3.2, 'alarmSoft'], [3.6, 'error'], [3.8, 'pop'], [5.4, 'pop'], [5.6, 'whoosh'], [9.0, 'pop'],
    ...[0, 1, 2].flatMap(i => [[dfT(i), 'zap'], [dfT(i) + .8, 'ok']]), [13.0, 'pop'], [13.2, 'chime'], [14.4, 'pop']],
  draw(t) {
    heading('compact、defrag 与配额', 140, 210, t, .2, { eyebrow: 'ETCD MAINTENANCE', color: COL })
    const nospace = t >= 3.2 && t < 13.0
    const sz = t < 3.2 ? lerp(1.2, 2.0, E.inOut(P(t, .8, 3.2))) : Math.max(...MEM.map((_, i) => memSize(i, t)))
    const cp = E.inOut(P(t, 5.6, 6.6))
    const pa = E.out(P(t, .5, 1.0))
    withA(pa, () => {
      panel(140, 280, 1000, 230, { r: 18, stroke: nospace ? hexA(C.red, .6) : C.hair, lw: nospace ? 2 : 1.5, fill: nospace ? tint(C.red, .03) : C.panel })
      txt('etcd DB SIZE', 170, 324, { size: 18, font: MONO, color: C.mute, track: 2 })
      txt(`${sz.toFixed(1)} GB`, 1110, 326, { size: 26, font: MONO, weight: 600, align: 'right', color: nospace ? C.red : C.text })
      dbBar(BX, 350, 940, 52, sz, cp, nospace ? C.red : null)
      line(QX, 338, QX, 414, hexA(C.red, .75), 2.5, [6, 5])
      txt('quota 2GB', QX, 438, { size: 16, font: MONO, color: C.red, align: 'center' })
      ;[['当前数据', tint(C.teal, .5)], ['旧版本', tint(C.body, .3)], ['空闲 · 碎片', 'rgba(0,0,0,0.05)']].forEach(([s, c], k) => {
        const x = 170 + k * 150
        ctx.save(); ctx.fillStyle = c; rr(x, 426, 22, 14, 4); ctx.fill(); if (k === 2) { ctx.strokeStyle = hexA(C.body, .5); ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.stroke() } ctx.restore()
        txt(s, x + 30, 439, { size: 16, color: C.body })
      })
    })
    if (t >= 3.2 && t < 4.4) ring(QX, 376, P(t, 3.2, 4.2), C.red, 130)
    if (nospace) withA(E.out(P(t, 3.2, 3.6)), () => { chip('alarm: NOSPACE', 170, 482, { size: 17, align: 'left', col: C.red, solid: true }); txt('database space exceeded · 拒绝写入', 350, 488, { size: 17, font: MONO, color: C.red }) })
    else if (t >= 13.0) withA(bk(P(t, 13.0, 13.4)), () => { chip('写入恢复', 170, 482, { size: 17, font: SANS, align: 'left', col: C.green, solid: true }); check(300, 482, 22, C.green, P(t, 13.2, 13.6)) })
    withA(E.out(P(t, 6.4, 6.9)) * (1 - P(t, 9.0, 9.4)), () => txt('compact 后文件大小不变', 1110, 488, { size: 17, color: C.mute, align: 'right' }))
    // 命令
    const cur = CT.reduce((a, c, i) => t >= c ? i : a, -1)
    code(1180, 280, 600, ['etcdctl alarm list', 'etcdctl compact "$rev"', 'etcdctl defrag', 'etcdctl alarm disarm'].map((r, i) => t >= CT[i] ? r : ''), t, -9,
      { title: 'etcd 运维 · 已加载 /etc/etcd.env', size: 21, lh: 44, alpha: E.out(P(t, 1.0, 1.5)), hi: cur >= 0 ? [cur] : [], hiColor: [C.red, C.blue, COL, C.green][Math.max(0, cur)] })
    ;[['alarm:NOSPACE', C.red, MONO], ['集群级 · 执行一次', C.blue, SANS], ['按成员 · 逐个', COL, SANS], ['恢复写入', C.green, SANS]].forEach(([s, c, f], i) =>
      chip(s, 1756, 376 + i * 44 - 7, { size: 16, font: f, align: 'right', col: c, alpha: E.out(P(t, CT[i] + .2, CT[i] + .5)) }))
    // 成员逐个 defrag
    MEM.forEach(([n, role], i) => {
      const a = E.out(P(t, 4.8 + i * .12, 5.3 + i * .12)); if (a <= 0) return
      const x = 140 + i * 340, t0 = dfT(i), act = t >= t0 && t < t0 + .8, done = t >= t0 + .8
      withA(a, () => {
        panel(x, 560, 320, 200, { r: 16, stroke: act ? C.red : done ? hexA(C.green, .6) : C.hair, lw: act ? 2.5 : 1.5, fill: act ? tint(C.red, .04) : C.panel })
        txt(n, x + 22, 600, { size: 18, font: MONO })
        chip(role, x + 298, 594, { size: 16, align: 'right', col: role === 'leader' ? COL : C.mute, solid: role === 'leader' })
        dbBar(x + 22, 626, 276, 30, memSize(i, t), cp, null)
        txt(`${memSize(i, t).toFixed(1)} GB`, x + 22, 706, { size: 22, font: MONO, weight: 600, color: act ? C.red : done ? C.green : C.text })
        if (act) chip('defrag · 阻塞读写', x + 298, 698, { size: 16, font: SANS, align: 'right', col: C.red, solid: true })
        if (done) { check(x + 282, 698, 26, C.green, P(t, t0 + .8, t0 + 1.2)); txt('完成', x + 262, 704, { size: 18, color: C.green, align: 'right' }) }
        txt(`第 ${i + 1} 个`, x + 22, 742, { size: 16, color: C.mute })
      })
    })
    withA(E.out(P(t, 9.6, 10.1)), () => txt('逐个成员执行：先 follower，最后 leader · 业务低峰期', 140, 816, { size: 20, color: C.body }))
    // 配额与自动 compact
    const qa = E.out(P(t, 1.4, 1.9))
    withA(qa, () => {
      panel(1180, 580, 600, 290, { r: 16 })
      txt('--quota-backend-bytes', 1208, 624, { size: 20, font: MONO, color: C.blue })
      txt('默认 2GB · 官方建议 ≤ 8GB', 1208, 662, { size: 22, color: C.text })
      line(1208, 690, 1752, 690, C.hair, 1)
    })
    withA(E.out(P(t, 7.0, 7.5)), () => txt('apiserver 每 5 分钟自动 compact', 1208, 734, { size: 20, color: C.text }))
    withA(E.out(P(t, 10.6, 11.1)), () => txt('日常变大多是碎片 → 定期 defrag', 1208, 772, { size: 20, color: C.body }))
    withA(E.out(P(t, 14.4, 14.9)), () => {
      chip('--etcd-compaction-interval=5m', 1208, 826, { size: 16, align: 'left', col: C.mute })
    })
  },
}

ANIM({
  id: 'day2-operations',
  meta: { stage: 4, lesson: 7, of: 8, title: 'Day-2 运维：升级、扩容与 etcd 维护', summary: '版本升级评估、节点增删、控制平面扩容、etcd 备份与碎片整理。', next: '故障排查方法论' },
  scenes: [
    lessonIntro({ tags: ['upgrade-cluster.yml', 'drain', 'PDB', 'etcd snapshot', 'defrag'], vo: [[3.2, 'Day-2：上线之后的几年，集群要一直健康。', 'Day 2：上线之后的几年，集群要一直健康。']] }),
    skew, rolling, drain, backup, defrag,
    lessonOutro({
      points: ['版本不能跳：K8s、Kubespray、etcd 各守规矩', '先控制平面再工作节点，分批 drain', 'PDB 要留余量，否则 drain 永远卡住', 'etcd 每天快照拷到集群外，按告警 compact + defrag'],
      vo: [[0.8, '小结：升级前先备份，每一步确认健康再继续。'], [5.6, '下一课，故障排查方法论。']],
    }),
  ],
})
})()
