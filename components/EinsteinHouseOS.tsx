import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Bot,
  Box,
  BookOpen,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  Cpu,
  FileText,
  GripVertical,
  Library,
  MapPin,
  MessageSquareText,
  Microscope,
  Palette,
  PackageCheck,
  PlayCircle,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Rocket,
  Save,
  Siren,
  Sparkles,
  Telescope,
  TimerReset,
  Trash2,
  UserRoundCheck,
  Users,
  Wrench,
  Wand2,
  X
} from 'lucide-react';
import {
  ComboPackage,
  Employee,
  EducationActivity,
  EducationTheme,
  Event,
  EventVenueType,
  HouseOperationEducationLink,
  HouseOperationFeedback,
  HouseOperationIncident,
  HouseOperationInstance,
  HouseOperationMediaTask,
  HouseOperationRotationGroup,
  HouseOperationStation,
  HouseOperationTask,
  HouseOperationTaskStatus,
  HouseOperationAgendaBlock,
  InventoryItem,
  LearningTrack
} from '../types';

interface EinsteinHouseOSProps {
  events: Event[];
  inventory: InventoryItem[];
  employees: Employee[];
  packages: ComboPackage[];
  sharedEhRooms?: string[];
  educationActivities?: EducationActivity[];
  learningTracks?: LearningTrack[];
  canEdit?: boolean;
  liveOnly?: boolean;
  publicMode?: boolean;
  embedded?: boolean;
  lockEventSelection?: boolean;
  activeModuleTab?: EinsteinHouseModuleTab;
  initialEventId?: string;
  liveProgramId?: string;
  onUpdateEvent: (eventId: string, updates: Partial<Event>) => void;
  onUpdateSharedEhRooms?: (rooms: string[]) => void;
}

export type EinsteinHouseModuleTab = 'CONTROL' | 'DESIGN' | 'AGENDA' | 'TASKS' | 'KNOWLEDGE' | 'LIVE' | 'REPORT';
type ModuleTab = EinsteinHouseModuleTab;
type LiveViewMode = 'CONTROL' | 'GUIDE' | 'ROOM';
type EventSession = NonNullable<Event['session']>;

const SESSION_LABELS: Record<EventSession, string> = {
  MORNING: 'SÁNG',
  AFTERNOON: 'CHIỀU',
  EVENING: 'TỐI'
};

const EVENT_VENUE_OPTIONS: { value: EventVenueType; label: string; description: string }[] = [
  { value: 'EH', label: 'Tại EH', description: 'Phát tại trung tâm Einstein House' },
  { value: 'EBUS', label: 'Bên ngoài EBUS', description: 'Phát cho sự kiện ngoài trung tâm' }
];

const getEventVenue = (event?: Pick<Event, 'organizationVenue'>): EventVenueType => event?.organizationVenue || 'EH';

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

const GROUP_LOGOS = [
  { id: 'maker', label: 'Chế tạo', icon: Wrench },
  { id: 'lab', label: 'Thí nghiệm', icon: Beaker },
  { id: 'books', label: 'Sách', icon: BookOpen },
  { id: 'robot', label: 'Robot', icon: Bot },
  { id: 'rocket', label: 'Tên lửa', icon: Rocket },
  { id: 'micro', label: 'Kính hiển vi', icon: Microscope },
  { id: 'tech', label: 'Công nghệ', icon: Cpu },
  { id: 'brain', label: 'Tư duy', icon: Brain },
  { id: 'art', label: 'Sáng tạo', icon: Palette },
  { id: 'space', label: 'Vũ trụ', icon: Telescope }
];

const MAX_ROTATION_GROUPS = 30;

const getGroupLetter = (index: number) => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};

const getGroupLogo = (group: Pick<HouseOperationRotationGroup, 'logoId'>, index: number) =>
  GROUP_LOGOS.find(logo => logo.id === group.logoId) || GROUP_LOGOS[index % GROUP_LOGOS.length];

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

const getExperienceStations = (stations: HouseOperationStation[], agenda: HouseOperationAgendaBlock[] = []) => {
  const commonStationIds = new Set(agenda.filter(block => block.kind === 'COMMON' && block.stationId).map(block => block.stationId as string));
  return stations.filter(station => !commonStationIds.has(station.id));
};

const getDefaultRoundDuration = (stations: HouseOperationStation[]) =>
  Math.max(20, ...stations.map(station => station.durationMinutes || 20));

const buildAgenda = (event: Event, stations: HouseOperationStation[]): HouseOperationAgendaBlock[] => {
  const start = getProgramStart(event);
  let cursor = timeToMinutes(start);
  const commonShow = stations.find(station => station.category === 'SHOW');
  const experienceStations = commonShow ? stations.filter(station => station.id !== commonShow.id) : stations;
  const roundDuration = getDefaultRoundDuration(experienceStations);
  const amStationCount = Math.min(3, Math.max(1, experienceStations.length || 1));
  const pmStationCount = Math.min(3, Math.max(0, experienceStations.length - amStationCount));

  const blocks: HouseOperationAgendaBlock[] = [
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
    note: 'Các nhóm chạy agenda riêng theo màu, không trùng trạm cùng mốc giờ.'
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
      note: 'Các nhóm tiếp tục xoay trạm theo agenda riêng.'
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

const recalcStructuredAgenda = (event: Event, stations: HouseOperationStation[], sourceAgenda: HouseOperationAgendaBlock[]) => {
  let cursor = timeToMinutes(sourceAgenda[0]?.startTime || getProgramStart(event));
  const experienceStations = getExperienceStations(stations, sourceAgenda);
  const roundDuration = getDefaultRoundDuration(experienceStations);

  return sourceAgenda.map(block => {
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
  const groupCount = Math.max(1, Math.min(MAX_ROTATION_GROUPS, requestedGroupCount || Math.ceil(studentCount / 25)));
  const stationIds = stations.map(station => station.id);
  const baseStudentCount = Math.floor(studentCount / groupCount);
  const remainder = studentCount % groupCount;
  return Array.from({ length: groupCount }).map((_, index) => ({
    id: makeId('eh-rot'),
    name: `Lớp/Nhóm ${getGroupLetter(index)}`,
    studentCount: baseStudentCount + (index < remainder ? 1 : 0),
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    logoId: GROUP_LOGOS[index % GROUP_LOGOS.length].id,
    route: stationIds.map((_, routeIndex) => stationIds[(routeIndex + index) % stationIds.length]).filter(Boolean)
  }));
};

const preserveRotations = (
  currentRotations: HouseOperationRotationGroup[] = [],
  studentCount: number,
  stations: HouseOperationStation[],
  requestedGroupCount?: number
) =>
  buildRotations(studentCount, stations, requestedGroupCount).map((generated, index) => {
    const existing = currentRotations[index];
    if (!existing) return generated;
    return {
      ...generated,
      id: existing.id,
      name: existing.name,
      studentCount: existing.studentCount,
      color: existing.color,
      logoId: existing.logoId
    };
  });

const getAgendaActivityStartTime = (agenda: HouseOperationAgendaBlock[], event: Event) => {
  const firstExperience = agenda.find(block => block.kind === 'EXPERIENCE_AM' || block.kind === 'EXPERIENCE_PM');
  if (firstExperience?.startTime) return firstExperience.startTime;
  return agenda[0]?.endTime || addMinutes(getProgramStart(event), 15);
};

type GroupAgendaBlock = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  stationId?: string;
  room?: string;
  note?: string;
};

type GroupAgendaView = HouseOperationRotationGroup & { blocks: GroupAgendaBlock[] };
type RoomAgendaBlock = GroupAgendaBlock & {
  groupName: string;
  groupColor?: string;
  groupId: string;
  eventId?: string;
  eventName?: string;
};
type LiveControlEventAgenda = {
  event: Event;
  groups: GroupAgendaView[];
};

type StationReservation = {
  resourceKey: string;
  date: string;
  start: number;
  end: number;
  eventId: string;
  eventName: string;
  groupName: string;
  stationName: string;
};

const timeRangesOverlap = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) =>
  leftStart < rightEnd && rightStart < leftEnd;

const getStationReservationBlocker = (
  station: HouseOperationStation | undefined,
  date: string,
  start: number,
  end: number,
  reservations: StationReservation[]
) => {
  if (!station) return undefined;
  const stationKeys = getStationResourceKeys(station);
  return reservations.find(reservation =>
    reservation.date === date &&
    stationKeys.includes(reservation.resourceKey) &&
    timeRangesOverlap(start, end, reservation.start, reservation.end)
  );
};

const buildGroupActivityAgendas = (
  event: Event,
  agenda: HouseOperationAgendaBlock[],
  stations: HouseOperationStation[],
  rotations: HouseOperationRotationGroup[],
  externalReservations: StationReservation[] = []
) => {
  const stationMap = new Map(stations.map(station => [station.id, station]));
  const experienceStationIds = getExperienceStations(stations, agenda).map(station => station.id);
  const experienceSlotDuration = getDefaultRoundDuration(getExperienceStations(stations, agenda));
  const commonBlocks = agenda.filter(block => block.kind === 'COMMON');
  const sharedBreakBlocks = agenda.filter(block => block.kind === 'BREAK' || block.kind === 'LUNCH');
  const experienceBlocks = agenda.filter(block => block.kind === 'EXPERIENCE_AM' || block.kind === 'EXPERIENCE_PM');
  const date = getPrimaryDate(event);
  const localReservations: StationReservation[] = [];

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
          room: block.room || station?.room || station?.areaDescription,
          note: 'Hoạt động chung toàn đoàn'
        };
      }),
      ...sharedBreakBlocks.map(block => ({
        id: `${group.id}-${block.id}`,
        title: block.title,
        startTime: block.startTime,
        endTime: block.endTime,
        stationId: block.stationId,
        room: block.room || 'Mốc chung',
        note: block.kind === 'LUNCH' ? 'Nghỉ trưa toàn đoàn' : 'Nghỉ giữa giờ toàn đoàn'
      })),
      ...experienceBlocks.flatMap(block => {
        const stationCount = Math.max(0, block.stationCount || 0);
        let cursor = timeToMinutes(block.startTime);
        return Array.from({ length: stationCount }).map((_, roundIndex) => {
          const start = cursor;
          const end = cursor + experienceSlotDuration;
          const reservations = [...externalReservations, ...localReservations];
          const routeLength = Math.max(1, groupRoute.length);
          let stationId: string | undefined;
          let station: HouseOperationStation | undefined;
          let blocker: StationReservation | undefined;

          for (let offset = 0; offset < routeLength; offset += 1) {
            const candidateId = groupRoute[(routeCursor + offset) % routeLength];
            const candidateStation = candidateId ? stationMap.get(candidateId) : undefined;
            const candidateBlocker = getStationReservationBlocker(candidateStation, date, start, end, reservations);
            if (!candidateBlocker) {
              stationId = candidateId;
              station = candidateStation;
              routeCursor += offset + 1;
              break;
            }
            blocker = blocker || candidateBlocker;
          }

          if (!stationId) {
            const fallbackId = groupRoute[routeCursor % routeLength];
            const fallbackStation = fallbackId ? stationMap.get(fallbackId) : undefined;
            blocker = blocker || getStationReservationBlocker(fallbackStation, date, start, end, reservations);
            routeCursor += 1;
          }

          const duration = experienceSlotDuration;
          if (station) {
            getStationResourceKeys(station).forEach(resourceKey => {
              localReservations.push({
                resourceKey,
                date,
                start,
                end,
                eventId: event.id,
                eventName: event.name,
                groupName: group.name,
                stationName: station?.name || ''
              });
            });
          }
          const item = {
            id: `${group.id}-${block.id}-${roundIndex}`,
            title: station?.name || 'Nghỉ/chờ lượt',
            startTime: minutesToTime(start),
            endTime: minutesToTime(end),
            stationId,
            room: station?.room || station?.areaDescription,
            note: station
              ? `${block.sectionCode || ''} • ${station.packageName || block.title}`
              : blocker
                ? `Tạm chờ vì ${blocker.stationName} đang được ${blocker.eventName} / ${blocker.groupName} dùng cùng giờ.`
                : `${block.sectionCode || ''} • Chưa có trạm khả dụng`
          };
          cursor += duration;
          return item;
        });
      })
    ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    return { ...group, blocks };
  });
};

