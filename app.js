const STORAGE_KEY_BASE = "swim-attendance-journal-v1";
const LEGACY_STORAGE_KEY = "swim-attendance-journal-v1";
const SUPABASE_CONFIG = window.__SUPABASE_CONFIG || {};
const supabaseClient =
  window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;

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
  { value: "navy", label: "Синяя", swatch: "#172033" },
];

const elements = {
  homeView: document.querySelector("#homeView"),
  poolView: document.querySelector("#poolView"),
  homeSummary: document.querySelector("#homeSummary"),
  homeDateInput: document.querySelector("#homeDateInput"),
  homeDatePrevButton: document.querySelector("#homeDatePrevButton"),
  homeDateNextButton: document.querySelector("#homeDateNextButton"),
  homeGroupTabs: document.querySelector("#homeGroupTabs"),
  homeGroupPanel: document.querySelector("#homeGroupPanel"),
  openThemePopoverButton: document.querySelector("#openThemePopoverButton"),
  openPoolEditorPopoverButton: document.querySelector("#openPoolEditorPopoverButton"),
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
  poolEditor: document.querySelector("#poolEditor"),
  groupList: document.querySelector("#groupList"),
  groupsPanelTitle: document.querySelector("#groupsPanelTitle"),
  themeOptions: document.querySelector("#themeOptions"),
  themePanel: document.querySelector(".theme-panel"),
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
  deleteStudentModal: document.querySelector("#deleteStudentModal"),
  deleteStudentModalText: document.querySelector("#deleteStudentModalText"),
  closeDeleteStudentModalButton: document.querySelector("#closeDeleteStudentModalButton"),
  cancelDeleteStudentButton: document.querySelector("#cancelDeleteStudentButton"),
  deleteStudentFromMonthButton: document.querySelector("#deleteStudentFromMonthButton"),
  deleteStudentAllButton: document.querySelector("#deleteStudentAllButton"),
  authModal: document.querySelector("#authModal"),
  authForm: document.querySelector("#authForm"),
  authEmailInput: document.querySelector("#authEmailInput"),
  authPasswordInput: document.querySelector("#authPasswordInput"),
  authMessage: document.querySelector("#authMessage"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  authModeToggleButton: document.querySelector("#authModeToggleButton"),
  authUserEmail: document.querySelector("#authUserEmail"),
  syncStatus: document.querySelector("#syncStatus"),
  signOutButton: document.querySelector("#signOutButton"),
  exportBackupButton: document.querySelector("#exportBackupButton"),
  importBackupButton: document.querySelector("#importBackupButton"),
  importBackupInput: document.querySelector("#importBackupInput"),
  stats: document.querySelector("#stats"),
  journalTable: document.querySelector("#journalTable"),
  emptyState: document.querySelector("#emptyState"),
};

let state = loadState();
let editingPoolId = state.selectedPoolId || null;
let editingGroupId = state.selectedGroupId || null;
let editingStudentId = null;
let transferStudentId = null;
let deleteStudentId = null;
let draggedGroupId = null;
let currentView = "home";
let selectedDayValues = new Set([1, 3, 5]);
let selectedQuickGroupId = null;
let homePopover = null;
let authMode = "signIn";
let currentUser = null;
let isHydratingFromCloud = false;
let syncTimer = null;
let syncInProgress = false;
let attendanceDateColumn = "training_date";
let syncStatus = "idle";
let cloudRefreshTimer = null;

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
initAuth();
initializeViewHistory();

function wireEvents() {
  window.addEventListener("popstate", (event) => {
    const nextView = event.state?.view === "pool" ? "pool" : "home";
    currentView = nextView === "pool" && getSelectedPool() ? "pool" : "home";
    closeHomePopover();
    render();
  });

  window.addEventListener("beforeunload", () => {
    if (!supabaseClient || !currentUser?.id || syncInProgress) return;
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
      syncStateToSupabase();
    }
  });

  window.addEventListener("focus", () => {
    refreshStateFromCloud();
  });

  document.addEventListener?.("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshStateFromCloud();
    }
  });

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

  elements.openThemePopoverButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHomePopover("theme");
  });

  elements.openPoolEditorPopoverButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHomePopover("pool");
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

  elements.homeDatePrevButton.addEventListener("click", () => {
    shiftHomeDateByDays(-1);
  });

  elements.homeDateNextButton.addEventListener("click", () => {
    shiftHomeDateByDays(1);
  });

  elements.homeGroupTabs.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-quick-group-id]");
    if (!tabButton) return;

    selectedQuickGroupId = tabButton.dataset.quickGroupId;
    renderHomeQuickAttendance();
  });

  elements.homeGroupPanel.addEventListener("click", (event) => {
    const bulkMarkButton = event.target.closest("[data-quick-mark-all-group-id]");
    if (bulkMarkButton) {
      const groupId = bulkMarkButton.dataset.quickMarkAllGroupId;
      const date = getHomeDateValue();
      const changed = setQuickGroupAttendanceCycle(groupId, date);
      if (!changed) return;

      renderHomeQuickAttendance();
      if (
        currentView === "pool" &&
        state.selectedGroupId === groupId &&
        elements.monthInput.value === date.slice(0, 7)
      ) {
        renderJournal();
        renderStats();
      }
      return;
    }

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
    renderGroupList();
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
      openStudentDeleteChoice(removeButton.dataset.removeStudentId);
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

  elements.closeDeleteStudentModalButton.addEventListener("click", closeStudentDeleteChoice);
  elements.cancelDeleteStudentButton.addEventListener("click", closeStudentDeleteChoice);
  elements.deleteStudentFromMonthButton.addEventListener("click", () => {
    if (!deleteStudentId) return;
    removeStudent(deleteStudentId, { skipConfirm: true });
    closeStudentDeleteChoice();
  });
  elements.deleteStudentAllButton.addEventListener("click", () => {
    if (!deleteStudentId) return;
    deleteStudentEverywhere(deleteStudentId, { skipConfirm: true });
    closeStudentDeleteChoice();
  });
  elements.deleteStudentModal.addEventListener("click", (event) => {
    if (event.target === elements.deleteStudentModal) {
      closeStudentDeleteChoice();
    }
  });

  document.addEventListener?.("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (homePopover) {
      closeHomePopover();
      return;
    }

    if (!elements.studentModal.hidden) {
      closeStudentEditor();
      return;
    }

    if (!elements.transferStudentModal.hidden) {
      closeStudentTransfer();
      return;
    }

    if (!elements.deleteStudentModal.hidden) {
      closeStudentDeleteChoice();
    }
  });

  elements.exportButton.addEventListener("click", exportCsv);

  document.addEventListener("click", (event) => {
    if (!homePopover || currentView !== "home") return;
    if (
      elements.themePanel.contains(event.target) ||
      elements.poolEditor.contains(event.target) ||
      elements.openThemePopoverButton.contains(event.target) ||
      elements.openPoolEditorPopoverButton.contains(event.target)
    ) {
      return;
    }

    closeHomePopover();
  });

  elements.themeOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-value]");
    if (!button) return;

    state.theme = button.dataset.themeValue;
    applyTheme(state.theme);
    saveState();
    renderThemeOptions();
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuthForm();
  });

  elements.authModeToggleButton.addEventListener("click", () => {
    authMode = authMode === "signIn" ? "signUp" : "signIn";
    renderAuthUi();
  });

  elements.signOutButton.addEventListener("click", async () => {
    await signOutUser();
  });

  elements.exportBackupButton.addEventListener("click", exportBackupJson);
  elements.importBackupButton.addEventListener("click", () => {
    elements.importBackupInput.click();
  });
  elements.importBackupInput.addEventListener("change", importBackupJson);
}

