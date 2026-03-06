const {
  utils: { getGoogleToken, getFirebaseIdToken, getTab, sendEmail },
} = require('../src/utils')

// Mock chrome APIs
global.chrome = {
  identity: {
    launchWebAuthFlow: jest.fn(),
    getRedirectURL: jest.fn(() => 'https://test-id.chromiumapp.org/'),
  },
  tabs: {
    query: jest.fn(),
  },
  runtime: {
    lastError: null,
  },
}

// Mock fetch
global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  chrome.runtime.lastError = null
})

describe('getGoogleToken', () => {
  it('resolves with token on success', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((_opts, cb) => {
      cb('https://test-id.chromiumapp.org/#access_token=google-token-123&token_type=Bearer')
    })

    const token = await getGoogleToken()
    expect(token).toBe('google-token-123')
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      { url: expect.stringContaining('accounts.google.com'), interactive: true },
      expect.any(Function)
    )
  })

  it('passes interactive=false when specified', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((_opts, cb) => {
      cb('https://test-id.chromiumapp.org/#access_token=token&token_type=Bearer')
    })

    await getGoogleToken(false)
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      { url: expect.any(String), interactive: false },
      expect.any(Function)
    )
  })

  it('rejects with runtime error', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((_opts, cb) => {
      chrome.runtime.lastError = { message: 'User not signed in' }
      cb(undefined)
    })

    await expect(getGoogleToken()).rejects.toEqual({
      message: 'User not signed in',
    })
  })

  it('rejects when no access token in response', async () => {
    chrome.identity.launchWebAuthFlow.mockImplementation((_opts, cb) => {
      cb('https://test-id.chromiumapp.org/#error=access_denied')
    })

    await expect(getGoogleToken()).rejects.toThrow('No access token in response')
  })
})

describe('getFirebaseIdToken', () => {
  it('exchanges google token for firebase token', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          idToken: 'firebase-id-token',
          email: 'user@test.com',
        }),
    })

    const result = await getFirebaseIdToken('google-token')
    expect(result).toEqual({
      idToken: 'firebase-id-token',
      email: 'user@test.com',
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('accounts:signInWithIdp'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const callBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(callBody.postBody).toContain('access_token=google-token')
    expect(callBody.postBody).toContain('providerId=google.com')
  })

  it('throws on error response', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          error: { message: 'INVALID_TOKEN' },
        }),
    })

    await expect(getFirebaseIdToken('bad-token')).rejects.toThrow('INVALID_TOKEN')
  })
})

describe('getTab', () => {
  it('returns active tab url and title', async () => {
    chrome.tabs.query.mockImplementation((_config, cb) => {
      cb([{ url: 'https://example.com', title: 'Example' }])
    })

    const result = await getTab()
    expect(result).toEqual({
      url: 'https://example.com',
      title: 'Example',
    })
    expect(chrome.tabs.query).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.any(Function)
    )
  })
})

describe('sendEmail', () => {
  it('sends POST with correct headers and body', async () => {
    fetch.mockResolvedValue({ text: () => Promise.resolve('success') })

    const result = await sendEmail('my-token', {
      title: 'Test Page',
      url: 'https://example.com',
    })

    expect(result).toBe('success')
    expect(fetch).toHaveBeenCalledWith(
      'https://us-central1-memail-163415.cloudfunctions.net/sendMeMailV2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          Authorization: 'Bearer my-token',
        },
        body: JSON.stringify({
          title: 'Test Page',
          url: 'https://example.com',
        }),
      }
    )
  })

  it('propagates fetch errors', async () => {
    fetch.mockRejectedValue(new Error('Network error'))

    await expect(sendEmail('token', { title: 'T', url: 'http://x.com' })).rejects.toThrow(
      'Network error'
    )
  })
})
