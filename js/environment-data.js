// Provider values only. Missing values remain null, never fallback weather or risk scores.
export function validateCoordinates(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Invalid coordinates');
}
export function parseWeather(data) {
  if (!data?.current?.time) throw new Error('Weather response has no timestamp');
  const read = (key, min, max) => {
    const value = data.current[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  return {
    time: data.current.time, temperature: read('temperature_2m', -100, 70),
    humidity: read('relative_humidity_2m', 0, 100), wind: read('wind_speed_10m', 0, 500),
    pressure: read('surface_pressure', 0, 1200), precipitation: read('precipitation', 0, 1000),
    interval: read('interval', 1, 86400)
  };
}
export function parseElevation(data, lat, lon, offset = 0.005) {
  validateCoordinates(lat, lon);
  const values = data?.elevation;
  if (!Array.isArray(values) || values.length !== 5 || !values.every(v => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('Elevation response is incomplete');
  }
  const [center, north, south, east, west] = values;
  const dy = 2 * offset * 111320;
  const dx = dy * Math.cos(lat * Math.PI / 180);
  if (dx < 1) throw new Error('Terrain gradient unavailable near the poles');
  const gradient = Math.hypot((north-south)/dy, (east-west)/dx);
  return {elevation: center, slope: Math.atan(gradient)*180/Math.PI};
}

export function parseRiverForecast(data, today = new Date().toISOString().slice(0,10)) {
  validateCoordinates(data?.latitude, data?.longitude);
  const dates = data?.daily?.time, values = data?.daily?.river_discharge;
  if (data?.daily_units?.river_discharge !== 'm³/s' || !Array.isArray(dates) || !Array.isArray(values) || dates.length !== values.length || !dates.length) {
    throw new Error('River forecast response is incomplete or has unexpected units');
  }
  const rows = dates.map((date, index) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || (index && date <= dates[index-1])) throw new Error('Invalid forecast dates');
    const value = values[index];
    return {date, flow: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null};
  }).filter(row => row.date >= today).slice(0,7);
  if (!rows.some(row => row.flow !== null)) throw new Error('No current river forecast data available for this grid cell');
  return {lat:data.latitude, lon:data.longitude, rows};
}