async function initAuth() {
  if (!supabaseClient) {
    setAuthMessage("Не удалось подключиться к Supabase. Проверьте URL и ключ.");
    openAuthModal();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthMessage(error.message);
    openAuthModal();
    return;
  }

  await applySession(data?.session || null);
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
  });
}

async function applySession(session) {
  const previousUserId = currentUser?.id || null;
  currentUser = session?.user || null;
  const nextUserId = currentUser?.id || null;

  if (previousUserId !== nextUserId) {
    attendanceDateColumn = "training_date";
  }

  if (!currentUser) {
    stopCloudRefreshLoop();
    openAuthModal();
    updateAuthBar();
    return;
  }

  isHydratingFromCloud = true;
  closeAuthModal();
  const localState = loadState();
  const cloudState = await loadStateFromSupabase();
  const shouldPushLocalState = !hasMeaningfulData(cloudState) && hasMeaningfulData(localState);

  if (hasMeaningfulData(cloudState)) {
    state = cloudState;
  } else {
    state = localState;
  }

  editingPoolId = state.selectedPoolId || null;
  editingGroupId = state.selectedGroupId || null;

  if (!cloudState && hasMeaningfulData(localState)) {
    saveState();
  } else if (!state.pools.length) {
    state = createSeedState();
    editingPoolId = state.selectedPoolId;
    editingGroupId = state.selectedGroupId;
    saveState();
  }

  updateAuthBar();
  render();
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  startCloudRefreshLoop();
  isHydratingFromCloud = false;

  if (shouldPushLocalState || (!cloudState && state.pools.length)) {
    scheduleSupabaseSync();
  }
}

