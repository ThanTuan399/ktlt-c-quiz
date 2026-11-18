import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {BankRepository} from './bank/repository.js';
import {toCSV} from './bank/csv.js';
import {QuizService} from './quiz/service.js';
import {AppError} from './shared/util.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const frontend=path.join(root,'frontend');
const bank=new BankRepository({
  seedPath:process.env.BANK_PATH||path.join(root,'backend/data/questions.json'),
  storagePath:process.env.ACTIVE_BANK_PATH||path.join(root,'backend/storage/active-bank.json')
});
const quiz=new QuizService({bankRepository:bank,
  statePath:process.env.STATE_PATH||path.join(root,'backend/storage/state.json')});
const port=Number(process.env.PORT||3000), host=process.env.HOST||'127.0.0.1';
function send(res,status,payload) {
  const body=Buffer.from(JSON.stringify(payload));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
}
function download(res,body,type,name){
  const data=Buffer.from(body);
  res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,
    'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(data);
}
async function read(req){
  const chunks=[];let total=0;
  for await(const c of req){total+=c.length;if(total>7*1024*1024)throw new AppError('Dữ liệu nạp tối đa 7 MB.',413);chunks.push(c);}
  if(!total)return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw new AppError('Nội dung yêu cầu phải là JSON hợp lệ.');}
}
const example=[{id:'C1-001',chapter:1,topic:'1.1 Thuật toán',level:'Nhớ',
  q:'Ví dụ mẫu: Thuật toán là gì?',opts:['Dãy bước giải bài toán','Một loại máy tính','Một thiết bị mạng','Một hệ điều hành'],
  a:0,why:'Theo bài giảng, thuật toán là trình tự hữu hạn các bước giải quyết bài toán.',
  source:{category:'A',references:[{chapter:1,slide:10}]}}];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
export const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),p=url.pathname;
    if(p.startsWith('/api/')){
      if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true});
      if(req.method==='GET'&&p==='/api/meta')return send(res,200,quiz.meta());
      if(req.method==='GET'&&p==='/api/bank/meta')return send(res,200,bank.meta());
      if(req.method==='GET'&&p==='/api/history')return send(res,200,quiz.history());
      if(req.method==='GET'&&p==='/api/bank/export')return download(res,JSON.stringify(bank.export(),null,2)+'\n','application/json; charset=utf-8','codequiz-bank.json');
      if(req.method==='GET'&&p==='/api/bank/template'){
        const format=url.searchParams.get('format')||'json';
        if(format==='csv')return download(res,toCSV(example),'text/csv; charset=utf-8','codequiz-template.csv');
        if(format==='json')return download(res,JSON.stringify({schemaVersion:1,name:'Ngân hàng mẫu',questions:example},null,2)+'\n','application/json; charset=utf-8','codequiz-template.json');
        throw new AppError('Định dạng mẫu không hợp lệ.');
      }
      if(req.method==='POST'&&p==='/api/bank/preview')return send(res,200,bank.preview(await read(req)));
      if(req.method==='POST'&&p==='/api/bank/import'){
        const report=bank.import(await read(req));quiz.reload();
        return send(res,200,{...report,bank:bank.meta()});
      }
      if(req.method==='POST'&&p==='/api/exams')return send(res,201,quiz.createExam(await read(req)));
      const m=p.match(/^\/api\/exams\/([A-Za-z0-9-]+)(?:\/(answers|finish))?$/);
      if(m){
        if(!m[2]&&req.method==='GET')return send(res,200,quiz.get(m[1]));
        if(m[2]==='answers'&&req.method==='POST')return send(res,200,quiz.answer(m[1],await read(req)));
        if(m[2]==='finish'&&req.method==='POST')return send(res,200,quiz.finish(m[1]));
      }
      return send(res,404,{error:'API không tồn tại.'});
    }
    if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Phương thức không được hỗ trợ.'});
    const resource=p==='/'?'/index.html':p;
    let decoded;
    try{decoded=decodeURIComponent(resource);}catch{throw new AppError('Đường dẫn không hợp lệ.');}
    const target=path.resolve(frontend,'.'+decoded);
    if(!target.startsWith(frontend+path.sep))return send(res,403,{error:'Truy cập bị từ chối.'});
    if(!fs.existsSync(target)||!fs.statSync(target).isFile())return send(res,404,{error:'Không tìm thấy tài nguyên.'});
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream',
      'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    return fs.createReadStream(target).pipe(res);
  }catch(err){
    const code=err instanceof AppError?err.status:500;
    if(code===500)console.error(err);
    if(!res.headersSent)return send(res,code,{error:code===500?'Lỗi máy chủ.':err.message,...(err.details?{details:err.details}:{})});
    res.end();
  }
});
if(process.env.NODE_ENV!=='test')server.listen(port,host,()=>console.log('CodeQuiz: http://localhost:'+port));
