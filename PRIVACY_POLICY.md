# MEmail Privacy Policy

Last Updated: March 5, 2026

## What MEmail Does

MEmail is a Chrome extension that emails you a link to the page you're currently viewing. When you click the extension, it sends an email containing the page title and URL to the email address associated with your Google account.

## What Information We Collect

When you use MEmail, the following information is sent to our server to deliver the email:

- **Your email address** (retrieved from your Google account via Chrome's identity API)
- **The current page URL**
- **The current page title**

## How Your Information Is Stored

**Locally:** Your Google authentication token is managed by Chrome's identity system. The extension does not store any personal data locally.

**Server-side:** Our server (a Firebase Cloud Function) processes your email address, page URL, and page title only to send the email. No data is stored on the server after the email is sent.

**Sent mail:** Emails are sent through a Gmail account controlled by MEmail. As a result, the sender's Gmail account retains a record of each sent email, which includes the recipient email address, page title, and page URL. These sent email records are not used for any purpose other than delivering the service.

## How Your Information Is Used

Your information is used solely to send you the email you requested. We do not:

- Sell or share your data with third parties
- Use your data for advertising or analytics
- Track your browsing activity beyond the single page you choose to email

## Third-Party Services

MEmail uses the following third-party services to operate:

- **Google Firebase** (cloud function hosting and authentication)
- **Gmail API** (email delivery)
- **Google Identity Toolkit** (user authentication)

These services are subject to [Google's Privacy Policy](https://policies.google.com/privacy).

## Children's Privacy

MEmail does not knowingly collect personal information from children under the age of 13.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted to this page with an updated date.

## Contact

If you have questions about this Privacy Policy, contact driscollrp@gmail.com.
