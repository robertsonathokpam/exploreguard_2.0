import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { computeCrowdRisk, CROWD_VENUES, CROWD_SECTORS } from './risk-engine.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let watchId = null;

// Multi-Venue Active State
let activeVenueId = 'kumbh-mela';
let activeSectorId = 'sector-a';
let activeCustomHeadcount = null;

// Custom Venue Configuration
let customVenueConfig = {
  id: 'custom',
  name: 'Custom Location Gathering',
  city: 'Universal Coordinates',
  sectors: {
    'sector-a': { id: 'sector-a', name: 'Zone A Main Ingress', areaSqM: 5000, safeCapacity: 10000, currentCount: 8500, inflowPerMin: 320, outflowPerMin: 300, evacuationRoutes: ['Main Gate 1', 'Spillway East'] },
    'sector-b': { id: 'sector-b', name: 'Zone B Intermodal Hub', areaSqM: 6000, safeCapacity: 12000, currentCount: 14500, inflowPerMin: 550, outflowPerMin: 280, evacuationRoutes: ['Transit Terminal Pier', 'Overpass West'] },
    'sector-c': { id: 'sector-c', name: 'Zone C Relief & Staging', areaSqM: 10000, safeCapacity: 20000, currentCount: 11000, inflowPerMin: 180, outflowPerMin: 170, evacuationRoutes: ['Radial Arterial 3', 'High Grounds'] },
    'sector-d': { id: 'sector-d', name: 'Zone D Medical Corridor', areaSqM: 3500, safeCapacity: 3500, currentCount: 2200, inflowPerMin: 70, outflowPerMin: 80, evacuationRoutes: ['Emergency Bay 1', 'Helipad Road'] }
  }
};

// Computer Vision Model State (Lazy-Loaded)
let cocoModel = null;
let visionSource = null;
let visionRevision = 0;
let visionBusy = false;

function setVisionSource(source, isSample = false) {
  const width = source.naturalWidth || source.videoWidth || source.width;
  const height = source.naturalHeight || source.videoHeight || source.height;
  if (!width || !height) throw new Error('Image is not ready');
  const scale = Math.min(1, 1600 / Math.max(width, height));
  visionSource = document.createElement('canvas');
  visionSource.width = Math.round(width * scale);
  visionSource.height = Math.round(height * scale);
  visionSource.getContext('2d').drawImage(source, 0, 0, visionSource.width, visionSource.height);
  visionRevision++;
  const canvas = document.getElementById('vision-canvas');
  canvas.width = visionSource.width;
  canvas.height = visionSource.height;
  canvas.getContext('2d').drawImage(visionSource, 0, 0);
  document.getElementById('vision-detected-count').textContent = 'Not scanned';
  document.getElementById('vision-inference-time').textContent = '—';
  document.getElementById('vision-density').textContent = 'Density unavailable until this image is scanned.';
  document.getElementById('vision-model-status').textContent = isSample
    ? 'Illustrated sample — not an accuracy benchmark' : 'Image ready';
}

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
    // Pre-render default crowd sample on canvas
    drawSampleCrowdToCanvas('preset-1');
  }
  lucide.createIcons();
};

// Venue Switcher
window.onVenueChange = (venueId) => {
  activeVenueId = venueId;
  const customPanel = document.getElementById('custom-venue-panel');
  if (venueId === 'custom') {
    if (customPanel) customPanel.style.display = 'block';
  } else {
    if (customPanel) customPanel.style.display = 'none';
  }

  // Update sector buttons labels based on venue
  const currentVenue = (venueId === 'custom') ? customVenueConfig : CROWD_VENUES[venueId];
  if (currentVenue && currentVenue.sectors) {
    const keys = Object.keys(currentVenue.sectors);
    activeSectorId = keys[0];
    keys.forEach((key, idx) => {
      const sec = currentVenue.sectors[key];
      const titleEl = document.getElementById(`title-${key}`);
      const capEl = document.getElementById(`cap-${key}`);
      if (titleEl) titleEl.textContent = sec.name;
      if (capEl) capEl.textContent = `Capacity: ${sec.safeCapacity.toLocaleString()}`;
    });
  }

  activeCustomHeadcount = null;
  updateCrowdTelemetryUI();
};

window.updateCustomVenueDetails = () => {
  const name = document.getElementById('custom-venue-name')?.value.trim();
  const city = document.getElementById('custom-venue-city')?.value.trim();
  if (name) customVenueConfig.name = name;
  if (city) customVenueConfig.city = city;
  updateCrowdTelemetryUI();
};

