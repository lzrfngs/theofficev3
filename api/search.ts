/// <reference types="node" />

interface SearchRequest {
  query?: string;
  maxResults?: number;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface VercelRequest {
  method?: string;
  body?: SearchRequest;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
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
    const query = req.body?.query?.trim();
    if (!query) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    const results = await searchTavily(query, req.body?.maxResults ?? 5);
    res.status(200).json({ query, results });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown search error' });
  }
}

async function searchTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
      max_results: Math.min(Math.max(maxResults, 1), 8)
    })
  });

  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data?.error || data?.message || `Tavily error ${response.status}`);

  return (data?.results ?? []).map((result: { title?: string; url?: string; content?: string }) => ({
    title: result.title || result.url || 'Untitled source',
    url: result.url || '',
    snippet: result.content || '',
    provider: 'tavily'
  })).filter((result: SearchResult) => result.url);
}

async function readJsonResponse(response: Response): Promise<{ results?: Array<{ title?: string; url?: string; content?: string }>; error?: string; message?: string }> {
  const rawText = await response.text();
  if (!rawText.trim()) return { error: `Tavily returned an empty response body (${response.status})` };

  try {
    return JSON.parse(rawText) as { results?: Array<{ title?: string; url?: string; content?: string }>; error?: string; message?: string };
  } catch {
    return { error: `Tavily returned non-JSON response (${response.status}): ${rawText.replace(/\s+/g, ' ').trim().slice(0, 240)}` };
  }
}
