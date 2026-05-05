const STORAGE_KEY = "tasks_v1";
const STATUSES = ["do", "doing", "done"];
const STATUS_LABELS = { do: "食材", doing: "調理中", done: "完了" };
const POT_THRESHOLD = 3;
const PRIORITY_LABELS = { high: "高", medium: "中", low: "低" };

const INGREDIENT_EMOJIS = ["🥕","🥦","🧅","🍅","🍆","🫑","🥑","🌽","🥔","🧄","🍋","🫐","🥝","🍄","🌶️","🥚","🍖","🧀","🌿","🥒"];
const DISH_EMOJIS = ["🍜","🍛","🍕","🥗","🍱","🍣","🥩","🍝","🫔","🥙","🍲","🥘","🫕","🍤","🍗","🌮","🍚","🥞","🎂","🥐"];

// 食材カテゴリ
const INGREDIENT_CATEGORIES = {
  "🥕":"vegetable","🥦":"vegetable","🧅":"vegetable","🍅":"vegetable",
  "🍆":"vegetable","🫑":"vegetable","🥒":"vegetable",
  "🌽":"grain",
  "🥑":"fat",    "🧀":"dairy",  "🥔":"starch",
  "🧄":"aromatic","🌿":"aromatic",
  "🫐":"fruit",  "🥝":"fruit",  "🍋":"citrus",
  "🍄":"umami",  "🌶️":"spicy",  "🥚":"egg",    "🍖":"meat",
};

// レシピ定義（食材カテゴリのスコアで料理決定）
const RECIPES = [
  { emoji:"🍜", name:"ラーメン",     weights:{ umami:3, meat:2, aromatic:2, egg:1 } },
  { emoji:"🍛", name:"カレーライス", weights:{ spicy:3, vegetable:2, starch:2 } },
  { emoji:"🍕", name:"ピザ",         weights:{ dairy:3, meat:2, vegetable:1 } },
  { emoji:"🥗", name:"サラダ",       weights:{ vegetable:3, fruit:2, fat:2, citrus:1 } },
  { emoji:"🍱", name:"お弁当",       weights:{ meat:2, vegetable:2, starch:2, egg:1 } },
  { emoji:"🍣", name:"お寿司",       weights:{ umami:3, aromatic:2, citrus:1 } },
  { emoji:"🥩", name:"ステーキ",     weights:{ meat:4, aromatic:2, fat:1 } },
  { emoji:"🍝", name:"パスタ",       weights:{ dairy:2, vegetable:2, aromatic:2, umami:1 } },
  { emoji:"🫔", name:"ブリトー",     weights:{ meat:2, starch:2, spicy:2, vegetable:1 } },
  { emoji:"🥙", name:"ケバブ",       weights:{ meat:3, vegetable:2, aromatic:2 } },
  { emoji:"🍲", name:"煮込み料理",   weights:{ vegetable:2, meat:2, umami:2, aromatic:1 } },
  { emoji:"🥘", name:"シチュー",     weights:{ vegetable:2, starch:2, dairy:2, meat:1 } },
  { emoji:"🫕", name:"フォンデュ鍋", weights:{ dairy:4, starch:2 } },
  { emoji:"🍤", name:"エビフライ",   weights:{ egg:3, meat:2, starch:1 } },
  { emoji:"🍗", name:"から揚げ",     weights:{ meat:3, aromatic:2 } },
  { emoji:"🌮", name:"タコス",       weights:{ meat:2, spicy:2, vegetable:2, fat:1 } },
  { emoji:"🍚", name:"白ごはん",     weights:{ grain:3, starch:2 } },
  { emoji:"🥞", name:"パンケーキ",   weights:{ dairy:2, egg:3, fruit:1 } },
  { emoji:"🎂", name:"ケーキ",       weights:{ dairy:2, egg:2, fruit:3, citrus:1 } },
  { emoji:"🥐", name:"クロワッサン", weights:{ dairy:4, starch:1 } },
];


