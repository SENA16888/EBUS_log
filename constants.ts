
import { InventoryItem, Event, Transaction, EventStatus, TransactionType, ComboPackage, Employee, LearningTrack, LearningProfile, CareerRank, UserAccount, InventoryReceipt, EducationActivity, InteractiveDeviceProfile, MakerAcademicYear, MakerAnnouncement, MakerAttendanceRecord, MakerCertificate, MakerClass, MakerClassSession, MakerEnrollment, MakerPayment, MakerStudent, MakerStudentProduct } from './types';
import { getDefaultPermissionsForRole } from './services/accessControl';

export const MOCK_INVENTORY: InventoryItem[] = [];
export const MOCK_PACKAGES: ComboPackage[] = [];
export const MOCK_EMPLOYEES: Employee[] = [];
export const MOCK_EVENTS: Event[] = [];
export const MOCK_TRANSACTIONS: Transaction[] = [];
export const MOCK_INVENTORY_RECEIPTS: InventoryReceipt[] = [];

export const MOCK_MAKER_ACADEMIC_YEARS: MakerAcademicYear[] = [
  {
    id: 'maker-year-einstein-2026',
    name: 'Einstein',
    programType: '3D_MAKER',
    startDate: '2026-08-10',
    endDate: '2026-10-08',
    courseCount: 3,
    lessonsPerCourse: 6,
    totalLessons: 18
  }
];

export const MOCK_MAKER_CLASSES: MakerClass[] = [
  {
    id: 'maker-class-einstein-k1-a',
    academicYearId: 'maker-year-einstein-2026',
    courseName: 'Khóa 1',
    name: 'Einstein - K1 - A',
    daysOfWeek: [1, 3],
    slotName: 'Slot 1',
    startTime: '17:00',
    endTime: '19:00',
    teacherName: 'Phạm Trần Nhân',
    maxStudents: 6,
    color: '#2563eb',
    startDate: '2026-08-10',
    endDate: '2026-08-26'
  },
  {
    id: 'maker-class-einstein-k1-b',
    academicYearId: 'maker-year-einstein-2026',
    courseName: 'Khóa 1',
    name: 'Einstein - K1 - B',
    daysOfWeek: [2, 4],
    slotName: 'Slot 2',
    startTime: '19:00',
    endTime: '21:00',
    teacherName: 'Phạm Trần Nhân',
    maxStudents: 6,
    color: '#eab308',
    startDate: '2026-08-11',
    endDate: '2026-08-27'
  }
];

export const MOCK_MAKER_CLASS_SESSIONS: MakerClassSession[] = [
  { id: 'maker-session-k1a-01', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 1, date: '2026-08-10', startTime: '17:00', endTime: '19:00', topic: 'Móc khóa cá nhân' },
  { id: 'maker-session-k1a-02', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 2, date: '2026-08-12', startTime: '17:00', endTime: '19:00', topic: 'Calibration Cube' },
  { id: 'maker-session-k1a-03', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 3, date: '2026-08-17', startTime: '17:00', endTime: '19:00', topic: 'Name tag 3D' },
  { id: 'maker-session-k1a-04', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 4, date: '2026-08-19', startTime: '17:00', endTime: '19:00', topic: 'Phone stand' },
  { id: 'maker-session-k1a-05', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 5, date: '2026-08-24', startTime: '17:00', endTime: '19:00', topic: 'Mini robot shell' },
  { id: 'maker-session-k1a-06', classId: 'maker-class-einstein-k1-a', courseName: 'Khóa 1', lessonNumber: 6, date: '2026-08-26', startTime: '17:00', endTime: '19:00', topic: 'Project showcase' },
  { id: 'maker-session-k1b-01', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 1, date: '2026-08-11', startTime: '19:00', endTime: '21:00', topic: 'Móc khóa cá nhân' },
  { id: 'maker-session-k1b-02', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 2, date: '2026-08-13', startTime: '19:00', endTime: '21:00', topic: 'Calibration Cube' },
  { id: 'maker-session-k1b-03', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 3, date: '2026-08-18', startTime: '19:00', endTime: '21:00', topic: 'Name tag 3D' },
  { id: 'maker-session-k1b-04', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 4, date: '2026-08-20', startTime: '19:00', endTime: '21:00', topic: 'Phone stand' },
  { id: 'maker-session-k1b-05', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 5, date: '2026-08-25', startTime: '19:00', endTime: '21:00', topic: 'Mini robot shell' },
  { id: 'maker-session-k1b-06', classId: 'maker-class-einstein-k1-b', courseName: 'Khóa 1', lessonNumber: 6, date: '2026-08-27', startTime: '19:00', endTime: '21:00', topic: 'Project showcase' }
];

