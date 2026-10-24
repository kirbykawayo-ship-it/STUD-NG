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
function showView(view){state.view=view;const names={home:'みんなの勉強ログ',ranking:'勉強時間ランキング',timer:'勉強タイマー',chat:'みんなのチャット',profile:'マイプロフィール',social:'友達・DM・1日対戦'};$('#page-title').textContent=names[view]||names.home;$('#home-view').classList.toggle('hidden',view!=='home');['ranking','timer','chat','profile','social'].forEach(v=>$('#'+v+'-view')?.classList.toggle('hidden',view!==v));$('#public-banner').classList.toggle('hidden',view!=='home');$('#stats-grid').classList.toggle('hidden',view!=='home');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='ranking')renderRanking();if(view==='chat')loadChat();if(view==='profile')renderProfile();if(view==='social'){loadFriends();loadDuels()}window.scrollTo({top:0,behavior:'smooth'})}
function demoMode(){state.demo=true;$('#connection-label').textContent='デモモード';$('#feed-list').innerHTML='';state.posts=demoPosts;renderFeed();renderStats();renderRanking();renderProfile();renderChatDemo();$('#public-banner').classList.remove('hidden');}
async function loadAll(){if(!supabase){demoMode();return}state.demo=false;$('#connection-label').textContent='オンライン';const {data:{user}}=await supabase.auth.getUser();state.user=user;if(user){const {data:profile}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();state.profile=profile;if(!profile){const username=(user.user_metadata?.username||user.email?.split('@')[0]||'student').slice(0,24);const result=await supabase.from('profiles').upsert({id:user.id,username}).select().single();state.profile=result.data}}await Promise.all([loadPosts(),renderStats(),renderRanking(),loadChat(),renderProfile()]);updateAccountButton();if($('#social-view')){loadFriends();loadDuels()}}
async function loadPosts(){if(state.demo)return;const {data,error}=await supabase.from('study_logs').select('id,user_id,minutes,subject,created_at,profiles(username,avatar_url)').order('created_at',{ascending:false}).limit(30);if(error){showNotice('勉強ログを読み込めませんでした。SupabaseのSQL設定を確認してください。','error');return}const ids=(data||[]).map(p=>p.id);let likes=[],comments=[];if(ids.length){const l=await supabase.from('likes').select('log_id,user_id').in('log_id',ids);likes=l.data||[];const c=await supabase.from('comments').select('id,log_id,user_id,body,created_at,profiles(username)').in('log_id',ids).order('created_at',{ascending:true});comments=c.data||[]}state.posts=(data||[]).map(p=>({...p,username:p.profiles?.username||'student',avatar_url:p.profiles?.avatar_url||null,initial:initials(p.profiles?.username),likes_count:likes.filter(l=>l.log_id===p.id).length,liked:likes.some(l=>l.log_id===p.id&&l.user_id===state.user?.id),comments:comments.filter(c=>c.log_id===p.id)}));renderFeed();}
function renderFeed(){const list=$('#feed-list');if(!state.posts.length){list.innerHTML='';$('#feed-empty').classList.remove('hidden');return}$('#feed-empty').classList.add('hidden');list.innerHTML=state.posts.map(p=>`<article class="feed-item">${avatarHTML(p.avatar_url,p.username)}<div class="feed-body"><div class="feed-head"><strong>${escapeHTML(p.username)}</strong> <button type="button" class="secondary-button" data-open-user="${p.user_id}" style="padding:3px 7px;font-size:12px">プロフィール</button><span class="feed-time">${relativeTime(p.created_at)}</span></div><p class="feed-copy">${p.subject?`<b>${escapeHTML(p.subject)}</b> を勉強しました。`:'勉強をがんばりました。'}</p><div class="feed-meta"><span class="duration-chip">◷ ${compactMinutes(p.minutes)}</span></div><div class="feed-actions"><button class="action-button ${p.liked||state.likes.has(p.id)?'liked':''}" data-like="${p.id}">♡ いいね ${p.likes_count||0}</button><button class="action-button" data-comment-toggle="${p.id}">▢ コメント ${(p.comments||[]).length}</button></div><div class="comment-list">${(p.comments||[]).map(c=>`<p class="comment-line"><b>${escapeHTML(c.profiles?.username||c.username||'メンバー')}：</b>${escapeHTML(c.body)}</p>`).join('')}</div><form class="comment-editor" data-comment-form="${p.id}"><input name="body" maxlength="300" placeholder="コメントを書く…" aria-label="コメント" /><button type="submit">送信</button></form></div></article>`).join('');}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function renderStats(){let today=0,week=0,members=demoProfiles.length;if(state.demo){today=demoProfiles.reduce((s,p)=>s+p.today,0);week=demoProfiles.reduce((s,p)=>s+p.week,0)}else{const now=new Date();const startDay=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();const startWeek=new Date(now);const offset=(now.getDay()+6)%7;startWeek.setDate(now.getDate()-offset);startWeek.setHours(0,0,0,0);const [t,w,m]=await Promise.all([supabase.from('study_logs').select('minutes').gte('created_at',startDay),supabase.from('study_logs').select('minutes').gte('created_at',startWeek.toISOString()),supabase.from('profiles').select('id',{count:'exact',head:true})]);today=(t.data||[]).reduce((s,x)=>s+x.minutes,0);week=(w.data||[]).reduce((s,x)=>s+x.minutes,0);members=m.count||0}$('#stat-today').innerHTML=`${today.toLocaleString()}<span>分</span>`;$('#stat-week').innerHTML=`${week.toLocaleString()}<span>分</span>`;$('#stat-members').innerHTML=`${members}<span>人</span>`}
function setupRankingPeriods(){const select=$('#ranking-period');if(!select)return;const current=['today','week','month','all'].includes(select.value)?select.value:'week';select.innerHTML='<option value="today">日</option><option value="week">週</option><option value="month">月</option><option value="all">全期間</option>';select.value=current;select.setAttribute('aria-label','ランキングの期間');}
async function getRanking(period){
  if(state.demo){const key=period==='today'?'today':period==='week'?'week':period==='month'?'month':'total';return demoProfiles.map(p=>({...p,minutes:p[key]||0})).sort((a,b)=>b.minutes-a.minutes)}
  const {data:profiles,error:profileError}=await supabase.from('profiles').select('id,username,avatar_url');
  if(profileError){showNotice('ランキングを読み込めませんでした。','error');return []}
  let start=null;const now=new Date();
  if(period==='today')start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  else if(period==='week'){start=new Date(now.getFullYear(),now.getMonth(),now.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7));}
  else if(period==='month')start=new Date(now.getFullYear(),now.getMonth(),1);
  let query=supabase.from('study_logs').select('user_id,minutes');
  if(start)query=query.gte('created_at',start.toISOString());
  const {data:logs,error}=await query;
  if(error){showNotice('勉強時間を集計できませんでした。','error');return []}
  const sums={};(logs||[]).forEach(log=>{sums[log.user_id]=(sums[log.user_id]||0)+Number(log.minutes||0)});
  return (profiles||[]).map(profile=>({id:profile.id,username:profile.username,avatar_url:profile.avatar_url,initial:initials(profile.username),minutes:sums[profile.id]||0})).sort((a,b)=>b.minutes-a.minutes||a.username.localeCompare(b.username,'ja'));
}
async function renderRanking(){
  const period=$('#ranking-period')?.value||'week';const labels={today:'今日',week:'今週',month:'今月',all:'全期間'};
  const ranking=await getRanking(period);const mini=(await getRanking('week')).slice(0,4);
  $('#mini-ranking').innerHTML=mini.map((p,i)=>`<div class="rank-row"><span class="rank-number ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span>${avatarHTML(p.avatar_url,p.username)}<div class="rank-name"><strong>${escapeHTML(p.username)}</strong><small>${i===0?'今週のトップ':i===1?'いいペース！':'継続中'}</small></div><span class="rank-value">${compactMinutes(p.minutes)}</span></div>`).join('');
  const max=Math.max(1,...ranking.map(p=>p.minutes));
  $('#full-ranking').innerHTML=ranking.map((p,i)=>`<div class="full-rank-row"><span class="rank-number ${i<3?'top':''}">${i+1}</span>${avatarHTML(p.avatar_url,p.username)}<div class="rank-main"><strong>${escapeHTML(p.username)}</strong> <button type="button" class="secondary-button" data-open-user="${p.id}" style="padding:3px 7px;font-size:12px">プロフィール</button><small>${i===0?`${labels[period]}のトップ`:'勉強を継続中'}</small><div class="rank-progress"><span style="width:${Math.max(0,p.minutes/max*100)}%"></span></div></div><span class="rank-total">${compactMinutes(p.minutes)}</span></div>`).join('')||'<p class="muted">まだランキングがありません。</p>';
}
function localDayKey(value){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function streakFromLogs(logs){
  const days=[...new Set((logs||[]).map(log=>localDayKey(log.created_at)))].sort().reverse();
  if(!days.length)return {current:0,days:new Set()};
  const today=localDayKey(new Date());const yesterdayDate=new Date();yesterdayDate.setDate(yesterdayDate.getDate()-1);const yesterday=localDayKey(yesterdayDate);
  if(days[0]!==today&&days[0]!==yesterday)return {current:0,days:new Set(days)};
  let current=0;let cursor=new Date(`${days[0]}T12:00:00`);
  for(const day of days){if(localDayKey(cursor)!==day)break;current++;cursor.setDate(cursor.getDate()-1)}
  return {current,days:new Set(days)};
}
function renderDailyGoal(logs=[]){
  const view=$('#timer-view');if(!view)return;
  if(!state.user||state.demo){$('#daily-goal-card')?.remove();return}
  let card=$('#daily-goal-card');if(!card){card=document.createElement('section');card.id='daily-goal-card';card.className='panel';card.style.cssText='margin:0 0 18px;padding:18px;border-radius:16px;border:1px solid var(--border-color, #e5e7eb)';view.prepend(card)}
  const key=`studing-daily-goal-${state.user.id}`;const saved=Number(localStorage.getItem(key));const goal=Number.isFinite(saved)&&saved>=15&&saved<=240?saved:30;
  const today=localDayKey(new Date());const done=(logs||[]).filter(log=>localDayKey(log.created_at)===today).reduce((sum,log)=>sum+Number(log.minutes||0),0);const pct=Math.min(100,Math.round(done/goal*100));
  card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><strong>今日の目標</strong><p class="muted" style="margin:5px 0 0">無理のない目標で、少しずつ積み重ねよう。</p></div><label style="display:flex;gap:8px;align-items:center;font-size:14px">目標 <select id="daily-goal-select" class="text-input" style="width:auto;padding:7px"><option value="15" ${goal===15?'selected':''}>15分</option><option value="30" ${goal===30?'selected':''}>30分</option><option value="45" ${goal===45?'selected':''}>45分</option><option value="60" ${goal===60?'selected':''}>60分</option><option value="90" ${goal===90?'selected':''}>90分</option><option value="120" ${goal===120?'selected':''}>120分</option><option value="180" ${goal===180?'selected':''}>180分</option><option value="240" ${goal===240?'selected':''}>240分</option></select></label></div><div style="display:flex;justify-content:space-between;margin:14px 0 7px;font-weight:600"><span>${compactMinutes(done)} / ${goal}分</span><span>${pct}%</span></div><div style="height:9px;border-radius:999px;background:var(--border-color,#e5e7eb);overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--accent,#64748b);border-radius:999px;transition:width .25s"></div></div>`;
  const select=$('#daily-goal-select');select.addEventListener('change',()=>{localStorage.setItem(key,String(Number(select.value)));renderDailyGoal(logs)});
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
  root.innerHTML=`<div class="profile-hero">${avatarHTML(state.profile?.avatar_url,state.profile?.username)}<div><h3>${escapeHTML(state.profile?.username||'student')}</h3><p>${escapeHTML(state.user.email||'')} ・ メンバー</p></div><button class="secondary-button" id="logout-button">ログアウト</button></div><div style="margin:12px 0"><label class="field-label" for="avatar-upload">プロフィールアイコン（2MB以下）</label><input class="text-input" id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="max-width:100%"></div><div class="profile-stats"><div class="profile-stat"><span>累計勉強時間</span><strong>${compactMinutes(total)}</strong></div><div class="profile-stat"><span>記録回数</span><strong>${allLogs.length}</strong></div><div class="profile-stat"><span>連続記録日数</span><strong>${streak.current}日</strong></div><div class="profile-stat"><span>今週の勉強時間</span><strong>${compactMinutes(weekTotal)}</strong></div></div><section style="margin:22px 0"><h3>獲得バッジ</h3><p class="muted">記録を積み重ねるとバッジが増えます。自分のペースで続けよう。</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">${badges.map(b=>`<div style="padding:12px;border-radius:12px;border:1px solid var(--border-color,#e5e7eb);opacity:${b.earned?'1':'.55'}"><strong>${b.earned?'★':'◇'} ${escapeHTML(b.name)}</strong><p class="muted" style="font-size:12px;margin:5px 0 0">${escapeHTML(b.desc)}${b.earned?' ・獲得済み':''}</p></div>`).join('')}</div></section><h3>最近の勉強記録</h3><div class="feed-list">${list.map(log=>`<div class="feed-item"><span class="avatar">✎</span><div class="feed-body"><div class="feed-head"><strong>${escapeHTML(log.subject||'勉強')}</strong><span class="feed-time">${relativeTime(log.created_at)}</span></div><div class="feed-meta"><span class="duration-chip">◷ ${compactMinutes(log.minutes)}</span></div></div></div>`).join('')||'<p class="muted">まだ勉強記録がありません。</p>'}</div><div class="profile-edit"><h3>プロフィール設定</h3><form id="profile-edit-form"><label class="field-label" for="profile-username">ユーザー名</label><input class="text-input" id="profile-username" maxlength="24" minlength="2" required value="${escapeHTML(state.profile?.username||'')}"/><label class="field-label" for="profile-bio">自己紹介</label><input class="text-input" id="profile-bio" maxlength="160" value="${escapeHTML(state.profile?.bio||'')}" placeholder="勉強の目標など（任意）"/><button class="primary-button" style="margin-top:12px" type="submit">プロフィールを保存</button></form></div>`;
}

function weekStart(){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));d.setHours(0,0,0,0);return d}
async function toggleLike(id){if(!state.user){openAuth();showNotice('いいねするにはログインしてください。');return}if(!supabase)return;const post=state.posts.find(p=>p.id===id);if(post?.liked){const {error}=await supabase.from('likes').delete().eq('log_id',id).eq('user_id',state.user.id);if(error)showNotice(error.message,'error')}else{const {error}=await supabase.from('likes').insert({log_id:id,user_id:state.user.id});if(error&&error.code!=='23505')showNotice(error.message,'error')}await loadPosts()}
async function addComment(e,id){e.preventDefault();const form=e.currentTarget,body=new FormData(form).get('body')?.toString().trim();if(!body)return;if(!state.user){openAuth();showNotice('コメントするにはログインしてください。');return}const {error}=await supabase.from('comments').insert({log_id:id,user_id:state.user.id,body});if(error){showNotice(error.message,'error');return}form.reset();await loadPosts()}
// --- Social features: public profiles, avatars, friends, direct messages, daily duels ---
let socialTarget = null;
let dmTarget = null;

