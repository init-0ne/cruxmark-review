// Minimal Chrome DevTools Protocol driver: a headless Chrome and Node's built-in WebSocket. No dependency.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
]
export function findChrome() {
  const found = candidates.find((path) => path && existsSync(path))
  if (!found) throw new Error('No Chrome or Chromium found. Install one, or set CHROME_PATH to its executable.')
  return found
}

export async function launchBrowser({ width = 1440, height = 900 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'cruxmark-ui-'))
  // Chrome's sandbox cannot start on some CI images (restricted user namespaces); the page is our own build.
  const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', `--window-size=${width},${height}`, ...(process.env.CI ? ['--no-sandbox'] : [])]
  const chrome = spawn(findChrome(), [...flags, 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 100 && !target; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((item) => item.type === 'page')
    } catch { await pause(100) }
  }
  const stop = async () => {
    chrome.kill('SIGKILL')
    await new Promise((resolve) => (chrome.exitCode !== null ? resolve() : chrome.once('exit', resolve)))
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
  }
  if (!target) { await stop(); throw new Error('Chrome did not expose a debugging page.') }
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })

  let id = 0
  const waiting = new Map()
  const logs = []
  const dialogs = []
  let acceptDialogs = true
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id)
      waiting.delete(message.id)
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
    } else if (message.method === 'Page.javascriptDialogOpening') {
      dialogs.push(message.params.message)
      send('Page.handleJavaScriptDialog', { accept: acceptDialogs }).catch(() => {})
    } else if (message.method === 'Runtime.exceptionThrown') {
      logs.push(`exception: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`)
    } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      logs.push(`console.${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')}`)
    }
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id
    const timer = setTimeout(() => { waiting.delete(n); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    waiting.set(n, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id: n, method, params }))
  })
  await Promise.all([send('Page.enable'), send('Runtime.enable')])

  const page = {
    logs, dialogs,
    set acceptDialogs(value) { acceptDialogs = value },
    async installScript(source) { await send('Page.addScriptToEvaluateOnNewDocument', { source }) },
    async eval(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    },
    async goto(url) { await send('Page.navigate', { url }); await page.waitFor('document.readyState === "complete"', 15000, 'page load') },
    async waitFor(expression, timeout = 10000, label = expression) {
      const started = Date.now()
      for (;;) {
        let ready = false
        try { ready = await page.eval(`!!(${expression})`) } catch { /* the page may be navigating */ }
        if (ready) return
        if (Date.now() - started > timeout) throw new Error(`Timed out waiting for: ${label}`)
        await pause(100)
      }
    },
    /** Click the first enabled button inside `scope` whose text starts with `text`. */
    async click(text, scope = '#execute') {
      const outcome = await page.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(`${scope} button`)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok' })()`)
      if (outcome !== 'ok') throw new Error(`Button "${text}" is ${outcome}.`)
    },
    async trustedClick(selector) {
      const point = await page.eval(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return null; element.scrollIntoView({ block: 'center' }); const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 } })()`)
      if (!point) throw new Error(`Element "${selector}" is missing.`)
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
    },
    /** Set a React-controlled <select>. */
    select: (selector, value) => page.eval(`(() => { const s = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })) })()`),
    text: (selector) => page.eval(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? null`),
    close: async () => { socket.close(); await stop() },
  }
  return page
}
