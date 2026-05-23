/// <reference types="node" />

interface ImageRequest {
  prompt?: string;
  model?: string;
  size?: string;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface VercelRequest {
  method?: string;
  body?: ImageRequest;
}

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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    const body = req.body ?? {};
    if (!body.prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: body.model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
        prompt: body.prompt,
        size: body.size || '1024x1024',
        response_format: 'b64_json'
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI image error ${response.status}`);

    const image = data?.data?.[0]?.b64_json;
    if (!image) throw new Error('Empty image response');

    res.status(200).json({ image, mimeType: 'image/png' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown image generation error' });
  }
}
