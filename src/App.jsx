import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Heart, House, Footprints, BookOpen, Cloud, CloudOff, LogOut, Download, ShieldCheck, RefreshCw } from 'lucide-react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, configured } from './firebase'

const KEY='better-every-day-v1'
const START='2026-11-06'
const tasks=[
  {id:'wake',name:'Wake up as planned; avoid morning scrolling',group:'Discipline'},
  {id:'home',name:'Own a household responsibility without reminders',group:'Home'},
  {id:'kids',name:'Be present for the children and their needs',group:'Family'},
  {id:'partner',name:'Give my partner undistracted attention',group:'Family'},
  {id:'walk',name:'Walk or exercise for at least 20 minutes',group:'Health'},
  {id:'pending',name:'Finish one pending personal task',group:'Discipline'},
  {id:'phone',name:'Stay within my recreational screen-time limit',group:'Discipline'}
]
const firstDay=[
  {id:'temple',name:'Visit the temple early in the morning'},
  {id:'breakfast',name:'Bring breakfast home'},
  {id:'school',name:'Help Ekaa get ready for school'},
  {id:'housework',name:'Complete household chores'},
  {id:'shelf',name:'Tidy one shelf of clothes from the trip'},
  {id:'shopping',name:'Buy crackers and Diwali light supplies safely'},
  {id:'lights',name:'Set up Diwali lights safely'},
  {id:'evening',name:'Take an evening walk'}
]
const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const starter=()=>({days:{},schemaVersion:1})
function loadLocal(){try{const v=JSON.parse(localStorage.getItem(KEY));return v && typeof v.days==='object'?v:starter()}catch{return starter()}}
const dayNumber=(date)=>Math.floor((Date.parse(`${date}T12:00:00Z`)-Date.parse(`${START}T12:00:00Z`))/86400000)+1
const phase=(n)=>n<=7?'Build the basics':n<=14?'Own my responsibilities':n<=21?'Rebuild connection':'Make it a lifestyle'

