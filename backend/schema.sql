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
    assessment_id VARCHAR(50) REFERENCES assessments (id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mcq', 'written')),
    text_en TEXT NOT NULL,
    text_ga TEXT NOT NULL,
    max_marks INTEGER NOT NULL,
    options JSONB,
    correct_answer_index INTEGER,
    mark_scheme_en TEXT,
    mark_scheme_ga TEXT,
    image_en TEXT,
    image_ga TEXT,
    mark_scheme_image TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_en TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_ga TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS mark_scheme_image TEXT;

-- 4. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES users (id) ON DELETE SET NULL,
    assessment_id VARCHAR(50) REFERENCES assessments (id) ON DELETE SET NULL,
    answers JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'graded')),
    total_score INTEGER,
    submitted_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Detailed Question Feedback Table
CREATE TABLE IF NOT EXISTS feedbacks (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(50) REFERENCES submissions (id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    comment_en TEXT,
    comment_ga TEXT,
    CONSTRAINT unique_sub_question UNIQUE (submission_id, question_id)
);