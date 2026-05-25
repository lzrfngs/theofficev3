/// <reference types="node" />

interface IngestRequest {
  url?: string;
  title?: string;
  text?: string;
  maxChars?: number;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface VercelRequest {
  method?: string;
  body?: IngestRequest;
}

interface TextChunk {
  id: string;
  text: string;
  index: number;
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
    const body = req.body ?? {};
    const maxChars = Math.min(Math.max(body.maxChars ?? 24000, 4000), 60000);
    const rawText = body.text?.trim() || await fetchUrlText(body.url);
    if (!rawText) {
      res.status(400).json({ error: 'Missing source URL or text' });
      return;
    }

    const cleanText = cleanReadableText(rawText).slice(0, maxChars);
    const chunks = chunkText(cleanText, 1400).map((text, index) => ({
      id: `chunk-${index + 1}`,
      text,
      index
    }));

    res.status(200).json({
      title: body.title || body.url || 'Ingested source',
      url: body.url,
      text: cleanText,
      summary: summarizeText(cleanText),
      chunks
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown ingestion error' });
  }
}

async function fetchUrlText(url?: string) {
  if (!url) return '';
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only http(s) URLs can be ingested');

  const response = await fetch(parsed.toString(), {
    headers: {
      Accept: 'text/html, text/plain, application/xhtml+xml',
      'User-Agent': 'TheOfficeV3ResearchBot/1.0'
    }
  });
  if (!response.ok) throw new Error(`Source fetch failed (${response.status})`);
  const contentType = response.headers.get('content-type') || '';
  if (!/text|html|xml|json/.test(contentType)) throw new Error(`Unsupported source content type: ${contentType || 'unknown'}`);
  return response.text();
}

function cleanReadableText(rawText: string) {
  return rawText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: TextChunk[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const slice = text.slice(cursor, cursor + chunkSize);
    const sentenceBreak = slice.lastIndexOf('. ');
    const length = sentenceBreak > chunkSize * 0.55 ? sentenceBreak + 1 : slice.length;
    chunks.push({ id: `chunk-${chunks.length + 1}`, text: text.slice(cursor, cursor + length).trim(), index: chunks.length });
    cursor += length;
  }
  return chunks.map(chunk => chunk.text).filter(Boolean);
}

function summarizeText(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.length > 40);
  return sentences.slice(0, 4).join(' ').slice(0, 1200) || text.slice(0, 1200);
}
