const functions = require('firebase-functions')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const cors = require('cors')({
  origin: [`chrome-extension://${process.env.EXTENSION_ID}`, 'http://localhost:3000'],
})

admin.initializeApp()

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY,
  },
})

exports.sendMeMail = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
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

      const mailOptions = {
        from: `MEmail <${process.env.NO_REPLY_EMAIL}>`,
        to: recipientEmail,
        subject: title,
        text: url,
      }

      await transporter.sendMail(mailOptions)
      return res.status(200).send('success')
    } catch (error) {
      console.error(error)
      return res.status(500).send('error')
    }
  })
)