function getStorageKey() {
  if (!currentUser?.id) return `${STORAGE_KEY_BASE}:guest`;
  return `${STORAGE_KEY_BASE}:${currentUser.id}`;
}

function getLegacyStorageKey() {
  return LEGACY_STORAGE_KEY;
}

function hasMeaningfulData(value) {
  return Boolean(value?.pools?.length || value?.groups?.length);
}

function startCloudRefreshLoop() {
  if (cloudRefreshTimer || !currentUser?.id) return;
  cloudRefreshTimer = window.setInterval(() => {
    refreshStateFromCloud();
  }, 15000);
}

function stopCloudRefreshLoop() {
  if (!cloudRefreshTimer) return;
  window.clearInterval(cloudRefreshTimer);
  cloudRefreshTimer = null;
}

async function refreshStateFromCloud() {
  if (!supabaseClient || !currentUser?.id || syncInProgress || syncTimer || isHydratingFromCloud) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

  const cloudState = await loadStateFromSupabase();
  if (!hasMeaningfulData(cloudState)) return;

  state = cloudState;
  editingPoolId = state.selectedPoolId || null;
  editingGroupId = state.selectedGroupId || null;
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  render();
  setSyncStatus("ok");
}

async function loadStateFromSupabase() {
  if (!supabaseClient || !currentUser?.id) return null;

  try {
    const [{ data: pools, error: poolsError }, { data: groups, error: groupsError }, { data: students, error: studentsError }, { data: attendance, error: attendanceError }] =
      await Promise.all([
        supabaseClient.from("pools").select("*").order("created_at", { ascending: true }),
        supabaseClient.from("groups").select("*").order("sort_order", { ascending: true }),
        supabaseClient.from("students").select("*").order("created_at", { ascending: true }),
        supabaseClient.from("attendance").select("*").order("created_at", { ascending: true }),
      ]);

    const loadError = poolsError || groupsError || studentsError || attendanceError;
    if (loadError) {
      window.alert(`Ошибка загрузки данных из Supabase: ${loadError.message}`);
      return null;
    }

    if (!pools?.length && !groups?.length && !students?.length && !attendance?.length) {
      return null;
    }

    const normalizedPools = (pools || []).map((pool) => ({
      id: String(pool.id),
      name: pool.name || "Бассейн",
    }));

    const studentsByGroup = new Map();
    (students || []).forEach((student) => {
      const groupId = String(student.group_id);
      if (!studentsByGroup.has(groupId)) studentsByGroup.set(groupId, []);
      studentsByGroup.get(groupId).push({
        id: String(student.id),
        name: student.name || "Ученик",
        birthYear: student.birth_year ? String(student.birth_year) : "",
        activeFromMonth: student.active_from_month || "",
        removedFromMonth: student.removed_from_month || "",
      });
    });

    const attendanceByGroup = new Map();
    (attendance || []).forEach((row) => {
      const groupId = String(row.group_id);
      const date = row.training_date || row.date || row.session_date;
      const studentId = String(row.student_id);
      const mark = row.mark || "";
      if (!date || !mark) return;

      if (!attendanceByGroup.has(groupId)) attendanceByGroup.set(groupId, {});
      const groupAttendance = attendanceByGroup.get(groupId);
      if (!groupAttendance[date]) groupAttendance[date] = {};
      groupAttendance[date][studentId] = mark;
    });

    const normalizedGroups = (groups || []).map((group) => ({
      id: String(group.id),
      poolId: String(group.pool_id),
      name: group.name || group.start_time || "Группа",
      start: group.start_time || group.name || "",
      end: group.end_time || "",
      days: Array.isArray(group.days) ? group.days.map(Number) : [],
      students: studentsByGroup.get(String(group.id)) || [],
      attendance: attendanceByGroup.get(String(group.id)) || {},
    }));

    const fallbackMonth = toMonthValue(new Date());
    const fallbackDate = toIsoDate(new Date());
    const selectedPoolId = normalizedPools.some((pool) => pool.id === state.selectedPoolId)
      ? state.selectedPoolId
      : normalizedPools[0]?.id || null;
    const selectedGroupId =
      normalizedGroups.find((group) => group.id === state.selectedGroupId && group.poolId === selectedPoolId)?.id ||
      normalizedGroups.find((group) => group.poolId === selectedPoolId)?.id ||
      null;

    return {
      pools: normalizedPools,
      groups: normalizedGroups,
      selectedPoolId,
      selectedGroupId,
      month: state.month || fallbackMonth,
      homeDate: state.homeDate || fallbackDate,
      theme: state.theme || "navy",
    };
  } catch (error) {
    window.alert(`Ошибка загрузки данных из Supabase: ${error.message}`);
    return null;
  }
}

