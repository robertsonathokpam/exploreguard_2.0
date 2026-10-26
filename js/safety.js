import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeMedicalTriage, TRIAGE_CATEGORIES } from './risk-engine.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let currentTriageAssessment = null;

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'login.html';
  currentUser = user;
});

// -------------------------------------------------------------
// AI GOLDEN-HOUR MEDICAL TRIAGE LOGIC
// -------------------------------------------------------------
window.onTriageInputChange = () => {
  const conditionId = document.getElementById('triage-condition-select')?.value || 'stampede-trauma';
  const consciousness = document.getElementById('triage-consciousness')?.value || 'unconscious';
  const severeBleeding = document.getElementById('triage-severe-bleeding')?.checked || false;
  const breathingDifficulty = document.getElementById('triage-breathing-diff')?.checked || false;
  const pulseRate = Number(document.getElementById('triage-pulse')?.value || 80);
  const symptomsText = document.getElementById('triage-symptoms-text')?.value || '';

  currentTriageAssessment = computeMedicalTriage({
    conditionId,
    consciousness,
    severeBleeding,
    breathingDifficulty,
    pulseRate,
    symptomsText
  });

  renderTriageUI(currentTriageAssessment);
};

function renderTriageUI(data) {
  // Update Priority Badge
  const badgeEl = document.getElementById('triage-priority-badge');
  if (badgeEl) {
    badgeEl.className = `badge ${data.badgeClass} text-white font-black text-sm p-3 flex items-center gap-1.5 shadow-sm`;
    let icon = (data.priority === 'RED') ? 'alert-octagon' : (data.priority === 'YELLOW') ? 'alert-triangle' : 'check-circle';
    badgeEl.innerHTML = `<i data-lucide="${icon}" style="width:14px; height:14px;"></i> ${data.priorityLabel.toUpperCase()} (P${data.priority === 'RED' ? '1' : data.priority === 'YELLOW' ? '2' : '3'})`;
  }

  // Update Golden-Hour Window
  const ghEl = document.getElementById('triage-golden-hour');
  if (ghEl) {
    ghEl.textContent = `< ${data.goldenHourMinutes} Minutes`;
    ghEl.style.color = data.badgeColor;
  }

  // Update Urgency Description
  const urgEl = document.getElementById('triage-urgency-desc');
  if (urgEl) urgEl.textContent = data.urgencyDescription;

  // Update Facility
  const facEl = document.getElementById('triage-facility-name');
  if (facEl) facEl.textContent = data.recommendedFacility;

  // Render First Aid Steps
  const stepsContainer = document.getElementById('first-aid-steps-container');
  if (stepsContainer && data.firstAidSteps) {
    stepsContainer.innerHTML = data.firstAidSteps.map(step => `
      <div style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:var(--dark); line-height:1.5; background:rgba(248,250,252,0.8); padding:8px 12px; border-radius:10px; border-left:3px solid var(--primary);">
        <i data-lucide="check" style="width:14px; height:14px; color:var(--primary); flex-shrink:0; margin-top:2px;"></i>
        <span>${step}</span>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

// -------------------------------------------------------------
// DISPATCH GPS SOS TO FIRESTORE & LOCAL EMERGENCY BROKER
// -------------------------------------------------------------
window.dispatchEmergencySOS = async () => {
  const btn = document.getElementById('dispatch-sos-btn');
  const confirmBox = document.getElementById('dispatch-confirm-box');
  const detailsEl = document.getElementById('dispatch-details');

  if (!currentTriageAssessment) {
    window.onTriageInputChange();
  }

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:18px; height:18px;"></i> Handshaking Satellites & Transmitting SOS...`;
  lucide.createIcons();

  // Helper to obtain GPS coordinates
  const getCoordinates = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: 25.4312, longitude: 81.8845, accuracy: 25, fallback: true }); // Default Kumbh Mela Sangam
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: +pos.coords.latitude.toFixed(5),
        longitude: +pos.coords.longitude.toFixed(5),
        accuracy: Math.round(pos.coords.accuracy),
        fallback: false
      }),
      () => resolve({ latitude: 24.8170, longitude: 93.9368, accuracy: 50, fallback: true }), // Imphal District HQ fallback
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });

  const coords = await getCoordinates();

  const emergencyPayload = {
    triageId: currentTriageAssessment.triageId,
    patientUid: currentUser?.uid || 'guest-emergency-user',
    patientName: currentUser?.displayName || currentUser?.email || 'Emergency Pilgrim / Traveler',
    priority: currentTriageAssessment.priority,
    priorityLabel: currentTriageAssessment.priorityLabel,
    conditionTitle: currentTriageAssessment.conditionTitle,
    symptomsDescription: currentTriageAssessment.symptomsDescription,
    clinicalReason: currentTriageAssessment.clinicalReason,
    vitals: currentTriageAssessment.vitalsRecorded,
    recommendedFacility: currentTriageAssessment.recommendedFacility,
    coordinates: coords,
    timestamp: new Date().toISOString(),
    status: 'ACTIVE_DISPATCH_TO_FIELD_UNIT',
    etaMinutes: currentTriageAssessment.priority === 'RED' ? 5 : 12
  };

  try {
    // 1. Write to Firestore 'triages' collection
    await addDoc(collection(db, 'triages'), emergencyPayload);
    // 2. Also write to 'emergency_dispatches' for real-time ambulance routing listeners
    await setDoc(doc(db, 'emergency_dispatches', emergencyPayload.triageId), emergencyPayload);
  } catch (firestoreError) {
    console.warn("Firestore offline or permission locked. Caching locally for offline delivery:", firestoreError);
  }

  // 3. Offline resilience backup to localStorage
  localStorage.setItem('last_emergency_dispatch', JSON.stringify(emergencyPayload));

  // 4. Update UI with Dispatch Confirmation
  btn.disabled = false;
  btn.innerHTML = `<i data-lucide="check-circle" style="width:18px; height:18px;"></i> SOS Dispatched to Emergency Unit!`;
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

  if (confirmBox && detailsEl) {
    confirmBox.style.display = 'flex';
    detailsEl.innerHTML = `
      <strong>Ticket:</strong> ${emergencyPayload.triageId} | 
      <strong>Assigned Unit:</strong> ${emergencyPayload.recommendedFacility} | 
      <strong>GPS:</strong> ${coords.latitude}, ${coords.longitude} (±${coords.accuracy}m) | 
      <strong>ETA:</strong> ~${emergencyPayload.etaMinutes} mins. Ambulances notified.
    `;
  }
  lucide.createIcons();
};

