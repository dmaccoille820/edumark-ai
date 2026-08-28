-- Schema for EduMark AI Database (Neon PostgreSQL)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
    exam_number VARCHAR(50),
    teacher_id VARCHAR(50)
);

-- 2. Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
    id VARCHAR(50) PRIMARY KEY,
    title_en VARCHAR(255) NOT NULL,
    title_ga VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ga TEXT
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(50) PRIMARY KEY,
    assessment_id VARCHAR(50) REFERENCES assessments(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mcq', 'written')),
    text_en TEXT NOT NULL,
    text_ga TEXT NOT NULL,
    max_marks INTEGER NOT NULL,
    options JSONB, -- Array of bilingual options: [{"en": "...", "ga": "..."}, ...]
    correct_answer_index INTEGER,
    mark_scheme_en TEXT,
    mark_scheme_ga TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 4. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    assessment_id VARCHAR(50) REFERENCES assessments(id) ON DELETE SET NULL,
    answers JSONB NOT NULL, -- Map of {question_id: answer_value}
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'graded')),
    total_score INTEGER,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Detailed Question Feedback Table
CREATE TABLE IF NOT EXISTS feedbacks (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(50) REFERENCES submissions(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    comment_en TEXT,
    comment_ga TEXT,
    CONSTRAINT unique_sub_question UNIQUE (submission_id, question_id)
);

-- Seed Data (Mirrors initial mockDb.ts)
INSERT INTO users (id, email, name, role, exam_number, teacher_id) VALUES
('s1', 'student@school.edu', 'Alex Johnson', 'student', 'EXAM123', NULL),
('s2', 'jane@school.edu', 'Jane Smith', 'student', 'EXAM456', NULL),
('t1', 'teacher@school.edu', 'Mr. Davis', 'teacher', NULL, 'TEACH999')
ON CONFLICT (id) DO NOTHING;

-- Seed Assessment a1
INSERT INTO assessments (id, title_en, title_ga, description_en, description_ga) VALUES
('a1', 'Introduction to Biology', 'Réamhrá don Bhitheolaíocht', 'A brief assessment covering basic biological concepts.', 'Measúnú gairid a chlúdaíonn buneilimintí bitheolaíochta.')
ON CONFLICT (id) DO NOTHING;

-- Seed Questions for a1
INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options, correct_answer_index, mark_scheme_en, mark_scheme_ga, sort_order) VALUES
('q1', 'a1', 'mcq', 'Which organelle is known as the powerhouse of the cell?', 'Cén t-organán a dtugtar teach cumhachta na cille air?', 1, '[{"en": "Nucleus", "ga": "Núicléas"}, {"en": "Mitochondria", "ga": "Miteacoindre"}, {"en": "Ribosome", "ga": "Ribeasóm"}, {"en": "Endoplasmic Reticulum", "ga": "Líonra Ionplásmach"}]'::jsonb, 1, NULL, NULL, 0),
('q2', 'a1', 'written', 'Explain the basic process of photosynthesis in plants.', 'Mínigh bunphróiseas na fótaisintéise i bplandaí.', 3, NULL, NULL, 'Award 1 mark for mentioning sunlight/light energy. Award 1 mark for mentioning the conversion of carbon dioxide and water. Award 1 mark for mentioning the production of glucose/sugar and oxygen.', 'Bronn marc amháin as fuinneamh gréine/solais a lua. Bronn marc amháin as tiontú dé-ocsaíd charbóin agus uisce a lua. Bronn marc amháin as táirgeadh glúcóis/siúcra agus ocsaigine a lua.', 1),
('q3', 'a1', 'written', 'Describe the difference between a prokaryotic and a eukaryotic cell.', 'Déan cur slices ar an difríocht idir cill phrócarótach agus cill eocarótach.', 2, NULL, NULL, 'Award 1 mark for stating eukaryotic cells have a membrane-bound nucleus. Award 1 mark for stating prokaryotic cells lack a membrane-bound nucleus (or lack membrane-bound organelles).', 'Bronn marc amháin as a rá go bhfuil núicléas scannán-cheangailte ag cealla eocarótacha. Bronn marc amháin as a rá nach bhfuil núicléas scannán-cheangailte ag cealla prócarótacha.', 2)
ON CONFLICT (id) DO NOTHING;

-- Seed Assessment a2
INSERT INTO assessments (id, title_en, title_ga, description_en, description_ga) VALUES
('a2', 'Computer Science 101', 'Ríomheolaíocht 101', 'Basic programming and hardware concepts.', 'Buneilimintí ríomhchlárúcháin agus crua-earraí.')
ON CONFLICT (id) DO NOTHING;

