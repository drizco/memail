const FIREBASE_API_KEY = 'AIzaSyB6I2wwF_Fu4n1M3rZTHwa4ODkcJk5Ncwo'

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

class EmailController {
  constructor() {
    this.data = {
      url: '',
      title: '',
    }
    this.firebaseIdToken = null
    this.email = null
  }

  async authenticate(interactive = true) {
    const googleToken = await getGoogleToken(interactive)
    const { idToken, email } = await getFirebaseIdToken(googleToken)
    this.firebaseIdToken = idToken
    this.email = email
  }

  renderSignIn(onSignIn) {
    const msgContainer = document.getElementById('msg-container')
    const button = document.createElement('button')
    button.textContent = 'Sign in with Google'
    button.addEventListener('click', onSignIn)
    msgContainer.innerHTML = null
    msgContainer.appendChild(button)
  }

  getTab() {
    const tabPromise = new Promise((resolve) => {
      const config = {
        active: true,
        currentWindow: true,
      }
      chrome.tabs.query(config, (tabs) => {
        const tab = tabs[0]
        this.data.url = tab.url
        this.data.title = tab.title
        resolve(tab)
      })
    })
    return tabPromise
  }

  sendEmail(done) {
    fetch('https://us-central1-memail-163415.cloudfunctions.net/sendMeMailV2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${this.firebaseIdToken}`,
      },
      body: JSON.stringify({ title: this.data.title, url: this.data.url }),
    })
      .then((response) => response.text())
      .then((responseText) => done(responseText))
      .catch(() => done('error'))
  }

  renderSending(email) {
    const msgContainer = document.getElementById('msg-container'),
      fragment = document.createDocumentFragment(),
      mainEl = document.createElement('div'),
      mainText = document.createTextNode('Sending'),
      titleEl = document.createElement('div'),
      titleText = document.createTextNode(this.data.title),
      toEl = document.createElement('div'),
      toText = document.createTextNode('to '),
      emailEl = document.createElement('span'),
      emailText = document.createTextNode(email)

    mainEl.appendChild(mainText)
    titleEl.appendChild(titleText)
    toEl.appendChild(toText)
    emailEl.appendChild(emailText)

    for (let i = 1; i <= 3; i++) {
      let dotText = document.createTextNode('.'),
        dotEl = document.createElement('span')
      dotEl.appendChild(dotText)
      dotEl.setAttribute('class', `dot dot-${i}`)
      mainEl.appendChild(dotEl)
    }

    toEl.appendChild(emailEl)

    fragment.appendChild(mainEl)
    fragment.appendChild(titleEl)
    fragment.appendChild(toEl)
    msgContainer.innerHTML = null
    msgContainer.appendChild(fragment)
  }

  renderStatus(response) {
    const msgContainer = document.getElementById('msg-container'),
      status = document.createElement('div'),
      success = 'MEmail sent!',
      error = 'uh oh, something went wrong...',
      statusMessage = response === 'success' ? success : error,
      statusText = document.createTextNode(statusMessage)
    status.className = 'status animate'
    status.appendChild(statusText)
    msgContainer.innerHTML = null
    msgContainer.appendChild(status)
    setTimeout(window.close, 1000)
  }

  renderError(message) {
    const msgContainer = document.getElementById('msg-container'),
      status = document.createElement('div'),
      statusText = document.createTextNode(message)
    status.className = 'status animate'
    status.appendChild(statusText)
    msgContainer.innerHTML = null
    msgContainer.appendChild(status)
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const MEmail = new EmailController()

  async function sendFlow() {
    await MEmail.authenticate()
    await MEmail.getTab()
    MEmail.renderSending(MEmail.email)
    MEmail.sendEmail(MEmail.renderStatus.bind(MEmail))
  }

  try {
    // Try silent auth first (no popup)
    await MEmail.authenticate(false)
    await MEmail.getTab()
    MEmail.renderSending(MEmail.email)
    MEmail.sendEmail(MEmail.renderStatus.bind(MEmail))
  } catch {
    // Not authenticated — show sign-in button
    MEmail.renderSignIn(async () => {
      try {
        await sendFlow()
      } catch {
        MEmail.renderError('Sign in failed. Please try again.')
      }
    })
  }
})
