import test from "node:test";
import assert from "node:assert/strict";

import {
  createOpenClawClient,
  extractOpenClawText,
  readOpenClawClientConfigFromEnv,
  shouldFallbackToLocalCli
} from "../src/openclaw-client.js";

test("shouldFallbackToLocalCli only enables for /v1 scope regression", () => {
  assert.equal(
    shouldFallbackToLocalCli({
      enabled: true,
      url: "http://127.0.0.1:18789/v1/chat/completions",
      status: 403,
      body: "missing scope: operator.read"
    }),
    true
  );

  assert.equal(
    shouldFallbackToLocalCli({
      enabled: true,
      url: "http://127.0.0.1:18789/api/chat",
      status: 403,
      body: "missing scope: operator.read"
    }),
    false
  );
});

test("extractOpenClawText supports /v1-like payloads", () => {
  assert.equal(
    extractOpenClawText(
      {
        payloads: [{ text: "hello from payload" }]
      },
      "response"
    ),
    "hello from payload"
  );
});

test("extractOpenClawText supports payload content arrays and empty payload envelopes", () => {
  assert.equal(
    extractOpenClawText(
      {
        payloads: [
          {
            content: [{ type: "text", text: "hello from content" }]
          }
        ]
      },
      "response"
    ),
    "hello from content"
  );

  assert.equal(
    extractOpenClawText(
      {
        payloads: []
      },
      "response"
    ),
    ""
  );
});

test("queryOpenClaw falls back to local CLI on /v1 403 scope failure", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_METHOD: "POST",
    OPENCLAW_INPUT_FIELD: "input",
    OPENCLAW_OUTPUT_FIELD: "response",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests"
  });

  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async (_bin, args) => {
      assert.equal(args[0], "agent");
      assert.ok(args.includes("--local"));
      return {
        stdout: JSON.stringify({
          payloads: [{ text: "fallback ok" }]
        }),
        stderr: ""
      };
    }
  });

  const result = await client("ping", "office");
  assert.equal(result, "fallback ok");
});

test("queryOpenClaw parses fallback JSON from stderr when stdout is empty", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests"
  });

  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async () => ({
      stdout: "",
      stderr: JSON.stringify({ payloads: [{ text: "stderr fallback ok" }] })
    })
  });

  const result = await client("ping", "office");
  assert.equal(result, "stderr fallback ok");
});

test("queryOpenClaw throws clear error when fallback CLI returns empty stdout and stderr", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests"
  });

  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async () => ({
      stdout: "",
      stderr: ""
    })
  });

  await assert.rejects(() => client("ping", "office"), /OpenClaw CLI returned empty output/);
});

test("queryOpenClaw isolates gateway restart turns to one-shot session ids", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests"
  });

  let capturedArgs;
  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async (_bin, args) => {
      capturedArgs = args;
      return {
        stdout: JSON.stringify({ response: "restart handled" }),
        stderr: ""
      };
    }
  });

  const result = await client("systemctl --user restart openclaw-gateway", "office");
  assert.equal(result, "restart handled");
  const sessionIdIndex = capturedArgs.indexOf("--session-id");
  assert.ok(sessionIdIndex > -1);
  assert.match(capturedArgs[sessionIdIndex + 1], /^office-restart-/);
});

test("queryOpenClaw blocks chained gateway restart commands with warning", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests"
  });

  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async () => {
      throw new Error("should not execute local cli for blocked chained restart");
    }
  });

  await assert.rejects(
    () => client("systemctl --user restart openclaw-gateway && curl http://127.0.0.1:18789/health", "office"),
    /Refusing chained `systemctl --user restart openclaw-gateway` command/
  );
});

test("queryOpenClaw retries without session id when first response is empty", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_METHOD: "POST",
    OPENCLAW_INPUT_FIELD: "input",
    OPENCLAW_OUTPUT_FIELD: "response"
  });

  const seenBodies = [];
  let callCount = 0;
  const client = createOpenClawClient(config, {
    fetchImpl: async (_url, options) => {
      callCount += 1;
      seenBodies.push(JSON.parse(options.body));

      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ payloads: [] }),
          text: async () => "",
          headers: { get: () => "application/json" }
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ response: "fallback without session id" }),
        text: async () => "",
        headers: { get: () => "application/json" }
      };
    }
  });

  const result = await client("ping", "office");
  assert.equal(result, "fallback without session id");
  assert.equal(callCount, 2);
  assert.equal(seenBodies[0].sessionId, "office");
  assert.equal(seenBodies[1].sessionId, undefined);
});

test("OPENCLAW_HTTP_SESSION_ID is injected into HTTP turns when caller passes no sessionId", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_HTTP_SESSION_ID: "my-voice-session"
  });

  const seenBodies = [];
  const client = createOpenClawClient(config, {
    fetchImpl: async (_url, options) => {
      seenBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: "ok" }),
        text: async () => "",
        headers: { get: () => "application/json" }
      };
    }
  });

  await client("hello");
  assert.equal(seenBodies[0].sessionId, "my-voice-session");
});

