import { initDb, getAssessments } from './database.js';

async function checkDb() {
  await initDb();
  const assessments = await getAssessments();
  console.log('Assessments in DB:', assessments.length);
  for (const a of assessments) {
    console.log(`\nAssessment: ${a.id} - ${a.title?.en} / ${a.title?.ga}`);
    for (const q of a.questions) {
      console.log(`  Question ${q.id}: audioUrl =`, JSON.stringify(q.audioUrl));
    }
  }
  process.exit(0);
}
checkDb().catch((err) => {
  console.error(err);
  process.exit(1);
});

