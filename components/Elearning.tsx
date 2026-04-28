import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Award, BookOpenCheck, CheckCircle2, GraduationCap, PlayCircle, Search, ShieldCheck, Sparkles, Target, Trophy, Users, XCircle, FileText, Video, CheckSquare } from 'lucide-react';
import { CareerRank, Employee, Event, LearningAttempt, LearningLesson, LearningProfile, LearningQuestion, LearningTrack } from '../types';

interface ElearningProps {
  tracks: LearningTrack[];
  profiles: LearningProfile[];
  attempts: LearningAttempt[];
  leaderboardProfiles?: LearningProfile[];
  ranks: CareerRank[];
  employees: Employee[];
  events: Event[];
  onSubmitAttempt: (attempt: LearningAttempt) => void;
  onUpsertProfile: (profile: LearningProfile) => void;
  onUpdateTracks: (tracks: LearningTrack[]) => void;
  onDeleteProfile: (profileId: string) => void;
  canEdit?: boolean;
  isAdminView?: boolean;
  canViewTeamProgress?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentEmployeeId?: string;
}

type ViewMode = 'home' | 'training' | 'progress' | 'leaderboard' | 'teamProgress' | 'lesson' | 'quiz' | 'result';

type AnswerDraft = {
  selectedOption?: number;
  answerText?: string;
};

type QuizResultItem = {
  question: LearningQuestion;
  attempt: LearningAttempt;
  isCorrect: boolean;
  userAnswerText: string;
  correctAnswerText: string;
};

type QuizResultSummary = {
  lessonTitle: string;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  items: QuizResultItem[];
};

type LessonProgressSummary = {
  lessonId: string;
  answeredCount: number;
  totalQuestions: number;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  completed: boolean;
};

type TrackProgressSummary = {
  trackId: string;
  completedLessons: number;
  totalLessons: number;
  totalScore: number;
  maxScore: number;
  completed: boolean;
};

type LearningLevel = LearningTrack['level'];
type TeamProgressRow = {
  id: string;
  name: string;
  roleLabel: string;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
  completedTracks: number;
  totalTracks: number;
  totalScore: number;
  maxScore: number;
  attemptCount: number;
  pendingLessons: number;
  status: 'NOT_STARTED' | 'AT_RISK' | 'IN_PROGRESS' | 'ON_TRACK' | 'COMPLETED';
  statusLabel: string;
  statusClassName: string;
  latestActivityText: string;
  latestActivityAt?: string;
};

const QUICK_IMPORT_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const LEARNING_LEVEL_ORDER: LearningLevel[] = ['BASE', 'ADVANCED', 'MASTER'];
const LEARNING_LEVEL_META: Record<LearningLevel, { label: string; description: string; badgeClassName: string; sectionClassName: string }> = {
  BASE: {
    label: 'Cơ bản',
    description: 'Dành cho người mới bắt đầu hoặc cần củng cố nền tảng.',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    sectionClassName: 'border-emerald-100 bg-emerald-50/40'
  },
  ADVANCED: {
    label: 'Nâng cao',
    description: 'Các chủ đề cần kinh nghiệm thực tế và khả năng xử lý tốt hơn.',
    badgeClassName: 'bg-blue-100 text-blue-700',
    sectionClassName: 'border-blue-100 bg-blue-50/40'
  },
  MASTER: {
    label: 'Chuyên gia',
    description: 'Nhóm nội dung dành cho vai trò dẫn dắt, huấn luyện và quản lý.',
    badgeClassName: 'bg-amber-100 text-amber-700',
    sectionClassName: 'border-amber-100 bg-amber-50/40'
  }
};

const formatDateTime = (iso?: string) => {
  if (!iso) return 'Chưa có hoạt động';
  return new Date(iso).toLocaleString('vi-VN');
};

const getRelativeActivityLabel = (iso?: string) => {
  if (!iso) return 'Chưa bắt đầu học';

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return '1 ngày trước';
  return `${diffDays} ngày trước`;
};

const parseQuickQuizImport = (rawText: string): { questions: LearningQuestion[]; error?: string } => {
  const normalizedText = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) {
    return { questions: [], error: 'Vui lòng dán nội dung câu hỏi trước khi thêm.' };
  }

  const blocks = normalizedText
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const questions: LearningQuestion[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length < 6) {
      return {
        questions: [],
        error: 'Mỗi câu cần có 1 dòng câu hỏi, 4 phương án A/B/C/D và 1 dòng Đáp án.'
      };
    }

    const promptLine = lines[0];
    const prompt = promptLine
      .replace(/^(?:câu hỏi|question|q)\s*[:.-]\s*/i, '')
      .replace(/^\d+\s*[.)-]\s*/, '')
      .trim();

    if (!prompt) {
      return { questions: [], error: 'Có câu hỏi đang bị trống nội dung.' };
    }

    const optionValues = QUICK_IMPORT_OPTION_LABELS.map(label => {
      const optionLine = lines.find(line => new RegExp(`^${label}\\s*[.)\\-:]\\s*`, 'i').test(line));
      return optionLine?.replace(new RegExp(`^${label}\\s*[.)\\-:]\\s*`, 'i'), '').trim() || '';
    });

    if (optionValues.some(option => !option)) {
      return {
        questions: [],
        error: 'Mỗi câu phải có đủ 4 phương án bắt đầu bằng A., B., C., D.'
      };
    }

    const answerLine = lines.find(line => /^(?:đáp án|dap an|answer|correct)\s*[:.-]\s*/i.test(line));
    if (!answerLine) {
      return { questions: [], error: 'Thiếu dòng Đáp án: A/B/C/D ở một trong các câu.' };
    }

    const answerValue = answerLine
      .replace(/^(?:đáp án|dap an|answer|correct)\s*[:.-]\s*/i, '')
      .trim()
      .toUpperCase()
      .charAt(0);

    const correctOption = QUICK_IMPORT_OPTION_LABELS.indexOf(answerValue as typeof QUICK_IMPORT_OPTION_LABELS[number]);
    if (correctOption === -1) {
      return { questions: [], error: 'Đáp án chỉ hỗ trợ A, B, C hoặc D.' };
    }

    questions.push({
      id: `question-${Date.now()}-${questions.length}`,
      prompt,
      type: 'MULTIPLE_CHOICE',
      options: optionValues,
      correctOption,
      answerGuide: optionValues[correctOption],
      answerKeywords: [],
      maxScore: 10
    });
  }

  return { questions };
};

