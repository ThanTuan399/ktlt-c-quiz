import fs from 'node:fs';
import crypto from 'node:crypto';
import {AppError,atomicJSON,shuffle} from '../shared/util.js';

export class QuizService {
  constructor({bankRepository,statePath}) {
    this.bankRepository=bankRepository; this.statePath=statePath;
    this.reload();
  }
  fresh(serial=0) {return {version:2,bankRevision:this.bankRevision,serial,pools:{},exams:{}};}
  reload() {
    const bank=this.bankRepository.get();
    this.bankRevision=bank.revision;
    this.byId=new Map(bank.questions.map(q=>[q.id,q]));
    this.groups=new Map();
    for(const q of bank.questions){if(!this.groups.has(q.chapter))this.groups.set(q.chapter,[]);this.groups.get(q.chapter).push(q.id);}
    let old;
    try {old=JSON.parse(fs.readFileSync(this.statePath,'utf8'));} catch(e){if(e.code!=='ENOENT')throw e;}
    this.state=old?.version===2&&old.bankRevision===this.bankRevision?old:this.fresh(old?.serial??0);
  }
  commit(next) {atomicJSON(this.statePath,next);this.state=next;}
  meta() {return {bank:this.bankRepository.meta(),generatedExams:this.state.serial,
    chapterCycles:Object.fromEntries([...this.groups.keys()].map(c=>[c,{
      cycle:this.state.pools[c]?.cycle??1,
      remaining:this.state.pools[c]?.remaining.length??this.groups.get(c).length
    }]))};}
  getParams(options={}) {
    const available=[...this.groups.keys()].sort((a,b)=>a-b);
    const defaultChapters=available.slice(0,Math.min(available.length,4));
    const chapters=options.chapters===undefined?defaultChapters:options.chapters;
    const perChapter=options.perChapter===undefined?10:Number(options.perChapter);
    if(!Array.isArray(chapters)||chapters.length<1||chapters.length>20||
      chapters.some(c=>!Number.isSafeInteger(c))||new Set(chapters).size!==chapters.length)
      throw new AppError('Chọn 1–20 chương không trùng lặp.');
    if(!Number.isSafeInteger(perChapter)||perChapter<1||perChapter>50||perChapter*chapters.length>200)
      throw new AppError('Số câu/chương phải là 1–50 và đề tối đa 200 câu.');
    for(const chapter of chapters) {
      const n=this.groups.get(chapter)?.length??0;
      if(n<perChapter)throw new AppError(`Chương ${chapter} chỉ có ${n} câu, không đủ ${perChapter} câu.`);
    }
    return {chapters,perChapter,total:chapters.length*perChapter};
  }
  draw(pools,chapter,count) {
    const keys=this.groups.get(chapter);
    if(!pools[chapter])pools[chapter]={cycle:1,remaining:shuffle(keys)};
    const pool=pools[chapter],selected=[];
    while(selected.length<count) {
      if(!pool.remaining.length){pool.cycle++;pool.remaining=shuffle(keys);}
      const index=pool.remaining.findIndex(id=>!selected.includes(id));
      if(index<0) {
        // Khi vừa sang vòng mới trong một đề: hoãn câu đã chọn đến lượt sau.
        const repeated=pool.remaining.filter(id=>selected.includes(id));
        const unused=pool.remaining.filter(id=>!selected.includes(id));
        pool.remaining=[...unused,...repeated];
        if(!unused.length)throw new AppError('Không thể sinh đề không trùng câu với cấu hình hiện tại.');
        continue;
      }
      selected.push(pool.remaining.splice(index,1)[0]);
    }
    return selected;
  }
  createExam(options={}) {
    const settings=this.getParams(options);
    const next=structuredClone(this.state);
    const ids=shuffle(settings.chapters.flatMap(c=>this.draw(next.pools,c,settings.perChapter)));
    if(new Set(ids).size!==ids.length)throw new Error('Lỗi sinh đề: câu bị trùng.');
    const code='C-'+String(++next.serial).padStart(4,'0')+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
    const exam={code,settings,createdAt:new Date().toISOString(),finishedAt:null,
      answers:{},questions:ids.map(id=>({id,order:shuffle([0,1,2,3])}))};
    next.exams[code]=exam;
    this.commit(next);
    return this.view(exam);
  }
  raw(code) {
    if(typeof code!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(code))throw new AppError('Mã đề không hợp lệ.');
    const exam=this.state.exams[code];
    if(!exam)throw new AppError('Không tìm thấy mã đề. Khi thay ngân hàng, mã đề cũ sẽ được đặt lại.',404);
    return exam;
  }
  view(exam) {
    let answered=0,correct=0;
    const questions=exam.questions.map(entry=>{
      const q=this.byId.get(entry.id);
      if(!q)throw new AppError('Đề cũ không còn tương thích với ngân hàng mới.',409);
      const selected=exam.answers[entry.id];const correctIndex=entry.order.indexOf(q.a);
      const feedback=selected===undefined?undefined:{selectedIndex:selected,correctIndex,
        isCorrect:selected===correctIndex,explanation:q.why};
      if(feedback){answered++;if(feedback.isCorrect)correct++;}
      return {id:q.id,chapter:q.chapter,topic:q.topic,level:q.level,source:q.source,
        prompt:q.q,choices:entry.order.map(i=>q.opts[i]),...(feedback?{feedback}:{})};
    });
    return {code:exam.code,createdAt:exam.createdAt,finishedAt:exam.finishedAt,
      total:exam.settings.total,settings:exam.settings,answered,correct,questions};
  }
  get(code){return this.view(this.raw(code));}
  answer(code,{questionId,selectedIndex}={}){
    const exam=this.raw(code);
    if(exam.finishedAt)throw new AppError('Đề đã kết thúc.',409);
    if(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>3)throw new AppError('Đáp án không hợp lệ.');
    const entry=exam.questions.find(x=>x.id===questionId);
    if(!entry)throw new AppError('Không có câu hỏi này trong đề.',404);
    if(exam.answers[questionId]===undefined){const next=structuredClone(this.state);next.exams[code].answers[questionId]=selectedIndex;this.commit(next);}
    const current=this.get(code);const fb=current.questions.find(q=>q.id===questionId).feedback;
    return {...fb,answered:current.answered,correct:current.correct};
  }
  finish(code){this.raw(code);if(!this.state.exams[code].finishedAt){const next=structuredClone(this.state);next.exams[code].finishedAt=new Date().toISOString();this.commit(next);}return this.get(code);}
  history(){return Object.values(this.state.exams).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30).map(e=>{
    const exam=this.view(e);return {code:e.code,createdAt:e.createdAt,finishedAt:e.finishedAt,answered:exam.answered,correct:exam.correct,total:exam.total};
  });}
}
