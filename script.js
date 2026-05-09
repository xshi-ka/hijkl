const STORAGE_KEY = "kotobaTrainerHtmlData.v1";
const SETTINGS_KEY = "kotobaTrainerHtmlSettings.v1";

const SPREADSHEET_API_URL = "";
const SPREADSHEET_API_TOKEN = "";

// Pakai CSV Google Sheet publik
const SPREADSHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1147-w0dWCnVqdB2ZbMqQJ2Yc-79w73w8tjZwK9gwPBM/export?format=csv&gid=0";

let db = {};
let activeBab = "";
let current = null;
let queue = [];
let sudahCek = false;
let selectedRows = new Set();
let sortHideAsc = false;
let syncTimer = null;
let isSyncing = false;

/* =========================
   Helpers
========================= */

function $(id) {
  return document.getElementById(id);
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function showToast(message) {
  console.log(message);
}

function setStorageStatus(source, type = "info") {
  const el = $("storageStatus");
  if (!el) return;

  el.textContent = source;
  el.dataset.type = type;
}

function showStatus(message, type = "info") {
  const el = $("syncStatus");
  if (!el) return;

  el.textContent = message;
  el.dataset.type = type;
}

function debounceSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    saveActiveBabToSpreadsheet(true);
  }, 800);
}

/* =========================
   Default data
========================= */

function defaultData() {
  return {
    "PM Bab1": [
      {
        hide: false,
        kanji: "学校",
        kana: "がっこう",
        romaji: "gakkou",
        arti: "Sekolah",
      },
      {
        hide: false,
        kanji: "先生",
        kana: "せんせい",
        romaji: "sensei",
        arti: "Guru",
      },
    ],
    "PM Bab2": [
      {
        hide: false,
        kanji: "水",
        kana: "みず",
        romaji: "mizu",
        arti: "Air",
      },
      {
        hide: false,
        kanji: "火",
        kana: "ひ",
        romaji: "hi",
        arti: "Api",
      },
    ],
  };
}

function normalizeItem(item) {
  return {
    hide: !!item?.hide,
    kanji: String(item?.kanji ?? "").trim(),
    kana: String(item?.kana ?? "").trim(),
    romaji: String(item?.romaji ?? "").trim(),
    arti: String(item?.arti ?? "").trim(),
  };
}

function normalizeDb(input) {
  const result = {};
  if (!input || typeof input !== "object") return result;

  for (const [babName, items] of Object.entries(input)) {
    if (!Array.isArray(items)) continue;
    result[String(babName)] = items.map(normalizeItem);
  }

  return result;
}

function ensureDbValid() {
  db = normalizeDb(db);

  if (!db || Object.keys(db).length === 0) {
    db = defaultData();
  }

  if (!activeBab || !db[activeBab]) {
    activeBab = Object.keys(db)[0] || "";
  }
}

/* =========================
   Settings & local
========================= */

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        lastBab: activeBab,
        sortHideAsc,
      })
    );
  } catch (err) {
    console.warn("Gagal simpan settings:", err);
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    db = raw ? normalizeDb(JSON.parse(raw)) : {};
  } catch {
    db = {};
  }

  const st = getSettings();
  sortHideAsc = !!st.sortHideAsc;

  if (Object.keys(db).length > 0) {
    activeBab = st.lastBab && db[st.lastBab] ? st.lastBab : Object.keys(db)[0] || "";
    ensureDbValid();
    refreshBabSelects();
    setStorageStatus("Lokal", "ok");
    showStatus("Data lokal ditemukan", "ok");
  } else {
    activeBab = "";
    setStorageStatus("Belum ada", "warn");
    showStatus("Data lokal kosong", "warn");
  }
}

function saveLocal(options = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    saveSettings();

    setStorageStatus("Lokal", "ok");
    showStatus("Tersimpan di lokal", "ok");
  } catch (err) {
    console.warn("Gagal simpan local:", err);
    showStatus("Gagal simpan lokal", "warn");
  }

  if (!options.skipRender) {
    renderTable();
  }
}

/* =========================
   BAB handling
========================= */

function refreshBabSelects() {
  ensureDbValid();

  const babNames = Object.keys(db || {});
  const babSelect = $("babSelect");
  const babKelolaSelect = $("babKelolaSelect");

  if (babNames.length === 0) return;

  function fillSelect(selectEl) {
    if (!selectEl) return;

    const selectedValue = selectEl.value || activeBab || babNames[0];

    selectEl.innerHTML = "";

    babNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });

    if (db[selectedValue]) {
      selectEl.value = selectedValue;
    } else {
      selectEl.value = babNames[0];
    }
  }

  fillSelect(babSelect);
  fillSelect(babKelolaSelect);
}

