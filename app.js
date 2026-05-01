const STORAGE_KEY = "swim-attendance-journal-v1";

const dayOptions = [
  { value: 1, short: "Пн", full: "понедельник" },
  { value: 2, short: "Вт", full: "вторник" },
  { value: 3, short: "Ср", full: "среда" },
  { value: 4, short: "Чт", full: "четверг" },
  { value: 5, short: "Пт", full: "пятница" },
  { value: 6, short: "Сб", full: "суббота" },
  { value: 0, short: "Вс", full: "воскресенье" },
];

const attendanceFlow = ["", "+", "-"];

const themeChoices = [
  { value: "white", label: "Белая", swatch: "#ffffff" },
  { value: "amoled", label: "Черная", swatch: "#000000" },
  { value: "navy", label: "Темносиняя", swatch: "#172033" },
  { value: "gray", label: "Серая", swatch: "#dedede" },
];

const elements = {
  homeView: document.querySelector("#homeView"),
  poolView: document.querySelector("#poolView"),
  homeSummary: document.querySelector("#homeSummary"),
  homeDateInput: document.querySelector("#homeDateInput"),
  homeGroupTabs: document.querySelector("#homeGroupTabs"),
  homeGroupPanel: document.querySelector("#homeGroupPanel"),
  backHomeButton: document.querySelector("#backHomeButton"),
  currentPoolTitle: document.querySelector("#currentPoolTitle"),
  currentPoolSubtitle: document.querySelector("#currentPoolSubtitle"),
  poolList: document.querySelector("#poolList"),
  newPoolButton: document.querySelector("#newPoolButton"),
  deletePoolButton: document.querySelector("#deletePoolButton"),
  deletePoolTextButton: document.querySelector("#deletePoolTextButton"),
  poolForm: document.querySelector("#poolForm"),
  poolFormTitle: document.querySelector("#poolFormTitle"),
  poolNameInput: document.querySelector("#poolNameInput"),
  groupList: document.querySelector("#groupList"),
  groupsPanelTitle: document.querySelector("#groupsPanelTitle"),
  themeOptions: document.querySelector("#themeOptions"),
  newGroupButton: document.querySelector("#newGroupButton"),
  deleteGroupButton: document.querySelector("#deleteGroupButton"),
  groupForm: document.querySelector("#groupForm"),
  groupFormTitle: document.querySelector("#groupFormTitle"),
  groupStartInput: document.querySelector("#groupStartInput"),
  groupEndInput: document.querySelector("#groupEndInput"),
  dayPills: document.querySelector("#dayPills"),
  activeGroupTitle: document.querySelector("#activeGroupTitle"),
  activeGroupSchedule: document.querySelector("#activeGroupSchedule"),
  monthInput: document.querySelector("#monthInput"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  exportButton: document.querySelector("#exportButton"),
  studentForm: document.querySelector("#studentForm"),
  studentNameInput: document.querySelector("#studentNameInput"),
  studentBirthYearInput: document.querySelector("#studentBirthYearInput"),
  studentModal: document.querySelector("#studentModal"),
  editStudentForm: document.querySelector("#editStudentForm"),
  editStudentNameInput: document.querySelector("#editStudentNameInput"),
  editStudentBirthYearInput: document.querySelector("#editStudentBirthYearInput"),
  closeStudentModalButton: document.querySelector("#closeStudentModalButton"),
  cancelStudentEditButton: document.querySelector("#cancelStudentEditButton"),
  transferStudentModal: document.querySelector("#transferStudentModal"),
  transferStudentForm: document.querySelector("#transferStudentForm"),
  transferStudentNameInput: document.querySelector("#transferStudentNameInput"),
  transferStudentTargetSelect: document.querySelector("#transferStudentTargetSelect"),
  closeTransferStudentModalButton: document.querySelector("#closeTransferStudentModalButton"),
  cancelTransferStudentButton: document.querySelector("#cancelTransferStudentButton"),
  stats: document.querySelector("#stats"),
  journalTable: document.querySelector("#journalTable"),
  emptyState: document.querySelector("#emptyState"),
};

let state = loadState();
let editingPoolId = state.selectedPoolId || null;
let editingGroupId = state.selectedGroupId || null;
let editingStudentId = null;
let transferStudentId = null;
let draggedGroupId = null;
let currentView = "home";
let selectedDayValues = new Set([1, 3, 5]);
let selectedQuickGroupId = null;

applyTheme(state.theme);
elements.monthInput.value = state.month || toMonthValue(new Date());
elements.homeDateInput.value = state.homeDate || toIsoDate(new Date());
elements.studentBirthYearInput.max = String(new Date().getFullYear());
elements.editStudentBirthYearInput.max = String(new Date().getFullYear());

if (!state.pools.length) {
  state = createSeedState();
  editingPoolId = state.selectedPoolId;
  editingGroupId = state.selectedGroupId;
  saveState();
}

wireEvents();
render();

function wireEvents() {
  elements.backHomeButton.addEventListener("click", () => {
    showHome();
  });

  elements.newPoolButton.addEventListener("click", () => {
    showHome();
    editingPoolId = null;
    renderPoolForm();
    elements.poolNameInput.focus();
  });

  elements.deletePoolButton.addEventListener("click", deleteEditingPool);
  elements.deletePoolTextButton.addEventListener("click", deleteEditingPool);

  elements.poolForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.poolNameInput.value.trim();

    if (!name) {
      window.alert("Укажите название бассейна.");
      return;
    }

    if (editingPoolId) {
      const pool = getPool(editingPoolId);
      if (!pool) return;
      pool.name = name;
    } else {
      const pool = {
        id: createId("pool"),
        name,
      };
      state.pools.push(pool);
      state.selectedPoolId = pool.id;
      state.selectedGroupId = null;
      editingPoolId = pool.id;
      editingGroupId = null;
    }

    saveState();
    render();
  });

  elements.poolList.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-pool-id]");
    const poolCard = event.target.closest("[data-pool-id]");
    if (!poolCard) return;

    selectPool(poolCard.dataset.poolId);

    if (openButton) {
      showPool();
      return;
    }

    render();
  });

  elements.poolList.addEventListener("dblclick", (event) => {
    const poolCard = event.target.closest("[data-pool-id]");
    if (!poolCard) return;

    selectPool(poolCard.dataset.poolId);
    showPool();
  });

  function selectPool(poolId) {
    state.selectedPoolId = poolId;
    state.selectedGroupId = getGroupsForSelectedPool()[0]?.id || null;
    editingPoolId = state.selectedPoolId;
    editingGroupId = state.selectedGroupId;
    saveState();
  }

  elements.homeDateInput.addEventListener("change", () => {
    state.homeDate = normalizeIsoDate(elements.homeDateInput.value) || toIsoDate(new Date());
    elements.homeDateInput.value = state.homeDate;
    selectedQuickGroupId = null;
    saveState();
    renderHomeQuickAttendance();
  });

  elements.homeGroupTabs.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-quick-group-id]");
    if (!tabButton) return;

    selectedQuickGroupId = tabButton.dataset.quickGroupId;
    renderHomeQuickAttendance();
  });

  elements.homeGroupPanel.addEventListener("click", (event) => {
    const markButton = event.target.closest("[data-quick-mark-group-id][data-quick-mark-student-id][data-quick-mark-value]");
    if (!markButton) return;

    const nextValue = markButton.dataset.quickMarkValue === "blank" ? "" : markButton.dataset.quickMarkValue;
    const date = getHomeDateValue();
    const changed = setAttendanceValue(
      markButton.dataset.quickMarkGroupId,
      markButton.dataset.quickMarkStudentId,
      date,
      nextValue,
    );

    if (!changed) return;

    renderHomeQuickAttendance();
    if (
      currentView === "pool" &&
      state.selectedGroupId === markButton.dataset.quickMarkGroupId &&
      elements.monthInput.value === date.slice(0, 7)
    ) {
      renderJournal();
      renderStats();
    }
  });

  elements.newGroupButton.addEventListener("click", () => {
    if (!state.selectedPoolId) {
      window.alert("Сначала создайте бассейн.");
      return;
    }

    editingGroupId = null;
    selectedDayValues = new Set([1, 3, 5]);
    renderGroupForm();
    elements.groupStartInput.focus();
  });

  elements.deleteGroupButton.addEventListener("click", () => {
    if (!editingGroupId) return;

    const group = getGroup(editingGroupId);
    if (!group) return;

    const confirmed = window.confirm(`Удалить группу "${group.start}" вместе с учениками и отметками?`);
    if (!confirmed) return;

    state.groups = state.groups.filter((item) => item.id !== editingGroupId);
    state.selectedGroupId = getGroupsForSelectedPool()[0]?.id || null;
    editingGroupId = state.selectedGroupId;
    saveState();
    render();
  });

  elements.groupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const start = elements.groupStartInput.value;
    const end = elements.groupEndInput.value;
    const days = dayOptions
      .map((day) => day.value)
      .filter((value) => selectedDayValues.has(value));

    if (!state.selectedPoolId) {
      window.alert("Сначала создайте бассейн.");
      return;
    }

    if (!start || !days.length) {
      window.alert("Укажите время начала и хотя бы один день тренировки.");
      return;
    }

    if (editingGroupId) {
      const group = getGroup(editingGroupId);
      if (!group) return;
      group.name = start;
      group.start = start;
      group.end = end;
      group.days = days;
    } else {
      const group = {
        id: createId("group"),
        poolId: state.selectedPoolId,
        name: start,
        start,
        end,
        days,
        students: [],
        attendance: {},
      };
      state.groups.push(group);
      state.selectedGroupId = group.id;
      editingGroupId = group.id;
    }

    saveState();
    render();
  });

  elements.groupList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group-id]");
    if (!button) return;

    state.selectedGroupId = button.dataset.groupId;
    editingGroupId = state.selectedGroupId;
    saveState();
    render();
  });

  elements.groupList.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-group-id]");
    if (!item) return;

    draggedGroupId = item.dataset.groupId;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedGroupId);
  });

  elements.groupList.addEventListener("dragover", (event) => {
    if (!draggedGroupId) return;

    const item = event.target.closest("[data-group-id]");
    if (!item || item.dataset.groupId === draggedGroupId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    showGroupDropPosition(item, getGroupDropPosition(event, item));
  });

  elements.groupList.addEventListener("drop", (event) => {
    if (!draggedGroupId) return;

    const item = event.target.closest("[data-group-id]");
    if (!item || item.dataset.groupId === draggedGroupId) return;

    event.preventDefault();
    reorderGroup(draggedGroupId, item.dataset.groupId, getGroupDropPosition(event, item));
    clearGroupDragState();
  });

  elements.groupList.addEventListener("dragend", clearGroupDragState);
  elements.groupList.addEventListener("dragleave", (event) => {
    if (!elements.groupList.contains?.(event.relatedTarget)) {
      clearGroupDropState();
    }
  });

  elements.dayPills.addEventListener("click", (event) => {
    const button = event.target.closest("[data-day-value]");
    if (!button) return;

    const day = Number(button.dataset.dayValue);
    if (selectedDayValues.has(day)) {
      selectedDayValues.delete(day);
    } else {
      selectedDayValues.add(day);
    }

    renderDayPills();
  });

  elements.prevMonthButton.addEventListener("click", () => shiftMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => shiftMonth(1));
  elements.monthInput.addEventListener("change", () => {
    state.month = elements.monthInput.value || toMonthValue(new Date());
    saveState();
    renderGroups();
    renderJournal();
    renderStats();
  });

  elements.studentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const group = getSelectedGroup();
    const name = elements.studentNameInput.value.trim();
    const birthYear = normalizeBirthYear(elements.studentBirthYearInput.value);

    if (!group || !name) return;
    if (birthYear === null) {
      window.alert("Укажите корректный год рождения.");
      return;
    }

    group.students.push({
      id: createId("student"),
      name,
      birthYear,
      activeFromMonth: elements.monthInput.value,
    });

    elements.studentNameInput.value = "";
    elements.studentBirthYearInput.value = "";
    saveState();
    renderJournal();
    renderStats();
    renderGroups();
    elements.studentNameInput.focus();
  });

  elements.journalTable.addEventListener("click", (event) => {
    const attendanceButton = event.target.closest("[data-student-id][data-date]");
    const editButton = event.target.closest("[data-edit-student-id]");
    const transferButton = event.target.closest("[data-transfer-student-id]");
    const removeButton = event.target.closest("[data-remove-student-id]");
    const deleteEverywhereButton = event.target.closest("[data-delete-student-everywhere-id]");

    if (attendanceButton) {
      setNextAttendance(attendanceButton.dataset.studentId, attendanceButton.dataset.date);
      return;
    }

    if (editButton) {
      openStudentEditor(editButton.dataset.editStudentId);
      return;
    }

    if (transferButton) {
      openStudentTransfer(transferButton.dataset.transferStudentId);
      return;
    }

    if (removeButton) {
      removeStudent(removeButton.dataset.removeStudentId);
      return;
    }

    if (deleteEverywhereButton) {
      deleteStudentEverywhere(deleteEverywhereButton.dataset.deleteStudentEverywhereId);
    }
  });

  elements.editStudentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveStudentEdits();
  });

  elements.closeStudentModalButton.addEventListener("click", closeStudentEditor);
  elements.cancelStudentEditButton.addEventListener("click", closeStudentEditor);
  elements.studentModal.addEventListener("click", (event) => {
    if (event.target === elements.studentModal) {
      closeStudentEditor();
    }
  });

  elements.transferStudentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitStudentTransfer();
  });

  elements.closeTransferStudentModalButton.addEventListener("click", closeStudentTransfer);
  elements.cancelTransferStudentButton.addEventListener("click", closeStudentTransfer);
  elements.transferStudentModal.addEventListener("click", (event) => {
    if (event.target === elements.transferStudentModal) {
      closeStudentTransfer();
    }
  });

  document.addEventListener?.("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (!elements.studentModal.hidden) {
      closeStudentEditor();
      return;
    }

    if (!elements.transferStudentModal.hidden) {
      closeStudentTransfer();
    }
  });

  elements.exportButton.addEventListener("click", exportCsv);

  elements.themeOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-value]");
    if (!button) return;

    state.theme = button.dataset.themeValue;
    applyTheme(state.theme);
    saveState();
    renderThemeOptions();
  });
}

