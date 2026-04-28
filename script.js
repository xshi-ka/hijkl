const STORAGE_KEY = "kotobaTrainerHtmlData.v1";
const SETTINGS_KEY = "kotobaTrainerHtmlSettings.v1";

let db = {};
let activeBab = "";
let current = null;
let queue = [];
let sudahCek = false;
let selectedRows = new Set();
let sortHideAsc = false;

function defaultData(){
  return {
    "PM Bab1": [
      {hide:false, kanji:"学校", kana:"がっこう", romaji:"gakkou", arti:"Sekolah"},
      {hide:false, kanji:"先生", kana:"せんせい", romaji:"sensei", arti:"Guru"}
    ],
    "PM Bab2": [
      {hide:false, kanji:"水", kana:"みず", romaji:"mizu", arti:"Air"},
      {hide:false, kanji:"火", kana:"ひ", romaji:"hi", arti:"Api"}
    ]
  };
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    db = raw ? JSON.parse(raw) : defaultData();
  }catch{
    db = defaultData();
  }

  if(!db || Object.keys(db).length === 0){
    db = defaultData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  const st = getSettings();
  activeBab = st.lastBab && db[st.lastBab] ? st.lastBab : Object.keys(db)[0] || "";

  refreshBabSelects();
}

function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  saveSettings();
  renderTable();
  alert("Data berhasil disimpan di browser.");
}

function getSettings(){
  try{
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  }catch{
    return {};
  }
}

function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({lastBab:activeBab}));
}

function refreshBabSelects(){
  const babSelect = document.getElementById("babSelect");
  const babKelola = document.getElementById("babKelolaSelect");

  if(!db || Object.keys(db).length === 0){
    db = defaultData();
  }

  [babSelect, babKelola].forEach(sel => {
    if(!sel) return;

    sel.innerHTML = "";

    Object.keys(db).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });

    sel.value = activeBab;
  });
}

document.getElementById("babSelect")?.addEventListener("change", e => {
  activeBab = e.target.value;
  saveSettings();
  queue = [];
});

document.getElementById("babKelolaSelect")?.addEventListener("change", e => {
  activeBab = e.target.value;
  saveSettings();
  selectedRows.clear();
  renderTable();
  refreshBabSelects();
});

function showPage(id){
  ["welcomePage","latihanPage","kelolaPage"].forEach(x => {
    const el = document.getElementById(x);
    if(el) el.classList.add("hidden");
  });

  document.getElementById(id)?.classList.remove("hidden");
}

function goWelcome(){
  refreshBabSelects();
  showPage("welcomePage");
}

function openKelola(){
  const babSelect = document.getElementById("babSelect");
  activeBab = babSelect?.value || activeBab;
  refreshBabSelects();
  renderTable();
  showPage("kelolaPage");
}

function startLatihan(){
  const babSelect = document.getElementById("babSelect");
  activeBab = babSelect?.value || activeBab;
  saveSettings();

  queue = [];

  const activeBabText = document.getElementById("activeBabText");
  if(activeBabText) activeBabText.textContent = "List kotoba yang akan diacak: " + activeBab;

  showPage("latihanPage");
  nextQuestion();
}

function activeItems(){
  return (db[activeBab] || []).filter(x => !x.hide && x.kanji && x.romaji && x.arti);
}

