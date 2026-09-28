import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const SPACE_BUNNY_MODEL_ID = 'stealth/space-bunny-alpha';
export const SPACE_BUNNY_PROVIDER_ID = 'stealth';

const MODEL_METADATA_URL = `https://openrouter.ai/api/v1/model/${SPACE_BUNNY_MODEL_ID}`;
const CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 48;

export class OpenRouterKeyProbeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OpenRouterKeyProbeError';
  }
}

export function validateOpenRouterApiKey(value) {
  const apiKey = typeof value === 'string' ? value.trim() : '';
  if (!apiKey) {
    throw new OpenRouterKeyProbeError(
      'OPENROUTER_API_KEY is missing. Set it in apps/api/.env or the process environment.',
    );
  }

  if (/placeholder|replace[-_ ]?me|your[-_ ]?(openrouter[-_ ]?)?api[-_ ]?key|<[^>]+>/i.test(apiKey)) {
    throw new OpenRouterKeyProbeError(
      'OPENROUTER_API_KEY looks like a placeholder. Replace it locally before running this probe.',
    );
  }

  return apiKey;
}

export function buildSpaceBunnyProbeRequest() {
  return {
    model: SPACE_BUNNY_MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: false,
    messages: [
      {
        role: 'user',
        content: 'This is a synthetic API-key check. Call the check_key tool with status exactly "ok".',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'check_key',
          description: 'Return the fixed status for this synthetic API-key check.',
          parameters: {
            type: 'object',
            properties: { status: { type: 'string', enum: ['ok'] } },
            required: ['status'],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'check_key' } },
    provider: { only: [SPACE_BUNNY_PROVIDER_ID], allow_fallbacks: false },
  };
}

function parseJsonResponse(body, status, stage) {
  try {
    return JSON.parse(body);
  } catch {
    throw new OpenRouterKeyProbeError(
      `${stage} returned an unreadable response (HTTP ${status}); response body suppressed.`,
    );
  }
}

function readPrice(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

function verifyFreeToolModel(metadata) {
  const model = metadata?.data;
  const pricing = model?.pricing;
  const parameters = model?.supported_parameters;
  const promptPrice = readPrice(pricing?.prompt);
  const completionPrice = readPrice(pricing?.completion);
  const requestPrice = readPrice(pricing?.request);

  if (
    model?.id !== SPACE_BUNNY_MODEL_ID ||
    promptPrice !== 0 ||
    completionPrice !== 0 ||
    requestPrice !== 0 ||
    !Array.isArray(parameters) ||
    !parameters.includes('tools') ||
    !parameters.includes('tool_choice')
  ) {
    throw new OpenRouterKeyProbeError(
      'Space Bunny Alpha is no longer verified as a zero-price forced-tool model; no inference request was sent.',
    );
  }
}

async function responseBody(response, stage) {
  const body = await response.text();
  if (!response.ok) {
    throw new OpenRouterKeyProbeError(
      `${stage} failed with HTTP ${response.status}; response body suppressed.`,
    );
  }
  return parseJsonResponse(body, response.status, stage);
}

function summarizeSuccessfulProbe(payload) {
  if (typeof payload?.model === 'string' && payload.model !== SPACE_BUNNY_MODEL_ID) {
    throw new OpenRouterKeyProbeError('OpenRouter returned an unexpected model for the synthetic key check.');
  }

  const calls = payload?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length !== 1) {
    throw new OpenRouterKeyProbeError('The model did not return exactly one expected tool call.');
  }

  const call = calls[0];
  if (call?.function?.name !== 'check_key' || typeof call.function.arguments !== 'string') {
    throw new OpenRouterKeyProbeError('The model returned an unexpected synthetic tool call.');
  }

  let args;
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    throw new OpenRouterKeyProbeError('The model returned invalid tool arguments.');
  }

  if (args?.status !== 'ok' || Object.keys(args).length !== 1) {
    throw new OpenRouterKeyProbeError('The model returned invalid synthetic tool arguments.');
  }

  const usage = payload?.usage ?? {};
  return {
    ok: true,
    requestedModel: SPACE_BUNNY_MODEL_ID,
    providerConstraint: SPACE_BUNNY_PROVIDER_ID,
    toolCallValidated: true,
    usage: {
      promptTokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null,
      completionTokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null,
      cost: readPrice(usage.cost),
    },
  };
}

export async function runOpenRouterKeyProbe({
  apiKey = process.env.OPENROUTER_API_KEY,
  fetchImpl = fetch,
  signal = AbortSignal.timeout(20_000),
} = {}) {
  const key = validateOpenRouterApiKey(apiKey);
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };

  let pricingResponse;
  try {
    pricingResponse = await fetchImpl(MODEL_METADATA_URL, {
      method: 'GET',
      headers,
      signal,
    });
  } catch {
    throw new OpenRouterKeyProbeError('Model price preflight failed; no inference request was sent.');
  }

  const metadata = await responseBody(pricingResponse, 'Model price preflight');
  verifyFreeToolModel(metadata);

  let inferenceResponse;
  try {
    inferenceResponse = await fetchImpl(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSpaceBunnyProbeRequest()),
      signal,
    });
  } catch {
    throw new OpenRouterKeyProbeError(
      'The inference request outcome is unknown. Check OpenRouter activity before retrying.',
    );
  }

  const payload = await responseBody(inferenceResponse, 'OpenRouter inference');
  return summarizeSuccessfulProbe(payload);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runOpenRouterKeyProbe();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof OpenRouterKeyProbeError
      ? error.message
      : 'The probe failed unexpectedly. No credentials or response body were printed.';
    process.stderr.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
