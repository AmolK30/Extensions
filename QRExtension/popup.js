/**
 * Current Tab QR Code - popup.js
 * Fetches the active tab URL and renders a scannable QR code.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const qrContainer = document.getElementById('qrcode');
  const loadingElement = document.getElementById('loading');
  const tabUrlElement = document.getElementById('tab-url');
  const errorMessageElement = document.getElementById('error-message');
  const errorTextElement = document.getElementById('error-text');
  const copyBtn = document.getElementById('copy-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const downloadBtn = document.getElementById('download-btn');

  let currentTabUrl = '';

  /**
   * Display an error message and disable actions
   * @param {string} message
   */
  function showError(message) {
    loadingElement.classList.add('hidden');
    errorMessageElement.classList.remove('hidden');
    errorTextElement.textContent = message;
    tabUrlElement.textContent = 'Unavailable';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
  }

  /**
   * Generates a QR Code inside the container
   * @param {string} url
   */
  function generateQRCode(url) {
    qrContainer.innerHTML = '';

    // Render using QRCode.js (local library)
    new QRCode(qrContainer, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    loadingElement.classList.add('hidden');
  }

  // 1. Fetch the active tab's URL using Chrome Tabs API
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      // Local preview fallback (e.g. testing popup.html directly in a browser)
      currentTabUrl = window.location.href;
      tabUrlElement.textContent = currentTabUrl;
      tabUrlElement.title = currentTabUrl;
      generateQRCode(currentTabUrl);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      showError('Unable to access tab URL (e.g., protected browser page).');
      return;
    }

    currentTabUrl = tab.url;
    tabUrlElement.textContent = currentTabUrl;
    tabUrlElement.title = currentTabUrl;

    // 2. Generate the QR code
    generateQRCode(currentTabUrl);
  } catch (error) {
    console.error('Error fetching tab URL:', error);
    showError('Failed to read the active tab URL.');
    return;
  }

  // 3. Event Listener: Copy URL to clipboard
  copyBtn.addEventListener('click', async () => {
    if (!currentTabUrl) return;

    try {
      await navigator.clipboard.writeText(currentTabUrl);
      const originalText = copyBtnText.textContent;
      copyBtnText.textContent = 'Copied! ✓';
      copyBtn.classList.add('btn-primary');
      copyBtn.classList.remove('btn-secondary');

      setTimeout(() => {
        copyBtnText.textContent = originalText;
        copyBtn.classList.remove('btn-primary');
        copyBtn.classList.add('btn-secondary');
      }, 1500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  });

  // 4. Event Listener: Download QR code as PNG image
  downloadBtn.addEventListener('click', () => {
    if (!currentTabUrl) return;

    // QRCode.js renders into either a <canvas> or an <img> (depending on browser/Android quirks)
    const sourceCanvas = qrContainer.querySelector('canvas');
    const sourceImg   = qrContainer.querySelector('img');

    // Export size and quiet zone (QR spec requires ≥4 modules of white border on each side)
    const EXPORT_SIZE  = 512;   // Final PNG width & height in px
    const QUIET_ZONE   = 48;    // White border in px (≈4 modules at this scale)
    const QR_SIZE      = EXPORT_SIZE - QUIET_ZONE * 2; // 416×416 for the code itself

    // Create an off-screen canvas with the quiet zone baked in
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width  = EXPORT_SIZE;
    outputCanvas.height = EXPORT_SIZE;
    const ctx = outputCanvas.getContext('2d');

    // 1. White background (quiet zone)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    // 2. Draw QR code centred inside the quiet zone
    if (sourceCanvas) {
      ctx.drawImage(sourceCanvas, QUIET_ZONE, QUIET_ZONE, QR_SIZE, QR_SIZE);
    } else if (sourceImg && sourceImg.src && sourceImg.src.startsWith('data:image')) {
      // <img> path: draw via an Image object so we can scale it
      const tmpImg = new Image();
      tmpImg.onload = () => {
        ctx.drawImage(tmpImg, QUIET_ZONE, QUIET_ZONE, QR_SIZE, QR_SIZE);
        triggerDownload(outputCanvas.toDataURL('image/png'));
      };
      tmpImg.src = sourceImg.src;
      return; // download triggered inside onload
    } else {
      console.warn('QR code image not ready for download.');
      return;
    }

    triggerDownload(outputCanvas.toDataURL('image/png'));
  });

  /** Trigger a PNG file download from a data URL */
  function triggerDownload(dataUrl) {
    const link = document.createElement('a');
    link.href     = dataUrl;
    link.download = 'tab-qr-code.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
