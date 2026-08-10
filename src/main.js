import {
  defineComponents,
  DocumentReaderService,
  GraphicFieldType,
  TextFieldType,
} from '@regulaforensics/vp-frontend-document-components';
import OpenAI from 'openai';
import './styles.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#" aria-label="TimeTec WebOCR home">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" role="img"><path d="M6.7 9.6 16 4.2l9.3 5.4v12.8L16 27.8l-9.3-5.4V9.6Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m11.2 16 3 3 6.7-7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/></svg>
        </span>
        <span>TimeTec WebOCR</span>
      </a>
      <span class="secure-pill"><span></span> Secure session</span>
    </header>

    <main>
      <section class="hero">
        <div class="eyebrow">IDENTITY CHECK</div>
        <h1>Verify your identity.</h1>
        <p>Upload a clear photo of your identity document. We’ll securely read the details and fill them in for you.</p>
      </section>

      <section class="workspace" aria-label="Identity document verification">
        <div class="stepper" aria-label="Verification steps">
          <div class="step is-active" data-step="1"><span>1</span><strong>Document</strong></div>
          <div class="step-line"></div>
          <div class="step" data-step="2"><span>2</span><strong>Review</strong></div>
          <div class="step-line"></div>
          <div class="step" data-step="3"><span>3</span><strong>Complete</strong></div>
        </div>

        <section class="ocr-settings" aria-labelledby="ocr-settings-title">
          <div class="settings-copy">
            <span class="settings-icon" aria-hidden="true">⚙</span>
            <div><strong id="ocr-settings-title">OCR provider</strong><p>Choose how this document should be read.</p></div>
          </div>
          <div class="provider-controls">
            <div class="provider-toggle" role="radiogroup" aria-label="OCR provider">
              <button class="provider-option" type="button" role="radio" aria-checked="false" data-provider="regula">Regula</button>
              <button class="provider-option is-selected" type="button" role="radio" aria-checked="true" data-provider="openai">OpenAI</button>
            </div>
            <div id="openai-key-config" class="api-key-config" hidden>
              <label for="openai-api-key">OpenAI API key <span>Optional override</span></label>
              <input id="openai-api-key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="sk-…" />
              <small>Enter a key to use it for this session. On static hosting it is sent directly to OpenAI and is not saved; leave blank to use the server key.</small>
            </div>
            <div id="regula-key-config" class="api-key-config" hidden>
              <label for="regula-license-key">Regula license key <span>Optional override</span></label>
              <input id="regula-license-key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste Base64 license" />
              <small>Enter a license to use it for this session, or leave blank to use VITE_REGULA_LICENSE.</small>
            </div>
          </div>
        </section>

        <div id="notice" class="notice" role="status" aria-live="polite">
          <span class="notice-icon">i</span>
          <div><strong>Setting up secure document reader</strong><p>This usually takes a few seconds.</p></div>
        </div>

        <div class="content-grid">
          <section class="upload-panel">
            <div class="panel-heading">
              <div><span class="section-number">01</span><h2>Upload document</h2></div>
              <span class="supported">ID · LICENSE</span>
            </div>

            <div id="reader-frame" class="reader-frame" aria-busy="true">
              <input id="openai-file" type="file" accept="image/jpeg,image/png,image/webp" hidden />
              <input id="regula-file" type="file" accept="image/jpeg,image/png,image/webp" hidden />
              <input id="openai-camera-file" type="file" accept="image/*" capture="environment" hidden />
              <canvas id="camera-canvas" hidden></canvas>
              <document-reader
                id="document-reader"
                start-screen="true"
                copyright="false"
              ></document-reader>
              <div id="document-preview" class="document-preview" hidden>
                <img id="document-preview-image" alt="Preview of the selected identity document" />
                <div class="preview-bar">
                  <div><strong>Document preview</strong><span id="document-preview-name"></span></div>
                  <button id="change-document" type="button">Change</button>
                </div>
              </div>
              <div id="processing-overlay" class="processing-overlay" hidden role="status" aria-live="polite">
                <span class="processing-spinner" aria-hidden="true"><span></span></span>
                <strong>Processing document</strong>
                <span id="processing-message">Extracting identity details…</span>
              </div>
              <div id="openai-camera" class="openai-camera" hidden>
                <video id="openai-camera-video" autoplay playsinline muted></video>
                <label id="camera-device-picker" class="camera-device-picker" hidden>
                  Camera
                  <select id="camera-device-select" aria-label="Select camera"></select>
                </label>
                <div class="camera-guide" aria-hidden="true"></div>
                <div class="camera-controls">
                  <button id="cancel-camera" class="camera-cancel" type="button">Cancel</button>
                  <button id="capture-camera" class="camera-shutter" type="button" aria-label="Capture document photo"><span></span></button>
                  <span>Place the document inside the frame</span>
                </div>
              </div>
              <div id="reader-placeholder" class="reader-placeholder">
                <div class="document-illustration" aria-hidden="true">
                  <span class="avatar"></span><span class="doc-line l1"></span><span class="doc-line l2"></span><span class="doc-line l3"></span>
                </div>
                <h3>Choose your document</h3>
                <p>Upload an identity card or driving license</p>
                <button id="reopen-reader" class="fake-button" type="button" disabled><span>↑</span> Select document</button>
                <button id="openai-camera-button" class="fake-button fake-button--secondary" type="button" hidden><span>◉</span> Capture photo</button>
                <button id="native-camera-button" class="native-camera-button" type="button" hidden>Use device camera instead</button>
                <small>JPG, PNG or PDF · Maximum 10 MB</small>
              </div>
            </div>

            <div class="tips">
              <strong>For the best result</strong>
              <ul>
                <li>Use a clear, well-lit image</li>
                <li>Show all four corners</li>
                <li>Avoid glare and blur</li>
              </ul>
            </div>
          </section>

          <aside class="result-panel">
            <div class="panel-heading compact">
              <div><span class="section-number">02</span><h2>Extracted details</h2></div>
            </div>
            <div id="result-empty" class="result-empty">
              <div class="empty-rings" aria-hidden="true"><span></span></div>
              <h3>Waiting for a document</h3>
              <p>Your extracted name and identity number will appear here.</p>
            </div>
            <div id="result-data" class="result-data" hidden>
              <div class="success-label"><span>✓</span> Document read successfully</div>
              <label>Full name<input id="full-name" type="text" autocomplete="name" /></label>
              <label>Identity number<input id="identity-number" type="text" autocomplete="off" /></label>
              <p class="review-note">Review the details and correct anything that doesn’t match your document.</p>
              <button id="confirm-button" class="confirm-button" type="button">Confirm details <span>→</span></button>
            </div>
            <div id="completed" class="completed" hidden>
              <div class="complete-mark">✓</div>
              <h3>Identity details confirmed</h3>
              <p>Your verification details are ready to use.</p>
              <button id="start-over" class="text-button" type="button">Scan another document</button>
            </div>
            <div id="usage-summary" class="usage-summary" hidden>
              <div class="usage-heading"><strong>OpenAI usage &amp; pricing</strong><span id="usage-model">gpt-5.6-luna</span></div>
              <div class="usage-grid">
                <span>Input tokens<strong id="usage-input">0</strong></span>
                <span>Cached<strong id="usage-cached">0</strong></span>
                <span>Output tokens<strong id="usage-output">0</strong></span>
                <span>Total tokens<strong id="usage-total">0</strong></span>
              </div>
              <div class="usage-cost"><span>This OCR process</span><strong id="usage-cost">Not configured</strong></div>
              <div id="usage-usd" class="usage-usd"></div>
              <div id="usage-rates" class="usage-rates"></div>
              <small id="usage-pricing-note">Token totals update after a successful scan.</small>
            </div>
          </aside>
        </div>
      </section>
    </main>

    <footer>
      <span id="data-note"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 8V6a4.5 4.5 0 0 1 9 0v2M4 8h12v9H4V8Z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg> Your data is processed securely in your browser</span>
      <span>OCR provider: <strong id="provider-credit">Regula</strong></span>
    </footer>
  </div>
