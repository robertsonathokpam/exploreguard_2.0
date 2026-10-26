import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { computeDisasterRisk, TERRAIN_PROFILES } from './risk-engine.js';

// Initialize Lucide Icons
lucide.createIcons();

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'login.html';
});

// Priority Key Resolution: Local Storage -> window.CONFIG -> null
function getWeatherApiKey() {
  const storedKey = localStorage.getItem('openweather_api_key');
  if (storedKey && storedKey.trim() !== '') {
    return storedKey.trim();
  }
  
  const configKey = window.CONFIG?.OPENWEATHER_API_KEY;
  if (configKey && configKey.trim() !== '' && configKey !== 'YOUR_OPENWEATHER_API_KEY_HERE') {
    return configKey.trim();
  }
  
  return null;
}

// Current active telemetry state
let currentTelemetry = {
  rainfall: 14.5,
  humidity: 82,
  windSpeed: 24,
  pressure: 1008,
  source: 'live'
};

// Sleek interactive UI prompt if key is missing
function renderApiKeyPrompt(targetCity = 'Imphal') {
  const result = document.getElementById('weather-result');
  result.innerHTML = `
    <div class="weather-card api-setup-card" style="border-color: rgba(29, 158, 117, 0.25); text-align: center; max-width: 500px; margin: 1.5rem auto; animation: scaleUp 0.4s ease;">
      <div style="margin-bottom: 1.5rem;">
        <div style="background: var(--primary-light); color: var(--primary); width: 64px; height: 64px; border-radius: 50px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; box-shadow: 0 8px 16px rgba(29, 158, 117, 0.1);">
          <i data-lucide="key" style="width: 32px; height: 32px; stroke-width: 2.2px;"></i>
        </div>
        <h3 style="font-size: 21px; font-weight: 800; color: var(--dark); margin-bottom: 0.5rem; letter-spacing: -0.5px;">API Key Integration</h3>
        <p style="color: var(--dark-muted); font-size: 14.5px; line-height: 1.6;">To fetch real-time climate and warning advisories, a valid **OpenWeather API key** is required. The key is stored locally on your device and is never shared.</p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; align-items: stretch; margin-bottom: 1.5rem;">
        <div style="position: relative; display: flex; align-items: center;">
          <input type="password" id="api-key-input" placeholder="Enter OpenWeather API Key..." style="width: 100%; padding: 14px 14px 14px 44px; border: 1.5px solid rgba(15, 23, 42, 0.1); border-radius: 12px; font-size: 14px; outline: none; background: rgba(255, 255, 255, 0.95); font-family: var(--font); box-shadow: var(--shadow-sm); transition: all 0.2s;" />
          <i data-lucide="shield-check" style="position: absolute; left: 16px; color: var(--dark-muted); width: 18px; height: 18px;"></i>
        </div>
        <button id="save-key-btn" style="padding: 14px 20px; background: var(--primary); color: var(--white); border: none; border-radius: 12px; font-size: 14.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(29, 158, 117, 0.15); transition: all 0.2s;">
          Activate Alerts <i data-lucide="play" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
      
      <div style="font-size: 13px; color: var(--dark-muted);">
        Don't have a key? Acquire one for free at <a href="https://openweathermap.org/price" target="_blank" style="color: var(--primary); font-weight: 700; text-decoration: underline;">openweathermap.org</a>
      </div>
    </div>`;
  lucide.createIcons();

  const inputEl = document.getElementById('api-key-input');
  const btnEl = document.getElementById('save-key-btn');
  
  const handleSave = () => {
    const key = inputEl.value.trim();
    if (key) {
      localStorage.setItem('openweather_api_key', key);
      window.fetchWeather(targetCity);
    } else {
      inputEl.style.borderColor = 'var(--danger)';
      inputEl.focus();
    }
  };

  btnEl.addEventListener('click', handleSave);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
  });
}

// Reset functions
window.clearSavedApiKey = (currentCity = 'Imphal') => {
  localStorage.removeItem('openweather_api_key');
  window.fetchWeather(currentCity);
};

window.searchCity = () => {
  const city = document.getElementById('city-input').value.trim();
  if (city) fetchWeather(city);
};

