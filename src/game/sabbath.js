// Modo Sábado: from Friday sunset to Saturday sunset the competitive and
// commercial parts rest (Arena, ranking, shop, boxes, pass, trophies, season
// points). Sunset is computed offline, without asking for location: the
// longitude comes from the phone's time zone and the latitude is Brasília's.

const RAD = Math.PI / 180;
const LAT = -15.8;
export const SABBATH_SCENES = new Set(['arena', 'online', 'ranking', 'shop', 'boxes', 'pass']);
export const SABBATH_TEXT = 'Feliz sábado! 🕊️ A Arena, o ranking e a loja descansam até o pôr do sol. Aproveite as histórias da Bíblia.';
export const SABBATH_VERSE = '“Lembra-te do dia de sábado, para o santificar.” Êxodo 20:8';

/** Local sunset of the calendar day of `d` (a Date at that day's local time). */
export function sunset(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const lon = -day.getTimezoneOffset() / 4; // UTC-3 -> -45°
  const n = Math.floor((day - new Date(day.getFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(dec)) - Math.tan(LAT * RAD) * Math.tan(dec)) / RAD;
  const utcMin = 720 - 4 * (lon - ha) - eq; // minutes after UTC midnight
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) + utcMin * 6e4);
}

/** True between Friday sunset and Saturday sunset (local time). */
export function isSabbath(now = new Date()) {
  const wd = now.getDay();
  if (wd === 5) return now >= sunset(now);
  if (wd === 6) return now < sunset(now);
  return false;
}

/** "18:21" — when this Sabbath ends (or the next one starts). */
export function sabbathEdge(now = new Date()) {
  const t = now.getDay() === 6 ? sunset(now) : sunset(new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((5 - now.getDay() + 7) % 7)));
  return t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** The gentle notice shown when a resting part of the game is tapped. */
export function showSabbath() {
  const root = document.getElementById('game');
  if (!root || root.querySelector('.sabbath')) return false;
  const close = () => el.remove();
  const el = document.createElement('div');
  el.className = 'modal sabbath';
  el.innerHTML = `<div class="modal__box sabbath__box"><img class="pixel sabbath__dove" src="assets/ui/sabado_pomba.png" alt="">
    <h2>Feliz sábado!</h2><p></p><p class="sabbath__verse"></p>
    <p class="sabbath__when"></p><button class="btn btn--play"><b>Voltar</b></button></div>`;
  const [p, verse, when] = el.querySelectorAll('p');
  p.textContent = 'A Arena, o ranking e a loja descansam até o pôr do sol de sábado. A Jornada, os minijogos, o versículo do dia e a Fuga cooperativa continuam abertos.';
  verse.textContent = SABBATH_VERSE;
  when.textContent = `Volta ${new Date().getDay() === 6 ? "hoje" : "amanhã"} às ${sabbathEdge()} (pôr do sol de sábado).`;
  el.querySelector('button').onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  root.appendChild(el);
  return false;
}
