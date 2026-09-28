import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSpaceBunnyProbeRequest,
  runOpenRouterKeyProbe,
  SPACE_BUNNY_MODEL_ID,
  OpenRouterKeyProbeError,
} from './test-openrouter-key.mjs';

const modelUrl = `https://openrouter.ai/api/v1/model/${SPACE_BUNNY_MODEL_ID}`;
const inferenceUrl = 'https://openrouter.ai/api/v1/chat/completions';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function freeModelMetadata(overrides = {}) {
  return {
    data: {
      id: SPACE_BUNNY_MODEL_ID,
      pricing: { prompt: '0', completion: '0', request: '0' },
      supported_parameters: ['tools', 'tool_choice'],
      ...overrides,
    },
  };
}

function expectedToolResponse(overrides = {}) {
  return {
    model: SPACE_BUNNY_MODEL_ID,
    provider: 'stealth',
    choices: [{
      message: {
        tool_calls: [{
          type: 'function',
          function: { name: 'check_key', arguments: '{"status":"ok"}' },
        }],
      },
    }],
    usage: { prompt_tokens: 20, completion_tokens: 5, cost: '0' },
    ...overrides,
  };
}

test('does not make network requests for a missing or placeholder key', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('must not call fetch'); };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: '', fetchImpl }),
    /OPENROUTER_API_KEY is missing/,
  );
  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'placeholder-for-now', fetchImpl }),
    /looks like a placeholder/,
  );
  assert.equal(calls, 0);
});

test('uses a zero-price preflight and sends one pinned, no-fallback forced-tool request', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (url === modelUrl) return jsonResponse(freeModelMetadata());
    if (url === inferenceUrl) return jsonResponse(expectedToolResponse());
    throw new Error('unexpected URL');
  };

  const result = await runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl });
  assert.deepEqual(requests.map(({ url }) => url), [modelUrl, inferenceUrl]);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer sk-or-v1-test-key');
  assert.equal(requests[1].init.headers.Authorization, 'Bearer sk-or-v1-test-key');

  const body = JSON.parse(requests[1].init.body);
  assert.equal(body.model, SPACE_BUNNY_MODEL_ID);
  assert.equal(body.max_tokens <= 48, true);
  assert.deepEqual(body.provider, { only: ['stealth'], allow_fallbacks: false });
  assert.deepEqual(body.tool_choice, { type: 'function', function: { name: 'check_key' } });
  assert.deepEqual(result, {
    ok: true,
    requestedModel: SPACE_BUNNY_MODEL_ID,
    providerConstraint: 'stealth',
    toolCallValidated: true,
    usage: { promptTokens: 20, completionTokens: 5, cost: 0 },
  });
});

test('blocks inference when the model is no longer listed at zero price', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    return jsonResponse(freeModelMetadata({
      pricing: { prompt: '0.01', completion: '0', request: '0' },
    }));
  };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl }),
    /no longer verified as a zero-price forced-tool model/,
  );
  assert.deepEqual(requests, [modelUrl]);
});

test('suppresses OpenRouter error response bodies', async () => {
  const fetchImpl = async (url) => {
    if (url === modelUrl) return jsonResponse(freeModelMetadata());
    return jsonResponse({ error: { message: 'sensitive provider response body' } }, 401);
  };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl }),
    (error) => {
      assert.ok(error instanceof OpenRouterKeyProbeError);
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, /sensitive provider response body/);
      return true;
    },
  );
});

test('does not retry an inference request with an unknown outcome', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url === modelUrl) return jsonResponse(freeModelMetadata());
    throw new Error('transport detail must not be printed');
  };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl }),
    (error) => {
      assert.match(error.message, /outcome is unknown/);
      assert.match(error.message, /Check OpenRouter activity before retrying/);
      assert.doesNotMatch(error.message, /transport detail/);
      return true;
    },
  );
  assert.deepEqual(requests, [modelUrl, inferenceUrl]);
});

test('does not accept a response attributed to a different model', async () => {
  const fetchImpl = async (url) => {
    if (url === modelUrl) return jsonResponse(freeModelMetadata());
    return jsonResponse(expectedToolResponse({ model: 'unexpected/model' }));
  };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl }),
    /unexpected model/,
  );
});

test('refuses unexpected tool output without printing its contents', async () => {
  const fetchImpl = async (url) => {
    if (url === modelUrl) return jsonResponse(freeModelMetadata());
    return jsonResponse(expectedToolResponse({
      choices: [{ message: { content: 'private model output', tool_calls: [] } }],
    }));
  };

  await assert.rejects(
    runOpenRouterKeyProbe({ apiKey: 'sk-or-v1-test-key', fetchImpl }),
    (error) => {
      assert.match(error.message, /exactly one expected tool call/);
      assert.doesNotMatch(error.message, /private model output/);
      return true;
    },
  );
});

test('probe prompt and payload are synthetic and pinned to the free model route', () => {
  const body = buildSpaceBunnyProbeRequest();
  assert.equal(body.model, SPACE_BUNNY_MODEL_ID);
  assert.equal(body.provider.only[0], 'stealth');
  assert.equal(body.provider.allow_fallbacks, false);
  assert.equal(body.messages[0].content.includes('synthetic'), true);
  assert.equal(body.max_tokens, 48);
});
