const STORAGE_KEY = "tasks_v1";
const STATUSES = ["do", "doing", "done"];
const STATUS_LABELS = { do: "Do", doing: "Doing", done: "Done" };
const PRIORITY_LABELS = { high: "高", medium: "中", low: "低" };

let tasks = [];
let editingId = null;
let dragSrcId = null;

// ===== Storage =====
function load() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { tasks = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

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
  card.draggable = true;

  const dlClass = deadlineClass(task.deadline);
  const dlText = task.deadline ? `📅 ${formatDate(task.deadline)}${dlClass === "overdue" ? " 期限切れ" : dlClass === "soon" ? " まもなく" : ""}` : "";

  card.innerHTML = `
    <div class="task-card-title">${escHtml(task.title)}</div>
    <div class="task-card-meta">
      <span class="priority-badge ${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
      ${task.deadline ? `<span class="deadline-badge ${dlClass}">${dlText}</span>` : ""}
      ${task.comment ? `<span class="comment-icon">💬</span>` : ""}
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
      moveTask(task.id, btn.dataset.move);
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

// ===== Move =====
function moveTask(id, newStatus) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.status = newStatus;
    save();
    render();
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
      moveTask(dragSrcId, status);
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
      id:       uid(),
      title,
      priority: inputPriority.value,
      deadline: inputDeadline.value,
      comment:  inputComment.value.trim(),
      status:   "do",
      createdAt: new Date().toISOString(),
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
