import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeCrowdRisk, CROWD_SECTORS } from './risk-engine.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let watchId = null;

// Crowd Mode Active State
let activeSectorId = 'sector-a';
let activeCustomHeadcount = null;

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  const link = `${window.location.origin}/view-location.html?uid=${user.uid}`;
  const shareLinkInput = document.getElementById('share-link');
  if (shareLinkInput) shareLinkInput.value = link;
});

// Mode Switcher (GPS vs Kumbh Crowd Safety)
window.switchTrackerMode = (mode) => {
  const panelGps = document.getElementById('panel-gps');
  const panelCrowd = document.getElementById('panel-crowd');
  const tabGps = document.getElementById('tab-gps');
  const tabCrowd = document.getElementById('tab-crowd');

  if (mode === 'gps') {
    panelGps.style.display = 'block';
    panelCrowd.style.display = 'none';
    tabGps.classList.add('tab-active');
    tabCrowd.classList.remove('tab-active');
  } else {
    panelGps.style.display = 'none';
    panelCrowd.style.display = 'block';
    tabCrowd.classList.add('tab-active');
    tabGps.classList.remove('tab-active');
    updateCrowdTelemetryUI();
  }
  lucide.createIcons();
};

// Select Crowd Sector
window.selectSector = (sectorId) => {
  activeSectorId = sectorId;
  activeCustomHeadcount = null; // reset override to sector baseline
  
  // Update sector buttons styling
  ['sector-a', 'sector-b', 'sector-c', 'sector-d'].forEach(id => {
    const btn = document.getElementById(`btn-${id}`);
    if (btn) {
      if (id === sectorId) {
        btn.classList.add('border-emerald-500', 'bg-white/95');
        btn.classList.remove('border-transparent', 'bg-white/80');
      } else {
        btn.classList.remove('border-emerald-500', 'bg-white/95');
        btn.classList.add('border-transparent', 'bg-white/80');
      }
    }
  });

  const sector = CROWD_SECTORS[sectorId];
  const slider = document.getElementById('crowd-slider');
  if (slider && sector) {
    slider.value = sector.currentCount;
  }
  updateCrowdTelemetryUI();
};

window.onCrowdSliderChange = (val) => {
  activeCustomHeadcount = Number(val);
  const tag = document.getElementById('crowd-scenario-tag');
  if (tag) tag.textContent = 'Custom Interactive Headcount';
  updateCrowdTelemetryUI();
};

window.applyCrowdPreset = (preset) => {
  const tag = document.getElementById('crowd-scenario-tag');
  if (preset === 'normal') {
    activeSectorId = 'sector-c';
    activeCustomHeadcount = 14000;
    if (tag) tag.textContent = 'Scenario: Normal Pilgrimage Flow';
  } else if (preset === 'shahi-snan') {
    activeSectorId = 'sector-a';
    activeCustomHeadcount = 28000; // In 6,000 sq.m = 4.66 p/m² Critical
    if (tag) tag.textContent = 'Scenario: Shahi Snan Holy Dip Rush';
  } else if (preset === 'pontoon-bottleneck') {
    activeSectorId = 'sector-b';
    activeCustomHeadcount = 37500; // In 7,500 sq.m = 5.0 p/m² Severe Stampede Risk
    if (tag) tag.textContent = 'Scenario: Pontoon Bridge Chokepoint Surge';
  } else if (preset === 'camp-dispersal') {
    activeSectorId = 'sector-c';
    activeCustomHeadcount = 16000;
    if (tag) tag.textContent = 'Scenario: Evening Camp Dispersal';
  }

  // Update button highlights
  ['sector-a', 'sector-b', 'sector-c', 'sector-d'].forEach(id => {
    const btn = document.getElementById(`btn-${id}`);
    if (btn) {
      if (id === activeSectorId) {
        btn.classList.add('border-emerald-500', 'bg-white/95');
        btn.classList.remove('border-transparent', 'bg-white/80');
      } else {
        btn.classList.remove('border-emerald-500', 'bg-white/95');
        btn.classList.add('border-transparent', 'bg-white/80');
      }
    }
  });

  const slider = document.getElementById('crowd-slider');
  if (slider) slider.value = activeCustomHeadcount;

  updateCrowdTelemetryUI();
};

