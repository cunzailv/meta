// Main interactive logic for index.html (module)
// - lazy loads chinese-lunar if available (script tag fallback present)
// - validates date (4-digit year between 1000 and 9999)
// - robustly reads GanZhi fields from different lib shapes
// - UI state handling (loading, report, error)

const Elements = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水','子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };

const form = document.getElementById('profileForm');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const restartBtn = document.getElementById('restartBtn');

const loadingPanel = document.getElementById('loadingPanel');
const reportPanel = document.getElementById('reportPanel');
const noLibNotice = document.getElementById('noLibNotice');

const yearP = document.getElementById('yearP');
const monthP = document.getElementById('monthP');
const dayP = document.getElementById('dayP');
const hourP = document.getElementById('hourP');

const zodiacEl = document.getElementById('zodiac');
const dayMasterEl = document.getElementById('dayMaster');
const analysisSummaryEl = document.getElementById('analysisSummary');
const recommendationsEl = document.getElementById('recommendations');
const reportTimeEl = document.getElementById('reportTime');

const formError = document.getElementById('formError');

const challengeButtons = Array.from(document.querySelectorAll('.pill-btn'));
let selectedChallenges = new Set();
challengeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.value;
    const pressed = btn.classList.toggle('pill-pressed');
    btn.setAttribute('aria-pressed', String(pressed));
    if (pressed) selectedChallenges.add(v); else selectedChallenges.delete(v);
  });
});

// ensure lib loaded (if script tag present it may already be loaded)
async function ensureChineseLunar() {
  if (window.chineseLunar) return window.chineseLunar;
  // try loading from default path (if not pre-included)
  const path = '/libs/chinese-lunar.bundle.js';
  try {
    await new Promise((resolve, reject) => {
      const scripts = Array.from(document.scripts).map(s => s.src || '');
      if (scripts.includes(location.origin + path) || scripts.includes(path)) {
        // script tag already added; wait briefly for it to load
        setTimeout(() => (window.chineseLunar ? resolve() : resolve()), 300);
        return;
      }
      const s = document.createElement('script');
      s.src = path;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('加载失败'));
      document.head.appendChild(s);
    });
  } catch (e) {
    // ignore: we'll use graceful fallback
    console.warn('chinese-lunar load failed:', e);
  }
  return window.chineseLunar || null;
}

// robust getter: accept many result shapes
function extractGanZhi(res) {
  if (!res) return null;
  // Several libs return an object with GanZhiYear/GanZhiMonth/GanZhiDay/GanZhiHour
  const yearP = res.GanZhiYear || res.ganZhiYear || res.yearGanZhi || res.year || res.yearCn || res.GanZhi || res.ganZhi || null;
  const monthP = res.GanZhiMonth || res.ganZhiMonth || res.month || res.monthCn || null;
  const dayP = res.GanZhiDay || res.ganZhiDay || res.day || res.dayCn || null;
  const hourP = res.GanZhiHour || res.ganZhiHour || res.hour || null;
  return {
    yearPillar: yearP || '—',
    monthPillar: monthP || '—',
    dayPillar: dayP || '—',
    hourPillar: hourP || '—',
    raw: res
  };
}

function simpleAnalyze(bazi) {
  // best-effort: take first char of day pillar as day-master
  const day = (bazi.dayPillar && String(bazi.dayPillar)) || '';
  const dayChar = day ? day[0] : null;
  const element = Elements[dayChar] || '土';
  const strength = (element === '木' || element === '火') ? '偏旺' : '偏弱';
  const favorable = (element === '木' || element === '火') ? '水' : '木';
  return { dayMaster: day || '—', element, strength, favorable };
}

function getZodiac(date) {
  const d = date.getDate(), m = date.getMonth() + 1;
  const z = [
    { sign: "摩羯座", start:[12,22], end:[1,19], element:"土" },
    { sign: "水瓶座", start:[1,20], end:[2,18], element:"风" },
    { sign: "双鱼座", start:[2,19], end:[3,20], element:"水" },
    { sign: "白羊座", start:[3,21], end:[4,19], element:"火" },
    { sign: "金牛座", start:[4,20], end:[5,20], element:"土" },
    { sign: "双子座", start:[5,21], end:[6,21], element:"风" },
    { sign: "巨蟹座", start:[6,22], end:[7,22], element:"水" },
    { sign: "狮子座", start:[7,23], end:[8,22], element:"火" },
    { sign: "处女座", start:[8,23], end:[9,22], element:"土" },
    { sign: "天秤座", start:[9,23], end:[10,23], element:"风" },
    { sign: "天蝎座", start:[10,24], end:[11,22], element:"水" },
    { sign: "射手座", start:[11,23], end:[12,21], element:"火" }
  ];
  for (const zc of z) {
    if ((m === zc.start[0] && d >= zc.start[1]) || (m === zc.end[0] && d <= zc.end[1])) return zc;
  }
  return z[0];
}