const shiftTime = (time: string, deltaMinutes: number) => minutesToTime(timeToMinutes(time) + deltaMinutes);

const getLiveTimingAnchor = (operation: HouseOperationInstance, event: Event) =>
  operation.agenda.find(block => block.kind === 'EXPERIENCE_AM')?.startTime
  || operation.agenda.find(block => block.kind === 'EXPERIENCE_PM')?.startTime
  || operation.agenda.find(block => block.kind === 'OPENING')?.startTime
  || getProgramStart(event);

const buildLiveGroupAgendas = (
  standardGroups: GroupAgendaView[],
  operation: HouseOperationInstance,
  event: Event
): GroupAgendaView[] => {
  const liveAnchor = getLiveTimingAnchor(operation, event);
  const actualStart = operation.live?.actualArrivalTime || liveAnchor;
  const delta = timeToMinutes(actualStart) - timeToMinutes(liveAnchor);
  if (!delta) return standardGroups;

  const lunchBlock = operation.agenda.find(block => block.kind === 'LUNCH');
  const lunchEnd = lunchBlock?.endTime;
  const anchorMinutes = timeToMinutes(liveAnchor);
  const lunchEndMinutes = lunchEnd ? timeToMinutes(lunchEnd) : Number.POSITIVE_INFINITY;

  return standardGroups.map(group => ({
    ...group,
    blocks: group.blocks.map(block => {
      const start = timeToMinutes(block.startTime);
      const isLunch = /nghỉ trưa|nghi trua/i.test(block.title);
      const isLiveAdjustable = start >= anchorMinutes && start < lunchEndMinutes;
      if (!isLiveAdjustable) return block;
      return {
        ...block,
        startTime: shiftTime(block.startTime, delta),
        endTime: isLunch && lunchEnd ? lunchEnd : shiftTime(block.endTime, delta),
        note: delta > 0 ? `${block.note || ''}${block.note ? ' • ' : ''}Live +${delta}p` : `${block.note || ''}${block.note ? ' • ' : ''}Live ${delta}p`
      };
    })
  }));
};

const buildRoomAgendasFromLiveGroups = (
  liveGroups: GroupAgendaView[],
  event?: Event
): Array<{ room: string; blocks: RoomAgendaBlock[] }> => {
  const map = new Map<string, RoomAgendaBlock[]>();
  liveGroups.forEach(group => {
    group.blocks.forEach(block => {
      const room = block.room || 'Chưa gán phòng';
      const rows = map.get(room) || [];
      rows.push({
        ...block,
        groupName: group.name,
        groupColor: group.color,
        groupId: group.id,
        eventId: event?.id,
        eventName: event?.name
      });
      map.set(room, rows);
    });
  });
  return Array.from(map.entries())
    .map(([room, blocks]) => ({
      room,
      blocks: blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    }))
    .sort((a, b) => a.room.localeCompare(b.room));
};

const alignRoomAgendasToRoomOptions = (
  roomAgendas: Array<{ room: string; blocks: RoomAgendaBlock[] }>,
  roomOptions: string[]
) => {
  if (roomOptions.length === 0) return roomAgendas;
  const agendaMap = new Map(roomAgendas.map(item => [item.room, item.blocks]));
  return roomOptions.map(room => ({
    room,
    blocks: (agendaMap.get(room) || []).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  }));
};

const getBlockState = (block: GroupAgendaBlock, now: Date) => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  if (nowMinutes < start) return 'UPCOMING';
  if (nowMinutes >= end) return 'DONE';
  return 'NOW';
};

const getCountdownLabel = (block: GroupAgendaBlock | undefined, now: Date) => {
  if (!block) return 'Không có mốc tiếp theo';
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  if (nowMinutes < start) return `Bắt đầu sau ${start - nowMinutes} phút`;
  if (nowMinutes < end) return `Còn ${end - nowMinutes} phút`;
  return 'Đã kết thúc';
};

const getEducationLinkKey = (link: HouseOperationEducationLink) => `${link.activityId}::${link.themeId}`;

