import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSoapEnvelope,
  escapeXml,
  setSonosUri,
  playSonos
} from "../src/sonos-relay-lib.js";

test("escapeXml handles all special characters", () => {
  assert.equal(escapeXml('&<>"\''), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXml("hello world"), "hello world");
  assert.equal(escapeXml("http://host/path?a=1&b=2"), "http://host/path?a=1&amp;b=2");
});

test("buildSoapEnvelope wraps body in valid SOAP envelope", () => {
  const xml = buildSoapEnvelope("Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
  assert.ok(xml.includes('<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"'));
  assert.ok(xml.includes('<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'));
  assert.ok(xml.includes("<InstanceID>0</InstanceID>"));
  assert.ok(xml.includes("</u:Play>"));
  assert.ok(xml.includes("</s:Envelope>"));
});

test("setSonosUri sends SetAVTransportURI SOAP action with correct headers", async () => {
  const calls = [];
  const mockFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, text: async () => "" };
  };

  await setSonosUri({
    sonosIp: "192.168.4.33",
    sonosPort: 1400,
    audioUrl: "http://10.0.0.1:8788/clips/test.mp3",
    audioMimeType: "audio/mpeg",
    fetchImpl: mockFetch
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://192.168.4.33:1400/MediaRenderer/AVTransport/Control");
  assert.equal(calls[0].opts.method, "POST");
  assert.ok(
    calls[0].opts.headers.SOAPAction.includes("SetAVTransportURI"),
    "SOAPAction header should reference SetAVTransportURI"
  );
  assert.ok(
    calls[0].opts.body.includes("SetAVTransportURI"),
    "body should contain SetAVTransportURI action"
  );
  assert.ok(
    calls[0].opts.body.includes("http://10.0.0.1:8788/clips/test.mp3"),
    "body should contain the clip URL"
  );
});

test("playSonos sends Play SOAP action", async () => {
  const calls = [];
  const mockFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, text: async () => "" };
  };

  await playSonos({ sonosIp: "192.168.4.33", sonosPort: 1400, fetchImpl: mockFetch });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].opts.headers.SOAPAction.includes("Play"), "SOAPAction should reference Play");
  assert.ok(calls[0].opts.body.includes("<u:Play"), "body should contain Play action element");
  assert.ok(calls[0].opts.body.includes("<Speed>1</Speed>"), "body should contain Speed element");
});

test("setSonosUri rejects when Sonos returns non-2xx status", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    text: async () => "UPnP error"
  });

  await assert.rejects(
    () =>
      setSonosUri({
        sonosIp: "192.168.4.33",
        sonosPort: 1400,
        audioUrl: "http://10.0.0.1:8788/clips/test.mp3",
        audioMimeType: "audio/mpeg",
        fetchImpl: mockFetch
      }),
    /Sonos SOAP SetAVTransportURI failed \(500\)/
  );
});

test("setSonosUri escapes special chars in audio URL", async () => {
  const calls = [];
  const mockFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, text: async () => "" };
  };

  await setSonosUri({
    sonosIp: "192.168.4.33",
    sonosPort: 1400,
    audioUrl: "http://10.0.0.1:8788/clips/test&clip.mp3",
    audioMimeType: "audio/mpeg",
    fetchImpl: mockFetch
  });

  assert.ok(
    calls[0].opts.body.includes("&amp;"),
    "URL ampersand should be XML-escaped in SOAP body"
  );
});
