import { useState, useRef } from "react";

const C = {
  bg:"#F8F9FB", surface:"#FFFFFF", border:"#E4E7ED", borderLight:"#F0F2F5",
  text:"#111827", textSub:"#6B7280", textDim:"#9CA3AF",
  accent:"#3B5BDB", accentBg:"#EEF2FF",
  success:"#16A34A", successBg:"#DCFCE7",
  warning:"#D97706", warningBg:"#FEF3C7",
  danger:"#DC2626", dangerBg:"#FEE2E2",
  purple:"#7C3AED", purpleBg:"#EDE9FE",
  teal:"#0891B2", tealBg:"#CFFAFE",
  gray:"#6B7280", grayBg:"#F3F4F6",
  ai:"#0EA5E9", aiBg:"#E0F2FE",
  navBg:"#1E2A3B",
};

const bx = (label, color, bg, s={}) => (
  <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:bg,color,whiteSpace:"nowrap",...s}}>{label}</span>
);
const classBadge = c => {const m={Lead:[C.warning,C.warningBg],Customer:[C.success,C.successBg],"Past Customer":[C.gray,C.grayBg]};const [col,bg]=m[c]||[C.gray,C.grayBg];return bx(c,col,bg);};
const stageBadge = s => {const m={"יצירת קשר":[C.textSub,C.grayBg],"מעוניין":[C.accent,C.accentBg],"סגירה":[C.warning,C.warningBg],"זכה":[C.success,C.successBg],"הפסיד":[C.danger,C.dangerBg]};const [col,bg]=m[s]||[C.gray,C.grayBg];return bx(s,col,bg);};