-- Seed Questions for a2
INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options, correct_answer_index, mark_scheme_en, mark_scheme_ga, sort_order) VALUES
('q4', 'a2', 'mcq', 'What does CPU stand for?', 'Cad a sheasann CPU dó?', 1, '[{"en": "Central Process Unit", "ga": "Aonad Próisis Lárnach"}, {"en": "Computer Personal Unit", "ga": "Aonad Pearsanta Ríomhaire"}, {"en": "Central Processing Unit", "ga": "Láraonad Próiseála"}, {"en": "Central Processor Unit", "ga": "Aonad Próiseálaí Lárnach"}]'::jsonb, 2, NULL, NULL, 0),
('q5', 'a2', 'written', 'Explain what a variable is in programming.', 'Mínigh cad is athróg ann sa ríomhchlárú.', 2, NULL, NULL, 'Award 1 mark for describing it as a storage location or container. Award 1 mark for mentioning it holds data/values that can change during program execution.', 'Bronn marc amháin as é a mhíniú mar shuíomh stórála nó coimeádán. Bronn marc amháin as a lua go gcoinníonn sé sonraí/luachanna is féidir a athrú le linn rith an chláir.', 1)
ON CONFLICT (id) DO NOTHING;

-- Seed Assessment a3
INSERT INTO assessments (id, title_en, title_ga, description_en, description_ga) VALUES
('a3', 'Systems Development & Programming Concepts', 'Coincheapa Forbartha Córas & Ríomhchlárúcháin', 'Past paper questions covering systems development lifecycles, algorithms, and object-oriented programming.', 'Ceisteanna ó scrúduithe roimhe seo a chlúdaíonn saolréanna forbartha córas, halgartaim, agus ríomhchlárúchán atá bunaithe ar oibiachtaí.')
ON CONFLICT (id) DO NOTHING;

