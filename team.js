// ══════════════════════════════════════════════════════════════════════
// TEAM MODULE — fourth extraction from index.html (module split phase 4).
// Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. Zero real
// external callers (same clean profile as audio.js/adstudio.js) — the only
// elevated reference count (renderTeam, 3 total) turned out to be two
// self-referential re-renders from within this module's own functions
// (openInviteForm/removeTeamMember refreshing the Team screen after their
// own actions), not external calls. Calls logActivity(), defined later in
// the main script — safe regardless, since it only needs to exist by call
// time, not definition time, and this file loads after the full main
// script closes either way.
// ══════════════════════════════════════════════════════════════════════

// ── TEAM ──
const ROLE_PERMS={
  Founder:{color:"gold",modules:"All modules — full control"},
  Director:{color:"violet",modules:"Projects, Characters, Image/Video Gen, Directors, Audio, Gallery"},
  Creative:{color:"blue",modules:"Characters, Image/Video Gen, Audio, Gallery, Assets"},
  Producer:{color:"green",modules:"Projects, Cost Tracker, Gallery, Team"},
  Viewer:{color:"gray",modules:"Gallery, Assets (view only)"}
};

function renderTeam(el){
  const roster=S.team||[];
  const isFounder=isFounderUser();
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">Team</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${roster.length} member${roster.length!==1?'s':''} on the roster</div>
      </div>
      ${isFounder?`<button class="btn btn-primary btn-sm" onclick="openInviteForm()">+ Invite Member</button>`:''}
    </div>

    <div style="font-size:11px;color:var(--textm);background:rgba(201,151,42,0.08);border:1px solid rgba(201,151,42,0.2);border-radius:8px;padding:10px;margin-bottom:14px">
      ${isFounder
        ?'✅ Real, working now: signing in with Google is real (Firebase Auth), and Founder-only areas (this roster, Settings → API Keys) are actually locked to founder accounts — a non-founder signed-in user genuinely cannot edit these on this device.<br><br>⚠ Still not real: this roster itself is stored locally in this browser only. Adding "Sarah" as Director here does not give Sarah an actual account or actual permissions when she signs in on her own device — it\'s a reference list, not a live permission system. Making that fully real (so invited members get enforced roles wherever they sign in) needs a shared database (Firestore), not just this device\'s storage.'
        :`🔒 Signed in as ${S.user?maskEmail(S.user.email):'guest'} — Team Manager is Founder-only. You can view the roster below but can't invite or remove members.`}
    </div>

    <div class="panel">
      <div class="panel-title">👑 Founders (permanent, hardcoded)</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${isFounder?`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--textm)"><span class="badge badge-gold">👑 Founder</span> ${maskEmail(S.user.email)} (you)</div>`:`<div style="font-size:12px;color:var(--texts)">Founder identities are private — not shown here.</div>`}
      </div>
    </div>

    ${roster.length?`<div class="panel" style="margin-top:14px">
      <div class="panel-title">👥 Invited Members</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${roster.map((m,i)=>`
          <div style="display:flex;align-items:center;gap:10px;background:rgba(61,31,122,0.03);border-radius:8px;padding:10px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--violet)">${m.email}</div>
              <div style="font-size:10px;color:var(--textm);margin-top:2px">${ROLE_PERMS[m.role]?.modules||''}</div>
            </div>
            <span class="badge badge-${ROLE_PERMS[m.role]?.color||'gray'}">${m.role}</span>
            ${isFounder?`<button class="pc-menu-btn" onclick="removeTeamMember(${i})">🗑</button>`:''}
          </div>`).join('')}
      </div>
    </div>`:`<div class="empty-state" style="margin-top:14px"><div class="empty-icon">👥</div><div class="empty-title">No Members Invited Yet</div><div class="empty-desc">Add collaborators and assign them a role to track studio permissions.</div></div>`}

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🔑 Role Permission Guide</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(ROLE_PERMS).map(([role,p])=>`
          <div style="display:flex;gap:8px;align-items:flex-start">
            <span class="badge badge-${p.color}" style="flex-shrink:0">${role}</span>
            <span style="font-size:11px;color:var(--textm)">${p.modules}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">📋 Activity Log <span style="font-weight:400;color:var(--texts);font-size:11px">— this device only, not shared across team members</span></div>
      ${(S.activityLog||[]).length?`<div style="display:flex;flex-direction:column;gap:5px;max-height:240px;overflow-y:auto">
        ${(S.activityLog||[]).map(a=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:5px 8px;background:rgba(61,31,122,0.03);border-radius:6px">
          <span style="color:var(--text);flex:1">${a.action}</span>
          <span style="color:var(--textm);flex-shrink:0">${new Date(a.ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
        </div>`).join('')}
      </div>`:`<div style="font-size:11px;color:var(--textm)">No activity logged yet — actions like inviting members or changing API keys will appear here.</div>`}
    </div>
  `;
}

async function openInviteForm(){
  if(!isFounderUser()){toast("Team Manager is Founder-only","error");return;}
  const email=await showPromptDialog("","",{title:"Invite a Team Member",okLabel:"Next: Pick Role"});
  if(!email||!email.includes("@")){if(email)toast("Enter a valid email","error");return;}
  const roles=Object.keys(ROLE_PERMS).filter(r=>r!=="Founder");
  const role=await showRolePickerDialog(email,roles);
  if(!role)return;
  if(!S.team)S.team=[];
  if(S.team.some(m=>m.email===email)){toast("That email is already on the roster","error");return;}
  S.team.push({email,role,invited:new Date().toISOString()});
  save("team");
  logActivity(`Added ${email} to roster as ${role}`);
  toast(`✅ ${email} added as ${role}`,"success");
  renderTeam(document.getElementById("moduleContent"));
}

function showRolePickerDialog(email,roles){
  return new Promise(resolve=>{
    const overlay=document.createElement("div");
    overlay.className="modal-overlay show";
    overlay.innerHTML=`
      <div class="modal">
        <div style="text-align:center;font-size:28px;margin-bottom:8px">◆</div>
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);margin-bottom:6px;text-align:center">Pick a Role</div>
        <div style="font-size:12px;color:var(--textm);text-align:center;margin-bottom:16px">for ${email}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${roles.map(r=>`<button class="btn btn-outline" data-role="${r}" style="text-align:left">${r}</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-full" id="rpCancel">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup=result=>{overlay.remove();resolve(result);};
    overlay.querySelectorAll("[data-role]").forEach(btn=>{
      btn.onclick=()=>cleanup(btn.dataset.role);
    });
    overlay.querySelector("#rpCancel").onclick=()=>cleanup(null);
  });
}

async function removeTeamMember(i){
  if(!isFounderUser()){toast("Team Manager is Founder-only","error");return;}
  if(!(await showConfirmDialog("Remove this team member from the roster?",{danger:true,okLabel:"Remove"})))return;
  const removed=S.team[i];
  S.team.splice(i,1);
  save("team");
  if(removed)logActivity(`Removed ${removed.email} from roster`);
  renderTeam(document.getElementById("moduleContent"));
  toast("Member removed","");
}

