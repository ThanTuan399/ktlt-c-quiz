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
test('Ngân hàng chỉ gồm A/B đã đối chiếu slide',()=>{
  const m=service().meta();
  assert.equal(m.bankTotal,220);
  assert.equal(m.sourcePolicy,'slide-A-B-only');
  assert.deepEqual([1,2,3,4].map(c=>m.chapters[c].total),[42,61,58,59]);
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

test('Mọi câu có chứng cứ slide; không còn câu C hoặc câu ngoài giáo trình',()=>{
  const bank = JSON.parse(fs.readFileSync(bankPath,'utf8'));
  const ban = new Set(["C2-052","C3-012","C3-023","C3-026","C4-023","C4-024","C4-025","C4-041","C4-044","C4-046","C4-049","C4-050","C4-064"]);
  assert.equal(bank.length,220);
  for(const q of bank) {
    assert.ok(['A','B'].includes(q.source?.category),q.id);
    assert.ok(q.source.references.length>0,q.id);
    for(const ref of q.source.references) {
      assert.ok([1,2,3,4].includes(ref.chapter) && ref.slide>0,q.id);
    }
    assert.equal(ban.has(q.id),false,q.id);
  }
});
test('Phản hồi bài thi chứa nguồn, nhưng vẫn ẩn đáp án khi chưa làm',()=>{
  const q=service(), exam=q.createExam();
  const item=exam.questions[0];
  assert.ok(item.source.references.length>0);
  assert.equal(item.feedback,undefined);
  q.answer(exam.code,{questionId:item.id,selectedIndex:2});
  assert.ok(q.get(exam.code).questions[0].feedback);
});
test('Trạng thái cũ bị làm mới khi đổi ngân hàng đã kiểm duyệt',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codequiz-old-'));
  const statePath=path.join(dir,'state.json');
  fs.writeFileSync(statePath,JSON.stringify({serial:5,pools:{1:{remaining:['C4-050'],cycle:1}},exams:{}}));
  const q=createQuizService({bankPath,statePath});
  const exam=q.createExam();
  assert.equal(exam.questions.length,40);
  assert.equal(q.meta().generatedExams,6);
});
