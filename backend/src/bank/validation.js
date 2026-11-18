import {AppError} from '../shared/util.js';
import {parseCSV} from './csv.js';

const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const t=(v)=>typeof v==='string'?v.trim():v==null?'':String(v).trim();
export const DOCUMENT_VERSION=1;

export function parseDocument({format,content}) {
  if(!['json','csv'].includes(format))throw new AppError('Chỉ hỗ trợ định dạng JSON và CSV.');
  if(typeof content!=='string'||!content.trim())throw new AppError('Tệp dữ liệu trống.');
  if(Buffer.byteLength(content,'utf8')>5*1024*1024)throw new AppError('Tệp vượt quá giới hạn 5 MB.',413);
  if(format==='csv')return {name:'Ngân hàng từ CSV',questions:parseCSV(content)};
  let data;
  try { data=JSON.parse(content.replace(/^\uFEFF/,'')); }
  catch {throw new AppError('JSON không hợp lệ. Kiểm tra dấu phẩy, dấu ngoặc và dấu nháy.');}
  if(Array.isArray(data))return {name:'Ngân hàng câu hỏi',questions:data};
  if(!isObj(data)||!Array.isArray(data.questions))throw new AppError('JSON cần là mảng câu hỏi hoặc {"schemaVersion":1,"questions":[]}');
  if(data.schemaVersion!==undefined && data.schemaVersion!==DOCUMENT_VERSION)throw new AppError('Phiên bản dữ liệu không hỗ trợ (chỉ schemaVersion: 1).');
  return {name:t(data.name||data.bankName).slice(0,100)||'Ngân hàng câu hỏi',questions:data.questions};
}
function references(raw) {
  if(typeof raw==='string') {
    const s=raw.trim(); if(!s)return null;
    // Chấp nhận CSV: "1:10;1:12"; JSON không nên chuyển thành chuỗi.
    return s.split(';').map(p=>{const m=p.trim().match(/^(\d+)\s*:\s*(\d+)$/);return m?{chapter:Number(m[1]),slide:Number(m[2])}:null;});
  }
  return raw;
}
export function normalizeQuestion(raw,index) {
  const errors=[];const line=index+1;
  const bad=(field,message)=>errors.push({row:line,field,message});
  if(!isObj(raw))return {question:null,errors:[{row:line,field:'row',message:'Câu hỏi phải là đối tượng JSON.'}]};
  const id=t(raw.id);
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(id))bad('id','ID phải dài 1–80 ký tự (chữ, số, _, ., :, -).');
  const chapter=Number(raw.chapter);
  if(!Number.isSafeInteger(chapter)||chapter<1||chapter>999)bad('chapter','Chương phải là số nguyên từ 1 đến 999.');
  const topic=t(raw.topic).slice(0,200);
  const level=t(raw.level).slice(0,50);
  const q=t(raw.question??raw.q);
  if(q.length<5||q.length>5000)bad('question','Nội dung câu hỏi cần 5–5000 ký tự.');
  let opts=Array.isArray(raw.options)?raw.options:raw.opts;
  if(!Array.isArray(opts))opts=[raw.optionA,raw.optionB,raw.optionC,raw.optionD];
  if(opts.length!==4||opts.some(v=>t(v).length<1||t(v).length>2000))bad('options','Phải có đúng 4 phương án không rỗng (mỗi phương án tối đa 2000 ký tự).');
  else if(new Set(opts.map(v=>t(v))).size!==4)bad('options','Bốn phương án phải khác nhau.');
  const v=raw.correctAnswer??raw.correctIndex??raw.a;
  let a=typeof v==='number'?v:/^[ABCDabcd]$/.test(t(v))?'ABCD'.indexOf(t(v).toUpperCase()):/^[0-3]$/.test(t(v))?Number(t(v)):NaN;
  if(!Number.isInteger(a)||a<0||a>3)bad('correctAnswer','Đáp án đúng là A/B/C/D hoặc chỉ số 0/1/2/3.');
  const why=t(raw.explanation??raw.why);
  if(why.length<4||why.length>5000)bad('explanation','Lời giải thích phải có 4–5000 ký tự.');
  const source=isObj(raw.source)?raw.source:{};
  const category=t(raw.category??source.category).toUpperCase();
  if(!['A','B'].includes(category))bad('category','Chỉ nạp câu loại A hoặc B có căn cứ từ slide.');
  const refs=references(raw.sourceRefs??source.references);
  if(!Array.isArray(refs)||refs.length<1||refs.length>30||refs.some(r=>!isObj(r)||!Number.isSafeInteger(r.chapter)||r.chapter<1||r.chapter>999||!Number.isSafeInteger(r.slide)||r.slide<1||r.slide>9999))bad('sourceRefs','Cần ít nhất 1 tham chiếu chương:slide, ví dụ 1:12;1:13.');
  const question=errors.length?null:{id,chapter,topic,level,q,opts:opts.map(t),a,why,source:{category,references:refs}};
  return {question,errors};
}
export function validateQuestions(items) {
  if(!Array.isArray(items)||items.length<1)throw new AppError('Ngân hàng phải có ít nhất 1 câu hỏi.');
  if(items.length>20000)throw new AppError('Tối đa 20.000 câu trong một lần nạp.');
  const questions=[],errors=[],seen=new Map();
  items.forEach((raw,i)=>{
    const out=normalizeQuestion(raw,i);
    errors.push(...out.errors);
    if(out.question) {
      if(seen.has(out.question.id))errors.push({row:i+1,field:'id',message:`ID ${out.question.id} bị trùng với dòng ${seen.get(out.question.id)}.`});
      else {seen.set(out.question.id,i+1);questions.push(out.question);}
    }
  });
  return {questions,errors};
}
