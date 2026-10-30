export function hourlyRain(data) {
  const rain = data.rain;
  const value = rain?.['1h'] ?? (rain?.['3h'] != null ? rain['3h'] / 3 : 0);
  if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Invalid rainfall data');
  return Number(value);
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