// 食材の組み合わせから料理を決定
function pickDish(emojiList) {
  const cats = {};
  for (const e of emojiList) {
    const c = INGREDIENT_CATEGORIES[e] || "other";
    cats[c] = (cats[c] || 0) + 1;
  }
  let best = RECIPES[0];
  let bestScore = -1;
  for (const recipe of RECIPES) {
    let score = 0;
    for (const [cat, w] of Object.entries(recipe.weights)) {
      score += (cats[cat] || 0) * w;
    }
    if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      best = recipe;
    }
  }
  return best;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let tasks = [];
let editingId = null;
let dragSrcId = null;
let pot       = [];
let table     = [];
let isCooking = false;

// ===== Storage =====
function load() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { tasks = []; }
  let migrated = false;
  tasks.forEach((t) => {
    if (!t.ingredient) { t.ingredient = randomFrom(INGREDIENT_EMOJIS); migrated = true; }
    if (!t.dish)       { t.dish       = randomFrom(DISH_EMOJIS);       migrated = true; }
  });
  if (migrated) save();
  loadPot();
  loadTable();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadPot()  { try { pot   = JSON.parse(localStorage.getItem("pot_v1"))   || []; } catch { pot   = []; } }
function savePot()  { localStorage.setItem("pot_v1",   JSON.stringify(pot));  }
function loadTable(){ try { table = JSON.parse(localStorage.getItem("table_v1")) || []; } catch { table = []; } }
function saveTable(){ localStorage.setItem("table_v1", JSON.stringify(table)); }

// ===== Helpers =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function deadlineClass(dateStr) {
  if (!dateStr) return "";
  const diff = (new Date(dateStr) - new Date(today())) / 86400000;
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ===== Render =====
function render() {
  STATUSES.forEach((status) => {
    const list = document.getElementById(`list-${status}`);
    const count = document.getElementById(`count-${status}`);
    const filtered = tasks.filter((t) => t.status === status);
    count.textContent = filtered.length;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">タスクなし</div>`;
      return;
    }

    list.innerHTML = "";
    filtered.forEach((task) => {
      list.appendChild(createCard(task));
    });
  });
}

function createCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.dataset.status   = task.status;
  card.draggable = true;

  const dlClass = deadlineClass(task.deadline);
  const dlText  = task.deadline ? `📅 ${formatDate(task.deadline)}${dlClass === "overdue" ? " 期限切れ" : dlClass === "soon" ? " まもなく" : ""}` : "";
  const emoji   = task.ingredient || "🥬";
  const steam   = task.status === "doing"
    ? `<div class="steam-wrap"><span></span><span></span><span></span></div>` : "";

  card.innerHTML = `
    <div class="task-card-inner">
      <div class="task-card-emoji-wrap">
        ${steam}
        <span class="task-emoji">${emoji}</span>
      </div>
      <div class="task-card-content">
        <div class="task-card-title">${escHtml(task.title)}</div>
        <div class="task-card-meta">
          <span class="priority-badge ${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
          ${task.deadline ? `<span class="deadline-badge ${dlClass}">${dlText}</span>` : ""}
          ${task.comment ? `<span class="comment-icon">💬</span>` : ""}
        </div>
      </div>
    </div>
    <div class="task-card-actions">
      ${prevStatus(task.status) ? `<button class="move-btn" data-move="${prevStatus(task.status)}">◀ ${STATUS_LABELS[prevStatus(task.status)]}</button>` : ""}
      ${nextStatus(task.status) ? `<button class="move-btn" data-move="${nextStatus(task.status)}">${STATUS_LABELS[nextStatus(task.status)]} ▶</button>` : ""}
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.closest(".move-btn")) return;
    openDetail(task.id);
  });

  card.querySelectorAll(".move-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = btn.getBoundingClientRect();
      moveTask(task.id, btn.dataset.move, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  });

  card.addEventListener("dragstart", (e) => {
    dragSrcId = task.id;
    setTimeout(() => card.classList.add("dragging"), 0);
    e.dataTransfer.effectAllowed = "move";
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    dragSrcId = null;
  });

  return card;
}

function prevStatus(s) {
  const i = STATUSES.indexOf(s);
  return i > 0 ? STATUSES[i - 1] : null;
}

function nextStatus(s) {
  const i = STATUSES.indexOf(s);
  return i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ===== Pot & Cooking =====
function flyIngredient(emoji, fromX, fromY) {
  const el = document.createElement("div");
  el.className  = "flying-ingredient";
  el.textContent = emoji;
  el.style.left  = fromX + "px";
  el.style.top   = fromY + "px";
  document.body.appendChild(el);

  const pr = document.getElementById("pot-widget").getBoundingClientRect();
  const dx = pr.left + 80 - fromX;
  const dy = pr.top  + pr.height / 2 - fromY;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.25)`;
    el.style.opacity   = "0";
  }));
  setTimeout(() => el.remove(), 900);
}

