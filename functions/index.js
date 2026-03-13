const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const https = require('https')
const http = require('http')

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

const fetchPageTitle = (url) => {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const request = client.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 400) {
        resolve(null)
        res.resume()
        return
      }

      // Follow redirects
      if (res.statusCode >= 300 && res.headers.location) {
        resolve(fetchPageTitle(res.headers.location))
        res.resume()
        return
      }

      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
        // Stop reading once we have enough to find the title
        const match = body.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (match) {
          resolve(match[1].trim())
          res.destroy()
        }
      })
      res.on('end', () => {
        const match = body.match(/<title[^>]*>([^<]+)<\/title>/i)
        resolve(match ? match[1].trim() : null)
      })
    })
    request.on('error', () => resolve(null))
    request.on('timeout', () => {
      request.destroy()
      resolve(null)
    })
  })
}

const cleanUrl = (url) => {
  try {
    const parsed = new URL(url)
    return parsed.hostname + parsed.pathname.replace(/\/$/, '')
  } catch (_) {
    return url.replace(/^https?:\/\//, '').split('?')[0]
  }
}

const brandRed = '#b8221a'
const bmcLink = 'https://www.buymeacoffee.com/drizco'
const logoUrl = 'https://api.memail.drizco.dev/logo.png'

const getEmailTemplate = (title, url) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css?family=Josefin+Slab:600');
    .email-body { font-family: 'Josefin Slab', serif; color: #333; line-height: 1.6; }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #f9f9f9;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
    
    <tr>
      <td align="center" style="padding: 30px 0; background-color: #ffffff;">
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

      return res.status(200).send('success')
    } catch (error) {
      console.error(error)
      return res.status(500).send('error')
    }
  }
)
