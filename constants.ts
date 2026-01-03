
import { InventoryItem, Event, Transaction, EventStatus, TransactionType, ComboPackage, Employee, LearningTrack, LearningProfile, CareerRank, UserAccount } from './types';
import { getDefaultPermissionsForRole } from './services/accessControl';

export const MOCK_INVENTORY: InventoryItem[] = [];
export const MOCK_PACKAGES: ComboPackage[] = [];
export const MOCK_EMPLOYEES: Employee[] = [];
export const MOCK_EVENTS: Event[] = [];
export const MOCK_TRANSACTIONS: Transaction[] = [];

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
        videoUrl: 'https://www.youtube.com/embed/2LhoCfjm8R4',
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
        videoUrl: 'https://www.youtube.com/embed/jmTRyZ2K2O0',
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
        videoUrl: 'https://www.youtube.com/embed/SfX6pHYU-44',
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
        videoUrl: 'https://www.youtube.com/embed/9oKl5OlpGWY',
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
        videoUrl: 'https://www.youtube.com/embed/wbp4w5Q1nqU',
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
        videoUrl: 'https://www.youtube.com/embed/7T7r_oSp0SE',
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
        videoUrl: 'https://www.youtube.com/embed/8QJ3I7gYV7c',
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
        videoUrl: 'https://www.youtube.com/embed/eN8nDVGfdZM',
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

export const MOCK_LEARNING_PROFILES: LearningProfile[] = [
  {
    id: 'learner-ops',
    name: 'Nguyễn Văn An',
    employeeId: 'EMP-OPS',
    tenureMonths: 8,
    eventsAttended: 14,
    scenarioScore: 8.5,
    roleHistory: ['Nhân viên vận hành', 'Team Lead'],
    badges: ['Ops Rookie', 'Safety First'],
    currentRank: 'Team Lead Onsite',
    completedLessons: ['ops-01', 'ct-01'],
    preferredTracks: ['OPERATIONS', 'LEADERSHIP']
  },
  {
    id: 'learner-content',
    name: 'Trần Thu Hà',
    employeeId: 'EMP-CONTENT',
    tenureMonths: 4,
    eventsAttended: 7,
    scenarioScore: 7.2,
    roleHistory: ['Nội dung', 'Hậu cần'],
    badges: ['Content Mate'],
    currentRank: 'Chuyên viên vận hành',
    completedLessons: ['ct-01'],
    preferredTracks: ['CONTENT', 'OPERATIONS']
  },
  {
    id: 'learner-sales',
    name: 'Lê Minh Khoa',
    employeeId: 'EMP-SALES',
    tenureMonths: 2,
    eventsAttended: 3,
    scenarioScore: 6.5,
    roleHistory: ['Bán hàng', 'Nhân viên vận hành'],
    badges: ['Sales Rookie'],
    currentRank: 'Triển khai viên',
    preferredTracks: ['SALES']
  }
];

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