function openAuthModal() {
  renderAuthUi();
  elements.authModal.hidden = false;
}

function closeAuthModal() {
  elements.authModal.hidden = true;
}

function updateAuthBar() {
  elements.authUserEmail.textContent = currentUser?.email || "";
  const hasUser = Boolean(currentUser);
  elements.signOutButton.hidden = !hasUser;
  elements.authUserEmail.hidden = !hasUser;
  renderSyncStatus();
}

function setSyncStatus(nextStatus) {
  syncStatus = nextStatus;
  renderSyncStatus();
}

function renderSyncStatus() {
  const labelByStatus = {
    idle: "Синхронизация: —",
    syncing: "Синхронизация: сохраняем...",
    ok: "Синхронизация: сохранено",
    error: "Синхронизация: ошибка",
  };
  if (elements.syncStatus) {
    elements.syncStatus.textContent = labelByStatus[syncStatus] || labelByStatus.idle;
  }
}

function setAuthMessage(text) {
  elements.authMessage.textContent = text;
}

function renderAuthUi() {
  const isSignIn = authMode === "signIn";
  elements.authModal.querySelector("#authModalTitle").textContent = isSignIn ? "Вход в журнал" : "Регистрация";
  elements.authSubmitButton.innerHTML = isSignIn
    ? '<i data-lucide="log-in"></i>Войти'
    : '<i data-lucide="user-plus"></i>Создать аккаунт';
  elements.authModeToggleButton.textContent = isSignIn
    ? "Нет аккаунта? Регистрация"
    : "Уже есть аккаунт? Войти";
  setAuthMessage(isSignIn ? "Войдите или зарегистрируйтесь, чтобы продолжить." : "Создайте аккаунт для доступа к журналу.");
  refreshIcons();
}

async function submitAuthForm() {
  if (!supabaseClient) return;

  const email = elements.authEmailInput.value.trim();
  const password = elements.authPasswordInput.value.trim();
  if (!email || !password) return;

  setAuthMessage("Проверяем...");
  const result =
    authMode === "signIn"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({ email, password });

  if (result.error) {
    setAuthMessage(result.error.message);
    return;
  }

  if (authMode === "signUp" && !result.data.session) {
    setAuthMessage("Аккаунт создан. Теперь войдите с этим email и паролем.");
    authMode = "signIn";
    renderAuthUi();
    return;
  }

  elements.authPasswordInput.value = "";
  setAuthMessage("Успешно. Загружаем журнал...");
}

async function signOutUser() {
  setSyncStatus("idle");

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: "local" });
      if (error) {
        console.warn("Supabase signOut error:", error.message);
      }
    } catch (error) {
      console.warn("Supabase signOut exception:", error?.message || error);
    }
  }

  forceLocalSignOut();
}

function forceLocalSignOut() {
  currentUser = null;
  attendanceDateColumn = "training_date";
  stopCloudRefreshLoop();

  Object.keys(localStorage).forEach((key) => {
    if (key.includes("supabase") || key.startsWith("sb-")) {
      localStorage.removeItem(key);
    }
  });

  openAuthModal();
  updateAuthBar();
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
  closeHomePopover();

  if (currentView === "pool" && window.history?.state?.view === "pool") {
    window.history.back();
    return;
  }

  currentView = "home";
  updateViewHistory("replace");
  render();
}

