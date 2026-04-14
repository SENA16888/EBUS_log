import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpenCheck, CheckCircle2, GraduationCap, PlayCircle, ShieldCheck, Sparkles, Target, Trophy, Users, XCircle, FileText, Video, CheckSquare } from 'lucide-react';
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

type ViewMode = 'topics' | 'lesson' | 'quiz';

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
  const [viewMode, setViewMode] = useState<ViewMode>('topics');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [newSkillText, setNewSkillText] = useState<string>('');

  const profileOptions = useMemo(() => {
    if (isAdminView) return profiles;
    if (!currentEmployeeId) return [];
    return profiles.filter(p => p.employeeId === currentEmployeeId);
  }, [profiles, isAdminView, currentEmployeeId]);

  const activeProfile = useMemo(() => profileOptions[0] || null, [profileOptions]);

  const selectedTrack = useMemo(() => tracks.find(t => t.id === selectedTrackId) || null, [tracks, selectedTrackId]);
  const selectedLesson = useMemo(() => selectedTrack?.lessons.find(l => l.id === selectedLessonId) || null, [selectedTrack, selectedLessonId]);

  const profileAttempts = useMemo(() =>
    attempts.filter(a => a.learnerId === activeProfile?.id),
    [attempts, activeProfile?.id]
  );

  const lessonQuestions = useMemo(() => {
    if (!selectedLesson) return [];
    return isAdminView ? selectedLesson.questions : selectedLesson.questions.filter(q => q.type === 'MULTIPLE_CHOICE');
  }, [selectedLesson, isAdminView]);

  const handleSelectLesson = (trackId: string, lessonId: string) => {
    setSelectedTrackId(trackId);
    setSelectedLessonId(lessonId);
    setViewMode('lesson');
    setAnswers({});
    setRevealed({});
  };

  const handleStartQuiz = () => {
    setViewMode('quiz');
  };

  const handleBackToTopics = () => {
    setViewMode('topics');
    setSelectedTrackId('');
    setSelectedLessonId('');
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
    if (!activeProfile || !selectedTrack || !selectedLesson) return;

    const unanswered = lessonQuestions.filter(q => {
      const latest = profileAttempts.filter(a => a.questionId === q.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return !latest;
    });

    for (const question of unanswered) {
      const draft = answers[question.id];
      if (!draft || (question.type === 'MULTIPLE_CHOICE' && draft.selectedOption === undefined) || (question.type === 'OPEN' && !draft.answerText?.trim())) {
        alert('Vui lòng hoàn tất tất cả câu hỏi trước khi nộp bài.');
        return;
      }
    }

    unanswered.forEach(question => {
      const attempt = createAttemptFromDraft(question);
      if (attempt) {
        onSubmitAttempt(attempt);
        setRevealed(prev => ({ ...prev, [question.id]: true }));
      }
    });
  };

  const updateSelectedTrack = (updater: (track: LearningTrack) => LearningTrack) => {
    if (!selectedTrack || !canEdit) return;
    const updatedTracks = tracks.map(track => track.id === selectedTrack.id ? updater(track) : track);
    onUpdateTracks(updatedTracks);
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
    const updatedTracks = tracks.map(track => track.id === trackId ? {
      ...track,
      lessons: [...track.lessons, newLesson]
    } : track);
    onUpdateTracks(updatedTracks);
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

  const renderTopicsView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <GraduationCap size={24} />
          <div>
            <h1 className="text-2xl font-bold">Kênh Học Tập</h1>
            <p className="text-slate-100">Khám phá các chủ đề học tập và nâng cao kỹ năng</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map(track => (
          <div key={track.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{track.title}</h3>
                <p className="text-sm text-slate-600 mb-3">{track.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-1 bg-slate-100 rounded-full">{track.level}</span>
                  <span>{track.lessons.length} bài học</span>
                </div>
              </div>
              <div className="text-2xl">{track.badge}</div>
            </div>

            <div className="space-y-2">
              {track.lessons.map(lesson => (
                <button
                  key={lesson.id}
                  onClick={() => handleSelectLesson(track.id, lesson.id)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PlayCircle className="text-blue-600" size={16} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
                      <p className="text-xs text-slate-500">{lesson.duration || 'N/A'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {isAdminView && canEdit && (
              <div className="mt-4">
                <button
                  onClick={() => handleAddLesson(track.id)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  + Thêm bài học mới
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderLessonView = () => {
    if (!selectedLesson || !selectedTrack) return null;

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

            {isAdminView && canEdit && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
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
            <div className="mb-6">
              {selectedLesson.mediaType === 'video' ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    controls
                    className="w-full h-full"
                    src={selectedLesson.mediaUrl}
                  >
                    Trình duyệt không hỗ trợ video.
                  </video>
                </div>
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <FileText size={48} className="mx-auto mb-2" />
                    <p>Đang tải tài liệu PDF...</p>
                    <iframe
                      src={selectedLesson.mediaUrl}
                      className="w-full h-full border-0"
                      title="PDF Document"
                    />
                  </div>
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
              const latest = profileAttempts.filter(a => a.questionId === q.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              const questionAnswered = revealed[q.id] || !!latest;
              return (
                <div key={q.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <p className="font-medium text-slate-800">{q.prompt}</p>
                    </div>
                    {questionAnswered && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                        Đã trả lời
                      </span>
                    )}
                  </div>

                  {questionAnswered ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        Đáp án của bạn: {q.type === 'MULTIPLE_CHOICE' ? q.options?.[latest?.selectedOption || 0] : latest?.answerText}
                      </p>
                      <p className="text-sm text-slate-600">Phản hồi: {latest?.feedback}</p>
                      <p className="text-sm font-medium text-blue-600">Điểm: {latest?.score}/{q.maxScore || 10}</p>
                    </div>
                  ) : (
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
                  )}
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

  if (viewMode === 'topics') {
    return renderTopicsView();
  } else if (viewMode === 'lesson') {
    return renderLessonView();
  } else if (viewMode === 'quiz') {
    return renderQuizView();
  }

  return null;
};