/* ============================================
   UMRANIGPT - AI Server Service
   ============================================ */
'use strict';

window.OllamaService = (() => {
  const { ENDPOINTS } = window.AppConfig;
  const { normaliseUrl } = window.AppUtils;

  const getBase = () => normaliseUrl(window.AppStorage.getServerUrl());

  const endpoint = (path) => {
    const base = getBase();
    if (!base) throw new Error('Server URL not configured. Set UMRANI_SERVER_URL in index.html.');
    return base + path;
  };

  /* ---- Connection test ---- */
  const testConnection = async () => {
    const start = Date.now();
    try {
      const data = await AppStream.get(endpoint(ENDPOINTS.TAGS), 8000);
      const latency = Date.now() - start;
      return { ok: true, latency, models: data?.models || [] };
    } catch (err) {
      return { ok: false, error: err.message, latency: Date.now() - start };
    }
  };

  /* ---- List models ---- */
  const listModels = async () => {
    const data = await AppStream.get(endpoint(ENDPOINTS.TAGS));
    return (data?.models || []).map(m => ({
      name: m.name,
      size: m.size,
      digest: m.digest,
      modifiedAt: m.modified_at,
      parameterSize: m.details?.parameter_size,
      quantization: m.details?.quantization_level,
      family: m.details?.family,
    }));
  };

  /* ---- Show model details ---- */
  const showModel = async (name) => AppStream.request(endpoint(ENDPOINTS.SHOW), { name });

  /* ---- Get running models ---- */
  const getRunning = async () => {
    try { const data = await AppStream.get(endpoint(ENDPOINTS.PS), 5000); return data?.models || []; }
    catch { return []; }
  };

  /* ---- Chat (streaming) ---- */
  const chat = async (messages, options = {}) => {
    const settings = AppStorage.getSettings();
    const { model, onChunk, onDone, onError, streaming = settings.streaming } = options;

    const body = {
      model: model || settings.lastModel || '',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.images ? { images: m.images } : {}),
      })),
      stream: streaming,
      options: {
        temperature:    options.temperature    ?? settings.temperature,
        top_p:          options.topP           ?? settings.topP,
        top_k:          options.topK           ?? settings.topK,
        repeat_penalty: options.repeatPenalty  ?? settings.repeatPenalty,
        num_ctx:        options.contextLength  ?? settings.contextLength,
        ...(settings.seed >= 0 ? { seed: settings.seed } : {}),
      },
    };

    if (settings.systemPrompt) {
      const hasSystem = body.messages.some(m => m.role === 'system');
      if (!hasSystem) body.messages.unshift({ role: 'system', content: settings.systemPrompt });
    }

    if (!streaming) {
      try {
        const data = await AppStream.request(endpoint(ENDPOINTS.CHAT), { ...body, stream: false });
        onChunk?.(data.message?.content || '');
        onDone?.({
          promptTokens:     data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens:      (data.prompt_eval_count || 0) + (data.eval_count || 0),
          duration:         data.total_duration ? Math.round(data.total_duration / 1e6) : 0,
        });
      } catch (err) { onError?.({ type: 'network', message: err.message }); }
      return;
    }

    await AppStream.stream(endpoint(ENDPOINTS.CHAT), body, onChunk, onDone, onError);
  };

  /* ---- Generate (legacy) ---- */
  const generate = async (prompt, options = {}) => {
    const settings = AppStorage.getSettings();
    const body = {
      model: options.model || '',
      prompt,
      stream: options.streaming ?? settings.streaming,
      options: {
        temperature:    options.temperature   ?? settings.temperature,
        top_p:          options.topP          ?? settings.topP,
        top_k:          options.topK          ?? settings.topK,
        repeat_penalty: options.repeatPenalty ?? settings.repeatPenalty,
        num_ctx:        options.contextLength ?? settings.contextLength,
      },
      ...(settings.systemPrompt ? { system: settings.systemPrompt } : {}),
    };
    await AppStream.stream(endpoint(ENDPOINTS.GENERATE), body, options.onChunk, options.onDone, options.onError);
  };

  /* ---- Embed ---- */
  const embed = async (model, input) => AppStream.request(endpoint(ENDPOINTS.EMBED), { model, input });

  /* ---- Abort ---- */
  const abort = () => AppStream.abort();

  return { getBase, testConnection, listModels, showModel, getRunning, chat, generate, embed, abort };
})();
