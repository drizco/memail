const FIREBASE_API_KEY = 'AIzaSyB6I2wwF_Fu4n1M3rZTHwa4ODkcJk5Ncwo'
const CLOUD_FUNCTION_URL =
  'https://us-central1-memail-163415.cloudfunctions.net/sendMeMailV2'
const OAUTH_CLIENT_ID =
  '294672396739-nf6lc5mn3fiu3t8t9jhatfflj7gt3b0l.apps.googleusercontent.com'

function getGoogleToken(interactive = true) {
  const redirectUrl = chrome.identity.getRedirectURL()
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: redirectUrl,
    response_type: 'token',
    scope: 'openid email profile',
  })
  const authUrl = `https://accounts.google.com/o/oauth2/auth?${params}`

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(chrome.runtime.lastError || new Error('No response'))
        return
      }
      const params = new URLSearchParams(new URL(responseUrl.replace('#', '?')).search)
      const token = params.get('access_token')
      if (token) {
        resolve(token)
      } else {
        reject(new Error('No access token in response'))
      }
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
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  )
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message)
  }
  return { idToken: data.idToken, email: data.email }
}

function getTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      resolve({ url: tab.url, title: tab.title })
    })
  })
}

function sendEmail(firebaseIdToken, data) {
  return fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify({ title: data.title, url: data.url }),
  }).then((response) => response.text())
}

const utils = {
  getGoogleToken,
  getFirebaseIdToken,
  getTab,
  sendEmail,
}

if (typeof module !== 'undefined') {
  module.exports = { FIREBASE_API_KEY, CLOUD_FUNCTION_URL, utils }
}
