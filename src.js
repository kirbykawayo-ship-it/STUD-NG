import { createClient } from '@supabase/supabase-js';

const config = window.STUDING_CONFIG || {};
const configured = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('YOUR_') && !config.SUPABASE_ANON_KEY.includes('YOUR_'));
const supabase = configured ? createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { user:null, profile:null, view:'home', timerSeconds:0, timerStartedAt:null, timerInterval:null, paused:false, elapsedBeforePause:0, posts:[], likes:new Set(), comments:{}, rankingPeriod:'week', demo:true };
const demoProfiles = [
  {id:'demo-1',username:'haru_study',total:1380,month:760,week:520,today:80,initial:'H'},
  {id:'demo-2',username:'mikan_23',total:1125,month:690,week:445,today:65,initial:'M'},
  {id:'demo-3',username:'sora_note',total:970,month:580,week:390,today:45,initial:'S'},
  {id:'demo-4',username:'study_days',total:720,month:440,week:300,today:35,initial:'D'},
  {id:'demo-5',username:'blue_pencil',total:610,month:360,week:255,today:25,initial:'B'}
];
const demoPosts = [
  {id:'d1',user_id:'demo-1',username:'haru_study',initial:'H',minutes:50,subject:'数学の問題集',created_at:new Date(Date.now()-1000*60*18).toISOString(),likes_count:4,comments:[{username:'mikan_23',body:'おつかれさま！'}]},
  {id:'d2',user_id:'demo-2',username:'mikan_23',initial:'M',minutes:35,subject:'英単語と英文法',created_at:new Date(Date.now()-1000*60*70).toISOString(),likes_count:2,comments:[]},
  {id:'d3',user_id:'demo-3',username:'sora_note',initial:'S',minutes:25,subject:'理科の復習',created_at:new Date(Date.now()-1000*60*180).toISOString(),likes_count:6,comments:[]}
];
function initials(name='S'){return [...name.trim()][0]?.toUpperCase()||'S'}
function minutesText(m){const n=Math.max(0,Math.floor(m||0));return `${Math.floor(n/60)}時間${n%60}分`}
function compactMinutes(m){const n=Math.max(0,Math.floor(m||0));return n>=60?`${Math.floor(n/60)}h ${n%60}m`:`${n}分`}
function relativeTime(date){const ms=Date.now()-new Date(date).getTime();if(ms<60000)return 'たった今';if(ms<3600000)return `${Math.floor(ms/60000)}分前`;if(ms<86400000)return `${Math.floor(ms/3600000)}時間前`;return `${Math.floor(ms/86400000)}日前`}
function showNotice(message,type=''){const n=$('#notice');n.textContent=message;n.className=`notice ${type}`;n.classList.remove('hidden');clearTimeout(showNotice.timeout);showNotice.timeout=setTimeout(()=>n.classList.add('hidden'),6500)}
function showView(view){state.view=view;const names={home:'みんなの勉強ログ',ranking:'勉強時間ランキング',timer:'勉強タイマー',chat:'みんなのチャット',profile:'マイプロフィール'};$('#page-title').textContent=names[view]||names.home;$('#home-view').classList.toggle('hidden',view!=='home');['ranking','timer','chat','profile'].forEach(v=>$('#'+v+'-view').classList.toggle('hidden',view!==v));$('#public-banner').classList.toggle('hidden',view!=='home');$('#stats-grid').classList.toggle('hidden',view!=='home');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='ranking')renderRanking();if(view==='chat')loadChat();if(view==='profile')renderProfile();window.scrollTo({top:0,behavior:'smooth'})}
function demoMode(){state.demo=true;$('#connection-label').textContent='デモモード';$('#feed-list').innerHTML='';state.posts=demoPosts;renderFeed();renderStats();renderRanking();renderProfile();renderChatDemo();$('#public-banner').classList.remove('hidden');}
async function loadAll(){if(!supabase){demoMode();return}state.demo=false;$('#connection-label').textContent='オンライン';const {data:{user}}=await supabase.auth.getUser();state.user=user;if(user){const {data:profile}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();state.profile=profile;if(!profile){const username=(user.user_metadata?.username||user.email?.split('@')[0]||'student').slice(0,24);const result=await supabase.from('profiles').upsert({id:user.id,username}).select().single();state.profile=result.data}}await Promise.all([loadPosts(),renderStats(),renderRanking(),loadChat(),renderProfile()]);updateAccountButton();}
async function loadPosts(){if(state.demo)return;const {data,error}=await supabase.from('study_logs').select('id,user_id,minutes,subject,created_at,profiles(username)').order('created_at',{ascending:false}).limit(30);if(error){showNotice('勉強ログを読み込めませんでした。SupabaseのSQL設定を確認してください。','error');return}const ids=(data||[]).map(p=>p.id);let likes=[],comments=[];if(ids.length){const l=await supabase.from('likes').select('log_id,user_id').in('log_id',ids);likes=l.data||[];const c=await supabase.from('comments').select('id,log_id,user_id,body,created_at,profiles(username)').in('log_id',ids).order('created_at',{ascending:true});comments=c.data||[]}state.posts=(data||[]).map(p=>({...p,username:p.profiles?.username||'student',initial:initials(p.profiles?.username),likes_count:likes.filter(l=>l.log_id===p.id).length,liked:likes.some(l=>l.log_id===p.id&&l.user_id===state.user?.id),comments:comments.filter(c=>c.log_id===p.id)}));renderFeed();}
function renderFeed(){const list=$('#feed-list');if(!state.posts.length){list.innerHTML='';$('#feed-empty').classList.remove('hidden');return}$('#feed-empty').classList.add('hidden');list.innerHTML=state.posts.map(p=>`<article class="feed-item"><div class="avatar">${escapeHTML(p.initial||initials(p.username))}</div><div class="feed-body"><div class="feed-head"><strong>${escapeHTML(p.username)}</strong><span class="feed-time">${relativeTime(p.created_at)}</span></div><p class="feed-copy">${p.subject?`<b>${escapeHTML(p.subject)}</b> を勉強しました。`:'勉強をがんばりました。'}</p><div class="feed-meta"><span class="duration-chip">◷ ${compactMinutes(p.minutes)}</span></div><div class="feed-actions"><button class="action-button ${p.liked||state.likes.has(p.id)?'liked':''}" data-like="${p.id}">♡ いいね ${p.likes_count||0}</button><button class="action-button" data-comment-toggle="${p.id}">▢ コメント ${(p.comments||[]).length}</button></div><div class="comment-list">${(p.comments||[]).map(c=>`<p class="comment-line"><b>${escapeHTML(c.profiles?.username||c.username||'メンバー')}：</b>${escapeHTML(c.body)}</p>`).join('')}</div><form class="comment-editor" data-comment-form="${p.id}"><input name="body" maxlength="300" placeholder="コメントを書く…" aria-label="コメント" /><button type="submit">送信</button></form></div></article>`).join('');}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function localDayKey(value){
  const d=new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function streakFromLogs(logs){
  const days=[...new Set((logs||[]).map(log=>localDayKey(log.created_at)))].sort().reverse();
  if(!days.length)return {current:0,days:new Set()};

  const today=localDayKey(new Date());
  const yesterdayDate=new Date();
  yesterdayDate.setDate(yesterdayDate.getDate()-1);
  const yesterday=localDayKey(yesterdayDate);

  if(days[0]!==today&&days[0]!==yesterday){
    return {current:0,days:new Set(days)};
  }

  let current=0;
  let cursor=new Date(`${days[0]}T12:00:00`);

  for(const day of days){
    if(localDayKey(cursor)!==day)break;
    current++;
    cursor.setDate(cursor.getDate()-1);
  }

  return {current,days:new Set(days)};
}

function renderDailyGoal(logs=[]){
  const view=$('#timer-view');
  if(!view)return;

  if(!state.user||state.demo){
    $('#daily-goal-card')?.remove();
    return;
  }

  let card=$('#daily-goal-card');

  if(!card){
    card=document.createElement('section');
    card.id='daily-goal-card';
    card.className='panel';
    card.style.cssText='margin:0 0 18px;padding:18px;border-radius:16px;border:1px solid var(--border-color, #e5e7eb)';
    view.prepend(card);
  }

  const key=`studing-daily-goal-${state.user.id}`;
  const saved=Number(localStorage.getItem(key));
  const goal=Number.isFinite(saved)&&saved>=15&&saved<=240?saved:30;

  const today=localDayKey(new Date());
  const done=(logs||[])
    .filter(log=>localDayKey(log.created_at)===today)
    .reduce((sum,log)=>sum+Number(log.minutes||0),0);

  const pct=Math.min(100,Math.round(done/goal*100));

  card.innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
      <div>
        <strong>今日の目標</strong>
        <p class="muted" style="margin:5px 0 0">無理のない目標で、少しずつ積み重ねよう。</p>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px">
        目標
        <select id="daily-goal-select" class="text-input" style="width:auto;padding:7px">
          ${[15,30,45,60,90,120,180,240].map(n=>`<option value="${n}" ${goal===n?'selected':''}>${n}分</option>`).join('')}
        </select>
      </label>
    </div>
    <div style="display:flex;justify-content:space-between;margin:14px 0 7px;font-weight:600">
      <span>${compactMinutes(done)} / ${goal}分</span>
      <span>${pct}%</span>
    </div>
    <div style="height:9px;border-radius:999px;background:var(--border-color,#e5e7eb);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--accent,#64748b);border-radius:999px;transition:width .25s"></div>
    </div>
  `;

  const select=$('#daily-goal-select');

  select.addEventListener('change',()=>{
    localStorage.setItem(key,String(Number(select.value)));
    renderDailyGoal(logs);
  });
}
function updateAccountButton(){$('#account-label').textContent=state.user?(state.profile?.username||'マイページ'):'ログイン';$('#account-button .avatar').textContent=state.user?initials(state.profile?.username):'S';$('#chat-input').disabled=!state.user;$('#chat-send').disabled=!state.user;$('#chat-access-label').textContent=state.user?'オンラインチャット':'ログインが必要です'}
function openAuth(mode='login'){setAuthMode(mode);$('#auth-message').textContent='';$('#auth-dialog').showModal()}
function setAuthMode(mode){const signup=mode==='signup';$('#login-tab').classList.toggle('active',!signup);$('#signup-tab').classList.toggle('active',signup);$('#auth-title').textContent=signup?'アカウントを作成':'おかえりなさい';$('#auth-subtitle').textContent=signup?'ユーザー名を決めて、勉強記録を始めよう。':'ログインして勉強を記録しよう。';$('#auth-username').classList.toggle('hidden',!signup);$('#username-label').classList.toggle('hidden',!signup);$('#auth-username').required=signup;$('#auth-password').autocomplete=signup?'new-password':'current-password';$('#auth-submit').textContent=signup?'新規登録':'ログイン';$('#auth-form').dataset.mode=mode}
async function authSubmit(e){e.preventDefault();if(!supabase){$('#auth-message').textContent='Supabaseの設定がまだ完了していません。READMEの手順に沿って設定してください。';return}const mode=$('#auth-form').dataset.mode,email=$('#auth-email').value.trim(),password=$('#auth-password').value,username=$('#auth-username').value.trim();$('#auth-submit').disabled=true;$('#auth-message').textContent='処理中…';try{if(mode==='signup'){if(username.length<2)throw new Error('ユーザー名は2文字以上で入力してください。');const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username}}});if(error)throw error;if(data.session){$('#auth-dialog').close();showNotice('アカウントを作成しました。','success');await loadAll()}else{$('#auth-message').textContent='確認メールを送信しました。メール内のリンクから登録を完了してください。'}}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;$('#auth-dialog').close();showNotice('ログインしました。','success');await loadAll()}}catch(err){$('#auth-message').textContent=err.message||'認証に失敗しました。'}finally{$('#auth-submit').disabled=false}}
async function sendPasswordReset(){
  if(!supabase){
    $('#auth-message').textContent='Supabaseの設定がまだ完了していません。';
    return;
  }
  const email=$('#auth-email').value.trim();
  if(!email){
    $('#auth-message').textContent='先にメールアドレスを入力してください。';
    $('#auth-email').focus();
    return;
  }
  const button=$('#forgot-password');
  button.disabled=true;
  $('#auth-message').textContent='再設定メールを送信中…';
  try{
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    if(error)throw error;
    $('#auth-message').textContent='再設定メールを送信しました。受信箱と迷惑メールを確認してください。';
  }catch(err){
    $('#auth-message').textContent=err.message||'メールを送信できませんでした。';
  }finally{
    button.disabled=false;
  }
}
function openRecoveryDialog(){
  if(!supabase)return;
  let dialog=$('#recovery-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');
    dialog.id='recovery-dialog';
    dialog.className='auth-dialog';
    dialog.innerHTML=`<form method="dialog" class="dialog-close-row"><button class="close-button" aria-label="閉じる">×</button></form>
      <div class="auth-brand"><span class="brand-mark">S</span><span>STUDING</span></div>
      <h2>新しいパスワード</h2>
      <p class="muted">新しく使うパスワードを入力してください。</p>
      <form id="recovery-form">
        <label class="field-label" for="recovery-password">新しいパスワード（8文字以上）</label>
        <input class="text-input" id="recovery-password" type="password" minlength="8" required autocomplete="new-password" placeholder="8文字以上">
        <label class="field-label" for="recovery-password-confirm">パスワード（確認）</label>
        <input class="text-input" id="recovery-password-confirm" type="password" minlength="8" required autocomplete="new-password" placeholder="もう一度入力">
        <button class="primary-button full auth-submit" type="submit" id="recovery-submit">パスワードを変更</button>
        <p class="auth-message" id="recovery-message" role="status"></p>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#recovery-form').addEventListener('submit',async e=>{
      e.preventDefault();
      const password=dialog.querySelector('#recovery-password').value;
      const confirmation=dialog.querySelector('#recovery-password-confirm').value;
      const message=dialog.querySelector('#recovery-message');
      const button=dialog.querySelector('#recovery-submit');
      if(password.length<8){message.textContent='パスワードは8文字以上にしてください。';return;}
      if(password!==confirmation){message.textContent='2つのパスワードが一致しません。';return;}
      button.disabled=true;
      message.textContent='変更中…';
      try{
        const {error}=await supabase.auth.updateUser({password});
        if(error)throw error;
        message.textContent='パスワードを変更しました。ログインできます。';
        dialog.querySelector('#recovery-form').reset();
        setTimeout(()=>{if(dialog.open)dialog.close();openAuth('login');},1200);
      }catch(err){
        message.textContent=err.message||'変更できませんでした。再設定メールからやり直してください。';
              }finally{
        button.disabled=false;
      }
    });
  }
  if(!dialog.open)dialog.showModal();
}
function formatTimer(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return [h,m,sec].map(v=>String(v).padStart(2,'0')).join(':')}
function updateTimer(){let s=state.elapsedBeforePause;if(state.timerStartedAt&&!state.paused)s+=Math.floor((Date.now()-state.timerStartedAt)/1000);state.timerSeconds=s;$('#timer-display').textContent=formatTimer(s);$('#timer-status').classList.toggle('running',Boolean(state.timerStartedAt&&!state.paused));$('#timer-status').innerHTML=`<span></span>${state.timerStartedAt&&!state.paused?'集中中':state.paused?'一時停止中':'記録待機中'}`;$('#save-session').disabled=s<60;$('#timer-pause').disabled=!state.timerStartedAt;$('#timer-start').disabled=Boolean(state.timerStartedAt&&!state.paused);$('#timer-start').textContent=state.paused?'▶ 再開':'▶ スタート'}
function startTimer(){if(state.paused){state.timerStartedAt=Date.now();state.paused=false}else if(!state.timerStartedAt){state.timerStartedAt=Date.now();state.elapsedBeforePause=0}clearInterval(state.timerInterval);state.timerInterval=setInterval(updateTimer,500);updateTimer()}
function pauseTimer(){if(!state.timerStartedAt||state.paused)return;state.elapsedBeforePause+=Math.floor((Date.now()-state.timerStartedAt)/1000);state.timerStartedAt=null;state.paused=true;clearInterval(state.timerInterval);updateTimer()}
function resetTimer(){clearInterval(state.timerInterval);state.timerStartedAt=null;state.elapsedBeforePause=0;state.timerSeconds=0;state.paused=false;updateTimer()}
async function saveStudy(minutes,subject){if(!state.user){openAuth();showNotice('勉強時間を保存するにはログインしてください。');return false}if(!supabase)return false;const {error}=await supabase.from('study_logs').insert({user_id:state.user.id,minutes,subject:subject.trim()||null});if(error){showNotice(`保存できませんでした：${error.message}`,'error');return false}showNotice(`${minutes}分の勉強記録を保存しました。`,'success');await Promise.all([loadPosts(),renderStats(),renderRanking(),renderProfile()]);return true}
async function loadChat(){if(state.demo){renderChatDemo();return}const {data,error}=await supabase.from('messages').select('id,user_id,body,created_at,profiles(username)').order('created_at',{ascending:true}).limit(100);if(error){$('#chat-messages').innerHTML='<p class="muted">チャットを読み込めません。SQL設定を確認してください。</p>';return}renderChat(data||[])}
function renderChatDemo(){renderChat([{id:'m1',user_id:'demo-1',body:'今日は数学を50分進めた！',created_at:new Date(Date.now()-3600000).toISOString(),profiles:{username:'haru_study'}},{id:'m2',user_id:'demo-2',body:'おつかれさま！自分もこれから始めます。',created_at:new Date(Date.now()-1800000).toISOString(),profiles:{username:'mikan_23'}}])}
function renderChat(messages){$('#chat-messages').innerHTML=messages.length?messages.map(m=>`<div class="chat-line"><span class="avatar">${escapeHTML(initials(m.profiles?.username||'S'))}</span><div class="chat-bubble"><strong>${escapeHTML(m.profiles?.username||'メンバー')}</strong>${escapeHTML(m.body)}<small>${relativeTime(m.created_at)}</small></div></div>`).join(''):'<div class="empty-state"><div class="empty-icon">▤</div><strong>最初のメッセージを送ろう</strong><p>勉強の相談や励ましを共有できます。</p></div>';$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight}
async function renderProfile(){
  const root=$('#profile-content');
  if(!state.user){root.innerHTML='<div class="empty-state"><div class="empty-icon">◎</div><strong>ログインしてください</strong><p>アカウントを作成すると、勉強記録を管理できます。</p><button class="primary-button" id="profile-login-inner">ログイン / 登録</button></div>';renderDailyGoal([]);return}
  if(state.demo)return;
  const {data:logs,error}=await supabase.from('study_logs').select('minutes,created_at,subject').eq('user_id',state.user.id).order('created_at',{ascending:false});
  if(error){root.innerHTML='<p class="muted">プロフィールを読み込めませんでした。</p>';return}
  const allLogs=logs||[];const list=allLogs.slice(0,10);const total=allLogs.reduce((sum,log)=>sum+Number(log.minutes||0),0);const streak=streakFromLogs(allLogs);const weekTotal=allLogs.filter(log=>new Date(log.created_at)>=weekStart()).reduce((sum,log)=>sum+Number(log.minutes||0),0);renderDailyGoal(allLogs);
  const badges=[
    {name:'はじめの一歩',desc:'最初の記録を保存',earned:allLogs.length>=1},
    {name:'集中60分',desc:'累計60分',earned:total>=60},
    {name:'記録5回',desc:'勉強記録を5回保存',earned:allLogs.length>=5},
    {name:'1週間継続',desc:'7日連続で記録',earned:streak.current>=7},
    {name:'累計10時間',desc:'累計600分',earned:total>=600}
  ];
  root.innerHTML=`<div class="profile-hero"><span class="avatar">${escapeHTML(initials(state.profile?.username))}</span><div><h3>${escapeHTML(state.profile?.username||'student')}</h3><p>${escapeHTML(state.user.email||'')} ・ メンバー</p></div><button class="secondary-button" id="logout-button">ログアウト</button></div><div class="profile-stats"><div class="profile-stat"><span>累計勉強時間</span><strong>${compactMinutes(total)}</strong></div><div class="profile-stat"><span>記録回数</span><strong>${allLogs.length}</strong></div><div class="profile-stat"><span>連続記録日数</span><strong>${streak.current}日</strong></div><div class="profile-stat"><span>今週の勉強時間</span><strong>${compactMinutes(weekTotal)}</strong></div></div><section style="margin:22px 0"><h3>獲得バッジ</h3><p class="muted">記録を積み重ねるとバッジが増えます。自分のペースで続けよう。</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">${badges.map(b=>`<div style="padding:12px;border-radius:12px;border:1px solid var(--border-color,#e5e7eb);opacity:${b.earned?'1':'.55'}"><strong>${b.earned?'★':'◇'} ${escapeHTML(b.name)}</strong><p class="muted" style="font-size:12px;margin:5px 0 0">${escapeHTML(b.desc)}${b.earned?' ・獲得済み':''}</p></div>`).join('')}</div></section><h3>最近の勉強記録</h3><div class="feed-list">${list.map(log=>`<div class="feed-item"><span class="avatar">✎</span><div class="feed-body"><div class="feed-head"><strong>${escapeHTML(log.subject||'勉強')}</strong><span class="feed-time">${relativeTime(log.created_at)}</span></div><div class="feed-meta"><span class="duration-chip">◷ ${compactMinutes(log.minutes)}</span></div></div></div>`).join('')||'<p class="muted">まだ勉強記録がありません。</p>'}</div><div class="profile-edit"><h3>プロフィール設定</h3><form id="profile-edit-form"><label class="field-label" for="profile-username">ユーザー名</label><input class="text-input" id="profile-username" maxlength="24" minlength="2" required value="${escapeHTML(state.profile?.username||'')}"/><label class="field-label" for="profile-bio">自己紹介</label><input class="text-input" id="profile-bio" maxlength="160" value="${escapeHTML(state.profile?.bio||'')}" placeholder="勉強の目標など（任意）"/><button class="primary-button" style="margin-top:12px" type="submit">プロフィールを保存</button></form></div>`;
}

