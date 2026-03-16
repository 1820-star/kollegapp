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

function normalizePlace(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function routeKey(origin, destination) {
  return `${normalizePlace(origin)}|${normalizePlace(destination)}`;
}

// Tarifdaten (Erwachsenen Vollpreis, einfache Strecke).
// Nur Daten verwenden, die von euch bestätigt sind.
const ROUTE_TARIFFS = {
  'graz|leibnitz': [
    { type: 'train', provider: 'ÖBB', price: 11.3, duration: 180, zones: 0 }
  ],
  'leibnitz|graz': [
    { type: 'train', provider: 'ÖBB', price: 11.3, duration: 180, zones: 0 }
  ]
};

const BUS_ZONE_TARIFFS = {
  1: { validityMin: 60, price: 3.2 },
  2: { validityMin: 90, price: 6.1 },
  3: { validityMin: 90, price: 8.8 },
  4: { validityMin: 90, price: 11.3 },
  5: { validityMin: 120, price: 13.8 },
  6: { validityMin: 120, price: 16.3 },
  7: { validityMin: 120, price: 18.7 },
  8: { validityMin: 150, price: 21.2 },
  9: { validityMin: 150, price: 23.6 },
  10: { validityMin: 150, price: 26.0 },
  11: { validityMin: 180, price: 28.2 },
  12: { validityMin: 180, price: 30.5 },
  13: { validityMin: 180, price: 32.8 },
  14: { validityMin: 210, price: 34.6 },
  15: { validityMin: 210, price: 36.5 },
  16: { validityMin: 360, price: 38.1 }
};

const TRANSPORT_ZONES = {
  '101': 'Graz (Kernzone)',
  '102': 'Graz Umgebung Nord',
  '103': 'Graz Umgebung Ost',
  '104': 'Graz Umgebung Sued',
  '105': 'Graz Umgebung West',
  '201': 'Bruck an der Mur',
  '202': 'Kapfenberg',
  '203': 'Muerzzuschlag',
  '204': 'Kindberg',
  '301': 'Frohnleiten',
  '302': 'Deutschfeistritz',
  '303': 'Peggau',
  '304': 'Uebelbach',
  '401': 'Weiz',
  '402': 'Gleisdorf',
  '403': 'Pischelsdorf',
  '404': 'Birkfeld',
  '501': 'Hartberg',
  '502': 'Fuerstenfeld',
  '503': 'Bad Waltersdorf',
  '504': 'Friedberg',
  '601': 'Leibnitz',
  '602': 'Wildon',
  '603': 'Ehrenhausen',
  '604': 'Strass-Spielfeld',
  '701': 'Deutschlandsberg',
  '702': 'Stainz',
  '703': 'Eibiswald',
  '801': 'Voitsberg',
  '802': 'Koeflach',
  '803': 'Baernbach',
  '901': 'Leoben',
  '902': 'Trofaiach',
  '903': 'Eisenerz'
};

// Hier kommen spaeter von dir bestaetigte Strecken-Zonenanzahlen rein.
// Format: 'zoneA|zoneB': zonenCount
const ROUTE_ZONE_COUNTS = {
  '101|601': 4,
  '101|901': 3,
  '601|701': 3,
  '101|401': 3,
  '101|801': 3,
  '101|501': 4,
  '401|501': 3,
  '701|801': 3,
  '901|201': 2,
  '201|202': 2,
  '401|402': 2,
  '801|802': 2,
  '601|901': 7,
  '701|501': 7,
  '801|601': 6,
  '401|901': 6,
  '501|701': 6
};

function findZoneByAddress(address) {
  const normalizedAddress = normalizePlace(address);
  const entries = Object.entries(TRANSPORT_ZONES);

  for (const [zoneId, zoneName] of entries) {
    const normalizedZoneName = normalizePlace(zoneName);
    if (normalizedAddress.includes(normalizedZoneName) || normalizedZoneName.includes(normalizedAddress)) {
      return { id: zoneId, name: zoneName };
    }
  }

  return null;
}

function getZoneCount(originZoneId, destinationZoneId) {
  if (originZoneId === destinationZoneId) return 1;

  const directKey = `${originZoneId}|${destinationZoneId}`;
  const reverseKey = `${destinationZoneId}|${originZoneId}`;

  return ROUTE_ZONE_COUNTS[directKey] || ROUTE_ZONE_COUNTS[reverseKey] || null;
}

let googleMapsLoaderPromise = null;

function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.maps?.DirectionsService) return Promise.resolve(window.google);

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return googleMapsLoaderPromise;
}

async function fetchGoogleTransitAverageDuration(origin, destination) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    await loadGoogleMaps(apiKey);

    return await new Promise(resolve => {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.TRANSIT,
          provideRouteAlternatives: true
        },
        (result, status) => {
          if (status !== 'OK' || !result?.routes?.length) {
            resolve(null);
            return;
          }

          const durations = result.routes
            .map(route => route?.legs?.[0]?.duration?.value)
            .filter(Boolean)
            .map(seconds => Math.round(seconds / 60));

          if (!durations.length) {
            resolve(null);
            return;
          }

          const avg = Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length);
          resolve(avg);
        }
      );
    });
  } catch {
    return null;
  }
}

function getTrainEstimate(origin, destination) {
  const key = routeKey(origin, destination);
  const options = (ROUTE_TARIFFS[key] || []).filter(item => item.type === 'train');
  if (!options.length) return null;

  const avgPrice = options.reduce((sum, item) => sum + item.price, 0) / options.length;
  const avgDuration = Math.round(options.reduce((sum, item) => sum + item.duration, 0) / options.length);

  return {
    provider: 'ÖBB',
    price: avgPrice,
    duration: avgDuration,
    source: 'tarifdaten'
  };
}