// UI Updater for the AI Risk Engine
export function updateRiskEngineUI() {
  const corridorKey = document.getElementById('corridor-select')?.value || 'nh-37';
  const riskResult = computeDisasterRisk(currentTelemetry, corridorKey);

  // Update Badge
  const badgeContainer = document.getElementById('overall-risk-badge-container');
  if (badgeContainer) {
    let icon = 'shield-check';
    let badgeStyle = 'badge-success';
    if (riskResult.riskLevel === 'Critical') {
      icon = 'alert-triangle';
      badgeStyle = 'badge-error animate-pulse';
    } else if (riskResult.riskLevel === 'Moderate') {
      icon = 'alert-circle';
      badgeStyle = 'badge-warning';
    }
    badgeContainer.innerHTML = `
      <span class="badge ${badgeStyle} text-white font-extrabold p-3 text-sm flex items-center gap-1.5 shadow-sm">
        <i data-lucide="${icon}" style="width:15px; height:15px;"></i> ${riskResult.riskLevel.toUpperCase()} DISASTER RISK (${riskResult.compositeScore}%)
      </span>
    `;
  }

  // Update Numerical Outputs
  const lpVal = document.getElementById('landslide-prob-val');
  if (lpVal) lpVal.textContent = `${riskResult.landslideProbability}%`;

  const fpVal = document.getElementById('flood-prob-val');
  if (fpVal) fpVal.textContent = `${riskResult.floodProbability}%`;

  const csVal = document.getElementById('composite-score-val');
  if (csVal) {
    csVal.textContent = `${riskResult.compositeScore}%`;
    csVal.style.color = riskResult.color;
  }

  // Update Progress Bars
  const lpProg = document.getElementById('landslide-progress');
  if (lpProg) {
    lpProg.value = riskResult.landslideProbability;
    lpProg.className = `progress ${riskResult.landslideProbability >= 70 ? 'progress-error' : riskResult.landslideProbability >= 40 ? 'progress-warning' : 'progress-success'} w-full mt-2`;
  }

  const fpProg = document.getElementById('flood-progress');
  if (fpProg) {
    fpProg.value = riskResult.floodProbability;
    fpProg.className = `progress ${riskResult.floodProbability >= 70 ? 'progress-error' : riskResult.floodProbability >= 40 ? 'progress-info' : 'progress-success'} w-full mt-2`;
  }

  const csProg = document.getElementById('composite-progress');
  if (csProg) {
    csProg.value = riskResult.compositeScore;
    csProg.className = `progress ${riskResult.compositeScore >= 70 ? 'progress-error' : riskResult.compositeScore >= 40 ? 'progress-warning' : 'progress-success'} w-full mt-2`;
  }

  // Update Tier Badge
  const rtBadge = document.getElementById('risk-tier-badge');
  if (rtBadge) {
    rtBadge.className = `badge ${riskResult.badgeClass} text-white text-xs font-bold`;
    rtBadge.textContent = riskResult.riskLevel.toUpperCase();
  }

  // Update Specific Metrics
  const slopeVal = document.getElementById('slope-factor-val');
  if (slopeVal) slopeVal.textContent = `${riskResult.metrics.slopeCoefficient}%`;

  const soilVal = document.getElementById('soil-fragility-val');
  if (soilVal) soilVal.textContent = `${riskResult.metrics.soilFragilityIndex}%`;

  const fpIndex = document.getElementById('floodplain-index-val');
  if (fpIndex) fpIndex.textContent = `${riskResult.metrics.floodPlainIndex}%`;

  const baroVal = document.getElementById('baro-pressure-val');
  if (baroVal) baroVal.textContent = `${riskResult.metrics.pressureHpa} hPa`;

  const windVal = document.getElementById('wind-speed-val');
  if (windVal) windVal.textContent = `${riskResult.metrics.windSpeedKmh} km/h`;

  // Update Evacuation Box
  const evacBox = document.getElementById('evacuation-action-box');
  const evacText = document.getElementById('evac-action-text');
  const evacIcon = document.getElementById('evac-icon');
  if (evacBox && evacText) {
    if (riskResult.riskLevel === 'Critical') {
      evacBox.className = 'alert-box alert-danger';
      if (evacIcon) evacIcon.setAttribute('data-lucide', 'alert-triangle');
    } else if (riskResult.riskLevel === 'Moderate') {
      evacBox.className = 'alert-box alert-warn';
      if (evacIcon) evacIcon.setAttribute('data-lucide', 'alert-circle');
    } else {
      evacBox.className = 'alert-box alert-safe';
      if (evacIcon) evacIcon.setAttribute('data-lucide', 'check-circle');
    }
    evacText.textContent = riskResult.evacuationAction;
  }

  // Update Shelters and High-Risk Sectors
  const safeShelter = document.getElementById('safe-shelter-name');
  if (safeShelter && riskResult.safeShelters) {
    safeShelter.textContent = riskResult.safeShelters.join(' | ');
  }

  const highRisk = document.getElementById('high-risk-sector-name');
  if (highRisk && riskResult.highRiskZones) {
    highRisk.textContent = riskResult.highRiskZones.join(' & ');
  }

  lucide.createIcons();
}