export const Elearning: React.FC<ElearningProps> = ({
  tracks,
  profiles,
  attempts,
  leaderboardProfiles = [],
  ranks,
  employees,
  events,
  onSubmitAttempt,
  onUpsertProfile,
  onUpdateTracks,
  onDeleteProfile,
  canEdit = true,
  isAdminView = true,
  canViewTeamProgress = false,
  currentUserId,
  currentUserName,
  currentEmployeeId
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [newSkillText, setNewSkillText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [localTracks, setLocalTracks] = useState<LearningTrack[]>(tracks);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickQuizInput, setQuickQuizInput] = useState<string>('');
  const [quickQuizError, setQuickQuizError] = useState<string>('');
  const [quickQuizSuccess, setQuickQuizSuccess] = useState<string>('');
  const [latestQuizResult, setLatestQuizResult] = useState<QuizResultSummary | null>(null);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTracksRef = useRef<LearningTrack[]>(tracks);

  useEffect(() => {
    setLocalTracks(tracks);
    lastSavedTracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (!isAdminView || !canEdit) return;
    
    const tracksJson = JSON.stringify(localTracks);
    const lastSavedJson = JSON.stringify(lastSavedTracksRef.current);
    
    if (tracksJson === lastSavedJson) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setIsSaving(true);
    autoSaveTimeoutRef.current = setTimeout(() => {
      onUpdateTracks(localTracks);
      lastSavedTracksRef.current = localTracks;
      setIsSaving(false);
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [localTracks, isAdminView, canEdit, onUpdateTracks]);

  const profileOptions = useMemo(() => {
    if (!currentUserId && !currentUserName && !currentEmployeeId) return profiles;

    return profiles.filter(profile =>
      (currentUserId && (profile.userAccountId === currentUserId || profile.id === `learning-user-${currentUserId}`)) ||
      (currentUserName && (profile.userName === currentUserName || profile.name === currentUserName)) ||
      (currentEmployeeId && profile.employeeId === currentEmployeeId)
    );
  }, [profiles, currentUserId, currentUserName, currentEmployeeId]);

  const activeProfile = useMemo(() => profileOptions[0] || null, [profileOptions]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return localTracks;
    const query = searchQuery.toLowerCase();
    return localTracks.filter(track =>
      track.title.toLowerCase().includes(query) ||
      track.description.toLowerCase().includes(query) ||
      track.lessons.some(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.summary.toLowerCase().includes(query) ||
        lesson.skills.some(skill => skill.toLowerCase().includes(query))
      )
    );
  }, [localTracks, searchQuery]);

  const groupedTrainingTracks = useMemo(() => {
    const sortedTracks = [...filteredTracks].sort((a, b) => {
      const levelDelta = LEARNING_LEVEL_ORDER.indexOf(a.level) - LEARNING_LEVEL_ORDER.indexOf(b.level);
      if (levelDelta !== 0) return levelDelta;
      return a.title.localeCompare(b.title, 'vi');
    });

    return LEARNING_LEVEL_ORDER.map(level => ({
      level,
      ...LEARNING_LEVEL_META[level],
      tracks: sortedTracks.filter(track => track.level === level)
    })).filter(group => group.tracks.length > 0);
  }, [filteredTracks]);

  useEffect(() => {
    if (!currentUserId || activeProfile) return;

    const employee = currentEmployeeId ? employees.find(e => e.id === currentEmployeeId) : null;
    const newProfile: LearningProfile = {
      id: `learning-user-${currentUserId}`,
      employeeId: employee?.id,
      userAccountId: currentUserId,
      userName: currentUserName || employee?.name || 'Người dùng',
      name: currentUserName || employee?.name || 'Người dùng',
      tenureMonths: 0,
      eventsAttended: 0,
      scenarioScore: 0,
      roleHistory: employee?.role ? [employee.role] : [],
      progress: {},
      completedLessons: [],
      certificates: [],
      totalScore: 0,
      rankId: null
    };
    onUpsertProfile(newProfile);
  }, [currentUserId, currentUserName, currentEmployeeId, activeProfile, employees, onUpsertProfile]);

  const selectedTrack = useMemo(() => localTracks.find(t => t.id === selectedTrackId) || null, [localTracks, selectedTrackId]);
  const selectedLesson = useMemo(() => selectedTrack?.lessons.find(l => l.id === selectedLessonId) || null, [selectedTrack, selectedLessonId]);

  useEffect(() => {
    setQuickQuizInput('');
    setQuickQuizError('');
    setQuickQuizSuccess('');
    setLatestQuizResult(null);
  }, [selectedLessonId]);

  const getVideoEmbedSource = (sourceUrl: string) => {
    const driveIdMatch = sourceUrl.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|drive\.google\.com\/uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveIdMatch) {
      return { type: 'iframe' as const, src: `https://drive.google.com/file/d/${driveIdMatch[1]}/preview` };
    }

    const queryIdMatch = sourceUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryIdMatch) {
      return { type: 'iframe' as const, src: `https://drive.google.com/file/d/${queryIdMatch[1]}/preview` };
    }

    const isDirectVideo = /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(sourceUrl);
    return { type: isDirectVideo ? 'video' as const : 'iframe' as const, src: sourceUrl };
  };

  const profileAttempts = useMemo(() =>
    attempts.filter(a => a.learnerId === activeProfile?.id),
    [attempts, activeProfile?.id]
  );

  const latestAttemptsByQuestionId = useMemo(() => {
    const sortedAttempts = [...profileAttempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const attemptMap = new Map<string, LearningAttempt>();

    sortedAttempts.forEach(attempt => {
      if (!attemptMap.has(attempt.questionId)) {
        attemptMap.set(attempt.questionId, attempt);
      }
    });

    return attemptMap;
  }, [profileAttempts]);

  const lessonQuestions = useMemo(() => {
    if (!selectedLesson) return [];
    return selectedLesson.questions;
  }, [selectedLesson]);

  const lessonProgressMap = useMemo(() => {
    const progressMap = new Map<string, LessonProgressSummary>();

    localTracks.forEach(track => {
      track.lessons.forEach(lesson => {
        const questionAttempts = lesson.questions
          .map(question => {
            const attempt = latestAttemptsByQuestionId.get(question.id);
            if (!attempt) return null;
            const maxScore = question.maxScore || 10;
            const isCorrect = question.type === 'MULTIPLE_CHOICE'
              ? attempt.selectedOption === question.correctOption
              : attempt.score >= maxScore;

            return { question, attempt, isCorrect, maxScore };
          })
          .filter(Boolean) as Array<{ question: LearningQuestion; attempt: LearningAttempt; isCorrect: boolean; maxScore: number }>;

        const answeredCount = questionAttempts.length;
        const totalQuestions = lesson.questions.length;
        const totalScore = questionAttempts.reduce((sum, item) => sum + item.attempt.score, 0);
        const maxScore = lesson.questions.reduce((sum, question) => sum + (question.maxScore || 10), 0);
        const correctCount = questionAttempts.filter(item => item.isCorrect).length;
        const completed = totalQuestions > 0 && answeredCount === totalQuestions;

        progressMap.set(lesson.id, {
          lessonId: lesson.id,
          answeredCount,
          totalQuestions,
          totalScore,
          maxScore,
          correctCount,
          completed
        });
      });
    });

    return progressMap;
  }, [localTracks, latestAttemptsByQuestionId]);

  const overallLearningProgress = useMemo(() => {
    const lessons = localTracks.flatMap(track => track.lessons);
    const summaries = lessons.map(lesson => lessonProgressMap.get(lesson.id)).filter(Boolean) as LessonProgressSummary[];
    const completedLessons = summaries.filter(summary => summary.completed).length;
    const totalLessons = lessons.length;
    const totalScore = summaries.reduce((sum, summary) => sum + summary.totalScore, 0);
    const maxScore = summaries.reduce((sum, summary) => sum + summary.maxScore, 0);

    return {
      completedLessons,
      totalLessons,
      totalScore,
      maxScore
    };
  }, [localTracks, lessonProgressMap]);

  const trackProgressMap = useMemo(() => {
    const progressMap = new Map<string, TrackProgressSummary>();

    localTracks.forEach(track => {
      const lessonSummaries = track.lessons
        .map(lesson => lessonProgressMap.get(lesson.id))
        .filter(Boolean) as LessonProgressSummary[];
      const completedLessons = lessonSummaries.filter(summary => summary.completed).length;
      const totalLessons = track.lessons.length;
      const totalScore = lessonSummaries.reduce((sum, summary) => sum + summary.totalScore, 0);
      const maxScore = lessonSummaries.reduce((sum, summary) => sum + summary.maxScore, 0);

      progressMap.set(track.id, {
        trackId: track.id,
        completedLessons,
        totalLessons,
        totalScore,
        maxScore,
        completed: totalLessons > 0 && completedLessons === totalLessons
      });
    });

    return progressMap;
  }, [localTracks, lessonProgressMap]);

  const profileAttemptsByLearnerId = useMemo(() => {
    const groupedAttempts = new Map<string, LearningAttempt[]>();

    attempts.forEach(attempt => {
      const currentAttempts = groupedAttempts.get(attempt.learnerId) || [];
      currentAttempts.push(attempt);
      groupedAttempts.set(attempt.learnerId, currentAttempts);
    });

    return groupedAttempts;
  }, [attempts]);

  const teamProgressRows = useMemo(() => {
    if (!canViewTeamProgress) return [];

    const totalLessons = localTracks.reduce((sum, track) => sum + track.lessons.length, 0);
    const totalTracks = localTracks.length;
    const maxScorePerLearner = localTracks.reduce(
      (sum, track) => sum + track.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.questions.reduce((questionSum, question) => questionSum + (question.maxScore || 10), 0), 0),
      0
    );

    const rows = profiles.map(profile => {
      const learnerAttempts = profileAttemptsByLearnerId.get(profile.id) || [];
      const latestAttempts = new Map<string, LearningAttempt>();

      [...learnerAttempts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .forEach(attempt => {
          if (!latestAttempts.has(attempt.questionId)) {
            latestAttempts.set(attempt.questionId, attempt);
          }
        });

      let completedLessons = 0;
      let completedTracks = 0;
      let totalScore = 0;

      localTracks.forEach(track => {
        let completedInTrack = 0;

        track.lessons.forEach(lesson => {
          const answeredCount = lesson.questions.filter(question => latestAttempts.has(question.id)).length;
          const lessonScore = lesson.questions.reduce((sum, question) => sum + (latestAttempts.get(question.id)?.score || 0), 0);

          totalScore += lessonScore;

          if (lesson.questions.length > 0 && answeredCount === lesson.questions.length) {
            completedLessons += 1;
            completedInTrack += 1;
          }
        });

        if (track.lessons.length > 0 && completedInTrack === track.lessons.length) {
          completedTracks += 1;
        }
      });

      const completionRate = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
      const pendingLessons = Math.max(0, totalLessons - completedLessons);
      const latestActivityAt = learnerAttempts
        .map(attempt => attempt.createdAt)
        .sort((a, b) => b.localeCompare(a))[0];
      const latestActivityText = getRelativeActivityLabel(latestActivityAt);
      const inactiveDays = latestActivityAt
        ? Math.floor((Date.now() - new Date(latestActivityAt).getTime()) / (1000 * 60 * 60 * 24))
        : Number.POSITIVE_INFINITY;

      let status: TeamProgressRow['status'] = 'IN_PROGRESS';
      let statusLabel = 'Đang học';
      let statusClassName = 'bg-blue-100 text-blue-700';

      if (completedLessons === 0 && learnerAttempts.length === 0) {
        status = 'NOT_STARTED';
        statusLabel = 'Chưa bắt đầu';
        statusClassName = 'bg-slate-100 text-slate-700';
      } else if (completionRate === 100) {
        status = 'COMPLETED';
        statusLabel = 'Hoàn thành';
        statusClassName = 'bg-emerald-100 text-emerald-700';
      } else if (inactiveDays >= 7 || completionRate < 30) {
        status = 'AT_RISK';
        statusLabel = 'Cần đốc thúc';
        statusClassName = 'bg-rose-100 text-rose-700';
      } else if (completionRate >= 70) {
        status = 'ON_TRACK';
        statusLabel = 'Đúng tiến độ';
        statusClassName = 'bg-amber-100 text-amber-700';
      }

      const employee = profile.employeeId ? employees.find(item => item.id === profile.employeeId) : null;
      const roleLabel = employee?.role || profile.roleHistory?.[profile.roleHistory.length - 1] || 'Chưa cập nhật';

      return {
        id: profile.id,
        name: profile.userName || profile.name,
        roleLabel,
        completedLessons,
        totalLessons,
        completionRate,
        completedTracks,
        totalTracks,
        totalScore,
        maxScore: maxScorePerLearner,
        attemptCount: learnerAttempts.length,
        pendingLessons,
        status,
        statusLabel,
        statusClassName,
        latestActivityText,
        latestActivityAt
      };
    });

    return rows.sort((a, b) => {
      const statusPriority = ['AT_RISK', 'NOT_STARTED', 'IN_PROGRESS', 'ON_TRACK', 'COMPLETED'];
      const statusDelta = statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status);
      if (statusDelta !== 0) return statusDelta;
      if ((a.latestActivityAt || '') !== (b.latestActivityAt || '')) {
        return (a.latestActivityAt || '').localeCompare(b.latestActivityAt || '');
      }
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [canViewTeamProgress, localTracks, profiles, profileAttemptsByLearnerId, employees]);

  const teamProgressSummary = useMemo(() => {
    const totalMembers = teamProgressRows.length;
    const completedMembers = teamProgressRows.filter(row => row.status === 'COMPLETED').length;
    const atRiskMembers = teamProgressRows.filter(row => row.status === 'AT_RISK' || row.status === 'NOT_STARTED').length;
    const activeMembers = teamProgressRows.filter(row => row.attemptCount > 0).length;
    const avgCompletionRate = totalMembers === 0
      ? 0
      : Math.round(teamProgressRows.reduce((sum, row) => sum + row.completionRate, 0) / totalMembers);

    return {
      totalMembers,
      completedMembers,
      atRiskMembers,
      activeMembers,
      avgCompletionRate
    };
  }, [teamProgressRows]);

  const sortedLeaderboardProfiles = useMemo(() =>
    [...leaderboardProfiles]
      .filter(profile => (profile.userName || profile.name) && typeof (profile.totalScore ?? 0) === 'number')
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)),
    [leaderboardProfiles]
  );

  const handleSelectLesson = (trackId: string, lessonId: string) => {
    setSelectedTrackId(trackId);
    setSelectedLessonId(lessonId);
    setViewMode('lesson');
    setAnswers({});
    setRevealed({});
  };

  const handleOpenTrainingView = () => {
    setViewMode('training');
  };

  const handleOpenProgressView = () => {
    setViewMode('progress');
  };

  const handleOpenLeaderboardView = () => {
    setViewMode('leaderboard');
  };

  const handleOpenTeamProgressView = () => {
    setViewMode('teamProgress');
  };

  const handleStartQuiz = () => {
    const hydratedAnswers: Record<string, AnswerDraft> = {};

    lessonQuestions.forEach(question => {
      const latestAttempt = latestAttemptsByQuestionId.get(question.id);
      if (!latestAttempt) return;

      hydratedAnswers[question.id] = {
        selectedOption: latestAttempt.selectedOption,
        answerText: latestAttempt.answerText
      };
    });

    setAnswers(hydratedAnswers);
    setLatestQuizResult(null);
    setViewMode('quiz');
  };

  const handleBackToTopics = () => {
    setViewMode('training');
    setSelectedTrackId('');
    setSelectedLessonId('');
  };

  const handleBackToHome = () => {
    setViewMode('home');
    setSelectedTrackId('');
    setSelectedLessonId('');
    setLatestQuizResult(null);
  };

  const handleBackToLesson = () => {
    setViewMode('lesson');
  };

  const createAttemptFromDraft = (question: LearningQuestion): LearningAttempt | null => {
    if (!activeProfile || !selectedTrack || !selectedLesson) return null;
    const draft = answers[question.id];
    if (!draft || (question.type === 'MULTIPLE_CHOICE' && draft.selectedOption === undefined) || (question.type === 'OPEN' && !draft.answerText?.trim())) {
      return null;
    }

    const maxScore = question.maxScore || 10;
    let score = 0;
    let feedback = '';

    if (question.type === 'MULTIPLE_CHOICE') {
      const isCorrect = draft.selectedOption === question.correctOption;
      score = isCorrect ? maxScore : 0;
      feedback = isCorrect ? 'Chính xác' : `Đáp án đúng: ${question.options?.[question.correctOption || 0] || ''}`;
    } else {
      const text = (draft.answerText || '').toLowerCase();
      const keywords = question.answerKeywords || [];
      const matchCount = keywords.filter(k => text.includes(k.toLowerCase())).length;
      if (keywords.length > 0) {
        score = Math.max(4, Math.round((matchCount / keywords.length) * maxScore));
      } else {
        score = Math.min(maxScore, Math.max(5, Math.floor(text.length / 25)));
      }
      feedback = `Điểm ${score}/${maxScore}. ${question.answerGuide || 'Tham khảo đáp án gợi ý.'}`;
    }

    return {
      id: `attempt-${Date.now()}-${question.id}`,
      learnerId: activeProfile.id,
      trackId: selectedTrack.id,
      lessonId: selectedLesson.id,
      questionId: question.id,
      type: question.type,
      selectedOption: draft.selectedOption,
      answerText: draft.answerText,
      score,
      feedback,
      createdAt: new Date().toISOString()
    };
  };

  const handleSubmitAll = () => {
    if (isAdminView) return;
    if (!canEdit) return;
    if (!activeProfile || !selectedTrack || !selectedLesson) {
      alert('Không tìm thấy hồ sơ học tập của tài khoản hiện tại.');
      return;
    }

    for (const question of lessonQuestions) {
      const draft = answers[question.id];
      if (!draft || (question.type === 'MULTIPLE_CHOICE' && draft.selectedOption === undefined) || (question.type === 'OPEN' && !draft.answerText?.trim())) {
        alert('Vui lòng hoàn tất tất cả câu hỏi trước khi nộp bài.');
        return;
      }
    }

    const attemptsToSubmit = lessonQuestions
      .map(question => createAttemptFromDraft(question))
      .filter(Boolean) as LearningAttempt[];

    if (attemptsToSubmit.length !== lessonQuestions.length) {
      alert('Có lỗi khi chấm bài. Vui lòng thử lại.');
      return;
    }

    attemptsToSubmit.forEach(attempt => onSubmitAttempt(attempt));

    const resultItems: QuizResultItem[] = lessonQuestions.map(question => {
      const attempt = attemptsToSubmit.find(item => item.questionId === question.id)!;
      const correctAnswerText = question.type === 'MULTIPLE_CHOICE'
        ? question.options?.[question.correctOption ?? 0] || ''
        : question.answerGuide || '';
      const userAnswerText = question.type === 'MULTIPLE_CHOICE'
        ? question.options?.[attempt.selectedOption ?? 0] || ''
        : attempt.answerText || '';
      const maxScore = question.maxScore || 10;
      const isCorrect = question.type === 'MULTIPLE_CHOICE'
        ? attempt.selectedOption === question.correctOption
        : attempt.score >= maxScore;

      return {
        question,
        attempt,
        isCorrect,
        userAnswerText,
        correctAnswerText
      };
    });

    const totalScore = resultItems.reduce((sum, item) => sum + item.attempt.score, 0);
    const maxScore = lessonQuestions.reduce((sum, question) => sum + (question.maxScore || 10), 0);
    const correctCount = resultItems.filter(item => item.isCorrect).length;

    setRevealed(Object.fromEntries(lessonQuestions.map(question => [question.id, true])));
    setLatestQuizResult({
      lessonTitle: selectedLesson.title,
      totalScore,
      maxScore,
      correctCount,
      totalQuestions: lessonQuestions.length,
      items: resultItems
    });

    const existingCompletedLessons = new Set(activeProfile.completedLessons || []);
    existingCompletedLessons.add(selectedLesson.id);
    onUpsertProfile({
      ...activeProfile,
      completedLessons: Array.from(existingCompletedLessons)
    });

    setViewMode('result');
  };

  const updateSelectedTrack = (updater: (track: LearningTrack) => LearningTrack) => {
    if (!selectedTrack || !canEdit) return;
    const updatedTracks = localTracks.map(track => track.id === selectedTrack.id ? updater(track) : track);
    setLocalTracks(updatedTracks);
  };

  const updateSelectedLesson = (updater: (lesson: LearningLesson) => LearningLesson) => {
    if (!selectedTrack || !selectedLesson || !canEdit) return;
    updateSelectedTrack(track => ({
      ...track,
      lessons: track.lessons.map(lesson => lesson.id === selectedLesson.id ? updater(lesson) : lesson)
    }));
  };

  const handleAddLesson = (trackId: string) => {
    if (!canEdit) return;
    const newLesson: LearningLesson = {
      id: `lesson-${Date.now()}`,
      title: 'Bài học mới',
      mediaType: 'video',
      mediaUrl: '',
      duration: '',
      summary: '',
      skills: [],
      questions: []
    };
    const updatedTracks = localTracks.map(track => track.id === trackId ? {
      ...track,
      lessons: [...track.lessons, newLesson]
    } : track);
    setLocalTracks(updatedTracks);
    setSelectedTrackId(trackId);
    setSelectedLessonId(newLesson.id);
    setViewMode('lesson');
  };

  const handleLessonFieldChange = <K extends keyof LearningLesson>(field: K, value: LearningLesson[K]) => {
    updateSelectedLesson(lesson => ({ ...lesson, [field]: value }));
  };

  const handleAddSkill = () => {
    if (!newSkillText.trim()) return;
    updateSelectedLesson(lesson => ({ ...lesson, skills: [...lesson.skills, newSkillText.trim()] }));
    setNewSkillText('');
  };

  const handleRemoveSkill = (index: number) => {
    updateSelectedLesson(lesson => ({ ...lesson, skills: lesson.skills.filter((_, i) => i !== index) }));
  };

  const handleSkillChange = (index: number, value: string) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      skills: lesson.skills.map((skill, i) => i === index ? value : skill)
    }));
  };

  const handleAddQuestion = () => {
    const newQuestion: LearningQuestion = {
      id: `question-${Date.now()}`,
      prompt: 'Câu hỏi mới',
      type: 'MULTIPLE_CHOICE',
      options: ['Lựa chọn 1', 'Lựa chọn 2'],
      correctOption: 0,
      answerGuide: '',
      answerKeywords: [],
      maxScore: 10
    };
    updateSelectedLesson(lesson => ({ ...lesson, questions: [...lesson.questions, newQuestion] }));
  };

  const handleDeleteQuestion = (questionId: string) => {
    updateSelectedLesson(lesson => ({ ...lesson, questions: lesson.questions.filter(q => q.id !== questionId) }));
  };

  const handleQuickQuizImport = () => {
    const result = parseQuickQuizImport(quickQuizInput);

    if (result.error) {
      setQuickQuizError(result.error);
      setQuickQuizSuccess('');
      return;
    }

    if (result.questions.length === 0) {
      setQuickQuizError('Không tìm thấy câu hỏi hợp lệ để thêm.');
      setQuickQuizSuccess('');
      return;
    }

    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: [...lesson.questions, ...result.questions]
    }));

    setQuickQuizSuccess(`Đã thêm ${result.questions.length} câu trắc nghiệm.`);
    setQuickQuizError('');
    setQuickQuizInput('');
  };

  const handleTrackFieldChange = <K extends keyof LearningTrack>(field: K, value: LearningTrack[K]) => {
    if (!selectedTrack || !canEdit) return;
    updateSelectedTrack(track => ({ ...track, [field]: value }));
  };

  const handleAddTrack = () => {
    if (!canEdit) return;
    const newLesson: LearningLesson = {
      id: `lesson-${Date.now()}`,
      title: 'Bài học mới',
      mediaType: 'video',
      mediaUrl: '',
      duration: '',
      summary: '',
      skills: [],
      questions: []
    };

    const newTrack: LearningTrack = {
      id: `track-${Date.now()}`,
      title: 'Chủ đề mới',
      description: 'Mô tả chủ đề',
      focus: 'OPERATIONS',
      level: 'BASE',
      badge: 'New',
      lessons: [newLesson]
    };

    setLocalTracks([...localTracks, newTrack]);
    setSelectedTrackId(newTrack.id);
    setSelectedLessonId(newLesson.id);
    setViewMode('lesson');
  };

  const handleDeleteTrack = (trackId: string) => {
    if (!canEdit || !canViewTeamProgress) return;

    const trackToDelete = localTracks.find(track => track.id === trackId);
    if (!trackToDelete) return;

    const shouldDelete = window.confirm(`Xóa chủ đề "${trackToDelete.title}" và toàn bộ bài học bên trong?`);
    if (!shouldDelete) return;

    const updatedTracks = localTracks.filter(track => track.id !== trackId);
    setLocalTracks(updatedTracks);

    if (selectedTrackId === trackId) {
      setSelectedTrackId('');
      setSelectedLessonId('');
      setLatestQuizResult(null);
      setViewMode('training');
    }
  };

  const handleQuestionChange = (questionId: string, patch: Partial<LearningQuestion>) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => q.id === questionId ? { ...q, ...patch } : q)
    }));
  };

  const handleOptionChange = (questionId: string, index: number, value: string) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => {
        if (q.id !== questionId) return q;
        const options = [...(q.options || [])];
        options[index] = value;
        return { ...q, options };
      })
    }));
  };

  const handleAddOption = (questionId: string) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => {
        if (q.id !== questionId) return q;
        const options = [...(q.options || []), `Lựa chọn ${((q.options || []).length || 0) + 1}`];
        return { ...q, options };
      })
    }));
  };

  const handleRemoveOption = (questionId: string, index: number) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => {
        if (q.id !== questionId) return q;
        const options = (q.options || []).filter((_, idx) => idx !== index);
        const correctOption = q.correctOption !== undefined && q.correctOption >= options.length ? Math.max(0, options.length - 1) : q.correctOption;
        return { ...q, options, correctOption };
      })
    }));
  };

  const handleSetCorrectOption = (questionId: string, index: number) => {
    handleQuestionChange(questionId, { correctOption: index });
  };

  const renderHomeView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <GraduationCap size={24} />
          <div>
            <h1 className="text-2xl font-bold">Kênh Học Tập</h1>
            <p className="text-slate-100">Chọn chức năng bạn muốn sử dụng trong Elearning</p>
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${canViewTeamProgress ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
        <button
          onClick={handleOpenTrainingView}
          className="rounded-2xl border border-blue-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        >
          <div className="inline-flex rounded-2xl bg-blue-100 p-3 text-blue-700">
            <BookOpenCheck size={22} />
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-800">1. Tham gia đào tạo</div>
          <p className="mt-2 text-sm text-slate-600">Vào danh sách chủ đề và bài học để bắt đầu học hoặc làm bài kiểm tra.</p>
        </button>

        <button
          onClick={handleOpenProgressView}
          className="rounded-2xl border border-emerald-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
        >
          <div className="inline-flex rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <Target size={22} />
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-800">2. Tiến độ học tập</div>
          <p className="mt-2 text-sm text-slate-600">Xem tổng điểm, số bài đã hoàn thành và tiến độ theo từng chủ đề.</p>
        </button>

        <button
          onClick={handleOpenLeaderboardView}
          className="rounded-2xl border border-amber-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
        >
          <div className="inline-flex rounded-2xl bg-amber-100 p-3 text-amber-700">
            <Trophy size={22} />
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-800">3. Bảng xếp hạng</div>
          <p className="mt-2 text-sm text-slate-600">Xem top người học có điểm cao nhất và mở rộng danh sách khi cần.</p>
        </button>

        {canViewTeamProgress && (
          <button
            onClick={handleOpenTeamProgressView}
            className="rounded-2xl border border-rose-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
          >
            <div className="inline-flex rounded-2xl bg-rose-100 p-3 text-rose-700">
              <Users size={22} />
            </div>
            <div className="mt-4 text-lg font-semibold text-slate-800">4. Theo dõi tiến độ nhân viên</div>
            <p className="mt-2 text-sm text-slate-600">Theo dõi toàn bộ nhân sự, phát hiện người học chậm và đốc thúc kiểm tra kịp thời.</p>
          </button>
        )}
      </div>
    </div>
  );

  const renderTrainingView = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToHome}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Quay lại trang chủ
        </button>
        <div className="text-sm text-slate-500">Tham gia đào tạo</div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm bài học..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {isAdminView && canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleAddTrack}
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            + Thêm chủ đề mới
          </button>
        </div>
      )}

      {groupedTrainingTracks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Không tìm thấy chủ đề phù hợp với từ khóa đang nhập.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTrainingTracks.map(group => (
            <section
              key={group.level}
              className={`rounded-2xl border p-5 ${group.sectionClassName}`}
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-800">{group.label}</h2>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600">
                      {group.tracks.length} chủ đề
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.tracks.map(track => (
                  <div key={track.id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-2 text-lg font-semibold text-slate-800">{track.title}</h3>
                        <p className="mb-3 text-sm text-slate-600">{track.description}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className={`rounded-full px-2 py-1 font-medium ${group.badgeClassName}`}>
                            {group.label}
                          </span>
                          <span>{track.lessons.length} bài học</span>
                        </div>
                      </div>
                      <div className="ml-3 flex flex-col items-end gap-2">
                        <div className="text-2xl">{track.badge}</div>
                        {canViewTeamProgress && canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTrack(track.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                          >
                            Xóa chủ đề
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {track.lessons.map(lesson => (
                        <button
                          key={lesson.id}
                          onClick={() => handleSelectLesson(track.id, lesson.id)}
                          className="w-full rounded-lg border border-slate-100 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                        >
                          {(() => {
                            const lessonProgress = lessonProgressMap.get(lesson.id);
                            return (
                              <div className="flex items-center gap-3">
                                <PlayCircle className="text-blue-600" size={16} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
                                    {activeProfile && lessonProgress?.completed && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                        <CheckCircle2 size={12} />
                                        Hoàn thành
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">{lesson.duration || 'N/A'}</p>
                                  {activeProfile && lessonProgress && lessonProgress.totalQuestions > 0 && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      Điểm: {lessonProgress.totalScore}/{lessonProgress.maxScore} • Đúng {lessonProgress.correctCount}/{lessonProgress.totalQuestions}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                    {isAdminView && canEdit && (
                      <div className="mt-4">
                        <button
                          onClick={() => handleAddLesson(track.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          + Thêm bài học mới
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  const renderProgressView = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToHome}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Quay lại trang chủ
        </button>
        <div className="text-sm text-slate-500">Tiến độ học tập</div>
      </div>

      {!activeProfile ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Chưa có dữ liệu học tập cho tài khoản này.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="text-sm font-semibold text-emerald-900">Tiến độ học tập</div>
              <div className="mt-2 text-3xl font-bold text-emerald-700">
                {overallLearningProgress.completedLessons}/{overallLearningProgress.totalLessons}
              </div>
              <div className="mt-1 text-sm text-emerald-800">Bài học đã hoàn thành</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="text-sm font-semibold text-blue-900">Tổng điểm tích lũy</div>
              <div className="mt-2 text-3xl font-bold text-blue-700">
                {overallLearningProgress.totalScore}/{overallLearningProgress.maxScore}
              </div>
              <div className="mt-1 text-sm text-blue-800">Từ các bài đã làm</div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-900">Chứng nhận hoàn thành</div>
              <div className="mt-2 flex items-center gap-2 text-amber-800">
                <CheckCircle2 size={20} />
                <span className="text-sm">Bài nào làm đủ câu sẽ được tick xanh</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-800">Thống kê theo chủ đề</h2>
              <p className="mt-1 text-sm text-slate-500">Xem điểm hiện tại và trạng thái hoàn thành của từng chủ đề học.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Chủ đề</th>
                    <th className="px-5 py-3 text-left font-semibold">Điểm hiện tại</th>
                    <th className="px-5 py-3 text-left font-semibold">Bài hoàn thành</th>
                    <th className="px-5 py-3 text-left font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {localTracks.map(track => {
                    const trackProgress = trackProgressMap.get(track.id);

                    return (
                      <tr key={track.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">{track.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{track.level} • {track.lessons.length} bài học</div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {trackProgress?.totalScore || 0}/{trackProgress?.maxScore || 0}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {trackProgress?.completedLessons || 0}/{trackProgress?.totalLessons || track.lessons.length}
                        </td>
                        <td className="px-5 py-4">
                          {trackProgress?.completed ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={14} />
                              Đã hoàn thành
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                              <XCircle size={14} />
                              Chưa hoàn thành
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderLeaderboardView = () => {
    const visibleProfiles = showFullLeaderboard ? sortedLeaderboardProfiles : sortedLeaderboardProfiles.slice(0, 10);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToHome}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại trang chủ
          </button>
          <div className="text-sm text-slate-500">Bảng xếp hạng</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Top người tham gia đào tạo</h2>
            <p className="mt-1 text-sm text-slate-500">Hiển thị theo tổng điểm tích lũy hiện tại.</p>
          </div>

          {visibleProfiles.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-600">Chưa có dữ liệu xếp hạng.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Hạng</th>
                    <th className="px-5 py-3 text-left font-semibold">Tên</th>
                    <th className="px-5 py-3 text-left font-semibold">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProfiles.map((profile, index) => (
                    <tr key={profile.userAccountId || profile.id || profile.name} className="border-t border-slate-100">
                      <td className="px-5 py-4 font-medium text-slate-700">#{index + 1}</td>
                      <td className="px-5 py-4 text-slate-800">{profile.userName || profile.name}</td>
                      <td className="px-5 py-4 text-slate-700">{profile.totalScore || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sortedLeaderboardProfiles.length > 10 && (
            <div className="border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowFullLeaderboard(prev => !prev)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {showFullLeaderboard ? 'Thu gọn danh sách' : 'Xổ thêm danh sách'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTeamProgressView = () => {
    const priorityRows = teamProgressRows.filter(row => row.status === 'AT_RISK' || row.status === 'NOT_STARTED');

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToHome}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại trang chủ
          </button>
          <div className="text-sm text-slate-500">Theo dõi tiến độ học tập nhân viên</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bảng theo dõi toàn đội</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tổng hợp tiến độ, kết quả và mức độ cần đốc thúc của tất cả nhân viên trong Elearning.
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Ưu tiên theo dõi: {teamProgressSummary.atRiskMembers} nhân viên đang chậm tiến độ hoặc chưa bắt đầu.
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="text-sm font-semibold text-blue-900">Tổng nhân viên</div>
            <div className="mt-2 text-3xl font-bold text-blue-700">{teamProgressSummary.totalMembers}</div>
            <div className="mt-1 text-sm text-blue-800">Đang có hồ sơ học tập</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="text-sm font-semibold text-emerald-900">Hoàn thành đủ</div>
            <div className="mt-2 text-3xl font-bold text-emerald-700">{teamProgressSummary.completedMembers}</div>
            <div className="mt-1 text-sm text-emerald-800">Đã hoàn tất toàn bộ bài học</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="text-sm font-semibold text-amber-900">Đang hoạt động</div>
            <div className="mt-2 text-3xl font-bold text-amber-700">{teamProgressSummary.activeMembers}</div>
            <div className="mt-1 text-sm text-amber-800">Đã có bài làm trên hệ thống</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
            <div className="text-sm font-semibold text-rose-900">Cần đốc thúc</div>
            <div className="mt-2 text-3xl font-bold text-rose-700">{teamProgressSummary.atRiskMembers}</div>
            <div className="mt-1 text-sm text-rose-800">Chậm hoặc chưa bắt đầu học</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-700">TB hoàn thành</div>
            <div className="mt-2 text-3xl font-bold text-slate-800">{teamProgressSummary.avgCompletionRate}%</div>
            <div className="mt-1 text-sm text-slate-600">Mức hoàn thành bình quân</div>
          </div>
        </div>

        {priorityRows.length > 0 && (
          <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-rose-100 bg-rose-50 px-5 py-4">
              <h3 className="text-lg font-semibold text-rose-800">Danh sách cần ưu tiên nhắc học</h3>
              <p className="mt-1 text-sm text-rose-600">Các nhân sự dưới đây đang chậm tiến độ, ít hoạt động hoặc chưa bắt đầu học.</p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {priorityRows.map(row => (
                <div key={row.id} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{row.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.roleLabel}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${row.statusClassName}`}>
                      {row.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    Hoàn thành {row.completedLessons}/{row.totalLessons} bài học • Còn thiếu {row.pendingLessons} bài
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Hoạt động gần nhất: {row.latestActivityText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-800">Chi tiết theo nhân viên</h3>
            <p className="mt-1 text-sm text-slate-500">Dùng bảng này để kiểm tra tiến độ, điểm số và xác định người cần follow-up.</p>
          </div>

          {teamProgressRows.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-600">Chưa có hồ sơ học tập để theo dõi.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Nhân viên</th>
                    <th className="px-5 py-3 text-left font-semibold">Tiến độ</th>
                    <th className="px-5 py-3 text-left font-semibold">Chủ đề</th>
                    <th className="px-5 py-3 text-left font-semibold">Điểm</th>
                    <th className="px-5 py-3 text-left font-semibold">Lần học gần nhất</th>
                    <th className="px-5 py-3 text-left font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {teamProgressRows.map(row => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">{row.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.roleLabel}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.attemptCount} lượt làm bài</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div className="font-medium">{row.completedLessons}/{row.totalLessons} bài học</div>
                        <div className="mt-2 h-2 w-40 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {row.completionRate}% hoàn thành • Còn {row.pendingLessons} bài
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {row.completedTracks}/{row.totalTracks} chủ đề hoàn tất
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div>{row.totalScore}/{row.maxScore}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Tích lũy hiện tại
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div>{row.latestActivityText}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(row.latestActivityAt)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${row.statusClassName}`}>
                          {row.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLessonView = () => {
    if (!selectedLesson || !selectedTrack) return null;
    const lessonProgress = lessonProgressMap.get(selectedLesson.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToTopics}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại chủ đề
          </button>
          <div className="text-sm text-slate-500">
            {selectedTrack.title} / {selectedLesson.title}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{selectedLesson.title}</h2>

            {activeProfile && lessonProgress && (
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-xs font-semibold text-blue-900">Tiến độ bài học</div>
                  <div className="mt-2 text-2xl font-bold text-blue-700">
                    {lessonProgress.answeredCount}/{lessonProgress.totalQuestions}
                  </div>
                  <div className="text-sm text-blue-800">Câu đã làm</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold text-emerald-900">Điểm hiện tại</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-700">
                    {lessonProgress.totalScore}/{lessonProgress.maxScore}
                  </div>
                  <div className="text-sm text-emerald-800">Tổng điểm bài học</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-700">Trạng thái</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                    {lessonProgress.completed ? <CheckCircle2 className="text-emerald-600" size={18} /> : <XCircle className="text-slate-400" size={18} />}
                    {lessonProgress.completed ? 'Đã hoàn thành và được chứng nhận' : 'Chưa hoàn thành'}
                  </div>
                </div>
              </div>
            )}

            {isAdminView && canEdit && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-semibold text-slate-700">Chỉnh sửa chi tiết</div>
                  <div className="flex items-center gap-2">
                    {isSaving && (
                      <div className="inline-flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-xs text-blue-600 font-medium">Đang lưu...</span>
                      </div>
                    )}
                    {!isSaving && (
                      <span className="text-xs text-green-600 font-medium">✓ Đã lưu</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Tiêu đề chủ đề</div>
                    <input
                      value={selectedTrack.title}
                      onChange={e => handleTrackFieldChange('title', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Cấp độ</div>
                    <select
                      value={selectedTrack.level}
                      onChange={e => handleTrackFieldChange('level', e.target.value as LearningTrack['level'])}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="BASE">BASE</option>
                      <option value="ADVANCED">ADVANCED</option>
                      <option value="MASTER">MASTER</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Mô tả chủ đề</div>
                    <textarea
                      value={selectedTrack.description}
                      onChange={e => handleTrackFieldChange('description', e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Phân loại</div>
                    <select
                      value={selectedTrack.focus}
                      onChange={e => handleTrackFieldChange('focus', e.target.value as LearningTrack['focus'])}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="OPERATIONS">Operations</option>
                      <option value="CONTENT">Content</option>
                      <option value="SALES">Sales</option>
                      <option value="LOGISTICS">Logistics</option>
                      <option value="LEADERSHIP">Leadership</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Badge</div>
                    <input
                      value={selectedTrack.badge}
                      onChange={e => handleTrackFieldChange('badge', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="text-sm font-semibold text-slate-800 mb-3">Nội dung bài học</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Tiêu đề bài học</div>
                    <input
                      value={selectedLesson.title}
                      onChange={e => handleLessonFieldChange('title', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Thời lượng</div>
                    <input
                      value={selectedLesson.duration || ''}
                      onChange={e => handleLessonFieldChange('duration', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Loại nội dung</div>
                    <select
                      value={selectedLesson.mediaType}
                      onChange={e => handleLessonFieldChange('mediaType', e.target.value as LearningLesson['mediaType'])}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Link video / tài liệu</div>
                    <input
                      value={selectedLesson.mediaUrl}
                      onChange={e => handleLessonFieldChange('mediaUrl', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Link video bổ sung (tùy chọn)</div>
                    <input
                      value={selectedLesson.videoUrl || ''}
                      onChange={e => handleLessonFieldChange('videoUrl', e.target.value)}
                      placeholder="Link Google Drive hoặc video trực tiếp"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Link tài liệu bổ sung (tùy chọn)</div>
                    <input
                      value={selectedLesson.documentUrl || ''}
                      onChange={e => handleLessonFieldChange('documentUrl', e.target.value)}
                      placeholder="Link PDF hoặc tài liệu khác"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <label className="block sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Link hướng dẫn (tùy chọn)</div>
                    <input
                      value={selectedLesson.guideUrl || ''}
                      onChange={e => handleLessonFieldChange('guideUrl', e.target.value)}
                      placeholder="Link hướng dẫn bổ sung"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <label className="block mt-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Mô tả ngắn</div>
                  <textarea
                    value={selectedLesson.summary}
                    onChange={e => handleLessonFieldChange('summary', e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-600">Kỹ năng học được</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedLesson.skills.map((skill, index) => (
                      <div key={skill + index} className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm">
                        <input
                          value={skill}
                          onChange={e => handleSkillChange(index, e.target.value)}
                          className="bg-transparent text-slate-800 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(index)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <input
                      value={newSkillText}
                      onChange={e => setNewSkillText(e.target.value)}
                      placeholder="Thêm kỹ năng mới"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors sm:mt-0"
                    >
                      Thêm kỹ năng
                    </button>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">Câu hỏi bài học</div>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                    >
                      Thêm câu hỏi
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">Nhập nhanh từ AI</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Mỗi câu cách nhau 1 dòng trống. Format ngắn gọn:
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs leading-6 text-slate-700 border border-blue-100">{`Câu hỏi: Nội dung câu hỏi
A. Phương án 1
B. Phương án 2
C. Phương án 3
D. Phương án 4
Đáp án: B

Câu hỏi: Nội dung câu hỏi tiếp theo
A. ...
B. ...
C. ...
D. ...
Đáp án: D`}</pre>
                    <textarea
                      value={quickQuizInput}
                      onChange={e => {
                        setQuickQuizInput(e.target.value);
                        if (quickQuizError) setQuickQuizError('');
                        if (quickQuizSuccess) setQuickQuizSuccess('');
                      }}
                      rows={12}
                      placeholder="Dán nhiều câu hỏi trắc nghiệm từ AI vào đây..."
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {(quickQuizError || quickQuizSuccess) && (
                      <div className={`mt-3 text-sm ${quickQuizError ? 'text-red-600' : 'text-green-600'}`}>
                        {quickQuizError || quickQuizSuccess}
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleQuickQuizImport}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        Thêm từ ô nhập nhanh
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickQuizInput('');
                          setQuickQuizError('');
                          setQuickQuizSuccess('');
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Xóa nội dung
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {selectedLesson.questions.map((question, index) => (
                      <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-semibold text-slate-800">Câu {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Xóa câu hỏi
                          </button>
                        </div>
                        <label className="block mt-3">
                          <div className="text-xs text-slate-600 mb-2">Nội dung câu hỏi</div>
                          <input
                            value={question.prompt}
                            onChange={e => handleQuestionChange(question.id, { prompt: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2 mt-3">
                          <label className="block">
                            <div className="text-xs text-slate-600 mb-2">Loại câu hỏi</div>
                            <select
                              value={question.type}
                              onChange={e => handleQuestionChange(question.id, { type: e.target.value as LearningQuestion['type'] })}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
                              <option value="OPEN">Tự luận</option>
                            </select>
                          </label>
                          <label className="block">
                            <div className="text-xs text-slate-600 mb-2">Điểm tối đa</div>
                            <input
                              type="number"
                              min={0}
                              value={question.maxScore ?? 10}
                              onChange={e => handleQuestionChange(question.id, { maxScore: Number(e.target.value) })}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </label>
                        </div>
                        {question.type === 'MULTIPLE_CHOICE' && (
                          <div className="mt-4 space-y-3">
                            <div className="text-xs text-slate-600">Các lựa chọn</div>
                            <div className="space-y-2">
                              {question.options?.map((option, optIndex) => (
                                <div key={`${question.id}-opt-${optIndex}`} className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-2 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <input
                                      type="radio"
                                      checked={question.correctOption === optIndex}
                                      onChange={() => handleSetCorrectOption(question.id, optIndex)}
                                    />
                                    <input
                                      value={option}
                                      onChange={e => handleOptionChange(question.id, optIndex, e.target.value)}
                                      className="w-full bg-transparent outline-none text-sm"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(question.id, optIndex)}
                                    className="text-sm text-red-600 hover:text-red-800"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddOption(question.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                              Thêm lựa chọn
                            </button>
                          </div>
                        )}
                        <label className="block mt-4">
                          <div className="text-xs text-slate-600 mb-2">Gợi ý / đáp án</div>
                          <input
                            value={question.answerGuide || ''}
                            onChange={e => handleQuestionChange(question.id, { answerGuide: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Media Section */}
            <div className="mb-6 space-y-4">
              {selectedLesson.videoUrl && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Video</h4>
                  {(() => {
                    const videoSource = getVideoEmbedSource(selectedLesson.videoUrl);
                    return videoSource.type === 'video' ? (
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                          controls
                          className="w-full h-full"
                          src={videoSource.src}
                        >
                          Trình duyệt không hỗ trợ video.
                        </video>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg overflow-hidden bg-slate-950">
                        <iframe
                          src={videoSource.src}
                          className="w-full h-full border-0"
                          title="Video"
                          allow="autoplay; encrypted-media; fullscreen"
                          allowFullScreen
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedLesson.documentUrl && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tài liệu</h4>
                  <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                    <iframe
                      src={selectedLesson.documentUrl}
                      className="w-full h-full border-0"
                      title="Document"
                    />
                  </div>
                </div>
              )}

              {selectedLesson.guideUrl && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Hướng dẫn</h4>
                  <a
                    href={selectedLesson.guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Xem hướng dẫn
                  </a>
                </div>
              )}

              {/* Backward compatibility with old mediaUrl */}
              {!selectedLesson.videoUrl && !selectedLesson.documentUrl && selectedLesson.mediaUrl && (
                <div>
                  {selectedLesson.mediaType === 'video' ? (
                    (() => {
                      const videoSource = getVideoEmbedSource(selectedLesson.mediaUrl);
                      return videoSource.type === 'video' ? (
                        <div className="aspect-video bg-black rounded-lg overflow-hidden">
                          <video
                            controls
                            className="w-full h-full"
                            src={videoSource.src}
                          >
                            Trình duyệt không hỗ trợ video.
                          </video>
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg overflow-hidden bg-slate-950">
                          <iframe
                            src={videoSource.src}
                            className="w-full h-full border-0"
                            title="Video"
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                      <iframe
                        src={selectedLesson.mediaUrl}
                        className="w-full h-full border-0"
                        title="Document"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Tóm tắt</h3>
              <p className="text-slate-600">{selectedLesson.summary}</p>
            </div>

            {/* Skills */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Kỹ năng học được</h3>
              <div className="flex flex-wrap gap-2">
                {selectedLesson.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Quiz Button */}
            {lessonQuestions.length > 0 && (
              <div className="text-center">
                <button
                  onClick={handleStartQuiz}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <CheckSquare size={20} />
                  Kiểm tra
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderQuizView = () => {
    if (!selectedLesson || !selectedTrack) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToLesson}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại bài học
          </button>
          <div className="text-sm text-slate-500">
            Kiểm tra: {selectedLesson.title}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Bài kiểm tra trắc nghiệm</h2>

          <div className="space-y-6">
            {lessonQuestions.map((q, idx) => {
              return (
                <div key={q.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <p className="font-medium text-slate-800">{q.prompt}</p>
                    </div>
                    {answers[q.id] && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        Đang làm
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {q.type === 'MULTIPLE_CHOICE' && q.options?.map((opt, i) => (
                      <label key={opt} className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition ${
                        answers[q.id]?.selectedOption === i ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'
                      }`}>
                        <input
                          type="radio"
                          checked={answers[q.id]?.selectedOption === i}
                          onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], selectedOption: i } }))}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}

                    {q.type === 'OPEN' && (
                      <textarea
                        value={answers[q.id]?.answerText || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], answerText: e.target.value } }))}
                        placeholder="Nhập câu trả lời của bạn..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Sau khi hoàn thành tất cả câu hỏi, nhấn nút nộp để lưu toàn bộ bài kiểm tra.
            </div>
            <button
              onClick={handleSubmitAll}
              className="inline-flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Nộp bài
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderResultView = () => {
    if (!selectedLesson || !latestQuizResult) return null;

    const wrongItems = latestQuizResult.items.filter(item => !item.isCorrect);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToLesson}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại bài học
          </button>
          <div className="text-sm text-slate-500">
            Kết quả: {selectedLesson.title}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800">Kết quả bài kiểm tra</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="text-sm font-semibold text-blue-900">Tổng điểm</div>
              <div className="mt-2 text-3xl font-bold text-blue-700">
                {latestQuizResult.totalScore}/{latestQuizResult.maxScore}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="text-sm font-semibold text-emerald-900">Số câu đúng</div>
              <div className="mt-2 text-3xl font-bold text-emerald-700">
                {latestQuizResult.correctCount}/{latestQuizResult.totalQuestions}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-700">Trạng thái</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                <CheckCircle2 className="text-emerald-600" size={18} />
                Đã lưu kết quả bài làm
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800">Các câu trả lời sai</h3>
            {wrongItems.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                Bạn đã trả lời đúng tất cả câu hỏi trong bài này.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {wrongItems.map((item, index) => (
                  <div key={item.question.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-rose-700">
                      <XCircle size={18} />
                      <span className="text-sm font-semibold">Câu sai {index + 1}</span>
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-800">{item.question.prompt}</div>
                    <div className="mt-2 text-sm text-slate-600">Bạn trả lời: {item.userAnswerText || 'Chưa có câu trả lời'}</div>
                    <div className="mt-1 text-sm text-slate-600">Đáp án đúng: {item.correctAnswerText || 'Không có'}</div>
                    <div className="mt-1 text-sm text-slate-600">Phản hồi: {item.attempt.feedback}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleStartQuiz}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Làm lại bài kiểm tra
            </button>
            <button
              onClick={handleBackToLesson}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Xem lại bài học
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (viewMode === 'home') {
    return renderHomeView();
  } else if (viewMode === 'training') {
    return renderTrainingView();
  } else if (viewMode === 'progress') {
    return renderProgressView();
  } else if (viewMode === 'leaderboard') {
    return renderLeaderboardView();
  } else if (viewMode === 'teamProgress') {
    return renderTeamProgressView();
  } else if (viewMode === 'lesson') {
    return renderLessonView();
  } else if (viewMode === 'quiz') {
    return renderQuizView();
  } else if (viewMode === 'result') {
    return renderResultView();
  }

  return null;
};
