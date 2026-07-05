const OpenAI = require('openai');

function getOpenAiKey() {
  const k = String(process.env.OPENAI_API_KEY || '').trim();
  if (!k) {
    const err = new Error('AI provider chưa được cấu hình (OPENAI_API_KEY)');
    err.statusCode = 503;
    throw err;
  }
  return k;
}

function getOpenAiClient() {
  return new OpenAI({
    apiKey: getOpenAiKey()
  });
}

function getChatModel() {
  return String(process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
}

function safeJsonParse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeParsedResult(parsed) {
  const reply = String(parsed?.reply || '').trim();
  if (!reply) {
    const err = new Error('OpenAI trả về JSON nhưng thiếu trường "reply".');
    err.statusCode = 502;
    throw err;
  }

  const detectedEmotion = String(parsed?.detectedEmotion || 'other').trim();
  const emotionScoreRaw = Number(parsed?.emotionScore);
  const emotionScore = Number.isFinite(emotionScoreRaw) ? Math.max(0, Math.min(100, emotionScoreRaw)) : 50;

  const suggestions = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : [];

  const recommendedActions = Array.isArray(parsed?.recommendedActions)
    ? parsed.recommendedActions.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : [];

  return { reply, detectedEmotion, emotionScore, suggestions, recommendedActions };
}

function buildOpenAiError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 500);
  const code = String(
    error?.code || error?.type || error?.error?.code || error?.response?.data?.error?.code || ''
  ).trim();
  const providerMessage =
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    'OpenAI chat failed';
  const providerType = String(
    error?.type || error?.name || error?.error?.type || error?.response?.data?.error?.type || ''
  ).trim();
  const requestId = String(error?.request_id || error?.headers?.['x-request-id'] || '').trim();

  console.error(
    '[ai.chat] OpenAI error:',
    JSON.stringify(
      {
        status,
        code: code || null,
        type: providerType || null,
        message: String(providerMessage || ''),
        model: getChatModel(),
        requestId: requestId || null
      },
      null,
      2
    )
  );

  const nextError = new Error(`OpenAI chat failed: ${String(providerMessage || 'Unknown error')}`);
  nextError.statusCode = Number.isFinite(status) && status > 0 ? status : 500;
  nextError.code = code || undefined;
  nextError.providerStatus = nextError.statusCode;
  nextError.providerType = providerType || undefined;
  return nextError;
}

async function chat({ systemPrompt, messages }) {
  const model = getChatModel();
  console.log(
    '[ai.chat] Request:',
    JSON.stringify(
      {
        keyLoaded: String(process.env.OPENAI_API_KEY || '').trim().length > 0,
        model,
        messageCount: Array.isArray(messages) ? messages.length : 0
      },
      null,
      2
    )
  );

  try {
    const openai = getOpenAiClient();
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: systemPrompt }, ...(messages || [])]
    });

    const content = completion?.choices?.[0]?.message?.content;
    const parsed = safeJsonParse(content);

    if (!parsed || typeof parsed.reply !== 'string') {
      console.error(
        '[ai.chat] Invalid OpenAI response format:',
        JSON.stringify(
          {
            model,
            content: String(content || '').slice(0, 500)
          },
          null,
          2
        )
      );
      const err = new Error('OpenAI trả về dữ liệu không đúng định dạng JSON mong đợi.');
      err.statusCode = 502;
      throw err;
    }

    return normalizeParsedResult(parsed);
  } catch (error) {
    if (error?.statusCode && !error?.response && !error?.status) {
      console.error(
        '[ai.chat] Service error:',
        JSON.stringify(
          {
            status: error.statusCode,
            message: String(error.message || ''),
            model
          },
          null,
          2
        )
      );
      throw error;
    }
    throw buildOpenAiError(error);
  }
}

module.exports = { chat };