window.recomputeRiskEngine = () => {
  updateRiskEngineUI();
};

window.onRainfallSliderChange = (val) => {
  currentTelemetry.rainfall = Number(val);
  const display = document.getElementById('rainfall-rate-display');
  if (display) display.textContent = `${val} mm/h`;
  const tag = document.getElementById('active-scenario-tag');
  if (tag) tag.textContent = 'Custom Simulation';
  updateRiskEngineUI();
};

window.setSimulationScenario = (scenario) => {
  const slider = document.getElementById('rainfall-slider');
  const display = document.getElementById('rainfall-rate-display');
  const tag = document.getElementById('active-scenario-tag');

  // Clear active button styling
  ['live', 'cloudburst', 'depression', 'clear'].forEach(s => {
    const btn = document.getElementById(`mode-btn-${s}`);
    if (btn) btn.classList.remove('btn-active');
  });
  const activeBtn = document.getElementById(`mode-btn-${scenario}`);
  if (activeBtn) activeBtn.classList.add('btn-active');

  if (scenario === 'cloudburst') {
    currentTelemetry = { rainfall: 68.5, humidity: 96, windSpeed: 48, pressure: 998, source: 'cloudburst' };
    if (tag) tag.textContent = 'Scenario: Cloudburst Surge';
  } else if (scenario === 'depression') {
    currentTelemetry = { rainfall: 42, humidity: 89, windSpeed: 54, pressure: 1002, source: 'depression' };
    if (tag) tag.textContent = 'Scenario: Deep Depression';
  } else if (scenario === 'clear') {
    currentTelemetry = { rainfall: 0, humidity: 50, windSpeed: 10, pressure: 1014, source: 'clear' };
    if (tag) tag.textContent = 'Scenario: Clear Transit';
  } else {
    // live
    currentTelemetry.source = 'live';
    if (tag) tag.textContent = 'Live OpenWeather Sync';
  }

  if (slider) slider.value = currentTelemetry.rainfall;
  if (display) display.textContent = `${currentTelemetry.rainfall} mm/h`;

  updateRiskEngineUI();
};

