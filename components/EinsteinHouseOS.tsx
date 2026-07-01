import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Box,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  FileText,
  GripVertical,
  Library,
  MapPin,
  MessageSquareText,
  PackageCheck,
  PlayCircle,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Save,
  Siren,
  Sparkles,
  TimerReset,
  Trash2,
  UserRoundCheck,
  Users,
  Wand2
} from 'lucide-react';
import {
  ComboPackage,
  Employee,
  Event,
  HouseOperationFeedback,
  HouseOperationIncident,
  HouseOperationInstance,
  HouseOperationMediaTask,
  HouseOperationRotationGroup,
  HouseOperationStation,
  HouseOperationTask,
  HouseOperationTaskStatus,
  HouseOperationTimelineBlock,
  InventoryItem
} from '../types';

interface EinsteinHouseOSProps {
  events: Event[];
  inventory: InventoryItem[];
  employees: Employee[];
  packages: ComboPackage[];
  canEdit?: boolean;
  onUpdateEvent: (eventId: string, updates: Partial<Event>) => void;
}

type ModuleTab = 'CONTROL' | 'DESIGN' | 'TIMELINE' | 'TASKS' | 'KNOWLEDGE' | 'LIVE' | 'REPORT';

const MODULES = [
  'Event Dashboard',
  'Event Designer',
  'Timeline Builder',
  'Rotation Planner',
  'Action Plan',
  'Human Assignment',
  'SOP Center',
  'Script Builder',
  'Station Library',
  'Equipment Order',
  'Setup Checklist',
  'Rehearsal',
  'Live Command',
  'Incident',
  'Media Center',
  'Feedback',
  'Report',
  'Knowledge Base',
  'AI Assistant',
  'Analytics'
];

const STATION_TEMPLATES: Omit<HouseOperationStation, 'id' | 'room' | 'status'>[] = [
  {
    name: 'Science Show',
    category: 'SHOW',
    durationMinutes: 25,
    objective: 'Tạo điểm mở đầu hứng thú, kích hoạt tò mò khoa học và thống nhất luật an toàn.',
    sopVersion: 'EH-SOP-SHOW-v1',
    checklist: ['Test loa micro', 'Đánh dấu vùng an toàn', 'Chuẩn bị đạo cụ demo', 'Chốt cue mở màn'],
    equipment: [
      { name: 'Loa kéo', quantity: 1, source: 'MANUAL' },
      { name: 'Micro không dây', quantity: 2, source: 'MANUAL' }
    ],
    script: 'Xin chào thầy cô và các bạn học sinh {{school}}. Hôm nay Einstein House sẽ biến khoa học thành một trải nghiệm có thể chạm, thử và khám phá.'
  },
  {
    name: 'VR Lab',
    category: 'VR',
    durationMinutes: 30,
    objective: 'Cho học sinh trải nghiệm môi trường ảo có hướng dẫn, đảm bảo vệ sinh kính và nhịp luân chuyển đều.',
    sopVersion: 'EH-SOP-VR-v1',
    checklist: ['Lau kính', 'Test game', 'Test wifi', 'Chia lượt đeo kính', 'Có người hỗ trợ tháo kính'],
    equipment: [
      { name: 'Kính VR', quantity: 8, source: 'MANUAL' },
      { name: 'Khăn lau kính', quantity: 20, unit: 'cái', source: 'CONSUMABLE' }
    ],
    script: 'Trạm VR giúp các bạn quan sát những điều bình thường mắt mình khó nhìn thấy. Mỗi lượt trải nghiệm cần nghe hiệu lệnh của HDV trước khi đeo kính.'
  },
  {
    name: 'Robot Mission',
    category: 'ROBOT',
    durationMinutes: 30,
    objective: 'Học sinh điều khiển robot theo nhiệm vụ ngắn, rèn tư duy thuật toán và phối hợp nhóm.',
    sopVersion: 'EH-SOP-ROBOT-v1',
    checklist: ['Sạc pin robot', 'Test đường chạy', 'Chuẩn bị nhiệm vụ', 'Kiểm tra remote/tablet'],
    equipment: [
      { name: 'Robot giáo dục', quantity: 6, source: 'MANUAL' },
      { name: 'Pin dự phòng', quantity: 6, source: 'MANUAL' }
    ],
    script: 'Robot chỉ làm đúng những gì con người hướng dẫn. Nhiệm vụ của đội mình là biến ý tưởng thành chuỗi lệnh thật rõ ràng.'
  },
  {
    name: 'STEM Workshop',
    category: 'WORKSHOP',
    durationMinutes: 35,
    objective: 'Mỗi học sinh hoàn thành một sản phẩm nhỏ, có hướng dẫn theo bước và phần phản tư cuối trạm.',
    sopVersion: 'EH-SOP-WORKSHOP-v1',
    checklist: ['Chia kit theo bàn', 'Chuẩn bị kéo/keo', 'Mẫu sản phẩm', 'Thùng rác mini'],
    equipment: [
      { name: 'Giấy workshop', quantity: 80, unit: 'tờ', source: 'CONSUMABLE' },
      { name: 'Keo dán', quantity: 15, unit: 'chai', source: 'CONSUMABLE' }
    ],
    script: 'Ở workshop, sản phẩm đẹp không quan trọng bằng việc các bạn thử, sai, sửa và hiểu vì sao nó hoạt động.'
  },
  {
    name: 'Newton Challenge',
    category: 'STEM',
    durationMinutes: 25,
    objective: 'Dùng thử thách vật lý ngắn để củng cố khái niệm lực, chuyển động và dự đoán kết quả.',
    sopVersion: 'EH-SOP-NEWTON-v1',
    checklist: ['Set bàn thử nghiệm', 'Đánh dấu hàng chờ', 'Test mẫu', 'Chuẩn bị bảng điểm'],
    equipment: [
      { name: 'Bộ thí nghiệm Newton', quantity: 4, source: 'MANUAL' },
      { name: 'Băng dính giấy', quantity: 4, unit: 'cuộn', source: 'CONSUMABLE' }
    ],
    script: 'Trước khi thử, mỗi đội hãy dự đoán kết quả. Nhà khoa học giỏi luôn bắt đầu bằng một giả thuyết.'
  }
];

const SHOT_LIST = ['Ảnh cổng đón đoàn', 'Toàn cảnh Science Show', 'VR cận cảnh', 'Workshop sản phẩm', 'Ảnh nhóm theo lớp', 'Ảnh tổng kết với giáo viên'];

const STATUS_LABELS: Record<HouseOperationTaskStatus, string> = {
  TODO: 'Cần làm',
  DOING: 'Đang làm',
  DONE: 'Hoàn thành',
  BLOCKED: 'Thiếu'
};

const GROUP_COLORS = ['#0f766e', '#2563eb', '#c2410c', '#7c3aed', '#be123c', '#047857'];

const formatDate = (value?: string) => {
  if (!value) return 'Chưa có ngày';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const timeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
};