`;

const readerFrame = document.querySelector('#reader-frame');
const readerPlaceholder = document.querySelector('#reader-placeholder');
const notice = document.querySelector('#notice');
const resultEmpty = document.querySelector('#result-empty');
const resultData = document.querySelector('#result-data');
const completed = document.querySelector('#completed');
const fullNameInput = document.querySelector('#full-name');
const identityNumberInput = document.querySelector('#identity-number');
const usageSummary = document.querySelector('#usage-summary');
const usageModel = document.querySelector('#usage-model');
const usageInput = document.querySelector('#usage-input');
const usageCached = document.querySelector('#usage-cached');
const usageOutput = document.querySelector('#usage-output');
const usageTotal = document.querySelector('#usage-total');
const usageCost = document.querySelector('#usage-cost');
const usageUsd = document.querySelector('#usage-usd');
const usageRates = document.querySelector('#usage-rates');
const usagePricingNote = document.querySelector('#usage-pricing-note');
const confirmButton = document.querySelector('#confirm-button');
const startOverButton = document.querySelector('#start-over');
const readerComponent = document.querySelector('#document-reader');
const reopenReaderButton = document.querySelector('#reopen-reader');
const providerOptions = document.querySelectorAll('.provider-option');
const openaiKeyConfig = document.querySelector('#openai-key-config');
const openaiApiKeyInput = document.querySelector('#openai-api-key');
const regulaKeyConfig = document.querySelector('#regula-key-config');
const regulaLicenseInput = document.querySelector('#regula-license-key');
const openaiFileInput = document.querySelector('#openai-file');
const regulaFileInput = document.querySelector('#regula-file');
const openaiCameraFileInput = document.querySelector('#openai-camera-file');
const documentPreview = document.querySelector('#document-preview');
const documentPreviewImage = document.querySelector('#document-preview-image');
const documentPreviewName = document.querySelector('#document-preview-name');
const changeDocumentButton = document.querySelector('#change-document');
const processingOverlay = document.querySelector('#processing-overlay');
const processingMessage = document.querySelector('#processing-message');
const openaiCameraButton = document.querySelector('#openai-camera-button');
const openaiCamera = document.querySelector('#openai-camera');
const openaiCameraVideo = document.querySelector('#openai-camera-video');
const cameraDevicePicker = document.querySelector('#camera-device-picker');
const cameraDeviceSelect = document.querySelector('#camera-device-select');
const cameraCanvas = document.querySelector('#camera-canvas');
const captureCameraButton = document.querySelector('#capture-camera');
const cancelCameraButton = document.querySelector('#cancel-camera');
const nativeCameraButton = document.querySelector('#native-camera-button');
const providerCredit = document.querySelector('#provider-credit');
const dataNote = document.querySelector('#data-note');
let activeProvider = 'openai';
let regulaReady = false;
let openaiPricing = null;
let openaiCameraStream = null;
let serverApiKeyConfigured = false;
let availableCameraDevices = [];
let activeRegulaLicense = '';

const defaultOpenAIPricing = {
  model: 'gpt-5.6-luna',
  inputUsdPerMillion: 1,
  cachedInputUsdPerMillion: 0.1,
  outputUsdPerMillion: 6,
  usdToMyr: 4.0651,
  configured: true,
};

function resetResults() {
  setProcessing(false);
  clearDocumentPreview();
  fullNameInput.value = '';
  identityNumberInput.value = '';
  renderUsageSummary();
  usageSummary.hidden = activeProvider !== 'openai';
  resultData.hidden = true;
  completed.hidden = true;
  resultEmpty.hidden = false;
  setStep(1);
}

function clearDocumentPreview() {
  documentPreview.hidden = true;
  documentPreviewImage.removeAttribute('src');
  documentPreviewName.textContent = '';
  readerFrame.classList.remove('has-preview');
}

function showDocumentPreview(source, label = 'Selected image') {
  if (!source) return;
  documentPreviewImage.src = source;
  documentPreviewName.textContent = label;
  documentPreview.hidden = false;
  readerComponent.hidden = true;
  readerPlaceholder.hidden = true;
  readerFrame.classList.add('has-preview');
}

function setProcessing(isProcessing, message = 'Extracting identity details…') {
  processingOverlay.hidden = !isProcessing;
  processingMessage.textContent = message;
  readerFrame.classList.toggle('is-processing', isProcessing);
  readerFrame.setAttribute('aria-busy', String(isProcessing));
}

function updateApiKeyVisibility() {
  openaiKeyConfig.hidden = activeProvider !== 'openai';
  regulaKeyConfig.hidden = activeProvider !== 'regula';
}

function hasOpenAICredentials() {
  if (openaiApiKeyInput.value.trim() || serverApiKeyConfigured) return true;
  openaiKeyConfig.hidden = false;
  openaiApiKeyInput.focus();
  setNotice('error', 'OpenAI API key required', 'Enter an API key above to process this document. It will be used for this session only.');
  return false;
}

function releaseOpenAICameraStream() {
  openaiCameraStream?.getTracks().forEach((track) => track.stop());
  openaiCameraStream = null;
  openaiCameraVideo.pause();
  openaiCameraVideo.srcObject = null;
}

function stopOpenAICamera(showPlaceholder = true) {
  releaseOpenAICameraStream();
  openaiCamera.hidden = true;
  readerFrame.classList.remove('is-camera-open');
  if (showPlaceholder && activeProvider === 'openai') readerPlaceholder.hidden = false;
}

function waitForCameraFrame(video, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();

    const checkFrame = () => {
      const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.videoWidth > 0
        && video.videoHeight > 0;
      if (hasFrame) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        reject(new DOMException('The camera did not provide a video frame.', 'NotReadableError'));
        return;
      }
      requestAnimationFrame(checkFrame);
    };

    checkFrame();
  });
}

async function connectOpenAICamera(videoConstraints) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });

  try {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
      throw new DOMException('The camera video track is not live.', 'NotReadableError');
    }
    openaiCameraVideo.muted = true;
    openaiCameraVideo.playsInline = true;
    openaiCameraVideo.srcObject = stream;
    await openaiCameraVideo.play();
    await waitForCameraFrame(openaiCameraVideo);
    return stream;
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    openaiCameraVideo.pause();
    openaiCameraVideo.srcObject = null;
    throw error;
  }
}

function cameraPreferenceScore(device) {
  const label = device.label.toLowerCase();
  let score = 0;
  if (/back|rear|environment/.test(label)) score += 80;
  if (/integrated|webcam|usb camera|facetime/.test(label)) score += 50;
  if (/virtual|screen|transscreen|obs|ndi|snap|camo|epoc/.test(label)) score -= 200;
  return score;
}

async function discoverCameraDevices() {
  const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  permissionStream.getTracks().forEach((track) => track.stop());
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .sort((left, right) => cameraPreferenceScore(right) - cameraPreferenceScore(left));
}

function renderCameraDevices(devices, selectedDeviceId = '') {
  cameraDeviceSelect.replaceChildren();
  devices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    option.selected = device.deviceId === selectedDeviceId;
    cameraDeviceSelect.append(option);
  });
  cameraDevicePicker.hidden = devices.length < 2;
}

async function connectFirstWorkingCamera(devices) {
  let lastError = null;
  const candidates = devices.length ? devices : [null];
  for (const device of candidates) {
    try {
      const constraints = device?.deviceId
        ? { deviceId: { exact: device.deviceId } }
        : true;
      const stream = await connectOpenAICamera(constraints);
      renderCameraDevices(devices, device?.deviceId || '');
      return stream;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new DOMException('No working camera was found.', 'NotFoundError');
}

async function startOpenAICamera() {
  if (activeProvider === 'openai' && !hasOpenAICredentials()) return;
  nativeCameraButton.hidden = true;
  if (!window.isSecureContext) {
    nativeCameraButton.hidden = false;
    setNotice('error', 'Secure connection required', 'Open this page on HTTPS or localhost, or use the device-camera option below.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    nativeCameraButton.hidden = false;
    setNotice('error', 'Camera unavailable', 'This browser does not support camera capture. Upload an image instead.');
    return;
  }

  try {
    openaiCameraButton.disabled = true;
    captureCameraButton.disabled = true;
    resetResults();
    readerPlaceholder.hidden = true;
    openaiCamera.hidden = false;
    readerFrame.classList.add('is-camera-open');
    setNotice('', 'Starting camera', 'Allow camera access if prompted. The preview will appear here.');
    availableCameraDevices = await discoverCameraDevices();
    openaiCameraStream = await connectFirstWorkingCamera(availableCameraDevices);
    captureCameraButton.disabled = false;
    nativeCameraButton.hidden = true;
    setNotice('ready', 'Camera ready', 'Place the document inside the frame, then press the capture button.');
  } catch (error) {
    stopOpenAICamera();
    nativeCameraButton.hidden = false;
    const permissionDenied = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name);
    const cameraBusy = ['NotReadableError', 'TrackStartError', 'AbortError'].includes(error?.name);
    const cameraMissing = ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(error?.name);
    setNotice(
      'error',
      permissionDenied
        ? 'Camera permission denied'
        : cameraBusy
          ? 'Camera is already in use'
          : cameraMissing
            ? 'No camera found'
            : 'Camera unavailable',
      permissionDenied
        ? 'Allow camera access for this site in your browser settings, then try again or use the device camera.'
        : cameraBusy
          ? 'Close other camera apps or tabs, then try again or use the device camera.'
          : cameraMissing
            ? 'Connect or enable a camera, or use the device-camera option below.'
            : 'The live camera could not start. Try the device-camera option below.',
    );
  } finally {
    openaiCameraButton.disabled = false;
  }
}

async function captureOpenAIPhoto() {
  const activeTrack = openaiCameraStream?.getVideoTracks?.()[0];
  const width = openaiCameraVideo.videoWidth;
  const height = openaiCameraVideo.videoHeight;
  if (!activeTrack || activeTrack.readyState !== 'live' || openaiCameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !width || !height) {
    setNotice('error', 'Camera is still starting', 'Wait a moment, then capture the document again.');
    return;
  }

  cameraCanvas.width = width;
  cameraCanvas.height = height;
  cameraCanvas.getContext('2d').drawImage(openaiCameraVideo, 0, 0, width, height);
  const photoBlob = await new Promise((resolve) => cameraCanvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!photoBlob) {
    setNotice('error', 'Capture failed', 'The camera image could not be created. Try again.');
    return;
  }

  stopOpenAICamera(false);
  const photoFile = new File([photoBlob], `document-${Date.now()}.jpg`, { type: 'image/jpeg' });
  if (activeProvider === 'openai') await processWithOpenAI(photoFile);
  else await processWithRegula(photoFile);
}

function setPlaceholder(title, message, buttonLabel, hint) {
  readerPlaceholder.querySelector('h3').textContent = title;
  readerPlaceholder.querySelector('p').textContent = message;
  reopenReaderButton.innerHTML = `<span>↑</span> ${buttonLabel}`;
  readerPlaceholder.querySelector('small').textContent = hint;
}

function selectProvider(provider) {
  stopOpenAICamera(false);
  activeProvider = provider;
  resetResults();
  providerOptions.forEach((option) => {
    const selected = option.dataset.provider === provider;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });

  const useOpenAI = provider === 'openai';
  providerCredit.textContent = useOpenAI ? 'OpenAI' : 'Regula';
  readerFrame.classList.toggle('is-openai', useOpenAI);
  readerFrame.classList.remove('is-closed');

  if (useOpenAI) {
    readerComponent.hidden = true;
    readerPlaceholder.hidden = false;
    reopenReaderButton.disabled = false;
    openaiCameraButton.hidden = false;
    nativeCameraButton.hidden = true;
    readerFrame.setAttribute('aria-busy', 'false');
    setPlaceholder('Choose your document', 'OpenAI will extract the identity details', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
    setNotice('', 'OpenAI OCR selected', 'Upload a document image to extract its identity details.');
    dataNote.lastChild.textContent = ' Document image is sent to OpenAI for extraction';
  } else {
    openaiCameraButton.hidden = false;
    nativeCameraButton.hidden = true;
    readerComponent.hidden = true;
    readerPlaceholder.hidden = false;
    reopenReaderButton.disabled = false;
    dataNote.lastChild.textContent = ' Your data is processed securely in your browser';
    if (regulaReady) {
      setPlaceholder('Choose your document', 'Regula will extract the identity details', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
      setNotice('ready', 'Regula OCR selected', 'Upload or capture a document image to extract its identity details.');
    } else {
      setPlaceholder('Choose your document', 'A Regula license is required before processing', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
      setNotice('error', 'Document reader needs a license', 'Add VITE_REGULA_LICENSE to a local .env file, or configure domain licensing for this host.');
    }
  }
  updateApiKeyVisibility();
}

function closeReader() {
  readerComponent.hidden = true;
  readerPlaceholder.hidden = false;
  readerFrame.classList.add('is-closed');
  readerPlaceholder.querySelector('h3').textContent = 'Document reader closed';
  readerPlaceholder.querySelector('p').textContent = 'Open it again when you’re ready to continue';
  reopenReaderButton.innerHTML = '<span>↗</span> Open document reader';
  reopenReaderButton.disabled = false;
  setNotice('', 'Document reader closed', 'No document is being captured or processed.');
}

function openReader() {
  readerComponent.hidden = false;
  readerPlaceholder.hidden = true;
  readerFrame.classList.remove('is-closed');
  reopenReaderButton.disabled = true;
  setNotice('ready', 'Ready to scan', 'Select an ID card or driving license to begin.');
}

function setNotice(type, title, message) {
  notice.className = `notice ${type ? `notice--${type}` : ''}`;
  notice.querySelector('.notice-icon').textContent = type === 'error' ? '!' : type === 'ready' ? '✓' : 'i';
  notice.querySelector('strong').textContent = title;
  notice.querySelector('p').textContent = message;
}

function setStep(activeStep) {
  document.querySelectorAll('.step').forEach((step) => {
    const number = Number(step.dataset.step);
    step.classList.toggle('is-active', number === activeStep);
    step.classList.toggle('is-complete', number < activeStep);
  });
  document.querySelectorAll('.step-line').forEach((line, index) => {
    line.classList.toggle('is-complete', index + 1 < activeStep);
  });
}

function collectTextFields(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextFields(item, output));
    return output;
  }

  const fieldName = value.fieldName || value.FieldName || value.name || value.typeName;
  const fieldValue = value.value || value.Value || value.valueFormatted || value.valueOriginal;
  if (typeof fieldName === 'string' && typeof fieldValue === 'string' && fieldValue.trim()) {
    output.push({ name: fieldName.toLowerCase(), value: fieldValue.trim() });
  }

  Object.values(value).forEach((item) => collectTextFields(item, output));
  return output;
}

function findField(fields, candidates) {
  const exact = fields.find((field) => candidates.some((name) => field.name === name));
  const partial = fields.find((field) => candidates.some((name) => field.name.includes(name)));
  return (exact || partial)?.value || '';
}

function extractIdentity(response) {
  const text = response?.text;
  if (text?.getFieldValue) {
    const combinedName = text.getFieldValue(TextFieldType.SURNAME_AND_GIVEN_NAMES);
    const surname = text.getFieldValue(TextFieldType.SURNAME);
    const givenNames = text.getFieldValue(TextFieldType.GIVEN_NAMES);
    const name = combinedName || [givenNames, surname].filter(Boolean).join(' ');
    const identityNumber =
      text.getFieldValue(TextFieldType.PERSONAL_NUMBER) ||
      text.getFieldValue(TextFieldType.DOCUMENT_NUMBER);

    if (name || identityNumber) return { name: name || '', identityNumber: identityNumber || '' };
  }

  const fields = collectTextFields(response);
  const name = findField(fields, [
    'surname and given names', 'full name', 'surname_and_given_names',
    'given names', 'name', 'holder name',
  ]);
  const identityNumber = findField(fields, [
    'personal number', 'personal_number', 'identity number', 'identity_number',
    'document number', 'document_number', 'license number', 'licence number', 'id number',
  ]);
  return { name, identityNumber };
}

function showResults(response) {
  const previewField = response?.images?.getField?.(GraphicFieldType.DOCUMENT_FRONT)
    || response?.images?.getField?.(GraphicFieldType.DOCUMENT_REAR);
  const previewBase64 = previewField?.valueList?.find((item) => item?.value)?.value;
  if (previewBase64) {
    const previewSource = previewBase64.startsWith('data:image/')
      ? previewBase64
      : `data:image/jpeg;base64,${previewBase64}`;
    showDocumentPreview(previewSource, 'Captured document');
  }

  const { name, identityNumber } = extractIdentity(response);
  showIdentityResults(name, identityNumber);
}

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(4)}` : '—';
}