function deleteEditingPool() {
  if (!editingPoolId) return;

  const pool = getPool(editingPoolId);
  if (!pool) return;

  const confirmed = window.confirm(`Удалить бассейн "${pool.name}" вместе со всеми группами и отметками?`);
  if (!confirmed) return;

  state.pools = state.pools.filter((item) => item.id !== editingPoolId);
  state.groups = state.groups.filter((group) => group.poolId !== editingPoolId);
  state.selectedPoolId = state.pools[0]?.id || null;
  state.selectedGroupId = getGroupsForSelectedPool()[0]?.id || null;
  editingPoolId = state.selectedPoolId;
  editingGroupId = state.selectedGroupId;
  currentView = "home";
  saveState();
  render();
}

function showHome() {
  currentView = "home";
  render();
}

function showPool() {
  if (!getSelectedPool()) {
    currentView = "home";
  } else {
    currentView = "pool";
  }

  render();
}

function openStudentEditor(studentId) {
  const group = getSelectedGroup();
  const student = group?.students.find((item) => item.id === studentId);
  if (!student) return;

  editingStudentId = studentId;
  elements.editStudentNameInput.value = student.name;
  elements.editStudentBirthYearInput.value = student.birthYear || "";
  elements.studentModal.hidden = false;
  elements.editStudentNameInput.focus();
}

