import test from "node:test";
import assert from "node:assert/strict";

import { createVoicePipelineLogger, formatPipelineError } from "../src/voice-pipeline-logger.js";

test("formatPipelineError serializes Error instances", () => {
  const serialized = formatPipelineError(new TypeError("bad input"));
  assert.deepEqual(serialized, {
    name: "TypeError",
    message: "bad input"
  });
});

test("createVoicePipelineLogger writes structured stage and failure events", () => {
  const lines = [];
  const logger = createVoicePipelineLogger({
    writeLine: (line) => lines.push(line),
    nowIso: () => "2026-03-31T00:00:00.000Z",
    context: {
      requestId: "req-1",
      route: "/api/voice/turn"
    }
  });

  logger.stageStart("query_openclaw", { hasSessionId: true });
  logger.stageSuccess("query_openclaw", { responseChars: 42 });
  logger.pipelineFailure("synthesize_tts", new Error("tts down"));

  assert.equal(lines.length, 3);

  const first = JSON.parse(lines[0]);
  assert.equal(first.type, "voice_pipeline");
  assert.equal(first.event, "stage_start");
  assert.equal(first.stage, "query_openclaw");
  assert.equal(first.requestId, "req-1");
  assert.equal(first.route, "/api/voice/turn");

  const second = JSON.parse(lines[1]);
  assert.equal(second.event, "stage_success");
  assert.equal(second.responseChars, 42);

  const third = JSON.parse(lines[2]);
  assert.equal(third.event, "pipeline_failure");
  assert.equal(third.failedStage, "synthesize_tts");
  assert.equal(third.error.message, "tts down");
});
