const state = {
  allQuestions: [],
  viewQuestions: [],
  answersById: new Map(), // id -> { chosenIndex, correct, time }
  viewBuilt: false, // ВАЖНО: чтобы не пересобирать/не перемешивать каждый раз

  // UI runtime flags
  started: false,       // нажал "Начать тест"
  showDetails: false,   // показывать сводку+вопросы
  revealResults: true,  // подсветка верно/неверно

  settings: {
    shuffleQ: true,
    shuffleA: true,
    showLetters: true,
    showNumber: true,
    showDifficulty: true,
    mode: "list",   // list | single
    testType: "all", // smart | all
  },

  filter: "all",
  singleIndex: 0,
};

const els = {};
function $(id){ return document.getElementById(id); }

function randomShuffle(arr){
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSmartQuestion(q){
  // "только где правильный ответ НЕ самый длинный"
  const correct = q.answers.find(a => a.correct);
  if (!correct) return true;
  const lens = q.answers.map(a => (a.text || "").length);
  const maxLen = Math.max(...lens);
  return (correct.text || "").length < maxLen;
}

function loadSettingsFromUI(){
  state.settings.shuffleQ = els.optShuffleQ.checked;
  state.settings.shuffleA = els.optShuffleA.checked;
  state.settings.showLetters = els.optShowLetters.checked;
  state.settings.showNumber = els.optShowNumber.checked;
  state.settings.showDifficulty = els.optShowDifficulty.checked;

  state.settings.mode = document.querySelector('input[name="mode"]:checked').value;
  state.settings.testType = document.querySelector('input[name="testType"]:checked').value;
}

function applySettingsReset({ keepStarted = true } = {}){
  state.answersById.clear();
  state.filter = "all";
  state.singleIndex = 0;

  if (!keepStarted){
    state.started = false;
    state.showDetails = false;
  } else {
    // если тест ещё не стартовали — детали должны быть скрыты
    if (!state.started) state.showDetails = false;
  }

  setActiveTab("all");
  syncDetailButtonLabel();
  state.viewBuilt = false;     // разрешаем пересобрать порядок
  state.viewQuestions = [];    // очищаем старый порядок
  renderAll();
}

function buildViewQuestions(){
  // если уже построили порядок — НЕ трогаем (иначе всё прыгает)
  if (state.viewBuilt && state.viewQuestions.length) return;

  let qs = [...state.allQuestions];
  if (state.settings.testType === "smart"){
    qs = qs.filter(isSmartQuestion);
  }

  // shuffle questions внутри категорий
  if (state.settings.shuffleQ){
    const byCat = new Map();
    for (const q of qs){
      const key = q.category || "Без раздела";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(q);
    }
    const cats = Array.from(byCat.keys());
    const merged = [];
    for (const cat of cats){
      merged.push(...randomShuffle(byCat.get(cat)));
    }
    qs = merged;
  }

  // shuffle answers per question
  state.viewQuestions = qs.map(q => {
    const clone = structuredClone(q);
    if (state.settings.shuffleA){
      clone.answers = randomShuffle(clone.answers);
    }
    return clone;
  });
  state.viewBuilt = true;
}

function setTheme(isDark){
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

function restoreTheme(){
  const saved = localStorage.getItem("theme") || "light";
  const isDark = saved === "dark";
  els.themeToggle.checked = isDark;
  setTheme(isDark);
}

function setActiveTab(filter){
  for (const b of document.querySelectorAll(".tab")){
    b.classList.toggle("active", b.dataset.filter === filter);
  }
}

function calcStats(){
  const total = state.viewQuestions.length;
  let answered = 0, correct = 0;

  for (const q of state.viewQuestions){
    const rec = state.answersById.get(q.id);
    if (rec){
      answered++;
      if (rec.correct) correct++;
    }
  }

  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { total, answered, correct, percent };
}

function renderStats(){
  const s = calcStats();
  els.stTotal.textContent = s.total;
  els.stAnswered.textContent = s.answered;
  els.stCorrect.textContent = s.correct;
  els.stPercent.textContent = `${s.percent}%`;

  // как на скрине: пока не стартовал — счёт 0/total
  if (!state.started){
    els.scoreTop.textContent = `Счёт: 0/${s.total} (0%)`;
  } else {
    els.scoreTop.textContent = `Счёт: ${s.correct}/${s.total} (${s.percent}%)`;
  }
}

function buildSummary(){
  const byCat = new Map();
  for (const q of state.viewQuestions){
    const cat = q.category || "Без раздела";
    if (!byCat.has(cat)) byCat.set(cat, { total:0, answered:0, correct:0 });
    const s = byCat.get(cat);
    s.total++;
    const rec = state.answersById.get(q.id);
    if (rec){
      s.answered++;
      if (rec.correct) s.correct++;
    }
  }
  return byCat;
}

function renderSummary(){
  const byCat = buildSummary();
  const stats = calcStats();

  els.summary.innerHTML = "";
  for (const [cat, s] of byCat.entries()){
    const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;

    const div = document.createElement("div");
    div.className = "summary-item";
    div.innerHTML = `
      <div class="summary-top">
        <div>
          <div class="summary-title">${escapeHtml(cat)}</div>
          <div class="small">Всего: ${s.total} • Отвечено: ${s.answered} • Правильно: ${s.correct}</div>
        </div>
        <div class="pill">${pct}%</div>
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
    `;
    els.summary.appendChild(div);
  }

  els.scoreTop.textContent = `Счёт: ${stats.correct}/${stats.total} (${stats.percent}%)`;
}

function questionVisible(q){
  const rec = state.answersById.get(q.id);
  if (state.filter === "all") return true;
  if (state.filter === "answered") return !!rec;
  if (state.filter === "unanswered") return !rec;
  if (state.filter === "correct") return !!rec && rec.correct;
  if (state.filter === "wrong") return !!rec && !rec.correct;
  return true;
}

function letters(i){
  return String.fromCharCode("a".charCodeAt(0) + i);
}

function renderQuestions(){
  els.questions.innerHTML = "";

  const mode = state.settings.mode;
  els.navSingle.style.display = (mode === "single") ? "flex" : "none";

  let list = state.viewQuestions.filter(questionVisible);

  if (mode === "single"){
    if (list.length === 0){
      els.questions.innerHTML = `<div class="small">Нет вопросов по выбранному фильтру.</div>`;
      els.singlePos.textContent = `0 / 0`;
      return;
    }

    state.singleIndex = Math.max(0, Math.min(state.singleIndex, list.length - 1));
    const current = list[state.singleIndex];
    els.singlePos.textContent = `${state.singleIndex + 1} / ${list.length}`;

    els.questions.appendChild(renderQuestionCard(current));
    return;
  }

  if (list.length === 0){
    els.questions.innerHTML = `<div class="small">Нет вопросов по выбранному фильтру.</div>`;
    return;
  }

  for (const q of list){
    els.questions.appendChild(renderQuestionCard(q));
  }
}

function renderQuestionCard(q){
  const rec = state.answersById.get(q.id);

  const card = document.createElement("div");
  card.className = "qcard";

  const meta = [];
  if (state.settings.showNumber) meta.push(`<span class="pill">Вопрос ${q.id}</span>`);
  if (q.difficulty && state.settings.showDifficulty) meta.push(`<span class="pill">${escapeHtml(q.difficulty)}</span>`);
  if (q.category) meta.push(`<span class="pill">${escapeHtml(q.category)}</span>`);

  const resPill = (!state.revealResults || !rec) ? "" :
    (rec.correct ? `<span class="pill good">Верно</span>` : `<span class="pill bad">Неверно</span>`);

  card.innerHTML = `
    <div class="qhead">
      <div>
        <div class="qmeta">${meta.join("")}</div>
        <div style="margin-top:8px; font-weight:800">${escapeHtml(q.question)}</div>
      </div>
      <div>${resPill}</div>
    </div>
    <div class="answers"></div>
  `;

  const answersBox = card.querySelector(".answers");

  q.answers.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "answer";

    const chosen = rec?.chosenIndex === i;
    const correct = a.correct === true;

    if (state.revealResults && rec){
      if (chosen && correct) row.classList.add("correct");
      if (chosen && !correct) row.classList.add("wrong");
      if (!chosen && correct && !rec.correct) row.classList.add("correct");
    }

    const letter = state.settings.showLetters ? `<div class="letter">${letters(i)})</div>` : "";

    row.innerHTML = `
      ${letter}
      <div>${escapeHtml(a.text)}</div>
    `;

    row.addEventListener("click", () => {
      // после ответа — не менять (как в твоём примере)
      if (state.answersById.get(q.id)) return;

      const isCorrect = !!a.correct;
      state.answersById.set(q.id, { chosenIndex: i, correct: isCorrect, time: Date.now() });

      renderStats();
      if (state.started && state.showDetails){
      renderSummary();
      renderQuestions();
      }
    });

    answersBox.appendChild(row);
  });

  return card;
}

