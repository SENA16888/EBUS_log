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
  onUpsertProfile
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || '');
  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || '');
  const [selectedLessonId, setSelectedLessonId] = useState<string>(tracks[0]?.lessons[0]?.id || '');
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [profileDraft, setProfileDraft] = useState<LearningProfile | null>(profiles[0] || null);
  const [newProfileName, setNewProfileName] = useState<string>('');

  const selectedTrack = useMemo(() => tracks.find(t => t.id === selectedTrackId) || tracks[0], [tracks, selectedTrackId]);
  const selectedLesson = useMemo(() => selectedTrack?.lessons.find(l => l.id === selectedLessonId) || selectedTrack?.lessons[0], [selectedLessonId, selectedTrack]);
  const activeProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId) || null, [profiles, selectedProfileId]);

  useEffect(() => {
    if (!selectedProfileId && profiles[0]) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

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

  const averageQuestionScore = useMemo(() => {
    const bestByQuestion = new Map<string, number>();
    profileAttempts.forEach(a => {
      bestByQuestion.set(a.questionId, Math.max(bestByQuestion.get(a.questionId) || 0, a.score));
    });
    if (bestByQuestion.size === 0) return 0;
    const total = Array.from(bestByQuestion.values()).reduce((sum, v) => sum + v, 0);
    return Number((total / bestByQuestion.size).toFixed(1));
  }, [profileAttempts]);

  const getLessonScore = (lesson?: LearningLesson) => {
    if (!lesson || !activeProfile) return { normalized: 0, answeredCount: 0, completed: false };
    const lessonAttempts = profileAttempts.filter(a => a.lessonId === lesson.id);
    const bestByQuestion = new Map<string, number>();
    lessonAttempts.forEach(a => {
      bestByQuestion.set(a.questionId, Math.max(bestByQuestion.get(a.questionId) || 0, a.score));
    });
    const totalScore = lesson.questions.reduce((sum, q) => sum + (bestByQuestion.get(q.id) || 0), 0);
    const totalPossible = lesson.questions.reduce((sum, q) => sum + (q.maxScore || 10), 0);
    const normalized = totalPossible ? Number(((totalScore / totalPossible) * 10).toFixed(1)) : 0;
    const answeredCount = bestByQuestion.size;
    const completed = normalized >= PASSING_SCORE && answeredCount === lesson.questions.length;
    return { normalized, answeredCount, completed };
  };

  const lessonScore = getLessonScore(selectedLesson);

  const trackSummaries = useMemo(() => {
    return tracks.map(track => {
      const lessonScores = track.lessons.map(l => getLessonScore(l));
      const done = lessonScores.filter(ls => ls.completed).length;
      const progress = track.lessons.length ? Math.round((done / track.lessons.length) * 100) : 0;
      return { track, progress, done };
    });
  }, [tracks, profileAttempts, activeProfile, totalEventCount, averageQuestionScore]);

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

  const handleAttemptSubmit = (question: LearningQuestion) => {
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
    if (!activeProfile || !selectedLesson) return;
    const completed = new Set(activeProfile.completedLessons || []);
    completed.add(selectedLesson.id);
    onUpsertProfile({ ...activeProfile, completedLessons: Array.from(completed) });
  };

  const handleSaveProfile = () => {
    if (!profileDraft) return;
    onUpsertProfile(profileDraft);
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const profile: LearningProfile = {
      id: `learner-${Date.now()}`,
      name: newProfileName.trim(),
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

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide">
              <GraduationCap size={16} />
              Elearning vận hành & bán hàng
            </div>
            <h2 className="text-2xl font-bold mt-1">Xem video, trả lời câu hỏi, mở khóa danh hiệu</h2>
            <p className="text-sm text-slate-100/80 mt-1">Điều kiện xét bậc dựa trên thời gian làm việc, số lần đi sự kiện, câu trả lời và vai trò đã trải qua.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/10 px-3 py-2 rounded-lg text-sm">
              <div className="text-xs text-slate-100/80">Khóa học</div>
              <div className="font-semibold">{tracks.length}</div>
            </div>
            <div className="bg-white/10 px-3 py-2 rounded-lg text-sm">
              <div className="text-xs text-slate-100/80">Bài học</div>
              <div className="font-semibold">{totalLessons}</div>
            </div>
            <div className="bg-white/10 px-3 py-2 rounded-lg text-sm">
              <div className="text-xs text-slate-100/80">Đã hoàn thành</div>
              <div className="font-semibold">{completedLessons}/{totalLessons}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-medium">Chọn nhân sự</label>
              <select
                value={selectedProfileId}
                onChange={e => setSelectedProfileId(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {profiles.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">Chưa có hồ sơ, hãy tạo mới ở bảng bên phải.</p>
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
            <div className="flex-1">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 h-full">
                <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold">
                  <ShieldCheck size={16} /> Điều kiện mở khóa
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {trackUnlockStatus.unlocked ? 'Đã đủ điều kiện học và thi.' : 'Chưa đủ, xem yêu cầu chi tiết.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trackSummaries.map(({ track, progress, done }) => {
              const unlocked = checkTrackUnlock(track).unlocked;
              return (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                  className={`text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition ${selectedTrackId === track.id ? 'border-blue-300 shadow-[0_10px_30px_rgba(37,99,235,0.08)]' : 'border-slate-100'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-blue-600" size={18} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{track.title}</p>
                        <p className="text-xs text-slate-500">{track.description}</p>
                      </div>
                    </div>
                    <div className="text-xs text-white bg-slate-800 px-2 py-1 rounded-lg">{track.level}</div>
                  </div>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-2 ${unlocked ? 'bg-blue-600' : 'bg-slate-400'}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-600" />
                    {done}/{track.lessons.length} bài đã đạt yêu cầu
                  </div>
                  {!unlocked && (
                    <div className="mt-2 text-[11px] text-orange-600 flex items-center gap-1">
                      <Lock size={12} /> Chưa mở khóa đầy đủ
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Bài học đang xem</p>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <PlayCircle className="text-blue-600" size={18} />
                  {selectedLesson.title}
                </h3>
                <p className="text-sm text-slate-500">{selectedLesson.summary}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Điểm trung bình</div>
                <div className="text-xl font-bold text-blue-700">{lessonScore.normalized.toFixed(1)}/10</div>
                <div className="text-xs text-slate-500">Đã trả lời {lessonScore.answeredCount}/{selectedLesson.questions.length}</div>
              </div>
            </div>

            <div className="aspect-video bg-slate-100">
              <iframe
                src={selectedLesson.videoUrl}
                title={selectedLesson.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedLesson.skills.map(skill => (
                  <span key={skill} className="px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                    {skill}
                  </span>
                ))}
              </div>

              {isLessonLocked && (
                <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-lg p-3 mb-3 flex gap-2 items-start">
                  <Lock size={16} className="mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Chưa mở khóa bài học</p>
                    <p className="text-xs">Hoàn thành điều kiện bên cạnh để mở.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {selectedLesson.questions.map((q, idx) => {
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
                          {q.type === 'MULTIPLE_CHOICE' ? 'Trắc nghiệm' : 'Tự luận'}
                        </span>
                      </div>

                      {q.type === 'MULTIPLE_CHOICE' ? (
                        <div className="space-y-2">
                          {q.options?.map((opt, i) => (
                            <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition ${answers[q.id]?.selectedOption === i ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                              <input
                                type="radio"
                                disabled={isLessonLocked}
                                checked={answers[q.id]?.selectedOption === i}
                                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], selectedOption: i } }))}
                              />
                              <span className="text-sm text-slate-700">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          disabled={isLessonLocked}
                          value={answers[q.id]?.answerText || ''}
                          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], answerText: e.target.value } }))}
                          placeholder="Nhập câu trả lời của bạn..."
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleAttemptSubmit(q)}
                          disabled={isLessonLocked}
                          className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${isLessonLocked ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                          <CheckCircle2 size={16} /> Nộp & xem đáp án
                        </button>
                        {latest && (
                          <span className="text-xs text-slate-500">Lần gần nhất: {latest.score}/10</span>
                        )}
                      </div>

                      {questionAnswered && (
                        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                          {q.type === 'MULTIPLE_CHOICE' ? (
                            <p className="text-green-700 font-medium flex items-center gap-2">
                              <ShieldCheck size={16} />
                              Đáp án đúng: {q.options?.[q.correctOption || 0]}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-800">Gợi ý tham khảo</p>
                              <p className="text-slate-600 text-sm">{q.answerGuide}</p>
                              {q.answerKeywords && (
                                <p className="text-[11px] text-slate-500">Từ khóa cần có: {q.answerKeywords.join(', ')}</p>
                              )}
                            </div>
                          )}
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
                  {lessonScore.completed ? 'Bài học đã đạt yêu cầu' : 'Hoàn thành tất cả câu hỏi để đạt chuẩn'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkLessonDone}
                    disabled={!lessonScore.completed}
                    className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${lessonScore.completed ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >
                    <Trophy size={16} /> Đánh dấu hoàn thành
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
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
                  <label className="text-xs text-slate-500">Cập nhật nhanh hồ sơ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={profileDraft?.tenureMonths || 0}
                      onChange={e => setProfileDraft(prev => prev ? { ...prev, tenureMonths: Number(e.target.value) } : prev)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Tháng làm việc"
                    />
                    <input
                      type="number"
                      value={profileDraft?.eventsAttended || 0}
                      onChange={e => setProfileDraft(prev => prev ? { ...prev, eventsAttended: Number(e.target.value) } : prev)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Số sự kiện"
                    />
                    <input
                      type="number"
                      value={profileDraft?.scenarioScore || 0}
                      onChange={e => setProfileDraft(prev => prev ? { ...prev, scenarioScore: Number(e.target.value) } : prev)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Điểm tình huống"
                      min={0}
                      max={10}
                    />
                    <input
                      type="text"
                      value={profileDraft?.currentRank || ''}
                      onChange={e => setProfileDraft(prev => prev ? { ...prev, currentRank: e.target.value } : prev)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Danh hiệu hiện tại"
                    />
                  </div>
                  <textarea
                    value={profileDraft?.roleHistory.join(', ') || ''}
                    onChange={e => setProfileDraft(prev => prev ? { ...prev, roleHistory: e.target.value.split(',').map(x => x.trim()).filter(Boolean) } : prev)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Vai trò đã trải qua (phân tách bằng dấu phẩy)"
                    rows={2}
                  />
                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Lưu hồ sơ
                  </button>
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
                />
                <button
                  onClick={handleCreateProfile}
                  className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900"
                >
                  Thêm
                </button>
              </div>
              {employees.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Gợi ý: tạo hồ sơ dựa trên nhân sự ở tab Nhân sự để theo dõi lộ trình.
                </p>
              )}
            </div>
          </div>

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
                    {eligible && (
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
      </div>
    </div>
  );
};