const minutesToTime = (minutes: number) => {
  const safe = Math.max(0, minutes);
  const hour = Math.floor(safe / 60) % 24;
  const minute = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const addMinutes = (time: string, minutes: number) => minutesToTime(timeToMinutes(time) + minutes);

const getPrimaryDate = (event: Event) => event.schedule?.[0]?.date || event.startDate || event.endDate || '';

const getProgramStart = (event: Event) => event.eventProfile?.programTimeStart || '09:00';

const getStudentCount = (event: Event) =>
  event.houseOperation?.studentCount ||
  event.eventProfile?.attendanceMax ||
  event.eventProfile?.attendanceMin ||
  64;

const getTeacherCount = (event: Event) => event.houseOperation?.teacherCount || Math.max(1, Math.ceil(getStudentCount(event) / 25));

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getExperienceStations = (stations: HouseOperationStation[], timeline: HouseOperationTimelineBlock[] = []) => {
  const commonStationIds = new Set(timeline.filter(block => block.kind === 'COMMON' && block.stationId).map(block => block.stationId as string));
  return stations.filter(station => !commonStationIds.has(station.id));
};

const getDefaultRoundDuration = (stations: HouseOperationStation[]) =>
  Math.max(20, ...stations.map(station => station.durationMinutes || 20));

const buildTimeline = (event: Event, stations: HouseOperationStation[]): HouseOperationTimelineBlock[] => {
  const start = getProgramStart(event);
  let cursor = timeToMinutes(start);
  const commonShow = stations.find(station => station.category === 'SHOW');
  const experienceStations = commonShow ? stations.filter(station => station.id !== commonShow.id) : stations;
  const roundDuration = getDefaultRoundDuration(experienceStations);
  const amStationCount = Math.min(3, Math.max(1, experienceStations.length || 1));
  const pmStationCount = Math.min(3, Math.max(0, experienceStations.length - amStationCount));

  const blocks: HouseOperationTimelineBlock[] = [
    {
      id: makeId('eh-time'),
      sectionCode: 'A',
      kind: 'OPENING',
      title: 'Đón đoàn - check in',
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + 15),
      note: 'Lead HDV nhận đoàn, xác nhận sĩ số, phổ biến an toàn.'
    }
  ];
  cursor += 15;

  if (commonShow) {
    blocks.push({
      id: makeId('eh-time'),
      sectionCode: 'B',
      kind: 'COMMON',
      title: commonShow.name,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + commonShow.durationMinutes),
      stationId: commonShow.id,
      room: commonShow.room || commonShow.areaDescription || 'Sân khấu/khu chung',
      note: 'Mốc chung cho toàn đoàn trước khi chia nhóm.'
    });
    cursor += commonShow.durationMinutes;
  }

  const amDuration = amStationCount * roundDuration;
  blocks.push({
    id: makeId('eh-time'),
    sectionCode: 'C',
    kind: 'EXPERIENCE_AM',
    title: 'Hoạt động trải nghiệm sáng',
    startTime: minutesToTime(cursor),
    endTime: minutesToTime(cursor + amDuration),
    stationCount: amStationCount,
    note: 'Các nhóm chạy timeline riêng theo màu, không trùng trạm cùng mốc giờ.'
  });
  cursor += amDuration;

  blocks.push({
    id: makeId('eh-time'),
    sectionCode: 'E',
    kind: 'LUNCH',
    title: 'Nghỉ trưa - ăn và ngủ',
    startTime: minutesToTime(cursor),
    endTime: '13:30',
    note: 'Giờ kết thúc nghỉ trưa nhập tay; đây là giờ bắt đầu hoạt động chiều.'
  });
  cursor = Math.max(timeToMinutes('13:30'), cursor);

  if (pmStationCount > 0) {
    const pmDuration = pmStationCount * roundDuration;
    blocks.push({
      id: makeId('eh-time'),
      sectionCode: 'F',
      kind: 'EXPERIENCE_PM',
      title: 'Hoạt động trải nghiệm chiều',
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + pmDuration),
      stationCount: pmStationCount,
      note: 'Các nhóm tiếp tục xoay trạm theo timeline riêng.'
    });
    cursor += pmDuration;
  }

  blocks.push({
    id: makeId('eh-time'),
    sectionCode: 'G',
    kind: 'CLOSING',
    title: 'Tổng kết - trả đoàn',
    startTime: minutesToTime(cursor),
    endTime: minutesToTime(cursor + 15),
    note: 'Chụp ảnh tổng kết, bàn giao giáo viên, ghi nhận feedback nhanh.'
  });

  return blocks;
};

const recalcStructuredTimeline = (event: Event, stations: HouseOperationStation[], sourceTimeline: HouseOperationTimelineBlock[]) => {
  let cursor = timeToMinutes(sourceTimeline[0]?.startTime || getProgramStart(event));
  const experienceStations = getExperienceStations(stations, sourceTimeline);
  const roundDuration = getDefaultRoundDuration(experienceStations);

  return sourceTimeline.map(block => {
    const next = { ...block };
    next.startTime = minutesToTime(cursor);
    next.warning = undefined;

    if (next.kind === 'EXPERIENCE_AM' || next.kind === 'EXPERIENCE_PM') {
      const stationCount = Math.max(0, next.stationCount || 0);
      const duration = stationCount > 0 ? stationCount * roundDuration : 0;
      next.endTime = minutesToTime(cursor + duration);
      cursor += duration;
      return next;
    }

    if (next.kind === 'LUNCH') {
      const targetEnd = timeToMinutes(next.endTime || minutesToTime(cursor + 60));
      if (targetEnd <= cursor) {
        next.warning = 'Giờ kết thúc nghỉ trưa đang cắn vào hoạt động trước. Hãy tăng giờ kết thúc hoặc giảm số trạm buổi sáng.';
        next.endTime = minutesToTime(cursor + 60);
        cursor += 60;
      } else {
        next.startTime = minutesToTime(cursor);
        cursor = targetEnd;
      }
      return next;
    }

    const duration = Math.max(0, timeToMinutes(next.endTime) - timeToMinutes(next.startTime)) || 10;
    next.endTime = minutesToTime(cursor + duration);
    cursor += duration;
    return next;
  });
};

const buildRotations = (studentCount: number, stations: HouseOperationStation[], requestedGroupCount?: number): HouseOperationRotationGroup[] => {
  const groupCount = Math.max(1, Math.min(6, requestedGroupCount || Math.ceil(studentCount / 25)));
  const stationIds = stations.map(station => station.id);
  return Array.from({ length: groupCount }).map((_, index) => ({
    id: makeId('eh-rot'),
    name: `Lớp/Nhóm ${String.fromCharCode(65 + index)}`,
    studentCount: Math.ceil(studentCount / groupCount),
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    route: stationIds.map((_, routeIndex) => stationIds[(routeIndex + index) % stationIds.length]).filter(Boolean)
  }));
};

const getActivityStartTime = (timeline: HouseOperationTimelineBlock[], event: Event) => {
  const firstExperience = timeline.find(block => block.kind === 'EXPERIENCE_AM' || block.kind === 'EXPERIENCE_PM');
  if (firstExperience?.startTime) return firstExperience.startTime;
  return timeline[0]?.endTime || addMinutes(getProgramStart(event), 15);
};

const buildGroupActivityTimelines = (
  event: Event,
  timeline: HouseOperationTimelineBlock[],
  stations: HouseOperationStation[],
  rotations: HouseOperationRotationGroup[]
) => {
  const stationMap = new Map(stations.map(station => [station.id, station]));
  const experienceStationIds = getExperienceStations(stations, timeline).map(station => station.id);
  const experienceSlotDuration = getDefaultRoundDuration(getExperienceStations(stations, timeline));
  const commonBlocks = timeline.filter(block => block.kind === 'COMMON');
  const experienceBlocks = timeline.filter(block => block.kind === 'EXPERIENCE_AM' || block.kind === 'EXPERIENCE_PM');

  return rotations.map(group => {
    const groupRoute = experienceStationIds.map((_, routeIndex) => experienceStationIds[(routeIndex + rotations.indexOf(group)) % experienceStationIds.length]).filter(Boolean);
    let routeCursor = 0;
    const blocks = [
      ...commonBlocks.map(block => {
        const station = block.stationId ? stationMap.get(block.stationId) : undefined;
        return {
          id: `${group.id}-${block.id}`,
          title: block.title,
          startTime: block.startTime,
          endTime: block.endTime,
          stationId: block.stationId,
          room: block.room || station?.areaDescription || station?.room,
          note: 'Hoạt động chung toàn đoàn'
        };
      }),
      ...experienceBlocks.flatMap(block => {
        const stationCount = Math.max(0, block.stationCount || 0);
        let cursor = timeToMinutes(block.startTime);
        return Array.from({ length: stationCount }).map((_, roundIndex) => {
          const stationId = groupRoute[routeCursor % Math.max(1, groupRoute.length)];
          routeCursor += 1;
          const station = stationId ? stationMap.get(stationId) : undefined;
          const duration = experienceSlotDuration;
          const item = {
            id: `${group.id}-${block.id}-${roundIndex}`,
            title: station?.name || 'Nghỉ/chờ lượt',
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(cursor + duration),
            stationId,
            room: station?.areaDescription || station?.room,
            note: `${block.sectionCode || ''} • ${station?.packageName || block.title}`
          };
          cursor += duration;
          return item;
        });
      })
    ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    return { ...group, blocks };
  });
};

const createStationInstances = (inventory: InventoryItem[]) =>
  STATION_TEMPLATES.map((template, index) => {
    const matchedEquipment = template.equipment.map(item => {
      const found = inventory.find(inv => inv.name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0]));
      return found ? { ...item, itemId: found.id, name: found.name, source: 'INVENTORY' as const } : item;
    });
    return {
      ...template,
      id: `eh-station-${index + 1}`,
      room: `Khu ${index + 1}`,
      status: 'TODO' as HouseOperationTaskStatus,
      equipment: matchedEquipment
    };
  });

