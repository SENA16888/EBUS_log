import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpenCheck, CheckCircle2, Crown, GraduationCap, Lock, PlayCircle, ShieldCheck, Sparkles, Target, Trophy, Users, XCircle } from 'lucide-react';
import { CareerRank, Employee, Event, LearningAttempt, LearningLesson, LearningProfile, LearningQuestion, LearningTrack } from '../types';

interface ElearningProps {
  tracks: LearningTrack[];
  profiles: LearningProfile[];
  attempts: LearningAttempt[];
  ranks: CareerRank[];
  employees: Employee[];
  events: Event[];
  onSubmitAttempt: (attempt: LearningAttempt) => void;
  onUpsertProfile: (profile: LearningProfile) => void;
  onUpdateTracks: (tracks: LearningTrack[]) => void;
  onDeleteProfile: (profileId: string) => void;
  canEdit?: boolean;
  isAdminView?: boolean;
  currentEmployeeId?: string;
}

const PASSING_SCORE = 7;

type AnswerDraft = {
  selectedOption?: number;
  answerText?: string;
};

export const Elearning: React.FC<ElearningProps> = ({
  tracks,
  profiles,
  attempts,
  ranks,
  employees,
  events,
  onSubmitAttempt,
  onUpsertProfile,
  onUpdateTracks,
  onDeleteProfile,
  canEdit = true,
  isAdminView = true,
  currentEmployeeId
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || '');
  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || '');
  const [selectedLessonId, setSelectedLessonId] = useState<string>(tracks[0]?.lessons[0]?.id || '');
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [profileDraft, setProfileDraft] = useState<LearningProfile | null>(profiles[0] || null);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileEmployeeId, setNewProfileEmployeeId] = useState<string>('');
  const [adminTab, setAdminTab] = useState<'profiles' | 'content'>('profiles');

  const profileOptions = useMemo(() => {
    if (isAdminView) return profiles;
    if (!currentEmployeeId) return [];
    return profiles.filter(p => p.employeeId === currentEmployeeId);
  }, [profiles, isAdminView, currentEmployeeId]);

  const employeesById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(emp => map.set(emp.id, emp));
    return map;
  }, [employees]);

  const employeesWithoutProfile = useMemo(() => {
    const profByEmployee = new Set(profiles.map(p => p.employeeId).filter(Boolean) as string[]);
    return employees.filter(emp => !profByEmployee.has(emp.id));
  }, [employees, profiles]);

  const selectedTrack = useMemo(() => tracks.find(t => t.id === selectedTrackId) || tracks[0], [tracks, selectedTrackId]);
  const selectedLesson = useMemo(() => selectedTrack?.lessons.find(l => l.id === selectedLessonId) || selectedTrack?.lessons[0], [selectedLessonId, selectedTrack]);
  const activeProfile = useMemo(() => profileOptions.find(p => p.id === selectedProfileId) || null, [profileOptions, selectedProfileId]);

  useEffect(() => {
    if (profileOptions.length === 0) {
      if (selectedProfileId) setSelectedProfileId('');
      return;
    }
    if (!profileOptions.find(p => p.id === selectedProfileId)) {
      setSelectedProfileId(profileOptions[0].id);
    }
  }, [profileOptions, selectedProfileId]);

  useEffect(() => {
    if (!selectedTrackId && tracks[0]) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [tracks, selectedTrackId]);

  useEffect(() => {
    if (selectedTrack && (!selectedLessonId || !selectedTrack.lessons.find(l => l.id === selectedLessonId))) {
      setSelectedLessonId(selectedTrack.lessons[0]?.id || '');
    }
  }, [selectedTrack, selectedLessonId]);

  useEffect(() => {
    setProfileDraft(activeProfile);
  }, [activeProfile]);

  const profileAttempts = useMemo(
    () => attempts.filter(a => a.learnerId === activeProfile?.id),
    [attempts, activeProfile?.id]
  );

  const eventCountFromData = useMemo(() => {
    if (!activeProfile?.employeeId) return 0;
    return events.reduce((count, ev) => {
      const joined = (ev.staff || []).some(s => s.employeeId === activeProfile.employeeId);
      return count + (joined ? 1 : 0);
    }, 0);
  }, [events, activeProfile?.employeeId]);

  const totalEventCount = Math.max(activeProfile?.eventsAttended || 0, eventCountFromData);

  const getLessonQuestions = (lesson?: LearningLesson) => {
    if (!lesson) return [];
    return isAdminView ? lesson.questions : lesson.questions.filter(q => q.type === 'MULTIPLE_CHOICE');
  };

  const getAverageScoreFromAttempts = (attemptList: LearningAttempt[]) => {
    const bestByQuestion = new Map<string, number>();
    attemptList.forEach(a => {
      bestByQuestion.set(a.questionId, Math.max(bestByQuestion.get(a.questionId) || 0, a.score));
    });
    if (bestByQuestion.size === 0) return 0;
    const total = Array.from(bestByQuestion.values()).reduce((sum, v) => sum + v, 0);
    return Number((total / bestByQuestion.size).toFixed(1));
  };

  const getLessonScoreFromAttempts = (lesson: LearningLesson | undefined, attemptList: LearningAttempt[]) => {
    if (!lesson) return { normalized: 0, answeredCount: 0, completed: false };
    const lessonQuestions = getLessonQuestions(lesson);
    if (lessonQuestions.length === 0) return { normalized: 0, answeredCount: 0, completed: false };
    const questionIds = new Set(lessonQuestions.map(q => q.id));
    const lessonAttempts = attemptList.filter(a => a.lessonId === lesson.id && questionIds.has(a.questionId));
    const bestByQuestion = new Map<string, number>();
    lessonAttempts.forEach(a => {
      bestByQuestion.set(a.questionId, Math.max(bestByQuestion.get(a.questionId) || 0, a.score));
    });
    const totalScore = lessonQuestions.reduce((sum, q) => sum + (bestByQuestion.get(q.id) || 0), 0);
    const totalPossible = lessonQuestions.reduce((sum, q) => sum + (q.maxScore || 10), 0);
    const normalized = totalPossible ? Number(((totalScore / totalPossible) * 10).toFixed(1)) : 0;
    const answeredCount = bestByQuestion.size;
    const completed = normalized >= PASSING_SCORE && answeredCount === lessonQuestions.length;
    return { normalized, answeredCount, completed };
  };

  const averageQuestionScore = useMemo(() => getAverageScoreFromAttempts(profileAttempts), [profileAttempts]);

  const getLessonScore = (lesson?: LearningLesson) => {
    if (!lesson || !activeProfile) return { normalized: 0, answeredCount: 0, completed: false };
    return getLessonScoreFromAttempts(lesson, profileAttempts);
  };

  const lessonScore = getLessonScore(selectedLesson);
  const lessonQuestions = useMemo(() => getLessonQuestions(selectedLesson), [selectedLesson, isAdminView]);
  const hasQuizQuestions = lessonQuestions.length > 0;

  const updateSelectedTrack = (updater: (track: LearningTrack) => LearningTrack) => {
    if (!selectedTrack || !isAdminView || !canEdit) return;
    const updatedTracks = tracks.map(track => track.id === selectedTrack.id ? updater(track) : track);
    onUpdateTracks(updatedTracks);
  };

  const updateSelectedLesson = (updater: (lesson: LearningLesson) => LearningLesson) => {
    if (!selectedTrack || !selectedLesson || !isAdminView || !canEdit) return;
    const updatedTracks = tracks.map(track => {
      if (track.id !== selectedTrack.id) return track;
      return {
        ...track,
        lessons: track.lessons.map(lesson => lesson.id === selectedLesson.id ? updater(lesson) : lesson)
      };
    });
    onUpdateTracks(updatedTracks);
  };

  const handleAddQuestion = () => {
    const newQuestion: LearningQuestion = {
      id: `q-${Date.now()}`,
      prompt: 'Câu hỏi mới',
      type: 'MULTIPLE_CHOICE',
      options: ['Lựa chọn 1', 'Lựa chọn 2'],
      correctOption: 0,
      answerGuide: '',
      maxScore: 10
    };
    updateSelectedLesson(lesson => ({ ...lesson, questions: [...lesson.questions, newQuestion] }));
  };

  const handleDeleteQuestion = (questionId: string) => {
    updateSelectedLesson(lesson => ({ ...lesson, questions: lesson.questions.filter(q => q.id !== questionId) }));
  };

  const handleQuestionChange = (questionId: string, patch: Partial<LearningQuestion>) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => q.id === questionId ? { ...q, ...patch } : q)
    }));
  };

  const handleOptionChange = (questionId: string, optionIndex: number, value: string) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => {
        if (q.id !== questionId) return q;
        const options = [...(q.options || [])];
        options[optionIndex] = value;
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

  const handleRemoveOption = (questionId: string, optionIndex: number) => {
    updateSelectedLesson(lesson => ({
      ...lesson,
      questions: lesson.questions.map(q => {
        if (q.id !== questionId) return q;
        const options = (q.options || []).filter((_, idx) => idx !== optionIndex);
        const correctOption = q.correctOption !== undefined && q.correctOption >= options.length ? Math.max(0, options.length - 1) : q.correctOption;
        return { ...q, options, correctOption };
      })
    }));
  };

  const trackSummaries = useMemo(() => {
    return tracks.map(track => {
      const lessonScores = track.lessons.map(l => getLessonScore(l));
      const done = lessonScores.filter(ls => ls.completed).length;
      const progress = track.lessons.length ? Math.round((done / track.lessons.length) * 100) : 0;
      return { track, progress, done };
    });
  }, [tracks, profileAttempts, activeProfile, totalEventCount, averageQuestionScore, isAdminView]);

  const checkTrackUnlock = (track?: LearningTrack) => {
    if (!track || !activeProfile) return { unlocked: false, reasons: ['Chưa có hồ sơ nhân sự'], eventCount: totalEventCount };
    const req = track.requirements || {};
    const reasons: string[] = [];
    if (req.minTenureMonths && (activeProfile.tenureMonths || 0) < req.minTenureMonths) {
      reasons.push(`Cần tối thiểu ${req.minTenureMonths} tháng làm việc`);
    }
    if (req.minEvents && totalEventCount < req.minEvents) {
      reasons.push(`Cần đi ít nhất ${req.minEvents} sự kiện (hiện ${totalEventCount})`);
    }
    if (req.minScenarioScore && (activeProfile.scenarioScore || 0) < req.minScenarioScore) {
      reasons.push(`Cần điểm xử lý tình huống ≥ ${req.minScenarioScore}`);
    }
    if (req.minScore && averageQuestionScore < req.minScore) {
      reasons.push(`Điểm bài học trung bình ≥ ${req.minScore} (hiện ${averageQuestionScore})`);
    }
    if (req.mandatoryRoles && req.mandatoryRoles.length > 0) {
      const missing = req.mandatoryRoles.filter(r => !(activeProfile.roleHistory || []).includes(r));
      if (missing.length > 0) {
        reasons.push(`Thiếu kinh nghiệm ở vai trò: ${missing.join(', ')}`);
      }
    }
    if (req.requiredLessons && req.requiredLessons.length > 0) {
      const missingLessons = req.requiredLessons.filter(lid => !(activeProfile.completedLessons || []).includes(lid));
      if (missingLessons.length > 0) {
        reasons.push(`Hoàn thành trước các bài: ${missingLessons.join(', ')}`);
      }
    }
    return { unlocked: reasons.length === 0, reasons, eventCount: totalEventCount };
  };

  const trackUnlockStatus = checkTrackUnlock(selectedTrack);

  const rankStatuses = useMemo(() => {
    return ranks.map(rank => {
      const reasons: string[] = [];
      if ((activeProfile?.tenureMonths || 0) < rank.minTenureMonths) reasons.push(`Cần ${rank.minTenureMonths} tháng kinh nghiệm`);
      if (totalEventCount < rank.minEvents) reasons.push(`Cần tham gia ${rank.minEvents} sự kiện`);
      if (averageQuestionScore < rank.minAvgScore) reasons.push(`Điểm trung bình ≥ ${rank.minAvgScore}`);
      if (rank.mandatoryRoles && rank.mandatoryRoles.length > 0) {
        const missing = rank.mandatoryRoles.filter(r => !(activeProfile?.roleHistory || []).includes(r));
        if (missing.length > 0) reasons.push(`Thiếu vai trò: ${missing.join(', ')}`);
      }
      return { rank, eligible: reasons.length === 0, reasons };
    });
  }, [ranks, activeProfile?.tenureMonths, averageQuestionScore, totalEventCount, activeProfile?.roleHistory]);

  const totalLessons = tracks.reduce((sum, t) => sum + t.lessons.length, 0);
  const completedLessons = tracks.reduce((sum, t) => {
    return sum + t.lessons.filter(l => getLessonScore(l).completed || (activeProfile?.completedLessons || []).includes(l.id)).length;
  }, 0);
  const totalLessonsForView = isAdminView
    ? totalLessons
    : tracks.reduce((sum, track) => {
      const hasQuizLesson = track.lessons.filter(lesson => lesson.questions.some(q => q.type === 'MULTIPLE_CHOICE')).length;
      return sum + hasQuizLesson;
    }, 0);
  const lessonsForStats = Math.max(1, totalLessonsForView || totalLessons);

  const leaderboard = useMemo(() => {
    if (profiles.length === 0) return [];
    return profiles
      .map(profile => {
        const attemptList = attempts.filter(a => a.learnerId === profile.id);
        const averageScore = getAverageScoreFromAttempts(attemptList);
        const completed = tracks.reduce((sum, track) => {
          return sum + track.lessons.filter(lesson => {
            const score = getLessonScoreFromAttempts(lesson, attemptList);
            return score.completed || (profile.completedLessons || []).includes(lesson.id);
          }).length;
        }, 0);
        const completionRate = lessonsForStats ? Math.round((completed / lessonsForStats) * 100) : 0;
        return { profile, averageScore, completed, completionRate };
      })
      .sort((a, b) => {
        if (b.completed !== a.completed) return b.completed - a.completed;
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        return a.profile.name.localeCompare(b.profile.name);
      });
  }, [profiles, attempts, tracks, totalLessonsForView, isAdminView]);

  const topLeaderboard = leaderboard.slice(0, 8);
  const activeLeaderboardIndex = leaderboard.findIndex(row => row.profile.id === activeProfile?.id);

  const handleAttemptSubmit = (question: LearningQuestion) => {
    if (isAdminView) return;
    if (!canEdit) return;
    if (!activeProfile || !selectedTrack || !selectedLesson) return;
    const draft = answers[question.id];
    if (!draft || (question.type === 'MULTIPLE_CHOICE' && draft.selectedOption === undefined) || (question.type === 'OPEN' && !draft.answerText?.trim())) {
      alert('Vui lòng trả lời câu hỏi này.');
      return;
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

    const attempt: LearningAttempt = {
      id: `attempt-${Date.now()}`,
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

    onSubmitAttempt(attempt);
    setRevealed(prev => ({ ...prev, [question.id]: true }));
  };

  const handleMarkLessonDone = () => {
    if (isAdminView) return;
    if (!canEdit) return;
    if (!activeProfile || !selectedLesson) return;
    const completed = new Set(activeProfile.completedLessons || []);
    completed.add(selectedLesson.id);
    onUpsertProfile({ ...activeProfile, completedLessons: Array.from(completed) });
  };

  const handleSaveProfile = () => {
    if (!canEdit) return;
    if (!profileDraft) return;
    onUpsertProfile(profileDraft);
  };

  const handleCreateProfile = () => {
    if (!canEdit) return;
    if (!newProfileName.trim() && !newProfileEmployeeId) return;
    const selectedEmployee = newProfileEmployeeId ? employeesById.get(newProfileEmployeeId) : undefined;
    const profile: LearningProfile = {
      id: `learner-${Date.now()}`,
      name: newProfileName.trim() || selectedEmployee?.name || 'Nhân sự mới',
      employeeId: selectedEmployee?.id,
      tenureMonths: 0,
      eventsAttended: 0,
      scenarioScore: 6,
      roleHistory: [],
      badges: [],
      currentRank: 'Cộng tác viên',
      completedLessons: []
    };
    onUpsertProfile(profile);
    setSelectedProfileId(profile.id);
    setNewProfileName('');
    setNewProfileEmployeeId('');
  };

  const handleCreateProfileFromEmployee = (employeeId: string) => {
    if (!canEdit) return;
    const existing = profiles.find(p => p.employeeId === employeeId);
    if (existing) {
      setSelectedProfileId(existing.id);
      return;
    }
    const emp = employeesById.get(employeeId);
    if (!emp) return;
    const profile: LearningProfile = {
      id: `learner-${employeeId}`,
      name: emp.name,
      employeeId: emp.id,
      tenureMonths: 0,
      eventsAttended: 0,
      scenarioScore: 6,
      roleHistory: [],
      badges: [],
      currentRank: 'Cộng tác viên',
      completedLessons: []
    };
    onUpsertProfile(profile);
    setSelectedProfileId(profile.id);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (!canEdit || !isAdminView) return;
    if (!window.confirm('Xóa hồ sơ này? Hành động không thể hoàn tác.')) return;
    onDeleteProfile(profileId);
    if (profileId === selectedProfileId) {
      setSelectedProfileId(profileOptions.find(p => p.id !== profileId)?.id || '');
    }
  };

  const renderRequirementItem = (text: string, isDone: boolean, key: string) => (
    <div key={key} className="flex items-center gap-2 text-sm">
      {isDone ? <CheckCircle2 className="text-green-600" size={16} /> : <XCircle className="text-orange-500" size={16} />}
      <span className={isDone ? 'text-slate-700' : 'text-slate-500'}>{text}</span>
    </div>
  );

  if (!selectedTrack || !selectedLesson) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
        <p>Chưa có khóa học. Thêm nội dung để bắt đầu.</p>
      </div>
    );
  }

  const isLessonLocked = !trackUnlockStatus.unlocked;
  const nextEligibleRank = rankStatuses.find(r => r.eligible);

  const renderHero = () => (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide">
            <GraduationCap size={16} />
            {isAdminView ? 'Elearning vận hành & bán hàng' : 'Elearning cá nhân'}
          </div>
          <h2 className="text-2xl font-bold mt-1">
            {isAdminView ? 'Quản trị nội dung & theo dõi học viên' : 'Làm bài kiểm tra, theo dõi cấp độ và bảng xếp hạng'}
          </h2>
          <p className="text-sm text-slate-100/80 mt-1">
            {isAdminView
              ? 'Quản lý hồ sơ, bảng xếp hạng và điều chỉnh bài học/câu hỏi.'
              : 'Tập trung hoàn thành bài học, tích lũy điểm số và nâng cấp danh hiệu cá nhân.'}
          </p>
        </div>
        {isAdminView && (
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <div className="bg-white/10 px-3 py-2 rounded-lg text-sm">
                <div className="text-xs text-slate-100/80">Khóa học</div>
                <div className="font-semibold">{tracks.length}</div>
              </div>
              <div className="bg-white/10 px-3 py-2 rounded-lg text-sm">
                <div className="text-xs text-slate-100/80">Bài học</div>
                <div className="font-semibold">{totalLessons}</div>
              </div>
            </div>
            <div className="inline-flex bg-white/10 rounded-xl p-1">
              <button
                onClick={() => setAdminTab('profiles')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${adminTab === 'profiles' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-100'}`}
              >
                Hồ sơ & BXH
              </button>
              <button
                onClick={() => setAdminTab('content')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${adminTab === 'content' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-100'}`}
              >
                Nội dung & Câu hỏi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!isAdminView) {
    return (
      <div className="space-y-4">
        {renderHero()}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Học viên</label>
                <div className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700">
                  {activeProfile?.name || 'Chưa gắn hồ sơ'}
                </div>
                {profileOptions.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">Tài khoản chưa gắn hồ sơ Elearning. Liên hệ Admin để tạo.</p>
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Chọn khóa học</label>
                <select
                  value={selectedTrackId}
                  onChange={e => setSelectedTrackId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.level})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Bài kiểm tra trắc nghiệm</p>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <PlayCircle className="text-blue-600" size={18} />
                    {selectedLesson.title}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Điểm trung bình</div>
                  <div className="text-xl font-bold text-blue-700">{lessonScore.normalized.toFixed(1)}/10</div>
                  <div className="text-xs text-slate-500">Đã trả lời {lessonScore.answeredCount}/{lessonQuestions.length}</div>
                </div>
              </div>

              <div className="p-4">
                {isLessonLocked && (
                  <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-lg p-3 mb-3 flex gap-2 items-start">
                    <Lock size={16} className="mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Chưa mở khóa bài học</p>
                      <p className="text-xs">Hoàn thành điều kiện để mở.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {!hasQuizQuestions && (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-600">
                      Bài học chưa có câu trắc nghiệm để làm.
                    </div>
                  )}
                  {lessonQuestions.map((q, idx) => {
                    const latest = profileAttempts.filter(a => a.questionId === q.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                    const questionAnswered = revealed[q.id] || !!latest;
                    return (
                      <div key={q.id} className="border border-slate-100 rounded-lg p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                            <p className="font-medium text-slate-800">{q.prompt}</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                            Trắc nghiệm
                          </span>
                        </div>

                        <div className="space-y-2">
                          {q.options?.map((opt, i) => (
                            <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition ${answers[q.id]?.selectedOption === i ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                              <input
                                type="radio"
                                disabled={isLessonLocked || !canEdit || !activeProfile}
                                checked={answers[q.id]?.selectedOption === i}
                                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], selectedOption: i } }))}
                              />
                              <span className="text-sm text-slate-700">{opt}</span>
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleAttemptSubmit(q)}
                            disabled={isLessonLocked || !canEdit || !activeProfile}
                            className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${isLessonLocked || !activeProfile ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                          >
                            <CheckCircle2 size={16} /> Nộp & xem đáp án
                          </button>
                          {latest && (
                            <span className="text-xs text-slate-500">Lần gần nhất: {latest.score}/10</span>
                          )}
                        </div>

                        {questionAnswered && (
                          <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                            <p className="text-green-700 font-medium flex items-center gap-2">
                              <ShieldCheck size={16} />
                              Đáp án đúng: {q.options?.[q.correctOption || 0]}
                            </p>
                            {latest && (
                              <p className="text-xs text-slate-500 mt-1">Điểm bạn đạt: {latest.score}/10 - {latest.feedback}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
                  <div className="text-sm text-slate-700 flex items-center gap-2">
                    <BookOpenCheck size={16} className="text-blue-600" />
                    {lessonScore.completed ? 'Bài học đã đạt yêu cầu' : 'Hoàn thành tất cả câu hỏi trắc nghiệm để đạt chuẩn'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-blue-600" />
                <p className="font-semibold text-slate-800">Bảng xếp hạng</p>
              </div>
              {!activeProfile && (
                <p className="text-sm text-slate-500">Chưa có hồ sơ học tập được gắn với tài khoản này.</p>
              )}
              {topLeaderboard.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có dữ liệu xếp hạng.</p>
              ) : (
                <div className="space-y-2">
                  {topLeaderboard.map((row, index) => {
                    const isCurrent = row.profile.id === activeProfile?.id;
                    return (
                      <div
                        key={row.profile.id}
                        className={`flex items-center justify-between border rounded-lg px-3 py-2 ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 text-xs font-semibold text-slate-500">{index + 1}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{row.profile.name}</p>
                            <p className="text-[11px] text-slate-500">{row.completed}/{lessonsForStats} bài • {row.averageScore.toFixed(1)}/10</p>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-slate-700">{row.completionRate}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeProfile && activeLeaderboardIndex >= 0 && (
                <p className="text-[11px] text-slate-500">Hạng của bạn: {activeLeaderboardIndex + 1}/{leaderboard.length}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-4">
      {renderHero()}

      {adminTab === 'profiles' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Chọn nhân sự</label>
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {profileOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Chọn khóa học</label>
                <select
                  value={selectedTrackId}
                  onChange={e => setSelectedTrackId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.level})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <p className="font-semibold text-slate-800">Hồ sơ học tập</p>
              </div>

              {activeProfile ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Thời gian làm việc</p>
                      <p className="text-lg font-semibold text-slate-800">{activeProfile.tenureMonths} tháng</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Số lần đi sự kiện</p>
                      <p className="text-lg font-semibold text-slate-800">{totalEventCount}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Điểm xử lý tình huống</p>
                      <p className="text-lg font-semibold text-slate-800">{activeProfile.scenarioScore}/10</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Điểm trung bình bài học</p>
                      <p className="text-lg font-semibold text-slate-800">{averageQuestionScore}/10</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Gắn nhân sự (từ module Nhân sự)</label>
                      <select
                        value={profileDraft?.employeeId || ''}
                        onChange={e => setProfileDraft(prev => prev ? { ...prev, employeeId: e.target.value || undefined } : prev)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        disabled={!canEdit}
                      >
                        <option value="">Chưa gắn</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} - {emp.phone}</option>
                        ))}
                      </select>
                      {profileDraft?.employeeId && (
                        <p className="text-[11px] text-slate-500">
                          {employeesById.get(profileDraft.employeeId)?.role || ''} • {employeesById.get(profileDraft.employeeId)?.phone || ''}
                        </p>
                      )}
                    </div>

                    <label className="text-xs text-slate-500">Cập nhật nhanh hồ sơ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={profileDraft?.tenureMonths || 0}
                        onChange={e => setProfileDraft(prev => prev ? { ...prev, tenureMonths: Number(e.target.value) } : prev)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Tháng làm việc"
                        disabled={!canEdit}
                      />
                      <input
                        type="number"
                        value={profileDraft?.eventsAttended || 0}
                        onChange={e => setProfileDraft(prev => prev ? { ...prev, eventsAttended: Number(e.target.value) } : prev)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Số sự kiện"
                        disabled={!canEdit}
                      />
                      <input
                        type="number"
                        value={profileDraft?.scenarioScore || 0}
                        onChange={e => setProfileDraft(prev => prev ? { ...prev, scenarioScore: Number(e.target.value) } : prev)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Điểm tình huống"
                        min={0}
                        max={10}
                        disabled={!canEdit}
                      />
                      <input
                        type="text"
                        value={profileDraft?.currentRank || ''}
                        onChange={e => setProfileDraft(prev => prev ? { ...prev, currentRank: e.target.value } : prev)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Danh hiệu hiện tại"
                        disabled={!canEdit}
                      />
                    </div>
                    <textarea
                      value={profileDraft?.roleHistory.join(', ') || ''}
                      onChange={e => setProfileDraft(prev => prev ? { ...prev, roleHistory: e.target.value.split(',').map(x => x.trim()).filter(Boolean) } : prev)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Vai trò đã trải qua (phân tách bằng dấu phẩy)"
                      rows={2}
                      disabled={!canEdit}
                    />
                  <button
                    onClick={handleSaveProfile}
                    disabled={!canEdit}
                    className={`w-full rounded-lg py-2 text-sm font-semibold transition ${canEdit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >
                    Lưu hồ sơ
                  </button>
                  {activeProfile && (
                    <button
                      onClick={() => handleDeleteProfile(activeProfile.id)}
                      disabled={!canEdit}
                      className={`w-full rounded-lg py-2 text-sm font-semibold transition border ${canEdit ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      Xóa hồ sơ
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Chưa có hồ sơ. Thêm mới bên dưới.</p>
            )}

              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs text-slate-500">Tạo hồ sơ mới</label>
                <div className="flex gap-2 mt-1">
                  <input
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="Tên nhân sự"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    disabled={!canEdit}
                  />
                  <select
                    value={newProfileEmployeeId}
                    onChange={e => setNewProfileEmployeeId(e.target.value)}
                    className="w-56 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    disabled={!canEdit}
                  >
                    <option value="">Chọn từ danh sách nhân sự</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.phone}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateProfile}
                    disabled={!canEdit}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${canEdit ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                <p className="font-semibold text-slate-800">Bậc danh hiệu & lương thưởng</p>
              </div>
              <div className="space-y-3">
                {rankStatuses.map(({ rank, eligible, reasons }) => (
                  <div
                    key={rank.id}
                    className={`border rounded-lg p-3 ${eligible ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {eligible ? <Award className="text-green-600" size={18} /> : <Lock className="text-slate-400" size={18} />}
                        <div>
                          <p className="font-semibold text-slate-800">{rank.name}</p>
                          <p className="text-[11px] text-slate-500">Yêu cầu: {rank.minTenureMonths} tháng • {rank.minEvents} sự kiện • Điểm ≥ {rank.minAvgScore}</p>
                        </div>
                      </div>
                      {eligible && canEdit && (
                        <button
                          onClick={() => activeProfile && onUpsertProfile({ ...activeProfile, currentRank: rank.name })}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Gắn danh hiệu
                        </button>
                      )}
                    </div>
                    {eligible ? (
                      <p className="text-xs text-green-700 mt-1">Đã đủ điều kiện. Quy đổi phụ cấp: {rank.benefits.join(' • ')}</p>
                    ) : (
                      <ul className="text-[11px] text-slate-600 mt-1 list-disc list-inside space-y-0.5">
                        {reasons.map(r => <li key={r}>{r}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {nextEligibleRank && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
                  <Trophy size={16} />
                  {`Bạn gần đạt: ${nextEligibleRank.rank.name}. Tập trung hoàn thành yêu cầu còn thiếu.`}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <p className="font-semibold text-slate-800">Nhân sự chưa có hồ sơ</p>
              </div>
              {employeesWithoutProfile.length === 0 ? (
                <p className="text-sm text-slate-500">Tất cả nhân sự đã có hồ sơ Elearning.</p>
              ) : (
                <div className="space-y-2">
                  {employeesWithoutProfile.slice(0, 8).map(emp => (
                    <div key={emp.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                        <p className="text-[11px] text-slate-500">{emp.role} • {emp.phone}</p>
                      </div>
                      <button
                        onClick={() => handleCreateProfileFromEmployee(emp.id)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        disabled={!canEdit}
                      >
                        Tạo hồ sơ
                      </button>
                    </div>
                  ))}
                  {employeesWithoutProfile.length > 8 && (
                    <p className="text-[11px] text-slate-500">... và {employeesWithoutProfile.length - 8} nhân sự khác.</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-blue-600" />
                <p className="font-semibold text-slate-800">Bảng xếp hạng</p>
              </div>
              {topLeaderboard.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có dữ liệu xếp hạng.</p>
              ) : (
                <div className="space-y-2">
                  {topLeaderboard.map((row, index) => (
                    <div
                      key={row.profile.id}
                      className="flex items-center justify-between border rounded-lg px-3 py-2 border-slate-100 bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 text-xs font-semibold text-slate-500">{index + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{row.profile.name}</p>
                          <p className="text-[11px] text-slate-500">{row.completed}/{lessonsForStats} bài • {row.averageScore.toFixed(1)}/10</p>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-700">{row.completionRate}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Chọn khóa học</label>
                <select
                  value={selectedTrackId}
                  onChange={e => setSelectedTrackId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.level})</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-medium">Chọn bài học</label>
                <select
                  value={selectedLessonId}
                  onChange={e => setSelectedLessonId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedTrack?.lessons.map(l => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600" />
                  <p className="font-semibold text-slate-800">Thông tin khóa học</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={selectedTrack.title}
                  onChange={e => updateSelectedTrack(track => ({ ...track, title: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Tiêu đề khóa học"
                  disabled={!canEdit}
                />
                <input
                  value={selectedTrack.badge}
                  onChange={e => updateSelectedTrack(track => ({ ...track, badge: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Badge / danh hiệu"
                  disabled={!canEdit}
                />
                <select
                  value={selectedTrack.level}
                  onChange={e => updateSelectedTrack(track => ({ ...track, level: e.target.value as LearningTrack['level'] }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  disabled={!canEdit}
                >
                  <option value="BASE">BASE</option>
                  <option value="ADVANCED">ADVANCED</option>
                  <option value="MASTER">MASTER</option>
                </select>
                <select
                  value={selectedTrack.focus}
                  onChange={e => updateSelectedTrack(track => ({ ...track, focus: e.target.value as LearningTrack['focus'] }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  disabled={!canEdit}
                >
                  <option value="OPERATIONS">OPERATIONS</option>
                  <option value="CONTENT">CONTENT</option>
                  <option value="SALES">SALES</option>
                  <option value="LOGISTICS">LOGISTICS</option>
                  <option value="LEADERSHIP">LEADERSHIP</option>
                </select>
              </div>
              <textarea
                value={selectedTrack.description}
                onChange={e => updateSelectedTrack(track => ({ ...track, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Mô tả ngắn"
                rows={2}
                disabled={!canEdit}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpenCheck size={16} className="text-blue-600" />
                  <p className="font-semibold text-slate-800">Thông tin bài học</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={selectedLesson.title}
                  onChange={e => updateSelectedLesson(lesson => ({ ...lesson, title: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Tiêu đề bài học"
                  disabled={!canEdit}
                />
                <input
                  value={selectedLesson.duration || ''}
                  onChange={e => updateSelectedLesson(lesson => ({ ...lesson, duration: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Thời lượng (ví dụ 10:00)"
                  disabled={!canEdit}
                />
                <input
                  value={selectedLesson.videoUrl}
                  onChange={e => updateSelectedLesson(lesson => ({ ...lesson, videoUrl: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-2"
                  placeholder="URL video (YouTube embed)"
                  disabled={!canEdit}
                />
              </div>
              <textarea
                value={selectedLesson.summary}
                onChange={e => updateSelectedLesson(lesson => ({ ...lesson, summary: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Tóm tắt bài học"
                rows={2}
                disabled={!canEdit}
              />
              <input
                value={selectedLesson.skills.join(', ')}
                onChange={e => updateSelectedLesson(lesson => ({ ...lesson, skills: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Kỹ năng (phân tách bằng dấu phẩy)"
                disabled={!canEdit}
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-blue-600" />
                  <p className="font-semibold text-slate-800">Câu hỏi</p>
                </div>
                <button
                  onClick={handleAddQuestion}
                  disabled={!canEdit}
                  className={`px-3 py-2 text-sm font-semibold rounded-md ${canEdit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                  + Thêm câu hỏi
                </button>
              </div>

              {lessonQuestions.length === 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-600">
                  Bài học chưa có câu hỏi.
                </div>
              )}

              <div className="space-y-4">
                {lessonQuestions.map((q, idx) => (
                  <div key={q.id} className="border border-slate-100 rounded-lg p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                        <input
                          value={q.prompt}
                          onChange={e => handleQuestionChange(q.id, { prompt: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="Nhập nội dung câu hỏi"
                          disabled={!canEdit}
                        />
                      </div>
                      <select
                        value={q.type}
                        onChange={e => handleQuestionChange(q.id, { type: e.target.value as LearningQuestion['type'] })}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                        disabled={!canEdit}
                      >
                        <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
                        <option value="OPEN">Tự luận</option>
                      </select>
                    </div>

                    {q.type === 'MULTIPLE_CHOICE' ? (
                      <div className="space-y-2">
                        {(q.options || []).map((opt, i) => (
                          <div key={`${q.id}-opt-${i}`} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctOption === i}
                              onChange={() => handleQuestionChange(q.id, { correctOption: i })}
                              disabled={!canEdit}
                            />
                            <input
                              value={opt}
                              onChange={e => handleOptionChange(q.id, i, e.target.value)}
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              placeholder={`Lựa chọn ${i + 1}`}
                              disabled={!canEdit}
                            />
                            {(q.options || []).length > 2 && (
                              <button
                                onClick={() => handleRemoveOption(q.id, i)}
                                className={`text-xs ${canEdit ? 'text-red-500 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                                disabled={!canEdit}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddOption(q.id)}
                            disabled={!canEdit}
                            className={`text-xs px-3 py-1.5 rounded-md ${canEdit ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                          >
                            + Thêm đáp án
                          </button>
                          <span className="text-[11px] text-slate-500">Tích chọn đáp án đúng ở đầu dòng.</span>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={q.answerGuide || ''}
                        onChange={e => handleQuestionChange(q.id, { answerGuide: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Gợi ý/đáp án mẫu cho câu tự luận"
                        rows={3}
                        disabled={!canEdit}
                      />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={q.maxScore || 10}
                        onChange={e => handleQuestionChange(q.id, { maxScore: Number(e.target.value) || 0 })}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Điểm tối đa"
                        disabled={!canEdit}
                      />
                      <input
                        value={(q.answerKeywords || []).join(', ')}
                        onChange={e => handleQuestionChange(q.id, { answerKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Từ khóa (ngăn cách bởi dấu phẩy)"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        disabled={!canEdit}
                        className={`text-xs ${canEdit ? 'text-red-500 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                      >
                        Xóa câu hỏi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-600" />
                <p className="font-semibold text-slate-800">Điều kiện mở khóa khóa học</p>
              </div>
              <div className="space-y-2">
                {selectedTrack.requirements?.minTenureMonths !== undefined && renderRequirementItem(
                  `Tối thiểu ${selectedTrack.requirements?.minTenureMonths || 0} tháng làm việc`,
                  (activeProfile?.tenureMonths || 0) >= (selectedTrack.requirements?.minTenureMonths || 0),
                  'req-tenure'
                )}
                {selectedTrack.requirements?.minEvents !== undefined && renderRequirementItem(
                  `Ít nhất ${selectedTrack.requirements.minEvents} sự kiện`,
                  totalEventCount >= (selectedTrack.requirements.minEvents || 0),
                  'req-events'
                )}
                {selectedTrack.requirements?.minScore !== undefined && renderRequirementItem(
                  `Điểm trung bình ≥ ${selectedTrack.requirements.minScore}`,
                  averageQuestionScore >= (selectedTrack.requirements.minScore || 0),
                  'req-score'
                )}
                {selectedTrack.requirements?.minScenarioScore !== undefined && renderRequirementItem(
                  `Điểm xử lý tình huống ≥ ${selectedTrack.requirements.minScenarioScore}`,
                  (activeProfile?.scenarioScore || 0) >= (selectedTrack.requirements.minScenarioScore || 0),
                  'req-scenario'
                )}
                {selectedTrack.requirements?.mandatoryRoles?.length ? renderRequirementItem(
                  `Đã trải qua: ${selectedTrack.requirements.mandatoryRoles.join(', ')}`,
                  selectedTrack.requirements.mandatoryRoles.every(r => (activeProfile?.roleHistory || []).includes(r)),
                  'req-roles'
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