function setActiveBab(value) {
  if (!db[value]) return;

  activeBab = value;
  queue = [];
  selectedRows.clear();

  const babSelect = $("babSelect");
  const babKelolaSelect = $("babKelolaSelect");

  if (babSelect) babSelect.value = value;
  if (babKelolaSelect) babKelolaSelect.value = value;

  saveSettings();
  updateStats();
}


/* =========================
   Page nav
========================= */

function showPage(id) {
  ["welcomePage", "latihanPage", "kelolaPage"].forEach((pageId) => {
    const el = $(pageId);
    if (el) el.classList.add("hidden");
  });

  $(id)?.classList.remove("hidden");
}

function goWelcome() {
  refreshBabSelects();
  showPage("welcomePage");
}

function openKelola() {
  const babSelect = $("babSelect");
  if (babSelect?.value && db[babSelect.value]) {
    activeBab = babSelect.value;
  }

  refreshBabSelects();
  renderTable();
  showPage("kelolaPage");
}

function startLatihan() {
  const babSelect = $("babSelect");
  if (babSelect?.value && db[babSelect.value]) {
    activeBab = babSelect.value;
  }

  saveSettings();
  queue = [];

  const activeBabText = $("activeBabText");
  if (activeBabText) {
    activeBabText.textContent = "List kotoba yang akan diacak: " + activeBab;
  }

  showPage("latihanPage");
  nextQuestion();
}

/* =========================
   Training
========================= */

