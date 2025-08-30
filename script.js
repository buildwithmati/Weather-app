/* ========= Utilities ========= */
const state = {
  unit: "C", // "C" or "F"
  lastData: null,
  lastMeta: { flag: "🇪🇺", city: "Europe", lat: null, lon: null },
};

const CITY_MAP = {
  paris:  ["48.8566","2.3522","🇫🇷","Paris"],
  london: ["51.5074","-0.1278","🇬🇧","London"],
  rome:   ["41.9028","12.4964","🇮🇹","Rome"],
  madrid: ["40.4168","-3.7038","🇪🇸","Madrid"],
  berlin: ["52.5200","13.4050","🇩🇪","Berlin"],
};

function cToF(c){ return Math.round((c * 9/5) + 32); }
function formatTemp(t){
  if (t == null || isNaN(t)) return "—";
  return state.unit === "C" ? `${t}°C` : `${cToF(t)}°F`;
}

/** Map cloud/precip to emoji and theme */
function getWeatherVisual(cloud, precip){
  // Emoji
  let emoji = "🌫️";
  if (precip === "snow") emoji = "❄️";
  else if (precip === "rain") emoji = "🌧️";
  else if (precip === "ice")  emoji = "🌨️";
  else if (precip === "frzr") emoji = "🌩️";
  else if (cloud <= 2) emoji = "☀️";
  else if (cloud <= 5) emoji = "🌤️";
  else if (cloud <= 8) emoji = "☁️";

  // Theme
  let theme = "default";
  if (precip === "snow") theme = "snowy";
  else if (precip === "rain") theme = "rainy";
  else if (cloud <= 2) theme = "sunny";
  else if (cloud <= 8) theme = "cloudy";
  else theme = "foggy";

  return { emoji, theme };
}

/** Short text description */
function describe(cloud, precip){
  if (precip === "snow") return "Snow";
  if (precip === "rain") return "Rain";
  if (precip === "ice")  return "Sleet";
  if (precip === "frzr") return "Freezing rain";
  if (cloud <= 2) return "Sunny";
  if (cloud <= 5) return "Partly cloudy";
  if (cloud <= 8) return "Cloudy";
  return "Foggy";
}

/* ========= Rendering ========= */
function setTheme(theme){ document.body.setAttribute("data-theme", theme); }

function renderCurrent(ds0, meta){
  const wrap = document.getElementById("currentWeather");
  const { emoji, theme } = getWeatherVisual(ds0.cloudcover, ds0.prec_type);
  const text = describe(ds0.cloudcover, ds0.prec_type);
  setTheme(theme);

  wrap.innerHTML = `
    <div class="current-top">
      <div class="current-left">
        <p class="current-location">${meta.flag} ${meta.city}</p>
        <p class="current-desc">${text}</p>
      </div>
      <div class="current-main">
        <div class="current-emoji" aria-hidden="true">${emoji}</div>
        <p class="current-temp">${formatTemp(ds0.temp2m)}</p>
      </div>
    </div>
    <div class="current-stats">
      <div class="stat">💧 Humidity: ${ds0.rh2m ?? "—"}%</div>
      <div class="stat">🌬️ Wind: ${ds0.wind10m?.speed ?? "—"} m/s ${ds0.wind10m?.direction ?? ""}</div>
      <div class="stat">☁️ Clouds: ${ds0.cloudcover ?? "—"}/9</div>
      <div class="stat">🌧️ Precip: ${ds0.prec_type ?? "—"}</div>
    </div>
  `;
}

