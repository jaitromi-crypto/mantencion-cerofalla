(() => {
  'use strict';
  const URL_BASE = 'https://hypzysgjpsgmzkztytsq.supabase.co';const API_KEY = 'sb_publishable_8Ql_sMjbEAuYwbyoBQzZIA_LS7fJOq7';
  const SESSION_KEY = 'CF_MANT_SUPABASE_SESSION_V1';
  let session = null;
  const el = id => document.getElementById(id);

  function storeSession(data) {
    session = {...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in};
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  async function validSession() {
    try {
      const s = session || JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return false;
      if (s.expires_at > Date.now() / 1000 + 60) { session = s; return true; }
      const r = await fetch(URL_BASE + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: {apikey: API_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({refresh_token: s.refresh_token})
      });
      if (!r.ok) throw Error('Sesión vencida');
      storeSession(await r.json()); return true;
    } catch (e) { session = null; localStorage.removeItem(SESSION_KEY); return false; }
  }
  async function login() {
    if (await validSession()) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#111e;z-index:9999;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = '<form style="background:white;color:#111;padding:24px;border-radius:12px;display:grid;gap:12px;width:min(400px,100%)"><h2>CERO FALLA · Mantenciones</h2><p>Ingresa con la misma cuenta de OT y Cotizaciones.</p><input type="email" required autocomplete="username" placeholder="Correo" style="padding:12px"><input type="password" required autocomplete="current-password" placeholder="Contraseña" style="padding:12px"><button type="submit">Ingresar</button><small></small></form>';
    document.body.appendChild(overlay);
    await new Promise(resolve => {
      overlay.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        const form = event.currentTarget, msg = form.querySelector('small');
        msg.textContent = 'Conectando…';
        try {
          const response = await fetch(URL_BASE + '/auth/v1/token?grant_type=password', {
            method: 'POST', headers: {apikey: API_KEY, 'Content-Type': 'application/json'},
            body: JSON.stringify({email: form.querySelector('[type=email]').value.trim(), password: form.querySelector('[type=password]').value})
          });
          if (!response.ok) throw Error('Correo o contraseña incorrectos');
          storeSession(await response.json()); overlay.remove(); resolve();
        } catch (error) { msg.textContent = error.message; }
      };
    });
  }
  async function request(path, options = {}) {
    await login();
    if (!await validSession()) throw Error('No hay sesión válida');
    const response = await fetch(URL_BASE + '/rest/v1/' + path, {
      ...options,
      headers: {apikey: API_KEY, Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json', ...(options.headers || {})}
    });
    if (!response.ok) throw Error('Supabase ' + response.status + ': ' + (await response.text()).slice(0, 250));
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }
  async function remoteRecord(id) {
    const found = await request('cf_mantenciones?id=eq.' + encodeURIComponent(id) + '&select=datos&limit=1');
    return found[0]?.datos || null;
  }
  async function uploadRecord(record) {
    await request('cf_mantenciones?on_conflict=id', {
      method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify({id: record.id, datos: record, actualizado_en: record.updated || new Date().toISOString()})
    });
  }
  async function keepLocal(record) {
    await idbPut(record);
    const all = records(), index = all.findIndex(x => x.id === record.id);
    if (index < 0) all.unshift(lightRecord(record));
    else all[index] = lightRecord(record);
    writeRecords(all);
  }
  // Comparación semántica: ignora fecha de guardado y campos vacíos equivalentes.
  function canonical(record) {
    const clean = value => {
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value).sort()) {
          if (key === 'updated' || key === 'created') continue;
          const v = clean(value[key]);
          if (v !== '' && v !== null && v !== undefined &&
              !(Array.isArray(v) && !v.length) &&
              !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) out[key] = v;
        }
        return out;
      }
      return value == null ? '' : value;
    };
    return JSON.stringify(clean(record));
  }
  const BASELINE_KEY = 'CF_MANT_CLOUD_BASELINES_V1';
  function baselines() { try { return JSON.parse(localStorage.getItem(BASELINE_KEY) || '{}'); } catch { return {}; } }
  function rememberBaseline(id, record) {
    const b = baselines(); b[id] = canonical(record);
    localStorage.setItem(BASELINE_KEY, JSON.stringify(b));
  }
  async function syncNow() {
    const button = el('cfSyncBtn'); button.disabled = true; button.textContent = 'Sincronizando…';
    try {
      await login();
      let uploaded = 0, downloaded = 0, conflicts = 0, identical = 0;
      const cloud = await request('cf_mantenciones?select=datos&limit=1000');
      const remoteById = new Map(cloud.map(row => [row.datos.id, row.datos]));
      const base = baselines();
      for (const summary of records()) {
        const full = await idbGet(summary.id) || summary;
        const remote = remoteById.get(summary.id);
        if (!remote) {
          await uploadRecord(full); rememberBaseline(full.id, full); uploaded++;
        } else if (canonical(full) === canonical(remote)) {
          rememberBaseline(full.id, remote); identical++;
        } else if (base[full.id] && base[full.id] === canonical(remote)) {
          await uploadRecord(full); rememberBaseline(full.id, full); uploaded++;
        } else if (base[full.id] && base[full.id] === canonical(full)) {
          await keepLocal(remote); rememberBaseline(remote.id, remote); downloaded++;
        } else {
          conflicts++;
          console.warn('Mantención con versiones distintas protegidas:', full.id);
        }
      }
      for (const row of cloud) {
        const record = row.datos;
        if (!records().some(x => x.id === record.id)) {
          await keepLocal(record); rememberBaseline(record.id, record); downloaded++;
        }
      }
      renderHistory();
      alert('Sincronización protegida. Subidas: ' + uploaded +
        ' · Descargadas: ' + downloaded + ' · Coincidentes: ' + identical +
        ' · Diferencias sin resolver: ' + conflicts + ' · Historial: ' + records().length +
        (conflicts ? '\\nNo se modificaron los registros en conflicto. Conserva los respaldos.' : ''));
    } catch (error) {
      console.error(error);
      alert('No se pudo completar la sincronización: ' + error.message + '\\nNo se borraron los registros locales.');
    } finally { button.disabled = false; button.textContent = '☁ Sincronizar'; }
  }
  // Resolución explícita de conflictos: nunca se ejecuta automáticamente.
  async function resolveConflicts() {
    const button = el('cfResolveBtn');
    button.disabled = true; button.textContent = 'Revisando diferencias…';
    try {
      await login();
      const cloud = await request('cf_mantenciones?select=datos&limit=1000');
      const remoteById = new Map(cloud.map(row => [row.datos.id, row.datos]));
      let resolved = 0, skipped = 0;
      for (const summary of records()) {
        const local = await idbGet(summary.id) || summary;
        const remote = remoteById.get(summary.id);
        if (!remote || canonical(local) === canonical(remote)) continue;
        const meta = remote.meta || {};
        const name = [meta.patente, meta.marca, meta.modelo].filter(Boolean).join(' · ') || remote.id;
        const localPhotos = JSON.stringify(local).match(/data:image\\//g)?.length || 0;
        const cloudPhotos = JSON.stringify(remote).match(/data:image\\//g)?.length || 0;
        const yes = confirm('DIFERENCIA DETECTADA: ' + name +
          '\\n\\nFotos incrustadas en celular: ' + localPhotos +
          '\\nFotos incrustadas en nube: ' + cloudPhotos +
          '\\n\\nAceptar reemplazará SOLO esta mantención del celular por la versión de Supabase. ' +
          'No cambiará la nube ni las otras mantenciones. Conserva tu respaldo JSON.\\n\\n¿Recuperar versión de la nube?');
        if (!yes) { skipped++; continue; }
        // Comprobar que la versión remota no haya cambiado durante la confirmación.
        const fresh = await remoteRecord(remote.id);
        if (!fresh || canonical(fresh) !== canonical(remote)) {
          alert('La versión de la nube cambió durante la revisión. Vuelve a intentarlo.');
          skipped++; continue;
        }
        await keepLocal(fresh);
        rememberBaseline(fresh.id, fresh);
        resolved++;
      }
      renderHistory();
      alert('Recuperadas desde la nube: ' + resolved + ' · Pendientes: ' + skipped +
        ' · Historial: ' + records().length + '\\nConserva el respaldo JSON.');
    } catch (error) {
      console.error(error);
      alert('No se pudo resolver la diferencia: ' + error.message);
    } finally {
      button.disabled = false; button.textContent = '🔎 Resolver diferencias';
    }
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'CERO_FALLA_MANT_BACKUP_V1' || !Array.isArray(backup.records) ||
          backup.records.some(x => !x.id || !x.meta || !x.items)) throw Error('Archivo de respaldo no válido');
      await login();
      if (!confirm('¿Importar ' + backup.records.length + ' mantenciones con sus fotos? No se reemplazarán registros existentes.')) return;
      let imported = 0, existing = 0;
      for (const record of backup.records) {
        if (records().some(x => x.id === record.id) || await remoteRecord(record.id)) { existing++; continue; }
        await uploadRecord(record);
        await keepLocal(record);
        imported++;
      }
      renderHistory();
      alert('Importadas: ' + imported + ' · Ya existentes: ' + existing + ' · Total: ' + records().length + '\nConserva el respaldo hasta comprobar las fotos.');
    } catch (error) {
      console.error(error);
      alert('Error al importar: ' + error.message + '\nEl archivo original permanece intacto.');
    } finally { el('cfImportFile').value = ''; }
  }
  // Guardado automático con comprobación de versión y sin reemplazar cambios ajenos.
  const saveQueues = new Map();
  window.cfAutoSave = record => {
    const id = record.id;
    const previous = saveQueues.get(id) || Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      const state = el('saveState');
      if (!await validSession()) {
        if (state) state.textContent = 'Guardado local · inicia sesión y sincroniza';
        return;
      }
      try {
        const rows = await request('cf_mantenciones?id=eq.' + encodeURIComponent(id) +
          '&select=datos,actualizado_en&limit=1');
        const row = rows[0], base = baselines()[id];
        if (row && canonical(row.datos) === canonical(record)) {
          rememberBaseline(id, row.datos);
          if (state) state.textContent = 'Guardado en nube ✓';
          return;
        }
        if (row && (!base || canonical(row.datos) !== base)) {
          if (state) state.textContent = 'Guardado local · conflicto, no sobrescrito';
          console.warn('Versión distinta en nube, mantención protegida:', id);
          return;
        }
        if (row) {
          const result = await request('cf_mantenciones?id=eq.' + encodeURIComponent(id) +
            '&actualizado_en=eq.' + encodeURIComponent(row.actualizado_en) + '&select=id', {
            method: 'PATCH', headers: {Prefer: 'return=representation'},
            body: JSON.stringify({datos: record, actualizado_en: record.updated})
          });
          if (!Array.isArray(result) || result.length !== 1) throw Error('Cambio simultáneo detectado');
        } else {
          await request('cf_mantenciones', {
            method: 'POST', headers: {Prefer: 'return=minimal'},
            body: JSON.stringify({id, datos: record, actualizado_en: record.updated})
          });
        }
        rememberBaseline(id, record);
        if (state) state.textContent = 'Guardado en nube ✓';
      } catch (error) {
        console.warn('Guardado local conservado; nube pendiente:', error);
        if (state) state.textContent = 'Guardado local · nube pendiente';
      }
    });
    saveQueues.set(id, task);
  };
  function setup() {
    const home = el('homeView');
    if (!home || !el('backupBtn')) return;
    const bar = el('backupBtn').parentElement;
    const importBtn = document.createElement('button'); importBtn.id = 'cfImportBtn';
    importBtn.type = 'button'; importBtn.textContent = '📥 Importar respaldo';
    const fileInput = document.createElement('input'); fileInput.id = 'cfImportFile';
    fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.hidden = true;
    const syncBtn = document.createElement('button'); syncBtn.id = 'cfSyncBtn';
    syncBtn.type = 'button'; syncBtn.textContent = '☁ Sincronizar';
    const resolveBtn = document.createElement('button'); resolveBtn.id = 'cfResolveBtn';
    resolveBtn.type = 'button'; resolveBtn.textContent = '🔎 Resolver diferencias';
    bar.append(importBtn, fileInput, syncBtn, resolveBtn);
    importBtn.onclick = () => fileInput.click();
    fileInput.onchange = event => importBackup(event.target.files[0]);
    syncBtn.onclick = syncNow;
    resolveBtn.onclick = resolveConflicts;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