function updateCrowdTelemetryUI() {
  const data = computeCrowdRisk(activeSectorId, activeCustomHeadcount);
  const sector = CROWD_SECTORS[activeSectorId];

  // Title and headers
  const titleEl = document.getElementById('sector-title');
  if (titleEl) titleEl.textContent = data.sectorName;

  const tagEl = document.getElementById('sector-tag');
  if (tagEl) tagEl.textContent = data.sectorId.toUpperCase();

  const locEl = document.getElementById('sector-location-desc');
  if (locEl) locEl.textContent = data.location;

  // Headcount & Area
  const hcDisplay = document.getElementById('headcount-display');
  if (hcDisplay) hcDisplay.textContent = `${data.headcount.toLocaleString()} pilgrims`;

  const areaDisplay = document.getElementById('area-display');
  if (areaDisplay) areaDisplay.textContent = `${data.areaSqM.toLocaleString()} m²`;

  // Density & Fruin LoS
  const densityVal = document.getElementById('density-val');
  if (densityVal) densityVal.textContent = data.densityPersonsPerSqM.toFixed(2);

  const losTag = document.getElementById('fruin-los-tag');
  if (losTag) {
    if (data.densityPersonsPerSqM >= 4.0) {
      losTag.textContent = 'Fruin LoS: Level F (Extreme Shockwave & Stampede Hazard)';
      losTag.className = 'text-[11px] font-bold text-red-600 animate-pulse';
    } else if (data.densityPersonsPerSqM >= 2.2) {
      losTag.textContent = 'Fruin LoS: Level D-E (Constrained & Slowing Flow)';
      losTag.className = 'text-[11px] font-bold text-amber-600';
    } else {
      losTag.textContent = 'Fruin LoS: Level A-C (Fluid Unconstrained Transit)';
      losTag.className = 'text-[11px] font-bold text-emerald-600';
    }
  }

  // Stampede Risk Badge
  const riskBadge = document.getElementById('stampede-risk-badge');
  if (riskBadge) {
    riskBadge.className = `badge ${data.badgeClass} text-white font-black text-sm p-3 flex items-center gap-1.5 shadow-sm`;
    let icon = (data.stampedeRisk === 'Critical') ? 'alert-triangle' : (data.stampedeRisk === 'Moderate') ? 'alert-circle' : 'check-circle';
    riskBadge.innerHTML = `<i data-lucide="${icon}" style="width:14px; height:14px;"></i> ${data.stampedeRisk.toUpperCase()} STAMPEDE RISK`;
  }

  // Flow In vs Out
  const inVal = document.getElementById('inflow-val');
  if (inVal) inVal.textContent = data.inflowPerMin;

  const outVal = document.getElementById('outflow-val');
  if (outVal) outVal.textContent = data.outflowPerMin;

  const ratioVal = document.getElementById('flow-ratio-val');
  if (ratioVal) ratioVal.textContent = `${data.flowRatio}x`;

  // Capacity Progress
  const capacityPercent = Math.round((data.headcount / sector.safeCapacity) * 100);
  const capVal = document.getElementById('capacity-percent');
  if (capVal) capVal.textContent = `${capacityPercent}%`;

  const capProg = document.getElementById('capacity-progress');
  if (capProg) {
    capProg.value = Math.min(100, capacityPercent);
    capProg.className = `progress ${capacityPercent > 120 ? 'progress-error' : capacityPercent > 85 ? 'progress-warning' : 'progress-success'} w-full h-1.5`;
  }

  // Bottleneck Status & Alert Banner
  const bnCard = document.getElementById('bottleneck-alert-card');
  const bnHead = document.getElementById('bottleneck-headline');
  const bnSub = document.getElementById('bottleneck-subtext');
  const bnIcon = document.getElementById('bottleneck-icon');
  const bnLabel = document.getElementById('bottleneck-status-label');

  if (data.bottleneckTriggered) {
    if (bnCard) bnCard.className = 'alert-box alert-danger mb-4 animate-pulse';
    if (bnHead) bnHead.textContent = 'CRITICAL BOTTLENECK ACTIVE: INFLOW EXCEEDS EGRESS CAPACITY';
    if (bnSub) bnSub.textContent = `Shockwave pressure wave detected. Inflow is ${data.flowRatio}x higher than outflow capacity. Immediate pedestrian throttle required.`;
    if (bnIcon) bnIcon.setAttribute('data-lucide', 'alert-triangle');
    if (bnLabel) {
      bnLabel.textContent = 'CHOKEPOINT DETECTED';
      bnLabel.style.color = '#ef4444';
    }
  } else if (data.stampedeRisk === 'Moderate') {
    if (bnCard) bnCard.className = 'alert-box alert-warn mb-4';
    if (bnHead) bnHead.textContent = 'MODERATE FLOW RESTRICTION — MONITORING SECTOR GATES';
    if (bnSub) bnSub.textContent = 'Pedestrian density approaching threshold. Maintain continuous movement and clear barricades.';
    if (bnIcon) bnIcon.setAttribute('data-lucide', 'alert-circle');
    if (bnLabel) {
      bnLabel.textContent = 'Pacing Controls Active';
      bnLabel.style.color = '#f59e0b';
    }
  } else {
    if (bnCard) bnCard.className = 'alert-box alert-safe mb-4';
    if (bnHead) bnHead.textContent = 'FLOW BALANCED: ALL ACCESS ROUTES UNOBSTRUCTED';
    if (bnSub) bnSub.textContent = 'Headcount within safe structural capacity. No bottleneck conditions detected.';
    if (bnIcon) bnIcon.setAttribute('data-lucide', 'check-circle');
    if (bnLabel) {
      bnLabel.textContent = 'All Clear';
      bnLabel.style.color = '#10b981';
    }
  }

  // Safe Decongestion Routing text
  const routingText = document.getElementById('decongestion-routing-text');
  if (routingText) routingText.textContent = data.decongestionRouting;

  lucide.createIcons();
}

