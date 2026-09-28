#!/usr/bin/env node
/* 动画自检：本地起一个静态服务，用一个常驻的无头 Chrome（DevTools 协议）打开 player.html?id=<id>&scan=1，
 * 逐帧渲染 + 离线合成音频 + 核对旁白与字幕；可选在每个场景中段截图便于肉眼检查。
 *
 * 用法：
 *   node scripts/animation/check.mjs                 # 检查所有动画
 *   node scripts/animation/check.mjs pods rbac       # 指定动画
 *   node scripts/animation/check.mjs pods --shots    # 另外截图到 /tmp/anim-shots/<id>/
 *   node scripts/animation/check.mjs pods --at 12.5,30   # 截取指定时间点
 *   node scripts/animation/check.mjs --shots --no-scan   # 只截图，跳过逐帧检查
 *   node scripts/animation/check.mjs --poster        # 只生成封面 public/animation/<id>/poster.jpg（不做检查）
 *     封面取 ANIM({poster: 秒数}) 指定的时间点，缺省为片头标签全部出现后的一帧
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { load } from './gen_vo.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const PUB = path.join(ROOT, 'public')
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' }

const args = process.argv.slice(2)
const shots = args.includes('--shots')
const posterOnly = args.includes('--poster')
const noScan = args.includes('--no-scan')
const atIdx = args.indexOf('--at')
const at = atIdx >= 0 ? args[atIdx + 1].split(',').map(Number) : null
const ids = args.filter((a, i) => !a.startsWith('--') && !(atIdx >= 0 && i === atIdx + 1))
const all = fs.readdirSync(path.join(PUB, 'animation')).filter(d => fs.existsSync(path.join(PUB, 'animation', d, 'scenes.js')))
const targets = ids.length ? ids : all

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const f = path.join(PUB, decodeURIComponent(u.pathname))
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/animation/player.html`

// ---- 常驻 Chrome + 极简 CDP 客户端 ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-chrome-'))
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const portFile = path.join(profile, 'DevToolsActivePort')
for (let i = 0; !fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').includes('\n'); i++) {
  if (i > 200) throw new Error('Chrome 启动超时'); await new Promise(r => setTimeout(r, 100))
}
const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n')
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } }
const send = (method, params = {}, sessionId) => new Promise((r, j) => { const id = ++seq; pending.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params, sessionId })) })

async function withPage(url, fn) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const s = (m, p) => send(m, p, sessionId)
  try {
    await s('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await s('Page.navigate', { url })
    return await fn(s)
  } finally { await send('Target.closeTarget', { targetId }) }
}
const evaluate = async (s, expr) => (await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value
async function waitFor(s, expr, ms) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await new Promise(r => setTimeout(r, 150))) {
    const v = await evaluate(s, expr).catch(() => null); if (v) return v
  }
  return null
}

async function scan(id) {
  return withPage(`${base}?id=${id}&scan=1`, s => waitFor(s, `document.body&&document.body.getAttribute('data-scan')`, 180000)).then(v => v || 'scan did not finish')
}

// 截图互斥：同一时刻只有一个标签页在截图（逐帧检查仍可并行）
let lock = Promise.resolve()
const exclusive = fn => { const r = lock.then(fn); lock = r.catch(() => {}); return r }

async function shoot(id) {
  const { scenes } = load(id)
  const times = at || scenes.flatMap(s => s.kind === 'intro' ? [s.start + s.dur * .55] : [s.start + s.dur * .3, s.start + s.dur * .72])
  const dir = `/tmp/anim-shots/${id}`; fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f))
  const files = []
  // 逐张截图：多个标签页同时截图时 Chrome 偶尔会返回拼贴的画面
  for (const t of times) await exclusive(() => withPage(`${base}?id=${id}&t=${t.toFixed(2)}&still=1`, async s => {
    // 等字体就绪后重画一帧再截图
    await waitFor(s, `document.fonts&&document.fonts.status==='loaded'&&typeof render==='function'&&ctx!==null`, 15000)
    await evaluate(s, `render(${t});1`)
    const { data } = await s('Page.captureScreenshot', { format: 'png' })
    const f = `${dir}/${t.toFixed(1).padStart(6, '0')}.png`; fs.writeFileSync(f, Buffer.from(data, 'base64')); files.push(f)
  }))
  return files.sort()
}

async function poster(id) {
  const { scenes, def } = load(id)
  const intro = scenes.find(s => s.kind === 'intro')
  const t = def.poster ?? (intro ? intro.start + intro.dur - 1.5 : 5)
  const f = path.join(PUB, 'animation', id, 'poster.jpg')
  await withPage(`${base}?id=${id}&t=${t.toFixed(2)}&still=1`, async s => {
    await waitFor(s, `document.fonts&&document.fonts.status==='loaded'&&typeof render==='function'&&ctx!==null`, 15000)
    await evaluate(s, `render(${t});1`)
    const { data } = await s('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 0.5 } })
    fs.writeFileSync(f, Buffer.from(data, 'base64'))
  })
  return f
}

let bad = 0
try {
  if (posterOnly) {
    // 逐个截图：多个标签页同时截图时 Chrome 偶尔会返回拼贴的画面
    for (const id of targets) console.log(`✓ ${id}: ${path.relative(ROOT, await poster(id))}`)
  } else for (let i = 0; i < targets.length; i += 4) {
    await Promise.all(targets.slice(i, i + 4).map(async id => {
      const r = noScan ? 'OK' : await scan(id)
      if (r !== 'OK') bad++
      if (!noScan) console.log(`${r === 'OK' ? '✓' : '✗'} ${id}: ${r}`)
      if (shots || at) console.log(`  截图：${(await shoot(id)).join(' ')}`)
    }))
  }
} finally {
  ws.close(); proc.kill('SIGKILL'); server.close()
  fs.rmSync(profile, { recursive: true, force: true })
}
process.exit(bad ? 1 : 0)
