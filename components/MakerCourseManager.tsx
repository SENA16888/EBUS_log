import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileDown,
  GraduationCap,
  ImagePlus,
  LayoutDashboard,
  Moon,
  Plus,
  Printer,
  Save,
  Search,
  Sun,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import {
  MakerAcademicYear,
  MakerAnnouncement,
  MakerAttendanceRecord,
  MakerAttendanceStatus,
  MakerCertificate,
  MakerClass,
  MakerClassSession,
  MakerEnrollment,
  MakerEnrollmentStatus,
  MakerLeadSource,
  MakerPayment,
  MakerPaymentMethod,
  MakerSaleStage,
  MakerStudent,
  MakerStudentGender,
  MakerStudentProduct,
  MakerStudentTag
} from '../types';

type MakerCourseState = {
  students: MakerStudent[];
  academicYears: MakerAcademicYear[];
  classes: MakerClass[];
  sessions: MakerClassSession[];
  enrollments: MakerEnrollment[];
  attendance: MakerAttendanceRecord[];
  payments: MakerPayment[];
  products: MakerStudentProduct[];
  certificates: MakerCertificate[];
  announcements: MakerAnnouncement[];
};

interface MakerCourseManagerProps extends MakerCourseState {
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdate: (state: MakerCourseState) => void;
}

type ViewKey = 'dashboard' | 'crm' | 'registration' | 'classes' | 'attendance' | 'progress' | 'products' | 'finance' | 'certificates' | 'calendar' | 'sale' | 'reports';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatCurrency = (value: number) => `${Math.max(0, Math.round(value || 0)).toLocaleString('vi-VN')} đ`;
const formatDate = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '-';
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
};
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
const normalizeSearch = (value: string) => value.trim().toLowerCase();

const sourceLabels: Record<MakerLeadSource, string> = {
  FACEBOOK: 'Facebook',
  WEBSITE: 'Website',
  EINSTEIN_BUS: 'Einstein Bus',
  REFERRAL: 'Giới thiệu',
  WALK_IN: 'Walk-in',
  OTHER: 'Khác'
};

const tagLabels: Record<MakerStudentTag, string> = {
  POTENTIAL: 'Tiềm năng',
  CONSULTED: 'Đã tư vấn',
  DEPOSITED: 'Đặt cọc',
  PAID: 'Đã đóng học phí',
  STUDYING: 'Đang học',
  PAUSED: 'Bảo lưu',
  GRADUATED: 'Tốt nghiệp'
};

const stageLabels: Record<MakerSaleStage, string> = {
  NEW: 'Khách mới',
  CONSULTED: 'Đã tư vấn',
  TRIAL_BOOKED: 'Hẹn trải nghiệm',
  DEPOSITED: 'Đặt cọc',
  ENROLLED: 'Đăng ký',
  STUDYING: 'Đang học',
  GRADUATED: 'Tốt nghiệp'
};

const statusLabels: Record<MakerEnrollmentStatus, string> = {
  WAITING_START: 'Chờ khai giảng',
  STUDYING: 'Đang học',
  COMPLETED: 'Hoàn thành',
  PAUSED: 'Bảo lưu',
  DROPPED: 'Nghỉ học'
};

const attendanceLabels: Record<MakerAttendanceStatus, string> = {
  PRESENT: 'Có mặt',
  LATE: 'Muộn',
  EXCUSED_ABSENCE: 'Nghỉ có phép',
  UNEXCUSED_ABSENCE: 'Nghỉ không phép'
};

const paymentLabels: Record<MakerPaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  QR: 'QR'
};

const genderLabels: Record<MakerStudentGender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác'
};

const lessonTopics = [
  'Móc khóa',
  'Calibration Cube',
  'Name Tag',
  'Phone Stand',
  'Mini Robot Shell',
  'Showcase',
  'Tinkercad nâng cao',
  'Cơ cấu chuyển động',
  'Hộp kỹ thuật',
  'Bản lề mini',
  'Logo 3D',
  'Thiết kế hữu dụng',
  'Kỹ thuật support',
  'Lắp ráp mô hình',
  'Sửa lỗi in',
  'Tối ưu vật liệu',
  'Prototype',
  'Master Project'
];

const viewTabs: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'crm', label: 'CRM học viên', icon: Users },
  { key: 'registration', label: 'Đăng ký', icon: UserPlus },
  { key: 'classes', label: 'Niên khóa & lớp', icon: GraduationCap },
  { key: 'attendance', label: 'Điểm danh', icon: CheckCircle2 },
  { key: 'progress', label: 'Tiến độ', icon: BarChart3 },
  { key: 'products', label: 'Sản phẩm', icon: ImagePlus },
  { key: 'finance', label: 'Học phí', icon: CircleDollarSign },
  { key: 'certificates', label: 'Chứng nhận', icon: Award },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'sale', label: 'Sale', icon: Users },
  { key: 'reports', label: 'Báo cáo', icon: BarChart3 }
];

const getAge = (birthDate: string) => {
  if (!birthDate) return 0;
  const birth = parseDate(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
};

const getWeekdayLabel = (days: number[]) => days.map(day => ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][day] || '').join(' + ');

const generateStudentCode = (students: MakerStudent[]) => {
  const year = new Date().getFullYear();
  const next = students.length + 1;
  return `3DM-${year}-${String(next).padStart(3, '0')}`;
};

const getPaidAmount = (payments: MakerPayment[], enrollmentId: string) =>
  payments.filter(payment => payment.enrollmentId === enrollmentId).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

const getProgress = (
  enrollment: MakerEnrollment,
  sessions: MakerClassSession[],
  attendance: MakerAttendanceRecord[]
) => {
  const classSessions = sessions.filter(session => session.classId === enrollment.classId);
  const attended = attendance.filter(record =>
    record.enrollmentId === enrollment.id && (record.status === 'PRESENT' || record.status === 'LATE')
  ).length;
  return {
    attended,
    total: Math.max(18, classSessions.length || 18),
    courseTotal: classSessions.length || 6
  };
};

