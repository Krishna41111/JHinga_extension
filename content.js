// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    try {
      const data = extractCRMData();
      if (data.length > 0) {
        const tsv = formatAsTSV(data);
        copyToClipboard(tsv);
        sendResponse({ success: true, data });
      } else {
        sendResponse({ success: false });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      sendResponse({ success: false });
    }
  }
  return true; // Keep message channel open for async response
});

function extractCRMData() {
  // Access nested frames: Top middle frame (index 1), then its rightframe (index 1)
  let doc;
  try {
    doc = window.frames[1]?.frames[1]?.document;
    if (!doc) throw new Error('Frame not accessible');
  } catch (e) {
    console.error('Frame access failed:', e);
    throw new Error('Page structure mismatch');
  }

  // Extract Name
  const nameInput = doc.querySelector('input[name="name"]');
  const name = nameInput ? nameInput.value.trim() : '';

  // Extract Mobile
  const mobileInput = doc.querySelector('input[name="mobile"]');
  const mobile = mobileInput ? mobileInput.value.trim() : '';

  // Extract Model: Shorten before first '-'
  const modelInput = doc.querySelector('input[name="modelShow"]');
  let model = '';
  if (modelInput) {
    const fullModel = modelInput.value.trim();
    model = fullModel.split('-')[0].trim();
  }

  // Extract Call ID: Find <td class="field"> with MH + digits pattern
  let callId = '';
  const fieldTds = doc.querySelectorAll('td.field');
  for (const td of fieldTds) {
    const text = td.textContent.trim().replace(/\xa0/g, ' ');
    const match = text.match(/MH\d{11}/);
    if (match) {
      callId = match[0];
      break;
    }
  }

  // Return as array of objects (for multi-row if needed, but single for now)
  return [{ Name: name, Mobile: mobile, Model: model, 'Call ID': callId }];
}

function formatAsTSV(data) {
  const headers = Object.keys(data[0]);
  let tsv = headers.join('\t') + '\n';
  data.forEach(row => {
    tsv += headers.map(header => row[header] || '').join('\t') + '\n';
  });
  return tsv;
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}