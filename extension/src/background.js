importScripts('utils.js')

// Keep the operation alive when the popup closes, and join overlapping clicks.
// Credentials remain local to the operation; Chrome owns the OAuth token cache.
let inFlight = null

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL('popup.html') ||
      message?.type !== 'send-page') return

  if (!inFlight) {
    inFlight = (async () => {
      const data = message.data
      if (!data || typeof data.url !== 'string' || !data.url ||
          typeof data.title !== 'string') {
        throw new MEmailError('tab-unavailable', 'Could not read this page. Please try again.')
      }
      const { idToken } = await utils.authenticate(message.interactive === true)
      await utils.sendEmail(idToken, data)
      return { status: 'success' }
    })().catch(error => ({
      status: 'error',
      code: error instanceof MEmailError ? error.code : 'unavailable',
      message: error instanceof MEmailError
        ? error.message
        : 'Could not connect. Check your connection and try again.',
    })).finally(() => { inFlight = null })
  }
  inFlight.then(sendResponse)
  return true
})