function shuffle(arr){
  const a = [...arr];

  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function clearAnswerColors(){
  const romajiInput = document.getElementById("romajiInput");
  const artiInput = document.getElementById("artiInput");
  const answerHint = document.getElementById("answerHint");
  const kanaBox = document.getElementById("kanaBox");

  [romajiInput, artiInput].forEach(input => {
    if(!input) return;

    input.classList.remove("answer-ok", "answer-bad", "answer-warn");

    input.style.borderColor = "";
    input.style.boxShadow = "";
    input.style.background = "";
  });

  if(answerHint){
    answerHint.className = "answer-hint";
    answerHint.textContent = "";
  }

  if(kanaBox){
    kanaBox.classList.remove("kana-ok", "kana-bad");
  }
}

function nextQuestion(){
  const items = activeItems();

  const kanjiText = document.getElementById("kanjiText");
  const kanaBox = document.getElementById("kanaBox");
  const romajiInput = document.getElementById("romajiInput");
  const artiInput = document.getElementById("artiInput");

  if(items.length === 0){
    current = null;

    if(kanjiText) kanjiText.textContent = "Data kosong";
    if(kanaBox) kanaBox.textContent = "";

    if(romajiInput) romajiInput.value = "";
    if(artiInput) artiInput.value = "";

    clearAnswerColors();
    sudahCek = false;
      const cekJawabanBtn = document.getElementById("cekJawabanBtn");
      if(cekJawabanBtn) cekJawabanBtn.textContent = "Cek Jawaban";
    return;
  }

  if(queue.length === 0) queue = shuffle(items);

  current = queue.shift();

  if(kanjiText) kanjiText.textContent = current.kanji;
  if(kanaBox) kanaBox.textContent = "";

  if(romajiInput) romajiInput.value = "";
  if(artiInput) artiInput.value = "";

  clearAnswerColors();

  sudahCek = false;

const cekJawabanBtn = document.getElementById("cekJawabanBtn");
if(cekJawabanBtn) cekJawabanBtn.textContent = "Cek Jawaban";

setTimeout(() => romajiInput?.focus(), 50);
}

function showKana(){
  if(current){
    const kanaBox = document.getElementById("kanaBox");
    if(kanaBox) kanaBox.textContent = current.kana || "";
  }
}

function hideKana(){
  const kanaBox = document.getElementById("kanaBox");
  if(kanaBox) kanaBox.textContent = "";
}

function norm(s){
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function rootSimple(s){
  let k = norm(s);

  for(const p of ["meng","meny","men","mem","ber","ter","per","pe","me","di","ke","se"]){
    if(k.startsWith(p) && k.length > p.length + 3){
      k = k.slice(p.length);
      break;
    }
  }

  for(const suf of ["kan","nya","lah","an","i"]){
    if(k.endsWith(suf) && k.length > suf.length + 3){
      k = k.slice(0, -suf.length);
      break;
    }
  }

  return k;
}

function levenshtein(a,b){
  a = norm(a);
  b = norm(b);

  const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

  for(let i = 0; i <= a.length; i++) dp[i][0] = i;
  for(let j = 0; j <= b.length; j++) dp[0][j] = j;

  for(let i = 1; i <= a.length; i++){
    for(let j = 1; j <= b.length; j++){
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

function statusArti(user, correctList){
  const u = norm(user);
  if(!u) return "salah";

  for(const answer of String(correctList || "").split("|")){
    const c = norm(answer);

    if(u === c) return "benar";

    if(u.length >= 4 && c.length >= 4){
      if(u.includes(c) || c.includes(u)) return "hampir";

      const ru = rootSimple(u);
      const rc = rootSimple(c);

      if(ru === rc || ru.includes(rc) || rc.includes(ru)) return "hampir";

      const sim = 1 - levenshtein(u, c) / Math.max(u.length, c.length);
      if(sim >= .75) return "hampir";
    }
  }

  return "salah";
}
function handleCekJawaban(){
  if(sudahCek){
    nextQuestion();
    return;
  }

  cekJawaban();
}
function cekJawaban(){
  if(!current) return;

  const romajiInput = document.getElementById("romajiInput");
  const artiInput = document.getElementById("artiInput");
  const answerHint = document.getElementById("answerHint");

  if(!romajiInput || !artiInput) return;

  const romajiUser = romajiInput.value;
  const artiUser = artiInput.value;

  const romajiOk = norm(romajiUser) === norm(current.romaji);
  const artiStatus = statusArti(artiUser, current.arti);
  const kanaBox = document.getElementById("kanaBox");

  clearAnswerColors();

  if(romajiOk){
    setInputStatus(romajiInput, "ok");
  }else{
    setInputStatus(romajiInput, "bad");
  }

  if(artiStatus === "benar"){
    setInputStatus(artiInput, "ok");
  }else if(artiStatus === "hampir"){
    setInputStatus(artiInput, "warn");
  }else{
    setInputStatus(artiInput, "bad");
  }

 if(answerHint){
    if(romajiOk && artiStatus === "benar"){
      answerHint.className = "answer-hint show-ok";
    }else if(romajiOk && artiStatus === "hampir"){
      answerHint.className = "answer-hint show-warn";
    }else{
      answerHint.className = "answer-hint show-bad";
    }

    answerHint.textContent =
      "Romaji: " + current.romaji + "\n" +
      "Arti: " + current.arti;
  }

  if(kanaBox){
    kanaBox.classList.remove("kana-ok", "kana-bad");
    kanaBox.classList.add(romajiOk ? "kana-ok" : "kana-bad");
  }

 showKana();

sudahCek = true;

const cekJawabanBtn = document.getElementById("cekJawabanBtn");
if(cekJawabanBtn) cekJawabanBtn.textContent = "Soal Selanjutnya";
}
function setInputStatus(input, status){
  if(status === "ok"){
    input.style.borderColor = "var(--ok)";
    input.style.boxShadow = "0 0 0 3px rgba(69, 232, 139, .25)";
    input.style.background = "rgba(69, 232, 139, .08)";
    return;
  }

  if(status === "warn"){
    input.style.borderColor = "var(--warn)";
    input.style.boxShadow = "0 0 0 3px rgba(255, 184, 77, .25)";
    input.style.background = "rgba(255, 184, 77, .08)";
    return;
  }

  input.style.borderColor = "var(--danger)";
  input.style.boxShadow = "0 0 0 3px rgba(255, 95, 126, .25)";
  input.style.background = "rgba(255, 95, 126, .08)";
}

function penak(){
  if(!current) return;

  const arr = db[activeBab] || [];
  const item = arr.find(x =>
    x.kanji === current.kanji &&
    x.kana === current.kana &&
    x.romaji === current.romaji &&
    x.arti === current.arti
  );

  if(item) item.hide = true;

  queue = queue.filter(x => x !== current);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

  nextQuestion();
}

document.getElementById("romajiInput")?.addEventListener("keydown", e => {
  if(e.key === "Enter" || e.key === "ArrowDown"){
    e.preventDefault();
    document.getElementById("artiInput")?.focus();
  }
});

document.getElementById("artiInput")?.addEventListener("keydown", e => {
  if(e.key === "ArrowUp"){
    e.preventDefault();
    document.getElementById("romajiInput")?.focus();
    return;
  }

if(e.key === "Enter"){
  e.preventDefault();
  handleCekJawaban();
}
});

document.addEventListener("keydown", e => {
  const latihanPage = document.getElementById("latihanPage");
  if(!latihanPage || latihanPage.classList.contains("hidden")) return;

  if(e.key === "1"){
    e.preventDefault();
    penak();
  }

  if(e.key === "Tab"){
    e.preventDefault();
    showKana();
  }
});

document.addEventListener("keyup", e => {
  if(e.key === "Tab") hideKana();
});

function renderTable(){
  const tbody = document.querySelector("#dataTable tbody");
  if(!tbody) return;

  tbody.innerHTML = "";

  const arr = db[activeBab] || [];

  arr.forEach((item, idx) => {
    const tr = document.createElement("tr");

    if(selectedRows.has(idx)) tr.classList.add("selected");

    tr.innerHTML = `
      <td><input type="checkbox" ${item.hide ? "checked" : ""} data-field="hide"></td>
      <td><input type="text" value="${escapeAttr(item.kanji)}" data-field="kanji"></td>
      <td><input type="text" value="${escapeAttr(item.kana)}" data-field="kana"></td>
      <td><input type="text" value="${escapeAttr(item.romaji)}" data-field="romaji"></td>
      <td><input type="text" value="${escapeAttr(item.arti)}" data-field="arti"></td>`;

    tr.addEventListener("click", ev => {
      if(ev.target.tagName === "INPUT") return;

      selectedRows.has(idx) ? selectedRows.delete(idx) : selectedRows.add(idx);
      renderTable();
    });

    tr.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", () => {
        const f = input.dataset.field;
        item[f] = f === "hide" ? input.checked : input.value;
        updateStats();
      });

      input.addEventListener("input", () => {
        const f = input.dataset.field;
        if(f !== "hide") item[f] = input.value;
        updateStats();
      });
    });

    tbody.appendChild(tr);
  });

  updateStats();
}

function escapeAttr(s){
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function updateStats(){
  const arr = db[activeBab] || [];
  const data = arr.filter(x => x.kanji || x.kana || x.romaji || x.arti);
  const hafal = data.filter(x => x.hide).length;

  const statTotal = document.getElementById("statTotal");
  const statHafal = document.getElementById("statHafal");
  const statLali = document.getElementById("statLali");

  if(statTotal) statTotal.textContent = data.length;
  if(statHafal) statHafal.textContent = hafal;
  if(statLali) statLali.textContent = data.length - hafal;
}

function addRow(){
  if(!db[activeBab]) db[activeBab] = [];

  db[activeBab].push({hide:false, kanji:"", kana:"", romaji:"", arti:""});
  renderTable();
}

function deleteSelected(){
  const arr = db[activeBab] || [];

  if(selectedRows.size === 0){
    alert("Pilih baris dulu dengan klik area baris.");
    return;
  }

  db[activeBab] = arr.filter((_, idx) => !selectedRows.has(idx));
  selectedRows.clear();

  renderTable();
}

function hideAll(value){
  (db[activeBab] || []).forEach(x => x.hide = value);
  renderTable();
}

function sortHideFirst(){
  sortHideAsc = !sortHideAsc;

  db[activeBab] = (db[activeBab] || []).sort((a,b) => {
    const hideA = a.hide ? 1 : 0;
    const hideB = b.hide ? 1 : 0;

    if(sortHideAsc){
      // Klik kedua: yang belum hide di atas
      return hideA - hideB || String(a.kanji).localeCompare(String(b.kanji));
    }

    // Klik pertama: yang sudah hide di atas
    return hideB - hideA || String(a.kanji).localeCompare(String(b.kanji));
  });

  selectedRows.clear();
  renderTable();
}

function pasteFromTextArea(){
  const pasteBox = document.getElementById("pasteBox");
  const text = pasteBox?.value.trim() || "";

  if(!text) return;

  const rows = text.replace(/\r\n/g, "\n").split("\n");

  if(!db[activeBab]) db[activeBab] = [];

  rows.forEach(r => {
    const p = r.split("\t");

    if(p.length >= 4){
      db[activeBab].push({
        hide:false,
        kanji:p[0]?.trim() || "",
        kana:p[1]?.trim() || "",
        romaji:p[2]?.trim() || "",
        arti:p.slice(3).join(" ").trim() || ""
      });
    }
  });

  pasteBox.value = "";
  renderTable();
}

document.getElementById("excelInput")?.addEventListener("change", async e => {
  const file = e.target.files[0];
  if(!file) return;

  if(typeof XLSX === "undefined"){
    alert("Library Excel belum kebaca. Pastikan internet aktif saat import/export Excel.");
    return;
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const next = {};

  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:""});
    const dataRows = rows.slice(1);

    next[name] = dataRows.map(r => {
      const first = String(r[0] ?? "").trim().toLowerCase();
      const hasHide =
        first === "true" ||
        first === "false" ||
        first === "1" ||
        first === "0" ||
        typeof r[0] === "boolean";

      if(hasHide){
        return {
          hide:parseBool(r[0]),
          kanji:r[1] || "",
          kana:r[2] || "",
          romaji:r[3] || "",
          arti:r[4] || ""
        };
      }

      return {
        hide:false,
        kanji:r[0] || "",
        kana:r[1] || "",
        romaji:r[2] || "",
        arti:r[3] || ""
      };
    }).filter(x => x.kanji || x.kana || x.romaji || x.arti);
  });

  db = next;

  if(!db || Object.keys(db).length === 0){
    db = defaultData();
  }

  activeBab = Object.keys(db)[0] || "";

  saveLocal();
  refreshBabSelects();

  alert("Import berhasil.");
});

