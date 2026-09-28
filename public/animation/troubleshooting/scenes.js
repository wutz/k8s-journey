/* 第 4 阶段 · 第 8 课：故障排查方法论 */
(() => {
const COL = STAGES[4].color
const bk = p => p <= 0 ? 0 : E.back(p)

// 场景 1：自顶向下，逐段排除
const LAY = [
  ['入口层', 'Ingress / Gateway 有地址？规则匹配？'],
  ['Service', 'EndpointSlice 有地址？targetPort 对？'],
  ['Pod', 'STATUS · READY · RESTARTS · Events'],
  ['容器', 'logs --previous · kubectl debug'],
  ['节点', 'kubelet · containerd · CNI · 磁盘'],
  ['控制平面', 'apiserver · etcd · scheduler'],
]
const LYP = i => 350 + i * 94
const SCAN = [[1.4, 2.2], [2.5, 3.4], [3.7, 4.8]]
const EVI = [
  { t: 8.8, cmd: 'kubectl describe pod web-7c9f > describe.txt' },
  { t: 10.0, cmd: 'kubectl logs web-7c9f --previous > prev.log' },
  { t: 11.2, cmd: 'kubectl events --for pod/web-7c9f > events.txt' },
]
const path = {
  name: '排查路径', dur: 16, mood: 1,
  vo: [[0.6, '用户说访问不了，从入口开始往下查。'],
    [4.6, '每一段用证据确认没问题，再往下走。'],
    [8.8, '先收集证据，再动手修改。'],
    [12.4, '先删 Pod，--previous 日志和事件就没了。', '先删 Pod，上一次的日志和事件就没了。']],
  cues: [[0.4, 'whoosh'], [0.7, 'alarmSoft'], ...LAY.map((_, i) => [0.9 + i * .12, 'tick']), [2.2, 'ok'], [3.4, 'ok'], [4.8, 'error'], [4.4, 'pop'], [6.0, 'pop'],
    ...typeCues(EVI, 45), [12.4, 'pop'], [13.4, 'poof'], [13.7, 'poof'], [14.0, 'poof'], [14.4, 'error']],
  draw(t) {
    heading('自顶向下，逐段排除', 140, 210, t, .2, { eyebrow: 'TOP-DOWN', color: COL })
    withA(bk(P(t, .6, 1.0)) > 0 ? clamp(bk(P(t, .6, 1.0))) : 0, () => chip('现象：用户说"访问不了"', 510, 280, { size: 18, font: SANS, col: C.red, solid: true }))
    const found = t >= 4.8
    LAY.forEach(([n, d], i) => {
      const a = E.out(P(t, .9 + i * .12, 1.3 + i * .12)); if (a <= 0) return
      const y = LYP(i)
      const scanning = SCAN[i] && t >= SCAN[i][0] && t < SCAN[i][1]
      const ok = i < 2 && t >= SCAN[i][1]
      const bad = i === 2 && found
      const next = i === 3 && t >= 6.0
      const dim = found && i > 3
      const c = bad ? C.red : scanning ? COL : next ? C.violet : ok ? C.green : C.hair
      withA(a * (dim ? .45 : 1), () => {
        panel(140 + lerp(-24, 0, a), y - 35, 740, 70, { r: 14, stroke: c, lw: c === C.hair ? 1.5 : 2.5, fill: bad ? tint(C.red, .05) : scanning ? tint(COL, .06) : C.panel })
        txt(String(i + 1), 176, y + 8, { size: 20, font: MONO, color: C.mute, align: 'center' })
        txt(n, 206, y + 8, { size: 24, weight: 600 })
        txt(bad ? 'CrashLoopBackOff → 问题在这一段' : d, 350, y + 7, { size: 18, color: bad ? C.red : C.body, weight: bad ? 600 : 500 })
        if (ok) check(846, y, 26, C.green, P(t, SCAN[i][1], SCAN[i][1] + .3))
        if (bad) cross(846, y, 22, C.red, E.out(P(t, 4.8, 5.1)))
        if (next) chip('下一步', 846, y, { size: 16, font: SANS, col: C.violet, align: 'right', alpha: E.out(P(t, 6.0, 6.4)) })
      })
      if (i < 5) arrow(510, y + 36, 510, y + 57, E.out(P(t, 1.2 + i * .12, 1.5 + i * .12)), hexA(C.text, .25), 2)
    })
    if (SCAN.some(([a, b]) => t >= a && t < b)) {
      const k = SCAN.findIndex(([a, b]) => t >= a && t < b)
      dot(122, LYP(k), 6, COL, 10)
    }
    if (found) ring(846, LYP(2), P(t, 4.8, 5.8), C.red, 90)
    // 原则 ①
    const pa = E.out(P(t, 4.4, 4.9))
    withA(pa, () => {
      panel(940, 300, 840, 150, { r: 18, stroke: hexA(COL, .5), lw: 2, fill: tint(COL, .04) })
      chip('原则 ①', 972, 346, { size: 18, font: SANS, col: COL, solid: true, align: 'left' })
      txt('自顶向下，逐段排除', 1090, 354, { size: 26, weight: 600 })
      txt('每段都有证据再往下，不直接跳到最怀疑的地方', 972, 414, { size: 20, color: C.body })
    })
    // 原则 ②：先存证据
    terminal(940, 470, 840, 200, t, EVI, { size: 20, cps: 45, title: '原则 ② · 先收集证据，再动手修改', alpha: E.out(P(t, 8.4, 8.8)) })
    // 反例
    const ra = E.out(P(t, 12.4, 12.9))
    withA(ra, () => {
      panel(940, 690, 840, 180, { r: 18, stroke: hexA(C.red, .55), lw: 2, fill: tint(C.red, .04) })
      txt('✗  反例', 968, 732, { size: 18, color: C.red, weight: 600 })
      txt('kubectl delete pod web-7c9f', 1080, 732, { size: 20, font: MONO, color: C.red })
    })
    ;['--previous 日志', 'Events 事件', '崩溃现场'].forEach((s, k) => {
      const t0 = 13.4 + k * .3, x = 1040 + k * 250
      if (t < t0) withA(ra, () => chip(s, x, 796, { size: 18, font: SANS, col: C.mute }))
      else poof(x, 796, P(t, t0, t0 + .6), C.red)
    })
    withA(E.out(P(t, 14.4, 14.9)), () => txt('证据全没了，只能等它再崩一次', 1360, 846, { size: 20, color: C.red, align: 'center' }))
  },
}

// 场景 2：Pod 状态逐个击破
const PL = [
  { t: .8, cmd: 'kubectl get pod' },
  { t: 1.8, out: 'NAME        READY   STATUS             RESTARTS   AGE', color: C.mute },
  { t: 2.0, out: 'bad-image   0/1     ErrImagePull       0          40s', color: C.red },
  { t: 2.2, out: 'crash       0/1     CrashLoopBackOff   3          90s', color: C.red },
  { t: 2.4, out: 'too-big     0/1     Pending            0          90s', color: COL },
  { t: 2.6, out: 'oom         0/1     OOMKilled          2          60s', color: C.red },
]
const PODS = [
  ['bad-image', 'ErrImagePull', 'fail', 'describe pod bad-image', 'manifest unknown · not found', '镜像名或 tag 写错'],
  ['crash', 'CrashLoopBackOff', 'fail', 'logs crash --previous', 'starting → exit code 3', '看上一次的日志和退出码'],
  ['too-big', 'Pending', 'pending', 'describe pod too-big', '0/5 nodes: Insufficient cpu', 'requests 超过可分配量'],
  ['oom', 'OOMKilled', 'fail', 'describe pod oom', 'Exit Code 137 = 128 + 9', '超过 limits.memory'],
]
const CT2 = [4.0, 7.0, 10.0, 13.0]
const podStatus = {
  name: 'Pod 状态', dur: 17, mood: 2,
  vo: [[0.6, '先 get pod，一眼看出四种异常。'],
    [4.0, '拉不下镜像：看事件里的原文。'],
    [7.0, 'CrashLoop 是退避，看 --previous。', 'CrashLoop 是退避，看上次日志。'],
    [10.0, 'Pending：资源不够，调度不上。'],
    [13.0, 'OOMKilled：137 是 128 加 9。', 'OOMKilled，137 是 128 加 9。']],
  cues: [[0.4, 'whoosh'], ...typeCues(PL, 40), [2.0, 'error'], [2.2, 'error'], [2.6, 'error'], ...CT2.flatMap(c => [[c, 'pop'], [c + .8, 'tick'], [c + 1.5, 'ding2']])],
  draw(t) {
    heading('Pod 状态：先看 STATUS，再找证据', 140, 210, t, .2, { eyebrow: 'POD STATUS', color: COL })
    terminal(140, 280, 1640, 290, t, PL, { size: 20, cps: 40, alpha: E.out(P(t, .4, .8)) })
    const cur = CT2.reduce((a, c, i) => t >= c ? i : a, -1)
    PODS.forEach(([n, st, ps, cmd, ev, cause], i) => {
      const a = E.out(P(t, 2.8 + i * .15, 3.3 + i * .15)); if (a <= 0) return
      const x = 140 + i * 415, on = cur === i, c = ps === 'pending' ? COL : C.red, t0 = CT2[i]
      withA(a * (cur < 0 || on ? 1 : .55), () => {
        panel(x, 600, 395, 270, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        const sh = on && ps === 'fail' ? Math.sin(t * 60) * 4 * Math.max(0, 1 - ((t - t0) % 1.5) / .4) : 0
        pod(x + 52, 668, 54, { state: ps, shake: sh })
        txt(n, x + 94, 660, { size: 22, font: MONO, weight: 600 })
        chip(st, x + 94, 694, { size: 16, col: c, align: 'left', solid: on })
        line(x + 24, 728, x + 371, 728, C.hair, 1)
        withA(E.out(P(t, t0 + .3, t0 + .7)), () => txt('kubectl ' + cmd, x + 24, 762, { size: 16, font: MONO, color: C.body }))
        withA(E.out(P(t, t0 + .8, t0 + 1.2)), () => txt(ev, x + 24, 800, { size: 17, font: MONO, color: c }))
        withA(E.out(P(t, t0 + 1.5, t0 + 1.9)), () => txt('→ ' + cause, x + 24, 846, { size: 20, weight: 600 }))
      })
      if (on) ring(x + 52, 668, P(t, t0, t0 + .9), c, 80)
    })
  },
}

// 场景 3：Service 不通
const SL = [
  { t: .8, cmd: 'kubectl get endpointslices -l kubernetes.io/service-name=web' },
  { t: 2.8, out: 'NAME        ADDRESSTYPE   PORTS     ENDPOINTS                  AGE', color: C.mute },
  { t: 3.0, out: 'web-x7k2p   IPv4          <unset>   <none>                     5m', color: C.red },
  { t: 7.8, cmd: `kubectl patch svc web -p '{"spec":{"selector":{"app":"web"}}}'` },
  { t: 9.4, out: 'web-x7k2p   IPv4          80        10.233.64.12,10.233.66.7   6m', color: C.green, sfx: 'ok' },
]
const TROWS = [
  ['EndpointSlice 为空', '选择器写错 / Pod 未 Ready', C.red],
  ['Pod IP 也不通', '只监听 127.0.0.1 / targetPort 错', COL],
  ['Pod IP 通，ClusterIP 不通', 'kube-proxy / Cilium 的 Service 规则', C.blue],
  ['同节点通，跨节点不通', 'CNI 隧道 / MTU / 防火墙', C.violet],
]
const service = {
  name: 'Service 不通', dur: 17, mood: 3,
  vo: [[0.6, 'Service 不通，第一步看 EndpointSlice。'],
    [4.2, 'ENDPOINTS 为空：选择器 wbe 拼错了。', 'Endpoints 为空，选择器拼错成了 W B E。'],
    [8.4, '改对选择器，地址出现，流量就通了。'],
    [12.4, '还不通，就绕过 Service 逐段比。']],
  cues: [[0.4, 'whoosh'], ...typeCues(SL, 45), [3.0, 'error'], [3.6, 'alarmSoft'], [9.6, 'chime'], [10.2, 'ok'], ...[0, 1, 2].map(k => [12.6 + k * .6, 'pop'])],
  draw(t) {
    heading('Service 不通：先看 EndpointSlice', 140, 210, t, .2, { eyebrow: 'SERVICE', color: COL })
    terminal(140, 280, 1640, 250, t, SL, { size: 20, cps: 45, alpha: E.out(P(t, .4, .8)) })
    const fixed = t >= 8.4, flowing = t >= 9.4
    const da = E.out(P(t, 1.0, 1.5))
    // client
    pod(210, 700, 70, { state: 'run', label: 'client', alpha: da })
    withA(da, () => arrow(250, 700, 334, 700, 1, hexA(C.text, .3), 2.5))
    if (!flowing && t > 1.6) {
      const ph = ((t - 1.6) % 1.4) / 1.4
      travel(250, 700, 334, 700, ph / .6, C.red, 6)
      if (ph > .6 && t > 3.2) cross(292, 668, 14, C.red, 1 - (ph - .6) / .4)
    }
    if (flowing) flow(250, 700, 334, 700, t, C.green, 2, .9, 0, 4)
    // Service
    withA(da, () => {
      panel(340, 560, 340, 300, { r: 16, stroke: fixed ? hexA(C.green, .6) : t >= 3.4 ? hexA(C.red, .6) : C.hair, lw: 2 })
      txt('svc/web', 366, 602, { size: 22, font: MONO, weight: 600 })
      txt('ClusterIP 10.233.12.40', 366, 630, { size: 16, font: MONO, color: C.mute })
      txt('selector', 366, 676, { size: 16, color: C.mute })
      chip(fixed ? 'app: web' : 'app: wbe', 366, 708, { size: 18, align: 'left', col: fixed ? C.green : t >= 3.4 ? C.red : C.body, solid: t >= 3.4 })
      txt('EndpointSlice', 366, 764, { size: 16, color: C.mute })
      if (!flowing) txt('<none>', 366, 800, { size: 20, font: MONO, color: t >= 3.0 ? C.red : C.mute })
    })
    if (flowing) withA(E.out(P(t, 9.4, 9.9)), () => { txt('10.233.64.12:80', 366, 800, { size: 18, font: MONO, color: C.green }); txt('10.233.66.7:80', 366, 830, { size: 18, font: MONO, color: C.green }) })
    if (t >= 8.4 && t < 9.2) ring(430, 708, P(t, 8.4, 9.2), C.green, 90)
    // Pods
    ;[['web-a', 640], ['web-b', 790]].forEach(([n, y]) => {
      pod(960, y, 64, { state: 'run', label: n, alpha: da })
      chip('app: web', 1004, y, { size: 16, align: 'left', col: C.green, alpha: da })
      if (!fixed) {
        withA(E.out(P(t, 3.6, 4.1)), () => line(684, 708, 922, y, hexA(C.red, .6), 2, [7, 6]))
      } else {
        withA(E.out(P(t, 9.4, 9.9)), () => line(684, 708, 922, y, hexA(C.green, .45), 2.5))
        if (flowing) flow(684, 708, 922, y, t, C.green, 3, .8, y / 300, 4)
      }
    })
    withA(E.out(P(t, 3.6, 4.1)) * (fixed ? 0 : 1), () => {
      ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(800, 712, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      txt('≠', 800, 722, { size: 30, weight: 700, color: C.red, align: 'center' })
    })
    // 右侧：逐段定位
    const ta = E.out(P(t, 10.0, 10.5))
    withA(ta, () => {
      panel(1220, 560, 560, 310, { r: 16 })
      txt('逐段定位', 1248, 598, { size: 16, color: C.mute })
    })
    TROWS.forEach(([s, c, col], k) => {
      const a = E.out(P(t, k ? 12.6 + (k - 1) * .6 : 10.2, (k ? 12.6 + (k - 1) * .6 : 10.2) + .45)); if (a <= 0) return
      const y = 644 + k * 60
      withA(a, () => {
        dot(1256, y - 7, 6, col, 0)
        txt(s, 1274, y, { size: 19, weight: 600 })
        txt(c, 1274, y + 24, { size: 16, color: C.body })
        if (k === 0) check(1750, y - 4, 22, C.green, P(t, 10.4, 10.8))
      })
    })
  },
}

// 场景 4：kubectl debug
const DL1 = [
  { t: .8, cmd: 'kubectl exec -it mypod -- sh' },
  { t: 2.2, out: 'exec: "sh": executable file not found in $PATH', color: C.red, sfx: 'error' },
  { t: 3.4, cmd: 'kubectl debug -it mypod --image=nicolaka/netshoot --target=app' },
  { t: 6.2, out: '~# ss -lntp   LISTEN  *:8080  users:(("app",pid=1))', color: C.green },
]
const DL2 = [
  { t: 8.0, cmd: 'kubectl debug node/gn-192-168-1-11 -it --image=busybox' },
  { t: 10.0, cmd: 'chroot /host' },
  { t: 10.8, cmd: 'journalctl -u kubelet --since "30 min ago" | tail' },
  { t: 12.6, out: 'kubelet: E0923 03:12  "container runtime is down"', color: C.red },
]
const debug = {
  name: 'kubectl debug', dur: 16, mood: 2,
  vo: [[0.6, 'distroless 没有 shell，进不去。'],
    [3.6, '挂一个 netshoot 临时容器，共享网络命名空间。'],
    [8.0, 'debug node 起特权 Pod，宿主机挂在 /host。', 'debug node 起特权 Pod，宿主机挂在 host 目录。'],
    [12.0, 'chroot 进去看 kubelet 日志，用完记得删。']],
  cues: [[0.4, 'whoosh'], ...typeCues(DL1, 40), ...typeCues(DL2, 40), [3.9, 'whoosh'], [4.4, 'pop'], [4.9, 'zap'], [5.5, 'zap'], [9.0, 'pop'], [9.4, 'pop'], [10.2, 'zap'], [13.4, 'pop'], [14.0, 'poof']],
  draw(t) {
    heading('kubectl debug：临时容器与节点调试', 140, 210, t, .2, { eyebrow: 'KUBECTL DEBUG', color: COL })
    const right = t >= 7.8
    const la = right ? lerp(1, .5, P(t, 7.8, 8.3)) : 1
    const ra = right ? 1 : .45 * E.out(P(t, 1.2, 1.7))
    // 左：Pod 调试
    withA(la, () => {
      terminal(140, 280, 800, 250, t, DL1, { size: 18, cps: 40, alpha: E.out(P(t, .4, .8)) })
      const pa = E.out(P(t, .9, 1.4))
      withA(pa, () => {
        panel(140, 560, 800, 310, { r: 22, fill: tint(COL, .03), stroke: hexA(COL, .55), dash: [12, 9], lw: 2, shadow: false })
        chip('Pod mypod', 540, 560, { size: 18, col: COL, solid: true })
      })
      box(330, 680, 280, 100, 'app', 'distroless · 无 shell', C.blue, { alpha: pa, size: 26 })
      if (t >= 2.2) withA(E.out(P(t, 2.2, 2.5)) * (1 - P(t, 4.2, 4.6)), () => chip('exec ✗', 330, 612, { size: 16, col: C.red, solid: true }))
      const da = E.out(P(t, 3.9, 4.5))
      box(lerp(860, 750, da), 680, 300, 100, 'debugger', 'nicolaka/netshoot', C.violet, { alpha: da, size: 26, hi: t >= 3.9 && t < 7.8 })
      withA(E.out(P(t, 4.4, 4.8)), () => chip('临时容器 · Ephemeral', 750, 612, { size: 16, font: SANS, col: C.violet }))
      const nb = E.out(P(t, 4.9, 5.4)), pb = E.out(P(t, 5.5, 6.0))
      ctx.save()
      ctx.globalAlpha *= nb; ctx.fillStyle = tint(C.teal, .22); rr(180, 758, 720 * nb, 30, 10); ctx.fill()
      ctx.restore()
      withA(nb, () => txt('network namespace · 共享', 200, 779, { size: 16, color: C.teal, weight: 600 }))
      ctx.save()
      ctx.globalAlpha *= pb; ctx.fillStyle = tint(C.blue, .18); rr(180, 802, 720 * pb, 30, 10); ctx.fill()
      ctx.restore()
      withA(pb, () => txt('process namespace · --target=app', 200, 823, { size: 16, color: C.blue, weight: 600 }))
    })
    // 右：节点调试
    withA(ra, () => {
      terminal(980, 280, 800, 250, t, DL2, { size: 18, cps: 40 })
      node(980, 560, 800, 310, 'gn-192-168-1-11', {})
      chip('Ready', 1768, 580, { size: 16, align: 'right', pad: 8, col: C.green })
    })
    const ba = E.out(P(t, 9.0, 9.5))
    box(1160, 690, 300, 100, 'node-debugger', '特权 · 宿主机命名空间', C.teal, { alpha: ba, size: 26, hi: t >= 9 && t < 12 })
    const ha = E.out(P(t, 9.4, 9.9))
    box(1610, 690, 280, 100, '宿主机 /', '容器内看到 /host', C.blue, { alpha: ha, size: 26 })
    arrow(1316, 690, 1464, 690, ha, hexA(C.blue, .6), 2.5)
    withA(E.out(P(t, 10.2, 10.6)), () => { chip('chroot /host', 1390, 648, { size: 16, col: C.blue, solid: true }) })
    if (t >= 10.2) ring(1610, 690, P(t, 10.2, 11.0), C.blue, 120)
    const ca = E.out(P(t, 13.4, 13.9))
    withA(ca, () => {
      chip('kubectl delete pod node-debugger-gn-192-168-1-11-x7k2p', 1004, 812, { size: 16, align: 'left', col: C.red })
      txt('不会自动删除', 1756, 818, { size: 18, color: C.red, align: 'right' })
    })
  },
}

// 场景 5：节点 NotReady
const TX = s => 200 + s / 360 * 1520
function simT(t) {
  if (t < 1.0) return 0
  if (t < 4.4) return lerp(0, 45, P(t, 1.0, 4.4))
  if (t < 7.2) return 45
  if (t < 10.6) return lerp(45, 345, P(t, 7.2, 10.6))
  return lerp(345, 360, P(t, 10.6, 11.4))
}
const tAt = s => s <= 45 ? 1.0 + s / 45 * 3.4 : 7.2 + (s - 45) / 300 * 3.4
const EV_T = tAt(340)
const CONDS = [['Ready', 'Unknown', C.red], ['MemoryPressure', 'False', C.mute], ['DiskPressure', 'False', C.mute], ['PIDPressure', 'False', C.mute], ['NetworkUnavailable', 'False', C.mute]]
const notready = {
  name: '节点 NotReady', dur: 16, mood: 4,
  vo: [[0.6, 'kubelet 失联，不会立刻 NotReady。'],
    [4.0, '约 40 秒后 NotReady，打上污点。', '约四十秒后 NotReady，打上污点。'],
    [7.6, 'Pod 默认容忍 300 秒，之后才驱逐重建。', 'Pod 默认容忍三百秒，之后才驱逐重建。'],
    [11.8, 'describe node 看 Conditions，再上节点查。']],
  cues: [[0.4, 'whoosh'], [1.0, 'powerDown'], [tAt(40), 'alarmSoft'], [tAt(40) + .3, 'lock'], [7.2, 'tick'], [EV_T, 'alarm'], [EV_T + .1, 'poof'], [EV_T + 1.0, 'pop'], [EV_T + 1.8, 'ok'], ...CONDS.map((_, i) => [12.0 + i * .2, 'tick']), [13.4, 'pop']],
  draw(t) {
    heading('节点 NotReady：为什么 5 分钟后才迁走', 140, 210, t, .2, { eyebrow: 'NODE NOTREADY', color: COL })
    const s = simT(t), nr = s >= 40, ev = t >= EV_T
    const ta = E.out(P(t, .5, 1.0))
    withA(ta, () => {
      line(TX(0), 360, TX(360), 360, C.hairD, 2)
      for (let k = 0; k <= 6; k++) { line(TX(k * 60), 352, TX(k * 60), 368, C.hairD, 2); txt(`${k * 60}s`, TX(k * 60), 394, { size: 16, font: MONO, color: C.mute, align: 'center' }) }
      txt(`T+${Math.round(s)}s`, 1780, 210, { size: 26, font: MONO, weight: 600, color: nr ? (ev ? C.red : COL) : C.text, align: 'right' })
    })
    withA(E.out(P(t, 1.0, 1.3)), () => { dot(TX(0), 360, 8, C.red, 8); txt('kubelet 失联', TX(0), 326, { size: 18, color: C.red, align: 'center' }) })
    if (nr) {
      const k = E.out(P(t, tAt(40), tAt(40) + .4))
      withA(k, () => {
        chip('NotReady + 污点', TX(40) + 20, 318, { size: 17, font: SANS, col: COL, solid: true, align: 'left' })
        txt('node-monitor-grace-period ≈ 40–50s', TX(40) - 6, 428, { size: 16, font: MONO, color: COL })
        dot(TX(40), 360, 8, COL, 8)
      })
    }
    const bw = E.out(P(t, 7.2, 7.8))
    if (bw > 0) {
      ctx.save(); ctx.fillStyle = tint(COL, .3); rr(TX(40), 352, (TX(340) - TX(40)) * bw, 16, 8); ctx.fill(); ctx.restore()
      withA(bw, () => txt('Pod 默认容忍 300s · tolerationSeconds', (TX(40) + TX(340)) / 2 + 60, 326, { size: 18, color: C.body, align: 'center' }))
    }
    if (ev) withA(bk(P(t, EV_T, EV_T + .4)) > 0 ? clamp(bk(P(t, EV_T, EV_T + .4))) : 0, () => { chip('驱逐 → 重建', TX(340), 428, { size: 17, font: SANS, col: C.red, solid: true }); dot(TX(340), 360, 8, C.red, 8) })
    if (ta > 0 && t >= 1.0) { line(TX(s), 340, TX(s), 380, hexA(C.text, .5), 2); dot(TX(s), 340, 5, C.text, 0) }
    // 节点
    const na = E.out(P(t, .7, 1.2))
    node(140, 470, 640, 250, 'gn-192-168-1-11', { alpha: na, state: nr ? 'down' : 'ok' })
    node(1140, 470, 640, 250, 'gn-192-168-1-12', { alpha: na })
    withA(na, () => {
      chip(nr ? 'NotReady' : 'Ready', 768, 490, { size: 16, align: 'right', pad: 8, col: nr ? C.red : C.green, solid: nr })
      chip('Ready', 1768, 490, { size: 16, align: 'right', pad: 8, col: C.green })
      if (t >= 1.0) txt(nr ? '' : '心跳中断…', 164, 548, { size: 18, color: C.red })
    })
    if (nr) withA(E.out(P(t, tAt(40) + .2, tAt(40) + .6)), () => chip('node.kubernetes.io/unreachable:NoExecute', 164, 542, { size: 16, align: 'left', col: COL }))
    if (t >= 1.0 && t < 1.8) ring(460, 595, P(t, 1.0, 1.8), C.red, 260)
    const XS = [300, 460, 620], XD = [1440, 1580, 1720]
    XS.forEach((x, i) => {
      if (!ev) pod(x, 640, 70, { state: nr ? 'idle' : 'run', label: 'web-' + 'abc'[i], alpha: na * (nr ? .6 : 1) })
      else {
        poof(x, 640, P(t, EV_T, EV_T + .6), C.mute)
        travelPath([[x, 600], [x, 450], [XD[i], 450], [XD[i], 600]], P(t, EV_T + .1 + i * .1, EV_T + .9 + i * .1), C.green, 7)
      }
      const k = P(t, EV_T + 1.0 + i * .1, EV_T + 1.3 + i * .1)
      if (k > 0) pod(XD[i], 640, 70, { state: t < EV_T + 1.8 ? 'pending' : 'run', label: 'web-' + 'abc'[i], scale: bk(k) })
    })
    if (nr && !ev) withA(E.out(P(t, tAt(40) + .4, tAt(40) + .8)), () => { txt('Pod 仍留在原节点', 960, 588, { size: 18, color: C.mute, align: 'center' }); txt('等容忍期结束', 960, 616, { size: 18, color: C.mute, align: 'center' }) })
    pod(1280, 640, 70, { state: 'run', label: 'db-0', alpha: na })
    // Conditions
    const ca = E.out(P(t, 11.8, 12.3))
    withA(ca, () => {
      panel(140, 750, 1640, 120, { r: 16 })
      txt('kubectl describe node gn-192-168-1-11  ·  Conditions', 168, 788, { size: 16, font: MONO, color: C.mute })
    })
    let cx = 168
    CONDS.forEach(([n, v, c], i) => {
      const w = chip(`${n}=${v}`, cx, 834, { size: 16, align: 'left', col: c, solid: i === 0, alpha: E.out(P(t, 12.0 + i * .2, 12.3 + i * .2)) })
      cx += w + 12
    })
    withA(E.out(P(t, 13.4, 13.9)), () => txt('SSH 上去：kubelet · containerd · 磁盘 · 时间', 1752, 840, { size: 18, color: C.text, align: 'right' }))
  },
}

ANIM({
  id: 'troubleshooting',
  meta: { stage: 4, lesson: 8, of: 8, title: '故障排查方法论', summary: '从 Pod 到节点到集群的排查路径，kubectl debug 与常见故障案例。', next: 'GPU 调度与 GPU Operator' },
  scenes: [
    lessonIntro({ tags: ['describe', 'logs --previous', 'EndpointSlice', 'kubectl debug', 'NotReady'], vo: [[3.2, '出了故障别乱猜：按层找证据。']] }),
    path, podStatus, service, debug, notready,
    lessonOutro({
      points: ['自顶向下逐段排除，先存证据再动手', 'Pod 异常看 describe 事件和 logs --previous', 'Service 不通，先看 EndpointSlice', 'debug 临时容器进 distroless，debug node 进节点'],
      vo: [[0.8, '小结：按层找证据，别跳到最怀疑的地方。'], [5.6, '下一课，GPU 调度与 GPU Operator。']],
    }),
  ],
})
})()
