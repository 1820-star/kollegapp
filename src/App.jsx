import { useState, useEffect } from 'react';

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function toTime(min) {
  if (min === null) return '--:--';
  const t = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function eur(n) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function App() {
  const [zugpreis, setZugpreis] = useState('');
  const [beginn, setBeginn] = useState('');
  const [ende, setEnde] = useState('');
  const [dauerHours, setDauerHours] = useState('');
  const [dauerMinutes, setDauerMinutes] = useState('');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const [times, setTimes] = useState(['--:--','--:--','--:--','--:--','--:--','--:--']);
  const [costs, setCosts] = useState({bahn:0, frueh:0, mittag:0, abend:0, gesamt:0});
  const [show, setShow] = useState(false);

  useEffect(() => {
    calc();
  }, [zugpreis, beginn, ende, dauerHours, dauerMinutes]);

  function calc() {
    const preis = parseFloat(zugpreis);
    const b = toMin(beginn);
    const e = toMin(ende);
    const d = (dauerHours !== '' && dauerMinutes !== '') 
      ? parseInt(dauerHours) * 60 + parseInt(dauerMinutes)
      : null;

    if (isNaN(preis) || b === null || e === null || d === null) {
      setShow(false);
      return;
    }

    const abfahrtMin = b - 30 - d;
    const ankunftMin = b - 30;
    const abfahrtTermMin = e + 30;
    const zuhauseMin = e + 30 + d;

    setTimes([
      toTime(abfahrtMin),
      toTime(ankunftMin),
      toTime(b),
      toTime(e),
      toTime(abfahrtTermMin),
      toTime(zuhauseMin)
    ]);

    const bahn = preis * 2;
    const frueh = abfahrtMin < 7 * 60 ? 5.80 : 0;
    const mittag = abfahrtMin < 11 * 60 && zuhauseMin > 14 * 60 ? 12.30 : 0;
    const abend = zuhauseMin > 19 * 60 ? 12.30 : 0;
    const gesamt = bahn + frueh + mittag + abend;

    setCosts({bahn, frueh, mittag, abend, gesamt});
    setShow(true);
  }

  return (
    <div className="wrap">
      <header>
        <div className="header-icon">🧳</div>
        <div>
          <h1>Reisekostenrechner</h1>
          <p className="subtitle">Automatische Berechnung · Zeitplan · Verpflegungspauschalen</p>
        </div>
      </header>

      <div className="grid">
        <div className="card" style={{animationDelay:'0s'}}>
          <div className="card-tag">01 — Eingaben</div>
          <h2 className="card-title">Reisedaten</h2>
          <p className="card-desc">Nur diese 4 Felder ausfüllen — alles andere wird berechnet.</p>

          <div className="inputs">
            <div className="field">
              <label>Abfahrtsadresse</label>
              <input
                type="text"
                id="origin"
                placeholder="Straße, Stadt"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Zieladresse</label>
              <input
                type="text"
                id="destination"
                placeholder="Straße, Stadt"
                value={destination}
                onChange={e => setDestination(e.target.value)}
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => {
                  if(origin && destination) {
                    const o = encodeURIComponent(origin);
                    const d = encodeURIComponent(destination);
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=transit`;
                    window.open(url, '_blank');
                  } else {
                    alert('Bitte Start- und Zieladresse eingeben');
                  }
                }}
              >Route suchen</button>
            </div>
            <div className="field">
              <label>Zugpreis einfache Strecke</label>
              <input
                type="number"
                id="zugpreis"
                placeholder="45.00"
                min="0"
                step="0.01"
                value={zugpreis}
                onChange={e => setZugpreis(e.target.value)}
              />
              <span className="hint">Preis in € für eine Fahrtrichtung</span>
            </div>
            <div className="field">
              <label>Terminbeginn</label>
              <input
                type="time"
                id="beginn"
                value={beginn}
                onChange={e => setBeginn(e.target.value)}
              />
              <span className="hint">Startzeit des Termins</span>
            </div>
            <div className="field">
              <label>Terminende</label>
              <input
                type="time"
                id="ende"
                value={ende}
                onChange={e => setEnde(e.target.value)}
              />
              <span className="hint">Endzeit des Termins</span>
            </div>
            <div className="field">
              <label>Reisedauer einfache Strecke</label>
              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                <div style={{flex:1}}>
                  <input
                    type="number"
                    id="dauerHours"
                    placeholder="0"
                    min="0"
                    max="23"
                    value={dauerHours}
                    onChange={e => setDauerHours(e.target.value)}
                  />
                  <span className="hint" style={{fontSize:'0.8em'}}>Stunden</span>
                </div>
                <div style={{flex:1}}>
                  <input
                    type="number"
                    id="dauerMinutes"
                    placeholder="30"
                    min="0"
                    max="59"
                    value={dauerMinutes}
                    onChange={e => setDauerMinutes(e.target.value)}
                  />
                  <span className="hint" style={{fontSize:'0.8em'}}>Minuten</span>
                </div>
              </div>
              <span className="hint">z.B. 1 Stunde und 30 Minuten</span>
            </div>
          </div>

          <div className="rules">
            <p className="rules-title">Pauschalen-Regeln</p>
            <div className="rule">
              <span className="rule-icon">🌅</span>
              <span>Frühstück <strong>5,80 €</strong> — wenn Abfahrt vor <strong>07:00 Uhr</strong></span>
            </div>
            <div className="rule">
              <span className="rule-icon">☀️</span>
              <span>Mittagessen <strong>12,30 €</strong> — Abfahrt vor <strong>11:00</strong> und Rückkehr nach <strong>14:00</strong></span>
            </div>
            <div className="rule">
              <span className="rule-icon">🌙</span>
              <span>Abendessen <strong>12,30 €</strong> — wenn Rückkehr nach <strong>19:00 Uhr</strong></span>
            </div>
          </div>
        </div>

        <div className="right-col">
          <div className={`card result-card${show ? ' has-result' : ''}`} style={{animationDelay:'0.1s'}}>
            <div className="card-tag">02 — Zeitplan</div>
            <h2 className="card-title">Reisezeitplan</h2>
            {!show && <div className="empty">← Felder ausfüllen für Zeitplan</div>}
            {show && (
              <div className="timeline" style={{display:'flex'}}>
                {[
                  {label:'🏠 Abfahrt von Zuhause', active:false},
                  {label:'📍 Ankunft beim Termin', active:false},
                  {label:'▶ Terminbeginn', active:true},
                  {label:'⏹ Terminende', active:true},
                  {label:'🚆 Abfahrt vom Termin', active:false},
                  {label:'🏠 Ankunft Zuhause', active:false},
                ].map((item,i)=>(
                  <div className="tl-item" key={i}>
                    <div className="tl-left">
                      <div className={`tl-dot${item.active ? ' active' : ''}`}></div>
                      {i < 5 && <div className="tl-line"></div>}
                    </div>
                    <div className={`tl-content${item.active ? ' active' : ''}`}>
                      <span className="tl-label">{item.label}</span>
                      <span className={`tl-time${item.active ? ' active' : ''}`}>{times[i]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`card result-card${show ? ' has-result' : ''}`} style={{animationDelay:'0.18s'}}>
            <div className="card-tag">03 — Kosten</div>
            <h2 className="card-title">Kostenübersicht</h2>
            {!show && <div className="empty">← Felder ausfüllen für Kostenberechnung</div>}
            {show && (
              <div id="costs">
                <div className={`cost-row${!show ? ' inactive' : ''}`} id="row-bahn">
                  <span className="cost-icon">🚆</span>
                  <span className="cost-label">Hin- und Rückreise</span>
                  <span className="cost-amount" id="val-bahn">{eur(costs.bahn)}</span>
                </div>
                <div className={`cost-row${costs.frueh === 0 ? ' inactive' : ''}`} id="row-frueh">
                  <span className="cost-icon">🌅</span>
                  <span className="cost-label">Frühstückspauschale</span>
                  <span className="cost-amount" id="val-frueh">{costs.frueh > 0 ? eur(costs.frueh) : '–'}</span>
                </div>
                <div className={`cost-row${costs.mittag === 0 ? ' inactive' : ''}`} id="row-mittag">
                  <span className="cost-icon">☀️</span>
                  <span className="cost-label">Mittagspauschale</span>
                  <span className="cost-amount" id="val-mittag">{costs.mittag > 0 ? eur(costs.mittag) : '–'}</span>
                </div>
                <div className={`cost-row${costs.abend === 0 ? ' inactive' : ''}`} id="row-abend">
                  <span className="cost-icon">🌙</span>
                  <span className="cost-label">Abendessenpauschale</span>
                  <span className="cost-amount" id="val-abend">{costs.abend > 0 ? eur(costs.abend) : '–'}</span>
                </div>
                <div className="cost-row total">
                  <span className="cost-icon">∑</span>
                  <span className="cost-label">Gesamtsumme</span>
                  <span className="cost-amount" id="val-gesamt">{eur(costs.gesamt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer>Reisekosten gem. interner Pauschalenregelung · 30 Min. Puffer vor &amp; nach Termin</footer>
    </div>
  );
}
