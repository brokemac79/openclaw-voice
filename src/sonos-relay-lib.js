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
 * @returns {string} Full SOAP envelope string
 */
export function buildSoapEnvelope(action, bodyXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
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
 * @returns {Promise<void>}
 */
export async function sendSoapAction({ sonosIp, sonosPort = 1400, action, bodyXml, fetchImpl }) {
  const fetch_ = fetchImpl || globalThis.fetch;
  const url = `http://${sonosIp}:${sonosPort}/MediaRenderer/AVTransport/Control`;
  const envelope = buildSoapEnvelope(action, bodyXml);

  const response = await fetch_(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"urn:schemas-upnp-org:service:AVTransport:1#${action}"`
    },
    body: envelope
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sonos SOAP ${action} failed (${response.status}): ${text}`);
  }
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
  const escapedUrl = escapeXml(audioUrl);
  const escapedMeta = escapeXml(metaXml);

  await sendSoapAction({
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
