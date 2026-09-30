const $ = id => document.getElementById(id);

const RECENT_KEY = 'meghdut_recent_cities';
const UNIT_KEY = 'meghdut_unit';

let currentUnit = localStorage.getItem(UNIT_KEY) || 'C';
let isFetching = false;
let lastData = null;
let lastForecast = null;

const weatherIconPaths = {
  Thunderstorm: `
    <path d="M7 13a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5 4 4 0 0 1 16.5 13H7z"/>
    <polyline points="12 14 9.5 18 12.5 18 10.5 22"/>
  `,
  Drizzle: `
    <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 5.5 4 4 0 0 1 16.5 14H7z"/>
    <line x1="8" y1="17" x2="8" y2="18.5"/>
    <line x1="12" y1="17" x2="12" y2="18.5"/>
    <line x1="16" y1="17" x2="16" y2="18.5"/>
  `,
  Rain: `
    <path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6.5 4 4 0 0 1 16.5 15H7z"/>
    <line x1="8" y1="18" x2="7" y2="21"/>
    <line x1="12" y1="18" x2="11" y2="21"/>
    <line x1="16" y1="18" x2="15" y2="21"/>
  `,
  Snow: `
    <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 5.5 4 4 0 0 1 16.5 14H7z"/>
    <line x1="8" y1="18" x2="8" y2="18" stroke-width="2.6"/>
    <line x1="12" y1="19" x2="12" y2="19" stroke-width="2.6"/>
    <line x1="16" y1="18" x2="16" y2="18" stroke-width="2.6"/>
    <line x1="9" y1="21" x2="9" y2="21" stroke-width="2.6"/>
    <line x1="15" y1="21" x2="15" y2="21" stroke-width="2.6"/>
  `,
  Fog: `
    <line x1="3" y1="8" x2="21" y2="8"/>
    <line x1="3" y1="12" x2="18" y2="12"/>
    <line x1="6" y1="16" x2="21" y2="16"/>
  `,
  Tornado: `
    <path d="M3 6h18"/>
    <path d="M5 10h14"/>
    <path d="M7 14h10"/>
    <path d="M9 18h6"/>
    <path d="M11 22h2"/>
  `,
  Clear: `
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="4" y2="12"/>
    <line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/>
    <line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/>
    <line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/>
    <line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>
  `,
  Clouds: `
    <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5 4 4 0 0 1 16.5 18H7z"/>
  `,
};

const iconAliasMap = {
  Mist: 'Fog',
  Smoke: 'Fog',
  Haze: 'Fog',
  Dust: 'Fog',
  Sand: 'Fog',
  Ash: 'Fog',
  Squall: 'Fog',
};

