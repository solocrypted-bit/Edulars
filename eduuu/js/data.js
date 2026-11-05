
// ===================== APPLICATION STATE =====================
const store = {
    currentUser: null,
    currentRole: null,
    currentPage: 'dashboard',
    students: [],
    studentEnrollmentHistory: [],
    teachers: [],
    classes: [],
    assignments: [],
    assignmentSubmissions: [],
    lessonNotes: [],
    grades: [],
    lessonPlans: [],
    fees: [],
    invoices: [],
    payments: [],
    borrowedBooks: [],
    libraryBooks: [],
    timetable: {},
    announcements: [],
    messages: [],
    notifications: [],
    dailyAttendance: {},
    settings: {
        schoolName: '',
        schoolLogoData: '',
        academicYear: '',
        emailNotifications: false,
        smsNotifications: false,
        onlinePayments: false,
        lateFeePenalty: false
    }
};

const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = window.EDULARS_API_URL
    || (isLocalFrontend ? 'http://localhost:5000/api' : 'https://edulars-api.onrender.com/api');
const API_TOKEN_KEY = 'edulars.accessToken';

async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const token = sessionStorage.getItem(API_TOKEN_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
        });
    } catch (error) {
        throw new Error(`Could not reach the EDULARS API at ${API_BASE_URL}. Check that the backend is running and CORS allows this frontend.`);
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 401 && path !== '/auth/login') {
            sessionStorage.removeItem(API_TOKEN_KEY);
        }
        throw new Error(body?.message || `API request failed with HTTP ${response.status}`);
    }
    return body;
}

async function loadStoreData() {
    const paths = {
        students: '/students',
        teachers: '/teachers',
        classes: '/classes',
        assignments: '/assignments',
        grades: '/academics/grades',
        lessonPlans: '/academics/lesson-plans',
        attendance: '/academics/attendance',
        announcements: '/school-life/announcements',
        libraryBooks: '/school-life/library',
        borrowedBooks: '/school-life/library/borrowed',
        timetable: '/school-life/timetable',
        messages: '/school-life/messages',
        settings: '/settings'
    };
    if (['admin', 'student', 'parent'].includes(store.currentRole)) {
        paths.fees = '/finance/fees';
    }
    if (['admin', 'parent'].includes(store.currentRole)) {
        paths.payments = '/finance/payments';
        paths.invoices = '/finance/invoices';
    }
    if (store.currentRole === 'admin') {
        paths.reports = '/reports';
    }
    if (['admin', 'teacher', 'student'].includes(store.currentRole)) {
        paths.assignmentSubmissions = '/assignment-submissions';
    }

    const keys = Object.keys(paths);
    const results = await Promise.all(keys.map(key =>
        apiRequest(paths[key]).then(value => ({ key, value }))
    ));
    const records = Object.fromEntries(results.map(({ key, value }) => [key, value]));

    store.classes = (records.classes || []).map(item => ({ ...item, grade: item.grade || item.name }));
    store.teachers = (records.teachers || []).filter(item => item.status !== 'inactive').map(item => ({
        ...item,
        email: item.email || '',
        classes: item.classNames || []
    }));
    store.students = (records.students || []).filter(item => item.status !== 'inactive').map(item => {
        const classroom = store.classes.find(entry => entry.name === item.className);
        return {
            ...item,
            grade: item.gradeLevel,
            section: classroom?.section || '',
            classId: classroom?.id || '',
            parent: item.parent || item.parentName || '',
            parentEmail: item.parentEmail || '',
            attendance: Number(item.attendance || 0)
        };
    });
    store.assignments = (records.assignments || []).map(item => ({ ...item, class: item.className }));
    store.assignmentSubmissions = records.assignmentSubmissions || [];
    store.grades = records.grades || [];
    store.lessonPlans = (records.lessonPlans || []).map(item => ({
        ...item,
        class: item.className,
        classId: store.classes.find(classroom => classroom.name === item.className)?.id || '',
        title: item.title || item.topic,
        date: item.date || item.week || '',
        teacher: item.teacherName,
        teacherId: item.teacherUserId
    }));
    store.dailyAttendance = {};
    for (const item of records.attendance || []) {
        (store.dailyAttendance[item.date] ||= []).push(item);
    }
    store.announcements = (records.announcements || []).map(item => ({
        ...item,
        content: item.content || item.message,
        author: item.author || item.createdByName || 'School administration',
        priority: item.priority || 'Normal',
        audience: item.audience || 'All'
    }));
    store.libraryBooks = (records.libraryBooks || []).map(item => ({
        ...item,
        copies: item.copies ?? item.availableCopies ?? 0,
        available: item.available ?? item.availableCopies ?? 0
    }));
    store.timetable = {};
    for (const item of records.timetable || []) {
        (store.timetable[item.day] ||= []).push({
            ...item,
            time: item.time || item.period,
            room: item.room || ''
        });
    }
    store.messages = (records.messages || []).map(item => ({ ...item, from: item.sender, to: item.recipientUserId }));
    store.settings = { ...store.settings, ...(records.settings || {}) };
    store.fees = (records.fees || []).map(item => ({
        ...item,
        type: item.type || item.term,
        dueDate: item.dueDate || '',
        amount: Number(item.amount || 0),
        paid: Number(item.paid || 0),
        balance: Number(item.balance || 0)
    }));
    store.payments = records.payments || [];
    store.invoices = records.invoices || [];
    store.borrowedBooks = records.borrowedBooks || [];
    store.reports = records.reports || [];
}

