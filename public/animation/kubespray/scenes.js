/* 第 4 阶段 · 第 2 课：用 Kubespray 部署高可用集群 */
(() => {
  const COL = STAGES[4].color
  const cardA = (t, a, b) => win(t, a, b, .35)

  // 场景 1：Kubespray 做了什么
  const HOSTS = ['mn-192-168-3-21', 'mn-192-168-3-22', 'mn-192-168-3-23', 'cn-192-168-3-50', 'cn-192-168-3-51', 'gn-192-168-3-60']
  const STEPS = ['OS 准备：swap、内核参数', 'containerd 运行时', 'etcd 集群', 'kubeadm init / join', '内部 LB：nginx 静态 Pod', 'CNI · CoreDNS · nodelocaldns', '插件：kube-vip 等']
  const RUN = [
    { t: 5.8, cmd: 'ansible-playbook -i inventory/mycluster/inventory.ini -u root -b cluster.yml' },
    { t: 8.8, out: 'TASK [kubernetes/control-plane : kubeadm | Initialize first control plane node]', color: C.mute },
    { t: 11.2, out: 'PLAY RECAP ****************************************', color: C.text },
    { t: 11.5, out: 'mn-192-168-3-21 : ok=712  changed=148  unreachable=0  failed=0', color: C.green, sfx: 'ok' },
    { t: 11.7, out: 'gn-192-168-3-60 : ok=498  changed=102  unreachable=0  failed=0', color: C.green },
  ]
  const what = {
    name: 'Kubespray 是什么', dur: 16, mood: 1,
    vo: [[0.6, 'Kubespray 是一套 Ansible Playbook。'],
      [5.6, '底层用 kubeadm，一条命令装好整个集群。'],
      [10.8, '它是幂等的：改了配置，再跑一遍即可。']],
    cues: [[0.6, 'whoosh'], [1.0, 'pop'], ...HOSTS.map((_, i) => [1.8 + i * .18, 'tick']), [3.2, 'zap'], ...typeCues(RUN, 30),
      ...STEPS.map((_, i) => [8.6 + i * .38, 'tick']), [12.4, 'chime']],
    draw(t) {
      heading('Kubespray：用 Ansible 部署集群', 140, 210, t, .2, { eyebrow: 'WHAT IT DOES', color: COL })
      // 部署机
      withA(E.out(P(t, .8, 1.3)), () => {
        panel(140, 280, 460, 260, { r: 18, stroke: hexA(COL, .5) })
        txt('部署机', 172, 326, { size: 24, weight: 600 })
        chip('Ansible', 568, 318, { size: 16, col: COL, align: 'right' })
        ;[['inventory.ini', '节点与分组'], ['group_vars/', '集群变量'], ['cluster.yml', '主 Playbook']].forEach(([f, s], i) => {
          const a = E.out(P(t, 1.1 + i * .25, 1.5 + i * .25))
          txt(f, 172, 386 + i * 50, { size: 22, font: MONO, color: C.text, alpha: a })
          txt(s, 568, 386 + i * 50, { size: 18, color: C.mute, align: 'right', alpha: a })
        })
      })
      // 目标节点
      HOSTS.forEach((h, i) => {
        const a = E.out(P(t, 1.8 + i * .18, 2.2 + i * .18)); if (a <= 0) return
        const x = 700 + (i % 3) * 366, y = 280 + Math.floor(i / 3) * 140
        node(x, y, 344, 116, h, { alpha: a, tag: h.slice(0, 2), accent: i < 3 ? COL : C.blue })
        const done = P(t, 8.6, 11.2)
        withA(a, () => {
          meter(x + 22, y + 74, 262, 14, done, C.green)
          if (done >= 1) check(x + 318, y + 81, 22, C.green, P(t, 11.2, 11.6))
        })
      })
      // ssh 连线
      withA(E.out(P(t, 3.2, 3.8)), () => {
        line(600, 410, 690, 410, hexA(COL, .6), 2.5); arrowHead(692, 410, 0, COL, 12)
        txt('SSH', 645, 396, { size: 16, font: MONO, color: COL, align: 'center' })
        if (t > 3.8 && t < 11.4) flow(600, 424, 690, 424, t, COL, 3, 1, 0, 4)
      })
      // 终端
      terminal(140, 580, 1000, 290, t, RUN, { size: 19, alpha: E.out(P(t, 5.4, 5.9)), title: 'deploy — kubespray' })
      // 步骤
      withA(E.out(P(t, 8.2, 8.7)), () => {
        panel(1180, 580, 600, 290, { r: 18 })
        txt('cluster.yml 依次完成', 1210, 620, { size: 19, color: C.mute })
        STEPS.forEach((s, i) => {
          const a = E.out(P(t, 8.6 + i * .38, 8.9 + i * .38)), y = 656 + i * 30
          check(1224, y - 6, 18, C.green, a)
          txt(s, 1248, y, { size: 18, color: a > 0 ? C.text : C.faint, alpha: .4 + .6 * a })
        })
      })
      withA(E.out(P(t, 12.4, 12.9)), () => chip('幂等：再跑一遍 = 只补差异', 1780, 216, { size: 20, col: C.green, align: 'right', font: SANS }))
    },
  }

  // 场景 2：inventory.ini
  const INV = ['[kube_control_plane]', 'mn-192-168-3-21 ansible_host=192.168.3.21 etcd_member_name=etcd1', 'mn-192-168-3-22 ansible_host=192.168.3.22 etcd_member_name=etcd2',
    'mn-192-168-3-23 ansible_host=192.168.3.23 etcd_member_name=etcd3', '', '[etcd:children]', 'kube_control_plane', '', '[kube_node]',
    'cn-192-168-3-50 ansible_host=192.168.3.50', 'cn-192-168-3-51 ansible_host=192.168.3.51', 'gn-192-168-3-60 ansible_host=192.168.3.60']
  const GET = [
    { t: 11.4, cmd: 'kubectl get nodes' },
    { t: 12.3, out: 'NAME              STATUS     ROLES', color: C.mute },
    { t: 12.6, out: 'mn-192-168-3-21   NotReady   control-plane', color: C.text },
    { t: 12.8, out: 'gn-192-168-3-60   NotReady   <none>', color: C.text },
  ]
  const inv = {
    name: 'inventory 规划', dur: 16, mood: 2,
    vo: [[0.6, 'inventory.ini 按分组列出所有节点。', 'inventory 文件按分组列出所有节点。'],
      [5.6, 'etcd 组指向控制平面，就是堆叠式 etcd。'],
      [10.8, '主机名会直接成为 K8s 的 Node 名。', '主机名会直接成为 Kubernetes 的 Node 名。']],
    cues: [[0.6, 'whoosh'], [1.6, 'pop'], [2.2, 'tick'], [2.4, 'tick'], [2.6, 'tick'], [3.6, 'pop'], [5.8, 'zap'], [6.6, 'shimmer'], ...typeCues(GET, 30), [13.4, 'chime']],
    draw(t) {
      heading('inventory.ini：节点与分组', 140, 210, t, .2, { eyebrow: 'INVENTORY', color: COL })
      const hi = t < 5.6 ? [0, 1, 2, 3] : t < 10.8 ? [5, 6] : [1, 9, 10, 11]
      code(140, 280, 880, INV, t, .8, { title: 'inventory/mycluster/inventory.ini', size: 18, step: .1, hi, hiColor: t < 10.8 ? COL : C.blue, h: 460 })
      withA(E.out(P(t, 12.8, 13.3)), () => callout(420, 694, 420, 800, '主机名 → Node 名：mn / cn / gn 一眼可辨', 1, C.blue, { font: SANS, size: 20, align: 'center' }))
      // 分组图
      const ga = E.out(P(t, 1.4, 1.9))
      withA(ga, () => {
        panel(1080, 280, 700, 186, { r: 18, stroke: hexA(COL, .55), fill: tint(COL, .04) })
        chip('kube_control_plane', 1108, 316, { size: 18, col: COL, solid: true, align: 'left' })
      })
      ;[0, 1, 2].forEach(i => {
        const a = E.back(P(t, 2.2 + i * .2, 2.6 + i * .2)); if (a <= 0) return
        const x = 1210 + i * 220
        withA(clamp(a), () => {
          panel(x - 96, 350, 192, 90, { r: 12 })
          txt('mn-…-3-2' + (i + 1), x, 384, { size: 17, font: MONO, align: 'center' })
          chip('etcd' + (i + 1), x, 418, { size: 15, col: COL, alpha: E.out(P(t, 5.8, 6.2)) })
        })
      })
      // 堆叠式 etcd 的虚线外框
      const ea = E.out(P(t, 5.8, 6.4))
      withA(ea, () => {
        panel(1096, 340, 668, 112, { r: 14, fill: 'rgba(0,0,0,0)', stroke: COL, lw: 2.5, dash: [9, 7], shadow: false })
        chip('etcd:children = kube_control_plane', 1764, 322, { size: 16, col: COL, align: 'right' })
      })
      ring(1430, 396, P(t, 6.4, 7.6), COL, 300)
      withA(E.out(P(t, 7.4, 7.9)), () => txt('堆叠式：etcd 与控制平面同机部署', 1080, 500, { size: 21, color: C.body }))
      withA(E.out(P(t, 3.4, 3.9)), () => {
        panel(1080, 530, 700, 136, { r: 18, stroke: hexA(C.blue, .5) })
        chip('kube_node', 1108, 564, { size: 18, col: C.blue, solid: true, align: 'left' })
        ;['cn-…-3-50', 'cn-…-3-51', 'gn-…-3-60'].forEach((s, i) => chip(s, 1210 + i * 220, 622, { size: 18, col: i === 2 ? C.violet : C.blue, alpha: E.out(P(t, 3.6 + i * .2, 4 + i * .2)) }))
      })
      terminal(1080, 694, 700, 176, t, GET, { size: 18, alpha: E.out(P(t, 11, 11.5)), title: 'kubectl' })
    },
  }

  // 场景 3：关键变量
  const VARS = ['# k8s_cluster/k8s-cluster.yml', 'kube_network_plugin: cni', 'kube_proxy_mode: ipvs', 'kube_proxy_strict_arp: true', 'enable_nodelocaldns: true',
    'nodelocaldns_ip: 169.254.25.10', '# all/etcd.yml', 'etcd_quota_backend_bytes: "8589934592"', '# k8s_cluster/addons.yml', 'kube_vip_enabled: true',
    'kube_vip_address: 192.168.3.101', 'kube_vip_interface: eth0']
  const SEG = [
    [.6, 6, [1], 'cni', '不让 Kubespray 装网络方案', ['只装 CNI 基础插件，节点先 NotReady', '之后用 Helm 装 Cilium', '版本与参数由自己的 values.yml 掌控'], C.violet],
    [6, 8.8, [2, 3], 'ipvs + strict_arp', '防止抢答 ARP', ['IPVS 把 ClusterIP 绑到 kube-ipvs0', 'strict_arp → arp_ignore=1 · arp_announce=2', 'kube-vip / MetalLB 的 ARP 宣告才不冲突'], C.blue],
    [8.8, 11.4, [4, 5], 'nodelocaldns', '每个节点一个 DNS 缓存', ['Pod → 169.254.25.10 本机命中', '不经 conntrack 转发到 CoreDNS', '避开偶发 5 秒 DNS 超时'], C.teal],
    [11.4, 14, [7], 'etcd quota', '默认只有 2 GiB', ['写满后报 database space exceeded', '集群进入只读，所有写操作失败', '调到官方建议上限 8 GiB'], C.red],
    [14, 17.4, [9, 10, 11], 'kube-vip', '集群外访问的 VIP', ['VIP 192.168.3.101:6443', '和节点同网段、向网管申请', 'interface 必须写真实网卡名'], COL],
  ]
  const vars = {
    name: '关键变量', dur: 17, mood: 2,
    vo: [[0.6, '网络插件设成 cni，之后用 Helm 装 Cilium。'],
      [6.0, 'strict ARP 防止和 VIP 抢 ARP 应答。', '严格 ARP 模式，防止节点和 VIP 抢 ARP 应答。'],
      [11.4, 'etcd 配额调到 8 GiB，VIP 交给 kube-vip。', 'etcd 配额调到 8 G，VIP 交给 kube vip。']],
    cues: [[0.6, 'whoosh'], ...SEG.map(s => [s[0] + .1, 'pop']), [12.4, 'alarmSoft'], [15, 'chime']],
    draw(t) {
      heading('group_vars：团队实际改动的变量', 140, 210, t, .2, { eyebrow: 'KEY VARIABLES', color: COL })
      const cur = SEG.find(s => t >= s[0] && t < s[1]) || SEG[SEG.length - 1]
      code(140, 280, 880, VARS, t, .5, { title: 'inventory/mycluster/group_vars/', size: 20, step: .08, hi: cur[2], hiColor: cur[6], h: 500 })
      // 进度点
      SEG.forEach((s, i) => { const on = s === cur; withA(E.out(P(t, .8, 1.2)), () => { dot(1100 + i * 30, 820, on ? 8 : 6, on ? s[6] : C.faint, 0) }) })
      SEG.forEach(([a, b, , name, sub, lines, c], i) => {
        const k = cardA(t, a, i === SEG.length - 1 ? 99 : b); if (k <= 0) return
        const dy = lerp(18, 0, E.out(P(t, a, a + .4)))
        withA(k, () => {
          panel(1080, 280 + dy, 700, 500, { r: 20, stroke: hexA(c, .55), lw: 2 })
          chip(name, 1112, 334 + dy, { size: 26, col: c, solid: true, align: 'left' })
          txt(sub, 1112, 420 + dy, { size: 30, weight: 600, color: C.text })
          lines.forEach((l, j) => {
            const la = E.out(P(t, a + .4 + j * .35, a + .8 + j * .35))
            withA(la, () => { dot(1122, 486 + j * 64 + dy, 5, c, 0); txt(l, 1142, 494 + j * 64 + dy, { size: 22, color: C.body, font: /[=:_.]/.test(l) && !/[一-龥]{4}/.test(l) ? MONO : SANS }) })
          })
          // 每项的小图示
          if (i === 3) {
            const q = E.out(P(t, a + 1.2, a + 2.2))
            meter(1112, 730 + dy, 636, 18, lerp(.25, 1, q), q < .5 ? C.red : C.green, { label: 'etcd 配额', value: q < .5 ? '2 GiB' : '8 GiB', size: 18 })
          } else if (i === 1) {
            chip('kube-ipvs0 · 所有 ClusterIP', 1112, 736 + dy, { size: 17, col: C.blue, align: 'left' })
            chip('arp_ignore=1', 1748, 736 + dy, { size: 17, col: C.green, align: 'right', alpha: E.out(P(t, a + 1.5, a + 1.9)) })
          } else if (i === 2) {
            const f = P(t, a + .8, a + 2.2)
            ;[['Pod', 1150], ['169.254.25.10', 1420], ['CoreDNS', 1700]].forEach(([s, x], j) => chip(s, x, 736 + dy, { size: 17, col: j === 1 ? C.teal : C.mute }))
            travel(1180, 736 + dy, 1340, 736 + dy, f, C.teal)
          } else if (i === 0) {
            ;['NotReady', 'NotReady', 'NotReady'].forEach((s, j) => chip(s, 1112 + j * 150, 736 + dy, { size: 17, col: C.amber, align: 'left' }))
            chip('helm install cilium', 1748, 736 + dy, { size: 17, col: C.violet, align: 'right', alpha: E.out(P(t, a + 2, a + 2.4)) })
          } else {
            chip('eth0', 1112, 736 + dy, { size: 17, col: COL, align: 'left' })
            chip('✕ 写成 ens33 却不存在 → VIP 起不来', 1190, 736 + dy, { size: 17, col: C.red, align: 'left', font: SANS, alpha: E.out(P(t, a + 1.6, a + 2)) })
          }
        })
      })
    },
  }

  // 场景 4：GPU 装箱调度
  const gpuPanel = (t, x, title, sub, col, a0, place, jobNode, tJob, ok) => {
    const a = E.out(P(t, a0, a0 + .5)); if (a <= 0) return
    withA(a, () => {
      panel(x, 280, 800, 590, { r: 18, stroke: hexA(col, .5) })
      chip(title, x + 32, 322, { size: 22, col, solid: true, align: 'left' })
      txt(sub, x + 768, 330, { size: 19, color: C.mute, align: 'right' })
    })
    const used = [[], [], []]
    place.forEach(([n, t0]) => { if (t >= t0) used[n].push(t0) })
    ;[0, 1, 2].forEach(n => {
      const y = 364 + n * 128
      node(x + 32, y, 736, 110, 'gn-192-168-3-6' + n, { alpha: a, tag: '8 × GPU', accent: C.violet })
      for (let k = 0; k < 8; k++) {
        const t0 = used[n][k], jb = jobNode === n && t >= tJob + .6
        const on = t0 != null, s = on ? E.back(P(t, t0, t0 + .35)) : 0
        const c = jb ? C.green : on ? C.violet : C.faint
        gpu(x + 90 + k * 86, y + 76, 34 * (on || jb ? lerp(.7, 1, clamp(jb ? E.back(P(t, tJob + .6 + k * .05, tJob + 1 + k * .05)) : s)) : 1), c, a)
      }
    })
    // 8 卡任务
    const ja = E.out(P(t, tJob - .6, tJob - .1)); if (ja <= 0) return
    withA(ja, () => {
      const jx = x + 400, jy = 802
      panel(x + 32, jy - 36, 736, 72, { r: 14, stroke: hexA(ok ? C.green : C.red, t >= tJob + .6 ? .8 : .3), fill: t >= tJob + .6 ? tint(ok ? C.green : C.red, .06) : C.panel })
      txt('训练任务 · nvidia.com/gpu: 8', x + 60, jy + 8, { size: 20, font: MONO })
      if (t >= tJob + .6) chip(ok ? 'Running ✓ 整机 8 卡' : 'Pending ✕ 没有整机空闲', x + 748, jy, { size: 18, col: ok ? C.green : C.red, solid: true, align: 'right', font: SANS })
      if (!ok) [0, 1, 2].forEach(n => { const y = 364 + n * 128 + 76; if (t > tJob && t < tJob + .9) travel(jx, jy - 36, x + 700, y, P(t, tJob, tJob + .6), C.red, 6) })
      else travel(jx, jy - 36, x + 400, 364 + jobNode * 128 + 76, P(t, tJob, tJob + .6), C.green, 8)
    })
  }
  const LEAST = [0, 1, 2, 3, 4, 5].map(k => [k % 3, 1.4 + k * .55])
  const MOST = [0, 1, 2, 3, 4, 5].map(k => [0, 10.8 + k * .28])
  const pack = {
    name: 'GPU 装箱调度', dur: 16, mood: 3,
    vo: [[0.6, '默认的 LeastAllocated 会把 Pod 打散。'],
      [5.6, '6 个单卡任务一分散，8 卡任务就没地方了。'],
      [10.6, '改成 MostAllocated 装箱，整机留给大任务。']],
    cues: [[0.6, 'whoosh'], ...LEAST.map(p => [p[1], 'pop']), [6.2, 'whoosh'], [6.8, 'error'], [10.4, 'pop'], ...MOST.map(p => [p[1], 'tick']), [13.4, 'whoosh'], [14, 'ok']],
    draw(t) {
      heading('GPU 集群：从打散到装箱', 140, 210, t, .2, { eyebrow: 'BIN PACKING', color: COL })
      gpuPanel(t, 140, 'LeastAllocated', '默认 · 打散', C.red, .6, LEAST, -1, 6.2, false)
      gpuPanel(t, 980, 'MostAllocated', 'nvidia.com/gpu weight: 5', C.green, 10.2, MOST, 1, 13.4, true)
      withA(E.out(P(t, 7.8, 8.3)) * (1 - E.out(P(t, 10, 10.4))), () => {
        panel(980, 420, 800, 260, { r: 18, fill: tint(C.red, .04), stroke: hexA(C.red, .4), dash: [8, 7], shadow: false })
        txt('每台都有 6 张空卡', 1380, 520, { size: 30, weight: 600, align: 'center' })
        txt('却没有一台能放下 8 卡任务：资源碎片', 1380, 574, { size: 22, color: C.red, align: 'center' })
      })
    },
  }

  // 场景 5：日常运维
  const OPS = [
    ['增量更新', ['cluster.yml --tags=coredns,nodelocaldns'], '只跑相关角色，几分钟完成', C.blue, .6],
    ['扩容 worker', ['playbooks/facts.yml', 'scale.yml --limit=gn-192-168-3-61'], '先刷新 facts，再只动新节点', C.green, 5.4],
    ['扩容控制平面', ['recover-control-plane.yml'], '新节点放进 broken_etcd 等分组 · 先备份 etcd', C.violet, 8.2],
    ['reset.yml', ['删 /etc/kubernetes · /var/lib/etcd'], '生产 inventory 上执行 = 删掉整个集群', C.red, 11],
  ]
  const ops = {
    name: '扩容与重置', dur: 17, mood: 4,
    vo: [[0.6, '改了配置用 --tags，只跑相关部分。', '改了配置用 tags 参数，只跑相关部分。'],
      [5.4, '扩 worker 用 scale，扩控制平面用 recover。', '扩 worker 用 scale，扩控制平面用 recover。'],
      [11.0, 'reset 会清空 etcd，生产环境千万慎用。']],
    cues: [[0.6, 'whoosh'], ...OPS.map(o => [o[4] + .2, 'pop']), [6.6, 'ok'], [9.4, 'shimmer'], [11.4, 'alarm'], [12.6, 'poof']],
    draw(t) {
      heading('Day 2：增量更新、扩容与重置', 140, 210, t, .2, { eyebrow: 'DAY-2 OPS', color: COL })
      const cur = OPS.findIndex((o, i) => t >= o[4] && (i === 3 || t < OPS[i + 1][4]))
      OPS.forEach(([n, cmds, note, c, t0], i) => {
        const a = E.out(P(t, t0, t0 + .5)); if (a <= 0) return
        const x = 140 + (i % 2) * 840, y = 280 + Math.floor(i / 2) * 310, on = cur === i
        const sh = i === 3 && t > 11.4 && t < 12 ? Math.sin(t * 90) * 5 : 0
        withA(a * (on ? 1 : .6), () => {
          panel(x + sh, y + lerp(18, 0, a), 800, 280, { r: 18, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
          txt(n, x + 32, y + 56, { size: 28, weight: 600, font: i === 3 ? MONO : SANS, color: i === 3 ? C.red : C.text })
          cmds.forEach((s, j) => chip(s, x + 32, y + 110 + j * 50, { size: 19, col: c, align: 'left' }))
          txt(note, x + 32, y + 244, { size: 21, color: i === 3 ? C.red : C.body })
        })
        // 图示
        const vx = x + 620, vy = y + 150
        if (i === 0) withA(a, () => { ['etcd', 'coredns', 'nodelocaldns', 'cni'].forEach((s, k) => { const hot = k === 1 || k === 2; chip(s, vx + 60, vy - 70 + k * 36, { size: 15, col: hot ? c : C.faint, solid: hot && on }) }) })
        if (i === 1) withA(a, () => {
          for (let k = 0; k < 3; k++) { ctx.save(); ctx.fillStyle = tint(C.blue, .2); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; rr(vx - 20 + k * 50, vy - 40, 40, 40, 8); ctx.fill(); ctx.stroke(); ctx.restore() }
          const q = E.back(P(t, 6.4, 6.9))
          withA(clamp(q), () => { ctx.save(); ctx.fillStyle = tint(C.green, .25); ctx.strokeStyle = C.green; ctx.lineWidth = 2.5; rr(vx + 5, vy + 16, 60 * q, 40, 8); ctx.fill(); ctx.stroke(); ctx.restore() })
          chip('+ gn-…-61', vx + 36, vy + 86, { size: 15, col: C.green, alpha: E.out(P(t, 6.8, 7.2)) })
        })
        if (i === 2) withA(a, () => {
          const q = E.out(P(t, 9.2, 10))
          ;[0, 1, 2].forEach(k => { const ang = -Math.PI / 2 + k * 2 * Math.PI / 3, r = 46; const px = vx + 40 + Math.cos(ang) * r, py = vy + Math.sin(ang) * r
            withA(k === 0 ? 1 : q, () => { dot(px, py, 16, k === 0 ? c : tint(c, .5), 0); txt('mn', px, py + 6, { size: 14, font: MONO, color: '#fff', align: 'center' }) }) })
          ring(vx + 40, vy, P(t, 9.8, 10.8), c, 90)
          txt('1 → 3', vx + 40, vy + 94, { size: 17, font: MONO, color: c, align: 'center', alpha: q })
        })
        if (i === 3) withA(a, () => {
          const q = P(t, 12.4, 13.2)
          ;[0, 1, 2].forEach(k => { const px = vx + k * 44, py = vy - 10
            withA(1 - q, () => { ctx.save(); ctx.fillStyle = tint(C.red, .2); ctx.strokeStyle = C.red; ctx.lineWidth = 2; rr(px - 18, py - 18, 36, 36, 7); ctx.fill(); ctx.stroke(); ctx.restore() })
            poof(px, py, q, C.red) })
          chip('只删一个节点：remove-node.yml', vx + 140, vy + 60, { size: 15, col: C.green, align: 'right', font: SANS, alpha: E.out(P(t, 13.4, 13.8)) })
        })
      })
    },
  }

  ANIM({
    id: 'kubespray',
    meta: { stage: 4, lesson: 2, of: 8, title: '用 Kubespray 部署高可用集群', summary: 'inventory 规划、关键变量、kube-vip、离线部署、扩容与重置。', next: '生产网络：Cilium、MetalLB 与证书' },
    scenes: [
      lessonIntro({ tags: ['Ansible', 'inventory', 'group_vars', 'MostAllocated', 'scale.yml'], vo: [[3.2, 'Kubespray：一条命令部署高可用集群。']] }),
      what, inv, vars, pack, ops,
      lessonOutro({
        points: ['Kubespray = Ansible + kubeadm，幂等可重跑', 'inventory：主机名即 Node 名，etcd 堆叠', 'cni + strict_arp + nodelocaldns + kube-vip', '--tags 增量、scale 扩容、reset 慎用'],
        vo: [[0.8, '小结：变量想清楚，部署只是一条命令。'], [5.6, '下一课，装 Cilium、MetalLB 和证书。']],
      }),
    ],
  })
})()
