import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeMedicalTriage, classifySymptomsNLP, TRIAGE_CATEGORIES } from './risk-engine.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let currentTriageAssessment = null;
let debounceTimer = null;
let assessmentRevision = 0;
let submitting = false;

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'login.html';
  currentUser = user;
});

function getGeminiApiKey() {
  const stored = localStorage.getItem('gemini_api_key');
  if (stored && stored.trim() !== '') return stored.trim();
  const config = window.CONFIG?.GEMINI_API_KEY;
  if (config && config.trim() !== '') return config.trim();
  return null;
}

// Quick Multilingual Demo Input Injector
window.applySymptomDemo = (demoType) => {
  const inputEl = document.getElementById('triage-symptoms-text');
  if (!inputEl) return;

  if (demoType === 'en-crush') {
    inputEl.value = 'Stampede crush injury near Pontoon Bridge 2 exit, patient is unconscious and lips are blue';
  } else if (demoType === 'hi-stampede') {
    inputEl.value = 'भगदड़ में सीने पर गंभीर चोट लगी है, मरीज बेहोश है और बहुत खून बह रहा है';
  } else if (demoType === 'mni-landslide') {
    inputEl.value = 'Ching leikhom chumbada kok ta asokpa fangkhre, wakhal leitaba amasung ee thorakli';
  } else if (demoType === 'heatstroke') {
    inputEl.value = 'Midday sun hyperthermia at Sangam Ghat, core temp 40.5C, anhidrosis, patient delirious';
  }

  window.onTriageInputChange();
};

window.debounceTriageInput = () => {
  ++assessmentRevision;
  currentTriageAssessment = null;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    window.onTriageInputChange();
  }, 400);
};

