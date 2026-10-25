class EmailController {
  constructor() {
    this.data = {
      url: '',
      title: '',
    }
    this.busy = false
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

  renderSending() {
    const msgContainer = document.getElementById('msg-container'),
      fragment = document.createDocumentFragment(),
      mainEl = document.createElement('div'),
      mainText = document.createTextNode('Sending'),
      titleEl = document.createElement('div'),
      titleText = document.createTextNode(this.data.title)

    mainEl.appendChild(mainText)
    titleEl.appendChild(titleText)

    for (let i = 1; i <= 3; i++) {
      let dotText = document.createTextNode('.'),
        dotEl = document.createElement('span')
      dotEl.appendChild(dotText)
      dotEl.setAttribute('class', `dot dot-${i}`)
      mainEl.appendChild(dotEl)
    }

    fragment.appendChild(mainEl)
    fragment.appendChild(titleEl)
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
    if (response === 'success') setTimeout(() => window.close(), 1000)
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

  async function sendFlow(interactive = false) {
    if (MEmail.busy) return
    MEmail.busy = true
    try {
      MEmail.renderSending()
      const result = await chrome.runtime.sendMessage({
        type: 'send-page',
        data: MEmail.data,
        interactive,
      })
      if (result?.status === 'success') {
        MEmail.renderStatus('success')
      } else if (result?.code === 'auth-required') {
        MEmail.renderSignIn(() => sendFlow(true))
      } else {
        MEmail.renderError(result?.message || 'Could not confirm delivery. Check your inbox before trying again.')
      }
    } catch {
      MEmail.renderError('Could not confirm delivery. Check your inbox before trying again.')
    } finally {
      MEmail.busy = false
    }
  }

  try {
    // Capture the original page before authorization changes browser focus.
    await MEmail.getTab()
    await sendFlow()
  } catch {
    MEmail.renderError('Could not read this page. Open a web page and try again.')
  }
})
