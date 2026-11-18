import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codequiz-api-'));
process.env.NODE_ENV='test';
process.env.ACTIVE_BANK_PATH=path.join(dir,'active-bank.json');
process.env.STATE_PATH=path.join(dir,'state.json');
const {server}=await import('../backend/src/server.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
async function call(url,method='GET',data=undefined){const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  return {status:res.status,payload:await res.json()};}
test('API: meta, preview, import, export, tạo đề từ CSV mới',async()=>{
  try{
    const before=await call('/api/meta');assert.equal(before.status,200);assert.equal(before.payload.bank.total,220);
    const input='id,chapter,topic,level,question,optionA,optionB,optionC,optionD,correctAnswer,explanation,category,sourceRefs\n'+
      Array.from({length:12},(_,i)=>`Z-${i+1},7,Nhập liệu,Nhớ,Câu hỏi số ${i+1} là gì?,Một,Hai,Ba,Bốn,B,Giải thích từ slide số 9,A,7:9`).join('\n');
    const p=await call('/api/bank/preview','POST',{format:'csv',content:input,mode:'replace'});
    assert.equal(p.status,200);assert.equal(p.payload.canApply,true);
    const updated=await call('/api/bank/import','POST',{format:'csv',content:input,mode:'replace',expectedRevision:p.payload.revision});
    assert.equal(updated.status,200);assert.equal(updated.payload.bank.total,12);
    const exam=await call('/api/exams','POST',{chapters:[7],perChapter:10});
    assert.equal(exam.status,201);assert.equal(exam.payload.questions.length,10);
    assert.ok(exam.payload.questions.every(q=>q.source.references[0].chapter===7));
    const item=exam.payload.questions[0];assert.equal(item.feedback,undefined);
    const ans=await call(`/api/exams/${exam.payload.code}/answers`,'POST',{questionId:item.id,selectedIndex:0});
    assert.equal(ans.status,200);assert.equal(typeof ans.payload.isCorrect,'boolean');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