function closeStudentEditor() {
  editingStudentId = null;
  elements.studentModal.hidden = true;
  elements.editStudentForm.reset();
}

function openStudentTransfer(studentId) {
  const sourceGroup = getSelectedGroup();
  const sourcePool = getSelectedPool();
  const student = sourceGroup?.students.find((item) => item.id === studentId);
  if (!sourceGroup || !student) return;

  const targets = getTransferTargetGroups(sourceGroup.id);
  if (!targets.length) {
    window.alert("Нет других групп для переноса. Сначала создайте ещё одну группу.");
    return;
  }

  transferStudentId = studentId;
  elements.transferStudentNameInput.value = `${student.name} (${sourcePool?.name || "Бассейн"} · ${sourceGroup.start})`;
  elements.transferStudentTargetSelect.innerHTML = targets
    .map(
      ({ group, pool }) =>
        `<option value="${group.id}">${escapeHtml(pool.name)} · ${escapeHtml(group.start)} · ${escapeHtml(formatDays(group.days))}</option>`,
    )
    .join("");
  elements.transferStudentModal.hidden = false;
  elements.transferStudentTargetSelect.focus();
}

function closeStudentTransfer() {
  transferStudentId = null;
  elements.transferStudentModal.hidden = true;
  elements.transferStudentForm.reset();
  elements.transferStudentTargetSelect.innerHTML = "";
}

function submitStudentTransfer() {
  const sourceGroup = getSelectedGroup();
  if (!sourceGroup || !transferStudentId) return;

  const targetGroupId = elements.transferStudentTargetSelect.value;
  if (!targetGroupId || targetGroupId === sourceGroup.id) return;

  const moved = transferStudentWithHistory(sourceGroup.id, targetGroupId, transferStudentId);
  if (!moved) {
    window.alert("Не удалось перенести ученика. Попробуйте снова.");
    return;
  }

  closeStudentTransfer();
  saveState();
  render();
}

function saveStudentEdits() {
  const group = getSelectedGroup();
  const student = group?.students.find((item) => item.id === editingStudentId);
  if (!student) return;

  const name = elements.editStudentNameInput.value.trim();
  const birthYear = normalizeBirthYear(elements.editStudentBirthYearInput.value);

  if (!name) {
    window.alert("Укажите имя ученика.");
    return;
  }

  if (birthYear === null) {
    window.alert("Укажите корректный год рождения.");
    return;
  }

  student.name = name;
  student.birthYear = birthYear;
  saveState();
  closeStudentEditor();
  renderJournal();
}

