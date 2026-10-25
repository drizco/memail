const { utils, CLOUD_FUNCTION_URL } = require('../src/utils')

function reply(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => body }
}

beforeEach(() => {
  global.chrome = {
    identity: {
      getAuthToken: jest.fn((_, cb) => cb('google-fixture')),
      removeCachedAuthToken: jest.fn((_, cb) => cb()),
    },
    tabs: { query: jest.fn((_, cb) => cb([{ url: 'https://example.test/', title: 'Fixture' }])) },
    runtime: { lastError: null },
  }
  global.fetch = jest.fn().mockResolvedValue(reply({ idToken: 'firebase-fixture', email: 'fixture@example.test' }))
})

function failIdentity(message) {
  chrome.identity.getAuthToken.mockImplementation((_, cb) => {
    chrome.runtime.lastError = { message }
    cb()
    chrome.runtime.lastError = null
  })
}

test('silent by default; explicit user action enables interactive auth', async () => {
  await utils.getGoogleToken()
  await utils.getGoogleToken(true)
  expect(chrome.identity.getAuthToken.mock.calls.map(([o]) => o.interactive)).toEqual([false, true])
})

test.each(['OAuth2 not granted or revoked.', 'The user is not signed in.'])(
  'offers sign-in only for missing authorization: %s', async message => {
    failIdentity(message)
    await expect(utils.getGoogleToken()).rejects.toMatchObject({ code: 'auth-required' })
  }
)

test.each(['OAuth2 request failed: Connection failed (-2).', 'Invalid OAuth2 Client ID.', 'The user did not approve access.'])(
  'does not turn other identity errors into automatic login: %s', async message => {
    failIdentity(message)
    await expect(utils.getGoogleToken()).rejects.toMatchObject({ code: 'auth-failed' })
    expect(chrome.identity.getAuthToken).toHaveBeenCalledTimes(1)
  }
)

test('cancellation stops before Firebase or delivery', async () => {
  failIdentity('The user did not approve access.')
  await expect(utils.authenticate(true)).rejects.toMatchObject({ code: 'auth-failed' })
  expect(fetch).not.toHaveBeenCalled()
})

test('encodes the Google credential and preserves the Firebase contract', async () => {
  await expect(utils.getFirebaseIdToken('fixture+&=')).resolves.toEqual({ idToken: 'firebase-fixture', email: 'fixture@example.test' })
  const [url, options] = fetch.mock.calls[0]
  expect(url).toContain('accounts:signInWithIdp?key=')
  const body = JSON.parse(options.body)
  expect(new URLSearchParams(body.postBody).get('access_token')).toBe('fixture+&=')
  expect(body.requestUri).toBe('http://localhost')
  expect(body.returnSecureToken).toBe(true)
  expect(body.returnIdpCredential).toBeUndefined()
})

test.each(['INVALID_IDP_RESPONSE', 'INVALID_OAUTH_ACCESS_TOKEN'])(
  'evicts a rejected Chrome token and renews silently once: %s', async code => {
    fetch.mockResolvedValueOnce(reply({ error: { message: code + ': provider details' } }, 400))
    await utils.authenticate()
    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'google-fixture' }, expect.any(Function))
    expect(chrome.identity.getAuthToken.mock.calls.map(([o]) => o.interactive)).toEqual([false, false])
    expect(fetch).toHaveBeenCalledTimes(2)
  }
)

test('repeated invalid credentials never loop', async () => {
  fetch.mockResolvedValue(reply({ error: { message: 'INVALID_IDP_RESPONSE' } }, 400))
  await expect(utils.authenticate()).rejects.toMatchObject({ code: 'invalid-google-token' })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledTimes(1)
})

test('revoked authorization during renewal offers sign-in, never starts it', async () => {
  fetch.mockResolvedValueOnce(reply({ error: { message: 'INVALID_IDP_RESPONSE' } }, 400))
  chrome.identity.getAuthToken.mockImplementationOnce((_, cb) => cb('expired-fixture'))
  failIdentity('OAuth2 not granted or revoked.')
  await expect(utils.authenticate()).rejects.toMatchObject({ code: 'auth-required' })
  expect(chrome.identity.getAuthToken.mock.calls.map(([o]) => o.interactive)).toEqual([false, false])
})

test.each([400, 403, 429, 500, 503])('Firebase failure %s does not clear grants or open login', async status => {
  fetch.mockResolvedValue(reply({ error: { message: 'SERVICE_UNAVAILABLE' } }, status))
  await expect(utils.authenticate()).rejects.toMatchObject({ code: 'auth-service-failed' })
  expect(chrome.identity.removeCachedAuthToken).not.toHaveBeenCalled()
  expect(chrome.identity.getAuthToken.mock.calls.map(([o]) => o.interactive)).toEqual([false])
})

test.each([{}, { idToken: 'fixture' }, { email: 'fixture@example.test' }])('rejects incomplete Firebase response %j', async body => {
  fetch.mockResolvedValue(reply(body))
  await expect(utils.authenticate()).rejects.toMatchObject({ code: 'auth-service-failed' })
})

test('network failure during auth never requests interactive login', async () => {
  fetch.mockRejectedValue(new Error('Offline'))
  await expect(utils.authenticate()).rejects.toThrow('Offline')
  expect(chrome.identity.getAuthToken.mock.calls.map(([o]) => o.interactive)).toEqual([false])
})

test('tab metadata and fallback title', async () => {
  await expect(utils.getTab()).resolves.toEqual({ url: 'https://example.test/', title: 'Fixture' })
  chrome.tabs.query.mockImplementation((_, cb) => cb([{ url: 'https://example.test/' }]))
  await expect(utils.getTab()).resolves.toEqual({ url: 'https://example.test/', title: 'https://example.test/' })
})

test('missing tab is controlled error', async () => {
  chrome.tabs.query.mockImplementation((_, cb) => cb([]))
  await expect(utils.getTab()).rejects.toMatchObject({ code: 'tab-unavailable' })
})

test('sends exactly the backend payload with Firebase bearer authorization', async () => {
  fetch.mockResolvedValue(reply('success'))
  await expect(utils.sendEmail('firebase-fixture', { title: 'Fixture', url: 'https://example.test/' })).resolves.toBe('success')
  expect(fetch).toHaveBeenCalledWith(CLOUD_FUNCTION_URL, expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', Authorization: 'Bearer firebase-fixture' },
    body: JSON.stringify({ title: 'Fixture', url: 'https://example.test/' }),
  }))
})

test.each([401, 403, 429, 500, 503])('delivery failure %s never retries or opens auth, even with success body', async status => {
  fetch.mockResolvedValue(reply('success', status))
  await expect(utils.sendEmail('fixture', {})).rejects.toMatchObject({ code: 'delivery-failed' })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(chrome.identity.getAuthToken).not.toHaveBeenCalled()
})

test('unexpected successful HTTP response is not delivery confirmation', async () => {
  fetch.mockResolvedValue(reply('error'))
  await expect(utils.sendEmail('fixture', {})).rejects.toMatchObject({ code: 'delivery-failed' })
})

test('ambiguous network outcome warns about possible delivery and never retries', async () => {
  fetch.mockRejectedValue(new Error('Offline'))
  await expect(utils.sendEmail('fixture', {})).rejects.toMatchObject({ code: 'delivery-unknown' })
  expect(fetch).toHaveBeenCalledTimes(1)
})
