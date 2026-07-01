import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Box,
  CheckCircle2,
  GraduationCap,
  Layers,
  LibraryBig,
  Link as LinkIcon,
  PackagePlus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react';
import {
  ComboPackage,
  EducationActivity,
  EducationEquipmentLink,
  EducationLessonLink,
  EducationTheme,
  InventoryItem,
  LearningLesson,
  LearningTrack
} from '../types';

interface EducationContentManagerProps {
  activities: EducationActivity[];
  inventory: InventoryItem[];
  packages: ComboPackage[];
  learningTracks: LearningTrack[];
  canEdit?: boolean;
  onUpdateActivities: (activities: EducationActivity[]) => void;
  onOpenLesson: (link: EducationLessonLink) => void;
}

type LessonOption = {
  trackId: string;
  trackTitle: string;
  lesson: LearningLesson;
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const buildThemeContent = (activityName: string, themeName: string) => {
  const normalized = themeName.toLowerCase();
  if (normalized.includes('đá') || normalized.includes('bóng') || normalized.includes('football')) {
    return {
      usageGuide: 'Sạc pin, kiểm tra mặt sàn phẳng, đặt bóng xốp ở khoảng cách an toàn, đánh dấu vùng đứng của học sinh trước khi robot thực hiện động tác.',
      pedagogyContent: `Với chủ đề ${themeName}, ${activityName} giúp học sinh quan sát cân bằng, trọng tâm, lực tác động và hướng chuyển động. HDV nên cho học sinh dự đoán trước khi robot sút, sau đó so sánh dự đoán với kết quả thật.`,
      guideScript: 'Theo các bạn, khi robot đổi góc chân thì bóng sẽ đi xa hơn hay lệch hướng? Mỗi nhóm chọn một giả thuyết, sau đó mình cùng quan sát cú sút của robot.',
      learningObjectives: ['Dự đoán kết quả trước khi thử', 'Nhận biết cân bằng và trọng tâm', 'Liên hệ lực tác động với chuyển động']
    };
  }
  if (normalized.includes('múa') || normalized.includes('hát') || normalized.includes('dance')) {
    return {
      usageGuide: 'Test loa, nhạc nền và chuỗi động tác trước giờ đón đoàn. Chừa vùng trống quanh robot và chuẩn bị phương án tắt nhạc nhanh khi cần.',
      pedagogyContent: `Với chủ đề ${themeName}, ${activityName} minh họa thuật toán tuần tự, nhịp điệu và lập trình hành vi. Học sinh nhìn thấy robot thực hiện từng lệnh theo thứ tự, không phải tự ngẫu hứng.`,
      guideScript: 'Robot đang biểu diễn theo một chuỗi lệnh. Nếu đổi thứ tự ba động tác đầu tiên, tiết mục sẽ khác như thế nào? Các bạn thử mô tả lại thuật toán của bài múa này.',
      learningObjectives: ['Hiểu chuỗi lệnh tuần tự', 'Nhận biết pattern và nhịp', 'Diễn đạt thuật toán bằng ngôn ngữ đơn giản']
    };
  }
  if (normalized.includes('boxing') || normalized.includes('võ') || normalized.includes('đấm')) {
    return {
      usageGuide: 'Chỉ chạy chế độ demo, kiểm tra nút dừng, đặt vạch cách ly và không để học sinh đứng trong vùng tay robot.',
      pedagogyContent: `Với chủ đề ${themeName}, ${activityName} tập trung vào mô phỏng chuyển động, điều khiển servo và luật an toàn khi tương tác với máy. Hoạt động nên được dẫn như một quan sát khoa học, không phải thi đấu đối kháng.`,
      guideScript: 'Boxing của robot là mô phỏng chuyển động. Điều quan trọng là robot nhận lệnh, giữ thăng bằng và dừng đúng lúc khi có tín hiệu an toàn.',
      learningObjectives: ['Hiểu mô phỏng chuyển động', 'Nhận biết tín hiệu điều khiển', 'Tuân thủ vùng an toàn với robot']
    };
  }
  return {
    usageGuide: `Chuẩn bị ${activityName}, kiểm tra thiết bị, phân vùng học sinh và chạy thử chủ đề ${themeName} trước khi đón đoàn.`,
    pedagogyContent: `Chủ đề ${themeName} cần được dẫn theo cấu trúc: gợi mở câu hỏi, cho học sinh dự đoán, trình diễn/thực hành, rồi chốt lại kiến thức bằng ví dụ gần gũi.`,
    guideScript: `Hôm nay mình sẽ khám phá ${themeName} qua ${activityName}. Trước khi xem kết quả, mỗi nhóm hãy đưa ra một dự đoán và giải thích vì sao.`,
    learningObjectives: ['Quan sát có mục tiêu', 'Đưa ra dự đoán', 'Rút ra kết luận sau trải nghiệm']
  };
};

const createTheme = (activityName: string, name = 'Chủ đề mới'): EducationTheme => {
  const content = buildThemeContent(activityName, name);
  return {
    id: makeId('edu-theme'),
    name,
    description: '',
    equipment: [],
    lessonLinks: [],
    ...content,
    updatedAt: new Date().toISOString()
  };
};

const createActivity = (): EducationActivity => ({
  id: makeId('edu'),
  name: 'Hoạt động mới',
  category: 'STEM',
  ageGroup: 'Tiểu học',
  summary: 'Mô tả ngắn hoạt động giáo dục.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  themes: [createTheme('Hoạt động mới', 'Chủ đề mẫu')]
});

const getLessonLabel = (lessons: LessonOption[], link: EducationLessonLink) => {
  const found = lessons.find(option => option.trackId === link.trackId && option.lesson.id === link.lessonId);
  return found ? `${found.lesson.title} • ${found.trackTitle}` : `${link.lessonId} • ${link.trackId}`;
};

export const EducationContentManager: React.FC<EducationContentManagerProps> = ({
  activities,
  inventory,
  packages,
  learningTracks,
  canEdit = true,
  onUpdateActivities,
  onOpenLesson
}) => {
  const [selectedActivityId, setSelectedActivityId] = useState(activities[0]?.id || '');
  const selectedActivity = activities.find(activity => activity.id === selectedActivityId) || activities[0] || null;
  const [selectedThemeId, setSelectedThemeId] = useState(selectedActivity?.themes?.[0]?.id || '');

  const lessonOptions = useMemo<LessonOption[]>(() =>
    learningTracks.flatMap(track => track.lessons.map(lesson => ({ trackId: track.id, trackTitle: track.title, lesson }))),
    [learningTracks]
  );

  const activeTheme = selectedActivity?.themes.find(theme => theme.id === selectedThemeId)
    || selectedActivity?.themes[0]
    || null;

  const saveActivities = (next: EducationActivity[]) => {
    if (!canEdit) return;
    onUpdateActivities(next.map(activity => ({
      ...activity,
      updatedAt: activity.id === selectedActivity?.id ? new Date().toISOString() : activity.updatedAt
    })));
  };

  const updateActivity = (patch: Partial<EducationActivity>) => {
    if (!selectedActivity) return;
    saveActivities(activities.map(activity => activity.id === selectedActivity.id ? { ...activity, ...patch } : activity));
  };

  const updateTheme = (themeId: string, patch: Partial<EducationTheme>) => {
    if (!selectedActivity) return;
    saveActivities(activities.map(activity => {
      if (activity.id !== selectedActivity.id) return activity;
      return {
        ...activity,
        themes: activity.themes.map(theme => theme.id === themeId ? { ...theme, ...patch, updatedAt: new Date().toISOString() } : theme)
      };
    }));
  };

  const addActivity = () => {
    const next = createActivity();
    onUpdateActivities([...activities, next]);
    setSelectedActivityId(next.id);
    setSelectedThemeId(next.themes[0]?.id || '');
  };

  const addTheme = () => {
    if (!selectedActivity) return;
    const theme = createTheme(selectedActivity.name, 'Chủ đề mới');
    saveActivities(activities.map(activity => activity.id === selectedActivity.id ? { ...activity, themes: [...activity.themes, theme] } : activity));
    setSelectedThemeId(theme.id);
  };

  const removeTheme = (themeId: string) => {
    if (!selectedActivity || selectedActivity.themes.length <= 1) return;
    const nextThemes = selectedActivity.themes.filter(theme => theme.id !== themeId);
    saveActivities(activities.map(activity => activity.id === selectedActivity.id ? { ...activity, themes: nextThemes } : activity));
    setSelectedThemeId(nextThemes[0]?.id || '');
  };

  const regenerateTheme = () => {
    if (!selectedActivity || !activeTheme) return;
    const content = buildThemeContent(selectedActivity.name, activeTheme.name);
    updateTheme(activeTheme.id, content);
  };

  const addEquipment = (type: EducationEquipmentLink['type']) => {
    if (!activeTheme) return;
    const source = type === 'ITEM' ? inventory[0] : packages[0];
    if (!source) return;
    updateTheme(activeTheme.id, {
      equipment: [...activeTheme.equipment, { type, id: source.id, quantity: 1 }]
    });
  };

  const updateEquipment = (index: number, patch: Partial<EducationEquipmentLink>) => {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      equipment: activeTheme.equipment.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    });
  };

  const removeEquipment = (index: number) => {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      equipment: activeTheme.equipment.filter((_item, itemIndex) => itemIndex !== index)
    });
  };

  const addLessonLink = () => {
    if (!activeTheme || lessonOptions.length === 0) return;
    const first = lessonOptions[0];
    updateTheme(activeTheme.id, {
      lessonLinks: [...activeTheme.lessonLinks, { trackId: first.trackId, lessonId: first.lesson.id }]
    });
  };

  const updateLessonLink = (index: number, value: string) => {
    if (!activeTheme) return;
    const [trackId, lessonId] = value.split('::');
    updateTheme(activeTheme.id, {
      lessonLinks: activeTheme.lessonLinks.map((link, linkIndex) => linkIndex === index ? { trackId, lessonId } : link)
    });
  };

  const removeLessonLink = (index: number) => {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      lessonLinks: activeTheme.lessonLinks.filter((_link, linkIndex) => linkIndex !== index)
    });
  };

  const getEquipmentName = (link: EducationEquipmentLink) => {
    if (link.type === 'PACKAGE') return packages.find(pkg => pkg.id === link.id)?.name || link.id;
    return inventory.find(item => item.id === link.id)?.name || link.id;
  };

  if (!selectedActivity || !activeTheme) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white border border-slate-200 rounded-lg">
        <div className="text-center">
          <LibraryBig className="mx-auto text-slate-300" size={48} />
          <h2 className="mt-4 text-xl font-black text-slate-800">Thư viện nội dung giáo dục</h2>
          <p className="mt-2 text-sm text-slate-500">Chưa có hoạt động nào. Hãy tạo hoạt động đầu tiên.</p>
          <button onClick={addActivity} disabled={!canEdit} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold disabled:bg-slate-300">
            <Plus size={16} />
            Tạo hoạt động
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-indigo-700">
              <LibraryBig size={16} />
              Educational Content OS
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Nội dung giáo dục theo hoạt động và chủ đề</h1>
            <p className="mt-1 text-sm text-slate-500">Một hoạt động có nhiều chủ đề, mỗi chủ đề có giáo cụ, bài học Elearning, nội dung sư phạm và kịch bản dẫn đoàn riêng.</p>
          </div>
          <button onClick={addActivity} disabled={!canEdit} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:bg-slate-300">
            <Plus size={16} />
            Hoạt động mới
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
        <aside className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-slate-800">Hoạt động</h2>
            <GraduationCap size={18} className="text-slate-400" />
          </div>
          <div className="space-y-2">
            {activities.map(activity => {
              const active = activity.id === selectedActivity.id;
              return (
                <button
                  key={activity.id}
                  onClick={() => {
                    setSelectedActivityId(activity.id);
                    setSelectedThemeId(activity.themes[0]?.id || '');
                  }}
                  className={`w-full text-left rounded-lg border p-3 transition ${active ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <p className="font-black text-slate-800">{activity.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{activity.themes.length} chủ đề • {activity.ageGroup || 'Chưa gán độ tuổi'}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <Field label="Tên hoạt động">
                <input value={selectedActivity.name} disabled={!canEdit} onChange={e => updateActivity({ name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" />
              </Field>
              <Field label="Nhóm nội dung">
                <input value={selectedActivity.category || ''} disabled={!canEdit} onChange={e => updateActivity({ category: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Độ tuổi/khối">
                <input value={selectedActivity.ageGroup || ''} disabled={!canEdit} onChange={e => updateActivity({ ageGroup: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <div className="flex items-end">
                <button onClick={() => onUpdateActivities(activities)} disabled={!canEdit} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold disabled:text-slate-300">
                  <Save size={16} />
                  Lưu thư viện
                </button>
              </div>
            </div>
            <textarea value={selectedActivity.summary || ''} disabled={!canEdit} onChange={e => updateActivity({ summary: e.target.value })} className="mt-3 w-full min-h-[70px] border rounded-lg p-3 text-sm" />
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedActivity.themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedThemeId(theme.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border ${theme.id === activeTheme.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {theme.name}
                </button>
              ))}
              <button onClick={addTheme} disabled={!canEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-indigo-700 disabled:text-slate-300">
                <Plus size={16} />
                Chủ đề
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
            <section className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-900 flex items-center gap-2"><Sparkles size={18} />Chủ đề đang chọn</h2>
                  <p className="text-sm text-slate-500 mt-1">Đổi chủ đề là nội dung sư phạm và kịch bản bên dưới đổi theo.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={regenerateTheme} disabled={!canEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300">
                    <Wand2 size={16} />
                    Sinh nội dung
                  </button>
                  <button onClick={() => removeTheme(activeTheme.id)} disabled={!canEdit || selectedActivity.themes.length <= 1} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-100 text-rose-700 text-sm font-bold disabled:text-slate-300">
                    <Trash2 size={16} />
                    Xóa
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Tên chủ đề">
                  <input value={activeTheme.name} disabled={!canEdit} onChange={e => updateTheme(activeTheme.id, { name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" />
                </Field>
                <Field label="Mô tả ngắn">
                  <input value={activeTheme.description || ''} disabled={!canEdit} onChange={e => updateTheme(activeTheme.id, { description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TextArea title="Hướng dẫn sử dụng" value={activeTheme.usageGuide} disabled={!canEdit} onChange={value => updateTheme(activeTheme.id, { usageGuide: value })} />
                <TextArea title="Nội dung giáo dục" value={activeTheme.pedagogyContent} disabled={!canEdit} onChange={value => updateTheme(activeTheme.id, { pedagogyContent: value })} />
                <TextArea title="Kịch bản dẫn đoàn" value={activeTheme.guideScript} disabled={!canEdit} onChange={value => updateTheme(activeTheme.id, { guideScript: value })} />
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Mục tiêu học tập</p>
                  <textarea
                    value={activeTheme.learningObjectives.join('\n')}
                    disabled={!canEdit}
                    onChange={e => updateTheme(activeTheme.id, { learningObjectives: e.target.value.split('\n').map(line => line.trim()).filter(Boolean) })}
                    className="mt-1 w-full min-h-[160px] border rounded-lg p-3 text-sm"
                  />
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 flex items-center gap-2"><PackagePlus size={18} />Giáo cụ đi kèm</h3>
                  <div className="flex gap-1">
                    <button title="Thêm thiết bị lẻ" onClick={() => addEquipment('ITEM')} disabled={!canEdit || inventory.length === 0} className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:text-slate-300"><Box size={16} /></button>
                    <button title="Thêm gói thiết bị" onClick={() => addEquipment('PACKAGE')} disabled={!canEdit || packages.length === 0} className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:text-slate-300"><Layers size={16} /></button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {activeTheme.equipment.map((link, index) => (
                    <div key={`${link.type}-${index}`} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <select value={link.id} disabled={!canEdit} onChange={e => updateEquipment(index, { id: e.target.value })} className="flex-1 border rounded-lg px-2 py-2 text-sm">
                          {(link.type === 'PACKAGE' ? packages : inventory).map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                        </select>
                        <input type="number" min={1} value={link.quantity} disabled={!canEdit} onChange={e => updateEquipment(index, { quantity: Number(e.target.value) || 1 })} className="w-16 border rounded-lg px-2 py-2 text-sm" />
                        <button onClick={() => removeEquipment(index)} disabled={!canEdit} className="text-slate-300 hover:text-rose-600 disabled:hover:text-slate-300"><Trash2 size={16} /></button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{link.type === 'PACKAGE' ? 'Gói thiết bị' : 'Thiết bị lẻ'} • {getEquipmentName(link)}</p>
                    </div>
                  ))}
                  {activeTheme.equipment.length === 0 && <p className="text-sm text-slate-500">Chưa gắn giáo cụ cho chủ đề này.</p>}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 flex items-center gap-2"><BookOpenCheck size={18} />Bài học Elearning</h3>
                  <button onClick={addLessonLink} disabled={!canEdit || lessonOptions.length === 0} className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:text-slate-300" title="Gắn bài học">
                    <LinkIcon size={16} />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {activeTheme.lessonLinks.map((link, index) => (
                    <div key={`${link.trackId}-${link.lessonId}-${index}`} className="border border-slate-100 rounded-lg p-3">
                      <select value={`${link.trackId}::${link.lessonId}`} disabled={!canEdit} onChange={e => updateLessonLink(index, e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                        {lessonOptions.map(option => <option key={`${option.trackId}::${option.lesson.id}`} value={`${option.trackId}::${option.lesson.id}`}>{option.lesson.title} • {option.trackTitle}</option>)}
                      </select>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 truncate">{getLessonLabel(lessonOptions, link)}</p>
                        <div className="flex gap-1">
                          <button onClick={() => onOpenLesson(link)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                            <GraduationCap size={14} />
                            Mở
                          </button>
                          <button onClick={() => removeLessonLink(index)} disabled={!canEdit} className="text-slate-300 hover:text-rose-600 disabled:hover:text-slate-300"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeTheme.lessonLinks.length === 0 && <p className="text-sm text-slate-500">Chưa gắn bài học Elearning.</p>}
                </div>
              </section>

              <section className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <h3 className="font-black text-indigo-950 flex items-center gap-2"><CheckCircle2 size={18} />Tóm tắt chủ đề</h3>
                <div className="mt-3 text-sm text-indigo-950 space-y-2">
                  <p><span className="font-bold">Hoạt động:</span> {selectedActivity.name}</p>
                  <p><span className="font-bold">Chủ đề:</span> {activeTheme.name}</p>
                  <p><span className="font-bold">Giáo cụ:</span> {activeTheme.equipment.length} mục</p>
                  <p><span className="font-bold">Bài học:</span> {activeTheme.lessonLinks.length} bài</p>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-black uppercase text-slate-500">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const TextArea: React.FC<{ title: string; value: string; disabled?: boolean; onChange: (value: string) => void }> = ({ title, value, disabled, onChange }) => (
  <div>
    <p className="text-xs font-black uppercase text-slate-500">{title}</p>
    <textarea value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="mt-1 w-full min-h-[160px] border rounded-lg p-3 text-sm" />
  </div>
);
