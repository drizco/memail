const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')

admin.initializeApp()

const resendApiKey = defineSecret('RESEND_API_KEY')

const getTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: resendApiKey.value(),
    },
  })
}

exports.sendMeMailV2 = onRequest(
  {
    cors: [`chrome-extension://${process.env.EXTENSION_ID}`, 'http://localhost:3000'],
    secrets: [resendApiKey],
    region: 'us-central1',
  },
  async (req, res) => {
    try {
      let recipientEmail
      const authHeader = req.headers.authorization

      if (!authHeader) {
        return res.status(400).send('Not authenticated')
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      recipientEmail = decodedToken.email

      if (!recipientEmail) {
        return res.status(400).send('No email associated with account')
      }

      const { title, url } = req.body
      const transporter = getTransporter()

      await transporter.sendMail({
        from: `MEmail <${process.env.NO_REPLY_EMAIL}>`,
        to: recipientEmail,
        subject: title || 'MEmail Link',
        text: url,
      })

      return res.status(200).send('success')
    } catch (error) {
      console.error(error)
      return res.status(500).send('error')
    }
  }
)
