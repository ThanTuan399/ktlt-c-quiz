const $=id=>document.getElementById(id);
const hide=(id,yes)=>$(id).classList.toggle('hidden',yes);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let exam=null,position=0,reviewing=false,meta=null,upload=null,checked=null,importBusy=false;
async function api(url,options={}) {
  const response=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  let payload;try{payload=await response.json();}catch{throw Error('Máy chủ trả về dữ liệu không hợp lệ.');}
  if(!response.ok)throw Error(payload.error||'Yêu cầu thất bại.');
  return payload;
}
const post=(url,body)=>api(url,{method:'POST',body:JSON.stringify(body)});
function show(id){for(const name of ['home','bankPanel','exam','result'])hide(name,name!==id);
  $('navHome').classList.toggle('active',id!=='bankPanel');$('navBank').classList.toggle('active',id==='bankPanel');}
function message(text,type='info'){$('importFeedback').className='import-feedback'+(type==='error'?' bad':type==='success'?' good':'');$('importFeedback').textContent=text;}
function fail(err){alert(err.message);}
function settingUpdate(){const count=document.querySelectorAll('#chapterPicker input:checked').length;
  const per=Number($('perChapter').value)||0;$('examEstimate').textContent=(count*per)+' câu / '+count+' chương';}
async function loadMeta(){
  meta=await api('/api/meta');const bank=meta.bank;
  $('totalCount').textContent=bank.total;$('chapterCount').textContent=bank.chapters.length;$('examCount').textContent=meta.generatedExams;
  $('bankName').textContent=bank.name;$('bankRevision').textContent='Phiên bản dữ liệu: '+bank.revision.slice(0,16)+'…';
  $('bankCounts').innerHTML=[`<span class="pill">${bank.total} câu</span>`,`<span class="pill">Loại A: ${bank.categories.A}</span>`,
    `<span class="pill">Loại B: ${bank.categories.B}</span>`,...bank.chapters.map(c=>`<span class="pill">Chương ${c.chapter}: ${c.count}</span>`)].join('');
  $('chapterPicker').innerHTML=bank.chapters.map((c,i)=>`<label class="chapter"><input type="checkbox" value="${c.chapter}" ${i<4?'checked':''}>
    <span><b>Chương ${c.chapter}</b><small>${c.count} câu</small></span></label>`).join('');
  document.querySelectorAll('#chapterPicker input').forEach(c=>c.addEventListener('change',settingUpdate));settingUpdate();
  const history=await api('/api/history');
  $('recentHistory').innerHTML=history.length?history.map(h=>`<button data-code="${escapeHTML(h.code)}">${escapeHTML(h.code)} · ${h.correct}/${h.total}</button>`).join(''):'<span class="muted">Chưa có mã đề nào.</span>';
  $('recentHistory').querySelectorAll('button').forEach(btn=>btn.onclick=()=>openExam(btn.dataset.code).catch(fail));
}
async function home(){show('home');try{await loadMeta();}catch(e){fail(e);}}
async function bankPage(){show('bankPanel');try{await loadMeta();}catch(e){fail(e);}}
function showExam(){show('exam');render();}
async function openExam(code){exam=await api('/api/exams/'+encodeURIComponent(code));position=0;reviewing=!!exam.finishedAt;
  if(reviewing)showResult();else showExam();}
