# TimeTec WebOCR identity reader

A responsive browser interface for uploading an identity card or driving license and extracting the holder's name and identity number with either Regula Document Reader Web Components or OpenAI vision.

## Run locally

1. Copy `.env.example` to `.env`.
2. Configure one or both OCR providers:
   - Regula: for local development only, set `VITE_REGULA_LICENSE` to a Base64 Regula license. For production, use Regula domain-name licensing.
   - OpenAI: set `OPENAI_API_KEY` for the recommended server-side setup. For local testing, the Settings panel also accepts a session-only key that is not saved.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

The Regula camera flow requires HTTPS in production. `localhost` is treated as a secure context by modern browsers.

## Integration notes

- The page initializes `DocumentReaderService` with the `FullProcess` scenario.
- Results are handled from the component's `PROCESS_FINISHED` event.
- OpenAI mode sends JPG, PNG, or WebP images through the same-origin `/api/openai-ocr` server endpoint and uses `gpt-5.6-luna` with reasoning disabled for low-latency extraction.
- Each successful OpenAI scan displays input, output, and total tokens plus that process's estimated price in MYR and USD, formatted to four decimal places. The example configuration contains the standard GPT-5.6 Luna token rates and a dated USD/MYR reference rate; review both when pricing changes.
- Extracted fields remain editable so the user can correct OCR results before confirming.
- Real Regula license values are excluded by `.gitignore` and should never be committed.
- OpenAI and Regula modes provide optional session-only key fields. A typed key overrides the corresponding project setting for the next request; leaving it blank uses `OPENAI_API_KEY` or `VITE_REGULA_LICENSE`. Manual keys remain in page memory only and are not saved in browser storage.
