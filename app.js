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
  groupList: document.querySelector("#groupList"),
  themeOptions: document.querySelector("#themeOptions"),
  newGroupButton: document.querySelector("#newGroupButton"),
  deleteGroupButton: document.querySelector("#deleteGroupButton"),
  groupForm: document.querySelector("#groupForm"),
  groupFormTitle: document.querySelector("#groupFormTitle"),
  groupNameInput: document.querySelector("#groupNameInput"),
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
  stats: document.querySelector("#stats"),
  journalTable: document.querySelector("#journalTable"),
  emptyState: document.querySelector("#emptyState"),
};

let state = loadState();
let editingGroupId = state.selectedGroupId || null;
let selectedDayValues = new Set([1, 3, 5]);

applyTheme(state.theme);
elements.monthInput.value = state.month || toMonthValue(new Date());

if (!state.groups.length) {
  state = createSeedState();
  editingGroupId = state.selectedGroupId;
  saveState();
}

wireEvents();
render();

function wireEvents() {
  elements.newGroupButton.addEventListener("click", () => {
    editingGroupId = null;
    selectedDayValues = new Set([1, 3, 5]);
    renderGroupForm();
    elements.groupNameInput.focus();
  });

  elements.deleteGroupButton.addEventListener("click", () => {
    if (!editingGroupId) return;

    const group = getGroup(editingGroupId);
    if (!group) return;

    const confirmed = window.confirm(`Удалить группу "${group.name}" вместе с учениками и отметками?`);
    if (!confirmed) return;

    state.groups = state.groups.filter((item) => item.id !== editingGroupId);
    state.selectedGroupId = state.groups[0]?.id || null;
    editingGroupId = state.selectedGroupId;
    saveState();
    render();
  });

  elements.groupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.groupNameInput.value.trim();
    const start = elements.groupStartInput.value;
    const end = elements.groupEndInput.value;
    const days = dayOptions
      .map((day) => day.value)
      .filter((value) => selectedDayValues.has(value));

    if (!name || !start || !days.length) {
      window.alert("Укажите название, время начала и хотя бы один день тренировки.");
      return;
    }

    if (editingGroupId) {
      const group = getGroup(editingGroupId);
      if (!group) return;
      group.name = name;
      group.start = start;
      group.end = end;
      group.days = days;
    } else {
      const group = {
        id: createId("group"),
        name,
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
    renderJournal();
  });

  elements.studentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const group = getSelectedGroup();
    const name = elements.studentNameInput.value.trim();

    if (!group || !name) return;

    group.students.push({
      id: createId("student"),
      name,
    });

    elements.studentNameInput.value = "";
    saveState();
    renderJournal();
    renderStats();
    elements.studentNameInput.focus();
  });

  elements.journalTable.addEventListener("click", (event) => {
    const attendanceButton = event.target.closest("[data-student-id][data-date]");
    const removeButton = event.target.closest("[data-remove-student-id]");

    if (attendanceButton) {
      setNextAttendance(attendanceButton.dataset.studentId, attendanceButton.dataset.date);
      return;
    }

    if (removeButton) {
      removeStudent(removeButton.dataset.removeStudentId);
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

function loadState() {
  const fallback = {
    groups: [],
    selectedGroupId: null,
    month: toMonthValue(new Date()),
    theme: "white",
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.groups)) return fallback;
    return {
      groups: saved.groups,
      selectedGroupId: saved.selectedGroupId || saved.groups[0]?.id || null,
      month: saved.month || fallback.month,
      theme: themeChoices.some((theme) => theme.value === saved.theme) ? saved.theme : fallback.theme,
    };
  } catch {
    return fallback;
  }
}

function createSeedState() {
  const groupId = createId("group");
  const students = ["Алина Мамбетова", "Даниил Смирнов", "Руслан Ибраев"].map((name) => ({
    id: createId("student"),
    name,
  }));

  return {
    groups: [
      {
        id: groupId,
        name: "Дельфины",
        start: "18:00",
        end: "19:00",
        days: [1, 3, 5],
        students,
        attendance: {},
      },
    ],
    selectedGroupId: groupId,
    month: toMonthValue(new Date()),
    theme: state.theme || "white",
  };
}

function saveState() {
  state.month = elements.monthInput.value || state.month;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  if (!state.selectedGroupId && state.groups.length) {
    state.selectedGroupId = state.groups[0].id;
  }

  if (!editingGroupId && state.selectedGroupId) {
    editingGroupId = state.selectedGroupId;
  }

  renderGroups();
  renderThemeOptions();
  renderGroupForm();
  renderActiveGroup();
  renderJournal();
  renderStats();
  refreshIcons();
}

function renderThemeOptions() {
  elements.themeOptions.innerHTML = themeChoices
    .map((theme) => {
      const active = theme.value === state.theme ? " active" : "";
      return `
        <button class="theme-option${active}" type="button" data-theme-value="${theme.value}" aria-pressed="${theme.value === state.theme}">
          <span class="theme-swatch" style="--swatch: ${theme.swatch}"></span>
          ${theme.label}
        </button>
      `;
    })
    .join("");
}

function renderGroups() {
  if (!state.groups.length) {
    elements.groupList.innerHTML = `<p class="group-meta">Создайте первую группу, чтобы начать журнал.</p>`;
    return;
  }

  elements.groupList.innerHTML = state.groups
    .map((group) => {
      const active = group.id === state.selectedGroupId ? " active" : "";
      return `
        <button class="group-item${active}" type="button" data-group-id="${group.id}">
          <span class="group-name">${escapeHtml(group.name)}</span>
          <span class="group-meta">${formatTimeRange(group)} · ${formatDays(group.days)}</span>
          <span class="group-meta">${group.students.length} ${pluralize(group.students.length, ["ученик", "ученика", "учеников"])}</span>
        </button>
      `;
    })
    .join("");
}

function renderGroupForm() {
  const group = editingGroupId ? getGroup(editingGroupId) : null;
  elements.groupFormTitle.textContent = group ? "Настройки группы" : "Новая группа";
  elements.deleteGroupButton.disabled = !group;
  elements.groupNameInput.value = group?.name || "";
  elements.groupStartInput.value = group?.start || "18:00";
  elements.groupEndInput.value = group?.end || "";
  selectedDayValues = new Set(group?.days || Array.from(selectedDayValues));
  renderDayPills();
}

function renderDayPills() {
  elements.dayPills.innerHTML = dayOptions
    .map((day) => {
      const active = selectedDayValues.has(day.value) ? " active" : "";
      return `
        <button class="day-pill${active}" type="button" data-day-value="${day.value}" aria-pressed="${selectedDayValues.has(day.value)}">
          ${day.short}
        </button>
      `;
    })
    .join("");
}

function renderActiveGroup() {
  const group = getSelectedGroup();
  const hasGroup = Boolean(group);

  elements.activeGroupTitle.textContent = group?.name || "Нет группы";
  elements.activeGroupSchedule.textContent = group
    ? `${formatDays(group.days)} · ${formatTimeRange(group)}`
    : "Создайте группу слева, укажите дни и время.";

  elements.studentNameInput.disabled = !hasGroup;
  elements.studentForm.querySelector("button").disabled = !hasGroup;
  elements.exportButton.disabled = !hasGroup;
  elements.prevMonthButton.disabled = !hasGroup;
  elements.nextMonthButton.disabled = !hasGroup;
  elements.monthInput.disabled = !hasGroup;
}

function renderJournal() {
  const group = getSelectedGroup();
  if (!group || !group.students.length) {
    elements.journalTable.innerHTML = "";
    elements.emptyState.classList.add("visible");
    elements.emptyState.querySelector("h3").textContent = group
      ? "Добавьте учеников в группу"
      : "Выберите группу и добавьте учеников";
    elements.emptyState.querySelector("p").textContent = group
      ? "После добавления первого ученика здесь появится журнал выбранного месяца."
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

  const rows = group.students
    .map((student) => {
      const summary = getStudentSummary(group, student.id, dates);
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
              <span class="student-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span>
              <button class="icon-button remove-student" type="button" data-remove-student-id="${student.id}" aria-label="Удалить ученика" title="Удалить ученика">
                <i data-lucide="x"></i>
              </button>
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

  refreshIcons();
}

function renderStats() {
  const group = getSelectedGroup();

  if (!group) {
    elements.stats.innerHTML = "";
    return;
  }

  const dates = getTrainingDates(group, elements.monthInput.value);
  const totals = dates.reduce(
    (acc, date) => {
      const dayMarks = group.attendance[date.iso] || {};
      Object.values(dayMarks).forEach((mark) => {
        if (mark === "+") acc.present += 1;
        if (mark === "-") acc.absent += 1;
      });
      return acc;
    },
    { present: 0, absent: 0 },
  );

  elements.stats.innerHTML = `
    <span class="stat-pill">${group.students.length} ${pluralize(group.students.length, ["ученик", "ученика", "учеников"])}</span>
    <span class="stat-pill">${dates.length} ${pluralize(dates.length, ["тренировка", "тренировки", "тренировок"])}</span>
    <span class="stat-pill">+ ${totals.present}</span>
    <span class="stat-pill">- ${totals.absent}</span>
  `;
}

function setNextAttendance(studentId, date) {
  const group = getSelectedGroup();
  if (!group) return;

  if (!group.attendance[date]) {
    group.attendance[date] = {};
  }

  const current = group.attendance[date][studentId] || "";
  const next = attendanceFlow[(attendanceFlow.indexOf(current) + 1) % attendanceFlow.length];

  if (next) {
    group.attendance[date][studentId] = next;
  } else {
    delete group.attendance[date][studentId];
    if (!Object.keys(group.attendance[date]).length) {
      delete group.attendance[date];
    }
  }

  saveState();
  renderJournal();
  renderStats();
}

function removeStudent(studentId) {
  const group = getSelectedGroup();
  if (!group) return;

  const student = group.students.find((item) => item.id === studentId);
  if (!student) return;

  const confirmed = window.confirm(`Удалить ученика "${student.name}" и его отметки?`);
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

function exportCsv() {
  const group = getSelectedGroup();
  if (!group) return;

  const dates = getTrainingDates(group, elements.monthInput.value);
  const rows = [
    ["Ученик", ...dates.map((date) => `${date.iso} ${date.weekday}`), "Итого"],
    ...group.students.map((student) => {
      const summary = getStudentSummary(group, student.id, dates);
      return [
        student.name,
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
  link.download = `${group.name}-${elements.monthInput.value}.csv`;
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
  renderJournal();
  renderStats();
}

function getSelectedGroup() {
  return getGroup(state.selectedGroupId);
}

function getGroup(id) {
  return state.groups.find((group) => group.id === id);
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

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
