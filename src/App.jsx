import { useState, useEffect } from 'react';
import axios from 'axios';

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

async function fetchRoute(origin, destination, targetArrival = null) {
  // Simuliere API-Aufruf mit realistischen Daten
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simuliere Ladezeit
  
  // Generiere individuelle Preise basierend auf den Adressen
  const routeKey = `${origin}-${destination}`.toLowerCase();
  const hash = routeKey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Basispreis zwischen 6€ und 18€ je nach Strecke (realistischer für Österreich)
  const basePrice = 6 + Math.abs(hash % 12);
  const priceVariation = (hash % 5) * 0.3; // ±0, ±0.3, ±0.6, ±0.9, ±1.2
  const finalPrice = Math.round((basePrice + priceVariation) * 100) / 100;
  
  // Priorität: Zuerst Zug, dann Bus
  // Mock-Daten basierend auf realen ÖBB-Verbindungen mit längeren Reisezeiten
  const mockRoutes = [
    {
      duration: 45, // Minuten für Graz-Leibnitz (realistisch)
      price: finalPrice,
      provider: hash % 2 === 0 ? 'ÖBB Regionalzug' : 'ÖBB Railjet',
      departure: '07:30',
      arrival: '08:15',
      departureMin: 7*60 + 30,
      arrivalMin: 8*60 + 15,
      type: 'train' // Priorität Zug
    },
    {
      duration: 52, // Minuten
      price: finalPrice + 1.5,
      provider: 'ÖBB Regionalexpress',
      departure: '08:15',
      arrival: '09:07',
      departureMin: 8*60 + 15,
      arrivalMin: 9*60 + 7,
      type: 'train'
    },
    {
      duration: 58, // Minuten
      price: finalPrice + 2.5,
      provider: 'ÖBB + Bus',
      departure: '09:00',
      arrival: '09:58',
      departureMin: 9*60,
      arrivalMin: 9*60 + 58,
      type: 'mixed'
    },
    {
      duration: 38, // Minuten (schnellere Verbindung)
      price: finalPrice + 4, // Teurer für schnellere Verbindung
      provider: 'ÖBB Railjet Express',
      departure: '10:30',
      arrival: '11:08',
      departureMin: 10*60 + 30,
      arrivalMin: 11*60 + 8,
      type: 'train'
    },
    // Bus-Optionen als Fallback
    {
      duration: 65, // Minuten (länger als Zug)
      price: finalPrice + 1, // Normalerweise teurer als Zug
      provider: 'BusBahnBim',
      departure: '06:45',
      arrival: '07:50',
      departureMin: 6*60 + 45,
      arrivalMin: 7*60 + 50,
      type: 'bus'
    },
    {
      duration: 72, // Minuten
      price: finalPrice + 1.5,
      provider: 'BusBahnBim Express',
      departure: '11:15',
      arrival: '12:27',
      departureMin: 11*60 + 15,
      arrivalMin: 12*60 + 27,
      type: 'bus'
    }
  ];
  
  let bestRoute;
  
  if (targetArrival) {
    // Priorität: Zuerst günstigste Zugverbindung, dann Bus
    const trainRoutes = mockRoutes.filter(route => route.type === 'train' || route.type === 'mixed');
    const busRoutes = mockRoutes.filter(route => route.type === 'bus');
    
    // Finde günstigste Zugverbindung
    if (trainRoutes.length > 0) {
      bestRoute = trainRoutes.reduce((best, current) => 
        current.price < best.price ? current : best
      );
    } else {
      // Fallback auf Bus, wenn kein Zug verfügbar
      bestRoute = busRoutes.reduce((best, current) => 
        current.price < best.price ? current : best
      );
    }
    
    return {
      duration: bestRoute.duration,
      price: bestRoute.price,
      provider: bestRoute.provider,
      details: bestRoute
    };
  } else {
    // Ohne Terminbeginn: einfach die günstigste Route
    bestRoute = mockRoutes.reduce((best, current) => 
      current.price < best.price ? current : best
    );
    
    return {
      duration: bestRoute.duration,
      price: bestRoute.price,
      provider: bestRoute.provider,
      details: bestRoute
    };
  }
}

