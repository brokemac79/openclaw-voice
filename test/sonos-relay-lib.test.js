import test from "node:test";
import assert from "node:assert/strict";

import { buildSonosClipUrl, mediaExtensionFromMime, trimTrailingSlash } from "../src/sonos-relay-lib.js";

test("trimTrailingSlash removes terminal slashes", () => {
  assert.equal(trimTrailingSlash("http://127.0.0.1:5005///"), "http://127.0.0.1:5005");
  assert.equal(trimTrailingSlash(""), "");
});

test("mediaExtensionFromMime maps known mime types", () => {
  assert.equal(mediaExtensionFromMime("audio/mpeg"), "mp3");
  assert.equal(mediaExtensionFromMime("audio/wav"), "wav");
  assert.equal(mediaExtensionFromMime("application/octet-stream"), "bin");
});

test("buildSonosClipUrl builds encoded clip endpoint", () => {
  const result = buildSonosClipUrl(
    "http://127.0.0.1:5005/",
    "Kitchen Speaker",
    "http://192.168.1.10:8788/media/test clip.mp3"
  );

  assert.equal(
    result,
    "http://127.0.0.1:5005/Kitchen%20Speaker/clip/http%3A%2F%2F192.168.1.10%3A8788%2Fmedia%2Ftest%20clip.mp3"
  );
});
