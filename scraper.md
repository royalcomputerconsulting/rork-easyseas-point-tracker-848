# 🧩 SCRAPER.MD
### Chrome Extension: “SCRAPE WEBSITE → OFFERS.xlsx + CRUISES.xlsx”
**Version:** 1.0.0  
**Manifest:** MV3

---

## 📘 Overview
This Chrome Extension allows the user to **download two prebuilt Excel templates** (`OFFERS.xlsx` and `CRUISES.xlsx`) directly to their computer’s **Downloads** folder by clicking a single button in the popup.

It does **not scrape live web data** (despite the name) — instead, it provides **duplicate templates** for downstream data population workflows (e.g., Easy Seas or Club Royale importers).

All functionality operates **entirely locally**, requiring no web permissions except for `downloads`.

---

## 📁 Folder & File Structure
```
SCRAPE_WEBSITE_XLSX_EXT/
│
├── manifest.json
├── background.js
├── popup.html
└── popup.js
```

---

## ⚙️ manifest.json
Defines the Chrome Extension’s core metadata and behavior.

```json
{
  "manifest_version": 3,
  "name": "SCRAPE WEBSITE → OFFERS.xlsx + CRUISES.xlsx",
  "version": "1.0.0",
  "action": {
    "default_popup": "popup.html",
    "default_title": "SCRAPE WEBSITE"
  },
  "permissions": ["downloads"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

### Key Points:
- **Manifest V3** — uses a `service_worker` background script.
- **Permissions:** Only `"downloads"` — no tabs, activeTab, or host permissions required.
- **Action:** Opens the `popup.html` UI when clicked on the browser toolbar.

---

## ⚙️ background.js
This is a minimal service worker that logs a confirmation when installed or updated.

```js
chrome.runtime.onInstalled.addListener(() => console.log("XLSX duplicator installed"));
```

✅ Purpose: Confirms successful installation in Chrome’s console.  
No additional listeners or runtime behavior are implemented.

---

## 🧠 popup.html
Provides the simple user interface.  
The popup displays one button and instructional text.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Export OFFERS.xlsx + CRUISES.xlsx</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 14px; width: 300px; }
      h1 { font-size: 16px; margin: 0 0 10px; }
      button { width: 100%; padding: 12px; border-radius: 10px; border: none; font-weight: 600; cursor: pointer; }
      #scrape { background: #5b6cff; color: #fff; }
      #status { margin-top: 10px; font-size: 12px; color: #333; white-space: pre-wrap; }
      .ok { color: #0a7a0a; }
      .err { color: #b00020; }
      .hint { margin-top: 8px; font-size: 11px; color: #666; }
    </style>
  </head>
  <body>
    <h1>Duplicate Templates</h1>
    <button id="scrape">SCRAPE WEBSITE</button>
    <div id="status"></div>
    <div class="hint">This will immediately download <b>OFFERS.xlsx</b> and <b>CRUISES.xlsx</b> to your Downloads folder.</div>
    <script src="popup.js"></script>
  </body>
</html>
```

✅ **UX Flow:**  
- User clicks **SCRAPE WEBSITE** → triggers JavaScript event in `popup.js`.  
- Displays live status feedback (`Downloading…`, `Complete`, or error messages).  
- Downloads files with friendly UI hints.

---

## 🧩 popup.js
Handles button clicks and triggers downloads of embedded XLSX templates.

### Behavior Outline:
1. **Attach listener** to `#scrape` button on popup load.  
2. **On click:** decodes embedded Base64 Excel data for both templates:  
   - `OFFERS.xlsx`  
   - `CRUISES.xlsx`  
3. **Creates Blob URLs** for each file and calls `chrome.downloads.download()`.  
4. **Updates status field** dynamically (success ✅ or failure ❌).

### Example pseudocode (reconstruction):
```js
document.getElementById("scrape").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    const offersBlob = base64ToBlob(OFFERS_B64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const cruisesBlob = base64ToBlob(CRUISES_B64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await Promise.all([
      chrome.downloads.download({ url: URL.createObjectURL(offersBlob), filename: "OFFERS.xlsx" }),
      chrome.downloads.download({ url: URL.createObjectURL(cruisesBlob), filename: "CRUISES.xlsx" })
    ]);

    status.textContent = "✅ OFFERS.xlsx and CRUISES.xlsx saved to Downloads.";
    status.className = "ok";
  } catch (e) {
    status.textContent = "❌ Error: " + e.message;
    status.className = "err";
  }
});

function base64ToBlob(b64, type) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
```

✅ **Key Technical Highlights:**
- No network calls or permissions beyond `downloads`.  
- Embedded templates are Base64-encoded XLSX files defined inside the JS.  
- Can run completely offline.

---

## 🧱 Architecture Summary

| Component | Purpose | Runs In |
|------------|----------|---------|
| `manifest.json` | Declares permissions and files | Extension root |
| `background.js` | Logs installation confirmation | Background service worker |
| `popup.html` | User interface and layout | Extension popup |
| `popup.js` | Core logic (downloads embedded XLSX templates) | Popup runtime |

---

## 🧩 Build & Install Instructions

1. **Create a new folder:**  
   `SCRAPE_WEBSITE_XLSX_EXT/`

2. **Add the four files** above with exact names and contents.

3. **Pack or load it into Chrome:**
   - Go to `chrome://extensions`
   - Toggle **Developer mode** ON  
   - Click **Load unpacked**
   - Select the folder

4. Click the **puzzle icon → SCRAPE WEBSITE → Pin it** to the toolbar.

5. Click the icon → hit “SCRAPE WEBSITE” → it downloads the two Excel templates instantly.

---

## 🧰 Dependencies
- None.  
- Built-in Chrome APIs (`chrome.downloads`).  
- Pure JavaScript and HTML (no frameworks).

---

## 🔒 Permissions & Security
- Only `"downloads"` — meaning it cannot read pages, inject scripts, or access external sites.  
- Fully offline; safe for local or corporate environments.

---

## 🧪 Testing Checklist
- [ ] Verify install via `chrome://extensions` → “Service Worker” console logs *“XLSX duplicator installed”*.  
- [ ] Confirm clicking the popup button downloads both `.xlsx` files.  
- [ ] Ensure filenames appear as `OFFERS.xlsx` and `CRUISES.xlsx` in Downloads.  
- [ ] Open Excel → confirm file integrity (valid structure).  
- [ ] No console errors inside `popup.js`.

---

## 🪶 Rebuild Notes for Rork.ai
When using Rork.ai to rebuild:
- Maintain **exact file naming** and **manifest structure**.  
- Rork should create a **Chrome MV3 extension project** with:  
  - `manifest.json` (permissions, popup, background worker)  
  - `popup.html` + inline style  
  - `popup.js` containing Base64 data + download logic  
  - `background.js` for installation logging  
- Base64 strings in `popup.js` can be swapped for updated XLSX templates if needed.

---

## 🧾 Summary for Engineers
This extension is a **self-contained MV3 Chrome tool** designed to **distribute standardized Excel templates** by download button. It’s optimized for speed, zero-dependency operation, and guaranteed offline compatibility.

To expand this in future versions, you can:
- Add scraping logic via `content_scripts` + host permissions.
- Implement runtime logging and version updates.
- Replace Base64 data with dynamically fetched templates.