// ===================== ROLE-BASED SIDEBAR MENUS =====================
const menuConfig = {
    admin: [
        { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
        { id: 'students', icon: 'fa-user-graduate', label: 'Students' },
        { id: 'teachers', icon: 'fa-chalkboard-teacher', label: 'Teachers' },
        { id: 'classes', icon: 'fa-school', label: 'Classes' },
        { id: 'classFees', icon: 'fa-money-bill-wave', label: 'Class Fees' },
        { id: 'gradeEntry', icon: 'fa-clipboard-check', label: 'Record Grades' },
        { id: 'lessonPlans', icon: 'fa-book-open', label: 'View Lesson Plans' },
        { id: 'fees', icon: 'fa-dollar-sign', label: 'Fees & Payments' },
        { id: 'library', icon: 'fa-book', label: 'Library' },
        { id: 'timetable', icon: 'fa-calendar-alt', label: 'Timetable' },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' },
        { id: 'reports', icon: 'fa-file-alt', label: 'Reports' },
        { id: 'settings', icon: 'fa-cog', label: 'Settings' }
    ],
    teacher: [
        { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
        { id: 'writeLessonNote', icon: 'fa-file-word', label: 'Write Lesson Note' },
        { id: 'myClasses', icon: 'fa-school', label: 'My Classes' },
        { id: 'teacherAttendance', icon: 'fa-clipboard-check', label: 'Attendance' },
        { id: 'teacherAssignments', icon: 'fa-tasks', label: 'Assignments' },
        { id: 'gradeEntry', icon: 'fa-clipboard-check', label: 'Record Grades' },
        { id: 'lessonPlans', icon: 'fa-book-open', label: 'Lesson Plans' },
        { id: 'myStudents', icon: 'fa-user-graduate', label: 'My Students' },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' },
        { id: 'reports', icon: 'fa-file-alt', label: 'Report Cards' }
    ],
    student: [
        { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
        { id: 'studentAssignments', icon: 'fa-tasks', label: 'My Assignments' },
        { id: 'grades', icon: 'fa-chart-line', label: 'My Grades' },
        { id: 'timetable', icon: 'fa-calendar-alt', label: 'Timetable' },
        { id: 'lessonPlans', icon: 'fa-book-open', label: 'Lesson Plans' },
        { id: 'attendance', icon: 'fa-clipboard-check', label: 'My Attendance' },
        { id: 'library', icon: 'fa-book', label: 'Library' },
        { id: 'fees', icon: 'fa-dollar-sign', label: 'Fees & Payments' },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' }
    ],
    parent: [
        { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
        { id: 'childProfile', icon: 'fa-user-graduate', label: 'Child Profile' },
        { id: 'academicPerformance', icon: 'fa-chart-line', label: 'Academic Performance' },
        { id: 'attendance', icon: 'fa-clipboard-check', label: 'Attendance' },
        { id: 'fees', icon: 'fa-dollar-sign', label: 'Fees & Payments' },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' },
        { id: 'teacherMessages', icon: 'fa-comments', label: 'Teacher Messages' }
    ]
};

function getTeacherAssignedClasses(teacher = store.currentUser) {
    if (!teacher) return [];
    const teacherRecord = store.teachers.find(item =>
        (teacher.id && item.id === teacher.id)
        || (teacher.email && item.email?.toLowerCase() === teacher.email.toLowerCase())
        || item.name === teacher.name
    ) || teacher;
    const assignedNames = teacherRecord.classes || [];
    return store.classes.filter(classroom =>
        classroom.teacherId === teacherRecord.id
        || Boolean(teacherRecord.email && classroom.teacherEmail?.toLowerCase() === teacherRecord.email.toLowerCase())
        || classroom.teacher === teacherRecord.name
        || (
            !classroom.teacherId
            && !classroom.teacherEmail
            && !classroom.teacher
            && assignedNames.includes(classroom.name)
        )
    );
}

function getTeacherAssignedStudents(teacher = store.currentUser) {
    const assignedClassIds = new Set(getTeacherAssignedClasses(teacher).map(classroom => classroom.id));
    return store.students.filter(student => assignedClassIds.has(student.classId));
}

function saveTeacherClassAssignments(teacher, classNames) {
    teacher.classes = [...new Set(classNames)];
}