function avatarHTML(url, name='S') {
  if (url) return `<img class="avatar" src="${escapeHTML(url)}" alt="${escapeHTML(name)}のアイコン" style="object-fit:cover">`;
  return `<span class="avatar">${escapeHTML(initials(name))}</span>`;
}
function socialCardStyle(){return 'background:var(--card-bg,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:14px;padding:16px;margin:0 0 14px'}
function socialSection(title, id, body='') { return `<section style="${socialCardStyle()}"><h3 style="margin:0 0 12px">${title}</h3><div id="${id}">${body}</div></section>`; }
function setupSocialUI(){
  const home=$('#home-view');
  if(!$('#social-view')){
    const view=document.createElement('section'); view.id='social-view'; view.className='hidden';
    view.innerHTML=`<div class="social-shell" style="max-width:1000px;margin:0 auto">
      <div class="social-tabs" role="tablist" aria-label="友達機能">
        <button type="button" class="social-tab active" data-social-tab="search">ユーザー検索</button>
        <button type="button" class="social-tab" data-social-tab="friends">友達一覧</button>
        <button type="button" class="social-tab" data-social-tab="dm">DM</button>
        <button type="button" class="social-tab" data-social-tab="duels">1日対戦</button>
      </div>
      <div class="social-page" data-social-page="search">
        ${socialSection('ユーザーを探す','social-search-panel',`<form id="social-search-form" style="display:flex;gap:8px;flex-wrap:wrap"><input class="text-input" id="social-search-input" maxlength="24" placeholder="ユーザー名で検索" style="flex:1;min-width:180px"><button class="primary-button" type="submit">検索</button></form><div id="social-search-results" style="margin-top:12px"></div>`)}
        ${socialSection('プロフィール','social-profile-panel','<p class="muted">検索結果からユーザーを選択してください。</p>')}
      </div>
      <div class="social-page hidden" data-social-page="friends">${socialSection('友達一覧・申請','social-friends-panel','<p class="muted">ログインすると友達を表示できます。</p>')}</div>
      <div class="social-page hidden" data-social-page="dm">
        <section class="dm-app">
          <aside class="dm-sidebar"><div class="dm-sidebar-title">メッセージ</div><p class="muted dm-sidebar-hint">友達を選ぶと会話が開きます。</p><div id="dm-friend-picker" class="dm-friend-picker"><p class="muted">友達がここに表示されます。</p></div></aside>
          <section class="dm-chat-shell">
            <header id="dm-chat-header" class="dm-chat-header"><div class="dm-header-placeholder">友達を選択してください</div></header>
            <div id="dm-thread" class="dm-thread" aria-live="polite"><div class="dm-empty">左の友達一覧から相手を選択してください。</div></div>
            <form id="dm-form" class="dm-compose"><input class="text-input" id="dm-input" maxlength="1000" placeholder="メッセージを書く…" aria-label="メッセージ" style="flex:1;min-width:0" disabled><button class="primary-button" type="submit" disabled>送信</button></form>
          </section>
        </section>
      </div>
      <div class="social-page hidden" data-social-page="duels">${socialSection('1対1・1日対戦','social-duels-panel',`<p class="muted">友達に対戦を申し込み、同じ日の勉強時間で競います。</p><div id="duel-list"></div>`)}</div>
    </div>`;
    const parent=home?.parentElement||document.querySelector('main')||document.body; parent.appendChild(view);
  }
  if(!$('#social-nav-button')){
    const b=document.createElement('button');b.id='social-nav-button';b.type='button';b.textContent='友達・DM・対戦';b.className='secondary-button';b.style.cssText='margin:8px 0';b.addEventListener('click',()=>showView('social'));
    const nav=$('[data-view]')?.parentElement; if(nav)nav.appendChild(b);else ($('#account-button')?.parentElement||document.body).appendChild(b);
  }
  if(!$('#social-style')){const style=document.createElement('style');style.id='social-style';style.textContent=`
    #social-view .social-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:5px;background:var(--surface,#f4f5f7);border-radius:14px}
    #social-view .social-tab{border:0;background:transparent;border-radius:10px;padding:10px 15px;cursor:pointer;color:inherit;font:inherit}
    #social-view .social-tab.active{background:var(--card-bg,#fff);box-shadow:0 1px 5px #00000012;font-weight:700}
    #social-view .social-user-row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-color,#e5e7eb);flex-wrap:wrap}
    #social-view .social-user-info{display:flex;align-items:center;gap:10px;min-width:0}
    #social-view .social-user-info strong{overflow-wrap:anywhere}
    #social-view .social-actions{display:flex;gap:6px;flex-wrap:wrap}
    #social-view .social-actions button{font-size:13px;padding:7px 10px}
    #social-view .dm-app{display:grid;grid-template-columns:minmax(180px,250px) minmax(0,1fr);height:min(620px,72vh);min-height:440px;border:1px solid var(--border-color,#e5e7eb);border-radius:16px;overflow:hidden;background:var(--card-bg,#fff)}
    #social-view .dm-sidebar{border-right:1px solid var(--border-color,#e5e7eb);overflow:auto;background:var(--surface,#f8f9fb);padding:14px}
    #social-view .dm-sidebar-title{font-weight:750;font-size:18px;margin:2px 0 5px}
    #social-view .dm-sidebar-hint{font-size:12px;margin:0 0 12px}
    #social-view .dm-friend-button{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:10px;border:0;border-radius:12px;background:transparent;cursor:pointer;color:inherit;margin:3px 0}
    #social-view .dm-friend-button:hover,#social-view .dm-friend-button.active{background:var(--card-bg,#fff);box-shadow:0 1px 5px #00000012}
    #social-view .dm-friend-name{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #social-view .dm-chat-shell{min-width:0;display:flex;flex-direction:column;background:var(--card-bg,#fff)}
    #social-view .dm-chat-header{display:flex;align-items:center;gap:10px;min-height:66px;padding:12px 16px;border-bottom:1px solid var(--border-color,#e5e7eb);font-weight:700}
    #social-view .dm-thread{flex:1;min-height:0;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px;background:var(--surface,#f8f9fb)}
    #social-view .dm-bubble-row{display:flex;align-items:flex-end;gap:8px;max-width:88%}
    #social-view .dm-bubble-row.mine{align-self:flex-end;flex-direction:row-reverse}
    #social-view .dm-bubble{padding:10px 13px;border-radius:16px 16px 16px 4px;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e5e7eb);overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.45}
    #social-view .dm-bubble-row.mine .dm-bubble{border-radius:16px 16px 4px 16px;background:var(--accent,#64748b);color:white;border-color:transparent}
    #social-view .dm-bubble-time{font-size:10px;opacity:.7;margin-top:4px}
    #social-view .dm-bubble-row.mine .dm-bubble-time{text-align:right}
    #social-view .dm-empty{margin:auto;text-align:center;color:var(--muted,#777);padding:24px}
    #social-view .dm-compose{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border-color,#e5e7eb);background:var(--card-bg,#fff)}
    @media(max-width:620px){#social-view .dm-app{grid-template-columns:105px minmax(0,1fr);height:68vh;min-height:400px}#social-view .dm-sidebar{padding:8px}#social-view .dm-friend-button{padding:8px 4px;gap:5px;flex-direction:column;align-items:flex-start}#social-view .dm-thread{padding:10px}#social-view .dm-bubble-row{max-width:96%}#social-view .dm-compose{padding:8px}}
  `;document.head.appendChild(style)}
  $('#social-view')?.addEventListener('click',async e=>{
    const tab=e.target.closest('[data-social-tab]');
    if(tab){switchSocialTab(tab.dataset.socialTab);return}
    const friendButton=e.target.closest('[data-dm-user]');
    if(friendButton){await openDM(friendButton.dataset.dmUser);return}
  });
  $('#social-search-form')?.addEventListener('submit',searchSocialUsers);
  $('#social-search-results')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-social-action]');if(!btn)return;const id=btn.dataset.userId;const action=btn.dataset.socialAction;if(action==='view')await openPublicProfile(id);if(action==='friend')await sendFriendRequest(id);if(action==='dm'){switchSocialTab('dm');await openDM(id)}if(action==='duel')await createDuel(id)});
  $('#social-profile-panel')?.addEventListener('click',async e=>{const b=e.target.closest('[data-social-action]');if(!b)return;const id=b.dataset.userId;const action=b.dataset.socialAction;if(action==='friend')await sendFriendRequest(id);if(action==='dm'){switchSocialTab('dm');await openDM(id)}if(action==='duel')await createDuel(id)});
  $('#social-friends-panel')?.addEventListener('click',async e=>{const b=e.target.closest('[data-friend-action]');if(!b)return;if(b.dataset.friendAction==='accept')await acceptFriendRequest(b.dataset.id);if(b.dataset.friendAction==='view')await openPublicProfile(b.dataset.userId);if(b.dataset.friendAction==='dm'){switchSocialTab('dm');await openDM(b.dataset.userId)}if(b.dataset.friendAction==='duel')await createDuel(b.dataset.userId);});
  $('#dm-form')?.addEventListener('submit',sendDM);
  $('#duel-list')?.addEventListener('click',async e=>{const b=e.target.closest('[data-duel-action]');if(!b)return;if(b.dataset.duelAction==='accept')await acceptDuel(b.dataset.id);if(b.dataset.duelAction==='view')await openPublicProfile(b.dataset.userId);});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-open-user]');if(b)openPublicProfile(b.dataset.openUser)});
}
function switchSocialTab(tab){
  const allowed=['search','friends','dm','duels'];if(!allowed.includes(tab))tab='search';
  $$('#social-view [data-social-tab]').forEach(b=>{const active=b.dataset.socialTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
  $$('#social-view [data-social-page]').forEach(page=>page.classList.toggle('hidden',page.dataset.socialPage!==tab));
  if(tab==='friends'||tab==='dm')loadFriends();if(tab==='duels')loadDuels();
}
function requireSocialLogin(){if(!state.user||!supabase){showNotice('この機能を使うには、Supabaseを設定してログインしてください。');if(!state.user)openAuth();return false}return true}
async function searchSocialUsers(e){e?.preventDefault();if(!requireSocialLogin())return;const q=$('#social-search-input').value.trim();if(q.length<2){$('#social-search-results').innerHTML='<p class="muted">2文字以上のユーザー名を入力してください。</p>';return}const {data,error}=await supabase.from('profiles').select('id,username,bio,avatar_url').ilike('username',`%${q.replace(/[%_]/g,'')}%`).neq('id',state.user.id).limit(20);if(error){$('#social-search-results').innerHTML=`<p class="muted">検索できませんでした。SQL設定を確認してください。</p>`;return}$('#social-search-results').innerHTML=(data||[]).map(p=>`<div class="social-user-row"><div class="social-user-info">${avatarHTML(p.avatar_url,p.username)}<div><strong>${escapeHTML(p.username)}</strong><div class="muted">${escapeHTML(p.bio||'自己紹介なし')}</div></div></div><div class="social-actions"><button class="secondary-button" data-social-action="view" data-user-id="${p.id}">プロフィール</button><button class="secondary-button" data-social-action="friend" data-user-id="${p.id}">友達追加</button><button class="secondary-button" data-social-action="dm" data-user-id="${p.id}">DM</button><button class="secondary-button" data-social-action="duel" data-user-id="${p.id}">対戦</button></div></div>`).join('')||'<p class="muted">ユーザーが見つかりませんでした。</p>'}
async function openPublicProfile(id){if(!requireSocialLogin())return;if(!id||id===state.user.id){showView('profile');return}const [{data:p,error},{data:logs}]=await Promise.all([supabase.from('profiles').select('id,username,bio,avatar_url').eq('id',id).maybeSingle(),supabase.from('study_logs').select('minutes,created_at').eq('user_id',id)]);if(error||!p){showNotice('プロフィールを読み込めませんでした。','error');return}socialTarget=p;const total=(logs||[]).reduce((s,l)=>s+Number(l.minutes||0),0);const todayKey=localDayKey(new Date());const today=(logs||[]).filter(l=>localDayKey(l.created_at)===todayKey).reduce((s,l)=>s+Number(l.minutes||0),0);$('#social-profile-panel').innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${avatarHTML(p.avatar_url,p.username)}<div style="flex:1;min-width:140px"><h3 style="margin:0">${escapeHTML(p.username)}</h3><p class="muted" style="margin:5px 0">${escapeHTML(p.bio||'自己紹介なし')}</p><p style="margin:0">累計 ${compactMinutes(total)} ・ 今日 ${compactMinutes(today)}</p></div></div><div class="social-actions" style="margin-top:12px"><button class="secondary-button" data-social-action="friend" data-user-id="${p.id}">友達追加</button><button class="secondary-button" data-social-action="dm" data-user-id="${p.id}">DMを送る</button><button class="primary-button" data-social-action="duel" data-user-id="${p.id}">1日対戦を申し込む</button></div>`;}
async function sendFriendRequest(id){if(!requireSocialLogin()||id===state.user.id)return;const {data:existing}=await supabase.from('friendships').select('id,status,requester_id,addressee_id').or(`and(requester_id.eq.${state.user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${state.user.id})`).maybeSingle();if(existing){if(existing.status==='accepted')showNotice('すでに友達です。');else showNotice('友達申請はすでに存在します。');return}const {error}=await supabase.from('friendships').insert({requester_id:state.user.id,addressee_id:id,status:'pending'});if(error){showNotice('友達申請を送れませんでした。SQL設定を確認してください。','error');return}showNotice('友達申請を送りました。','success');await loadFriends();}
async function loadFriends(){const root=$('#social-friends-panel');if(!root)return;if(!state.user||!supabase){root.innerHTML='<p class="muted">ログインすると友達を追加できます。</p>';return}const {data:rows,error}=await supabase.from('friendships').select('id,requester_id,addressee_id,status,created_at').or(`requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`).order('created_at',{ascending:false});if(error){root.innerHTML='<p class="muted">友達を読み込めません。SQL設定を適用してください。</p>';return}const ids=[...new Set((rows||[]).map(r=>r.requester_id===state.user.id?r.addressee_id:r.requester_id))];let profiles=[];if(ids.length){const result=await supabase.from('profiles').select('id,username,avatar_url,bio').in('id',ids);profiles=result.data||[]}const byId=Object.fromEntries(profiles.map(p=>[p.id,p]));const html=(rows||[]).map(r=>{const otherId=r.requester_id===state.user.id?r.addressee_id:r.requester_id;const p=byId[otherId]||{username:'ユーザー'};const inbound=r.addressee_id===state.user.id&&r.status==='pending';return `<div class="social-user-row"><div class="social-user-info">${avatarHTML(p.avatar_url,p.username)}<div><strong>${escapeHTML(p.username)}</strong><div class="muted">${r.status==='accepted'?'友達':inbound?'友達申請が届いています':'申請中'}</div></div></div><div class="social-actions">${inbound?`<button class="primary-button" data-friend-action="accept" data-id="${r.id}">承認</button>`:''}<button class="secondary-button" data-friend-action="view" data-user-id="${otherId}">プロフィール</button>${r.status==='accepted'?`<button class="secondary-button" data-friend-action="dm" data-user-id="${otherId}">DM</button><button class="secondary-button" data-friend-action="duel" data-user-id="${otherId}">対戦</button>`:''}</div></div>`}).join('');root.innerHTML=html||'<p class="muted">まだ友達はいません。上の検索からユーザーを探してください。</p>';const accepted=(rows||[]).filter(r=>r.status==='accepted').map(r=>{const id=r.requester_id===state.user.id?r.addressee_id:r.requester_id;return {id,username:byId[id]?.username||'ユーザー'}});$('#dm-friend-picker').innerHTML=accepted.length?accepted.map(p=>`<button type="button" class="dm-friend-button ${dmTarget===p.id?'active':''}" data-dm-user="${p.id}">${avatarHTML(byId[p.id]?.avatar_url,p.username)}<span class="dm-friend-name">${escapeHTML(p.username)}</span></button>`).join(''):'<p class="muted">DMを送るには、先に友達になってください。</p>'}
async function acceptFriendRequest(id){if(!requireSocialLogin())return;const {error}=await supabase.from('friendships').update({status:'accepted'}).eq('id',id).eq('addressee_id',state.user.id);if(error){showNotice('申請を承認できませんでした。','error');return}showNotice('友達になりました。','success');await loadFriends()}
async function openDM(userId){
  if(!requireSocialLogin())return;
  dmTarget=userId;switchSocialTab('dm');
  const [{data:p},{data:messages,error}]=await Promise.all([
    supabase.from('profiles').select('username,avatar_url').eq('id',userId).maybeSingle(),
    supabase.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').or(`and(sender_id.eq.${state.user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${state.user.id})`).order('created_at',{ascending:true}).limit(100)
  ]);
  const name=p?.username||'友達';
  $('#dm-chat-header').innerHTML=`${avatarHTML(p?.avatar_url,name)}<div><div>${escapeHTML(name)}</div><small class="muted" style="font-weight:400">ダイレクトメッセージ</small></div>`;
  $('#dm-thread').innerHTML=error?'<div class="dm-empty">DMを読み込めません。友達関係とSQL設定を確認してください。</div>':(messages||[]).map(m=>`<div class="dm-bubble-row ${m.sender_id===state.user.id?'mine':'theirs'}"><div class="dm-bubble">${escapeHTML(m.body)}<div class="dm-bubble-time">${relativeTime(m.created_at)}</div></div></div>`).join('')||'<div class="dm-empty">最初のメッセージを送ってみましょう。</div>';
  $('#dm-thread').dataset.userId=userId;
  $('#dm-input').placeholder=`${name}にメッセージを書く…`;
  $('#dm-input').disabled=Boolean(error);$('#dm-form button').disabled=Boolean(error);
  $$('#dm-friend-picker [data-dm-user]').forEach(b=>b.classList.toggle('active',b.dataset.dmUser===userId));
  $('#dm-thread').scrollTop=$('#dm-thread').scrollHeight;
  if(!error)$('#dm-input').focus();
}
async function sendDM(e){e.preventDefault();if(!requireSocialLogin())return;const recipient=dmTarget||$('#dm-thread').dataset.userId;const body=$('#dm-input').value.trim();if(!recipient||!body){showNotice('友達を選び、メッセージを入力してください。');return}const {error}=await supabase.from('direct_messages').insert({sender_id:state.user.id,recipient_id:recipient,body});if(error){showNotice('DMを送れませんでした。友達同士か、SQL設定を確認してください。','error');return}$('#dm-input').value='';await openDM(recipient)}
async function createDuel(opponentId){if(!requireSocialLogin()||opponentId===state.user.id)return;const {data:friend}=await supabase.from('friendships').select('id').eq('status','accepted').or(`and(requester_id.eq.${state.user.id},addressee_id.eq.${opponentId}),and(requester_id.eq.${opponentId},addressee_id.eq.${state.user.id})`).maybeSingle();if(!friend){showNotice('1日対戦は友達同士で利用できます。先に友達追加してください。');return}const duelDate=localDayKey(new Date());const {error}=await supabase.from('duels').insert({challenger_id:state.user.id,opponent_id:opponentId,duel_date:duelDate,status:'pending'});if(error){showNotice('対戦を申し込めませんでした。今日の対戦がすでにあるか、SQL設定を確認してください。','error');return}showNotice('今日の対戦を申し込みました。','success');await loadDuels()}
async function acceptDuel(id){if(!requireSocialLogin())return;const {error}=await supabase.from('duels').update({status:'accepted'}).eq('id',id).eq('opponent_id',state.user.id).eq('status','pending');if(error){showNotice('対戦を承認できませんでした。','error');return}showNotice('1日対戦を開始しました。','success');await loadDuels()}
async function loadDuels(){const root=$('#duel-list');if(!root)return;if(!state.user||!supabase){root.innerHTML='<p class="muted">ログインすると1日対戦ができます。</p>';return}const {data:duels,error}=await supabase.from('duels').select('id,challenger_id,opponent_id,duel_date,status,created_at').or(`challenger_id.eq.${state.user.id},opponent_id.eq.${state.user.id}`).order('created_at',{ascending:false}).limit(30);if(error){root.innerHTML='<p class="muted">対戦を読み込めません。SQL設定を適用してください。</p>';return}const ids=[...new Set((duels||[]).flatMap(d=>[d.challenger_id,d.opponent_id]))];let profs=[];if(ids.length){const r=await supabase.from('profiles').select('id,username').in('id',ids);profs=r.data||[]}const names=Object.fromEntries(profs.map(p=>[p.id,p.username]));const dates=[...new Set((duels||[]).map(d=>d.duel_date))];const scoreMap={};if(dates.length){for(const date of dates){const start=new Date(`${date}T00:00:00`);const end=new Date(start);end.setDate(end.getDate()+1);const r=await supabase.from('study_logs').select('user_id,minutes').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).in('user_id',ids);(r.data||[]).forEach(log=>{scoreMap[`${date}:${log.user_id}`]=(scoreMap[`${date}:${log.user_id}`]||0)+Number(log.minutes||0)})}}root.innerHTML=(duels||[]).map(d=>{const mine=d.challenger_id===state.user.id;const other=mine?d.opponent_id:d.challenger_id;const a=scoreMap[`${d.duel_date}:${d.challenger_id}`]||0,b=scoreMap[`${d.duel_date}:${d.opponent_id}`]||0;let result='対戦申請中';if(d.status==='accepted')result=a===b?'同点':a>b?`${escapeHTML(names[d.challenger_id]||'挑戦者')} がリード`:`${escapeHTML(names[d.opponent_id]||'対戦相手')} がリード`;return `<div class="social-user-row" style="align-items:flex-start"><div style="flex:1;min-width:180px"><strong>${escapeHTML(names[d.challenger_id]||'挑戦者')} vs ${escapeHTML(names[d.opponent_id]||'対戦相手')}</strong><div class="muted">日付：${escapeHTML(d.duel_date)} ・ ${d.status==='accepted'?'対戦中':d.status==='completed'?'終了':'申請中'}</div><p style="margin:7px 0">${d.status==='accepted'?`${compactMinutes(a)} vs ${compactMinutes(b)}　— ${result}`:result}</p></div><div class="social-actions">${d.status==='pending'&&!mine?`<button class="primary-button" data-duel-action="accept" data-id="${d.id}">承認</button>`:''}<button class="secondary-button" data-duel-action="view" data-user-id="${other}">プロフィール</button></div></div>`}).join('')||'<p class="muted">対戦はまだありません。友達のプロフィールから申し込めます。</p>'}
async function uploadAvatar(file){if(!requireSocialLogin())return;if(!file)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>2*1024*1024){showNotice('画像はPNG・JPEG・WebP・GIF、2MB以下にしてください。','error');return}const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${state.user.id}/${Date.now()}.${ext}`;const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});if(uploadError){showNotice('アイコンをアップロードできません。Supabaseにavatarsストレージを設定してください。','error');return}const {data}=supabase.storage.from('avatars').getPublicUrl(path);const {data:profile,error}=await supabase.from('profiles').update({avatar_url:data.publicUrl}).eq('id',state.user.id).select().single();if(error){showNotice('アイコンURLを保存できませんでした。profiles.avatar_url列を確認してください。','error');return}state.profile=profile;showNotice('アイコンを更新しました。','success');await renderProfile();await loadPosts();}


setupSocialUI();
setupRankingPeriods();
$('#today-label').textContent=new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).toUpperCase();
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$('#refresh-button').addEventListener('click',()=>loadAll());$('#account-button').addEventListener('click',()=>state.user?showView('profile'):openAuth());$('#empty-login').addEventListener('click',()=>openAuth());$('#profile-login').addEventListener('click',()=>openAuth());$('#profile-content').addEventListener('click',e=>{if(e.target.id==='profile-login-inner')openAuth();if(e.target.id==='logout-button')logout()});$('#profile-content').addEventListener('change',e=>{if(e.target.id==='avatar-upload')uploadAvatar(e.target.files?.[0])});$('#login-tab').addEventListener('click',()=>setAuthMode('login'));$('#signup-tab').addEventListener('click',()=>setAuthMode('signup'));$('#forgot-password').addEventListener('click',sendPasswordReset);$('#auth-form').addEventListener('submit',authSubmit);$('#ranking-period').addEventListener('change',renderRanking);$('#timer-start').addEventListener('click',startTimer);$('#timer-pause').addEventListener('click',pauseTimer);$('#timer-reset').addEventListener('click',resetTimer);$('#save-session').addEventListener('click',async()=>{const minutes=Math.floor(state.timerSeconds/60);if(minutes<1)return;if(await saveStudy(minutes,$('#study-subject').value)){resetTimer();$('#study-subject').value=''}});$('#manual-form').addEventListener('submit',async e=>{e.preventDefault();const minutes=Number($('#manual-minutes').value);if(!Number.isInteger(minutes)||minutes<1||minutes>1440){showNotice('勉強時間は1〜1440分で入力してください。','error');return}if(await saveStudy(minutes,$('#manual-subject').value)){e.currentTarget.reset()}});$('#feed-list').addEventListener('click',e=>{const like=e.target.closest('[data-like]');if(like){if(state.demo){state.likes.has(like.dataset.like)?state.likes.delete(like.dataset.like):state.likes.add(like.dataset.like);renderFeed();showNotice('デモモードでは変更は保存されません。');}else toggleLike(like.dataset.like)}const comment=e.target.closest('[data-comment-toggle]');if(comment){const form=$(`[data-comment-form="${comment.dataset.commentToggle}"]`);form?.classList.toggle('hidden');form?.querySelector('input')?.focus()}});$('#feed-list').addEventListener('submit',e=>{const form=e.target.closest('[data-comment-form]');if(!form)return;e.preventDefault();if(state.demo){showNotice('デモモードではコメントは保存されません。');return}addComment(e,form.dataset.commentForm)});$('#chat-form').addEventListener('submit',async e=>{e.preventDefault();const body=$('#chat-input').value.trim();if(!body)return;if(!state.user){openAuth();return}const {error}=await supabase.from('messages').insert({user_id:state.user.id,body});if(error){showNotice(error.message,'error');return}$('#chat-input').value='';await loadChat()});$('#profile-content').addEventListener('submit',async e=>{if(e.target.id!=='profile-edit-form')return;e.preventDefault();const username=$('#profile-username').value.trim(),bio=$('#profile-bio').value.trim();const {data,error}=await supabase.from('profiles').update({username,bio}).eq('id',state.user.id).select().single();if(error){showNotice(error.message,'error');return}state.profile=data;updateAccountButton();showNotice('プロフィールを保存しました。','success');await loadAll()});
async function logout(){if(supabase)await supabase.auth.signOut();state.user=null;state.profile=null;updateAccountButton();showNotice('ログアウトしました。');await loadAll();showView('home')}
if(supabase){supabase.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>openRecoveryDialog(),0);setTimeout(()=>loadAll(),0)});supabase.channel('study-logs-live').on('postgres_changes',{event:'*',schema:'public',table:'study_logs'},()=>{loadPosts();renderStats();renderRanking();loadDuels()}).on('postgres_changes',{event:'*',schema:'public',table:'messages'},()=>loadChat()).on('postgres_changes',{event:'*',schema:'public',table:'direct_messages'},()=>{if(dmTarget)openDM(dmTarget)}).subscribe();}updateTimer();updateAccountButton();loadAll();
