/**
 * sonos-relay-lib.js
 *
 * Shared helpers for the VPS-side Sonos relay service.
 * All Sonos UPnP/SOAP interaction lives here so unit tests can inject stubs.
 */

/**
 * Build a Sonos AVTransport SOAP action envelope.
 *
 * @param {string} action  - SOAP action name, e.g. "SetAVTransportURI"
 * @param {string} bodyXml - Inner XML fragment for the action body
 * @param {string} service - Sonos service name, e.g. "AVTransport"
 * @returns {string} Full SOAP envelope string
 */
export function buildSoapEnvelope(action, bodyXml, service = "AVTransport") {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:${service}:1">
      ${bodyXml}
    </u:${action}>
  </s:Body>
</s:Envelope>`;
}

/**
 * Send a Sonos AVTransport UPnP/SOAP request.
 *
 * @param {object} opts
 * @param {string} opts.sonosIp    - IP address of the Sonos speaker
 * @param {number} opts.sonosPort  - UPnP port (default 1400)
 * @param {string} opts.action     - SOAP action name
 * @param {string} opts.bodyXml    - Inner XML for the action body
 * @param {Function} [opts.fetchImpl] - Optional fetch override for testing
 * @returns {Promise<string>}
 */
export async function sendSoapAction({ sonosIp, sonosPort = 1400, action, bodyXml, fetchImpl }) {
  return sendSoapRequest({
    sonosIp,
    sonosPort,
    action,
    service: "AVTransport",
    bodyXml,
    fetchImpl
  });
}

async function sendSoapRequest({ sonosIp, sonosPort = 1400, action, service, bodyXml, fetchImpl }) {
  const fetch_ = fetchImpl || globalThis.fetch;
  const url = `http://${sonosIp}:${sonosPort}/MediaRenderer/${service}/Control`;
  const envelope = buildSoapEnvelope(action, bodyXml, service);
  const serviceType = `urn:schemas-upnp-org:service:${service}:1`;

  const response = await fetch_(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${serviceType}#${action}"`
    },
    body: envelope
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sonos SOAP ${service}.${action} failed (${response.status}): ${text}`);
  }

  return response.text();
}

/**
 * Set the Sonos speaker's current transport URI to the given audio URL.
 *
 * @param {object} opts
 * @param {string} opts.sonosIp
 * @param {number} [opts.sonosPort]
 * @param {string} opts.audioUrl   - Public HTTP URL the Sonos device can reach
 * @param {string} opts.audioMimeType
 * @param {Function} [opts.fetchImpl]
 */
export async function setSonosUri({ sonosIp, sonosPort, audioUrl, audioMimeType, fetchImpl }) {
  const metaXml = buildDidlLite(audioUrl, audioMimeType);
  return setSonosUriRaw({
    sonosIp,
    sonosPort,
    uri: audioUrl,
    metadata: metaXml,
    fetchImpl
  });
}

export async function setSonosUriRaw({ sonosIp, sonosPort, uri, metadata = "", fetchImpl }) {
  const escapedUrl = escapeXml(uri);
  const escapedMeta = escapeXml(metadata);

  return sendSoapAction({
    sonosIp,
    sonosPort,
    action: "SetAVTransportURI",
    bodyXml: `<InstanceID>0</InstanceID>
               <CurrentURI>${escapedUrl}</CurrentURI>
               <CurrentURIMetaData>${escapedMeta}</CurrentURIMetaData>`,
    fetchImpl
  });
}

/**
 * Send the Play action to start playback.
 *
 * @param {object} opts
 * @param {string} opts.sonosIp
 * @param {number} [opts.sonosPort]
 * @param {Function} [opts.fetchImpl]
 */
export async function playSonos({ sonosIp, sonosPort, fetchImpl }) {
  await sendSoapAction({
    sonosIp,
    sonosPort,
    action: "Play",
    bodyXml: `<InstanceID>0</InstanceID><Speed>1</Speed>`,
    fetchImpl
  });
}

export async function getSonosTransportInfo({ sonosIp, sonosPort, fetchImpl }) {
  const xml = await sendSoapAction({
    sonosIp,
    sonosPort,
    action: "GetTransportInfo",
    bodyXml: `<InstanceID>0</InstanceID>`,
    fetchImpl
  });

  return {
    state: getXmlTag(xml, "CurrentTransportState") || null,
    status: getXmlTag(xml, "CurrentTransportStatus") || null,
    speed: getXmlTag(xml, "CurrentSpeed") || null
  };
}

export async function getSonosMediaInfo({ sonosIp, sonosPort, fetchImpl }) {
  const xml = await sendSoapAction({
    sonosIp,
    sonosPort,
    action: "GetMediaInfo",
    bodyXml: `<InstanceID>0</InstanceID>`,
    fetchImpl
  });

  return {
    currentUri: getXmlTag(xml, "CurrentURI") || null,
    currentUriMetaData: getXmlTag(xml, "CurrentURIMetaData") || null
  };
}

export async function getSonosVolume({ sonosIp, sonosPort, fetchImpl }) {
  const xml = await sendSoapRequest({
    sonosIp,
    sonosPort,
    service: "RenderingControl",
    action: "GetVolume",
    bodyXml: `<InstanceID>0</InstanceID><Channel>Master</Channel>`,
    fetchImpl
  });
  const value = Number(getXmlTag(xml, "CurrentVolume"));
  return Number.isFinite(value) ? value : null;
}

export async function setSonosVolume({ sonosIp, sonosPort, volume, fetchImpl }) {
  const bounded = Math.max(0, Math.min(100, Number(volume)));
  return sendSoapRequest({
    sonosIp,
    sonosPort,
    service: "RenderingControl",
    action: "SetVolume",
    bodyXml: `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${bounded}</DesiredVolume>`,
    fetchImpl
  });
}

export async function playClipWithRestore({
  sonosIp,
  sonosPort,
  clipUrl,
  audioMimeType,
  fetchImpl,
  pollIntervalMs = 500,
  pollTimeoutMs = 20000
}) {
  const snapshot = {
    media: await getSonosMediaInfo({ sonosIp, sonosPort, fetchImpl }),
    transport: await getSonosTransportInfo({ sonosIp, sonosPort, fetchImpl }),
    volume: await getSonosVolume({ sonosIp, sonosPort, fetchImpl })
  };

  await setSonosUri({ sonosIp, sonosPort, audioUrl: clipUrl, audioMimeType, fetchImpl });
  await playSonos({ sonosIp, sonosPort, fetchImpl });

  await waitForClipEnd({ sonosIp, sonosPort, clipUrl, fetchImpl, pollIntervalMs, pollTimeoutMs });

  if (snapshot.media.currentUri) {
    await setSonosUriRaw({
      sonosIp,
      sonosPort,
      uri: snapshot.media.currentUri,
      metadata: snapshot.media.currentUriMetaData || "",
      fetchImpl
    });
  }
  if (snapshot.transport.state === "PLAYING") {
    await playSonos({ sonosIp, sonosPort, fetchImpl });
  }
  if (snapshot.volume !== null) {
    await setSonosVolume({ sonosIp, sonosPort, volume: snapshot.volume, fetchImpl });
  }

  return {
    previousUri: snapshot.media.currentUri,
    previousState: snapshot.transport.state,
    previousVolume: snapshot.volume
  };
}

async function waitForClipEnd({
  sonosIp,
  sonosPort,
  clipUrl,
  fetchImpl,
  pollIntervalMs,
  pollTimeoutMs
}) {
  const start = Date.now();
  while (Date.now() - start < pollTimeoutMs) {
    const [media, transport] = await Promise.all([
      getSonosMediaInfo({ sonosIp, sonosPort, fetchImpl }),
      getSonosTransportInfo({ sonosIp, sonosPort, fetchImpl })
    ]);

    if (media.currentUri !== clipUrl || transport.state === "STOPPED") {
      return;
    }
    await sleep(pollIntervalMs);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getXmlTag(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? unescapeXml(match[1]) : null;
}

function unescapeXml(value) {
  return String(value)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * Build a minimal DIDL-Lite metadata fragment for the given audio URL.
 *
 * @param {string} url
 * @param {string} mimeType
 * @returns {string}
 */
function buildDidlLite(url, mimeType) {
  const safe = escapeXml(url);
  return `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">` +
    `<item id="1" parentID="0" restricted="1">` +
    `<dc:title>openclaw-voice</dc:title>` +
    `<upnp:class>object.item.audioItem.musicTrack</upnp:class>` +
    `<res protocolInfo="http-get:*:${escapeXml(mimeType)}:*">${safe}</res>` +
    `</item>` +
    `</DIDL-Lite>`;
}

/**
 * Escape characters that are invalid inside XML text/attribute content.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Remove trailing slashes from a URL string.
 *
 * @param {string} url
 * @returns {string}
 */
export function trimTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

const MIME_TO_EXT = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "application/octet-stream": "bin"
};

/**
 * Map an audio MIME type to a file extension.
 *
 * @param {string} mime
 * @returns {string}
 */
export function mediaExtensionFromMime(mime) {
  return MIME_TO_EXT[mime] || "bin";
}

/**
 * Build a Sonos HTTP API clip endpoint URL.
 *
 * @param {string} baseUrl  - Sonos HTTP API base URL (trailing slashes stripped)
 * @param {string} speaker  - Speaker/room name
 * @param {string} mediaUrl - Public URL of the audio clip
 * @returns {string}
 */
export function buildSonosClipUrl(baseUrl, speaker, mediaUrl) {
  const base = trimTrailingSlash(baseUrl);
  return `${base}/${encodeURIComponent(speaker)}/clip/${encodeURIComponent(mediaUrl)}`;
}
