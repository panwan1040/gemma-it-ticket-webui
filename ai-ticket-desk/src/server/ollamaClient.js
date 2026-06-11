import { config } from './config.js';

function aiOptions(options = {}) {
  return {
    temperature: config.ai.temperature,
    top_p: config.ai.topP,
    num_ctx: config.ai.numCtx,
    num_predict: config.ai.numPredict,
    ...options
  };
}

async function callGenerate(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw Object.assign(new Error(`Ollama model call failed with HTTP ${response.status}. ${text.slice(0, 300)}`), {
        status: 502
      });
    }
    const data = await response.json();
    return data.response ?? '';
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Ollama request timed out.'), { status: 504 });
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      throw Object.assign(new Error('Ollama is unreachable. Please confirm Ollama is running and the configured base URL is correct.'), {
        status: 502
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function generateText({ model, prompt, options, format }) {
  return callGenerate({
    model,
    prompt,
    stream: false,
    options: aiOptions(options),
    ...(format ? { format } : {})
  });
}

export function generateWithImages({ model, prompt, imageBase64List, options, format }) {
  return callGenerate({
    model,
    prompt,
    images: imageBase64List,
    stream: false,
    options: aiOptions(options),
    ...(format ? { format } : {})
  });
}

export async function pingOllama() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
    return { reachable: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { reachable: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}
