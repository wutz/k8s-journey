/* 第 4 阶段 · 第 1 课：生产集群规划 */
(() => {
  const COL = STAGES[4].color

  // 场景 1：命名规范
  const ROLES = [['mn', '控制平面', '3/5/7 奇数'], ['ln', '负载均衡', '≥2 可复用'], ['gn', 'GPU 计算', '按需'],
    ['cn', 'CPU 计算', '按需'], ['dn', '数据库', '≥3 独立'], ['sn', '存储', '≥3 独立']]
  const DNS = [['gf', '服务', COL], ['.', '', C.faint], ['k8s1', '集群', C.blue], ['.', '', C.faint], ['sh2', '地区', C.teal], ['.', '', C.faint], ['example.com', '域名', C.violet]]
  const naming = {
    name: '命名规范', dur: 16, mood: 1,
    vo: [[0.6, '节点名：角色前缀加 IP，一眼看出身份。'],
      [5.6, '服务域名按 服务.集群.地区.域名 分层。', '服务域名按服务、集群、地区、域名分层。'],
      [10.8, '一张通配证书加泛解析，新服务即开即用。']],
    cues: [[0.6, 'whoosh'], [1.0, 'pop'], [2.0, 'tick'], [2.5, 'tick'], ...ROLES.map((_, i) => [3.0 + i * .22, 'tick']),
      [6.0, 'tick'], [6.5, 'tick'], [7.0, 'tick'], [7.5, 'tick'], [10.9, 'lock'], [12.2, 'ok'], [12.8, 'ok'], [13.4, 'ok']],
    draw(t) {
      heading('先定命名：节点与域名', 140, 210, t, .2, { eyebrow: 'NAMING', color: COL })
      // 节点名拆解
      withA(E.out(P(t, .6, 1.2)), () => {
        panel(140, 280, 800, 300, { r: 18 })
        txt('节点名 = 角色前缀 - IP', 176, 328, { size: 20, color: C.mute })
        const o = { size: 64, font: MONO, weight: 600 }
        const w1 = textW('mn', 64, o), w2 = textW('-', 64, o), w3 = textW('192-168-0-1', 64, o)
        const x0 = 176
        txt('mn', x0, 430, { ...o, color: COL, alpha: E.out(P(t, 1, 1.4)) })
        txt('-', x0 + w1, 430, { ...o, color: C.faint, alpha: E.out(P(t, 1.2, 1.6)) })
        txt('192-168-0-1', x0 + w1 + w2, 430, { ...o, color: C.text, alpha: E.out(P(t, 1.3, 1.8)) })
        const b1 = E.out(P(t, 2, 2.5)), b2 = E.out(P(t, 2.5, 3))
        withA(b1, () => { line(x0, 458, x0 + w1, 458, COL, 3); txt('角色', x0 + w1 / 2, 494, { size: 22, color: COL, align: 'center' }) })
        withA(b2, () => { const xs = x0 + w1 + w2; line(xs, 458, xs + w3, 458, C.body, 3); txt('IP 192.168.0.1', xs + w3 / 2, 494, { size: 22, font: MONO, color: C.body, align: 'center' }) })
        withA(E.out(P(t, 4.2, 4.8)), () => txt('调度靠同名标签：node-role.kubernetes.io/<角色>=true', 176, 548, { size: 18, font: MONO, color: C.mute }))
      })
      // 角色前缀
      ROLES.forEach(([p, n, m], i) => {
        const a = E.out(P(t, 3 + i * .22, 3.4 + i * .22)); if (a <= 0) return
        const x = 1000 + (i % 3) * 260, y = 280 + Math.floor(i / 3) * 160, on = i === 0
        withA(a, () => {
          panel(x, y + lerp(16, 0, a), 244, 140, { r: 16, stroke: on ? COL : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(COL, .07) : C.panel })
          txt(p, x + 24, y + 64, { size: 40, font: MONO, weight: 600, color: COL })
          txt(n, x + 24, y + 110, { size: 22, color: C.text })
          chip(m, x + 228, y + 40, { size: 15, align: 'right', col: C.mute, pad: 8 })
        })
      })
      // DNS 分层
      withA(E.out(P(t, 5.6, 6.1)), () => {
        panel(140, 620, 800, 250, { r: 18 })
        txt('服务域名 = <service>.<cluster>.<region>.<domain>', 176, 666, { size: 19, font: MONO, color: C.mute })
        let x = 176
        DNS.forEach(([s, lb, c], i) => {
          const w = textW(s, 48, { font: MONO, weight: 600 })
          const k = Math.floor(i / 2), a = E.out(P(t, 6 + k * .5, 6.4 + k * .5))
          txt(s, x, 760, { size: 48, font: MONO, weight: 600, color: c, alpha: a })
          if (lb) withA(a, () => { line(x, 784, x + w, 784, c, 3); txt(lb, x + w / 2, 820, { size: 20, color: c, align: 'center' }) })
          x += w
        })
      })
      // 通配证书
      withA(E.out(P(t, 10.8, 11.4)), () => {
        panel(1000, 620, 760, 250, { r: 18, stroke: hexA(COL, .5), fill: tint(COL, .04) })
        lock(1058, 690, 40, COL)
        txt('*.k8s1.sh2.example.com', 1102, 702, { size: 30, font: MONO, weight: 600, color: C.text })
        txt('一张通配证书 + 一条泛解析 → 入口 LB IP', 1036, 760, { size: 21, color: C.body })
        ;[['gf  Grafana', 12.2], ['cr  镜像仓库', 12.8], ['新服务', 13.4]].forEach(([s, t0], i) => {
          const a = E.out(P(t, t0, t0 + .4)); if (a <= 0) return
          const x = 1036 + [0, 222, 432][i]
          chip(s + '  ✓', x, 822, { size: 19, align: 'left', col: C.green, alpha: a, font: SANS })
        })
      })
    },
  }

  // 场景 2：etcd 为什么是奇数
  const EN = [[470, 410], [290, 680], [650, 680]]
  const QT = [[1, 1, 0], [3, 2, 1], [4, 3, 1], [5, 3, 2], [7, 4, 3]]
  const quorum = {
    name: '奇数控制平面', dur: 16, mood: 2,
    vo: [[0.6, 'etcd 用 Raft，写入要多数成员确认。'],
      [5.6, '3 台坏 1 台，剩下 2 台仍是多数派。'],
      [10.6, '4 台也只容忍 1 台故障，所以总用奇数。']],
    cues: [[0.6, 'whoosh'], [1.0, 'pop'], [1.2, 'pop'], [1.4, 'pop'], [1.8, 'zap'], [3.2, 'tick'], [3.4, 'tick'], [4.2, 'ok'],
      [5.8, 'error'], [6.6, 'zap'], [7.8, 'tick'], [8.4, 'ok'], ...QT.map((_, i) => [1.2 + i * .3, 'tick']), [10.8, 'alarmSoft'], [12.6, 'chime']],
    draw(t) {
      heading('控制平面为什么是 3 或 5 台', 140, 210, t, .2, { eyebrow: 'RAFT QUORUM', color: COL })
      const la = E.out(P(t, .6, 1.1))
      withA(la, () => { panel(140, 280, 660, 580, { r: 18 }); txt('一次写入', 172, 326, { size: 20, color: C.mute }) })
      const dead = t >= 5.8
      // 连线
      withA(la, () => { EN.forEach(([x, y], i) => { const [x2, y2] = EN[(i + 1) % 3]; line(x, y, x2, y2, C.hairD, 2, [6, 8]) }) })
      EN.forEach(([x, y], i) => {
        const a = E.back(P(t, 1 + i * .2, 1.5 + i * .2)); if (a <= 0) return
        const bad = i === 2 && dead, col = bad ? C.red : i === 0 ? COL : C.blue
        const sh = bad && t < 6.4 ? Math.sin(t * 80) * 6 : 0
        withA(clamp(a), () => {
          ctx.save(); ctx.beginPath(); ctx.arc(x + sh, y, 58 * a, 0, Math.PI * 2); ctx.fillStyle = tint(col, bad ? .1 : .14); ctx.fill()
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.restore()
          txt('etcd-' + (i + 1), x + sh, y + 8, { size: 22, font: MONO, weight: 600, color: col, align: 'center' })
          if (i === 0) chip('leader', x, y - 84, { size: 16, col: COL, solid: true })
          if (bad) cross(x + 40, y - 40, 26, C.red, E.out(P(t, 5.8, 6.2)))
        })
      })
      ring(EN[2][0], EN[2][1], P(t, 5.8, 6.8), C.red, 130)
      // 第一轮：3/3 确认
      ;[1, 2].forEach(k => { travel(EN[0][0], EN[0][1], EN[k][0], EN[k][1], P(t, 1.9, 2.9), COL); travel(EN[k][0], EN[k][1], EN[0][0], EN[0][1], P(t, 3, 4), C.green) })
      ring(EN[0][0], EN[0][1], P(t, 1.7, 2.5), COL, 110)
      // 第二轮：2/3 确认
      travel(EN[0][0], EN[0][1], EN[1][0], EN[1][1], P(t, 6.6, 7.5), COL)
      travel(EN[0][0], EN[0][1], lerp(EN[0][0], EN[2][0], .55), lerp(EN[0][1], EN[2][1], .55), P(t, 6.6, 7.3), hexA(C.red, .6))
      travel(EN[1][0], EN[1][1], EN[0][0], EN[0][1], P(t, 7.6, 8.4), C.green)
      const s1 = E.out(P(t, 4.2, 4.6)) * (1 - E.out(P(t, 5.6, 6))), s2 = E.out(P(t, 8.4, 8.8))
      chip('确认 3 / 3  ·  已提交 ✓', 470, 810, { size: 22, col: C.green, alpha: s1, font: SANS })
      chip('确认 2 / 3  ·  仍是多数派 ✓', 470, 810, { size: 22, col: C.green, solid: true, alpha: s2, font: SANS })
      // 右侧：成员数表
      withA(E.out(P(t, .9, 1.4)), () => {
        panel(860, 280, 920, 580, { r: 18 })
        ;[['etcd 成员', 900], ['多数派', 1250], ['可容忍故障', 1450]].forEach(([s, x]) => txt(s, x, 334, { size: 20, color: C.mute }))
        line(880, 356, 1760, 356, C.hair, 1)
      })
      QT.forEach(([n, q, f], i) => {
        const a = E.out(P(t, 1.2 + i * .3, 1.6 + i * .3)); if (a <= 0) return
        const y = 372 + i * 86
        const four = n === 4 && t >= 10.6, good = (n === 3 || n === 5) && t >= 12.6, cur = n === 3 && t >= 5.6 && t < 10.6
        const hc = four ? C.red : good || cur ? C.green : null
        withA(a, () => {
          if (hc) { ctx.save(); rr(876, y, 888, 74, 12); ctx.fillStyle = tint(hc, .1); ctx.fill(); ctx.strokeStyle = hexA(hc, .55); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore() }
          txt(String(n), 912, y + 48, { size: 32, font: MONO, weight: 600, color: C.text })
          for (let k = 0; k < n; k++) dot(962 + k * 30, y + 37, 9, k < q ? COL : C.faint, 0)
          txt(String(q), 1285, y + 48, { size: 30, font: MONO, color: C.body, align: 'center' })
          txt(String(f), 1510, y + 48, { size: 30, font: MONO, weight: 600, color: f ? C.green : C.red, align: 'center' })
          if (four) chip('容错同 3 · 更慢', 1748, y + 37, { size: 17, align: 'right', col: C.red, font: SANS, alpha: E.out(P(t, 10.8, 11.2)) })
          if (good) chip('推荐', 1748, y + 37, { size: 17, align: 'right', col: C.green, solid: true, font: SANS, alpha: E.out(P(t, 12.6, 13)) })
          if (n === 7 && t >= 12.6) chip('上限', 1748, y + 37, { size: 17, align: 'right', col: C.mute, font: SANS, alpha: E.out(P(t, 13, 13.4)) })
        })
      })
      withA(E.out(P(t, 3, 3.5)), () => txt('多数派 = N/2+1，可容忍 (N−1)/2 台故障', 900, 830, { size: 19, color: C.mute }))
    },
  }

  // 场景 3：高可用拓扑
  const MX = [560, 960, 1360], WK = ['gn-192-168-1-1', 'cn-192-168-100-1', 'sn-192-168-201-1']
  const topo = {
    name: '高可用拓扑', dur: 17, mood: 3,
    vo: [[0.6, '三台 mn 上同时跑 apiserver 和 etcd。', '三台管理节点上，同时跑 API Server 和 etcd。'],
      [5.6, '集群外走 VIP，由 kube-vip 用 ARP 宣告。', '集群外部走 VIP，由 kube vip 用 ARP 宣告。'],
      [10.6, 'worker 走本地 nginx 代理，坏一台也不怕。', 'worker 走本地 nginx 代理，坏掉一台也不怕。']],
    cues: [[0.6, 'whoosh'], [0.9, 'pop'], [1.2, 'pop'], [1.5, 'pop'], [2.0, 'tick'], [2.4, 'tick'], [2.8, 'tick'], [3.4, 'zap'],
      [5.8, 'pop'], [6.4, 'zap'], [7.2, 'tick'], [10.8, 'pop'], [11.1, 'pop'], [11.4, 'pop'], [13.4, 'error'], [14.0, 'whoosh'], [14.8, 'ok']],
    draw(t) {
      heading('堆叠式 etcd + VIP', 140, 210, t, .2, { eyebrow: 'HA TOPOLOGY', color: COL })
      const down = t >= 13.4, mv = E.inOut(P(t, 13.9, 14.7))
      // 控制平面
      MX.forEach((x, i) => {
        const a = E.out(P(t, .8 + i * .3, 1.3 + i * .3)); if (a <= 0) return
        const bad = i === 0 && down
        node(x - 170, 400 + lerp(20, 0, a), 340, 210, 'mn-192-168-0-' + (i + 1), { alpha: a, state: bad ? 'down' : 'ok', tag: 'mn', accent: COL })
        ;[['apiserver', C.blue], ['etcd', COL], ['sched / cm', C.violet]].forEach(([s, c], k) => {
          chip(s, x, 474 + k * 46 + lerp(20, 0, a), { size: 19, col: bad ? C.faint : c, alpha: a * E.out(P(t, 2 + k * .4, 2.4 + k * .4)) })
        })
      })
      // etcd 互联
      const el = E.out(P(t, 3.4, 4))
      ;[0, 1].forEach(i => { const x1 = MX[i] + 170, x2 = MX[i + 1] - 170; withA(el, () => { line(x1 + 6, 520, x2 - 6, 520, hexA(COL, .7), 2.5); arrowHead(x2 - 4, 520, 0, COL, 10); arrowHead(x1 + 4, 520, Math.PI, COL, 10) }) })
      withA(el, () => txt('Raft', 760, 506, { size: 16, font: MONO, color: COL, align: 'center' }))
      // VIP
      const va = E.back(P(t, 5.8, 6.3))
      const hx = lerp(MX[0], MX[1], mv)
      withA(clamp(va), () => {
        user(220, 330, 16, C.body)
        txt('kubectl / CI', 220, 390, { size: 18, font: MONO, color: C.body, align: 'center' })
        chip('VIP 192.168.0.100:6443', 960, 310, { size: 22, col: COL, solid: true })
      })
      arrow(262, 310, 810, 310, E.out(P(t, 6.4, 7)), hexA(C.text, .4), 2.5)
      if (t > 7) flow(262, 310, 800, 310, t, COL, 3, .7, 0, 4)
      const hl = E.out(P(t, 7.2, 7.7))
      withA(hl, () => {
        line(960, 330, hx, 398, COL, 2.5, [7, 6]); dot(hx, 398, 6, COL, 8)
        chip('kube-vip · ARP 宣告', 1110, 352, { size: 16, col: COL, align: 'left' })
      })
      ring(hx, 400, P(t, 14.6, 15.6), COL, 140)
      // worker
      WK.forEach((n, j) => {
        const x = MX[j], a = E.out(P(t, 10.8 + j * .3, 11.3 + j * .3)); if (a <= 0) return
        MX.forEach((ax, i) => {
          const bad = i === 0 && down
          withA(a * E.out(P(t, 11.4, 12)), () => {
            line(x, 736, ax, 612, bad ? hexA(C.red, .35) : hexA(C.blue, .28), 2, bad ? [6, 8] : null)
            if (!bad) flow(x, 736, ax, 612, t, C.blue, 2, .6, j * .3 + i * .17, 3.5)
          })
        })
        node(x - 170, 736 + lerp(20, 0, a), 340, 124, n, { alpha: a, tag: n.slice(0, 2), accent: C.blue })
        chip('nginx → 127.0.0.1:6443', x, 818 + lerp(20, 0, a), { size: 16, col: C.teal, alpha: a })
      })
    },
  }

  // 场景 4：地址规划
  const ROWS = [['节点网络', '192.168.0.0/16', '物理机 IP · 机房分配', C.body], ['apiserver VIP', '192.168.0.100', '同二层 · 不在 DHCP 内', COL],
    ['LB 地址池', '192.168.10.200-210', 'MetalLB 分给 Service', C.teal], ['Service CIDR', '172.23.0.0/16', 'ClusterIP', C.blue], ['Pod CIDR', '172.24.0.0/13', '按节点数留足余量', C.violet]]
  const addr = {
    name: '地址规划', dur: 16, mood: 2,
    vo: [[0.6, '部署前填好地址规划表，和网管确认无冲突。'],
      [5.4, 'Pod 网段 /13 按 /24 切，够 2048 个节点。', 'Pod 网段斜杠13，按斜杠24切分，够2048个节点。'],
      [11.2, '和在用网段重叠，是最隐蔽的故障。']],
    cues: [[0.6, 'whoosh'], ...ROWS.map((_, i) => [0.9 + i * .35, 'tick']), [5.6, 'pop'], [6, 'shimmer'], [8.2, 'ding3'],
      [9, 'tick'], [11, 'tick'], [11.4, 'tick'], [12.2, 'error'], [13.2, 'alarmSoft']],
    draw(t) {
      heading('网络与地址规划', 140, 210, t, .2, { eyebrow: 'ADDRESS PLAN', color: COL })
      const pod = t >= 5.4
      ROWS.forEach(([n, cidr, note, c], i) => {
        const a = E.out(P(t, .9 + i * .35, 1.3 + i * .35)); if (a <= 0) return
        const y = 290 + i * 116, on = pod && i === 4
        withA(a * (pod && !on ? .55 : 1), () => {
          panel(140 + lerp(-24, 0, a), y, 860, 100, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .06) : C.panel })
          ctx.save(); ctx.fillStyle = c; rr(140 + lerp(-24, 0, a), y + 18, 6, 64, 3); ctx.fill(); ctx.restore()
          txt(n, 176, y + 44, { size: 24, weight: 600 })
          txt(note, 176, y + 76, { size: 17, color: C.mute })
          txt(cidr, 976, y + 60, { size: 28, font: MONO, color: c, align: 'right' })
        })
      })
      // Pod CIDR 容量
      withA(E.out(P(t, 5.6, 6.1)), () => {
        panel(1060, 290, 720, 300, { r: 18 })
        txt('172.24.0.0/13', 1092, 346, { size: 30, font: MONO, weight: 600, color: C.violet })
        txt('每个节点切一个 /24', 1748, 344, { size: 20, color: C.body, align: 'right' })
        const n = 64, pr = P(t, 6, 8)
        for (let k = 0; k < n; k++) {
          const on = k / n < pr, x = 1092 + k * 10.1
          ctx.save(); ctx.fillStyle = on ? tint(C.violet, k % 2 ? .4 : .6) : 'rgba(0,0,0,0.06)'; rr(x, 376, 8, 64, 2); ctx.fill(); ctx.restore()
        }
        const k2 = E.out(P(t, 8.2, 8.8))
        txt('2^(24−13) =', 1092, 510, { size: 30, font: MONO, color: C.body, alpha: k2 })
        txt(String(countUp(2048, t, 8.2, 9.4)), 1330, 512, { size: 52, font: MONO, weight: 600, color: C.violet, alpha: k2 })
        txt('个节点', 1490, 510, { size: 26, color: C.body, alpha: k2 })
        txt('× 每节点 254 个 Pod IP', 1092, 560, { size: 21, color: C.mute, alpha: E.out(P(t, 9, 9.5)) })
      })
      // 网段数轴
      withA(E.out(P(t, 10.8, 11.3)), () => {
        panel(1060, 620, 720, 240, { r: 18 })
        txt('172.x.0.0 · 和机房在用网段逐一比对', 1092, 664, { size: 19, color: C.mute })
        const X = v => 1100 + (v - 16) * 40, Y = 760
        line(X(16), Y, X(32), Y, C.hairD, 2)
        for (let v = 16; v <= 32; v += 4) { line(X(v), Y - 6, X(v), Y + 6, C.hairD, 2); txt(String(v), X(v), Y + 30, { size: 16, font: MONO, color: C.mute, align: 'center' }) }
        ;[[17, 1, C.faint, 'docker0', 11], [23, 1, C.blue, 'Svc', 11.4], [24, 8, C.violet, 'Pod /13', 11.4]].forEach(([s, w, c, lb, t0]) => {
          const a = E.out(P(t, t0, t0 + .4))
          withA(a, () => { ctx.save(); ctx.fillStyle = tint(c, .35); ctx.strokeStyle = c; ctx.lineWidth = 2; rr(X(s), Y - 30, w * 40, 24, 6); ctx.fill(); ctx.stroke(); ctx.restore()
            txt(lb, X(s) + w * 20, Y - 40, { size: 16, font: MONO, color: c === C.faint ? C.mute : c, align: 'center' }) })
        })
        const ov = E.out(P(t, 12.2, 12.6)), pul = .5 + .5 * Math.sin(t * 8)
        withA(ov, () => {
          ctx.save(); ctx.fillStyle = hexA(C.red, .25 + .2 * pul); ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; rr(X(26), Y - 34, 40, 32, 6); ctx.fill(); ctx.stroke(); ctx.restore()
          chip('办公网 172.26.0.0/16  ✕ 重叠', X(26) + 20, Y - 62 - 14, { size: 16, col: C.red, solid: true, font: SANS })
          txt('去往它的流量被集群路由吃掉：某些地址就是不通', 1092, 836, { size: 18, color: C.red })
        })
      })
    },
  }

  // 场景 5：etcd 磁盘验收
  const CHAIN = ['WAL fsync 慢', '写请求变慢', 'apiserver 卡顿', 'kubectl 超时']
  const FIO = [
    { t: 5.8, cmd: 'fio --rw=write --ioengine=sync --fdatasync=1 \\' },
    { t: 7.5, out: '    --directory=/var/lib/etcd --size=22m --bs=2300 \\', color: C.text },
    { t: 7.7, out: '    --name=etcd-disk-test', color: C.text },
    { t: 8.6, out: '  sync percentiles (usec):', color: C.mute },
    { t: 9.0, out: '   | 99.00th=[ 2376]', color: C.green, sfx: 'ok' },
    { t: 9.2, out: '   | 99.50th=[ 9634]', color: C.body },
    { t: 9.4, out: '   | 99.90th=[15795]', color: C.body },
  ]
  const disk = {
    name: 'etcd 磁盘验收', dur: 17, mood: 3,
    vo: [[0.6, 'etcd 每次写入都要把 WAL fsync 到磁盘。', 'etcd 每次写入，都要把日志 fsync 到磁盘。'],
      [5.6, '上线前用 fio 模拟 WAL 写入来验收。', '上线前，用 fio 模拟 etcd 的日志写入来验收。'],
      [10.8, 'p99 小于 10 毫秒才合格，不达标别上线。', '99 分位小于 10 毫秒才合格，不达标别上线。']],
    cues: [[0.6, 'whoosh'], ...CHAIN.map((_, i) => [1 + i * .8, i ? 'thud' : 'pop']), [4.2, 'alarmSoft'], ...typeCues(FIO, 30), [11, 'ding4'], [12.6, 'chime']],
    draw(t) {
      heading('etcd 磁盘验收：fio 测 WAL fsync', 140, 210, t, .2, { eyebrow: 'DISK CHECK', color: COL })
      CHAIN.forEach((s, i) => {
        const a = E.out(P(t, 1 + i * .8, 1.4 + i * .8)); if (a <= 0) return
        const x = 290 + i * 410, c = i ? C.red : COL
        box(x, 320, 300, 72, s, null, c, { alpha: a, size: 24, hi: i === 0 })
        if (i) arrow(x - 410 + 156, 320, x - 158, 320, E.out(P(t, .7 + i * .8, 1.1 + i * .8)), hexA(C.red, .6), 2.5)
        if (i) travel(x - 410 + 156, 320, x - 158, 320, P(t, .7 + i * .8, 1.2 + i * .8), C.red)
      })
      withA(E.out(P(t, 4.2, 4.7)), () => txt('超过心跳间隔 → follower 认为 leader 失联 → 重新选举 → 短暂不可用', 140, 400, { size: 20, color: C.red }))
      // 终端
      const ta = E.out(P(t, 5.4, 5.9))
      terminal(140, 440, 1000, 420, t, FIO, { size: 21, alpha: ta, cps: 30, title: 'root@mn-192-168-0-1' })
      withA(ta * E.out(P(t, 9, 9.3)), () => { ctx.save(); ctx.fillStyle = hexA(C.green, .12); rr(150, 440 + 92 + 4 * 33.6 - 25, 980, 34, 6); ctx.fill(); ctx.restore() })
      callout(440, 660, 560, 790, 'p99 ≈ 2376 µs ≈ 2.4 ms', P(t, 9.6, 10.6), C.green, { font: MONO })
      // 仪表
      withA(E.out(P(t, 6, 6.5)), () => {
        panel(1180, 440, 600, 420, { r: 18 })
        txt('WAL fsync p99', 1212, 488, { size: 22, color: C.body })
        const v = 2.376 * E.out(P(t, 10.8, 12))
        txt(t >= 10.8 ? v.toFixed(1) + ' ms' : '— ms', 1212, 572, { size: 60, font: MONO, weight: 600, color: t >= 10.8 ? C.green : C.faint })
        const X0 = 1212, X1 = 1748, sc = v => X0 + (X1 - X0) * v / 20
        meter(X0, 614, X1 - X0, 22, v / 20, C.green)
        line(sc(10), 596, sc(10), 652, C.red, 2.5, [6, 5])
        txt('10 ms 合格线', sc(10), 678, { size: 17, color: C.red, align: 'center' })
        txt('0', X0, 678, { size: 16, font: MONO, color: C.mute }); txt('20 ms', X1, 678, { size: 16, font: MONO, color: C.mute, align: 'right' })
        chip('✓ 通过', 1748, 540, { size: 22, col: C.green, solid: true, align: 'right', font: SANS, alpha: E.out(P(t, 12.6, 13)) })
        ;[['--fdatasync=1', '每次写都落盘'], ['--bs=2300', '≈ WAL 条目大小']].forEach(([f, s], i) => {
          const a = E.out(P(t, 7.6 + i * .6, 8 + i * .6)); if (a <= 0) return
          chip(f, 1212, 740 + i * 56, { size: 17, align: 'left', col: COL, alpha: a })
          txt(s, 1400, 746 + i * 56, { size: 19, color: C.body, alpha: a })
        })
      })
    },
  }

  ANIM({
    id: 'cluster-planning',
    meta: { stage: 4, lesson: 1, of: 8, title: '生产集群规划', summary: '节点角色与命名规范、高可用拓扑、网络规划、etcd 磁盘验收。', next: '用 Kubespray 部署高可用集群' },
    scenes: [
      lessonIntro({ tags: ['命名规范', 'etcd 奇数', 'VIP 高可用', '地址规划', 'fio 验收'], vo: [[3.2, '生产集群：动手之前，先把规划做对。']] }),
      naming, quorum, topo, addr, disk,
      lessonOutro({
        points: ['命名：角色前缀 + IP，域名按四层分级', 'etcd 多数派：控制平面 3 / 5 台，最多 7', '地址规划：网段不重叠，Pod CIDR 留余量', 'etcd 磁盘 fio 验收：p99 < 10 ms'],
        vo: [[0.8, '小结：规划做对，集群才能长期稳定。'], [5.6, '下一课，用 Kubespray 部署高可用集群。']],
      }),
    ],
  })
})()