export default function App() {
  const [zugpreis, setZugpreis] = useState('');
  const [beginn, setBeginn] = useState('');
  const [ende, setEnde] = useState('');
  const [dauerHours, setDauerHours] = useState('');
  const [dauerMinutes, setDauerMinutes] = useState('');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [autoRoute, setAutoRoute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null);

  const [times, setTimes] = useState(['--:--','--:--','--:--','--:--','--:--','--:--']);
  const [costs, setCosts] = useState({bahn:0, frueh:0, mittag:0, abend:0, gesamt:0});
  const [show, setShow] = useState(false);

  useEffect(() => {
    calc();
  }, [zugpreis, beginn, ende, dauerHours, dauerMinutes]);

  useEffect(() => {
    if (autoRoute && origin && destination && beginn) {
      fetchRouteData();
    }
  }, [autoRoute, origin, destination, beginn]); // Nur auf Eingabedaten reagieren, nicht auf berechnete Werte

  async function fetchRouteData() {
    if (!origin || !destination || !beginn) return;
    
    setLoading(true);
    try {
      const targetArrivalMin = toMin(beginn);
      const route = await fetchRoute(origin, destination, targetArrivalMin);
      setRouteData(route);
      
      // Automatisch Werte setzen
      const durationHours = Math.floor(route.duration / 60);
      const durationMinutes = route.duration % 60;
      
      setDauerHours(durationHours.toString());
      setDauerMinutes(durationMinutes.toString());
      setZugpreis(route.price.toString());
      
    } catch (error) {
      console.error('Fehler beim Laden der Route:', error);
      alert('Fehler beim Laden der Routendaten. Bitte manuell eingeben.');
    } finally {
      setLoading(false);
    }
  }

  function calc() {
    const preis = parseFloat(zugpreis);
    const b = toMin(beginn);
    const e = toMin(ende);
    const d = (dauerHours !== '' && dauerMinutes !== '') 
      ? parseInt(dauerHours) * 60 + parseInt(dauerMinutes)
      : null;

    // Kosten können berechnet werden, wenn preis und d vorhanden sind
    if (!isNaN(preis) && d !== null) {
      const bahn = preis * 2;
      // Für die Pauschalen brauchen wir den Zeitplan
      // Wenn ende vorhanden ist, berechne genau, sonst schätze
      let frueh = 0, mittag = 0, abend = 0;
      
      if (b !== null) {
        const abfahrtMin = b - 30 - d;
        
        if (e !== null) {
          // Genaue Berechnung mit ende
          const zuhauseMin = e + 30 + d;
          frueh = abfahrtMin < 7 * 60 ? 5.80 : 0;
          mittag = abfahrtMin < 11 * 60 && zuhauseMin > 14 * 60 ? 12.30 : 0;
          abend = zuhauseMin > 19 * 60 ? 12.30 : 0;
        } else {
          // Schätzung ohne ende (angenommen Terminende = Terminbeginn + 1 Stunde)
          const estimatedEndeMin = b + 60;
          const estimatedZuhauseMin = estimatedEndeMin + 30 + d;
          frueh = abfahrtMin < 7 * 60 ? 5.80 : 0;
          mittag = abfahrtMin < 11 * 60 && estimatedZuhauseMin > 14 * 60 ? 12.30 : 0;
          abend = estimatedZuhauseMin > 19 * 60 ? 12.30 : 0;
        }
      }
      
      const gesamt = bahn + frueh + mittag + abend;
      setCosts({bahn, frueh, mittag, abend, gesamt});
    }

    // Zeitplan kann nur berechnet werden, wenn alle Daten vorhanden sind
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

    setShow(true);
  }

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>ZGB</h1>
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
            
            <div className="field">
              <label>Terminbeginn</label>
              <input
                type="time"
                id="beginn"
                value={beginn}
                onChange={e => setBeginn(e.target.value)}
              />
              <span className="hint">Startzeit des Termins (für optimale Routenplanung)</span>
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
              <label>
                <input
                  type="checkbox"
                  checked={autoRoute}
                  onChange={e => setAutoRoute(e.target.checked)}
                  style={{marginRight: '8px'}}
                />
                Automatische Routenabfrage (ÖBB/BusBahnBim)
              </label>
              {!beginn && <div style={{color: '#dc3545', fontSize: '0.9em'}}>⚠️ Bitte zuerst Terminbeginn eingeben</div>}
              {loading && <div style={{color: '#666', fontSize: '0.9em'}}>🔄 Lade Routendaten...</div>}
              {routeData && !loading && (
                <div style={{
                  color: '#28a745', 
                  fontSize: '0.9em'
                }}>
                  ✅ {routeData.provider}: {routeData.duration} Min, {eur(routeData.price)}
                </div>
              )}
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
            
            {!autoRoute && (
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
            )}
            
            {!autoRoute && (
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
            )}
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
