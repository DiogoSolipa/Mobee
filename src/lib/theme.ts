/** Day/Night: Mobee switches at local sunset and back at sunrise unless the person locks a theme. */

const LISBON = { lat: 38.7223, lon: -9.1393 };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sunrise and sunset as epoch ms for the UTC day containing `at` (NOAA approximation, ±2 min). */
export function sunTimes(at: number, lat = LISBON.lat, lon = LISBON.lon): { sunrise: number; sunset: number } {
  const d = new Date(at);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const n = Math.floor((dayStart - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const gamma = ((2 * Math.PI) / 365) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const ha = deg(Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl)));
  const sunriseMin = 720 - 4 * (lon + ha) - eqTime;
  const sunsetMin = 720 - 4 * (lon - ha) - eqTime;
  return { sunrise: dayStart + sunriseMin * 60000, sunset: dayStart + sunsetMin * 60000 };
}

export function autoTheme(at: number = Date.now()): 'day' | 'night' {
  const { sunrise, sunset } = sunTimes(at);
  return at >= sunrise && at < sunset ? 'day' : 'night';
}
