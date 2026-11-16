  var QZ=(function(){ /*plain-engine v1*/
    var cp=null,box=null,set=null,R=null,tm=null;
    var LABEL={bank:'Quiz',src:'Questions',qs:'Questions',ans:'Answer from',mode:'Mode',len:'Length',time:'Time per question',miss:'Which items'};
    var KIND={hypo:'Problem or hypo',twist:'Reworded statement',g1:'Statement type',past:'Essay statement',new:'Essay statement'};
    function opts(){
      var o={};
      o.bank=[['hard','Harder: mostly hypos, plus your verdict'],['spot','Spot the essay only (the original bank)']];
      if(cp.n===5)o.src=[['all','Everything (exam mix)'],['hypo','Hypos only (the problem question)'],['stmt','Statements only'],['g1','Statement types (G1)']];
      else if(cp.n>1)o.qs=[['review','This family, plus review of earlier ones'],['fam','This family only']];
      o.ans=(cp.n===5?[]:[['sofar',cp.n===1?'Index rows E1–E13':'Index rows read so far (E1–E'+cp.upto+')']]).concat([['index','The full Index (like the exam)'],['four','Four choices (warm-up)']]);
      o.mode=[['practice','Practice: feedback after each'],['exam','Exam: feedback at the end']];
      o.len=[['10','10'],['20','20'],['all','All']];
      o.time=[['0','No timer'],['60','60 s'],['90','90 s'],['120','2 min']];
      o.miss=[['any','All items'],['missed','Only ones I missed'],['new','Only ones I have not tried']];
      return o;
    }
    function defs(){return cp.n===5?{bank:'hard',src:'all',ans:'index',mode:'exam',len:'20',time:'120',miss:'any'}:{bank:'hard',qs:'review',ans:'sofar',mode:'practice',len:'10',time:'0',miss:'any'};}
    function bank(){return set&&set.bank==='spot'?ITEMS:HARD;}
    function open(n,el){
      cp=CPS[n-1];box=el;var o=opts(),d=defs(),sv=rec.cpset[n]||{};set={};
      Object.keys(o).forEach(function(k){set[k]=(sv[k]&&o[k].some(function(x){return x[0]===sv[k];}))?sv[k]:d[k];});
      box.innerHTML='<div class="qpanel" id="qsetup"><h3>Set up the quiz</h3>'+Object.keys(o).map(function(g){return '<div class="row" data-g="'+g+'"><span class="rl">'+LABEL[g]+'</span></div>';}).join('')+
        '<div class="startrow"><button type="button" class="btn main" id="qstart">Start quiz '+n+'</button><span class="pool" id="qpool"></span></div></div>'+
        '<div class="qpanel" id="qstats"><h3>Your record'+(n<5?' in this family':'')+'</h3><div class="stats" id="qstat"></div><div id="qmix"></div>'+
        (n===5?'<p style="margin:12px 0 0"><button type="button" class="btn" id="qreset">Reset my quiz record</button></p>':'')+'</div>'+
        '<div class="qpanel hidden" id="qplay"></div><div class="qpanel hidden" id="qsum"></div>';
      $('qstart').addEventListener('click',function(){start();});
      if($('qreset'))$('qreset').addEventListener('click',function(){if(!confirm('Clear your quiz record (all five quizzes) in this browser?'))return;rec.items={};rec.mix={};rec.cp={};save(QK,rec);drawSetup();paint();});
      drawSetup();
      if(R&&R.cp===n&&!R.over){$('qsetup').classList.add('hidden');$('qstats').classList.add('hidden');$('qplay').classList.remove('hidden');if(R.done)next();else showQ();}
    }
    function close(){clearInterval(tm);if(box)box.innerHTML='';box=null;}
    function okItem(it){var r=rec.items[it.id];if(set.miss==='missed'&&!(r&&r.last&&r.last!=='right'))return false;if(set.miss==='new'&&r)return false;return true;}
    function inCp(it){return cp.n===5||famOf(it.best)===cp.fam;}
    function isStmt(it){return it.kind==='past'||it.kind==='new'||it.kind==='twist';}
    function pools(){
      var B=bank();
      if(cp.n===5)return {main:B.filter(function(it){
        if(set.src==='hypo'&&it.kind!=='hypo')return false;
        if(set.src==='stmt'&&!isStmt(it))return false;
        if(set.src==='g1'&&it.kind!=='g1')return false;return okItem(it);}),rev:[]};
      return {main:B.filter(function(it){return inCp(it)&&okItem(it);}),
        rev:set.qs==='review'?B.filter(function(it){return cp.prev.indexOf(famOf(it.best))>=0&&okItem(it);}):[]};
    }
    function sizes(p){var nm,nr;
      if(set.len==='all'){nm=p.main.length;nr=Math.min(p.rev.length,Math.round(nm*3/7));}
      else{var L=+set.len;nr=Math.min(p.rev.length,Math.round(L*0.3));nm=Math.min(p.main.length,L-nr);nr=Math.min(p.rev.length,L-nm);}
      return {nm:nm,nr:nr};}
    function drawSetup(){
      var o=opts();
      [].forEach.call(box.querySelectorAll('#qsetup .row'),function(row){
        var g=row.dataset.g;[].forEach.call(row.querySelectorAll('.chip'),function(c){c.remove();});
        o[g].forEach(function(x){var b=document.createElement('button');b.className='chip';b.type='button';b.textContent=x[1];
          b.setAttribute('aria-pressed',set[g]===x[0]?'true':'false');
          b.addEventListener('click',function(){set[g]=x[0];rec.cpset[cp.n]=set;save(QK,rec);drawSetup();});row.appendChild(b);});});
      var p=pools(),s=sizes(p),n=s.nm+s.nr,its=bank().filter(inCp),hy=its.filter(function(it){return it.kind==='hypo';}).length;
      $('qpool').textContent=n?(n+' question'+(n===1?'':'s')+(s.nr?': '+s.nm+' from this family and '+s.nr+' review':'')+'. The bank holds '+its.length+(cp.n<5?' for this family':'')+(set.bank==='hard'?', '+hy+' of them hypos.':'.')):'No questions match these settings. Change one.';
      $('qstart').disabled=!n;drawStats();
    }
    function stat(b,s){return '<div class="stat"><b>'+b+'</b><span>'+s+'</span></div>';}
    function drawStats(){
      var its=bank().filter(inCp),tried=0,right=0,half=0,seen=0;
      its.forEach(function(it){var r=rec.items[it.id];if(!r)return;seen++;tried+=r.n;right+=r.right;half+=r.half||0;});
      var c=rec.cp[cp.n];
      $('qstat').innerHTML=stat(c?c.last+'%':'–','last round'+(c?', '+c.of+' questions':''))+stat(c?c.best+'%':'–','best round')+
        stat(seen+' / '+its.length,'items tried in this bank')+stat(tried?Math.round(100*(right+half/2)/tried)+'%':'–','all your answers (part marks count half)');
      var mix=Object.keys(rec.mix).filter(function(k){var b=k.split('>')[0];return E[b]&&(cp.n===5||famOf(b)===cp.fam);}).sort(function(a,b){return rec.mix[b]-rec.mix[a];}).slice(0,6);
      var weak={};its.forEach(function(it){var r=rec.items[it.id];if(!r)return;var w=weak[it.best]||(weak[it.best]={n:0,s:0});w.n+=r.n;w.s+=r.right+(r.half||0)/2;});
      var wl=Object.keys(weak).filter(function(k){return weak[k].n>=2&&weak[k].s/weak[k].n<0.6;}).sort(function(a,b){return weak[a].s/weak[a].n-weak[b].s/weak[b].n;}).slice(0,6);
      var h='';
      if(mix.length)h+='<p class="rl" style="margin:16px 0 0">Your usual mix-ups</p><ul class="mix">'+mix.map(function(k){var p=k.split('>');
        return '<li>The answer was '+badge(p[0])+' you chose '+badge(p[1])+' <a href="#'+p[0].toLowerCase()+'">compare on the card</a><span class="n">'+rec.mix[k]+'×</span></li>';}).join('')+'</ul>';
      if(wl.length)h+='<p class="rl" style="margin:16px 0 0">Essays you find hardest</p><p style="margin:6px 0 0">'+wl.map(function(id){return badge(id);}).join(' ')+'</p>';
      if(!h)h='<p style="margin:12px 0 0;color:var(--soft)">Nothing yet. Your mix-ups and the essays you find hardest will show here.</p>';
      $('qmix').innerHTML=h;
    }
    function allowed(){var a={};ESSAYS.forEach(function(e){if(cp.n===5||set.ans==='index'||num(e.id)<=cp.upto)a[e.id]=1;});return a;}
    function start(list,redo){
      var p=pools(),s=sizes(p);
      list=list||shuffle(shuffle(p.main.slice()).slice(0,s.nm).concat(shuffle(p.rev.slice()).slice(0,s.nr)));
      R={cp:cp.n,items:list,i:0,res:[],score:0,ess:0,ver:0,vn:0,over:false,redo:!!redo,ans:set.ans,mode:set.mode,time:+set.time,allow:allowed()};
      $('qsetup').classList.add('hidden');$('qstats').classList.add('hidden');$('qsum').classList.add('hidden');$('qplay').classList.remove('hidden');
      showQ();
    }
    function choices(it){
      var A=R.allow,pri=[];it.t.forEach(function(t){pri.push(t[0]);});it.also.forEach(function(a){pri.push(a);});
      (NOTS[it.best]||[]).forEach(function(a){pri.push(a);});
      var seen={};seen[it.best]=1;var c=[];shuffle(pri).forEach(function(id){if(!seen[id]&&A[id]){seen[id]=1;c.push(id);}});
      c=c.slice(0,3);
      var same=shuffle(ESSAYS.filter(function(e){return e.fam===famOf(it.best)&&A[e.id];}).map(function(e){return e.id;}));
      var rest=shuffle(ESSAYS.filter(function(e){return A[e.id];}).map(function(e){return e.id;}));
      same.concat(rest).forEach(function(id){if(c.length<3&&!seen[id]){seen[id]=1;c.push(id);}});
      return shuffle(c.concat([it.best]));
    }
    function indexHtml(){
      var A=R.allow;
      return '<div class="ix">'+FAMS.map(function(f){
        var rs=ESSAYS.filter(function(e){return e.fam===f[0]&&A[e.id];});
        if(!rs.length)return '';
        return '<div class="ixf r-'+f[0]+'"><h3>'+f[1]+' '+f[2]+'</h3>'+rs.map(function(e){
          return '<button type="button" class="ixr r-'+e.fam+'" data-id="'+e.id+'"><span class="eid">'+e.id+'</span><span class="lik">'+(e.mark||'')+'</span><span>'+e.idx+'</span></button>';}).join('')+'</div>';}).join('')+'</div>';
    }
    function hasV(it){return !!(it.parts&&it.parts.length);}
    function showQ(){
      clearInterval(tm);
      var it=R.items[R.i],n=R.items.length,rv=cp.n<5&&famOf(it.best)!==cp.fam,v=hasV(it);
      var h='<div class="qhead"><span class="qno">Question '+(R.i+1)+' of '+n+'</span><span class="kind">'+(KIND[it.kind]||'Essay statement')+'</span>'+
        (rv?'<span class="kind rvw r-'+famOf(it.best)+'">Review</span>':'')+
        '<span class="score">'+(R.mode==='practice'?'Score '+fmtScore(R.score)+' / '+R.i:'Exam mode')+'</span></div>'+
        '<div class="bar"><span style="width:'+(100*R.i/n)+'%"></span></div>'+(R.time?'<div class="tbar" id="qtbar"><span></span></div>':'')+
        '<div class="prompt'+(it.kind==='hypo'?' hypo':'')+'">'+it.q+'</div>'+
        '<p class="ask">'+(v?'<span class="stp">Step 1 of 2</span> ':'')+(it.kind==='hypo'?'Which essay gives you the plan for this?':'Which essay answers this statement?')+'</p><div id="qfbw"></div>';
      if(R.ans==='four'){var c=choices(it);R.cur=c;
        h+='<div class="four">'+c.map(function(id,k){var e=E[id];return '<button type="button" class="ixr r-'+e.fam+'" data-id="'+id+'"><span class="k">'+(k+1)+'</span><span class="eid">'+id+'</span><span class="lik">'+(e.mark||'')+'</span><span>'+e.idx+'</span></button>';}).join('')+'</div>';}
      else h+='<div class="typer">Type a number <input id="qtyper" inputmode="text" autocomplete="off" placeholder="'+(cp.n===5?'25 or g1':'e.g. 7')+'" aria-label="Essay number"> and press Enter, or click a row'+(R.ans==='sofar'?' (only the essays read so far are listed)':' of the Index')+'.</div>'+indexHtml();
      h+='<div id="qverd"></div><div class="skip"><button type="button" class="btn" id="qskip">Not sure: show me</button><button type="button" class="btn" id="qquit">End round</button></div>';
      $('qplay').innerHTML=h;
      [].forEach.call($('qplay').querySelectorAll('.ixr'),function(b){b.addEventListener('click',function(){answer(b.dataset.id);});});
      $('qskip').addEventListener('click',function(){if(R.stage==='verdict')settle(false);else answer(null);});
      $('qquit').addEventListener('click',finish);
      var ty=$('qtyper');if(ty){if(window.innerWidth>700)ty.focus({preventScroll:true});ty.addEventListener('keydown',function(e){if(e.key!=='Enter')return;e.preventDefault();e.stopPropagation();
        var v=ty.value.trim().toUpperCase().replace(/\s/g,'');if(/^\d+$/.test(v))v='E'+v;if(v==='G')v='G1';
        if(E[v])answer(v);else{ty.value='';ty.placeholder='no such essay';}});}
      R.qt=Date.now();R.done=false;R.stage='essay';R.pick=null;R.vans=[];
      if(R.time){var total=R.time,lt=total,bar=$('qtbar');
        setTimeout(function(){if(bar){bar.firstChild.style.transitionDuration=total+'s';bar.firstChild.style.width='0%';}},30);
        tm=setInterval(function(){lt--;if(lt<=total*0.25&&bar)bar.classList.add('low');if(lt<=0){clearInterval(tm);if(R.stage==='verdict')settle(true);else answer(null,true);}},1000);}
      var top=$('qplay').getBoundingClientRect().top;if(top<0||top>window.innerHeight*0.5)window.scrollTo(0,window.scrollY+top-12);
    }
    function answer(pick,timeout){
      if(!R||R.done||R.stage!=='essay')return;
      var it=R.items[R.i];R.pick=pick;
      if(!hasV(it)||!pick||timeout){settle(!!timeout);return;}
      R.stage='verdict';
      [].forEach.call($('qplay').querySelectorAll('.ixr'),function(b){b.disabled=true;if(b.dataset.id===pick)b.classList.add('pick-mine');});
      var ty=$('qtyper');if(ty)ty.parentNode.classList.add('hidden');
      var ixw=$('qplay').querySelector('.ix,.four');if(ixw)ixw.classList.add('hidden');
      $('qverd').innerHTML='<div class="vstep"><p class="ask"><span class="stp">Step 2 of 2</span> Your verdict'+(it.parts.length>1?' on each point':'')+'</p><p class="vyou">Your essay: '+line(pick)+'</p>'+
        it.parts.map(function(p,k){return '<div class="vpart" data-k="'+k+'"><p class="vq">'+p.ask+'</p><div class="vopts">'+
          p.opts.map(function(o,j){return '<button type="button" class="vopt" data-k="'+k+'" data-j="'+j+'"><span class="k">'+(j+1)+'</span>'+o+'</button>';}).join('')+'</div></div>';}).join('')+'</div>';
      [].forEach.call($('qverd').querySelectorAll('.vopt'),function(b){b.addEventListener('click',function(){pickV(+b.dataset.k,+b.dataset.j);});});
      $('qskip').textContent='Not sure: show me';
      var top=$('qverd').getBoundingClientRect().top;if(top<0||top>window.innerHeight*0.6)window.scrollTo(0,window.scrollY+top-90);
    }
    function pickV(k,j){
      if(!R||R.done||R.stage!=='verdict'||R.vans[k]!==undefined)return;
      R.vans[k]=j;
      [].forEach.call($('qverd').querySelectorAll('.vopt[data-k="'+k+'"]'),function(b){b.disabled=true;if(+b.dataset.j===j)b.classList.add('chosen');});
      var it=R.items[R.i];
      for(var i=0;i<it.parts.length;i++)if(R.vans[i]===undefined){var nx=$('qverd').querySelector('.vpart[data-k="'+i+'"]');
        if(nx){var t=nx.getBoundingClientRect().top;if(t>window.innerHeight*0.85)window.scrollTo(0,window.scrollY+t-window.innerHeight*0.5);}return;}
      settle(false);
    }
    function settle(timeout){
      if(!R||R.done)return;R.done=true;clearInterval(tm);
      var it=R.items[R.i],pick=R.pick,v=hasV(it)&&!!pick;
      var es=pick===it.best?1:(pick&&it.also.indexOf(pick)>=0?0.5:0);
      var vs=null;if(hasV(it)){var ok=0;it.parts.forEach(function(p,k){if(R.vans[k]===p.ans)ok++;});vs=ok/it.parts.length;}
      var sc=vs===null?es:(es+vs)/2,res=sc>=0.999?'right':(sc>0?'half':'wrong');
      R.score+=sc;R.ess+=es;if(vs!==null){R.ver+=vs;R.vn++;}
      R.res.push({it:it,pick:pick,res:res,es:es,vs:vs,vans:R.vans.slice(),timeout:!!timeout,secs:Math.round((Date.now()-R.qt)/1000)});
      var r=rec.items[it.id]||(rec.items[it.id]={n:0,right:0,half:0});r.n++;if(res==='right')r.right++;if(res==='half')r.half++;r.last=res;
      if(pick&&pick!==it.best){var k=it.best+'>'+pick;rec.mix[k]=(rec.mix[k]||0)+1;}
      save(QK,rec);
      if(R.mode==='exam'){next();return;}
      var esr=es===1?'right':es?'half':'wrong';
      [].forEach.call($('qplay').querySelectorAll('.ixr'),function(b){b.disabled=true;b.classList.remove('pick-mine');var id=b.dataset.id;
        if(id===it.best)b.classList.add('pick-best');else if(id===pick)b.classList.add(esr==='half'?'pick-half':'pick-wrong');});
      var ty=$('qtyper');if(ty)ty.parentNode.classList.add('hidden');
      $('qskip').classList.add('hidden');$('qverd').innerHTML='';
      var ixw=$('qplay').querySelector('.ix,.four');if(ixw)ixw.classList.remove('hidden');
      $('qfbw').innerHTML=feedback(R.res[R.res.length-1])+'<div class="fbact"><button type="button" class="btn main" id="qnext">'+(R.i+1<R.items.length?'Next question →':'See the results')+'</button></div>';
      $('qnext').addEventListener('click',next);$('qnext').focus({preventScroll:true});
      var top=$('qfbw').getBoundingClientRect().top;if(top<0||top>window.innerHeight*0.6)window.scrollTo(0,window.scrollY+top-90);
    }
    function vdict(rr){
      var it=rr.it;if(!hasV(it))return '';
      return '<div class="vfb"><p class="vh">Your verdict: '+Math.round(rr.vs*it.parts.length)+' of '+it.parts.length+(it.parts.length>1?' points':'')+' right</p><ul>'+it.parts.map(function(p,k){
        var a=rr.vans[k],ok=a===p.ans;
        return '<li class="'+(ok?'vok':'vno')+'"><b>'+(ok?'✓':'✗')+' '+p.ask+'</b><br>'+(a===undefined?'No answer. ':(ok?'':'You said: '+p.opts[a]+'. '))+'Best: <b>'+p.opts[p.ans]+'</b>. '+p.why+'</li>';}).join('')+'</ul></div>';
    }
    function feedback(rr){
      var it=rr.it,pick=rr.pick,res=rr.res,timeout=rr.timeout,v=hasV(it);
      var vt=v?{right:'Right: essay and verdict.',half:'Partly right.',wrong:timeout?'Time is up.':(pick?'Not this time.':'Here is the answer.')}[res]:
        {right:'Right.',half:'Half marks: it would work, but it is not the best.',wrong:timeout?'Time is up.':(pick?'Not this one.':'Here is the answer.')}[res];
      var e=E[it.best],esr=rr.es===1?'✓':rr.es?'½':'✗';
      var h='<div class="fb '+res+'"><p class="verdict">'+vt+'</p><p class="best">'+(v?esr+' ':'')+'Best essay: '+line(it.best)+' <span class="fsrc">('+e.title+')</span></p><p>'+it.w+'</p>';
      var mine=null;it.t.forEach(function(t){if(t[0]===pick)mine=t;});
      if(pick&&pick!==it.best){
        if(mine)h+='<p class="yours"><b>'+(rr.es?'Why '+pick+' is not the best:':'Why not '+pick+':')+'</b> '+mine[1]+'</p>';
        else{var nt=null;(e.nots||[]).forEach(function(x){if(x[0]===pick)nt=x;});
          h+='<p class="yours"><b>You chose '+pick+'</b> ('+E[pick].idx+'). '+(nt?'The '+it.best+' card says to use '+pick+' when '+nt[1]+'.':'Compare the two cards: the words that give each away are different.')+'</p>';}
      }
      h+=vdict(rr);
      var others=it.t.filter(function(t){return t[0]!==pick;});
      if(others.length)h+='<details><summary>Other look-alikes ('+others.length+')</summary><ul>'+others.map(function(t){return '<li>'+badge(t[0])+' '+t[1]+'</li>';}).join('')+'</ul></details>';
      var kl=({past:'Past or practice paper',new:'New statement',hypo:'Hypo',g1:'Statement type',twist:'Reworded statement'})[it.kind];
      h+='<p class="fsrc">'+kl+(it.src&&it.src!==kl?': '+it.src:'')+' · <a href="#'+it.best.toLowerCase()+'">Open the '+it.best+' card →</a></p></div>';
      return h;
    }
    function next(){R.i++;if(R.i<R.items.length)showQ();else finish();}
    function finish(){
      clearInterval(tm);if(!R||R.over)return;R.over=true;
      var n=R.res.length,avg=n?Math.round(R.res.reduce(function(a,r){return a+r.secs;},0)/n):0,pct=n?Math.round(100*R.score/n):0;
      if(n>=Math.min(5,R.items.length)&&!R.redo){var c=rec.cp[cp.n]||{best:0,rounds:0};c.last=pct;c.best=Math.max(c.best||0,pct);c.of=n;c.rounds=(c.rounds||0)+1;rec.cp[cp.n]=c;save(QK,rec);paint();}
      var nx=cp.n<5?'<a class="btn" href="#e'+(cp.upto+1)+'">Go on to E'+(cp.upto+1)+' →</a>':'<a class="btn" href="#map">The finder map</a>';
      var h='<p class="sumh">Round over: '+fmtScore(R.score)+' out of '+n+(n?' ('+pct+'%)':'')+'</p>'+
        (n?'<p style="margin:4px 0 0">Essay found: <b>'+fmtScore(R.ess)+' of '+n+'</b>'+(R.vn?' · Verdicts: <b>'+fmtScore(R.ver)+' of '+R.vn+'</b>':'')+'</p>':'')+
        '<p style="margin:4px 0 0;color:var(--soft)">'+(n?'Average '+avg+' seconds a question. In the exam, aim to have the essay and your answer inside a minute or two.':'No questions answered.')+'</p>'+
        '<div class="startrow"><button type="button" class="btn main" id="qagain">Another round</button><button type="button" class="btn" id="qredo">Redo the ones I missed</button><button type="button" class="btn" id="qback">Settings and record</button>'+nx+'</div>'+
        '<ul class="sumlist">'+R.res.map(function(r,i){var it=r.it;
          var cls={right:'r',half:'h',wrong:'w'}[r.res],mk={right:'✓',half:'½',wrong:'✗'}[r.res];
          var vv=r.vs===null?'':' · verdict '+Math.round(r.vs*it.parts.length)+'/'+it.parts.length;
          return '<li><p class="sq">'+(i+1)+'. '+it.q+'</p><p class="sv"><span class="'+cls+'">'+mk+'</span> Best '+line(it.best)+(r.pick&&r.pick!==it.best?' · you chose '+badge(r.pick):(r.pick?'':' · '+(r.timeout?'time ran out':'skipped')))+vv+'</p>'+
            (r.res==='right'?'':'<details><summary>Why</summary>'+feedback(r)+'</details>')+'</li>';}).join('')+'</ul>';
      $('qsum').innerHTML=h;$('qplay').classList.add('hidden');$('qsum').classList.remove('hidden');
      $('qagain').addEventListener('click',function(){start();});
      $('qredo').addEventListener('click',function(){var miss=R.res.filter(function(r){return r.res!=='right';}).map(function(r){return r.it;});
        if(!miss.length){alert('Nothing missed in this round.');return;}start(shuffle(miss),true);});
      $('qback').addEventListener('click',function(){$('qsum').classList.add('hidden');$('qsetup').classList.remove('hidden');$('qstats').classList.remove('hidden');drawSetup();window.scrollTo(0,0);});
      var top=box.getBoundingClientRect().top;window.scrollTo(0,Math.max(0,window.scrollY+top-12));
    }
    function key(e){
      if(!R||!box||R.cp!==cp.n||R.over||$('qplay').classList.contains('hidden'))return false;
      var inInput=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if(e.key==='Escape'&&(!inInput||e.target.id==='qtyper')){finish();return true;}
      if(inInput||e.defaultPrevented)return true;
      if(e.key==='Enter'&&R.done&&$('qnext')){if(document.activeElement!==$('qnext')){e.preventDefault();next();}return true;}
      if(!R.done&&R.stage==='verdict'&&/^[1-4]$/.test(e.key)){var it=R.items[R.i];
        for(var i=0;i<it.parts.length;i++)if(R.vans[i]===undefined){if(+e.key<=it.parts[i].opts.length)pickV(i,+e.key-1);break;}return true;}
      if(R.ans==='four'&&!R.done&&R.stage==='essay'&&/^[1-4]$/.test(e.key)&&R.cur){answer(R.cur[+e.key-1]);return true;}
      if(e.key==='ArrowLeft'||e.key==='ArrowRight')return true;
      return false;
    }
    return {open:open,close:close,key:key};
  })();

