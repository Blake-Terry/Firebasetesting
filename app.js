// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ---------- FIREBASE CONFIG (your project's config) ----------
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

  // ---------- INIT FIREBASE ----------
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  // ---------- APP CONFIG ----------
  const MAX_PER_DAY = 25;
  const MAX_PER_WEEK_PER_EMAIL = 2;
  const ALLOWED_WEEKDAY_NUMS = [1,2,3,4]; // Monday-Thursday

  // ---------- UTILITIES ----------
  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = ((day + 6) % 7);
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0,0,0,0);
    return d;
  }
  function formatDate(d) { return d.toISOString().slice(0,10); }
  function weekKeyForDate(d) {
    const mon = startOfWeek(d);
    return 'week-' + formatDate(mon);
  }
  function getDatesForWeek(startDate) {
    const arr = [];
    for (let i=0;i<7;i++){
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }

  // ---------- DOM ----------
  const daySelect = document.getElementById('daySelect');
  const availabilityTableBody = document.querySelector('#availabilityTable tbody');
  const emailInput = document.getElementById('email');
  const bookingForm = document.getElementById('bookingForm');
  const myBookingsDiv = document.getElementById('myBookings');
  const weekLabel = document.getElementById('weekLabel');
  const prevWeekBtn = document.getElementById('prevWeek');
  const nextWeekBtn = document.getElementById('nextWeek');
  const resetBtn = document.getElementById('resetStorage');
  const toggleUpdatesBtn = document.getElementById('toggleUpdates');
  const updatesList = document.getElementById('updatesList');
  const messageArea = document.getElementById('messageArea');

  let currentWeekStart = startOfWeek(new Date());

  // ---------- FIREBASE READ / WRITE ----------
  async function loadBookings(weekKey){
    try {
      const snap = await get(ref(db, 'bookings/' + weekKey));
      return snap.val() || {};
    } catch (e) {
      console.error('Error loading bookings', e);
      return {};
    }
  }

  async function saveBookings(weekKey, data){
    try {
      await set(ref(db, 'bookings/' + weekKey), data);
    } catch (e) {
      console.error('Error saving bookings', e);
      alert('Save failed: ' + e.message);
    }
  }

  // ---------- UI BUILDERS ----------
  async function buildDayOptions(){
    daySelect.innerHTML = '';
    const dates = getDatesForWeek(currentWeekStart);
    const today = new Date();
    dates.forEach(d=>{
      const wd = d.getDay();
      const formatted = formatDate(d);
      const label = d.toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'}) + ' — ' + formatted;
      const opt = document.createElement('option');
      opt.value = formatted;
      opt.textContent = label;
      if (!ALLOWED_WEEKDAY_NUMS.includes(wd)){
        opt.disabled = true;
        opt.textContent += ' (closed)';
      } else if (d < startOfWeek(today)) {
        opt.disabled = true;
        opt.textContent += ' (past)';
      }
      daySelect.appendChild(opt);
    });
  }

  async function getAvailabilityTable(){
    const weekKey = weekKeyForDate(currentWeekStart);
    const bookings = await loadBookings(weekKey);
    const dates = getDatesForWeek(currentWeekStart);
    availabilityTableBody.innerHTML = '';
    dates.forEach(d=>{
      const fmt = formatDate(d);
      const used = (bookings[fmt]||[]).length;
      const left = MAX_PER_DAY - used;
      const tr = document.createElement('tr');
      const dayName = d.toLocaleDateString(undefined, {weekday:'long'}) + ' — ' + fmt;
      tr.innerHTML = `<td>${dayName}</td><td class="status">${used}</td><td>${left<0?0:left}</td>`;
      if (!ALLOWED_WEEKDAY_NUMS.includes(d.getDay())){
        tr.querySelectorAll('td')[2].innerHTML = '<span class="muted">closed</span>';
      }
      availabilityTableBody.appendChild(tr);
    });
  }

  async function getUserBookingsThisWeek(email){
    if (!email) return [];
    const weekKey = weekKeyForDate(currentWeekStart);
    const bookings = await loadBookings(weekKey);
    const result = [];
    for (const day in bookings){
      bookings[day].forEach(e=>{ if (e.toLowerCase() === email.toLowerCase()) result.push(day); })
    }
    return result.sort();
  }

  async function refreshUI(){
    await buildDayOptions();
    await getAvailabilityTable();
    const e = emailInput.value.trim();
    const list = await getUserBookingsThisWeek(e);
    if (!e){
      myBookingsDiv.textContent = 'Enter your email to see bookings for the selected week.';
    } else if (list.length === 0){
      myBookingsDiv.textContent = 'No bookings this week.';
    } else {
      const ul = document.createElement('div');
      ul.innerHTML = list.map(d => `<div>${d} <button data-day="${d}" class="linklike">Cancel</button></div>`).join('');
      myBookingsDiv.innerHTML = '';
      myBookingsDiv.appendChild(ul);
      myBookingsDiv.querySelectorAll('button[data-day]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const day = btn.getAttribute('data-day');
          const weekKey = weekKeyForDate(currentWeekStart);
          const bookings = await loadBookings(weekKey);
          bookings[day] = bookings[day].filter(e=> e.toLowerCase() !== emailInput.value.trim().toLowerCase());
          if (bookings[day].length === 0) delete bookings[day];
          await saveBookings(weekKey, bookings);
          await refreshUI();
        });
      });
    }
    weekLabel.textContent = currentWeekStart.toLocaleDateString(undefined,{month:'short', day:'numeric'}) +
      ' — ' + new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate()+6)
      .toLocaleDateString(undefined,{month:'short', day:'numeric'});
  }

  // ---------- EVENTS ----------
  bookingForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const day = daySelect.value;
    if (!email || !day) return alert('Fill email and pick a day.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return alert('Invalid email.');
    const weekKey = weekKeyForDate(currentWeekStart);
    const bookings = await loadBookings(weekKey);
    const countForUser = Object.values(bookings).flat().filter(e=> e.toLowerCase() === email).length;
    if ((bookings[day]||[]).length >= MAX_PER_DAY) return alert('Day full.');
    if (countForUser >= MAX_PER_WEEK_PER_EMAIL) return alert('Max slots reached.');
    if ((bookings[day]||[]).includes(email)) return alert('Already booked.');
    bookings[day] = bookings[day]||[];
    bookings[day].push(email);
    await saveBookings(weekKey, bookings);
    await refreshUI();
  });

  emailInput.addEventListener('input', refreshUI);
  prevWeekBtn.addEventListener('click', ()=>{
    currentWeekStart.setDate(currentWeekStart.getDate()-7);
    currentWeekStart = startOfWeek(currentWeekStart);
    refreshUI();
  });
  nextWeekBtn.addEventListener('click', ()=>{
    currentWeekStart.setDate(currentWeekStart.getDate()+7);
    currentWeekStart = startOfWeek(currentWeekStart);
    refreshUI();
  });
  resetBtn.addEventListener('click', async ()=>{
    if (!confirm('Reset this week\'s bookings?')) return;
    const weekKey = weekKeyForDate(currentWeekStart);
    await saveBookings(weekKey,{});
    refreshUI();
  });

  toggleUpdatesBtn.addEventListener('click', ()=>{
    updatesList.classList.toggle('hidden');
    toggleUpdatesBtn.textContent = updatesList.classList.contains('hidden') ? 'Show' : 'Hide';
  });

  // ---------- INIT ----------
  refreshUI();

});


