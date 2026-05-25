import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import generateHandler from './api/generate'
import ingestHandler from './api/ingest'
import providersHandler from './api/providers'
import searchHandler from './api/search'

interface LocalApiRequest extends IncomingMessage {
  body?: unknown;
}

interface LocalApiResponse extends ServerResponse {
  status: (code: number) => LocalApiResponse;
  json: (body: unknown) => void;
}

type LocalApiHandler = (req: LocalApiRequest, res: LocalApiResponse) => Promise<void> | void;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), localApiPlugin()]
  };
})

function localApiPlugin(): Plugin {
  return {
    name: 'the-office-local-api',
    configureServer(server) {
      server.middlewares.use('/api/generate', createLocalApiMiddleware(generateHandler));
      server.middlewares.use('/api/ingest', createLocalApiMiddleware(ingestHandler));
      server.middlewares.use('/api/providers', createLocalApiMiddleware(providersHandler));
      server.middlewares.use('/api/search', createLocalApiMiddleware(searchHandler));
    }
  };
}

function createLocalApiMiddleware(handler: unknown) {
  const localHandler = handler as LocalApiHandler;

  return async (req: IncomingMessage, res: ServerResponse) => {
    const localReq = req as LocalApiRequest;
    const localRes = res as LocalApiResponse;

    try {
      localReq.body = await readRequestBody(localReq);
      localRes.status = (code: number) => {
        localRes.statusCode = code;
        return localRes;
      };
      localRes.json = (body: unknown) => {
        if (!localRes.headersSent) localRes.setHeader('Content-Type', 'application/json');
        localRes.end(JSON.stringify(body));
      };

      await localHandler(localReq, localRes);
    } catch (error) {
      localRes.statusCode = 500;
      localRes.setHeader('Content-Type', 'application/json');
      localRes.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local API middleware error' }));
    }
  };
}

async function readRequestBody(req: IncomingMessage) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawText = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawText) return undefined;
  return JSON.parse(rawText) as unknown;
}
