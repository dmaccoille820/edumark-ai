import { initDb, getAssessments } from './database.js';

async function checkTypes() {
  await initDb();
  const assessments = await getAssessments();
  const a = assessments.find(x => x.id === 'a_1792091337644');
  for (const q of a.questions) {
    console.log(`Q: ${q.id} type=${q.type} maxMarks=${q.maxMarks} hasOptions=${Boolean(q.options)} hasAudio=${Boolean(q.audioUrl)}`);
  }
  process.exit(0);
}
checkTypes().catch(console.error);
