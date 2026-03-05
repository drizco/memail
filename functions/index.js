const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const cors = require('cors')({ origin: true });

admin.initializeApp();

const EMAIL = process.env.APP_EMAIL;
const REFRESH_TOKEN = process.env.APP_REFRESH_TOKEN;
const CLIENT_ID = process.env.APP_CLIENT_ID;
const CLIENT_SECRET = process.env.APP_CLIENT_SECRET;
const REDIRECT_URL = process.env.APP_REDIRECT_URL;
const OAuth2 = google.auth.OAuth2;

exports.sendMeMail = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
    try {
      // Verify Firebase ID token if present, fall back to body email for
      // backwards compatibility with the currently published Chrome extension.
      // TODO: Remove fallback once the new extension is published.
      let recipientEmail;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        recipientEmail = decodedToken.email;
        if (!recipientEmail) {
          return res.status(400).send('No email associated with this account');
        }
      } else {
        recipientEmail = req.body.email;
        if (!recipientEmail) {
          return res.status(400).send('Missing email');
        }
      }

      const { title, url } = req.body;
      const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
      oauth2Client.setCredentials({
        refresh_token: REFRESH_TOKEN
      });
      const { token } = await oauth2Client.getAccessToken();
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: EMAIL,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: token
        }
      });

      const mailOptions = {
        from: `MEmail <${EMAIL}>`,
        to: recipientEmail,
        subject: title,
        text: url
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).send('success');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return res.status(401).send('Unauthorized');
      }
      return res.status(500).send('error');
    }
  })
);
