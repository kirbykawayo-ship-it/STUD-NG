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
  if(days[0]!==today&&days[0]!==yesterday)return {current:0,days:new Set(days)};
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
          <option value="15" ${goal===15?'selected':''}>15分</option>
          <option value="30" ${goal===30?'selected':''}>30分</option>
          <option value="45" ${goal===45?'selected':''}>45分</option>
          <option value="60" ${goal===60?'selected':''}>60分</option>
          <option value="90" ${goal===90?'selected':''}>90分</option>
          <option value="120" ${goal===120?'selected':''}>120分</option>
          <option value="180" ${goal===180?'selected':''}>180分</option>
          <option value="240" ${goal===240?'selected':''}>240分</option>
        </select>
      </label>
    </div>
    <div style="display:flex;justify-content:space-between;margin:14px 0 7px;font-weight:600">
      <span>${compactMinutes(done)} / ${goal}分</span>
      <span>${pct}%</span>
    </div>
    <div style="height:9px;border-radius:999px;background:var(--border-color,#e5e7eb);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--accent,#64748b);border-radius:999px;transition:width .25s"></div>
    </div>`;

  const select=$('#daily-goal-select');
  select.addEventListener('change',()=>{
    localStorage.setItem(key,String(Number(select.value)));
    renderDailyGoal(logs);
  });
}

function updateAccountButton(){
  $('#account-label').textContent=state.user?(state.profile?.username||'マイページ'):'ログイン';
  $('#account-button .avatar').textContent=state.user?initials(state.profile?.username):'S';
  $('#chat-input').disabled=!state.user;
  $('#chat-send').disabled=!state.user;
  $('#chat-access-label').textContent=state.user?'オンラインチャット':'ログインが必要です';
}

function openAuth(mode='login'){
  setAuthMode(mode);
  $('#auth-message').textContent='';
  $('#auth-dialog').showModal();
}

function setAuthMode(mode){
  const signup=mode==='signup';
  $('#login-tab').classList.toggle('active',!signup);
  $('#signup-tab').classList.toggle('active',signup);
  $('#auth-title').textContent=signup?'アカウントを作成':'おかえりなさい';
  $('#auth-subtitle').textContent=signup
    ?'ユーザー名を決めて、勉強記録を始めよう。'
    :'ログインして勉強を記録しよう。';
  $('#auth-username').classList.toggle('hidden',!signup);
  $('#username-label').classList.toggle('hidden',!signup);
  $('#auth-username').required=signup;
  $('#auth-password').autocomplete=signup?'new-password':'current-password';
  $('#auth-submit').textContent=signup?'新規登録':'ログイン';
  $('#auth-form').dataset.mode=mode;
}

async function authSubmit(e){
  e.preventDefault();
  if(!supabase){
    $('#auth-message').textContent='Supabaseの設定がまだ完了していません。READMEの手順に沿って設定してください。';
    return;
  }
  const mode=$('#auth-form').dataset.mode;
  const email=$('#auth-email').value.trim();
  const password=$('#auth-password').value;
  const username=$('#auth-username').value.trim();
  $('#auth-submit').disabled=true;
  $('#auth-message').textContent='処理中…';
  try{
    if(mode==='signup'){
      if(username.length<2)throw new Error('ユーザー名は2文字以上で入力してください。');
      const {data,error}=await supabase.auth.signUp({
        email,
        password,
        options:{data:{username}}
      });
      if(error)throw error;
      if(data.session){
        $('#auth-dialog').close();
        showNotice('アカウントを作成しました。','success');
        await loadAll();
      }else{
        $('#auth-message').textContent='確認メールを送信しました。メール内のリンクから登録を完了してください。';
      }
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      $('#auth-dialog').close();
      showNotice('ログインしました。','success');
      await loadAll();
    }
  }catch(err){
    $('#auth-message').textContent=err.message||'認証に失敗しました。';
  }finally{
    $('#auth-submit').disabled=false;
  }
}

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
    const {error}=await supabase.auth.resetPasswordForEmail(
      email,
      {redirectTo:window.location.origin}
    );
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

    dialog.innerHTML=`
      <form method="dialog" class="dialog-close-row">
        <button class="close-button" aria-label="閉じる">×</button>
      </form>
      <div class="auth-brand">
        <span class="brand-mark">S</span>
        <span>STUDING</span>
      </div>
      <h2>新しいパスワード</h2>
      <p class="muted">新しく使うパスワードを入力してください。</p>
      <form id="recovery-form">
        <label class="field-label" for="recovery-password">
          新しいパスワード（8文字以上）
        </label>
        <input class="text-input" id="recovery-password"
          type="password" minlength="8" required
          autocomplete="new-password" placeholder="8文字以上">
        <label class="field-label" for="recovery-password-confirm">
          パスワード（確認）
        </label>
        <input class="text-input" id="recovery-password-confirm"
          type="password" minlength="8" required
          autocomplete="new-password" placeholder="もう一度入力">
        <button class="primary-button full auth-submit"
          type="submit" id="recovery-submit">パスワードを変更</button>
        <p class="auth-message" id="recovery-message" role="status"></p>
      </form>`;

    document.body.appendChild(dialog);

    dialog.querySelector('#recovery-form').addEventListener('submit',async e=>{
      e.preventDefault();

      const password=dialog.querySelector('#recovery-password').value;
      const confirmation=dialog.querySelector('#recovery-password-confirm').value;
      const message=dialog.querySelector('#recovery-message');
      const button=dialog.querySelector('#recovery-submit');

      if(password.length<8){
        message.textContent='パスワードは8文字以上にしてください。';
        return;
      }

      if(password!==confirmation){
        message.textContent='2つのパスワードが一致しません。';
        return;
      }

      button.disabled=true;
      message.textContent='変更中…';

      try{
        const {error}=await supabase.auth.updateUser({password});
        if(error)throw error;

        message.textContent='パスワードを変更しました。ログインできます。';
        dialog.querySelector('#recovery-form').reset();

        setTimeout(()=>{
          if(dialog.open)dialog.close();
          openAuth('login');
        },1200);
      }catch(err){
        message.textContent=err.message||'変更できませんでした。再設定メールからやり直してください。';
      }finally{
        button.disabled=false;
      }
    });
  }

  if(!dialog.open)dialog.showModal();
}

// 勉強タイマー
function formatTimer(seconds){
  const h=Math.floor(seconds/3600);
  const m=Math.floor(seconds%3600/60);
  const s=seconds%60;

  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
}

function updateTimer(){
  let seconds=state.elapsedBeforePause;

  if(state.timerStartedAt&&!state.paused){
    seconds+=Math.floor((Date.now()-state.timerStartedAt)/1000);
  }

  state.timerSeconds=seconds;
  $('#timer-display').textContent=formatTimer(seconds);

  const running=Boolean(state.timerStartedAt&&!state.paused);

  $('#timer-status').classList.toggle('running',running);
  $('#timer-status').innerHTML=`
    <span></span>
    ${running?'集中中':state.paused?'一時停止中':'記録待機中'}
  `;

  $('#save-session').disabled=seconds<60;
  $('#timer-pause').disabled=!state.timerStartedAt;
  $('#timer-start').disabled=Boolean(state.timerStartedAt&&!state.paused);
  $('#timer-start').textContent=state.paused?'▶ 再開':'▶ スタート';
}

function startTimer(){
  if(state.paused){
    state.timerStartedAt=Date.now();
    state.paused=false;
  }else if(!state.timerStartedAt){
    state.timerStartedAt=Date.now();
    state.elapsedBeforePause=0;
  }

  clearInterval(state.timerInterval);
  state.timerInterval=setInterval(updateTimer,500);
  updateTimer();
}

function pauseTimer(){
  if(!state.timerStartedAt||state.paused)return;

  state.elapsedBeforePause+=Math.floor(
    (Date.now()-state.timerStartedAt)/1000
  );

  state.timerStartedAt=null;
  state.paused=true;

  clearInterval(state.timerInterval);
  updateTimer();
}

function resetTimer(){
  clearInterval(state.timerInterval);

  state.timerStartedAt=null;
  state.elapsedBeforePause=0;
  state.timerSeconds=0;
  state.paused=false;

  updateTimer();
}

// 勉強記録を保存
async function saveStudy(minutes,subject){
  if(!state.user){
    openAuth();
    showNotice('勉強時間を保存するにはログインしてください。');
    return false;
  }

  if(!supabase)return false;

  const {error}=await supabase.from('study_logs').insert({
    user_id:state.user.id,
    minutes,
    subject:subject.trim()||null
  });

  if(error){
    showNotice(`保存できませんでした：${error.message}`,'error');
    return false;
  }

  showNotice(`${minutes}分の勉強記録を保存しました。`,'success');

  await Promise.all([
    loadPosts(),
    renderStats(),
    renderRanking(),
    renderProfile()
  ]);

  return true;
}

// グループチャット
async function loadChat(){
  if(state.demo){
    renderChatDemo();
    return;
  }

  const {data,error}=await supabase
    .from('messages')
    .select('id,user_id,body,created_at,profiles(username)')
    .order('created_at',{ascending:true})
    .limit(100);

  if(error){
    $('#chat-messages').innerHTML=
      '<p class="muted">チャットを読み込めません。SQL設定を確認してください。</p>';
    return;
  }

  renderChat(data||[]);
}

function renderChatDemo(){
  renderChat([
    {
      id:'m1',
      user_id:'demo-1',
      body:'今日は数学を50分進めた！',
      created_at:new Date(Date.now()-3600000).toISOString(),
      profiles:{username:'haru_study'}
    },
    {
      id:'m2',
      user_id:'demo-2',
      body:'おつかれさま！自分もこれから始めます。',
      created_at:new Date(Date.now()-1800000).toISOString(),
      profiles:{username:'mikan_23'}
    }
  ]);
}

function renderChat(messages){
  $('#chat-messages').innerHTML=messages.length
    ?messages.map(m=>`
      <div class="chat-line">
        <span class="avatar">${escapeHTML(initials(m.profiles?.username||'S'))}</span>
        <div class="chat-bubble">
          <strong>${escapeHTML(m.profiles?.username||'メンバー')}</strong>
          ${escapeHTML(m.body)}
          <small>${relativeTime(m.created_at)}</small>
        </div>
      </div>
    `).join('')
    :`
      <div class="empty-state">
        <div class="empty-icon">▤</div>
        <strong>最初のメッセージを送ろう</strong>
        <p>勉強の相談や励ましを共有できます。</p>
      </div>
    `;

  $('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
}

// プロフィール画面
async function renderProfile(){
  const root=$('#profile-content');

  if(!state.user){
    root.innerHTML=`
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <strong>ログインしてください</strong>
        <p>アカウントを作成すると、勉強記録を管理できます。</p>
        <button class="primary-button" id="profile-login-inner">
          ログイン / 登録
        </button>
      </div>`;

    renderDailyGoal([]);
    return;
  }

  if(state.demo)return;

  const {data:logs,error}=await supabase
    .from('study_logs')
    .select('minutes,created_at,subject')
    .eq('user_id',state.user.id)
    .order('created_at',{ascending:false});

  if(error){
    root.innerHTML='<p class="muted">プロフィールを読み込めませんでした。</p>';
    return;
  }

  const allLogs=logs||[];
  const list=allLogs.slice(0,10);
  const total=allLogs.reduce((sum,log)=>sum+Number(log.minutes||0),0);
  const streak=streakFromLogs(allLogs);

  const weekTotal=allLogs
    .filter(log=>new Date(log.created_at)>=weekStart())
    .reduce((sum,log)=>sum+Number(log.minutes||0),0);

  renderDailyGoal(allLogs);

  const badges=[
    {name:'はじめの一歩',desc:'最初の記録を保存',earned:allLogs.length>=1},
    {name:'集中60分',desc:'累計60分',earned:total>=60},
    {name:'記録5回',desc:'勉強記録を5回保存',earned:allLogs.length>=5},
    {name:'1週間継続',desc:'7日連続で記録',earned:streak.current>=7},
    {name:'累計10時間',desc:'累計600分',earned:total>=600}
  ];

  root.innerHTML=`
    <div class="profile-hero">
      ${avatarHTML(state.profile?.avatar_url,state.profile?.username)}
      <div>
        <h3>${escapeHTML(state.profile?.username||'student')}</h3>
        <p>${escapeHTML(state.user.email||'')} ・ メンバー</p>
      </div>
      <button class="secondary-button" id="logout-button">ログアウト</button>
    </div>

    <div style="margin:12px 0">
      <label class="field-label" for="avatar-upload">
        プロフィールアイコン（2MB以下）
      </label>
      <input class="text-input" id="avatar-upload" type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style="max-width:100%">
    </div>

    <div class="profile-stats">
      <div class="profile-stat">
        <span>累計勉強時間</span>
        <strong>${compactMinutes(total)}</strong>
      </div>
      <div class="profile-stat">
        <span>記録回数</span>
        <strong>${allLogs.length}</strong>
      </div>
      <div class="profile-stat">
        <span>連続記録日数</span>
        <strong>${streak.current}日</strong>
      </div>
      <div class="profile-stat">
        <span>今週の勉強時間</span>
        <strong>${compactMinutes(weekTotal)}</strong>
      </div>
    </div>

    <section style="margin:22px 0">
      <h3>獲得バッジ</h3>
      <p class="muted">記録を積み重ねるとバッジが増えます。</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${badges.map(b=>`
          <div style="padding:12px;border-radius:12px;border:1px solid var(--border-color,#e5e7eb);opacity:${b.earned?'1':'.55'}">
            <strong>${b.earned?'★':'◇'} ${escapeHTML(b.name)}</strong>
            <p class="muted" style="font-size:12px;margin:5px 0 0">
              ${escapeHTML(b.desc)}${b.earned?' ・獲得済み':''}
            </p>
          </div>
        `).join('')}
      </div>
    </section>

    <h3>最近の勉強記録</h3>
    <div class="feed-list">
      ${list.map(log=>`
        <div class="feed-item">
          <span class="avatar">✎</span>
          <div class="feed-body">
            <div class="feed-head">
              <strong>${escapeHTML(log.subject||'勉強')}</strong>
              <span class="feed-time">${relativeTime(log.created_at)}</span>
            </div>
            <div class="feed-meta">
              <span class="duration-chip">◷ ${compactMinutes(log.minutes)}</span>
            </div>
          </div>
        </div>
      `).join('')||'<p class="muted">まだ勉強記録がありません。</p>'}
    </div>

    <div class="profile-edit">
      <h3>プロフィール設定</h3>
      <form id="profile-edit-form">
        <label class="field-label" for="profile-username">ユーザー名</label>
        <input class="text-input" id="profile-username"
          maxlength="24" minlength="2" required
          value="${escapeHTML(state.profile?.username||'')}">

        <label class="field-label" for="profile-bio">自己紹介</label>
        <input class="text-input" id="profile-bio"
          maxlength="160"
          value="${escapeHTML(state.profile?.bio||'')}"
          placeholder="勉強の目標など（任意）">

        <button class="primary-button" style="margin-top:12px" type="submit">
          プロフィールを保存
        </button>
      </form>
    </div>
  `;
}

function weekStart(){
  const d=new Date();
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  d.setHours(0,0,0,0);
  return d;
}

// いいね
async function toggleLike(id){
  if(!state.user){
    openAuth();
    showNotice('いいねするにはログインしてください。');
    return;
  }

  if(!supabase)return;

  const post=state.posts.find(p=>p.id===id);

  if(post?.liked){
    const {error}=await supabase.from('likes')
      .delete()
      .eq('log_id',id)
      .eq('user_id',state.user.id);

    if(error)showNotice(error.message,'error');
  }else{
    const {error}=await supabase.from('likes').insert({
      log_id:id,
      user_id:state.user.id
    });

    if(error&&error.code!=='23505'){
      showNotice(error.message,'error');
    }
  }

  await loadPosts();
}

// コメント
async function addComment(e,id){
  e.preventDefault();

  const form=e.currentTarget;
  const body=new FormData(form).get('body')?.toString().trim();

  if(!body)return;

  if(!state.user){
    openAuth();
    showNotice('コメントするにはログインしてください。');
    return;
  }

  const {error}=await supabase.from('comments').insert({
    log_id:id,
    user_id:state.user.id,
    body
  });

  if(error){
    showNotice(error.message,'error');
    return;
  }

  form.reset();
  await loadPosts();// 他のユーザーのプロフィールを表示
async function openUserProfile(userId){
  if(!userId)return;

  if(state.demo){
    const demo=demoProfiles.find(p=>p.id===userId);

    if(!demo){
      showNotice('デモ用プロフィールが見つかりません。');
      return;
    }

    showNotice(`${demo.username} のプロフィールを表示しています。`);
    return;
  }

  const {data:profile,error}=await supabase
    .from('profiles')
    .select('id,username,avatar_url,bio')
    .eq('id',userId)
    .maybeSingle();

  if(error||!profile){
    showNotice('プロフィールを取得できませんでした。','error');
    return;
  }

  const {data:logs}=await supabase
    .from('study_logs')
    .select('minutes')
    .eq('user_id',userId);

  const total=(logs||[]).reduce((sum,log)=>sum+Number(log.minutes||0),0);

  const dialog=document.createElement('dialog');
  dialog.className='auth-dialog';

  dialog.innerHTML=`
    <form method="dialog" style="text-align:right">
      <button class="close-button" aria-label="閉じる">×</button>
    </form>
    <div style="text-align:center;padding:12px">
      ${avatarHTML(profile.avatar_url,profile.username)}
      <h2>${escapeHTML(profile.username)}</h2>
      <p>${escapeHTML(profile.bio||'自己紹介はまだありません。')}</p>
      <p>累計勉強時間：${compactMinutes(total)}</p>
      ${profile.id!==state.user?.id?`
        <button class="primary-button" id="send-friend-request">
          友達申請
        </button>
      `:''}
    </div>`;

  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener('close',()=>dialog.remove());

  dialog.querySelector('#send-friend-request')?.addEventListener('click',async()=>{
    const {error}=await supabase.from('friend_requests').insert({
      sender_id:state.user.id,
      receiver_id:profile.id,
      status:'pending'
    });

    if(error){
      showNotice(
        error.code==='23505'
          ?'すでに申請済みか、友達になっています。'
          :`申請できませんでした：${error.message}`,
        'error'
      );
      return;
    }

    showNotice('友達申請を送りました。','success');
    dialog.close();
  });
}

// 友達申請と友達一覧
async function loadFriends(){
  const root=$('#friends-content');
  if(!root)return;

  if(!state.user||state.demo){
    root.innerHTML=`
      <div class="empty-state">
        <strong>友達機能を使うにはログインしてください</strong>
        <p>ログインすると友達申請を管理できます。</p>
      </div>`;
    return;
  }

  root.innerHTML='<p class="muted">友達一覧を読み込み中…</p>';

  const {data:requests,error}=await supabase
    .from('friend_requests')
    .select('id,sender_id,receiver_id,status,created_at')
    .or(`sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`)
    .order('created_at',{ascending:false});

  if(error){
    root.innerHTML='<p class="muted">友達一覧を取得できません。データベース設定を確認してください。</p>';
    return;
  }

  const rows=requests||[];
  const incoming=rows.filter(r=>r.receiver_id===state.user.id&&r.status==='pending');
  const accepted=rows.filter(r=>r.status==='accepted');

  const ids=[...new Set(rows.map(r=>
    r.sender_id===state.user.id?r.receiver_id:r.sender_id
  ))];

  let profiles=[];

  if(ids.length){
    const result=await supabase
      .from('profiles')
      .select('id,username,avatar_url')
      .in('id',ids);

    profiles=result.data||[];
  }

  const profileById=Object.fromEntries(profiles.map(p=>[p.id,p]));

  root.innerHTML=`
    <section class="panel" style="padding:16px;margin-bottom:16px">
      <h3>受信した友達申請</h3>
      ${incoming.length?incoming.map(r=>{
        const p=profileById[r.sender_id];

        return `
          <div class="friend-row">
            ${avatarHTML(p?.avatar_url,p?.username||'ユーザー')}
            <strong>${escapeHTML(p?.username||'ユーザー')}</strong>
            <button class="primary-button" data-accept-friend="${r.id}">
              承認
            </button>
          </div>`;
      }).join(''):'<p class="muted">新しい申請はありません。</p>'}
    </section>

    <section class="panel" style="padding:16px">
      <h3>友達一覧</h3>
      ${accepted.length?accepted.map(r=>{
        const otherId=r.sender_id===state.user.id?r.receiver_id:r.sender_id;
        const p=profileById[otherId];

        return `
          <div class="friend-row">
            ${avatarHTML(p?.avatar_url,p?.username||'ユーザー')}
            <strong>${escapeHTML(p?.username||'ユーザー')}</strong>
            <button class="secondary-button" data-open-dm="${otherId}">
              DM
            </button>
            <button class="secondary-button" data-start-duel="${otherId}">
              対戦
            </button>
          </div>`;
      }).join(''):'<p class="muted">まだ友達がいません。</p>'}
    </section>`;
}

// 友達申請の承認
async function acceptFriendRequest(requestId){
  if(!state.user||!supabase)return;

  const {error}=await supabase
    .from('friend_requests')
    .update({status:'accepted'})
    .eq('id',requestId)
    .eq('receiver_id',state.user.id)
    .eq('status','pending');

  if(error){
    showNotice(`承認できませんでした：${error.message}`,'error');
    return;
  }

  showNotice('友達申請を承認しました。','success');
  await loadFriends();
}

// DM画面を開く
async function openDM(otherUserId){
  if(!state.user||!supabase){
    openAuth();
    return;
  }

  const {data:profile}=await supabase
    .from('profiles')
    .select('username')
    .eq('id',otherUserId)
    .maybeSingle();

  const root=$('#dm-content');
  if(!root)return;

  root.innerHTML=`
    <section class="panel" style="padding:16px">
      <h3>${escapeHTML(profile?.username||'友達')} とのDM</h3>
      <div id="dm-messages" style="max-height:360px;overflow:auto"></div>
      <form id="dm-form" style="display:flex;gap:8px;margin-top:12px">
        <input class="text-input" name="body" maxlength="1000"
          placeholder="メッセージを入力…" required>
        <button class="primary-button" type="submit">送信</button>
      </form>
    </section>`;

  showView('social');

  await loadDMMessages(otherUserId);

  $('#dm-form').addEventListener('submit',async e=>{
    e.preventDefault();

    const form=e.currentTarget;
    const body=new FormData(form).get('body')?.toString().trim();

    if(!body)return;

    const {error}=await supabase.from('direct_messages').insert({
      sender_id:state.user.id,
      receiver_id:otherUserId,
      body
    });

    if(error){
      showNotice(`送信できませんでした：${error.message}`,'error');
      return;
    }

    form.reset();
    await loadDMMessages(otherUserId);
  });
}

// DMの読み込み
async function loadDMMessages(otherUserId){
  if(!state.user||!supabase)return;

  const {data,error}=await supabase
    .from('direct_messages')
    .select('id,sender_id,receiver_id,body,created_at')
    .or(
      `and(sender_id.eq.${state.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${state.user.id})`
    )
    .order('created_at',{ascending:true})
    .limit(100);

  const root=$('#dm-messages');
  if(!root)return;

  if(error){
    root.innerHTML='<p class="muted">DMを読み込めません。SQL設定を確認してください。</p>';
    return;
  }

  root.innerHTML=(data||[]).map(m=>`
    <div style="display:flex;justify-content:${m.sender_id===state.user.id?'flex-end':'flex-start'};margin:8px 0">
      <div style="padding:10px 14px;border-radius:14px;background:var(--surface,#f1f5f9);max-width:80%;overflow-wrap:anywhere">
        ${escapeHTML(m.body)}
        <small style="display:block;margin-top:4px;color:var(--muted,#64748b)">
          ${relativeTime(m.created_at)}
        </small>
      </div>
    </div>
  `).join('');

  root.scrollTop=root.scrollHeight;
}

// 1対1の1日勉強時間対戦
async function startDuel(opponentId){
  if(!state.user||!supabase){
    openAuth();
    return;
  }

  if(opponentId===state.user.id){
    showNotice('自分自身とは対戦できません。');
    return;
  }

  const {data:existing}=await supabase
    .from('study_duels')
    .select('id,status')
    .eq('status','active')
    .or(
      `and(player1_id.eq.${state.user.id},player2_id.eq.${opponentId}),and(player1_id.eq.${opponentId},player2_id.eq.${state.user.id})`
    )
    .limit(1);

  if(existing?.length){
    showNotice('この友達とはすでに対戦中です。');
    return;
  }

  const {error}=await supabase.from('study_duels').insert({
    player1_id:state.user.id,
    player2_id:opponentId,
    status:'active',
    starts_at:new Date().toISOString(),
    ends_at:new Date(Date.now()+24*60*60*1000).toISOString()
  });

  if(error){
    showNotice(`対戦を開始できませんでした：${error.message}`,'error');
    return;
  }

  showNotice('24時間の勉強対戦を開始しました。','success');
  await loadDuels();
}

// 対戦状況を表示
async function loadDuels(){
  const root=$('#duels-content');
  if(!root)return;

  if(!state.user||state.demo){
    root.innerHTML='<p class="muted">対戦機能を使うにはログインしてください。</p>';
    return;
  }

  const {data:duels,error}=await supabase
    .from('study_duels')
    .select('id,player1_id,player2_id,status,starts_at,ends_at')
    .or(`player1_id.eq.${state.user.id},player2_id.eq.${state.user.id}`)
    .order('starts_at',{ascending:false})
    .limit(20);

  if(error){
    root.innerHTML='<p class="muted">対戦情報を読み込めません。データベース設定を確認してください。</p>';
    return;
  }

  const list=duels||[];

  const ids=[...new Set(list.flatMap(d=>[d.player1_id,d.player2_id]))];

  let profiles=[];

  if(ids.length){
    const result=await supabase.from('profiles')
      .select('id,username')
      .in('id',ids);

    profiles=result.data||[];
  }

  const names=Object.fromEntries(profiles.map(p=>[p.id,p.username]));

  root.innerHTML=list.length?list.map(d=>{
    const opponent=d.player1_id===state.user.id?d.player2_id:d.player1_id;
    const active=d.status==='active'&&new Date(d.ends_at)>new Date();

    return `
      <div class="panel" style="padding:14px;margin-bottom:10px">
        <strong>${escapeHTML(names[opponent]||'友達')} との対戦</strong>
        <p class="muted">${active?'対戦中':'終了または完了'}</p>
        <p>終了予定：${new Date(d.ends_at).toLocaleString('ja-JP')}</p>
        <button class="secondary-button" data-duel-result="${d.id}">
          勉強時間を確認
        </button>
      </div>`;
  }).join(''):'<p class="muted">対戦履歴はありません。友達一覧から対戦を始められます。</p>';
}
}