async function createExam(){
  const chapters=[...document.querySelectorAll('#chapterPicker input:checked')].map(c=>Number(c.value));
  const perChapter=Number($('perChapter').value);
  $('createExam').disabled=true;
  try{exam=await post('/api/exams',{chapters,perChapter});position=0;reviewing=false;showExam();}
  catch(err){fail(err);}finally{$('createExam').disabled=false;}
}
function render(){
  if(!exam)return;const q=exam.questions[position],fb=q.feedback;
  $('examLabel').textContent=exam.code;
  $('progressValue').style.width=100*exam.answered/exam.total+'%';
  $('questionNumber').textContent=`Câu ${position+1}/${exam.total} · Chương ${q.chapter}`;
  $('quizScore').textContent=`Đã trả lời ${exam.answered} · Đúng ${exam.correct}`;
  $('questionTopic').textContent=(q.topic||'Chương '+q.chapter)+' · Loại '+q.source.category+' · '+(q.level||'');
  $('questionText').textContent=q.prompt;$('answerOptions').innerHTML='';
  q.choices.forEach((choice,index)=>{
    const btn=document.createElement('button');btn.className='answer';
    if(fb)btn.classList.add(index===fb.correctIndex?'right':index===fb.selectedIndex?'wrong':'');
    const symbol=document.createElement('b');symbol.textContent='ABCD'[index];
    const label=document.createElement('span');label.textContent=choice;btn.append(symbol,label);
    btn.disabled=!!fb||reviewing;btn.onclick=()=>answer(q.id,index);$('answerOptions').append(btn);
  });
  hide('answerFeedback',!fb);
  if(fb){$('answerFeedback').className='answer-feedback '+(fb.isCorrect?'good':'bad');
    const refs=q.source.references.map(r=>'Chương '+r.chapter+', slide '+r.slide).join(' · ');
    $('answerFeedback').innerHTML='<strong>'+(fb.isCorrect?'✓ Chính xác!':'✗ Chưa đúng – Đáp án: '+ 'ABCD'[fb.correctIndex])+'</strong>'+
      '<div>'+escapeHTML(fb.explanation)+'</div><div class="source-line">Căn cứ bài giảng: '+escapeHTML(refs)+'</div>';
  }
  $('previousQuestion').disabled=position===0;
  $('nextQuestion').textContent=position===exam.total-1?(reviewing?'Về kết quả →':'Hoàn thành →'):'Câu tiếp →';
  hide('endExam',reviewing);
}
async function answer(id,index){
  try{await post('/api/exams/'+encodeURIComponent(exam.code)+'/answers',{questionId:id,selectedIndex:index});
    exam=await api('/api/exams/'+encodeURIComponent(exam.code));render();}
  catch(err){fail(err);}
}
async function finish(){
  if(reviewing)return showResult();
  if(exam.answered<exam.total&&!confirm(`Bạn mới làm ${exam.answered}/${exam.total} câu. Kết thúc đề ngay?`))return;
  try{exam=await post('/api/exams/'+encodeURIComponent(exam.code)+'/finish',{});reviewing=false;showResult();}
  catch(e){fail(e);}
}
function showResult(){show('result');$('resultHeader').textContent=`${exam.correct} / ${exam.total} câu đúng`;
  $('resultContent').innerHTML=`<p>Đã trả lời: ${exam.answered}/${exam.total}</p>`+
    exam.settings.chapters.map(c=>{
      const qs=exam.questions.filter(q=>q.chapter===c);
      return '<p>Chương '+c+': '+qs.filter(q=>q.feedback?.isCorrect).length+'/'+qs.length+' đúng</p>';
    }).join('')+'<p>Mã đề: '+escapeHTML(exam.code)+'</p>';
}
function clearPreview(){checked=null;$('applyImport').disabled=true;hide('importPreview',true);hide('importFeedback',true);}
async function previewImport(){
  const file=$('bankFile').files?.[0];clearPreview();
  if(!file)return message('Bạn cần chọn một tệp JSON hoặc CSV trước.','error');
  const name=file.name.toLowerCase(),format=name.endsWith('.json')?'json':name.endsWith('.csv')?'csv':null;
  if(!format)return message('Chỉ chấp nhận tệp .json hoặc .csv.','error');
  if(file.size>5*1024*1024)return message('Tệp quá lớn, giới hạn 5 MB.','error');
  $('previewImport').disabled=true;
  try{
    upload={format,content:await file.text(),mode:$('importMode').value};
    const report=await post('/api/bank/preview',upload);
    checked=report.canApply?{...upload,expectedRevision:report.revision}:null;
    $('previewStats').innerHTML=[`Hợp lệ: ${report.validCount}/${report.inputCount}`,`Thêm: ${report.add}`,`Cập nhật: ${report.update}`,
      `Bỏ khi thay thế: ${report.remove}`,`Tổng sau nạp: ${report.resultCount}`].map(v=>'<span class="pill">'+escapeHTML(v)+'</span>').join('');
    $('previewNote').textContent=report.note||'';
    $('previewErrors').innerHTML=report.errors.map(e=>'<div>Dòng '+e.row+' · '+escapeHTML(e.field)+': '+escapeHTML(e.message)+'</div>').join('');
    hide('importPreview',false);$('applyImport').disabled=!report.canApply;
    message(report.canApply?'Kiểm định thành công. Xem thống kê rồi nhấn xác nhận để áp dụng.':
      `Phát hiện ${report.errorCount} lỗi. Chỉnh dữ liệu trước khi nạp.`,report.canApply?'success':'error');
  }catch(err){message(err.message,'error');}
  finally{$('previewImport').disabled=false;}
}
async function applyImport(){
  if(!checked||importBusy)return;
  if(checked.mode==='replace'&&!confirm('Thay thế toàn bộ ngân hàng đang dùng? Các đề và tiến độ cũ sẽ được đặt lại.'))return;
  if(checked.mode!=='replace'&&!confirm('Áp dụng thay đổi vào ngân hàng? Các mã đề cũ sẽ được đặt lại.'))return;
  importBusy=true;$('applyImport').disabled=true;
  try{const report=await post('/api/bank/import',checked);
    message(`Nạp thành công! Ngân hàng hiện có ${report.resultCount} câu. Bạn có thể tạo đề ngay.`, 'success');
    checked=null;hide('importPreview',true);await loadMeta();
  }catch(err){message(err.message,'error');}
  finally{importBusy=false;}
}
$('navHome').onclick=home;$('navBank').onclick=bankPage;
$('createExam').onclick=createExam;$('resumeExam').onclick=()=>openExam($('examCode').value.trim()).catch(fail);
$('examBack').onclick=()=>reviewing?showResult():home();
$('previousQuestion').onclick=()=>{position=Math.max(0,position-1);render();};
$('nextQuestion').onclick=()=>{if(position===exam.total-1){if(reviewing)showResult();else finish();}else{position++;render();}};
$('endExam').onclick=finish;
$('resultReview').onclick=()=>{reviewing=true;position=0;showExam();};
$('resultNewExam').onclick=home;
$('bankFile').onchange=()=>{$('fileName').textContent=$('bankFile').files?.[0]?.name||'Chọn tệp .json hoặc .csv';clearPreview();};
$('importMode').onchange=clearPreview;$('previewImport').onclick=previewImport;$('applyImport').onclick=applyImport;
$('perChapter').onchange=settingUpdate;
home();
