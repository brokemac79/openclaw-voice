import { execFile } from "node:child_process";
import { promisify } from "node:util";

function parseBoolean(value, defaultValue = false) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function isV1HttpEndpoint(url) {
  if (typeof url !== "string" || url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/v1/");
  } catch {
    return false;
  }
}

function parsePossibleJson(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) {
    throw new Error("OpenClaw CLI returned empty output");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OpenClaw CLI returned non-JSON output");
  }
}

function parseCliJsonOutput(stdout, stderr) {
  const stdoutText = String(stdout || "").trim();
  const stderrText = String(stderr || "").trim();

  if (!stdoutText && !stderrText) {
    throw new Error("OpenClaw CLI returned empty output");
  }

  if (stdoutText) {
    try {
      return parsePossibleJson(stdoutText);
    } catch {
      // Continue to stderr fallback parsing.
    }
  }

  if (stderrText) {
    return parsePossibleJson(stderrText);
  }

  throw new Error("OpenClaw CLI returned non-JSON output");
}

function parseGatewayRestartRisk(text) {
  const normalized = String(text || "");
  const hasGatewayRestart = /systemctl\s+(?:--user\s+)?restart\s+openclaw-gateway\b/i.test(normalized);
  const hasCommandChaining = /(?:&&|\|\||;)/.test(normalized);

  return {
    hasGatewayRestart,
    hasCommandChaining
  };
}

function createOneShotSessionId(baseSessionId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${baseSessionId}-restart-${timestamp}-${random}`;
}

export function extractOpenClawText(json, outputField) {
  if (json && typeof json[outputField] === "string") {
    return json[outputField];
  }

  if (typeof json?.text === "string") {
    return json.text;
  }

  if (Array.isArray(json?.payloads)) {
    const payloadText = json.payloads
      .map((payload) => {
        if (typeof payload?.text === "string") {
          return payload.text;
        }

        if (typeof payload?.content === "string") {
          return payload.content;
        }

        if (Array.isArray(payload?.content)) {
          return payload.content
            .map((part) => {
              if (typeof part === "string") {
                return part;
              }

              if (typeof part?.text === "string") {
                return part.text;
              }

              if (typeof part?.content === "string") {
                return part.content;
              }

              return "";
            })
            .join(" ");
        }

        return "";
      })
      .find((text) => text.trim().length > 0);
    if (payloadText) {
      return payloadText;
    }

    return "";
  }

  return JSON.stringify(json);
}

export function shouldFallbackToLocalCli({ enabled, url, status, body }) {
  if (!enabled) {
    return false;
  }

  if (!isV1HttpEndpoint(url)) {
    return false;
  }

  if (status !== 403) {
    return false;
  }

  return /missing scope:\s*operator\.(read|write)/i.test(String(body || ""));
}

export function createOpenClawClient(config, deps = {}) {
  const {
    openClawUrl,
    openClawMethod,
    openClawInputField,
    openClawOutputField,
    openClawAuthBearer,
    openClawCliFallbackEnabled,
    openClawCliBin,
    openClawCliSessionId,
    openClawHttpSessionId,
    openClawCliAgent,
    openClawCliTimeoutMs
  } = config;

  const fetchImpl = deps.fetchImpl || fetch;
  const execFileAsync = deps.execFileAsync || promisify(execFile);

  async function queryViaHttp(text, sessionId, { omitDefaultSession = false } = {}) {
    const resolvedSessionId = omitDefaultSession ? (sessionId || undefined) : (sessionId || openClawHttpSessionId || undefined);
    const payload = {
      [openClawInputField]: text,
      sessionId: resolvedSessionId
    };

    const headers = {
      "Content-Type": "application/json"
    };

    if (openClawAuthBearer) {
      headers.Authorization = `Bearer ${openClawAuthBearer}`;
    }

    const response = await fetchImpl(openClawUrl, {
      method: openClawMethod,
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        shouldFallbackToLocalCli({
          enabled: openClawCliFallbackEnabled,
          url: openClawUrl,
          status: response.status,
          body
        })
      ) {
        process.stderr.write(
          "OpenClaw /v1 token-scope regression detected (403 missing operator scope); retrying via local CLI fallback.\n"
        );
        return queryViaLocalCli(text, sessionId);
      }

      throw new Error(`OpenClaw request failed (${response.status}): ${body}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return extractOpenClawText(json, openClawOutputField);
    }

    return response.text();
  }

  async function queryViaLocalCli(text, sessionId) {
    const chosenSessionId = sessionId || openClawCliSessionId;
    const restartRisk = parseGatewayRestartRisk(text);

    if (restartRisk.hasGatewayRestart && restartRisk.hasCommandChaining) {
      throw new Error(
        "Refusing chained `systemctl --user restart openclaw-gateway` command: restarting the gateway terminates the active agent session before chained commands continue. Run restart as its own turn, then run follow-up commands in a new turn."
      );
    }

    const sessionIdForTurn = restartRisk.hasGatewayRestart ? createOneShotSessionId(chosenSessionId) : chosenSessionId;
    if (restartRisk.hasGatewayRestart) {
      process.stderr.write(
        `Gateway restart command detected; running this turn in isolated one-shot session '${sessionIdForTurn}' so the primary session stays alive.\n`
      );
    }

    const args = ["agent", "--local", "--json", "--session-id", sessionIdForTurn, "--message", text];
    if (openClawCliAgent) {
      args.push("--agent", openClawCliAgent);
    }

    const { stdout, stderr } = await execFileAsync(openClawCliBin, args, {
      timeout: openClawCliTimeoutMs,
      maxBuffer: 4 * 1024 * 1024
    });

    if (stderr?.trim()) {
      process.stderr.write(`openclaw CLI stderr: ${stderr}\n`);
    }

    const json = parseCliJsonOutput(stdout, stderr);
    return extractOpenClawText(json, openClawOutputField);
  }

  return async function queryOpenClaw(text, sessionId) {
    const effectiveSessionId = sessionId || openClawHttpSessionId || undefined;
    const primaryResponse = await queryViaHttp(text, sessionId);
    if (String(primaryResponse || "").trim() || !effectiveSessionId) {
      return primaryResponse;
    }

    process.stderr.write(
      `OpenClaw returned empty text for session '${effectiveSessionId}'; retrying once without sessionId to avoid stale-session empty payload bug.\n`
    );

    return queryViaHttp(text, undefined, { omitDefaultSession: true });
  };
}

export function readOpenClawClientConfigFromEnv(env) {
  return {
    openClawUrl: env.OPENCLAW_URL,
    openClawMethod: (env.OPENCLAW_METHOD || "POST").toUpperCase(),
    openClawInputField: env.OPENCLAW_INPUT_FIELD || "input",
    openClawOutputField: env.OPENCLAW_OUTPUT_FIELD || "response",
    openClawAuthBearer: env.OPENCLAW_AUTH_BEARER,
    openClawCliFallbackEnabled: parseBoolean(env.OPENCLAW_CLI_FALLBACK_ENABLED, false),
    openClawCliBin: env.OPENCLAW_CLI_BIN || "openclaw",
    openClawCliSessionId: env.OPENCLAW_CLI_SESSION_ID || "openclaw-voice",
    openClawHttpSessionId: env.OPENCLAW_HTTP_SESSION_ID || env.OPENCLAW_CLI_SESSION_ID || "openclaw-voice",
    openClawCliAgent: env.OPENCLAW_CLI_AGENT || "",
    openClawCliTimeoutMs: Number(env.OPENCLAW_CLI_TIMEOUT_MS || 120000)
  };
}