function renderAll(){
  // строим порядок только если ещё не строили
  if (!state.viewBuilt) buildViewQuestions();

  renderStats();

  if (!state.started){
    els.summary.innerHTML = "";
    els.questions.innerHTML = "";
    return;
  }

  if (!state.showDetails){
    els.summary.innerHTML = "";
    els.questions.innerHTML = "";
    return;
  }

  renderSummary();
  renderQuestions();
}

function syncDetailButtonLabel(){
  // как на скрине: сначала "Показать подробные результаты"
  els.btnToggleResults.textContent = state.showDetails
    ? "Скрыть подробные результаты"
    : "Показать подробные результаты";
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function init(){
  Object.assign(els, {
    themeToggle: $("themeToggle"),
    optShuffleQ: $("optShuffleQ"),
    optShuffleA: $("optShuffleA"),
    optShowLetters: $("optShowLetters"),
    optShowNumber: $("optShowNumber"),
    optShowDifficulty: $("optShowDifficulty"),
    btnApply: $("btnApply"),
    btnStart: $("btnStart"),
    btnToggleResults: $("btnToggleResults"),
    btnReset: $("btnReset"),
    stTotal: $("stTotal"),
    stAnswered: $("stAnswered"),
    stCorrect: $("stCorrect"),
    stPercent: $("stPercent"),
    summary: $("summary"),
    questions: $("questions"),
    scoreTop: $("scoreTop"),
    smartCount: $("smartCount"),
    allCount: $("allCount"),
    navSingle: $("navSingle"),
    singlePos: $("singlePos"),
    prevQ: $("prevQ"),
    nextQ: $("nextQ"),
  });

  // theme
  restoreTheme();
  els.themeToggle.addEventListener("change", (e) => setTheme(e.target.checked));

  // load questions
  const res = await fetch("data/questions.json");
  state.allQuestions = await res.json();

  // counters for test type
  const all = state.allQuestions.length;
  const smart = state.allQuestions.filter(isSmartQuestion).length;
  els.allCount.textContent = all;
  els.smartCount.textContent = smart;

  // tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      setActiveTab(state.filter);
      state.singleIndex = 0;
      renderAll();
    });
  });

  // Apply (сбросить ответы)
  els.btnApply.addEventListener("click", () => {
    loadSettingsFromUI();
    applySettingsReset({ keepStarted: true });
  });

  // Start test (как фото 5: после клика показываем вопросы)
  els.btnStart.addEventListener("click", () => {
    loadSettingsFromUI();
    state.started = true;
    state.showDetails = true; // сразу показываем детали
    state.filter = "all";
    state.singleIndex = 0;
    syncDetailButtonLabel();

    state.viewBuilt = false;
    state.viewQuestions = [];

    renderAll();
    window.scrollTo({ top: document.querySelector("#questions").offsetTop - 80, behavior: "smooth" });
  });

  // Reset test (вернуть как фото 4)
  els.btnReset.addEventListener("click", () => {
    applySettingsReset({ keepStarted: false });
  });

  // Toggle details (сводка+вопросы)
  els.btnToggleResults.addEventListener("click", () => {
    if (!state.started){
      // до старта ничего не показываем
      state.showDetails = false;
      syncDetailButtonLabel();
      renderAll();
      return;
    }
    state.showDetails = !state.showDetails;
    syncDetailButtonLabel();
    renderAll();
  });

  // single navigation
  els.prevQ.addEventListener("click", () => { state.singleIndex--; renderAll(); });
  els.nextQ.addEventListener("click", () => { state.singleIndex++; renderAll(); });

  // re-render when radios changed (не стартует тест)
  document.querySelectorAll('input[name="mode"], input[name="testType"]').forEach(r => {
    r.addEventListener("change", () => {
        loadSettingsFromUI();
        // Ничего не пересобираем и не ререндерим вопросы!
        // Пользователь применяет изменения только кнопкой "Применить"
    });
  });


  // initial (как фото 4)
  loadSettingsFromUI();
  state.started = false;
  state.showDetails = false;
  syncDetailButtonLabel();
  renderAll();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:16px">Ошибка загрузки: ${String(err)}</pre>`;
});
