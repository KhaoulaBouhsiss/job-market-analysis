/* JobScope — main.js */
const COLORS = {
  accent:"#2563eb",green:"#16a34a",orange:"#d97706",purple:"#7c3aed",red:"#dc2626",
  palette:["#2563eb","#16a34a","#d97706","#7c3aed","#dc2626","#0891b2","#65a30d","#db2777"],
};
let charts={}, currentPage=1, selectedJobId=null, cvFileReady=false;

// ── Navigation
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-"+btn.dataset.view).classList.add("active");
    if(btn.dataset.view==="dashboard") loadDashboard();
    if(btn.dataset.view==="analytics") loadAnalytics();
    if(btn.dataset.view==="browse"){currentPage=1;loadListings();}
    if(btn.dataset.view==="analyzecv") loadOfferTable();
  });
});

// ── Helpers
function fmtSalary(n){return n?"$"+Number(n).toLocaleString("en-US"):"—";}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function baseOpts(extra={}){
  return Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
    scales:{x:{grid:{display:false},ticks:{font:{family:"DM Sans",size:11},color:"#9a9891"}},
            y:{grid:{color:"#f0efec"},ticks:{font:{family:"DM Sans",size:11},color:"#9a9891"},beginAtZero:true}}},extra);
}
function modeBadge(m){
  const c=m==="Remote"?"badge-remote":m==="Hybrid"?"badge-hybrid":"badge-onsite";
  return `<span class="badge ${c}">${esc(m)}</span>`;
}
function animateNumber(el,from,to,duration){
  const start=performance.now();
  (function update(now){const p=Math.min((now-start)/duration,1),e=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*e);if(p<1)requestAnimationFrame(update);})(performance.now());
}

// ── Dashboard
async function loadDashboard(){
  const d=await fetch("/api/stats").then(r=>r.json()).catch(()=>({}));
  if(!d.total_listings)return;
  document.getElementById("statTotal").textContent=d.total_listings;
  document.getElementById("statAvgSalary").textContent=fmtSalary(d.avg_salary);
  document.getElementById("statTopSkill").textContent=d.top_skill;
  document.getElementById("statIndustry").textContent=d.leading_industry;
  document.getElementById("recordCount").textContent=d.total_listings+" enregistrements";

  destroyChart("area");
  charts.area=new Chart(document.getElementById("areaChart"),{type:"line",data:{labels:d.area_chart.labels,datasets:[{data:d.area_chart.values,borderColor:COLORS.accent,backgroundColor:"rgba(37,99,235,0.08)",fill:true,tension:0.35,pointRadius:3}]},options:baseOpts()});
  destroyChart("pie");
  charts.pie=new Chart(document.getElementById("industryPie"),{type:"pie",data:{labels:d.industry_pie.labels,datasets:[{data:d.industry_pie.values,backgroundColor:COLORS.palette,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:10,font:{family:"DM Sans",size:11}}}}}});
  destroyChart("donut");
  charts.donut=new Chart(document.getElementById("workModeDonut"),{type:"doughnut",data:{labels:d.work_mode_donut.labels,datasets:[{data:d.work_mode_donut.values,backgroundColor:[COLORS.green,COLORS.orange,COLORS.purple],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{position:"bottom",labels:{boxWidth:10,font:{family:"DM Sans",size:11}}}}}});
  destroyChart("expBar");
  charts.expBar=new Chart(document.getElementById("experienceBar"),{type:"bar",data:{labels:d.experience_bar.labels,datasets:[{data:d.experience_bar.values,backgroundColor:COLORS.accent,borderRadius:6,maxBarThickness:44}]},options:baseOpts()});
}

