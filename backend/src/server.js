import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createQuizService, QuizError} from './quiz-service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(root, 'frontend');
const quiz = createQuizService({
  bankPath: process.env.BANK_PATH || path.join(root, 'backend/data/questions.json'),
  statePath: process.env.STATE_PATH || path.join(root, 'backend/storage/state.json')
});
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

function json(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
}
async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new QuizError('Dữ liệu quá lớn',413);
    chunks.push(chunk);
  }
  try { return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { throw new QuizError('Dữ liệu JSON không hợp lệ'); }
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};

export const server = http.createServer(async (req,res) => {
  try {
    const uri = new URL(req.url,'http://localhost');
    const p=uri.pathname;
    if (p.startsWith('/api/')) {
      if (p==='/api/meta' && req.method==='GET') return json(res,200,quiz.meta());
      if (p==='/api/health' && req.method==='GET') return json(res,200,{ok:true});
      if (p==='/api/history' && req.method==='GET') return json(res,200,quiz.history());
      if (p==='/api/exams' && req.method==='POST') return json(res,201,quiz.createExam());
      const m=p.match(/^\/api\/exams\/([A-Za-z0-9-]+)(?:\/(answers|finish))?$/);
      if (m) {
        if (!m[2] && req.method==='GET') return json(res,200,quiz.get(m[1]));
        if (m[2]==='answers' && req.method==='POST') return json(res,200,quiz.answer(m[1],await body(req)));
        if (m[2]==='finish' && req.method==='POST') return json(res,200,quiz.finish(m[1]));
      }
      return json(res,404,{error:'API không tồn tại'});
    }
    if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Phương thức không hỗ trợ'});
    const resource=p==='/' ? '/index.html' : p;
    let decoded;
    try { decoded=decodeURIComponent(resource); } catch {return json(res,400,{error:'Đường dẫn sai'});}
    const target=path.resolve(frontend,'.'+decoded);
    if (!target.startsWith(frontend+path.sep)) return json(res,403,{error:'Không được truy cập'});
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return json(res,404,{error:'Không tìm thấy tệp'});
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream',
      'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  } catch(err) {
    const status=err instanceof QuizError ? err.status : 500;
    if(status===500) console.error(err);
    if(!res.headersSent) json(res,status,{error:status===500?'Lỗi máy chủ':err.message});
    else res.end();
  }
});
if (process.env.NODE_ENV !== 'test') server.listen(port,host,
  ()=>console.log('CodeQuiz: http://localhost:'+port));