function activeItems() {
  return (db[activeBab] || []).filter(
    (x) => !x.hide && x.kanji && x.romaji && x.arti
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearAnswerColors() {
  const romajiInput = $("romajiInput");
  const artiInput = $("artiInput");
  const answerHint = $("answerHint");
  const kanaBox = $("kanaBox");

  [romajiInput, artiInput].forEach((input) => {
    if (!input) return;
    input.classList.remove("answer-ok", "answer-bad", "answer-warn");
    input.style.borderColor = "";
    input.style.boxShadow = "";
    input.style.background = "";
  });

  if (answerHint) {
    answerHint.className = "answer-hint";
    answerHint.textContent = "";
  }

  if (kanaBox) {
    kanaBox.classList.remove("kana-ok", "kana-bad");
  }
}

function nextQuestion() {
  const items = activeItems();
  const kanjiText = $("kanjiText");
  const kanaBox = $("kanaBox");
  const romajiInput = $("romajiInput");
  const artiInput = $("artiInput");
  const cekJawabanBtn = $("cekJawabanBtn");

  if (items.length === 0) {
    current = null;

    if (kanjiText) kanjiText.textContent = "Data kosong";
    if (kanaBox) kanaBox.textContent = "";
    if (romajiInput) romajiInput.value = "";
    if (artiInput) artiInput.value = "";

    clearAnswerColors();
    sudahCek = false;

    if (cekJawabanBtn) cekJawabanBtn.textContent = "Cek Jawaban";
    return;
  }

  if (queue.length === 0) {
    queue = shuffle(items);
  }

  current = queue.shift();

  if (kanjiText) kanjiText.textContent = current.kanji;
  if (kanaBox) kanaBox.textContent = "";
  if (romajiInput) romajiInput.value = "";
  if (artiInput) artiInput.value = "";

  clearAnswerColors();
  sudahCek = false;

  if (cekJawabanBtn) cekJawabanBtn.textContent = "Cek Jawaban";

  setTimeout(() => {
    romajiInput?.focus();
  }, 50);
}

function showKana() {
  if (!current) return;
  const kanaBox = $("kanaBox");
  if (kanaBox) kanaBox.textContent = current.kana || "";
}

function hideKana() {
  const kanaBox = $("kanaBox");
  if (kanaBox) kanaBox.textContent = "";
}

function rootSimple(s) {
  let k = norm(s);

  for (const p of [
    "meng",
    "meny",
    "men",
    "mem",
    "ber",
    "ter",
    "per",
    "pe",
    "me",
    "di",
    "ke",
    "se",
  ]) {
    if (k.startsWith(p) && k.length > p.length + 3) {
      k = k.slice(p.length);
      break;
    }
  }

  for (const suf of ["kan", "nya", "lah", "an", "i"]) {
    if (k.endsWith(suf) && k.length > suf.length + 3) {
      k = k.slice(0, -suf.length);
      break;
    }
  }

  return k;
}

function levenshtein(a, b) {
  a = norm(a);
  b = norm(b);

  const dp = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function statusArti(user, correctList) {
  const u = norm(user);
  if (!u) return "salah";

  for (const answer of String(correctList || "").split("|")) {
    const c = norm(answer);

    if (u === c) return "benar";

    if (u.length >= 4 && c.length >= 4) {
      if (u.includes(c) || c.includes(u)) return "hampir";

      const ru = rootSimple(u);
      const rc = rootSimple(c);

      if (ru === rc || ru.includes(rc) || rc.includes(ru)) return "hampir";

      const sim = 1 - levenshtein(u, c) / Math.max(u.length, c.length);
      if (sim >= 0.75) return "hampir";
    }
  }

  return "salah";
}

function setInputStatus(input, status) {
  if (!input) return;

  if (status === "ok") {
    input.style.borderColor = "var(--ok)";
    input.style.boxShadow = "0 0 0 3px rgba(69, 232, 139, .25)";
    input.style.background = "rgba(69, 232, 139, .08)";
    return;
  }

  if (status === "warn") {
    input.style.borderColor = "var(--warn)";
    input.style.boxShadow = "0 0 0 3px rgba(255, 184, 77, .25)";
    input.style.background = "rgba(255, 184, 77, .08)";
    return;
  }

  input.style.borderColor = "var(--danger)";
  input.style.boxShadow = "0 0 0 3px rgba(255, 95, 126, .25)";
  input.style.background = "rgba(255, 95, 126, .08)";
}

function cekJawaban() {
  if (!current) return;

  const romajiInput = $("romajiInput");
  const artiInput = $("artiInput");
  const answerHint = $("answerHint");
  const kanaBox = $("kanaBox");

  if (!romajiInput || !artiInput) return;

  const romajiUser = romajiInput.value;
  const artiUser = artiInput.value;

  const romajiOk = norm(romajiUser) === norm(current.romaji);
  const artiStatus = statusArti(artiUser, current.arti);

  clearAnswerColors();

  setInputStatus(romajiInput, romajiOk ? "ok" : "bad");

  if (artiStatus === "benar") {
    setInputStatus(artiInput, "ok");
  } else if (artiStatus === "hampir") {
    setInputStatus(artiInput, "warn");
  } else {
    setInputStatus(artiInput, "bad");
  }

  if (answerHint) {
    if (romajiOk && artiStatus === "benar") {
      answerHint.className = "answer-hint show-ok";
    } else if (romajiOk && artiStatus === "hampir") {
      answerHint.className = "answer-hint show-warn";
    } else {
      answerHint.className = "answer-hint show-bad";
    }

    answerHint.textContent = `Romaji: ${current.romaji}\nArti: ${current.arti}`;
  }

  if (kanaBox) {
    kanaBox.classList.remove("kana-ok", "kana-bad");
    kanaBox.classList.add(romajiOk ? "kana-ok" : "kana-bad");
  }

  showKana();
  sudahCek = true;

  const cekJawabanBtn = $("cekJawabanBtn");
  if (cekJawabanBtn) cekJawabanBtn.textContent = "Soal Selanjutnya";
}

function handleCekJawaban() {
  if (sudahCek) {
    nextQuestion();
    return;
  }

  cekJawaban();
}

function penak() {
  if (!current) return;

  const arr = db[activeBab] || [];
  const item = arr.find(
    (x) =>
      x.kanji === current.kanji &&
      x.kana === current.kana &&
      x.romaji === current.romaji &&
      x.arti === current.arti
  );

  if (item) {
    item.hide = true;
  }

  queue = queue.filter((x) => x !== current);
  saveLocal({ skipRender: true });
  nextQuestion();
}

/* =========================
   Table / kelola
========================= */

function renderTable() {
  const tbody = qs("#dataTable tbody");
  if (!tbody) return;

  ensureDbValid();

  tbody.innerHTML = "";
  const arr = db[activeBab] || [];

  arr.forEach((item, idx) => {
    const tr = document.createElement("tr");

    if (selectedRows.has(idx)) {
      tr.classList.add("selected");
    }

    tr.innerHTML = `
      <td>
        <input type="checkbox" data-field="hide" ${item.hide ? "checked" : ""} />
      </td>
      <td>
        <input type="text" data-field="kanji" value="${escapeAttr(item.kanji)}" />
      </td>
      <td>
        <input type="text" data-field="kana" value="${escapeAttr(item.kana)}" />
      </td>
      <td>
        <input type="text" data-field="romaji" value="${escapeAttr(item.romaji)}" />
      </td>
      <td>
        <input type="text" data-field="arti" value="${escapeAttr(item.arti)}" />
      </td>
    `;

    tr.addEventListener("click", (ev) => {
      if (ev.target instanceof HTMLInputElement) return;

      if (selectedRows.has(idx)) {
        selectedRows.delete(idx);
      } else {
        selectedRows.add(idx);
      }

      renderTable();
    });

    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        if (!field) return;

        item[field] = field === "hide" ? input.checked : input.value;
        updateStats();
        saveLocal({ skipRender: true });
      });

      input.addEventListener("input", () => {
        const field = input.dataset.field;
        if (!field || field === "hide") return;

        item[field] = input.value;
        updateStats();
      });

      input.addEventListener("blur", () => {
        saveLocal({ skipRender: true });
      });
    });

    tbody.appendChild(tr);
  });

  updateStats();
}

