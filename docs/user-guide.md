# OpenClaw Voice User Guide

This is the primary end-user guide for people who already have an OpenClaw Voice link and token.

## Start here first

- If someone else set this up for you, read this guide.
- I need to host or configure the service: use `docs/host-it-yourself.md`
- I need the always-on desktop client guide: use `docs/desktop-client-walkthrough.md`

> If someone else set this up for you, stay in this guide.
>
> If you want to set it up yourself, switch to `docs/host-it-yourself.md`.

## What you need

- A phone, tablet, or computer with a microphone
- A supported web browser
- Your OpenClaw Voice web link
- Your access token
- Your Sonos room name only if your host told you to use one

If terminal commands make you uncomfortable, stay on the browser path in this guide and ask the person hosting OpenClaw Voice for your link and token.

## Browser compatibility

Best experience:

- Chrome (desktop + Android)
- Edge (desktop)
- Safari (iOS 16.4+ and macOS Safari 16.4+)
- Firefox current version (desktop)

If recording does not work, update the browser first.

## First-time setup

### What to paste where

| Screen field | What belongs there |
| --- | --- |
| Browser **Voice Service URL** | The OpenClaw Voice page/service URL from your host, for example `http://localhost:8787` |
| Browser **Access Token** | The access token from your host |
| Browser **Session ID (optional)** | Only use this if your host told you to |
| Browser **Sonos Room (optional)** | Only use this if your host told you to |

If someone gives you extra server details such as `.env`, websocket URLs, Python commands, or relay settings, you can ignore them for normal browser use.

Filled browser example:

| Screen field | Example value | Who gives it to you |
| --- | --- | --- |
| **Voice Service URL** | `https://voice.example.net` | Your host/admin |
| **Access Token** | `demo-voice-token-9f3a` | Your host/admin |
| **Session ID (optional)** | `KitchenTablet` | Usually you choose this only if your host asked for one |
| **Sonos Room (optional)** | `Kitchen` | Your host/admin if they use Sonos |

If your host says "use the browser at `https://voice.example.net` and paste token `demo-voice-token-9f3a`," your filled screen should look like this:

- **Voice Service URL**: `https://voice.example.net`
- **Access Token**: `demo-voice-token-9f3a`
- **Session ID**: leave blank unless they asked for one such as `KitchenTablet`
- **Sonos Room**: leave blank unless they gave you a room such as `Kitchen`

## Use it in your browser

1. Open the OpenClaw Voice web link you were given.
2. Click **Allow** when the browser asks to use your microphone.
3. Check that **Voice Service URL** matches the address from your host.
4. Paste your token into **Access Token**.
5. Leave **Session ID** and **Sonos Room** blank unless your host told you to fill them in.
6. Click **Save Settings**.
7. Wait for the page to say it is ready.
8. Hold **Hold to Talk**, speak, then let go.

What success looks like:

- the big button is enabled
- the status text says the app is ready
- your spoken words appear under **Transcription**
- the reply appears under **OpenClaw Response**

![Example browser screen with saved settings and the Hold to Talk button](assets/browser-ui-example.svg)

## How to talk to OpenClaw

1. Press and hold **Hold to Talk**.
2. Speak clearly while holding the button.
3. Release the button when you are done.
4. Wait while the app uploads your audio and gets a reply.
5. Read the text on screen or listen to the spoken response.

Keyboard users can also hold **Space** or **Enter** while the talk button is selected.

After each turn, the page shows:

- **Transcription**: what the app heard you say
- **OpenClaw Response**: the reply text before it is spoken aloud

## Tips for best results

- Speak in a normal voice and stay close to the microphone.
- Wait for the ready message before starting a new request.
- Use a quiet room when possible.
- If the reply audio is hard to hear, raise your device volume and replay the audio player at the bottom of the page.

## Troubleshooting

### The talk button stays disabled

Check these first:

- Your browser allowed microphone access
- The **Access Token** field is filled in
- The **Voice Service URL** is the one your host gave you
- Your browser supports microphone recording

If needed, refresh the page and allow microphone access again.

### I see a microphone permission error

Your browser or device blocked microphone access. Open your browser settings, allow microphone use for this site, then reload the page.

### It says the access token is missing or invalid

The token is blank, expired, or typed incorrectly. Paste it again exactly as provided. If it still fails, ask your host for a fresh token.

### The request fails after I record

This usually means the service, OpenClaw connection, or internet connection had a problem.

Try this:

1. Check that you are still online.
2. Record a shorter request.
3. Wait a few seconds and try again.
4. Contact your host if the problem keeps happening.

If you can share technical details, include the exact error text shown on screen.

### The reply text appears, but I do not hear audio

- Make sure your device volume is on.
- Press play on the audio player at the bottom of the page.
- If your phone is in silent mode, switch audio back on and try again.
- If your setup uses Sonos, confirm the correct room name was saved.

### Sonos playback does not start

- Check that the saved room name matches the Sonos room exactly.
- If your setup uses a shared default room, ask your host which room to use.
- Ask your host to check whether the external Sonos relay service is online.

### The transcription is wrong

- Speak a little slower.
- Move closer to the microphone.
- Reduce background noise.
- Try again using a shorter sentence.

### I saved settings, but they disappear later

Settings are stored in your browser's local storage.

- Avoid private/incognito windows for daily use.
- Do not clear site data for the OpenClaw Voice page.
- If you changed browsers or devices, enter settings again there.

## FAQ

### Do I need to install anything?

Usually no. Most people only need the web link, microphone permission, and an access token.

### Do I need to keep holding the button the whole time?

Yes. This version uses push-to-talk. Hold the button while speaking, then release it to send your request.

### What do Session ID and Sonos Room mean?

They are optional extra settings. If your host did not tell you to use them, leave them blank.

### Can I use the keyboard instead of pressing the button?

Yes. If the talk button is selected, you can hold **Space** or **Enter** to record and release the key to send your request.

### Is there a desktop option?

Yes, but it is a separate path. If someone already prepared the always-on desktop client for you, use `docs/desktop-client-walkthrough.md`.

### Who should I contact if setup does not work?

Contact the person who gave you the OpenClaw Voice link or token.
