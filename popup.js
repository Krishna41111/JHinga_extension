// popup.js (final - accurate Purchase Channel detection, everything else same)
(() => {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('copyBtn');
  const preview = document.getElementById('preview');

  const PRODUCT_MAP = {
    "HD4929/01": "Induction Cooker",
    "GC362/80": "Dry Steam Iron",
    "GC1905/21": "Dry Iron",
    "HD4938/01": "Induction Cooker",
    "HL7756/00": "Mixer Grinder",
    "HR3705/10": "Hand Mixer",
    "HR7627/00": "Food Processor",
    "HP8100/46": "Hair Dryer",
    "BHD007/20": "Hair Dryer",
    "HP8142/00": "Hair Straightener",
    "HD9216/43": "Air Fryer",
    "HD9218/00": "Air Fryer",
    "GC1440/20": "Steam Iron",
    "GC1903/30": "Dry Iron",
    "HR1351/90": "Hand Blender",
    "HR1600/00": "Hand Blender",
    "HR1863/20": "Juicer",
    "HR1855/00": "Juicer",
    "HR2116/00": "Blender",
    "HR2771/00": "Citrus Juicer",
    "HD4936/00": "Induction Cooker",
    "HD4928/01": "Induction Cooker",
    "HR3745/00": "Mixer Grinder",
    "GC2040/70": "Steam Iron",
    "GC1920/20": "Dry Iron",
    "HD4929/00": "Induction Cooker"
  };

  const REGION_MAP = {
    "Uttar Pradesh & Uttarakhand": "North",
    "Gujarat": "West",
    "Karnataka, Telangana & Andhra": "South",
    "Mumbai, ROM1 & Goa": "West",
    "West Bengal & NE": "East",
    "Greater Punjab": "North",
    "Tamil Nadu & Kerala": "South",
    "Delhi & NCR": "North",
    "Bihar, Odisha & Jharkhand": "East",
    "Haryana & Rajasthan": "North",
    "Mpcg & Rom2": "West"
  };

  let PINCODE_MAP = null;
  let pinLoadState = 'not-started';

  const headers = [
    "SR Number", "Escalation Type", "Case history", "Channel", "Reason of Escalation by consumer",
    "Source of Escalation (Previous Channel)", "Source of Email", "Escalation Date", "Consumer Name",
    "Consumer Phone", "Mail ID", "Product Name", "Product Category", "NCH Request", "Service Request Number",
    "Warranty Status", "Date of purchase ", "Geography (Local/ Upcountry)", "Home Service (Yes/No)",
    "Purchase Channel", "Service Request Date", "Service Request Closure Date", "Escalation Closure Date",
    "ASC Code", "ASC Name", "Branch", "Region", "Consumer VOC", "Case History2",
    "Reason of Escalation by CC", "Root Cause 1", "Root Cause 2", "Consumer Expectation",
    "Resolution Offered", "Final Status", "CSAT", "Aging (Days)", "Aging Bucket", "Month",
    "Responsible for Escalation", "Profile of Person", "Type", "Spare Parts Code required",
    "Consumer Feedback for the below 3 Rating", "Name"
  ];

  const log = (...a) => console.debug('[popup.js]', ...a);
  const setStatus = txt => { if (statusEl) statusEl.textContent = txt; log(txt); };

  async function loadPinMap() {
    try {
      pinLoadState = 'loading';
      const url = chrome.runtime.getURL('pincode_map.json');
      const res = await fetch(url);
      PINCODE_MAP = await res.json();
      pinLoadState = 'loaded';
      log('✅ Pincode map loaded:', Object.keys(PINCODE_MAP).length);
    } catch (e) {
      pinLoadState = 'failed';
      console.error('❌ Pincode map load error:', e);
    }
  }

  function chooseBestResult(results) {
    let best = null, score = -1;
    for (const res of results) {
      const r = res?.result || res;
      if (!r || !r.found) continue;
      const s = ['Consumer Name', 'Consumer Phone', 'Product Name', 'Pincode'].filter(k => r[k]).length;
      if (s > score) { score = s; best = r; }
    }
    return best;
  }

  async function queryAndPrepare() {
    try {
      setStatus('Extracting data...');
      btn.disabled = true;
      preview.textContent = '—';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: extractFromDocument,
        args: [PRODUCT_MAP]
      });

      const best = chooseBestResult(execResults);
      if (!best) return setStatus('⚠️ No valid data found.');

      if (best['Pincode'] && PINCODE_MAP?.[best['Pincode']]) {
        const info = PINCODE_MAP[best['Pincode']];
        best['ASC Code'] = info['ASC Code'] || '';
        best['ASC Name'] = info['ASC Name'] || '';
        best['Branch'] = info['Branch'] || '';
        best['Region'] = REGION_MAP[info['Branch']] || info['Region'] || '';
      }

      const row = headers.map(h => best[h] || '').join('\t');
      const tsv = row + '\n';
      preview.textContent = row.replace(/\t/g, ' | ');
      btn.dataset.tsv = tsv;
      btn.disabled = false;
      setStatus('✅ Ready — click Copy');
      console.log('✅ Extracted:', best);
    } catch (err) {
      console.error('❌ Extraction Error:', err);
      setStatus('❌ Error: ' + err.message);
    }
  }

  function extractFromDocument(PRODUCT_MAP_PARAM) {
    try {
      const norm = s => (s || '').toString().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      const out = { found: false };

      Object.assign(out, {
        "Escalation Type": "Escalation by CC",
        "Case history": "Existing",
        "Channel": "Phone",
        "Reason of Escalation by consumer": "Service Delay",
        "Source of Escalation (Previous Channel)": "Phone",
        "Final Status": "open",
        "Responsible for Escalation": "ASC",
        "Profile of Person": "technician",
        "Type": "Service related",
        "Name": "krishna",
        "Reason of Escalation by CC": "Service delay",
        "Root Cause 1": "Service delay",
        "Root Cause 2": "Service delay",
        "Consumer Expectation": "Repair services"
      });

      let consumerName = '', consumerPhone = '', productName = '', purchaseDate = '',
          warrantyStatus = '', geography = '', homeService = '', purchaseChannel = 'Other Ecom',
          pincode = '', serviceRequestDate = '';

      const nameInput = document.querySelector('input[name="name"]');
      if (nameInput) consumerName = norm(nameInput.value);
      const mobileInput = document.querySelector('input[name="mobile"]');
      if (mobileInput) consumerPhone = norm(mobileInput.value);

      const modelInput = document.querySelector('input[name="modelShow"]');
      if (modelInput) {
        const full = norm(modelInput.value);
        const id = full.split('-')[0].trim();
        productName = id || full;
      }

      const d = document.querySelector('input[name="purchaseDay"]');
      const m = document.querySelector('input[name="purchaseMonth"]');
      const y = document.querySelector('input[name="purchaseYear"]');
      if (d && m && y) {
        const dd = d.value.padStart(2, '0');
        const mm = m.value.padStart(2, '0');
        const yyyy = y.value;
        purchaseDate = `${mm}/${dd}/${yyyy}`;
        const diff = (new Date() - new Date(`${yyyy}-${mm}-${dd}`)) / (1000 * 60 * 60 * 24 * 365.25);
        warrantyStatus = diff <= 2 ? 'In-Warranty' : 'Out-Of-Warranty';
      }

      const pinInput = document.querySelector('input[name="zipCode"], input#zipCode');
      if (pinInput && norm(pinInput.value)) pincode = norm(pinInput.value);
      out['Pincode'] = pincode;

      try {
        const geoEl = Array.from(document.querySelectorAll('td.field')).find(td =>
          /(Local|Upcountry)/i.test(td.innerText || '')
        );
        if (geoEl) {
          const match = geoEl.innerText.match(/(Local|Upcountry)/i);
          if (match) geography = match[1];
          homeService = /Home Service/i.test(geoEl.innerText) ? 'Yes' : 'No';
        }
      } catch {}
      out['Geography (Local/ Upcountry)'] = geography;
      out['Home Service (Yes/No)'] = homeService;

      // ✅ FIXED: smart Purchase Channel detection
      try {
        const pageText = document.body ? document.body.innerText.toLowerCase() : '';
        if (/\b(r\s*-\s*)?dealer(?! counter)/i.test(pageText)) {
          purchaseChannel = 'Dealer';
        } else if (/amazon|flipkart|croma|reliance|tatacliq|vijaysales/.test(pageText)) {
          purchaseChannel = 'Online';
        } else {
          purchaseChannel = 'Other Ecom';
        }
      } catch {}
      out['Purchase Channel'] = purchaseChannel;

      const sr = Array.from(document.querySelectorAll('td.field[nowrap], td.field')).find(td =>
        /\d{2}\/\d{2}\/\d{4}/.test(td.innerText)
      );
      if (sr) {
        const match = sr.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) serviceRequestDate = `${match[2]}/${match[1]}/${match[3]}`;
      }
      out['Service Request Date'] = serviceRequestDate;

      let serviceReq = '';
      const callIdLabel = Array.from(document.querySelectorAll('td.label')).find(td =>
        /(call\s*id|main\s*call\s*id)/i.test(td.innerText || '')
      );
      if (callIdLabel) {
        const nextField = callIdLabel.nextElementSibling;
        if (nextField && nextField.classList.contains('field')) {
          serviceReq = (nextField.innerText || '').replace(/\u00A0/g, ' ').trim();
        }
      }
      if (!serviceReq) {
        const txt = document.body.innerText;
        const m = txt.match(/\b[A-Z]{2}\d{10,12}\b/);
        if (m) serviceReq = m[0];
      }
      if (serviceReq) {
        out['Service Request Number'] = serviceReq;
        out['SR Number'] = serviceReq;
      }

      out['Product Category'] = PRODUCT_MAP_PARAM[productName] || '';
      out['Consumer Name'] = consumerName;
      out['Consumer Phone'] = consumerPhone;
      out['Product Name'] = productName;
      out['Date of purchase '] = purchaseDate;
      out['Warranty Status'] = warrantyStatus;

      const now = new Date();
      const mm2 = String(now.getMonth() + 1).padStart(2, '0');
      const dd2 = String(now.getDate()).padStart(2, '0');
      const yyyy2 = now.getFullYear();
      out['Escalation Date'] = `${mm2}/${dd2}/${yyyy2}`;
      out['Case History2'] = `${mm2}/${dd2}/${yyyy2} as per the case escalated via mail`;

      if (out['SR Number'] || out['Consumer Name'] || out['Product Name']) out.found = true;
      return out;
    } catch {
      return { found: false };
    }
  }

  btn.addEventListener('click', async () => {
    const tsv = btn.dataset.tsv || '';
    try {
      await navigator.clipboard.writeText(tsv);
      setStatus('✅ Copied! Paste directly into Krishna Tracker Excel.');
      btn.disabled = true;
      setTimeout(queryAndPrepare, 700);
    } catch (err) {
      console.error('copy failed', err);
      setStatus('❌ Copy failed: ' + err.message);
    }// popup.js (previous stable version - only Purchase Channel logic fixed)
(() => {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('copyBtn');
  const preview = document.getElementById('preview');

  const PRODUCT_MAP = {
    "HD4929/01": "Induction Cooker",
    "GC362/80": "Dry Steam Iron",
    "GC1905/21": "Dry Iron",
    "HD4938/01": "Induction Cooker",
    "HL7756/00": "Mixer Grinder",
    "HR3705/10": "Hand Mixer",
    "HR7627/00": "Food Processor",
    "HP8100/46": "Hair Dryer",
    "BHD007/20": "Hair Dryer",
    "HP8142/00": "Hair Straightener",
    "HD9216/43": "Air Fryer",
    "HD9218/00": "Air Fryer",
    "GC1440/20": "Steam Iron",
    "GC1903/30": "Dry Iron",
    "HR1351/90": "Hand Blender",
    "HR1600/00": "Hand Blender",
    "HR1863/20": "Juicer",
    "HR1855/00": "Juicer",
    "HR2116/00": "Blender",
    "HR2771/00": "Citrus Juicer",
    "HD4936/00": "Induction Cooker",
    "HD4928/01": "Induction Cooker",
    "HR3745/00": "Mixer Grinder",
    "GC2040/70": "Steam Iron",
    "GC1920/20": "Dry Iron",
    "HD4929/00": "Induction Cooker"
  };

  const REGION_MAP = {
    "Uttar Pradesh & Uttarakhand": "North",
    "Gujarat": "West",
    "Karnataka, Telangana & Andhra": "South",
    "Mumbai, ROM1 & Goa": "West",
    "West Bengal & NE": "East",
    "Greater Punjab": "North",
    "Tamil Nadu & Kerala": "South",
    "Delhi & NCR": "North",
    "Bihar, Odisha & Jharkhand": "East",
    "Haryana & Rajasthan": "North",
    "Mpcg & Rom2": "West"
  };

  let PINCODE_MAP = null;
  let pinLoadState = 'not-started';

  const headers = [
    "SR Number", "Escalation Type", "Case history", "Channel", "Reason of Escalation by consumer",
    "Source of Escalation (Previous Channel)", "Source of Email", "Escalation Date", "Consumer Name",
    "Consumer Phone", "Mail ID", "Product Name", "Product Category", "NCH Request", "Service Request Number",
    "Warranty Status", "Date of purchase ", "Geography (Local/ Upcountry)", "Home Service (Yes/No)",
    "Purchase Channel", "Service Request Date", "Service Request Closure Date", "Escalation Closure Date",
    "ASC Code", "ASC Name", "Branch", "Region", "Consumer VOC", "Case History2",
    "Reason of Escalation by CC", "Root Cause 1", "Root Cause 2", "Consumer Expectation",
    "Resolution Offered", "Final Status", "CSAT", "Aging (Days)", "Aging Bucket", "Month",
    "Responsible for Escalation", "Profile of Person", "Type", "Spare Parts Code required",
    "Consumer Feedback for the below 3 Rating", "Name"
  ];

  const log = (...a) => console.debug('[popup.js]', ...a);
  const setStatus = txt => { if (statusEl) statusEl.textContent = txt; log(txt); };

  async function loadPinMap() {
    try {
      pinLoadState = 'loading';
      const url = chrome.runtime.getURL('pincode_map.json');
      const res = await fetch(url);
      PINCODE_MAP = await res.json();
      pinLoadState = 'loaded';
      log('✅ Pincode map loaded:', Object.keys(PINCODE_MAP).length);
    } catch (e) {
      pinLoadState = 'failed';
      console.error('❌ Pincode map load error:', e);
    }
  }

  function chooseBestResult(results) {
    let best = null, score = -1;
    for (const res of results) {
      const r = res?.result || res;
      if (!r || !r.found) continue;
      const s = ['Consumer Name', 'Consumer Phone', 'Product Name', 'Pincode'].filter(k => r[k]).length;
      if (s > score) { score = s; best = r; }
    }
    return best;
  }

  async function queryAndPrepare() {
    try {
      setStatus('Extracting data...');
      btn.disabled = true;
      preview.textContent = '—';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const execResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: extractFromDocument,
        args: [PRODUCT_MAP]
      });

      const best = chooseBestResult(execResults);
      if (!best) return setStatus('⚠️ No valid data found.');

      if (best['Pincode'] && PINCODE_MAP?.[best['Pincode']]) {
        const info = PINCODE_MAP[best['Pincode']];
        best['ASC Code'] = info['ASC Code'] || '';
        best['ASC Name'] = info['ASC Name'] || '';
        best['Branch'] = info['Branch'] || '';
        best['Region'] = REGION_MAP[info['Branch']] || info['Region'] || '';
      }

      const row = headers.map(h => best[h] || '').join('\t');
      const tsv = row + '\n';
      preview.textContent = row.replace(/\t/g, ' | ');
      btn.dataset.tsv = tsv;
      btn.disabled = false;
      setStatus('✅ Ready — click Copy');
      console.log('✅ Extracted:', best);
    } catch (err) {
      console.error('❌ Extraction Error:', err);
      setStatus('❌ Error: ' + err.message);
    }
  }

  function extractFromDocument(PRODUCT_MAP_PARAM) {
    try {
      const norm = s => (s || '').toString().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      const out = { found: false };

      Object.assign(out, {
        "Escalation Type": "Escalation by CC",
        "Case history": "Existing",
        "Channel": "Phone",
        "Reason of Escalation by consumer": "Service Delay",
        "Source of Escalation (Previous Channel)": "Phone",
        "Final Status": "open",
        "Responsible for Escalation": "ASC",
        "Profile of Person": "technician",
        "Type": "Service related",
        "Name": "krishna",
        "Reason of Escalation by CC": "Service delay",
        "Root Cause 1": "Service delay",
        "Root Cause 2": "Service delay",
        "Consumer Expectation": "Repair services"
      });

      let consumerName = '', consumerPhone = '', productName = '', purchaseDate = '',
          warrantyStatus = '', geography = '', homeService = '', purchaseChannel = 'Other Ecom',
          pincode = '', serviceRequestDate = '';

      const nameInput = document.querySelector('input[name="name"]');
      if (nameInput) consumerName = norm(nameInput.value);
      const mobileInput = document.querySelector('input[name="mobile"]');
      if (mobileInput) consumerPhone = norm(mobileInput.value);

      const modelInput = document.querySelector('input[name="modelShow"]');
      if (modelInput) {
        const full = norm(modelInput.value);
        const id = full.split('-')[0].trim();
        productName = id || full;
      }

      const d = document.querySelector('input[name="purchaseDay"]');
      const m = document.querySelector('input[name="purchaseMonth"]');
      const y = document.querySelector('input[name="purchaseYear"]');
      if (d && m && y) {
        const dd = d.value.padStart(2, '0');
        const mm = m.value.padStart(2, '0');
        const yyyy = y.value;
        purchaseDate = `${mm}/${dd}/${yyyy}`;
        const diff = (new Date() - new Date(`${yyyy}-${mm}-${dd}`)) / (1000 * 60 * 60 * 24 * 365.25);
        warrantyStatus = diff <= 2 ? 'In-Warranty' : 'Out-Of-Warranty';
      }

      const pinInput = document.querySelector('input[name="zipCode"], input#zipCode');
      if (pinInput && norm(pinInput.value)) pincode = norm(pinInput.value);
      out['Pincode'] = pincode;

      // ✅ Purchase Channel logic replaced with correct one
      const dealerField = Array.from(document.querySelectorAll('td.field')).find(td =>
        /\bR\s*-\s*DEALER\b/i.test(td.innerText || '')
      );
      if (dealerField) {
        purchaseChannel = 'Dealer';
      } else {
        const pageText = document.body ? document.body.innerText.toLowerCase() : '';
        if (/amazon|flipkart|croma|reliance|tatacliq|vijaysales/.test(pageText)) {
          purchaseChannel = 'Online';
        } else {
          purchaseChannel = 'Other Ecom';
        }
      }
      out['Purchase Channel'] = purchaseChannel;

      const sr = Array.from(document.querySelectorAll('td.field[nowrap], td.field')).find(td =>
        /\d{2}\/\d{2}\/\d{4}/.test(td.innerText)
      );
      if (sr) {
        const match = sr.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) serviceRequestDate = `${match[2]}/${match[1]}/${match[3]}`;
      }
      out['Service Request Date'] = serviceRequestDate;

      let serviceReq = '';
      const callIdLabel = Array.from(document.querySelectorAll('td.label')).find(td =>
        /(call\s*id|main\s*call\s*id)/i.test(td.innerText || '')
      );
      if (callIdLabel) {
        const nextField = callIdLabel.nextElementSibling;
        if (nextField && nextField.classList.contains('field')) {
          serviceReq = (nextField.innerText || '').replace(/\u00A0/g, ' ').trim();
        }
      }
      if (!serviceReq) {
        const txt = document.body.innerText;
        const m = txt.match(/\b[A-Z]{2}\d{10,12}\b/);
        if (m) serviceReq = m[0];
      }
      if (serviceReq) {
        out['Service Request Number'] = serviceReq;
        out['SR Number'] = serviceReq;
      }

      out['Product Category'] = PRODUCT_MAP_PARAM[productName] || '';
      out['Consumer Name'] = consumerName;
      out['Consumer Phone'] = consumerPhone;
      out['Product Name'] = productName;
      out['Date of purchase '] = purchaseDate;
      out['Warranty Status'] = warrantyStatus;

      const now = new Date();
      const mm2 = String(now.getMonth() + 1).padStart(2, '0');
      const dd2 = String(now.getDate()).padStart(2, '0');
      const yyyy2 = now.getFullYear();
      out['Escalation Date'] = `${mm2}/${dd2}/${yyyy2}`;
      out['Case History2'] = `${mm2}/${dd2}/${yyyy2} as per the case escalated via mail`;

      if (out['SR Number'] || out['Consumer Name'] || out['Product Name']) out.found = true;
      return out;
    } catch {
      return { found: false };
    }
  }

  btn.addEventListener('click', async () => {
    const tsv = btn.dataset.tsv || '';
    try {
      await navigator.clipboard.writeText(tsv);
      setStatus('✅ Copied! Paste directly into Krishna Tracker Excel.');
      btn.disabled = true;
      setTimeout(queryAndPrepare, 700);
    } catch (err) {
      console.error('copy failed', err);
      setStatus('❌ Copy failed: ' + err.message);
    }
  });

  (async function init() {
    await loadPinMap();
    setTimeout(queryAndPrepare, 300);
  })();
})();

  });

  (async function init() {
    await loadPinMap();
    setTimeout(queryAndPrepare, 300);
  })();
})();