function weatherIconSVG(main, { size = 48, strokeWidth = 1.6 } = {}) {
  const key = iconAliasMap[main] || main;
  const inner = weatherIconPaths[key] || weatherIconPaths.Clear;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const weatherThemes = {
  Clear: { orb1: '#3a2f12', orb2: '#4a3418' },
  Clouds: { orb1: '#0d2557', orb2: '#091840' },
  Rain: { orb1: '#082438', orb2: '#061a2c' },
  Drizzle: { orb1: '#082438', orb2: '#061a2c' },
  Thunderstorm: { orb1: '#141026', orb2: '#0d0a1c' },
  Snow: { orb1: '#152a42', orb2: '#101f34' },
  Fog: { orb1: '#1a1f2b', orb2: '#12161f' },
  Tornado: { orb1: '#3a1810', orb2: '#2a1008' },
};

function applyWeatherTheme(main) {
  const theme =
    weatherThemes[iconAliasMap[main] ? 'Fog' : main] || weatherThemes.Clouds;
  document.documentElement.style.setProperty('--orb1-color', theme.orb1);
  document.documentElement.style.setProperty('--orb2-color', theme.orb2);
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDate(unix, offset) {
  const d = new Date((unix + offset) * 1000);
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function showError(msg) {
  const el = $('errorMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  $('errorMsg').classList.add('hidden');
}

function setLoading(on) {
  $('loadingState').classList.toggle('hidden', !on);
  $('emptyState').classList.add('hidden');
  $('weatherCard').classList.add('hidden');
}

/* Recent searches */

function getRecentCities() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentCity(city) {
  let list = getRecentCities().filter(
    c => c.toLowerCase() !== city.toLowerCase(),
  );
  list.unshift(city);
  list = list.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  renderRecentChips();
}

function renderRecentChips() {
  const list = getRecentCities();
  const el = $('recentChips');
  el.innerHTML = '';
  if (!list.length) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  list.forEach(city => {
    const btn = document.createElement('button');
    btn.className = 'recent-chip';
    btn.type = 'button';
    btn.textContent = city;
    btn.addEventListener('click', () => {
      $('cityInput').value = city;
      fetchWeather();
    });
    el.appendChild(btn);
  });
}

/* Unit toggle */

function setUnit(unit) {
  currentUnit = unit;
  localStorage.setItem(UNIT_KEY, unit);
  $('unitC').classList.toggle('active', unit === 'C');
  $('unitF').classList.toggle('active', unit === 'F');
  if (lastData && lastForecast) {
    renderWeather(lastData, lastForecast);
  }
}

function convertTemp(celsius, fahrenheit) {
  return currentUnit === 'C' ? Math.round(celsius) : Math.round(fahrenheit);
}

/* Fetch */

async function fetchWeatherByQuery(queryParams) {
  if (isFetching) return;

  isFetching = true;
  hideError();
  setLoading(true);

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`/api/weather?${queryParams}&type=current`),
      fetch(`/api/weather?${queryParams}&type=forecast`),
    ]);

    if (!currentRes.ok) {
      const err = await currentRes.json();
      throw new Error(err.error || 'City not found');
    }
    if (!forecastRes.ok) {
      const err = await forecastRes.json();
      throw new Error(err.error || 'Forecast unavailable');
    }

    const data = await currentRes.json();
    const forecast = await forecastRes.json();

    lastData = data;
    lastForecast = forecast;

    saveRecentCity(data.location.name);
    renderWeather(data, forecast);
  } catch (err) {
    setLoading(false);
    $('emptyState').classList.remove('hidden');
    showError(
      err.message === 'Failed to fetch'
        ? 'Network error. Please check your connection.'
        : `${err.message}`,
    );
  } finally {
    isFetching = false;
  }
}

async function fetchWeather() {
  const city = $('cityInput').value.trim();
  if (!city) return;
  await fetchWeatherByQuery(`city=${encodeURIComponent(city)}`);
}

function tryGeolocation() {
  if (!('geolocation' in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      fetchWeatherByQuery(`lat=${latitude}&lon=${longitude}`);
    },
    () => {
      // Permission denied or unavailable, stay on empty state
    },
    { timeout: 8000 },
  );
}

function mapCondition(text) {
  text = text.toLowerCase();
  if (text.includes('thunder')) return 'Thunderstorm';
  if (text.includes('drizzle') || text.includes('freezing')) return 'Drizzle';
  if (text.includes('rain') || text.includes('shower')) return 'Rain';
  if (
    text.includes('snow') ||
    text.includes('blizzard') ||
    text.includes('sleet')
  )
    return 'Snow';
  if (text.includes('fog')) return 'Fog';
  if (text.includes('mist')) return 'Mist';
  if (text.includes('haze')) return 'Haze';
  if (text.includes('dust') || text.includes('sand')) return 'Dust';
  if (text.includes('tornado')) return 'Tornado';
  if (text.includes('overcast') || text.includes('cloud')) return 'Clouds';
  if (text.includes('sunny') || text.includes('clear')) return 'Clear';
  return 'Clear';
}

/* Sun path */

function parseTimeToMinutes(timeStr) {
  const [time, period] = timeStr.trim().split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period) {
    const p = period.toUpperCase();
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
  }
  return h * 60 + m;
}

