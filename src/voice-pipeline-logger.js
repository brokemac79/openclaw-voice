export function formatPipelineError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: "Error",
    message: String(error)
  };
}

export function createVoicePipelineLogger({ writeLine, nowIso, context = {} } = {}) {
  const writer = writeLine || ((line) => process.stderr.write(line));
  const now = nowIso || (() => new Date().toISOString());

  function emit(event, payload = {}) {
    writer(
      `${JSON.stringify({
        type: "voice_pipeline",
        at: now(),
        ...context,
        event,
        ...payload
      })}\n`
    );
  }

  return {
    stageStart(stage, payload = {}) {
      emit("stage_start", { stage, ...payload });
    },
    stageSuccess(stage, payload = {}) {
      emit("stage_success", { stage, ...payload });
    },
    stageFailure(stage, error, payload = {}) {
      emit("stage_failure", {
        stage,
        ...payload,
        error: formatPipelineError(error)
      });
    },
    pipelineFailure(failedStage, error, payload = {}) {
      emit("pipeline_failure", {
        failedStage,
        ...payload,
        error: formatPipelineError(error)
      });
    }
  };
}