function renderPot() {
  document.getElementById("pot-count").textContent = pot.length;
  const row = document.getElementById("pot-ingredients-row");
  row.innerHTML = pot.length === 0
    ? `<span class="pot-hint">タスクを完了すると食材が入ります</span>`
    : pot.map((i) => `<span class="pot-ingredient-emoji">${i.emoji}</span>`).join("");
}

function updateBadge() {
  const badge = document.getElementById("dish-count-badge");
  badge.textContent = table.length;
  badge.classList.toggle("hidden", table.length === 0);
}

function startCooking() {
  const ingredients = pot.splice(0, POT_THRESHOLD);
  pot = [];
  savePot();
  renderPot();

  const recipe    = pickDish(ingredients.map((i) => i.emoji));
  const overlay   = document.getElementById("cooking-overlay");
  const ingRow    = document.getElementById("cooking-ing-row");
  const phaseCook = document.getElementById("phase-cooking");
  const phaseDone = document.getElementById("phase-done");

  ingRow.innerHTML = ingredients.map((ing, i) =>
    `<span class="cooking-ing-emoji" style="--delay:${i * 0.2}s">${ing.emoji}</span>`
  ).join("");

  phaseCook.classList.remove("hidden");
  phaseDone.classList.add("hidden");
  overlay.classList.remove("hidden");

  setTimeout(() => {
    phaseCook.classList.add("hidden");
    document.getElementById("cooking-dish-icon").textContent = recipe.emoji;
    document.getElementById("cooking-dish-name").textContent = recipe.name;
    phaseDone.classList.remove("hidden");
    table.push({
      dishEmoji:   recipe.emoji,
      dishName:    recipe.name,
      ingredients: ingredients.map((i) => i.emoji),
      cookedAt:    new Date().toISOString(),
    });
    saveTable();
    updateBadge();
  }, 3400);

  setTimeout(() => {
    overlay.classList.add("hidden");
    isCooking = false;
  }, 5400);
}

function addIngredientToPot(task, fromPos) {
  if (isCooking) return;
  pot.push({ emoji: task.ingredient || "🥬", title: task.title });
  savePot();

  if (fromPos) flyIngredient(task.ingredient || "🥬", fromPos.x, fromPos.y);

  setTimeout(() => {
    renderPot();
    if (!isCooking && pot.length >= POT_THRESHOLD) {
      isCooking = true;
      setTimeout(startCooking, 400);
    }
  }, fromPos ? 880 : 0);
}

// ===== Move =====
function moveTask(id, newStatus, fromPos) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    const wasNotDone = task.status !== "done";
    task.status = newStatus;
    save();
    render();
    if (newStatus === "done" && wasNotDone) addIngredientToPot(task, fromPos);
  }
}

