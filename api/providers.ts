/// <reference types="node" />

type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'azure-openai' | 'github-models';

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface VercelRequest {
  method?: string;
}

interface ProviderStatus {
  provider: ModelProvider;
  configured: boolean;
  missing: string[];
  defaultModel: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const providers = getProviderStatuses();
  const preferred = providers.find(provider => provider.provider === process.env.MODEL_PROVIDER && provider.configured)
    ?? providers.find(provider => provider.configured)
    ?? providers[0];

  res.status(200).json({ providers, preferredProvider: preferred.provider, preferredModel: preferred.defaultModel });
}

function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      provider: 'gemini',
      configured: hasAny(['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY']),
      missing: missingAny(['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY']),
      defaultModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    },
    {
      provider: 'openai',
      configured: hasAll(['OPENAI_API_KEY']),
      missing: missingAll(['OPENAI_API_KEY']),
      defaultModel: process.env.OPENAI_MODEL || 'gpt-5.4'
    },
    {
      provider: 'anthropic',
      configured: hasAll(['ANTHROPIC_API_KEY']),
      missing: missingAll(['ANTHROPIC_API_KEY']),
      defaultModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6'
    },
    {
      provider: 'azure-openai',
      configured: hasAll(['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT']),
      missing: missingAll(['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT']),
      defaultModel: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1'
    },
    {
      provider: 'github-models',
      configured: hasAny(['GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN']),
      missing: missingAny(['GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN']),
      defaultModel: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-5.4'
    }
  ];
}

function hasAll(names: string[]) {
  return names.every(name => !!process.env[name]);
}

function hasAny(names: string[]) {
  return names.some(name => !!process.env[name]);
}

function missingAll(names: string[]) {
  return names.filter(name => !process.env[name]);
}

function missingAny(names: string[]) {
  return hasAny(names) ? [] : names;
}