function renderUsageSummary(usage = null) {
  const pricing = usage?.pricing || openaiPricing;
  usageModel.textContent = usage?.model || pricing?.model || 'gpt-5.6-luna';
  usageInput.textContent = Number(usage?.inputTokens || 0).toLocaleString();
  usageCached.textContent = Number(usage?.cachedInputTokens || 0).toLocaleString();
  usageOutput.textContent = Number(usage?.outputTokens || 0).toLocaleString();
  usageTotal.textContent = Number(usage?.totalTokens || 0).toLocaleString();
  usageCost.textContent = usage?.pricingConfigured
    ? `RM ${Number(usage.estimatedCostMyr).toFixed(4)}`
    : 'Not configured';
  usageUsd.textContent = usage?.pricingConfigured
    ? `USD $${Number(usage.estimatedCostUsd).toFixed(4)}`
    : '';
  usageRates.textContent = pricing
    ? `Per 1M tokens · input ${formatRate(pricing.inputUsdPerMillion)} · cached ${formatRate(pricing.cachedInputUsdPerMillion || pricing.inputUsdPerMillion)} · output ${formatRate(pricing.outputUsdPerMillion)}`
    : 'Loading configured rates…';
  usagePricingNote.textContent = usage?.pricingConfigured
    ? `Estimated using USD 1 = RM ${Number(pricing.usdToMyr).toFixed(4)}. Reasoning tokens: ${Number(usage.reasoningTokens || 0).toLocaleString()}.`
    : 'Set the current token rates and USD_TO_MYR in .env; usage totals update after a successful scan.';
}

