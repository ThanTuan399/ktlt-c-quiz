import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createQuizService, QuizError} from '../backend/src/quiz-service.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bankPath=path.join(root,'backend/data/questions.json');
function service() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codequiz-'));
  return createQuizService({bankPath,statePath:path.join(dir,'state.json')});
}
test('Ngân hàng 233 câu và phân bổ đúng chương',()=>{
  const m=service().meta();
  assert.equal(m.bankTotal,233);
  assert.deepEqual([1,2,3,4].map(c=>m.chapters[c].total),[42,62,61,68]);
});
test('Đề có 40 câu duy nhất, đúng 10 câu/chương',()=>{
  const v=service().createExam();
  assert.equal(v.questions.length,40);
  assert.equal(new Set(v.questions.map(q=>q.id)).size,40);
  for(let c=1;c<=4;c++)assert.equal(v.questions.filter(q=>q.chapter===c).length,10);
});
test('Đáp án đúng không bị tiết lộ trước khi chọn',()=>{
  const v=service().createExam();
  assert.equal(v.questions[0].feedback,undefined);
  assert.equal(v.questions[0].choices.length,4);
});
test('Chấm bài, khóa câu đã chọn và lưu tiến độ',()=>{
  const q=service(),v=q.createExam(),item=v.questions[0];
  const a=q.answer(v.code,{questionId:item.id,selectedIndex:0});
  assert.equal(typeof a.isCorrect,'boolean');
  assert.equal(q.get(v.code).answered,1);
  assert.equal(q.answer(v.code,{questionId:item.id,selectedIndex:1}).selectedIndex,0);
});
test('Hoàn thành đề và không cho sửa đáp án',()=>{
  const q=service(),v=q.createExam(),item=v.questions[0];
  q.finish(v.code);
  assert.throws(()=>q.answer(v.code,{questionId:item.id,selectedIndex:0}),QuizError);
});
test('Không lặp câu trước khi hết vòng chương khi đủ số lượng',()=>{
  const q=service(),sets=[q.createExam(),q.createExam(),q.createExam(),q.createExam()];
  const c1=sets.flatMap(e=>e.questions.filter(x=>x.chapter===1).map(x=>x.id));
  assert.equal(new Set(c1).size,40);
});
