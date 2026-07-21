// ══════════════════════════════════════════════════════════════════════
// COST TRACKER MODULE — fifth extraction from index.html (module split
// phase 5). Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. Zero real
// external callers — the elevated reference counts (renderCosts 3,
// csvEscape 2 via .map(csvEscape) rather than a direct call, which a quick
// grep for "csvEscape(" initially missed) both turned out to be entirely
// self-contained within this same module.
// ══════════════════════════════════════════════════════════════════════

// ── COSTS ──
function renderCosts(el){
  const total=parseFloat(gs("total_spent","0"));
  const budgetCap=parseFloat(gs("budget_cap","0"));
  const log=[...(S.costLog||[])].reverse();
  const byModel={};
  (S.costLog||[]).forEach(c=>{byModel[c.key]=(byModel[c.key]||0)+c.amt;});
  const modelRows=Object.entries(byModel).sort((a,b)=>b[1]-a[1]);

  // Monthly projection: daily average spend this month, extrapolated to month length
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const daysElapsed=Math.max(1,Math.ceil((now-monthStart)/86400000));
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const spentThisMonth=(S.costLog||[]).filter(c=>new Date(c.created||now)>=monthStart).reduce((s,c)=>s+c.amt,0);
  const dailyAvg=spentThisMonth/daysElapsed;
  const projectedMonthly=dailyAvg*daysInMonth;

  const overBudget=budgetCap>0&&total>=budgetCap;
  const nearBudget=budgetCap>0&&total>=budgetCap*0.8&&!overBudget;

  el.innerHTML=`
    <div class="panel" id="costsOverviewAnchor">
      <div style="background:linear-gradient(135deg,var(--violet),var(--vm));border-radius:12px;padding:16px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <div style="font-size:10px;opacity:0.75;letter-spacing:0.06em;margin-bottom:2px">TOTAL SPENT (ESTIMATED)</div>
          <div style="font-family:'Cinzel',serif;font-size:28px;font-weight:900;color:var(--gold-l)">$${total.toFixed(2)}</div>
          <div style="font-size:10px;opacity:0.7;margin-top:2px">${(S.costLog||[]).length} generation${(S.costLog||[]).length!==1?'s':''} tracked</div>
        </div>
        <div style="font-size:32px">💰</div>
      </div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:12px">Estimates based on published fal.ai/ElevenLabs pricing — actual provider bills may vary slightly. Connect Razorpay or Stripe below for real payment processing.</div>
      ${(S.costLog||[]).length?`<button class="btn btn-ghost btn-sm" onclick="resetCostLog()">↺ Reset Cost Log</button>`:''}
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🎯 Budget Cap</div>
      <div class="f-row">
        <div class="f-group" style="margin-bottom:0"><input class="f-input" type="number" id="budgetCapInput" placeholder="e.g. 50" value="${budgetCap||''}" step="1" min="0"></div>
        <button class="btn btn-outline btn-sm" onclick="saveBudgetCap()">Set Cap</button>
      </div>
      ${budgetCap>0?`
        <div style="margin-top:10px">
          <div style="background:rgba(61,31,122,0.08);border-radius:6px;height:10px;overflow:hidden">
            <div style="background:${overBudget?'var(--red)':nearBudget?'var(--yellow)':'var(--green)'};height:100%;width:${Math.min(100,(total/budgetCap*100))}%"></div>
          </div>
          <div style="font-size:11px;color:var(--textm);margin-top:6px">$${total.toFixed(2)} of $${budgetCap.toFixed(2)} (${(total/budgetCap*100).toFixed(0)}%)</div>
          ${overBudget?`<div style="font-size:12px;color:var(--red);font-weight:700;margin-top:6px">⚠️ Over budget cap</div>`:nearBudget?`<div style="font-size:12px;color:#b45309;font-weight:700;margin-top:6px">⚠️ Approaching budget cap (80%+)</div>`:''}
        </div>`:`<div style="font-size:11px;color:var(--textm);margin-top:8px">No cap set — you won't get a warning as spend grows.</div>`}
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">📈 Monthly Projection</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Based on this month's daily average so far (${daysElapsed} day${daysElapsed!==1?'s':''} of data) — rough estimate, not a guarantee.</div>
      <div style="display:flex;gap:16px">
        <div><div style="font-size:10px;color:var(--textm)">SPENT THIS MONTH</div><div style="font-size:18px;font-weight:700;color:var(--violet)">$${spentThisMonth.toFixed(2)}</div></div>
        <div><div style="font-size:10px;color:var(--textm)">PROJECTED MONTH TOTAL</div><div style="font-size:18px;font-weight:700;color:var(--gold)">$${projectedMonthly.toFixed(2)}</div></div>
      </div>
    </div>

    ${modelRows.length?`
    <div class="panel" style="margin-top:14px" id="costsBreakdownAnchor">
      <div class="panel-title">📊 Spend by Model</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${modelRows.map(([key,amt])=>{
          const pct=total>0?(amt/total*100):0;
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
              <span style="color:var(--textm)">${key.split('/').slice(-2).join('/')}</span>
              <span style="color:var(--violet);font-weight:700">$${amt.toFixed(3)}</span>
            </div>
            <div style="background:rgba(61,31,122,0.08);border-radius:4px;height:6px;overflow:hidden">
              <div style="background:var(--vm);height:100%;width:${pct}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : `<div class="empty-state" style="margin-top:14px" id="costsBreakdownAnchor"><div class="empty-icon">📊</div><div class="empty-title">No Spend Yet</div><div class="empty-desc">Generate an image, video, or voiceover and real cost estimates will appear here.</div></div>`}

    <div class="panel" style="margin-top:14px" id="costsExportAnchor">
      <div class="panel-title">⬇️ Export Cost Log</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Download every logged generation (model, note, cost, date) as a real CSV file — useful for client billing or expense records.</div>
      <button class="btn btn-outline btn-full" ${!(S.costLog||[]).length?'disabled':''} onclick="exportCostLogCsv()">⬇️ Download CSV (${(S.costLog||[]).length} row${(S.costLog||[]).length!==1?'s':''})</button>
    </div>

    ${log.length?`
    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🧾 Recent Activity</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
        ${log.slice(0,20).map(c=>`
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:6px 8px;background:rgba(61,31,122,0.03);border-radius:6px">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:var(--textm)">${c.note||c.key.split('/').pop()}</div>
            <div style="color:var(--gold);font-weight:700;margin-left:8px;flex-shrink:0">$${c.amt.toFixed(3)}</div>
          </div>`).join('')}
      </div>
    </div>`:''}

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">💵 Model Cost Reference <span style="font-weight:400;color:var(--texts);font-size:11px">— what this app actually charges per generation, live from the real pricing table</span></div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:11px">
        ${[
          ["fal-ai/flux/schnell","FLUX Schnell (image)"],
          ["fal-ai/flux/dev","FLUX Dev (image)"],
          ["bytedance/seedance-2.0/fast/text-to-video","Seedance 2.0 Fast (video)"],
          ["fal-ai/kling-video/v2.1/master/text-to-video","Kling 2.1 Master (video)"],
          ["fal-ai/kling-video/v3/standard/text-to-video","Kling 3.0 Standard (video)"],
          ["fal-ai/kling-video/v3/pro/text-to-video","Kling 3.0 Pro (video)"],
          ["fal-ai/kling-video/o3/pro/reference-to-video","Kling O3 Pro (video)"],
          ["fal-ai/veo3.1","Veo 3.1 (video)"],
          ["fal-ai/kling-video/v3/pro/motion-control","Motion Control (video)"],
          ["stable-audio-3","Music"],
          ["fal-ai/kling-video/lipsync/audio-to-video","Lip-sync"],
        ].filter(([key])=>COST_TABLE[key]!==undefined).map(([key,label])=>
          `<div style="display:flex;justify-content:space-between"><span style="color:var(--textm)">${label}</span><span style="color:var(--text)">~$${COST_TABLE[key].toFixed(3)}</span></div>`
        ).join('')}
        <div style="font-size:10px;color:var(--texts);margin-top:4px">These are flat, duration-unaware approximations for a typical clip — the actual per-generation cost hint you see before creating something in Video/Image Canvas is the accurate, duration-aware one.</div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">💳 Payment Processing</div>
      <div style="font-size:12px;color:var(--textm)">Connect Razorpay or Stripe in Settings to manage real billing for clients or team members.</div>
    </div>
  `;
}

// Real CSV export - genuinely missing feature, now built. Escapes fields
// per standard CSV rules (wrap in quotes, double up any internal quotes)
// since notes/model names can contain commas.
function csvEscape(val){
  const s=String(val==null?"":val);
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}

function exportCostLogCsv(){
  const rows=S.costLog||[];
  if(!rows.length){toast("Nothing to export yet","error");return;}
  const header=["Date","Model","Note","Cost (USD)"];
  const lines=[header.map(csvEscape).join(",")];
  rows.forEach(c=>{
    lines.push([new Date(c.created).toLocaleString(),c.key,c.note||"",c.amt.toFixed(4)].map(csvEscape).join(","));
  });
  const csv=lines.join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`KosmicKat_cost_log_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`⬇️ Exported ${rows.length} row${rows.length!==1?'s':''}`,"success");
}

function saveBudgetCap(){
  const val=parseFloat(document.getElementById("budgetCapInput").value)||0;
  saveSetting("budget_cap",String(val));
  toast(val>0?`🎯 Budget cap set to $${val.toFixed(2)}`:"Budget cap cleared","success");
  renderCosts(document.getElementById("moduleContent"));
}

async function resetCostLog(){
  if(!(await showConfirmDialog("Reset the cost tracker to $0? This only clears the local log — it does NOT affect your real provider billing.",{danger:true,okLabel:"Reset"})))return;
  S.costLog=[];
  save("costLog");
  saveSetting("total_spent","0");
  renderCosts(document.getElementById("moduleContent"));
  toast("Cost log reset","");
}