const buildSessionsForClass = (klass: MakerClass, lessonsPerCourse = 6): MakerClassSession[] => {
  const sessions: MakerClassSession[] = [];
  const cursor = parseDate(klass.startDate);
  let guard = 0;

  while (sessions.length < lessonsPerCourse && guard < 90) {
    if (klass.daysOfWeek.includes(cursor.getDay())) {
      const lessonNumber = sessions.length + 1;
      sessions.push({
        id: makeId(`maker-session-${klass.id}-${lessonNumber}`),
        classId: klass.id,
        courseName: klass.courseName,
        lessonNumber,
        date: toDateKey(cursor),
        startTime: klass.startTime,
        endTime: klass.endTime,
        topic: lessonTopics[lessonNumber - 1] || `Buổi ${lessonNumber}`
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return sessions;
};

const printHtml = (title: string, body: string) => {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:32px;color:#0f172a}
          h1,h2{margin:0 0 8px}
          .muted{color:#64748b}
          .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
          .item{border:1px solid #e2e8f0;padding:12px;border-radius:8px;margin:10px 0}
          img{max-width:100%;border-radius:8px}
          .certificate{border:8px solid #2563eb;padding:42px;text-align:center;min-height:620px}
        </style>
      </head>
      <body>${body}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
};

export const MakerCourseManager: React.FC<MakerCourseManagerProps> = ({
  students,
  academicYears,
  classes,
  sessions,
  enrollments,
  attendance,
  payments,
  products,
  certificates,
  announcements,
  canEdit = true,
  canDelete = true,
  onUpdate
}) => {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [query, setQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');
  const [darkMode, setDarkMode] = useState(false);
  const [studentForm, setStudentForm] = useState<MakerStudent | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState<Partial<MakerEnrollment> | null>(null);
  const [classForm, setClassForm] = useState<Partial<MakerClass> | null>(null);
  const [paymentForm, setPaymentForm] = useState<Partial<MakerPayment> | null>(null);
  const [productForm, setProductForm] = useState<Partial<MakerStudentProduct> | null>(null);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  const state = { students, academicYears, classes, sessions, enrollments, attendance, payments, products, certificates, announcements };
  const selectedStudent = students.find(student => student.id === selectedStudentId) || students[0] || null;
  const selectedClass = classes.find(klass => klass.id === selectedClassId) || classes[0] || null;
  const selectedSession = sessions.find(session => session.id === selectedSessionId) || sessions.find(session => session.classId === selectedClass?.id) || sessions[0] || null;

  const stats = useMemo(() => {
    const month = todayKey().slice(0, 7);
    const activeEnrollments = enrollments.filter(item => item.status === 'STUDYING');
    const graduatedStudents = students.filter(student => student.tags.includes('GRADUATED') || student.saleStage === 'GRADUATED');
    const waitingStudents = enrollments.filter(item => item.status === 'WAITING_START').length + students.filter(student => student.saleStage === 'NEW' || student.saleStage === 'TRIAL_BOOKED').length;
    const monthRevenue = payments.filter(payment => payment.paidAt.slice(0, 7) === month).reduce((sum, payment) => sum + payment.amount, 0);
    const totalDebt = enrollments.reduce((sum, enrollment) => sum + Math.max(0, enrollment.tuitionFee - getPaidAmount(payments, enrollment.id)), 0);
    const todaySessions = sessions.filter(session => session.date === todayKey());
    const upcomingClasses = classes.filter(klass => klass.startDate >= todayKey()).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    return {
      totalStudents: students.length,
      activeStudents: new Set(activeEnrollments.map(item => item.studentId)).size,
      graduatedStudents: graduatedStudents.length,
      waitingStudents,
      monthRevenue,
      totalDebt,
      todaySessions,
      upcomingClasses
    };
  }, [students, enrollments, payments, sessions, classes]);

  const filteredStudents = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return students;
    return students.filter(student =>
      normalizeSearch(`${student.code} ${student.fullName} ${student.parentName} ${student.parentPhone}`).includes(normalized)
    );
  }, [students, query]);

  const classEnrollmentCount = (classId: string) => enrollments.filter(enrollment => enrollment.classId === classId && enrollment.status !== 'DROPPED').length;

  const patch = (next: Partial<MakerCourseState>) => onUpdate({ ...state, ...next });

  const openNewStudent = () => {
    if (!canEdit) return;
    setStudentForm({
      id: makeId('maker-student'),
      code: generateStudentCode(students),
      fullName: '',
      birthDate: '2014-01-01',
      gender: 'MALE',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      parentFacebook: '',
      address: '',
      source: 'FACEBOOK',
      saleNote: '',
      tags: ['POTENTIAL'],
      saleStage: 'NEW',
      createdAt: new Date().toISOString()
    });
  };

  const saveStudent = () => {
    if (!studentForm || !canEdit) return;
    if (!studentForm.fullName.trim() || !studentForm.parentPhone.trim()) {
      alert('Vui lòng nhập họ tên học viên và SĐT phụ huynh.');
      return;
    }
    const exists = students.some(student => student.id === studentForm.id);
    const nextStudent = { ...studentForm, updatedAt: new Date().toISOString() };
    patch({ students: exists ? students.map(student => student.id === nextStudent.id ? nextStudent : student) : [nextStudent, ...students] });
    setSelectedStudentId(nextStudent.id);
    setStudentForm(null);
  };

  const deleteStudent = (studentId: string) => {
    if (!canDelete) return;
    patch({
      students: students.filter(student => student.id !== studentId),
      enrollments: enrollments.filter(enrollment => enrollment.studentId !== studentId),
      attendance: attendance.filter(record => record.studentId !== studentId),
      payments: payments.filter(payment => payment.studentId !== studentId),
      products: products.filter(product => product.studentId !== studentId),
      certificates: certificates.filter(certificate => certificate.studentId !== studentId)
    });
  };

  const saveEnrollment = () => {
    if (!enrollmentForm || !canEdit) return;
    const klass = classes.find(item => item.id === enrollmentForm.classId);
    const year = academicYears.find(item => item.id === enrollmentForm.academicYearId) || academicYears[0];
    if (!enrollmentForm.studentId || !klass || !year) {
      alert('Vui lòng chọn học viên, niên khóa và lớp.');
      return;
    }
    const enrollment: MakerEnrollment = {
      id: enrollmentForm.id || makeId('maker-enroll'),
      studentId: enrollmentForm.studentId,
      academicYearId: year.id,
      courseName: enrollmentForm.courseName || klass.courseName,
      classId: klass.id,
      slotName: klass.slotName,
      startDate: klass.startDate,
      endDate: klass.endDate,
      status: enrollmentForm.status || 'WAITING_START',
      tuitionFee: Number(enrollmentForm.tuitionFee) || 3000000,
      createdAt: enrollmentForm.createdAt || new Date().toISOString()
    };
    const exists = enrollments.some(item => item.id === enrollment.id);
    patch({ enrollments: exists ? enrollments.map(item => item.id === enrollment.id ? enrollment : item) : [enrollment, ...enrollments] });
    setEnrollmentForm(null);
  };

  const saveClass = () => {
    if (!classForm || !canEdit) return;
    if (!classForm.name || !classForm.academicYearId || !classForm.startDate) {
      alert('Vui lòng nhập tên lớp, niên khóa và ngày khai giảng.');
      return;
    }
    const klass: MakerClass = {
      id: classForm.id || makeId('maker-class'),
      academicYearId: classForm.academicYearId,
      courseName: classForm.courseName || 'Khóa 1',
      name: classForm.name,
      daysOfWeek: classForm.daysOfWeek || [1, 3],
      slotName: classForm.slotName || 'Slot 1',
      startTime: classForm.startTime || '17:00',
      endTime: classForm.endTime || '19:00',
      teacherName: classForm.teacherName || 'Phạm Trần Nhân',
      maxStudents: Number(classForm.maxStudents) || 6,
      color: classForm.color || '#2563eb',
      startDate: classForm.startDate,
      endDate: classForm.endDate || classForm.startDate
    };
    const year = academicYears.find(item => item.id === klass.academicYearId);
    const generatedSessions = buildSessionsForClass(klass, year?.lessonsPerCourse || 6);
    const finalClass = { ...klass, endDate: generatedSessions[generatedSessions.length - 1]?.date || klass.endDate };
    const exists = classes.some(item => item.id === finalClass.id);
    patch({
      classes: exists ? classes.map(item => item.id === finalClass.id ? finalClass : item) : [finalClass, ...classes],
      sessions: [...sessions.filter(session => session.classId !== finalClass.id), ...generatedSessions].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    });
    setSelectedClassId(finalClass.id);
    setSelectedSessionId(generatedSessions[0]?.id || selectedSessionId);
    setClassForm(null);
  };

  const setAttendance = (enrollment: MakerEnrollment, status: MakerAttendanceStatus) => {
    if (!selectedSession || !canEdit) return;
    const existing = attendance.find(record => record.sessionId === selectedSession.id && record.enrollmentId === enrollment.id);
    const nextRecord: MakerAttendanceRecord = {
      id: existing?.id || makeId('maker-att'),
      sessionId: selectedSession.id,
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      status,
      note: existing?.note || '',
      makeupRequired: status === 'EXCUSED_ABSENCE' || status === 'UNEXCUSED_ABSENCE',
      makeupSessionId: existing?.makeupSessionId,
      checkedAt: new Date().toISOString()
    };
    patch({ attendance: existing ? attendance.map(record => record.id === existing.id ? nextRecord : record) : [nextRecord, ...attendance] });
  };

  const updateAttendanceNote = (recordId: string, note: string) => {
    if (!canEdit) return;
    patch({ attendance: attendance.map(record => record.id === recordId ? { ...record, note } : record) });
  };

  const savePayment = () => {
    if (!paymentForm || !canEdit) return;
    const enrollment = enrollments.find(item => item.id === paymentForm.enrollmentId);
    if (!enrollment || !paymentForm.amount) {
      alert('Vui lòng chọn đăng ký và nhập số tiền.');
      return;
    }
    const payment: MakerPayment = {
      id: paymentForm.id || makeId('maker-pay'),
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      amount: Number(paymentForm.amount) || 0,
      paidAt: paymentForm.paidAt || todayKey(),
      method: paymentForm.method || 'BANK_TRANSFER',
      note: paymentForm.note || ''
    };
    patch({ payments: [payment, ...payments] });
    setPaymentForm(null);
  };

  const saveProduct = () => {
    if (!productForm || !canEdit) return;
    const enrollment = enrollments.find(item => item.id === productForm.enrollmentId);
    const session = sessions.find(item => item.id === productForm.sessionId);
    if (!enrollment || !session || !productForm.title || !productForm.imageUrl) {
      alert('Vui lòng chọn học viên, buổi học, tên sản phẩm và URL ảnh.');
      return;
    }
    const product: MakerStudentProduct = {
      id: productForm.id || makeId('maker-product'),
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      sessionId: session.id,
      title: productForm.title,
      imageUrl: productForm.imageUrl,
      note: productForm.note || '',
      uploadedAt: new Date().toISOString()
    };
    patch({ products: [product, ...products] });
    setProductForm(null);
  };

  const createCertificate = (enrollment: MakerEnrollment) => {
    if (!canEdit) return;
    const student = students.find(item => item.id === enrollment.studentId);
    const klass = classes.find(item => item.id === enrollment.classId);
    if (!student || !klass) return;
    const existing = certificates.find(item => item.enrollmentId === enrollment.id);
    if (existing) return;
    const certificate: MakerCertificate = {
      id: makeId('maker-cert'),
      studentId: student.id,
      enrollmentId: enrollment.id,
      certificateNo: `EH-3DM-${new Date().getFullYear()}-${String(certificates.length + 1).padStart(4, '0')}`,
      issuedAt: todayKey(),
      teacherName: klass.teacherName,
      verifyUrl: `https://einsteinhouse.vn/verify/${student.code}`
    };
    patch({
      certificates: [certificate, ...certificates],
      enrollments: enrollments.map(item => item.id === enrollment.id ? { ...item, status: 'COMPLETED' } : item),
      students: students.map(item => item.id === student.id ? { ...item, saleStage: 'GRADUATED', tags: Array.from(new Set([...item.tags, 'GRADUATED'])) } : item)
    });
  };

  const updateStudentStage = (studentId: string, stage: MakerSaleStage) => {
    if (!canEdit) return;
    const stageTagMap: Partial<Record<MakerSaleStage, MakerStudentTag>> = {
      CONSULTED: 'CONSULTED',
      DEPOSITED: 'DEPOSITED',
      STUDYING: 'STUDYING',
      GRADUATED: 'GRADUATED'
    };
    patch({
      students: students.map(student => {
        if (student.id !== studentId) return student;
        const tag = stageTagMap[stage];
        return {
          ...student,
          saleStage: stage,
          tags: tag ? Array.from(new Set([...student.tags, tag])) : student.tags,
          updatedAt: new Date().toISOString()
        };
      })
    });
  };

  const printPortfolio = (student: MakerStudent) => {
    const studentProducts = products.filter(product => product.studentId === student.id);
    const productHtml = studentProducts.map(product => `
      <div class="item">
        <h3>${product.title}</h3>
        <p class="muted">${product.note || ''}</p>
        <img src="${product.imageUrl}" />
      </div>
    `).join('');
    printHtml(`Portfolio ${student.fullName}`, `
      <h1>3D Maker Portfolio</h1>
      <h2>${student.fullName}</h2>
      <p class="muted">${student.code} - Einstein House</p>
      ${productHtml || '<p>Chưa có sản phẩm.</p>'}
    `);
  };

  const printCertificate = (certificate: MakerCertificate) => {
    const student = students.find(item => item.id === certificate.studentId);
    if (!student) return;
    printHtml(`Certificate ${student.fullName}`, `
      <div class="certificate">
        <h1>EINSTEIN HOUSE</h1>
        <p class="muted">Certificate of Completion</p>
        <h2>3D Maker Student Management System</h2>
        <p>Chứng nhận học viên</p>
        <h1>${student.fullName}</h1>
        <p>đã hoàn thành chương trình 3D Maker.</p>
        <p>Ngày cấp: ${formatDate(certificate.issuedAt)}</p>
        <p>Giảng viên: ${certificate.teacherName}</p>
        <p class="muted">Mã chứng nhận: ${certificate.certificateNo}</p>
        <p class="muted">Verify: ${certificate.verifyUrl}</p>
      </div>
    `);
  };

  const themeClass = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const panelClass = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const subtleClass = darkMode ? 'text-slate-400' : 'text-slate-500';

  const kpiCards = [
    { title: 'Tổng học viên', value: stats.totalStudents.toString(), sub: 'CRM 3D Maker', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { title: 'Đang học', value: stats.activeStudents.toString(), sub: 'Đăng ký active', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { title: 'Tốt nghiệp', value: stats.graduatedStudents.toString(), sub: 'Đủ điều kiện chứng nhận', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
    { title: 'Chờ xếp lớp', value: stats.waitingStudents.toString(), sub: 'Lead và đăng ký mới', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { title: 'Doanh thu tháng', value: formatCurrency(stats.monthRevenue), sub: 'Học phí đã thu', tone: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
    { title: 'Học phí còn nợ', value: formatCurrency(stats.totalDebt), sub: 'Theo đăng ký', tone: 'bg-rose-50 text-rose-700 border-rose-100' }
  ];

  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map(card => (
          <div key={card.title} className={`rounded-lg border p-4 ${card.tone}`}>
            <p className="text-xs font-black uppercase">{card.title}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs font-semibold opacity-80">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section className={`rounded-lg border p-4 ${panelClass}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-black">Lịch học hôm nay</h3>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{stats.todaySessions.length} buổi</span>
          </div>
          <div className="mt-3 space-y-2">
            {stats.todaySessions.length === 0 && <p className={`text-sm ${subtleClass}`}>Hôm nay chưa có lớp 3D Maker.</p>}
            {stats.todaySessions.map(session => {
              const klass = classes.find(item => item.id === session.classId);
              return (
                <div key={session.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{klass?.name || session.classId}</p>
                    <p className="text-xs text-slate-500">{session.topic} - {session.startTime} đến {session.endTime}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{classEnrollmentCount(session.classId)} học viên</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`rounded-lg border p-4 ${panelClass}`}>
          <h3 className="font-black">Thông báo nội bộ</h3>
          <div className="mt-3 space-y-2">
            {announcements.map(item => (
              <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <h3 className="font-black">Các lớp sắp khai giảng</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stats.upcomingClasses.map(klass => {
            const count = classEnrollmentCount(klass.id);
            const full = count >= klass.maxStudents;
            return (
              <div key={klass.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-900">{klass.name}</p>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${full ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{full ? 'Đã đầy' : 'Còn chỗ'}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatDate(klass.startDate)} - {getWeekdayLabel(klass.daysOfWeek)}</p>
                <p className="mt-2 text-sm font-bold text-slate-700">{count}/{klass.maxStudents} ghế đã đăng ký</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderCrm = () => (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className={`rounded-lg border ${panelClass}`}>
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-black">CRM học viên</h3>
            <button onClick={openNewStudent} disabled={!canEdit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Thêm học viên</button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} className="w-full outline-none" placeholder="Tìm theo tên, mã, phụ huynh, SĐT" />
          </div>
        </div>
        <div className="max-h-[620px] overflow-auto p-3">
          {filteredStudents.map(student => (
            <button key={student.id} onClick={() => setSelectedStudentId(student.id)} className={`mb-2 w-full rounded-lg border p-3 text-left transition ${selectedStudent?.id === student.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{student.fullName}</p>
                  <p className="text-xs font-semibold text-slate-500">{student.code} - {getAge(student.birthDate)} tuổi</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-700">{stageLabels[student.saleStage]}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{student.parentName} - {student.parentPhone}</p>
            </button>
          ))}
        </div>
      </section>

      <section className={`rounded-lg border p-4 ${panelClass}`}>
        {selectedStudent ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">{selectedStudent.code}</p>
                <h2 className="text-2xl font-black">{selectedStudent.fullName}</h2>
                <p className={`text-sm ${subtleClass}`}>{genderLabels[selectedStudent.gender]} - {formatDate(selectedStudent.birthDate)} - {getAge(selectedStudent.birthDate)} tuổi</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStudentForm(selectedStudent)} disabled={!canEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-50">Sửa</button>
                <button onClick={() => deleteStudent(selectedStudent.id)} disabled={!canDelete} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Phụ huynh" value={selectedStudent.parentName} />
              <Info label="SĐT" value={selectedStudent.parentPhone} />
              <Info label="Email" value={selectedStudent.parentEmail || '-'} />
              <Info label="Facebook" value={selectedStudent.parentFacebook || '-'} />
              <Info label="Địa chỉ" value={selectedStudent.address || '-'} />
              <Info label="Nguồn khách" value={sourceLabels[selectedStudent.source]} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-500">Tag</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedStudent.tags.map(tag => <span key={tag} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">{tagLabels[tag]}</span>)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-500">Ghi chú Sale</p>
              <p className="mt-1 text-sm text-slate-700">{selectedStudent.saleNote || 'Chưa có ghi chú.'}</p>
            </div>
          </div>
        ) : <p className={subtleClass}>Chưa có học viên.</p>}
      </section>
    </div>
  );

  const renderRegistration = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-black">Đăng ký khóa học</h3>
        <button onClick={() => setEnrollmentForm({ studentId: selectedStudent?.id, academicYearId: academicYears[0]?.id, classId: classes[0]?.id, tuitionFee: 3000000, status: 'WAITING_START' })} disabled={!canEdit || students.length === 0 || classes.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Tạo đăng ký</button>
      </div>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Học viên</th>
              <th className="p-3">Niên khóa</th>
              <th className="p-3">Khóa</th>
              <th className="p-3">Lớp</th>
              <th className="p-3">Slot</th>
              <th className="p-3">Thời gian</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Học phí</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map(enrollment => {
              const student = students.find(item => item.id === enrollment.studentId);
              const klass = classes.find(item => item.id === enrollment.classId);
              const year = academicYears.find(item => item.id === enrollment.academicYearId);
              return (
                <tr key={enrollment.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{student?.fullName || enrollment.studentId}</td>
                  <td className="p-3">{year?.name || '-'}</td>
                  <td className="p-3">{enrollment.courseName}</td>
                  <td className="p-3">{klass?.name || '-'}</td>
                  <td className="p-3">{enrollment.slotName} - {klass?.startTime} đến {klass?.endTime}</td>
                  <td className="p-3">{formatDate(enrollment.startDate)} - {formatDate(enrollment.endDate)}</td>
                  <td className="p-3">
                    <select disabled={!canEdit} value={enrollment.status} onChange={event => patch({ enrollments: enrollments.map(item => item.id === enrollment.id ? { ...item, status: event.target.value as MakerEnrollmentStatus } : item) })} className="rounded-lg border border-slate-200 px-2 py-1">
                      {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </td>
                  <td className="p-3 font-bold">{formatCurrency(enrollment.tuitionFee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderClasses = () => (
    <div className="space-y-4">
      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black">Niên khóa</h3>
            <p className={`text-sm ${subtleClass}`}>Mặc định chương trình 3 khóa, mỗi khóa 6 buổi, tổng 18 buổi.</p>
          </div>
          <button onClick={() => setClassForm({ academicYearId: academicYears[0]?.id, courseName: 'Khóa 1', name: 'Einstein - K1 - A', daysOfWeek: [1, 3], slotName: 'Slot 1', startTime: '17:00', endTime: '19:00', teacherName: 'Phạm Trần Nhân', maxStudents: 6, color: '#2563eb', startDate: todayKey() })} disabled={!canEdit || academicYears.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Thêm lớp</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {academicYears.map(year => (
            <div key={year.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Niên khóa {year.name}</p>
              <p className="mt-2 text-sm text-slate-600">Khai giảng {formatDate(year.startDate)} - Kết thúc {formatDate(year.endDate)}</p>
              <p className="mt-2 font-black text-slate-900">{year.courseCount} khóa - {year.lessonsPerCourse} buổi/khóa - {year.totalLessons} buổi</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <h3 className="font-black">Quản lý lớp</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {classes.map(klass => {
            const count = classEnrollmentCount(klass.id);
            const full = count >= klass.maxStudents;
            return (
              <button key={klass.id} onClick={() => { setSelectedClassId(klass.id); setSelectedSessionId(sessions.find(session => session.classId === klass.id)?.id || selectedSessionId); }} className={`rounded-lg border p-4 text-left transition ${selectedClassId === klass.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: klass.color }} />
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${full ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{full ? 'Đã đầy' : 'Còn chỗ'}</span>
                </div>
                <p className="mt-3 font-black text-slate-900">{klass.name}</p>
                <p className="mt-1 text-xs text-slate-500">{getWeekdayLabel(klass.daysOfWeek)} - {klass.slotName} - {klass.startTime} đến {klass.endTime}</p>
                <p className="mt-2 text-sm font-bold text-slate-700">{count}/{klass.maxStudents} ghế đã đăng ký</p>
                <p className="mt-1 text-xs text-slate-500">GV: {klass.teacherName}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <h3 className="font-black">Lịch tự sinh - {selectedClass?.name || 'Chưa chọn lớp'}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sessions.filter(session => session.classId === selectedClass?.id).map(session => (
            <div key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="font-black text-slate-900">Buổi {session.lessonNumber}: {session.topic}</p>
              <p className="text-xs text-slate-500">{formatDate(session.date)} - {session.startTime} đến {session.endTime}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderAttendance = () => {
    const sessionEnrollments = selectedSession ? enrollments.filter(item => item.classId === selectedSession.classId) : [];
    return (
      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-black">Điểm danh</h3>
            <p className={`text-sm ${subtleClass}`}>Tick trạng thái theo từng học viên. Học viên nghỉ sẽ tự bật cờ học bù.</p>
          </div>
          <select value={selectedSessionId} onChange={event => setSelectedSessionId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2">
            {sessions.map(session => {
              const klass = classes.find(item => item.id === session.classId);
              return <option key={session.id} value={session.id}>{formatDate(session.date)} - {klass?.name} - Buổi {session.lessonNumber}</option>;
            })}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {sessionEnrollments.map(enrollment => {
            const student = students.find(item => item.id === enrollment.studentId);
            const record = attendance.find(item => item.sessionId === selectedSession?.id && item.enrollmentId === enrollment.id);
            return (
              <div key={enrollment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-black text-slate-900">{student?.fullName || enrollment.studentId}</p>
                    <p className="text-xs text-slate-500">{student?.code} - {student?.parentPhone}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(attendanceLabels).map(([key, label]) => (
                      <button key={key} onClick={() => setAttendance(enrollment, key as MakerAttendanceStatus)} disabled={!canEdit} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${record?.status === key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                {record && (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input value={record.note || ''} onChange={event => updateAttendanceNote(record.id, event.target.value)} disabled={!canEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Ghi chú điểm danh" />
                    {record.makeupRequired && <span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-black text-amber-800">Cần học bù</span>}
                  </div>
                )}
              </div>
            );
          })}
          {sessionEnrollments.length === 0 && <p className={`text-sm ${subtleClass}`}>Lớp này chưa có học viên đăng ký.</p>}
        </div>
      </section>
    );
  };

  const renderProgress = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <h3 className="font-black">Tiến độ học</h3>
      <div className="mt-4 space-y-3">
        {enrollments.map(enrollment => {
          const student = students.find(item => item.id === enrollment.studentId);
          const progress = getProgress(enrollment, sessions, attendance);
          const pct = Math.min(100, Math.round((progress.attended / progress.total) * 100));
          return (
            <div key={enrollment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-900">{student?.fullName || enrollment.studentId}</p>
                  <p className="text-xs text-slate-500">{enrollment.courseName}: {Math.min(progress.attended, progress.courseTotal)}/{progress.courseTotal} - Tổng {progress.attended}/{progress.total}</p>
                </div>
                <span className="text-sm font-black text-blue-700">{pct}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderProducts = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-black">Sản phẩm học viên</h3>
        <button onClick={() => setProductForm({ enrollmentId: enrollments[0]?.id, sessionId: sessions[0]?.id })} disabled={!canEdit || enrollments.length === 0 || sessions.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><ImagePlus size={16} />Upload ảnh</button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {students.map(student => (
            <button key={student.id} onClick={() => setSelectedStudentId(student.id)} className={`w-full rounded-lg border p-3 text-left ${selectedStudent?.id === student.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="font-bold text-slate-900">{student.fullName}</p>
              <p className="text-xs text-slate-500">{products.filter(product => product.studentId === student.id).length} sản phẩm</p>
            </button>
          ))}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-black">Album {selectedStudent?.fullName || ''}</h4>
            {selectedStudent && <button onClick={() => printPortfolio(selectedStudent)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><FileDown size={16} />In Portfolio PDF</button>}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.filter(product => product.studentId === selectedStudent?.id).map(product => {
              const session = sessions.find(item => item.id === product.sessionId);
              return (
                <div key={product.id} className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                  <img src={product.imageUrl} alt={product.title} className="h-44 w-full object-cover" />
                  <div className="p-3">
                    <p className="font-black text-slate-900">{product.title}</p>
                    <p className="text-xs text-slate-500">Buổi {session?.lessonNumber}: {session?.topic}</p>
                    <p className="mt-1 text-xs text-slate-600">{product.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );

  const renderFinance = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-black">Quản lý học phí</h3>
        <button onClick={() => setPaymentForm({ enrollmentId: enrollments[0]?.id, amount: 0, paidAt: todayKey(), method: 'BANK_TRANSFER' })} disabled={!canEdit || enrollments.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Thêm thanh toán</button>
      </div>
      <div className="mt-4 space-y-3">
        {enrollments.map(enrollment => {
          const student = students.find(item => item.id === enrollment.studentId);
          const paid = getPaidAmount(payments, enrollment.id);
          const debt = Math.max(0, enrollment.tuitionFee - paid);
          return (
            <div key={enrollment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Học viên" value={student?.fullName || enrollment.studentId} />
                <Info label="Học phí" value={formatCurrency(enrollment.tuitionFee)} />
                <Info label="Đã đóng" value={formatCurrency(paid)} />
                <Info label="Còn nợ" value={formatCurrency(debt)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {payments.filter(payment => payment.enrollmentId === enrollment.id).map(payment => (
                  <span key={payment.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{formatDate(payment.paidAt)} - {formatCurrency(payment.amount)} - {paymentLabels[payment.method]}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderCertificates = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <h3 className="font-black">Chứng nhận</h3>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {enrollments.map(enrollment => {
          const student = students.find(item => item.id === enrollment.studentId);
          const progress = getProgress(enrollment, sessions, attendance);
          const certificate = certificates.find(item => item.enrollmentId === enrollment.id);
          const canCreate = progress.attended >= 18 || enrollment.status === 'COMPLETED';
          return (
            <div key={enrollment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{student?.fullName || enrollment.studentId}</p>
                  <p className="text-xs text-slate-500">Hoàn thành {progress.attended}/18 buổi</p>
                </div>
                {certificate ? (
                  <button onClick={() => printCertificate(certificate)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><Printer size={16} />In</button>
                ) : (
                  <button onClick={() => createCertificate(enrollment)} disabled={!canEdit || !canCreate} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Tạo chứng nhận</button>
                )}
              </div>
              {certificate && (
                <div className="mt-4 rounded-lg border-4 border-blue-600 bg-white p-6 text-center">
                  <p className="text-xs font-black uppercase text-blue-700">Einstein House</p>
                  <h4 className="mt-2 text-xl font-black text-slate-900">{student?.fullName}</h4>
                  <p className="mt-1 text-sm text-slate-600">Certificate PDF - {certificate.certificateNo}</p>
                  <div className="mt-4 flex justify-center"><QRCodeSVG value={certificate.verifyUrl} size={96} /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderCalendar = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <h3 className="font-black">Calendar 3D Maker</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[...sessions].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)).map(session => {
          const klass = classes.find(item => item.id === session.classId);
          return (
            <div key={session.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: klass?.color || '#2563eb' }} />
                <p className="font-black text-slate-900">{formatDate(session.date)}</p>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-700">{klass?.name} - Buổi {session.lessonNumber}</p>
              <p className="text-xs text-slate-500">{session.startTime} đến {session.endTime} - {classEnrollmentCount(session.classId)} học viên</p>
              <p className="text-xs text-slate-500">GV: {klass?.teacherName}</p>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderSale = () => (
    <section className={`rounded-lg border p-4 ${panelClass}`}>
      <h3 className="font-black">Sale Pipeline</h3>
      <div className="mt-4 grid min-w-[1000px] gap-3 overflow-x-auto xl:grid-cols-7">
        {(Object.keys(stageLabels) as MakerSaleStage[]).map(stage => (
          <div
            key={stage}
            onDragOver={event => event.preventDefault()}
            onDrop={() => {
              if (draggedStudentId && canEdit) updateStudentStage(draggedStudentId, stage);
              setDraggedStudentId(null);
            }}
            className="min-h-[360px] rounded-lg border border-slate-100 bg-slate-50 p-3"
          >
            <p className="font-black text-slate-900">{stageLabels[stage]}</p>
            <div className="mt-3 space-y-2">
              {students.filter(student => student.saleStage === stage).map(student => (
                <div
                  key={student.id}
                  draggable={canEdit}
                  onDragStart={() => setDraggedStudentId(student.id)}
                  onDragEnd={() => setDraggedStudentId(null)}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="font-bold text-slate-900">{student.fullName}</p>
                  <p className="text-xs text-slate-500">{student.parentPhone}</p>
                  <select value={student.saleStage} disabled={!canEdit} onChange={event => updateStudentStage(student.id, event.target.value as MakerSaleStage)} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs">
                    {Object.entries(stageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderReports = () => {
    const revenueByClass = classes.map(klass => {
      const classEnrollments = enrollments.filter(enrollment => enrollment.classId === klass.id);
      const revenue = classEnrollments.reduce((sum, enrollment) => sum + getPaidAmount(payments, enrollment.id), 0);
      return { name: klass.name.replace('Einstein - ', ''), revenue, students: classEnrollments.length };
    });
    const completed = enrollments.filter(enrollment => enrollment.status === 'COMPLETED').length;
    const dropped = enrollments.filter(enrollment => enrollment.status === 'DROPPED').length;
    return (
      <section className={`rounded-lg border p-4 ${panelClass}`}>
        <h3 className="font-black">Báo cáo</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Info label="Số học viên" value={students.length.toString()} />
          <Info label="Tỷ lệ hoàn thành" value={`${enrollments.length ? Math.round((completed / enrollments.length) * 100) : 0}%`} />
          <Info label="Tỷ lệ nghỉ" value={`${enrollments.length ? Math.round((dropped / enrollments.length) * 100) : 0}%`} />
          <Info label="Học phí còn nợ" value={formatCurrency(stats.totalDebt)} />
        </div>
        <div className="mt-6 h-80 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByClass}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    );
  };

  return (
    <div className={`min-h-full rounded-xl ${themeClass}`}>
      <div className="mb-4 flex flex-col gap-3 rounded-lg bg-gradient-to-r from-blue-700 via-blue-600 to-yellow-400 p-4 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-90">Project: 3D Maker Student Management System</p>
          <h1 className="mt-1 text-2xl font-black">Quản lý khóa học 3D Maker</h1>
          <p className="mt-1 text-sm opacity-90">CRM, lớp học, điểm danh, tiến độ, học phí, sản phẩm, chứng nhận và báo cáo cho Einstein House.</p>
        </div>
        <button onClick={() => setDarkMode(value => !value)} className="inline-flex items-center gap-2 self-start rounded-lg bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {darkMode ? 'Light' : 'Dark'}
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {viewTabs.map(tab => {
          const Icon = tab.icon;
          const active = view === tab.key;
          return (
            <button key={tab.key} onClick={() => setView(tab.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${active ? 'bg-blue-600 text-white' : darkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'}`}>
              <Icon size={16} />{tab.label}
            </button>
          );
        })}
      </div>

      {view === 'dashboard' && renderDashboard()}
      {view === 'crm' && renderCrm()}
      {view === 'registration' && renderRegistration()}
      {view === 'classes' && renderClasses()}
      {view === 'attendance' && renderAttendance()}
      {view === 'progress' && renderProgress()}
      {view === 'products' && renderProducts()}
      {view === 'finance' && renderFinance()}
      {view === 'certificates' && renderCertificates()}
      {view === 'calendar' && renderCalendar()}
      {view === 'sale' && renderSale()}
      {view === 'reports' && renderReports()}

      {studentForm && (
        <Modal title={studentForm.fullName ? 'Cập nhật học viên' : 'Thêm học viên'} onClose={() => setStudentForm(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Mã học viên" value={studentForm.code} onChange={value => setStudentForm({ ...studentForm, code: value })} />
            <Field label="Họ tên" value={studentForm.fullName} onChange={value => setStudentForm({ ...studentForm, fullName: value })} />
            <Field label="Ngày sinh" type="date" value={studentForm.birthDate} onChange={value => setStudentForm({ ...studentForm, birthDate: value })} />
            <SelectField label="Giới tính" value={studentForm.gender} options={genderLabels} onChange={value => setStudentForm({ ...studentForm, gender: value as MakerStudentGender })} />
            <Field label="Phụ huynh" value={studentForm.parentName} onChange={value => setStudentForm({ ...studentForm, parentName: value })} />
            <Field label="SĐT phụ huynh" value={studentForm.parentPhone} onChange={value => setStudentForm({ ...studentForm, parentPhone: value })} />
            <Field label="Email" value={studentForm.parentEmail || ''} onChange={value => setStudentForm({ ...studentForm, parentEmail: value })} />
            <Field label="Facebook" value={studentForm.parentFacebook || ''} onChange={value => setStudentForm({ ...studentForm, parentFacebook: value })} />
            <Field label="Địa chỉ" value={studentForm.address || ''} onChange={value => setStudentForm({ ...studentForm, address: value })} />
            <SelectField label="Nguồn khách" value={studentForm.source} options={sourceLabels} onChange={value => setStudentForm({ ...studentForm, source: value as MakerLeadSource })} />
            <SelectField label="Pipeline" value={studentForm.saleStage} options={stageLabels} onChange={value => setStudentForm({ ...studentForm, saleStage: value as MakerSaleStage })} />
            <div className="md:col-span-2">
              <Field label="Ghi chú Sale" value={studentForm.saleNote || ''} onChange={value => setStudentForm({ ...studentForm, saleNote: value })} />
            </div>
          </div>
          <ModalActions onSave={saveStudent} />
        </Modal>
      )}

      {enrollmentForm && (
        <Modal title="Đăng ký khóa học" onClose={() => setEnrollmentForm(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Học viên" value={enrollmentForm.studentId || ''} options={Object.fromEntries(students.map(student => [student.id, `${student.fullName} - ${student.code}`]))} onChange={value => setEnrollmentForm({ ...enrollmentForm, studentId: value })} />
            <SelectField label="Niên khóa" value={enrollmentForm.academicYearId || ''} options={Object.fromEntries(academicYears.map(year => [year.id, year.name]))} onChange={value => setEnrollmentForm({ ...enrollmentForm, academicYearId: value })} />
            <SelectField label="Lớp" value={enrollmentForm.classId || ''} options={Object.fromEntries(classes.map(klass => [klass.id, `${klass.name} - ${getWeekdayLabel(klass.daysOfWeek)}`]))} onChange={value => setEnrollmentForm({ ...enrollmentForm, classId: value })} />
            <Field label="Học phí" type="number" value={String(enrollmentForm.tuitionFee || 3000000)} onChange={value => setEnrollmentForm({ ...enrollmentForm, tuitionFee: Number(value) })} />
            <SelectField label="Trạng thái" value={enrollmentForm.status || 'WAITING_START'} options={statusLabels} onChange={value => setEnrollmentForm({ ...enrollmentForm, status: value as MakerEnrollmentStatus })} />
          </div>
          <ModalActions onSave={saveEnrollment} />
        </Modal>
      )}

      {classForm && (
        <Modal title="Tạo lớp và tự sinh lịch" onClose={() => setClassForm(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Niên khóa" value={classForm.academicYearId || ''} options={Object.fromEntries(academicYears.map(year => [year.id, year.name]))} onChange={value => setClassForm({ ...classForm, academicYearId: value })} />
            <Field label="Tên lớp" value={classForm.name || ''} onChange={value => setClassForm({ ...classForm, name: value })} />
            <Field label="Khóa" value={classForm.courseName || 'Khóa 1'} onChange={value => setClassForm({ ...classForm, courseName: value })} />
            <SelectField label="Lịch học" value={(classForm.daysOfWeek || [1, 3]).join(',')} options={{ '1,3': 'Thứ 2 + Thứ 4', '2,4': 'Thứ 3 + Thứ 5', '5,0': 'Thứ 6 + Chủ nhật' }} onChange={value => setClassForm({ ...classForm, daysOfWeek: value.split(',').map(Number) })} />
            <SelectField label="Slot" value={classForm.slotName || 'Slot 1'} options={{ 'Slot 1': 'Slot 1 - 17:00 - 19:00', 'Slot 2': 'Slot 2 - 19:00 - 21:00' }} onChange={value => setClassForm({ ...classForm, slotName: value, startTime: value === 'Slot 1' ? '17:00' : '19:00', endTime: value === 'Slot 1' ? '19:00' : '21:00' })} />
            <Field label="Ngày khai giảng" type="date" value={classForm.startDate || todayKey()} onChange={value => setClassForm({ ...classForm, startDate: value })} />
            <Field label="Giảng viên" value={classForm.teacherName || 'Phạm Trần Nhân'} onChange={value => setClassForm({ ...classForm, teacherName: value })} />
            <Field label="Sĩ số tối đa" type="number" value={String(classForm.maxStudents || 6)} onChange={value => setClassForm({ ...classForm, maxStudents: Number(value) })} />
          </div>
          <ModalActions onSave={saveClass} />
        </Modal>
      )}

      {paymentForm && (
        <Modal title="Ghi nhận thanh toán" onClose={() => setPaymentForm(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Đăng ký" value={paymentForm.enrollmentId || ''} options={Object.fromEntries(enrollments.map(enrollment => {
              const student = students.find(item => item.id === enrollment.studentId);
              return [enrollment.id, `${student?.fullName || enrollment.studentId} - ${enrollment.courseName}`];
            }))} onChange={value => setPaymentForm({ ...paymentForm, enrollmentId: value })} />
            <Field label="Số tiền" type="number" value={String(paymentForm.amount || 0)} onChange={value => setPaymentForm({ ...paymentForm, amount: Number(value) })} />
            <Field label="Ngày đóng" type="date" value={paymentForm.paidAt || todayKey()} onChange={value => setPaymentForm({ ...paymentForm, paidAt: value })} />
            <SelectField label="Phương thức" value={paymentForm.method || 'BANK_TRANSFER'} options={paymentLabels} onChange={value => setPaymentForm({ ...paymentForm, method: value as MakerPaymentMethod })} />
            <div className="md:col-span-2"><Field label="Ghi chú" value={paymentForm.note || ''} onChange={value => setPaymentForm({ ...paymentForm, note: value })} /></div>
          </div>
          <ModalActions onSave={savePayment} />
        </Modal>
      )}

      {productForm && (
        <Modal title="Upload sản phẩm học viên" onClose={() => setProductForm(null)}>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Đăng ký" value={productForm.enrollmentId || ''} options={Object.fromEntries(enrollments.map(enrollment => {
              const student = students.find(item => item.id === enrollment.studentId);
              return [enrollment.id, `${student?.fullName || enrollment.studentId} - ${enrollment.courseName}`];
            }))} onChange={value => setProductForm({ ...productForm, enrollmentId: value })} />
            <SelectField label="Buổi học" value={productForm.sessionId || ''} options={Object.fromEntries(sessions.map(session => [session.id, `${formatDate(session.date)} - Buổi ${session.lessonNumber}: ${session.topic}`]))} onChange={value => setProductForm({ ...productForm, sessionId: value })} />
            <Field label="Tên sản phẩm" value={productForm.title || ''} onChange={value => setProductForm({ ...productForm, title: value })} />
            <Field label="URL ảnh" value={productForm.imageUrl || ''} onChange={value => setProductForm({ ...productForm, imageUrl: value })} />
            <div className="md:col-span-2"><Field label="Ghi chú" value={productForm.note || ''} onChange={value => setProductForm({ ...productForm, note: value })} /></div>
          </div>
          <ModalActions onSave={saveProduct} />
        </Modal>
      )}
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-100 bg-white p-3">
    <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
  </div>
);

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <label className="block">
    <span className="text-xs font-black uppercase text-slate-500">{label}</span>
    <input type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
  </label>
);

const SelectField: React.FC<{ label: string; value: string; options: Record<string, string>; onChange: (value: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="text-xs font-black uppercase text-slate-500">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
      {Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>
);

const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h3 className="font-black text-slate-900">{title}</h3>
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600">Đóng</button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

const ModalActions: React.FC<{ onSave: () => void }> = ({ onSave }) => (
  <div className="mt-4 flex justify-end">
    <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Save size={16} />Lưu</button>
  </div>
);
