
// =========================================================================
// 1. KODE INITIALIZE FIREBASE (Ditaruh di paling atas, di luar fungsi bawaan)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDUEUgPeaEufr_EIEQOL5K_kpHK3fiRIXQ",
  authDomain: "aturin-6a0d3.firebaseapp.com",
  projectId: "aturin-6a0d3",
  databaseURL: "https://aturin-6a0d3-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "aturin-6a0d3.firebasestorage.app",
  messagingSenderId: "512476883279",
  appId: "1:512476883279:web:3832a7b6568b605d8bbd3a",
  measurementId: "G-LPGKPM3FYE"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const rtdb = firebase.database();

function loginDenganGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/calendar.events");
  auth.signInWithPopup(provider)
    .then((result) => {
      console.log("Berhasil Login:", result.user.displayName);
      alert("Selamat Datang, " + result.user.displayName);
    })
    .catch((error) => {
      console.error("Gagal Login:", error.message);
      alert("Login Google gagal. Periksa koneksi dan pengaturan Firebase Authentication.");
    });
}

function logout() {
  auth.signOut()
    .then(() => alert("Anda telah keluar."))
    .catch((error) => {
      console.error("Gagal keluar:", error.message);
      alert("Tidak dapat keluar. Silakan coba lagi.");
    });
}

auth.onAuthStateChanged((user) => {
  const loginButton = document.querySelector("#btn-login");
  const userProfile = document.querySelector("#user-profile");
  const userName = document.querySelector("#user-name");

  if (loginButton) {
    loginButton.style.display = user ? "none" : "block";
  }

  if (userProfile) {
    userProfile.style.display = user ? "flex" : "none";
  }

  if (userName) {
    userName.textContent = user ? user.displayName || user.email || "Pengguna Aturin" : "";
  }
});


"use strict";