function updateStats() {
  const arr = db[activeBab] || [];
  const data = arr.filter((x) => x.kanji || x.kana || x.romaji || x.arti);
  const hafal = data.filter((x) => x.hide).length;

  const statTotal = $("statTotal");
  const statHafal = $("statHafal");
  const statLali = $("statLali");

  if (statTotal) statTotal.textContent = data.length;
  if (statHafal) statHafal.textContent = hafal;
  if (statLali) statLali.textContent = data.length - hafal;
}


function hideAll(value) {
  (db[activeBab] || []).forEach((x) => {
    x.hide = value;
  });

  renderTable();
  saveLocal();
}

function sortHideFirst() {
  sortHideAsc = !sortHideAsc;

  db[activeBab] = (db[activeBab] || []).sort((a, b) => {
    const hideA = a.hide ? 1 : 0;
    const hideB = b.hide ? 1 : 0;

    if (sortHideAsc) {
      return hideA - hideB || String(a.kanji).localeCompare(String(b.kanji));
    }

    return hideB - hideA || String(a.kanji).localeCompare(String(b.kanji));
  });

  selectedRows.clear();
  renderTable();
  saveLocal({ skipSpreadsheet: true });
}

function pasteFromTextArea() {
  const pasteBox = $("pasteBox");
  const text = pasteBox?.value.trim() || "";

  if (!text) return;

  const rows = text.replace(/\r\n/g, "\n").split("\n");

  if (!db[activeBab]) db[activeBab] = [];

  rows.forEach((row) => {
    const p = row.split("\t");
    if (p.length >= 4) {
      db[activeBab].push({
        hide: false,
        kanji: p[0]?.trim() || "",
        kana: p[1]?.trim() || "",
        romaji: p[2]?.trim() || "",
        arti: p.slice(3).join(" ").trim() || "",
      });
    }
  });

  if (pasteBox) pasteBox.value = "";

  renderTable();
  saveLocal();
}

/* =========================
   Excel import / export
========================= */

function rowsToSheetData(rows) {
  return [
    ["Hide", "Kanji", "Kana", "Romaji", "Arti"],
    ...rows.map((x) => [
      x.hide ? 1 : 0,
      x.kanji,
      x.kana,
      x.romaji,
      x.arti,
    ]),
  ];
}

async function importExcelFile(file) {
  if (!file) return;

  if (typeof XLSX === "undefined") {
    alert("Library Excel belum kebaca.");
    return;
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    alert("Sheet Excel tidak ditemukan.");
    return;
  }

  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (!db[activeBab]) db[activeBab] = [];

  const imported = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const item = normalizeItem({
      hide:
        row[0] === true ||
        row[0] === 1 ||
        String(row[0] || "").toLowerCase() === "true",
      kanji: row[1],
      kana: row[2],
      romaji: row[3],
      arti: row[4],
    });

    if (!item.kanji && !item.kana && !item.romaji && !item.arti) continue;
    imported.push(item);
  }

  db[activeBab].push(...imported);
  renderTable();
  saveLocal();

  alert(`Import berhasil: ${imported.length} data.`);
}

