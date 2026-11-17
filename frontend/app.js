const $ = id => document.getElementById(id);
let exam = null, pos = 0;
const hidden = (id, yes) => $(id).classList.toggle('hidden', yes);
const escapeHTML = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url, options={}) {
  const response = await fetch(url, {headers:{'Content-Type':'application/json'},...options});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Có lỗi kết nối máy chủ');
  return data;
}
function onError(error) { alert(error.message); }
async function loadHome() {
  try {
    const [meta, history] = await Promise.all([api('/api/meta'),api('/api/history')]);
    $('stats').innerHTML=[1,2,3,4].map(c=>'<div class="stat"><strong>'+meta.chapters[c].total+'</strong><span>Chương '+c+'</span></div>').join('');
    $('history').innerHTML=history.length?'<strong>Đề gần đây</strong><div>'+history.map(e=>
      '<button data-code="'+escapeHTML(e.code)+'">'+escapeHTML(e.code)+' · '+e.correct+'/'+e.total+'</button>').join('')+'</div>':'';
    $('history').querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>openExam(b.dataset.code).catch(onError)));
  } catch(e) {onError(e);}
}
function showHome() {hidden('home',false);hidden('exam',true);hidden('result',true);loadHome();}
function showExam() {hidden('home',true);hidden('exam',false);hidden('result',true);render();}
async function openExam(code) {exam=await api('/api/exams/'+encodeURIComponent(code));pos=0;showExam();}
async function createExam() {
  $('create').disabled=true;
  try {exam=await api('/api/exams',{method:'POST'});pos=0;showExam();}
  catch(e){onError(e);}finally{$('create').disabled=false;}
}
function render() {
  if (!exam) return;
  if(exam.finishedAt){showResult();return;}
  const q=exam.questions[pos],fb=q.feedback;
  $('code').textContent=exam.code;
  $('bar').style.width=(exam.answered/40*100)+'%';
  $('number').textContent='Câu '+(pos+1)+' / 40 · Chương '+q.chapter;
  $('score').textContent='Đã làm '+exam.answered+'/40 · Đúng '+exam.correct;
  $('topic').textContent=(q.topic||'Chương '+q.chapter)+' · '+(q.level||'');
  $('prompt').textContent=q.prompt;
  $('choices').innerHTML='';
  q.choices.forEach((answer,i)=>{
    const btn=document.createElement('button');
    btn.className='choice'+(fb?(i===fb.correctIndex?' correct':i===fb.selectedIndex?' wrong':''):'');
    const letter=document.createElement('b');letter.textContent='ABCD'[i];
    const span=document.createElement('span');span.textContent=answer;
    btn.append(letter,span);btn.disabled=!!fb;
    btn.onclick=()=>select(q.id,i);
    $('choices').append(btn);
  });
  hidden('feedback',!fb);
  if(fb){
    $('feedback').className='feedback '+(fb.isCorrect?'good':'bad');
    $('feedback').innerHTML='<strong>'+(fb.isCorrect?'✓ Chính xác!':'✗ Chưa đúng. Đáp án: '+ 'ABCD'[fb.correctIndex])+'</strong>'+
      '<div>'+escapeHTML(fb.explanation||'')+'</div>';
  }
  $('prev').disabled=pos===0;
  $('next').textContent=pos===39?'Xem kết quả →':'Câu tiếp →';
}
async function select(id,index) {
  try {
    await api('/api/exams/'+encodeURIComponent(exam.code)+'/answers',{method:'POST',body:JSON.stringify({questionId:id,selectedIndex:index})});
    exam=await api('/api/exams/'+encodeURIComponent(exam.code));
    render();
  } catch(e) {onError(e);}
}
async function finish() {
  if(!exam)return;
  if(exam.answered<40&&!confirm('Bạn mới làm '+exam.answered+'/40 câu. Vẫn kết thúc đề?'))return;
  try {exam=await api('/api/exams/'+encodeURIComponent(exam.code)+'/finish',{method:'POST'});showResult();}
  catch(e){onError(e);}
}
function showResult() {
  hidden('home',true);hidden('exam',true);hidden('result',false);
  $('resultTitle').textContent=exam.correct+' / 40 câu đúng';
  const byChapter=[1,2,3,4].map(c=>{const qs=exam.questions.filter(q=>q.chapter===c);return 'Chương '+c+': '+qs.filter(q=>q.feedback?.isCorrect).length+'/10';});
  $('summary').innerHTML='<p>Đã trả lời: '+exam.answered+'/40</p><p>'+byChapter.join(' · ')+'</p><p>Mã đề: '+escapeHTML(exam.code)+'</p>';
}
$('create').onclick=createExam;
$('newExam').onclick=createExam;
$('back').onclick=showHome;
$('prev').onclick=()=>{pos=Math.max(pos-1,0);render();};
$('next').onclick=()=>{if(pos===39)finish();else{pos++;render();}};
$('finish').onclick=finish;
$('resume').onclick=()=>openExam($('examCode').value.trim()).catch(onError);
$('review').onclick=async()=>{const copy=exam.code;const v=await api('/api/exams/'+copy);exam={...v,finishedAt:null};pos=0;showExam();exam.finishedAt=v.finishedAt;document.querySelectorAll('.choice').forEach(x=>x.disabled=true);$('finish').disabled=true;};
loadHome();
