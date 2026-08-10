import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 5173);
const production = process.argv.includes('--production');
const root = path.dirname(fileURLToPath(import.meta.url));

function readPositiveNumber(name) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getPricingConfig() {
  const inputUsdPerMillion = readPositiveNumber('OPENAI_INPUT_USD_PER_1M');
  const cachedInputUsdPerMillion = readPositiveNumber('OPENAI_CACHED_INPUT_USD_PER_1M');
  const outputUsdPerMillion = readPositiveNumber('OPENAI_OUTPUT_USD_PER_1M');
  const usdToMyr = readPositiveNumber('USD_TO_MYR');

  return {
    model: process.env.OPENAI_OCR_MODEL || 'gpt-5.6-luna',
    inputUsdPerMillion,
    cachedInputUsdPerMillion,
    outputUsdPerMillion,
    usdToMyr,
    configured: Boolean(inputUsdPerMillion && outputUsdPerMillion && usdToMyr),
  };
}

function summarizeUsage(result) {
  const inputTokens = Number(result.usage?.input_tokens) || 0;
  const cachedInputTokens = Number(result.usage?.input_tokens_details?.cached_tokens) || 0;
  const outputTokens = Number(result.usage?.output_tokens) || 0;
  const reasoningTokens = Number(result.usage?.output_tokens_details?.reasoning_tokens) || 0;
  const totalTokens = Number(result.usage?.total_tokens) || inputTokens + outputTokens;
  const pricing = getPricingConfig();

  let estimatedCostUsd = null;
  let estimatedCostMyr = null;
  if (pricing.configured) {
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const inputCostUsd = (uncachedInputTokens / 1_000_000) * pricing.inputUsdPerMillion;
    const cachedCostUsd = (cachedInputTokens / 1_000_000)
      * (pricing.cachedInputUsdPerMillion || pricing.inputUsdPerMillion);
    const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputUsdPerMillion;
    estimatedCostUsd = inputCostUsd + cachedCostUsd + outputCostUsd;
    estimatedCostMyr = estimatedCostUsd * pricing.usdToMyr;
  }

  return {
    model: result.model || pricing.model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    estimatedCostUsd,
    estimatedCostMyr,
    pricingConfigured: pricing.configured,
    pricing,
  };
}

app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

app.get('/api/openai-pricing', (_request, response) => {
  response.json({
    ...getPricingConfig(),
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
});

app.post('/api/openai-ocr', async (request, response) => {
  const serverApiKey = process.env.OPENAI_API_KEY?.trim();
  const requestApiKey = request.get('x-openai-api-key')?.trim();
  const apiKey = requestApiKey || serverApiKey;
  const { imageDataUrl } = request.body || {};

  if (!apiKey) {
    return response.status(400).json({
      error: 'Enter an OpenAI API key to use OpenAI OCR.',
    });
  }

  if (requestApiKey && requestApiKey.length > 512) {
    return response.status(400).json({ error: 'The supplied OpenAI API key is invalid.' });
  }

  if (typeof imageDataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl)) {
    return response.status(400).json({ error: 'Upload a JPG, PNG, or WebP image.' });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      timeout: 45_000,
      maxRetries: 1,
    });
    const result = await openai.responses.create({
      model: process.env.OPENAI_OCR_MODEL || 'gpt-5.6-luna',
      reasoning: { effort: 'none' },
      store: false,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Read this identity card or driving license. Return the holder full name and the primary identity, personal, or document number exactly as printed. Use empty strings when a value cannot be read.',
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'high',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'identity_document',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              full_name: { type: 'string' },
              identity_number: { type: 'string' },
              document_type: { type: 'string' },
            },
            required: ['full_name', 'identity_number', 'document_type'],
            additionalProperties: false,
          },
        },
      },
    });

    const extracted = JSON.parse(result.output_text);
    return response.json({
      name: extracted.full_name,
      identityNumber: extracted.identity_number,
      documentType: extracted.document_type,
      usage: summarizeUsage(result),
    });
  } catch (error) {
    const connectionFailure =
      error?.name === 'APIConnectionError' ||
      error?.name === 'APIConnectionTimeoutError' ||
      error?.message === 'Connection error.';
    const status = connectionFailure ? 503 : Number(error?.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const message = safeStatus === 401
      ? 'The OpenAI API key was rejected.'
      : safeStatus === 403
        ? 'This OpenAI project does not have access to the selected OCR model.'
        : safeStatus === 404
          ? 'The configured OpenAI OCR model is unavailable. Check OPENAI_OCR_MODEL.'
      : safeStatus === 429
        ? 'OpenAI rate limit or account quota reached.'
        : safeStatus === 503
          ? 'The OCR server cannot reach OpenAI. Check its internet connection and try again.'
        : 'OpenAI could not read this document. Try a clearer image.';

    console.error('OpenAI OCR request failed:', error?.message || error);
    return response.status(safeStatus).json({ error: message });
  }
});

if (production) {
  app.use(express.static(path.join(root, 'dist')));
  app.use((_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '127.0.0.1', () => {
  console.log(`TimeTec WebOCR running at http://127.0.0.1:${port}/`);
});