-- Seed Questions for a3
INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options, correct_answer_index, mark_scheme_en, mark_scheme_ga, sort_order) VALUES
('a3_q1', 'a3', 'written', '(c) Technical documentation is produced during system development.
Discuss how technical documentation will be used during software maintenance.', '(c) Táirgtear doiciméadú teicniúil le linn forbairt córais.
Pléigh an dóigh a n-úsáidfear doiciméadú teicniúil le linn cothabháil bogearraí.', 3, NULL, NULL, 
'Component: System specification/module specifications [1]
How used: To identify the part of the system which needs changing/correcting/debugging
Component: DFDs/ERDs/database structures/query designs/report designs/DD
How used: To identify the part of the database which need changing/correcting
Component: Program documentation/pseudocode/flowcharts/listings/code
How used: To identify the code which needs changing/correcting/debugging/optimising
Component: Test plans/test schedule/test data/test results
How used: To retest the system/module after it has been modified
Component: HW/SW Configuration
How used: To identify how the system might benefit from advances in technology/software
[1] for each of two components
[1] for how any component is used
3 x [1] [3]', 
'[Béarla amháin ar fáil don scéim mharcála]
Component: System specification/module specifications [1]
How used: To identify the part of the system which needs changing/correcting/debugging
Component: DFDs/ERDs/database structures/query designs/report designs/DD
How used: To identify the part of the database which need changing/correcting
Component: Program documentation/pseudocode/flowcharts/listings/code
How used: To identify the code which needs changing/correcting/debugging/optimising
Component: Test plans/test schedule/test data/test results
How used: To retest the system/module after it has been modified
Component: HW/SW Configuration
How used: To identify how the system might benefit from advances in technology/software
[1] for each of two components
[1] for how any component is used
3 x [1] [3]', 0),
('a3_q2', 'a3', 'written', '(d) Agile and the waterfall model are different approaches to systems development.
Compare these two approaches with respect to the time taken to develop a system.
Quality of written communication will be assessed in this question.', '(d) Is cuir chuige éagsúla iad Agile agus an tsamhail chascáideach maidir le forbairt córas.
Déan comparáid idir an dá chur chuige seo maidir leis an am a thógann sé le córas a fhorbairt.
Measúnófar caighdeán na cumarsáide scríofa sa cheist seo.', 6, NULL, NULL, 
'Banded response
Features of the Agile approach:
- A combination of iterative and incremental models
- Close collaboration with customers
- The project is split into a number of small modules/iterations
- Each model is developed by a separate team of collaborators scrums
- The teams work concurrently
- A project leader coordinates the teams
Features of the waterfall model:
- Consists of a number of separate stages
- Each stage must be completed before the next one can begin
- At the end of each stage the project is reviewed and a deliverable produced
- A previous stage may have to be re-visited if an error is found
Comparison (The time taken to develop a system):
Agile approach:
- Aims for the rapid delivery of a working product
- Modules can be developed concurrently by multiple independent teams which can speed up development time
- Can adapt quickly to changes in user requirements
Waterfall model:
- A rigid model in which one stage must be fully completed before the next one commences which increases development time
- Changes in user requirements difficult/require previous stages to be repeated

Band 2 [5]-[6]: Detailed description of both, addresses suitability wrt development time with justification, accurate terminology.
Band 1 [3]-[4]: Detailed description of both, refers to suitability wrt development time with limited justification, some terminology.
Band 0 [1]-[2]: Description of one approach, limited terminology.', 
'[Béarla amháin ar fáil don scéim mharcála]
Banded response
Features of the Agile approach:
- A combination of iterative and incremental models
- Close collaboration with customers
- The project is split into a number of small modules/iterations
- Each model is developed by a separate team of collaborators scrums
- The teams work concurrently
- A project leader coordinates the teams
Features of the waterfall model:
- Consists of a number of separate stages
- Each stage must be completed before the next one can begin
- At the end of each stage the project is reviewed and a deliverable produced
- A previous stage may have to be re-visited if an error is found
Comparison (The time taken to develop a system):
Agile approach:
- Aims for the rapid delivery of a working product
- Modules can be developed concurrently by multiple independent teams which can speed up development time
- Can adapt quickly to changes in user requirements
Waterfall model:
- A rigid model in which one stage must be fully completed before the next one commences which increases development time
- Changes in user requirements difficult/require previous stages to be repeated

Band 2 [5]-[6]: Detailed description of both, addresses suitability wrt development time with justification, accurate terminology.
Band 1 [3]-[4]: Description of inheritance, refers to role in supporting code reusability, some terminology.
Band 0 [1]-[2]: Description of inheritance lacking detail, limited terminology.', 1),
('a3_q3', 'a3', 'written', '(e) Describe one benefit and one drawback of the parallel changeover method.
Advantage:
Disadvantage:', '(e) Cuir síos ar aon bhuntáiste agus ar aon mhíbhuntáiste amháin a bhaineann leis an mhodh athraithe chomhthreomhair.
Buntáiste:
Míbhuntáiste:', 4, NULL, NULL, 
'Benefit:
The results of the original system are available
... for results comparison/training/as a backup if new system fails
2 x [1]

Drawback:
Duplication of resources
... hardware/personnel
2 x [1] [4]', 
'[Béarla amháin ar fáil don scéim mharcála]
Benefit:
The results of the original system are available
... for results comparison/training/as a backup if new system fails
2 x [1]

Drawback:
Duplication of resources
... hardware/personnel
2 x [1] [4]', 2),
('a3_q4', 'a3', 'written', '(a) Explain each of the following programming terms.
Algorithm:
Syntax:', '(a) Mínigh gach ceann de na téarmaí ríomhchlárúcháin seo a leanas.
Algartam:
Comhréir:', 4, NULL, NULL, 
'Algorithm:
A list of operations
... required to complete a task or solve a problem
2 x [1]

Syntax:
The rules that define the format/grammar/structure of each statement in a programming language
... including permitted symbols, punctuation characters and key words
2 x [1] [4]', 
'[Béarla amháin ar fáil don scéim mharcála]
Algorithm:
A list of operations
... required to complete a task or solve a problem
2 x [1]

Syntax:
The rules that define the format/grammar/structure of each statement in a programming language
... including permitted symbols, punctuation characters and key words
2 x [1] [4]', 3),
('a3_q5', 'a3', 'written', '(b) Part of the algorithm for calculating student grades is shown below.

Input the student mark
If the mark exceeds 40 the grade is a pass, otherwise the grade is a fail
Output the grade

By referring to this part of the algorithm, explain what is meant by each of the following.
Sequence:', '(b) Tá cuid den algartam le gráid daltaí a ríomh taispeánta thíos.

Ionchuir marc an dalta
Má tá an marc níos mó ná 40 is pas é an grád, seachas sin, is teip é an grád
Aschuir an grád

Agus tagairt á déanamh agat don chuid seo den algartam, mínigh cad é a chiallaíonn gach ceann de na rudaí seo a leanas.
Seicheamh:', 2, NULL, NULL, 
'A sequence:
A number of instructions performed in the order in which they are listed
In this case: Input, If, Output
2 x [1]', 
'[Béarla amháin ar fáil don scéim mharcála]
A sequence:
A number of instructions performed in the order in which they are listed
In this case: Input, If, Output
2 x [1]', 4),
('a3_q6', 'a3', 'written', 'Selection (referring to the algorithm in the previous question):', 'Roghnú (ag tagairt don algartam sa cheist roimhe seo):', 3, NULL, NULL, 
'Selection:
One set of instructions is executed if a condition is true
Optionally, another set of instructions is executed if the condition is false
If mark > 40 then grade = pass else grade = fail
3 x [1] [3]', 
'[Béarla amháin ar fáil don scéim mharcála]
Selection:
One set of instructions is executed if a condition is true
Optionally, another set of instructions is executed if the condition is false
If mark > 40 then grade = pass else grade = fail
3 x [1] [3]', 5),
('a3_q7', 'a3', 'written', '(c) State the difference between a count-controlled loop and a condition-controlled loop.
Count-controlled loop:
Condition-controlled loop:', '(c) Luaigh an difríocht idir lúb áireamh-rialaithe agus lúb choinníoll-rialaithe.
Lúb áireamh-rialaithe:
Lúb choinníoll-rialaithe:', 4, NULL, NULL, 
'Count-controlled loop:
A variable governs the number of times the loop is executed
... for which start/end/increment values are specified
2 x [1]

Condition-controlled loop:
The loop is controlled by a Boolean variable
The variable may be tested at the start of the loop (while)
... or at the end of the loop (until)
2 x [1] [4]', 
'[Béarla amháin ar fáil don scéim mharcála]
Count-controlled loop:
A variable governs the number of times the loop is executed
... for which start/end/increment values are specified
2 x [1]

Condition-controlled loop:
The loop is controlled by a Boolean variable
The variable may be tested at the start of the loop (while)
... or at the end of the loop (until)
2 x [1] [4]', 6),
('a3_q8', 'a3', 'written', '(d) Code reusability is an important aspect of object-oriented programming (OOP).
Evaluate the use of inheritance in supporting code reusability.
Quality of written communication will be assessed in this question.', '(d) Is gné thábhachtach de ríomhchlárúchán atá bunaithe ar oibiachtaí (OOP) í ath-inúsáidteacht cód.
Déan luacháil ar úsáid na hoidhreachta mar thaca le hath-inúsáidteacht cód.
Measúnófar caighdeán na cumarsáide scríofa sa cheist seo.', 6, NULL, NULL, 
'Banded response
Features of inheritance:
- A new class can inherit the attributes and behaviours of an existing class
- Terminology: base/parent/super class derived/child sub class
- The derived class inherits all the attributes and behaviours of the base class
- New attributes and behaviours can be defined for derived classes
Evaluation (The use of inheritance in supporting code re-usability):
- Inheritance is a key part of OOP
- New classes are created from existing classes
- The appropriate code for attributes and behaviours is automatically re-used
- The code does not have to be written and tested
- This reduces development time
- A single base class can be used to define many sub classes

Band 2 [5]-[6]: Detailed description of inheritance, describes use in supporting code reusability with justification, accurate terminology.
Band 1 [3]-[4]: Description of inheritance, refers to role in supporting code reusability, some terminology.
Band 0 [1]-[2]: Description of inheritance lacking detail, limited terminology.', 
'[Béarla amháin ar fáil don scéim mharcála]
Banded response
Features of inheritance:
- A new class can inherit the attributes and behaviours of an existing class
- Terminology: base/parent/super class derived/child sub class
- The derived class inherits all the attributes and behaviours of the base class
- New attributes and behaviours can be defined for derived classes
Evaluation (The use of inheritance in supporting code re-usability):
- Inheritance is a key part of OOP
- New classes are created from existing classes
- The appropriate code for attributes and behaviours is automatically re-used
- The code does not have to be written and tested
- This reduces development time
- A single base class can be used to define many sub classes

Band 2 [5]-[6]: Detailed description of inheritance, describes use in supporting code reusability with justification, accurate terminology.
Band 1 [3]-[4]: Description of inheritance, refers to role in supporting code reusability, some terminology.
Band 0 [1]-[2]: Description of inheritance lacking detail, limited terminology.', 7)
ON CONFLICT (id) DO NOTHING;

-- Seed Submission sub_1
INSERT INTO submissions (id, student_id, assessment_id, answers, status, total_score, submitted_at) VALUES
('sub_1', 's2', 'a1', '{"q1": "1", "q2": "Plants use sunlight to turn water and carbon dioxide into oxygen and glucose.", "q3": "Eukaryotic cells have a nucleus, prokaryotic cells do not."}'::jsonb, 'graded', 6, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Seed Feedbacks for sub_1
INSERT INTO feedbacks (submission_id, question_id, score, comment_en, comment_ga) VALUES
('sub_1', 'q1', 1, 'Correct.', 'Ceart.'),
('sub_1', 'q2', 3, 'Excellent answer covering all points.', 'Freagra den scoth a chlúdaíonn na pointí go léir.'),
('sub_1', 'q3', 2, 'Correct distinction.', 'Idirdhealú ceart.')
ON CONFLICT (submission_id, question_id) DO NOTHING;
