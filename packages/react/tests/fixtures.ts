import type {
  ApiCourse,
  ApiCourseSummary,
  ApiLesson,
  ApiLessonQuiz,
  ApiLessonVideo,
  ApiQuizAttempt,
  ApiQuizResult,
} from "@bebranded/elearning-core";

// Synthetic API payloads, shaped by the contract types of elearning-core.

export const courseSummary: ApiCourseSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "safety",
  title: "Safety basics",
  summary: "Stay safe at work.",
  cover_image_url: null,
  locale: "en",
  enrollment_mode: "self",
  enrollment: null,
};

export const enrolledSummary: ApiCourseSummary = {
  ...courseSummary,
  id: "00000000-0000-4000-8000-000000000002",
  slug: "first-aid",
  title: "First aid",
  enrollment: {
    id: "00000000-0000-4000-8000-000000000010",
    course_id: "00000000-0000-4000-8000-000000000002",
    source: "assigned",
    progress: 0.5,
    due_at: "2026-12-31T00:00:00.000Z",
    started_at: "2026-06-01T09:00:00.000Z",
    completed_at: null,
  },
};

export const course: ApiCourse = {
  ...courseSummary,
  export_formats: [],
  chapters: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      title: "Getting started",
      position: 0,
      lessons: [
        {
          id: "00000000-0000-4000-8000-000000000030",
          title: "Welcome",
          type: "text",
          position: 0,
          is_required: true,
          estimated_minutes: 5,
          status: "completed",
        },
        {
          id: "00000000-0000-4000-8000-000000000031",
          title: "Extra reading",
          type: "text",
          position: 1,
          is_required: false,
          estimated_minutes: null,
          status: "not_started",
        },
      ],
    },
  ],
  progress: { completed_required: 1, total_required: 2, ratio: 0.5, is_complete: false },
};

export const lesson: ApiLesson = {
  id: "00000000-0000-4000-8000-000000000030",
  course_id: courseSummary.id,
  chapter_id: "00000000-0000-4000-8000-000000000020",
  type: "text",
  title: "Welcome",
  estimated_minutes: 5,
  is_required: true,
  html: "<h2>Hello</h2><p>Read <strong>this</strong>.</p>",
  settings: {},
  status: "in_progress",
  video: null,
  quiz: null,
  export_formats: [],
};

export const readyVideo: ApiLessonVideo = {
  status: "ready",
  duration_seconds: 60,
  thumbnail_url: "https://videos.example.com/thumb.jpg",
  captions: [{ lang: "fr", url: "https://videos.example.com/fr.vtt" }],
  playback: {
    type: "hls",
    url: "https://videos.example.com/video.m3u8",
    expires_at: "2026-10-23T10:00:00.000Z",
  },
  progress: { watched_seconds: 0, coverage: 0, last_position: 0, watched_ranges: [] },
};

export const videoLesson: ApiLesson = {
  ...lesson,
  id: "00000000-0000-4000-8000-000000000031",
  type: "video",
  title: "Safety video",
  html: "<p>Notes</p>",
  settings: {
    completionThreshold: 0.95,
    allowSeeking: true,
    maxPlaybackRate: 2,
    pauseWhenHidden: false,
  },
  video: readyVideo,
};

export const quizStanding: ApiLessonQuiz = {
  ready: true,
  question_count: 2,
  passing_score: 0.8,
  max_attempts: 3,
  attempts_used: 0,
  attempts_remaining: 3,
  cooldown_minutes: 0,
  next_attempt_at: null,
  time_limit_minutes: null,
  best_score: null,
  passed: false,
  show_correction: "after_attempt",
  open_attempt: null,
};

export const quizLesson: ApiLesson = {
  ...lesson,
  id: "00000000-0000-4000-8000-000000000032",
  type: "quiz",
  title: "Safety check",
  html: "",
  quiz: quizStanding,
};

/** An attempt as the server sends it: opaque values, no answer. */
export const quizAttempt: ApiQuizAttempt = {
  id: "00000000-0000-4000-8000-000000000040",
  attempt_number: 1,
  started_at: "2026-10-23T09:00:00.000Z",
  expires_at: null,
  survey: {
    pages: [
      {
        name: "quiz",
        elements: [
          { type: "html", name: "q1_intro", html: "<p>Look at the poster.</p>" },
          { type: "boolean", name: "q1", title: "Exit signs are green." },
          {
            type: "radiogroup",
            name: "q2",
            title: "Which color marks an exit?",
            choices: [
              { value: "o1", text: "Red" },
              { value: "o2", text: "Green" },
            ],
          },
        ],
      },
    ],
  },
};

export const quizResult: ApiQuizResult = {
  attempt_id: quizAttempt.id,
  attempt_number: 1,
  outcome: "graded",
  score: 0.5,
  passed: false,
  points_earned: 1,
  points_possible: 2,
  status: "in_progress",
  best_score: 0.5,
  attempts_remaining: 2,
  next_attempt_at: null,
  corrections: [
    { name: "q1", correct: true, earned: 1, possible: 1, correct_answer: true, explanation: "" },
    {
      name: "q2",
      correct: false,
      earned: 0,
      possible: 1,
      correct_answer: "o2",
      explanation: "Green means safe.",
    },
  ],
};