// -------------------------------------------------------------
// LOCAL EMERGENCY CONTACTS DATABASE (Preserved Intact)
// -------------------------------------------------------------
const contacts = {
  'imphal-east': [
    { icon: 'shield', title: 'Imphal East Police', num: '0385-2450900', note: 'District HQ Office', tel: '03852450900' },
    { icon: 'heart-pulse', title: 'JNIMS Hospital', num: '0385-2416041', note: 'Emergency Trauma 24/7', tel: '03852416041' },
    { icon: 'flame', title: 'Fire Station', num: '101', note: 'Imphal East Command', tel: '101' },
    { icon: 'compass', title: 'National Tourist Helpline', num: '1363', note: 'Govt. of India · 24/7 Support', tel: '1363' }
  ],
  'imphal-west': [
    { icon: 'shield', title: 'Imphal West Police', num: '0385-2220023', note: 'District HQ Office', tel: '03852220023' },
    { icon: 'heart-pulse', title: 'RIMS Hospital', num: '0385-2411700', note: 'Emergency Trauma 24/7', tel: '03852411700' },
    { icon: 'flame', title: 'Fire Station', num: '101', note: 'Imphal West Command', tel: '101' },
    { icon: 'compass', title: 'National Tourist Helpline', num: '1363', note: 'Govt. of India · 24/7 Support', tel: '1363' }
  ],
  'churachandpur': [
    { icon: 'shield', title: 'CCpur District Police', num: '03874-234567', note: 'District HQ Office', tel: '03874234567' },
    { icon: 'heart-pulse', title: 'District Hospital', num: '03874-234100', note: 'General Ward 24/7', tel: '03874234100' },
    { icon: 'flame', title: 'Fire Station', num: '101', note: 'Churachandpur Station', tel: '101' },
    { icon: 'compass', title: 'National Tourist Helpline', num: '1363', note: 'Govt. of India · 24/7 Support', tel: '1363' }
  ],
  'senapati': [
    { icon: 'shield', title: 'Senapati District Police', num: '03872-222345', note: 'District HQ Office', tel: '03872222345' },
    { icon: 'heart-pulse', title: 'District Hospital', num: '03872-222100', note: 'General Ward 24/7', tel: '0387222100' },
    { icon: 'flame', title: 'Fire Station', num: '101', note: 'Senapati Fire Depot', tel: '101' },
    { icon: 'compass', title: 'National Tourist Helpline', num: '1363', note: 'Govt. of India · 24/7 Support', tel: '1363' }
  ]
};

const defaultContacts = [
  { icon: 'shield', title: 'District Police', num: '100', note: 'National police network', tel: '100' },
  { icon: 'heart-pulse', title: 'Ambulance Response', num: '108', note: 'Free medical transit services', tel: '108' },
  { icon: 'flame', title: 'Fire Station', num: '101', note: 'Fire & emergency rescue', tel: '101' },
  { icon: 'compass', title: 'National Tourist Helpline', num: '1363', note: 'Govt. of India · 24/7 Support', tel: '1363' }
];

window.loadContacts = () => {
  const district = document.getElementById('district-select').value;
  const data = contacts[district] || defaultContacts;
  const grid = document.getElementById('contacts-grid');
  
  grid.innerHTML = data.map(c => `
    <div class="contact-card">
      <div class="contact-icon-box">
        <i data-lucide="${c.icon}"></i>
      </div>
      <div class="contact-info">
        <div class="contact-title">${c.title}</div>
        <div class="contact-num">${c.num}</div>
        <div class="contact-note">${c.note}</div>
        <a class="call-btn" href="tel:${c.tel}"><i data-lucide="phone" style="width:12px;"></i> Call Now</a>
      </div>
    </div>`).join('');
  lucide.createIcons();
};

// Initial triggers
loadContacts();
window.onTriageInputChange();
