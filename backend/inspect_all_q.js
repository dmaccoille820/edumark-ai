import { initDb, getAssessments } from './database.js';

async function inspectAll() {
  await initDb();
  const assessments = await getAssessments();
  const a = assessments.find(x => x.id === 'a_1792091337644');
  a.questions.forEach((q, idx) => {
    console.log(`[${idx}] ${q.id}:`);
    console.log(`    text_en (${q.text?.en?.length || 0} chars): "${q.text?.en}"`);
    console.log(`    text_ga (${q.text?.ga?.length || 0} chars): "${q.text?.ga}"`);
    console.log(`    audioUrl: ${JSON.stringify(q.audioUrl)}`);
  });
  process.exit(0);
}
inspectAll().catch(console.error);