export const MOCK_MAKER_STUDENTS: MakerStudent[] = [
  {
    id: 'maker-student-001',
    code: '3DM-2026-001',
    fullName: 'Nguyễn Minh Khang',
    birthDate: '2014-05-18',
    gender: 'MALE',
    parentName: 'Nguyễn Hoàng Nam',
    parentPhone: '0901234567',
    parentEmail: 'nam.nguyen@example.com',
    parentFacebook: 'facebook.com/nam.nguyen',
    address: 'Quận 7, TP.HCM',
    source: 'FACEBOOK',
    saleNote: 'Phụ huynh quan tâm lộ trình in 3D nâng cao sau khóa 1.',
    tags: ['PAID', 'STUDYING'],
    saleStage: 'STUDYING',
    createdAt: '2026-07-25T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z'
  },
  {
    id: 'maker-student-002',
    code: '3DM-2026-002',
    fullName: 'Lê Gia Hân',
    birthDate: '2015-11-02',
    gender: 'FEMALE',
    parentName: 'Lê Thanh Mai',
    parentPhone: '0912345678',
    parentEmail: 'mai.le@example.com',
    address: 'Thủ Đức, TP.HCM',
    source: 'EINSTEIN_BUS',
    saleNote: 'Đã trải nghiệm EBUS, thích thiết kế mô hình nhân vật.',
    tags: ['DEPOSITED'],
    saleStage: 'DEPOSITED',
    createdAt: '2026-07-28T10:30:00.000Z'
  },
  {
    id: 'maker-student-003',
    code: '3DM-2026-003',
    fullName: 'Trần Nhật Minh',
    birthDate: '2013-03-21',
    gender: 'MALE',
    parentName: 'Trần Thu Hà',
    parentPhone: '0987654321',
    parentEmail: 'ha.tran@example.com',
    address: 'Bình Thạnh, TP.HCM',
    source: 'REFERRAL',
    saleNote: 'Chờ xếp lớp tối thứ 3 + thứ 5.',
    tags: ['CONSULTED'],
    saleStage: 'TRIAL_BOOKED',
    createdAt: '2026-07-30T08:15:00.000Z'
  }
];

export const MOCK_MAKER_ENROLLMENTS: MakerEnrollment[] = [
  {
    id: 'maker-enroll-001',
    studentId: 'maker-student-001',
    academicYearId: 'maker-year-einstein-2026',
    courseName: 'Khóa 1',
    classId: 'maker-class-einstein-k1-a',
    slotName: 'Slot 1',
    startDate: '2026-08-10',
    endDate: '2026-08-26',
    status: 'STUDYING',
    tuitionFee: 3000000,
    createdAt: '2026-07-25T09:30:00.000Z'
  },
  {
    id: 'maker-enroll-002',
    studentId: 'maker-student-002',
    academicYearId: 'maker-year-einstein-2026',
    courseName: 'Khóa 1',
    classId: 'maker-class-einstein-k1-a',
    slotName: 'Slot 1',
    startDate: '2026-08-10',
    endDate: '2026-08-26',
    status: 'WAITING_START',
    tuitionFee: 3000000,
    createdAt: '2026-07-28T11:00:00.000Z'
  }
];

export const MOCK_MAKER_ATTENDANCE: MakerAttendanceRecord[] = [
  {
    id: 'maker-att-001',
    sessionId: 'maker-session-k1a-01',
    enrollmentId: 'maker-enroll-001',
    studentId: 'maker-student-001',
    status: 'PRESENT',
    note: 'Hoàn thành móc khóa.',
    checkedAt: '2026-08-10T12:30:00.000Z'
  }
];

export const MOCK_MAKER_PAYMENTS: MakerPayment[] = [
  {
    id: 'maker-pay-001',
    enrollmentId: 'maker-enroll-001',
    studentId: 'maker-student-001',
    amount: 3000000,
    paidAt: '2026-07-25',
    method: 'BANK_TRANSFER',
    note: 'Đóng đủ khóa 1'
  },
  {
    id: 'maker-pay-002',
    enrollmentId: 'maker-enroll-002',
    studentId: 'maker-student-002',
    amount: 500000,
    paidAt: '2026-07-28',
    method: 'QR',
    note: 'Đặt cọc giữ chỗ'
  }
];