function parseBool(v){
  if(typeof v === "boolean") return v;

  const s = String(v || "").trim().toLowerCase();
  return ["true","1","ya","y","checked"].includes(s);
}

function downloadExcel(){
  if(typeof XLSX === "undefined"){
    alert("Library Excel belum kebaca. Pastikan internet aktif saat export Excel.");
    return;
  }

  const wb = XLSX.utils.book_new();

  Object.keys(db).forEach(name => {
    const rows = [["Hide","Kanji","Kana","Romaji","Arti"]];

    (db[name] || []).forEach(x => rows.push([
      !!x.hide,
      x.kanji,
      x.kana,
      x.romaji,
      x.arti
    ]));

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  XLSX.writeFile(wb, "data.xlsx");
}

function resetData(){
  if(!confirm("Reset data lokal browser?")) return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);

  loadLocal();
  goWelcome();
}
function parseCsvLine(line){
  const result = [];
  let current = "";
  let inQuotes = false;

  for(let i = 0; i < line.length; i++){
    const char = line[i];
    const next = line[i + 1];

    if(char === '"' && inQuotes && next === '"'){
      current += '"';
      i++;
      continue;
    }

    if(char === '"'){
      inQuotes = !inQuotes;
      continue;
    }

    if(char === "," && !inQuotes){
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(text){
  const rows = [];
  let currentLine = "";
  let inQuotes = false;

  for(let i = 0; i < text.length; i++){
    const char = text[i];
    const next = text[i + 1];

    if(char === '"' && inQuotes && next === '"'){
      currentLine += '""';
      i++;
      continue;
    }

    if(char === '"'){
      inQuotes = !inQuotes;
    }

    if((char === "\n" || char === "\r") && !inQuotes){
      if(currentLine.trim()){
        rows.push(parseCsvLine(currentLine));
      }

      currentLine = "";

      if(char === "\r" && next === "\n"){
        i++;
      }

      continue;
    }

    currentLine += char;
  }

  if(currentLine.trim()){
    rows.push(parseCsvLine(currentLine));
  }

  return rows;
}
const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4AkdnfIK7QcuWVnP4P_ZNKzl0tMPynEwLYEAnhyoL3j_OubjMj7D5QAv8U2rQQkMkHiZT-zlPJAYh/pub?gid=0&single=true&output=csv";
async function loadDataFromSpreadsheet(){
  try{
    const response = await fetch(SPREADSHEET_CSV_URL);

    if(!response.ok){
      throw new Error("Gagal mengambil data spreadsheet.");
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    if(rows.length <= 1){
      throw new Error("Data spreadsheet kosong.");
    }

    const header = rows[0].map(x => String(x || "").trim().toLowerCase());
    const dataRows = rows.slice(1);

    const babIndex = header.indexOf("bab");
    const hideIndex = header.indexOf("hide");
    const kanjiIndex = header.indexOf("kanji");
    const kanaIndex = header.indexOf("kana");
    const romajiIndex = header.indexOf("romaji");
    const artiIndex = header.indexOf("arti");

    if(babIndex < 0 || kanjiIndex < 0 || kanaIndex < 0 || romajiIndex < 0 || artiIndex < 0){
      throw new Error("Header wajib: Bab, Hide, Kanji, Kana, Romaji, Arti");
    }

    const next = {};

    dataRows.forEach(row => {
      const bab = String(row[babIndex] || "").trim();
      const kanji = String(row[kanjiIndex] || "").trim();
      const kana = String(row[kanaIndex] || "").trim();
      const romaji = String(row[romajiIndex] || "").trim();
      const arti = String(row[artiIndex] || "").trim();

      if(!bab || (!kanji && !kana && !romaji && !arti)){
        return;
      }

      if(!next[bab]){
        next[bab] = [];
      }

      next[bab].push({
        hide: parseBool(row[hideIndex]),
        kanji: kanji,
        kana: kana,
        romaji: romaji,
        arti: arti
      });
    });

    if(Object.keys(next).length === 0){
      throw new Error("Tidak ada data valid di spreadsheet.");
    }

    db = next;
    activeBab = Object.keys(db)[0] || "";

    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    saveSettings();
    refreshBabSelects();

  }catch(err){
    console.error(err);
    alert("Gagal mengambil data dari Spreadsheet. Data lokal akan dipakai.");
  }
}
loadLocal();
loadDataFromSpreadsheet();