function loadState() {
  const fallback = {
    pools: [],
    groups: [],
    selectedPoolId: null,
    selectedGroupId: null,
    month: toMonthValue(new Date()),
    homeDate: toIsoDate(new Date()),
    theme: "white",
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;

    const theme = themeChoices.some((choice) => choice.value === saved.theme) ? saved.theme : fallback.theme;

    if (Array.isArray(saved.pools)) {
      const pools = saved.pools;
      const firstPoolId = pools[0]?.id || null;
      const selectedPoolId = pools.some((pool) => pool.id === saved.selectedPoolId)
        ? saved.selectedPoolId
        : firstPoolId;
      const groups = Array.isArray(saved.groups) ? saved.groups : [];
      const selectedGroup = groups.find(
        (group) => group.id === saved.selectedGroupId && group.poolId === selectedPoolId,
      );
      const firstGroup = groups.find((group) => group.poolId === selectedPoolId);

      return {
        pools,
        groups,
        selectedPoolId,
        selectedGroupId: selectedGroup?.id || firstGroup?.id || null,
        month: saved.month || fallback.month,
        homeDate: normalizeIsoDate(saved.homeDate) || fallback.homeDate,
        theme,
      };
    }

    if (!Array.isArray(saved.groups)) return fallback;

    const migratedPoolId = createId("pool");
    const groups = saved.groups.map((group) => ({
      ...group,
      poolId: group.poolId || migratedPoolId,
      name: group.start || group.name,
    }));

    return {
      pools: [
        {
          id: migratedPoolId,
          name: "Мой бассейн",
        },
      ],
      groups,
      selectedPoolId: migratedPoolId,
      selectedGroupId: saved.selectedGroupId || groups[0]?.id || null,
      month: saved.month || fallback.month,
      homeDate: normalizeIsoDate(saved.homeDate) || fallback.homeDate,
      theme,
    };
  } catch {
    return fallback;
  }
}

function createSeedState() {
  const poolId = createId("pool");
  const groupId = createId("group");
  const students = [
    ["Алина Мамбетова", "2014"],
    ["Даниил Смирнов", "2013"],
    ["Руслан Ибраев", "2015"],
  ].map(([name, birthYear]) => ({
    id: createId("student"),
    name,
    birthYear,
  }));

  return {
    pools: [
      {
        id: poolId,
        name: "Максимум",
      },
    ],
    groups: [
      {
        id: groupId,
        poolId,
        name: "18:00",
        start: "18:00",
        end: "19:00",
        days: [1, 3, 5],
        students,
        attendance: {},
      },
    ],
    selectedPoolId: poolId,
    selectedGroupId: groupId,
    month: toMonthValue(new Date()),
    homeDate: toIsoDate(new Date()),
    theme: state.theme || "white",
  };
}

function saveState() {
  state.month = elements.monthInput.value || state.month;
  state.homeDate = normalizeIsoDate(elements.homeDateInput.value) || state.homeDate || toIsoDate(new Date());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  if (!state.selectedPoolId && state.pools.length) {
    state.selectedPoolId = state.pools[0].id;
  }

  if (!getPool(state.selectedPoolId) && state.pools.length) {
    state.selectedPoolId = state.pools[0].id;
  }

  const poolGroups = getGroupsForSelectedPool();
  if (!poolGroups.some((group) => group.id === state.selectedGroupId)) {
    state.selectedGroupId = poolGroups[0]?.id || null;
  }

  if (!editingPoolId && state.selectedPoolId) {
    editingPoolId = state.selectedPoolId;
  }

  if (editingPoolId && !getPool(editingPoolId)) {
    editingPoolId = state.selectedPoolId;
  }

  if (!editingGroupId && state.selectedGroupId) {
    editingGroupId = state.selectedGroupId;
  }

  if (editingGroupId && !poolGroups.some((group) => group.id === editingGroupId)) {
    editingGroupId = state.selectedGroupId;
  }

  renderView();
  renderHomeSummary();
  renderPools();
  renderHomeQuickAttendance();
  renderGroups();
  renderThemeOptions();
  renderPoolForm();
  renderGroupForm();
  renderActiveGroup();
  renderJournal();
  renderStats();
  refreshIcons();
}

function renderView() {
  const hasPool = Boolean(getSelectedPool());
  if (currentView === "pool" && !hasPool) {
    currentView = "home";
  }

  elements.homeView.hidden = currentView !== "home";
  elements.poolView.hidden = currentView !== "pool";
}

function renderHomeSummary() {
  const groupCount = state.groups.length;
  const activeStudentCount = state.groups.reduce(
    (total, group) => total + getVisibleStudentsForMonth(group, elements.monthInput.value).length,
    0,
  );

  elements.homeSummary.innerHTML = `
    <span class="stat-pill">${state.pools.length} ${pluralize(state.pools.length, ["бассейн", "бассейна", "бассейнов"])}</span>
    <span class="stat-pill">${groupCount} ${pluralize(groupCount, ["группа", "группы", "групп"])}</span>
    <span class="stat-pill">${activeStudentCount} ${pluralize(activeStudentCount, ["ученик", "ученика", "учеников"])}</span>
  `;
}