// ===== Drag & Drop on columns =====
STATUSES.forEach((status) => {
  const list = document.getElementById(`list-${status}`);

  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    list.classList.add("drag-over");
    e.dataTransfer.dropEffect = "move";
  });

  list.addEventListener("dragleave", () => {
    list.classList.remove("drag-over");
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    list.classList.remove("drag-over");
    if (dragSrcId) {
      moveTask(dragSrcId, status, { x: e.clientX, y: e.clientY });
    }
  });
});

// ===== Modal (Add / Edit) =====
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle  = document.getElementById("modal-title");
const inputTitle    = document.getElementById("task-title");
const inputPriority = document.getElementById("task-priority");
const inputDeadline = document.getElementById("task-deadline");
const inputComment  = document.getElementById("task-comment");

function openModal(task = null) {
  editingId = task ? task.id : null;
  modalTitle.textContent = task ? "タスクを編集" : "タスクを追加";
  inputTitle.value    = task ? task.title    : "";
  inputPriority.value = task ? task.priority : "medium";
  inputDeadline.value = task ? task.deadline : "";
  inputComment.value  = task ? task.comment  : "";
  modalOverlay.classList.remove("hidden");
  inputTitle.focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  editingId = null;
}

document.getElementById("add-task-btn").addEventListener("click", () => openModal());
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

document.getElementById("modal-save").addEventListener("click", () => {
  const title = inputTitle.value.trim();
  if (!title) {
    inputTitle.focus();
    inputTitle.style.borderColor = "#ef4444";
    setTimeout(() => inputTitle.style.borderColor = "", 1200);
    return;
  }

  if (editingId) {
    const task = tasks.find((t) => t.id === editingId);
    if (task) {
      task.title    = title;
      task.priority = inputPriority.value;
      task.deadline = inputDeadline.value;
      task.comment  = inputComment.value.trim();
    }
  } else {
    tasks.push({
      id:         uid(),
      title,
      priority:   inputPriority.value,
      deadline:   inputDeadline.value,
      comment:    inputComment.value.trim(),
      status:     "do",
      ingredient: randomFrom(INGREDIENT_EMOJIS),
      dish:       randomFrom(DISH_EMOJIS),
      createdAt:  new Date().toISOString(),
    });
  }

  save();
  render();
  closeModal();
});

// Enter key submits modal
inputTitle.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("modal-save").click();
});

// ===== Detail Modal =====
const detailOverlay = document.getElementById("detail-overlay");
let detailId = null;

function openDetail(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  detailId = id;

  document.getElementById("detail-title").textContent   = task.title;
  document.getElementById("detail-status").textContent  = STATUS_LABELS[task.status];
  document.getElementById("detail-deadline").textContent = formatDate(task.deadline);
  document.getElementById("detail-comment").textContent  = task.comment || "コメントなし";

  const badge = document.getElementById("detail-priority");
  badge.textContent  = PRIORITY_LABELS[task.priority];
  badge.className    = `priority-badge ${task.priority}`;

  detailOverlay.classList.remove("hidden");
}

function closeDetail() {
  detailOverlay.classList.add("hidden");
  detailId = null;
}

document.getElementById("detail-close").addEventListener("click", closeDetail);
document.getElementById("detail-close-btn").addEventListener("click", closeDetail);
detailOverlay.addEventListener("click", (e) => { if (e.target === detailOverlay) closeDetail(); });

document.getElementById("detail-edit").addEventListener("click", () => {
  const task = tasks.find((t) => t.id === detailId);
  closeDetail();
  openModal(task);
});

document.getElementById("detail-delete").addEventListener("click", () => {
  if (!detailId) return;
  const task = tasks.find((t) => t.id === detailId);
  if (task && confirm(`「${task.title}」を削除しますか？`)) {
    tasks = tasks.filter((t) => t.id !== detailId);
    save();
    render();
    closeDetail();
  }
});

// ===== Keyboard shortcuts =====
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!modalOverlay.classList.contains("hidden")) closeModal();
    if (!detailOverlay.classList.contains("hidden")) closeDetail();
  }
});

// ===== Init =====
load();
render();
renderPot();
updateBadge();