async function loadOpenAIPricing() {
  try {
    const response = await fetch('/api/openai-pricing');
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) throw new Error('Pricing backend unavailable');
    openaiPricing = await response.json();
    serverApiKeyConfigured = Boolean(openaiPricing.apiKeyConfigured);
    updateApiKeyVisibility();
    if (activeProvider === 'openai') renderUsageSummary();
  } catch {
    openaiPricing = defaultOpenAIPricing;
    serverApiKeyConfigured = false;
    updateApiKeyVisibility();
    if (activeProvider === 'openai') renderUsageSummary();
  }
}

function showIdentityResults(name, identityNumber, usage = null) {
  fullNameInput.value = name;
  identityNumberInput.value = identityNumber;
  resultEmpty.hidden = true;
  completed.hidden = true;
  resultData.hidden = false;
  setStep(2);

  usageSummary.hidden = activeProvider !== 'openai';
  renderUsageSummary(usage);

  if (!name && !identityNumber) {
    setNotice('error', 'Details need your review', 'The document was processed, but the requested fields were not found. Enter them manually.');
  } else {
    setNotice('ready', 'Document processed', 'Please review the extracted details before confirming.');
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function summarizeOpenAIUsage(result) {
  const pricing = openaiPricing || defaultOpenAIPricing;
  const inputTokens = Number(result.usage?.input_tokens) || 0;
  const cachedInputTokens = Number(result.usage?.input_tokens_details?.cached_tokens) || 0;
  const outputTokens = Number(result.usage?.output_tokens) || 0;
  const reasoningTokens = Number(result.usage?.output_tokens_details?.reasoning_tokens) || 0;
  const totalTokens = Number(result.usage?.total_tokens) || inputTokens + outputTokens;
  const pricingConfigured = Boolean(
    pricing.inputUsdPerMillion && pricing.outputUsdPerMillion && pricing.usdToMyr,
  );
  let estimatedCostUsd = null;
  let estimatedCostMyr = null;

  if (pricingConfigured) {
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    estimatedCostUsd = (uncachedInputTokens / 1_000_000) * pricing.inputUsdPerMillion
      + (cachedInputTokens / 1_000_000)
        * (pricing.cachedInputUsdPerMillion || pricing.inputUsdPerMillion)
      + (outputTokens / 1_000_000) * pricing.outputUsdPerMillion;
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
    pricingConfigured,
    pricing,
  };
}

async function processOpenAIDirectly(imageDataUrl, apiKey) {
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 45_000,
    maxRetries: 1,
  });
  const result = await openai.responses.create({
    model: openaiPricing?.model || defaultOpenAIPricing.model,
    reasoning: { effort: 'none' },
    store: false,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: 'Read this identity card or driving license. Return the holder full name and the primary identity, personal, or document number exactly as printed. Use empty strings when a value cannot be read.',
        },
        { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
      ],
    }],
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
  return {
    name: extracted.full_name,
    identityNumber: extracted.identity_number,
    documentType: extracted.document_type,
    usage: summarizeOpenAIUsage(result),
  };
}

