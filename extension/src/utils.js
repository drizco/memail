const FIREBASE_API_KEY = 'AIzaSyB6I2wwF_Fu4n1M3rZTHwa4ODkcJk5Ncwo'
const CLOUD_FUNCTION_URL =
  'https://us-central1-memail-163415.cloudfunctions.net/sendMeMailV2'

function getGoogleToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(token)
      }
    })
  })
}

async function getFirebaseIdToken(googleAccessToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
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
