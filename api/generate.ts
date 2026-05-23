/// <reference types="node" />

type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'azure-openai' | 'github-models';

interface GenerateRequest {
  provider?: ModelProvider;
  model?: string;
  system?: string;
  prompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface VercelRequest {
  method?: string;
  body?: GenerateRequest;
}

const defaultProvider = (process.env.MODEL_PROVIDER as ModelProvider | undefined) ?? 'gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body ?? {};
    if (!body.prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }

    const provider = body.provider ?? defaultProvider;
    const model = body.model || getDefaultModel(provider);
    const text = await callProvider({
      provider,
      model,
      system: body.system ?? '',
      prompt: body.prompt,
      temperature: body.temperature ?? 0.7,
      maxOutputTokens: body.maxOutputTokens ?? 2048
    });

    res.status(200).json({ text, provider, model });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

async function callProvider(request: Required<GenerateRequest> & { provider: ModelProvider }) {
  if (request.provider === 'gemini') return callGemini(request);
  if (request.provider === 'openai') return callOpenAI(request, 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY);
  if (request.provider === 'anthropic') return callAnthropic(request);
  if (request.provider === 'azure-openai') return callAzureOpenAI(request);
  if (request.provider === 'github-models') return callOpenAI(request, 'https://models.github.ai/inference/chat/completions', process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN);
  throw new Error(`Unsupported provider: ${request.provider}`);
}

async function callGemini(request: Required<GenerateRequest>) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens
      }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(formatProviderError(data, `Gemini error ${response.status}`));

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function callOpenAI(request: Required<GenerateRequest>, endpoint: string, apiKey?: string) {
  if (!apiKey) throw new Error(`Missing API key for ${request.provider}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature,
      max_completion_tokens: request.maxOutputTokens
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(formatProviderError(data, `${request.provider} error ${response.status}`));

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from ${request.provider}`);
  return text;
}

async function callAnthropic(request: Required<GenerateRequest>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: request.model,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(formatProviderError(data, `Anthropic error ${response.status}`));

  const text = data?.content?.map((part: { type: string; text?: string }) => part.type === 'text' ? part.text : '').join('').trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

async function callAzureOpenAI(request: Required<GenerateRequest>) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
  if (!apiKey || !endpoint) throw new Error('Missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT');

  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || request.model;
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  const url = `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature,
      max_completion_tokens: request.maxOutputTokens
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(formatProviderError(data, `Azure OpenAI error ${response.status}`));

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Azure OpenAI');
  return text;
}

function getDefaultModel(provider: ModelProvider) {
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  if (provider === 'openai') return process.env.OPENAI_MODEL || 'gpt-5.4';
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL || 'claude-opus-4-6';
  if (provider === 'azure-openai') return process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';
  if (provider === 'github-models') return process.env.GITHUB_MODELS_MODEL || 'openai/gpt-5.4';
  return 'gemini-3.5-flash';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown model router error';
}

function formatProviderError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;

  const error = 'error' in data ? (data as { error?: unknown }).error : data;
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return fallback;

  const record = error as Record<string, unknown>;
  const message = stringifyErrorField(record.message);
  const code = stringifyErrorField(record.code);
  const type = stringifyErrorField(record.type);
  const param = stringifyErrorField(record.param);

  const parts = [message, code && `code: ${code}`, type && `type: ${type}`, param && `param: ${param}`].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error);
}

function stringifyErrorField(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
