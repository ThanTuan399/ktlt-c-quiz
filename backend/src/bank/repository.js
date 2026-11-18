import fs from 'node:fs';
import {AppError,atomicJSON,hash} from '../shared/util.js';
import {parseDocument,validateQuestions} from './validation.js';

export class BankRepository {
  constructor({seedPath,storagePath}) {
    this.storagePath=storagePath;
    const src=fs.existsSync(storagePath)?storagePath:seedPath;
    const stored=JSON.parse(fs.readFileSync(src,'utf8'));
    const doc=Array.isArray(stored)?{name:'Kỹ thuật lập trình C – ngân hàng A/B',questions:stored}:stored;
    const {questions,errors}=validateQuestions(doc.questions);
    if(errors.length)throw new Error('Ngân hàng đang lưu có câu không hợp lệ: '+JSON.stringify(errors.slice(0,3)));
    this.snapshot={name:doc.name||'Ngân hàng câu hỏi',questions,revision:hash(questions)};
  }
  get() {return this.snapshot;}
  meta() {
    const {name,questions,revision}=this.snapshot;
    const chapters=[...new Set(questions.map(q=>q.chapter))].sort((a,b)=>a-b).map(c=>({
      chapter:c,count:questions.filter(q=>q.chapter===c).length,
      eligibleFor10:questions.filter(q=>q.chapter===c).length>=10
    }));
    return {name,revision,total:questions.length,chapters,
      categories:{A:questions.filter(q=>q.source.category==='A').length,
        B:questions.filter(q=>q.source.category==='B').length},
      schemaVersion:1,policy:'A/B with slide references'};
  }
  export() {const {name,questions}=this.snapshot;return {schemaVersion:1,name,questions};}
  plan({format,content,mode='replace'}) {
    if(!['replace','append','upsert'].includes(mode))throw new AppError('Chế độ nhập không hợp lệ.');
    const doc=parseDocument({format,content});
    const {questions,errors}=validateQuestions(doc.questions);
    const current=this.snapshot.questions;
    const oldIds=new Set(current.map(q=>q.id));
    const conflicting=mode==='append'?questions.filter(q=>oldIds.has(q.id)).map(q=>q.id):[];
    for(const id of conflicting)errors.push({row:0,field:'id',message:`ID ${id} đã tồn tại; dùng chế độ cập nhật (upsert) hoặc thay thế.`});
    const newIds=new Set(questions.map(q=>q.id));
    const updates=questions.filter(q=>oldIds.has(q.id)).length;
    const adds=questions.length-updates;
    const removed=mode==='replace'?current.filter(q=>!newIds.has(q.id)).length:0;
    const result=mode==='replace'?questions:
      mode==='append'?[...current,...questions]:[
        ...current.filter(q=>!newIds.has(q.id)),...questions
      ];
    const byChapter=[...new Set(result.map(q=>q.chapter))].sort((a,b)=>a-b).map(chapter=>({chapter,count:result.filter(q=>q.chapter===chapter).length}));
    return {name:mode==='replace'?doc.name:this.snapshot.name,mode,
      candidate:result,revision:this.snapshot.revision,
      report:{canApply:errors.length===0,mode,inputCount:doc.questions.length,validCount:questions.length,
        add:mode==='replace'?questions.length:adds,update:mode==='upsert'?updates:0,
        remove:removed,resultCount:result.length,chapters:byChapter,
        errorCount:errors.length,errors:errors.slice(0,60),revision:this.snapshot.revision,
        note:byChapter.length===0?'Chưa có câu hỏi.':byChapter.some(c=>c.count<10)?
          'Một số chương dưới 10 câu. Chỉ tạo đề khi chọn số câu/chương phù hợp.':''}};
  }
  preview(input) {return this.plan(input).report;}
  import(input) {
    const {expectedRevision,...rest}=input;
    if(!expectedRevision||expectedRevision!==this.snapshot.revision)throw new AppError('Ngân hàng đã thay đổi. Vui lòng kiểm tra lại bản xem trước.',409);
    const plan=this.plan(rest);
    if(!plan.report.canApply)throw new AppError('Dữ liệu chưa đạt kiểm tra, chưa có thay đổi nào được lưu.',422,plan.report.errors);
    if(!plan.candidate.length)throw new AppError('Ngân hàng mới không được để trống.');
    const doc={schemaVersion:1,name:plan.name,questions:plan.candidate};
    atomicJSON(this.storagePath,doc);
    this.snapshot={name:doc.name,questions:doc.questions,revision:hash(doc.questions)};
    return {...plan.report,revision:this.snapshot.revision,imported:true};
  }
}