export default function App(){
  const [data,setData]=useState(loadLocal)
  const [date,setDate]=useState(localDay)
  const [tab,setTab]=useState('Today')
  const [user,setUser]=useState(null)
  const [credentials,setCredentials]=useState({email:'',password:''})
  const [authError,setAuthError]=useState('')
  const [syncState,setSyncState]=useState('Local only')
  const [busy,setBusy]=useState(false)
  const [showAccount,setShowAccount]=useState(false)
  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(data))},[data])
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,u=>{setUser(u);setSyncState(u?'Ready to sync':'Local only')})},[])
  const selected=data.days[date]||{checked:[],plan:[],journal:'',wins:'',minutes:0}
  const done=selected.checked||[]
  const completed=tasks.filter(t=>done.includes(t.id)).length
  const n=dayNumber(date)
  const update=(patch)=>setData(current=>({...current,days:{...current.days,[date]:{...(current.days[date]||{}),...patch}}}))
  const toggle=(field,id)=>{const values=selected[field]||[];update({[field]:values.includes(id)?values.filter(x=>x!==id):[...values,id]})}
  const totals=useMemo(()=>{
    const days=Object.values(data.days)
    return {days:days.filter(d=>(d.checked||[]).length>0).length,habits:days.reduce((v,d)=>v+(d.checked||[]).length,0),minutes:days.reduce((v,d)=>v+(Number(d.minutes)||0),0)}
  },[data])
  async function login(create){
    setBusy(true);setAuthError('')
    try{
      if(!configured)throw Error('Add Firebase settings to your .env file first.')
      if(create)await createUserWithEmailAndPassword(auth,credentials.email,credentials.password)
      else await signInWithEmailAndPassword(auth,credentials.email,credentials.password)
      setShowAccount(false);setCredentials(c=>({...c,password:''}))
    }catch(e){setAuthError(e.message)}finally{setBusy(false)}
  }
  async function sync(direction){
    if(!user||!db)return
    setBusy(true);setSyncState('Syncing...')
    try{
      const ref=doc(db,'users',user.uid,'app','tracker')
      if(direction==='up'){
        await setDoc(ref,{schemaVersion:1,days:data.days,updatedAt:serverTimestamp()})
        setSyncState('Uploaded to Firebase')
      }else{
        const snapshot=await getDoc(ref)
        if(snapshot.exists() && snapshot.data().days && typeof snapshot.data().days==='object'){
          setData({schemaVersion:1,days:snapshot.data().days})
          setSyncState('Downloaded from Firebase')
        } else setSyncState('No cloud backup yet')
      }
    }catch(e){setSyncState(`Sync failed: ${e.message}`)}finally{setBusy(false)}
  }
  function exportData(){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob);const a=document.createElement('a')
    a.href=url;a.download='better-every-day-backup.json';a.click();URL.revokeObjectURL(url)
  }
  return <div className="shell">
    <header className="top"><div className="brand"><div className="logo"><CheckCircle2 size={26}/></div><div><strong>BETTER EVERY DAY</strong><small>One day. One promise. One improvement.</small></div></div><button className="avatar" onClick={()=>setShowAccount(s=>!s)} aria-label="Account and sync"><Cloud size={18}/></button></header>
    {showAccount&&<section className="account card"><h3><ShieldCheck size={20}/> Local + Firebase</h3><p>Your entries stay on this device unless you choose to upload them. Cloud upload and download are manual to avoid accidental overwrites.</p>
      {!configured?<p className="notice">Firebase is not configured yet. The local tracker works now; see README for setup.</p>:user?<><p>Signed in: <b>{user.email}</b></p><div className="actions"><button disabled={busy} onClick={()=>sync('up')}><Cloud size={16}/> Upload local to Firebase</button><button disabled={busy} onClick={()=>sync('down')}><RefreshCw size={16}/> Restore from Firebase</button><button onClick={()=>signOut(auth)}><LogOut size={16}/> Sign out</button></div><p className="small">{syncState}</p></>:<><div className="inputs"><input type="email" placeholder="Email" aria-label="Email" value={credentials.email} onChange={e=>setCredentials({...credentials,email:e.target.value})}/><input type="password" placeholder="Password" aria-label="Password" value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/></div><div className="actions"><button disabled={busy} onClick={()=>login(false)}>Sign in</button><button disabled={busy} className="secondary" onClick={()=>login(true)}>Create account</button></div>{authError&&<p className="error">{authError}</p>}</>}
    </section>}
    <main>
      <div className="hero"><div><span className="eyebrow">YOUR PERSONAL RESET</span><h1>Progress begins<br/>with showing up.</h1><p>Not perfection. Just consistent care for yourself and the people around you.</p></div><div className="hero-icon">✳</div></div>
      <div className="datebar"><div><span className="eyebrow">YOUR JOURNEY</span><h2>{n>=1&&n<=30?`Day ${n} of 30`:n<1?'Before your challenge':'Beyond the 30 days'}</h2><span className="muted">{phase(Math.max(1,Math.min(30,n)))}</span></div><label className="date-label">View date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      <nav>{['Today','Progress','Reflect'].map(t=><button className={tab===t?'selected':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</nav>
      {tab==='Today'&&<>
        <section className="card"><div className="sectiontop"><div><span className="eyebrow">TODAY'S PROMISES</span><h2>Small things matter.</h2></div><div className="counter">{completed}<span> / {tasks.length}</span></div></div><div className="progress"><div style={{width:`${completed/tasks.length*100}%`}}/></div>
          <div className="checklist">{tasks.map(t=><label className="checkrow" key={t.id}><input type="checkbox" checked={done.includes(t.id)} onChange={()=>toggle('checked',t.id)}/><span className="task"><span>{t.name}</span><small>{t.group}</small></span></label>)}</div>
        </section>
        <section className="card"><div className="sectiontop"><div><span className="eyebrow">YOUR OWN PLAN</span><h2>{date===START?'Day 1 mission':'Today’s tasks'}</h2></div><House size={21}/></div>
          {date===START&&firstDay.map(t=><label className="checkrow" key={t.id}><input type="checkbox" checked={(selected.plan||[]).includes(t.id)} onChange={()=>toggle('plan',t.id)}/><span className="task">{t.name}</span></label>)}
          <form className="addrow" onSubmit={e=>{e.preventDefault();const field=e.currentTarget.elements.task;const val=field.value.trim();if(!val)return;update({extra:[...(selected.extra||[]),{id:`custom-${Date.now()}`,name:val,done:false}]});field.value=''}}>
          <input name="task" aria-label="Add a task" placeholder="Add your own task..." maxLength="140"/><button>Add</button></form>
          {(selected.extra||[]).map(x=><label className="checkrow" key={x.id}><input type="checkbox" checked={!!x.done} onChange={()=>update({extra:selected.extra.map(item=>item.id===x.id?{...item,done:!item.done}:item)})}/><span className="task">{x.name}</span></label>)}
        </section>
        <section className="card"><div className="sectiontop"><div><span className="eyebrow">MOVE YOUR BODY</span><h2>Walking minutes</h2></div><Footprints size={22}/></div><div className="minute"><input type="number" min="0" max="600" value={selected.minutes??0} onChange={e=>update({minutes:Math.max(0,Math.min(600,Number(e.target.value)||0))})}/><span>minutes today</span></div><p className="muted">Start with 20 minutes. A shorter walk still counts as progress.</p></section>
      </>}
      {tab==='Progress'&&<><div className="stats"><div className="card"><span className="eyebrow">ACTIVE DAYS</span><b>{totals.days}</b></div><div className="card"><span className="eyebrow">HABITS DONE</span><b>{totals.habits}</b></div><div className="card"><span className="eyebrow">WALKING MIN</span><b>{totals.minutes}</b></div></div><section className="card"><h2>Your 30-day journey</h2><p className="muted">Tap a day to view or update its checklist.</p><div className="calendar">{Array.from({length:30},(_,i)=>{const d=new Date(`${START}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);const iso=d.toISOString().slice(0,10);const count=(data.days[iso]?.checked||[]).length;return <button key={iso} className={`${count===7?'complete':count>0?'started':''} ${date===iso?'current':''}`} onClick={()=>{setDate(iso);setTab('Today')}} title={`${count} of 7 habits`}>{i+1}</button>})}</div><div className="legend"><span>● Started</span><span>● All 7 habits</span></div></section></>}
      {tab==='Reflect'&&<section className="card"><div className="sectiontop"><div><span className="eyebrow">EVENING REVIEW</span><h2>Reflect without judging.</h2></div><BookOpen size={21}/></div><label className="field">What went well today?<textarea value={selected.wins||''} onChange={e=>update({wins:e.target.value})} placeholder="Even one small win matters."/></label><label className="field">What could I do differently tomorrow?<textarea value={selected.journal||''} onChange={e=>update({journal:e.target.value})} placeholder="Write with kindness and honesty."/></label><p className="notice">Your reflections are saved locally. Only upload to Firebase if you want them backed up.</p></section>}
      <section className="backup"><div><h3>Your information belongs to you.</h3><p>Local by default. Optional account-based cloud backup.</p></div><button onClick={exportData}><Download size={17}/> Export JSON</button></section>
    </main><footer>Built for better habits, not perfect days. <span>{configured?<><Cloud size={13}/> Firebase available</>:<><CloudOff size={13}/> Local mode</>}</span></footer>
  </div>
}
