import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {BankRepository} from '../backend/src/bank/repository.js';
import {parseDocument,validateQuestions} from '../backend/src/bank/validation.js';
import {toCSV,parseCSV} from '../backend/src/bank/csv.js';
import {QuizService} from '../backend/src/quiz/service.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seedPath=path.join(root,'backend/data/questions.json');
const sample=(id='NEW-001',chapter=1)=>({id,chapter,topic:'Chương '+chapter,level:'Nhớ',
  question:'Câu hỏi tối thiểu hợp lệ?',options:['Đáp án A','Đáp án B','Đáp án C','Đáp án D'],
  correctAnswer:'B',explanation:'Đây là phần giải thích của đáp án đúng.',category:'A',sourceRefs:`${chapter}:10`});
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codequiz-v2-'));
  const bank=new BankRepository({seedPath,storagePath:path.join(dir,'active-bank.json')});
  const quiz=new QuizService({bankRepository:bank,statePath:path.join(dir,'state.json')});return {dir,bank,quiz};}
const input=(items,mode='replace')=>({format:'json',content:JSON.stringify({schemaVersion:1,name:'Đề tự nạp',questions:items}),mode});

test('Ngân hàng seed có 220 câu A/B và nguồn slide',()=>{
  const {bank}=setup(),m=bank.meta();assert.equal(m.total,220);
  assert.deepEqual(m.chapters.map(c=>c.count),[42,61,58,59]);
  assert.equal(m.categories.A+m.categories.B,220);
});
test('Tệp JSON dạng mảng cũ và document schema v1 đều đọc được',()=>{
  assert.equal(parseDocument({format:'json',content:JSON.stringify([sample()])}).questions.length,1);
  assert.equal(parseDocument({format:'json',content:JSON.stringify({schemaVersion:1,name:'X',questions:[sample()]})}).name,'X');
});
test('CSV có BOM, dấu phẩy, dấu nháy kép và xuống dòng trong ô',()=>{
  const question={id:'CSV-1',chapter:2,topic:'X',level:'Nhớ',q:'Câu hỏi về "chuỗi", với dấu phẩy?',
    opts:['Đáp án dòng 1\ndòng 2','B','C','D'],a:1,why:'Nội dung "giải thích", có dấu phẩy.',source:{category:'B',references:[{chapter:2,slide:5}]}};
  const parsed=parseCSV(toCSV([question]));
  assert.equal(parsed[0].question,question.q);
  assert.equal(parsed[0].optionA,question.opts[0]);
  const output=validateQuestions(parsed);assert.equal(output.errors.length,0);assert.equal(output.questions[0].a,1);
});
test('Bắt buộc đủ đáp án, lời giải, A/B, nguồn slide và ID duy nhất',()=>{
  const invalid={...sample('A'),options:['x','x','','d'],correctAnswer:'E',sourceRefs:''};
  const out=validateQuestions([invalid,sample('B'),sample('B'),{...sample('C'),category:'C'}]);
  assert.ok(out.errors.some(e=>e.field==='options'));
  assert.ok(out.errors.some(e=>e.field==='correctAnswer'));
  assert.ok(out.errors.some(e=>e.field==='sourceRefs'));
  assert.ok(out.errors.some(e=>e.field==='id'));
  assert.ok(out.errors.some(e=>e.field==='category'));
});
test('Preview thay thế không làm thay đổi ngân hàng, import mới lưu',()=>{
  const {bank}=setup(),args=input([sample('NEW-1',3)]);
  const preview=bank.preview(args);assert.equal(preview.canApply,true);assert.equal(preview.resultCount,1);
  assert.equal(bank.meta().total,220);
  const imported=bank.import({...args,expectedRevision:preview.revision});
  assert.equal(imported.imported,true);assert.equal(bank.meta().total,1);
  assert.equal(bank.get().questions[0].chapter,3);
});
test('Append trùng ID bị từ chối, upsert cập nhật và thêm mới',()=>{
  const {bank}=setup();const rev=bank.meta().revision;
  let collision=bank.preview(input([sample('C1-001')],'append'));
  assert.equal(collision.canApply,false);assert.equal(bank.meta().revision,rev);
  const payload=input([{...sample('C1-001'),question:'Câu hỏi cập nhật có thật không?'},sample('NEW-2',6)],'upsert');
  const p=bank.preview(payload);assert.equal(p.canApply,true);assert.equal(p.update,1);assert.equal(p.add,1);
  bank.import({...payload,expectedRevision:p.revision});assert.equal(bank.meta().total,221);
  assert.equal(bank.get().questions.find(q=>q.id==='C1-001').q,'Câu hỏi cập nhật có thật không?');
});
test('Giao dịch lỗi không làm thay đổi dữ liệu lưu',()=>{
  const {bank,dir}=setup(),current=bank.meta().revision;
  const payload=input([{...sample(),category:'C'}]);
  assert.equal(bank.preview(payload).canApply,false);
  assert.throws(()=>bank.import({...payload,expectedRevision:current}));
  assert.equal(bank.meta().revision,current);
  assert.equal(fs.existsSync(path.join(dir,'active-bank.json')),false);
});
test('Revision tránh ghi đè khi bản preview đã cũ',()=>{
  const {bank}=setup(),old=bank.meta().revision;
  let a=input([sample('A')]);bank.import({...a,expectedRevision:old});
  assert.throws(()=>bank.import({...input([sample('B')]),expectedRevision:old}),e=>e.status===409);
});
test('Tạo đề 40 câu từ ngân hàng A/B hiện hành, không lộ đáp án',()=>{
  const {quiz}=setup(),exam=quiz.createExam({chapters:[1,2,3,4],perChapter:10});
  assert.equal(exam.total,40);assert.equal(new Set(exam.questions.map(q=>q.id)).size,40);
  for(const c of [1,2,3,4])assert.equal(exam.questions.filter(q=>q.chapter===c).length,10);
  assert.ok(exam.questions.every(q=>q.feedback===undefined&&q.source.references.length>0));
});
test('Không lặp câu chương 1 qua 4 đề đầu tiên',()=>{
  const {quiz}=setup(),ids=[];
  for(let n=0;n<4;n++)ids.push(...quiz.createExam({chapters:[1],perChapter:10}).questions.map(q=>q.id));
  assert.equal(ids.length,40);assert.equal(new Set(ids).size,40);
});
test('Thay ngân hàng làm mới đề cũ và lấy cấu hình chương động',()=>{
  const {quiz,bank}=setup(),before=quiz.createExam();
  const questions=Array.from({length:12},(_,i)=>sample('NEW-'+i,6));
  const args=input(questions),p=bank.preview(args);bank.import({...args,expectedRevision:p.revision});quiz.reload();
  assert.throws(()=>quiz.get(before.code),e=>e.status===404);
  const exam=quiz.createExam({chapters:[6],perChapter:10});
  assert.equal(exam.total,10);assert.ok(exam.questions.every(q=>q.chapter===6));
  assert.throws(()=>quiz.createExam({chapters:[1],perChapter:10}));
});
test('Đáp án được khóa sau khi bấm; kết thúc không sửa được',()=>{
  const {quiz}=setup(),exam=quiz.createExam({chapters:[2],perChapter:3}),q=exam.questions[0];
  const a=quiz.answer(exam.code,{questionId:q.id,selectedIndex:2});
  assert.equal(typeof a.isCorrect,'boolean');
  assert.equal(quiz.answer(exam.code,{questionId:q.id,selectedIndex:0}).selectedIndex,2);
  quiz.finish(exam.code);
  assert.throws(()=>quiz.answer(exam.code,{questionId:q.id,selectedIndex:0}),e=>e.status===409);
});