function renderReport(bazi, analysis, date) {
  yearP.textContent = bazi.yearPillar || '—';
  monthP.textContent = bazi.monthPillar || '—';
  dayP.textContent = bazi.dayPillar || '—';
  hourP.textContent = bazi.hourPillar || '—';

  const zodiac = getZodiac(date);
  zodiacEl.textContent = `${zodiac.sign}（${zodiac.element}象）`;
  dayMasterEl.textContent = `${analysis.dayMaster}（${analysis.element}）`;
  analysisSummaryEl.textContent = `初步判断：日主 ${analysis.strength}；建议优先调和/补充“${analysis.favorable}”元素来平衡能量。关注：${Array.from(selectedChallenges).join('、')}`;

  // simple recommendations UI
  recommendationsEl.innerHTML = `
    <div class="card p-3">
      <div class="font-semibold">建议一：易用品（示例）</div>
      <div class="text-sm text-gray-300 mt-1">优先引入 ${analysis.favorable} 元素的练习/物品来帮助平衡。</div>
    </div>
    <div class="card p-3">
      <div class="font-semibold">建议二：数字练习（示例）</div>
      <div class="text-sm text-gray-300 mt-1">每日 10 分钟的意象练习，结合呼吸与身体感知。</div>
    </div>
  `;

  reportTimeEl.textContent = new Date().toLocaleString();
}

// build Date reliably from inputs; if tz is provided like "+08:00", interpret user input as local at that tz
function buildDateFromInputs(dateStr, timeStr, tzStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh = 0, mm = 0] = (timeStr || '').split(':').map(Number);
  if (!tzStr) {
    // interpret as local browser time
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  // interpret input as time in tzStr, convert to UTC-based Date
  const sign = tzStr[0] === '-' ? -1 : 1;
  const [tH, tM] = tzStr.slice(1).split(':').map(Number);
  const offsetMinutes = sign * (tH * 60 + (tM || 0));
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm, 0) - offsetMinutes * 60 * 1000;
  return new Date(utcMillis);
}

function validateYearFourDigits(dateStr) {
  // dateStr is "YYYY-MM-DD"
  if (!dateStr) return false;
  const y = Number(dateStr.split('-')[0]);
  if (!Number.isInteger(y)) return false;
  return y >= 1000 && y <= 9999;
}

// attempt to call chineseLunar.solarToLunar in a few different ways
function callSolarToLunar(date) {
  if (!window.chineseLunar) return null;
  try {
    // some libs accept Date
    let res = null;
    try { res = window.chineseLunar.solarToLunar(date); } catch (e) {}
    if (!res) {
      try {
        res = window.chineseLunar.solarToLunar(date.getFullYear(), date.getMonth() + 1, date.getDate());
      } catch (e) { res = null; }
    }
    return res;
  } catch (e) {
    console.error('callSolarToLunar error', e);
    return null;
  }
}

// graceful fallback stub if library absent
function stubSolarToLunar(date) {
  const y = date.getFullYear();
  const base = ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉'];
  const idx = Math.abs(y) % base.length;
  return { GanZhiYear: base[idx], GanZhiMonth: base[(idx+1)%base.length], GanZhiDay: base[(idx+2)%base.length], GanZhiHour: base[(idx+3)%base.length] };
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  formError.classList.add('hidden');

  const name = document.getElementById('name').value.trim();
  const dateStr = document.getElementById('birthdate').value;
  const timeStr = document.getElementById('birthtime').value;
  const tz = document.getElementById('tz').value || null;

  if (!name || !dateStr || !timeStr || selectedChallenges.size === 0) {
    formError.textContent = '请填写姓名、出生日期与时间，并至少选择一个关注领域。';
    formError.classList.remove('hidden');
    return;
  }

  if (!validateYearFourDigits(dateStr)) {
    formError.textContent = '出生年份必须为四位数字且在 1000 到 9999 之间，请检查。';
    formError.classList.remove('hidden');
    return;
  }

  // build date
  const userDate = buildDateFromInputs(dateStr, timeStr, tz);

  // UI: loading
  loadingPanel.classList.remove('hidden');
  reportPanel.classList.add('hidden');
  noLibNotice.classList.add('hidden');
  analyzeBtn.disabled = true;

  // ensure lib loaded (try)
  await ensureChineseLunar();

  // compute (simulate slight delay for better UX)
  setTimeout(() => {
    let raw;
    if (window.chineseLunar) {
      raw = callSolarToLunar(userDate);
      if (!raw) raw = stubSolarToLunar(userDate);
    } else {
      raw = stubSolarToLunar(userDate);
      noLibNotice.classList.remove('hidden');
    }

    const bazi = extractGanZhi(raw) || { yearPillar:'—', monthPillar:'—', dayPillar:'—', hourPillar:'—' };
    const analysis = simpleAnalyze(bazi);
    renderReport(bazi, analysis, userDate);

    loadingPanel.classList.add('hidden');
    reportPanel.classList.remove('hidden');
    analyzeBtn.disabled = false;
  }, 600);
});

clearBtn.addEventListener('click', () => {
  document.getElementById('name').value = '';
  document.getElementById('birthdate').value = '';
  document.getElementById('birthtime').value = '';
  document.getElementById('tz').value = '';
  selectedChallenges.clear();
  challengeButtons.forEach(b => { b.classList.remove('pill-pressed'); b.setAttribute('aria-pressed','false'); });
  formError.classList.add('hidden');
});

restartBtn.addEventListener('click', () => {
  reportPanel.classList.add('hidden');
  loadingPanel.classList.add('hidden');
  noLibNotice.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});