const dedupeEducationLinks = (links: HouseOperationEducationLink[]) => {
  const seen = new Set<string>();
  return links.filter(link => {
    const key = getEducationLinkKey(link);
    if (!link.activityId || !link.themeId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getStationManualEducationLinks = (station: HouseOperationStation) =>
  dedupeEducationLinks([
    ...(station.educationLinks || []),
    ...(station.educationLink ? [station.educationLink] : [])
  ]);

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

const isEducationPackage = (pkg: ComboPackage) => (pkg.packageType || 'EDUCATION') === 'EDUCATION';

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

const dedupeRoomNames = (rooms: string[]) =>
  Array.from(new Set(rooms.map(room => room.trim()).filter(Boolean)));

const getOperationRooms = (rooms?: string[], stations: HouseOperationStation[] = []) => {
  const stationRooms = stations.flatMap(station => {
    const candidates = [station.room, station.areaDescription];
    return candidates.filter((value): value is string => !!value && value.trim().length > 0 && value.trim().length <= 50);
  });
  return dedupeRoomNames([...(rooms || []), ...stationRooms]);
};

const normalizeResourceText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getStationResourceKeys = (station: HouseOperationStation) => {
  const packageKeys = getStationPackageIds(station).map(packageId => `pkg:${packageId}`);
  if (packageKeys.length > 0) return packageKeys;
  const nameKey = normalizeResourceText(station.packageName || station.name);
  return nameKey ? [`name:${nameKey}`] : [`station:${station.id}`];
};

const getEventScheduleItems = (event: Event): Array<{ date: string; sessions: EventSession[] }> => {
  if (event.schedule && event.schedule.length > 0) {
    return event.schedule.map(item => ({
      date: item.date,
      sessions: item.sessions && item.sessions.length > 0
        ? item.sessions as EventSession[]
        : event.session
          ? [event.session]
          : ['MORNING' as EventSession]
    }));
  }
  const date = getPrimaryDate(event);
  return date ? [{ date, sessions: event.session ? [event.session] : ['MORNING' as EventSession] }] : [];
};

const eventSessionsOverlap = (left: Event, right: Event) => {
  const leftSchedule = getEventScheduleItems(left);
  const rightSchedule = getEventScheduleItems(right);
  return leftSchedule.some(leftItem => rightSchedule.some(rightItem =>
    leftItem.date === rightItem.date &&
    leftItem.sessions.some(session => rightItem.sessions.includes(session))
  ));
};

const getSessionListLabel = (sessions: EventSession[]) =>
  sessions.map(session => SESSION_LABELS[session]).join(' + ');

const buildEhReservationsForEvent = (event: Event): StationReservation[] => {
  const operation = event.houseOperation;
  if (!operation || getEventVenue(event) !== 'EH') return [];
  const date = getPrimaryDate(event);
  if (!date) return [];
  const stationMap = new Map(operation.stations.map(station => [station.id, station]));
  return buildGroupActivityAgendas(event, operation.agenda || [], operation.stations || [], operation.rotations || [])
    .flatMap(group => group.blocks.flatMap(block => {
      const station = block.stationId ? stationMap.get(block.stationId) : undefined;
      if (!station) return [];
      const start = timeToMinutes(block.startTime);
      const end = timeToMinutes(block.endTime);
      return getStationResourceKeys(station).map(resourceKey => ({
        resourceKey,
        date,
        start,
        end,
        eventId: event.id,
        eventName: event.name,
        groupName: group.name,
        stationName: station.name
      }));
    }));
};

const getExternalEhReservations = (events: Event[], selectedEvent: Event) =>
  events
    .filter(event =>
      event.id !== selectedEvent.id &&
      getEventVenue(event) === 'EH' &&
      getPrimaryDate(event) === getPrimaryDate(selectedEvent)
    )
    .flatMap(buildEhReservationsForEvent);

type EbusPackageLock = {
  packageId: string;
  eventId: string;
  eventName: string;
  date: string;
  sessions: EventSession[];
  stationName: string;
};

const getEventPackageSelections = (event: Event) => {
  const selections = new Map<string, string>();
  (event.houseOperation?.stations || []).forEach(station => {
    getStationPackageIds(station).forEach(packageId => {
      if (!selections.has(packageId)) selections.set(packageId, station.name);
    });
  });
  (event.layout?.blocks || []).forEach(block => {
    if (block.packageId && !selections.has(block.packageId)) {
      selections.set(block.packageId, block.name || block.packageName || block.packageId);
    }
  });
  return Array.from(selections.entries()).map(([packageId, stationName]) => ({ packageId, stationName }));
};

const getEbusPackageLocks = (events: Event[], selectedEvent: Event) => {
  const locks = new Map<string, EbusPackageLock[]>();
  if (getEventVenue(selectedEvent) !== 'EBUS') return locks;
  events.forEach(event => {
    if (event.id === selectedEvent.id || getEventVenue(event) !== 'EBUS' || !eventSessionsOverlap(event, selectedEvent)) return;
    const date = getPrimaryDate(event);
    const sessions = getEventScheduleItems(event)
      .filter(item => getEventScheduleItems(selectedEvent).some(selectedItem => selectedItem.date === item.date))
      .flatMap(item => item.sessions);
    getEventPackageSelections(event).forEach(({ packageId, stationName }) => {
      const current = locks.get(packageId) || [];
      current.push({
        packageId,
        eventId: event.id,
        eventName: event.name,
        date,
        sessions: Array.from(new Set(sessions)),
        stationName
      });
      locks.set(packageId, current);
    });
  });
  return locks;
};

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
    room: '',
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
  room: '',
  objective: 'Khu vực vận hành gồm một hoặc nhiều trạm/gói thiết bị.',
  sopVersion: 'CUSTOM-AREA',
  checklist: ['Chốt vị trí khu vực', 'Gán trạm/gói thiết bị', 'Kiểm tra lối di chuyển', 'Chốt người phụ trách'],
  equipment: [],
  script: '',
  status: 'TODO'
});

const createPackageStationInstances = (packages: ComboPackage[], inventory: InventoryItem[]) =>
  packages.filter(isEducationPackage).map((pkg, index) => createStationFromPackage(pkg, inventory, index));

const createDefaultTasks = (event: Event, stations: HouseOperationStation[], employees: Employee[]): HouseOperationTask[] => {
  const lead = employees.find(emp => /lead|hdv|leader|quản/i.test(`${emp.role} ${emp.name}`));
  const eventDate = getPrimaryDate(event);
  const deadline = eventDate ? `${eventDate}T08:00` : undefined;
  const baseTasks: HouseOperationTask[] = [
    { id: makeId('eh-task'), title: 'Chốt thông tin đoàn, sĩ số, khối, người liên hệ', scope: 'EVENT', status: 'TODO', ownerId: lead?.id, ownerName: lead?.name, deadline },
    { id: makeId('eh-task'), title: 'Khóa agenda và sơ đồ luân chuyển', scope: 'QUALITY', status: 'TODO', ownerId: lead?.id, ownerName: lead?.name, deadline },
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

const createDefaultOperation = (
  event: Event,
  inventory: InventoryItem[],
  employees: Employee[],
  packages: ComboPackage[] = [],
  options: { includeTemplateStations?: boolean } = {}
): HouseOperationInstance => {
  const educationPackages = packages.filter(isEducationPackage);
  const stations = options.includeTemplateStations
    ? (educationPackages.length > 0 ? createPackageStationInstances(educationPackages, inventory) : createStationInstances(inventory))
    : [];
  const studentCount = getStudentCount(event);
  const groupCount = Math.max(1, Math.min(MAX_ROTATION_GROUPS, Math.ceil(studentCount / 25)));
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
    rooms: getOperationRooms([], stations),
    stations,
    agenda: stations.length > 0 ? buildAgenda(event, stations) : [],
    rotations: stations.length > 0 ? buildRotations(studentCount, stations, groupCount) : [],
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
  const legacy = current as HouseOperationInstance & { timeline?: HouseOperationInstance['agenda'] };
  const { timeline: _legacyTimeline, ...currentWithoutLegacy } = legacy;
  const currentAgenda = Array.isArray(current.agenda) ? current.agenda : undefined;
  const legacyAgenda = Array.isArray(legacy.timeline) ? legacy.timeline : undefined;
  return {
    ...fallback,
    ...currentWithoutLegacy,
    rooms: getOperationRooms(current.rooms, current.stations || fallback.stations),
    stations: Array.isArray(current.stations) ? current.stations : fallback.stations,
    agenda: currentAgenda && (currentAgenda.length > 0 || !legacyAgenda)
      ? currentAgenda
      : (legacyAgenda || fallback.agenda),
    rotations: Array.isArray(current.rotations) ? current.rotations : fallback.rotations,
    tasks: Array.isArray(current.tasks) ? current.tasks : fallback.tasks,
    incidents: current.incidents || [],
    mediaTasks: Array.isArray(current.mediaTasks) ? current.mediaTasks : fallback.mediaTasks,
    feedback: current.feedback || [],
    live: current.live || fallback.live
  };
};

const getOverlapWarnings = (agenda: HouseOperationAgendaBlock[]) => {
  const warnings = new Set<string>();
  const sorted = [...agenda].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
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
  sharedEhRooms = [],
  educationActivities = [],
  learningTracks = [],
  canEdit = true,
  liveOnly = false,
  publicMode = false,
  embedded = false,
  lockEventSelection = false,
  activeModuleTab,
  initialEventId,
  liveProgramId,
  onUpdateEvent,
  onUpdateSharedEhRooms
}) => {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || events[0]?.id || '');
  const [activeTab, setActiveTab] = useState<ModuleTab>(activeModuleTab || (liveOnly ? 'LIVE' : 'CONTROL'));
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackScore, setFeedbackScore] = useState(5);
  const [draggedStationId, setDraggedStationId] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState(new Date());
  const [liveViewMode, setLiveViewMode] = useState<LiveViewMode>('CONTROL');
  const [localLiveGroupId, setLocalLiveGroupId] = useState('');
  const [localLiveRoom, setLocalLiveRoom] = useState('');
  const [expandedEquipmentStationId, setExpandedEquipmentStationId] = useState<string | null>(null);
  const [viewingEducationContext, setViewingEducationContext] = useState<{ stationName: string; links: HouseOperationEducationLink[]; activeIndex: number } | null>(null);
  const [newRoomName, setNewRoomName] = useState('');

  const selectedEvent = events.find(event => event.id === selectedEventId) || events[0];
  const operation = useMemo(
    () => selectedEvent ? ensureOperation(selectedEvent, inventory, employees, packages) : null,
    [selectedEvent, inventory, employees, packages]
  );
  const educationPackages = useMemo(() => packages.filter(isEducationPackage), [packages]);

  useEffect(() => {
    if (initialEventId && initialEventId !== selectedEventId) {
      setSelectedEventId(initialEventId);
    }
  }, [initialEventId, selectedEventId]);

  useEffect(() => {
    if (activeModuleTab && activeModuleTab !== activeTab) {
      setActiveTab(activeModuleTab);
    }
  }, [activeModuleTab, activeTab]);

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

  const overlapWarnings = useMemo(() => operation ? getOverlapWarnings(operation.agenda) : new Set<string>(), [operation]);
  const externalEhReservations = useMemo(
    () => selectedEvent ? getExternalEhReservations(events, selectedEvent) : [],
    [events, selectedEvent]
  );
  const ebusPackageLocks = useMemo(
    () => selectedEvent ? getEbusPackageLocks(events, selectedEvent) : new Map<string, EbusPackageLock[]>(),
    [events, selectedEvent]
  );

  const groupActivityAgendas = useMemo(
    () => selectedEvent && operation
      ? buildGroupActivityAgendas(
        selectedEvent,
        operation.agenda,
        operation.stations,
        operation.rotations,
        getEventVenue(selectedEvent) === 'EH' ? externalEhReservations : []
      )
      : [],
    [selectedEvent, operation, externalEhReservations]
  );

  const ehResourceConflictWarnings = useMemo(() => {
    if (!selectedEvent || !operation || getEventVenue(selectedEvent) !== 'EH') return [];
    const ownEvent: Event = { ...selectedEvent, houseOperation: operation };
    const ownReservations = buildEhReservationsForEvent(ownEvent);
    const warnings = new Map<string, { stationName: string; blocker: StationReservation; own: StationReservation }>();
    ownReservations.forEach(own => {
      externalEhReservations.forEach(blocker => {
        if (
          own.resourceKey === blocker.resourceKey &&
          own.date === blocker.date &&
          timeRangesOverlap(own.start, own.end, blocker.start, blocker.end)
        ) {
          warnings.set(`${own.resourceKey}-${own.start}-${own.end}-${blocker.eventId}`, {
            stationName: own.stationName,
            blocker,
            own
          });
        }
      });
    });
    return Array.from(warnings.values()).slice(0, 6);
  }, [externalEhReservations, operation, selectedEvent]);

  const unresolvedEhSlots = useMemo(
    () => groupActivityAgendas.flatMap(group => group.blocks
      .filter(block => !block.stationId && (block.note || '').includes('Tạm chờ'))
      .map(block => ({ groupName: group.name, block }))
    ).slice(0, 6),
    [groupActivityAgendas]
  );

  const ebusCurrentStationConflicts = useMemo(() => {
    if (!selectedEvent || !operation || getEventVenue(selectedEvent) !== 'EBUS') return [];
    return operation.stations.flatMap(station => getStationPackageIds(station).flatMap(packageId =>
      (ebusPackageLocks.get(packageId) || []).map(lock => ({ station, lock }))
    ));
  }, [ebusPackageLocks, operation, selectedEvent]);
  const ehRoomOptions = useMemo(
    () => getOperationRooms(sharedEhRooms.length > 0 ? sharedEhRooms : operation?.rooms, []),
    [operation?.rooms, sharedEhRooms]
  );

  const liveGroupAgendas = useMemo(
    () => selectedEvent && operation ? buildLiveGroupAgendas(groupActivityAgendas, operation, selectedEvent) : [],
    [groupActivityAgendas, operation, selectedEvent]
  );

  const liveControlEventAgendas = useMemo<LiveControlEventAgenda[]>(() => {
    if (!selectedEvent || !operation) return [];
    const selectedDate = getPrimaryDate(selectedEvent);
    const aggregateSameDayEh = getEventVenue(selectedEvent) === 'EH';
    const sourceEvents = aggregateSameDayEh
      ? events.filter(event => getEventVenue(event) === 'EH' && getPrimaryDate(event) === selectedDate)
      : [selectedEvent];

    return sourceEvents.map(event => {
      const currentOperation = event.id === selectedEvent.id
        ? operation
        : ensureOperation(event, inventory, employees, packages);
      const reservations = getEventVenue(event) === 'EH' ? getExternalEhReservations(events, event) : [];
      const standardGroups = buildGroupActivityAgendas(
        event,
        currentOperation.agenda,
        currentOperation.stations,
        currentOperation.rotations,
        reservations
      );
      return {
        event,
        groups: buildLiveGroupAgendas(standardGroups, currentOperation, event)
      };
    }).filter(item => item.groups.length > 0);
  }, [employees, events, inventory, operation, packages, selectedEvent]);

  const roomAgendas = useMemo(
    () => buildRoomAgendasFromLiveGroups(liveGroupAgendas, selectedEvent),
    [liveGroupAgendas, selectedEvent]
  );

  const ehSameDayRoomAgendas = useMemo(() => {
    if (!selectedEvent || getEventVenue(selectedEvent) !== 'EH') return roomAgendas;
    const date = getPrimaryDate(selectedEvent);
    const map = new Map<string, RoomAgendaBlock[]>();
    events
      .filter(event => getEventVenue(event) === 'EH' && getPrimaryDate(event) === date)
      .forEach(event => {
        const currentOperation = event.id === selectedEvent.id && operation
          ? operation
          : ensureOperation(event, inventory, employees, packages);
        const reservations = getExternalEhReservations(events, event);
        const standardGroups = buildGroupActivityAgendas(
          event,
          currentOperation.agenda,
          currentOperation.stations,
          currentOperation.rotations,
          reservations
        );
        const liveGroups = buildLiveGroupAgendas(standardGroups, currentOperation, event);
        buildRoomAgendasFromLiveGroups(liveGroups, event).forEach(roomAgenda => {
          const rows = map.get(roomAgenda.room) || [];
          rows.push(...roomAgenda.blocks);
          map.set(roomAgenda.room, rows);
        });
      });
    return Array.from(map.entries())
      .map(([room, blocks]) => ({
        room,
        blocks: blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      }))
      .sort((a, b) => a.room.localeCompare(b.room));
  }, [employees, events, inventory, operation, packages, roomAgendas, selectedEvent]);

  const effectiveRoomAgendas = selectedEvent && getEventVenue(selectedEvent) === 'EH'
    ? alignRoomAgendasToRoomOptions(ehSameDayRoomAgendas, ehRoomOptions)
    : roomAgendas;

  useEffect(() => {
    setLocalLiveGroupId(current => {
      if (!liveGroupAgendas.length) return '';
      if (current && liveGroupAgendas.some(group => group.id === current)) return current;
      const saved = operation?.live?.selectedGroupId;
      if (saved && liveGroupAgendas.some(group => group.id === saved)) return saved;
      return liveGroupAgendas[0].id;
    });
  }, [liveGroupAgendas, operation?.live?.selectedGroupId]);

  useEffect(() => {
    setLocalLiveRoom(current => {
      if (!effectiveRoomAgendas.length) return '';
      if (current && effectiveRoomAgendas.some(item => item.room === current)) return current;
      const saved = operation?.live?.selectedRoom;
      if (saved && effectiveRoomAgendas.some(item => item.room === saved)) return saved;
      return effectiveRoomAgendas[0].room;
    });
  }, [effectiveRoomAgendas, operation?.live?.selectedRoom]);

  const hasGroupStationConflict = operation ? (operation.groupCount || operation.rotations.length || 1) > Math.max(1, operation.stations.length) : false;

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

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

  const addRoom = () => {
    const name = newRoomName.trim();
    if (!name) return;
    const nextRooms = dedupeRoomNames([...ehRoomOptions, name]);
    onUpdateSharedEhRooms?.(nextRooms);
    saveOperation(current => ({
      ...current,
      rooms: nextRooms
    }));
    setNewRoomName('');
  };

  const removeRoom = (room: string) => {
    if (!room) return;
    const isUsed = (operation?.stations || []).some(station => station.room === room);
    if (isUsed && !window.confirm(`Xóa phòng "${room}" và bỏ gán khỏi các trạm đang dùng phòng này?`)) return;
    const nextRooms = ehRoomOptions.filter(item => item !== room);
    onUpdateSharedEhRooms?.(nextRooms);
    saveOperation(current => ({
      ...current,
      rooms: nextRooms,
      stations: current.stations.map(station =>
        station.room === room ? { ...station, room: '' } : station
      )
    }));
  };

  const getEbusPackageLockText = (packageId: string) => {
    const lock = ebusPackageLocks.get(packageId)?.[0];
    if (!lock) return '';
    return `${lock.eventName} • ${lock.date} • ${getSessionListLabel(lock.sessions)}`;
  };

  const isEbusPackageLocked = (packageId: string) =>
    getEventVenue(selectedEvent) === 'EBUS' && (ebusPackageLocks.get(packageId)?.length || 0) > 0;

  const initializeOperation = () => {
    if (!selectedEvent || !canEdit) return;
    onUpdateEvent(selectedEvent.id, {
      houseOperation: createDefaultOperation(selectedEvent, inventory, employees, packages, { includeTemplateStations: true })
    });
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
    if (isEbusPackageLocked(pkg.id)) return;
    saveOperation(current => {
      const station = {
        ...createStationFromPackage(pkg, inventory, current.stations.length),
        id: makeId('eh-station')
      };
      const stations = [...current.stations, station];
      return {
        ...current,
        stations,
        agenda: current.agenda.length > 0 ? recalcStructuredAgenda(selectedEvent!, stations, current.agenda) : buildAgenda(selectedEvent!, stations),
        rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const addEmptyArea = () => {
    saveOperation(current => {
      const stations = [...current.stations, createEmptyAreaStation(current.stations.length)];
      return {
        ...current,
        stations,
        agenda: current.agenda.length > 0 ? recalcStructuredAgenda(selectedEvent!, stations, current.agenda) : buildAgenda(selectedEvent!, stations),
        rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const updateStation = (stationId: string, patch: Partial<HouseOperationStation>) => {
    saveOperation(current => {
      const stations = current.stations.map(station => station.id === stationId ? { ...station, ...patch } : station);
      return {
        ...current,
        stations,
        agenda: recalcStructuredAgenda(selectedEvent!, stations, current.agenda)
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
        agenda: recalcStructuredAgenda(selectedEvent!, stations, current.agenda),
        rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const mergePackageIntoStation = (stationId: string, packageId: string) => {
    if (isEbusPackageLocked(packageId)) return;
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
        agenda: recalcStructuredAgenda(selectedEvent!, stations, current.agenda),
        rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount)
      };
    });
  };

  const addInventoryItemToStation = (stationId: string, itemId: string) => {
    const item = inventory.find(inv => inv.id === itemId);
    if (!item) return;
    saveOperation(current => {
      const stations = current.stations.map(station => {
        if (station.id !== stationId) return station;
        return {
          ...station,
          equipment: mergeEquipment(station.equipment || [], [{
            itemId: item.id,
            name: item.name,
            quantity: 1,
            unit: item.consumableUnit,
            source: 'INVENTORY' as const
          }])
        };
      });
      return { ...current, stations };
    });
  };

  const getAutoEducationLinksForStation = (station: HouseOperationStation) => {
    const stationPackageIds = new Set(getStationPackageIds(station));
    const stationItemIds = new Set((station.equipment || []).map(item => item.itemId).filter(Boolean) as string[]);
    return dedupeEducationLinks(educationActivities.flatMap(activity =>
      activity.themes
        .filter(theme => {
          const themePackageLinks = theme.equipment.filter(item => item.type === 'PACKAGE');
          const packageMatch = themePackageLinks.some(item => stationPackageIds.has(item.id));
          if (packageMatch) return true;
          if (themePackageLinks.length > 0) return false;
          return theme.equipment.some(item => item.type === 'ITEM' && stationItemIds.has(item.id));
        })
        .map(theme => ({ activityId: activity.id, themeId: theme.id }))
    ));
  };

  const getStationEducationViews = (station: HouseOperationStation) => {
    const autoLinks = getAutoEducationLinksForStation(station);
    const autoKeys = new Set(autoLinks.map(getEducationLinkKey));
    const manualLinks = getStationManualEducationLinks(station);
    return [
      ...autoLinks.map(link => ({ link, source: 'AUTO' as const })),
      ...manualLinks.filter(link => !autoKeys.has(getEducationLinkKey(link))).map(link => ({ link, source: 'MANUAL' as const }))
    ].map(view => {
      const activity = educationActivities.find(item => item.id === view.link.activityId);
      const theme = activity?.themes.find(item => item.id === view.link.themeId);
      return { ...view, activity, theme };
    });
  };

  const addStationEducationLink = (stationId: string, value: string) => {
    const [activityId, themeId] = value.split('::');
    if (!activityId || !themeId) return;
    saveOperation(current => ({
      ...current,
      stations: current.stations.map(station =>
        station.id === stationId
          ? { ...station, educationLink: undefined, educationLinks: dedupeEducationLinks([...getStationManualEducationLinks(station), { activityId, themeId }]) }
          : station
      )
    }));
  };

  const removeStationEducationLink = (stationId: string, link: HouseOperationEducationLink) => {
    const key = getEducationLinkKey(link);
    saveOperation(current => ({
      ...current,
      stations: current.stations.map(station =>
        station.id === stationId
          ? { ...station, educationLink: undefined, educationLinks: getStationManualEducationLinks(station).filter(item => getEducationLinkKey(item) !== key) }
          : station
      )
    }));
  };

  const removeStation = (stationId: string) => {
    saveOperation(current => {
      const stations = current.stations.filter(station => station.id !== stationId);
      return {
        ...current,
        stations,
        agenda: recalcStructuredAgenda(selectedEvent!, stations, current.agenda.filter(block => block.stationId !== stationId)),
        rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), stations, current.groupCount),
        tasks: current.tasks.filter(task => task.stationId !== stationId)
      };
    });
  };

  const recalcAgenda = () => {
    saveOperation(current => ({
      ...current,
      agenda: buildAgenda(selectedEvent!, current.stations)
    }));
  };

  const insertBreak = () => {
    saveOperation(current => {
      if (current.agenda.some(block => block.kind === 'BREAK')) return current;
      const breakBlock: HouseOperationAgendaBlock = {
        id: makeId('eh-time'),
        sectionCode: 'D',
        kind: 'BREAK',
        title: 'Nghỉ giữa giờ',
        startTime: getProgramStart(selectedEvent!),
        endTime: addMinutes(getProgramStart(selectedEvent!), 10),
        note: 'Nếu có mốc này, hoạt động sáng được hiểu là C1 trước nghỉ và C2 sau nghỉ.'
      };
      const agenda = [...current.agenda];
      const amIndex = agenda.findIndex(block => block.kind === 'EXPERIENCE_AM');
      if (amIndex >= 0) {
        const amBlock = agenda[amIndex];
        const totalStations = Math.max(1, amBlock.stationCount || 1);
        const firstCount = Math.ceil(totalStations / 2);
        const secondCount = Math.max(0, totalStations - firstCount);
        agenda.splice(
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
        const lunchIndex = agenda.findIndex(block => block.kind === 'LUNCH');
        const insertAt = lunchIndex >= 0 ? lunchIndex : Math.max(1, agenda.length - 1);
        agenda.splice(insertAt, 0, breakBlock);
      }
      return { ...current, agenda: recalcStructuredAgenda(selectedEvent!, current.stations, agenda) };
    });
  };

  const addCommonActivity = () => {
    saveOperation(current => {
      const firstStation = current.stations[0];
      const block: HouseOperationAgendaBlock = {
        id: makeId('eh-time'),
        sectionCode: 'B',
        kind: 'COMMON',
        title: 'Hoạt động chung',
        startTime: getProgramStart(selectedEvent!),
        endTime: addMinutes(getProgramStart(selectedEvent!), firstStation?.durationMinutes || 15),
        stationId: firstStation?.id,
        room: firstStation?.room || firstStation?.areaDescription,
        note: 'Toàn bộ nhóm cùng tham gia mốc này.'
      };
      const firstExperienceIndex = current.agenda.findIndex(item => item.kind === 'EXPERIENCE_AM' || item.kind === 'EXPERIENCE_PM');
      const insertAt = firstExperienceIndex >= 0 ? firstExperienceIndex : Math.max(1, current.agenda.length - 1);
      const agenda = [...current.agenda];
      agenda.splice(insertAt, 0, block);
      return { ...current, agenda: recalcStructuredAgenda(selectedEvent!, current.stations, agenda) };
    });
  };

  const updateAgendaBlock = (blockId: string, patch: Partial<HouseOperationAgendaBlock>) => {
    saveOperation(current => ({
      ...current,
      agenda: recalcStructuredAgenda(
        selectedEvent!,
        current.stations,
        current.agenda.map(block => block.id === blockId ? { ...block, ...patch } : block)
      )
    }));
  };

  const moveAgendaBlock = (blockId: string, delta: number) => {
    saveOperation(current => {
      const index = current.agenda.findIndex(block => block.id === blockId);
      const targetIndex = index + delta;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.agenda.length) return current;
      const agenda = [...current.agenda];
      const [moving] = agenda.splice(index, 1);
      agenda.splice(targetIndex, 0, moving);
      return { ...current, agenda: recalcStructuredAgenda(selectedEvent!, current.stations, agenda) };
    });
  };

  const removeAgendaBlock = (blockId: string) => {
    saveOperation(current => {
      if (current.agenda.length <= 1) return current;
      const target = current.agenda.find(block => block.id === blockId);
      const agenda = current.agenda.filter(block => block.id !== blockId);
      const normalizedAgenda =
        target?.sectionCode === 'D'
          ? agenda.map(block => block.sectionCode === 'C1' ? { ...block, sectionCode: 'C' as const, title: 'Hoạt động trải nghiệm sáng' } : block)
          : agenda;
      return { ...current, agenda: recalcStructuredAgenda(selectedEvent!, current.stations, normalizedAgenda) };
    });
  };

  const regenerateRotations = () => {
    saveOperation(current => ({
      ...current,
      rotations: buildRotations(current.studentCount || getStudentCount(selectedEvent!), current.stations, current.groupCount)
    }));
  };

  const updateGroupCount = (value: number) => {
    const groupCount = Math.max(1, Math.min(MAX_ROTATION_GROUPS, Math.round(value || 1)));
    saveOperation(current => ({
      ...current,
      groupCount,
      rotations: preserveRotations(current.rotations, current.studentCount || getStudentCount(selectedEvent!), current.stations, groupCount)
    }));
  };

  const updateRotationGroup = (groupId: string, patch: Partial<HouseOperationRotationGroup>) => {
    saveOperation(current => ({
      ...current,
      rotations: current.rotations.map((group, index) =>
        group.id === groupId
          ? { ...group, logoId: group.logoId || GROUP_LOGOS[index % GROUP_LOGOS.length].id, ...patch }
          : group
      )
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

  const printGroupAgendas = () => {
    const rows = groupActivityAgendas.map((group, index) => {
      const color = group.color || GROUP_COLORS[index % GROUP_COLORS.length];
      const items = group.blocks.map((block, blockIndex) => `
        <div class="block">
          <div class="block-head">
            <strong>${blockIndex + 1}. ${block.title}</strong>
            <span>${block.startTime}-${block.endTime}</span>
          </div>
          <div class="meta">${block.room || 'Chưa gán vị trí'}${block.note ? ` • ${block.note}` : ''}</div>
        </div>
      `).join('');
      return `
        <section class="group" style="border-top-color:${color}">
          <header>
            <h2>${group.name}</h2>
            <span>${group.studentCount} HS</span>
          </header>
          ${items || '<p class="empty">Chưa có agenda hoạt động.</p>'}
        </section>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Agenda nhóm - ${selectedEvent?.name || 'Einstein House'}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            .subtitle { color: #64748b; font-size: 12px; margin-bottom: 18px; }
            .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
            .group { border: 1px solid #e2e8f0; border-top: 5px solid #0f766e; border-radius: 8px; padding: 12px; break-inside: avoid; }
            header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
            h2 { font-size: 15px; margin: 0; }
            header span { font-size: 11px; font-weight: 800; color: #64748b; }
            .block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-top: 7px; }
            .block-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
            .block-head span { white-space: nowrap; color: #475569; font-weight: 800; }
            .meta { margin-top: 4px; font-size: 11px; color: #64748b; }
            .empty { font-size: 12px; color: #64748b; }
            @media print { body { margin: 12mm; } .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
          </style>
        </head>
        <body>
          <h1>Agenda hoạt động theo nhóm</h1>
          <div class="subtitle">${selectedEvent?.name || ''} • ${selectedEvent?.client || ''} • ${formatDate(getPrimaryDate(selectedEvent!))}</div>
          <div class="grid">${rows}</div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  const currentBlock = operation.agenda.find(block => block.id === operation.live?.currentBlockId);
  const selectedLiveGroup = liveGroupAgendas.find(group => group.id === (localLiveGroupId || operation.live?.selectedGroupId)) || liveGroupAgendas[0];
  const selectedLiveBlocks = selectedLiveGroup?.blocks || [];
  const activeGroupBlock = selectedLiveBlocks.find(block => getBlockState(block, liveNow) === 'NOW');
  const nextGroupBlock = selectedLiveBlocks.find(block => getBlockState(block, liveNow) === 'UPCOMING');
  const focusGroupBlock = activeGroupBlock || nextGroupBlock || selectedLiveBlocks[selectedLiveBlocks.length - 1];
  const selectedRoomAgenda = effectiveRoomAgendas.find(item => item.room === (localLiveRoom || operation.live?.selectedRoom)) || effectiveRoomAgendas[0];
  const activeRoomBlock = selectedRoomAgenda?.blocks.find(block => getBlockState(block, liveNow) === 'NOW');
  const nextRoomBlock = selectedRoomAgenda?.blocks.find(block => getBlockState(block, liveNow) === 'UPCOMING');
  const focusRoomBlock = activeRoomBlock || nextRoomBlock;
  const handleLiveGroupSelect = (groupId: string) => {
    setLocalLiveGroupId(groupId);
    if (!canEdit || publicMode) return;
    saveOperation(cur => ({ ...cur, live: { ...cur.live, selectedGroupId: groupId, lastUpdatedAt: new Date().toISOString() } }));
  };
  const handleLiveRoomSelect = (room: string) => {
    setLocalLiveRoom(room);
    if (!canEdit || publicMode) return;
    saveOperation(cur => ({ ...cur, live: { ...cur.live, selectedRoom: room, lastUpdatedAt: new Date().toISOString() } }));
  };
  const liveTimingAnchor = getLiveTimingAnchor(operation, selectedEvent);
  const actualArrival = operation.live?.actualArrivalTime || liveTimingAnchor;
  const liveDelta = timeToMinutes(actualArrival) - timeToMinutes(liveTimingAnchor);
  const viewingEducationItems = (viewingEducationContext?.links || []).map(link => {
    const activity = educationActivities.find(item => item.id === link.activityId);
    const theme = activity?.themes.find(item => item.id === link.themeId);
    return { link, activity, theme };
  });
  const viewingEducationActiveIndex = Math.min(viewingEducationContext?.activeIndex || 0, Math.max(0, viewingEducationItems.length - 1));
  const viewingEducationItem = viewingEducationItems[viewingEducationActiveIndex];
  const viewingEducationActivity = viewingEducationItem?.activity;
  const viewingEducationTheme = viewingEducationItem?.theme;
  const getEducationEquipmentName = (link: EducationTheme['equipment'][number]) => {
    if (link.type === 'PACKAGE') return packages.find(pkg => pkg.id === link.id)?.name || link.id;
    return inventory.find(item => item.id === link.id)?.name || link.id;
  };
  const getEducationLessonLabel = (trackId: string, lessonId: string) => {
    const track = learningTracks.find(item => item.id === trackId);
    const lesson = track?.lessons.find(item => item.id === lessonId);
    return lesson ? `${lesson.title} • ${track?.title || trackId}` : `${lessonId} • ${trackId}`;
  };
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
      {!liveOnly && !embedded && (
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
      )}

      <div>
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
                {!publicMode && !lockEventSelection && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EVENT_VENUE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => canEdit && onUpdateEvent(selectedEvent.id, { organizationVenue: option.value })}
                        disabled={!canEdit}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          getEventVenue(selectedEvent) === option.value
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        } disabled:opacity-60`}
                      >
                        <span className="block text-xs font-black">{option.label}</span>
                        <span className="block text-[10px] font-semibold text-slate-500">{option.description}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!publicMode && !lockEventSelection && (
                <div className="mt-3 max-w-xl">
                  <select
                    value={selectedEvent.id}
                    onChange={event => setSelectedEventId(event.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white"
                  >
                    {sidebarEvents.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} • {formatDate(getPrimaryDate(event))}
                      </option>
                    ))}
                  </select>
                </div>
                )}
              </div>
              {!publicMode && (
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
              )}
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

          {!liveOnly && !embedded && (
          <div className="bg-white border border-slate-200 rounded-lg p-2">
            <div className="flex overflow-x-auto gap-2">
              {[
                ['CONTROL', Radio],
                ['DESIGN', Wand2],
                ['AGENDA', TimerReset],
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
          )}

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
                  {operation.agenda.slice(0, 5).map(block => (
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
                  {`Tạo chương trình cho ${operation.studentCount} học sinh, ${operation.grade || 'Tiểu học'}, ${operation.stations.length} trạm: ${operation.stations.map(s => s.name).join(', ')}. Ưu tiên agenda không trùng, đủ thiết bị, có checklist setup và incident fallback.`}
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
                    <input type="number" value={operation.studentCount || 0} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, studentCount: Number(e.target.value), rotations: preserveRotations(cur.rotations, Number(e.target.value) || 1, cur.stations, cur.groupCount) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                  <Field label="Số giáo viên">
                    <input type="number" value={operation.teacherCount || 0} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, teacherCount: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </Field>
                </div>
                {getEventVenue(selectedEvent) === 'EH' && (
                  <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                    <p className="text-xs font-black uppercase text-teal-700">Danh sách phòng/khu vực EH dùng chung</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newRoomName}
                        disabled={!canEdit}
                        onChange={event => setNewRoomName(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addRoom();
                          }
                        }}
                        placeholder="Ví dụ: Phòng Tesla, Sảnh tầng 1..."
                        className="min-w-0 flex-1 border border-teal-100 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                      <button
                        type="button"
                        onClick={addRoom}
                        disabled={!canEdit || !newRoomName.trim()}
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300"
                      >
                        <Plus size={14} />
                        Thêm
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ehRoomOptions.map(room => {
                        const usedCount = operation.stations.filter(station => station.room === room).length;
                        return (
                          <span key={room} className="inline-flex items-center gap-2 rounded-lg border border-teal-100 bg-white px-2 py-1 text-xs font-bold text-teal-800">
                            {room}
                            <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-600">{usedCount} trạm</span>
                            <button
                              type="button"
                              onClick={() => removeRoom(room)}
                              disabled={!canEdit}
                              className="text-teal-300 hover:text-rose-600 disabled:hover:text-teal-300"
                              title="Xóa phòng/khu vực"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        );
                      })}
                      {ehRoomOptions.length === 0 && (
                        <p className="text-xs font-semibold text-teal-700">Chưa có phòng/khu vực. Thêm phòng để gán cho từng trạm.</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-xs font-black uppercase text-slate-500 mb-2">Tạo nhanh khu vực từ gói thiết bị</p>
                  {getEventVenue(selectedEvent) === 'EBUS' && ebusPackageLocks.size > 0 && (
                    <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                      EBUS đang khóa trạm theo sự kiện cùng ngày/cùng buổi. Gói đã có sự kiện khác dùng sẽ không chọn được; quy tắc này không áp dụng cho EH.
                    </div>
                  )}
                  {ebusCurrentStationConflicts.length > 0 && (
                    <div className="mb-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-800">
                      <p className="font-black uppercase">Trạm EBUS đang trùng lịch</p>
                      <div className="mt-2 space-y-1">
                        {ebusCurrentStationConflicts.slice(0, 4).map(({ station, lock }) => (
                          <p key={`${station.id}-${lock.packageId}-${lock.eventId}`} className="font-semibold">
                            {station.name} đang bị giữ bởi {lock.eventName} ({lock.date} • {getSessionListLabel(lock.sessions)}).
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {educationPackages.map(pkg => {
                      const alreadyAdded = operation.stations.some(station => getStationPackageIds(station).includes(pkg.id));
                      const locked = isEbusPackageLocked(pkg.id);
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => addPackageStation(pkg)}
                          disabled={!canEdit || locked}
                          className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 ${
                            locked
                              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50'
                              : alreadyAdded
                                ? 'border-teal-200 bg-teal-50 text-teal-800'
                                : 'border-slate-200 text-slate-800'
                          }`}
                          title={locked ? `Đã được chọn bởi ${getEbusPackageLockText(pkg.id)}` : `${pkg.items.length} thiết bị trong gói`}
                        >
                          <Plus size={15} />
                          {pkg.name}
                          <span className="text-[11px] font-black text-slate-400">({pkg.items.length})</span>
                          {locked && <span className="text-[10px] font-black text-rose-500">Đã khóa</span>}
                        </button>
                      );
                    })}
                    {educationPackages.length === 0 && (
                      <div className="w-full rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        Chưa có gói học liệu. Hãy tạo hoặc chuyển loại gói ở module Gói thiết bị để EH OS dùng làm trạm.
                      </div>
                    )}
                    {educationPackages.length === 0 && STATION_TEMPLATES.map(template => (
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
                    const mergeablePackages = educationPackages.filter(pkg => !stationPackageIds.includes(pkg.id));
                    const hasUnlockedMergeablePackage = mergeablePackages.some(pkg => !isEbusPackageLocked(pkg.id));
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
                            {getEventVenue(selectedEvent) === 'EH' ? (
                              <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-2">
                                <select
                                  value={station.room || ''}
                                  disabled={!canEdit || ehRoomOptions.length === 0}
                                  onChange={event => updateStation(station.id, { room: event.target.value })}
                                  className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-teal-700 bg-white"
                                >
                                  <option value="">Chọn phòng/khu vực</option>
                                  {station.room && !ehRoomOptions.includes(station.room) && (
                                    <option value={station.room}>{station.room} (ngoài danh sách chung)</option>
                                  )}
                                  {ehRoomOptions.map(room => (
                                    <option key={room} value={room}>{room}</option>
                                  ))}
                                </select>
                                <input
                                  value={station.areaDescription || ''}
                                  disabled={!canEdit}
                                  onChange={event => updateStation(station.id, { areaDescription: event.target.value })}
                                  className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white"
                                  placeholder="Mô tả nhỏ: vị trí trong phòng, gần cửa..."
                                />
                              </div>
                            ) : (
                              <input
                                value={station.areaDescription ?? station.room ?? ''}
                                disabled={!canEdit}
                                onChange={event => updateStation(station.id, { areaDescription: event.target.value, room: event.target.value })}
                                className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 bg-white"
                                placeholder="Mô tả nhỏ: tầng, vị trí, gần cửa..."
                              />
                            )}
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
                            disabled={!canEdit || mergeablePackages.length === 0 || !hasUnlockedMergeablePackage}
                            onChange={event => {
                              if (!event.target.value) return;
                              mergePackageIntoStation(station.id, event.target.value);
                              event.currentTarget.value = '';
                            }}
                            className="w-full min-w-0 border rounded-lg px-2 py-2 text-xs font-bold bg-white"
                          >
                            <option value="">Chọn/gộp gói vào khu vực</option>
                            {mergeablePackages.map(pkg => (
                              <option key={pkg.id} value={pkg.id} disabled={isEbusPackageLocked(pkg.id)}>
                                {pkg.name} ({pkg.items.length}){isEbusPackageLocked(pkg.id) ? ` - Đã khóa: ${getEbusPackageLockText(pkg.id)}` : ''}
                              </option>
                            ))}
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

          {activeTab === 'AGENDA' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><TimerReset size={18} />Agenda tổng</h3>
                    <p className="mt-1 text-xs text-slate-500">Các mốc chung cho toàn đoàn: đến, show chung, nghỉ, ăn, ra về.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addCommonActivity} disabled={!canEdit} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:text-slate-300">Thêm hoạt động chung</button>
                    <button onClick={insertBreak} disabled={!canEdit} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:text-slate-300">Thêm nghỉ giữa giờ</button>
                    <button onClick={recalcAgenda} disabled={!canEdit} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300">Sinh mốc chung</button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {operation.agenda.map(block => {
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
                                <button type="button" disabled={!canEdit} onClick={() => moveAgendaBlock(block.id, -1)} className="text-[10px] text-slate-400 hover:text-slate-800 disabled:hover:text-slate-400">↑</button>
                                <button type="button" disabled={!canEdit} onClick={() => moveAgendaBlock(block.id, 1)} className="text-[10px] text-slate-400 hover:text-slate-800 disabled:hover:text-slate-400">↓</button>
                              </span>
                              <button type="button" disabled={!canEdit || operation.agenda.length <= 1} onClick={() => removeAgendaBlock(block.id)} className="text-slate-300 hover:text-rose-600 disabled:hover:text-slate-300" title="Xóa mốc">
                                <Trash2 size={12} />
                              </button>
                            </span>
                          </div>
                          <input type="time" value={block.startTime} disabled={!canEdit} onChange={e => updateAgendaBlock(block.id, { startTime: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                          <input type="time" value={block.endTime} disabled={!canEdit} onChange={e => updateAgendaBlock(block.id, { endTime: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                          <input value={block.title} disabled={!canEdit} onChange={e => updateAgendaBlock(block.id, { title: e.target.value })} className="border rounded-lg px-2 py-2 text-sm font-bold" />
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
                          {isCommon ? (
                            <select
                              value={block.stationId || ''}
                              disabled={!canEdit}
                              onChange={e => {
                                const station = operation.stations.find(item => item.id === e.target.value);
                                updateAgendaBlock(block.id, {
                                  stationId: station?.id,
                                  title: station?.name || block.title,
                                  room: station?.room || station?.areaDescription,
                                  endTime: addMinutes(block.startTime, station?.durationMinutes || 15)
                                });
                              }}
                              className="border rounded-lg px-2 py-2 text-sm font-bold bg-white"
                            >
                              <option value="">Chọn trạm xem chung</option>
                              {operation.stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                            </select>
                          ) : (
                            <input value={block.room || ''} disabled={!canEdit} onChange={e => updateAgendaBlock(block.id, { room: e.target.value })} placeholder="Phòng/khu hoặc ghi chú" className="border rounded-lg px-2 py-2 text-sm" />
                          )}
                          {isExperience ? (
                            <label className="flex items-center gap-2 border rounded-lg px-2 py-2 bg-white">
                              <span className="text-[11px] font-black text-slate-500">Số trạm</span>
                              <input
                                type="number"
                                min={0}
                                value={block.stationCount || 0}
                                disabled={!canEdit}
                                onChange={e => updateAgendaBlock(block.id, { stationCount: Math.max(0, Number(e.target.value) || 0) })}
                                className="min-w-0 flex-1 text-sm font-black outline-none"
                              />
                            </label>
                          ) : (
                            <input value={block.note || ''} disabled={!canEdit} onChange={e => updateAgendaBlock(block.id, { note: e.target.value })} placeholder="Ghi chú" className="border rounded-lg px-2 py-2 text-sm" />
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
                    <p className="mt-1 text-xs text-slate-500">Nhập số nhóm, hệ thống sinh agenda hoạt động riêng để tránh trùng trạm cùng giờ.</p>
                  </div>
                  <button onClick={regenerateRotations} disabled={!canEdit} className="text-sm font-bold text-teal-700 disabled:text-slate-300">Sinh lại</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Số nhóm">
                    <input
                      type="number"
                      min={1}
                      max={MAX_ROTATION_GROUPS}
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
                {getEventVenue(selectedEvent) === 'EH' && ehResourceConflictWarnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                    <p className="font-black uppercase">Đã phát hiện chương trình EH trùng giờ</p>
                    <div className="mt-2 space-y-1">
                      {ehResourceConflictWarnings.slice(0, 4).map(({ stationName, blocker, own }) => (
                        <p key={`${stationName}-${blocker.eventId}-${own.start}`} className="font-semibold">
                          {stationName} va với {blocker.eventName} / {blocker.groupName} ({minutesToTime(blocker.start)}-{minutesToTime(blocker.end)}). Agenda nhóm sẽ tự né nếu còn trạm thay thế.
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {operation.rotations.map((group, groupIndex) => {
                    const color = group.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length];
                    const logo = getGroupLogo(group, groupIndex);
                    const LogoIcon = logo.icon;
                    return (
                      <div key={group.id} className="border border-slate-100 bg-slate-50 rounded-lg p-3" style={{ borderLeft: `5px solid ${color}` }}>
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18`, color }}>
                            <LogoIcon size={24} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              value={group.name}
                              disabled={!canEdit}
                              onChange={event => updateRotationGroup(group.id, { name: event.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm font-black bg-white"
                              placeholder="Tên nhóm"
                            />
                            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                              <label className="flex items-center gap-2 border rounded-lg bg-white px-2 py-2">
                                <span className="text-[11px] font-black text-slate-500">HS</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={group.studentCount}
                                  disabled={!canEdit}
                                  onChange={event => updateRotationGroup(group.id, { studentCount: Math.max(0, Number(event.target.value) || 0) })}
                                  className="min-w-0 flex-1 text-sm font-black outline-none"
                                />
                              </label>
                              <input
                                type="color"
                                value={color}
                                disabled={!canEdit}
                                onChange={event => updateRotationGroup(group.id, { color: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white p-1"
                                title="Màu nhóm"
                              />
                            </div>
                            <p className="text-[11px] font-bold text-slate-500">Logo tự động: {logo.label}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="xl:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><TimerReset size={18} />Agenda hoạt động theo nhóm</h3>
                    <p className="mt-1 text-xs text-slate-500">Các nhóm chạy song song theo màu. Cùng một round sẽ có cùng mốc giờ, nhưng đi khu vực khác nhau.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">Bắt đầu sau: {getAgendaActivityStartTime(operation.agenda, selectedEvent)}</span>
                    <button onClick={printGroupAgendas} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-black">
                      <FileText size={15} />
                      Xuất PDF
                    </button>
                  </div>
                </div>
                {unresolvedEhSlots.length > 0 && (
                  <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-800">
                    <p className="font-black uppercase">Còn slot chưa có trạm sạch</p>
                    <div className="mt-2 space-y-1">
                      {unresolvedEhSlots.map(({ groupName, block }) => (
                        <p key={block.id} className="font-semibold">
                          {groupName} • {block.startTime}-{block.endTime}: {block.note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {groupActivityAgendas.map((group, groupIndex) => (
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
                        {group.blocks.length === 0 && <p className="text-sm text-slate-500">Chưa có khu vực/trạm để sinh agenda hoạt động.</p>}
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
            <div className="space-y-4">
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Library size={18} />SOP Center + Station Library</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Knowledge tự lấy nội dung giáo dục theo gói/giáo cụ đã gắn ở Design và module Nội dung GD. Chỉ thêm thủ công khi khu vực có bài phụ hoặc ngoại lệ.
                </p>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {operation.stations.map(station => {
                    const educationViews = getStationEducationViews(station);
                    const manualEducationKeys = new Set(getStationManualEducationLinks(station).map(getEducationLinkKey));
                    const linkedEducationKeys = new Set(educationViews.map(view => getEducationLinkKey(view.link)));
                    const availableEducationOptions = educationActivities.flatMap(activity => activity.themes.map(theme => ({ activity, theme })))
                      .filter(option => !linkedEducationKeys.has(`${option.activity.id}::${option.theme.id}`));
                    return (
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
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select
                          value=""
                          disabled={!canEdit || educationPackages.length === 0 || educationPackages.every(pkg => isEbusPackageLocked(pkg.id))}
                          onChange={event => {
                            if (!event.target.value) return;
                            mergePackageIntoStation(station.id, event.target.value);
                            event.currentTarget.value = '';
                          }}
                          className="w-full border rounded-lg px-2 py-2 text-xs font-bold bg-white"
                        >
                          <option value="">Bổ sung gói ngoài Design</option>
                          {educationPackages.map(pkg => (
                            <option key={pkg.id} value={pkg.id} disabled={isEbusPackageLocked(pkg.id)}>
                              {pkg.name} ({pkg.items.length}){isEbusPackageLocked(pkg.id) ? ` - Đã khóa: ${getEbusPackageLockText(pkg.id)}` : ''}
                            </option>
                          ))}
                        </select>
                        <select
                          value=""
                          disabled={!canEdit || inventory.length === 0}
                          onChange={event => {
                            if (!event.target.value) return;
                            addInventoryItemToStation(station.id, event.target.value);
                            event.currentTarget.value = '';
                          }}
                          className="w-full border rounded-lg px-2 py-2 text-xs font-bold bg-white"
                        >
                          <option value="">Bổ sung thiết bị lẻ ngoài gói</option>
                          {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                        <select
                          value=""
                          disabled={!canEdit || availableEducationOptions.length === 0}
                          onChange={event => {
                            if (!event.target.value) return;
                            addStationEducationLink(station.id, event.target.value);
                            event.currentTarget.value = '';
                          }}
                          className="w-full border rounded-lg px-2 py-2 text-xs font-bold bg-white"
                        >
                          <option value="">Thêm bài GD bổ sung</option>
                          {availableEducationOptions.map(({ activity, theme }) => (
                            <option key={`${activity.id}::${theme.id}`} value={`${activity.id}::${theme.id}`}>{activity.name} • {theme.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setExpandedEquipmentStationId(expandedEquipmentStationId === station.id ? null : station.id)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700"
                        >
                          {expandedEquipmentStationId === station.id ? 'Ẩn thiết bị' : 'Xem thiết bị'}
                        </button>
                        <button
                          onClick={() => setViewingEducationContext({ stationName: station.name, links: educationViews.map(view => view.link), activeIndex: 0 })}
                          disabled={educationViews.length === 0}
                          className="px-3 py-2 rounded-lg border border-indigo-100 bg-indigo-50 text-xs font-black text-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
                        >
                          {educationViews.length > 0 ? `Xem ${educationViews.length} nội dung GD` : 'Chưa có nội dung GD'}
                        </button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {educationViews.map(view => {
                          const canRemoveManual = canEdit && manualEducationKeys.has(getEducationLinkKey(view.link)) && view.source === 'MANUAL';
                          return (
                            <div key={`${view.source}-${getEducationLinkKey(view.link)}`} className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-xs text-indigo-900">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-black">{view.activity?.name || 'Nội dung không còn tồn tại'} • {view.theme?.name || 'Chủ đề không còn tồn tại'}</p>
                                  <p className="mt-1 text-[11px] font-bold uppercase text-indigo-600">{view.source === 'AUTO' ? 'Tự động từ gói/giáo cụ' : 'Bổ sung thủ công'}</p>
                                </div>
                                {canRemoveManual && (
                                  <button onClick={() => removeStationEducationLink(station.id, view.link)} className="text-indigo-400 hover:text-rose-600">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              {view.theme?.pedagogyContent && <p className="mt-1">{view.theme.pedagogyContent}</p>}
                            </div>
                          );
                        })}
                        {educationViews.length === 0 && (
                          <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs font-bold text-amber-800">
                            Chưa có nội dung GD khớp với gói/giáo cụ. Gắn giáo cụ cho bài trong module Nội dung GD hoặc thêm bài bổ sung tại đây.
                          </div>
                        )}
                      </div>
                      {expandedEquipmentStationId === station.id && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-black uppercase text-slate-500">Danh mục thiết bị của phòng/khu vực</p>
                          <div className="mt-2 space-y-2">
                            {(station.equipment || []).map(item => {
                              const inv = item.itemId ? inventory.find(i => i.id === item.itemId) : undefined;
                              return (
                                <div key={`${item.itemId || item.name}-${item.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2">
                                  <div>
                                    <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                    <p className="text-[11px] text-slate-500">{item.itemId ? 'Thiết bị lẻ/kho' : 'Vật tư thủ công'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-black text-slate-900">{item.quantity} {item.unit || ''}</p>
                                    {inv && <p className={`text-[11px] font-bold ${inv.availableQuantity >= item.quantity ? 'text-emerald-600' : 'text-rose-600'}`}>Kho: {inv.availableQuantity}</p>}
                                  </div>
                                </div>
                              );
                            })}
                            {(station.equipment || []).length === 0 && <p className="text-sm text-slate-500">Chưa có thiết bị cho khu vực này.</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'LIVE' && (
            <div className="space-y-4">
              <section className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    ['CONTROL', 'Dành cho Điều phối chung', Radio],
                    ['GUIDE', 'Dành cho giáo viên dẫn đoàn', Users],
                    ['ROOM', 'Dành cho nhân viên tại phòng', Building2]
                  ].map(([mode, label, Icon]) => (
                    <button
                      key={mode as string}
                      onClick={() => setLiveViewMode(mode as LiveViewMode)}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-black transition ${liveViewMode === mode ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Icon size={17} />
                      {label as string}
                    </button>
                  ))}
                </div>
              </section>

              {liveViewMode === 'CONTROL' && (
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 flex items-center gap-2"><PlayCircle size={18} />Timing Center</h3>
                    <p className="mt-1 text-xs text-slate-500">Bản LIVE lấy từ agenda chuẩn. Nhập giờ thực tế bắt đầu mốc C để đẩy các vòng trải nghiệm; A check-in và B hoạt động chung giữ nguyên.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 min-w-full lg:min-w-[300px]">
                    <label className="block">
                      <span className="text-[11px] font-black uppercase text-slate-500">Mốc C chuẩn</span>
                      <input readOnly value={liveTimingAnchor} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-black bg-slate-50" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-black uppercase text-slate-500">Bắt đầu C thực tế</span>
                      <input
                        type="time"
                        value={actualArrival}
                        disabled={!canEdit}
                        onChange={event => saveOperation(cur => ({ ...cur, live: { ...cur.live, actualArrivalTime: event.target.value, lastUpdatedAt: new Date().toISOString() } }))}
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-black"
                      />
                    </label>
                  </div>
                </div>
                <div className={`mt-4 rounded-lg border p-3 text-sm font-bold ${liveDelta > 0 ? 'border-amber-100 bg-amber-50 text-amber-800' : liveDelta < 0 ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                  {liveDelta === 0 ? 'LIVE đang khớp mốc C chuẩn.' : `Mốc C và các vòng trải nghiệm đang ${liveDelta > 0 ? 'trễ' : 'sớm'} ${Math.abs(liveDelta)} phút. A/B giữ nguyên, nghỉ trưa tự co/giãn, buổi chiều giữ nguyên.`}
                </div>
                {!publicMode && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-black uppercase text-blue-700">Link xem LIVE không cần đăng nhập</p>
                    <input
                      readOnly
                      value={`${window.location.origin}${window.location.pathname}?ehLive=${selectedEvent.id}${liveProgramId ? `&ehProgram=${encodeURIComponent(liveProgramId)}` : ''}`}
                      className="mt-2 w-full border border-blue-100 rounded-lg px-3 py-2 text-xs font-bold text-blue-900 bg-white"
                      onFocus={event => event.currentTarget.select()}
                    />
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {getEventVenue(selectedEvent) === 'EH' && (
                    <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
                      <p className="text-xs font-black uppercase text-teal-700">Tổng điều phối trung tâm trong ngày</p>
                      <p className="mt-1 text-xs font-semibold text-teal-800">
                        Đang xem {liveControlEventAgendas.length} đoàn/chương trình EH cùng ngày {formatDate(getPrimaryDate(selectedEvent))}.
                      </p>
                    </div>
                  )}
                  {liveControlEventAgendas.map(({ event, groups }) => {
                    const activeCount = groups.filter(group => group.blocks.some(block => getBlockState(block, liveNow) === 'NOW')).length;
                    const upcomingCount = groups.filter(group =>
                      !group.blocks.some(block => getBlockState(block, liveNow) === 'NOW') &&
                      group.blocks.some(block => getBlockState(block, liveNow) === 'UPCOMING')
                    ).length;
                    return (
                      <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[11px] font-black uppercase text-slate-400">{formatDate(getPrimaryDate(event))}</p>
                            <h4 className="font-black text-slate-900">{event.name}</h4>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-black">
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{activeCount} đang chạy</span>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{upcomingCount} sắp tới</span>
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-600">{groups.length} nhóm</span>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {groups.map((group, groupIndex) => {
                            const active = group.blocks.find(block => getBlockState(block, liveNow) === 'NOW');
                            const next = group.blocks.find(block => getBlockState(block, liveNow) === 'UPCOMING');
                            const focus = active || next || group.blocks[group.blocks.length - 1];
                            const nextAfterFocus = active ? next : undefined;
                            return (
                              <div key={`${event.id}-${group.id}`} className="rounded-lg border border-slate-100 bg-white p-3" style={{ borderTop: `5px solid ${group.color || GROUP_COLORS[groupIndex % GROUP_COLORS.length]}` }}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-black text-slate-900">{group.name}</p>
                                  <span className={`px-2 py-1 rounded-full text-[11px] font-black ${active ? 'bg-emerald-100 text-emerald-700' : next ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {active ? 'Đang chạy' : next ? 'Sắp tới' : 'Xong'}
                                  </span>
                                </div>
                                <p className="mt-3 text-lg font-black text-slate-900">{focus?.title || 'Standby'}</p>
                                <p className="mt-1 text-xs text-slate-500">{focus ? `${focus.startTime}-${focus.endTime} • ${focus.room || 'Chưa gán vị trí'}` : 'Không có lịch live'}</p>
                                <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                                  <p className="text-xs font-black uppercase text-slate-500">{active ? 'Countdown' : 'Chuẩn bị'}</p>
                                  <p className="mt-1 text-xl font-black text-teal-700">{getCountdownLabel(focus, liveNow)}</p>
                                </div>
                                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-blue-600">{active ? 'Trạm tiếp theo' : 'Mốc sắp chạy'}</p>
                                  <p className="mt-1 text-xs font-bold text-blue-900">
                                    {nextAfterFocus
                                      ? `${nextAfterFocus.title} • ${nextAfterFocus.startTime}-${nextAfterFocus.endTime} • ${nextAfterFocus.room || 'Chưa gán vị trí'}`
                                      : next
                                        ? `${next.title} • ${next.startTime}-${next.endTime} • ${next.room || 'Chưa gán vị trí'}`
                                        : 'Không còn trạm tiếp theo'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {liveControlEventAgendas.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Chưa có nhóm live nào trong ngày.
                    </div>
                  )}
                </div>
              </section>
              )}

              {liveViewMode === 'GUIDE' && (
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Users size={18} />Màn hình đội dẫn đoàn</h3>
                <select
                  value={selectedLiveGroup?.id || ''}
                  disabled={liveGroupAgendas.length === 0}
                  onChange={event => handleLiveGroupSelect(event.target.value)}
                  className="mt-4 w-full border rounded-lg px-3 py-2 text-sm font-black"
                >
                  {liveGroupAgendas.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase text-blue-700">{selectedLiveGroup?.name || 'Chưa chọn nhóm'}</p>
                  <h4 className="mt-2 text-2xl font-black text-blue-950">{focusGroupBlock?.title || 'Standby'}</h4>
                  <p className="mt-1 text-sm font-bold text-blue-800">{focusGroupBlock ? `${focusGroupBlock.startTime}-${focusGroupBlock.endTime} • ${focusGroupBlock.room || 'Chưa gán vị trí'}` : 'Không có lịch'}</p>
                  <div className="mt-4 rounded-lg bg-white/80 border border-blue-100 p-4 text-center">
                    <p className="text-xs font-black uppercase text-blue-600">Đếm ngược</p>
                    <p className="mt-1 text-3xl font-black text-blue-950">{getCountdownLabel(focusGroupBlock, liveNow)}</p>
                  </div>
                  <p className="mt-3 text-sm text-blue-800">{nextGroupBlock && activeGroupBlock ? `Trạm tiếp theo: ${nextGroupBlock.title} lúc ${nextGroupBlock.startTime}` : nextGroupBlock ? `Chuẩn bị di chuyển đến: ${nextGroupBlock.title}` : 'Không còn trạm tiếp theo.'}</p>
                </div>
                <textarea value={operation.live?.statusNote || ''} disabled={!canEdit} onChange={e => saveOperation(cur => ({ ...cur, live: { ...cur.live, statusNote: e.target.value, lastUpdatedAt: new Date().toISOString() } }))} className="mt-4 w-full min-h-[90px] border rounded-lg p-3 text-sm" placeholder="Ghi chú live cho điều phối..." />
              </section>
              )}

              {liveViewMode === 'ROOM' && (
              <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Building2 size={18} />Màn hình nhân viên tại phòng</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {getEventVenue(selectedEvent) === 'EH'
                    ? 'Chọn phòng/khu vực để xem tất cả đoàn EH cùng ngày đang dùng phòng đó.'
                    : 'Chọn khu vực/phòng để xem lần lượt nhóm nào sẽ đến, đang đến hoặc đã xong.'}
                </p>
                <select
                  value={selectedRoomAgenda?.room || ''}
                  disabled={effectiveRoomAgendas.length === 0}
                  onChange={event => handleLiveRoomSelect(event.target.value)}
                  className="mt-4 w-full border rounded-lg px-3 py-2 text-sm font-black"
                >
                  {effectiveRoomAgendas.map(item => <option key={item.room} value={item.room}>{item.room}</option>)}
                </select>
                <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase text-violet-700">Đang theo dõi khu vực</p>
                  <h4 className="mt-2 text-2xl font-black text-violet-950">{selectedRoomAgenda?.room || 'Chưa có khu vực'}</h4>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/80 border border-violet-100 p-3">
                      <p className="text-xs font-black uppercase text-violet-600">Đang đón</p>
                      <p className="mt-1 text-lg font-black text-violet-950">{activeRoomBlock ? activeRoomBlock.groupName : 'Chưa có nhóm'}</p>
                      <p className="text-xs text-violet-700">{activeRoomBlock ? `${activeRoomBlock.startTime}-${activeRoomBlock.endTime} • ${activeRoomBlock.eventName ? `${activeRoomBlock.eventName} • ` : ''}${activeRoomBlock.title}` : 'Không có nhóm đang ở phòng'}</p>
                    </div>
                    <div className="rounded-lg bg-white/80 border border-violet-100 p-3">
                      <p className="text-xs font-black uppercase text-violet-600">Tiếp theo</p>
                      <p className="mt-1 text-lg font-black text-violet-950">{nextRoomBlock ? nextRoomBlock.groupName : 'Không còn nhóm'}</p>
                      <p className="text-xs text-violet-700">{nextRoomBlock ? `${nextRoomBlock.startTime}-${nextRoomBlock.endTime} • ${nextRoomBlock.eventName ? `${nextRoomBlock.eventName} • ` : ''}${nextRoomBlock.title}` : 'Không có lượt tiếp theo'}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/90 border border-violet-100 p-4 text-center">
                    <p className="text-xs font-black uppercase text-violet-600">{activeRoomBlock ? 'Thời gian còn lại của lượt hiện tại' : 'Thời gian tới lượt tiếp theo'}</p>
                    <p className="mt-1 text-3xl font-black text-violet-950">{getCountdownLabel(focusRoomBlock, liveNow)}</p>
                    {focusRoomBlock && (
                      <p className="mt-1 text-xs font-bold text-violet-700">{focusRoomBlock.eventName ? `${focusRoomBlock.eventName} • ` : ''}{focusRoomBlock.groupName} • {focusRoomBlock.startTime}-{focusRoomBlock.endTime}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {(selectedRoomAgenda?.blocks || []).map(block => {
                    const state = getBlockState(block, liveNow);
                    return (
                      <div key={`${block.eventId || 'event'}-${block.groupId}-${block.id}`} className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${state === 'NOW' ? 'border-emerald-200 bg-emerald-50' : state === 'UPCOMING' ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                        <div>
                          <p className="font-black text-slate-900">{block.groupName}</p>
                          <p className="text-xs text-slate-500">{block.eventName ? `${block.eventName} • ` : ''}{block.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-700">{block.startTime}-{block.endTime}</p>
                          <p className="text-[11px] font-bold text-slate-500">{state === 'NOW' ? 'Đang ở phòng' : state === 'UPCOMING' ? getCountdownLabel(block, liveNow) : 'Đã xong'}</p>
                        </div>
                      </div>
                    );
                  })}
                  {!selectedRoomAgenda && <p className="text-sm text-slate-500">Chưa có lịch phòng.</p>}
                </div>
              </section>
              )}

              {liveViewMode === 'CONTROL' && (
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
              )}
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

      {viewingEducationContext && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
              <div>
                <p className="text-xs font-black uppercase text-indigo-700">Nội dung giáo dục</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{viewingEducationContext.stationName}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{viewingEducationItems.length} nội dung đã gắn/tự động khớp</p>
              </div>
              <button
                onClick={() => setViewingEducationContext(null)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Đóng cửa sổ nội dung giáo dục"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto p-4">
              {viewingEducationItems.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {viewingEducationItems.map((item, index) => {
                    const active = index === viewingEducationActiveIndex;
                    return (
                      <button
                        key={getEducationLinkKey(item.link)}
                        onClick={() => setViewingEducationContext(current => current ? { ...current, activeIndex: index } : current)}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-black ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {index + 1}. {item.activity?.name || 'Nội dung lỗi'}
                        <span className="block max-w-[220px] truncate font-bold opacity-70">{item.theme?.name || 'Chủ đề lỗi'}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {viewingEducationTheme ? (
                <div className="space-y-4">
                  <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <p className="text-[11px] font-black uppercase text-indigo-700">Bài đang xem</p>
                    <h3 className="mt-1 text-lg font-black text-indigo-950">{viewingEducationActivity?.name}</h3>
                    <p className="mt-1 text-sm font-bold text-indigo-800">{viewingEducationTheme.name}</p>
                  </section>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-500">Nhóm nội dung</p>
                      <p className="mt-1 font-black text-slate-900">{viewingEducationActivity?.category || 'Chưa phân loại'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-500">Độ tuổi/khối</p>
                      <p className="mt-1 font-black text-slate-900">{viewingEducationActivity?.ageGroup || 'Chưa gán'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-500">Elearning</p>
                      <p className="mt-1 font-black text-slate-900">{viewingEducationTheme.lessonLinks.length} bài học</p>
                    </div>
                  </div>

                  {(viewingEducationActivity?.summary || viewingEducationTheme.description) && (
                    <section className="rounded-lg border border-slate-100 p-4">
                      <h3 className="font-black text-slate-900">Tổng quan</h3>
                      {viewingEducationActivity?.summary && <p className="mt-2 text-sm text-slate-600">{viewingEducationActivity.summary}</p>}
                      {viewingEducationTheme.description && <p className="mt-2 text-sm text-slate-600">{viewingEducationTheme.description}</p>}
                    </section>
                  )}

                  <section className="rounded-lg border border-slate-100 p-4">
                    <h3 className="font-black text-slate-900">Mục tiêu học tập</h3>
                    {viewingEducationTheme.learningObjectives.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {viewingEducationTheme.learningObjectives.map(objective => (
                          <li key={objective} className="flex gap-2 text-sm text-slate-600">
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                            <span>{objective}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Chưa nhập mục tiêu học tập.</p>
                    )}
                  </section>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <section className="rounded-lg border border-slate-100 p-4">
                      <h3 className="font-black text-slate-900">Hướng dẫn sử dụng</h3>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{viewingEducationTheme.usageGuide || 'Chưa nhập hướng dẫn sử dụng.'}</p>
                    </section>
                    <section className="rounded-lg border border-slate-100 p-4">
                      <h3 className="font-black text-slate-900">Nội dung sư phạm</h3>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{viewingEducationTheme.pedagogyContent || 'Chưa nhập nội dung sư phạm.'}</p>
                    </section>
                  </div>

                  <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <h3 className="font-black text-indigo-950">Kịch bản dẫn đoàn</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-indigo-900">{viewingEducationTheme.guideScript || 'Chưa nhập kịch bản dẫn đoàn.'}</p>
                  </section>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <section className="rounded-lg border border-slate-100 p-4">
                      <h3 className="font-black text-slate-900">Giáo cụ đi kèm</h3>
                      <div className="mt-2 space-y-2">
                        {viewingEducationTheme.equipment.map((link, index) => (
                          <div key={`${link.type}-${link.id}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <p className="font-black text-slate-800">{getEducationEquipmentName(link)}</p>
                            <p className="text-xs font-bold text-slate-500">{link.type === 'PACKAGE' ? 'Gói thiết bị' : 'Thiết bị lẻ'} • SL {link.quantity || 1}</p>
                            {link.note && <p className="mt-1 text-xs text-slate-500">{link.note}</p>}
                          </div>
                        ))}
                        {viewingEducationTheme.equipment.length === 0 && <p className="text-sm text-slate-500">Chưa gắn giáo cụ.</p>}
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-100 p-4">
                      <h3 className="font-black text-slate-900">Bài học Elearning đã gắn</h3>
                      <div className="mt-2 space-y-2">
                        {viewingEducationTheme.lessonLinks.map(link => (
                          <div key={`${link.trackId}-${link.lessonId}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <p className="font-black text-slate-800">{getEducationLessonLabel(link.trackId, link.lessonId)}</p>
                            <p className="text-xs font-bold text-slate-500">{link.trackId} • {link.lessonId}</p>
                          </div>
                        ))}
                        {viewingEducationTheme.lessonLinks.length === 0 && <p className="text-sm text-slate-500">Chưa gắn bài học Elearning.</p>}
                      </div>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Nội dung đã gắn không còn tồn tại trong module Nội dung GD. Hãy chọn lại bài trong SOP Center + Station Library.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
