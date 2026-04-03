const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
admin.initializeApp()

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const NO_REPLY_EMAIL = 'no-reply@memail.drizco.dev'

const getTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY.value(),
    },
  })
}

const isYouTubeUrl = (url) => {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com'
  } catch (_) {
    return false
  }
}

const fetchYouTubeTitle = async (url) => {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json()
    return data.title || null
  } catch (_) {
    return null
  }
}

const fetchPageTitle = async (url) => {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return match ? match[1].trim() : null
  } catch (_) {
    return null
  }
}

const cleanUrl = (url) => {
  try {
    const parsed = new URL(url)
    return parsed.hostname + parsed.pathname.replace(/\/$/, '')
  } catch (_) {
    return url.replace(/^https?:\/\//, '').split('?')[0]
  }
}

const brandRed = '#c8261e'
const bmcLink = 'https://www.buymeacoffee.com/drizco'
const logoUrl = 'https://api.memail.drizco.dev/logo.png'

const getEmailTemplate = (title, url) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,800;1,800&display=swap');
    .email-body { font-family: 'Nunito', sans-serif; color: #333; line-height: 1.6; }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #f9f9f9; font-family: 'Nunito', sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 6px rgba(0,0,0,0.1); font-family: 'Nunito', sans-serif; table-layout: fixed;">
    
    <tr>
      <td align="center" style="padding: 30px 0; background-color: #ffffff; font-weight: 800; font-style: italic;">
        <img src="${logoUrl}" alt="MEmail" width="70" height="70" style="display: block; border: 0; outline: none;">
      </td>
    </tr>

    <tr>
      <td style="padding: 0 40px 40px 40px; text-align: center;">
        <h2 style="font-size: 24px; margin-bottom: 40px;"><a href="${url}" style="color: ${brandRed}; text-decoration: none;">${title || url}</a></h2>

        <p style="margin-bottom: 40px;font-size: 13px; word-break: break-all;">
          <a href="${url}" style="color: ${brandRed};">${url}</a>
        </p>
        
        <p>
          <a href="${url}" style="background-color: ${brandRed}; color: #ffffff; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 3px; font-size: 18px; display: inline-block;">
            Open Link
          </a>
        </p>
        
      </td>
    </tr>

    <tr>
      <td style="padding: 20px; background-color: #f4f4f4; text-align: center; font-size: 12px; color: #888;">
        You sent yourself this link via <strong>MEmail</strong>
        <br><br>
        Enjoying MEmail? <a href="${bmcLink}" style="color: ${brandRed}; text-decoration: none; font-weight: bold;">Buy me a coffee</a>  ☕️
      </td>
    </tr>
  </table>
</body>
</html>
`
}

exports.sendMeMailV2 = onRequest(
  {
    cors: true, // token validation secures endpoint
    secrets: [RESEND_API_KEY],
    region: 'us-central1',
  },
  async (req, res) => {
    try {
      let recipientEmail
      const authHeader = req.headers.authorization

      if (!authHeader) {
        return res.status(401).send('Not authenticated')
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      recipientEmail = decodedToken.email

      if (!recipientEmail) {
        return res.status(400).send('No email associated with account')
      }

      const { title, url } = req.body
      const transporter = getTransporter()

      let subject = title
      if (!subject && isYouTubeUrl(url)) {
        subject = await fetchYouTubeTitle(url)
      }
      if (!subject) {
        subject = await fetchPageTitle(url)
      }
      if (!subject) {
        subject = cleanUrl(url)
      }

      await transporter.sendMail({
        from: `MEmail <${NO_REPLY_EMAIL}>`,
        to: recipientEmail,
        subject,
        text: `Your Link: ${url}\n\nSupport MEmail: ${bmcLink}`,
        html: getEmailTemplate(subject, url),
      })

      if (req.query.format === 'json') {
        return res.status(200).json({ title: subject, url })
      }
      return res.status(200).send('success')
    } catch (error) {
      console.error(error)
      return res.status(500).send('error')
    }
  }
)

exports.sendMeMail = onRequest(
  {
    cors: {
      origin: [
        `chrome-extension://fflpcmbjflhfimhfhgcdmgjinglgflhk`,
        'http://localhost:3000',
      ],
    },
    secrets: [RESEND_API_KEY],
    region: 'us-central1',
  },
  async (req, res) => {
    try {
      // Verify Firebase ID token if present, fall back to body email for
      // backwards compatibility with the currently published Chrome extension.
      // TODO: Remove fallback once the new extension is published.
      let recipientEmail
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1]
        const decodedToken = await admin.auth().verifyIdToken(idToken)
        recipientEmail = decodedToken.email
        if (!recipientEmail) {
          return res.status(400).send('No email associated with this account')
        }
      } else {
        recipientEmail = req.body.email
        if (!recipientEmail) {
          return res.status(400).send('Missing email')
        }
      }

      const { title, url } = req.body

      const subject = title || cleanUrl(url)

      const transporter = getTransporter()
      await transporter.sendMail({
        from: `MEmail <${NO_REPLY_EMAIL}>`,
        to: recipientEmail,
        subject,
        text: `Your Link: ${url}\n\nSupport MEmail: ${bmcLink}`,
        html: getEmailTemplate(subject, url),
      })
      return res.status(200).send('success')
    } catch (error) {
      console.error(error)
      return res.status(500).send('error')
    }
  }
)
