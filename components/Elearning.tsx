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

                      <button
                        onClick={() => handleAttemptSubmit(q)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Trả lời
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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