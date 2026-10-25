const admin = require('firebase-admin')

jest.mock('firebase-admin', () => {
  const verifyIdToken = jest.fn()
  return {
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({ verifyIdToken })),
  }
})

const mockSendMail = jest.fn().mockResolvedValue({})
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}))

jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((_opts, handler) => handler),
}))

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn(() => ({ value: () => 'test-api-key' })),
}))

const { sendMeMailV2 } = require('./index')

function mockReqRes(overrides = {}) {
  const req = {
    headers: { authorization: 'Bearer valid-token' },
    body: { title: 'Test Page', url: 'https://example.com' },
    query: {},
    ...overrides,
  }
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
  return { req, res }
}

describe('sendMeMailV2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    admin.auth().verifyIdToken.mockResolvedValue({ email: 'user@test.com' })
    // Never fetch external pages from a unit test.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, url: 'https://example.com',
      text: async () => '<title>Fetched Page</title>',
    })
  })

  it('returns 401 when no authorization header', async () => {
    const { req, res } = mockReqRes({ headers: {} })
    await sendMeMailV2(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.send).toHaveBeenCalledWith('Not authenticated')
  })

  it('returns 400 when account has no email', async () => {
    admin.auth().verifyIdToken.mockResolvedValue({ email: null })
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.send).toHaveBeenCalledWith('No email associated with account')
  })

  it('sends email and returns 200 on success', async () => {
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('success')
  })

  it('sends email with correct format', async () => {
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'MEmail <no-reply@memail.drizco.dev>',
      to: 'user@test.com',
      subject: 'Fetched Page',
      text: expect.stringContaining('Your Link: https://example.com'),
      html: expect.stringContaining('Fetched Page'),
    }))
  })

  it('falls back to the URL when page metadata is unavailable', async () => {
    fetch.mockResolvedValue({ ok: false })
    const { req, res } = mockReqRes({ body: { url: 'https://example.com' } })
    await sendMeMailV2(req, res)

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'example.com' })
    )
  })

  it('extracts Bearer token from authorization header', async () => {
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)
    expect(admin.auth().verifyIdToken).toHaveBeenCalledWith('valid-token')
  })

  it('returns 500 when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'))
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.send).toHaveBeenCalledWith('error')
  })

  it('returns 500 when token verification fails', async () => {
    admin.auth().verifyIdToken.mockRejectedValue(new Error('Invalid token'))
    const { req, res } = mockReqRes()
    await sendMeMailV2(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.send).toHaveBeenCalledWith('error')
  })
})
