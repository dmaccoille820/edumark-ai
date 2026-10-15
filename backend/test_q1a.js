import { generateIrishAudio, generateEnglishAudio } from './ttsService.js';
import { initDb, getAssessments } from './database.js';

async function testGeneration() {
  await initDb();
  const assessments = await getAssessments();
  const a = assessments.find(x => x.id === 'a_1792091337644');
  const q1a = a.questions.find(x => x.id === 'a_1792091337644_q1a');
  console.log('Testing q1a:');
  console.log('EN text:', q1a.text.en);
  console.log('GA text:', q1a.text.ga);

  console.log('\nCalling generateIrishAudio...');
  const gaRes = await generateIrishAudio(q1a.text.ga, q1a.id);
  console.log('gaRes:', gaRes);

  console.log('\nCalling generateEnglishAudio...');
  const enRes = await generateEnglishAudio(q1a.text.en, q1a.id);
  console.log('enRes:', enRes);

  process.exit(0);
}
testGeneration().catch(console.error);