function showPool() {
  closeHomePopover();
  if (!getSelectedPool()) {
    currentView = "home";
    updateViewHistory("replace");
  } else {
    if (currentView !== "pool") {
      updateViewHistory("push", "pool");
    }
    currentView = "pool";
  }

  render();
}

function initializeViewHistory() {
  updateViewHistory("replace", currentView);
}

function updateViewHistory(mode = "replace", view = currentView) {
  if (!window.history?.replaceState) return;

  const normalized = view === "pool" ? "pool" : "home";
  const stateValue = { view: normalized };

  if (mode === "push" && window.history?.pushState) {
    window.history.pushState(stateValue, "");
    return;
  }

  window.history.replaceState(stateValue, "");
}

function toggleHomePopover(type) {
  if (homePopover === type) {
    closeHomePopover();
    return;
  }

  homePopover = type;
  elements.themePanel.classList.toggle("is-popover-open", type === "theme");
  elements.poolEditor.classList.toggle("is-popover-open", type === "pool");
}

function closeHomePopover() {
  homePopover = null;
  elements.themePanel.classList.remove("is-popover-open");
  elements.poolEditor.classList.remove("is-popover-open");
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
    window.alert("В этом бассейне нет другой группы для переноса.");
    return;
  }

  transferStudentId = studentId;
  elements.transferStudentNameInput.value = `${student.name} (${sourcePool?.name || "Бассейн"} · ${sourceGroup.start})`;
  elements.transferStudentTargetSelect.innerHTML = targets
    .map(
      ({ group }) =>
        `<option value="${group.id}">${escapeHtml(group.start)} · ${escapeHtml(formatDays(group.days))}</option>`,
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

function openStudentDeleteChoice(studentId) {
  const group = getSelectedGroup();
  const student = group?.students.find((item) => item.id === studentId);
  if (!group || !student) return;

  deleteStudentId = studentId;
  elements.deleteStudentModalText.textContent =
    `Выберите как удалить ученика "${student.name}".`;
  elements.deleteStudentModal.hidden = false;
}

function closeStudentDeleteChoice() {
  deleteStudentId = null;
  elements.deleteStudentModal.hidden = true;
  elements.deleteStudentModalText.textContent = "";
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
    theme: "navy",
  };

  try {
    const savedByUser = localStorage.getItem(getStorageKey());
    const savedRaw = savedByUser || localStorage.getItem(getLegacyStorageKey());
    const saved = JSON.parse(savedRaw);
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
  const monthValue = toMonthValue(new Date());
  const students = [
    ["Алина Мамбетова", "2014"],
    ["Даниил Смирнов", "2013"],
    ["Руслан Ибраев", "2015"],
  ].map(([name, birthYear]) => ({
    id: createId("student"),
    name,
    birthYear,
    activeFromMonth: monthValue,
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
    month: monthValue,
    homeDate: toIsoDate(new Date()),
    theme: state.theme || "navy",
  };
}

function saveState() {
  state.month = elements.monthInput.value || state.month;
  state.homeDate = normalizeIsoDate(elements.homeDateInput.value) || state.homeDate || toIsoDate(new Date());
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  scheduleSupabaseSync();
}

function scheduleSupabaseSync() {
  if (isHydratingFromCloud || !supabaseClient || !currentUser?.id) return;
  setSyncStatus("syncing");

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(async () => {
    syncTimer = null;
    await syncStateToSupabase();
  }, 350);
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function makeEntityId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return createId("id");
}

function normalizeIdsForCloud() {
  let changed = false;
  const poolIdMap = new Map();
  state.pools = state.pools.map((pool) => {
    if (isUuidLike(pool.id)) return pool;
    const nextId = makeEntityId();
    poolIdMap.set(pool.id, nextId);
    changed = true;
    return { ...pool, id: nextId };
  });

  const groupIdMap = new Map();
  state.groups = state.groups.map((group) => {
    const nextGroupId = isUuidLike(group.id) ? group.id : makeEntityId();
    if (nextGroupId !== group.id) {
      groupIdMap.set(group.id, nextGroupId);
      changed = true;
    }
    const nextPoolId = poolIdMap.get(group.poolId) || group.poolId;
    if (nextPoolId !== group.poolId) changed = true;
    return { ...group, id: nextGroupId, poolId: nextPoolId };
  });

  state.groups = state.groups.map((group) => {
    const studentIdMap = new Map();
    const nextStudents = group.students.map((student) => {
      if (isUuidLike(student.id)) return student;
      const nextId = makeEntityId();
      studentIdMap.set(student.id, nextId);
      changed = true;
      return { ...student, id: nextId };
    });

    const nextAttendance = {};
    Object.entries(group.attendance || {}).forEach(([date, marks]) => {
      nextAttendance[date] = {};
      Object.entries(marks || {}).forEach(([studentId, mark]) => {
        nextAttendance[date][studentIdMap.get(studentId) || studentId] = mark;
      });
    });

    return { ...group, students: nextStudents, attendance: nextAttendance };
  });

  state.selectedPoolId = poolIdMap.get(state.selectedPoolId) || state.selectedPoolId;
  state.selectedGroupId = groupIdMap.get(state.selectedGroupId) || state.selectedGroupId;
  return changed;
}

function cloneImportedStateForCurrentAccount(imported) {
  const fallbackMonth = imported.month || toMonthValue(new Date());
  const fallbackDate = normalizeIsoDate(imported.homeDate) || toIsoDate(new Date());
  const poolIdMap = new Map();
  const sourcePools = Array.isArray(imported.pools) ? imported.pools : [];
  const sourceGroups = Array.isArray(imported.groups) ? imported.groups : [];

  const pools = sourcePools.map((pool) => {
    const oldId = String(pool.id || createId("pool"));
    const nextId = makeEntityId();
    poolIdMap.set(oldId, nextId);
    return {
      id: nextId,
      name: pool.name || "Бассейн",
    };
  });

  if (!pools.length && sourceGroups.length) {
    const nextId = makeEntityId();
    pools.push({
      id: nextId,
      name: "Бассейн",
    });
  }

  const groupIdMap = new Map();
  const studentIdMap = new Map();

  const groups = sourceGroups.map((group) => {
    const oldGroupId = String(group.id || createId("group"));
    const nextGroupId = makeEntityId();
    const sourcePoolId = String(group.poolId || "");
    const nextPoolId = poolIdMap.get(sourcePoolId) || pools[0]?.id || null;

    groupIdMap.set(oldGroupId, nextGroupId);

    const students = (Array.isArray(group.students) ? group.students : []).map((student) => {
      const oldStudentId = String(student.id || createId("student"));
      const nextStudentId = makeEntityId();
      studentIdMap.set(`${oldGroupId}:${oldStudentId}`, nextStudentId);
      return {
        id: nextStudentId,
        name: student.name || "Ученик",
        birthYear: student.birthYear ? String(student.birthYear) : "",
        activeFromMonth: student.activeFromMonth || fallbackMonth,
        removedFromMonth: student.removedFromMonth || "",
      };
    });

    const attendance = {};
    Object.entries(group.attendance || {}).forEach(([date, marks]) => {
      Object.entries(marks || {}).forEach(([studentId, mark]) => {
        if (!mark) return;

        const nextStudentId = studentIdMap.get(`${oldGroupId}:${String(studentId)}`);
        if (!nextStudentId) return;

        if (!attendance[date]) {
          attendance[date] = {};
        }

        attendance[date][nextStudentId] = mark;
      });
    });

    return {
      id: nextGroupId,
      poolId: nextPoolId,
      name: group.name || group.start || "Группа",
      start: group.start || group.name || "",
      end: group.end || "",
      days: Array.isArray(group.days) ? group.days.map(Number).filter((day) => day >= 0 && day <= 6) : [],
      students,
      attendance,
    };
  });

  const selectedPoolId = poolIdMap.get(String(imported.selectedPoolId || "")) || pools[0]?.id || null;
  const selectedGroupId =
    groupIdMap.get(String(imported.selectedGroupId || "")) ||
    groups.find((group) => group.poolId === selectedPoolId)?.id ||
    groups[0]?.id ||
    null;

  return {
    pools,
    groups,
    selectedPoolId,
    selectedGroupId,
    month: fallbackMonth,
    homeDate: fallbackDate,
    theme: "navy",
  };
}

async function syncStateToSupabase() {
  if (syncInProgress || !supabaseClient || !currentUser?.id) return;

  syncInProgress = true;

  try {
    const idsChanged = normalizeIdsForCloud();
    if (idsChanged) {
      render();
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser.id;

    const poolRows = state.pools.map((pool) => ({
      id: pool.id,
      user_id: userId,
      name: pool.name,
      updated_at: nowIso,
    }));

    const groupsWithOrder = state.groups.map((group) => {
      const poolGroups = state.groups.filter((item) => item.poolId === group.poolId);
      const sortOrder = poolGroups.findIndex((item) => item.id === group.id);
      return { ...group, sortOrder };
    });

    const groupRows = groupsWithOrder.map((group) => ({
      id: group.id,
      user_id: userId,
      pool_id: group.poolId,
      start_time: group.start || "",
      end_time: group.end || "",
      days: Array.isArray(group.days) ? group.days.map(Number) : [],
      sort_order: group.sortOrder,
      updated_at: nowIso,
    }));

    const studentRows = [];
    const attendanceRows = [];

    state.groups.forEach((group) => {
      group.students.forEach((student) => {
        const activeFromMonth = student.activeFromMonth || state.month || elements.monthInput.value || toMonthValue(new Date());
        student.activeFromMonth = activeFromMonth;
        studentRows.push({
          id: student.id,
          user_id: userId,
          group_id: group.id,
          name: student.name,
          birth_year: student.birthYear ? Number(student.birthYear) : null,
          active_from_month: activeFromMonth,
          removed_from_month: student.removedFromMonth || null,
          updated_at: nowIso,
        });
      });

      Object.entries(group.attendance || {}).forEach(([date, marks]) => {
        Object.entries(marks || {}).forEach(([studentId, mark]) => {
          if (!mark) return;
          attendanceRows.push({
            user_id: userId,
            group_id: group.id,
            student_id: studentId,
            entry_date: date,
            mark,
            updated_at: nowIso,
          });
        });
      });
    });

    await syncEntityTable("pools", poolRows);
    await syncEntityTable("groups", groupRows);
    await syncEntityTable("students", studentRows);

    if (attendanceRows.length) {
      const toDbRows = (dateColumn) =>
        attendanceRows.map(({ entry_date, ...row }) => ({
          ...row,
          [dateColumn]: entry_date,
        }));

      const dateColumn = "training_date";
      const desiredRows = toDbRows(dateColumn);
      await replaceAttendanceRows(desiredRows);
    }

    localStorage.setItem(getStorageKey(), JSON.stringify(state));
    setSyncStatus("ok");
  } catch (error) {
    window.alert(`Ошибка синхронизации с Supabase: ${error.message}`);
    setSyncStatus("error");
  } finally {
    syncInProgress = false;
  }
}

async function syncEntityTable(tableName, desiredRows) {
  const userId = currentUser.id;
  const desiredIds = desiredRows.map((row) => row.id);

  if (desiredRows.length) {
    const { error } = await supabaseClient.from(tableName).upsert(desiredRows, { onConflict: "id" });
    if (error) throw error;
  }

  const { data: existingRows, error: existingError } = await supabaseClient
    .from(tableName)
    .select("id")
    .eq("user_id", userId);
  if (existingError) throw existingError;

  const existingIds = (existingRows || []).map((row) => row.id);
  const toDelete = existingIds.filter((id) => !desiredIds.includes(id));
  if (toDelete.length) {
    const { error } = await supabaseClient.from(tableName).delete().in("id", toDelete);
    if (error) throw error;
  }
}

async function replaceAttendanceRows(desiredRows) {
  const userId = currentUser.id;
  const { error: deleteError } = await supabaseClient.from("attendance").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (!desiredRows.length) return;

  const { error: insertError } = await supabaseClient.from("attendance").insert(desiredRows);
  if (insertError) throw insertError;
}

function exportBackupJson() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-backup-${toIsoDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackupJson(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parsed?.state;
    if (!imported || !Array.isArray(imported.pools) || !Array.isArray(imported.groups)) {
      window.alert("Некорректный файл резервной копии.");
      return;
    }

    state = cloneImportedStateForCurrentAccount(imported);
    editingPoolId = state.selectedPoolId;
    editingGroupId = state.selectedGroupId;
    saveState();
    render();
    window.alert("Резервная копия восстановлена.");
  } catch {
    window.alert("Не удалось прочитать файл резервной копии.");
  }
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

  const currentMonthValue = toMonthValue(new Date());

  elements.poolList.innerHTML = state.pools
    .map((pool) => {
      const active = pool.id === state.selectedPoolId ? " active" : "";
      const poolGroups = state.groups.filter((group) => group.poolId === pool.id);
      const groupCount = poolGroups.filter(
        (group) => getVisibleStudentsForMonth(group, currentMonthValue).length > 0,
      ).length;
      const studentCount = poolGroups.reduce(
        (total, group) => total + getVisibleStudentsForMonth(group, currentMonthValue).length,
        0,
      );
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
        <button class="secondary-button quick-bulk-mark-button" type="button" data-quick-mark-all-group-id="${activeGroup.id}">Отметить все</button>
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
      const active = editingGroupId && group.id === state.selectedGroupId ? " active" : "";
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
                <button class="icon-button remove-student" type="button" data-remove-student-id="${student.id}" aria-label="Удалить ученика" title="Удалить ученика">
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
    const removeButton = actions.querySelector("[data-remove-student-id]");
    if (!removeButton) return;

    removeButton.setAttribute("aria-label", "Удалить ученика");
    removeButton.setAttribute("title", "Удалить ученика");
    const removeIcon = removeButton.querySelector("i");
    if (removeIcon) {
      removeIcon.setAttribute("data-lucide", "trash-2");
    }

    if (actions.querySelector("[data-transfer-student-id]")) return;

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

function setQuickGroupAttendanceCycle(groupId, date) {
  const group = getGroup(groupId);
  if (!group) return false;

  const monthValue = date.slice(0, 7);
  const visibleStudents = getVisibleStudentsForMonth(group, monthValue);
  if (!visibleStudents.length) return false;

  const dayMarks = group.attendance[date] || {};
  const areAllPresent = visibleStudents.every((student) => dayMarks[student.id] === "+");
  const areAllAbsent = visibleStudents.every((student) => dayMarks[student.id] === "-");
  const nextValue = areAllPresent ? "-" : areAllAbsent ? "" : "+";

  if (nextValue) {
    if (!group.attendance[date]) {
      group.attendance[date] = {};
    }
    visibleStudents.forEach((student) => {
      group.attendance[date][student.id] = nextValue;
    });
  } else if (group.attendance[date]) {
    visibleStudents.forEach((student) => {
      delete group.attendance[date][student.id];
    });

    if (!Object.keys(group.attendance[date]).length) {
      delete group.attendance[date];
    }
  }

  saveState();
  return true;
}

function removeStudent(studentId, options = {}) {
  const group = getSelectedGroup();
  if (!group) return;

  const student = group.students.find((item) => item.id === studentId);
  if (!student) return;

  const monthValue = elements.monthInput.value;
  if (!options.skipConfirm) {
    const confirmed = window.confirm(
      `Убрать ученика "${student.name}" из группы с ${formatMonthLabel(monthValue)} и следующих месяцев? В предыдущих месяцах он останется в журнале.`,
    );
    if (!confirmed) return;
  }

  student.removedFromMonth = monthValue;

  saveState();
  renderJournal();
  renderStats();
  renderGroups();
  refreshIcons();
}

function deleteStudentEverywhere(studentId, options = {}) {
  const group = getSelectedGroup();
  if (!group) return;

  const student = group.students.find((item) => item.id === studentId);
  if (!student) return;

  if (!options.skipConfirm) {
    const confirmed = window.confirm(
      `Полностью удалить ученика "${student.name}" из всех месяцев и стереть все его отметки? Это действие нельзя отменить.`,
    );
    if (!confirmed) return;
  }

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
  const sourceGroup = getGroup(sourceGroupId);
  if (!sourceGroup) return [];

  return state.groups
    .filter((group) => group.poolId === sourceGroup.poolId && group.id !== sourceGroupId)
    .map((group) => ({ group, pool: getPool(group.poolId) }))
    .filter((item) => item.pool)
    .sort((left, right) => {
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

function shiftHomeDateByDays(deltaDays) {
  const baseDate = parseIsoDate(getHomeDateValue()) || new Date();
  baseDate.setDate(baseDate.getDate() + deltaDays);
  const nextIsoDate = toIsoDate(baseDate);
  state.homeDate = nextIsoDate;
  elements.homeDateInput.value = nextIsoDate;
  selectedQuickGroupId = null;
  saveState();
  renderHomeQuickAttendance();
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
  const normalized = themeChoices.some((choice) => choice.value === theme) ? theme : "navy";
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

