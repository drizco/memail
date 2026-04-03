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
    const googleToken = await utils.getGoogleToken(interactive)
    const { idToken, email } = await utils.getFirebaseIdToken(googleToken)
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

  async getTab() {
    const tab = await utils.getTab()
    this.data.url = tab.url
    this.data.title = tab.title
    return tab
  }

  async sendEmail() {
    try {
      const responseText = await utils.sendEmail(this.firebaseIdToken, this.data)
      this.renderStatus(responseText)
    } catch (_) {
      this.renderStatus('error')
    }
  }

  async sendFlow(interactive) {
    await this.authenticate(interactive)
    await this.getTab()
    this.renderSending()
    await this.sendEmail()
  }

  renderSending() {
    const msgContainer = document.getElementById('msg-container'),
      fragment = document.createDocumentFragment(),
      mainEl = document.createElement('div'),
      mainText = document.createTextNode('Sending'),
      titleEl = document.createElement('div'),
      titleText = document.createTextNode(this.data.title),
      toEl = document.createElement('div'),
      toText = document.createTextNode('to '),
      emailEl = document.createElement('span'),
      emailText = document.createTextNode(this.email)

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
    setTimeout(window.close, 1500)
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
  const controller = new EmailController()

  try {
    // Try silent auth first (no popup)
    await controller.sendFlow(false)
  } catch {
    // Not authenticated — show sign-in button
    controller.renderSignIn(async () => {
      try {
        await controller.sendFlow()
      } catch {
        controller.renderError('Sign in failed. Please try again.')
      }
    })
  }
})