window.useLiveGPSForVenue = () => {
  if (!navigator.geolocation) {
    alert("Geolocation unavailable.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      customVenueConfig.city = `Live GPS (${pos.coords.latitude.toFixed(3)}°, ${pos.coords.longitude.toFixed(3)}°)`;
      const cityInput = document.getElementById('custom-venue-city');
      if (cityInput) cityInput.value = customVenueConfig.city;
      updateCrowdTelemetryUI();
    },
    () => alert("GPS permission denied."),
    { timeout: 5000 }
  );
};

// Select Crowd Sector
window.selectSector = (sectorId) => {
  activeSectorId = sectorId;
  activeCustomHeadcount = null;
  
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

  const currentVenue = (activeVenueId === 'custom') ? customVenueConfig : CROWD_VENUES[activeVenueId];
  const sector = currentVenue.sectors[sectorId] || currentVenue.sectors[Object.keys(currentVenue.sectors)[0]];
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
    activeCustomHeadcount = 28000;
    if (tag) tag.textContent = 'Scenario: Shahi Snan Holy Dip Rush';
  } else if (preset === 'pontoon-bottleneck') {
    activeSectorId = 'sector-b';
    activeCustomHeadcount = 37500;
    if (tag) tag.textContent = 'Scenario: Pontoon Bridge Chokepoint Surge';
  } else if (preset === 'camp-dispersal') {
    activeSectorId = 'sector-c';
    activeCustomHeadcount = 16000;
    if (tag) tag.textContent = 'Scenario: Evening Camp Dispersal';
  }

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
  const currentVenue = (activeVenueId === 'custom') ? customVenueConfig : CROWD_VENUES[activeVenueId];
  let data;
  try { data = computeCrowdRisk(activeSectorId, activeCustomHeadcount, currentVenue); }
  catch (error) {
    const tag = document.getElementById('crowd-scenario-tag');
    if (tag) tag.textContent = 'Invalid scenario input — check count, area and flow';
    return;
  }
  const sector = currentVenue.sectors[activeSectorId] || Object.values(currentVenue.sectors)[0];

  // Title and headers
  const titleEl = document.getElementById('sector-title');
  if (titleEl) titleEl.textContent = data.sectorName;

  const tagEl = document.getElementById('sector-tag');
  if (tagEl) tagEl.textContent = `${currentVenue.name.split(' ')[0]} · ${data.sectorId.toUpperCase()}`;

  const locEl = document.getElementById('sector-location-desc');
  if (locEl) locEl.textContent = `${data.location} (${currentVenue.city})`;

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

  const routingText = document.getElementById('decongestion-routing-text');
  if (routingText) routingText.textContent = data.decongestionRouting;

  lucide.createIcons();
}

// -------------------------------------------------------------
// COMPUTER VISION AI CROWD COUNTER (TensorFlow.js + MobileNetV2 COCO-SSD)
// -------------------------------------------------------------

async function getOrInitCocoModel() {
  if (cocoModel) return cocoModel;
  const overlay = document.getElementById('vision-loading-overlay');
  const loadingText = document.getElementById('vision-loading-text');
  const statusEl = document.getElementById('vision-model-status');

  if (overlay) overlay.style.display = 'flex';
  if (loadingText) loadingText.textContent = 'Loading person-detection model...';
  if (statusEl) statusEl.textContent = 'Loading Model...';

  try {
    if (typeof cocoSsd !== 'undefined') {
      cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      if (statusEl) statusEl.textContent = 'Neural Network Ready';
      return cocoModel;
    } else {
      throw new Error("COCO-SSD library not loaded from CDN");
    }
  } catch (e) {
    console.warn("Person-detection model could not load:", e);
    if (statusEl) statusEl.textContent = 'Model unavailable — retry online';
    return null;
  } finally {
    if (overlay) overlay.style.display = 'none';
  }
}

// Draw sample crowd images onto the canvas
function drawSampleCrowdToCanvas(preset = 'preset-1') {
  const canvas = document.getElementById('vision-canvas');
  if (!canvas) return;
  canvas.width = 600; canvas.height = 280;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // High quality procedural crowd visual representation with pilgrims and silhouettes
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (preset === 'preset-1') {
    // Holy Ghat Riverbank scene
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.7, '#1e293b');
    grad.addColorStop(1, '#0e7490');
  } else if (preset === 'preset-2') {
    // Pontoon Bridge Chokepoint scene
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.7, '#292524');
    grad.addColorStop(1, '#b45309');
  } else {
    // Open Relief Pavilion scene
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.8, '#064e3b');
    grad.addColorStop(1, '#047857');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw simulated person figures
  const personCount = (preset === 'preset-1') ? 18 : (preset === 'preset-2') ? 26 : 10;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText(`ILLUSTRATED SAMPLE: ${preset.toUpperCase()}`, 16, 24);

  // Draw distinct human figures
  for (let i = 0; i < personCount; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 50 + col * 75 + ((row % 2) * 35) + (Math.sin(i * 1.5) * 12);
    const y = 80 + row * 65 + (Math.cos(i * 2) * 8);

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 16, 9, 0, Math.PI * 2);
    ctx.fillStyle = (i % 3 === 0) ? '#f87171' : (i % 2 === 0) ? '#38bdf8' : '#fbbf24';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 5, 24, 34, [6, 6, 2, 2]);
    ctx.fillStyle = (i % 4 === 0) ? '#e2e8f0' : (i % 3 === 0) ? '#94a3b8' : '#cbd5e1';
    ctx.fill();

    // Legs
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 9, y + 29, 6, 18);
    ctx.fillRect(x + 3, y + 29, 6, 18);
  }

  // Draw crowd boundary lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 40, canvas.width - 40, canvas.height - 55);
  setVisionSource(canvas, true);
}