const getPackageStationCategory = (pkg: ComboPackage): HouseOperationStation['category'] => {
  const text = `${pkg.name} ${pkg.category || ''} ${pkg.description || ''}`.toLowerCase();
  if (/vr|thực tế ảo|virtual/.test(text)) return 'VR';
  if (/robot|alpha|drone/.test(text)) return 'ROBOT';
  if (/workshop|stem|thí nghiệm|thi nghiem|science|khoa học/.test(text)) return 'WORKSHOP';
  if (/show|biểu diễn|bieu dien|sân khấu|san khau/.test(text)) return 'SHOW';
  if (/media|ảnh|video|camera/.test(text)) return 'MEDIA';
  return 'STEM';
};

const getPackageStationDuration = (pkg: ComboPackage) => {
  const category = getPackageStationCategory(pkg);
  if (category === 'SHOW') return 25;
  if (category === 'VR') return 30;
  if (category === 'WORKSHOP') return 35;
  if (category === 'ROBOT') return 30;
  return 25;
};

const buildEquipmentFromPackage = (pkg: ComboPackage, inventory: InventoryItem[]): HouseOperationStation['equipment'] =>
  (pkg.items || []).map(pkgItem => {
    const inv = inventory.find(item => item.id === pkgItem.itemId);
    return {
      itemId: pkgItem.itemId,
      name: inv?.name || pkgItem.itemId,
      quantity: pkgItem.quantity,
      unit: inv?.consumableUnit,
      source: 'INVENTORY' as const
    };
  });

const mergeEquipment = (
  currentEquipment: HouseOperationStation['equipment'],
  addedEquipment: HouseOperationStation['equipment']
): HouseOperationStation['equipment'] => {
  const map = new Map<string, HouseOperationStation['equipment'][number]>();
  [...currentEquipment, ...addedEquipment].forEach(item => {
    const key = item.itemId || item.name;
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : { ...item });
  });
  return Array.from(map.values());
};

const getStationPackageIds = (station: HouseOperationStation) =>
  station.packageIds && station.packageIds.length > 0
    ? station.packageIds
    : station.packageId
      ? [station.packageId]
      : [];

const getPackageNames = (packageIds: string[], packages: ComboPackage[]) =>
  packageIds
    .map(id => packages.find(pkg => pkg.id === id)?.name || id)
    .join(' + ');

const createStationFromPackage = (pkg: ComboPackage, inventory: InventoryItem[], index: number): HouseOperationStation => {
  const category = getPackageStationCategory(pkg);
  const equipment = buildEquipmentFromPackage(pkg, inventory);

  return {
    id: `eh-station-pkg-${pkg.id}-${index + 1}`,
    name: pkg.name,
    packageId: pkg.id,
    packageIds: [pkg.id],
    packageName: pkg.name,
    areaDescription: pkg.description || '',
    category,
    durationMinutes: getPackageStationDuration(pkg),
    room: `Khu ${index + 1}`,
    objective: pkg.description || `Tổ chức trạm trải nghiệm theo gói thiết bị ${pkg.name}.`,
    sopVersion: `PKG-${pkg.id}`,
    checklist: ['Kiểm tra đủ thiết bị trong gói', 'Test hoạt động trước khi đón đoàn', 'Sắp xếp khu vực và hàng chờ', 'Chốt người phụ trách trạm'],
    equipment,
    script: `Chào mừng các bạn đến với trạm ${pkg.name}. Ở trạm này, mình sẽ quan sát, thử nghiệm và rút ra kiến thức từ chính bộ giáo cụ đang dùng.`,
    status: 'TODO'
  };
};

const createEmptyAreaStation = (index: number): HouseOperationStation => ({
  id: makeId('eh-area'),
  name: `Khu vực ${index + 1}`,
  packageIds: [],
  packageName: '',
  areaDescription: '',
  category: 'OTHER',
  durationMinutes: 30,
  room: `Khu ${index + 1}`,
  objective: 'Khu vực vận hành gồm một hoặc nhiều trạm/gói thiết bị.',
  sopVersion: 'CUSTOM-AREA',
  checklist: ['Chốt vị trí khu vực', 'Gán trạm/gói thiết bị', 'Kiểm tra lối di chuyển', 'Chốt người phụ trách'],
  equipment: [],
  script: '',
  status: 'TODO'
});

const createPackageStationInstances = (packages: ComboPackage[], inventory: InventoryItem[]) =>
  packages.map((pkg, index) => createStationFromPackage(pkg, inventory, index));

const createDefaultTasks = (event: Event, stations: HouseOperationStation[], employees: Employee[]): HouseOperationTask[] => {
  const lead = employees.find(emp => /lead|hdv|leader|quản/i.test(`${emp.role} ${emp.name}`));
  const eventDate = getPrimaryDate(event);
  const deadline = eventDate ? `${eventDate}T08:00` : undefined;
  const baseTasks: HouseOperationTask[] = [
    { id: makeId('eh-task'), title: 'Chốt thông tin đoàn, sĩ số, khối, người liên hệ', scope: 'EVENT', status: 'TODO', ownerId: lead?.id, ownerName: lead?.name, deadline },
    { id: makeId('eh-task'), title: 'Khóa timeline và sơ đồ luân chuyển', scope: 'QUALITY', status: 'TODO', ownerId: lead?.id, ownerName: lead?.name, deadline },
    { id: makeId('eh-task'), title: 'Kiểm tra thiết bị, vật tư tiêu hao và phiếu kho', scope: 'ASSET', status: 'TODO', deadline },
    { id: makeId('eh-task'), title: 'Brief nhân sự, rehearsal lỗi thường gặp', scope: 'STAFF', status: 'TODO', ownerId: lead?.id, ownerName: lead?.name, deadline },
    { id: makeId('eh-task'), title: 'Chuẩn bị shot list media và người chụp', scope: 'MEDIA', status: 'TODO', deadline }
  ];
  return [
    ...baseTasks,
    ...stations.map(station => ({
      id: makeId('eh-task'),
      title: `Setup checklist trạm ${station.name}`,
      scope: 'STATION' as const,
      status: 'TODO' as HouseOperationTaskStatus,
      stationId: station.id,
      deadline
    }))
  ];
};

const createDefaultOperation = (event: Event, inventory: InventoryItem[], employees: Employee[], packages: ComboPackage[] = []): HouseOperationInstance => {
  const stations = packages.length > 0 ? createPackageStationInstances(packages, inventory) : createStationInstances(inventory);
  const studentCount = getStudentCount(event);
  const groupCount = Math.max(1, Math.min(6, Math.ceil(studentCount / 25)));
  return {
    templateVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grade: event.eventProfile?.audience?.[0] || 'Tiểu học',
    theme: event.eventProfile?.generalGoal || 'Science Experience',
    programType: event.eventProfile?.eventType || 'SCIENCE_DAY',
    studentCount,
    teacherCount: getTeacherCount(event),
    groupCount,
    stations,
    timeline: buildTimeline(event, stations),
    rotations: buildRotations(studentCount, stations, groupCount),
    tasks: createDefaultTasks(event, stations, employees),
    incidents: [],
    mediaTasks: SHOT_LIST.map(title => ({ id: makeId('eh-media'), title, checked: false })),
    feedback: [],
    live: { currentBlockId: undefined, statusNote: 'Chưa bắt đầu' },
    reportNote: ''
  };
};

const ensureOperation = (event: Event, inventory: InventoryItem[], employees: Employee[], packages: ComboPackage[] = []): HouseOperationInstance => {
  const fallback = createDefaultOperation(event, inventory, employees, packages);
  const current = event.houseOperation;
  if (!current) return fallback;
  return {
    ...fallback,
    ...current,
    stations: Array.isArray(current.stations) ? current.stations : fallback.stations,
    timeline: Array.isArray(current.timeline) ? current.timeline : fallback.timeline,
    rotations: Array.isArray(current.rotations) ? current.rotations : fallback.rotations,
    tasks: Array.isArray(current.tasks) ? current.tasks : fallback.tasks,
    incidents: current.incidents || [],
    mediaTasks: Array.isArray(current.mediaTasks) ? current.mediaTasks : fallback.mediaTasks,
    feedback: current.feedback || [],
    live: current.live || fallback.live
  };
};