test("OPENCLAW_HTTP_SESSION_ID falls back to OPENCLAW_CLI_SESSION_ID then openclaw-voice", async () => {
  const configCliOnly = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_CLI_SESSION_ID: "cli-session"
  });
  assert.equal(configCliOnly.openClawHttpSessionId, "cli-session");

  const configDefault = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat"
  });
  assert.equal(configDefault.openClawHttpSessionId, "openclaw-voice");
});

test("caller-supplied sessionId takes precedence over OPENCLAW_HTTP_SESSION_ID", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_HTTP_SESSION_ID: "default-session"
  });

  const seenBodies = [];
  const client = createOpenClawClient(config, {
    fetchImpl: async (_url, options) => {
      seenBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: "ok" }),
        text: async () => "",
        headers: { get: () => "application/json" }
      };
    }
  });

  await client("hello", "caller-session");
  assert.equal(seenBodies[0].sessionId, "caller-session");
});

// ---------------------------------------------------------------------------
// #68 — voice-optimised system prompt
// ---------------------------------------------------------------------------

test("readOpenClawClientConfigFromEnv includes a non-empty default voice system prompt", () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat"
  });
  assert.ok(
    typeof config.openClawVoiceSystemPrompt === "string" &&
      config.openClawVoiceSystemPrompt.length > 0,
    "openClawVoiceSystemPrompt should have a non-empty default"
  );
  assert.ok(
    /markdown/i.test(config.openClawVoiceSystemPrompt),
    "default voice prompt should mention markdown"
  );
});

test("readOpenClawClientConfigFromEnv uses OPENCLAW_VOICE_SYSTEM_PROMPT when set", () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_VOICE_SYSTEM_PROMPT: "Custom voice prompt"
  });
  assert.equal(config.openClawVoiceSystemPrompt, "Custom voice prompt");
});

test("queryViaLocalCli passes --system-prompt arg when openClawVoiceSystemPrompt is set", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:18789/v1/chat/completions",
    OPENCLAW_CLI_FALLBACK_ENABLED: "true",
    OPENCLAW_CLI_SESSION_ID: "voice-tests",
    OPENCLAW_VOICE_SYSTEM_PROMPT: "Respond without markdown."
  });

  let capturedArgs;
  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async (_bin, args) => {
      capturedArgs = [...args];
      return {
        stdout: JSON.stringify({ response: "voice ok" }),
        stderr: ""
      };
    }
  });

  const result = await client("what time is it", "office");
  assert.equal(result, "voice ok");
  assert.ok(
    capturedArgs.includes("--system-prompt"),
    `expected --system-prompt in CLI args, got: ${capturedArgs.join(" ")}`
  );
  const idx = capturedArgs.indexOf("--system-prompt");
  assert.equal(capturedArgs[idx + 1], "Respond without markdown.");
});

test("queryViaLocalCli omits --system-prompt when openClawVoiceSystemPrompt is empty string", async () => {
  const config = {
    openClawUrl: "http://127.0.0.1:18789/v1/chat/completions",
    openClawMethod: "POST",
    openClawInputField: "input",
    openClawOutputField: "response",
    openClawAuthBearer: "",
    openClawCliFallbackEnabled: true,
    openClawCliBin: "openclaw",
    openClawCliSessionId: "voice-tests",
    openClawHttpSessionId: "voice-tests",
    openClawCliAgent: "",
    openClawCliTimeoutMs: 5000,
    openClawVoiceSystemPrompt: ""
  };

  let capturedArgs;
  const client = createOpenClawClient(config, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => "missing scope: operator.write",
      headers: { get: () => "application/json" }
    }),
    execFileAsync: async (_bin, args) => {
      capturedArgs = [...args];
      return {
        stdout: JSON.stringify({ response: "no prompt ok" }),
        stderr: ""
      };
    }
  });

  await client("what time is it", "office");
  assert.ok(
    !capturedArgs.includes("--system-prompt"),
    `expected no --system-prompt in CLI args, got: ${capturedArgs.join(" ")}`
  );
});

// ---------------------------------------------------------------------------

test("empty-response retry omits session even when OPENCLAW_HTTP_SESSION_ID is set", async () => {
  const config = readOpenClawClientConfigFromEnv({
    OPENCLAW_URL: "http://127.0.0.1:3000/api/chat",
    OPENCLAW_HTTP_SESSION_ID: "voice-session"
  });

  const seenBodies = [];
  let callCount = 0;
  const client = createOpenClawClient(config, {
    fetchImpl: async (_url, options) => {
      callCount += 1;
      seenBodies.push(JSON.parse(options.body));
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ payloads: [] }),
          text: async () => "",
          headers: { get: () => "application/json" }
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: "retry ok" }),
        text: async () => "",
        headers: { get: () => "application/json" }
      };
    }
  });

  const result = await client("ping", "office");
  assert.equal(result, "retry ok");
  assert.equal(callCount, 2);
  assert.equal(seenBodies[0].sessionId, "office");
  assert.equal(seenBodies[1].sessionId, undefined);
});