// ── Analytics
async function loadAnalytics(){
  const d=await fetch("/api/analytics").then(r=>r.json()).catch(()=>({}));
  if(!d.skills_demand)return;
  destroyChart("skills");
  charts.skills=new Chart(document.getElementById("skillsDemandChart"),{type:"bar",data:{labels:d.skills_demand.labels,datasets:[{data:d.skills_demand.values,backgroundColor:COLORS.purple,borderRadius:6}]},options:baseOpts({indexAxis:"y",scales:{x:{grid:{color:"#f0efec"},ticks:{font:{family:"DM Sans",size:11},color:"#9a9891"},beginAtZero:true},y:{grid:{display:false},ticks:{font:{family:"DM Sans",size:11},color:"#5c5a54"}}}})});
  destroyChart("hist");
  charts.hist=new Chart(document.getElementById("salaryHistogram"),{type:"bar",data:{labels:d.salary_histogram.labels,datasets:[{data:d.salary_histogram.values,backgroundColor:COLORS.green,borderRadius:6,maxBarThickness:50}]},options:baseOpts()});
  destroyChart("trend");
  charts.trend=new Chart(document.getElementById("salaryTrendChart"),{type:"line",data:{labels:d.salary_trend.labels,datasets:[{data:d.salary_trend.values,borderColor:COLORS.orange,backgroundColor:"rgba(217,119,6,0.08)",fill:true,tension:0.35,pointRadius:3}]},options:baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>"$"+ctx.parsed.y.toLocaleString("en-US")}}},scales:{x:{grid:{display:false},ticks:{font:{family:"DM Sans",size:11},color:"#9a9891"}},y:{grid:{color:"#f0efec"},ticks:{callback:v=>"$"+v.toLocaleString("en-US"),font:{family:"DM Sans",size:11},color:"#9a9891"}}}})});
}

// ── Filter options
async function loadFilterOptions(){
  const d=await fetch("/api/filter-options").then(r=>r.json()).catch(()=>({industries:[],work_modes:[],experience_levels:[]}));
  fillSelect(document.getElementById("filterIndustry"),d.industries,"Toutes les industries");
  fillSelect(document.getElementById("filterMode"),d.work_modes,"Tous les modes");
  fillSelect(document.getElementById("filterExperience"),d.experience_levels,"Toutes les expériences");
  fillSelect(document.getElementById("offerIndustry"),d.industries,"Toutes les industries");
  fillSelect(document.getElementById("offerMode"),d.work_modes,"Tous les modes");
}
function fillSelect(sel,vals,def){
  sel.innerHTML=`<option value="">${def}</option>`;
  vals.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
}

// ── Browse listings
async function loadListings(){
  const tbody=document.getElementById("tableBody");
  tbody.innerHTML=`<tr><td colspan="9" class="empty-cell">Chargement…</td></tr>`;
  const p=new URLSearchParams();
  const s=document.getElementById("searchInput").value.trim();
  const i=document.getElementById("filterIndustry").value;
  const m=document.getElementById("filterMode").value;
  const e=document.getElementById("filterExperience").value;
  if(s)p.set("search",s);if(i)p.set("industry",i);if(m)p.set("mode",m);if(e)p.set("experience",e);
  p.set("page",currentPage);p.set("per_page",10);
  const d=await fetch(`/api/listings?${p}`).then(r=>r.json()).catch(()=>({data:[],total_pages:1,page:1}));
  tbody.innerHTML=d.data.length?d.data.map(r=>`<tr>
    <td>${esc(r.job_title)}</td><td>${esc(r.company)}</td><td>${esc(r.industry)}</td>
    <td>${esc(r.location)}</td><td>${modeBadge(r.work_mode)}</td><td>${esc(r.experience_level)}</td>
    <td>${fmtSalary(r.salary)}</td><td class="skills-cell" title="${esc(r.skills)}">${esc(r.skills)}</td>
    <td>${esc(r.posted_date)}</td></tr>`).join(""):`<tr><td colspan="9" class="empty-cell">Aucun résultat.</td></tr>`;
  renderPagination(d.total_pages,d.page);
}

function renderPagination(total,page){
  const wrap=document.getElementById("pagination");
  if(total<=1){wrap.innerHTML="";return;}
  let h=`<button class="page-btn" ${page===1?"disabled":""} data-page="${page-1}">‹</button>`;
  for(let i=1;i<=total;i++){
    if(i===1||i===total||Math.abs(i-page)<=1)h+=`<button class="page-btn ${i===page?"active":""}" data-page="${i}">${i}</button>`;
    else if(i===2||i===total-1)h+=`<span class="page-btn" style="border:none;cursor:default">…</span>`;
  }
  h+=`<button class="page-btn" ${page===total?"disabled":""} data-page="${page+1}">›</button>`;
  wrap.innerHTML=h;
  wrap.querySelectorAll(".page-btn[data-page]").forEach(b=>b.addEventListener("click",()=>{currentPage=parseInt(b.dataset.page);loadListings();}));
}

