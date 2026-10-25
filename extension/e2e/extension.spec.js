const { test, expect, chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { execFileSync } = require('node:child_process')
const extensionId = 'fflpcmbjflhfimhfhgcdmgjinglgflhk'
const extensionUrl = `chrome-extension://${extensionId}/`
let root, context, server, base, state, extensionPath

async function launch() {
  context = await chromium.launchPersistentContext(path.join(root, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })
  // Requests from test extension code are redirected to loopback by its shim.
  // Block other page traffic (including the popup's external font).
  await context.route('**/*', route => {
    const url = route.request().url()
    return url.startsWith(base) || url.startsWith(extensionUrl)
      ? route.continue() : route.abort()
  })
  return context.serviceWorkers()[0] || context.waitForEvent('serviceworker')
}
async function currentWorker() {
  return context.serviceWorkers().filter(w => w.url() === extensionUrl + 'background.js').at(-1) || context.waitForEvent('serviceworker')
}
async function popup() {
  const page = context.pages().find(p => p.url() === base + '/article') || await context.newPage()
  if (page.url() !== base + '/article') await page.goto(base + '/article')
  await page.bringToFront()
  const cdp = await context.newCDPSession(page)
  const opened = context.waitForEvent('page')
  // Playwright does not expose Chrome's toolbar popup as a Page. Load the
  // identical popup document in an inactive tab, retaining the article as
  // the real active tab for chrome.tabs.query. Test-only loopback permission
  // grants metadata access; the production activeTab grant needs manual QA.
  await cdp.send('Target.createTarget', { url: extensionUrl + 'popup.html', background: true })
  await cdp.detach()
  const result = await opened
  await result.waitForLoadState('domcontentloaded')
  return result
}
async function waitSends(count) { await expect.poll(() => state.sends.length).toBe(count) }
async function closePopup(page) { if (!page.isClosed()) await page.close() }

test.beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'memail-e2e-'))
  state = { authorized: false, identity: [], sends: [], account: 'first', mode: 'ok', delay: 0, exchanges: 0, workerInstances: [] }
  server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') { res.end(); return }
    let body = ''
    for await (const chunk of req) body += chunk
    if (req.url === '/article') {
      res.setHeader('Content-Type', 'text/html'); res.end('<title>Local article</title><h1>Local article</h1>'); return
    }
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/identity') {
      const { interactive, legacy } = JSON.parse(body)
      state.identity.push({ interactive, legacy: !!legacy })
      if (state.mode === 'cancel') { res.end(JSON.stringify({ error: 'The user did not approve access.' })); return }
      if ((!state.authorized || legacy) && !interactive) {
        res.end(JSON.stringify({ error: 'OAuth2 not granted or revoked.' })); return
      }
      state.authorized = true
      res.end(JSON.stringify({ token: `synthetic-${state.account}` })); return
    }
    if (req.url === '/exchange') {
      state.exchanges++
      state.workerInstances.push(req.headers['x-test-worker'])
      const payload = JSON.parse(body)
      expect(new URLSearchParams(payload.postBody).get('providerId')).toBe('google.com')
      if (state.mode === 'invalid-once' && state.exchanges === 1) {
        res.statusCode = 400; res.end(JSON.stringify({ error: { message: 'INVALID_IDP_RESPONSE' } })); return
      }
      if (state.mode === 'auth-down') { res.statusCode = 503; res.end('{}'); return }
      res.end(JSON.stringify({ idToken: `synthetic-${state.account}`, email: `${state.account}@example.test` })); return
    }
    if (req.url === '/send') {
      // Check synthetic authorization without saving credentials in evidence.
      const authorized = req.headers.authorization === `Bearer synthetic-${state.account}`
      state.sends.push({ ...JSON.parse(body), authorized, account: state.account })
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
      if (state.mode === 'offline') {
        // Lose the response after headers: delivery is now ambiguous. A bare
        // reset on a reused socket can itself cause a Chromium transport retry.
        res.writeHead(200, { 'Content-Length': '1000' }); res.write('partial')
        setTimeout(() => res.destroy(), 20); return
      }
      res.statusCode = state.mode === 'backend-down' ? 503 : 200
      res.end(state.mode === 'backend-down' ? 'error' : 'success'); return
    }
    res.statusCode = 404; res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  extensionPath = path.join(root, 'extension')
  await fs.cp(path.join(__dirname, '../src'), extensionPath, { recursive: true })
})