function weekStart(){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));d.setHours(0,0,0,0);return d}
async function toggleLike(id){if(!state.user){openAuth();showNotice('いいねするにはログインしてください。');return}if(!supabase)return;const post=state.posts.find(p=>p.id===id);if(post?.liked){const {error}=await supabase.from('likes').delete().eq('log_id',id).eq('user_id',state.user.id);if(error)showNotice(error.message,'error')}else{const {error}=await supabase.from('likes').insert({log_id:id,user_id:state.user.id});if(error&&error.code!=='23505')showNotice(error.message,'error')}await loadPosts()}
async function addComment(e,id){e.preventDefault();const form=e.currentTarget,body=new FormData(form).get('body')?.toString().trim();if(!body)return;if(!state.user){openAuth();showNotice('コメントするにはログインしてください。');return}const {error}=await supabase.from('comments').insert({log_id:id,user_id:state.user.id,body});if(error){showNotice(error.message,'error');return}form.reset();await loadPosts()}
setupRankingPeriods();
$('#today-label').textContent=new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).toUpperCase();
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$('#refresh-button').addEventListener('click',()=>loadAll());$('#account-button').addEventListener('click',()=>state.user?showView('profile'):openAuth());$('#empty-login').addEventListener('click',()=>openAuth());$('#profile-login').addEventListener('click',()=>openAuth());$('#profile-content').addEventListener('click',e=>{if(e.target.id==='profile-login-inner')openAuth();if(e.target.id==='logout-button')logout()});$('#login-tab').addEventListener('click',()=>setAuthMode('login'));$('#signup-tab').addEventListener('click',()=>setAuthMode('signup'));$('#forgot-password').addEventListener('click',sendPasswordReset);$('#auth-form').addEventListener('submit',authSubmit);$('#ranking-period').addEventListener('change',renderRanking);$('#timer-start').addEventListener('click',startTimer);$('#timer-pause').addEventListener('click',pauseTimer);$('#timer-reset').addEventListener('click',resetTimer);$('#save-session').addEventListener('click',async()=>{const minutes=Math.floor(state.timerSeconds/60);if(minutes<1)return;if(await saveStudy(minutes,$('#study-subject').value)){resetTimer();$('#study-subject').value=''}});$('#manual-form').addEventListener('submit',async e=>{e.preventDefault();const minutes=Number($('#manual-minutes').value);if(!Number.isInteger(minutes)||minutes<1||minutes>1440){showNotice('勉強時間は1〜1440分で入力してください。','error');return}if(await saveStudy(minutes,$('#manual-subject').value)){e.currentTarget.reset()}});$('#feed-list').addEventListener('click',e=>{const like=e.target.closest('[data-like]');if(like){if(state.demo){state.likes.has(like.dataset.like)?state.likes.delete(like.dataset.like):state.likes.add(like.dataset.like);renderFeed();showNotice('デモモードでは変更は保存されません。');}else toggleLike(like.dataset.like)}const comment=e.target.closest('[data-comment-toggle]');if(comment){const form=$(`[data-comment-form="${comment.dataset.commentToggle}"]`);form?.classList.toggle('hidden');form?.querySelector('input')?.focus()}});$('#feed-list').addEventListener('submit',e=>{const form=e.target.closest('[data-comment-form]');if(!form)return;e.preventDefault();if(state.demo){showNotice('デモモードではコメントは保存されません。');return}addComment(e,form.dataset.commentForm)});$('#chat-form').addEventListener('submit',async e=>{e.preventDefault();const body=$('#chat-input').value.trim();if(!body)return;if(!state.user){openAuth();return}const {error}=await supabase.from('messages').insert({user_id:state.user.id,body});if(error){showNotice(error.message,'error');return}$('#chat-input').value='';await loadChat()});$('#profile-content').addEventListener('submit',async e=>{if(e.target.id!=='profile-edit-form')return;e.preventDefault();const username=$('#profile-username').value.trim(),bio=$('#profile-bio').value.trim();const {data,error}=await supabase.from('profiles').update({username,bio}).eq('id',state.user.id).select().single();if(error){showNotice(error.message,'error');return}state.profile=data;updateAccountButton();showNotice('プロフィールを保存しました。','success');await loadAll()});
async function logout(){if(supabase)await supabase.auth.signOut();state.user=null;state.profile=null;updateAccountButton();showNotice('ログアウトしました。');await loadAll();showView('home')}
if(supabase){supabase.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>openRecoveryDialog(),0);setTimeout(()=>loadAll(),0)});supabase.channel('study-logs-live').on('postgres_changes',{event:'*',schema:'public',table:'study_logs'},()=>{loadPosts();renderStats();renderRanking()}).on('postgres_changes',{event:'*',schema:'public',table:'messages'},()=>loadChat()).subscribe();}updateTimer();updateAccountButton();loadAll();
