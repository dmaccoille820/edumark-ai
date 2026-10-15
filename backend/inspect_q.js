import { initDb, getAssessments } from './database.js';

async function checkAssessment() {
  await initDb();
  const assessments = await getAssessments();
  const a = assessments.find(x => x.id === 'a_1792091337644');
  if (!a) {
    console.log('Assessment a_1792091337644 not found!');
    process.exit(1);
  }
  console.log('Assessment found:', a.title);
  for (const q of a.questions) {
    console.log(`Q: ${q.id}`);
    console.log(`  text_en:`, q.text?.en?.slice(0, 60));
    console.log(`  text_ga:`, q.text?.ga?.slice(0, 60));
    console.log(`  audioUrl:`, q.audioUrl);
  }
  process.exit(0);
}
checkAssessment().catch(console.error);
