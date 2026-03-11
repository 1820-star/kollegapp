import { useState, useEffect } from 'react';

const AVATARE_BOESE = ['🧙‍♀️','🐉','👹','🧟','💀','🕷️','🦇','😈'];
const AVATARE_GUT   = ['👸','🍼','🦋','🌸','🧚','🌈','🐣','🦄'];
const STORAGE_KEY   = 'kollegen-app-v3';

export default function App() {
  const [data, setData] = useState({ kollegen:[], bewertungen:[], ereignisse:[] });
  const [currentView, setCurrentView] = useState('bewertung');
  const [selectedKollegeId, setSelectedKollegeId] = useState(null);
  const [tagesKollegeId, setTagesKollegeId] = useState(null);
  const [bewertungPunkte, setBewertungPunkte] = useState(5);
  const [filterTyp, setFilterTyp] = useState('alle');
  const [ereignisTyp, setEreignisTyp] = useState('positiv');
  const [addKollegeOpen, setAddKollegeOpen] = useState(false);
  const [addEreignisOpen, setAddEreignisOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // STORAGE
  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_KEY);
      if (r) {
        const d = JSON.parse(r);
        const base = d.data || d || {};
        base.kollegen = Array.isArray(base.kollegen) ? base.kollegen : [];
        base.bewertungen = Array.isArray(base.bewertungen) ? base.bewertungen : [];
        base.ereignisse = Array.isArray(base.ereignisse) ? base.ereignisse : [];
        setData(base);
        setIsDark(!!d.dark);
      }
    } catch(e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, dark: isDark }));
    } catch(e) {}
  }, [data, isDark]);

  // helpers
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function fmt(iso) { return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'2-digit'}); }
  function ratingColor(v) { return v >= 8 ? 'var(--green)' : v >= 5 ? 'var(--yellow)' : 'var(--red)'; }
  function getAvg(id) {
    const bs = data.bewertungen.filter(b => b.kollegeId===id);
    return bs.length ? (bs.reduce((s,b)=>s+b.punkte,0)/bs.length).toFixed(1) : null;
  }
  function calcWeight(k) {
    const bs = data.bewertungen.filter(b=>b.kollegeId===k.id);
    return bs.length ? Math.max(1, 11 - bs.reduce((s,b)=>s+b.punkte,0)/bs.length) : 10;
  }
  function pickRandom() {
    const ks = data.kollegen;
    if (!ks.length) return null;
    const ws = ks.map(calcWeight), tot = ws.reduce((a,b)=>a+b,0);
    let r = Math.random()*tot;
    for (let i=0;i<ks.length;i++){r-=ws[i];if(r<=0)return ks[i].id;}
    return ks[ks.length-1].id;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'), 2200);
    }
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function toggleMode() {
    setIsDark(!isDark);
  }
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  },[isDark]);

  // Bewertung view actions
  useEffect(() => {
    if (!tagesKollegeId && data.kollegen.length) {
      setTagesKollegeId(pickRandom());
    }
  }, [data.kollegen]);

  function updateScore(val) {
    setBewertungPunkte(parseInt(val));
  }
  function neuerVorschlag() {
    const prev = tagesKollegeId;
    if (data.kollegen.length > 1) {
      let n = prev, t = 0;
      while (n === prev && t < 10) { n = pickRandom(); t++; }
      setTagesKollegeId(n);
    } else {
      setTagesKollegeId(pickRandom());
    }
    setBewertungPunkte(5);
  }
  function bewertungAbgeben() {
    const k = data.kollegen.find(k=>k.id===tagesKollegeId);
    if (!k) return;
    const anmEl = document.getElementById('anmerkungField');
    const anm = anmEl ? anmEl.value.trim() : '';
    const newData = {...data};
    newData.bewertungen = [...newData.bewertungen, {id:uid(),kollegeId:k.id,punkte:bewertungPunkte,anmerkung:anm,datum:new Date().toISOString()}];
    setData(newData);
    showToast('Bewertung für '+k.name+' gespeichert');
    neuerVorschlag();
  }

  // Kollegen view
  function toggleAddKollege() { setAddKollegeOpen(!addKollegeOpen); }
  function kollegeHinzufuegen() {
    const nameEl = document.getElementById('newName');
    if (!nameEl) return;
    const name = nameEl.value.trim();
    if (!name) { showToast('Bitte Name eingeben'); return; }
    const posEl = document.getElementById('newPosition');
    const pos = posEl ? posEl.value.trim() : '';
    const avatarEl = document.getElementById('newAvatar');
    const avatar = avatarEl ? avatarEl.value || '👤' : '👤';
    const newData = {...data};
    newData.kollegen = [...newData.kollegen, {id:uid(),name,position:pos,avatar}];
    setData(newData);
    setAddKollegeOpen(false);
    showToast(name+' hinzugefügt');
  }

  function openDetail(id) { setSelectedKollegeId(id); setCurrentView('detail'); }
  function kollegeLoeschen(id) {
    if (!window.confirm('Kollegen wirklich löschen?')) return;
    const newData = {
      kollegen: data.kollegen.filter(k=>k.id!==id),
      bewertungen: data.bewertungen.filter(b=>b.kollegeId!==id),
      ereignisse: data.ereignisse.filter(e=>e.kollegeId!==id),
    };
    setData(newData);
    showToast('Kollege gelöscht');
    setCurrentView('kollegen');
  }

  function addEreignis() {
    const textEl = document.getElementById('ereignisText');
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) { showToast('Bitte Text eingeben'); return; }
    const newData = {...data};
    newData.ereignisse = [...newData.ereignisse, {id:uid(),kollegeId:selectedKollegeId,typ:ereignisTyp,text,datum:new Date().toISOString()}];
    setData(newData);
    showToast('Ereignis gespeichert');
    setAddEreignisOpen(false);
  }

  // filter view
  function setFilter(t) { setFilterTyp(t); }

  // rendering helpers
  const kollege = data.kollegen.find(k=>k.id===tagesKollegeId);
  const avg = kollege ? getAvg(kollege.id) : null;

  return (
    <div className="app">
      <div className="header">
        {currentView !== 'bewertung' && <button className="back-btn" onClick={()=>setCurrentView('bewertung')}>←</button>}
        <div className="header-title">Tagesbewertung</div>
        <div style={{flex:1}} />
        <button className="mode-btn" onClick={toggleMode} title="Night Mode">{isDark ? '☀️' : '🌙'}</button>
        <div style={{flex:1,display:'flex',justifyContent:'flex-end'}}>
          <div className="ali-logo">
            <span className="ali-c">c</span><span className="ali-o">o</span><span className="ali-d">d</span><span className="ali-e">e</span><span className="ali-b">b</span><span className="ali-y">y</span><span className="ali-a">a</span><span className="ali-l">l</span><span className="ali-i">i</span>
          </div>
        </div>
      </div>

      {/* views */}
      {currentView === 'bewertung' && (
        <div className="content view">
          {data.kollegen.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">👤</div>Noch keine Kollegen angelegt.<br />Gehe zu <em>Kollegen</em> um anzufangen.
            </div>
          ) : (
            <>
              {kollege && (
                <div className="hero-card">
                  <span className="hero-emoji">{kollege.avatar||'👤'}</span>
                  <div className="hero-name">{kollege.name}</div>
                  {kollege.position && <div className="hero-pos">{kollege.position}</div>}
                  {avg && <div className="hero-avg">Ø <span style={{color: ratingColor(parseFloat(avg))}}>{avg}</span></div>}
                </div>
              )}
              <div className="card">
                <div style={{textAlign:'center',marginBottom:20}}>
                  <div className="label">Heute bewerten</div>
                  <div className="big-score" id="bigScore" style={{color:ratingColor(bewertungPunkte)}}>{bewertungPunkte}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2,fontWeight:500}}>von 10</div>
                </div>
                <input type="range" min="1" max="10" value={bewertungPunkte} onChange={e=>updateScore(e.target.value)} />
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)',marginTop:7,marginBottom:20,fontWeight:500}}>
                  <span>1 — schlecht</span><span>10 — sehr gut</span>
                </div>
                <div className="field">
                  <label className="label">Anmerkung</label>
                  <textarea className="textarea" id="anmerkungField" placeholder="Warum diese Bewertung?" />
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-secondary" style={{flex:1}} onClick={neuerVorschlag}>Überspringen</button>
                <button className="btn btn-primary" style={{flex:2}} onClick={bewertungAbgeben}>Speichern</button>
              </div>
            </>
          )}
        </div>
      )}

      {currentView === 'kollegen' && (
        <div className="content view">
          <div className="section-header">
            <div className="section-title">{data.kollegen.length} Kollegen</div>
            <button className="btn btn-primary btn-sm" onClick={toggleAddKollege}>+ Hinzufügen</button>
          </div>
          {addKollegeOpen && (
            <div id="addKollegeForm" style={{display:'block'}}>
              <div className="card" style={{marginBottom:16}}>
                <div className="field">
                  <label className="label">Avatar</label>
                  <input className="input" id="newAvatar" placeholder="👤" defaultValue="👤" />
                </div>
                <div className="field"><label className="label">Name</label><input className="input" id="newName" placeholder="Max Mustermann" autoComplete="off"/></div>
                <div className="field"><label className="label">Position</label><input className="input" id="newPosition" placeholder="z. B. Teamleiter" autoComplete="off"/></div>
                <div className="btn-row">
                  <button className="btn btn-secondary" style={{flex:1}} onClick={toggleAddKollege}>Abbrechen</button>
                  <button className="btn btn-primary" style={{flex:2}} onClick={kollegeHinzufuegen}>Speichern</button>
                </div>
              </div>
            </div>
          )}
          {data.kollegen.length===0 ? (
            <div className="empty"><div className="empty-icon">👥</div>Noch keine Kollegen.<br/>Füge deinen ersten Kollegen hinzu!</div>
          ) : (
            data.kollegen.map(k => {
              const avgk = getAvg(k.id);
              const bc = data.bewertungen.filter(b=>b.kollegeId===k.id).length;
              const col = avgk?ratingColor(parseFloat(avgk)):'var(--text3)';
              return (
                <div key={k.id} className="kollege-row" onClick={()=>openDetail(k.id)}>
                  <div style={{fontSize:34,width:48,textAlign:'center',flexShrink:0}}>{k.avatar||'👤'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:600,letterSpacing:'-0.01em'}}>{esc(k.name)}</div>
                    {k.position && <div className="meta" style={{marginTop:2}}>{esc(k.position)}</div>}
                    <div className="meta" style={{marginTop:2}}>{bc} Bewertung{bc!==1?'en':''}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{color:col,fontSize:22,fontWeight:600}}>{avgk||'–'}</div>
                    <div style={{color:'var(--text3)',fontSize:18}}>›</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {currentView === 'detail' && detailKollege && (
        <div className="content view">
          <div style={{textAlign:'center',marginBottom:20}}>
            <div id="heroAvatarDisplay" style={{fontSize:64,cursor:'pointer',display:'block',marginBottom:6}}>{detailKollege.avatar||'👤'}</div>
            <div style={{fontSize:10,color:'var(--text3)',fontWeight:500,letterSpacing:0.06,marginBottom:10}}>TIPPEN ZUM ÄNDERN</div>
            <div style={{fontSize:24,fontWeight:700,letterSpacing:-0.02}}>{esc(detailKollege.name)}</div>
            {detailKollege.position && <div className="meta" style={{marginTop:4}}>{esc(detailKollege.position)}</div>}
          </div>
          <div className="stat-row">
            <div className="stat-box"><div className="stat-val" style={{color:detailAvg?ratingColor(parseFloat(detailAvg)):'var(--text3)'}}>{detailAvg||'–'}</div><div className="stat-label">Ø Wert</div></div>
            <div className="stat-box"><div className="stat-val" style={{color:'var(--acc)'}}>{detailBew.length}</div><div className="stat-label">Bewertet</div></div>
            <div className="stat-box"><div className="stat-val" style={{color:'var(--green)'}}>{posCnt}</div><div className="stat-label">Positiv</div></div>
            <div className="stat-box"><div className="stat-val" style={{color:'var(--red)'}}>{negCnt}</div><div className="stat-label">Negativ</div></div>
          </div>
          <div className="section-header">
            <div className="section-title">Ereignisse</div>
            <button className="btn btn-secondary btn-sm" onClick={()=>setAddEreignisOpen(!addEreignisOpen)}>+ Ereignis</button>
          </div>
          {addEreignisOpen && (
            <div id="addEreignisForm" style={{display:'block'}}>
              <div className="card" style={{marginBottom:12}}>
                <div className="type-toggle">
                  <button className={`type-btn pos ${ereignisTyp==='positiv'?'active':''}`} onClick={()=>setEreignisTyp('positiv')}>✦ Positiv</button>
                  <button className={`type-btn neg ${ereignisTyp==='negativ'?'active':''}`} onClick={()=>setEreignisTyp('negativ')}>◆ Negativ</button>
                </div>
                <div className="field"><label className="label">Was ist passiert?</label><textarea className="textarea" id="ereignisText" placeholder="Beschreibe das Ereignis..." /></div>
                <div className="btn-row">
                  <button className="btn btn-secondary" style={{flex:1}} onClick={()=>setAddEreignisOpen(false)}>Abbrechen</button>
                  <button className="btn btn-primary" style={{flex:2}} onClick={addEreignis}>Speichern</button>
                </div>
              </div>
            </div>
          )}
          {detailEre.length ? detailEre.map(e=>(
            <div key={e.id} className={`card ${e.typ==='positiv'?'pos':'neg'}`}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span className={`tag ${e.typ==='positiv'?'pos':'neg'}`}>{e.typ}</span>
                <span className="meta">{fmt(e.datum)}</span>
              </div>
              <div style={{fontSize:14,lineHeight:1.65}}>{esc(e.text)}</div>
            </div>
          )) : <div className="card" style={{textAlign:'center',padding:24,color:'var(--text3)',fontSize:13}}>Noch keine Ereignisse</div>}
          {detailBew.length ? <>
            <div className="section-header" style={{marginTop:6}}><div className="section-title">Bewertungshistorie</div></div>
            {detailBew.map(b=>(
              <div key={b.id} className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:28,fontWeight:600,letterSpacing:-0.02,color:ratingColor(b.punkte)}}>{b.punkte}</div>
                  <span className="meta">{fmt(b.datum)}</span>
                </div>
                {b.anmerkung && <><hr className="divider"/><div style={{fontSize:13,color:'var(--text2)',lineHeight:1.65}}>{esc(b.anmerkung)}</div></>}
              </div>
            ))}
          </> : null}
          <button className="btn btn-danger btn-full" style={{marginTop:14}} onClick={()=>kollegeLoeschen(detailKollege.id)}>Kollege löschen</button>
        </div>
      )}

      {currentView === 'filter' && (
        <div className="content view">
          <div className="stat-row">
            <div className="stat-box" style={{borderColor:'rgba(52,199,89,0.3)'}}><div className="stat-val" style={{color:'var(--green)'}}>{data.ereignisse.filter(e=>e.typ==='positiv').length}</div><div className="stat-label">Positiv</div></div>
            <div className="stat-box" style={{borderColor:'rgba(255,59,48,0.25)'}}><div className="stat-val" style={{color:'var(--red)'}}>{data.ereignisse.filter(e=>e.typ==='negativ').length}</div><div className="stat-label">Negativ</div></div>
            <div className="stat-box"><div className="stat-val" style={{color:'var(--acc)'}}>{data.ereignisse.length}</div><div className="stat-label">Gesamt</div></div>
          </div>
          <div className="filter-tabs">
            <button className={`filter-tab ${filterTyp==='alle'?'active':''}`} onClick={()=>setFilter('alle')}>Alle</button>
            <button className={`filter-tab ${filterTyp==='positiv'?'active':''}`} onClick={()=>setFilter('positiv')}>✦ Positiv</button>
            <button className={`filter-tab ${filterTyp==='negativ'?'active':''}`} onClick={()=>setFilter('negativ')}>◆ Negativ</button>
          </div>
          {filtered.map(e=>{
            const k = data.kollegen.find(k=>k.id===e.kollegeId) || {};
            return (
              <div key={e.id} className={`card ${e.typ==='positiv'?'pos':'neg'}`}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{k.avatar||'👤'}</span>
                    <span className={`tag ${e.typ==='positiv'?'pos':'neg'}`}>{e.typ}</span>
                    <span style={{fontSize:13,fontWeight:600,color:'var(--acc)'}}>{k.name?esc(k.name):'?'}</span>
                  </div>
                  <span className="meta">{fmt(e.datum)}</span>
                </div>
                <div style={{fontSize:14,lineHeight:1.65}}>{esc(e.text)}</div>
              </div>
            );
          })}
          {filtered.length===0 && <div className="empty"><div className="empty-icon">⊞</div>Keine Ereignisse gefunden</div>}
        </div>
      )}

      <nav className="nav">
        <button className={`nav-btn ${currentView==='bewertung'?'active':''}`} onClick={()=>setCurrentView('bewertung')}>
          <span className="nav-icon">⭐</span>Bewerten
        </button>
        <button className={`nav-btn ${currentView==='kollegen'?'active':''}`} onClick={()=>setCurrentView('kollegen')}>
          <span className="nav-icon">👤</span>Kollegen
        </button>
        <button className={`nav-btn ${currentView==='filter'?'active':''}`} onClick={()=>setCurrentView('filter')}>
          <span className="nav-icon">⊞</span>Abfrage
        </button>
      </nav>
      <div className="toast" id="toast"></div>
    </div>
  );
}
