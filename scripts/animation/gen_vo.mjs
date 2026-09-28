#!/usr/bin/env node
/* 为动画生成中文旁白，并刷新动画清单。
 *
 * 用法（需要 uv 与 macOS 自带的 afinfo；无需安装其它依赖）：
 *   node scripts/animation/gen_vo.mjs            # 所有动画
 *   node scripts/animation/gen_vo.mjs pods rbac  # 指定动画 id
 *
 * - 旁白文案写在 public/animation/<id>/scenes.js 各场景的 vo 数组里：
 *   vo:[[场景内开始秒数, 字幕文案, 读法覆盖?]]，读法覆盖用于缩写（如 K8s → Kubernetes）
 * - 语音：Microsoft Edge 神经语音（edge-tts）zh-CN-XiaoxiaoNeural
 * - 读得比留给它的时间长时自动小幅加快语速（最多 +22%），仍放不下时标记 OVER，需要缩短文案
 * - 输出 public/animation/<id>/vo.json 与 vo/<hash>.mp3；文案和读法未变且放得下的句子直接复用
 * - 同时重写 src/content/animations.gen.json（站点据此决定哪些课有动画、时长多少）
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const DIR = path.join(ROOT, 'public/animation')
const MANIFEST = path.join(ROOT, 'src/content/animations.gen.json')
const VOICE = 'zh-CN-XiaoxiaoNeural'
const MAX_RATE = 22
const JOBS = 4

export function load(id) {
  const code = fs.readFileSync(path.join(DIR, 'engine.js'), 'utf8') + '\n' + fs.readFileSync(path.join(DIR, id, 'scenes.js'), 'utf8')
  const c = vm.createContext({ console, module: {} })
  vm.runInContext(code, c, { filename: `${id}/scenes.js` })
  return vm.runInContext('({L:voLines(),def:ANIM_DEF,total:TOTAL,scenes:SCENES.map(s=>({name:s.name,dur:s.dur,start:s.start,kind:s.kind}))})', c)
}

const hash = s => crypto.createHash('sha1').update(`${VOICE}|${s}`).digest('hex').slice(0, 10)

async function duration(f) {
  const { stdout } = await run('afinfo', [f])
  return +stdout.match(/estimated duration: ([\d.]+)/)[1]
}

async function tts(text, rate, f) {
  let err
  for (let i = 0; i < 5; i++) { // 网络偶发失败时重试
    try {
      await run('uvx', ['edge-tts', '--voice', VOICE, `--rate=+${rate}%`, '--text', text, '--write-media', f])
      // 偶尔会返回只有几 KB 的残缺音频，当作失败重试
      if (fs.statSync(f).size >= 4096) return
      err = new Error('音频文件过小')
    }
    catch (e) { err = e }
    await new Promise(r => setTimeout(r, 800 * (i + 1)))
  }
  throw new Error(`edge-tts 失败：${text}\n${err.stderr || err.message}`)
}

async function pool(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k) } }))
}

async function gen(id) {
  const { L, scenes } = load(id)
  const out = path.join(DIR, id), voDir = path.join(out, 'vo')
  fs.mkdirSync(voDir, { recursive: true })
  const old = fs.existsSync(path.join(out, 'vo.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'vo.json'), 'utf8')) : []
  const byHash = new Map(old.map(v => [v.h, v]))
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vo-${id}-`))
  const budget = i => L[i + 1] && L[i + 1].s === L[i].s ? L[i + 1].a - L[i].a - 0.12 : scenes[L[i].s].dur - L[i].a + 0.2
  const res = new Array(L.length)
  let over = 0
  await pool(L, JOBS, async (l, i) => {
    const spoken = l.spoken || l.text, h = hash(spoken), win = budget(i), f = `${h}.mp3`
    const prev = byHash.get(h)
    // 复用：文件还在，且放得下（加速过的句子若空间明显变宽则重新合成，恢复正常语速）；
    // 之前已加到最快语速仍放不下 → 同样结果，不必重试
    const r0 = prev?.r ?? 0
    if (prev && fs.existsSync(path.join(voDir, f)) && ((prev.d <= win && (r0 === 0 || prev.d > win - 0.6)) || (prev.d > win && r0 >= MAX_RATE))) {
      res[i] = { s: l.s, a: l.a, d: prev.d, text: l.text, f, h, r: prev.r ?? 0 }
    } else {
      const tf = path.join(tmp, f)
      let rate = 0, d
      for (;;) {
        await tts(spoken, rate, tf)
        d = await duration(tf)
        if (d <= win || rate >= MAX_RATE) break
        rate = Math.min(MAX_RATE, rate + Math.max(4, Math.floor((d / win - 1) * 100) + 3))
      }
      fs.copyFileSync(tf, path.join(voDir, f))
      res[i] = { s: l.s, a: l.a, d: Math.round(d * 100) / 100, text: l.text, f, h, r: rate }
    }
    const v = res[i]
    if (v.d > win) over++
    console.log(`${id} ${String(i).padStart(2, '0')} 场景${l.s} ${l.a.toFixed(1).padStart(5)}s 可用 ${win.toFixed(1).padStart(4)}s 实际 ${v.d.toFixed(2)}s 语速 +${v.r}%${v.d > win ? '  <-- OVER' : ''}${prev && v.f === prev.f && v.d === prev.d ? '  (复用)' : ''}`)
  })
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.writeFileSync(path.join(out, 'vo.json'), JSON.stringify(res) + '\n')
  // 清理不再引用的音频
  const keep = new Set(res.map(v => v.f))
  for (const f of fs.readdirSync(voDir)) if (!keep.has(f)) fs.rmSync(path.join(voDir, f))
  if (over) console.log(`⚠ ${id}：${over} 句放不下，请缩短文案或推后时间点`)
  return over
}

export function writeManifest() {
  const m = {}
  for (const id of fs.readdirSync(DIR).sort()) {
    if (!fs.existsSync(path.join(DIR, id, 'scenes.js')) || !fs.existsSync(path.join(DIR, id, 'vo.json'))) continue
    const { total, scenes, def } = load(id)
    m[id] = { duration: Math.round(total), scenes: scenes.map(s => s.name), ...(def.meta ? { title: def.meta.title } : {}) }
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n')
  // 连播顺序：总览动画在前，其后按阶段、课序排列；播放器据此决定"下一部"
  const list = Object.keys(m).map(id => ({ id, ...load(id).def.meta })).sort((a, b) => (a.stage ?? -1) - (b.stage ?? -1) || (a.lesson ?? 0) - (b.lesson ?? 0))
    .map(({ id, title, stage, lesson }) => ({ id, title: title || 'K8s Journey 总览', duration: m[id].duration, ...(stage != null ? { stage, lesson } : {}) }))
  fs.writeFileSync(path.join(DIR, 'playlist.json'), JSON.stringify(list) + '\n')
  console.log(`已写入 ${path.relative(ROOT, MANIFEST)}（${Object.keys(m).length} 个动画）`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(DIR).filter(d => fs.existsSync(path.join(DIR, d, 'scenes.js')))
  let over = 0
  for (const id of ids) over += await gen(id)
  writeManifest()
  process.exit(over ? 1 : 0)
}