export const MOCK_MAKER_PRODUCTS: MakerStudentProduct[] = [
  {
    id: 'maker-product-001',
    studentId: 'maker-student-001',
    enrollmentId: 'maker-enroll-001',
    sessionId: 'maker-session-k1a-01',
    title: 'Móc khóa Khang',
    imageUrl: 'https://images.unsplash.com/photo-1635405050330-b0824eb1bf26?auto=format&fit=crop&w=600&q=80',
    note: 'Thiết kế chữ nổi và bo góc.',
    uploadedAt: '2026-08-10T13:00:00.000Z'
  }
];

export const MOCK_MAKER_CERTIFICATES: MakerCertificate[] = [];

export const MOCK_MAKER_ANNOUNCEMENTS: MakerAnnouncement[] = [
  {
    id: 'maker-ann-001',
    title: 'Chuẩn bị khai giảng 3D Maker Einstein',
    body: 'Sale xác nhận học phí, giảng viên kiểm tra máy in và vật tư PLA trước ngày 10/08/2026.',
    createdAt: '2026-08-01T08:00:00.000Z',
    audience: 'INTERNAL'
  }
];
export const MOCK_INTERACTIVE_DEVICES: InteractiveDeviceProfile[] = [
  {
    id: 'eh-broadcast-center',
    name: 'Phát thanh trung tâm Einstein House',
    type: 'BROADCAST_CENTER',
    location: 'Einstein House',
    broadcastVenue: 'EH',
    isAutomationEnabled: true,
    volume: 0.82,
    backgroundVolume: 0.35,
    announcementVolume: 0.95,
    duckVolume: 0.08,
    duckFadeMs: 700,
    preAnnouncementAssetId: '',
    voiceURI: '',
    backgroundMode: 'LOOP_ALL',
    backgroundTrackId: '',
    youtubeFallbackUrl: 'https://www.youtube.com/embed/videoseries?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    youtubePlaylist: [
      {
        id: 'yt-default-chill',
        title: 'Nhạc nền Einstein House',
        url: 'https://www.youtube.com/embed/videoseries?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'
      }
    ],
    operatingHours: [
      {
        id: 'oh-weekday',
        title: 'Thứ 2 - Thứ 5',
        daysOfWeek: [1, 2, 3, 4],
        openTime: '08:00',
        closeTime: '19:00',
        enabled: true
      },
      {
        id: 'oh-weekend',
        title: 'Thứ 6 - Chủ nhật',
        daysOfWeek: [5, 6, 0],
        openTime: '08:00',
        closeTime: '21:00',
        enabled: true
      }
    ],
    silenceWindows: [
      {
        id: 'silent-center-lunch',
        title: 'Nghỉ trưa trung tâm',
        startTime: '12:00',
        endTime: '13:00',
        enabled: true
      }
    ],
    eventMusicSettings: [],
    audioAssets: [],
    schedules: [
      {
        id: 'bc-welcome',
        title: 'Âm thanh chào đón đầu ngày',
        time: '08:00',
        enabled: true,
        voiceText: 'Einstein House xin chào. Chúc mọi người một ngày trải nghiệm khoa học thật nhiều năng lượng.',
        priority: 10
      },
      {
        id: 'bc-lunch',
        title: 'Thông báo nghỉ trưa',
        time: '12:00',
        enabled: true,
        voiceText: 'Đã đến giờ nghỉ trưa. Các khu trải nghiệm tạm dừng hoạt động và sẽ tiếp tục theo lịch sau giờ nghỉ.',
        priority: 9
      },
      {
        id: 'bc-end-shift-weekday',
        title: 'Thông báo kết thúc ca làm Thứ 2 - Thứ 5',
        time: '18:30',
        enabled: true,
        daysOfWeek: [1, 2, 3, 4],
        voiceText: 'Ca vận hành hôm nay đã kết thúc. Vui lòng kiểm tra thiết bị, tắt nguồn và bàn giao khu vực theo checklist.',
        priority: 9
      },
      {
        id: 'bc-closing-weekday',
        title: 'Thông báo đóng cửa Thứ 2 - Thứ 5',
        time: '19:00',
        enabled: true,
        daysOfWeek: [1, 2, 3, 4],
        voiceText: 'Einstein House chuẩn bị đóng cửa. Cảm ơn quý khách và hẹn gặp lại trong những trải nghiệm tiếp theo.',
        priority: 8
      },
      {
        id: 'bc-end-shift-weekend',
        title: 'Thông báo kết thúc ca làm Thứ 6 - Chủ nhật',
        time: '20:30',
        enabled: true,
        daysOfWeek: [5, 6, 0],
        voiceText: 'Ca vận hành hôm nay đã kết thúc. Vui lòng kiểm tra thiết bị, tắt nguồn và bàn giao khu vực theo checklist.',
        priority: 9
      },
      {
        id: 'bc-closing-weekend',
        title: 'Thông báo đóng cửa Thứ 6 - Chủ nhật',
        time: '21:00',
        enabled: true,
        daysOfWeek: [5, 6, 0],
        voiceText: 'Einstein House chuẩn bị đóng cửa. Cảm ơn quý khách và hẹn gặp lại trong những trải nghiệm tiếp theo.',
        priority: 8
      }
    ],
    eventRules: [
      {
        id: 'bc-event-start',
        title: 'Chào đoàn theo sự kiện',
        enabled: true,
        trigger: 'EVENT_START',
        offsetMinutes: 0,
        messageTemplate: 'Einstein House xin chào đoàn {{eventName}}. Chúc các bạn có một hành trình khám phá khoa học thật vui và an toàn.',
        priority: 20
      },
      {
        id: 'bc-block-start',
        title: 'Thông báo đổi trạm buổi sáng',
        enabled: true,
        trigger: 'BLOCK_START',
        offsetMinutes: 0,
        blockKind: 'EXPERIENCE_AM',
        messageTemplate: 'Đã đến giờ di chuyển trạm trải nghiệm. Các nhóm vui lòng đi theo hướng dẫn viên đến khu vực tiếp theo.',
        priority: 18
      },
      {
        id: 'bc-block-start-pm',
        title: 'Thông báo đổi trạm buổi chiều',
        enabled: true,
        trigger: 'BLOCK_START',
        offsetMinutes: 0,
        blockKind: 'EXPERIENCE_PM',
        messageTemplate: 'Đã đến giờ di chuyển trạm trải nghiệm. Các nhóm vui lòng đi theo hướng dẫn viên đến khu vực tiếp theo.',
        priority: 18
      },
      {
        id: 'bc-before-block-end',
        title: 'Sắp hết giờ trải nghiệm',
        enabled: true,
        trigger: 'BEFORE_BLOCK_END',
        offsetMinutes: -5,
        messageTemplate: 'Còn 5 phút nữa là kết thúc lượt trải nghiệm hiện tại. Các nhóm vui lòng hoàn thiện hoạt động và chuẩn bị di chuyển.',
        priority: 17
      },
      {
        id: 'bc-lunch-event',
        title: 'Nghỉ trưa theo agenda sự kiện',
        enabled: true,
        trigger: 'BLOCK_START',
        offsetMinutes: 0,
        blockKind: 'LUNCH',
        messageTemplate: 'Đã đến giờ ăn trưa. Các đoàn vui lòng di chuyển theo hướng dẫn của ban tổ chức.',
        priority: 19
      },
      {
        id: 'bc-event-closing',
        title: 'Kết thúc thời gian trải nghiệm',
        enabled: true,
        trigger: 'BLOCK_START',
        offsetMinutes: 0,
        blockKind: 'CLOSING',
        messageTemplate: 'Thời gian trải nghiệm tại Einstein House đã kết thúc. Cảm ơn thầy cô và các bạn đã đồng hành cùng chương trình.',
        priority: 20
      }
    ],
    playbackLogs: []
  }
];
export const MOCK_EDUCATION_ACTIVITIES: EducationActivity[] = [
  {
    id: 'edu-robot-alpha-1e',
    name: 'Robot Alpha 1E',
    category: 'Robot',
    ageGroup: 'Tiểu học / THCS',
    summary: 'Hoạt động trải nghiệm robot hình người, thay đổi nội dung theo chủ đề vận động và biểu diễn.',
    createdAt: new Date().toISOString(),
    themes: [
      {
        id: 'theme-alpha-football',
        name: 'Đá bóng',
        description: 'Robot thực hiện động tác sút bóng, giữ thăng bằng và phối hợp theo lượt.',
        equipment: [],
        lessonLinks: [{ trackId: 'lt-content', lessonId: 'ct-01' }],
        usageGuide: 'Sạc pin trước giờ chạy, đặt bóng xốp cách robot 30-50cm, kiểm tra mặt sàn phẳng, cho học sinh đứng ngoài vạch an toàn.',
        pedagogyContent: 'Trọng tâm sư phạm là cân bằng, lực tác động, góc sút và tư duy thử nghiệm. HDV cho học sinh dự đoán hướng bóng trước khi robot sút, sau đó so sánh dự đoán với kết quả thật.',
        guideScript: 'Các bạn hãy quan sát chân robot. Theo các bạn, nếu robot nghiêng người nhiều hơn thì bóng sẽ đi xa hơn hay lệch hướng? Mỗi nhóm đưa ra một giả thuyết trước khi robot sút nhé.',
        learningObjectives: ['Nhận biết cân bằng và trọng tâm', 'Dự đoán kết quả trước khi thử nghiệm', 'Liên hệ lực tác động với hướng chuyển động']
      },
      {
        id: 'theme-alpha-dance',
        name: 'Múa hát',
        description: 'Robot biểu diễn chuỗi động tác theo nhạc, học sinh quan sát nhịp, trình tự và biểu cảm.',
        equipment: [],
        lessonLinks: [{ trackId: 'lt-content', lessonId: 'ct-01' }],
        usageGuide: 'Test loa, file nhạc và động tác trước khi đón đoàn. Chừa khoảng trống tối thiểu 2m quanh robot để tránh va chạm.',
        pedagogyContent: 'Trọng tâm sư phạm là thuật toán tuần tự, nhịp điệu và lập trình hành vi. HDV giải thích robot không tự “ngẫu hứng” mà thực hiện chuỗi lệnh đã được thiết kế.',
        guideScript: 'Robot đang múa theo một chuỗi lệnh. Nếu đổi thứ tự ba động tác đầu tiên thì tiết mục sẽ khác như thế nào? Các bạn thử mô tả lại thuật toán của bài múa này.',
        learningObjectives: ['Hiểu chuỗi lệnh tuần tự', 'Nhận biết nhịp và pattern', 'Diễn đạt thuật toán bằng ngôn ngữ đơn giản']
      },
      {
        id: 'theme-alpha-boxing',
        name: 'Boxing',
        description: 'Robot mô phỏng động tác boxing an toàn, nhấn mạnh phản xạ, điều khiển động cơ và luật an toàn.',
        equipment: [],
        lessonLinks: [{ trackId: 'lt-operations', lessonId: 'ops-02' }],
        usageGuide: 'Chỉ chạy chế độ demo, không để học sinh đứng trong vùng tay robot. Đặt vạch cách ly, kiểm tra pin và nút dừng trước khi biểu diễn.',
        pedagogyContent: 'Trọng tâm sư phạm là điều khiển servo, phản xạ theo tín hiệu và an toàn khi tương tác với máy. HDV biến hoạt động thành quan sát khoa học thay vì thi đấu đối kháng.',
        guideScript: 'Boxing của robot là mô phỏng chuyển động. Điều quan trọng không phải đánh mạnh, mà là robot nhận lệnh, giữ thăng bằng và dừng đúng lúc khi có tín hiệu an toàn.',
        learningObjectives: ['Hiểu mô phỏng chuyển động', 'Nhận biết vai trò cảm biến/tín hiệu', 'Tuân thủ vùng an toàn khi tương tác robot']
      }
    ]
  }
];