function exportExcel() {
  if (typeof XLSX === "undefined") {
    alert("Library Excel belum kebaca.");
    return;
  }

  const wb = XLSX.utils.book_new();

  for (const [babName, rows] of Object.entries(db)) {
    const data = rowsToSheetData(rows);
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, babName.slice(0, 31));
  }

  XLSX.writeFile(wb, "xshi-kotoba.xlsx");
}

function exportJson() {
  const blob = new Blob([JSON.stringify(db, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "xshi-kotoba.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetData() {
  const ok = confirm("Reset semua data ke bawaan awal?");
  if (!ok) return;

  db = defaultData();
  activeBab = Object.keys(db)[0] || "";
  queue = [];
  selectedRows.clear();

  refreshBabSelects();
  renderTable();
  saveLocal();
}

/* =========================
   Spreadsheet sync
========================= */

async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function extractDbFromSpreadsheetPayload(payload) {
  if (!payload) return null;

  if (payload.db && typeof payload.db === "object") {
    return normalizeDb(payload.db);
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return normalizeDb(payload.data);
  }

  if (typeof payload === "object" && !Array.isArray(payload)) {
    const values = Object.values(payload);
    const seemsDb =
      Object.keys(payload).length > 0 &&
      values.every((v) => Array.isArray(v));
    if (seemsDb) {
      return normalizeDb(payload);
    }
  }

  return null;
}

async function loadDataFromSpreadsheet(silent = true) {
  if (!SPREADSHEET_CSV_URL) return false;

  try {
    showStatus("Mengambil data spreadsheet...", "info");

    const res = await fetch(SPREADSHEET_CSV_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const csvText = await res.text();
    const rows = csvToObjects(csvText);

    if (!rows.length) {
      showStatus("Spreadsheet kosong", "warn");
      return false;
    }

    const grouped = {};

    rows.forEach((row) => {
      const bab = String(row.Bab || row.bab || "").trim();
      if (!bab) return;

      const item = {
        hide:
          String(row.Hide || row.hide || "").trim().toLowerCase() === "true" ||
          String(row.Hide || row.hide || "").trim() === "1",
        kanji: String(row.Kanji || row.kanji || "").trim(),
        kana: String(row.Kana || row.kana || "").trim(),
        romaji: String(row.Romaji || row.romaji || "").trim(),
        arti: String(row.Arti || row.arti || "").trim(),
      };

      if (!item.kanji && !item.kana && !item.romaji && !item.arti) return;

      if (!grouped[bab]) grouped[bab] = [];
      grouped[bab].push(item);
    });

    if (Object.keys(grouped).length === 0) {
      showStatus("Format spreadsheet tidak cocok", "warn");
      return false;
    }

      const oldBab = activeBab;
      db = normalizeDb(grouped);
ensureDbValid();

if (oldBab && db[oldBab]) {
  activeBab = oldBab;
} else {
  activeBab = Object.keys(db)[0] || "";
}

localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
saveSettings();

refreshBabSelects();
renderTable();
updateStats();

setStorageStatus("Spreadsheet", "ok");
showStatus("Data awal diambil dari spreadsheet", "ok");

return true;
  } catch (err) {
    console.warn("Gagal load spreadsheet:", err);

      setStorageStatus("Lokal", "warn");
      showStatus("Gagal ambil spreadsheet", "warn");

  if (!silent) {
    alert("Gagal mengambil data dari spreadsheet.");
  }

  return false;
  }
}
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function csvToObjects(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h || "").trim());

  return rows
    .slice(1)
    .filter(r => r.some(v => String(v || "").trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    });
}

async function postSpreadsheetJson(payload) {
  return safeFetchJson(SPREADSHEET_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

async function saveActiveBabToSpreadsheet(silent = true) {
  if (!SPREADSHEET_API_URL || !SPREADSHEET_API_TOKEN) return false;
  if (isSyncing) return false;

  isSyncing = true;

  try {
    showStatus("Menyimpan ke spreadsheet...", "info");

    const payload = {
      token: SPREADSHEET_API_TOKEN,
      action: "save",
      activeBab,
      db: deepClone(db),
      rows: deepClone(db[activeBab] || []),
      updatedAt: new Date().toISOString(),
    };

    await postSpreadsheetJson(payload);

    showStatus("Tersimpan ke spreadsheet", "ok");
    return true;
  } catch (err) {
    console.warn("Gagal simpan spreadsheet:", err);
    showStatus("Gagal simpan spreadsheet", "warn");
    if (!silent) {
      alert("Gagal menyimpan ke Spreadsheet.");
    }
    return false;
  } finally {
    isSyncing = false;
  }
}
function saveJsonFile() {
  try {
    const payload = {
      activeBab,
      sortHideAsc,
      db,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xshi-kotoba.json";
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showStatus("File JSON berhasil disimpan", "ok");
  } catch (err) {
    console.warn("Gagal simpan file JSON:", err);
    showStatus("Gagal simpan file JSON", "warn");
  }
}

function triggerImportJson() {
  $("jsonInput")?.click();
}

async function importJsonFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const importedDb = normalizeDb(parsed.db || parsed);

    if (!importedDb || Object.keys(importedDb).length === 0) {
      alert("File JSON tidak valid atau kosong.");
      return;
    }

    db = importedDb;
    activeBab =
      parsed.activeBab && db[parsed.activeBab]
        ? parsed.activeBab
        : Object.keys(db)[0] || "";

    sortHideAsc = !!parsed.sortHideAsc;

    ensureDbValid();
    refreshBabSelects();
    renderTable();
    updateStats();
    saveLocal({ skipRender: true });

    showStatus("Data JSON berhasil diambil", "ok");
  } catch (err) {
    console.warn("Gagal ambil file JSON:", err);
    alert("File JSON tidak valid.");
    showStatus("Gagal ambil data JSON", "warn");
  }
}
/* =========================
   Events
========================= */

function bindSelectEvents() {
  const babSelect = $("babSelect");
  const babKelolaSelect = $("babKelolaSelect");

  if (babSelect) {
    babSelect.addEventListener("change", function () {
      setActiveBab(this.value);
    });
  }

  if (babKelolaSelect) {
    babKelolaSelect.addEventListener("change", function () {
      setActiveBab(this.value);
      renderTable();
    });
  }
}

function bindTrainingEvents() {
  $("romajiInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      $("artiInput")?.focus();
    }
  });

  $("artiInput")?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      $("romajiInput")?.focus();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleCekJawaban();
    }
  });

  document.addEventListener("keydown", (e) => {
    const latihanPage = $("latihanPage");
    if (!latihanPage || latihanPage.classList.contains("hidden")) return;

    if (e.key === "1") {
      e.preventDefault();
      penak();
    }

    if (e.key === "Tab") {
      e.preventDefault();
      showKana();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Tab") {
      hideKana();
    }
  });
}