async function requestOpenAIOCR(imageDataUrl, manualApiKey) {
  let response;
  try {
    response = await fetch('/api/openai-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(manualApiKey ? { 'X-OpenAI-API-Key': manualApiKey } : {}),
      },
      body: JSON.stringify({ imageDataUrl, ...(manualApiKey ? { apiKey: manualApiKey } : {}) }),
    });
  } catch {
    if (manualApiKey) return processOpenAIDirectly(imageDataUrl, manualApiKey);
    throw new Error('The OCR backend is unavailable. Enter an OpenAI API key above or deploy the Node server with `npm start`.');
  }

  const contentType = response.headers.get('content-type') || '';
  const backendUnavailable = response.status === 404 || !contentType.includes('application/json');
  if (backendUnavailable) {
    if (manualApiKey) return processOpenAIDirectly(imageDataUrl, manualApiKey);
    throw new Error('The OCR backend is not deployed. Enter an OpenAI API key above or host the Node server with `npm start`.');
  }

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'OpenAI OCR failed.');
  return payload;
}

async function processWithOpenAI(file) {
  if (!file) return;
  if (!hasOpenAICredentials()) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    setNotice('error', 'Unsupported file type', 'OpenAI mode accepts JPG, PNG, or WebP images.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setNotice('error', 'File is too large', 'Choose an image smaller than 10 MB.');
    return;
  }

  try {
    resetResults();
    reopenReaderButton.disabled = true;
    const imageDataUrl = await fileToDataUrl(file);
    showDocumentPreview(imageDataUrl, file.name);
    setProcessing(true, 'OpenAI is reading the uploaded image…');
    setPlaceholder('Reading your document', 'OpenAI is extracting the identity details', 'Processing…', file.name);
    setNotice('', 'Reading with OpenAI', 'Keep this page open while the image is processed.');

    const manualApiKey = openaiApiKeyInput.value.trim();
    const payload = await requestOpenAIOCR(imageDataUrl, manualApiKey);

    showIdentityResults(payload.name || '', payload.identityNumber || '', payload.usage || null);
    setPlaceholder('Choose another document', 'Upload a new image to replace these results', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
  } catch (error) {
    setNotice('error', 'OpenAI OCR failed', error.message || 'Try a clearer image.');
    setPlaceholder('Try another document', 'Use a clear image with all four corners visible', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
  } finally {
    setProcessing(false);
    reopenReaderButton.disabled = false;
    openaiFileInput.value = '';
  }
}

async function processWithRegula(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    setNotice('error', 'Unsupported file type', 'Regula mode accepts JPG, PNG, or WebP images.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setNotice('error', 'File is too large', 'Choose an image smaller than 10 MB.');
    return;
  }

  try {
    resetResults();
    const imageDataUrl = await fileToDataUrl(file);
    showDocumentPreview(imageDataUrl, file.name);
    const manualLicense = regulaLicenseInput.value.trim();
    const configuredLicense = import.meta.env.VITE_REGULA_LICENSE?.trim() || '';
    const requestedLicense = manualLicense || configuredLicense;
    if (!requestedLicense) {
      setNotice('error', 'Regula license required', 'Enter a Regula license above or configure VITE_REGULA_LICENSE.');
      return;
    }
    if (!regulaReady || !window.RegulaDocumentSDK || activeRegulaLicense !== requestedLicense) {
      setProcessing(true, 'Initializing Regula with the selected license…');
      const initialized = await initializeReader(manualLicense, false);
      if (!initialized) {
        setNotice('error', 'Regula license rejected', 'Check the entered license, or clear the field to use VITE_REGULA_LICENSE.');
        return;
      }
    }
    setProcessing(true, 'Regula is reading the selected image…');
    setNotice('', 'Reading with Regula', 'Keep this page open while the image is processed.');
    const response = await window.RegulaDocumentSDK.processImage([await file.arrayBuffer()]);
    showResults(response);
  } catch (error) {
    console.error('Regula image processing failed:', error);
    setNotice('error', 'Regula OCR failed', 'Try a clearer image with all four corners visible.');
  } finally {
    setProcessing(false);
    regulaFileInput.value = '';
  }
}

async function initializeReader(licenseOverride = '', updateChooser = true) {
  const configuredLicense = import.meta.env.VITE_REGULA_LICENSE?.trim() || '';
  const license = licenseOverride.trim() || configuredLicense;
  try {
    try {
      window.RegulaDocumentSDK?.shutdown?.();
    } catch {
      // A failed or partial initialization may not have a running worker to shut down.
    }
    window.RegulaDocumentSDK = new DocumentReaderService();
    const processOptions = { processParam: { scenario: 'FullProcess' } };
    window.RegulaDocumentSDK.recognizerProcessParam = processOptions;
    window.RegulaDocumentSDK.imageProcessParam = processOptions;

    await defineComponents();
    await window.RegulaDocumentSDK.initialize(license ? { license } : undefined);

    regulaReady = true;
    activeRegulaLicense = license;
    readerFrame.setAttribute('aria-busy', 'false');
    readerFrame.classList.remove('has-error');
    readerFrame.classList.add('is-ready');
    if (updateChooser && activeProvider === 'regula') {
      readerComponent.hidden = true;
      readerPlaceholder.hidden = false;
      reopenReaderButton.disabled = false;
      openaiCameraButton.hidden = false;
      setPlaceholder('Choose your document', 'Regula will extract the identity details', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
      setNotice('ready', 'Regula OCR selected', 'Upload or capture a document image to extract its identity details.');
    }
    return true;
  } catch (error) {
    console.error('Regula initialization failed:', error);
    regulaReady = false;
    activeRegulaLicense = '';
    readerFrame.setAttribute('aria-busy', 'false');
    readerFrame.classList.add('has-error');
    if (updateChooser && activeProvider === 'regula') {
      readerComponent.hidden = true;
      readerPlaceholder.hidden = false;
      reopenReaderButton.disabled = false;
      openaiCameraButton.hidden = false;
      setNotice('error', 'Document reader needs a license', 'Add VITE_REGULA_LICENSE to a local .env file, or configure domain licensing for this host.');
    }
    return false;
  }
}

readerComponent.addEventListener('document-reader', (event) => {
  const { action, data } = event.detail || {};
  if (action === 'CLOSE') {
    setProcessing(false);
    closeReader();
    return;
  }
  if (action === 'CAMERA_PROCESS_CLOSED') {
    setProcessing(false);
    setNotice('ready', 'Capture cancelled', 'Choose a document source when you’re ready to try again.');
    return;
  }
  if (action === 'CAMERA_PROCESS_STARTED') {
    setProcessing(true, 'Capturing and reading your document…');
  }
  if (action === 'FILE_PROCESS_STARTED') {
    setProcessing(true, 'Reading the selected document…');
    setNotice('', 'Reading your document', 'Keep this page open while the details are extracted.');
  }
  if (action === 'PROCESS_FINISHED') {
    setProcessing(false);
    if (data?.status === 1 && data.response) {
      showResults(data.response);
    } else {
      const reason = data?.reason ? ` (${data.reason})` : '';
      setNotice('error', 'We couldn’t read that document', `Try a clearer image with all four corners visible${reason}.`);
    }
  }
});

providerOptions.forEach((option) => {
  option.addEventListener('click', () => selectProvider(option.dataset.provider));
});

reopenReaderButton.addEventListener('click', () => {
  if (activeProvider === 'openai') {
    if (hasOpenAICredentials()) openaiFileInput.click();
  }
  else regulaFileInput.click();
});

changeDocumentButton.addEventListener('click', () => {
  stopOpenAICamera(false);
  resetResults();
  readerComponent.hidden = true;
  readerPlaceholder.hidden = false;
  if (activeProvider === 'openai') {
    setPlaceholder('Choose your document', 'OpenAI will extract the identity details', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
    setNotice('', 'OpenAI OCR selected', 'Upload or capture a document image when you’re ready.');
  } else {
    if (regulaReady) {
      setPlaceholder('Choose your document', 'Regula will extract the identity details', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
      setNotice('ready', 'Regula OCR selected', 'Upload or capture a document image when you’re ready.');
    } else {
      setPlaceholder('Choose your document', 'A Regula license is required before processing', 'Select image', 'JPG, PNG or WebP · Maximum 10 MB');
      setNotice('error', 'Document reader needs a license', 'You can choose an image first; the license error will appear after it loads.');
    }
  }
});

openaiCameraButton.addEventListener('click', startOpenAICamera);
nativeCameraButton.addEventListener('click', () => openaiCameraFileInput.click());
captureCameraButton.addEventListener('click', captureOpenAIPhoto);
cameraDeviceSelect.addEventListener('change', async () => {
  const selectedDevice = availableCameraDevices.find((device) => device.deviceId === cameraDeviceSelect.value);
  if (!selectedDevice) return;
  captureCameraButton.disabled = true;
  setNotice('', 'Switching camera', `Starting ${selectedDevice.label || 'the selected camera'}…`);
  releaseOpenAICameraStream();
  try {
    openaiCameraStream = await connectOpenAICamera({ deviceId: { exact: selectedDevice.deviceId } });
    captureCameraButton.disabled = false;
    setNotice('ready', 'Camera ready', `${selectedDevice.label || 'Selected camera'} is active.`);
  } catch (error) {
    nativeCameraButton.hidden = false;
    setNotice('error', 'Selected camera unavailable', 'Choose another camera or use the device-camera option.');
  }
});
cancelCameraButton.addEventListener('click', () => {
  stopOpenAICamera();
  setNotice('', 'Camera closed', 'Capture a photo or upload a document image when you’re ready.');
});

openaiFileInput.addEventListener('change', () => processWithOpenAI(openaiFileInput.files?.[0]));
regulaFileInput.addEventListener('change', () => processWithRegula(regulaFileInput.files?.[0]));
openaiCameraFileInput.addEventListener('change', () => {
  const file = openaiCameraFileInput.files?.[0];
  openaiCameraFileInput.value = '';
  if (activeProvider === 'openai') processWithOpenAI(file);
  else processWithRegula(file);
});

confirmButton.addEventListener('click', () => {
  if (!fullNameInput.value.trim() || !identityNumberInput.value.trim()) {
    setNotice('error', 'Complete both fields', 'Enter the name and identity number exactly as shown on the document.');
    return;
  }
  resultData.hidden = true;
  completed.hidden = false;
  setStep(3);
  setNotice('ready', 'Verification complete', 'The identity details have been confirmed.');
});

startOverButton.addEventListener('click', () => {
  resetResults();
  if (activeProvider === 'openai') {
    readerPlaceholder.hidden = false;
    setNotice('', 'OpenAI OCR selected', 'Upload another document image when you’re ready.');
  } else {
    readerPlaceholder.hidden = false;
    setNotice('ready', 'Regula OCR selected', 'Upload or capture another document image when you’re ready.');
  }
});

selectProvider('openai');
initializeReader();
loadOpenAIPricing();