document.getElementById("searchInput").addEventListener("input",()=>{clearTimeout(window._sd);window._sd=setTimeout(()=>{currentPage=1;loadListings();},350);});
["filterIndustry","filterMode","filterExperience"].forEach(id=>document.getElementById(id).addEventListener("change",()=>{currentPage=1;loadListings();}));
document.getElementById("resetFilters").addEventListener("click",()=>{
  ["searchInput","filterIndustry","filterMode","filterExperience"].forEach(id=>{document.getElementById(id).value="";});
  currentPage=1;loadListings();
});
document.getElementById("exportBtn").addEventListener("click",()=>{
  const p=new URLSearchParams();
  const s=document.getElementById("searchInput").value.trim();
  const i=document.getElementById("filterIndustry").value;
  const m=document.getElementById("filterMode").value;
  const e=document.getElementById("filterExperience").value;
  if(s)p.set("search",s);if(i)p.set("industry",i);if(m)p.set("mode",m);if(e)p.set("experience",e);
  window.location.href=`/api/export?${p}`;
});

// ── Upload CSV
const SCHEMA_FIELDS=[
  {key:"job_title",label:"Job Title"},{key:"company",label:"Company"},{key:"industry",label:"Industry"},
  {key:"location",label:"Location"},{key:"work_mode",label:"Work Mode"},{key:"experience_level",label:"Experience Level"},
  {key:"salary",label:"Salary"},{key:"skills",label:"Skills"},{key:"posted_date",label:"Posted Date"},
];
let parsedCsv=null;
const uploadZone=document.getElementById("uploadZone");
const csvFileInput=document.getElementById("csvFileInput");
uploadZone.addEventListener("dragover",e=>{e.preventDefault();uploadZone.classList.add("drag-over");});
uploadZone.addEventListener("dragleave",()=>uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop",e=>{e.preventDefault();uploadZone.classList.remove("drag-over");const f=e.dataTransfer.files[0];if(f&&f.name.endsWith(".csv"))handleCsv(f);});
csvFileInput.addEventListener("change",()=>{if(csvFileInput.files[0])handleCsv(csvFileInput.files[0]);});
function handleCsv(file){
  document.getElementById("csvFileName").textContent="Fichier : "+file.name;
  document.getElementById("uploadResult").style.display="none";
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{parsedCsv={headers:r.meta.fields||[],rows:r.data};showMapping(parsedCsv.headers);}});
}
function showMapping(headers){
  document.getElementById("mappingGrid").innerHTML=SCHEMA_FIELDS.map(f=>{
    const g=headers.find(h=>h.toLowerCase().replace(/[\s_]/g,""===f.key.replace(/_/g,"")))||headers.find(h=>h.toLowerCase().includes(f.key.split("_")[0]));
    return `<div class="mapping-field"><label>${f.label}</label><select data-target="${f.key}"><option value="">— Ignorer —</option>${headers.map(h=>`<option value="${esc(h)}" ${h===g?"selected":""}>${esc(h)}</option>`).join("")}</select></div>`;
  }).join("");
  document.getElementById("mappingCard").style.display="block";
}
document.getElementById("cancelMappingBtn").addEventListener("click",()=>{document.getElementById("mappingCard").style.display="none";parsedCsv=null;csvFileInput.value="";document.getElementById("csvFileName").textContent="";});
document.getElementById("confirmImportBtn").addEventListener("click",async()=>{
  if(!parsedCsv)return;
  const mapping={};
  document.getElementById("mappingGrid").querySelectorAll("select").forEach(s=>{if(s.value)mapping[s.dataset.target]=s.value;});
  const rows=parsedCsv.rows.map(r=>{const m={};SCHEMA_FIELDS.forEach(f=>{m[f.key]=mapping[f.key]?r[mapping[f.key]]:"";});return m;});
  const btn=document.getElementById("confirmImportBtn");btn.disabled=true;btn.textContent="Importation…";
  try{
    const res=await fetch("/api/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows})});
    const d=await res.json();
    const el=document.getElementById("uploadResult");
    el.textContent=d.error?d.error:`${d.inserted} ligne(s) importée(s).`;
    el.className="upload-result "+(d.error?"error":"success");el.style.display="block";
    if(!d.error){document.getElementById("mappingCard").style.display="none";csvFileInput.value="";document.getElementById("csvFileName").textContent="";parsedCsv=null;}
  }finally{btn.disabled=false;btn.textContent="Importer les données";}
});
document.getElementById("restoreSampleBtn").addEventListener("click",async()=>{
  if(!confirm("Remplacer toutes les données par l'échantillon ?"))return;
  document.getElementById("restoreSampleBtn").disabled=true;
  const d=await fetch("/api/restore-sample",{method:"POST"}).then(r=>r.json());
  const el=document.getElementById("uploadResult");
  el.textContent=`Échantillon restauré : ${d.restored} enregistrements.`;
  el.className="upload-result success";el.style.display="block";
  document.getElementById("restoreSampleBtn").disabled=false;
});

// ── Analyze CV
const cvPdfInput=document.getElementById("cvPdfInput");
const cvPdfName=document.getElementById("cvPdfName");
const analyzeBtn=document.getElementById("analyzeBtn");
const cvDropZone=document.getElementById("cvDropZone");
const cvLoader=document.getElementById("cvLoader");
const cvResults=document.getElementById("cvResults");
const cvForm=document.getElementById("cvForm");

cvPdfInput.addEventListener("change",()=>{
  if(cvPdfInput.files[0]){cvPdfName.textContent=cvPdfInput.files[0].name;cvPdfName.classList.add("has-file");cvFileReady=true;checkReady();}
});
cvDropZone.addEventListener("dragover",e=>{e.preventDefault();cvDropZone.classList.add("drag-over");});
cvDropZone.addEventListener("dragleave",()=>cvDropZone.classList.remove("drag-over"));
cvDropZone.addEventListener("drop",e=>{
  e.preventDefault();cvDropZone.classList.remove("drag-over");
  const f=e.dataTransfer.files[0];
  if(f&&f.type==="application/pdf"){
    const dt=new DataTransfer();dt.items.add(f);cvPdfInput.files=dt.files;
    cvPdfName.textContent=f.name;cvPdfName.classList.add("has-file");cvFileReady=true;checkReady();
  }else alert("PDF uniquement.");
});
function checkReady(){analyzeBtn.disabled=!(cvFileReady&&selectedJobId);}

// Offer table
let offerDebounce;
async function loadOfferTable(){
  const tbody=document.getElementById("offerTableBody");
  tbody.innerHTML=`<tr><td colspan="8" class="empty-cell">Chargement…</td></tr>`;
  const p=new URLSearchParams();
  const s=document.getElementById("offerSearch").value.trim();
  const i=document.getElementById("offerIndustry").value;
  const m=document.getElementById("offerMode").value;
  if(s)p.set("search",s);if(i)p.set("industry",i);if(m)p.set("mode",m);
  p.set("per_page",100);p.set("page",1);
  const data=await fetch(`/api/listings?${p}`).then(r=>r.json()).catch(()=>({data:[]}));
  if(!data.data.length){tbody.innerHTML=`<tr><td colspan="8" class="empty-cell">Aucune offre trouvée.</td></tr>`;return;}
  tbody.innerHTML=data.data.map(r=>`
    <tr class="offer-row ${selectedJobId==r.id?"offer-selected":""}"
        data-id="${r.id}" data-name="${esc(r.job_title)} — ${esc(r.company)}">
      <td><input type="radio" name="offerRadio" ${selectedJobId==r.id?"checked":""}></td>
      <td><strong>${esc(r.job_title)}</strong></td>
      <td>${esc(r.company)}</td>
      <td>${esc(r.industry)}</td>
      <td>${modeBadge(r.work_mode)}</td>
      <td>${esc(r.experience_level)}</td>
      <td>${fmtSalary(r.salary)}</td>
      <td class="skills-cell" title="${esc(r.skills)}">${esc(r.skills)}</td>
    </tr>`).join("");
  tbody.querySelectorAll(".offer-row").forEach(row=>{
    row.addEventListener("click",()=>{
      selectedJobId=row.dataset.id;
      tbody.querySelectorAll(".offer-row").forEach(r=>r.classList.remove("offer-selected"));
      row.classList.add("offer-selected");
      row.querySelector("input[type=radio]").checked=true;
      document.getElementById("selectedOfferBox").style.display="flex";
      document.getElementById("selectedOfferName").textContent=row.dataset.name;
      checkReady();
    });
  });
}

document.getElementById("offerSearch").addEventListener("input",()=>{clearTimeout(offerDebounce);offerDebounce=setTimeout(loadOfferTable,350);});
document.getElementById("offerIndustry").addEventListener("change",loadOfferTable);
document.getElementById("offerMode").addEventListener("change",loadOfferTable);
document.getElementById("offerReset").addEventListener("click",()=>{
  document.getElementById("offerSearch").value="";
  document.getElementById("offerIndustry").value="";
  document.getElementById("offerMode").value="";
  loadOfferTable();
});
document.getElementById("clearOfferBtn").addEventListener("click",()=>{
  selectedJobId=null;
  document.getElementById("selectedOfferBox").style.display="none";
  document.querySelectorAll(".offer-row").forEach(r=>{r.classList.remove("offer-selected");r.querySelector("input[type=radio]").checked=false;});
  checkReady();
});

analyzeBtn.addEventListener("click",async()=>{
  cvForm.style.display="none";cvLoader.style.display="flex";cvResults.style.display="none";
  const fd=new FormData();
  fd.append("cv",cvPdfInput.files[0]);
  fd.append("job_id",selectedJobId);
  try{
    const res=await fetch("/api/analyze-cv",{method:"POST",body:fd});
    const d=await res.json();
    if(d.error){alert("Erreur : "+d.error);showCvForm();return;}
    renderResults(d);
  }catch(err){alert("Erreur réseau.");showCvForm();}
  finally{cvLoader.style.display="none";}
});

function renderResults(d){
  const circ=2*Math.PI*52,arc=document.getElementById("scoreArc"),num=document.getElementById("scoreNumber"),score=d.score||0;
  setTimeout(()=>{
    const f=(score/100)*circ;
    arc.style.strokeDasharray=`${f} ${circ-f}`;
    arc.style.stroke=score>=75?"#16a34a":score>=50?"#d97706":"#dc2626";
    animateNumber(num,0,score,1200);
  },100);
  document.getElementById("cvNiveau").textContent=d.niveau||"—";
  document.getElementById("cvResume").textContent=d.resume||"—";
  document.getElementById("cvMatchees").innerHTML=(d.competences_matchees||[]).map(c=>`<li>${esc(c)}</li>`).join("")||"<li>Aucune</li>";
  document.getElementById("cvManquantes").innerHTML=(d.competences_manquantes||[]).map(c=>`<li>${esc(c)}</li>`).join("")||"<li>Aucune</li>";
  document.getElementById("cvForts").innerHTML=(d.points_forts||[]).map(p=>`<div class="point-item"><div class="point-bullet bullet-green">✓</div><div><p class="point-title">${esc(p.titre)}</p><p class="point-detail">${esc(p.detail)}</p></div></div>`).join("");
  document.getElementById("cvFaibles").innerHTML=(d.points_faibles||[]).map(p=>`<div class="point-item"><div class="point-bullet bullet-orange">!</div><div><p class="point-title">${esc(p.titre)}</p><p class="point-detail">${esc(p.detail)}</p></div></div>`).join("");
  document.getElementById("cvRecos").innerHTML=(d.recommandations||[]).map(r=>`<li>${esc(r)}</li>`).join("");
  cvResults.style.display="block";
  cvResults.scrollIntoView({behavior:"smooth",block:"start"});
}

function showCvForm(){cvForm.style.display="block";cvLoader.style.display="none";cvResults.style.display="none";}

document.getElementById("cvResetBtn").addEventListener("click",()=>{
  cvPdfInput.value="";cvPdfName.textContent="Aucun fichier sélectionné";cvPdfName.classList.remove("has-file");
  cvFileReady=false;selectedJobId=null;
  document.getElementById("selectedOfferBox").style.display="none";
  analyzeBtn.disabled=true;showCvForm();
  window.scrollTo({top:0,behavior:"smooth"});
});

// ── Init
loadDashboard();
loadFilterOptions();