export const DEFAULT_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'user-admin',
    name: 'Admin Tong',
    phone: '0900000000',
    role: 'ADMIN',
    permissions: getDefaultPermissionsForRole('ADMIN'),
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-manager',
    name: 'Quan ly',
    phone: '0910000000',
    role: 'MANAGER',
    permissions: getDefaultPermissionsForRole('MANAGER'),
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export const MOCK_LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'lt-operations',
    title: 'Vận hành sự kiện',
    description: 'Checklist xuất nhập, vận hành an toàn, xử lý sự cố tại điểm.',
    focus: 'OPERATIONS',
    level: 'BASE',
    badge: 'Ops Rookie',
    requirements: { minTenureMonths: 1, minEvents: 2, minScore: 6 },
    lessons: [
      {
        id: 'ops-01',
        title: 'Checklist xuất / nhập kho & bàn giao',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/2LhoCfjm8R4',
        duration: '12:45',
        summary: 'Chuẩn hóa điểm danh thiết bị, ký biên bản và log thiếu đủ trước giờ chạy.',
        skills: ['Checklist', 'Giao nhận', 'An toàn'],
        questions: [
          {
            id: 'ops-01-q1',
            prompt: 'Ai bắt buộc phải ký biên bản bàn giao thiết bị?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Một người bất kỳ trong đội onsite',
              'Đại diện kho và Team Lead onsite ký đối ứng',
              'Khách hàng ký thay'
            ],
            correctOption: 1,
            answerGuide: 'Luôn cần 2 chữ ký đối ứng (kho + team lead) để có cơ sở đối soát.',
            maxScore: 10
          },
          {
            id: 'ops-01-q2',
            prompt: 'Ảnh chụp niêm phong và tình trạng thiết bị được chụp vào thời điểm nào?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Khi đã chất lên xe nhưng trước khi rời kho',
              'Sau khi thiết bị đã giao cho khách và setup xong',
              'Chỉ cần chụp khi có hư hỏng'
            ],
            correctOption: 0,
            answerGuide: 'Chụp tại kho ngay lúc bàn giao để có bằng chứng ban đầu.',
            maxScore: 10
          },
          {
            id: 'ops-01-q3',
            prompt: 'Thiếu 2 micro cầm tay ngay trước giờ chạy, bạn xử lý thế nào để sự kiện không bị trễ?',
            type: 'OPEN',
            answerGuide: 'Báo kho/điều phối để bổ sung nhanh, log thiếu trên checklist, đề xuất mượn/bù thiết bị tại chỗ hoặc thuê ngoài, báo team lead & khách để đồng thuận.',
            answerKeywords: ['bổ sung', 'log thiếu', 'mượn', 'thuê', 'báo kho', 'bù'],
            maxScore: 10
          }
        ]
      },
      {
        id: 'ops-02',
        title: 'Xử lý sự cố điện & âm thanh',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/jmTRyZ2K2O0',
        duration: '09:12',
        summary: 'Nhận diện rủi ro điện, bố trí nguồn, chống hú micro và phương án dự phòng.',
        skills: ['An toàn điện', 'Âm thanh', 'Ứng phó sự cố'],
        questions: [
          {
            id: 'ops-02-q1',
            prompt: 'Điện tổng sụt khi đang chạy chương trình, bước xử lý đầu tiên là gì?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Bật lại tất cả thiết bị ngay để kịp timeline',
              'Ngắt tải, báo khách/điều phối, kiểm tra nguồn và chia tải lại',
              'Chờ kỹ thuật tòa nhà tự xử lý'
            ],
            correctOption: 1,
            answerGuide: 'Ưu tiên an toàn: ngắt tải, báo cáo, chia tải/đổi nguồn trước khi bật lại.',
            maxScore: 10
          },
          {
            id: 'ops-02-q2',
            prompt: 'Âm thanh bị hú liên tục, bạn sẽ làm gì để dừng ngay và tránh tái diễn?',
            type: 'OPEN',
            answerGuide: 'Mute micro, kiểm tra khoảng cách micro - loa, hạ gain/EQ, bật chống hú, xoay hướng loa, phân vai micro.',
            answerKeywords: ['mute', 'gain', 'eq', 'khoảng cách', 'loa', 'micro', 'chống hú'],
            maxScore: 10
          }
        ]
      }
    ]
  },
  {
    id: 'lt-content',
    title: 'Nội dung & kịch bản',
    description: 'Chuẩn bị nội dung, timeline MC, vật phẩm truyền thông.',
    focus: 'CONTENT',
    level: 'BASE',
    badge: 'Content Mate',
    requirements: { minTenureMonths: 1, minScore: 6 },
    lessons: [
      {
        id: 'ct-01',
        title: 'Viết kịch bản chạy chương trình',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/SfX6pHYU-44',
        duration: '08:30',
        summary: 'Kết cấu timeline, MC cue, điểm check âm thanh/ánh sáng.',
        skills: ['Timeline', 'MC cue', 'Phối hợp sân khấu'],
        questions: [
          {
            id: 'ct-01-q1',
            prompt: 'Cue nào cần báo sớm nhất cho kỹ thuật âm thanh?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Lời chào mở màn',
              'Các đoạn cần nhạc nền / effect đặc biệt',
              'Phần cảm ơn cuối chương trình'
            ],
            correctOption: 1,
            answerGuide: 'Các đoạn có effect/nhạc nền cần chuẩn bị trước để tránh hụt cue.',
            maxScore: 10
          },
          {
            id: 'ct-01-q2',
            prompt: 'Nêu 3 ý chính để MC không lệch timeline khi khách hàng phát biểu dài.',
            type: 'OPEN',
            answerGuide: 'Chèn cue nhắc thời lượng, thống nhất hand signal, có phương án rút gọn tiết mục sau đó.',
            answerKeywords: ['cue', 'thời lượng', 'hand signal', 'rút gọn', 'timeline'],
            maxScore: 10
          }
        ]
      },
      {
        id: 'ct-02',
        title: 'Quản lý tài sản nội dung',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/9oKl5OlpGWY',
        duration: '07:05',
        summary: 'Logo, file trình chiếu, video và guideline thương hiệu.',
        skills: ['Brand guideline', 'File control', 'Checklist nội dung'],
        questions: [
          {
            id: 'ct-02-q1',
            prompt: 'Khi nhận file trình chiếu mới 10 phút trước giờ chạy, ưu tiên nào đúng?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Chép đè ngay lên máy chạy',
              'Kiểm tra font/format, mở thử, backup bản cũ trước khi thay',
              'Hẹn khách gửi lại sau chương trình'
            ],
            correctOption: 1,
            answerGuide: 'Luôn kiểm tra nhanh lỗi font/video và backup để rollback nếu sự cố.',
            maxScore: 10
          }
        ]
      }
    ]
  },
  {
    id: 'lt-sales',
    title: 'Bán hàng & CSKH',
    description: 'Tư vấn gói, tính giá, ghi nhận đơn và chăm sóc sau bán.',
    focus: 'SALES',
    level: 'ADVANCED',
    badge: 'Sales Booster',
    requirements: { minTenureMonths: 2, minEvents: 1, minScore: 7, minScenarioScore: 7 },
    lessons: [
      {
        id: 'sales-01',
        title: 'Tư vấn gói thiết bị & upsell',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/wbp4w5Q1nqU',
        duration: '10:15',
        summary: 'Khung hỏi nhu cầu, đề xuất gói chuẩn và upsell hợp lý.',
        skills: ['Sales script', 'Upsell', 'Chốt đơn'],
        questions: [
          {
            id: 'sales-01-q1',
            prompt: 'Câu hỏi mở đầu nào giúp hiểu rõ quy mô chương trình?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Anh/chị đã có ngân sách chưa?',
              'Anh/chị có bao nhiêu khách và diễn ra ở đâu/ngoài trời hay trong nhà?',
              'Anh/chị muốn dùng gói nào?'
            ],
            correctOption: 1,
            answerGuide: 'Hỏi quy mô, địa điểm để chọn cấu hình âm thanh/ánh sáng phù hợp.',
            maxScore: 10
          },
          {
            id: 'sales-01-q2',
            prompt: 'Nếu khách chỉ hỏi giá thấp nhất, bạn phản hồi thế nào để giữ biên lợi nhuận?',
            type: 'OPEN',
            answerGuide: 'Chốt giá dựa trên nhu cầu tối thiểu, nhấn mạnh rủi ro khi cắt giảm, đề xuất gói chuẩn và upsell giá trị cao (backup, bảo hành nhanh, trực kỹ thuật).',
            answerKeywords: ['nhu cầu tối thiểu', 'rủi ro', 'upsell', 'backup', 'bảo hành', 'trực kỹ thuật'],
            maxScore: 10
          }
        ]
      },
      {
        id: 'sales-02',
        title: 'Ghi nhận đơn & chăm sóc sau bán',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/7T7r_oSp0SE',
        duration: '06:40',
        summary: 'Checklist hợp đồng, thu cọc, cập nhật trạng thái và chăm sóc sau sự kiện.',
        skills: ['Hợp đồng', 'Thu tiền', 'CSKH'],
        questions: [
          {
            id: 'sales-02-q1',
            prompt: 'Bước nào bắt buộc trước khi chốt lịch sự kiện trên hệ thống?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Đã thu đủ 100% giá trị đơn',
              'Đã có báo giá được khách xác nhận + thông tin người phụ trách onsite',
              'Chỉ cần tên sự kiện và ngày diễn ra'
            ],
            correctOption: 1,
            answerGuide: 'Cần báo giá xác nhận và thông tin người phụ trách để đội vận hành phối hợp.',
            maxScore: 10
          }
        ]
      }
    ]
  },
  {
    id: 'lt-logistics',
    title: 'Hậu cần & điều phối',
    description: 'Lập lộ trình, đóng gói, quản lý xe và an toàn vận chuyển.',
    focus: 'LOGISTICS',
    level: 'ADVANCED',
    badge: 'Ops Logistician',
    requirements: { minEvents: 3, mandatoryRoles: ['Hậu cần', 'Điều phối xe'] },
    lessons: [
      {
        id: 'log-01',
        title: 'Đóng gói & lộ trình giao nhận',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/8QJ3I7gYV7c',
        duration: '11:02',
        summary: 'Phân loại thùng, chằng buộc, chọn lộ trình và buffer thời gian.',
        skills: ['Đóng gói', 'Điều phối', 'An toàn vận chuyển'],
        questions: [
          {
            id: 'log-01-q1',
            prompt: 'Buffer thời gian tối thiểu cho chặng giao nội thành giờ cao điểm?',
            type: 'MULTIPLE_CHOICE',
            options: ['15 phút', '30 - 45 phút', 'Không cần buffer'],
            correctOption: 1,
            answerGuide: 'Luôn dự trù 30-45 phút và có phương án tuyến đường thay thế.',
            maxScore: 10
          },
          {
            id: 'log-01-q2',
            prompt: 'Nếu xe đến điểm giao nhưng chưa có người nhận, bạn xử lý thế nào?',
            type: 'OPEN',
            answerGuide: 'Gọi người nhận, chụp hiện trường, khóa thùng/niêm phong, chờ tối đa thời gian đã thống nhất, báo điều phối để đổi slot hoặc gửi kho gần nhất.',
            answerKeywords: ['gọi người nhận', 'chụp hiện trường', 'niêm phong', 'báo điều phối', 'đổi slot'],
            maxScore: 10
          }
        ]
      }
    ]
  },
  {
    id: 'lt-leader',
    title: 'Team Lead & Leader',
    description: 'Huấn luyện đội nhóm, phân ca, KPI và phản hồi sau sự kiện.',
    focus: 'LEADERSHIP',
    level: 'MASTER',
    badge: 'Ops Captain',
    requirements: { minTenureMonths: 6, minEvents: 8, minScore: 8, minScenarioScore: 8, mandatoryRoles: ['Team Lead', 'Giám sát vận hành'] },
    lessons: [
      {
        id: 'lead-01',
        title: 'Huấn luyện và kèm cặp tại chỗ',
        mediaType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/eN8nDVGfdZM',
        duration: '09:55',
        summary: 'Checklist kèm cặp, chia ca và đánh giá sau sự kiện.',
        skills: ['Coaching', 'Phân ca', 'Đánh giá'],
        questions: [
          {
            id: 'lead-01-q1',
            prompt: 'Chỉ số quan trọng nhất để biết thành viên mới sẵn sàng tự chạy job?',
            type: 'MULTIPLE_CHOICE',
            options: [
              'Thuộc tên tất cả thiết bị',
              'Hoàn thành checklist không lỗi trong 2 job liên tiếp và tự xử lý tình huống đơn giản',
              'Chỉ cần đi đủ 3 job'
            ],
            correctOption: 1,
            answerGuide: 'Thành viên phải chứng minh được khả năng vận hành ổn định và xử lý tình huống cơ bản.',
            maxScore: 10
          },
          {
            id: 'lead-01-q2',
            prompt: 'Nêu khung phản hồi sau sự kiện để cả đội cùng nâng cấp.',
            type: 'OPEN',
            answerGuide: 'Điểm tốt/điểm lỗi, 3 hành động sửa, người chịu trách nhiệm & thời hạn, cập nhật tài liệu/kịch bản nếu cần.',
            answerKeywords: ['điểm lỗi', 'hành động sửa', 'trách nhiệm', 'thời hạn', 'cập nhật tài liệu'],
            maxScore: 10
          }
        ]
      }
    ]
  }
];

