import { initDb, getAssessments, updateQuestionAudio } from './database.js';
import { generateQuestionAudio } from './ttsService.js';

async function runBackfill() {
  console.log('--- Starting Audio Backfill ---');
  await initDb();

  const assessments = await getAssessments();
  console.log(`Found ${assessments.length} assessment(s).`);

  let totalProcessed = 0;
  let totalUpdated = 0;

  for (const assess of assessments) {
    console.log(`\nProcessing Assessment: "${assess.title?.en || assess.id}" (${assess.questions.length} questions)`);

    for (let i = 0; i < assess.questions.length; i++) {
      const q = assess.questions[i];
      totalProcessed++;

      const needsEn = !q.audioUrl?.en;
      const needsGa = !q.audioUrl?.ga || q.audioUrl?.ga.endsWith('.mp3'); // Old broken .mp3 files

      if (!needsEn && !needsGa) {
        console.log(`  [${i + 1}/${assess.questions.length}] ${q.id}: Already has valid audio. Skipping.`);
        continue;
      }

      console.log(`  [${i + 1}/${assess.questions.length}] ${q.id}: Generating (EN: ${needsEn ? 'YES' : 'NO'}, GA: ${needsGa ? 'YES' : 'NO'})...`);

      const textEn = needsEn ? (q.text?.en ?? (typeof q.text === 'string' ? q.text : null)) : null;
      const textGa = needsGa ? (q.text?.ga ?? (typeof q.text === 'string' ? q.text : null)) : null;

      try {
        const generated = await generateQuestionAudio({
          id: q.id,
          text: { en: textEn, ga: textGa },
        });

        const updates = {};
        if (needsEn && generated.audioUrlEn) updates.audioUrlEn = generated.audioUrlEn;
        if (needsGa && generated.audioUrlGa) updates.audioUrlGa = generated.audioUrlGa;

        if (Object.keys(updates).length > 0) {
          await updateQuestionAudio(q.id, updates);
          totalUpdated++;
          console.log(`    -> Success: ${JSON.stringify(updates)}`);
        } else {
          console.warn(`    -> Warning: No audio was generated for question ${q.id}`);
        }
      } catch (err) {
        console.error(`    -> Error generating audio for ${q.id}:`, err.message);
      }

      // 600ms delay to keep Abair API below gateway limits
      await new Promise(r => setTimeout(r, 600));
    }
  }

  console.log(`\n========================================`);
  console.log(`Backfill Completed!`);
  console.log(`Total questions checked: ${totalProcessed}`);
  console.log(`Total questions updated: ${totalUpdated}`);
  console.log(`========================================`);
  process.exit(0);
}

runBackfill().catch(err => {
  console.error('Fatal backfill error:', err);
  process.exit(1);
});
