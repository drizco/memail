const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

// Identity is owned by the browser, deliberately outside the worker context.
// These are synthetic grants; they do not prove real Google session persistence.
let authorized, account, identityCalls, deliveries, failDelivery, cancel, gate
const data = { title: 'Fixture', url: 'https://example.test/' }
function worker() {
  let listener
  const chrome = {
    runtime: {
      id: 'fixture', lastError: null, getURL: p => `chrome-extension://fixture/${p}`,
      onMessage: { addListener: fn => { listener = fn } },
    },
    identity: {
      getAuthToken: ({ interactive }, cb) => {
        identityCalls.push(interactive)
        if ((!authorized && !interactive) || cancel) {
          chrome.runtime.lastError = { message: cancel ? 'The user did not approve access.' : 'OAuth2 not granted or revoked.' }
          cb()
          chrome.runtime.lastError = null
        } else { authorized = true; cb(account) }
      },
      removeCachedAuthToken: (_, cb) => cb(),
    },
  }
  const context = vm.createContext({ chrome, URLSearchParams, AbortSignal, fetch: async (url, options) => {
    if (url.includes('signInWithIdp')) return { ok: true, json: async () => ({ idToken: account, email: `${account}@example.test` }) }
    deliveries.push({ ...JSON.parse(options.body), account: options.headers.Authorization })
    if (gate) await gate
    return { ok: !failDelivery, status: failDelivery ? 500 : 200, text: async () => failDelivery ? 'error' : 'success' }
  } })
  context.importScripts = name => vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', name), 'utf8'), context)
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8'), context)
  return (interactive = false, sender = { id: 'fixture', url: 'chrome-extension://fixture/popup.html' }) => new Promise(resolve => {
    const keepAlive = listener({ type: 'send-page', data, interactive }, sender, resolve)
    if (!keepAlive) resolve('ignored')
  })
}

beforeEach(() => {
  authorized = false; account = 'first'; identityCalls = []; deliveries = []
  failDelivery = false; cancel = false; gate = null
})

test('first use needs explicit sign-in, then ten clicks send with no further interaction', async () => {
  const send = worker()
  expect(await send()).toMatchObject({ code: 'auth-required' })
  expect(deliveries).toHaveLength(0)
  expect(await send(true)).toEqual({ status: 'success' })
  for (let i = 0; i < 10; i++) expect(await send()).toEqual({ status: 'success' })
  expect(identityCalls).toEqual([false, true, ...Array(10).fill(false)])
  expect(deliveries).toHaveLength(11)
  expect(deliveries[0]).toEqual({ ...data, account: 'Bearer first' })
})

test('fresh worker contexts reuse the external grant without persisting application credentials', async () => {
  await worker()(true)
  expect(await worker()()).toEqual({ status: 'success' })
  expect(await worker()()).toEqual({ status: 'success' })
  expect(identityCalls).toEqual([true, false, false])
})

test('account change uses new identity, revocation offers reauthorization', async () => {
  const send = worker()
  await send(true)
  account = 'second'
  await send()
  expect(deliveries[1].account).toBe('Bearer second')
  authorized = false
  expect(await send()).toMatchObject({ code: 'auth-required' })
  expect(deliveries).toHaveLength(2)
  expect(identityCalls).toEqual([true, false, false])
})

test('overlapping popup requests share one delivery and one auth attempt', async () => {
  authorized = true
  let finish
  gate = new Promise(resolve => { finish = resolve })
  const send = worker()
  const pending = Array.from({ length: 10 }, () => send())
  finish()
  expect(await Promise.all(pending)).toEqual(Array(10).fill({ status: 'success' }))
  expect(deliveries).toHaveLength(1)
  expect(identityCalls).toEqual([false])
  gate = null
  await send()
  expect(deliveries).toHaveLength(2)
})

test('cancellation sends nothing and the next user action can recover', async () => {
  const send = worker()
  cancel = true
  expect(await send(true)).toMatchObject({ code: 'auth-failed' })
  expect(deliveries).toHaveLength(0)
  cancel = false
  expect(await send(true)).toEqual({ status: 'success' })
})

test('delivery failure releases concurrency guard without retrying or interactive auth', async () => {
  authorized = true; failDelivery = true
  const send = worker()
  expect(await send()).toMatchObject({ code: 'delivery-failed' })
  expect(deliveries).toHaveLength(1)
  expect(identityCalls).toEqual([false])
  failDelivery = false
  expect(await send()).toEqual({ status: 'success' })
})

test('messages from other pages are ignored', async () => {
  expect(await worker()(true, { id: 'fixture', url: 'https://example.test/' })).toBe('ignored')
  expect(identityCalls).toHaveLength(0)
})
