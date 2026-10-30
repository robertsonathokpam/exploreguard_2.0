import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { validateCoordinates, parseWeather, parseElevation } from './environment-data.js';

lucide.createIcons();
onAuthStateChanged(auth, user => { if (!user) window.location.href = 'login.html'; });
let revision = 0;
let controller;
const text = (id, value) => { document.getElementById(id).textContent = value; };
const metrics = ['weather-temperature','weather-rain','weather-humidity','weather-wind','weather-pressure','terrain-elevation','terrain-slope'];
function reset() {
  metrics.forEach(id => text(id, 'Unavailable'));
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
  reset(); text('environment-status', 'Loading provider data…');
  try {
    let lat, lon, name;
    if (coordinates) ({lat, lon, name} = coordinates);
    else {
      const query = document.getElementById('city-input').value.trim();
      if (!query) throw new Error('Enter a city or use your location');
      const geo = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`, signal);
      const place = geo.results?.[0];
      if (!place) throw new Error('Location not found');
      lat = place.latitude; lon = place.longitude;
      name = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
    }
    validateCoordinates(lat, lon);
    if (current !== revision) return;
    text('location-result', `${name || 'Selected location'} (${lat.toFixed(4)}, ${lon.toFixed(4)}) — check this matches your intended location`);
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
      text('weather-source', `Open-Meteo modelled conditions: ${w.time} UTC. These are weather model values, not an on-site sensor reading.`);
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
  ++revision; controller?.abort(); reset();
  const request = revision;
  text('environment-status', 'Waiting for location permission…');
  if (!navigator.geolocation) { text('environment-status', 'Device location unavailable'); return; }
  navigator.geolocation.getCurrentPosition(position => {
    if (request !== revision) return;
    window.loadEnvironment({lat:position.coords.latitude,lon:position.coords.longitude,name:'Device location'});
  }, () => { if (request === revision) text('environment-status','Location unavailable or permission denied. Search a city instead.'); }, {timeout:10000});
};
reset();