// -------------------------------------------------------------
// AI GOLDEN-HOUR MEDICAL TRIAGE LOGIC (Gemini 2.5 Flash + Edge NLP)
// -------------------------------------------------------------
window.onTriageInputChange = async (useCloud = false) => {
  const revision = ++assessmentRevision;
  currentTriageAssessment = null;
  const conditionSelect = document.getElementById('triage-condition-select');
  const consciousnessEl = document.getElementById('triage-consciousness');
  const severeBleedingEl = document.getElementById('triage-severe-bleeding');
  const breathingDiffEl = document.getElementById('triage-breathing-diff');
  const pulseEl = document.getElementById('triage-pulse');
  const symptomsText = document.getElementById('triage-symptoms-text')?.value.trim() || '';

  const tagEl = document.getElementById('triage-ai-model-tag');

  // Check if Gemini API Key is available
  const geminiKey = getGeminiApiKey();

  if (useCloud === true && geminiKey && symptomsText.length > 5) {
    if (tagEl) {
      tagEl.textContent = 'Contacting Gemini 2.5 Flash...';
      tagEl.className = 'badge badge-warning text-[10px] font-bold text-white animate-pulse';
    }

    try {
      const prompt = `You are ExploreGuard Emergency Medical Triage AI. Analyze the casualty symptoms according to START (Simple Triage and Rapid Treatment) and Manchester Triage protocols.
Symptom Narrative: "${symptomsText}"
Return ONLY valid JSON with this exact schema:
{
  "triage_priority": "RED" | "YELLOW" | "GREEN",
  "suspected_condition": string,
  "golden_hour_window": number,
  "first_aid_steps": [string, string, string, string],
  "localized_summary": string
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          if (revision !== assessmentRevision) return;
          if (!['RED', 'YELLOW', 'GREEN'].includes(parsed.triage_priority)
            || typeof parsed.suspected_condition !== 'string'
            || typeof parsed.localized_summary !== 'string'
            || !Array.isArray(parsed.first_aid_steps)
            || !parsed.first_aid_steps.every(step => typeof step === 'string')) {
            throw new Error('Invalid AI response');
          }
          currentTriageAssessment = {
            triageId: `TRG-GEMINI-${Date.now().toString(36).toUpperCase()}`,
            conditionId: 'generative-ai-triage',
            conditionTitle: parsed.suspected_condition || 'Mass-Gathering Casualty',
            priority: parsed.triage_priority || 'RED',
            priorityLabel: `${parsed.triage_priority} - Experimental`,
            badgeColor: parsed.triage_priority === 'RED' ? '#ef4444' : parsed.triage_priority === 'YELLOW' ? '#f59e0b' : '#10b981',
            badgeClass: parsed.triage_priority === 'RED' ? 'badge-error' : parsed.triage_priority === 'YELLOW' ? 'badge-warning' : 'badge-success',
            goldenHourMinutes: null,
            urgencyDescription: `Gemini 2.5 Flash Assessment: ${parsed.suspected_condition}. Immediate clinical management recommended.`,
            clinicalReason: parsed.localized_summary,
            firstAidSteps: parsed.first_aid_steps,
            recommendedFacility: 'Not assigned',
            vitalsRecorded: {
              consciousness: consciousnessEl?.value || 'unknown',
              breathingDifficulty: breathingDiffEl?.checked || false,
              severeBleeding: severeBleedingEl?.checked || false,
              pulseRate: pulseEl?.value ? Number(pulseEl.value) : null
            },
            symptomsDescription: symptomsText,
            localizedSummary: parsed.localized_summary,
            source: 'gemini-2.5-flash',
            timestamp: new Date().toISOString()
          };

          if (tagEl) {
            tagEl.textContent = 'Triaged via Google Gemini 2.5 Flash';
            tagEl.className = 'badge badge-success text-[10px] font-bold text-white';
          }
          renderTriageUI(currentTriageAssessment);
          return;
        }
      }
    } catch (err) {
      console.warn("Gemini call failed or network offline, triggering Edge NLP fallback:", err);
    }
  }

  // Experimental local keyword fallback; no clinical validation.
  if (revision !== assessmentRevision) return;
  const conditionId = conditionSelect?.value || 'auto';
  const consciousness = consciousnessEl?.value || 'unknown';
  const severeBleeding = severeBleedingEl?.checked || false;
  const breathingDifficulty = breathingDiffEl?.checked || false;
  const pulseRate = pulseEl?.value ? Number(pulseEl.value) : null;

  try { currentTriageAssessment = computeMedicalTriage({
    conditionId,
    consciousness,
    severeBleeding,
    breathingDifficulty,
    pulseRate,
    symptomsText
  }); } catch (error) {
    if (tagEl) tagEl.textContent = 'Invalid input — check the recorded measurements';
    document.getElementById('triage-priority-badge').textContent = 'Assessment unavailable';
    return;
  }

  if (tagEl) {
    tagEl.textContent = 'Experimental local rules — clinical review pending';
    tagEl.className = 'badge badge-ghost text-[10px] font-bold';
  }

  renderTriageUI(currentTriageAssessment);
};

function renderTriageUI(data) {
  // Update Priority Badge
  const badgeEl = document.getElementById('triage-priority-badge');
  if (badgeEl) {
    badgeEl.className = `badge ${data.badgeClass} text-white font-black text-sm p-3 flex items-center gap-1.5 shadow-sm`;
    let icon = (data.priority === 'RED') ? 'alert-octagon' : (data.priority === 'YELLOW') ? 'alert-triangle' : 'check-circle';
    badgeEl.textContent = `${data.priorityLabel} — unvalidated demo`;
  }

  // Update Golden-Hour Window
  const ghEl = document.getElementById('triage-golden-hour');
  if (ghEl) {
    ghEl.textContent = 'Not estimated';
    ghEl.style.color = data.badgeColor;
  }

  // Update Urgency Description
  const urgEl = document.getElementById('triage-urgency-desc');
  if (urgEl) urgEl.textContent = 'Prototype assessment only. No responder has been contacted.';

  // Update Facility
  const facEl = document.getElementById('triage-facility-name');
  if (facEl) facEl.textContent = data.recommendedFacility;

  // Render First Aid Steps
  const stepsContainer = document.getElementById('first-aid-steps-container');
  if (stepsContainer && data.firstAidSteps) {
    stepsContainer.textContent = 'Clinical instructions are withheld until qualified review. This prototype does not provide validated treatment advice.';
  }

  // Localized Summary Banner (Gemini or NLP)
  const locBanner = document.getElementById('localized-summary-banner');
  const locText = document.getElementById('localized-summary-text');
  if (locBanner && locText) {
    if (data.localizedSummary) {
      locBanner.style.display = 'flex';
      locText.textContent = data.localizedSummary;
    } else {
      locBanner.style.display = 'none';
    }
  }

  lucide.createIcons();
}

// -------------------------------------------------------------
// DISPATCH GPS SOS TO FIRESTORE & LOCAL EMERGENCY BROKER
// -------------------------------------------------------------
window.dispatchEmergencySOS = async () => {
  if (submitting) return;
  const btn = document.getElementById('dispatch-sos-btn');
  const box = document.getElementById('dispatch-confirm-box');
  const details = document.getElementById('dispatch-details');
  const show = message => { if (box) box.style.display = 'flex'; if (details) details.textContent = message; };
  if (!currentUser) { show('Sign in before recording a request. Nothing was sent.'); return; }
  submitting = true;
  btn.disabled = true;
  btn.textContent = 'Recording demo request…';
  clearTimeout(debounceTimer);
  try {
    if (!currentTriageAssessment) await window.onTriageInputChange();
    const assessment = currentTriageAssessment;
    if (!assessment) throw new Error('Complete the request form first.');
    const uid = currentUser.uid;
    const requestId = assessment.triageId;
    const key = `exploreguard.pending.${uid}.${requestId}`;
    const coordinates = await new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(pos => resolve({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy
      }), () => resolve(null), {enableHighAccuracy: true, timeout: 5000});
    });
    if (currentUser?.uid !== uid) throw new Error('Account changed. Please retry after signing in.');
    const payload = JSON.parse(JSON.stringify({
      ...assessment, patientUid: uid, requestId, coordinates,
      locationStatus: coordinates ? 'device_location' : 'unknown',
      status: 'RECORDED_DEMO_REQUEST', responderAcknowledged: false,
      etaMinutes: null, timestamp: new Date().toISOString()
    }));
    let savedLocally = false;
    try { localStorage.setItem(key, JSON.stringify(payload)); savedLocally = true; } catch (_) {}
    // Stable document IDs make retries idempotent; the two writes succeed atomically.
    const batch = writeBatch(db);
    batch.set(doc(db, 'triages', requestId), payload);
    batch.set(doc(db, 'emergency_dispatches', requestId), payload);
    let timeout;
    const acknowledgement = batch.commit().then(() => {
      try { localStorage.removeItem(key); } catch (_) {}
      return 'stored';
    });
    const result = await Promise.race([
      acknowledgement,
      new Promise(resolve => { timeout = setTimeout(() => resolve('pending'), 12000); })
    ]).finally(() => clearTimeout(timeout));
    if (result === 'stored') {
      show(`Request ${requestId} stored in the demo database. ${coordinates ? 'Device location included.' : 'Location unavailable.'} No ambulance or PHC has been contacted. No ETA is available.`);
      btn.textContent = 'Request recorded';
    } else {
      show(`Server confirmation pending. ${savedLocally ? 'A copy is saved on this device.' : 'Local saving is unavailable; keep this page open.'} No responder has been contacted. Retry uses the same request ID while this assessment remains open.`);
      btn.textContent = 'Retry recording request';
    }
  } catch (error) {
    console.warn('Request could not be confirmed:', error);
    show('Request not confirmed by the server. Check your connection and account permissions, then retry. No responder has been contacted.');
    btn.textContent = 'Retry recording request';
  } finally {
    submitting = false;
    btn.disabled = false;
  }
};

// Gemini Key Settings
window.openGeminiSettings = () => {
  const input = document.getElementById('gemini-triage-key-input');
  if (input) input.value = localStorage.getItem('gemini_api_key') || '';
  document.getElementById('gemini-triage-modal')?.showModal();
};

window.saveGeminiKey = () => {
  const key = document.getElementById('gemini-triage-key-input')?.value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
    alert('Gemini 2.5 Flash API Key saved securely to browser.');
  }
  document.getElementById('gemini-triage-modal')?.close();
  window.onTriageInputChange();
};

window.clearGeminiKey = () => {
  localStorage.removeItem('gemini_api_key');
  document.getElementById('gemini-triage-key-input').value = '';
  alert('Gemini API Key removed. Offline Edge NLP classifier will handle triage.');
  document.getElementById('gemini-triage-modal')?.close();
  window.onTriageInputChange();
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

window.restorePendingRequest = () => {
  if (!currentUser || submitting) return;
  const prefix = `exploreguard.pending.${currentUser.uid}.`;
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    const pending = keys.map(key => JSON.parse(localStorage.getItem(key)))
      .filter(item => item.patientUid === currentUser.uid && item.triageId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (!pending.length) { alert('No locally saved pending request for this account.'); return; }
    ++assessmentRevision; clearTimeout(debounceTimer);
    currentTriageAssessment = pending[0];
    renderTriageUI(currentTriageAssessment);
    document.getElementById('dispatch-details').textContent = 'Saved request restored. Review it, then use Record request to retry. No responder has been contacted.';
    document.getElementById('dispatch-confirm-box').style.display = 'flex';
  } catch (_) { alert('Saved requests could not be read on this device.'); }
};