function renderPools() {
  if (!state.pools.length) {
    elements.poolList.innerHTML = `<p class="pool-meta">Создайте первый бассейн.</p>`;
    return;
  }

  elements.poolList.innerHTML = state.pools
    .map((pool) => {
      const active = pool.id === state.selectedPoolId ? " active" : "";
      const groupCount = state.groups.filter((group) => group.poolId === pool.id).length;
      const studentCount = state.groups
        .filter((group) => group.poolId === pool.id)
        .reduce((total, group) => total + getVisibleStudentsForMonth(group, elements.monthInput.value).length, 0);
      return `
        <button class="pool-item${active}" type="button" data-pool-id="${pool.id}" aria-pressed="${pool.id === state.selectedPoolId}">
          <span class="pool-name">${escapeHtml(pool.name)}</span>
          <span class="pool-meta">${groupCount} ${pluralize(groupCount, ["группа", "группы", "групп"])} · ${studentCount} ${pluralize(studentCount, ["ученик", "ученика", "учеников"])}</span>
          <span class="pool-card-footer">
            <span class="pool-selection-label">${pool.id === editingPoolId ? "Выбран для настроек" : "Нажмите для настроек"}</span>
            <span class="pool-cta" data-open-pool-id="${pool.id}">
              <i data-lucide="arrow-right"></i>
              Открыть журнал
            </span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderHomeQuickAttendance() {
  const dateValue = getHomeDateValue();
  const selectedDate = parseIsoDate(dateValue);
  const groupsForDate = getGroupsForDate(dateValue);

  elements.homeDateInput.value = dateValue;

  if (!groupsForDate.length) {
    selectedQuickGroupId = null;
    elements.homeGroupTabs.innerHTML = `<p class="quick-empty-text">На эту дату нет групп по расписанию.</p>`;
    elements.homeGroupPanel.innerHTML = `
      <div class="quick-empty-state">
        <i data-lucide="calendar-check-2"></i>
        <h3>Групп нет</h3>
        <p>Выберите другую дату или добавьте дни тренировок в настройках групп.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  if (!groupsForDate.some((group) => group.id === selectedQuickGroupId)) {
    selectedQuickGroupId = groupsForDate[0].id;
  }

  elements.homeGroupTabs.innerHTML = groupsForDate
    .map((group) => {
      const pool = getPool(group.poolId);
      const active = group.id === selectedQuickGroupId ? " active" : "";
      return `
        <button class="quick-group-tab${active}" type="button" data-quick-group-id="${group.id}" aria-pressed="${group.id === selectedQuickGroupId}">
          <span class="quick-group-time">${escapeHtml(group.start)}</span>
          <span class="quick-group-meta">${escapeHtml(pool?.name || "Бассейн")}</span>
        </button>
      `;
    })
    .join("");

  const activeGroup = getGroup(selectedQuickGroupId) || groupsForDate[0];
  const activePool = getPool(activeGroup.poolId);
  const monthValue = dateValue.slice(0, 7);
  const visibleStudents = getVisibleStudentsForMonth(activeGroup, monthValue);
  const dayMarks = activeGroup.attendance[dateValue] || {};

  const totals = visibleStudents.reduce(
    (acc, student) => {
      const value = dayMarks[student.id] || "";
      if (value === "+") acc.present += 1;
      if (value === "-") acc.absent += 1;
      if (!value) acc.empty += 1;
      return acc;
    },
    { present: 0, absent: 0, empty: 0 },
  );

  if (!visibleStudents.length) {
    elements.homeGroupPanel.innerHTML = `
      <div class="quick-empty-state">
        <i data-lucide="users"></i>
        <h3>${escapeHtml(activePool?.name || "Бассейн")} · ${escapeHtml(activeGroup.start)}</h3>
        <p>На ${formatFullDateLabel(selectedDate)} в этой группе нет активных учеников.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  const rows = visibleStudents
    .map((student) => {
      const value = dayMarks[student.id] || "";
      const birthYear = student.birthYear ? `${escapeHtml(student.birthYear)} г.р.` : "год не указан";
      return `
        <tr>
          <th scope="row">
            <span class="quick-student-name">${escapeHtml(student.name)}</span>
            <span class="quick-student-meta">${birthYear}</span>
          </th>
          <td>
            <div class="quick-mark-controls">
              <button class="quick-mark-button${value === "+" ? " active present" : ""}" type="button" data-quick-mark-group-id="${activeGroup.id}" data-quick-mark-student-id="${student.id}" data-quick-mark-value="+" aria-label="${escapeHtml(student.name)}: был">+</button>
              <button class="quick-mark-button${value === "-" ? " active absent" : ""}" type="button" data-quick-mark-group-id="${activeGroup.id}" data-quick-mark-student-id="${student.id}" data-quick-mark-value="-" aria-label="${escapeHtml(student.name)}: не был">-</button>
              <button class="quick-mark-button${value === "" ? " active blank" : ""}" type="button" data-quick-mark-group-id="${activeGroup.id}" data-quick-mark-student-id="${student.id}" data-quick-mark-value="blank" aria-label="${escapeHtml(student.name)}: пусто">·</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.homeGroupPanel.innerHTML = `
    <div class="quick-group-header">
      <div>
        <h3>${escapeHtml(activePool?.name || "Бассейн")} · ${escapeHtml(activeGroup.start)}</h3>
        <p>${formatFullDateLabel(selectedDate)} · ${formatDays(activeGroup.days)}</p>
      </div>
      <div class="quick-group-stats">
        <span class="stat-pill">+ ${totals.present}</span>
        <span class="stat-pill">- ${totals.absent}</span>
        <span class="stat-pill">Пусто ${totals.empty}</span>
      </div>
    </div>
    <div class="quick-table-wrap">
      <table class="quick-table">
        <thead>
          <tr>
            <th scope="col">Ученик</th>
            <th scope="col">Отметка</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderThemeOptions() {
  elements.themeOptions.innerHTML = themeChoices
    .map((theme) => {
      const active = theme.value === state.theme ? " active" : "";
      const displayLabel = theme.value === "navy" ? "Синяя" : theme.label;
      return `
        <button class="theme-option${active}" type="button" data-theme-value="${theme.value}" aria-pressed="${theme.value === state.theme}">
          <span class="theme-swatch" style="--swatch: ${theme.swatch}"></span>
          ${displayLabel}
        </button>
      `;
    })
    .join("");
}

function renderPoolForm() {
  const pool = editingPoolId ? getPool(editingPoolId) : null;
  elements.poolFormTitle.textContent = pool ? "Настройки бассейна" : "Новый бассейн";
  elements.deletePoolButton.disabled = !pool;
  elements.deletePoolTextButton.disabled = !pool;
  elements.poolNameInput.value = pool?.name || "";
}

function renderGroups() {
  const pool = getSelectedPool();
  const groups = getGroupsForSelectedPool();
  const monthValue = elements.monthInput.value;

  elements.currentPoolTitle.textContent = pool?.name || "Бассейн";
  elements.currentPoolSubtitle.textContent = pool
    ? `${groups.length} ${pluralize(groups.length, ["группа", "группы", "групп"])} в расписании`
    : "Выберите бассейн на главной.";
  elements.groupsPanelTitle.textContent = "Группы";
  elements.newGroupButton.disabled = !pool;

  if (!pool) {
    elements.groupList.innerHTML = `<p class="group-meta">Создайте бассейн, чтобы добавить группы.</p>`;
    return;
  }

  if (!groups.length) {
    elements.groupList.innerHTML = `<p class="group-meta">В этом бассейне пока нет групп.</p>`;
    return;
  }

  elements.groupList.innerHTML = groups
        .map((group) => {
      const active = group.id === state.selectedGroupId ? " active" : "";
      const activeStudentCount = getVisibleStudentsForMonth(group, monthValue).length;
      return `
        <button class="group-item${active}" type="button" draggable="true" data-group-id="${group.id}">
          <span class="group-drag-handle" aria-hidden="true">
            <i data-lucide="grip-vertical"></i>
          </span>
          <span class="group-details">
            <span class="group-name">${escapeHtml(group.start)}</span>
            <span class="group-meta">${group.end ? `до ${escapeHtml(group.end)} · ` : ""}${formatDays(group.days)}</span>
            <span class="group-meta">${activeStudentCount} ${pluralize(activeStudentCount, ["ученик", "ученика", "учеников"])} в месяце</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function reorderGroup(draggedId, targetId, position) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const dragged = getGroup(draggedId);
  const target = getGroup(targetId);
  if (!dragged || !target || dragged.poolId !== target.poolId || dragged.poolId !== state.selectedPoolId) return;

  const poolGroups = getGroupsForSelectedPool();
  const nextPoolGroups = poolGroups.filter((group) => group.id !== draggedId);
  const targetIndex = nextPoolGroups.findIndex((group) => group.id === targetId);
  if (targetIndex === -1) return;

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  nextPoolGroups.splice(insertIndex, 0, dragged);
  state.groups = [...state.groups.filter((group) => group.poolId !== state.selectedPoolId), ...nextPoolGroups];
  saveState();
  renderGroups();
}

function getGroupDropPosition(event, item) {
  const rect = item.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

function showGroupDropPosition(item, position) {
  clearGroupDropState();
  item.classList.add(position === "after" ? "drop-after" : "drop-before");
}

function clearGroupDropState() {
  elements.groupList.querySelectorAll?.("[data-group-id]").forEach((item) => {
    item.classList.remove("drop-before", "drop-after");
  });
}

function clearGroupDragState() {
  draggedGroupId = null;
  elements.groupList.querySelectorAll?.("[data-group-id]").forEach((item) => {
    item.classList.remove("dragging", "drop-before", "drop-after");
  });
}

function renderGroupForm() {
  const group = editingGroupId ? getGroup(editingGroupId) : null;
  const hasPool = Boolean(getSelectedPool());
  elements.groupFormTitle.textContent = group ? "Настройки группы" : "Новая группа";
  elements.deleteGroupButton.disabled = !group;
  elements.groupStartInput.value = group?.start || "18:00";
  elements.groupEndInput.value = group?.end || "";
  elements.groupStartInput.disabled = !hasPool;
  elements.groupEndInput.disabled = !hasPool;
  elements.groupForm.querySelector("button[type='submit']").disabled = !hasPool;
  selectedDayValues = new Set(group?.days || Array.from(selectedDayValues));
  renderDayPills();
}

function renderDayPills() {
  const disabled = getSelectedPool() ? "" : " disabled";
  elements.dayPills.innerHTML = dayOptions
    .map((day) => {
      const active = selectedDayValues.has(day.value) ? " active" : "";
      return `
        <button class="day-pill${active}" type="button" data-day-value="${day.value}" aria-pressed="${selectedDayValues.has(day.value)}"${disabled}>
          ${day.short}
        </button>
      `;
    })
    .join("");
}

function renderActiveGroup() {
  const pool = getSelectedPool();
  const group = getSelectedGroup();
  const hasGroup = Boolean(group);

  elements.activeGroupTitle.textContent = group ? `${pool?.name || "Бассейн"} · ${group.start}` : pool?.name || "Нет бассейна";
  elements.activeGroupSchedule.textContent = group
    ? `${formatDays(group.days)} · ${formatTimeRange(group)}`
    : pool
      ? "Создайте группу слева, укажите дни и время."
      : "Создайте бассейн слева, затем добавьте группы.";

  elements.studentNameInput.disabled = !hasGroup;
  elements.studentBirthYearInput.disabled = !hasGroup;
  elements.studentForm.querySelector("button").disabled = !hasGroup;
  elements.exportButton.disabled = !hasGroup;
  elements.prevMonthButton.disabled = !hasGroup;
  elements.nextMonthButton.disabled = !hasGroup;
  elements.monthInput.disabled = !hasGroup;
}

function renderJournal() {
  const group = getSelectedGroup();
  const visibleStudents = group ? getVisibleStudentsForMonth(group, elements.monthInput.value) : [];
  if (!group || !visibleStudents.length) {
    elements.journalTable.innerHTML = "";
    elements.emptyState.classList.add("visible");
    elements.emptyState.querySelector("h3").textContent = group
      ? "В этом месяце нет активных учеников"
      : "Выберите группу и добавьте учеников";
    elements.emptyState.querySelector("p").textContent = group
      ? "Добавьте ученика или выберите предыдущий месяц, где ученик еще был в группе."
      : "После этого здесь появится журнал с датами тренировок выбранного месяца.";
    refreshIcons();
    return;
  }

  const dates = getTrainingDates(group, elements.monthInput.value);
  if (!dates.length) {
    elements.journalTable.innerHTML = "";
    elements.emptyState.classList.add("visible");
    elements.emptyState.querySelector("h3").textContent = "В этом месяце нет тренировочных дней";
    elements.emptyState.querySelector("p").textContent = "Измените дни группы или выберите другой месяц.";
    refreshIcons();
    return;
  }

  elements.emptyState.classList.remove("visible");
  elements.emptyState.querySelector("h3").textContent = "Выберите группу и добавьте учеников";
  elements.emptyState.querySelector("p").textContent =
    "После этого здесь появится журнал с датами тренировок выбранного месяца.";

  const headCells = dates
    .map(
      (item) => `
        <th scope="col">
          <span class="date-head">
            <strong>${item.dayNumber}</strong>
            <span>${item.weekday}</span>
          </span>
        </th>
      `,
    )
    .join("");

  const rows = visibleStudents
    .map((student) => {
      const summary = getStudentSummary(group, student.id, dates);
      const birthYear = student.birthYear ? `${escapeHtml(student.birthYear)} г.р.` : "год не указан";
      const cells = dates
        .map((item) => {
          const value = group.attendance[item.iso]?.[student.id] || "";
          const className = value === "+" ? "present" : value === "-" ? "absent" : "";
          const label = value === "+" ? "Был" : value === "-" ? "Не был" : "Пусто";
          return `
            <td class="attendance-cell">
              <button class="attendance-button ${className}" type="button" data-student-id="${student.id}" data-date="${item.iso}" aria-label="${escapeHtml(student.name)}: ${label}, ${item.readable}">
                ${value}
              </button>
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          <th class="student-cell" scope="row">
            <span class="student-row">
              <span class="student-info">
                <span class="student-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span>
                <span class="student-birth-year">${birthYear}</span>
              </span>
              <span class="student-actions">
                <button class="icon-button edit-student" type="button" data-edit-student-id="${student.id}" aria-label="Редактировать ученика" title="Редактировать ученика">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="icon-button remove-student" type="button" data-remove-student-id="${student.id}" aria-label="Убрать ученика с этого месяца" title="Убрать с этого месяца и дальше">
                  <i data-lucide="x"></i>
                </button>
                <button class="icon-button delete-student-everywhere" type="button" data-delete-student-everywhere-id="${student.id}" aria-label="Удалить ученика из всех месяцев" title="Удалить из всех месяцев">
                  <i data-lucide="trash-2"></i>
                </button>
              </span>
            </span>
          </th>
          ${cells}
          <td class="summary-cell">${summary.present}/${summary.total}</td>
        </tr>
      `;
    })
    .join("");

  elements.journalTable.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Ученик</th>
        ${headCells}
        <th class="summary-head" scope="col">Итого</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;

  renderStudentTransferButtons();
  refreshIcons();
}

function renderStats() {
  const group = getSelectedGroup();

  if (!group) {
    elements.stats.innerHTML = "";
    return;
  }

  const dates = getTrainingDates(group, elements.monthInput.value);
  const visibleStudents = getVisibleStudentsForMonth(group, elements.monthInput.value);
  const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
  const totals = dates.reduce(
    (acc, date) => {
      const dayMarks = group.attendance[date.iso] || {};
      Object.entries(dayMarks).forEach(([studentId, mark]) => {
        if (!visibleStudentIds.has(studentId)) return;
        if (mark === "+") acc.present += 1;
        if (mark === "-") acc.absent += 1;
      });
      return acc;
    },
    { present: 0, absent: 0 },
  );

  elements.stats.innerHTML = `
    <span class="stat-pill">${visibleStudents.length} ${pluralize(visibleStudents.length, ["ученик", "ученика", "учеников"])}</span>
    <span class="stat-pill">${dates.length} ${pluralize(dates.length, ["тренировка", "тренировки", "тренировок"])}</span>
    <span class="stat-pill">+ ${totals.present}</span>
    <span class="stat-pill">- ${totals.absent}</span>
  `;
}

function renderStudentTransferButtons() {
  elements.journalTable.querySelectorAll(".student-actions").forEach((actions) => {
    if (actions.querySelector("[data-transfer-student-id]")) return;

    const removeButton = actions.querySelector("[data-remove-student-id]");
    if (!removeButton) return;

    const studentId = removeButton.dataset.removeStudentId;
    if (!studentId) return;

    const transferButton = document.createElement("button");
    transferButton.className = "icon-button transfer-student";
    transferButton.type = "button";
    transferButton.dataset.transferStudentId = studentId;
    transferButton.setAttribute("aria-label", "Перенести ученика");
    transferButton.setAttribute("title", "Перенести в другую группу");
    transferButton.innerHTML = `<i data-lucide="arrow-right-left"></i>`;
    actions.insertBefore(transferButton, removeButton);
  });
}

function setNextAttendance(studentId, date) {
  const group = getSelectedGroup();
  if (!group) return;
  const current = group.attendance[date]?.[studentId] || "";
  const next = attendanceFlow[(attendanceFlow.indexOf(current) + 1) % attendanceFlow.length];
  const changed = setAttendanceValue(group.id, studentId, date, next, elements.monthInput.value);
  if (!changed) return;

  renderJournal();
  renderStats();
}

function setAttendanceValue(groupId, studentId, date, nextValue, monthValueOverride = null) {
  const group = getGroup(groupId);
  if (!group) return false;

  const monthValue = monthValueOverride || date.slice(0, 7);
  if (!getVisibleStudentsForMonth(group, monthValue).some((student) => student.id === studentId)) return false;
  if (!["", "+", "-"].includes(nextValue)) return false;

  if (nextValue) {
    if (!group.attendance[date]) {
      group.attendance[date] = {};
    }
    group.attendance[date][studentId] = nextValue;
  } else {
    if (!group.attendance[date]) return false;
    delete group.attendance[date][studentId];
    if (!Object.keys(group.attendance[date]).length) {
      delete group.attendance[date];
    }
  }

  saveState();
  return true;
}

function removeStudent(studentId) {
  const group = getSelectedGroup();
  if (!group) return;

  const student = group.students.find((item) => item.id === studentId);
  if (!student) return;

  const monthValue = elements.monthInput.value;
  const confirmed = window.confirm(
    `Убрать ученика "${student.name}" из группы с ${formatMonthLabel(monthValue)} и следующих месяцев? В предыдущих месяцах он останется в журнале.`,
  );
  if (!confirmed) return;

  student.removedFromMonth = monthValue;

  saveState();
  renderJournal();
  renderStats();
  renderGroups();
  refreshIcons();
}

function deleteStudentEverywhere(studentId) {
  const group = getSelectedGroup();
  if (!group) return;

  const student = group.students.find((item) => item.id === studentId);
  if (!student) return;

  const confirmed = window.confirm(
    `Полностью удалить ученика "${student.name}" из всех месяцев и стереть все его отметки? Это действие нельзя отменить.`,
  );
  if (!confirmed) return;

  group.students = group.students.filter((item) => item.id !== studentId);
  Object.keys(group.attendance).forEach((date) => {
    delete group.attendance[date][studentId];
    if (!Object.keys(group.attendance[date]).length) {
      delete group.attendance[date];
    }
  });

  saveState();
  renderJournal();
  renderStats();
  renderGroups();
  refreshIcons();
}

function getTransferTargetGroups(sourceGroupId) {
  return state.groups
    .filter((group) => group.id !== sourceGroupId)
    .map((group) => ({ group, pool: getPool(group.poolId) }))
    .filter((item) => item.pool)
    .sort((left, right) => {
      const poolNameCompare = left.pool.name.localeCompare(right.pool.name, "ru");
      if (poolNameCompare !== 0) return poolNameCompare;
      return left.group.start.localeCompare(right.group.start, "ru");
    });
}

function transferStudentWithHistory(sourceGroupId, targetGroupId, studentId) {
  const sourceGroup = getGroup(sourceGroupId);
  const targetGroup = getGroup(targetGroupId);
  if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return false;

  const studentIndex = sourceGroup.students.findIndex((student) => student.id === studentId);
  if (studentIndex === -1) return false;

  const sourceStudent = sourceGroup.students[studentIndex];
  const nextStudentId = targetGroup.students.some((student) => student.id === sourceStudent.id)
    ? createId("student")
    : sourceStudent.id;
  const movedStudent = nextStudentId === sourceStudent.id ? sourceStudent : { ...sourceStudent, id: nextStudentId };

  sourceGroup.students.splice(studentIndex, 1);
  targetGroup.students.push(movedStudent);

  Object.keys(sourceGroup.attendance).forEach((date) => {
    const dayMarks = sourceGroup.attendance[date];
    const mark = dayMarks[sourceStudent.id];
    if (!mark) return;

    if (!targetGroup.attendance[date]) {
      targetGroup.attendance[date] = {};
    }

    targetGroup.attendance[date][nextStudentId] = mark;
    delete dayMarks[sourceStudent.id];

    if (!Object.keys(dayMarks).length) {
      delete sourceGroup.attendance[date];
    }
  });

  return true;
}

function exportCsv() {
  const pool = getSelectedPool();
  const group = getSelectedGroup();
  if (!group) return;

  const dates = getTrainingDates(group, elements.monthInput.value);
  const visibleStudents = getVisibleStudentsForMonth(group, elements.monthInput.value);
  const rows = [
    ["Ученик", "Год рождения", ...dates.map((date) => `${date.iso} ${date.weekday}`), "Итого"],
    ...visibleStudents.map((student) => {
      const summary = getStudentSummary(group, student.id, dates);
      return [
        student.name,
        student.birthYear || "",
        ...dates.map((date) => group.attendance[date.iso]?.[student.id] || ""),
        `${summary.present}/${summary.total}`,
      ];
    }),
  ];

  const csv = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${pool?.name || "attendance"}-${group.start}-${elements.monthInput.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getStudentSummary(group, studentId, dates) {
  return dates.reduce(
    (acc, date) => {
      const value = group.attendance[date.iso]?.[studentId] || "";
      if (value === "+") acc.present += 1;
      if (value === "-") acc.absent += 1;
      if (value) acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, total: 0 },
  );
}

function getTrainingDates(group, monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const weekdayValue = date.getDay();

    if (!group.days.includes(weekdayValue)) continue;

    const dayInfo = dayOptions.find((item) => item.value === weekdayValue);
    dates.push({
      date,
      iso: toIsoDate(date),
      dayNumber: String(day).padStart(2, "0"),
      weekday: dayInfo.short,
      readable: `${day} ${formatMonthName(date)} (${dayInfo.full})`,
    });
  }

  return dates;
}

function shiftMonth(delta) {
  const [year, month] = elements.monthInput.value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  elements.monthInput.value = toMonthValue(date);
  state.month = elements.monthInput.value;
  saveState();
  renderGroups();
  renderJournal();
  renderStats();
}

function getSelectedGroup() {
  return getGroup(state.selectedGroupId);
}

function getGroup(id) {
  return state.groups.find((group) => group.id === id);
}

function getSelectedPool() {
  return getPool(state.selectedPoolId);
}

function getPool(id) {
  return state.pools.find((pool) => pool.id === id);
}

function getGroupsForSelectedPool() {
  return state.groups.filter((group) => group.poolId === state.selectedPoolId);
}

function getGroupsForDate(dateValue) {
  const date = parseIsoDate(dateValue);
  if (!date) return [];

  const weekday = date.getDay();
  const poolOrder = new Map(state.pools.map((pool, index) => [pool.id, index]));

  return state.groups
    .filter((group) => group.days.includes(weekday))
    .sort((left, right) => {
      const poolOrderLeft = poolOrder.get(left.poolId) ?? 0;
      const poolOrderRight = poolOrder.get(right.poolId) ?? 0;
      return poolOrderLeft - poolOrderRight;
    });
}

function getHomeDateValue() {
  return normalizeIsoDate(state.homeDate) || toIsoDate(new Date());
}

function getVisibleStudentsForMonth(group, monthValue) {
  return group.students.filter((student) => isStudentVisibleInMonth(student, monthValue));
}

function isStudentVisibleInMonth(student, monthValue) {
  const isAfterStart = !student.activeFromMonth || student.activeFromMonth <= monthValue;
  const isBeforeRemoval = !student.removedFromMonth || monthValue < student.removedFromMonth;
  return isAfterStart && isBeforeRemoval;
}

function applyTheme(theme) {
  const normalized = themeChoices.some((choice) => choice.value === theme) ? theme : "white";
  state.theme = normalized;
  document.documentElement.dataset.theme = normalized;
}

function formatDays(days) {
  if (!days?.length) return "дни не выбраны";
  return dayOptions
    .filter((day) => days.includes(day.value))
    .map((day) => day.short)
    .join(" ");
}

function formatTimeRange(group) {
  if (!group?.start) return "время не указано";
  return group.end ? `${group.start}-${group.end}` : group.start;
}

function formatMonthName(date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date);
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function formatFullDateLabel(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeIsoDate(value) {
  const parsed = parseIsoDate(value);
  return parsed ? toIsoDate(parsed) : null;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBirthYear(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const year = Number(text);
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
    return null;
  }

  return String(year);
}

function pluralize(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
