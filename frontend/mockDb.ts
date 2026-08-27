import { User, Assessment, Submission } from './types';

export const MOCK_USERS: User[] = [
  { id: 's1', email: 'student@school.edu', examNumber: 'EXAM123', name: 'Alex Johnson', role: 'student' },
  { id: 's2', email: 'jane@school.edu', examNumber: 'EXAM456', name: 'Jane Smith', role: 'student' },
  { id: 't1', email: 'teacher@school.edu', teacherId: 'TEACH999', name: 'Mr. Davis', role: 'teacher' },
];

export const MOCK_ASSESSMENTS: Assessment[] = [
  {
    id: 'a1',
    title: {
      en: 'Introduction to Biology',
      ga: 'Réamhrá don Bhitheolaíocht'
    },
    description: {
      en: 'A brief assessment covering basic biological concepts.',
      ga: 'Measúnú gairid a chlúdaíonn buneilimintí bitheolaíochta.'
    },
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        text: {
          en: 'Which organelle is known as the powerhouse of the cell?',
          ga: 'Cén t-organán a dtugtar teach cumhachta na cille air?'
        },
        maxMarks: 1,
        options: [
          { en: 'Nucleus', ga: 'Núicléas' },
          { en: 'Mitochondria', ga: 'Miteacoindre' },
          { en: 'Ribosome', ga: 'Ribeasóm' },
          { en: 'Endoplasmic Reticulum', ga: 'Líonra Ionplásmach' }
        ],
        correctAnswerIndex: 1
      },
      {
        id: 'q2',
        type: 'written',
        text: {
          en: 'Explain the basic process of photosynthesis in plants.',
          ga: 'Mínigh bunphróiseas na fótaisintéise i bplandaí.'
        },
        maxMarks: 3,
        markScheme: {
          en: 'Award 1 mark for mentioning sunlight/light energy. Award 1 mark for mentioning the conversion of carbon dioxide and water. Award 1 mark for mentioning the production of glucose/sugar and oxygen.',
          ga: 'Bronn marc amháin as fuinneamh gréine/solais a lua. Bronn marc amháin as tiontú dé-ocsaíd charbóin agus uisce a lua. Bronn marc amháin as táirgeadh glúcóis/siúcra agus ocsaigine a lua.'
        }
      },
      {
        id: 'q3',
        type: 'written',
        text: {
          en: 'Describe the difference between a prokaryotic and a eukaryotic cell.',
          ga: 'Déan cur síos ar an difríocht idir cill phrócarótach agus cill eocarótach.'
        },
        maxMarks: 2,
        markScheme: {
          en: 'Award 1 mark for stating eukaryotic cells have a membrane-bound nucleus. Award 1 mark for stating prokaryotic cells lack a membrane-bound nucleus (or lack membrane-bound organelles).',
          ga: 'Bronn marc amháin as a rá go bhfuil núicléas scannán-cheangailte ag cealla eocarótacha. Bronn marc amháin as a rá nach bhfuil núicléas scannán-cheangailte ag cealla prócarótacha.'
        }
      }
    ]
  },
  {
    id: 'a2',
    title: {
      en: 'Computer Science 101',
      ga: 'Ríomheolaíocht 101'
    },
    description: {
      en: 'Basic programming and hardware concepts.',
      ga: 'Buneilimintí ríomhchlárúcháin agus crua-earraí.'
    },
    questions: [
      {
        id: 'q4',
        type: 'mcq',
        text: {
          en: 'What does CPU stand for?',
          ga: 'Cad a sheasann CPU dó?'
        },
        maxMarks: 1,
        options: [
          { en: 'Central Process Unit', ga: 'Aonad Próisis Lárnach' },
          { en: 'Computer Personal Unit', ga: 'Aonad Pearsanta Ríomhaire' },
          { en: 'Central Processing Unit', ga: 'Láraonad Próiseála' },
          { en: 'Central Processor Unit', ga: 'Aonad Próiseálaí Lárnach' }
        ],
        correctAnswerIndex: 2
      },
      {
        id: 'q5',
        type: 'written',
        text: {
          en: 'Explain what a variable is in programming.',
          ga: 'Mínigh cad is athróg ann sa ríomhchlárú.'
        },
        maxMarks: 2,
        markScheme: {
          en: 'Award 1 mark for describing it as a storage location or container. Award 1 mark for mentioning it holds data/values that can change during program execution.',
          ga: 'Bronn marc amháin as é a mhíniú mar shuíomh stórála nó coimeádán. Bronn marc amháin as a lua go gcoinníonn sé sonraí/luachanna is féidir a athrú le linn rith an chláir.'
        }
      }
    ]
  },
  {
    id: 'a3',
    title: {
      en: 'Systems Development & Programming Concepts',
      ga: 'Coincheapa Forbartha Córas & Ríomhchlárúcháin'
    },
    description: {
      en: 'Past paper questions covering systems development lifecycles, algorithms, and object-oriented programming.',
      ga: 'Ceisteanna ó scrúduithe roimhe seo a chlúdaíonn saolréanna forbartha córas, halgartaim, agus ríomhchlárúchán atá bunaithe ar oibiachtaí.'
    },
    questions: [
      {
        id: 'a3_q1',
        type: 'written',
        text: {
          en: '(c) Technical documentation is produced during system development.\nDiscuss how technical documentation will be used during software maintenance.',
          ga: '(c) Táirgtear doiciméadú teicniúil le linn forbairt córais.\nPléigh an dóigh a n-úsáidfear doiciméadú teicniúil le linn cothabháil bogearraí.'
        },
        maxMarks: 3,
        markScheme: {
          en: 'Component: System specification/module specifications [1]\nHow used: To identify the part of the system which needs changing/correcting/debugging\nComponent: DFDs/ERDs/database structures/query designs/report designs/DD\nHow used: To identify the part of the database which need changing/correcting\nComponent: Program documentation/pseudocode/flowcharts/listings/code\nHow used: To identify the code which needs changing/correcting/debugging/optimising\nComponent: Test plans/test schedule/test data/test results\nHow used: To retest the system/module after it has been modified\nComponent: HW/SW Configuration\nHow used: To identify how the system might benefit from advances in technology/software\n[1] for each of two components\n[1] for how any component is used\n3 × [1] [3]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nComponent: System specification/module specifications [1]\nHow used: To identify the part of the system which needs changing/correcting/debugging\nComponent: DFDs/ERDs/database structures/query designs/report designs/DD\nHow used: To identify the part of the database which need changing/correcting\nComponent: Program documentation/pseudocode/flowcharts/listings/code\nHow used: To identify the code which needs changing/correcting/debugging/optimising\nComponent: Test plans/test schedule/test data/test results\nHow used: To retest the system/module after it has been modified\nComponent: HW/SW Configuration\nHow used: To identify how the system might benefit from advances in technology/software\n[1] for each of two components\n[1] for how any component is used\n3 × [1] [3]'
        }
      },
      {
        id: 'a3_q2',
        type: 'written',
        text: {
          en: '(d) Agile and the waterfall model are different approaches to systems development.\nCompare these two approaches with respect to the time taken to develop a system.\nQuality of written communication will be assessed in this question.',
          ga: '(d) Is cuir chuige éagsúla iad Agile agus an tsamhail chascáideach maidir le forbairt córas.\nDéan comparáid idir an dá chur chuige seo maidir leis an am a thógann sé le córas a fhorbairt.\nMeasúnófar caighdeán na cumarsáide scríofa sa cheist seo.'
        },
        maxMarks: 6,
        markScheme: {
          en: 'Banded response\nFeatures of the Agile approach:\n- A combination of iterative and incremental models\n- Close collaboration with customers\n- The project is split into a number of small modules/iterations\n- Each model is developed by a separate team of collaborators scrums\n- The teams work concurrently\n- A project leader coordinates the teams\nFeatures of the waterfall model:\n- Consists of a number of separate stages\n- Each stage must be completed before the next one can begin\n- At the end of each stage the project is reviewed and a deliverable produced\n- A previous stage may have to be re-visited if an error is found\nComparison (The time taken to develop a system):\nAgile approach:\n- Aims for the rapid delivery of a working product\n- Modules can be developed concurrently by multiple independent teams which can speed up development time\n- Can adapt quickly to changes in user requirements\nWaterfall model:\n- A rigid model in which one stage must be fully completed before the next one commences which increases development time\n- Changes in user requirements difficult/require previous stages to be repeated\n\nBand 2 [5]–[6]: Detailed description of both, addresses suitability wrt development time with justification, accurate terminology.\nBand 1 [3]–[4]: Detailed description of both, refers to suitability wrt development time with limited justification, some terminology.\nBand 0 [1]–[2]: Description of one approach, limited terminology.',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nBanded response\nFeatures of the Agile approach:\n- A combination of iterative and incremental models\n- Close collaboration with customers\n- The project is split into a number of small modules/iterations\n- Each model is developed by a separate team of collaborators scrums\n- The teams work concurrently\n- A project leader coordinates the teams\nFeatures of the waterfall model:\n- Consists of a number of separate stages\n- Each stage must be completed before the next one can begin\n- At the end of each stage the project is reviewed and a deliverable produced\n- A previous stage may have to be re-visited if an error is found\nComparison (The time taken to develop a system):\nAgile approach:\n- Aims for the rapid delivery of a working product\n- Modules can be developed concurrently by multiple independent teams which can speed up development time\n- Can adapt quickly to changes in user requirements\nWaterfall model:\n- A rigid model in which one stage must be fully completed before the next one commences which increases development time\n- Changes in user requirements difficult/require previous stages to be repeated\n\nBand 2 [5]–[6]: Detailed description of both, addresses suitability wrt development time with justification, accurate terminology.\nBand 1 [3]–[4]: Detailed description of both, refers to suitability wrt development time with limited justification, some terminology.\nBand 0 [1]–[2]: Description of one approach, limited terminology.'
        }
      },
      {
        id: 'a3_q3',
        type: 'written',
        text: {
          en: '(e) Describe one benefit and one drawback of the parallel changeover method.\nAdvantage:\nDisadvantage:',
          ga: '(e) Cuir síos ar aon bhuntáiste agus ar aon mhíbhuntáiste amháin a bhaineann leis an mhodh athraithe chomhthreomhair.\nBuntáiste:\nMíbhuntáiste:'
        },
        maxMarks: 4,
        markScheme: {
          en: 'Benefit:\nThe results of the original system are available\n... for results comparison/training/as a backup if new system fails\n2 × [1]\n\nDrawback:\nDuplication of resources\n… hardware/personnel\n2 × [1] [4]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nBenefit:\nThe results of the original system are available\n... for results comparison/training/as a backup if new system fails\n2 × [1]\n\nDrawback:\nDuplication of resources\n… hardware/personnel\n2 × [1] [4]'
        }
      },
      {
        id: 'a3_q4',
        type: 'written',
        text: {
          en: '(a) Explain each of the following programming terms.\nAlgorithm:\nSyntax:',
          ga: '(a) Mínigh gach ceann de na téarmaí ríomhchlárúcháin seo a leanas.\nAlgartam:\nComhréir:'
        },
        maxMarks: 4,
        markScheme: {
          en: 'Algorithm:\nA list of operations\n… required to complete a task or solve a problem\n2 × [1]\n\nSyntax:\nThe rules that define the format/grammar/structure of each statement in a programming language\n... including permitted symbols, punctuation characters and key words\n2 × [1] [4]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nAlgorithm:\nA list of operations\n… required to complete a task or solve a problem\n2 × [1]\n\nSyntax:\nThe rules that define the format/grammar/structure of each statement in a programming language\n... including permitted symbols, punctuation characters and key words\n2 × [1] [4]'
        }
      },
      {
        id: 'a3_q5',
        type: 'written',
        text: {
          en: '(b) Part of the algorithm for calculating student grades is shown below.\n\nInput the student mark\nIf the mark exceeds 40 the grade is a pass, otherwise the grade is a fail\nOutput the grade\n\nBy referring to this part of the algorithm, explain what is meant by each of the following.\nSequence:',
          ga: '(b) Tá cuid den algartam le gráid daltaí a ríomh taispeánta thíos.\n\nIonchuir marc an dalta\nMá tá an marc níos mó ná 40 is pas é an grád, seachas sin, is teip é an grád\nAschuir an grád\n\nAgus tagairt á déanamh agat don chuid seo den algartam, mínigh cad é a chiallaíonn gach ceann de na rudaí seo a leanas.\nSeicheamh:'
        },
        maxMarks: 2,
        markScheme: {
          en: 'A sequence:\nA number of instructions performed in the order in which they are listed\nIn this case: Input, If, Output\n2 × [1]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nA sequence:\nA number of instructions performed in the order in which they are listed\nIn this case: Input, If, Output\n2 × [1]'
        }
      },
      {
        id: 'a3_q6',
        type: 'written',
        text: {
          en: 'Selection (referring to the algorithm in the previous question):',
          ga: 'Roghnú (ag tagairt don algartam sa cheist roimhe seo):'
        },
        maxMarks: 3,
        markScheme: {
          en: 'Selection:\nOne set of instructions is executed if a condition is true\nOptionally, another set of instructions is executed if the condition is false\nIf mark > 40 then grade = pass else grade = fail\n3 × [1] [3]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nSelection:\nOne set of instructions is executed if a condition is true\nOptionally, another set of instructions is executed if the condition is false\nIf mark > 40 then grade = pass else grade = fail\n3 × [1] [3]'
        }
      },
      {
        id: 'a3_q7',
        type: 'written',
        text: {
          en: '(c) State the difference between a count-controlled loop and a condition-controlled loop.\nCount-controlled loop:\nCondition-controlled loop:',
          ga: '(c) Luaigh an difríocht idir lúb áireamh-rialaithe agus lúb choinníoll-rialaithe.\nLúb áireamh-rialaithe:\nLúb choinníoll-rialaithe:'
        },
        maxMarks: 4,
        markScheme: {
          en: 'Count-controlled loop:\nA variable governs the number of times the loop is executed\n… for which start/end/increment values are specified\n2 × [1]\n\nCondition-controlled loop:\nThe loop is controlled by a Boolean variable\nThe variable may be tested at the start of the loop (while)\n... or at the end of the loop (until)\n2 × [1] [4]',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nCount-controlled loop:\nA variable governs the number of times the loop is executed\n… for which start/end/increment values are specified\n2 × [1]\n\nCondition-controlled loop:\nThe loop is controlled by a Boolean variable\nThe variable may be tested at the start of the loop (while)\n... or at the end of the loop (until)\n2 × [1] [4]'
        }
      },
      {
        id: 'a3_q8',
        type: 'written',
        text: {
          en: '(d) Code reusability is an important aspect of object-oriented programming (OOP).\nEvaluate the use of inheritance in supporting code reusability.\nQuality of written communication will be assessed in this question.',
          ga: '(d) Is gné thábhachtach de ríomhchlárúchán atá bunaithe ar oibiachtaí (OOP) í ath-inúsáidteacht cód.\nDéan luacháil ar úsáid na hoidhreachta mar thaca le hath-inúsáidteacht cód.\nMeasúnófar caighdeán na cumarsáide scríofa sa cheist seo.'
        },
        maxMarks: 6,
        markScheme: {
          en: 'Banded response\nFeatures of inheritance:\n- A new class can inherit the attributes and behaviours of an existing class\n- Terminology: base/parent/super class derived/child sub class\n- The derived class inherits all the attributes and behaviours of the base class\n- New attributes and behaviours can be defined for derived classes\nEvaluation (The use of inheritance in supporting code re-usability):\n- Inheritance is a key part of OOP\n- New classes are created from existing classes\n- The appropriate code for attributes and behaviours is automatically re-used\n- The code does not have to be written and tested\n- This reduces development time\n- A single base class can be used to define many sub classes\n\nBand 2 [5]–[6]: Detailed description of inheritance, describes use in supporting code reusability with justification, accurate terminology.\nBand 1 [3]–[4]: Description of inheritance, refers to role in supporting code reusability, some terminology.\nBand 0 [1]–[2]: Description of inheritance lacking detail, limited terminology.',
          ga: '[Béarla amháin ar fáil don scéim mharcála]\nBanded response\nFeatures of inheritance:\n- A new class can inherit the attributes and behaviours of an existing class\n- Terminology: base/parent/super class derived/child sub class\n- The derived class inherits all the attributes and behaviours of the base class\n- New attributes and behaviours can be defined for derived classes\nEvaluation (The use of inheritance in supporting code re-usability):\n- Inheritance is a key part of OOP\n- New classes are created from existing classes\n- The appropriate code for attributes and behaviours is automatically re-used\n- The code does not have to be written and tested\n- This reduces development time\n- A single base class can be used to define many sub classes\n\nBand 2 [5]–[6]: Detailed description of inheritance, describes use in supporting code reusability with justification, accurate terminology.\nBand 1 [3]–[4]: Description of inheritance, refers to role in supporting code reusability, some terminology.\nBand 0 [1]–[2]: Description of inheritance lacking detail, limited terminology.'
        }
      }
    ]
  }
];

// Pre-populate some submissions so the teacher dashboard has data
export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: 'sub_1',
    studentId: 's2',
    assessmentId: 'a1',
    answers: {
      'q1': '1',
      'q2': 'Plants use sunlight to turn water and carbon dioxide into oxygen and glucose.',
      'q3': 'Eukaryotic cells have a nucleus, prokaryotic cells do not.'
    },
    status: 'graded',
    totalScore: 6,
    feedback: {
      'q1': { score: 1, commentEn: 'Correct.', commentGa: 'Ceart.' },
      'q2': { score: 3, commentEn: 'Excellent answer covering all points.', commentGa: 'Freagra den scoth a chlúdaíonn na pointí go léir.' },
      'q3': { score: 2, commentEn: 'Correct distinction.', commentGa: 'Idirdhealú ceart.' }
    },
    submittedAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  }
];
