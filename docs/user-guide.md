# OpenClaw Voice User Guide

OpenClaw Voice lets you press a button, speak naturally, and hear OpenClaw answer back.

This Phase 1 version is designed for simple push-to-talk use in a web browser. You hold the talk button while speaking, release it when you finish, and wait a moment for the spoken reply.

If you are deploying or administering the service, use `README.md` instead. This guide is for end users only.

## What You Need Before You Start

- A phone, tablet, or computer with a microphone
- A supported web browser with microphone access enabled
- Your OpenClaw Voice web link
- Your voice access token from the person who set up the system

## Browser Compatibility

Best experience:

- Chrome (desktop + Android)
- Edge (desktop)
- Safari (iOS 16.4+ and macOS Safari 16.4+)

Safari 16.4+ is supported with automatic audio MIME fallback handling during upload.

Also supported:

- Firefox current version (desktop)

If your browser is older and recording does not work, update the browser first.

## First-Time Setup

1. Open the OpenClaw Voice page in your browser.
2. When your browser asks for microphone access, choose **Allow**.
3. In the **Settings** card at the top of the page, check that **Voice Service URL** matches the service address you were given.
4. In **Access Token**, paste the voice access token you were given.
5. If your household or project uses a room label, enter it in **Room Name (optional)**. Otherwise, leave it blank.
6. Click **Save Settings**.
7. Check the saved summary under the Settings card. It should show your service URL, room name if used, and a masked token.
8. Wait for the status message to say the app is ready.

## How To Talk To OpenClaw

1. Press and hold **Hold to talk**.
2. Speak clearly while holding the button.
3. Release the button when you are done.
4. Wait while the app uploads your audio and gets a reply.
5. Read the text on screen or listen to the spoken response.

Keyboard users can also hold **Space** or **Enter** while the talk button is selected.

After each turn, the page shows:

- **Transcription**: what the app heard you say
- **OpenClaw Response**: the reply text before it is spoken aloud

## Tips For Best Results

- Speak in a normal voice and stay close to the microphone.
- Wait for the ready message before starting a new request.
- Use a quiet room when possible.
- If the reply audio is hard to hear, raise your device volume and replay the audio player at the bottom of the page.

## Troubleshooting

### The talk button stays disabled

Check these first:

- Your browser allowed microphone access
- The **Access Token** field is filled in
- Your browser supports microphone recording

If needed, refresh the page and allow microphone access again.

### I see a microphone permission error

Your browser or device blocked microphone access. Open your browser settings, allow microphone use for this site, then reload the page.

### It says the access token is missing or invalid

The access token is blank, expired, or typed incorrectly. Paste the token again exactly as provided in **Access Token**. If it still fails, ask your administrator for a fresh token.

### The request fails after I record

This usually means the voice service, OpenClaw connection, or internet connection had a problem.

Try this:

1. Check that you are still online.
2. Record a shorter request.
3. Wait a few seconds and try again.
4. Contact your administrator if the problem keeps happening.

If you can share technical details with your administrator, include the exact error text shown on screen. Common server-side messages are `Voice pipeline failed`, `OpenClaw request failed (...)`, and `Whisper request failed (...)`.

### The reply text appears, but I do not hear audio

- Make sure your device volume is on.
- Press play on the audio player at the bottom of the page.
- If your phone is in silent mode, switch audio back on and try again.

### The transcription is wrong

- Speak a little slower.
- Move closer to the microphone.
- Reduce background noise.
- Try again using a shorter sentence.

### I saved settings, but they disappear later

Settings are stored in your browser's local storage.

- Avoid private/incognito windows for daily use.
- Do not clear site data for the OpenClaw Voice page.
- If you changed browsers/devices, enter settings again on that browser/device.

## FAQ

### Do I need to install anything?

Usually no. Phase 1 runs in a browser, so most people only need the web link, microphone permission, and an access token.

### Do I need to keep holding the button the whole time?

Yes. This version uses push-to-talk. Hold the button while speaking, then release it to send your request.

### What does Room Name mean?

It is an optional label that can help keep a conversation tied to a room, device, or user flow. If you were not told to use one, you can leave it blank.

### Can I use the keyboard instead of pressing the button?

Yes. If the talk button is selected, you can hold **Space** or **Enter** to record and release the key to send your request.

### Can I talk to it in the background?

No. Phase 1 is an active push-to-talk experience. It does not support background listening or wake words.

### Who should I contact if setup does not work?

Contact the person who gave you the OpenClaw Voice link or token. They can confirm the service is online and verify your settings.
