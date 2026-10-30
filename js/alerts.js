import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { validateCoordinates, parseWeather, parseElevation, parseRiverForecast } from './environment-data.js';


onAuthStateChanged(auth, user => { if (!user) window.location.href = 'login.html'; });
let revision = 0;
let controller;
let currentLocation = null;
let riverController;
let riverRevision = 0;
const visible = (id, show) => { document.getElementById(id).hidden = !show; };
const text = (id, value) => { document.getElementById(id).textContent = value; };
const metrics = ['weather-temperature','weather-rain','weather-humidity','weather-wind','weather-pressure','terrain-elevation','terrain-slope'];
function reset() {
  metrics.forEach(id => text(id, 'Unavailable'));
  riverRevision++; riverController?.abort();
  visible('river-result', false);
  text('river-status', 'Choose a location, then load its forecast.');
  document.getElementById('load-river-button').disabled = false;
  visible('environment-results', false);
  visible('environment-empty', true);
  document.getElementById('location-choices').replaceChildren();
  text('weather-source', 'Weather not retrieved');
  text('terrain-source', 'Elevation not retrieved');
  text('location-result', 'Location not selected');
}
async function json(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}
window.loadEnvironment = async (coordinates = null) => {
  const current = ++revision;
  controller?.abort(); controller = new AbortController();
  const activeController = controller;
  const signal = activeController.signal;
  const timeout = setTimeout(() => activeController.abort(), 20000);
  currentLocation = null;
  reset(); text('environment-status', 'Loading provider data…');
  try {
    let lat, lon, name;
    if (coordinates) ({lat, lon, name} = coordinates);
    else {
      const query = document.getElementById('city-input').value.trim();
      if (!query) throw new Error('Enter a city or use your location');
      const geo = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`, signal);
      if (current !== revision) return;
      const places = (geo.results || []).filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
      if (!places.length) throw new Error('No matching place found. Try a nearby town or use your location.');
      text('environment-status', 'Choose your location below');
      const choices = document.getElementById('location-choices');
      places.forEach(place => {
        const name = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = `${name} (${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)})`;
        button.addEventListener('click', () => window.loadEnvironment({lat:place.latitude,lon:place.longitude,name}));
        choices.append(button);
      });
      return;
    }
    validateCoordinates(lat, lon);
    if (current !== revision) return;
    currentLocation = {lat,lon,name};
    visible('environment-results', true); visible('environment-empty', false);
    text('location-result', name || 'Selected location');
    text('location-coordinates', `Latitude ${lat.toFixed(4)} · Longitude ${lon.toFixed(4)}`);
    text('river-status', 'Ready — load the forecast for this location.');
    const offset = 0.005;
    const requests = await Promise.allSettled([
      json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,surface_pressure&timezone=UTC`, signal).then(parseWeather),
      json(`https://api.open-meteo.com/v1/elevation?latitude=${[lat,lat+offset,lat-offset,lat,lat].join(',')}&longitude=${[lon,lon,lon,lon+offset,lon-offset].join(',')}`, signal).then(data => parseElevation(data, lat, lon))
    ]);
    if (current !== revision) return;
    const [weather, terrain] = requests;
    const display = (id, value, unit) => text(id, value === null ? 'Unavailable' : `${value.toFixed(1)} ${unit}`);
    if (weather.status === 'fulfilled') {
      const w = weather.value;
      display('weather-temperature', w.temperature, '°C'); display('weather-humidity', w.humidity, '%');
      display('weather-wind', w.wind, 'km/h'); display('weather-pressure', w.pressure, 'hPa');
      display('weather-rain', w.precipitation, w.interval ? `mm / ${w.interval/60} min` : 'mm (interval unavailable)');
      const date = new Date(w.time.endsWith('Z') ? w.time : w.time+'Z');
      const formatted = Number.isNaN(date.getTime()) ? w.time+' UTC' : new Intl.DateTimeFormat(undefined, {dateStyle:'medium',timeStyle:'short'}).format(date);
      text('weather-source', `Weather model time: ${formatted} (your device time zone). Source timestamp: ${w.time} UTC.`);
    } else text('weather-source', 'Weather unavailable. No substitute values were used.');
    if (terrain.status === 'fulfilled') {
      display('terrain-elevation', terrain.value.elevation, 'm'); display('terrain-slope', terrain.value.slope, '°');
      text('terrain-source', 'Open-Meteo elevation grid: central difference across ±0.005°. Coarse surrounding terrain, not a measured road-cut slope.');
    } else text('terrain-source', 'Terrain data unavailable. No substitute values were used.');
    text('environment-status', requests.every(r => r.status === 'fulfilled') ? 'Provider data retrieved' : 'Some provider data unavailable');
  } catch (error) {
    if (current === revision) text('environment-status', signal.aborted ? 'Request timed out. Retry when connected.' : error.message);
  } finally { clearTimeout(timeout); }
};
window.useEnvironmentGPS = () => {
  ++revision; controller?.abort(); currentLocation = null; reset();
  const request = revision;
  text('environment-status', 'Waiting for location permission…');
  if (!navigator.geolocation) { text('environment-status', 'Device location unavailable'); return; }
  navigator.geolocation.getCurrentPosition(position => {
    if (request !== revision) return;
    window.loadEnvironment({lat:position.coords.latitude,lon:position.coords.longitude,name:'Device location'});
  }, () => { if (request === revision) text('environment-status','Location unavailable or permission denied. Search a city instead.'); }, {timeout:10000});
};
window.refreshEnvironment = () => { if (currentLocation) window.loadEnvironment({...currentLocation}); };
window.loadRiverForecast = async () => {
  if (!currentLocation) { text('river-status','Choose a location first.'); return; }
  const location = {...currentLocation};
  const locationRevision = revision;
  const request = ++riverRevision;
  riverController?.abort();
  const active = new AbortController(); riverController = active;
  const button = document.getElementById('load-river-button'); button.disabled = true;
  visible('river-result',false); text('river-status','Loading seven-day river forecast…');
  const timeout = setTimeout(()=>active.abort(),20000);
  try {
    const data = await json(`https://flood-api.open-meteo.com/v1/flood?latitude=${location.lat}&longitude=${location.lon}&daily=river_discharge&forecast_days=7&timezone=GMT`,active.signal);
    const forecast = parseRiverForecast(data);
    if (request !== riverRevision || locationRevision !== revision) return;
    const rows = document.getElementById('river-rows'); rows.replaceChildren();
    const known = forecast.rows.filter(row => row.flow !== null);
    const peak = known.reduce((a,b)=>b.flow>a.flow?b:a);
    const number = value => new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
    const dateLabel = date => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
    forecast.rows.forEach(row => {
      const tr = document.createElement('tr');
      const day = document.createElement('td'); day.textContent = dateLabel(row.date);
      const flow = document.createElement('td'); flow.textContent = row.flow === null ? 'Unavailable' : number(row.flow);
      const chart = document.createElement('td'); chart.setAttribute('aria-hidden','true');
      if (row.flow !== null) { const bar = document.createElement('span'); bar.className='flow-bar'; bar.style.width=`${peak.flow ? row.flow/peak.flow*100 : 0}%`; chart.append(bar); }
      tr.append(day,flow,chart); rows.append(tr);
    });
    text('river-summary',`Highest available forecast flow: ${number(peak.flow)} m³/s on ${dateLabel(peak.date)}. This is not a flood severity classification.`);
    text('river-source',`Source: Copernicus GloFAS via Open-Meteo (provider default model). Returned grid centre: ${forecast.lat.toFixed(4)}, ${forecast.lon.toFixed(4)}. Retrieved ${new Date().toLocaleString()}. Forecast issue time is not supplied by this endpoint.`);
    document.getElementById('river-map-link').href=`https://www.openstreetmap.org/?mlat=${forecast.lat}&mlon=${forecast.lon}#map=12/${forecast.lat}/${forecast.lon}`;
    text('river-status',known.length===forecast.rows.length && forecast.rows.length===7 ? 'Seven-day forecast loaded' : 'Partial forecast — some days are unavailable');
    visible('river-result',true);
  } catch (error) {
    if (request === riverRevision && locationRevision === revision) text('river-status',active.signal.aborted ? 'Forecast request timed out. Please retry.' : 'River forecast unavailable for this location or connection. No estimate has been substituted.');
  } finally { clearTimeout(timeout); if(request === riverRevision) button.disabled=false; }
};
reset();
