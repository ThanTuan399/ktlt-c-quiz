import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class QuizError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const CHAPTERS = [1, 2, 3, 4];
const EACH = 10;
const shuffle = items => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function createQuizService({ bankPath, statePath }) {
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const byId = new Map(bank.map(q => [q.id, q]));
  if (byId.size !== bank.length) throw new Error('ID câu hỏi bị trùng');
  for (const q of bank) {
    if (!CHAPTERS.includes(q.chapter) || !Array.isArray(q.opts) || q.opts.length !== 4
        || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) {
      throw new Error('Ngân hàng câu hỏi không hợp lệ: ' + q.id);
    }
  }
  const groups = Object.fromEntries(CHAPTERS.map(c => [c, bank.filter(q => q.chapter === c).map(q => q.id)]));
  if (CHAPTERS.some(c => groups[c].length < EACH)) throw new Error('Mỗi chương cần ít nhất 10 câu hỏi');
  const fresh = () => ({
    serial: 0,
    pools: Object.fromEntries(CHAPTERS.map(c => [c, { cycle: 1, remaining: shuffle(groups[c]) }])),
    exams: {}
  });
  let state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : fresh();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const save = next => {
    const temp = statePath + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, statePath);
    state = next;
  };
  function draw(pool, chapter) {
    const picked = [];
    while (picked.length < EACH) {
      if (!pool.remaining.length) {
        pool.remaining = shuffle(groups[chapter]);
        pool.cycle++;
      }
      // Không lặp trong một đề, kể cả khi chuyển chu kỳ giữa đề.
      const index = pool.remaining.findIndex(id => !picked.includes(id));
      if (index < 0) {
        pool.remaining = shuffle(groups[chapter].filter(id => !picked.includes(id)));
        pool.cycle++;
        continue;
      }
      picked.push(pool.remaining.splice(index, 1)[0]);
    }
    return picked;
  }
  function raw(code) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(code ?? '')) throw new QuizError('Mã đề không hợp lệ');
    const exam = state.exams[code];
    if (!exam) throw new QuizError('Không tìm thấy mã đề', 404);
    return exam;
  }
  function view(exam) {
    let correct = 0, answered = 0;
    const questions = exam.questions.map(entry => {
      const q = byId.get(entry.id);
      const choice = exam.answers[entry.id];
      const correctIndex = entry.order.indexOf(q.a);
      const feedback = choice == null ? undefined : {
        selectedIndex: choice, correctIndex, isCorrect: choice === correctIndex, explanation: q.why
      };
      if (feedback) { answered++; if (feedback.isCorrect) correct++; }
      return { id: q.id, chapter: q.chapter, topic: q.topic, level: q.level,
        prompt: q.q, choices: entry.order.map(i => q.opts[i]), ...(feedback && {feedback}) };
    });
    return { code: exam.code, createdAt: exam.createdAt, finishedAt: exam.finishedAt,
      total: 40, answered, correct, questions };
  }
  const meta = () => ({ bankTotal: bank.length, examSize: 40, perChapter: EACH, generatedExams: state.serial,
    chapters: Object.fromEntries(CHAPTERS.map(c => [c, {
      total: groups[c].length, remaining: state.pools[c].remaining.length, cycle: state.pools[c].cycle
    }])) });
  function createExam() {
    const next = structuredClone(state);
    const ids = shuffle(CHAPTERS.flatMap(c => draw(next.pools[c], c)));
    if (ids.length !== 40 || new Set(ids).size !== 40) throw new Error('Lỗi sinh mã đề: trùng câu');
    const code = 'C-' + String(++next.serial).padStart(4, '0') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const exam = { code, createdAt: new Date().toISOString(), finishedAt: null,
      answers: {}, questions: ids.map(id => ({id, order: shuffle([0,1,2,3])})) };
    next.exams[code] = exam;
    save(next);
    return view(exam);
  }
  function get(code) { return view(raw(code)); }
  function answer(code, {questionId, selectedIndex} = {}) {
    const exam = raw(code);
    if (exam.finishedAt) throw new QuizError('Đề đã kết thúc', 409);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) throw new QuizError('Đáp án không hợp lệ');
    const entry = exam.questions.find(q => q.id === questionId);
    if (!entry) throw new QuizError('Không có câu hỏi này trong đề', 404);
    if (exam.answers[questionId] == null) {
      const next = structuredClone(state);
      next.exams[code].answers[questionId] = selectedIndex;
      save(next);
    }
    const selected = state.exams[code].answers[questionId];
    const q = byId.get(questionId);
    const correctIndex = entry.order.indexOf(q.a);
    const current = get(code);
    return { selectedIndex:selected, correctIndex, isCorrect:selected===correctIndex,
      explanation:q.why, answered:current.answered, correct:current.correct };
  }
  function finish(code) {
    raw(code);
    if (!state.exams[code].finishedAt) {
      const next = structuredClone(state);
      next.exams[code].finishedAt = new Date().toISOString();
      save(next);
    }
    return get(code);
  }
  function history() {
    return Object.values(state.exams).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
      .slice(0,30).map(e => {
        const v=view(e); return {code:e.code,createdAt:e.createdAt,finishedAt:e.finishedAt,
          answered:v.answered,correct:v.correct,total:v.total};
      });
  }
  return {meta,createExam,get,answer,finish,history};
}