function getLocalMinutesFromEpoch(epoch) {
  const d = new Date(epoch * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function renderSunPath(astro, localtimeEpoch) {
  const sunriseMin = parseTimeToMinutes(astro.sunrise);
  const sunsetMin = parseTimeToMinutes(astro.sunset);
  const nowMin = getLocalMinutesFromEpoch(localtimeEpoch);

  let t;
  let isDaytime;
  if (nowMin <= sunriseMin) {
    t = 0;
    isDaytime = false;
  } else if (nowMin >= sunsetMin) {
    t = 1;
    isDaytime = false;
  } else {
    t = (nowMin - sunriseMin) / (sunsetMin - sunriseMin);
    isDaytime = true;
  }

  const cx = 100;
  const cy = 82;
  const rx = 88;
  const ry = 62;
  const theta = Math.PI * (1 - t);
  const dotX = (cx + rx * Math.cos(theta)).toFixed(1);
  const dotY = (cy - ry * Math.sin(theta)).toFixed(1);

  const dotColor = isDaytime ? '#c9a96e' : 'rgba(255,255,255,0.3)';
  const dotRadius = isDaytime ? 6 : 4;

  $('sunPath').innerHTML = `
    <svg class="sun-path-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M 12 ${cy} A ${rx} ${ry} 0 0 1 188 ${cy}"
        fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <circle cx="${dotX}" cy="${dotY}" r="${dotRadius}" fill="${dotColor}" />
    </svg>
  `;

  let caption;
  if (!isDaytime && t === 0) {
    caption = 'Before sunrise';
  } else if (!isDaytime && t === 1) {
    caption = 'After sunset';
  } else {
    caption = `${Math.round(t * 100)}% through daylight`;
  }
  $('sunPathCaption').textContent = caption;
}

function renderWeather(data, forecast) {
  const current = data.current;
  const location = data.location;
  const conditionText = current.condition.text;
  const main = mapCondition(conditionText);

  applyWeatherTheme(main);

  $('cityName').textContent = location.name;
  $('countryDate').textContent =
    `${location.country} · ${formatDate(location.localtime_epoch, 0)}`;
  $('weatherDesc').textContent = conditionText;

  const temp = convertTemp(current.temp_c, current.temp_f);
  const feels = convertTemp(current.feelslike_c, current.feelslike_f);
  $('tempDisplay').innerHTML = `${temp}<span class="deg">°</span>`;
  $('feelsLike').textContent = `Feels like ${feels}°${currentUnit}`;

  $('weatherIcon').innerHTML = weatherIconSVG(main, { size: 72 });
  $('humidity').textContent = `${current.humidity}%`;
  $('windSpeed').textContent = `${Math.round(current.wind_kph)} km/h`;
  $('visibility').textContent = `${current.vis_km} km`;
  $('pressure').textContent = `${current.pressure_mb} hPa`;

  const astro = forecast.forecast.forecastday[0].astro;
  $('sunrise').textContent = astro.sunrise;
  $('sunset').textContent = astro.sunset;
  renderSunPath(astro, location.localtime_epoch);

  const dailyItems = forecast.forecast.forecastday.slice(0, 5);

  $('forecastContainer').innerHTML = dailyItems
    .map((item, i) => {
      const d = new Date(item.date_epoch * 1000);
      const day = days[d.getUTCDay()];
      const dayMain = mapCondition(item.day.condition.text);
      const isFirst = i === 0;
      const bg = isFirst
        ? 'background:rgba(255,255,255,0.07); border:0.5px solid rgba(255,255,255,0.1);'
        : 'background:rgba(255,255,255,0.03);';
      const dayColor = isFirst
        ? 'rgba(201,169,110,0.9)'
        : 'rgba(255,255,255,0.28)';
      const iconColor = isFirst ? '#c9a96e' : 'rgba(255,255,255,0.55)';
      const avg = convertTemp(item.day.avgtemp_c, item.day.avgtemp_f);
      const min = convertTemp(item.day.mintemp_c, item.day.mintemp_f);
      const max = convertTemp(item.day.maxtemp_c, item.day.maxtemp_f);
      return `
      <div style="${bg} border-radius:16px; padding:14px 4px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:default;">
        <p style="font-size:clamp(9px,1.4vw,11px); font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:${dayColor};">
          ${day}
        </p>
        <span class="forecast-icon" style="color:${iconColor};">${weatherIconSVG(dayMain, { size: 24, strokeWidth: 1.5 })}</span>
        <p style="font-family:'Playfair Display',serif; font-size:clamp(14px,2.5vw,20px); font-weight:500; color:#fff;">
          ${avg}°
        </p>
        <p style="font-size:clamp(9px,1.2vw,11px); color:rgba(255,255,255,0.22); text-align:center; line-height:1.4;">
          ${min}°<br/>${max}°
        </p>
      </div>`;
    })
    .join('');

  setLoading(false);
  $('weatherCard').classList.remove('hidden');
}

$('unitC').classList.toggle('active', currentUnit === 'C');
$('unitF').classList.toggle('active', currentUnit === 'F');
$('unitC').addEventListener('click', () => setUnit('C'));
$('unitF').addEventListener('click', () => setUnit('F'));
renderRecentChips();
tryGeolocation();
