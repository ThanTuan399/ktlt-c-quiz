import {AppError} from '../shared/util.js';

// RFC-4180-like CSV: BOM, quoted comma, embedded quotes/newlines, CRLF.
export function parseCSV(text) {
  if(typeof text!=='string') throw new AppError('CSV phải là văn bản UTF-8.');
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"' && text[i+1]==='"') {cell+='"';i++;}
      else if(ch==='"') {quoted=false;closed=true;}
      else cell+=ch;
    } else if(ch==='"' && cell==='' && !closed) {quoted=true;}
    else if(ch===',') {row.push(cell);cell='';closed=false;}
    else if(ch==='\n' || ch==='\r') {
      if(ch==='\r' && text[i+1]==='\n')i++;
      row.push(cell);cell='';closed=false;
      if(row.some(v=>v.trim()!==''))rows.push(row);
      row=[];
    } else if(closed && ch!==' ' && ch!=='\t') {
      throw new AppError('CSV có ký tự không hợp lệ sau dấu ngoặc kép.');
    } else if(!closed) cell+=ch;
  }
  if(quoted)throw new AppError('CSV có trường đặt trong dấu ngoặc kép chưa đóng.');
  row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);
  if(rows.length<2)throw new AppError('CSV phải có dòng tiêu đề và ít nhất một câu hỏi.');
  const headers=rows.shift().map(h=>h.trim());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new AppError('Tiêu đề cột CSV rỗng hoặc trùng.');
  return rows.map((r,i)=>{
    if(r.length!==headers.length)throw new AppError(`Dòng CSV ${i+2}: số cột ${r.length} khác ${headers.length}.`);
    return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));
  });
}
export const CSV_HEADERS=['id','chapter','topic','level','question','optionA','optionB','optionC','optionD','correctAnswer','explanation','category','sourceRefs'];
export function toCSV(questions) {
  const quote = s => '"'+String(s??'').replaceAll('"','""')+'"';
  return '\uFEFF'+CSV_HEADERS.join(',')+'\r\n'+questions.map(q=>[
    q.id,q.chapter,q.topic,q.level,q.q,...q.opts,'ABCD'[q.a],q.why,q.source.category,
    q.source.references.map(r=>r.chapter+':'+r.slide).join(';')
  ].map(quote).join(',')).join('\r\n')+'\r\n';
}