window.fetchWeather = async (city) => {
  const result = document.getElementById('weather-result');
  result.innerHTML = `
    <div class="loading">
      <i data-lucide="loader" class="animate-spin" style="width:24px; height:24px; color:var(--primary);"></i>
      <span>Contacting meteorology satellites...</span>
    </div>`;
  lucide.createIcons();
  
  const API_KEY = getWeatherApiKey();
  if (!API_KEY) {
    renderApiKeyPrompt(city);
    // Still compute baseline risk with regional telemetry fallback
    updateRiskEngineUI();
    return;
  }
  
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},IN&appid=${API_KEY}&units=metric`);
    
    if (res.status === 401) {
      localStorage.removeItem('openweather_api_key');
      result.innerHTML = `
        <div class="weather-card" style="border-color: rgba(231, 76, 60, 0.3); text-align: center; animation: scaleUp 0.4s ease;">
          <div class="alert-box alert-danger" style="margin-top: 0; text-align: left;">
            <i data-lucide="shield-alert" style="width:24px; height:24px; flex-shrink:0;"></i>
            <span><strong>Authentication Failed:</strong> The OpenWeather API Key you entered appears to be invalid or deactivated.</span>
          </div>
          <div style="margin-top: 1.5rem;">
            <button onclick="window.fetchWeather('${city}')" style="padding: 12px 20px; background: var(--primary); color: var(--white); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-family: var(--font); display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(29, 158, 117, 0.15);">
              Re-enter API Key <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>`;
      lucide.createIcons();
      updateRiskEngineUI();
      return;
    }
    
    if (!res.ok) throw new Error('City not found');
    const data = await res.json();

    const temp = Math.round(data.main.temp);
    const humidity = data.main.humidity;
    const wind = Math.round(data.wind.speed * 3.6); // m/s to km/h
    const condition = data.weather[0].description;
    const visibility = data.visibility ? Math.round(data.visibility / 1000) : 'N/A';
    const pressure = data.main.pressure || 1013;
    const rainMm = data.rain ? (data.rain['1h'] || data.rain['3h'] || 0) : 0;

    // Feed live OpenWeather telemetry into Risk Engine if in live mode
    if (currentTelemetry.source === 'live') {
      currentTelemetry.rainfall = rainMm;
      currentTelemetry.humidity = humidity;
      currentTelemetry.windSpeed = wind;
      currentTelemetry.pressure = pressure;

      const slider = document.getElementById('rainfall-slider');
      const display = document.getElementById('rainfall-rate-display');
      if (slider) slider.value = rainMm;
      if (display) display.textContent = `${rainMm} mm/h`;
    }

    // Safety alert logic based on weather conditions
    let alertClass = 'alert-safe';
    let alertMsg = 'Weather looks optimal for sightseeing and transit operations.';
    let alertIcon = 'check-circle';
    
    if (data.weather[0].main === 'Thunderstorm') {
      alertClass = 'alert-danger';
      alertMsg = 'Severe Thunderstorm warnings active! Severe lightning threat, seek indoors immediately.';
      alertIcon = 'alert-circle';
    } else if (data.weather[0].main === 'Rain' && rainMm > 10) {
      alertClass = 'alert-warn';
      alertMsg = 'Heavy monsoon precipitation. High risk of torrential mudslides in montane paths. Drive cautiously.';
      alertIcon = 'alert-triangle';
    } else if (wind > 50) {
      alertClass = 'alert-warn';
      alertMsg = 'Substantial wind velocities. Exercise high caution on open road bypasses and valleys.';
      alertIcon = 'alert-triangle';
    } else if (data.weather[0].main === 'Fog' || visibility < 1) {
      alertClass = 'alert-warn';
      alertMsg = 'Impaired road visibility due to dense fog banks. Maximize headlight utilization.';
      alertIcon = 'alert-triangle';
    }

    result.innerHTML = `
      <div class="weather-card" style="animation: scaleUp 0.4s ease;">
        <div class="weather-top">
          <div class="city-details">
            <div class="city-name"><i data-lucide="map-pin"></i> ${data.name}, ${data.sys.country}</div>
            <div class="condition"><i data-lucide="cloud"></i> ${condition}</div>
          </div>
          <div class="temp">${temp}°C</div>
        </div>
        <div class="weather-details">
          <div class="detail-item">
            <i data-lucide="droplets"></i>
            <div class="detail-val">${humidity}%</div>
            <div class="detail-key">Humidity</div>
          </div>
          <div class="detail-item">
            <i data-lucide="wind"></i>
            <div class="detail-val">${wind} km/h</div>
            <div class="detail-key">Wind Speed</div>
          </div>
          <div class="detail-item">
            <i data-lucide="gauge"></i>
            <div class="detail-val">${pressure} hPa</div>
            <div class="detail-key">Pressure</div>
          </div>
          <div class="detail-item">
            <i data-lucide="cloud-rain"></i>
            <div class="detail-val">${rainMm} mm/h</div>
            <div class="detail-key">Rainfall</div>
          </div>
        </div>
        <div class="alert-box ${alertClass}">
          <i data-lucide="${alertIcon}" style="width:22px; height:22px; flex-shrink:0;"></i>
          <span><strong>Meteorological Advisory:</strong> ${alertMsg}</span>
        </div>
        
        <div class="weather-meta-actions" style="margin-top: 1.75rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(15, 23, 42, 0.06); padding-top: 14px; font-size: 12.5px; color: var(--dark-muted); font-weight: 500;">
          <span style="display: flex; align-items: center; gap: 4px;"><i data-lucide="activity" style="width: 13px; height: 13px; color: var(--primary);"></i> Telemetry Feed Synchronized</span>
          <button onclick="window.clearSavedApiKey('${data.name}')" style="background: none; border: none; color: var(--danger); font-weight: 700; cursor: pointer; font-family: var(--font); display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.2s ease;">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Reset Key
          </button>
        </div>
      </div>`;
    lucide.createIcons();
    updateRiskEngineUI();
  } catch (e) {
    result.innerHTML = `
      <div class="weather-card" style="border-color: rgba(231, 76, 60, 0.2); animation: scaleUp 0.4s ease;">
        <div class="alert-box alert-danger">
          <i data-lucide="alert-circle" style="width:22px; flex-shrink:0;"></i>
          <span><strong>Satellite Outage:</strong> City could not be queried or network timeout. Falling back to regional terrain model.</span>
        </div>
      </div>`;
    lucide.createIcons();
    updateRiskEngineUI();
  }
};

// Initial load
fetchWeather('Imphal');
updateRiskEngineUI();
