const SECTIONS={"REVISIÓN EXTERNA Y CARROCERÍA":["Óxidos visibles","Vidrios, parabrisas, espejos","Estado y desgaste de neumáticos","Grabado de Patentes","Llantas / Ruedas","Molduras y plásticos"],"LUCES":["Luz interior","Posición delantera","Luces Bajas","Luces Altas","Intermitentes delanteros","Neblineros delanteros","Luces laterales delanteras","Posición Traseras","Luces de Freno","Luz de Patente","Neblineros traseros","Laterales Traseras"],"NEUMÁTICOS":["Delantero Derecho","Delantero Izquierdo","Trasero Derecho","Trasero Izquierdo","Repuesto","Todos iguales?","Pernos llantas"],"MOTOR Y COMPONENTES":["Aceite de Motor","Refrigerante","Líquido de freno","Líquido de embrague","Líquido de dirección","Batería","Sistema de Carga (alternador)","Vapores sistema de combustión","Hermeticidad de escape","Sonido de motor","Filtro de Aire","Fugas visibles","Correas de accesorios / Mangueras"],"FRENOS":["Discos y Pastillas delanteras","Discos y Pastillas traseras","Cañerías, Calipers, Flexibles","Freno de Mano"],"SUSPENSIÓN Y DIRECCIÓN":["Amortiguadores Delanteros","Cazoletas Delanteras","Bieletas Delanteras","Amortiguadores Traseros","Cazoletas Traseras","Juego rodamientos de rueda","Juego en terminales de dirección"],"REVISIÓN INTERIOR Y EQUIPAMIENTO":["Asistencia reversa (sensores / cámara)","Limpia Parabrisas Plumillas / Lavaparabrisas","Reseteo de Aceite / Mantención / IOLM","Extintor","Cierre Centralizado","Inspección de tablero (luces de alertas)","Bocina","Alzavidrios Eléctricos","Espejos Eléctricos","Comandos al volante","Telecomando y Señalizadores","Aire Acondicionado","Calefacción","Estado de Tapicería","Radio o Multimedia","Cinturones de seguridad"],"DIAGNÓSTICO SCANNER":["Scanner (DTCs) de módulos","Verificación de VIN","Verificación de kilometraje","Verificación de Compresión (si está disponible)"],"PRUEBA DE RUTA":["Se realiza?","Estabilidad RPM en Ralenti","Balanceo","Alineación (cargas evidentes)","Eficiencia, equilibrio y ruidos de frenado","Estado transmisión automática","Funcionamiento Embrague (mecánico)","Temperatura Motor","Sonidos de suspensión","Funcionamiento 4x4","Sistema escape, humos, estanqueidad"]};
const DB='CF_MANT_V5',ACTIVE='CF_MANT_ACTIVE_V5';let current=null,timer=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').toLowerCase();
function records(){try{const x=JSON.parse(localStorage.getItem(DB)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function writeRecords(a){localStorage.setItem(DB,JSON.stringify(a))}
function newRecord(){return{id:'CF-'+Date.now(),created:new Date().toISOString(),updated:new Date().toISOString(),meta:{fecha:new Date().toISOString().slice(0,10)},items:{},conclusion:''}}
function extra(sec,item){if(sec==='NEUMÁTICOS'&&/Derecho|Izquierdo|Repuesto/.test(item))return['Medida neumático','Profundidad dibujo (mm)'];if(item==='Batería')return['Voltaje','CCA / estado'];if(item==='Líquido de freno')return['% humedad / medición'];if(/Discos y Pastillas/.test(item))return['Espesor / desgaste','Detalle por eje'];return[]}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function showHome(){saveNow(true);$('#formView').classList.add('hidden');$('#homeView').classList.remove('hidden');$('#bottomBar').classList.add('hidden');renderHistory();scrollTo(0,0)}
function showForm(){$('#homeView').classList.add('hidden');$('#formView').classList.remove('hidden');$('#bottomBar').classList.remove('hidden');fillMeta();renderChecklist();scrollTo(0,0)}
function create(){current=newRecord();saveNow(true);showForm()}
function fillMeta(){$$('[data-meta]').forEach(i=>i.value=current?.meta?.[i.dataset.meta]||'');$('#conclusion').value=current?.conclusion||''}
function renderChecklist(){const host=$('#checklist');host.innerHTML='';Object.entries(SECTIONS).forEach(([sec,items])=>{const box=document.createElement('section');box.className='section';box.innerHTML='<h2>'+sec+'</h2>';items.forEach(item=>{const key=slug(sec+'_'+item),d=current.items[key]||{photos:[],extras:{}};const el=document.createElement('div');el.className='item';el.dataset.key=key;el.innerHTML=`<div class="item-title">${esc(item)}</div><div class="status"><button data-v="ok">✓ OK</button><button data-v="warn">! Atención</button><button data-v="bad">✕ Intervención</button><button data-v="na">N/A</button></div><input class="obs" placeholder="Observación" value="${esc(d.obs)}"><div class="extras">${extra(sec,item).map(x=>`<label>${esc(x)}<input data-extra="${esc(x)}" value="${esc((d.extras||{})[x])}"></label>`).join('')}</div><div class="photo"><b>Fotos</b><div class="photo-actions"><label class="photo-btn">📷 Tomar foto<input class="photo-input camera" type="file" accept="image/*" capture="environment"></label><label class="photo-btn gallery">▣ Galería<input class="photo-input gallery-in" type="file" accept="image/*" multiple></label></div><div class="thumbs"></div></div>`;if(d.status)el.querySelector(`[data-v="${d.status}"]`)?.classList.add('active');box.appendChild(el);bindItem(el,key)});host.appendChild(box)});counts()}
function bindItem(el,key){el.querySelectorAll('.status button').forEach(b=>b.onclick=()=>{el.querySelectorAll('.status button').forEach(x=>x.classList.remove('active'));b.classList.add('active');schedule();counts()});el.querySelector('.obs').oninput=schedule;el.querySelectorAll('[data-extra]').forEach(i=>i.oninput=schedule);el.querySelectorAll('.photo-input').forEach(inp=>inp.onchange=async e=>{for(const f of [...e.target.files]){const pic=await compress(f);current.items[key]=current.items[key]||{extras:{},photos:[]};current.items[key].photos=current.items[key].photos||[];current.items[key].photos.push(pic)}e.target.value='';renderPhotos(el,key);saveNow(true)});renderPhotos(el,key)}
function compress(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const max=850,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.55))};im.onerror=reject;im.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}
function renderPhotos(el,key){const box=el.querySelector('.thumbs'),pics=current.items[key]?.photos||[];box.innerHTML='';pics.forEach((src,i)=>{const w=document.createElement('div');w.className='thumb';w.innerHTML=`<img src="${src}" alt="Foto de revisión"><button type="button">×</button>`;w.querySelector('img').onclick=()=>{$('#fullPhoto').src=src;$('#photoModal').classList.remove('hidden')};w.querySelector('button').onclick=ev=>{ev.stopPropagation();pics.splice(i,1);renderPhotos(el,key);saveNow(true)};box.appendChild(w)})}
function collect(){if(!current)return;$$('[data-meta]').forEach(i=>current.meta[i.dataset.meta]=i.value);current.conclusion=$('#conclusion').value;$$('.item').forEach(el=>{const key=el.dataset.key,x=current.items[key]||{photos:[],extras:{}};x.photos=x.photos||[];x.status=el.querySelector('.status .active')?.dataset.v||'';x.obs=el.querySelector('.obs').value;x.extras={};el.querySelectorAll('[data-extra]').forEach(i=>x.extras[i.dataset.extra]=i.value);current.items[key]=x})}
function saveNow(silent=false){if(!current)return;collect();current.updated=new Date().toISOString();let a=records(),i=a.findIndex(x=>x.id===current.id);if(i<0)a.unshift(current);else a[i]=current;try{writeRecords(a);localStorage.setItem(ACTIVE,current.id);$('#saveState').textContent='Guardado ✓ '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});if(!silent)alert('Revisión guardada.')}catch(e){$('#saveState').textContent='Error al guardar';if(!silent)alert('No se pudo guardar. Puede haberse llenado el almacenamiento del navegador.')}}
function schedule(){clearTimeout(timer);$('#saveState').textContent='Guardando…';timer=setTimeout(()=>saveNow(true),300)}
function openRecord(id){const r=records().find(x=>x.id===id);if(!r)return alert('No se encontró la revisión.');current=JSON.parse(JSON.stringify(r));localStorage.setItem(ACTIVE,id);showForm()}
function deleteRecord(id){if(!confirm('¿Eliminar esta revisión?'))return;writeRecords(records().filter(x=>x.id!==id));if(localStorage.getItem(ACTIVE)===id)localStorage.removeItem(ACTIVE);renderHistory()}
function renderHistory(){const a=records(),h=$('#historyList');if(!a.length){h.innerHTML='<div class="empty">Aún no hay revisiones guardadas.</div>';return}h.innerHTML=a.map(x=>`<div class="history-card"><div class="title">${esc(x.meta?.patente||'Sin patente')} · ${esc(x.meta?.marca||'')} ${esc(x.meta?.modelo||'')}</div><small>${esc(x.meta?.cliente||'Sin cliente')} · ${x.updated?new Date(x.updated).toLocaleString('es-CL'):''}</small><div class="history-actions"><button onclick="openRecord('${x.id}')">Abrir / continuar</button><button class="danger" onclick="deleteRecord('${x.id}')">Eliminar</button></div></div>`).join('')}
function counts(){let c={ok:0,warn:0,bad:0,na:0};$$('.status .active').forEach(b=>c[b.dataset.v]++);$('#okCount').textContent=c.ok;$('#warnCount').textContent=c.warn;$('#badCount').textContent=c.bad;$('#naCount').textContent=c.na}
function prepareReport(){saveNow(true);$('#printFolio').textContent='Folio: '+current.id+' · Fecha informe: '+new Date().toLocaleDateString('es-CL');$$('.item').forEach(el=>{const d=current.items[el.dataset.key]||{};el.classList.toggle('print-hide',!(['ok','warn','bad'].includes(d.status)||((d.photos||[]).length>0)))});$$('.section').forEach(sec=>sec.classList.toggle('print-hide',![...sec.querySelectorAll('.item')].some(el=>!el.classList.contains('print-hide'))))}
function clearReportFilter(){$$('.item,.section').forEach(el=>el.classList.remove('print-hide'))}
$('#createBtn').onclick=create;$('#refreshBtn').onclick=renderHistory;$('#backBtn').onclick=showHome;$('#navHistory').onclick=showHome;$('#navSave').onclick=()=>saveNow(false);
$('#navPdf').onclick=()=>{prepareReport();window.print();setTimeout(clearReportFilter,500)};
$('#navTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});$$('[data-meta]').forEach(i=>i.oninput=schedule);$('#conclusion').oninput=schedule;
window.openRecord=openRecord;window.deleteRecord=deleteRecord;renderHistory();
const closePhotoModal=()=>{$('#photoModal').classList.add('hidden');$('#fullPhoto').src=''};$('#closePhoto').onclick=closePhotoModal;$('#photoModal').onclick=e=>{if(e.target.id==='photoModal')closePhotoModal()};

/* V10: Google Drive, permiso restringido drive.file */
const GOOGLE_CLIENT_ID='752698643419-le70dldkh83r5jtmu5gba94pp3u9e49n.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_KEY='CF_DRIVE_FOLDER_V10';
let driveAccessToken='';
function safeFilePart(v){return String(v||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,60)||'Sin_dato'}
function driveFileName(){const m=current?.meta||{},date=m.fecha||new Date().toISOString().slice(0,10);return `${date}_${safeFilePart(m.patente)}_${safeFilePart(m.marca)}_${safeFilePart(m.modelo)}.pdf`}
async function ensureDriveToken(){if(driveAccessToken)return driveAccessToken;if(!window.google?.accounts?.oauth2)throw new Error('Google todavía está cargando. Intenta nuevamente en unos segundos.');return await new Promise((resolve,reject)=>{const tc=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:DRIVE_SCOPE,callback:r=>{if(r.error)return reject(new Error(r.error));driveAccessToken=r.access_token;resolve(driveAccessToken)}});tc.requestAccessToken({prompt:'consent'})})}
async function driveFetch(url,opt={}){const token=await ensureDriveToken();opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token};let r=await fetch(url,opt);if(r.status===401){driveAccessToken='';opt.headers.Authorization='Bearer '+await ensureDriveToken();r=await fetch(url,opt)}if(!r.ok)throw new Error((await r.text())||('Google Drive respondió '+r.status));return r}
async function getOrCreateDriveFolder(){let id=localStorage.getItem(DRIVE_FOLDER_KEY);if(id){try{await driveFetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,trashed');return id}catch(e){localStorage.removeItem(DRIVE_FOLDER_KEY)}}const r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cero Falla Revisiones',mimeType:'application/vnd.google-apps.folder'})});const d=await r.json();localStorage.setItem(DRIVE_FOLDER_KEY,d.id);return d.id}
async function makePdfBlob(){
  prepareReport();
  const {jsPDF}=window.jspdf,pdf=new jsPDF('p','mm','a4');
  const PW=210,PH=297,M=12,CW=PW-M*2,FOOT=13;
  let y=M;
  const statusLabel={ok:'OK',warn:'ATENCIÓN',bad:'INTERVENCIÓN'};
  const statusColor={ok:[28,120,70],warn:[185,120,0],bad:[185,45,45]};

  function footer(){
    pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(90);
    pdf.text('Cero Falla Automotriz SpA · +56 9 6915 2515 · cerofalla.automotriz@gmail.com',M,PH-7);
    pdf.text('Tú no tienes que venir, yo voy.',PW-M,PH-7,{align:'right'});
  }
  function newPage(){ footer(); pdf.addPage(); y=M; }
  function need(h){ if(y+h>PH-FOOT) newPage(); }
  function text(s,x,yy,size=9,style='normal',color=[25,25,25],align='left'){
    pdf.setFont('helvetica',style); pdf.setFontSize(size); pdf.setTextColor(...color);
    pdf.text(String(s||''),x,yy,{align});
  }
  function wrap(s,width,size=8){
    pdf.setFont('helvetica','normal'); pdf.setFontSize(size);
    return pdf.splitTextToSize(String(s||''),width);
  }
  function rule(){ pdf.setDrawColor(215); pdf.line(M,y,PW-M,y); }

  text('CERO',M,y+5,18,'bold');
  text('FALLA',M+20,y+5,18,'bold',[205,25,35]);
  text('ESPECIALISTA AUTOMOTRIZ',M,y+10,7,'bold',[80,80,80]);
  text('INFORME DE REVISIÓN GENERAL Y MANTENIMIENTO',PW-M,y+5,11,'bold',[20,20,20],'right');
  text('Folio: '+current.id,PW-M,y+10,7,'normal',[80,80,80],'right');
  y+=16; rule(); y+=6;

  const m=current.meta||{};
  const meta=[
    ['Cliente',m.cliente],['Fecha',m.fecha],
    ['Marca',m.marca],['Modelo',m.modelo],
    ['VIN / Chasis',m.vin],['N° Motor',m.motor],
    ['Patente',m.patente],['Kilometraje',m.km]
  ];
  for(let i=0;i<meta.length;i+=2){
    const a=meta[i],b=meta[i+1];
    text(a[0]+':',M,y,8,'bold'); text(a[1]||'-',M+25,y,8);
    text(b[0]+':',M+96,y,8,'bold'); text(b[1]||'-',M+123,y,8);
    y+=5;
  }
  y+=2; rule(); y+=6;

  const vals=Object.values(current.items||{}),ct={ok:0,warn:0,bad:0};
  vals.forEach(d=>{ if(Object.prototype.hasOwnProperty.call(ct,d.status)) ct[d.status]++; });
  text('Resumen:',M,y,9,'bold');
  text('OK '+ct.ok,M+22,y,9,'bold',statusColor.ok);
  text('Atención '+ct.warn,M+47,y,9,'bold',statusColor.warn);
  text('Intervención '+ct.bad,M+83,y,9,'bold',statusColor.bad);
  y+=8;

  async function imgDims(src,maxW,maxH){
    return await new Promise(resolve=>{
      const im=new Image();
      im.onload=()=>{const r=Math.min(maxW/im.width,maxH/im.height);resolve({w:im.width*r,h:im.height*r});};
      im.onerror=()=>resolve({w:maxW,h:maxH});
      im.src=src;
    });
  }

  for(const [sec,items] of Object.entries(SECTIONS)){
    const included=items.map(item=>({item,key:slug(sec+'_'+item)})).filter(x=>{
      const d=current.items[x.key]||{};
      return ['ok','warn','bad'].includes(d.status) || (d.photos||[]).length>0;
    });
    if(!included.length) continue;

    need(12);
    pdf.setFillColor(242,242,242); pdf.rect(M,y-4,CW,7,'F');
    text(sec,M+2,y+1,9,'bold'); y+=8;

    for(const x of included){
      const d=current.items[x.key]||{}, photos=d.photos||[];
      const extras=Object.entries(d.extras||{}).filter(([,v])=>String(v||'').trim());
      const details=[];
      if(String(d.obs||'').trim()) details.push('Obs.: '+String(d.obs).trim());
      extras.forEach(([k,v])=>details.push(k+': '+v));
      const detailLines=details.length?wrap(details.join(' · '),CW-4,7.5):[];

      need(8+detailLines.length*3.5);
      text(x.item,M,y,8.5,'bold');
      if(statusLabel[d.status]) text(statusLabel[d.status],PW-M,y,8,'bold',statusColor[d.status],'right');
      y+=4;

      if(detailLines.length){
        pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); pdf.setTextColor(70);
        pdf.text(detailLines,M+2,y);
        y+=detailLines.length*3.5+2;
      }

      if(photos.length){
        for(let p=0;p<photos.length;p+=2){
          const pair=photos.slice(p,p+2), gap=4, boxW=(CW-gap)/2, maxH=58;
          const dims=[];
          for(const src of pair) dims.push(await imgDims(src,boxW,maxH));
          const rowH=Math.max(...dims.map(d2=>d2.h));
          need(rowH+5);
          for(let j=0;j<pair.length;j++){
            const d2=dims[j],x0=M+j*(boxW+gap)+(boxW-d2.w)/2;
            try{pdf.addImage(pair[j],'JPEG',x0,y,d2.w,d2.h,undefined,'FAST');}catch(e){}
          }
          y+=rowH+4;
        }
      }
      rule(); y+=4;
    }
  }

  const conclusion=String(current.conclusion||'').trim();
  if(conclusion){
    const ls=wrap(conclusion,CW-4,8);
    need(12+ls.length*4);
    pdf.setFillColor(242,242,242); pdf.rect(M,y-4,CW,7,'F');
    text('CONCLUSIÓN FINAL / RECOMENDACIONES',M+2,y+1,9,'bold'); y+=8;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(30);
    pdf.text(ls,M+2,y); y+=ls.length*4+4;
  }

  need(22); y+=6;
  text('____________________________',M,y,8);
  text('____________________________',PW-M-58,y,8);
  y+=4;
  text('Técnico Cero Falla',M+8,y,7,'bold');
  text('Recepción cliente',PW-M-50,y,7,'bold');

  footer();
  clearReportFilter();
  return pdf.output('blob');
}
async function uploadPdfToDrive(blob){const folderId=await getOrCreateDriveFolder(),boundary='cf_'+Date.now(),meta={name:driveFileName(),mimeType:'application/pdf',parents:[folderId]},head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/pdf\r\n\r\n',tail='\r\n--'+boundary+'--',body=new Blob([head,blob,tail],{type:'multipart/related; boundary='+boundary});const r=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});return await r.json()}
async function savePdfToDrive(){if(!current)return alert('Abre una revisión primero.');saveNow(true);const b=$('#navDrive'),old=b.innerHTML;b.disabled=true;b.innerHTML='⏳<span>Guardando</span>';try{await ensureDriveToken();const blob=await makePdfBlob(),f=await uploadPdfToDrive(blob);alert('PDF guardado en Google Drive ✓\n\n'+f.name)}catch(e){console.error(e);alert('No se pudo guardar en Drive.\n\n'+e.message)}finally{b.disabled=false;b.innerHTML=old}}
$('#navDrive').onclick=savePdfToDrive;