function bindImportEvents() {
  $("excelInput")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    await importExcelFile(file);
    e.target.value = "";
  });
}

function bindBeforeUnload() {
  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      saveSettings();
    } catch {
      // ignore
    }
  });
}

/* =========================
   Init
========================= */

async function initApp() {
  loadLocal();
  bindSelectEvents();
  bindTrainingEvents();
  bindImportEvents();
  bindBeforeUnload();

  // kalau local kosong, baru ambil dari spreadsheet
  if (!db || Object.keys(db).length === 0) {
    const ok = await loadDataFromSpreadsheet(true);

    if (!ok) {
      db = defaultData();
      ensureDbValid();
      refreshBabSelects();
      renderTable();
      updateStats();
      setStorageStatus("Default", "warn");
      showStatus("Pakai data bawaan", "warn");
      return;
    }
  }

  ensureDbValid();
  refreshBabSelects();
  renderTable();
  updateStats();
}

/* =========================
   Expose globals
========================= */

window.showPage = showPage;
window.goWelcome = goWelcome;
window.openKelola = openKelola;
window.startLatihan = startLatihan;
window.handleCekJawaban = handleCekJawaban;
window.cekJawaban = cekJawaban;
window.nextQuestion = nextQuestion;
window.showKana = showKana;
window.hideKana = hideKana;
window.penak = penak;

window.hideAll = hideAll;
window.sortHideFirst = sortHideFirst;
window.pasteFromTextArea = pasteFromTextArea;

window.loadDataFromSpreadsheet = loadDataFromSpreadsheet;
window.saveActiveBabToSpreadsheet = saveActiveBabToSpreadsheet;
window.saveLocal = saveLocal;

window.saveJsonFile = saveJsonFile;
window.triggerImportJson = triggerImportJson;

document.addEventListener("DOMContentLoaded", initApp);