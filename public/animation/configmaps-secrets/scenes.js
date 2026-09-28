/* 第 1 阶段 · 第 6 课：ConfigMap 与 Secret */
(() => {
  const COL = STAGES[1].color

  // 场景 1：镜像与配置解耦
  const IMGS = ['app:dev', 'app:test', 'app:prod']
  const ENVS = [['dev', 'debug', 'db.dev', C.teal], ['test', 'info', 'db.test', C.amber], ['prod', 'warn', 'db.prod', C.violet]]
  const MAKE = [
    ['apply -f app-config.yaml', '声明式 · 推荐', 'YAML 进 Git，值可以是整个文件'],
    ['--from-literal', 'KEY=VALUE 字面值', 'LOG_LEVEL=debug  REGION=cn'],
    ['--from-file', '键 = 文件名，值 = 内容', 'nginx.conf  ·  ./conf.d/'],
    ['--from-env-file', '每行 KEY=VALUE 一个键', 'db.env → DB_HOST、DB_PORT'],
  ]
  const decouple = {
    name: '镜像与配置解耦', dur: 16, mood: 1,
    vo: [[0.6, '配置打进镜像，每个环境就得一个镜像。'],
      [5.6, '配置进 ConfigMap，密码进 Secret。'],
      [10.8, '可以写 YAML 声明，也能从文件直接生成。']],
    cues: [[0.4, 'whoosh'], [0.8, 'pop'], ...IMGS.map((_, i) => [1.4 + i * .3, 'pop']), [2.6, 'error'], [3.0, 'tick'], [3.8, 'zap'], [4.3, 'alarmSoft'],
      [5.8, 'whoosh'], ...ENVS.map((_, i) => [6.3 + i * .3, 'pop']), ...ENVS.map((_, i) => [7.3 + i * .3, 'tick']), [9.4, 'ok'], ...MAKE.map((_, i) => [11.0 + i * .5, 'pop']), [13.4, 'chime']],
    draw(t, T) {
      heading('同一个镜像，配置随环境注入', 140, 210, t, .2, { eyebrow: 'DECOUPLE CONFIG', color: COL })
      // A：配置打进镜像 / 密码写进 YAML
      const aA = E.out(P(t, .5, 1)) * (1 - E.out(P(t, 5.2, 5.7)))
      withA(aA, () => {
        doc(250, 510, 190, 130, 'Dockerfile', C.amber, { sub: 'COPY app.conf', ext: ' ', alpha: E.out(P(t, .7, 1.1)) })
        IMGS.forEach((s, i) => {
          const k = E.back(P(t, 1.4 + i * .3, 1.8 + i * .3)); if (k <= 0) return
          const y = 410 + i * 100
          arrow(350, 510, 506, y, E.out(P(t, 1.3 + i * .3, 1.7 + i * .3)), hexA(C.amber, .6), 2)
          box(640, y, 250, 72, s, null, C.amber, { size: 24, alpha: clamp(k) })
        })
        withA(E.out(P(t, 2.6, 3.0)), () => chip('改一个参数 → 重新构建、发布', 640, 730, { size: 20, font: SANS, col: C.red }))
        code(1000, 390, 440, ['containers:', '- image: app:1.4', '  env:', '  - value: "S3cr3t!"'], t, 2.8, { title: 'deploy.yaml', size: 20, step: .1, hi: t > 3.3 ? [3] : [], hiColor: C.red, alpha: E.out(P(t, 2.8, 3.2)) })
        arrow(1450, 500, 1560, 500, E.out(P(t, 3.8, 4.2)), C.red, 2.5)
        travel(1450, 500, 1560, 500, P(t, 3.8, 4.3), C.red, 6)
        withA(E.out(P(t, 4.0, 4.4)), () => {
          chip('Git 仓库', 1660, 500, { size: 22, font: SANS, col: C.text })
          txt('密码进了 Git 历史', 1660, 560, { size: 20, color: C.red, align: 'center' })
        })
        cross(1505, 460, 26, C.red, E.out(P(t, 4.3, 4.6)))
      })
      // B：一个镜像 + 各环境 ConfigMap / Secret
      const aB = E.out(P(t, 5.6, 6.1))
      withA(aB, () => {
        box(300, 431, 260, 110, 'app:1.4', '同一个镜像', COL, { hi: t > 9.4 && t < 10.8 })
        ENVS.forEach(([env, lv, db, c], i) => {
          const y = 333 + i * 98, k = E.out(P(t, 6.2 + i * .3, 6.7 + i * .3)); if (k <= 0) return
          arrow(432, 431, 612, y, k, hexA(COL, .5), 2)
          if (t > 7) flow(432, 431, 612, y, t, COL, 2, .5, i * .3, 3.5)
          withA(k, () => {
            panel(620 + lerp(30, 0, k), y - 43, 1160, 86, { r: 16, stroke: hexA(c, .45) })
            chip(env, 648, y, { size: 20, align: 'left', col: c, solid: true })
            pod(790, y, 60, { state: 'run', scale: E.back(P(t, 6.3 + i * .3, 6.8 + i * .3)) })
          })
          const m = E.out(P(t, 7.3 + i * .3, 7.8 + i * .3))
          withA(m, () => {
            chip('ConfigMap', 870, y, { size: 18, align: 'left', col: C.teal })
            txt('LOG_LEVEL=', 1020, y + 7, { size: 20, font: MONO, color: C.mute })
            txt(lv, 1020 + textW('LOG_LEVEL=', 20, { font: MONO }), y + 7, { size: 20, font: MONO, color: c, weight: 600 })
            txt('DB_HOST=', 1250, y + 7, { size: 20, font: MONO, color: C.mute })
            txt(db, 1250 + textW('DB_HOST=', 20, { font: MONO }), y + 7, { size: 20, font: MONO, color: c, weight: 600 })
          })
          const s = E.out(P(t, 8.2 + i * .3, 8.7 + i * .3))
          withA(s, () => {
            lock(1520, y - 2, 24, C.violet)
            chip('Secret · db-cred', 1548, y, { size: 18, align: 'left', col: C.violet })
          })
        })
      })
      // C：创建方式
      withA(E.out(P(t, 10.8, 11.2)), () => {
        txt('创建 ConfigMap', 140, 686, { size: 24, weight: 600 })
        chip('值都是字符串 · 单个 ≤ 1 MiB', 1780, 678, { size: 18, font: SANS, align: 'right', col: C.amber })
      })
      MAKE.forEach(([cmd, d, sub], i) => {
        const a = E.out(P(t, 11.0 + i * .5, 11.5 + i * .5)); if (a <= 0) return
        const x = 140 + i * 417, y = 716 + lerp(20, 0, a)
        withA(a, () => {
          panel(x, y, 388, 156, { r: 16, stroke: i === 0 ? hexA(COL, .6) : C.hair, fill: i === 0 ? tint(COL, .05) : C.panel })
          chip(cmd, x + 24, y + 42, { size: 18, align: 'left', col: i === 0 ? COL : C.teal, solid: i === 0 })
          txt(d, x + 26, y + 100, { size: 22, color: C.text, weight: 600 })
          txt(sub, x + 26, y + 134, { size: 17, font: MONO, color: C.mute })
        })
      })
    },
  }

  // 场景 2：环境变量注入
  const ENV_YAML = ['env:', '  - name: LOG_LEVEL', '    valueFrom:', '      configMapKeyRef:', '        name: app-config', '        key: LOG_LEVEL', 'envFrom:', '  - configMapRef:', '      name: demo-env', '    prefix: CFG_']
  const envInject = {
    name: '环境变量注入', dur: 16, mood: 2,
    vo: [[0.6, 'configMapKeyRef 取单个键，名字还能改。', 'config map key ref 取单个键，变量名还能改。'],
      [5.6, 'envFrom 整个导入，可以加 CFG_ 前缀。', 'env from 整个导入，还可以加上 CFG 前缀。'],
      [10.8, '引用不存在又没 optional，容器起不来。', '引用的键不存在，又没标 optional，容器就起不来。']],
    cues: [[0.4, 'whoosh'], [1.0, 'pop'], [1.4, 'pop'], [2.2, 'zap'], [2.9, 'tick'], [4.0, 'pop'], [6.0, 'pop'], [6.6, 'zap'], [7.3, 'tick'], [7.7, 'tick'], [8.6, 'pop'], [11.0, 'pop'], [11.5, 'error'], [12.6, 'pop'], [13.1, 'ok'], [14.0, 'tick']],
    draw(t, T) {
      heading('方式一：注入环境变量', 140, 210, t, .2, { eyebrow: 'ENV · ENVFROM', color: COL })
      const hi = t < 1.4 ? [] : t < 5.6 ? [1, 2, 3, 4, 5] : t < 10.8 ? [6, 7, 8, 9] : []
      code(140, 270, 740, ENV_YAML, t, .6, { title: 'env-demo.yaml · containers[0]', size: 20, step: .08, hi, hiColor: t < 5.6 ? COL : C.teal })
      withA(E.out(P(t, 4.0, 4.4)) * (1 - E.out(P(t, 5.4, 5.8))), () => chip('name 可以和 key 不同', 866, 398, { size: 16, font: SANS, align: 'right', col: COL }))
      // ConfigMap 卡片
      const card = (y, h, title, rows, a, hiRow) => withA(a, () => {
        panel(950, y, 360, h, { r: 16, stroke: hexA(C.teal, .5) })
        chip(title, 972, y + 36, { size: 17, align: 'left', col: C.teal, solid: true })
        rows.forEach((r, i) => {
          const ry = y + 92 + i * 42, on = hiRow(i)
          if (on) { ctx.save(); ctx.fillStyle = tint(C.teal, .14); ctx.fillRect(952, ry - 26, 356, 38); ctx.restore() }
          txt(r, 976, ry, { size: 19, font: MONO, color: on ? C.text : C.body })
        })
      })
      card(280, 210, 'ConfigMap · app-config', ['LOG_LEVEL: info', 'FEATURE_NEW_UI: "true"', 'app.properties: |'], E.out(P(t, 1.0, 1.4)), i => i === 0 && t > 1.8 && t < 5.6)
      card(520, 160, 'ConfigMap · demo-env', ['DB_HOST: db.example.com', 'DB_PORT: "5432"'], E.out(P(t, 1.4, 1.8)), () => t > 6.0 && t < 10.8)
      // 容器里的环境变量
      withA(E.out(P(t, 1.6, 2.0)), () => {
        panel(1420, 280, 360, 400, { r: 16, stroke: hexA(C.green, .5) })
        chip('Pod · env-demo', 1444, 316, { size: 17, align: 'left', col: C.green, solid: true })
        txt('$ env', 1756, 322, { size: 16, font: MONO, color: C.mute, align: 'right' })
        line(1420, 346, 1780, 346, C.hair, 1)
      })
      travel(1310, 372, 1440, 398, P(t, 2.2, 2.9), COL, 6)
      const EV = [['', 'LOG_LEVEL=info', 2.9], ['', 'CFG_DB_HOST=db.example.com', 7.3], ['', 'CFG_DB_PORT=5432', 7.7]]
      EV.forEach(([_, s, t0], i) => {
        const a = E.out(P(t, t0, t0 + .3)); if (a <= 0) return
        const y = 404 + i * 46
        if (s.startsWith('CFG_')) {
          txt('CFG_', 1444, y, { size: 19, font: MONO, color: C.teal, weight: 700, alpha: a })
          txt(s.slice(4), 1444 + textW('CFG_', 19, { font: MONO, weight: 700 }), y, { size: 19, font: MONO, color: C.text, alpha: a })
        } else txt(s, 1444, y, { size: 19, font: MONO, color: C.text, alpha: a })
      })
      travel(1310, 612, 1440, 444, P(t, 6.6, 7.3), C.teal, 6)
      travel(1310, 654, 1440, 490, P(t, 6.9, 7.7), C.teal, 6)
      withA(E.out(P(t, 8.6, 9.0)), () => {
        txt('envFrom 导入全部键', 1600, 596, { size: 18, color: C.body, align: 'center' })
        txt('非法变量名的键会被跳过', 1600, 628, { size: 17, color: C.amber, align: 'center' })
        txt('（如 app.properties）', 1600, 654, { size: 16, font: MONO, color: C.mute, align: 'center' })
      })
      // 引用不存在
      const ba = E.out(P(t, 10.8, 11.2))
      withA(ba, () => {
        panel(140, 716, 1640, 164, { r: 18, stroke: hexA(C.red, .35), fill: tint(C.red, .03) })
        line(900, 736, 900, 860, C.hair, 1.5)
        txt('key: NOT_EXIST', 176, 777, { size: 21, font: MONO, color: C.text })
        arrow(376, 770, 450, 770, E.out(P(t, 11.1, 11.4)), hexA(C.red, .6), 2)
        pod(490, 770, 46, { state: 'fail', scale: E.back(P(t, 11.2, 11.6)), shake: t > 11.5 && t < 11.9 ? Math.sin(t * 60) * 3 : 0 })
        chip('CreateContainerConfigError', 530, 770, { size: 18, align: 'left', col: C.red, solid: true, alpha: E.out(P(t, 11.5, 11.8)) })
      })
      withA(E.out(P(t, 12.6, 13.0)), () => {
        txt('optional: true', 176, 841, { size: 21, font: MONO, color: C.green })
        arrow(376, 834, 450, 834, E.out(P(t, 12.8, 13.1)), hexA(C.green, .6), 2)
        pod(490, 834, 46, { state: 'run', scale: E.back(P(t, 12.9, 13.3)) })
        chip('Running', 530, 834, { size: 18, align: 'left', col: C.green, solid: true, alpha: E.out(P(t, 13.1, 13.4)) })
        txt('缺的键直接忽略', 648, 841, { size: 19, color: C.body, alpha: E.out(P(t, 13.1, 13.4)) })
      })
      withA(E.out(P(t, 14.0, 14.5)), () => {
        txt('引用的 ConfigMap 或键不存在', 936, 776, { size: 22, weight: 600 })
        txt('又没标 optional → Pod 卡在创建容器阶段', 936, 814, { size: 20, color: C.body })
        txt('kubectl describe pod  看 Events', 936, 852, { size: 18, font: MONO, color: C.mute })
      })
    },
  }

  // 场景 3：卷挂载与 ..data
  const LINKS = ['LOG_LEVEL', 'FEATURE_NEW_UI', 'app.properties']
  const volume = {
    name: '卷挂载与 ..data', dur: 16, mood: 2,
    vo: [[0.6, '卷挂载时，每个键变成目录里的一个文件。'],
      [5.6, '改配置后，kubelet 写新目录，再切换 ..data。', '改了配置，kubelet 写入新目录，再原子地切换 data 链接。'],
      [10.8, '挂载会遮住原目录；subPath 不跟随更新。', '挂载会遮住原来的目录；subPath 则不会跟着更新。']],
    cues: [[0.4, 'whoosh'], [0.9, 'pop'], [1.6, 'zap'], ...LINKS.map((_, i) => [2.2 + i * .3, 'tick']), [3.4, 'pop'], [3.9, 'pop'], [5.8, 'pop'], [6.6, 'pop'], [8.0, 'zap'], [8.6, 'ok'], [11.0, 'pop'], [11.8, 'whoosh'], [12.8, 'pop'], [13.6, 'error']],
    draw(t, T) {
      heading('方式二：挂成文件', 140, 210, t, .2, { eyebrow: 'VOLUME · ..DATA', color: COL })
      box(290, 370, 280, 100, 'app-config', 'ConfigMap', C.teal, { alpha: E.out(P(t, .7, 1.1)), hi: t > 5.8 && t < 7 })
      arrow(432, 370, 612, 370, E.out(P(t, 1.4, 1.8)), hexA(C.teal, .6), 2.5)
      if (t > 1.8) flow(432, 370, 612, 370, t, C.teal, 3, .6, 0, 4)
      withA(E.out(P(t, 1.5, 1.9)), () => txt('volume', 522, 350, { size: 17, font: MONO, color: C.mute, align: 'center' }))
      const swap = E.inOut(P(t, 8.0, 8.6))
      withA(E.out(P(t, 1.6, 2.0)), () => {
        panel(620, 270, 1160, 370, { r: 18 })
        chip('mountPath: /etc/app', 648, 306, { size: 17, align: 'left', col: COL })
        txt('$ ls -la /etc/app', 668 + textW('mountPath: /etc/app', 17, { font: MONO }) + 50, 312, { size: 16, font: MONO, color: C.mute })
      })
      LINKS.forEach((s, i) => {
        const a = E.out(P(t, 2.2 + i * .3, 2.6 + i * .3)); if (a <= 0) return
        const y = 390 + i * 70, w = textW(s, 21, { font: MONO })
        txt(s, 668, y + 7, { size: 21, font: MONO, color: C.text, alpha: a })
        arrow(680 + w, y, 1004, 450, E.out(P(t, 2.9 + i * .15, 3.4 + i * .15)), hexA(COL, .45), 2, [6, 5])
      })
      withA(E.out(P(t, 3.3, 3.6)), () => {
        chip('..data', 1060, 450, { size: 20, col: COL, solid: true })
        txt('符号链接', 1060, 494, { size: 17, color: C.mute, align: 'center' })
      })
      // 时间戳目录
      const dir = (y, name, lv, port, a, cur, tag, tc) => withA(a, () => {
        panel(1240, y, 510, 140, { r: 14, stroke: cur ? hexA(C.green, .6) : C.hair, fill: cur ? tint(C.green, .05) : C.panel })
        txt(name, 1264, y + 40, { size: 18, font: MONO, weight: 600, color: C.text })
        chip(tag, 1728, y + 34, { size: 16, font: SANS, align: 'right', col: tc })
        txt('LOG_LEVEL → ' + lv, 1264, y + 84, { size: 18, font: MONO, color: C.body })
        txt('app.properties → ' + port, 1264, y + 118, { size: 18, font: MONO, color: C.body })
      })
      dir(300, '..2026_09_23_06_10_12', 'info', 'server.port=8080', E.out(P(t, 3.6, 4.0)) * lerp(1, .45, swap), swap < .5, swap < .5 ? '当前' : '旧 · 稍后清理', swap < .5 ? C.green : C.mute)
      dir(480, '..2026_09_23_06_12_40', 'debug', 'server.port=9090', E.out(P(t, 6.6, 7.0)), swap >= .5, swap >= .5 ? '当前' : '新 · 写入中', swap >= .5 ? C.green : C.amber)
      if (t > 3.9) {
        const ty = lerp(370, 550, swap)
        arrow(1110, 450, 1234, ty, E.out(P(t, 3.9, 4.3)), COL, 3)
        if (swap > 0 && swap < 1) ring(1060, 450, P(t, 8.0, 8.9), COL, 90)
      }
      // 左侧：修改流程
      withA(E.out(P(t, 5.8, 6.2)), () => chip('kubectl patch cm app-config', 290, 470, { size: 17, col: C.amber }))
      travel(290, 488, 1240, 550, P(t, 6.0, 6.6), C.amber, 6)
      withA(E.out(P(t, 6.6, 7.0)), () => txt('① kubelet 写入新目录', 160, 540, { size: 20, color: C.body }))
      withA(E.out(P(t, 8.2, 8.6)), () => txt('② 原子切换 ..data', 160, 578, { size: 20, color: COL, weight: 600 }))
      withA(E.out(P(t, 8.8, 9.2)), () => txt('通常一分钟左右内生效', 160, 614, { size: 17, color: C.mute }))
      // 两个坑
      const wa = E.out(P(t, 10.8, 11.2))
      withA(wa, () => {
        panel(140, 680 + lerp(20, 0, wa), 800, 190, { r: 18, stroke: hexA(C.amber, .5) })
        txt('挂载会遮住整个目录', 176, 728, { size: 23, weight: 600, color: C.amber })
        txt('mountPath: /etc/nginx', 904, 728, { size: 18, font: MONO, color: C.mute, align: 'right' })
        const cover = E.inOut(P(t, 11.8, 12.4))
        ;['nginx.conf', 'mime.types', 'conf.d/'].forEach((s, i) => chip(s, 176 + i * 160, 792, { size: 18, align: 'left', alpha: lerp(1, .3, cover) }))
        if (cover > 0) {
          ctx.save(); ctx.globalAlpha *= .92; rr(166, 766, lerp(0, 490, cover), 52, 12); ctx.fillStyle = tint(C.teal, .16); ctx.fill(); ctx.strokeStyle = hexA(C.teal, .6); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
          txt('ConfigMap 挂载点', 410, 799, { size: 19, color: C.teal, weight: 600, align: 'center', alpha: P(cover, .6, 1) })
        }
        txt('原来的文件都“消失”了', 690, 799, { size: 19, color: C.red, alpha: E.out(P(t, 12.4, 12.8)) })
        txt('只想放一个文件：用 subPath，或挂到独立目录', 176, 848, { size: 19, color: C.body, alpha: E.out(P(t, 12.6, 13.0)) })
      })
      const sa = E.out(P(t, 12.8, 13.2))
      withA(sa, () => {
        panel(980, 680 + lerp(20, 0, sa), 800, 190, { r: 18, stroke: hexA(C.violet, .5) })
        txt('subPath：只挂单个文件', 1016, 728, { size: 23, weight: 600, color: C.violet })
        txt('/opt/app.properties', 1016, 799, { size: 20, font: MONO, color: C.text })
        arrow(1262, 792, 1322, 792, 1, hexA(C.violet, .6), 2)
        chip('server.port=8080', 1332, 792, { size: 18, align: 'left', col: C.amber })
        txt('不跟随 ..data 切换', 1566, 799, { size: 19, color: C.red, alpha: E.out(P(t, 13.6, 14.0)) })
        txt('绑定的是某一时刻的旧文件，要重启 Pod', 1016, 848, { size: 19, color: C.body, alpha: E.out(P(t, 13.8, 14.2)) })
      })
    },
  }

  // 场景 4：改了配置会怎样
  const CHK = [
    { t: .9, cmd: 'kubectl patch cm app-config -p \'{"data":{…}}\'' },
    { t: 2.6, out: 'configmap/app-config patched', color: C.green },
    { t: 3.0, cmd: 'kubectl exec volume-demo -- cat /etc/app/LOG_LEVEL' },
    { t: 5.2, out: 'debug              # 约一分钟后', color: C.green, sfx: 'ok' },
    { t: 5.8, cmd: 'kubectl exec volume-demo -- cat /opt/app.properties' },
    { t: 7.8, out: 'server.port=8080   # 还是旧值', color: C.red, sfx: 'error' },
    { t: 8.3, cmd: 'kubectl exec env-demo -- printenv LOG_LEVEL' },
    { t: 9.9, out: 'info               # 还是旧值', color: C.red, sfx: 'error' },
  ]
  const ROWS = [['卷挂载（整个目录）', 'kubelet 定期同步', '会 · 有延迟', C.green, 5.2], ['subPath 挂载', '绑定了旧文件', '不会', C.red, 7.8], ['env / envFrom', '只在容器启动时读一次', '不会', C.red, 9.9]]
  const update = {
    name: '改了配置会怎样', dur: 17, mood: 3,
    vo: [[0.6, '改完 ConfigMap，三种注入方式表现不同。'],
      [5.6, '卷挂载会更新，subPath 和 env 不会。', '卷挂载会更新，subPath 和环境变量都不会。'],
      [10.6, '稳妥做法：滚动重启，或换个新名字。', '稳妥的做法是滚动重启；或者设成 immutable，每次换个新名字。']],
    cues: [[0.4, 'whoosh'], ...typeCues(CHK, 30), [1.2, 'pop'], [10.8, 'pop'], ...[0, 1, 2].map(i => [11.6 + i * .6, 'poof']), [13.6, 'chime'], [13.4, 'pop'], [14.2, 'error'], [14.8, 'zap'], [15.4, 'ok']],
    draw(t, T) {
      heading('改了配置，Pod 里什么时候变？', 140, 210, t, .2, { eyebrow: 'HOT RELOAD', color: COL })
      terminal(140, 270, 920, 390, t, CHK, { size: 20, alpha: E.out(P(t, .4, .9)) })
      // 对照表
      withA(E.out(P(t, 1.0, 1.4)), () => {
        panel(1090, 270, 690, 390, { r: 18 })
        txt('注入方式', 1120, 324, { size: 18, color: C.mute })
        txt('修改后是否更新', 1756, 324, { size: 18, color: C.mute, align: 'right' })
        line(1090, 346, 1780, 346, C.hair, 1)
      })
      ROWS.forEach(([n, s, r, c, t0], i) => {
        const a = E.out(P(t, 1.2 + i * .2, 1.6 + i * .2)); if (a <= 0) return
        const y = 400 + i * 100, on = t >= t0, cur = on && t < t0 + 2.4 && t < 10.6
        withA(a, () => {
          if (cur) { ctx.save(); ctx.fillStyle = tint(c, .1); ctx.fillRect(1092, y - 50, 686, 98); ctx.restore() }
          if (i) line(1110, y - 50, 1760, y - 50, C.hair, 1)
          txt(n, 1120, y - 2, { size: 22, weight: 600 })
          txt(s, 1120, y + 28, { size: 17, color: C.mute })
          if (on) {
            const k = E.back(P(t, t0, t0 + .4))
            withA(clamp(k), () => chip(r, 1756, y, { size: 20, font: SANS, align: 'right', col: c, solid: true }))
            const ix = 1756 - textW(r, 20) - 24 - 30
            if (c === C.green) check(ix, y, 28, C.green, P(t, t0, t0 + .4)); else cross(ix, y, 20, C.red, clamp(k))
          } else chip('?', 1756, y, { size: 20, align: 'right' })
        })
      })
      // 做法一：滚动重启
      const la = E.out(P(t, 10.6, 11.0))
      withA(la, () => {
        panel(140, 690 + lerp(20, 0, la), 800, 190, { r: 18, stroke: hexA(COL, .5) })
        chip('kubectl rollout restart deploy/app', 176, 738, { size: 19, align: 'left', col: COL, solid: true })
        ;[0, 1, 2].forEach(i => {
          const x = 230 + i * 100, y = 824, q = P(t, 11.6 + i * .6, 12.1 + i * .6)
          if (q < .5) pod(x, y, 62, { state: 'idle', alpha: 1 - q * 1.6 })
          if (q > 0 && q < 1) poof(x, y, q, C.faint)
          pod(x, y, 62, { state: 'run', scale: E.back(P(t, 11.9 + i * .6, 12.3 + i * .6)) })
        })
        txt('新 Pod 启动时读到新配置', 520, 818, { size: 21, alpha: E.out(P(t, 13.2, 13.6)) })
        txt('文件变了，应用也要自己 reload', 520, 852, { size: 17, color: C.mute, alpha: E.out(P(t, 13.4, 13.8)) })
      })
      // 做法二：immutable + 版本化名字
      const ra = E.out(P(t, 13.4, 13.8))
      withA(ra, () => {
        panel(980, 690 + lerp(20, 0, ra), 800, 190, { r: 18, stroke: hexA(C.violet, .5) })
        chip('immutable: true', 1016, 738, { size: 19, align: 'left', col: C.violet, solid: true })
        txt('patch → Forbidden，只能删了重建', 1234, 745, { size: 20, color: C.red, alpha: E.out(P(t, 14.2, 14.6)) })
        withA(E.out(P(t, 14.8, 15.2)), () => {
          chip('app-config-v1', 1016, 808, { size: 18, align: 'left', col: C.mute })
          arrow(1196, 808, 1256, 808, E.out(P(t, 14.8, 15.2)), C.violet, 2.5)
          chip('app-config-v2', 1266, 808, { size: 18, align: 'left', col: C.violet })
          txt('改引用 → 滚动发布，可回滚', 1450, 815, { size: 20, color: C.text })
        })
        txt('kubelet 不必再 watch，减轻 API Server 负担', 1016, 856, { size: 17, color: C.mute, alpha: E.out(P(t, 15.4, 15.8)) })
      })
    },
  }

  // 场景 5：Secret 只是 base64
  const SEC = [
    { t: .9, cmd: 'kubectl get secret db-cred -o yaml' },
    { t: 2.3, out: 'type: Opaque', color: C.body },
    { t: 2.5, out: 'data:', color: C.body },
    { t: 2.7, out: '  password: UzNjcjN0IQ==', color: C.amber },
    { t: 2.9, out: '  username: YXBw', color: C.amber },
    { t: 5.8, cmd: 'kubectl get secret db-cred -o jsonpath=\'{.data.password}\' | base64 -d' },
    { t: 8.4, out: 'S3cr3t!', color: C.red, sfx: 'error' },
  ]
  const DEF = [
    ['① 静态加密', 'Encryption at Rest', C.teal],
    ['② 最小权限', 'RBAC 控制谁能读 Secret', C.violet],
    ['③ 不进 Git 明文', 'Git 里只放引用或密文', C.amber],
  ]
  const secret = {
    name: 'Secret 与生产实践', dur: 17, mood: 3,
    vo: [[0.6, 'Secret 用法和 ConfigMap 一样，值只是 base64。', 'Secret 用法和 ConfigMap 几乎一样，值只是 base64 编码。'],
      [5.6, '谁能读这个对象，谁就能一键解码。'],
      [10.8, '生产上：静态加密、最小权限、不进 Git。', '生产环境要靠三道防线：静态加密、最小权限，以及明文不进 Git。']],
    cues: [[0.4, 'whoosh'], ...typeCues(SEC, 30), [3.0, 'pop'], [3.4, 'zap'], [8.6, 'zap'], [9.0, 'alarmSoft'], [10.0, 'tick'], ...DEF.map((_, i) => [11.0 + i * .8, 'pop']), [13.4, 'tick'], [13.7, 'tick'], [14.0, 'tick'], [14.3, 'tick'], [15.0, 'chime']],
    draw(t, T) {
      heading('Secret：base64 不是加密', 140, 210, t, .2, { eyebrow: 'SECRET', color: COL })
      terminal(140, 270, 980, 320, t, SEC, { size: 19, alpha: E.out(P(t, .4, .9)) })
      // 编码 / 解码
      withA(E.out(P(t, 3.0, 3.4)), () => {
        chip('S3cr3t!', 1180, 320, { size: 20, align: 'left', col: C.red })
        txt('base64 编码', 1375, 298, { size: 16, font: MONO, color: C.mute, align: 'center' })
        arrow(1300, 320, 1450, 320, E.out(P(t, 3.3, 3.7)), hexA(C.amber, .7), 2.5)
        chip('UzNjcjN0IQ==', 1460, 320, { size: 20, align: 'left', col: C.amber, alpha: E.out(P(t, 3.6, 3.9)) })
      })
      withA(E.out(P(t, 8.4, 8.8)), () => {
        chip('UzNjcjN0IQ==', 1180, 420, { size: 20, align: 'left', col: C.amber })
        txt('base64 -d', 1435, 398, { size: 16, font: MONO, color: C.mute, align: 'center' })
        arrow(1360, 420, 1510, 420, E.out(P(t, 8.5, 8.9)), hexA(C.red, .7), 2.5)
        chip('S3cr3t!', 1520, 420, { size: 20, align: 'left', col: C.red, solid: true, alpha: E.out(P(t, 8.8, 9.1)) })
      })
      const st = E.back(P(t, 9.0, 9.5))
      if (st > 0) {
        ctx.save(); ctx.translate(1470, 500); ctx.rotate(-.04); ctx.scale(lerp(1.4, 1, clamp(st)), lerp(1.4, 1, clamp(st)))
        chip('base64 ≠ 加密', 0, 0, { size: 26, font: SANS, col: C.red, solid: true, alpha: clamp(st) }); ctx.restore()
      }
      withA(E.out(P(t, 10.0, 10.4)), () => txt('用的时候：优先挂成只读文件，少用 env', 1470, 566, { size: 18, color: C.body, align: 'center' }))
      // 三道防线
      DEF.forEach(([n, s, c], i) => {
        const a = E.out(P(t, 11.0 + i * .8, 11.5 + i * .8)); if (a <= 0) return
        const x = 140 + i * 560, y = 630 + lerp(20, 0, a)
        withA(a, () => {
          panel(x, y, 520, 250, { r: 18, stroke: hexA(c, .5) })
          txt(n, x + 28, y + 50, { size: 25, weight: 600, color: c })
          txt(s, x + 28, y + 84, { size: 17, color: C.mute, font: i === 0 ? MONO : SANS })
          if (i === 0) {
            lock(x + 470, y + 44, 30, c)
            txt('--encryption-provider-config', x + 28, y + 140, { size: 18, font: MONO, color: C.text })
            txt('推荐 KMS v2 对接外部密钥服务', x + 28, y + 180, { size: 20, color: C.body })
            txt('不开的话，etcd 里存的就是明文', x + 28, y + 216, { size: 18, color: C.red })
          } else if (i === 1) {
            shield(x + 470, y + 46, 30, c)
            txt('严格控制 get / list / watch', x + 28, y + 140, { size: 20, color: C.text })
            txt('能在命名空间里建 Pod 的人，', x + 28, y + 180, { size: 19, color: C.amber })
            txt('就能挂载读出其中的 Secret', x + 28, y + 212, { size: 19, color: C.amber })
          } else {
            ;[['External Secrets', C.teal], ['Sealed Secrets', C.violet], ['SOPS', C.amber], ['CSI Driver', COL]].forEach(([s2, c2], j) => {
              chip(s2, x + 28 + (j % 2) * 236, y + 138 + Math.floor(j / 2) * 60, { size: 18, align: 'left', col: c2, alpha: E.out(P(t, 13.4 + j * .3, 13.7 + j * .3)) })
            })
            txt('真正的密钥放在 Vault / KMS 等外部系统', x + 28, y + 228, { size: 17, color: C.mute, alpha: E.out(P(t, 14.6, 15.0)) })
          }
        })
      })
    },
  }

  ANIM({
    id: 'configmaps-secrets',
    meta: { stage: 1, lesson: 6, of: 6, title: 'ConfigMap 与 Secret', summary: '把配置和敏感信息从镜像里解耦出来，环境变量与卷两种注入方式。', next: '健康检查与资源管理' },
    scenes: [
      lessonIntro({ tags: ['ConfigMap', 'env · envFrom', '卷挂载', 'Secret', 'immutable'], vo: [[3.2, 'ConfigMap 与 Secret：让镜像和配置解耦。']] }),
      decouple, envInject, volume, update, secret,
      lessonOutro({
        points: ['ConfigMap 放配置，Secret 放敏感信息', 'env 只在启动时读；卷挂载会热更新', 'subPath 与 env 不更新 → 滚动重启', 'base64 不是加密：加密 + RBAC + 不进 Git'],
        vo: [[0.8, '小结：镜像不变，配置随环境注入。'], [5.6, '下一课，健康检查与资源管理。']],
      }),
    ],
  })
})()