const getOverlapWarnings = (timeline: HouseOperationTimelineBlock[]) => {
  const warnings = new Set<string>();
  const sorted = [...timeline].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  sorted.forEach((block, index) => {
    const next = sorted[index + 1];
    if (next && timeToMinutes(block.endTime) > timeToMinutes(next.startTime)) {
      warnings.add(block.id);
      warnings.add(next.id);
    }
  });
  return warnings;
};

const statusColor = (status: HouseOperationTaskStatus) => {
  if (status === 'DONE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'DOING') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'BLOCKED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

export const EinsteinHouseOS: React.FC<EinsteinHouseOSProps> = ({
  events,
  inventory,
  employees,
  packages,
  canEdit = true,
  onUpdateEvent
}) => {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || '');
  const [activeTab, setActiveTab] = useState<ModuleTab>('CONTROL');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackScore, setFeedbackScore] = useState(5);
  const [draggedStationId, setDraggedStationId] = useState<string | null>(null);

  const selectedEvent = events.find(event => event.id === selectedEventId) || events[0];
  const operation = useMemo(
    () => selectedEvent ? ensureOperation(selectedEvent, inventory, employees, packages) : null,
    [selectedEvent, inventory, employees, packages]
  );

  const eventCards = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...events].sort((a, b) => (getPrimaryDate(a) || '').localeCompare(getPrimaryDate(b) || ''));
    return {
      today: sorted.filter(event => getPrimaryDate(event) === today),
      upcoming: sorted.filter(event => (getPrimaryDate(event) || '') > today).slice(0, 5),
      week: sorted.filter(event => {
        const date = new Date(getPrimaryDate(event));
        const diff = date.getTime() - new Date(today).getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
    };
  }, [events]);

  const sidebarEvents = useMemo(
    () => [...events].sort((a, b) => (getPrimaryDate(b) || '').localeCompare(getPrimaryDate(a) || '')),
    [events]
  );

  const progress = useMemo(() => {
    if (!operation) return { done: 0, total: 0, pct: 0, missing: 0 };
    const total = operation.tasks.length + operation.stations.length + operation.mediaTasks.length;
    const done = operation.tasks.filter(task => task.status === 'DONE').length
      + operation.stations.filter(station => station.status === 'DONE').length
      + operation.mediaTasks.filter(task => task.checked).length;
    const missing = operation.tasks.filter(task => task.status === 'BLOCKED').length + operation.incidents.filter(incident => incident.status === 'OPEN').length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, missing };
  }, [operation]);

  const overlapWarnings = useMemo(() => operation ? getOverlapWarnings(operation.timeline) : new Set<string>(), [operation]);

  const groupActivityTimelines = useMemo(
    () => selectedEvent && operation
      ? buildGroupActivityTimelines(selectedEvent, operation.timeline, operation.stations, operation.rotations)
      : [],
    [selectedEvent, operation]
  );

  const hasGroupStationConflict = operation ? (operation.groupCount || operation.rotations.length || 1) > Math.max(1, operation.stations.length) : false;

  const saveOperation = (updater: (current: HouseOperationInstance) => HouseOperationInstance) => {
    if (!selectedEvent || !canEdit) return;
    const current = ensureOperation(selectedEvent, inventory, employees, packages);
    onUpdateEvent(selectedEvent.id, {
      houseOperation: {
        ...updater(current),
        updatedAt: new Date().toISOString()
      }
    });
  };

  const initializeOperation = () => {
    if (!selectedEvent || !canEdit) return;
    onUpdateEvent(selectedEvent.id, { houseOperation: createDefaultOperation(selectedEvent, inventory, employees, packages) });
  };

  const updateTask = (taskId: string, patch: Partial<HouseOperationTask>) => {
    saveOperation(current => ({
      ...current,
      tasks: current.tasks.map(task => task.id === taskId ? { ...task, ...patch } : task)
    }));
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    saveOperation(current => ({
      ...current,
      tasks: [
        ...current.tasks,
        { id: makeId('eh-task'), title: newTaskTitle.trim(), scope: 'EVENT', status: 'TODO' }
      ]
    }));
    setNewTaskTitle('');
  };

  const addPackageStation = (pkg: ComboPackage) => {
    saveOperation(current => {
      const station = {
        ...createStationFromPackage(pkg, inventory, current.stations.length),
        id: makeId('eh-station')
      };
      const stations = [...current.stations, station];
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const addEmptyArea = () => {
    saveOperation(current => {
      const stations = [...current.stations, createEmptyAreaStation(current.stations.length)];
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const updateStation = (stationId: string, patch: Partial<HouseOperationStation>) => {
    saveOperation(current => {
      const stations = current.stations.map(station => station.id === stationId ? { ...station, ...patch } : station);
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const reorderStation = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    saveOperation(current => {
      const sourceIndex = current.stations.findIndex(station => station.id === sourceId);
      const targetIndex = current.stations.findIndex(station => station.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const stations = [...current.stations];
      const [moving] = stations.splice(sourceIndex, 1);
      stations.splice(targetIndex, 0, moving);
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const mergePackageIntoStation = (stationId: string, packageId: string) => {
    const pkg = packages.find(item => item.id === packageId);
    if (!pkg) return;
    saveOperation(current => {
      const stations = current.stations.map(station => {
        if (station.id !== stationId) return station;
        const packageIds = getStationPackageIds(station);
        if (packageIds.includes(pkg.id)) return station;
        const nextPackageIds = [...packageIds, pkg.id];
        return {
          ...station,
          packageId: nextPackageIds[0],
          packageIds: nextPackageIds,
          packageName: getPackageNames(nextPackageIds, packages),
          category: station.category === 'OTHER' ? getPackageStationCategory(pkg) : station.category,
          equipment: mergeEquipment(station.equipment || [], buildEquipmentFromPackage(pkg, inventory)),
          checklist: Array.from(new Set([...(station.checklist || []), 'Kiểm tra đủ thiết bị các gói đã gộp'])),
          objective: station.objective || pkg.description || `Tổ chức trạm từ nhiều gói thiết bị.`
        };
      });
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const removeStation = (stationId: string) => {
    saveOperation(current => {
      const stations = current.stations.filter(station => station.id !== stationId);
      return {
        ...current,
        stations,
        timeline: recalcStructuredTimeline(selectedEvent!, stations, current.timeline.filter(block => block.stationId !== stationId)),
        rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount),
        tasks: current.tasks.filter(task => task.stationId !== stationId)
      };
    });
  };

  const recalcTimeline = () => {
    saveOperation(current => ({
      ...current,
      timeline: buildTimeline(selectedEvent!, current.stations)
    }));
  };

  const insertBreak = () => {
    saveOperation(current => {
      if (current.timeline.some(block => block.kind === 'BREAK')) return current;
      const breakBlock: HouseOperationTimelineBlock = {
        id: makeId('eh-time'),
        sectionCode: 'D',
        kind: 'BREAK',
        title: 'Nghỉ giữa giờ',
        startTime: getProgramStart(selectedEvent!),
        endTime: addMinutes(getProgramStart(selectedEvent!), 10),
        note: 'Nếu có mốc này, hoạt động sáng được hiểu là C1 trước nghỉ và C2 sau nghỉ.'
      };
      const timeline = [...current.timeline];
      const amIndex = timeline.findIndex(block => block.kind === 'EXPERIENCE_AM');
      if (amIndex >= 0) {
        const amBlock = timeline[amIndex];
        const totalStations = Math.max(1, amBlock.stationCount || 1);
        const firstCount = Math.ceil(totalStations / 2);
        const secondCount = Math.max(0, totalStations - firstCount);
        timeline.splice(
          amIndex,
          1,
          { ...amBlock, sectionCode: 'C1', title: 'Hoạt động trải nghiệm sáng C1', stationCount: firstCount },
          breakBlock,
          {
            ...amBlock,
            id: makeId('eh-time'),
            sectionCode: 'C2',
            title: 'Hoạt động trải nghiệm sáng C2',
            stationCount: secondCount,
            note: 'Ẩn/để 0 nếu không cần chạy thêm trạm sáng sau nghỉ.'
          }
        );
      } else {
        const lunchIndex = timeline.findIndex(block => block.kind === 'LUNCH');
        const insertAt = lunchIndex >= 0 ? lunchIndex : Math.max(1, timeline.length - 1);
        timeline.splice(insertAt, 0, breakBlock);
      }
      return { ...current, timeline: recalcStructuredTimeline(selectedEvent!, current.stations, timeline) };
    });
  };

  const addCommonActivity = () => {
    saveOperation(current => {
      const firstStation = current.stations[0];
      const block: HouseOperationTimelineBlock = {
        id: makeId('eh-time'),
        sectionCode: 'B',
        kind: 'COMMON',
        title: 'Hoạt động chung',
        startTime: getProgramStart(selectedEvent!),
        endTime: addMinutes(getProgramStart(selectedEvent!), firstStation?.durationMinutes || 15),
        stationId: firstStation?.id,
        room: firstStation?.areaDescription || firstStation?.room,
        note: 'Toàn bộ nhóm cùng tham gia mốc này.'
      };
      const firstExperienceIndex = current.timeline.findIndex(item => item.kind === 'EXPERIENCE_AM' || item.kind === 'EXPERIENCE_PM');
      const insertAt = firstExperienceIndex >= 0 ? firstExperienceIndex : Math.max(1, current.timeline.length - 1);
      const timeline = [...current.timeline];
      timeline.splice(insertAt, 0, block);
      return { ...current, timeline: recalcStructuredTimeline(selectedEvent!, current.stations, timeline) };
    });
  };

  const updateTimeline = (blockId: string, patch: Partial<HouseOperationTimelineBlock>) => {
    saveOperation(current => ({
      ...current,
      timeline: recalcStructuredTimeline(
        selectedEvent!,
        current.stations,
        current.timeline.map(block => block.id === blockId ? { ...block, ...patch } : block)
      )
    }));
  };

  const moveTimelineBlock = (blockId: string, delta: number) => {
    saveOperation(current => {
      const index = current.timeline.findIndex(block => block.id === blockId);
      const targetIndex = index + delta;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.timeline.length) return current;
      const timeline = [...current.timeline];
      const [moving] = timeline.splice(index, 1);
      timeline.splice(targetIndex, 0, moving);
      return { ...current, timeline: recalcStructuredTimeline(selectedEvent!, current.stations, timeline) };
    });
  };

  const removeTimelineBlock = (blockId: string) => {
    saveOperation(current => {
      if (current.timeline.length <= 1) return current;
      const target = current.timeline.find(block => block.id === blockId);
      const timeline = current.timeline.filter(block => block.id !== blockId);
      const normalizedTimeline =
        target?.sectionCode === 'D'
          ? timeline.map(block => block.sectionCode === 'C1' ? { ...block, sectionCode: 'C' as const, title: 'Hoạt động trải nghiệm sáng' } : block)
          : timeline;
      return { ...current, timeline: recalcStructuredTimeline(selectedEvent!, current.stations, normalizedTimeline) };
    });
  };

  const regenerateRotations = () => {
    saveOperation(current => ({
      ...current,
      rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), current.stations, current.groupCount)
    }));
  };

  const updateGroupCount = (value: number) => {
    const groupCount = Math.max(1, Math.min(6, Math.round(value || 1)));
    saveOperation(current => ({
      ...current,
      groupCount,
      rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), current.stations, groupCount)
    }));
  };

  const addIncident = () => {
    if (!newIncidentTitle.trim()) return;
    saveOperation(current => ({
      ...current,
      incidents: [
        {
          id: makeId('eh-incident'),
          title: newIncidentTitle.trim(),
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date().toISOString()
        },
        ...current.incidents
      ]
    }));
    setNewIncidentTitle('');
  };

  const updateIncident = (incidentId: string, patch: Partial<HouseOperationIncident>) => {
    saveOperation(current => ({
      ...current,
      incidents: current.incidents.map(incident => incident.id === incidentId ? { ...incident, ...patch } : incident)
    }));
  };

  const toggleMedia = (mediaId: string, checked: boolean) => {
    saveOperation(current => ({
      ...current,
      mediaTasks: current.mediaTasks.map(task => task.id === mediaId ? { ...task, checked } : task)
    }));
  };

  const addFeedback = () => {
    if (!feedbackNote.trim()) return;
    const feedback: HouseOperationFeedback = {
      id: makeId('eh-feedback'),
      source: 'TEACHER',
      score: feedbackScore,
      note: feedbackNote.trim(),
      createdAt: new Date().toISOString()
    };
    saveOperation(current => ({ ...current, feedback: [feedback, ...current.feedback] }));
    setFeedbackNote('');
  };

  const equipmentOrder = useMemo(() => {
    if (!operation || !selectedEvent) return [];
    const map = new Map<string, { name: string; quantity: number; unit?: string; itemId?: string; available?: number }>();
    operation.stations.forEach(station => {
      station.equipment.forEach(item => {
        const key = item.itemId || item.name;
        const inv = item.itemId ? inventory.find(i => i.id === item.itemId) : undefined;
        const existing = map.get(key);
        map.set(key, {
          name: item.name,
          quantity: (existing?.quantity || 0) + item.quantity,
          unit: item.unit,
          itemId: item.itemId,
          available: inv?.availableQuantity
        });
      });
    });
    selectedEvent.items.forEach(alloc => {
      const inv = inventory.find(item => item.id === alloc.itemId);
      if (!inv) return;
      const existing = map.get(inv.id);
      map.set(inv.id, {
        name: inv.name,
        quantity: (existing?.quantity || 0) + alloc.quantity,
        itemId: inv.id,
        available: inv.availableQuantity
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [operation, selectedEvent, inventory]);

  if (!selectedEvent || !operation) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white border border-slate-200 rounded-lg">
        <div className="text-center">
          <Building2 className="mx-auto text-slate-300" size={48} />
          <h2 className="mt-4 text-xl font-black text-slate-800">Einstein House Operation OS</h2>
          <p className="mt-2 text-sm text-slate-500">Chưa có sự kiện nào để tạo đoàn trường.</p>
        </div>
      </div>
    );
  }

  const currentBlock = operation.timeline.find(block => block.id === operation.live?.currentBlockId);
  const reportSummary = [
    `Đoàn: ${selectedEvent.name}`,
    `Trường/đơn vị: ${selectedEvent.client}`,
    `Ngày: ${formatDate(getPrimaryDate(selectedEvent))}`,
    `Quy mô: ${operation.studentCount || getStudentCount(selectedEvent)} học sinh, ${operation.teacherCount || getTeacherCount(selectedEvent)} giáo viên`,
    `Trạm: ${operation.stations.map(station => station.name).join(', ')}`,
    `Tiến độ chuẩn bị: ${progress.pct}%`,
    `Incident mở: ${operation.incidents.filter(incident => incident.status === 'OPEN').length}`,
    `Feedback trung bình: ${operation.feedback.length ? (operation.feedback.reduce((sum, item) => sum + (item.score || 0), 0) / operation.feedback.length).toFixed(1) : 'Chưa có'}`
  ].join('\n');

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-teal-700">
              <Building2 size={16} />
              Einstein House Operation OS
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Hệ điều hành vận hành đón đoàn</h1>
            <p className="mt-1 text-sm text-slate-500">Chạy song song với quản lý sự kiện, dùng chung dữ liệu đoàn, kho, gói thiết bị và nhân sự Einstein Bus.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-full xl:min-w-[420px]">
            <div className="border border-emerald-100 bg-emerald-50 rounded-lg p-3">
              <p className="text-[11px] font-bold text-emerald-700">Hôm nay</p>
              <p className="text-2xl font-black text-emerald-900">{eventCards.today.length}</p>
            </div>
            <div className="border border-amber-100 bg-amber-50 rounded-lg p-3">
              <p className="text-[11px] font-bold text-amber-700">7 ngày tới</p>
              <p className="text-2xl font-black text-amber-900">{eventCards.week.length}</p>
            </div>
            <div className="border border-rose-100 bg-rose-50 rounded-lg p-3">
              <p className="text-[11px] font-bold text-rose-700">Đang thiếu</p>
              <p className="text-2xl font-black text-rose-900">{progress.missing}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
        <aside className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-slate-800">Đoàn trường</h2>
              <CalendarDays size={18} className="text-slate-400" />
            </div>
            <div className="space-y-2 max-h-[430px] overflow-auto pr-1">
              {sidebarEvents.map(event => {
                const op = ensureOperation(event, inventory, employees, packages);
                const taskTotal = op.tasks.length || 1;
                const taskDone = op.tasks.filter(task => task.status === 'DONE').length;
                const pct = Math.round((taskDone / taskTotal) * 100);
                const active = event.id === selectedEvent.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full text-left border rounded-lg p-3 transition ${active ? 'border-teal-400 bg-teal-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-800 leading-snug">{event.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{event.client}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full border ${pct >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : pct >= 45 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 size={14} />
                      {formatDate(getPrimaryDate(event))}
                    </div>
                  </button>
                );
              })}
              {events.length === 0 && <p className="text-sm text-slate-500">Chưa có sự kiện.</p>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h2 className="font-black text-slate-800 mb-3">OS Modules</h2>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map((module, index) => (
                <div key={module} className="border border-slate-100 rounded-md px-2 py-2 bg-slate-50 text-[11px] font-bold text-slate-600">
                  {index + 1}. {module}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">{selectedEvent.name}</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><MapPin size={16} />{selectedEvent.location || 'Chưa có địa điểm'}</span>
                  <span className="inline-flex items-center gap-1"><Users size={16} />{operation.studentCount} HS / {operation.teacherCount} GV</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={16} />{getProgramStart(selectedEvent)}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={initializeOperation}
                  disabled={!canEdit}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300"
                >
                  <RefreshCw size={16} />
                  Khởi tạo từ template
                </button>
                <button
                  onClick={() => saveOperation(current => current)}
                  disabled={!canEdit}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:text-slate-300"
                >
                  <Save size={16} />
                  Lưu instance
                </button>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Chuẩn bị tổng thể</span>
                <span>{progress.done}/{progress.total} hạng mục</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${progress.pct >= 80 ? 'bg-emerald-500' : progress.pct >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          </section>

          <div className="bg-white border border-slate-200 rounded-lg p-2">
            <div className="flex overflow-x-auto gap-2">
              {[
                ['CONTROL', Radio],
                ['DESIGN', Wand2],
                ['TIMELINE', TimerReset],
                ['TASKS', ClipboardCheck],
                ['KNOWLEDGE', Library],
                ['LIVE', PlayCircle],
                ['REPORT', BarChart3]
              ].map(([tab, Icon]) => (
                <button
                  key={tab as string}
                  onClick={() => setActiveTab(tab as ModuleTab)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold whitespace-nowrap ${activeTab === tab ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Icon size={16} />
                  {tab as string}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'CONTROL' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Radio size={18} />Event Dashboard</h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Metric title="Stations" value={operation.stations.length} tone="teal" />
                  <Metric title="Tasks done" value={`${operation.tasks.filter(t => t.status === 'DONE').length}/${operation.tasks.length}`} tone="emerald" />
                  <Metric title="Incidents open" value={operation.incidents.filter(i => i.status === 'OPEN').length} tone="rose" />
                </div>
                <div className="mt-4 space-y-2">
                  {operation.timeline.slice(0, 5).map(block => (
                    <div key={block.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${overlapWarnings.has(block.id) ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div>
                        <p className="font-bold text-slate-800">{block.title}</p>
                        <p className="text-xs text-slate-500">{block.room || block.note || 'Operation block'}</p>
                      </div>
                      <span className="font-black text-slate-700">{block.startTime} - {block.endTime}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Sparkles size={18} />AI Assistant Prompt</h3>
                <div className="mt-3 rounded-lg bg-cyan-50 border border-cyan-100 p-3 text-sm text-cyan-900 whitespace-pre-wrap">
                  {`Tạo chương trình cho ${operation.studentCount} học sinh, ${operation.grade || 'Tiểu học'}, ${operation.stations.length} trạm: ${operation.stations.map(s => s.name).join(', ')}. Ưu tiên timeline không trùng, đủ thiết bị, có checklist setup và incident fallback.`}
                </div>
                <p className="mt-3 text-xs text-slate-500">Prompt này dùng dữ liệu thật của đoàn hiện tại để đưa vào AI Chat khi cần sinh script hoặc tối ưu kế hoạch.</p>
              </section>
            </div>
          )}

          {activeTab === 'DESIGN' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Wand2 size={18} />Event Designer</h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Khối">
                    <input value={operation.grade || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, grade: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                  <Field label="Chủ đề">
                    <input value={operation.theme || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, theme: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                  <Field label="Số học sinh">
                    <input type="number" value={operation.studentCount || 0} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, studentCount: Number(e.target.value), rotations: buildRotations(Number(e.target.value) || 1, cur.stations, cur.groupCount) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                  <Field label="Số giáo viên">
                    <input type="number" value={operation.teacherCount || 0} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, teacherCount: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-black uppercase text-slate-500 mb-2">Tạo nhanh khu vực từ gói thiết bị</p>
                  <div className="flex flex-wrap gap-2">
                    {packages.map(pkg => {
                      const alreadyAdded = operation.stations.some(station => getStationPackageIds(station).includes(pkg.id));
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => addPackageStation(pkg)}
                          disabled={!canEdit}
                          className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-bold hover:bg-slate-50 disabled:text-slate-300 ${alreadyAdded ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-800'}`}
                          title={`${pkg.items.length} thiết bị trong gói`}
                        >
                          <Plus size={15} />
                          {pkg.name}
                          <span className="text-[11px] font-black text-slate-400">({pkg.items.length})</span>
                        </button>
                      );
                    })}
                    {packages.length === 0 && (
                      <div className="w-full rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        Chưa có gói thiết bị. Hãy tạo gói ở module Gói thiết bị để EH OS dùng làm trạm.
                      </div>
                    )}
                    {packages.length === 0 && STATION_TEMPLATES.map(template => (
                      <button key={template.name} disabled className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-300">
                        <Plus size={15} />
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-slate-900 flex items-center gap-2"><Route size={18} />Program Canvas</h3>
                  <button onClick={addEmptyArea} disabled={!canEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-black disabled:bg-slate-300">
                    <Plus size={15} />
                    Khu vực mới
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {operation.stations.map((station, index) => {
                    const stationPackageIds = getStationPackageIds(station);
                    const mergeablePackages = packages.filter(pkg => !stationPackageIds.includes(pkg.id));
                    return (
                      <div
                        key={station.id}
                        draggable={canEdit}
                        onDragStart={() => setDraggedStationId(station.id)}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => {
                          if (draggedStationId) reorderStation(draggedStationId, station.id);
                          setDraggedStationId(null);
                        }}
                        onDragEnd={() => setDraggedStationId(null)}
                        className={`flex flex-col gap-3 border rounded-lg p-3 transition overflow-hidden ${draggedStationId === station.id ? 'border-teal-300 bg-teal-50' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button type="button" disabled={!canEdit} className="mt-2 text-slate-300 cursor-grab active:cursor-grabbing disabled:cursor-default shrink-0" title="Kéo để đổi thứ tự">
                            <GripVertical size={18} />
                          </button>
                          <div className="h-9 w-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-black shrink-0">{index + 1}</div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              value={station.name}
                              disabled={!canEdit}
                              onChange={event => updateStation(station.id, { name: event.target.value })}
                              className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-800 bg-white"
                              placeholder="Tên khu vực"
                            />
                            <input
                              value={station.areaDescription ?? station.room ?? ''}
                              disabled={!canEdit}
                              onChange={event => updateStation(station.id, { areaDescription: event.target.value, room: event.target.value })}
                              className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white"
                              placeholder="Mô tả nhỏ: tầng, vị trí, gần cửa..."
                            />
                            <p className="text-xs text-slate-500 leading-relaxed break-words">
                              {station.packageName ? `Gói/trạm trong khu vực: ${station.packageName}` : 'Chưa chọn gói/trạm cho khu vực này'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[92px_minmax(0,1fr)_120px_32px] gap-2 items-center w-full pl-0 sm:pl-12">
                          <label className="flex items-center gap-1 border rounded-lg bg-white px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              value={station.durationMinutes}
                              disabled={!canEdit}
                              onChange={event => updateStation(station.id, { durationMinutes: Math.max(1, Number(event.target.value) || 1) })}
                              className="w-full min-w-0 text-xs font-bold outline-none"
                            />
                            <span className="text-[11px] font-bold text-slate-400">phút</span>
                          </label>
                          <select
                            value=""
                            disabled={!canEdit || mergeablePackages.length === 0}
                            onChange={event => {
                              if (!event.target.value) return;
                              mergePackageIntoStation(station.id, event.target.value);
                              event.currentTarget.value = '';
                            }}
                            className="w-full min-w-0 border rounded-lg px-2 py-2 text-xs font-bold bg-white"
                          >
                            <option value="">Chọn/gộp gói vào khu vực</option>
                            {mergeablePackages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.items.length})</option>)}
                          </select>
                          <select value={station.status || 'TODO'} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, stations: cur.stations.map(s => s.id === station.id ? { ...s, status: e.target.value as HouseOperationTaskStatus } : s) }))} className="w-full min-w-0 border rounded-lg px-2 py-2 text-xs font-bold bg-white">
                            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <button onClick={() => removeStation(station.id)} disabled={!canEdit} className="h-8 w-8 inline-flex items-center justify-center text-slate-300 hover:text-rose-600 disabled:hover:text-slate-300"><Trash2 size={17} /></button>
                        </div>
                      </div>
                    );
                  })}
                  {operation.stations.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                      Canvas đang trống. Chọn gói thiết bị bên trái để thêm lại trạm theo thứ tự mong muốn.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><TimerReset size={18} />Timeline tổng</h3>
                    <p className="mt-1 text-xs text-slate-500">Các mốc chung cho toàn đoàn: đến, show chung, nghỉ, ăn, ra về.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addCommonActivity} disabled={!canEdit} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:text-slate-300">Thêm hoạt động chung</button>
                    <button onClick={insertBreak} disabled={!canEdit} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:text-slate-300">Thêm nghỉ giữa giờ</button>
                    <button onClick={recalcTimeline} disabled={!canEdit} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300">Sinh mốc chung</button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {operation.timeline.map(block => {
                    if ((block.sectionCode === 'C2' || block.sectionCode === 'F') && (block.stationCount || 0) <= 0) return null;
                    const isExperience = block.kind === 'EXPERIENCE_AM' || block.kind === 'EXPERIENCE_PM';
                    const isCommon = block.kind === 'COMMON';
                    return (
                      <div key={block.id} className={`border rounded-lg p-3 ${block.warning || overlapWarnings.has(block.id) ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-white'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-[48px_92px_92px_minmax(0,1fr)] gap-2">
                          <div className="flex items-center justify-between gap-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-black px-2">
                            <span>{block.sectionCode || '-'}</span>
                            <span className="flex items-center gap-1 leading-none">
                              <span className="flex flex-col">
                                <button type="button" disabled={!canEdit} onClick={() => moveTimelineBlock(block.id, -1)} className="text-[10px] text-slate-400 hover:text-slate-800 disabled:hover:text-slate-400">↑</button>
                                <button type="button" disabled={!canEdit} onClick={() => moveTimelineBlock(block.id, 1)} className="text-[10px] text-slate-400 hover:text-slate-800 disabled:hover:text-slate-400">↓</button>
                              </span>
                              <button type="button" disabled={!canEdit || operation.timeline.length <= 1} onClick={() => removeTimelineBlock(block.id)} className="text-slate-300 hover:text-rose-600 disabled:hover:text-slate-300" title="Xóa mốc">
                                <Trash2 size={12} />
                              </button>
                            </span>
                          </div>
                          <input type="time" value={block.startTime} disabled={!canEdit} onChange={e => updateTimeline(block.id, { startTime: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                          <input type="time" value={block.endTime} disabled={!canEdit} onChange={e => updateTimeline(block.id, { endTime: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                          <input value={block.title} disabled={!canEdit} onChange={e => updateTimeline(block.id, { title: e.target.value })} className="border rounded-lg px-2 py-2 text-sm font-bold" />
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
                          {isCommon ? (
                            <select
                              value={block.stationId || ''}
                              disabled={!canEdit}
                              onChange={e => {
                                const station = operation.stations.find(item => item.id === e.target.value);
                                updateTimeline(block.id, {
                                  stationId: station?.id,
                                  title: station?.name || block.title,
                                  room: station?.areaDescription || station?.room,
                                  endTime: addMinutes(block.startTime, station?.durationMinutes || 15)
                                });
                              }}
                              className="border rounded-lg px-2 py-2 text-sm font-bold bg-white"
                            >
                              <option value="">Chọn trạm xem chung</option>
                              {operation.stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                            </select>
                          ) : (
                            <input value={block.room || ''} disabled={!canEdit} onChange={e => updateTimeline(block.id, { room: e.target.value })} placeholder="Phòng/khu hoặc ghi chú" className="border rounded-lg px-2 py-2 text-sm" />
                          )}
                          {isExperience ? (
                            <label className="flex items-center gap-2 border rounded-lg px-2 py-2 bg-white">
                              <span className="text-[11px] font-black text-slate-500">Số trạm</span>
                              <input
                                type="number"
                                min={0}
                                value={block.stationCount || 0}
                                disabled={!canEdit}
                                onChange={e => updateTimeline(block.id, { stationCount: Math.max(0, Number(e.target.value) || 0) })}
                                className="min-w-0 flex-1 text-sm font-black outline-none"
                              />
                            </label>
                          ) : (
                            <input value={block.note || ''} disabled={!canEdit} onChange={e => updateTimeline(block.id, { note: e.target.value })} placeholder="Ghi chú" className="border rounded-lg px-2 py-2 text-sm" />
                          )}
                        </div>
                        {block.warning && (
                          <div className="mt-2 flex items-start gap-2 text-xs font-bold text-rose-700">
                            <AlertTriangle size={14} />
                            <span>{block.warning}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><Route size={18} />Thiết lập nhóm</h3>
                    <p className="mt-1 text-xs text-slate-500">Nhập số nhóm, hệ thống sinh timeline hoạt động riêng để tránh trùng trạm cùng giờ.</p>
                  </div>
                  <button onClick={regenerateRotations} disabled={!canEdit} className="text-sm font-bold text-teal-700 disabled:text-slate-300">Sinh lại</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Số nhóm">
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={operation.groupCount || operation.rotations.length || 1}
                      disabled={!canEdit}
                      onChange={event => updateGroupCount(Number(event.target.value))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-black"
                    />
                  </Field>
                  <Field label="Số trạm/khu vực">
                    <input readOnly value={operation.stations.length} className="w-full border rounded-lg px-3 py-2 text-sm font-black bg-slate-50" />
                  </Field>
                </div>
                {hasGroupStationConflict && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                    Số nhóm đang nhiều hơn số khu vực/trạm, có thể phải cho một số nhóm nghỉ/chờ hoặc bổ sung khu vực để tránh trùng.
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {operation.rotations.map((group, groupIndex) => (
                    <div key={group.id} className="border border-slate-100 bg-slate-50 rounded-lg p-3" style={{ borderLeft: `5px solid ${group.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length]}` }}>
                      <div className="flex items-center justify-between">
                        <p className="font-black text-slate-800">{group.name}</p>
                        <span className="text-xs font-bold text-slate-500">{group.studentCount} HS</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.route.map((stationId, index) => {
                          const station = operation.stations.find(s => s.id === stationId);
                          return <span key={`${group.id}-${stationId}-${index}`} className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold">{index + 1}. {station?.name || stationId}</span>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="xl:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><TimerReset size={18} />Timeline hoạt động theo nhóm</h3>
                    <p className="mt-1 text-xs text-slate-500">Các nhóm chạy song song theo màu. Cùng một round sẽ có cùng mốc giờ, nhưng đi khu vực khác nhau.</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Bắt đầu sau: {getActivityStartTime(operation.timeline, selectedEvent)}</span>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {groupActivityTimelines.map((group, groupIndex) => (
                    <div key={group.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3" style={{ borderTop: `5px solid ${group.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length]}` }}>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-black text-slate-900">{group.name}</h4>
                        <span className="text-xs font-black text-slate-500">{group.studentCount} HS</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.blocks.map((block, blockIndex) => (
                          <div key={block.id} className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-black text-slate-800 leading-snug">{blockIndex + 1}. {block.title}</p>
                              <span className="shrink-0 text-[11px] font-black text-slate-500">{block.startTime}-{block.endTime}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{block.room || 'Chưa gán vị trí'}{block.note ? ` • ${block.note}` : ''}</p>
                          </div>
                        ))}
                        {group.blocks.length === 0 && <p className="text-sm text-slate-500">Chưa có khu vực/trạm để sinh timeline hoạt động.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'TASKS' && (
            <section className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-black text-slate-900 flex items-center gap-2"><ClipboardCheck size={18} />Action Plan + Human Assignment</h3>
              <div className="mt-4 flex gap-2">
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Thêm việc cần làm..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button onClick={addTask} disabled={!canEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold disabled:bg-slate-300"><Plus size={16} />Thêm</button>
              </div>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2">Việc</th>
                      <th>Scope</th>
                      <th>Owner</th>
                      <th>Deadline</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operation.tasks.map(task => (
                      <tr key={task.id} className="border-b border-slate-100">
                        <td className="py-3 font-bold text-slate-800">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={task.status === 'DONE'} disabled={!canEdit} onChange={e => updateTask(task.id, { status: e.target.checked ? 'DONE' : 'TODO' })} />
                            {task.title}
                          </label>
                        </td>
                        <td className="text-slate-500">{task.scope}</td>
                        <td>
                          <select value={task.ownerId || ''} disabled={!canEdit} onChange={e => {
                            const emp = employees.find(item => item.id === e.target.value);
                            updateTask(task.id, { ownerId: emp?.id || undefined, ownerName: emp?.name || undefined });
                          }} className="border rounded-lg px-2 py-1">
                            <option value="">Chưa gán</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                          </select>
                        </td>
                        <td><input type="datetime-local" value={task.deadline || ''} disabled={!canEdit} onChange={e => updateTask(task.id, { deadline: e.target.value })} className="border rounded-lg px-2 py-1" /></td>
                        <td>
                          <select value={task.status} disabled={!canEdit} onChange={e => updateTask(task.id, { status: e.target.value as HouseOperationTaskStatus })} className={`border rounded-lg px-2 py-1 font-bold ${statusColor(task.status)}`}>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'KNOWLEDGE' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Library size={18} />SOP Center + Station Library</h3>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {operation.stations.map(station => (
                    <div key={station.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-800">{station.name}</p>
                          <p className="text-xs text-slate-500">{station.sopVersion} • {station.durationMinutes} phút</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full border text-[11px] font-bold ${statusColor(station.status || 'TODO')}`}>{STATUS_LABELS[station.status || 'TODO']}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{station.objective}</p>
                      <div className="mt-3 space-y-1">
                        {station.checklist.map(item => (
                          <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            {item}
                          </div>
                        ))}
                      </div>
                      <textarea value={station.script || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, stations: cur.stations.map(s => s.id === station.id ? { ...s, script: e.target.value } : s) }))} className="mt-3 w-full min-h-[90px] border rounded-lg p-2 text-xs" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><PackageCheck size={18} />Equipment Order</h3>
                <div className="mt-4 space-y-2">
                  {equipmentOrder.map(item => (
                    <div key={item.itemId || item.name} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg p-3">
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.itemId ? 'Từ kho Einstein Bus' : 'Vật tư thủ công'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900">{item.quantity} {item.unit || ''}</p>
                        {item.available !== undefined && <p className={`text-xs font-bold ${item.available >= item.quantity ? 'text-emerald-600' : 'text-rose-600'}`}>Kho: {item.available}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'LIVE' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><PlayCircle size={18} />Live Command Center</h3>
                <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs font-black uppercase text-teal-700">Đang chạy</p>
                  <select value={operation.live?.currentBlockId || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, live: { ...cur.live, currentBlockId: e.target.value, lastUpdatedAt: new Date().toISOString() } }))} className="mt-2 w-full border rounded-lg px-3 py-2 font-bold">
                    <option value="">Chưa chọn block</option>
                    {operation.timeline.map(block => <option key={block.id} value={block.id}>{block.startTime} - {block.title}</option>)}
                  </select>
                  <div className="mt-4 text-3xl font-black text-teal-950">{currentBlock ? currentBlock.title : 'Standby'}</div>
                  <p className="mt-1 text-sm text-teal-800">{currentBlock ? `${currentBlock.startTime} - ${currentBlock.endTime} • ${currentBlock.room || 'Không gian chung'}` : 'Chọn block khi bắt đầu vận hành.'}</p>
                  <textarea value={operation.live?.statusNote || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, live: { ...cur.live, statusNote: e.target.value, lastUpdatedAt: new Date().toISOString() } }))} className="mt-4 w-full min-h-[90px] border rounded-lg p-3 text-sm" placeholder="Ghi chú live: VR chậm 5 phút, cần hỗ trợ..." />
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Siren size={18} />Incident Center</h3>
                <div className="mt-4 flex gap-2">
                  <input value={newIncidentTitle} onChange={e => setNewIncidentTitle(e.target.value)} placeholder="Robot hết pin, trẻ khóc..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                  <button onClick={addIncident} disabled={!canEdit} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:bg-slate-300">Báo</button>
                </div>
                <div className="mt-4 space-y-2">
                  {operation.incidents.map(incident => (
                    <div key={incident.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-800">{incident.title}</p>
                        <p className="text-xs text-slate-500">{new Date(incident.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                      <button onClick={() => updateIncident(incident.id, { status: incident.status === 'OPEN' ? 'RESOLVED' : 'OPEN', resolvedAt: incident.status === 'OPEN' ? new Date().toISOString() : undefined })} disabled={!canEdit} className={`px-2 py-1 rounded-full border text-xs font-bold ${incident.status === 'OPEN' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {incident.status === 'OPEN' ? 'Đang xử lý' : 'Đã xử lý'}
                      </button>
                    </div>
                  ))}
                  {operation.incidents.length === 0 && <p className="text-sm text-slate-500">Chưa có incident.</p>}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'REPORT' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Camera size={18} />Media Center</h3>
                <div className="mt-4 space-y-2">
                  {operation.mediaTasks.map(task => (
                    <label key={task.id} className="flex items-center gap-2 border border-slate-100 rounded-lg p-3 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={task.checked} disabled={!canEdit} onChange={e => toggleMedia(task.id, e.target.checked)} />
                      {task.checked ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} className="text-slate-300" />}
                      {task.title}
                    </label>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><MessageSquareText size={18} />Feedback</h3>
                <div className="mt-4 space-y-2">
                  <input type="number" min={1} max={5} value={feedbackScore} onChange={e => setFeedbackScore(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <textarea value={feedbackNote} onChange={e => setFeedbackNote(e.target.value)} placeholder="Feedback giáo viên/HDV..." className="w-full min-h-[100px] border rounded-lg p-3 text-sm" />
                  <button onClick={addFeedback} disabled={!canEdit} className="w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300">Ghi feedback</button>
                </div>
                <div className="mt-4 space-y-2">
                  {operation.feedback.slice(0, 4).map(item => (
                    <div key={item.id} className="border border-slate-100 rounded-lg p-3">
                      <p className="font-bold text-slate-800">{item.score || '-'} ★</p>
                      <p className="text-sm text-slate-600">{item.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><FileText size={18} />Report Generator</h3>
                <textarea readOnly value={reportSummary} className="mt-4 w-full min-h-[220px] border rounded-lg p-3 text-sm font-mono bg-slate-50" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric title="Station rating" value={operation.feedback.length ? `${(operation.feedback.reduce((s, f) => s + (f.score || 0), 0) / operation.feedback.length).toFixed(1)}★` : '-'} tone="amber" />
                  <Metric title="Chậm/trùng" value={overlapWarnings.size} tone="rose" />
                </div>
              </section>
            </div>
          )}
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

const Metric: React.FC<{ title: string; value: React.ReactNode; tone: 'teal' | 'emerald' | 'amber' | 'rose' }> = ({ title, value, tone }) => {
  const classes = {
    teal: 'bg-teal-50 border-teal-100 text-teal-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900'
  };
  return (
    <div className={`border rounded-lg p-3 ${classes[tone]}`}>
      <p className="text-[11px] font-black uppercase opacity-70">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
};