test.afterEach(async ({}, testInfo) => {
  const evidencePath = testInfo.outputPath('sanitized-flow.json')
  await fs.mkdir(path.dirname(evidencePath), { recursive: true })
  await fs.writeFile(evidencePath, JSON.stringify({
    identityCalls: state.identity, exchanges: state.exchanges,
    sends: state.sends, workerInstances: state.workerInstances,
  }, null, 2))
  await testInfo.attach('sanitized-flow.json', { path: evidencePath, contentType: 'application/json' })
  await context?.close()
  context = null
  await new Promise(resolve => server.close(resolve))
  await fs.rm(root, { recursive: true, force: true })
})

async function prepare({ baseline = false, nativeIdentity = false } = {}) {
  if (baseline) {
    const repo = path.join(__dirname, '../..')
    if (process.env.MEMAIL_BASELINE_DIR) await fs.cp(process.env.MEMAIL_BASELINE_DIR, extensionPath, { recursive: true })
    else for (const name of ['manifest.json', 'popup.html', 'popup.js', 'utils.js']) {
      await fs.writeFile(path.join(extensionPath, name), execFileSync('git', ['show', `5fb6dca:extension/src/${name}`], { cwd: repo }))
    }
  }
  const manifestPath = path.join(extensionPath, 'manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  manifest.host_permissions = [base + '/*']
  if (baseline) manifest.background = { service_worker: 'background.js' }
  await fs.writeFile(manifestPath, JSON.stringify(manifest))
  const shim = `
const nativeFetch = globalThis.fetch.bind(globalThis)
const base = ${JSON.stringify(base)}
const workerInstance = crypto.randomUUID()
globalThis.fetch = (url, options) => {
  if (String(url).startsWith(base)) return nativeFetch(url, options)
  if (String(url).includes('accounts:signInWithIdp')) return nativeFetch(base + '/exchange', { ...options, headers: { ...options.headers, 'X-Test-Worker': workerInstance } })
  if (String(url) === 'https://api.memail.drizco.dev/send') return nativeFetch(base + '/send', options)
  throw new Error('Non-test network request blocked')
}
${nativeIdentity ? '' : `
function identity(options, cb, legacy = false) {
  nativeFetch(base + '/identity', { method: 'POST', body: JSON.stringify({ interactive: options.interactive, legacy }) })
    .then(r => r.json()).then(result => {
      Object.defineProperty(chrome.runtime, 'lastError', { configurable: true, value: result.error ? { message: result.error } : undefined })
      cb(result.token)
      delete chrome.runtime.lastError
    })
}
chrome.identity.getAuthToken = (options, cb) => identity(options, cb)
chrome.identity.removeCachedAuthToken = (_, cb) => cb()
chrome.identity.launchWebAuthFlow = (options, cb) => identity(options, token => cb(token ? chrome.identity.getRedirectURL() + '#access_token=' + token : undefined), true)
`}
`
  await fs.writeFile(path.join(extensionPath, 'test-shim.js'), shim)
  if (baseline) {
    await fs.writeFile(path.join(extensionPath, 'background.js'), '// Test-only worker to open the original popup document.\n')
    const html = await fs.readFile(path.join(extensionPath, 'popup.html'), 'utf8')
    await fs.writeFile(path.join(extensionPath, 'popup.html'), html.replace('<head>', '<head><script src="test-shim.js"></script>'))
  } else {
    const worker = await fs.readFile(path.join(extensionPath, 'background.js'), 'utf8')
    await fs.writeFile(path.join(extensionPath, 'background.js'), `importScripts('test-shim.js')\n${worker}`)
  }
  await launch()
}

test('baseline: original popup requests interactive authorization again after reopening (mocked identity)', async () => {
  await prepare({ baseline: true })
  for (let i = 1; i <= 2; i++) {
    const p = await popup()
    await p.getByRole('button', { name: 'Sign in with Google' }).click()
    await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
    await waitSends(i)
    await closePopup(p)
  }
  expect(state.identity.map(c => c.interactive)).toEqual([false, true, false, true])
})

test('unmocked Chrome identity in a clean profile: controlled first-use sign-in, no email', async () => {
  await prepare({ nativeIdentity: true })
  const p = await popup()
  await expect(p.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  expect(state.exchanges).toBe(0)
  expect(state.sends).toHaveLength(0)
})

test('first sign-in, ten popup reopenings, browser restart, account change and revocation (mocked identity)', async ({}, testInfo) => {
  await prepare()
  let p = await popup()
  await expect(p.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await p.bringToFront()
  await p.screenshot({ path: testInfo.outputPath('first-use.png'), animations: 'disabled', timeout: 5000 })
  await p.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
  await p.screenshot({ path: testInfo.outputPath('success.png'), animations: 'disabled', timeout: 5000 })
  await closePopup(p)
  for (let i = 0; i < 10; i++) {
    p = await popup()
    await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
    await closePopup(p)
  }
  await waitSends(11)
  expect(state.identity.filter(c => c.interactive)).toHaveLength(1)
  expect(state.sends[0]).toEqual({ title: 'Local article', url: base + '/article', authorized: true, account: 'first' })
  await context.close()
  await launch()
  p = await popup()
  await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
  await closePopup(p)
  state.account = 'second'
  p = await popup()
  await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
  await closePopup(p)
  expect(state.sends.at(-1).account).toBe('second')
  state.authorized = false
  p = await popup()
  await expect(p.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  expect(state.sends).toHaveLength(13)
  expect(state.identity.filter(c => c.interactive)).toHaveLength(1)
})

test('popup closure does not cancel send; overlapping popup joins one operation', async () => {
  state.authorized = true; state.delay = 2500
  await prepare()
  let p = await popup()
  await waitSends(1)
  await closePopup(p)
  p = await popup()
  await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
  expect(state.sends).toHaveLength(1)
  expect(state.identity).toEqual([{ interactive: false, legacy: false }])
})

test('worker stop and restart uses browser-owned grant (mocked identity)', async () => {
  state.authorized = true
  await prepare()
  let p = await popup()
  await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
  await closePopup(p)
  const worker = await currentWorker()
  await fs.writeFile(path.join(extensionPath, 'idle.html'), '<title>Idle test page</title>')
  const opened = context.waitForEvent('page')
  await worker.evaluate(url => chrome.tabs.create({ url, active: false }), extensionUrl + 'idle.html')
  const page2 = await opened
  const page = context.pages().find(p => p.url().startsWith(base))
  const cdp = await context.newCDPSession(page)
  await cdp.send('ServiceWorker.enable')
  await cdp.send('ServiceWorker.stopAllWorkers')
  // The background tab wakes the worker through the normal message path.
  await page2.goto(extensionUrl + 'popup.html')
  await expect(page2.locator('#msg-container')).toContainText('MEmail sent!')
  expect(state.identity.filter(c => c.interactive)).toHaveLength(0)
  expect(state.sends).toHaveLength(2)
  expect(state.workerInstances).toHaveLength(2)
  expect(state.workerInstances[1]).not.toBe(state.workerInstances[0])
  expect(state.sends[1].url).toBe(base + '/article')
})

for (const mode of ['cancel', 'auth-down', 'backend-down', 'offline', 'invalid-once']) {
  test(`controlled ${mode} path without unauthorized retries`, async () => {
    state.mode = mode === 'cancel' ? 'ok' : mode; state.authorized = mode !== 'cancel'
    await prepare()
    const p = await popup()
    if (mode === 'cancel') {
      await expect(p.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
      state.mode = 'cancel'
      await p.getByRole('button', { name: 'Sign in with Google' }).click()
      await expect(p.locator('#msg-container')).toContainText('Sign in was not completed')
      expect(state.sends).toHaveLength(0)
    } else if (mode === 'invalid-once') {
      await expect(p.locator('#msg-container')).toContainText('MEmail sent!')
      expect(state.exchanges).toBe(2)
      expect(state.sends).toHaveLength(1)
    } else {
      await expect(p.locator('#msg-container')).toContainText(mode === 'auth-down' ? 'Could not verify' : 'Could not confirm delivery')
      expect(state.sends).toHaveLength(mode === 'auth-down' ? 0 : 1)
    }
    expect(state.identity.filter(c => c.interactive)).toHaveLength(mode === 'cancel' ? 1 : 0)
  })
}
