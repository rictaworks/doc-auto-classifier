(function () {
  "use strict";

  const API = {
    FILES: "/api/files",
    CATEGORIES: "/api/categories",
  };

  const state = {
    page: 1,
    query: "",
    categoryId: null,
    tag: "",
    categories: [],
    tagTargetFileId: null,
  };

  // --- DOM refs ---
  const fileList = document.getElementById("file-list");
  const totalCount = document.getElementById("total-count");
  const pagination = document.getElementById("pagination");
  const emptyState = document.getElementById("empty-state");
  const filterCategoryEl = document.getElementById("filter-category");

  const modalBackdrop = document.getElementById("modal-backdrop");
  const uploadForm = document.getElementById("upload-form");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const selectedFile = document.getElementById("selected-file");
  const selectedFilename = document.getElementById("selected-filename");
  const uploadError = document.getElementById("upload-error");

  const tagModalBackdrop = document.getElementById("tag-modal-backdrop");
  const tagInput = document.getElementById("tag-input");

  const previewModalBackdrop = document.getElementById("preview-modal-backdrop");
  const previewTitle = document.getElementById("preview-title");
  const previewContent = document.getElementById("preview-content");

  // --- Utilities ---
  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP") + " " + d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }

  function showError(msg) {
    uploadError.textContent = msg;
    uploadError.classList.remove("hidden");
  }

  function hideError() {
    uploadError.classList.add("hidden");
  }

  // --- API calls ---
  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "エラーが発生しました" }));
      throw new Error(err.detail || "エラーが発生しました");
    }
    return res.json();
  }

  // --- Categories ---
  async function loadCategories() {
    state.categories = await fetchJson(API.CATEGORIES);
    filterCategoryEl.innerHTML = '<option value="">すべて</option>';
    state.categories.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      filterCategoryEl.appendChild(opt);
    });
  }

  function categoryById(id) {
    return state.categories.find(function (c) { return c.id === id; }) || { name: "その他", color_code: "#B0B0B0" };
  }

  // --- File list rendering ---
  async function loadFiles() {
    const params = new URLSearchParams({ page: state.page });
    if (state.query) params.set("query", state.query);
    if (state.categoryId) params.set("category_id", state.categoryId);
    if (state.tag) params.set("tag", state.tag);

    const data = await fetchJson(API.FILES + "?" + params.toString());

    totalCount.textContent = data.total + " 件";
    emptyState.style.display = data.total === 0 ? "" : "none";

    fileList.querySelectorAll(".file-row").forEach(function (el) { el.remove(); });

    data.items.forEach(function (f) {
      const cat = f.category;
      const bgLight = cat.color_code + "33";
      const row = document.createElement("div");
      row.className = "file-row px-4 py-3 hover:bg-gray-50 transition";
      row.innerHTML = `
        <div class="flex flex-wrap items-start gap-3">
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-gray-800 text-sm truncate max-w-xs"
                title="${escHtml(f.original_name)}">${escHtml(f.original_name)}</span>
              <span class="category-badge" style="background:${bgLight};color:${cat.color_code}">${escHtml(cat.name)}</span>
            </div>
            <div class="text-xs text-gray-400 flex flex-wrap gap-3">
              <span><i class="fa-solid fa-weight-hanging mr-1"></i>${formatBytes(f.file_size)}</span>
              <span><i class="fa-solid fa-clock mr-1"></i>${formatDate(f.uploaded_at)}</span>
              ${f.summary ? `<span class="text-gray-500 truncate max-w-xs" title="${escHtml(f.summary)}">${escHtml(f.summary.substring(0, 60))}${f.summary.length > 60 ? "..." : ""}</span>` : ""}
            </div>
            <div class="flex flex-wrap gap-1 mt-1">
              ${f.tags.map(function (t) {
                return `<span class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  <i class="fa-solid fa-tag text-gray-400" style="font-size:0.65rem"></i>${escHtml(t.name)}
                  <button class="btn-remove-tag hover:text-red-500 ml-0.5" data-file-id="${f.id}" data-tag="${escHtml(t.name)}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </span>`;
              }).join("")}
              <button class="btn-add-tag inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full transition"
                data-file-id="${f.id}">
                <i class="fa-solid fa-plus" style="font-size:0.65rem"></i> タグ追加
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <select class="cat-select border rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
              data-file-id="${f.id}">
              ${state.categories.map(function (c) {
                return `<option value="${c.id}" ${c.id === cat.id ? "selected" : ""}>${escHtml(c.name)}</option>`;
              }).join("")}
            </select>
            ${isTextFile(f.mime_type) ? `<button class="btn-preview text-gray-400 hover:text-purple-500 transition text-sm" data-file-id="${f.id}" title="プレビュー">
              <i class="fa-solid fa-eye"></i>
            </button>` : ""}
            <a href="/api/files/${f.id}/download" class="text-gray-400 hover:text-blue-500 transition text-sm" title="ダウンロード">
              <i class="fa-solid fa-download"></i>
            </a>
            <button class="btn-delete text-gray-400 hover:text-red-500 transition text-sm" data-file-id="${f.id}" title="削除">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
      fileList.appendChild(row);
    });

    renderPagination(data.total, data.page, data.page_size);
  }

  function isTextFile(mime) {
    return mime && (mime.startsWith("text/") || mime === "application/json");
  }

  function renderPagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    pagination.innerHTML = "";
    if (totalPages <= 1) {
      pagination.classList.add("hidden");
      return;
    }
    pagination.classList.remove("hidden");

    function btn(label, targetPage, disabled, active) {
      const el = document.createElement("button");
      el.textContent = label;
      el.disabled = disabled;
      el.className = [
        "px-3 py-1 rounded text-sm border transition",
        active ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-100",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ");
      if (!disabled) {
        el.addEventListener("click", function () {
          state.page = targetPage;
          loadFiles();
        });
      }
      return el;
    }

    pagination.appendChild(btn("前へ", page - 1, page === 1, false));
    for (let i = 1; i <= totalPages; i++) {
      pagination.appendChild(btn(i, i, false, i === page));
    }
    pagination.appendChild(btn("次へ", page + 1, page === totalPages, false));
  }

  // --- Event delegation for file list ---
  fileList.addEventListener("change", async function (e) {
    if (!e.target.classList.contains("cat-select")) return;
    const fileId = e.target.dataset.fileId;
    const categoryId = parseInt(e.target.value, 10);
    await fetchJson(API.FILES + "/" + fileId + "/category", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    });
    loadFiles();
  });

  fileList.addEventListener("click", async function (e) {
    const deleteBtn = e.target.closest(".btn-delete");
    if (deleteBtn) {
      const fileId = deleteBtn.dataset.fileId;
      await fetchJson(API.FILES + "/" + fileId, { method: "DELETE" });
      loadFiles();
      return;
    }

    const addTagBtn = e.target.closest(".btn-add-tag");
    if (addTagBtn) {
      state.tagTargetFileId = addTagBtn.dataset.fileId;
      tagInput.value = "";
      tagModalBackdrop.classList.remove("hidden");
      tagModalBackdrop.classList.add("flex");
      tagInput.focus();
      return;
    }

    const removeTagBtn = e.target.closest(".btn-remove-tag");
    if (removeTagBtn) {
      const fileId = removeTagBtn.dataset.fileId;
      const tagName = removeTagBtn.dataset.tag;
      await fetchJson(API.FILES + "/" + fileId + "/tags/" + encodeURIComponent(tagName), { method: "DELETE" });
      loadFiles();
      return;
    }

    const previewBtn = e.target.closest(".btn-preview");
    if (previewBtn) {
      const fileId = previewBtn.dataset.fileId;
      const resp = await fetch(API.FILES + "/" + fileId + "/download");
      const text = await resp.text();
      const row = previewBtn.closest(".file-row");
      const fname = row.querySelector(".font-medium").textContent;
      previewTitle.innerHTML = `<i class="fa-solid fa-eye text-purple-500 mr-2"></i>${escHtml(fname)}`;
      previewContent.textContent = text;
      previewModalBackdrop.classList.remove("hidden");
      previewModalBackdrop.classList.add("flex");
    }
  });

  // --- Upload modal ---
  document.getElementById("btn-upload-open").addEventListener("click", function () {
    modalBackdrop.classList.add("open");
    hideError();
  });

  function closeUploadModal() {
    modalBackdrop.classList.remove("open");
    uploadForm.reset();
    selectedFile.classList.add("hidden");
    hideError();
    fileInput.value = "";
  }

  document.getElementById("btn-modal-close").addEventListener("click", closeUploadModal);
  document.getElementById("btn-cancel").addEventListener("click", closeUploadModal);

  modalBackdrop.addEventListener("click", function (e) {
    if (e.target === modalBackdrop) closeUploadModal();
  });

  dropZone.addEventListener("click", function () { fileInput.click(); });

  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("active");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("active");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("active");
    const f = e.dataTransfer.files[0];
    if (f) setSelectedFile(f);
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) setSelectedFile(fileInput.files[0]);
  });

  function setSelectedFile(f) {
    selectedFilename.textContent = f.name;
    selectedFile.classList.remove("hidden");
    hideError();
  }

  document.getElementById("btn-clear-file").addEventListener("click", function () {
    fileInput.value = "";
    selectedFile.classList.add("hidden");
    hideError();
  });

  uploadForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideError();

    if (!fileInput.files[0]) {
      showError("ファイルを選択してください");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("hp_field", "");

    try {
      await fetchJson(API.FILES + "/upload", { method: "POST", body: formData });
      closeUploadModal();
      state.page = 1;
      loadFiles();
    } catch (err) {
      showError(err.message);
    }
  });

  // --- Search / Filter ---
  document.getElementById("btn-search").addEventListener("click", function () {
    state.page = 1;
    state.query = document.getElementById("search-query").value.trim();
    state.categoryId = filterCategoryEl.value || null;
    state.tag = document.getElementById("filter-tag").value.trim();
    loadFiles();
  });

  document.getElementById("btn-reset").addEventListener("click", function () {
    document.getElementById("search-query").value = "";
    filterCategoryEl.value = "";
    document.getElementById("filter-tag").value = "";
    state.query = "";
    state.categoryId = null;
    state.tag = "";
    state.page = 1;
    loadFiles();
  });

  // --- Tag modal ---
  function closeTagModal() {
    tagModalBackdrop.classList.remove("flex");
    tagModalBackdrop.classList.add("hidden");
    state.tagTargetFileId = null;
  }

  document.getElementById("btn-tag-modal-close").addEventListener("click", closeTagModal);
  document.getElementById("btn-tag-cancel").addEventListener("click", closeTagModal);

  document.getElementById("btn-tag-submit").addEventListener("click", async function () {
    const name = tagInput.value.trim();
    if (!name) return;
    await fetchJson(API.FILES + "/" + state.tagTargetFileId + "/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name }),
    });
    closeTagModal();
    loadFiles();
  });

  tagInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("btn-tag-submit").click();
  });

  // --- Preview modal ---
  document.getElementById("btn-preview-close").addEventListener("click", function () {
    previewModalBackdrop.classList.remove("flex");
    previewModalBackdrop.classList.add("hidden");
  });

  previewModalBackdrop.addEventListener("click", function (e) {
    if (e.target === previewModalBackdrop) {
      previewModalBackdrop.classList.remove("flex");
      previewModalBackdrop.classList.add("hidden");
    }
  });

  // --- Init ---
  (async function init() {
    await loadCategories();
    await loadFiles();
  })();
})();
