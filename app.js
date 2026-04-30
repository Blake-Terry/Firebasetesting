import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, set } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = {
    apiKey: "AIzaSyDa12fNLLkABOGcHwfFIhv6GjRUAYk1McY",
    authDomain: "lab-booking-4cd3e.firebaseapp.com",
    databaseURL: "https://lab-booking-4cd3e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lab-booking-4cd3e",
    storageBucket: "lab-booking-4cd3e.firebasestorage.app",
    messagingSenderId: "1093913529804",
    appId: "1:1093913529804:web:6ad654668cf887ab0a2169",
    measurementId: "G-KGG31JFS02"
  };

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  const MAX_PER_DAY = 25;
  const MAX_PER_WEEK_PER_EMAIL = 2;
  const ALLOWED_WEEKDAY_NUMS = [1, 2, 3, 4];

  const daySelect = document.getElementById("daySelect");
  const availabilityTableBody = document.querySelector("#availabilityTable tbody");
  const emailInput = document.getElementById("email");
  const bookingForm = document.getElementById("bookingForm");
  const myBookingsDiv = document.getElementById("myBookings");
  const weekLabel = document.getElementById("weekLabel");
  const prevWeekBtn = document.getElementById("prevWeek");
  const nextWeekBtn = document.getElementById("nextWeek");
  const resetBtn = document.getElementById("resetStorage");
  const toggleUpdatesBtn = document.getElementById("toggleUpdates");
  const updatesList = document.getElementById("updatesList");
  const messageArea = document.getElementById("messageArea");

  let currentWeekStart = startOfWeek(new Date());
  let liveBookings = {};
  let activeUnsubscribe = null;

  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function weekKeyForDate(d) {
    return `week-${formatDate(startOfWeek(d))}`;
  }

  function getDatesForWeek(startDate) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  function getWeekRangeLabel(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  function isBookableDate(dateLike) {
    const date = new Date(`${dateLike}T00:00:00`);
    const isAllowedDay = ALLOWED_WEEKDAY_NUMS.includes(date.getDay());
    const isPast = date < startOfWeek(new Date());
    return isAllowedDay && !isPast;
  }

  function normalizeEmail(value) {
    return value.trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  function showMessage(text, type = "info") {
    const colors = { info: "#0f172a", success: "#198754", error: "#d9534f" };
    messageArea.textContent = text;
    messageArea.style.color = colors[type] || colors.info;
  }

  function getUserBookings(email, bookings = liveBookings) {
    if (!email) return [];
    const normalized = normalizeEmail(email);
    return Object.entries(bookings)
      .filter(([, emails]) => Array.isArray(emails) && emails.some((e) => normalizeEmail(e) === normalized))
      .map(([day]) => day)
      .sort();
  }

  function renderDayOptions() {
    daySelect.innerHTML = "";
    const todayWeekStart = startOfWeek(new Date());

    getDatesForWeek(currentWeekStart).forEach((d) => {
      const formatted = formatDate(d);
      const opt = document.createElement("option");
      opt.value = formatted;
      opt.textContent = `${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} — ${formatted}`;

      if (!ALLOWED_WEEKDAY_NUMS.includes(d.getDay())) {
        opt.disabled = true;
        opt.textContent += " (closed)";
      } else if (d < todayWeekStart) {
        opt.disabled = true;
        opt.textContent += " (past)";
      }

      daySelect.appendChild(opt);
    });

    const firstEnabled = daySelect.querySelector("option:not([disabled])");
    if (firstEnabled && daySelect.selectedOptions[0]?.disabled) {
      daySelect.value = firstEnabled.value;
    }
  }

  function renderAvailabilityTable() {
    availabilityTableBody.innerHTML = "";

    getDatesForWeek(currentWeekStart).forEach((d) => {
      const fmt = formatDate(d);
      const used = (liveBookings[fmt] || []).length;
      const left = Math.max(0, MAX_PER_DAY - used);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.toLocaleDateString(undefined, { weekday: "long" })} — ${fmt}</td><td class="status">${used}</td><td>${left}</td>`;

      if (!ALLOWED_WEEKDAY_NUMS.includes(d.getDay())) {
        tr.querySelectorAll("td")[2].innerHTML = '<span class="muted">closed</span>';
      }
      availabilityTableBody.appendChild(tr);
    });
  }

  function renderMyBookings() {
    const email = normalizeEmail(emailInput.value);
    const list = getUserBookings(email);

    if (!email) {
      myBookingsDiv.textContent = "Enter your email to see bookings for the selected week.";
      return;
    }

    if (!isValidEmail(email)) {
      myBookingsDiv.textContent = "Enter a valid email to manage your bookings.";
      return;
    }

    if (list.length === 0) {
      myBookingsDiv.textContent = "No bookings this week.";
      return;
    }

    myBookingsDiv.innerHTML = list
      .map((day) => `<div>${day} <button data-day="${day}" class="linklike">Cancel</button></div>`)
      .join("");

    myBookingsDiv.querySelectorAll("button[data-day]").forEach((btn) => {
      btn.addEventListener("click", () => cancelBooking(btn.getAttribute("data-day")));
    });
  }

  function refreshUI() {
    weekLabel.textContent = getWeekRangeLabel(currentWeekStart);
    renderDayOptions();
    renderAvailabilityTable();
    renderMyBookings();
  }

  function watchCurrentWeek() {
    if (typeof activeUnsubscribe === "function") activeUnsubscribe();

    const bookingsRef = ref(db, `bookings/${weekKeyForDate(currentWeekStart)}`);
    activeUnsubscribe = onValue(
      bookingsRef,
      (snapshot) => {
        liveBookings = snapshot.val() || {};
        refreshUI();
      },
      (error) => showMessage(`Realtime sync failed: ${error.message}`, "error")
    );
  }

  async function createBooking() {
    const email = normalizeEmail(emailInput.value);
    const day = daySelect.value;

    if (!email || !day) return showMessage("Fill email and pick a day.", "error");
    if (!isValidEmail(email)) return showMessage("Invalid email address.", "error");
    if (!isBookableDate(day)) return showMessage("This day is closed or in the past.", "error");

    const weekRef = ref(db, `bookings/${weekKeyForDate(currentWeekStart)}`);

    const tx = await runTransaction(weekRef, (bookings) => {
      const next = bookings || {};
      const dayBookings = next[day] || [];
      const normalizedDayBookings = dayBookings.map(normalizeEmail);
      const totalByUser = Object.values(next).flat().map(normalizeEmail).filter((e) => e === email).length;

      if (normalizedDayBookings.includes(email)) return;
      if (totalByUser >= MAX_PER_WEEK_PER_EMAIL) return;
      if (dayBookings.length >= MAX_PER_DAY) return;

      next[day] = [...dayBookings, email];
      return next;
    });

    if (!tx.committed) {
      const dayCount = (liveBookings[day] || []).length;
      const userCount = getUserBookings(email).length;

      if ((liveBookings[day] || []).some((e) => normalizeEmail(e) === email)) {
        return showMessage("Already booked for this day.", "error");
      }
      if (userCount >= MAX_PER_WEEK_PER_EMAIL) {
        return showMessage(`Limit reached (${MAX_PER_WEEK_PER_EMAIL} per week).`, "error");
      }
      if (dayCount >= MAX_PER_DAY) {
        return showMessage("Day is full.", "error");
      }
      return showMessage("Booking could not be completed due to a concurrent update. Try again.", "error");
    }

    showMessage(`Booked ${day} successfully.`, "success");
  }

  async function cancelBooking(day) {
    const email = normalizeEmail(emailInput.value);
    if (!email) return showMessage("Enter your email to cancel bookings.", "error");

    const weekRef = ref(db, `bookings/${weekKeyForDate(currentWeekStart)}`);
    const tx = await runTransaction(weekRef, (bookings) => {
      const next = bookings || {};
      const before = next[day] || [];
      const after = before.filter((e) => normalizeEmail(e) !== email);
      if (before.length === after.length) return;
      if (after.length === 0) {
        delete next[day];
      } else {
        next[day] = after;
      }
      return next;
    });

    showMessage(tx.committed ? `Cancelled booking for ${day}.` : "No booking found to cancel.", tx.committed ? "success" : "error");
  }

  async function resetCurrentWeek() {
    if (!confirm("Reset this week's bookings?")) return;
    await set(ref(db, `bookings/${weekKeyForDate(currentWeekStart)}`), {});
    showMessage("Week bookings reset.", "success");
  }

  bookingForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await createBooking();
  });

  emailInput.addEventListener("input", renderMyBookings);

  prevWeekBtn.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    currentWeekStart = startOfWeek(currentWeekStart);
    watchCurrentWeek();
  });

  nextWeekBtn.addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    currentWeekStart = startOfWeek(currentWeekStart);
    watchCurrentWeek();
  });

  resetBtn.addEventListener("click", resetCurrentWeek);

  toggleUpdatesBtn.addEventListener("click", () => {
    updatesList.classList.toggle("hidden");
    toggleUpdatesBtn.textContent = updatesList.classList.contains("hidden") ? "Show" : "Hide";
  });

  showMessage("Live sync enabled. Booking data updates automatically.");
  watchCurrentWeek();
});
