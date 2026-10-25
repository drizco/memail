const FIREBASE_API_KEY = 'AIzaSyB6I2wwF_Fu4n1M3rZTHwa4ODkcJk5Ncwo'
const CLOUD_FUNCTION_URL = 'https://api.memail.drizco.dev/send'

class MEmailError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function getGoogleToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const error = chrome.runtime.lastError
      if (error || !token) {
        // Only missing authorization should offer sign-in. Network and OAuth
        // configuration errors must not trigger another authorization flow.
        const needsAuth = /^(OAuth2 not granted or revoked\.|The user is not signed in\.)$/.test(
          error?.message || ''
        )
        reject(new MEmailError(
          needsAuth && !interactive ? 'auth-required' : 'auth-failed',
          interactive
            ? 'Sign in was not completed. Please try again.'
            : 'Could not authorize MEmail. Check your Chrome sign-in and try again.'
        ))
        return
      }
      resolve(token)
    })
  })
}

function removeGoogleToken(token) {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      if (chrome.runtime.lastError) {
        reject(new MEmailError('auth-failed', 'Could not renew authorization. Please try again.'))
      } else resolve()
    })
  })
}

async function getFirebaseIdToken(googleAccessToken) {
  const params = new URLSearchParams({ key: FIREBASE_API_KEY })
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?${params}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: new URLSearchParams({
          access_token: googleAccessToken,
          providerId: 'google.com',
        }).toString(),
        requestUri: 'http://localhost',
        returnSecureToken: true,
      }),
      signal: AbortSignal.timeout(20000),
    }
  )
  const data = await response.json()
  if (!response.ok || data.error) {
    // Firebase may append provider details. Never expose or log the raw body.
    const code = data.error?.message?.split(/\s|:/)[0]
    const invalidToken = response.status === 400 &&
      ['INVALID_IDP_RESPONSE', 'INVALID_OAUTH_ACCESS_TOKEN'].includes(code)
    throw new MEmailError(
      invalidToken ? 'invalid-google-token' : 'auth-service-failed',
      'Could not verify your Google account. Please try again.'
    )
  }
  if (typeof data.idToken !== 'string' || !data.idToken ||
      typeof data.email !== 'string' || !data.email) {
    throw new MEmailError('auth-service-failed', 'Your Google account has no usable email address.')
  }
  return { idToken: data.idToken, email: data.email }
}

async function authenticate(interactive = false) {
  let token = await getGoogleToken(interactive)
  try {
    return await getFirebaseIdToken(token)
  } catch (error) {
    if (error.code !== 'invalid-google-token') throw error
    // Only retry the pre-delivery credential exchange, once. Chrome owns
    // expiry/renewal; remove only the rejected token, not all account grants.
    await removeGoogleToken(token)
    token = await getGoogleToken(false)
    return getFirebaseIdToken(token)
  }
}

function getTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs?.[0]?.url) {
        reject(new MEmailError('tab-unavailable', 'Could not read this page. Open a web page and try again.'))
        return
      }
      const tab = tabs[0]
      resolve({ url: tab.url, title: tab.title || tab.url })
    })
  })
}

async function sendEmail(firebaseIdToken, data) {
  let response
  try {
    response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({ title: data.title, url: data.url }),
      signal: AbortSignal.timeout(20000),
    })
    if (response.ok && await response.text() === 'success') return 'success'
  } catch {
    // The server may already have sent the email: never replay this request.
    throw new MEmailError('delivery-unknown', 'Could not confirm delivery. Check your inbox before trying again.')
  }
  throw new MEmailError(
    'delivery-failed',
    response.status === 401 || response.status === 403
      ? 'The server rejected authorization. Please try again later.'
      : 'Could not confirm delivery. Check your inbox before trying again.'
  )
}

const utils = { getGoogleToken, getFirebaseIdToken, authenticate, getTab, sendEmail }

if (typeof module !== 'undefined') {
  module.exports = { FIREBASE_API_KEY, CLOUD_FUNCTION_URL, MEmailError, utils }
}