function renderHourly(all){
  // 7Timer (civil) is 3-hourly. Show next 8 slices ~ 24h.
  const row = document.getElementById("hourlyForecast");
  row.innerHTML = "";
  const now = new Date();

  all.slice(0, 8).forEach((h, idx) => {
    const t = new Date(now.getTime() + idx * 3 * 60 * 60 * 1000);
    const hh = `${t.getHours().toString().padStart(2,"0")}:00`;
    const { emoji } = getWeatherVisual(h.cloudcover, h.prec_type);

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.setAttribute("role","listitem");
    card.innerHTML = `
      <h3>${hh}</h3>
      <div class="emoji">${emoji}</div>
      <p><strong>${formatTemp(h.temp2m)}</strong></p>
      <p>Clouds: ${h.cloudcover}/9</p>
    `;
    row.appendChild(card);
  });
}

function renderDaily(all, flag){
  const row = document.getElementById("dailyForecast");
  row.innerHTML = "";
  const days = all.filter((_, i) => i % 8 === 0).slice(0, 7);
  const base = new Date();

  days.forEach((d, idx) => {
    const dt = new Date(base);
    dt.setDate(base.getDate() + idx);
    const label = dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    const { emoji } = getWeatherVisual(d.cloudcover, d.prec_type);

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.setAttribute("role","listitem");
    card.innerHTML = `
      <h3>${flag} ${label}</h3>
      <div class="emoji">${emoji}</div>
      <p><strong>${formatTemp(d.temp2m)}</strong></p>
      <p>Humidity: ${d.rh2m}%</p>
      <p>Clouds: ${d.cloudcover}/9</p>
    `;
    row.appendChild(card);
  });
}

/* ========= Data fetching ========= */
async function fetch7Timer(lat, lon){
  const url = `http://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civil&output=json`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return res.json();
}

async function loadWeather(lat, lon, flag = "🇪🇺", city = "Selected location"){
  try{
    const data = await fetch7Timer(lat, lon);
    state.lastData = data;
    state.lastMeta = { flag, city, lat, lon };

    // Render
    renderCurrent(data.dataseries[0], state.lastMeta);
    renderHourly(data.dataseries);
    renderDaily(data.dataseries, flag);
  }catch(err){
    console.error(err);
    document.getElementById("currentWeather").innerHTML =
      `<div class="current-weather"><p style="color:#b00020;font-weight:700;">Unable to load forecast. Please try again.</p></div>`;
  }
}

/* ========= Controls ========= */
document.getElementById("unitToggle").addEventListener("click", (e)=>{
  // Toggle units
  state.unit = state.unit === "C" ? "F" : "C";
  e.currentTarget.textContent = state.unit === "C" ? "°C" : "°F";
  e.currentTarget.setAttribute("aria-pressed", state.unit === "F");

  // Re-render using cached data
  if (state.lastData){
    renderCurrent(state.lastData.dataseries[0], state.lastMeta);
    renderHourly(state.lastData.dataseries);
    renderDaily(state.lastData.dataseries, state.lastMeta.flag);
  }
});

document.getElementById("citySelect").addEventListener("change", function(){
  const [lat, lon, flag, city] = this.value.split(",");
  loadWeather(lat, lon, flag, city);
});

document.getElementById("searchBtn").addEventListener("click", ()=>{
  const input = document.getElementById("searchCity").value.trim().toLowerCase();
  if(!input) return;
  if (CITY_MAP[input]){
    const [lat, lon, flag, city] = CITY_MAP[input];
    loadWeather(lat, lon, flag, city);
  } else {
    alert("City not in list. Try Paris, London, Rome, Madrid, or Berlin.");
  }
});

/* Use my location (no external reverse geocode; labels generic) */
document.getElementById("useLocation").addEventListener("click", ()=>{
  if (!navigator.geolocation){
    alert("Geolocation not supported by your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      const lat = pos.coords.latitude.toFixed(4);
      const lon = pos.coords.longitude.toFixed(4);
      loadWeather(lat, lon, "📍", "My Location");
    },
    (err)=> alert("Unable to get location: " + err.message),
    { enableHighAccuracy:true, timeout:8000 }
  );
});

/* ========= Initial load ========= */
loadWeather("48.8566", "2.3522", "🇫🇷", "Paris");
