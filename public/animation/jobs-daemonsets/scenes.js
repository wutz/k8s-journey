/* 第 2 阶段 · 第 4 课：Job、CronJob 与 DaemonSet */
(() => {
const COL = STAGES[2].color

// 本地小工具：甘特条（x,y 为左上角）
const bar = (x, y, w, h, col, o = {}) => {
  if (w <= 0) return
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1
  ctx.fillStyle = tint(col, o.fa ?? .22); ctx.strokeStyle = col; ctx.lineWidth = 1.5
  if (o.dash) ctx.setLineDash(o.dash)
  rr(x, y, w, h, Math.min(10, h / 2)); ctx.fill(); ctx.stroke(); ctx.restore()
}
// 命令行条
const cmdStrip = (x, y, w, s, a, note) => withA(a, () => {
  panel(x, y, w, 60, { r: 14, fill: '#fff' })
  txt('❯', x + 26, y + 39, { size: 22, font: MONO, color: C.blue })
  txt(s, x + 56, y + 39, { size: 21, font: MONO, color: C.text })
  if (note) txt(note, x + w - 24, y + 39, { size: 19, color: C.mute, align: 'right' })
})

// ---------- 场景 1：运行到完成 ----------
const PI = [
  { t: .8, cmd: 'kubectl apply -f job-pi.yaml' },
  { t: 1.9, out: 'job.batch/pi created', color: C.mute },
  { t: 2.4, cmd: 'kubectl get job pi -w' },
  { t: 3.4, out: 'NAME   STATUS     COMPLETIONS   DURATION', color: C.mute },
  { t: 3.7, out: 'pi     Running    0/1           5s', color: C.amber },
  { t: 6.0, out: 'pi     Complete   1/1           28s', color: C.green, sfx: 'ok' },
  { t: 6.9, cmd: 'kubectl logs job/pi | head -c 60' },
  { t: 8.2, out: '3.14159265358979323846264338327950288419716939937', color: C.body },
]
const run = {
  name: '运行到完成', dur: 16, mood: 1,
  vo: [[0.6, 'Job 创建 Pod，一直等到它成功退出。'],
    [5.6, '退出码为 0，Job 进入 Complete。'],
    [10.8, '设了 TTL，结束后自动清理 Job 和 Pod。']],
  cues: [[0.4, 'whoosh'], ...typeCues(PI, 30), [2.0, 'pop'], [2.6, 'pop'], [6.1, 'chime'], [10.8, 'tick'], [12.6, 'poof']],
  draw(t) {
    heading('Job：跑完就结束', 140, 210, t, .2, { eyebrow: 'RUN TO COMPLETION', color: COL })
    terminal(140, 280, 900, 390, t, PI, { size: 22, alpha: E.out(P(t, .4, .9)) })
    const hi = t < 5.6 ? 0 : t < 10.8 ? 1 : 2
    code(140, 694, 900, ['restartPolicy: Never   # 只能 Never / OnFailure', 'backoffLimit: 4        # 最多重试 4 次', 'ttlSecondsAfterFinished: 600'], t, 1.4, { title: 'job-pi.yaml', size: 20, hi: [hi] })
    // 右侧：Job → Pod
    const gone = P(t, 12.6, 13.4)
    const ja = E.out(P(t, 1.8, 2.2)) * (1 - E.out(gone))
    box(1440, 330, 300, 90, 'Job pi', 'completions 1', COL, { alpha: ja, size: 26 })
    arrow(1440, 378, 1440, 438, E.out(P(t, 2.4, 2.8)) * (1 - E.out(gone)), hexA(COL, .6), 2.5)
    const done = t >= 6.0
    const st = t < 3.6 ? 'pending' : done ? C.teal : 'run'
    const pa = E.out(P(t, 2.6, 3)) * (1 - E.out(gone))
    pod(1440, 520, 120, { state: st, label: 'pi-7xq2m', alpha: pa, scale: done ? 1 + .06 * Math.sin(P(t, 6, 6.6) * Math.PI) : 1 })
    if (done) check(1500, 470, 34, C.teal, P(t, 6, 6.5) * (1 - gone))
    chip(t < 3.6 ? 'Pending' : done ? 'Completed · exit 0' : 'Running · 计算 π', 1440, 640, { size: 20, col: t < 3.6 ? C.amber : done ? C.teal : C.green, solid: done, alpha: pa })
    ring(1440, 520, P(t, 6, 7), C.teal, 140)
    poof(1440, 520, gone, C.teal)
    // 对比：Deployment 会一直重启
    withA(E.out(P(t, 7.8, 8.3)) * (1 - E.out(P(t, 10.6, 11))), () => {
      cross(1200, 720, 20, C.red, 1)
      txt('restartPolicy: Always → Pod 永远不会“完成”', 1226, 728, { size: 20, color: C.body })
    })
    // TTL 倒计时
    const ta = E.out(P(t, 10.8, 11.2))
    if (ta > 0) withA(ta, () => {
      txt('ttlSecondsAfterFinished: 600', 1140, 716, { size: 20, font: MONO, color: C.text })
      meter(1140, 740, 600, 14, P(t, 11, 12.6), C.amber)
      txt(t < 12.6 ? '结束后 10 分钟…' : '已级联删除 Job 及其 Pod', 1140, 790, { size: 20, color: t < 12.6 ? C.mute : C.teal })
    })
    if (gone >= 1) withA(E.out(P(t, 13.2, 13.6)), () => {
      ctx.save(); ctx.strokeStyle = hexA(C.text, .2); ctx.lineWidth = 2; ctx.setLineDash([8, 7]); rr(1270, 290, 340, 370, 20); ctx.stroke(); ctx.restore()
      txt('etcd 里不再堆积', 1440, 482, { size: 22, color: C.mute, align: 'center' })
    })
  },
}

// ---------- 场景 2：失败与重试 ----------
const FX = [260, 700, 1460], FN = ['always-fail-4xk9p', 'always-fail-q7w2c', 'always-fail-m3z8t']
const FT = [[1.0, 2.0], [3.8, 4.6], [7.2, 8.0]] // 出现, 失败
const retry = {
  name: '失败与重试', dur: 16, mood: 3,
  vo: [[0.6, '失败会重试，间隔 10s、20s 成倍增长。', '失败会重试，间隔 10 秒、20 秒，成倍增长。'],
    [5.4, '重试超过 backoffLimit，Job 判定失败。', '重试超过 backoff limit，Job 判定失败。'],
    [10.8, 'Never 每次新建 Pod，失败现场都留着。']],
  cues: [[0.4, 'whoosh'], [0.8, 'tick'], ...FT.map(([a]) => [a, 'pop']), ...FT.map(([, b]) => [b, 'error']), [8.4, 'alarmSoft'], [11.0, 'pop'], [11.6, 'pop'], [13.4, 'tick']],
  draw(t) {
    heading('失败、退避与 backoffLimit', 140, 210, t, .2, { eyebrow: 'RETRY & BACKOFF', color: COL })
    cmdStrip(140, 270, 1640, 'kubectl get pods -l job-name=always-fail -w', E.out(P(t, .6, 1)), 'backoffLimit: 2')
    // 时间轴
    const ax = E.out(P(t, .8, 1.2))
    withA(ax, () => line(180, 470, 1760, 470, C.hair, 2))
    FT.forEach(([a, b], i) => {
      const x = FX[i], k = E.back(P(t, a, a + .5)); if (k <= 0) return
      const failed = t >= b
      const shake = failed ? Math.sin(t * 70) * 6 * (1 - P(t, b, b + .5)) : 0
      pod(x + shake, 470, 96, { state: failed ? 'fail' : 'run', label: FN[i], scale: k, alpha: clamp(k) })
      chip(failed ? 'Error' : 'Running', x, 576, { size: 18, col: failed ? C.red : C.green, alpha: clamp(k) })
      ring(x, 470, P(t, b, b + .9), C.red, 110)
    })
    // 退避区间
    ;[[FX[0] + 70, FX[1] - 70, 2.2, 3.6, '退避 10s'], [FX[1] + 70, FX[2] - 70, 4.8, 7.0, '退避 20s']].forEach(([x1, x2, a, b, s]) => {
      const p = E.inOut(P(t, a, b)); if (p <= 0) return
      bar(x1, 452, (x2 - x1) * p, 36, C.amber, { fa: .16, dash: [6, 5] })
      withA(clamp(p * 3), () => txt(s, (x1 + x2) / 2, 430, { size: 20, font: MONO, color: C.amber, align: 'center' }))
    })
    withA(E.out(P(t, 8.6, 9)), () => {
      bar(FX[2] + 70, 452, 230, 36, C.hairD, { fa: .05, dash: [6, 5], alpha: .7 })
      txt('40s… 上限 6 分钟', FX[2] + 185, 430, { size: 18, color: C.mute, align: 'center' })
    })
    // 重试计数
    const fails = FT.filter(([, b]) => t >= b).length, made = FT.filter(([a]) => t >= a).length
    chip(`失败 ${fails} 次 · 已重试 ${Math.max(0, made - 1)}/2`, 1760, 360, { size: 18, col: fails > 2 ? C.red : C.mute, align: 'right', alpha: ax })
    // BackoffLimitExceeded
    withA(E.out(P(t, 8.4, 8.8)), () => {
      chip('BackoffLimitExceeded', 140, 646, { size: 22, col: C.red, solid: true, align: 'left' })
      txt('Job has reached the specified backoff limit', 440, 653, { size: 20, font: MONO, color: C.body })
      chip('activeDeadlineSeconds 到点优先终止', 1780, 646, { size: 18, col: C.amber, font: SANS, align: 'right', alpha: E.out(P(t, 9.4, 9.8)) })
    })
    // Never vs OnFailure
    ;[['restartPolicy: Never', '每次失败新建 Pod，失败 Pod 保留，日志都在', C.teal, 140, 11.0, t >= 10.8], ['restartPolicy: OnFailure', '同一 Pod 里重启容器，旧日志被覆盖', C.mute, 980, 11.6, false]].forEach(([n, s, c, x, t0, on]) => {
      withA(E.out(P(t, t0, t0 + .4)), () => {
        panel(x, 710, 800, 150, { r: 16, stroke: on ? c : C.hair, lw: on ? 2.5 : 1.5, fill: on ? tint(c, .05) : C.panel })
        chip(n, x + 28, 756, { size: 20, col: c, solid: on, align: 'left' })
        txt(s, x + 30, 820, { size: 22, color: C.text })
        if (on) [0, 1, 2].forEach(k => pod(x + 590 + k * 70, 784, 50, { state: 'fail', scale: E.back(P(t, t0 + .3 + k * .15, t0 + .7 + k * .15)) }))
        else {
          pod(x + 690, 776, 56, { state: 'fail' })
          chip('RESTARTS 2', x + 690, 834, { size: 16, col: C.red })
        }
      })
    })
    chip('排查阶段推荐 Never', 910, 838, { size: 16, col: C.teal, font: SANS, align: 'right', alpha: E.out(P(t, 13.4, 13.8)) })
  },
}

// ---------- 场景 3：并行与 Indexed Job ----------
const GX0 = 420, GX1 = 1560, GT0 = 1.0, GT1 = 5.8
const gx = s => GX0 + (s - GT0) / (GT1 - GT0) * (GX1 - GX0)
const SLOTS = [[['a', 1.0, 2.4], ['c', 2.5, 3.9], ['e', 4.0, 5.4]], [['b', 1.0, 2.7], ['d', 2.8, 4.2], ['f', 4.3, 5.7]]]
const IX = [360, 660, 960, 1260, 1560], FILES = ['a.csv', 'b.csv', 'c.csv', 'd.csv', 'e.csv']
const IT = [[6.8, 8.0], [6.8, 8.3], [8.1, 9.3], [8.4, 9.6], [9.4, 10.6]]
const parallel = {
  name: '并行与索引', dur: 17, mood: 2,
  vo: [[0.6, '需要 6 次成功，同时最多跑 2 个。'],
    [6.0, 'Indexed Job 给每个 Pod 一个编号，各取一片数据。'],
    [11.4, '某片失败重试，新 Pod 还是同一个编号。']],
  cues: [[0.4, 'whoosh'], [1.0, 'pop'], ...SLOTS.flat().map(([, , e]) => [e, 'ok']), [5.9, 'chime'], ...IT.map(([a]) => [a, 'pop']), ...IT.filter((_, i) => i !== 2).map(([, b]) => [b, 'tick']), [11.6, 'error'], [12.8, 'pop'], [14.0, 'ok']],
  draw(t) {
    heading('completions、parallelism 与 Indexed Job', 140, 210, t, .2, { eyebrow: 'PARALLEL JOBS', color: COL })
    // 上：两个槽位
    const ga = E.out(P(t, .5, .9)) * (t < 6 ? 1 : .8)
    withA(ga, () => {
      chip('completions: 6', 140, 296, { size: 20, col: COL, align: 'left' })
      chip('parallelism: 2', 340, 296, { size: 20, col: COL, align: 'left' })
      ;['槽位 1', '槽位 2'].forEach((s, r) => {
        const y = 340 + r * 66
        txt(s, GX0 - 24, y + 27, { size: 20, color: C.body, align: 'right' })
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.035)'; rr(GX0, y, GX1 - GX0, 44, 10); ctx.fill(); ctx.restore()
        SLOTS[r].forEach(([n, a, b]) => {
          if (t < a) return
          const e = Math.min(t, b)
          const ok = t >= b
          bar(gx(a) + 3, y + 2, gx(e) - gx(a) - 6, 40, ok ? C.green : C.amber)
          withA(clamp((gx(e) - gx(a) - 60) / 40), () => txt(`Pod-${n}`, gx(a) + 16, y + 29, { size: 18, font: MONO, color: ok ? C.green : C.amber }))
          if (ok) check(gx(b) - 22, y + 22, 20, C.green, P(t, b, b + .3))
        })
      })
      if (t > GT0 && t < GT1) line(gx(t), 330, gx(t), 460, hexA(C.text, .25), 2, [6, 6])
    })
    const n = SLOTS.flat().filter(([, , b]) => t >= b).length
    chip(`COMPLETIONS ${n}/6`, 1780, 362, { size: 22, col: n === 6 ? C.green : C.amber, solid: n === 6, align: 'right', alpha: ga })
    chip('Complete', 1780, 428, { size: 20, col: C.green, align: 'right', alpha: E.out(P(t, 5.9, 6.3)) * ga })
    // 下：Indexed
    const ia = E.out(P(t, 6, 6.4))
    if (ia <= 0) return
    withA(ia, () => {
      line(140, 500, 1780, 500, C.hair, 1.5)
      chip('completionMode: Indexed', 140, 540, { size: 20, col: C.violet, solid: true, align: 'left' })
      chip('completions: 5 · parallelism: 2', 460, 540, { size: 18, col: C.violet, align: 'left' })
      txt('env JOB_COMPLETION_INDEX', 1780, 547, { size: 20, font: MONO, color: C.violet, align: 'right' })
    })
    IX.forEach((x, i) => {
      const [a, b] = IT[i]
      const retryI = i === 2
      const failT = 11.6, reT = 12.8
      let st = t < a ? 'idle' : t < b ? 'run' : C.teal
      if (retryI && t >= a) st = t < failT ? 'run' : t < reT ? 'fail' : t < 14 ? 'run' : C.teal
      const pa = t < a ? .35 : 1
      const sc = retryI && t >= reT ? E.back(P(t, reT, reT + .5)) : t >= a ? E.back(P(t, a, a + .4)) : 1
      if (retryI && t >= failT && t < reT) poof(x, 650, P(t, failT + .6, reT), C.red)
      if (!(retryI && t >= failT + .6 && t < reT)) pod(x, 650, 84, { state: st, alpha: ia * pa, scale: clamp(sc, .01, 2) })
      chip(`index ${i}`, x, 730, { size: 18, col: retryI && t >= failT && t < 14 ? C.red : C.violet, solid: retryI ? (t >= a && t < failT) || (t >= reT && t < 14) : t >= a && t < b, alpha: ia })
      const done = retryI ? t >= 14 : t >= b
      const lp = E.out(P(t, retryI && t >= 14 ? 14 : b, (retryI && t >= 14 ? 14 : b) + .4))
      if (done) arrow(x, 752, x, 796, lp, hexA(C.teal, .7), 2)
      withA(ia, () => {
        panel(x - 70, 800, 140, 50, { r: 10, fill: done ? tint(C.teal, .08) : '#fff', stroke: done ? C.teal : C.hair, shadow: false })
        txt(FILES[i], x, 833, { size: 20, font: MONO, color: done ? C.teal : C.mute, align: 'center' })
      })
      if (st === C.teal) check(x + 36, 616, 22, C.teal, 1)
    })
    withA(E.out(P(t, 12.8, 13.2)), () => txt('↑ 重试的新 Pod 仍拿 index 2', 960, 884, { size: 20, color: C.red, align: 'center' }))
    chip('backoffLimitPerIndex：每片单独计重试', 1780, 880, { size: 18, col: C.violet, font: SANS, align: 'right', alpha: E.out(P(t, 14.2, 14.6)) })
  },
}

// ---------- 场景 4：CronJob ----------
const CF = [['*/1', '分'], ['*', '时'], ['*', '日'], ['*', '月'], ['*', '周']]
const LX0 = 480, LX1 = 1740, LMIN = 4
const lx = m => LX0 + m / LMIN * (LX1 - LX0)
const cron = {
  name: 'CronJob', dur: 17, mood: 2,
  vo: [[0.6, 'CronJob 按 Cron 表达式，定时创建 Job。'],
    [5.8, '上次没跑完又到点了，由并发策略决定。'],
    [11.0, 'Forbid 跳过这次，Replace 用新的替换旧的。']],
  cues: [[0.4, 'whoosh'], ...CF.map((_, i) => [1.0 + i * .2, 'tick']), [2.8, 'pop'], [3.4, 'pop'], [4.0, 'pop'], [6.2, 'pop'], [7.3, 'pop'], [8.4, 'pop'], [9.5, 'pop'], [7.4, 'error'], [9.6, 'error'], [11.2, 'chime'], [13.6, 'alarmSoft']],
  draw(t) {
    heading('CronJob：定时创建 Job', 140, 210, t, .2, { eyebrow: 'CRONJOB', color: COL })
    // schedule 拆解
    withA(E.out(P(t, .6, 1)), () => txt('schedule:', 140, 318, { size: 22, font: MONO, color: C.blue }))
    CF.forEach(([s, l], i) => {
      const a = E.out(P(t, 1 + i * .2, 1.3 + i * .2)); if (a <= 0) return
      const x = 330 + i * 88
      withA(a, () => {
        chip(s, x, 310, { size: 26, col: i === 0 ? COL : C.body, solid: i === 0 })
        txt(l, x, 366, { size: 20, color: C.mute, align: 'center' })
      })
    })
    withA(E.out(P(t, 2, 2.4)), () => {
      txt('每分钟一次', 330, 410, { size: 20, color: COL })
      txt('timeZone: "Asia/Shanghai"', 610, 410, { size: 20, font: MONO, color: C.text })
    })
    // CronJob → Job → Pod
    const chain = [['CronJob', 'report', COL, 1080, 2.8], ['Job', 'report-2905…', C.blue, 1370, 3.4], ['Pod', 'report-2905…-x', C.green, 1640, 4.0]]
    chain.forEach(([n, s, c, x, t0], i) => {
      box(x, 350, 230, 96, n, s, c, { alpha: E.out(P(t, t0, t0 + .4)), size: 26 })
      if (i) arrow(chain[i - 1][3] + 116, 350, x - 118, 350, E.out(P(t, t0 - .2, t0 + .2)), hexA(C.text, .35), 2.5)
    })
    // 并发策略泳道
    const la = E.out(P(t, 5.8, 6.2))
    if (la <= 0) return
    const m = clamp((t - 6.2) / 4.4) * 3.9 // 已模拟的分钟数
    withA(la, () => {
      txt('concurrencyPolicy  ·  每分钟触发，每次运行 90s', 140, 480, { size: 20, color: C.body })
      for (let k = 0; k <= LMIN; k++) {
        line(lx(k), 500, lx(k), 780, hexA(C.text, .08), 1.5)
        txt(`${k}m`, lx(k), 808, { size: 18, font: MONO, color: C.mute, align: 'center' })
      }
    })
    const LANES = [
      ['Allow', '默认 · 允许重叠', [[0, 1.5], [1, 2.5], [2, 3.5], [3, 4.5]], 'allow'],
      ['Forbid', '上次未完则跳过', [[0, 1.5], [2, 3.5]], 'forbid'],
      ['Replace', '终止旧的换新的', [[0, 1], [1, 2], [2, 3], [3, 4.5]], 'replace'],
    ]
    LANES.forEach(([n, s, jobs, kind], r) => {
      const y = 540 + r * 84, on = t >= 11 && (kind === 'forbid' || (kind === 'replace' && t >= 12.6))
      withA(la * (t >= 11 && !on ? .55 : 1), () => {
        chip(n, 140, y, { size: 20, col: COL, solid: on, align: 'left' })
        txt(s, 140, y + 34, { size: 16, color: C.mute })
        jobs.forEach(([a, b], j) => {
          if (m < a) return
          const e = Math.min(m, b, LMIN)
          const lane2 = kind === 'allow' && j % 2 === 1
          const yy = kind === 'allow' ? y - 22 + (lane2 ? 24 : 0) : y - 20
          const hh = kind === 'allow' ? 20 : 40
          const cut = kind === 'replace' && b < 4.5 && m >= b
          bar(lx(a) + 2, yy, lx(e) - lx(a) - 4, hh, cut ? C.red : C.blue, { fa: .18 })
          if (cut) cross(lx(b) - 12, y, 14, C.red, 1)
        })
        if (kind === 'forbid') [1, 3].forEach(k => {
          if (m < k) return
          withA(E.out(clamp((m - k) * 4)), () => { cross(lx(k), y, 18, C.red, 1); txt('跳过', lx(k) + 16, y + 44, { size: 16, color: C.red }) })
        })
      })
    })
    if (m > 0 && m < 3.9) line(lx(m), 500, lx(m), 780, hexA(C.text, .3), 2, [6, 6])
    chip('同时 2 个 Job', 1780, 470, { size: 16, col: C.amber, font: SANS, align: 'right', alpha: E.out(P(t, 7.4, 7.8)) * (t < 11 ? 1 : .55) })
    withA(E.out(P(t, 13.6, 14)), () => {
      chip('任务必须幂等', 140, 868, { size: 20, col: C.amber, solid: true, align: 'left', font: SANS })
      txt('CronJob 只保证“大约”按时创建 Job，极端情况下可能多跑一次或漏跑', 318, 875, { size: 20, color: C.body })
    })
  },
}

// ---------- 场景 5：DaemonSet ----------
const NX = [140, 560, 980, 1400], NW = 380
const NN = ['k8s-journey-control-plane', 'k8s-journey-worker', 'k8s-journey-worker2', 'k8s-journey-worker3']
const BORN = [6.6, 1.4, 1.8, 9.2] // 各节点 Pod 创建时刻
const UPT = [11.4, 12.4, 13.4, 14.4] // 滚动更新时刻（每个节点一次一个）
const daemon = {
  name: 'DaemonSet', dur: 16, mood: 3,
  vo: [[0.6, 'DaemonSet 在每个节点上各跑一个 Pod。'],
    [5.4, '加上容忍，控制平面也有；新节点加入自动补上。'],
    [10.8, '更新时逐个节点替换，maxUnavailable 默认 1。', '更新时逐个节点替换，max unavailable 默认为 1。']],
  cues: [[0.4, 'whoosh'], [1.4, 'pop'], [1.8, 'pop'], [2.6, 'lock'], [5.6, 'tick'], [6.6, 'pop'], [8.2, 'whoosh'], [9.2, 'pop'], ...UPT.map(a => [a, 'poof']), ...UPT.map(a => [a + .45, 'pop']), [15.0, 'chime']],
  draw(t) {
    heading('DaemonSet：每个节点一个', 140, 210, t, .2, { eyebrow: 'DAEMONSET', color: COL })
    chip('DaemonSet node-agent', 1780, 236, { size: 20, col: COL, solid: true, align: 'right', alpha: E.out(P(t, .6, 1)) })
    const tol = t >= 5.6
    NX.forEach((x, i) => {
      const join = i === 3
      const na = join ? E.out(P(t, 8.2, 8.8)) : E.out(P(t, .5 + i * .15, .9 + i * .15))
      const ox = join ? lerp(120, 0, na) : 0
      if (join && na <= 0) {
        withA(E.out(P(t, .9, 1.3)), () => { ctx.save(); ctx.strokeStyle = hexA(C.text, .14); ctx.lineWidth = 2; ctx.setLineDash([8, 7]); rr(x, 290, NW, 330, 14); ctx.stroke(); ctx.restore(); txt('（暂无节点）', x + NW / 2, 460, { size: 20, color: C.faint, align: 'center' }) })
        return
      }
      node(x + ox, 290, NW, 330, NN[i], { alpha: na, accent: COL })
      withA(na, () => {
        if (i === 0) {
          chip(tol ? 'NoSchedule · 已容忍' : '污点 control-plane:NoSchedule', x + NW / 2, 592, { size: 16, col: tol ? C.teal : C.red, solid: tol && t < 7, alpha: 1 })
        }
        if (join) chip('新节点加入', x + NW / 2, 592, { size: 16, col: C.blue, font: SANS })
      })
      const born = BORN[i]
      if (t < born) {
        if (i === 0) withA(E.out(P(t, 2.4, 2.8)), () => { pod(x + NW / 2, 440, 96, { state: 'idle', alpha: .35 }); cross(x + NW / 2, 440, 34, C.red, 1) })
        return
      }
      const up = t >= UPT[i] + .45, upNow = t >= UPT[i] && t < UPT[i] + .45
      const sc = upNow ? 0 : up ? E.back(P(t, UPT[i] + .45, UPT[i] + .9)) : E.back(P(t, born, born + .5))
      poof(x + NW / 2 + ox, 440, P(t, UPT[i], UPT[i] + .8), C.green)
      travel(1780 - 100, 256, x + NW / 2, 392, P(t, born - .6, born), COL)
      pod(x + NW / 2 + ox, 440, 96, { state: up ? C.violet : 'run', label: 'node-agent', scale: sc, alpha: clamp(sc) })
      chip(up ? 'busybox:1.37' : 'busybox:1.36', x + NW / 2 + ox, 552, { size: 16, col: up ? C.violet : C.mute })
    })
    // kubectl get ds 实时表
    const desired = (t >= BORN[0] ? 1 : 0) + 2 + (t >= BORN[3] ? 1 : 0)
    const busy = UPT.some(a => t >= a && t < a + .9) ? 1 : 0
    const upd = t < 10.8 ? desired : UPT.filter(a => t >= a + .45).length
    const cmd = t < 5.4 ? 'kubectl -n kube-system get ds node-agent' : t < 10.8 ? 'kubectl apply -f node-agent.yaml      # 加上 tolerations' : 'kubectl -n kube-system set image ds/node-agent agent=busybox:1.37'
    const ta = E.out(P(t, 1, 1.4))
    withA(ta, () => {
      panel(140, 660, 1640, 210, { r: 16, fill: '#fff' })
      txt('❯', 168, 706, { size: 21, font: MONO, color: C.blue })
      txt(cmd, 198, 706, { size: 21, font: MONO, color: C.text })
      const cols = [['NAME', 'node-agent'], ['DESIRED', desired], ['CURRENT', desired], ['READY', desired - busy], ['UP-TO-DATE', upd], ['NODE SELECTOR', '<none>']]
      let x = 198
      cols.forEach(([h, v], k) => {
        txt(h, x, 768, { size: 19, font: MONO, color: C.mute })
        const hot = (k === 1 && t < 10.8) || (k === 4 && t >= 10.8)
        txt(String(v), x, 824, { size: 26, font: MONO, weight: 700, color: hot ? COL : C.text })
        x += [230, 190, 190, 160, 230, 0][k]
      })
      txt(t < 5.4 ? '控制平面有污点 → DESIRED 2' : t < 10.8 ? '节点数变了，DESIRED 跟着变' : 'maxUnavailable: 1 · 一次一个节点', 1750, 824, { size: 20, color: C.mute, align: 'right' })
    })
  },
}

ANIM({
  id: 'jobs-daemonsets',
  meta: { stage: 2, lesson: 4, of: 7, title: 'Job、CronJob 与 DaemonSet', summary: '一次性任务、定时任务，以及每个节点一个的守护进程。', next: 'Ingress 与 Gateway API' },
  scenes: [
    lessonIntro({ tags: ['Job', 'Indexed Job', 'CronJob', 'DaemonSet'], vo: [[3.2, '有的任务跑完就该结束，有的要每个节点一份。']] }),
    run, retry, parallel, cron, daemon,
    lessonOutro({
      points: ['Job 跑到成功退出，失败按指数退避重试', 'completions / parallelism 控并行，Indexed 分片', 'CronJob 定时建 Job，并发策略处理重叠', 'DaemonSet 每节点一个，新节点自动补上'],
      vo: [[0.8, '小结：批处理用 Job，守护进程用 DaemonSet。'], [5.6, '下一课，Ingress 与 Gateway API。']],
    }),
  ],
})
})()