const Btn = ({children,variant="primary",sm,onClick,disabled,style={}}) => {
  const base={display:"inline-flex",alignItems:"center",gap:5,borderRadius:6,fontWeight:600,cursor:disabled?"not-allowed":"pointer",border:"none",fontSize:sm?12:13,padding:sm?"5px 11px":"7px 14px",lineHeight:1.4,flexShrink:0,opacity:disabled?0.45:1};
  const v={primary:{background:C.accent,color:"#fff"},secondary:{background:C.surface,color:C.text,border:`1px solid ${C.border}`},ghost:{background:"transparent",color:C.textSub,border:`1px solid ${C.border}`},teal:{background:C.tealBg,color:C.teal,border:`1px solid ${C.teal}30`},ai:{background:C.aiBg,color:C.ai,border:`1px solid ${C.ai}30`},danger:{background:C.dangerBg,color:C.danger}};
  return <button style={{...base,...(v[variant]||v.primary),...style}} onClick={disabled?undefined:onClick}>{children}</button>;
};
const Card = ({children,style={}}) => <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",...style}}>{children}</div>;
const Av = ({name,size=28}) => <div style={{width:size,height:size,borderRadius:"50%",background:C.accentBg,color:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size/2.6,fontWeight:700,flexShrink:0}}>{(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>;
const Inp = ({label,placeholder,type="text",mono}) => <div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,fontWeight:500,color:C.textSub,marginBottom:4}}>{label}</div>}<input type={type} placeholder={placeholder} style={{width:"100%",boxSizing:"border-box",padding:"7px 11px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:13,color:C.text,outline:"none",background:C.surface,fontFamily:mono?"monospace":"inherit"}}/></div>;
const Sl = ({label,options=[]}) => <div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,fontWeight:500,color:C.textSub,marginBottom:4}}>{label}</div>}<select style={{width:"100%",boxSizing:"border-box",padding:"7px 11px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:13,color:C.text,outline:"none",background:C.surface}}>{options.map(o=><option key={o}>{o}</option>)}</select></div>;
const Banner = ({type="info",children,onClose}) => {const s={info:[C.ai,C.aiBg],warning:[C.warning,C.warningBg],danger:[C.danger,C.dangerBg],success:[C.success,C.successBg]};const [col,bg]=s[type];return <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",background:bg,border:`1px solid ${col}20`,borderRadius:8,marginBottom:14,fontSize:13}}><span style={{color:col,flex:1}}>{children}</span>{onClose&&<span onClick={onClose} style={{color:col,cursor:"pointer",fontSize:16}}>✕</span>}</div>;};

const Modal = ({title,width=500,onClose,children,footer}) => (
  <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(15,17,23,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:C.surface,borderRadius:12,width,maxWidth:"94vw",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.22)"}}>
      <div style={{padding:"16px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{fontSize:14,fontWeight:700}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,color:C.textSub,cursor:"pointer"}}>✕</button>
      </div>
      <div style={{overflowY:"auto",padding:"18px 22px",flex:1}}>{children}</div>
      {footer&&<div style={{padding:"13px 22px",borderTop:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:8}}>{footer}</div>}
    </div>
  </div>
);

// ─── NAVBAR ───────────────────────────────────────────────────
const Navbar = ({screen,setScreen}) => {
  const crm=["dashboard","list","pipeline","messages","broadcast","followup"].includes(screen);
  return (
    <div style={{background:C.navBg,height:48,display:"flex",alignItems:"center",padding:"0 24px",gap:22,flexShrink:0}}>
      <div style={{fontSize:15,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>Leaders</div>
      <div style={{width:1,height:18,background:"rgba(255,255,255,0.15)"}}/>
      {["דשבורד","תלמידים","מדריכים","CRM","הגדרות"].map(item=>{
        const active=item==="CRM"?crm:false;
        return <div key={item} onClick={()=>item==="CRM"&&setScreen("dashboard")} style={{fontSize:13,color:active?"#fff":"rgba(255,255,255,0.45)",fontWeight:active?600:400,cursor:item==="CRM"?"pointer":"default",padding:"4px 0",borderBottom:active?"2px solid #3B5BDB":"2px solid transparent"}}>{item}</div>;
      })}
      <div style={{flex:1}}/>
      <Av name="יעל כהן" size={26}/>
    </div>
  );
};

const Breadcrumbs = ({screen,setScreen}) => {
  const map={dashboard:[["CRM"]],list:[["CRM","dashboard"],["מוסדות"]],pipeline:[["CRM","dashboard"],["פייפליין"]],messages:[["CRM","dashboard"],["עורך הודעות"]],broadcast:[["CRM","dashboard"],["שליחה בקבוצות"]],followup:[["CRM","dashboard"],["תור מעקב"]],profile:[["CRM","dashboard"],["מוסדות","list"],["עיריית תל אביב"]]};
  const crumbs=map[screen]||[["CRM"]];
  return (
    <div style={{height:36,background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 24px",gap:5,flexShrink:0}}>
      {crumbs.map(([label,target],i)=>(
        <span key={i} style={{display:"flex",alignItems:"center",gap:5}}>
          {i>0&&<span style={{color:C.textDim,fontSize:12}}>/</span>}
          <span onClick={target?()=>setScreen(target):undefined} style={{fontSize:12,color:target?C.accent:C.text,fontWeight:i===crumbs.length-1?600:400,cursor:target?"pointer":"default"}}>{label}</span>
        </span>
      ))}
    </div>
  );
};

const NAV_TABS=[{id:"dashboard",l:"דשבורד"},{id:"list",l:"מוסדות"},{id:"pipeline",l:"פייפליין"},{id:"messages",l:"עורך הודעות"},{id:"broadcast",l:"שליחה בקבוצות"},{id:"followup",l:"תור מעקב"}];

const SubNav = ({screen,setScreen}) => {
  if(!NAV_TABS.find(t=>t.id===screen)) return null;
  return (
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 24px",flexShrink:0}}>
      {NAV_TABS.map(t=>(
        <div key={t.id} onClick={()=>setScreen(t.id)} style={{padding:"8px 16px",fontSize:13,fontWeight:screen===t.id?600:400,color:screen===t.id?C.accent:C.textSub,borderBottom:screen===t.id?`2px solid ${C.accent}`:"2px solid transparent",cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>{t.l}</div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 1. DASHBOARD — ממוקד, חכם, ללא עומס
// ══════════════════════════════════════════════════════════════
const StatPill = ({label, value, color, bg, onClick}) => (
  <div onClick={onClick} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,cursor:onClick?"pointer":"default",gap:12}}>
    <span style={{fontSize:12,color:C.textSub,fontWeight:500}}>{label}</span>
    <span style={{fontSize:16,fontWeight:800,color,background:bg,padding:"2px 10px",borderRadius:20}}>{value}</span>
  </div>
);

const Dashboard = ({setScreen}) => {
  const [aiLoading,setAiLoading]=useState(false);
  const [aiSections,setAiSections]=useState(null);

  const loadAI = async () => {
    setAiLoading(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:"CRM AI for Digi-tech (Israeli edtech). Concise daily briefing in Hebrew. Use EXACTLY these bold headers:\n**מי צפוי להיסגר:**\n**מי תקוע:**\n**לחידוש דחוף:**\n**המלצה לעכשיו:**\nBase on: מועצת השרון (closing, contact today), רשת אורט (21d no contact), עיריית ב״ש (renewal Q3). Max 1-2 short lines each. Actionable."}]})});
      const d = await r.json();
      const text = d.content?.[0]?.text || "";
      const parts = text.split(/\*\*(.+?):\*\*/).filter(Boolean);
      const sections=[];
      for(let i=0;i<parts.length-1;i+=2) sections.push({title:parts[i],body:parts[i+1]?.trim()});
      setAiSections(sections.length?sections:[{title:"סיכום",body:text}]);
    } catch { setAiSections([{title:"שגיאה",body:"לא ניתן לטעון. בדוק חיבור."}]); }
    setAiLoading(false);
  };

  const icons={"מי צפוי להיסגר":"🎯","מי תקוע":"🔴","לחידוש דחוף":"♻️","המלצה לעכשיו":"⚡"};
  const sColors={"מי צפוי להיסגר":[C.success,C.successBg],"מי תקוע":[C.danger,C.dangerBg],"לחידוש דחוף":[C.purple,C.purpleBg],"המלצה לעכשיו":[C.ai,C.aiBg]};

  return (
    <div style={{padding:"20px 24px",overflow:"auto",flex:1}}>

      {/* One-line alert — only if overdue */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:C.dangerBg,border:`1px solid ${C.danger}20`,borderRadius:8,marginBottom:18,fontSize:13}}>
        <span style={{color:C.danger}}>⚠️</span>
        <span style={{color:C.danger,flex:1}}><b>8 פעולות מעקב באיחור</b></span>
        <span onClick={()=>setScreen("followup")} style={{color:C.danger,textDecoration:"underline",cursor:"pointer",fontSize:12,fontWeight:600}}>לתור מעקב →</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>

        {/* LEFT: stats + quick actions */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>סטטוס פייפליין</div>
          <StatPill label="לידים חדשים" value={18} color={C.accent} bg={C.accentBg} onClick={()=>setScreen("list")}/>
          <StatPill label="בתהליך" value={34} color={C.warning} bg={C.warningBg} onClick={()=>setScreen("pipeline")}/>
          <StatPill label="לקוחות פעילים" value={62} color={C.success} bg={C.successBg} onClick={()=>setScreen("list")}/>
          <StatPill label="פוטנציאל פתוח" value="₪293K" color={C.purple} bg={C.purpleBg} onClick={()=>setScreen("pipeline")}/>
          <StatPill label="הזדמנויות" value={27} color={C.teal} bg={C.tealBg} onClick={()=>setScreen("pipeline")}/>

          <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:6,marginBottom:2}}>פעולות מהירות</div>
          {[{l:"📤 ייבוא CSV",s:"list"},{l:"💬 עורך הודעות",s:"messages"},{l:"📢 שליחה בקבוצות",s:"broadcast"},{l:"⏰ תור מעקב",s:"followup"}].map((a,i)=>(
            <Btn key={i} variant="secondary" sm onClick={()=>setScreen(a.s)} style={{justifyContent:"flex-start",width:"100%"}}>{a.l}</Btn>
          ))}
        </div>

        {/* CENTER: hot leads */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>🔥 לידים חמים</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{n:"מועצת השרון",s:"סגירה",v:"₪48K",d:"היום",owner:"דרור כץ"},{n:"עיריית ראשל״צ",s:"מעוניין",v:"₪32K",d:"אתמול",owner:"דן כהן"},{n:"רשת ריאלי",s:"סגירה",v:"₪22.5K",d:"2י׳",owner:"טלי מור"},{n:"עיריית ח׳",s:"מעוניין",v:"₪55K",d:"3י׳",owner:"נעמה לוי"}].map((h,i)=>(
              <div key={i} onClick={()=>setScreen("profile")} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background=C.surface}>
                <Av name={h.n} size={32}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{h.n}</div>
                  <div style={{fontSize:11,color:C.textSub}}>👤 {h.owner} · {h.d}</div>
                </div>
                <div style={{textAlign:"left"}}>
                  {stageBadge(h.s)}
                  <div style={{fontSize:13,fontWeight:800,color:C.success,marginTop:4,textAlign:"right"}}>{h.v}</div>
                </div>
              </div>
            ))}
            <Btn variant="ghost" sm onClick={()=>setScreen("pipeline")} style={{justifyContent:"center"}}>כל הפייפליין →</Btn>
          </div>
        </div>

        {/* RIGHT: AI summary */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>🤖 סיכום AI להיום</div>
          <div style={{background:C.surface,border:`1px solid ${C.ai}25`,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${C.ai}`,minHeight:320,display:"flex",flexDirection:"column"}}>
            {!aiSections&&!aiLoading&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"16px 0"}}>
                <div style={{fontSize:28}}>🤖</div>
                <div style={{fontSize:12,color:C.textSub,textAlign:"center",lineHeight:1.6}}>קבל סיכום חכם של הפייפליין — מי ייסגר, מי תקוע, ומה לעשות עכשיו</div>
                <Btn variant="ai" sm onClick={loadAI}>✨ הפעל סיכום</Btn>
              </div>
            )}
            {aiLoading&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                <div style={{fontSize:22,color:C.ai}}>⟳</div>
                <div style={{fontSize:12,color:C.ai}}>מנתח את הפייפליין...</div>
              </div>
            )}
            {aiSections&&!aiLoading&&(
              <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
                {aiSections.map((sec,i)=>{
                  const [col,bg]=sColors[sec.title]||[C.ai,C.aiBg];
                  return (
                    <div key={i} style={{padding:"10px 12px",borderRadius:8,background:bg,border:`1px solid ${col}15`}}>
                      <div style={{fontSize:10,fontWeight:700,color:col,marginBottom:4}}>{icons[sec.title]||"•"} {sec.title}</div>
                      <div style={{fontSize:12,color:C.text,lineHeight:1.55}}>{sec.body}</div>
                    </div>
                  );
                })}
                <Btn variant="ai" sm onClick={loadAI} style={{marginTop:"auto",justifyContent:"center"}}>⟳ רענן</Btn>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 2. INSTITUTIONS LIST + CSV + INSTRUCTOR ASSIGNMENT
// ══════════════════════════════════════════════════════════════

const INSTRUCTORS = [
  {id:1,name:"אלעד פרץ",cities:["חיפה","קרית ביאליק","טירת כרמל"]},
  {id:2,name:"ינון מור יוסף",cities:["תל אביב","רמת גן","גבעתיים"]},
  {id:3,name:"אליאור רפאל",cities:["ב״ש","דימונה","נתיבות"]},
  {id:4,name:"אלעז מורי",cities:["כרמיאל","עכו","נהריה"]},
  {id:5,name:"רינה מזרחי",cities:["השרון","נתניה","הרצליה"]},
];

const AssignModal = ({lead, onClose}) => {
  const [sel,setSel] = useState(null);
  const suggested = INSTRUCTORS.filter(i=>i.cities.includes(lead.city));
  const others = INSTRUCTORS.filter(i=>!i.cities.includes(lead.city));
  return (
    <Modal title={`שיוך מדריך — ${lead.n}`} width={440} onClose={onClose}
      footer={[
        <Btn key="s" style={{flex:1,justifyContent:"center"}} disabled={!sel} onClick={onClose}>✓ שייך מדריך</Btn>,
        <Btn key="c" variant="secondary" onClick={onClose}>ביטול</Btn>
      ]}>
      <div style={{fontSize:12,color:C.textSub,marginBottom:12}}>
        🏙 עיר: <b style={{color:C.text}}>{lead.city}</b>
      </div>
      {suggested.length>0&&<>
        <div style={{fontSize:11,fontWeight:700,color:C.success,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:8}}>✓ מדריכים לפי אזור</div>
        {suggested.map(i=>(
          <div key={i.id} onClick={()=>setSel(i.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`2px solid ${sel===i.id?C.accent:C.border}`,marginBottom:6,cursor:"pointer",background:sel===i.id?C.accentBg:C.surface}}>
            <Av name={i.name} size={32}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{i.name}</div>
              <div style={{fontSize:11,color:C.textSub}}>{i.cities.join(" · ")}</div>
            </div>
            <span style={{fontSize:10,color:C.success,fontWeight:700,background:C.successBg,padding:"2px 7px",borderRadius:10}}>מתאים</span>
            {sel===i.id&&<span style={{color:C.accent,fontSize:16}}>✓</span>}
          </div>
        ))}
      </>}
      {others.length>0&&<>
        <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.4px",margin:"12px 0 8px"}}>מדריכים אחרים</div>
        {others.map(i=>(
          <div key={i.id} onClick={()=>setSel(i.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:`2px solid ${sel===i.id?C.accent:C.border}`,marginBottom:5,cursor:"pointer",background:sel===i.id?C.accentBg:C.surface}}>
            <Av name={i.name} size={28}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600}}>{i.name}</div>
              <div style={{fontSize:11,color:C.textSub}}>{i.cities.join(" · ")}</div>
            </div>
            {sel===i.id&&<span style={{color:C.accent,fontSize:16}}>✓</span>}
          </div>
        ))}
      </>}
    </Modal>
  );
};

const InstitutionsList = ({setScreen}) => {
  const [showCSV,setShowCSV]=useState(false);
  const [step,setStep]=useState(0);
  const [csvRows,setCsvRows]=useState([]);
  const [done,setDone]=useState(false);
  const [assignLead,setAssignLead]=useState(null);
  const fileRef=useRef();

  // Active filters
  const [filters,setFilters]=useState({cl:"הכל",stage:"הכל",city:"הכל",instructor:"הכל"});
  const [search,setSearch]=useState("");
  const setFilter=(k,v)=>setFilters(p=>({...p,[k]:v}));

  const handleFile = e => {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const lines=ev.target.result.split(/\r?\n/).filter(Boolean);
      if(lines.length<2) return;
      const header=lines[0].split(",").map(s=>s.trim());
      const parsed=lines.slice(1).map(line=>{const vals=line.split(",").map(s=>s.trim());const obj={};header.forEach((h,i)=>{obj[h]=vals[i]||"";});return obj;}).filter(r=>Object.values(r).some(v=>v));
      setCsvRows(parsed); setStep(1);
    };
    reader.readAsText(file,"utf-8");
  };
  const closeCSV=()=>{setShowCSV(false);setStep(0);setCsvRows([]);setDone(false);};

  const ALL_ROWS=[
    {n:"רשת אורט ברודה",city:"כרמיאל",type:"רשת",cl:"Lead",stage:"יצירת קשר",contact:"מירי כץ",instructor:"אלעז מורי",last:"3י׳",next:"שיחה",opp:"₪38,000"},
    {n:"עיריית תל אביב",city:"תל אביב",type:"עירייה",cl:"Customer",stage:"מעוניין",contact:"אבי בן-דוד",instructor:"ינון מור יוסף",last:"היום",next:"הצעה",opp:"₪92,000"},
    {n:"בית ספר ריאלי",city:"חיפה",type:"בי״ס",cl:"Lead",stage:"מעוניין",contact:"טלי מור",instructor:"אלעד פרץ",last:"אתמול",next:"פגישה",opp:"₪22,500"},
    {n:"עיריית ב״ש",city:"ב״ש",type:"עירייה",cl:"Customer",stage:"סגירה",contact:"גל לוי",instructor:"אליאור רפאל",last:"5י׳",next:"מעקב",opp:"₪65,000"},
    {n:"קרית ביאליק",city:"קרית ביאליק",type:"רשת",cl:"Customer",stage:"מעוניין",contact:"נועה בר",instructor:"אלעד פרץ",last:"2י׳",next:"בדיקה",opp:"₪28,000"},
    {n:"מועצת השרון",city:"השרון",type:"מועצה",cl:"Lead",stage:"סגירה",contact:"דרור כץ",instructor:null,last:"היום",next:"חוזה",opp:"₪48,000"},
    {n:"עיריית נתניה",city:"נתניה",type:"עירייה",cl:"Lead",stage:"יצירת קשר",contact:"שרה כהן",instructor:null,last:"שבוע",next:"שיחה",opp:"₪30,000"},
    {n:"בית ספר אמית",city:"הרצליה",type:"בי״ס",cl:"Lead",stage:"יצירת קשר",contact:"דוד שמש",instructor:"רינה מזרחי",last:"4י׳",next:"מייל",opp:"₪18,000"},
  ];

  const CITIES=[...new Set(ALL_ROWS.map(r=>r.city))];
  const INSTRUCTORS_FILTER=["הכל",...INSTRUCTORS.map(i=>i.name),"לא משויך"];

  const filtered = ALL_ROWS.filter(r=>{
    if(search && !r.n.includes(search) && !r.city.includes(search)) return false;
    if(filters.cl!=="הכל" && r.cl!==filters.cl) return false;
    if(filters.stage!=="הכל" && r.stage!==filters.stage) return false;
    if(filters.city!=="הכל" && r.city!==filters.city) return false;
    if(filters.instructor==="לא משויך" && r.instructor) return false;
    if(filters.instructor!=="הכל" && filters.instructor!=="לא משויך" && r.instructor!==filters.instructor) return false;
    return true;
  });

  const unassigned = ALL_ROWS.filter(r=>!r.instructor).length;

  const FilterChip = ({label,field,options}) => (
    <select value={filters[field]} onChange={e=>setFilter(field,e.target.value)}
      style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${filters[field]!=="הכל"?C.accent:C.border}`,background:filters[field]!=="הכל"?C.accentBg:C.surface,color:filters[field]!=="הכל"?C.accent:C.textSub,fontSize:12,cursor:"pointer",outline:"none",fontWeight:filters[field]!=="הכל"?600:400}}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div style={{padding:"20px 24px",overflow:"auto",flex:1}}>
      {showCSV&&(
        <Modal title="📤 ייבוא מוסדות מ-CSV" width={560} onClose={closeCSV}
          footer={step===1&&!done?[<Btn key="i" style={{flex:1,justifyContent:"center"}} onClick={()=>setDone(true)}>✓ ייבא {csvRows.length} מוסדות</Btn>,<Btn key="b" variant="secondary" onClick={()=>setStep(0)}>חזור</Btn>]:null}>
          {step===0&&(
            <>
              <Banner type="info">ייבוא מהיר ממסמך אקסל / CSV — כולל שיוך מדריך אוטומטי לפי עיר.</Banner>
              <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:C.bg,marginBottom:14}}>
                <div style={{fontSize:28,marginBottom:8}}>📁</div>
                <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>גרור קובץ CSV לכאן</div>
                <div style={{fontSize:12,color:C.textSub}}>או לחץ לבחירת קובץ</div>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleFile}/>
              </div>
              <div style={{background:C.bg,borderRadius:8,padding:"10px 13px",fontFamily:"monospace",fontSize:12,color:C.textSub,lineHeight:1.8,marginBottom:12}}>
                שם מוסד, עיר, סוג, איש קשר, טלפון, אימייל<br/>
                עיריית נתניה, נתניה, עירייה, דנה לוי, 054-111, dana@net.il
              </div>
              <Btn variant="secondary" sm onClick={()=>{const c="שם מוסד,עיר,סוג,איש קשר,טלפון,אימייל\nדוגמה,תל אביב,עירייה,שם,054-0000000,ex@org.il";const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,\uFEFF"+encodeURIComponent(c);a.download="template.csv";a.click();}}>⬇ הורד תבנית</Btn>
            </>
          )}
          {step===1&&!done&&csvRows.length>0&&(
            <>
              <Banner type="success">✓ נמצאו <b>{csvRows.length} מוסדות</b></Banner>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",maxHeight:240,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:C.bg}}>{Object.keys(csvRows[0]||{}).map(h=><th key={h} style={{padding:"6px 10px",textAlign:"right",fontSize:11,fontWeight:600,color:C.textSub,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>{csvRows.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.borderLight}`}}>{Object.values(r).map((v,j)=><td key={j} style={{padding:"6px 10px",fontSize:12}}>{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </>
          )}
          {done&&<div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:40,marginBottom:10}}>✅</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:5}}>הייבוא הושלם!</div>
            <div style={{fontSize:13,color:C.textSub,marginBottom:18}}>{csvRows.length} מוסדות נוספו · שיוך מדריכים אוטומטי בוצע לפי עיר</div>
            <Btn onClick={closeCSV}>סגור</Btn>
          </div>}
        </Modal>
      )}

      {assignLead&&<AssignModal lead={assignLead} onClose={()=>setAssignLead(null)}/>}

      {/* Unassigned banner */}
      {unassigned>0&&(
        <Banner type="warning">
          ⚠️ <b>{unassigned} לידים</b> ללא מדריך משויך —{" "}
          <span onClick={()=>setFilter("instructor","לא משויך")} style={{textDecoration:"underline",cursor:"pointer"}}>הצג אותם</span>
        </Banner>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  חיפוש לפי שם / עיר..." style={{padding:"7px 12px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:13,width:210,outline:"none",color:C.text}}/>
        <FilterChip label="סיווג" field="cl" options={["הכל","Lead","Customer","Past Customer"]}/>
        <FilterChip label="שלב" field="stage" options={["הכל",...STAGES]}/>
        <FilterChip label="עיר" field="city" options={["הכל",...CITIES]}/>
        <FilterChip label="מדריך" field="instructor" options={INSTRUCTORS_FILTER}/>
        {Object.values(filters).some(v=>v!=="הכל")&&(
          <button onClick={()=>setFilters({cl:"הכל",stage:"הכל",city:"הכל",instructor:"הכל"})} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.danger}30`,background:C.dangerBg,color:C.danger,fontSize:11,cursor:"pointer",fontWeight:600}}>✕ נקה פילטרים</button>
        )}
        <div style={{flex:1}}/>
        <Btn variant="secondary" sm onClick={()=>setShowCSV(true)}>📤 ייבוא CSV</Btn>
        <Btn sm>+ הוסף מוסד</Btn>
      </div>

      {/* Table */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.bg}}>
              {["מוסד","עיר","סוג","סיווג","שלב","איש קשר","מדריך משויך","קשר אחרון","פעולה","הזדמנות"].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:600,color:C.textSub,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"9px 12px"}} onClick={()=>setScreen("profile")}><div style={{fontSize:13,fontWeight:600,color:C.accent}}>{r.n}</div></td>
                <td style={{padding:"9px 12px",fontSize:12,color:C.textSub}} onClick={()=>setScreen("profile")}>{r.city}</td>
                <td style={{padding:"9px 12px",fontSize:12,color:C.textSub}} onClick={()=>setScreen("profile")}>{r.type}</td>
                <td style={{padding:"9px 12px"}} onClick={()=>setScreen("profile")}>{classBadge(r.cl)}</td>
                <td style={{padding:"9px 12px"}} onClick={()=>setScreen("profile")}>{stageBadge(r.stage)}</td>
                <td style={{padding:"9px 12px"}} onClick={()=>setScreen("profile")}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><Av name={r.contact} size={22}/><span style={{fontSize:12}}>{r.contact}</span></div>
                </td>
                {/* Instructor cell */}
                <td style={{padding:"9px 12px"}}>
                  {r.instructor?(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <Av name={r.instructor} size={22} color={C.purple} bg={C.purpleBg}/>
                      <span style={{fontSize:12,color:C.text}}>{r.instructor}</span>
                    </div>
                  ):(
                    <button onClick={()=>setAssignLead(r)} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:5,border:`1px dashed ${C.warning}`,background:C.warningBg,color:C.warning,fontSize:11,cursor:"pointer",fontWeight:600}}>
                      + שייך מדריך
                    </button>
                  )}
                </td>
                <td style={{padding:"9px 12px",fontSize:12,color:C.textSub}} onClick={()=>setScreen("profile")}>{r.last}</td>
                <td style={{padding:"9px 12px"}} onClick={()=>setScreen("profile")}>{bx(r.next,C.accent,C.accentBg)}</td>
                <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:C.success}} onClick={()=>setScreen("profile")}>{r.opp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{padding:"9px 16px",background:C.bg,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.textSub,display:"flex",justifyContent:"space-between"}}>
          <span>מציג {filtered.length} מתוך {ALL_ROWS.length} מוסדות</span>
          {unassigned>0&&<span style={{color:C.warning,fontWeight:600}}>{unassigned} ללא מדריך</span>}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 3. PIPELINE — Kanban מקצועי + אוטומציות
// ══════════════════════════════════════════════════════════════
const STAGES=["יצירת קשר","מעוניין","סגירה","זכה","הפסיד"];
const STAGE_COLORS={"יצירת קשר":[C.gray,"#F9FAFB","#E5E7EB"],"מעוניין":[C.accent,"#F0F4FF","#C7D2FE"],"סגירה":[C.warning,"#FFFBEB","#FDE68A"],"זכה":[C.success,"#F0FDF4","#BBF7D0"],"הפסיד":[C.danger,"#FFF5F5","#FECACA"]};

const PipelineScreen = () => {
  const [view,setView]=useState("kanban");
  const [editRule,setEditRule]=useState(null);
  const [rules,setRules]=useState([
    {id:1,trigger:"כניסה לשלב: יצירת קשר",channel:"📱",action:"שלח וואטסאפ",template:"פולו-אפ ראשוני",delay:"מיידי",active:true},
    {id:2,trigger:"כניסה לשלב: מעוניין",channel:"📧",action:"שלח מייל",template:"הצעת מחיר",delay:"שעה אחרי",active:true},
    {id:3,trigger:"ללא קשר 7 ימים",channel:"📱",action:"שלח וואטסאפ",template:"מעקב אחרי הצעה",delay:"אוטומטי",active:true},
    {id:4,trigger:"כניסה לשלב: סגירה",channel:"📧",action:"שלח מייל",template:"החוזה מוכן",delay:"יום לאחר",active:false},
    {id:5,trigger:"זכייה בעסקה",channel:"📱",action:"שלח וואטסאפ",template:"ברכת פתיחה",delay:"מיידי",active:true},
  ]);

  const [instrFilter,setInstrFilter]=useState("הכל");
  const [cityFilter,setCityFilter]=useState("הכל");
  const INSTR_OPTIONS=["הכל",...INSTRUCTORS.map(i=>i.name)];
  const CITY_OPTIONS=["הכל","תל אביב","חיפה","כרמיאל","ב״ש","השרון","הרצליה"];

  const allCards=[
    {stage:"יצירת קשר",n:"רשת אורט ברודה",v:"₪38K",c:"מירי כץ",city:"כרמיאל",instructor:"אלעז מורי",d:"3י׳"},
    {stage:"יצירת קשר",n:"עיריית חיפה",v:"₪55K",c:"ירון שמיר",city:"חיפה",instructor:"אלעד פרץ",d:"שבוע"},
    {stage:"מעוניין",n:"בית ספר ריאלי",v:"₪22.5K",c:"טלי מור",city:"חיפה",instructor:"אלעד פרץ",d:"אתמול"},
    {stage:"מעוניין",n:"עיריית ראשל״צ",v:"₪32K",c:"דן כהן",city:"השרון",instructor:"רינה מזרחי",d:"2י׳"},
    {stage:"סגירה",n:"מועצת השרון",v:"₪48K",c:"דרור כץ",city:"השרון",instructor:null,d:"היום",hot:true},
    {stage:"סגירה",n:"עיריית ח׳",v:"₪55K",c:"נעמה לוי",city:"חיפה",instructor:"אלעד פרץ",d:"1י׳"},
    {stage:"זכה",n:"עיריית ת״א",v:"₪92K",c:"אבי",city:"תל אביב",instructor:"ינון מור יוסף",d:"5י׳"},
    {stage:"הפסיד",n:"עיריית אשדוד",v:"₪18K",c:"יוסי גל",city:"אשדוד",instructor:null,d:"12י׳"},
  ];

  const filteredCards = allCards.filter(card=>{
    if(instrFilter!=="הכל" && card.instructor!==instrFilter) return false;
    if(cityFilter!=="הכל" && card.city!==cityFilter) return false;
    return true;
  });

  const cols = STAGES.map(stage=>({
    stage,
    cards: filteredCards.filter(c=>c.stage===stage),
  }));

  const rulesForStage = s => rules.filter(r=>r.active&&r.trigger.includes(s));

  return (
    <div style={{padding:"20px 24px",overflow:"auto",flex:1}}>
      {editRule&&(
        <Modal title="עריכת אוטומציה" width={460} onClose={()=>setEditRule(null)}
          footer={[<Btn key="s" style={{flex:1,justifyContent:"center"}} onClick={()=>setEditRule(null)}>💾 שמור</Btn>,<Btn key="c" variant="secondary" onClick={()=>setEditRule(null)}>ביטול</Btn>]}>
          <div style={{padding:"10px 13px",borderRadius:8,background:C.aiBg,border:`1px solid ${C.ai}20`,marginBottom:14,fontSize:12,color:C.ai}}>
            🤖 כאשר <b>{editRule.trigger}</b> → {editRule.action} "{editRule.template}" ({editRule.delay})
          </div>
          <Sl label="טריגר" options={["כניסה לשלב: יצירת קשר","כניסה לשלב: מעוניין","כניסה לשלב: סגירה","זכייה בעסקה","ללא קשר 3 ימים","ללא קשר 7 ימים","ללא קשר 14 ימים"]}/>
          <Sl label="ערוץ" options={["📱 וואטסאפ","📧 מייל"]}/>
          <Sl label="תבנית הודעה" options={["פולו-אפ ראשוני","הצעת מחיר","מעקב אחרי הצעה","החוזה מוכן","ברכת פתיחה"]}/>
          <Sl label="עיכוב שליחה" options={["מיידי","שעה אחרי","3 שעות","יום לאחר","3 ימים לאחר"]}/>
        </Modal>
      )}

      {/* Summary + filters strip */}
      <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center"}}>
        {[["שווי פייפליין","₪293K",C.purple],["ממוצע ימים","34",C.accent],["שיעור המרה","68%",C.success],["אוטומציות פעילות",rules.filter(r=>r.active).length,C.teal]].map(([l,v,c],i)=>(
          <div key={i} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:C.textSub,marginBottom:4}}>{l}</div>
            <div style={{fontSize:19,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
        {/* Filters */}
        <div style={{display:"flex",gap:7,alignItems:"center",marginRight:4}}>
          <select value={instrFilter} onChange={e=>setInstrFilter(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${instrFilter!=="הכל"?C.accent:C.border}`,background:instrFilter!=="הכל"?C.accentBg:C.surface,color:instrFilter!=="הכל"?C.accent:C.textSub,fontSize:12,outline:"none",fontWeight:instrFilter!=="הכל"?600:400}}>
            {INSTR_OPTIONS.map(o=><option key={o}>{o}</option>)}
          </select>
          <select value={cityFilter} onChange={e=>setCityFilter(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${cityFilter!=="הכל"?C.accent:C.border}`,background:cityFilter!=="הכל"?C.accentBg:C.surface,color:cityFilter!=="הכל"?C.accent:C.textSub,fontSize:12,outline:"none",fontWeight:cityFilter!=="הכל"?600:400}}>
            {CITY_OPTIONS.map(o=><option key={o}>{o}</option>)}
          </select>
          {(instrFilter!=="הכל"||cityFilter!=="הכל")&&<button onClick={()=>{setInstrFilter("הכל");setCityFilter("הכל");}} style={{padding:"5px 9px",borderRadius:5,border:`1px solid ${C.danger}30`,background:C.dangerBg,color:C.danger,fontSize:11,cursor:"pointer",fontWeight:600}}>✕</button>}
        </div>
        <div style={{display:"flex",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
          {[{id:"kanban",l:"Kanban"},{id:"rules",l:"⚙️ אוטומציות"}].map(t=>(
            <div key={t.id} onClick={()=>setView(t.id)} style={{padding:"6px 13px",fontSize:12,fontWeight:view===t.id?600:400,color:view===t.id?C.accent:C.textSub,background:view===t.id?C.surface:"transparent",cursor:"pointer"}}>{t.l}</div>
          ))}
        </div>
        {view==="rules"&&<Btn sm>+ הוסף חוק</Btn>}
      </div>

      {/* KANBAN */}
      {view==="kanban"&&(
        <div style={{display:"flex",gap:13,overflowX:"auto",paddingBottom:6}}>
          {cols.map(col=>{
            const [color,bg,border]=STAGE_COLORS[col.stage];
            const stageRules=rulesForStage(col.stage);
            return (
              <div key={col.stage} style={{width:218,flexShrink:0}}>
                {/* Column header */}
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:stageRules.length?6:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                      <span style={{fontSize:12,fontWeight:700,color}}>{col.stage}</span>
                      <span style={{fontSize:10,color:C.textDim,background:bg,border:`1px solid ${border}`,padding:"1px 5px",borderRadius:8,fontWeight:700}}>{col.cards.length}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,color:C.textSub}}>₪{col.cards.reduce((s,c)=>s+parseFloat(c.v.replace(/[₪K]/g,"")),0)}K</span>
                  </div>
                  {/* Automation pills */}
                  {stageRules.map((r,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 7px",borderRadius:5,background:C.aiBg,border:`1px solid ${C.ai}20`,marginBottom:3,cursor:"pointer"}} onClick={()=>setView("rules")}>
                      <span style={{fontSize:11}}>{r.channel}</span>
                      <span style={{fontSize:10,color:C.ai,fontWeight:500,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.template}</span>
                      <span style={{fontSize:9,color:C.textDim}}>{r.delay}</span>
                    </div>
                  ))}
                </div>
                {/* Cards */}
                <div style={{background:bg,border:`1px solid ${border}`,borderRadius:9,padding:7,display:"flex",flexDirection:"column",gap:7,minHeight:80}}>
                  {col.cards.map((card,i)=>(
                    <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",borderTop:`3px solid ${color}`}}>
                      {card.hot&&<div style={{fontSize:9,color:C.danger,fontWeight:700,marginBottom:2}}>🔥 חם</div>}
                      <div style={{fontSize:12,fontWeight:700,marginBottom:3,color:C.text}}>{card.n}</div>
                      <div style={{fontSize:11,color:C.textSub,marginBottom:6}}>👤 {card.c}</div>
                    {card.instructor?(
                      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
                        <Av name={card.instructor} size={16} color={C.purple} bg={C.purpleBg}/>
                        <span style={{fontSize:10,color:C.purple,fontWeight:500}}>{card.instructor}</span>
                      </div>
                    ):(
                      <div style={{fontSize:10,color:C.warning,fontWeight:600,marginBottom:5}}>⚠ ללא מדריך</div>
                    )}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:800,color:C.success}}>{card.v}</span>
                        <span style={{fontSize:10,color:C.textDim}}>{card.d}</span>
                      </div>
                    </div>
                  ))}
                  <button style={{padding:"5px",border:`1px dashed ${border}`,borderRadius:7,background:"transparent",color:C.textDim,fontSize:11,cursor:"pointer"}}>+ הוסף</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AUTOMATION RULES */}
      {view==="rules"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rules.map(rule=>(
            <div key={rule.id} style={{background:C.surface,border:`1px solid ${rule.active?C.border:C.borderLight}`,borderRadius:9,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,opacity:rule.active?1:0.55}}>
              <div style={{width:36,height:36,borderRadius:8,background:rule.active?C.aiBg:C.grayBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{rule.channel}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.textSub}}>אם</span>
                  {bx(rule.trigger,C.purple,C.purpleBg)}
                  <span style={{fontSize:12,color:C.textDim}}>→</span>
                  {bx(rule.action,C.teal,C.tealBg)}
                  <span style={{fontSize:12,color:C.textSub}}>"{rule.template}"</span>
                </div>
                <div style={{fontSize:11,color:C.textDim}}>עיכוב: {rule.delay}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div onClick={()=>setRules(r=>r.map(x=>x.id===rule.id?{...x,active:!x.active}:x))} style={{width:38,height:20,borderRadius:10,background:rule.active?C.accent:C.border,cursor:"pointer",position:"relative",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,right:rule.active?2:18,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"right 0.15s"}}/>
                </div>
                <Btn variant="ghost" sm onClick={()=>setEditRule(rule)}>עריכה</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 4. MESSAGE EDITOR — מלא, נוח, עם character count
// ══════════════════════════════════════════════════════════════
const DEFAULTS={
  "יצירת קשר":{wa:"שלום [שם] 👋\nאני [שם_שולח] מדיגי-טק.\nשמחתי להכיר את [שם_מוסד] — רצינו לשתף אתכם בתוכניות AI לתלמידים.\nניתן לקבוע שיחת היכרות קצרה? 🙏",email:"שלום [שם],\n\nאני [שם_שולח] מדיגי-טק — חברה המתמחה בתוכניות AI ומיומנויות דיגיטל לבתי ספר.\n\nשמחתי להכיר את [שם_מוסד] ואשמח לתאם שיחה קצרה של 15 דקות.\n\nבברכה,\n[שם_שולח] | דיגי-טק"},
  "מעוניין":{wa:"היי [שם] 😊\nבהמשך לשיחתנו — מצורפת ההצעה עבור [שם_מוסד].\nנשמח לשמוע! 🚀\nדיגי-טק",email:"שלום [שם],\n\nבהמשך לשיחתנו, מצורפת הצעת המחיר המפורטת עבור [שם_מוסד].\n\nאשמח לענות על שאלות ולקבוע שיחה.\n\nבברכה,\n[שם_שולח] | דיגי-טק"},
  "סגירה":{wa:"שלום [שם] 🤝\nנשמח לסגור את השיתוף עם [שם_מוסד]!\nניתן לשלוח חוזה?\nדיגי-טק",email:"שלום [שם],\n\nאנחנו שמחים לקדם את השיתוף עם [שם_מוסד]!\nמצורף החוזה לחתימה עד [תאריך].\n\nבברכה,\n[שם_שולח] | דיגי-טק"},
  "זכה":{wa:"ברכות [שם]! 🎉\nשמחים להתחיל את הדרך עם [שם_מוסד]!\nנחזור בקרוב עם פרטי הפתיחה.\nדיגי-טק",email:"שלום [שם],\n\nברכות! נשמח לפתוח את שיתוף הפעולה עם [שם_מוסד].\n\nנחזור אליכם תוך 48 שעות עם לוח זמנים.\n\nבברכה,\n[שם_שולח] | דיגי-טק"},
  "הפסיד":{wa:"שלום [שם],\nמעריכים מאוד את זמנכם 🙏\nאם המצב ישתנה — נשמח לחזור.\nדיגי-טק",email:"שלום [שם],\n\nתודה על הזמן והנכונות לשוחח.\nמקווים לשיתוף פעולה בעתיד.\n\nבברכה,\n[שם_שולח] | דיגי-טק"},
};

const MessagesEditor = () => {
  const [stage,setStage]=useState("יצירת קשר");
  const [ch,setCh]=useState("wa");
  const [tpls,setTpls]=useState(JSON.parse(JSON.stringify(DEFAULTS)));
  const [genning,setGenning]=useState(false);
  const [saveState,setSaveState]=useState({}); // key -> "saved"|"dirty"
  const [showPreview,setShowPreview]=useState(true);
  const taRef=useRef();

  const txt=tpls[stage]?.[ch]||"";
  const setTxt=v=>{
    setTpls(p=>({...p,[stage]:{...p[stage],[ch]:v}}));
    setSaveState(p=>({...p,[stage+ch]:"dirty"}));
  };

  const VARS=[{v:"[שם]",l:"שם איש קשר"},{v:"[שם_מוסד]",l:"שם מוסד"},{v:"[שם_שולח]",l:"שמך"},{v:"[תאריך]",l:"תאריך"},{v:"[תוכנית]",l:"שם תוכנית"}];
  const insertVar=v=>{
    const ta=taRef.current; if(!ta) return;
    const s=ta.selectionStart, e=ta.selectionEnd;
    const newTxt=txt.slice(0,s)+v+txt.slice(e);
    setTxt(newTxt);
    setTimeout(()=>{ta.focus();ta.setSelectionRange(s+v.length,s+v.length);},0);
  };

  const preview=txt
    .replace(/\[שם\]/g,"אבי בן-דוד")
    .replace(/\[שם_מוסד\]/g,"עיריית ת״א")
    .replace(/\[שם_שולח\]/g,"יעל כהן")
    .replace(/\[תאריך\]/g,"30.6.25")
    .replace(/\[תוכנית\]/g,"Creators AI");

  const generateAI=async()=>{
    setGenning(true);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:`Write a ${ch==="wa"?"WhatsApp message (max 4 lines, warm, 1-2 emojis ok)":"professional email (warm, 5-7 lines with greeting and sign-off)"} in Hebrew for Digi-tech (Israeli edtech) at CRM pipeline stage "${stage}". Use these exact placeholders where natural: [שם], [שם_מוסד], [שם_שולח], [תאריך]. Return ONLY the message text, no explanation.`}]})});
      const d=await r.json();
      const generated=d.content?.[0]?.text?.trim()||txt;
      setTxt(generated);
    }catch{}
    setGenning(false);
  };

  const doSave=()=>{
    setSaveState(p=>({...p,[stage+ch]:"saved"}));
    setTimeout(()=>setSaveState(p=>({...p,[stage+ch]:undefined})),2500);
  };
  const isEdited=txt!==DEFAULTS[stage]?.[ch];
  const savedKey=saveState[stage+ch];
  const WA_LIMIT=1024;

  return (
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ── LEFT RAIL: stage picker ── */}
      <div style={{width:186,flexShrink:0,borderLeft:`1px solid ${C.border}`,background:C.surface,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 14px 8px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px"}}>שלב בפייפליין</div>
        {STAGES.map(s=>{
          const [color]=STAGE_COLORS[s];
          const waDirty=tpls[s]?.wa!==DEFAULTS[s]?.wa;
          const emDirty=tpls[s]?.email!==DEFAULTS[s]?.email;
          const active=stage===s;
          return (
            <div key={s} onClick={()=>setStage(s)} style={{padding:"11px 14px",cursor:"pointer",borderRight:active?`3px solid ${color}`:"3px solid transparent",background:active?`${color}10`:"transparent",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
                <span style={{fontSize:12,fontWeight:active?700:400,color:active?color:C.text}}>{s}</span>
              </div>
              <div style={{display:"flex",gap:2,flexShrink:0}}>
                <span style={{fontSize:9,opacity:waDirty?1:0.25}}>📱</span>
                <span style={{fontSize:9,opacity:emDirty?1:0.25}}>📧</span>
              </div>
            </div>
          );
        })}
        {/* Channel toggle at bottom */}
        <div style={{marginTop:"auto",borderTop:`1px solid ${C.border}`,padding:"12px 14px"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textSub,marginBottom:7}}>ערוץ</div>
          {[{id:"wa",l:"📱 וואטסאפ",c:C.teal},{id:"email",l:"📧 מייל",c:C.accent}].map(t=>(
            <div key={t.id} onClick={()=>setCh(t.id)} style={{padding:"7px 10px",borderRadius:6,marginBottom:5,cursor:"pointer",background:ch===t.id?`${t.c}15`:C.bg,border:`1px solid ${ch===t.id?t.c:C.border}`,fontSize:12,fontWeight:ch===t.id?700:400,color:ch===t.id?t.c:C.textSub}}>{t.l}</div>
          ))}
        </div>
      </div>

      {/* ── CENTER: editor ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0,background:C.surface}}>
          <span style={{fontSize:13,fontWeight:700,color:C.text}}>{stage}</span>
          <span style={{fontSize:12,color:C.textDim}}>—</span>
          <span style={{fontSize:12,color:ch==="wa"?C.teal:C.accent,fontWeight:600}}>{ch==="wa"?"📱 וואטסאפ":"📧 מייל"}</span>
          {isEdited&&<span style={{fontSize:10,color:C.warning,fontWeight:600,background:C.warningBg,padding:"1px 6px",borderRadius:4}}>● לא נשמר</span>}
          <div style={{flex:1}}/>
          <Btn variant="secondary" sm onClick={()=>setShowPreview(p=>!p)}>{showPreview?"הסתר תצוגה מקדימה":"הצג תצוגה מקדימה"}</Btn>
          <Btn variant="ai" sm onClick={generateAI} style={{minWidth:110,justifyContent:"center"}}>{genning?"⟳ מייצר...":"🤖 צור עם AI"}</Btn>
        </div>

        {/* Variable chips */}
        <div style={{padding:"8px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",background:C.bg,flexShrink:0}}>
          <span style={{fontSize:11,color:C.textSub,fontWeight:500,marginLeft:2}}>הכנס משתנה:</span>
          {VARS.map(({v,l})=>(
            <button key={v} title={l} onClick={()=>insertVar(v)} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${C.accent}30`,background:C.accentBg,color:C.accent,fontSize:11,cursor:"pointer",fontWeight:600}}>{v}</button>
          ))}
        </div>

        {/* Textarea + preview */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          {/* Textarea */}
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"14px 18px",gap:8}}>
            <textarea
              ref={taRef}
              value={txt}
              onChange={e=>setTxt(e.target.value)}
              style={{flex:1,width:"100%",boxSizing:"border-box",padding:"13px 15px",border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,lineHeight:1.8,resize:"none",outline:"none",fontFamily:"inherit",color:C.text,background:C.surface}}
              placeholder={`כתוב כאן את הודעת ה${ch==="wa"?"וואטסאפ":"מייל"} לשלב "${stage}"...`}
            />
            {/* Footer: char count + actions */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {ch==="wa"&&(
                <span style={{fontSize:11,color:txt.length>WA_LIMIT?C.danger:C.textDim}}>
                  {txt.length}/{WA_LIMIT} תווים
                </span>
              )}
              <div style={{flex:1}}/>
              {isEdited&&<Btn variant="secondary" sm onClick={()=>setTxt(DEFAULTS[stage]?.[ch]||"")}>↩ אפס</Btn>}
              <Btn sm onClick={doSave} style={{minWidth:120,justifyContent:"center"}}>
                {savedKey==="saved"?"✓ נשמר":"💾 שמור תבנית"}
              </Btn>
            </div>
          </div>

          {/* Live preview panel */}
          {showPreview&&(
            <div style={{width:280,flexShrink:0,borderRight:`1px solid ${C.border}`,padding:"14px 16px",background:C.bg,overflowY:"auto"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>תצוגה מקדימה</div>
              <div style={{fontSize:11,color:C.textDim,marginBottom:10}}>עם ערכים לדוגמה</div>
              {ch==="wa"?(
                <div style={{background:"#E9FBD8",borderRadius:"0 12px 12px 12px",padding:"11px 13px",fontSize:13,lineHeight:1.7,color:"#1a1a1a",whiteSpace:"pre-wrap",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                  {preview}
                </div>
              ):(
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>
                  <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,background:C.bg}}>
                    <div style={{fontSize:10,color:C.textSub}}>מאת: יעל כהן &lt;yael@digitek.co.il&gt;</div>
                    <div style={{fontSize:10,color:C.textSub}}>אל: אבי בן-דוד &lt;avi@tlv.gov.il&gt;</div>
                  </div>
                  <div style={{padding:"11px 13px",fontSize:12,lineHeight:1.75,color:C.text,whiteSpace:"pre-wrap"}}>{preview}</div>
                </div>
              )}
              {/* Tips */}
              <div style={{marginTop:14,padding:"10px 12px",borderRadius:8,background:C.aiBg,border:`1px solid ${C.ai}20`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.ai,marginBottom:5}}>💡 טיפ לשלב זה</div>
                <div style={{fontSize:11,color:C.text,lineHeight:1.5}}>
                  {stage==="יצירת קשר"&&"שמור על טון חם ואישי. הכנס שם מוסד ספציפי."}
                  {stage==="מעוניין"&&"הזכר מה דיברתם. הצמד קישור להצעה."}
                  {stage==="סגירה"&&"צור urgency עדינה עם תאריך יעד ברור."}
                  {stage==="זכה"&&"חגוג! עבור מהר לפרטים הלוגיסטיים."}
                  {stage==="הפסיד"&&"השאר דלת פתוחה. אל תלחץ."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 5. BROADCAST — UX חלק
// ══════════════════════════════════════════════════════════════
const BroadcastScreen = () => {
  const [step,setStep]=useState(0);
  const [ch,setCh]=useState("wa");
  const [selList,setSelList]=useState(null);
  const [selTpl,setSelTpl]=useState(null);
  const [sent,setSent]=useState(false);
  const [sending,setSending]=useState(false);

  const lists=[
    {id:1,name:"לידים חדשים — יוני 25",count:18,tag:"יצירת קשר",desc:"הצטרפו החודש"},
    {id:2,name:"מעוניין — ללא מענה 7 ימים",count:11,tag:"מעוניין",desc:"לא ענו בשבוע"},
    {id:3,name:"לקוחות — פוטנציאל חידוש",count:14,tag:"Customer",desc:"חוזה מסתיים 90 יום"},
    {id:4,name:"כל הלידים הפעילים",count:34,tag:"כל",desc:"לא הפסידו"},
    {id:5,name:"מנהלי חינוך — ת״א",count:24,tag:"ידנית",desc:"רשימה ידנית"},
  ];
  const templates={
    wa:[{id:1,name:"פולו-אפ ראשוני",stage:"יצירת קשר",p:"שלום [שם], אני מדיגי-טק 👋..."},{id:2,name:"מעקב אחרי הצעה",stage:"מעוניין",p:"היי [שם], רציתי לבדוק אם..."}],
    email:[{id:3,name:"הצעת מחיר",stage:"מעוניין",p:"שלום [שם], בהמשך לשיחתנו..."},{id:4,name:"חידוש חוזה",stage:"Customer",p:"שלום [שם], שמחים לחדש..."}],
  };

  const doSend=()=>{setSending(true);setTimeout(()=>{setSending(false);setSent(true);},1400);};
  const reset=()=>{setStep(0);setSelList(null);setSelTpl(null);setSent(false);setSending(false);};

  return (
    <div style={{padding:"20px 24px",overflow:"auto",flex:1}}>
      {/* Channel switcher */}
      <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
        <div style={{display:"flex",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>
          {[{id:"wa",l:"📱 וואטסאפ",c:C.teal},{id:"email",l:"📧 מייל",c:C.accent}].map(t=>(
            <div key={t.id} onClick={()=>{setCh(t.id);setSelTpl(null);}} style={{padding:"7px 18px",fontSize:13,fontWeight:ch===t.id?600:400,color:ch===t.id?t.c:C.textSub,background:ch===t.id?C.surface:"transparent",cursor:"pointer",borderLeft:t.id==="wa"?`1px solid ${C.border}`:"none"}}>{t.l}</div>
          ))}
        </div>
        <div style={{flex:1}}/>
        {/* Steps */}
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          {["בחר קהל","בחר הודעה","שלח"].map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,cursor:i<=step?"pointer":"default"}} onClick={()=>i<=step&&setStep(i)}>
                <div style={{width:22,height:22,borderRadius:"50%",background:i<step?C.success:i===step?C.accent:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>{i<step?"✓":i+1}</div>
                <span style={{fontSize:12,fontWeight:i===step?600:400,color:i===step?C.text:C.textSub}}>{s}</span>
              </div>
              {i<2&&<div style={{width:30,height:1,background:i<step?C.success:C.border,margin:"0 8px"}}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: list */}
      {step===0&&(
        <div style={{maxWidth:600}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>בחר רשימת נמענים</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {lists.map(l=>(
              <div key={l.id} onClick={()=>setSelList(l)} style={{background:C.surface,border:`2px solid ${selList?.id===l.id?C.accent:C.border}`,borderRadius:9,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"border-color 0.15s"}}>
                <div style={{width:36,height:36,borderRadius:8,background:C.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>📋</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{l.name}</div>
                  <div style={{fontSize:11,color:C.textSub,marginTop:1}}>{l.desc}</div>
                </div>
                <div style={{textAlign:"center",minWidth:48}}>
                  <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{l.count}</div>
                  <div style={{fontSize:10,color:C.textDim}}>נמענים</div>
                </div>
                {selList?.id===l.id&&<span style={{color:C.accent,fontSize:18,fontWeight:700}}>✓</span>}
              </div>
            ))}
          </div>
          <Btn disabled={!selList} onClick={()=>setStep(1)}>הבא — בחר הודעה →</Btn>
        </div>
      )}

      {/* Step 1: template */}
      {step===1&&(
        <div style={{maxWidth:580}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>בחר תבנית הודעה</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {(templates[ch]||[]).map(t=>(
              <div key={t.id} onClick={()=>setSelTpl(t)} style={{background:C.surface,border:`2px solid ${selTpl?.id===t.id?C.accent:C.border}`,borderRadius:9,padding:"12px 15px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:600}}>{t.name}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {bx(t.stage,C.purple,C.purpleBg)}
                    {selTpl?.id===t.id&&<span style={{color:C.accent,fontWeight:700}}>✓</span>}
                  </div>
                </div>
                <div style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>{t.p}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="secondary" onClick={()=>setStep(0)}>← חזור</Btn>
            <Btn disabled={!selTpl} onClick={()=>setStep(2)}>הבא — אישור →</Btn>
          </div>
        </div>
      )}

      {/* Step 2: confirm / sent */}
      {step===2&&(
        <div style={{maxWidth:480}}>
          {!sent?(
            <>
              <Banner type="info">עומד לשלוח <b>{ch==="wa"?"וואטסאפ":"מייל"}</b> ל-<b>{selList?.count} נמענים</b></Banner>
              <Card style={{marginBottom:14}}>
                {[["ערוץ",ch==="wa"?"📱 וואטסאפ":"📧 מייל"],["רשימה",`${selList?.name} (${selList?.count})`],["תבנית",selTpl?.name||"—"],["שליחה","מיידית"]].map(([k,v],i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<3?`1px solid ${C.borderLight}`:"none"}}>
                    <span style={{width:70,fontSize:12,color:C.textSub,fontWeight:500}}>{k}</span>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{v}</span>
                  </div>
                ))}
              </Card>
              <div style={{padding:"12px 14px",borderRadius:9,background:ch==="wa"?"#E9FBD8":"#EEF2FF",marginBottom:16,fontSize:12,lineHeight:1.7,color:C.text}}>{selTpl?.p?.replace("[שם]","[שם הנמען]")}</div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="secondary" onClick={()=>setStep(1)}>← חזור</Btn>
                <Btn style={{flex:1,justifyContent:"center"}} onClick={doSend}>{sending?"⟳ שולח...":"📤 שלח עכשיו"}</Btn>
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:44,marginBottom:14}}>✅</div>
              <div style={{fontSize:17,fontWeight:700,marginBottom:6}}>נשלח בהצלחה!</div>
              <div style={{fontSize:13,color:C.textSub,marginBottom:24}}>{selList?.count} הודעות נשלחו לרשימה "{selList?.name}"</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:22,maxWidth:320,margin:"0 auto 22px"}}>
                {[["נשלחו",selList?.count,C.success],["נפתחו","—",C.accent],["שגיאות","0",C.gray]].map(([l,v,c],i)=>(
                  <div key={i} style={{padding:"10px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:11,color:C.textSub}}>{l}</div>
                    <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              <Btn onClick={reset}>שליחה חדשה</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// FOLLOW-UP + PROFILE (compact)
// ══════════════════════════════════════════════════════════════
const FollowupQueue = ({setScreen}) => {
  const groups=[{label:"🔴 באיחור",color:C.danger,bg:C.dangerBg,items:[{n:"רשת אורט ברודה",task:"שיחת מעקב",contact:"מירי כץ",step:"אשר תאריך",due:"3 ימים"},{n:"בתי ספר עמל",task:"שלח הצעה",contact:"אורלי",step:"שלח תמחור",due:"5 ימים"}]},{label:"🟡 היום",color:C.warning,bg:C.warningBg,items:[{n:"מועצת השרון",task:"סקירת חוזה",contact:"דרור כץ",step:"שלח חוזה",due:"היום"}]},{label:"🟢 בקרוב",color:C.success,bg:C.successBg,items:[{n:"בית ספר ריאלי",task:"שיחת דמו",contact:"טלי מור",step:"הכן דמו",due:"מחר"},{n:"עיריית ב״ש",task:"שיחת חידוש",contact:"גל לוי",step:"סקור היסטוריה",due:"3 ימים"}]}];
  return (
    <div style={{padding:"20px 24px",overflow:"auto",flex:1}}>
      <Banner type="danger">2 פעולות <b>באיחור של יותר מ-3 ימים</b></Banner>
      {groups.map((g,gi)=>(
        <div key={gi} style={{marginBottom:18}}>
          <div style={{display:"inline-flex",padding:"4px 10px",borderRadius:6,background:g.bg,color:g.color,fontSize:12,fontWeight:700,marginBottom:9}}>{g.label} ({g.items.length})</div>
          {g.items.map((item,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:7,display:"flex",alignItems:"center",gap:12}}>
              <Av name={item.n} size={30}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{item.n}</div><div style={{fontSize:11,color:C.textSub}}>{item.task} · {item.contact}</div></div>
              <div style={{fontSize:11,color:C.textSub,maxWidth:140}}>⏭ {item.step}</div>
              <div style={{fontSize:12,fontWeight:700,color:g.color,minWidth:70,textAlign:"right"}}>{item.due}</div>
              <Btn sm onClick={()=>setScreen("profile")}>פתח →</Btn>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const InstitutionProfile = ({setScreen}) => {
  const [tab,setTab]=useState("סקירה");
  const TABS=["סקירה","אנשי קשר","הזדמנויות","פעילות","תוכניות","תקשורת","קבצים","AI"];
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 24px 0",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:40,height:40,borderRadius:9,background:C.accentBg,color:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800}}>ת״א</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}><span style={{fontSize:16,fontWeight:800}}>עיריית תל אביב</span>{classBadge("Customer")}{stageBadge("סגירה")}</div>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.textSub}}>
                <span>👤 <b style={{color:C.text}}>יעל כהן</b></span><span>📞 <b style={{color:C.text}}>אבי בן-דוד</b></span><span>⏭ <b style={{color:C.accent}}>שלח הצעה — מחר</b></span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn variant="teal" sm>📱 וואטסאפ</Btn><Btn variant="ghost" sm>📧 מייל</Btn><Btn variant="secondary" sm>+ הזדמנות</Btn><Btn variant="ai" sm>🤖 AI</Btn><Btn sm>✏️</Btn>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {[["קשרים","3",C.accent,C.accentBg],["הזדמנויות","3",C.warning,C.warningBg],["תוכניות","5",C.purple,C.purpleBg],["הכנסות","₪92K",C.success,C.successBg],["AI Score","87",C.ai,C.aiBg]].map(([l,v,c,bg],i)=>(
            <div key={i} style={{flex:1,padding:"7px 11px",borderRadius:7,background:bg,border:`1px solid ${c}15`}}><div style={{fontSize:9,color:c,fontWeight:500,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div></div>
          ))}
        </div>
        <div style={{display:"flex",overflowX:"auto"}}>
          {TABS.map(t=><div key={t} onClick={()=>setTab(t)} style={{padding:"7px 14px",fontSize:12,fontWeight:tab===t?600:400,color:tab===t?C.accent:C.textSub,borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>{t}</div>)}
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:"18px 24px"}}>
        <Card><div style={{fontSize:13,color:C.textSub}}>תוכן הטאב <b>"{tab}"</b> — ניווט מלא זמין בטאבים למעלה</div></Card>
      </div>
    </div>
  );
};

// ─── APP SHELL ────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("dashboard");
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',sans-serif",direction:"rtl",overflow:"hidden"}}>
      <Navbar screen={screen} setScreen={setScreen}/>
      <Breadcrumbs screen={screen} setScreen={setScreen}/>
      <SubNav screen={screen} setScreen={setScreen}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {screen==="dashboard"&&<Dashboard setScreen={setScreen}/>}
        {screen==="list"&&<InstitutionsList setScreen={setScreen}/>}
        {screen==="pipeline"&&<PipelineScreen/>}
        {screen==="messages"&&<MessagesEditor/>}
        {screen==="broadcast"&&<BroadcastScreen/>}
        {screen==="followup"&&<FollowupQueue setScreen={setScreen}/>}
        {screen==="profile"&&<InstitutionProfile setScreen={setScreen}/>}
      </div>
    </div>
  );
}
