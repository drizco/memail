/** @jest-environment jsdom */
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../src/popup'), 'utf8')
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
let start, send, getTab, close
beforeEach(() => {
  document.body.innerHTML = '<div id="msg-container"></div>'
  send = jest.fn()
  getTab = jest.fn().mockResolvedValue({ title: 'Original page', url: 'https://example.test/' })
  close = jest.fn()
  const documentProxy = new Proxy(document, {
    get(target, key) {
      if (key === 'addEventListener') return (_, fn) => { start = fn }
      const value = target[key]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  vm.runInNewContext(source, {
    document: documentProxy, window: { close }, setTimeout,
    chrome: { runtime: { sendMessage: send } }, utils: { getTab },
  })
})

test('opens silently and reports success with original page metadata', async () => {
  send.mockResolvedValue({ status: 'success' })
  await start()
  expect(send).toHaveBeenCalledWith({ type: 'send-page', interactive: false, data: { title: 'Original page', url: 'https://example.test/' } })
  expect(document.body.textContent).toContain('MEmail sent!')
})

test('sign-in is explicit; rapid button clicks do not create duplicate messages or recapture tab', async () => {
  let finish
  send.mockResolvedValueOnce({ status: 'error', code: 'auth-required' })
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await start()
  const button = document.querySelector('button')
  button.click(); button.click(); button.click()
  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls[1][0].interactive).toBe(true)
  expect(getTab).toHaveBeenCalledTimes(1)
  finish({ status: 'success' })
  await flush()
  expect(document.body.textContent).toContain('MEmail sent!')
})

test('backend and network errors never offer login or close error feedback', async () => {
  send.mockResolvedValue({ status: 'error', code: 'delivery-failed', message: 'Check your inbox before trying again.' })
  await start()
  expect(document.querySelector('button')).toBeNull()
  expect(document.body.textContent).toContain('Check your inbox')
  expect(close).not.toHaveBeenCalled()
})

test('missing tab does not start authentication', async () => {
  getTab.mockRejectedValue(new Error('No tab'))
  await start()
  expect(send).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('Could not read this page')
})