function getBusEstimate(origin, destination) {
  const originZone = findZoneByAddress(origin);
  const destinationZone = findZoneByAddress(destination);

  if (!originZone || !destinationZone) {
    return null;
  }

  const zoneCount = getZoneCount(originZone.id, destinationZone.id);
  if (!zoneCount) {
    return null;
  }

  const tariff = BUS_ZONE_TARIFFS[zoneCount];
  if (!tariff) {
    return null;
  }

  return {
    provider: 'BusBahnBim',
    price: tariff.price,
    duration: tariff.validityMin,
    zones: zoneCount,
    originZone,
    destinationZone,
    source: 'zonentarif'
  };
}

async function fetchRouteComparison(origin, destination) {
  const train = getTrainEstimate(origin, destination);
  const bus = getBusEstimate(origin, destination);

  let trainMerged = train;
  if (trainMerged) {
    const googleAvgDuration = await fetchGoogleTransitAverageDuration(origin, destination);
    if (googleAvgDuration) {
      trainMerged = {
        ...trainMerged,
        duration: Math.round((trainMerged.duration + googleAvgDuration) / 2),
        source: 'durchschnitt aus tarifdaten + google maps'
      };
    }
  }

  const providers = [trainMerged, bus].filter(Boolean);
  if (!providers.length) {
    throw new Error('NO_PROVIDER_DATA');
  }

  const avgPrice = providers.reduce((sum, item) => sum + item.price, 0) / providers.length;
  const avgDuration = Math.round(providers.reduce((sum, item) => sum + item.duration, 0) / providers.length);

  return {
    train: trainMerged,
    bus,
    average: {
      price: avgPrice,
      duration: avgDuration
    }
  };
}

async function fetchRoute(origin, destination, targetArrival = null) {
  // Kleine Verzögerung für UI-Feedback
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simuliere Ladezeit

  const key = routeKey(origin, destination);
  const options = ROUTE_TARIFFS[key] || [];

  if (options.length > 0) {
    const trainOptions = options.filter(item => item.type === 'train');
    const busOptions = options.filter(item => item.type === 'bus');

    const pool = trainOptions.length > 0 ? trainOptions : busOptions;
    if (pool.length === 0) {
      throw new Error('NO_TRANSPORT_OPTION');
    }

    const bestRoute = pool.reduce((best, current) =>
      current.price < best.price ? current : best
    );

    return {
      duration: bestRoute.duration,
      price: bestRoute.price,
      provider: bestRoute.provider,
      details: bestRoute,
      requestedArrival: targetArrival
    };
  }

  // Fallback: BusBahnBim Tariflogik aus fixer Zonentariftabelle
  const originZone = findZoneByAddress(origin);
  const destinationZone = findZoneByAddress(destination);

  if (!originZone || !destinationZone) {
    throw new Error('NO_ZONE_MATCH');
  }

  const zoneCount = getZoneCount(originZone.id, destinationZone.id);
  if (!zoneCount) {
    throw new Error(`NO_ZONE_COUNT:${originZone.id}|${destinationZone.id}`);
  }

  const tariff = BUS_ZONE_TARIFFS[zoneCount];
  if (!tariff) {
    throw new Error('NO_ZONE_TARIFF');
  }

  return {
    duration: tariff.validityMin,
    price: tariff.price,
    provider: 'BusBahnBim',
    details: {
      type: 'bus',
      zones: zoneCount,
      originZone,
      destinationZone
    },
    requestedArrival: targetArrival
  };
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
  const [autoSuggestion, setAutoSuggestion] = useState(null);

  const [times, setTimes] = useState(['--:--','--:--','--:--','--:--','--:--','--:--']);
  const [costs, setCosts] = useState({bahn:0, frueh:0, mittag:0, abend:0, gesamt:0});
  const [show, setShow] = useState(false);

  useEffect(() => {
    calc();
  }, [zugpreis, beginn, ende, dauerHours, dauerMinutes]);

  useEffect(() => {
    if (autoRoute) {
      fetchRouteData();
    }
  }, [autoRoute]); // Abfrage beim Aktivieren der Checkbox

  async function fetchRouteData() {
    setLoading(true);
    setRouteData(null);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRouteData({ placeholder: true });
    setLoading(false);
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
                  onChange={e => { setAutoRoute(e.target.checked); if (!e.target.checked) setRouteData(null); }}
                  style={{marginRight: '8px'}}
                />
                Automatische Routenabfrage (ÖBB/BusBahnBim)
              </label>
              <div className="hint">Manuelle Eingabe bleibt immer möglich: Reisedauer und Preis können danach weiter geändert werden.</div>
              {loading && <div style={{color: '#666', fontSize: '0.9em'}}>🔄 Lade Routendaten...</div>}
              {routeData && !loading && (
                <div style={{color: '#28a745', fontSize: '0.9em'}}>
                  <div>✅ ÖBB Railjet: XX Min, XX €</div>
                  <div>✅ BusBahnBim: XX Min, XX €</div>
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
              {autoSuggestion && (
                <span className="hint">Vorschlag (nicht uebernommen): ca. {eur(autoSuggestion.price)}</span>
              )}
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
              {autoSuggestion && (
                <span className="hint">
                  Vorschlag (nicht uebernommen): ca. {autoSuggestion.durationHours}h {String(autoSuggestion.durationMinutes).padStart(2, '0')}min
                </span>
              )}
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
