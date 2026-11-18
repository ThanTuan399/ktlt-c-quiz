import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class AppError extends Error {
  constructor(message, status=400, details=undefined) {
    super(message); this.name='AppError'; this.status=status; this.details=details;
  }
}
export const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try { fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600}); fs.renameSync(tmp,file); }
  finally { if(fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
export function shuffle(values) {
  const a=[...values];
  for(let i=a.length-1;i>0;i--) {const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