window.loadVisionPreset = (preset) => {
  drawSampleCrowdToCanvas(preset);
  window.runVisionDetection();
};

window.onVisionFileUploaded = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Choose an image file.'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    setVisionSource(img);
    URL.revokeObjectURL(url);
    window.runVisionDetection();
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('This image could not be opened.'); };
  img.src = url;
};

window.captureWebcamSnapshot = async () => {
  const video = document.getElementById('webcam-video');
  let stream;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720}}});
    video.srcObject = stream;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 400));
    setVisionSource(video);
  } catch (error) {
    alert('Camera unavailable or permission denied. You can upload a photo instead.');
    return;
  } finally {
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  await window.runVisionDetection();
};

window.runVisionDetection = async () => {
  if (visionBusy) return;
  const canvas = document.getElementById('vision-canvas');
  const status = document.getElementById('vision-model-status');
  const count = document.getElementById('vision-detected-count');
  const time = document.getElementById('vision-inference-time');
  const button = document.getElementById('btn-run-vision-scan');
  if (!visionSource) { status.textContent = 'Upload a photo or take a snapshot first'; return; }
  const revision = visionRevision;
  const source = visionSource;
  visionBusy = true;
  button.disabled = true;
  count.textContent = 'Scanning…';
  time.textContent = '—';
  canvas.getContext('2d').drawImage(source, 0, 0);
  try {
    const model = await getOrInitCocoModel();
    if (!model) throw new Error('Model unavailable');
    if (revision !== visionRevision) return;
    status.textContent = 'Scanning image…';
    const started = performance.now();
    // Explicit limit and threshold. This does not guarantee dense-crowd recall.
    const predictions = await model.detect(source, 200, 0.35);
    if (revision !== visionRevision) return;
    const people = predictions.filter(p => p.class === 'person' && Number.isFinite(p.score)
      && p.score >= 0.35 && Array.isArray(p.bbox) && p.bbox.length === 4
      && p.bbox.every(Number.isFinite) && p.bbox[2] > 0 && p.bbox[3] > 0);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.lineWidth = Math.max(2, canvas.width / 500);
    ctx.font = `${Math.max(12, Math.round(canvas.width / 65))}px sans-serif`;
    people.forEach(p => {
      const [x, y, w, h] = p.bbox;
      ctx.strokeStyle = '#10b981'; ctx.strokeRect(x, y, w, h);
      const label = `Person ${Math.round(p.score * 100)}%`;
      const labelWidth = ctx.measureText(label).width + 8;
      const labelY = Math.max(18, y);
      ctx.fillStyle = '#064e3b'; ctx.fillRect(x, labelY - 18, labelWidth, 20);
      ctx.fillStyle = '#ffffff'; ctx.fillText(label, x + 4, labelY - 3);
    });
    count.textContent = `${people.length} detected`;
    time.textContent = `${Math.round(performance.now() - started)} ms`;
    status.textContent = people.length ? 'Complete — visible detections only' : 'No people detected — people may still be missed';
    if (predictions.length >= 200) status.textContent += '; detection limit reached';
    const area = Number(document.getElementById('vision-area')?.value);
    const density = document.getElementById('vision-density');
    if (density) density.textContent = Number.isFinite(area) && area > 0
      ? `Estimated visible density: ${(people.length / area).toFixed(2)} detections/m² (requires measured camera area)`
      : 'Density unavailable: enter the measured ground area visible in this image.';
  } catch (error) {
    console.warn('Vision scan failed:', error);
    if (revision === visionRevision) {
      count.textContent = 'Unavailable';
      status.textContent = 'Scan failed — check connection/model and retry';
      time.textContent = '—';
      document.getElementById('vision-density').textContent = 'Density unavailable';
    }
  } finally {
    visionBusy = false;
    button.disabled = false;
    // A newly selected image supersedes an in-flight scan.
    if (revision !== visionRevision) window.runVisionDetection();
  }
};

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
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
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