(() => {
  const STORAGE_KEY = "aturin.tasks.v1";
  const FORMAT = "aturin-local-data";
  const VERSION = 1;
  const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const DELETE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg>';
  const CLOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>';
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dateWords = {
    jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3,
    mei: 4, jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agustus: 7,
    sep: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10, des: 11, desember: 11
  };
  const elements = {
    navLinks: [...document.querySelectorAll(".nav-link[data-view]")],
    views: [...document.querySelectorAll(".view-panel")],
    breadcrumb: document.querySelector("#breadcrumb-current"),
    menu: document.querySelector("#mobile-menu"),
    sidebar: document.querySelector(".sidebar"),
    saveStatus: document.querySelector("#save-status"),
    notificationButton: document.querySelector("#notification-toggle"),
    notificationLabel: document.querySelector("#notification-label"),
    calendarExportButton: document.querySelector("#calendar-export"),
    calendarDialog: document.querySelector("#calendar-dialog"),
    calendarExportSummary: document.querySelector("#calendar-export-summary"),
    downloadCalendarButton: document.querySelector("#download-calendar"),
    todayLabel: document.querySelector("#today-label"),
    heroHeading: document.querySelector("#hero-heading"),
    heroCopy: document.querySelector("#hero-copy"),
    todayTotal: document.querySelector("#today-total"),
    todayCaption: document.querySelector("#today-caption"),
    doneTotal: document.querySelector("#done-total"),
    doneCaption: document.querySelector("#done-caption"),
    progressValue: document.querySelector("#progress-value"),
    progressBar: document.querySelector("#progress-bar"),
    todayHeadingCount: document.querySelector("#today-heading-count"),
    todayList: document.querySelector("#today-list"),
    upcomingList: document.querySelector("#upcoming-list"),
    upcomingMonth: document.querySelector("#upcoming-month"),
    agendaCount: document.querySelector("#agenda-count"),
    agendaDateTitle: document.querySelector("#agenda-date-title"),
    agendaDateStrip: document.querySelector("#agenda-date-strip"),
    agendaList: document.querySelector("#agenda-list"),
    routineCount: document.querySelector("#routine-count"),
    routineList: document.querySelector("#routine-list"),
    dialog: document.querySelector("#task-dialog"),
    form: document.querySelector("#task-form"),
    moreOptions: document.querySelector(".more-options"),
    naturalInput: document.querySelector("#natural-input"),
    voiceButton: document.querySelector("#voice-button"),
    voiceButtonLabel: document.querySelector("#voice-button-label"),
    voiceHint: document.querySelector("#voice-hint"),
    missingFields: document.querySelector("#missing-fields"),
    titleInput: document.querySelector("#task-title"),
    dateInput: document.querySelector("#task-date"),
    timeInput: document.querySelector("#task-time"),
    priorityInput: document.querySelector("#task-priority"),
    prioritySuggestion: document.querySelector("#priority-suggestion"),
    reminderInput: document.querySelector("#task-reminder"),
    routineInput: document.querySelector("#task-routine"),
    recurrenceField: document.querySelector("#recurrence-field"),
    recurrenceInput: document.querySelector("#task-recurrence"),
    formError: document.querySelector("#form-error"),
    status: document.querySelector("#app-status"),
    toastRegion: document.querySelector("#toast-region")
  };

  let tasks = [];
  let selectedDate = startOfDay(new Date());
  let storageAvailable = true;
  let cloudReadyUid = null;
  let cloudTasksRef = null;
  let cloudWriteQueue = Promise.resolve();
  let lastReminderCheck = new Date();
  let recognition = null;
  let voiceRecordingActive = false;
  let voiceTranscript = "";
  let voiceSessionTranscript = "";
  let voiceRestartTimer = 0;
  let missingVoiceFields = [];
  let priorityManuallySelected = false;
  const deliveredReminders = new Set();

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function formatDate(date, options = {}) {
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function isValidTask(task) {
    return task !== null && typeof task === "object"
      && typeof task.id === "string" && task.id.length > 0
      && typeof task.title === "string" && task.title.length > 0 && task.title.length <= 100
      && dateFromKey(task.date) !== null
      && (task.time === "" || (typeof task.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)))
      && ["low", "normal", "high"].includes(task.priority)
      && typeof task.completed === "boolean"
      && typeof task.routine === "boolean"
      && ["none", "0", "10", "60"].includes(task.reminder)
      && ["daily", "weekly", "monthly", null].includes(task.recurrence)
      && (task.completedDates === undefined || (Array.isArray(task.completedDates)
        && task.completedDates.every(value => dateFromKey(value) !== null)))
      && (task.recurrence === null || task.routine);
  }

  function normalizeCloudTask(task, taskKey) {
    if (task === null || typeof task !== "object" || Array.isArray(task)) return task;

    const normalized = { ...task };
    if ((typeof normalized.id !== "string" || normalized.id.length === 0) && typeof taskKey === "string" && taskKey.length > 0) {
      normalized.id = taskKey;
    }
    if (normalized.time === undefined || normalized.time === null) normalized.time = "";
    if (!["low", "normal", "high"].includes(normalized.priority)) normalized.priority = "normal";
    if (typeof normalized.completed !== "boolean") normalized.completed = false;
    if (typeof normalized.routine !== "boolean") normalized.routine = false;
    if (!["none", "0", "10", "60"].includes(normalized.reminder)) normalized.reminder = "none";
    if (normalized.recurrence === undefined) normalized.recurrence = null;
    if (normalized.recurrence === "none") normalized.recurrence = null;
    if (normalized.recurrence !== null && normalized.recurrence !== undefined) normalized.routine = true;
    if (normalized.completedDates === undefined || normalized.completedDates === null) {
      normalized.completedDates = [];
    } else if (!Array.isArray(normalized.completedDates) && typeof normalized.completedDates === "object") {
      const dates = Object.entries(normalized.completedDates);
      if (dates.every(([key]) => /^\d+$/.test(key))) {
        normalized.completedDates = dates
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, value]) => value);
      } else if (dates.every(([key, value]) => dateFromKey(key) !== null && typeof value === "boolean")) {
        normalized.completedDates = dates.filter(([, done]) => done).map(([key]) => key);
      }
    }

    return normalized;
  }

  function getCloudTaskRecords(cloudValue) {
    const storedTasks = cloudValue && typeof cloudValue === "object" && !Array.isArray(cloudValue)
      && cloudValue.tasks && typeof cloudValue.tasks === "object"
      ? cloudValue.tasks
      : cloudValue;
    if (Array.isArray(storedTasks)) {
      return storedTasks.map((task, index) => normalizeCloudTask(task, String(index)));
    }
    if (storedTasks && typeof storedTasks === "object") {
      return Object.entries(storedTasks).map(([key, task]) => normalizeCloudTask(task, key));
    }
    return [];
  }

  function getInvalidTaskFields(task) {
    if (task === null || typeof task !== "object" || Array.isArray(task)) return ["task"];
    const invalidFields = [];
    if (typeof task.id !== "string" || task.id.length === 0) invalidFields.push("id");
    if (typeof task.title !== "string" || task.title.length === 0 || task.title.length > 100) invalidFields.push("title");
    if (dateFromKey(task.date) === null) invalidFields.push("date");
    if (!(task.time === "" || (typeof task.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)))) invalidFields.push("time");
    if (!["low", "normal", "high"].includes(task.priority)) invalidFields.push("priority");
    if (typeof task.completed !== "boolean") invalidFields.push("completed");
    if (typeof task.routine !== "boolean") invalidFields.push("routine");
    if (!["none", "0", "10", "60"].includes(task.reminder)) invalidFields.push("reminder");
    if (!["daily", "weekly", "monthly", null].includes(task.recurrence)) invalidFields.push("recurrence");
    if (!Array.isArray(task.completedDates)
      || !task.completedDates.every(value => dateFromKey(value) !== null)) invalidFields.push("completedDates");
    if (task.recurrence !== null && !task.routine && !invalidFields.includes("routine")) invalidFields.push("routine/recurrence");
    return invalidFields;
  }

  function setSaveStatus(message, isError = false) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.parentElement.classList.toggle("is-error", isError);
  }

  function readTasks() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      setSaveStatus("Penyimpanan tidak tersedia", true);
      showToast("Penyimpanan tidak tersedia", "Izinkan penyimpanan lokal di browser untuk memakai Aturin.", true);
      return [];
    }
    if (raw === null) return [];
    try {
      const data = JSON.parse(raw);
      if (data.format !== FORMAT || data.version !== VERSION || !Array.isArray(data.tasks) || !data.tasks.every(isValidTask)) {
        throw new Error("Format atau isi data tidak dikenali.");
      }
      data.tasks.forEach(task => {
        if (!Array.isArray(task.completedDates)) task.completedDates = [];
      });
      return data.tasks;
    } catch (error) {
      storageAvailable = false;
      setSaveStatus("Data tidak dapat dibaca", true);
      showToast("Data lokal tidak dapat dibaca", "Data tidak diubah. Periksa penyimpanan browser sebelum melanjutkan.", true);
      return [];
    }
  }

  function saveTasks() {
    const user = auth.currentUser;
    if (user) {
      if (cloudReadyUid !== user.uid) {
        setSaveStatus("Menunggu data Cloud", true);
        showToast("Belum bisa menyimpan", "Tunggu sampai data akun selesai dimuat dari Cloud.", true);
        return false;
      }

      const cloudTasks = tasks.reduce((data, task) => {
        data[task.id] = task;
        return data;
      }, {});
      setSaveStatus("Menyimpan ke Cloud...");
      const write = cloudWriteQueue.then(async () => {
        if (auth.currentUser?.uid !== user.uid) return;
        await rtdb.ref(`users/${user.uid}/tasks`).set(cloudTasks);
        if (auth.currentUser?.uid === user.uid) {
          setSaveStatus("Tersimpan di Cloud");
        }
      });
      cloudWriteQueue = write.catch(error => {
        console.error("Gagal menyimpan tugas ke Cloud:", error);
        if (auth.currentUser?.uid === user.uid) {
          setSaveStatus("Gagal sinkron Cloud", true);
          showToast("Gagal menyimpan ke Cloud", "Periksa koneksi dan aturan keamanan Realtime Database.", true);
        }
      });
      return true;
    }

    if (!storageAvailable) {
      setSaveStatus("Perubahan belum tersimpan", true);
      showToast("Perubahan belum disimpan", "Penyimpanan lokal bermasalah. Data hanya tersedia selama halaman ini terbuka.", true);
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: FORMAT, version: VERSION, tasks }));
      setSaveStatus("Tersimpan di perangkat");
      return true;
    } catch (error) {
      storageAvailable = false;
      setSaveStatus("Gagal menyimpan", true);
      showToast("Gagal menyimpan perubahan", "Browser tidak dapat menyimpan data Aturin di perangkat ini.", true);
      return false;
    }
  }

  function canEditTasks() {
    const user = auth.currentUser;
    if (!user || cloudReadyUid === user.uid) return true;
    setSaveStatus("Menunggu data Cloud", true);
    showToast("Belum bisa mengubah urusan", "Tunggu sampai data akun selesai dimuat dari Cloud.", true);
    return false;
  }

  function handleAuthStateChange(user) {
    if (cloudTasksRef) {
      cloudTasksRef.off();
      cloudTasksRef = null;
    }
    cloudReadyUid = null;

    if (!user) {
      tasks = readTasks();
      render();
      if (storageAvailable) setSaveStatus("Tersimpan di perangkat");
      return;
    }

    tasks = [];
    render();
    setSaveStatus("Memuat dari Cloud...");
    const uid = user.uid;
    const tasksRef = rtdb.ref(`users/${uid}/tasks`);
    cloudTasksRef = tasksRef;
    let firstSnapshot = true;

    tasksRef.on("value", snapshot => {
      if (auth.currentUser?.uid !== uid || cloudTasksRef !== tasksRef) return;
      const cloudValue = snapshot.val();

      if (cloudValue === null && firstSnapshot) {
        firstSnapshot = false;
        const localTasks = readTasks();
        if (localTasks.length > 0) {
          tasks = localTasks;
          cloudReadyUid = uid;
          render();
          saveTasks();
          return;
        }
      } else {
        firstSnapshot = false;
      }

      if (cloudValue === null) {
        tasks = [];
      } else {
        const cloudTasks = getCloudTaskRecords(cloudValue);
        if (!cloudTasks.every(isValidTask)) {
          const invalidTasks = cloudTasks
            .map((task, index) => ({ index, fields: getInvalidTaskFields(task) }))
            .filter(task => task.fields.length > 0);
          console.error("Tugas Realtime Database tidak cocok dengan skema Aturin:", invalidTasks);
          setSaveStatus("Data Cloud tidak valid", true);
          showToast("Data Cloud tidak dapat dibaca", "Struktur tugas di Realtime Database tidak sesuai format Aturin.", true);
          return;
        }
        tasks = cloudTasks;
      }

      cloudReadyUid = uid;
      render();
      setSaveStatus("Sinkron dengan Cloud");
    }, error => {
      if (auth.currentUser?.uid !== uid || cloudTasksRef !== tasksRef) return;
      console.error("Gagal memuat tugas dari Cloud:", error);
      cloudReadyUid = null;
      tasks = readTasks();
      render();
      setSaveStatus("Gagal memuat dari Cloud", true);
      showToast("Data Cloud belum bisa dimuat", "Periksa koneksi, URL database, dan aturan keamanan Realtime Database.", true);
    });
  }

  function showToast(title, message, isError = false, duration = 5000) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " is-error" : ""}`;
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${isError ? "!" : "✦"}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div><button class="toast-close" type="button" aria-label="Tutup pemberitahuan">×</button>`;
    const closeButton = toast.querySelector(".toast-close");
    closeButton.addEventListener("click", () => toast.remove());
    elements.toastRegion.append(toast);
    elements.status.textContent = `${title}. ${message}`;
    window.setTimeout(() => toast.remove(), duration);
  }

  function emptyState(title, message, icon = "✦") {
    return `<div class="empty-state"><span class="empty-illustration" aria-hidden="true">${icon}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  }

  function priorityLabel(priority) {
    if (priority === "high") return "Penting";
    if (priority === "low") return "Kalau sempat";
    return "";
  }

  function recurrenceLabel(recurrence) {
    if (recurrence === "daily") return "Setiap hari";
    if (recurrence === "weekly") return "Setiap minggu";
    if (recurrence === "monthly") return "Setiap bulan";
    return "";
  }

  function isScheduledOn(task, key) {
    if (dateFromKey(key) === null || key < task.date) return false;
    if (!task.routine || task.recurrence === null) return key === task.date;
    const date = dateFromKey(key);
    const startDate = dateFromKey(task.date);
    if (task.recurrence === "daily") return true;
    if (task.recurrence === "weekly") return date.getDay() === startDate.getDay();
    return date.getDate() === startDate.getDate();
  }

  function isTaskCompleted(task, key) {
    return task.routine && task.recurrence !== null
      ? task.completedDates.includes(key)
      : task.completed;
  }

  function nextOccurrence(task, fromDate) {
    const date = startOfDay(fromDate);
    for (let offset = 1; offset <= 366; offset += 1) {
      date.setDate(date.getDate() + 1);
      const key = dateKey(date);
      if (isScheduledOn(task, key) && !isTaskCompleted(task, key)) {
        return { task, date: new Date(date) };
      }
    }
    return null;
  }

  function taskRow(task, variant = "home", occurrenceDate = task.date) {
    const taskDate = dateFromKey(variant === "routine" ? task.date : occurrenceDate);
    const timeLabel = task.time ? task.time : "Atur waktu";
    const completed = isTaskCompleted(task, occurrenceDate);
    const canComplete = variant !== "routine" || isScheduledOn(task, occurrenceDate);
    const priority = priorityLabel(task.priority);
    const priorityMarkup = priority
      ? `<span class="priority-mark${task.priority === "low" ? " is-low" : ""}">${priority}</span>`
      : "";
    const routineMarkup = task.routine ? `<span class="task-tag">${recurrenceLabel(task.recurrence)}</span>` : "";
    const metaDate = variant === "home" ? "" : `<span>${formatDate(taskDate, { day: "numeric", month: "short" })}</span>`;
    const homeMeta = variant === "home"
      ? `<span class="task-meta">${task.time ? `<span class="task-time">${CLOCK_ICON}${escapeHtml(timeLabel)}</span>` : '<span>Belum dijadwalkan</span>'}${routineMarkup}</span>`
      : `<span class="task-meta">${metaDate}${routineMarkup}</span>`;
    const agendaColumns = variant === "agenda";
    return `<article class="task-row${completed ? " is-complete" : ""}" data-task-id="${escapeHtml(task.id)}" data-occurrence-date="${occurrenceDate}">
      <button class="task-check${completed ? " is-checked" : ""}" type="button" data-action="toggle" aria-label="${completed ? "Tandai belum selesai" : "Tandai selesai"}: ${escapeHtml(task.title)}" aria-pressed="${completed}"${canComplete ? "" : " disabled"}>${completed ? CHECK_ICON : ""}</button>
      <div class="task-main"><span class="task-title">${escapeHtml(task.title)}</span>${homeMeta}</div>
      ${agendaColumns ? `<span class="row-time">${escapeHtml(timeLabel)}</span>${priorityMarkup || '<span></span>'}<span class="agenda-status${completed ? " is-done" : ""}">${completed ? "Selesai" : "Belum"}</span><button class="delete-task" type="button" data-action="delete" aria-label="Hapus ${escapeHtml(task.title)}">${DELETE_ICON}</button>` : `<span class="task-actions">${priorityMarkup}<button class="delete-task" type="button" data-action="delete" aria-label="Hapus ${escapeHtml(task.title)}">${DELETE_ICON}</button></span>`}
    </article>`;
  }

  function renderHome() {
    const today = startOfDay(new Date());
    const todayId = dateKey(today);
    const todayTasks = tasks.filter(task => isScheduledOn(task, todayId));
    const completed = todayTasks.filter(task => isTaskCompleted(task, todayId)).length;
    const progress = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0;
    const openTasks = todayTasks.filter(task => !isTaskCompleted(task, todayId));

    elements.todayLabel.textContent = formatDate(today, { weekday: "long", day: "numeric", month: "long" }).toLocaleUpperCase("id-ID");
    elements.todayTotal.textContent = String(openTasks.length);
    elements.todayCaption.textContent = todayTasks.length === 0 ? "siap diatur" : openTasks.length ? "urusan tersisa" : "semua dituntaskan";
    elements.doneTotal.textContent = String(completed);
    elements.doneCaption.textContent = completed === 1 ? "langkah kecil" : "langkah kecil";
    elements.progressValue.textContent = `${progress}%`;
    elements.progressBar.style.width = `${progress}%`;
    elements.todayHeadingCount.textContent = String(todayTasks.length);

    if (todayTasks.length === 0) {
      elements.heroHeading.textContent = "Hari ini masih milikmu.";
      elements.heroCopy.textContent = "Tambahkan urusan pertamamu dan biarkan Aturin membantu mengingatnya.";
      elements.todayList.innerHTML = emptyState("Belum ada agenda untuk hari ini", "Catat urusan yang ingin kamu ingat. Tak harus besar untuk jadi penting.", "＋");
    } else {
      elements.heroHeading.textContent = openTasks.length ? "Satu per satu, kamu bisa." : "Semua urusan hari ini selesai!";
      elements.heroCopy.textContent = openTasks.length
        ? `${openTasks.length} urusan menunggu perhatianmu. Pilih satu yang terasa paling pas untuk dimulai.`
        : "Kamu sudah menuntaskan agenda hari ini. Semoga ada waktu untuk beristirahat.";
      elements.todayList.innerHTML = todayTasks
        .slice()
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
        .map(task => taskRow(task, "home", todayId))
        .join("");
    }

    const upcoming = tasks
      .map(task => nextOccurrence(task, today))
      .filter(item => item !== null)
      .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || (a.task.time || "99:99").localeCompare(b.task.time || "99:99"))
      .slice(0, 4);
    elements.upcomingMonth.textContent = formatDate(today, { month: "long", year: "numeric" });
    elements.upcomingList.innerHTML = upcoming.length
      ? upcoming.map(({ task, date }) => {
        return `<div class="upcoming-item"><span class="upcoming-date"><strong>${date.getDate()}</strong><small>${monthNames[date.getMonth()]}</small></span><span class="upcoming-copy"><strong>${escapeHtml(task.title)}</strong><small>${formatDate(date, { weekday: "long" })}${task.time ? ` · ${escapeHtml(task.time)}` : ""}</small></span></div>`;
      }).join("")
      : emptyState("Belum ada yang berikutnya", "Urusan yang dijadwalkan nanti akan muncul di sini.", "◷");
  }

  function renderAgenda() {
    const selected = startOfDay(selectedDate);
    const selectedKey = dateKey(selected);
    const selectedTasks = tasks.filter(task => isScheduledOn(task, selectedKey))
      .slice()
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

    elements.agendaDateTitle.textContent = formatDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    elements.agendaDateStrip.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selected);
      date.setDate(selected.getDate() - 3 + index);
      const key = dateKey(date);
      const classes = ["date-chip"];
      if (key === dateKey(startOfDay(new Date()))) classes.push("is-today");
      if (key === selectedKey) classes.push("is-selected");
      return `<button class="${classes.join(" ")}" type="button" data-date="${key}" aria-label="${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}${key === selectedKey ? ", dipilih" : ""}" aria-pressed="${key === selectedKey}"><span>${formatDate(date, { weekday: "short" })}</span><strong>${date.getDate()}</strong></button>`;
    }).join("");
    elements.agendaList.innerHTML = selectedTasks.length
      ? selectedTasks.map(task => taskRow(task, "agenda", selectedKey)).join("")
      : emptyState("Tanggal ini masih lengang", "Kalau ada urusan yang ingin kamu ingat, tambahkan ke agenda.", "◷");
  }

  function renderRoutines() {
    const routineTasks = tasks.filter(task => task.routine)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99"));
    elements.routineCount.textContent = `${routineTasks.length} rutinitas`;
    elements.routineList.innerHTML = routineTasks.length
      ? routineTasks.map(task => taskRow(task, "routine", dateKey(startOfDay(new Date())))).join("")
      : emptyState("Rutinitasmu dimulai dari sini", "Catat kegiatan yang ingin diulang setiap hari, minggu, atau bulan.", "↻");
  }

  function render() {
    renderHome();
    renderAgenda();
    renderRoutines();
    const todayKey = dateKey(startOfDay(new Date()));
    elements.agendaCount.textContent = String(tasks.filter(task => isScheduledOn(task, todayKey) && !isTaskCompleted(task, todayKey)).length);
  }

  function switchView(view) {
    const validViews = ["beranda", "agenda", "rutinitas"];
    if (!validViews.includes(view)) return;
    elements.views.forEach(panel => panel.classList.toggle("hidden", panel.id !== `view-${view}`));
    elements.navLinks.forEach(link => {
      const selected = link.dataset.view === view;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    elements.breadcrumb.textContent = view === "beranda" ? "Beranda" : view === "agenda" ? "Agenda" : "Rutinitas";
    elements.sidebar.classList.remove("is-open");
    elements.menu.setAttribute("aria-expanded", "false");
  }

  function openTaskDialog() {
    if (recognition) stopVoiceRecording(false);
    elements.form.reset();
    priorityManuallySelected = false;
    elements.prioritySuggestion.textContent = "";
    elements.prioritySuggestion.classList.add("hidden");
    elements.voiceHint.textContent = "Pilih Bicara, lalu sebutkan urusan dan waktunya. Suara dapat diproses oleh layanan browser.";
    elements.voiceHint.classList.remove("parse-error");
    elements.missingFields.classList.add("hidden");
    elements.missingFields.replaceChildren();
    missingVoiceFields = [];
    elements.formError.textContent = "";
    elements.moreOptions.open = false;
    elements.recurrenceField.classList.add("hidden");
    elements.dialog.showModal();
    window.setTimeout(() => elements.voiceButton.focus(), 0);
  }

  function parseNaturalText(value) {
    const input = value.trim();
    if (!input) return { error: "Tulis kalimat singkat terlebih dahulu." };
    const now = new Date();
    let date = startOfDay(now);
    let hasDate = false;
    const lower = input.toLocaleLowerCase("id-ID");
    let remaining = input;
    const removePhrase = phrase => {
      remaining = remaining.replace(new RegExp(`\\b${phrase}\\b`, "i"), " ");
    };

    if (/\blusa\b/i.test(lower)) {
      date.setDate(date.getDate() + 2);
      hasDate = true;
      removePhrase("lusa");
    } else if (/\bbesok\b/i.test(lower)) {
      date.setDate(date.getDate() + 1);
      hasDate = true;
      removePhrase("besok");
    } else if (/\bhari ini\b/i.test(lower)) {
      hasDate = true;
      removePhrase("hari ini");
    }

    const weekdayPattern = /\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)\b/i;
    const weekdayMatch = lower.match(weekdayPattern);
    if (weekdayMatch) {
      const weekdays = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
      const target = weekdays[weekdayMatch[1].toLocaleLowerCase("id-ID")];
      let difference = (target - now.getDay() + 7) % 7;
      if (difference === 0) difference = 7;
      date = startOfDay(now);
      date.setDate(date.getDate() + difference);
      hasDate = true;
      remaining = remaining.replace(weekdayPattern, " ");
    }

    const explicitDate = lower.match(/\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\b/i);
    if (explicitDate) {
      const day = Number(explicitDate[1]);
      const month = dateWords[explicitDate[2].toLocaleLowerCase("id-ID")];
      const yearMatch = lower.match(new RegExp(`\\b${explicitDate[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d{4})\\b`, "i"));
      let year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
      let parsed = new Date(year, month, day);
      if (parsed.getMonth() !== month || parsed.getDate() !== day) return { error: "Tanggal tersebut tidak valid. Coba periksa kembali." };
      if (!yearMatch && parsed < startOfDay(now)) parsed = new Date(year + 1, month, day);
      date = parsed;
      hasDate = true;
      remaining = remaining.replace(explicitDate[0], " ");
      if (yearMatch) remaining = remaining.replace(yearMatch[0], " ");
    }

    let time = "";
    const timeWords = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, "dua belas": 12 };
    const spokenTime = lower.match(/\b(?:jam|pukul)\s+(dua belas|sebelas|sepuluh|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu|(?:[01]?\d|2[0-3])(?:[:.][0-5]\d)?)\s*(pagi|siang|sore|malam)?\b/i);
    const digitalTime = lower.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i);
    const timeMatch = spokenTime || digitalTime;
    if (timeMatch) {
      const spokenValue = spokenTime ? timeMatch[1].toLocaleLowerCase("id-ID") : "";
      let hour;
      let minute;
      if (digitalTime && !spokenTime) {
        hour = Number(timeMatch[1]);
        minute = Number(timeMatch[2]);
      } else if (spokenValue.includes(":") || spokenValue.includes(".")) {
        const parts = spokenValue.replace(".", ":").split(":");
        hour = Number(parts[0]);
        minute = Number(parts[1]);
      } else {
        hour = timeWords[spokenValue] ?? Number(spokenValue);
        minute = 0;
      }
      const period = spokenTime?.[2]?.toLocaleLowerCase("id-ID");
      if (period === "pagi" && hour === 12) hour = 0;
      if ((period === "siang" || period === "sore" || period === "malam") && hour < 12) hour += 12;
      time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      remaining = remaining.replace(timeMatch[0], " ");
    }

    const title = remaining
      .replace(/\b(pukul|jam|pagi|siang|sore|malam|tanggal|ingatkan|ingat|setiap|rutin|besok|lusa|hari ini)\b/gi, " ")
      .replace(/\b(aku|saya|tolong|untuk|pada)\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, "")
      .trim();
    return {
      title: title ? title.charAt(0).toLocaleUpperCase("id-ID") + title.slice(1) : "",
      date: hasDate ? dateKey(date) : "",
      time,
      missing: [!title && "title", !hasDate && "date", !time && "time"].filter(Boolean)
    };
  }

  function handleParse() {
    const result = parseNaturalText(elements.naturalInput.value);
    if (result.error) {
      elements.voiceHint.textContent = result.error;
      elements.voiceHint.classList.add("parse-error");
      return;
    }
    if (result.title) elements.titleInput.value = result.title;
    if (result.date) elements.dateInput.value = result.date;
    if (result.time) elements.timeInput.value = result.time;
    suggestPriority();
    missingVoiceFields = result.missing;
    renderMissingFields();
    const recognized = [
      result.title && `urusan: ${result.title}`,
      result.date && `tanggal: ${formatDate(dateFromKey(result.date), { day: "numeric", month: "long" })}`,
      result.time && `jam: ${result.time}`
    ].filter(Boolean);
    elements.voiceHint.textContent = recognized.length
      ? `Terbaca ${recognized.join(" · ")}. Silakan periksa sebelum disimpan.`
      : "Belum ada bagian yang terbaca. Isi nama urusan dan tanggal di bawah.";
    elements.voiceHint.classList.toggle("parse-error", recognized.length === 0);
    elements.status.textContent = elements.voiceHint.textContent;
    if (missingVoiceFields.includes("title")) elements.titleInput.focus();
    else if (missingVoiceFields.includes("date")) elements.dateInput.focus();
    else if (missingVoiceFields.includes("time")) elements.timeInput.focus();
  }

  function suggestPriority() {
    if (priorityManuallySelected) return;

    const text = `${elements.titleInput.value} ${elements.naturalInput.value}`.toLocaleLowerCase("id-ID");
    const taskDate = dateFromKey(elements.dateInput.value);
    const today = startOfDay(new Date());
    const daysUntilDue = taskDate ? Math.round((taskDate - today) / 86_400_000) : null;
    let priority = "normal";
    let reason = "Belum ada tanda mendesak; urusan ini bisa diatur seperti biasa.";

    if (/\b(opsional|kalau sempat|bisa nanti|hobi|santai)\b/i.test(text)) {
      priority = "low";
      reason = "Kata-katanya menunjukkan urusan ini bisa menunggu.";
    } else if (/\b(darurat|mendesak|segera|deadline|tenggat|ujian|presentasi|sidang|wawancara|tagihan|bayar|pembayaran|obat|dokter|kontrak)\b/i.test(text)) {
      priority = "high";
      reason = "Nama urusan mengandung kata yang biasanya perlu didahulukan.";
    } else if (daysUntilDue !== null && daysUntilDue <= 1) {
      priority = "high";
      reason = "Tanggalnya hari ini atau besok, jadi mungkin perlu didahulukan.";
    } else if (daysUntilDue !== null && daysUntilDue <= 3) {
      priority = "normal";
      reason = "Tanggalnya sudah dekat; pastikan urusan ini masuk agenda.";
    }

    elements.priorityInput.value = priority;
    const labels = { high: "Penting", normal: "Biasa", low: "Bisa nanti" };
    elements.prioritySuggestion.textContent = `Saran berdasarkan kata dan tanggal: ${labels[priority]}. ${reason} Ubah jika kurang sesuai.`;
    elements.prioritySuggestion.classList.remove("hidden");
  }

  function renderMissingFields() {
    const requiredMissing = [];
    if (!elements.titleInput.value.trim()) requiredMissing.push("title");
    if (!elements.dateInput.value || !dateFromKey(elements.dateInput.value)) requiredMissing.push("date");
    const reminderNeedsTime = elements.reminderInput.value !== "none" && !elements.timeInput.value;
    const unresolved = [...new Set([...requiredMissing, ...missingVoiceFields])];
    if (reminderNeedsTime && !unresolved.includes("time")) unresolved.push("time");
    if (!unresolved.length) {
      elements.missingFields.classList.add("hidden");
      elements.missingFields.replaceChildren();
      return;
    }

    const labels = { title: "Nama urusan", date: "Tanggal", time: "Jam (opsional)" };
    elements.missingFields.classList.remove("hidden");
    elements.missingFields.innerHTML = `<strong>Lengkapi bagian ini:</strong>${unresolved.map(field =>
      `<button class="missing-field-link" type="button" data-focus-field="${field}">${labels[field]}</button>`
    ).join("")}`;
  }

  function foldCalendarLine(line) {
    const encoder = new TextEncoder();
    const chunks = [];
    let chunk = "";
    let chunkBytes = 0;
    for (const character of line) {
      const characterBytes = encoder.encode(character).length;
      if (chunkBytes + characterBytes > 73) {
        chunks.push(chunk);
        chunk = ` ${character}`;
        chunkBytes = 1 + characterBytes;
      } else {
        chunk += character;
        chunkBytes += characterBytes;
      }
    }
    chunks.push(chunk);
    return chunks.join("\r\n");
  }

  function escapeCalendarText(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function calendarTimestamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function calendarOccurrenceDates(task, firstDay, lastDay) {
    const occurrences = [];
    const date = new Date(firstDay);
    while (date <= lastDay) {
      const key = dateKey(date);
      if (isScheduledOn(task, key) && !isTaskCompleted(task, key)) {
        occurrences.push(key);
      }
      date.setDate(date.getDate() + 1);
    }
    return occurrences;
  }

  function createCalendarFile() {
    const firstDay = startOfDay(new Date());
    const lastDay = new Date(firstDay);
    lastDay.setDate(lastDay.getDate() + 89);
    const stamp = calendarTimestamp(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aturin//Agenda Bahasa Indonesia//ID",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeCalendarText("Aturin")}`,
      "X-WR-CALDESC:Agenda dari Aturin"
    ];
    let eventCount = 0;

    tasks.forEach(task => {
      calendarOccurrenceDates(task, firstDay, lastDay).forEach(occurrence => {
        const date = dateFromKey(occurrence);
        const eventId = encodeURIComponent(`${task.id}-${occurrence}`);
        const title = escapeCalendarText(task.title);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${eventId}@aturin.local`,
          `DTSTAMP:${stamp}`,
          `SUMMARY:${title}`,
          `DESCRIPTION:${escapeCalendarText(task.routine ? `Rutinitas Aturin (${recurrenceLabel(task.recurrence)}).` : "Agenda dari Aturin.")}`
        );

        if (task.time) {
          const [hours, minutes] = task.time.split(":").map(Number);
          const startsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
          const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
          lines.push(`DTSTART:${calendarTimestamp(startsAt)}`, `DTEND:${calendarTimestamp(endsAt)}`);
          if (task.reminder !== "none") {
            const reminder = Number(task.reminder);
            lines.push(
              "BEGIN:VALARM",
              "ACTION:DISPLAY",
              `DESCRIPTION:${title}`,
              `TRIGGER:${reminder === 0 ? "PT0M" : `-PT${reminder}M`}`,
              "END:VALARM"
            );
          }
        } else {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          lines.push(`DTSTART;VALUE=DATE:${occurrence.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${dateKey(nextDate).replace(/-/g, "")}`);
        }

        lines.push("END:VEVENT");
        eventCount += 1;
      });
    });

    lines.push("END:VCALENDAR");
    const content = `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
    return { content, eventCount, firstDay, lastDay };
  }

  function showCalendarDialog() {
    const { eventCount, firstDay, lastDay } = createCalendarFile();
    const range = `${formatDate(firstDay, { day: "numeric", month: "long" })} - ${formatDate(lastDay, { day: "numeric", month: "long", year: "numeric" })}`;
    elements.calendarExportSummary.textContent = eventCount
      ? `${eventCount} agenda aktif · ${range}`
      : `Belum ada agenda aktif untuk 90 hari ke depan.`;
    elements.downloadCalendarButton.disabled = eventCount === 0;
    elements.calendarDialog.showModal();
  }

  function downloadCalendarFile() {
    const { content, eventCount } = createCalendarFile();
    if (eventCount === 0) {
      showToast("Belum ada agenda untuk diekspor", "Tambahkan urusan bertanggal di 90 hari ke depan terlebih dahulu.");
      return;
    }

    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aturin-kalender.ics";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    elements.calendarDialog.close();
    showToast("File kalender diunduh", "Buka file aturin-kalender.ics dengan aplikasi kalender di perangkatmu.");
  }

  function startVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      elements.voiceHint.textContent = "Browser ini belum mendukung input suara. Kamu tetap bisa mengetik di kolom ini.";
      elements.voiceHint.classList.add("parse-error");
      return;
    }
    if (!window.isSecureContext && location.protocol !== "file:") {
      elements.voiceHint.textContent = "Input suara perlu koneksi aman. Buka Aturin lewat localhost atau HTTPS.";
      elements.voiceHint.classList.add("parse-error");
      return;
    }
    if (voiceRecordingActive) {
      stopVoiceRecording(true);
      return;
    }

    recognition = new Recognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    voiceTranscript = "";
    voiceSessionTranscript = "";
    voiceRecordingActive = true;
    recognition.onstart = () => {
      elements.voiceButton.classList.add("is-listening");
      elements.voiceButtonLabel.textContent = "Selesai";
      elements.voiceHint.textContent = "Sedang merekam. Bicara selama yang kamu perlukan, lalu tekan Selesai.";
      elements.voiceHint.classList.remove("parse-error");
      elements.voiceButton.setAttribute("aria-label", "Selesai merekam");
    };
    recognition.onresult = event => {
      voiceSessionTranscript = Array.from(event.results)
        .map(result => result[0]?.transcript || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      elements.naturalInput.value = [voiceTranscript, voiceSessionTranscript].filter(Boolean).join(" ");
    };
    recognition.onerror = event => {
      const messages = {
        "not-allowed": "Izin mikrofon belum diberikan. Izinkan mikrofon di pengaturan browser.",
        "audio-capture": "Mikrofon tidak ditemukan. Periksa mikrofon perangkatmu.",
        "network": "Pengenalan suara memerlukan koneksi internet. Coba lagi saat tersambung."
      };
      if (event.error === "no-speech" || event.error === "aborted") return;
      voiceRecordingActive = false;
      elements.voiceHint.textContent = messages[event.error] || "Rekaman berhenti. Coba lagi atau ketik urusanmu.";
      elements.voiceHint.classList.add("parse-error");
    };
    recognition.onend = () => {
      voiceTranscript = [voiceTranscript, voiceSessionTranscript].filter(Boolean).join(" ").trim();
      voiceSessionTranscript = "";
      if (voiceRecordingActive && elements.dialog.open) {
        elements.naturalInput.value = voiceTranscript;
        voiceRestartTimer = window.setTimeout(() => {
          if (!voiceRecordingActive || !recognition || !elements.dialog.open) return;
          try {
            recognition.start();
          } catch (error) {
            voiceRecordingActive = false;
            elements.voiceHint.textContent = "Perekaman berhenti. Tekan Bicara untuk mencoba lagi.";
            elements.voiceHint.classList.add("parse-error");
          }
        }, 300);
        return;
      }

      recognition = null;
      voiceRecordingActive = false;
      elements.voiceButton.classList.remove("is-listening");
      elements.voiceButtonLabel.textContent = "Bicara";
      elements.voiceButton.setAttribute("aria-label", "Mulai bicara");
      if (!elements.dialog.open) return;
      if (voiceTranscript) {
        elements.naturalInput.value = voiceTranscript;
        handleParse();
      } else if (!elements.voiceHint.classList.contains("parse-error")) {
        elements.voiceHint.textContent = "Belum ada suara yang terbaca. Coba lagi atau ketik urusanmu.";
      }
    };
    try {
      recognition.start();
    } catch (error) {
      recognition = null;
      voiceRecordingActive = false;
      elements.voiceHint.textContent = "Mikrofon belum bisa dimulai. Coba lagi atau ketik urusanmu.";
      elements.voiceHint.classList.add("parse-error");
    }
  }

  function stopVoiceRecording(parseTranscript) {
    voiceRecordingActive = false;
    window.clearTimeout(voiceRestartTimer);
    if (parseTranscript) {
      elements.voiceButtonLabel.textContent = "Memproses…";
      elements.voiceHint.textContent = "Sebentar, Aturin sedang membaca ucapanmu.";
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        recognition = null;
        elements.voiceButton.classList.remove("is-listening");
        elements.voiceButtonLabel.textContent = "Bicara";
      }
    }
    if (!parseTranscript && recognition) {
      try {
        recognition.abort();
      } catch (error) {
        recognition = null;
      }
      recognition = null;
      elements.voiceButton.classList.remove("is-listening");
      elements.voiceButtonLabel.textContent = "Bicara";
      return;
    }
    if (!recognition && parseTranscript && voiceTranscript) handleParse();
  }

  function addTask(event) {
    event.preventDefault();
    if (!canEditTasks()) return;
    elements.formError.textContent = "";
    const title = elements.titleInput.value.trim();
    const date = dateFromKey(elements.dateInput.value);
    const time = elements.timeInput.value;
    if (!title) {
      elements.formError.textContent = "Nama urusan wajib diisi.";
      renderMissingFields();
      elements.titleInput.focus();
      return;
    }
    if (!date) {
      elements.formError.textContent = "Pilih tanggal yang valid.";
      renderMissingFields();
      elements.dateInput.focus();
      return;
    }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      elements.formError.textContent = "Periksa kembali format jam.";
      elements.moreOptions.open = true;
      elements.timeInput.focus();
      return;
    }
    if (elements.reminderInput.value !== "none" && !time) {
      elements.formError.textContent = "Isi jam agar Aturin tahu kapan harus mengingatkanmu.";
      elements.moreOptions.open = true;
      elements.timeInput.focus();
      renderMissingFields();
      return;
    }

    const routine = elements.routineInput.checked;
    const task = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      date: dateKey(date),
      time,
      priority: elements.priorityInput.value,
      completed: false,
      completedDates: [],
      routine,
      reminder: elements.reminderInput.value,
      recurrence: routine ? elements.recurrenceInput.value : null
    };
    if (!isValidTask(task)) {
      elements.formError.textContent = "Periksa lagi informasi urusan yang kamu masukkan.";
      return;
    }
    tasks.unshift(task);
    const saved = saveTasks();
    render();
    elements.dialog.close();
    switchView(routine ? "rutinitas" : "beranda");
    showToast(saved ? "Urusan sudah dicatat" : "Urusan ditambahkan sementara", saved ? "Kamu bisa mengubah statusnya kapan saja." : "Penyimpanan belum tersedia, jadi data ini sementara ada di halaman ini.", !saved);
  }

  function handleTaskAction(event) {
    const button = event.target.closest("[data-action]");
    const row = event.target.closest("[data-task-id]");
    if (!button || !row) return;
    const task = tasks.find(item => item.id === row.dataset.taskId);
    if (!task) return;
    if (!canEditTasks()) return;
    if (button.dataset.action === "toggle") {
      const occurrenceDate = dateFromKey(row.dataset.occurrenceDate);
      if (!occurrenceDate) return;
      const key = dateKey(occurrenceDate);
      if (task.routine && task.recurrence !== null) {
        if (task.completedDates.includes(key)) {
          task.completedDates = task.completedDates.filter(value => value !== key);
        } else {
          task.completedDates.push(key);
        }
      } else {
        task.completed = !task.completed;
      }
      if (saveTasks()) {
        render();
        elements.status.textContent = isTaskCompleted(task, key) ? `${task.title} ditandai selesai.` : `${task.title} ditandai belum selesai.`;
      }
    } else if (button.dataset.action === "delete") {
      tasks = tasks.filter(item => item.id !== task.id);
      if (saveTasks()) {
        render();
        showToast("Urusan dihapus", `${task.title} sudah dihapus dari agenda.`);
      }
    }
  }

  function renderReminderChecks() {
    const now = new Date();
    const previousCheck = lastReminderCheck;
    lastReminderCheck = now;
    const dueTasks = tasks.filter(task => {
      const todayKey = dateKey(now);
      if (!isScheduledOn(task, todayKey) || isTaskCompleted(task, todayKey) || !task.time || task.reminder === "none") return false;
      const [hours, minutes] = task.time.split(":").map(Number);
      const taskAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const reminderAt = new Date(taskAt.getTime() - Number(task.reminder) * 60_000);
      const reminderKey = `${task.id}-${todayKey}-${task.time}-${task.reminder}`;
      return reminderAt > previousCheck && reminderAt <= now && !deliveredReminders.has(reminderKey);
    });
    dueTasks.forEach(task => {
      const reminderKey = `${task.id}-${dateKey(now)}-${task.time}-${task.reminder}`;
      deliveredReminders.add(reminderKey);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(`Pengingat: ${task.title}`, {
            body: `Urusanmu dijadwalkan hari ini pukul ${task.time}.`,
            tag: `aturin-${reminderKey}`
          });
          notification.addEventListener("click", () => {
            window.focus();
            selectedDate = startOfDay(now);
            switchView("agenda");
            renderAgenda();
            notification.close();
          }, { once: true });
        } catch (error) {
          showToast("Pengingat Aturin", `${task.title} · pukul ${task.time}`, false, 12_000);
        }
      } else {
        showToast("Pengingat Aturin", `${task.title} · pukul ${task.time}`, false, 12_000);
      }
    });
  }

  function updateNotificationButton() {
    if (!("Notification" in window)) {
      elements.notificationLabel.textContent = "Notifikasi";
      elements.notificationButton.title = "Notifikasi browser ini tidak tersedia.";
      elements.notificationButton.setAttribute("aria-label", "Notifikasi browser tidak tersedia");
      return;
    }
    const states = {
      granted: ["Notifikasi aktif", "Izin notifikasi sudah diberikan."],
      denied: ["Notifikasi diblokir", "Ubah izin notifikasi melalui pengaturan browser."],
      default: ["Aktifkan notifikasi", "Izinkan notifikasi untuk melihat pengingat browser."]
    };
    const [label, title] = states[Notification.permission] || states.default;
    elements.notificationLabel.textContent = label;
    elements.notificationButton.title = title;
    elements.notificationButton.setAttribute("aria-label", title);
    elements.notificationButton.classList.toggle("is-enabled", Notification.permission === "granted");
    elements.notificationButton.classList.toggle("is-blocked", Notification.permission === "denied");
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      showToast("Notifikasi tidak tersedia", "Coba browser modern seperti Chrome atau Edge.", true);
      return;
    }
    if (!window.isSecureContext && location.protocol !== "file:") {
      showToast("Buka lewat koneksi aman", "Notifikasi browser perlu localhost atau HTTPS.", true);
      return;
    }
    if (Notification.permission === "denied") {
      showToast("Izin notifikasi diblokir", "Buka pengaturan situs di browser, lalu izinkan notifikasi untuk Aturin.", true);
      return;
    }
    if (Notification.permission === "granted") {
      showToast("Notifikasi sudah aktif", "Pengingat muncul saat halaman Aturin terbuka.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      updateNotificationButton();
      if (permission === "granted") {
        showToast("Notifikasi diizinkan", "Pengingat akan muncul saat halaman Aturin terbuka.");
      } else {
        showToast("Izin notifikasi belum diberikan", "Kamu tetap dapat melihat pengingat di dalam Aturin saat halaman terbuka.", true);
      }
    } catch (error) {
      showToast("Izin notifikasi belum bisa diminta", "Periksa pengaturan browser dan coba lagi.", true);
    }
  }

  elements.navLinks.forEach(link => link.addEventListener("click", () => switchView(link.dataset.view)));
  document.querySelectorAll("[data-view-link]").forEach(link => link.addEventListener("click", () => switchView(link.dataset.viewLink)));
  document.querySelectorAll("[data-open-task]").forEach(button => button.addEventListener("click", openTaskDialog));
  document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#cancel-dialog").addEventListener("click", () => elements.dialog.close());
  document.querySelector("#parse-button").addEventListener("click", handleParse);
  elements.voiceButton.addEventListener("click", startVoiceInput);
  elements.notificationButton.addEventListener("click", enableNotifications);
  elements.missingFields.addEventListener("click", event => {
    const button = event.target.closest("[data-focus-field]");
    if (!button) return;
    const fields = { title: elements.titleInput, date: elements.dateInput, time: elements.timeInput };
    fields[button.dataset.focusField]?.focus();
    if (button.dataset.focusField === "time") elements.moreOptions.open = true;
  });
  elements.titleInput.addEventListener("input", () => {
    missingVoiceFields = missingVoiceFields.filter(field => field !== "title");
    renderMissingFields();
    suggestPriority();
  });
  elements.dateInput.addEventListener("change", () => {
    missingVoiceFields = missingVoiceFields.filter(field => field !== "date");
    renderMissingFields();
    suggestPriority();
  });
  elements.priorityInput.addEventListener("change", () => {
    priorityManuallySelected = true;
    const labels = { high: "Penting", normal: "Biasa", low: "Bisa nanti" };
    elements.prioritySuggestion.textContent = `Pilihanmu: ${labels[elements.priorityInput.value]}.`;
    elements.prioritySuggestion.classList.remove("hidden");
  });
  elements.timeInput.addEventListener("input", () => {
    missingVoiceFields = missingVoiceFields.filter(field => field !== "time");
    renderMissingFields();
  });
  elements.reminderInput.addEventListener("change", renderMissingFields);
  elements.naturalInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleParse();
    }
  });
  elements.form.addEventListener("submit", addTask);
  elements.calendarExportButton.addEventListener("click", showCalendarDialog);
  elements.downloadCalendarButton.addEventListener("click", downloadCalendarFile);
  document.querySelector("#close-calendar-dialog").addEventListener("click", () => elements.calendarDialog.close());
  document.querySelector("#cancel-calendar-dialog").addEventListener("click", () => elements.calendarDialog.close());
  elements.dialog.addEventListener("close", () => {
    if (recognition) stopVoiceRecording(false);
  });
  elements.routineInput.addEventListener("change", () => elements.recurrenceField.classList.toggle("hidden", !elements.routineInput.checked));
  document.querySelector("#date-prev").addEventListener("click", () => {
    selectedDate.setDate(selectedDate.getDate() - 1);
    renderAgenda();
  });
  document.querySelector("#date-next").addEventListener("click", () => {
    selectedDate.setDate(selectedDate.getDate() + 1);
    renderAgenda();
  });
  document.querySelector("#date-today").addEventListener("click", () => {
    selectedDate = startOfDay(new Date());
    renderAgenda();
  });
  elements.agendaDateStrip.addEventListener("click", event => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    const date = dateFromKey(button.dataset.date);
    if (!date) return;
    selectedDate = date;
    renderAgenda();
  });
  elements.todayList.addEventListener("click", handleTaskAction);
  elements.agendaList.addEventListener("click", handleTaskAction);
  elements.routineList.addEventListener("click", handleTaskAction);
  elements.menu.addEventListener("click", () => {
    const open = !elements.sidebar.classList.contains("is-open");
    elements.sidebar.classList.toggle("is-open", open);
    elements.menu.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      elements.sidebar.classList.remove("is-open");
      elements.menu.setAttribute("aria-expanded", "false");
    }
  });

  auth.onAuthStateChanged(handleAuthStateChange);
  tasks = readTasks();
  render();
  updateNotificationButton();
  window.setInterval(renderReminderChecks, 15_000);
})();