// -------------------------------------------------------------
// GPS JOURNEY TRACKER FUNCTIONALITY (Preserved 100% Intact)
// -------------------------------------------------------------
window.toggleSharing = async () => {
  const isOn = document.getElementById('share-toggle').checked;
  const status = document.getElementById('status-msg');

  if (isOn) {
    status.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:16px; height:16px; display:inline;"></i> Handshaking GPS satellite grid...`;
    status.className = 'status';
    lucide.createIcons();

    if (!navigator.geolocation) {
      status.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px; display:inline;"></i> Local hardware does not support GPS sensors.`;
      status.className = 'status error';
      lucide.createIcons();
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        document.getElementById('lat-val').textContent = latitude.toFixed(5);
        document.getElementById('lng-val').textContent = longitude.toFixed(5);
        document.getElementById('accuracy-val').textContent = Math.round(accuracy) + 'm';
        document.getElementById('updated-val').textContent = new Date().toLocaleTimeString();

        status.innerHTML = `<i data-lucide="wifi" style="width:16px; height:16px; display:inline;"></i> Granular tracking active — streaming coordinates live.`;
        status.className = 'status active';
        lucide.createIcons();

        document.getElementById('share-link-box').style.display = 'block';

        const mapFrame = document.getElementById('map-frame');
        mapFrame.src = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
        mapFrame.style.display = 'block';

        if (currentUser) {
          await setDoc(doc(db, 'locations', currentUser.uid), {
            uid: currentUser.uid,
            name: currentUser.displayName || 'Traveler',
            latitude, longitude, accuracy,
            updatedAt: new Date().toISOString(),
            sharing: true
          });
        }
      },
      (err) => {
        status.innerHTML = `<i data-lucide="alert-triangle" style="width:16px; height:16px; display:inline;"></i> Sensor access denied. Verify system-level permissions.`;
        status.className = 'status error';
        lucide.createIcons();
        document.getElementById('share-toggle').checked = false;
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  } else {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (currentUser) await deleteDoc(doc(db, 'locations', currentUser.uid));

    status.innerHTML = `<i data-lucide="info" style="width:16px; height:16px; display:inline;"></i> Telemetry stream stopped. Sensor details deleted.`;
    status.className = 'status';
    lucide.createIcons();

    document.getElementById('share-link-box').style.display = 'none';
    document.getElementById('map-frame').style.display = 'none';
    document.getElementById('lat-val').textContent = '--';
    document.getElementById('lng-val').textContent = '--';
    document.getElementById('accuracy-val').textContent = '--';
    document.getElementById('updated-val').textContent = '--';
  }
};

window.copyLink = () => {
  navigator.clipboard.writeText(document.getElementById('share-link').value);
  const copyBtn = document.querySelector('.copy-btn');
  copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;"></i> Copied!';
  lucide.createIcons();
  setTimeout(() => {
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;"></i> Copy Link';
    lucide.createIcons();
  }, 2000);
};

// Initial crowd calculations
updateCrowdTelemetryUI();
