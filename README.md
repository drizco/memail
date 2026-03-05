# MEmail

Email yourself a link to the current page in a single click.

Available as a [Chrome extension](https://chromewebstore.google.com/). A mobile app (Flutter) is in development.

## Project Structure

```
extension/       Chrome extension (Manifest v3)
functions/       Firebase Cloud Functions backend
mobile_flutter/  Flutter mobile app
mobile/          React Native mobile app (deprecated)
```

## Setup

### Chrome Extension

```bash
npm --prefix extension run build
```

Load `extension/src/` as an unpacked extension in Chrome, or use the built zip at `extension/dist/memail-extension.zip`.

### Cloud Functions

```bash
npm --prefix functions install
npm --prefix functions run serve    # local emulator
npm --prefix functions run deploy   # deploy to Firebase
```

## How It Works

1. The extension or mobile app captures the current page/shared link
2. Sends a POST request with `{title, url}` and a Firebase auth token to the Cloud Function
3. The Cloud Function verifies the token, extracts the user's email, and sends the link via email

## Privacy Policy

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