export const MOCK_LEARNING_PROFILES: LearningProfile[] = [];

export const MOCK_CAREER_RANKS: CareerRank[] = [
  {
    id: 'rank-1',
    name: 'Cộng tác viên',
    minTenureMonths: 0,
    minEvents: 0,
    minAvgScore: 0,
    benefits: ['Học thử các khóa cơ bản', 'Tham gia hỗ trợ sự kiện nhỏ']
  },
  {
    id: 'rank-2',
    name: 'Triển khai viên',
    minTenureMonths: 1,
    minEvents: 2,
    minAvgScore: 6,
    mandatoryRoles: ['Nhân viên vận hành'],
    benefits: ['Phụ cấp ca tiêu chuẩn', 'Thưởng hoàn thành checklist đúng giờ']
  },
  {
    id: 'rank-3',
    name: 'Chuyên viên vận hành',
    minTenureMonths: 3,
    minEvents: 5,
    minAvgScore: 7,
    mandatoryRoles: ['Hậu cần', 'Nhân viên vận hành'],
    benefits: ['Phụ cấp trách nhiệm', 'Ưu tiên phân ca sự kiện lớn']
  },
  {
    id: 'rank-4',
    name: 'Team Lead Onsite',
    minTenureMonths: 6,
    minEvents: 8,
    minAvgScore: 8,
    mandatoryRoles: ['Team Lead'],
    benefits: ['Thưởng theo KPI đội', 'Phụ cấp quản lý và coaching']
  },
  {
    id: 'rank-5',
    name: 'Quản lý vận hành',
    minTenureMonths: 12,
    minEvents: 12,
    minAvgScore: 8.5,
    mandatoryRoles: ['Team Lead', 'Giám sát vận hành'],
    benefits: ['Thưởng quý theo hiệu suất', 'Ngân sách đào tạo & lương thưởng theo bậc']
  }
];
