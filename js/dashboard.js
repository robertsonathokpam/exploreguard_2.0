import {hourlyRain, escapeHtml} from './data-utils.js';
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeDisasterRisk, estimateSlopeFromElevationGrid, TERRAIN_PROFILES } from './risk-engine.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let activeTelemetry = {
  rainfall: 12.0,
  humidity: 78,
  windSpeed: 20,
  pressure: 1010
};

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  document.getElementById('user-name').textContent = user.displayName || user.email;
  document.getElementById('welcome-msg').textContent = `Welcome back, ${user.displayName || 'Traveler'}!`;
  loadBookings(user.uid);
  initDashboardRiskEngine();
});

// Priority Key Resolution
function getWeatherApiKey() {
  const storedKey = localStorage.getItem('openweather_api_key');
  if (storedKey && storedKey.trim() !== '') return storedKey.trim();
  const configKey = window.CONFIG?.OPENWEATHER_API_KEY;
  if (configKey && configKey.trim() !== '' && configKey !== 'YOUR_OPENWEATHER_API_KEY_HERE') return configKey.trim();
  return null;
}

// Fetch live weather telemetry for dashboard risk engine
async function initDashboardRiskEngine() { window.updateDashboardRisk(); }

window.updateDashboardRisk = async () => {
  const corridorKey = document.getElementById('dash-corridor-select')?.value || 'nh-37';
  if (corridorKey === 'live-gps') {
    document.getElementById('dash-risk-badge').textContent = 'Use Hazard Analysis for location-specific data';
    for (const id of ['dash-landslide-val', 'dash-flood-val']) {
      const el = document.getElementById(id); if (el) el.textContent = 'Unavailable';
    }
    return;
  }
  const dynamicElevation = null;
  const targetTerrain = corridorKey;
  const risk = computeDisasterRisk(activeTelemetry, targetTerrain, dynamicElevation);

  // Update Telemetry Snapshot
  const rainEl = document.getElementById('dash-tele-rain');
  if (rainEl) rainEl.textContent = `${activeTelemetry.rainfall} mm/h`;
  const humEl = document.getElementById('dash-tele-hum');
  if (humEl) humEl.textContent = `${activeTelemetry.humidity}%`;
  const pressEl = document.getElementById('dash-tele-press');
  if (pressEl) pressEl.textContent = `${activeTelemetry.pressure} hPa`;

  // Update Risk Badge
  const badgeEl = document.getElementById('dash-risk-badge');
  if (badgeEl) {
    badgeEl.className = `badge ${risk.badgeClass} text-white font-extrabold text-xs px-3 py-2`;
    badgeEl.textContent = `SAMPLE: ${risk.riskLevel.toUpperCase()} (${risk.compositeScore}/100)`;
  }

  // Update Probabilities
  const lsVal = document.getElementById('dash-landslide-val');
  if (lsVal) lsVal.textContent = `${risk.landslideProbability}%`;
  const lsProg = document.getElementById('dash-landslide-prog');
  if (lsProg) lsProg.value = risk.landslideProbability;

  const flVal = document.getElementById('dash-flood-val');
  if (flVal) flVal.textContent = `${risk.floodProbability}%`;
  const flProg = document.getElementById('dash-flood-prog');
  if (flProg) flProg.value = risk.floodProbability;

  const cpVal = document.getElementById('dash-composite-val');
  if (cpVal) {
    cpVal.textContent = `${risk.compositeScore}%`;
    cpVal.style.color = risk.color;
  }
  const cpProg = document.getElementById('dash-composite-prog');
  if (cpProg) cpProg.value = risk.compositeScore;

  const cpTag = document.getElementById('dash-composite-tag');
  if (cpTag) {
    cpTag.textContent = risk.riskLevel;
    cpTag.style.color = risk.color;
  }

  // Update Evacuation Advisory
  const evacEl = document.getElementById('dash-evac-action');
  if (evacEl) evacEl.textContent = risk.evacuationAction;

  lucide.createIcons();
};

// READ operation — fetch all bookings from Firestore for this user
async function loadBookings(uid) {
  const list = document.getElementById('bookings-list');
  try {
    const q = query(collection(db, 'bookings'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `
        <div class="empty">
          <i data-lucide="calendar" style="width:36px; height:36px; stroke-width:1.5px; opacity:0.6;"></i>
          <span>No bookings found. Ready to start your adventure?</span>
          <a href="booking.html">Book your first trip now &rarr;</a>
        </div>`;
      lucide.createIcons();
      return;
    }
    list.innerHTML = '';
    snap.forEach(docSnap => {
      const b = docSnap.data();
      const type = b.type || 'Flight';
      
      let typeBadgeClass = 'badge-flight';
      let typeIcon = 'plane';
      if (type === 'Railway') {
        typeBadgeClass = 'badge-railway';
        typeIcon = 'train';
      } else if (type === 'Cab') {
        typeBadgeClass = 'badge-cab';
        typeIcon = 'car';
      }
      
      list.innerHTML += `
        <div class="booking-item">
          <div class="booking-info">
            <div class="info-type-box">
              <span class="booking-badge ${typeBadgeClass}">
                <i data-lucide="${typeIcon}" style="width:12px; height:12px; display:inline;"></i> ${escapeHtml(type)}
              </span>
            </div>
            <div class="route-display">
              <span>${escapeHtml(b.from)}</span>
              <i data-lucide="arrow-right" style="width:16px;"></i>
              <span>${escapeHtml(b.to)}</span>
            </div>
            <div class="booking-details-meta">
              <span><i data-lucide="calendar" style="width:14px;"></i> ${escapeHtml(b.date)}</span>
              <span><i data-lucide="users" style="width:14px;"></i> ${escapeHtml(b.passengers)} traveler(s)</span>
              ${b.notes ? `<span><i data-lucide="message-square" style="width:14px;"></i> ${escapeHtml(b.notes)}</span>` : ''}
            </div>
          </div>
          <button class="cancel-btn" data-booking-id="${escapeHtml(docSnap.id)}">
            <i data-lucide="trash-2" style="width:14px;"></i> Cancel
          </button>
        </div>`;
    });
    list.querySelectorAll('[data-booking-id]').forEach(button => button.addEventListener('click', () => window.cancelBooking(button.dataset.bookingId)));
    lucide.createIcons();
  } catch (e) {
    console.error("Error loading bookings:", e);
    list.innerHTML = `
      <div class="empty">
        <i data-lucide="alert-triangle" style="color:var(--danger); width:36px; height:36px;"></i>
        <span>Failed to load bookings: ${e.message}</span>
      </div>`;
    lucide.createIcons();
  }
}

// DELETE operation — remove booking from Firestore
window.cancelBooking = async (bookingId) => {
  if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'bookings', bookingId));
    loadBookings(currentUser.uid);
  } catch (e) {
    alert('Cancellation failed. Please try again.');
  }
};

window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = 'login.html';
};
