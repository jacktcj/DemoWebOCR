# TimeTec WebOCR identity reader

A responsive browser interface for uploading an identity card or driving license and extracting the holder's name and identity number with Regula, OpenAI vision, or DeepSeek V4 Flash.

## Run locally

1. Copy `.env.example` to `.env`.
2. Configure one or both OCR providers:
   - Regula: for local development only, set `VITE_REGULA_LICENSE` to a Base64 Regula license. For production, use Regula domain-name licensing.
   - OpenAI: set `OPENAI_API_KEY` for the recommended server-side setup. For local testing, the Settings panel also accepts a session-only key that is not saved.
   - DeepSeek: set `DEEPSEEK_API_KEY`, or enter a session-only key in the DeepSeek provider. The image is read locally with Tesseract.js and only recognized text is sent to `deepseek-v4-flash` because this model is text-only.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

The Regula camera flow requires HTTPS in production. `localhost` is treated as a secure context by modern browsers.

## Host in production

The recommended production setup uses the Node/Express server so the OpenAI key stays private. Configure the hosting service to run:

```bash
npm install
npm run build
npm start
```

If the host serves only the `dist` folder, users can still enter a session-only OpenAI key. When the app detects that `/api/openai-ocr` is absent, it sends the image and typed key directly from the browser to OpenAI. The key is not saved, but it is available to the page runtime, so use this fallback only on a trusted deployment with a temporary or restricted key.

## Integration notes

- The page initializes `DocumentReaderService` with the `FullProcess` scenario.
- Results are handled from the component's `PROCESS_FINISHED` event.
- OpenAI mode prefers the same-origin `/api/openai-ocr` server endpoint. On static-only hosting, a manually entered session key enables a direct browser-to-OpenAI fallback. Both paths use `gpt-5.6-luna` with reasoning disabled for low-latency extraction.
- DeepSeek mode performs image-to-text OCR locally, then sends that text through `/api/deepseek-ocr` to `deepseek-v4-flash` with thinking disabled and JSON output enabled. Static-only hosting can use a manually entered key for a direct browser request when the DeepSeek API permits it.
- DeepSeek pricing uses the official V4 Flash rates per 1M tokens: USD $0.1400 cache-miss input, $0.0028 cache-hit input, and $0.2800 output. The process cost includes billed DeepSeek tokens only, not local OCR.
- Each successful OpenAI scan displays input, output, and total tokens plus that process's estimated price in MYR and USD, formatted to four decimal places. The example configuration contains the standard GPT-5.6 Luna token rates and a dated USD/MYR reference rate; review both when pricing changes.
- Extracted fields remain editable so the user can correct OCR results before confirming.
- Real Regula license values are excluded by `.gitignore` and should never be committed.
- OpenAI, DeepSeek, and Regula modes provide optional session-only key fields. A typed key overrides the corresponding project setting for the next request; leaving it blank uses `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or `VITE_REGULA_LICENSE`. Manual keys remain in page memory only and are not saved in browser storage.
