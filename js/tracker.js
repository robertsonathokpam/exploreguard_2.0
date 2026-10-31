import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createPersonDetector } from './vision-model.js';

// Initializing Lucide Icons
lucide.createIcons();

let currentUser = null;
let watchId = null;

// Computer Vision Model State (Lazy-Loaded)
const detectorCache = new Map();
let visionSource = null;
let visionRevision = 0;
let visionBusy = false;

// Corrections are local to this photo; they never represent a venue total.
let reviewPeople = [], originalPeople = [], reviewHistory = [], reviewReady = false;
function resetPhotoReview() {
  reviewPeople = []; originalPeople = []; reviewHistory = []; reviewReady = false;
  document.getElementById('review-count').textContent = 'Not reviewed';
  document.getElementById('review-status').textContent = 'Scan a photo, then check each marker.';
  document.getElementById('review-list').replaceChildren();
}
function renderPhotoReview() {
  if (!visionSource) return;
  const canvas = document.getElementById('vision-canvas'), ctx = canvas.getContext('2d');
  ctx.drawImage(visionSource, 0, 0);
  const list = document.getElementById('review-list'); list.replaceChildren();
  reviewPeople.forEach((p, i) => {
    const size = Math.max(20, canvas.width / (canvas.clientWidth || canvas.width) * 22);
    ctx.fillStyle = p.manual ? '#1d4ed8' : '#047857';
    ctx.fillRect(p.x-size/2, p.y-size/2, size, size);
    ctx.font = `bold ${size*.65}px sans-serif`; ctx.fillStyle = '#fff';
    ctx.fillText(String(i+1), p.x-size/3, p.y+size/4);
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = `Remove person ${i+1}${p.manual ? ' (added)' : ''}`;
    button.onclick = () => removeReviewPerson(i); list.append(button);
  });
  document.getElementById('review-count').textContent = `${reviewPeople.length} — review in progress`;
  document.getElementById('review-status').textContent = 'Tap a missed person to add a marker. Tap a marker to remove it. Then finish your review.';
}
function rememberReview() { reviewHistory.push(reviewPeople.map(p=>({...p}))); }
function removeReviewPerson(i) {
  if (!reviewReady || visionBusy) return;
  rememberReview(); reviewPeople.splice(i,1); renderPhotoReview();
}
window.editPhotoReview = event => {
  if (!reviewReady || visionBusy) return;
  const canvas = document.getElementById('vision-canvas'), rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = (event.clientX-rect.left)/rect.width*canvas.width;
  const y = (event.clientY-rect.top)/rect.height*canvas.height;
  if (x<0 || y<0 || x>canvas.width || y>canvas.height) return;
  // Hit testing uses screen pixels, including on a resized mobile canvas.
  let nearest=-1, distance=22;
  reviewPeople.forEach((p,i)=>{const d=Math.hypot((p.x-x)*rect.width/canvas.width,(p.y-y)*rect.height/canvas.height);if(d<distance){distance=d;nearest=i;}});
  if(nearest>=0) { removeReviewPerson(nearest); return; }
  rememberReview(); reviewPeople.push({x,y,manual:true}); renderPhotoReview();
};
window.undoPhotoReview = () => {
  if (!reviewReady || visionBusy || !reviewHistory.length) return;
  reviewPeople = reviewHistory.pop(); renderPhotoReview();
};
window.restorePhotoReview = () => {
  if (!reviewReady || visionBusy) return;
  rememberReview(); reviewPeople = originalPeople.map(p=>({...p})); renderPhotoReview();
};
window.finishPhotoReview = () => {
  if (!reviewReady || visionBusy) return;
  document.getElementById('review-count').textContent = `${reviewPeople.length} visible people — reviewed by you`;
  document.getElementById('review-status').textContent = 'Review complete. Hidden or unclear people can still be missed. Any edit starts a new review.';
};

function setVisionSource(source) {
  const width = source.naturalWidth || source.videoWidth || source.width;
  const height = source.naturalHeight || source.videoHeight || source.height;
  if (!width || !height) throw new Error('Image is not ready');
  const scale = Math.min(1, 1600 / Math.max(width, height));
  visionSource = document.createElement('canvas');
  visionSource.width = Math.round(width * scale);
  visionSource.height = Math.round(height * scale);
  visionSource.getContext('2d').drawImage(source, 0, 0, visionSource.width, visionSource.height);
  visionRevision++;
  resetPhotoReview();
  const canvas = document.getElementById('vision-canvas');
  canvas.width = visionSource.width;
  canvas.height = visionSource.height;
  canvas.getContext('2d').drawImage(visionSource, 0, 0);
  document.getElementById('vision-detected-count').textContent = 'Not scanned';
  document.getElementById('vision-inference-time').textContent = '—';
  document.getElementById('vision-density').textContent = 'Crowd density unavailable: camera calibration and count validation are required.';
  document.getElementById('vision-model-status').textContent = 'Image ready';
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

  }
  lucide.createIcons();
};

// -------------------------------------------------------------
// COMPUTER VISION AI CROWD COUNTER (TensorFlow.js + MobileNetV2 COCO-SSD)
// -------------------------------------------------------------

async function getOrInitCocoModel() {
  const choice = document.getElementById('vision-model-select')?.value || 'mobilenet';
  if (!detectorCache.has(choice)) {
    const loading = createPersonDetector(choice).catch(error => {
      detectorCache.delete(choice);
      throw error;
    });
    detectorCache.set(choice, loading);
  }
  return detectorCache.get(choice);
}

window.onVisionModelChanged = () => {
  visionRevision++;
  resetPhotoReview();
  document.getElementById('vision-detected-count').textContent = 'Not scanned';
  document.getElementById('vision-inference-time').textContent = '—';
  document.getElementById('vision-model-status').textContent = 'Model changed — run scan';
  if (visionSource) document.getElementById('vision-canvas').getContext('2d').drawImage(visionSource, 0, 0);
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
  resetPhotoReview();
  visionBusy = true;
  button.disabled = true;
  count.textContent = 'Scanning…';
  time.textContent = '—';
  canvas.getContext('2d').drawImage(source, 0, 0);
  try {
    status.textContent = 'Loading model — first download may take a few minutes…';
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
    originalPeople = people.map(p=>({x: Math.max(0,Math.min(canvas.width,p.bbox[0]+p.bbox[2]/2)), y: Math.max(0,Math.min(canvas.height,p.bbox[1]+p.bbox[3]/4)), manual:false}));
    reviewPeople = originalPeople.map(p=>({...p})); reviewReady = true;
    renderPhotoReview();
    count.textContent = `${people.length} detected`;
    time.textContent = `${Math.round(performance.now() - started)} ms`;
    status.textContent = people.length ? 'Complete — visible detections only' : 'No people detected — people may still be missed';
    if (predictions.length >= 200) status.textContent += '; detection limit reached';
    document.getElementById('vision-density').textContent = 'Crowd density unavailable: camera calibration and count validation are required.';
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
