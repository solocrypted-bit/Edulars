// ===================== ADMIN ENROLLMENT HISTORY AND CHART =====================
function getAdminEnrollmentHistory() {
    const currentSession = store.settings.academicYear;
    const currentSessionStartYear = /^(\d{4})-\d{4}$/.exec(currentSession);
    const historicalSessions = store.studentEnrollmentHistory
        .slice()
        .sort((a, b) => b.sessionsAgo - a.sessionsAgo)
        .map(record => {
            const sessionStartYear = currentSessionStartYear
                ? Number(currentSessionStartYear[1]) - record.sessionsAgo
                : null;
            const session = sessionStartYear === null
                ? `${record.sessionsAgo} sessions ago`
                : `${sessionStartYear}-${sessionStartYear + 1}`;

            return { session, studentCount: record.studentCount };
        });
    const enrollment = [
        ...historicalSessions,
        { session: currentSession, studentCount: store.students.length }
    ];

    return enrollment.map((record, index) => ({
        ...record,
        change: index === 0 ? null : record.studentCount - enrollment[index - 1].studentCount
    }));
}

let adminEnrollmentChart;

function initializeAdminEnrollmentChart() {
    const canvas = document.getElementById('adminEnrollmentChart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
        console.error('EDULARS could not render the enrollment chart because Chart.js is unavailable.');
        canvas.insertAdjacentHTML('afterend', '<p class="mt-3 text-sm text-red-700" role="alert">The enrollment chart could not be loaded. Check your connection and reload the page.</p>');
        return;
    }

    if (adminEnrollmentChart) adminEnrollmentChart.destroy();

    const history = getAdminEnrollmentHistory();
    const changes = history.map(record => record.change);
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    adminEnrollmentChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: history.map(record => record.session),
            datasets: [{
                label: 'Students',
                data: history.map(record => record.studentCount),
                borderWidth: 3,
                // Smooth the line between points
                tension: 0.4,
                cubicInterpolationMode: 'monotone',
                // Rounded caps & joins for a softer line
                borderJoinStyle: 'round',
                borderCapStyle: 'round',
                // Subtle fill under the line for visual weight
                fill: true,
                backgroundColor: 'rgba(22,163,74,0.06)',
                // Points styled softly; color per point indicates growth/reduction
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: changes.map(change => change === null || change === 0
                    ? '#94a3b8'
                    : change > 0 ? '#16a34a' : '#dc2626'),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                // Color each segment by whether it increased or decreased
                segment: {
                    borderColor: context => {
                        const change = context.p1.parsed.y - context.p0.parsed.y;
                        return change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#94a3b8';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => `${context.parsed.y} students`
                    }
                }
            },
            elements: {
                line: {
                    // make joins rounded
                    tension: 0.4,
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    title: { display: true, text: 'Number of students' }
                },
                x: { title: { display: true, text: 'Academic session' } }
            }
        }
    });
}

// ===================== ROLE-SPECIFIC DASHBOARDS =====================
function renderDashboard() {
    const role = store.currentRole;

    // Administrator overview: enrollment, directories, classes, and fee summaries.
    if (role === 'admin') {
        const totalFeesDue = store.fees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const outstanding = store.fees.reduce((sum, fee) => sum + Math.max(0, Number(fee.amount || 0) - Number(fee.paid || 0)), 0);
        const enrollmentHistory = getAdminEnrollmentHistory();
        return `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div><h1 class="text-2xl font-bold text-slate-800">EDULARS Admin Dashboard</h1><p class="text-slate-500">Welcome back, ${store.currentUser.name} (Administrator)</p></div>
                <button onclick="navigateTo('announcements')" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><i class="fas fa-bullhorn mr-2"></i>Post an update</button>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <button onclick="navigateTo('students')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200">
                    <p class="text-xs font-semibold uppercase text-slate-500">Total Students</p><h3 class="mt-1 text-2xl font-bold text-slate-800">${store.students.length}</h3><span class="mt-2 inline-block text-xs text-primary-700">Open directory <i class="fas fa-arrow-right ml-1"></i></span>
                </button>
                <button onclick="navigateTo('teachers')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200">
                    <p class="text-xs font-semibold uppercase text-slate-500">Teaching Staff</p><h3 class="mt-1 text-2xl font-bold text-slate-800">${store.teachers.length}</h3><span class="mt-2 inline-block text-xs text-primary-700">Open staff list <i class="fas fa-arrow-right ml-1"></i></span>
                </button>
                <button onclick="navigateTo('classes')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200">
                    <p class="text-xs font-semibold uppercase text-slate-500">Classes</p><h3 class="mt-1 text-2xl font-bold text-slate-800">${store.classes.length}</h3><span class="mt-2 inline-block text-xs text-primary-700">Manage classes <i class="fas fa-arrow-right ml-1"></i></span>
                </button>
                <button onclick="navigateTo('fees')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200">
                    <p class="text-xs font-semibold uppercase text-slate-500">Total Fees Due</p><h3 class="mt-1 text-2xl font-bold text-slate-800">${formatNaira(totalFeesDue)}</h3><span class="mt-2 inline-block text-xs text-primary-700">View fee accounts <i class="fas fa-arrow-right ml-1"></i></span>
                </button>
                <button onclick="navigateTo('fees')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200">
                    <p class="text-xs font-semibold uppercase text-slate-500">Fees Outstanding</p><h3 class="mt-1 text-2xl font-bold text-amber-700">${formatNaira(outstanding)}</h3><span class="mt-2 inline-block text-xs text-primary-700">View payments <i class="fas fa-arrow-right ml-1"></i></span>
                </button>
            </div>
            <div class="grid grid-cols-1 gap-4">
                <button onclick="navigateTo('announcements')" class="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm"><span><span class="block text-sm text-slate-500">School announcements</span><strong class="mt-1 block text-xl text-slate-800">${store.announcements.length} posted</strong></span><i class="fas fa-bullhorn text-xl text-primary-600"></i></button>
            </div>
            <section class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm" aria-labelledby="enrollment-history-heading">
                <div class="mb-4">
                    <h2 id="enrollment-history-heading" class="text-lg font-bold text-slate-800">Student enrollment history</h2>
                    <p class="text-sm text-slate-500">Student count across the previous five sessions and the current session.</p>
                </div>
                <div class="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="Chart legend">
                    <span><span class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-600"></span>Growth</span>
                    <span><span class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600"></span>Reduction</span>
                    <span><span class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-500"></span>No change / first session</span>
                </div>
                <div class="relative h-72 w-full">
                    <canvas id="adminEnrollmentChart" role="img" aria-label="Line chart showing student enrollment by academic session"></canvas>
                </div>
                <p class="mt-3 text-xs text-slate-500">Enrollment counts reflect the student records currently stored for this school.</p>
                <details class="group mt-4 border-t border-slate-100 pt-4">
                    <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                        <span class="group-open:hidden">More details</span>
                        <span class="hidden group-open:inline">Hide details</span>
                        <i class="fas fa-chevron-down text-xs transition-transform group-open:rotate-180" aria-hidden="true"></i>
                    </summary>
                    <div class="mt-3 overflow-x-auto">
                    <table class="w-full min-w-[28rem] text-left text-sm">
                        <caption class="sr-only">Student counts and changes by academic session</caption>
                        <thead class="border-b border-slate-200 text-xs uppercase text-slate-500">
                            <tr><th scope="col" class="px-3 py-2">Academic session</th><th scope="col" class="px-3 py-2 text-right">Students</th><th scope="col" class="px-3 py-2 text-right">Change from previous session</th></tr>
                        </thead>
                        <tbody>
                            ${enrollmentHistory.map(record => {
                                const changeClass = record.change === null || record.change === 0
                                    ? 'text-slate-500'
                                    : record.change > 0 ? 'text-green-700' : 'text-red-700';
                                const changeText = record.change === null
                                    ? '—'
                                    : `${record.change > 0 ? '+' : ''}${record.change}`;
                                return `<tr class="border-b border-slate-100 last:border-0"><th scope="row" class="px-3 py-3 font-medium text-slate-700">${record.session}</th><td class="px-3 py-3 text-right text-slate-700">${record.studentCount}</td><td class="px-3 py-3 text-right font-semibold ${changeClass}">${changeText}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    </div>
                </details>
            </section>
        </div>`;
    // Teacher overview: assigned classes, students, and teaching shortcuts.
    } else if (role === 'teacher') {
        const assignedClasses = getTeacherAssignedClasses();
        const assignedStudents = getTeacherAssignedStudents();
        return `
        <div class="space-y-6">
            <!-- Welcome Teacher Banner -->
            <div class="bg-gradient-to-r from-primary-700 to-primary-900 text-white p-8 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <span class="bg-white/20 text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold">Teacher Portal</span>
                    <h1 class="text-3xl font-extrabold mt-2">Welcome teacher, ${store.currentUser.name}!</h1>
                    <p class="text-white/80 text-sm mt-1">Manage your lesson notes, mark daily/weekly student attendance, and upload class assignments.</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="navigateTo('writeLessonNote')" class="px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-xl text-sm shadow hover:bg-primary-500 transition"><i class="fas fa-file-word mr-1.5"></i> New Lesson Note</button>
                    <button onclick="navigateTo('teacherAssignments')" class="px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-xl text-sm shadow hover:bg-primary-500 transition"><i class="fas fa-tasks mr-1.5"></i> Post Assignment</button>
                </div>
            </div>

            <!-- Quick Stats Overview -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center text-xl"><i class="fas fa-school"></i></div>
                    <div>
                        <p class="text-xs text-slate-500 font-semibold uppercase">Assigned Classes</p>
                        <h3 class="text-xl font-bold text-slate-800">${assignedClasses.map(item => escapeHTML(item.name)).join(', ') || 'No classes assigned'}</h3>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl"><i class="fas fa-tasks"></i></div>
                    <div>
                        <p class="text-xs text-slate-500 font-semibold uppercase">Active Assignments</p>
                        <h3 class="text-xl font-bold text-slate-800">${store.assignments.length} Uploaded</h3>
                    </div>
                </div>
                <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl"><i class="fas fa-users"></i></div>
                    <div>
                        <p class="text-xs text-slate-500 font-semibold uppercase">Total Students</p>
                        <h3 class="text-xl font-bold text-slate-800">${assignedStudents.length} Pupils</h3>
                    </div>
                </div>
            </div>
        </div>`;
    // Student overview: assignments, grades, and the weekly timetable.
    } else if (role === 'student') {
        const student = getCurrentStudent();
        const grades = store.grades.filter(grade => grade.studentId === student?.id);
        const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
        return `
        <div class="space-y-6">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">Student Dashboard</h1>
                <p class="text-slate-500">Welcome back, ${store.currentUser.name}</p>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <button onclick="navigateTo('studentAssignments')" class="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-primary-300"><i class="fas fa-tasks text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">My Assignments</h2><p class="mt-1 text-sm text-slate-500">${store.assignments.length} available</p></button>
                <button onclick="navigateTo('grades')" class="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-primary-300"><i class="fas fa-chart-line text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">My Grades</h2><p class="mt-1 text-sm text-slate-500">${average}% average · ${grades.length} subjects</p></button>
                <button onclick="navigateTo('timetable')" class="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-primary-300"><i class="fas fa-calendar-alt text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">Timetable</h2><p class="mt-1 text-sm text-slate-500">Review this week’s lessons</p></button>
            </div>
        </div>`;
    // Parent overview: child profile, performance, fees, and teacher contact.
    } else {
        const student = getCurrentStudent();
        const grades = store.grades.filter(grade => grade.studentId === student?.id);
        const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
        const outstanding = store.fees.filter(fee => fee.studentId === student?.id).reduce((sum, fee) => sum + Math.max(0, fee.amount - fee.paid), 0);
        return `
        <div class="space-y-6">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">Parent Dashboard</h1>
                <p class="text-slate-500">Welcome, ${store.currentUser.name}</p>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <button onclick="navigateTo('childProfile')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200"><i class="fas fa-user-graduate text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">${student.name}</h2><p class="mt-1 text-sm text-slate-500">${studentClassName(student)} · View child profile</p></button>
                <button onclick="navigateTo('academicPerformance')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200"><i class="fas fa-chart-line text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">Academic Performance</h2><p class="mt-1 text-sm text-slate-500">${average}% average across ${grades.length} subjects</p></button>
                <button onclick="navigateTo('fees')" class="rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm hover:border-primary-200"><i class="fas fa-receipt text-primary-600"></i><h2 class="mt-3 font-semibold text-slate-800">Fees & Payments</h2><p class="mt-1 text-sm text-slate-500">${formatNaira(outstanding)} outstanding</p></button>
            </div>
            <button onclick="navigateTo('teacherMessages')" class="w-full rounded-xl border border-slate-100 bg-white p-5 text-left text-sm text-primary-700 shadow-sm hover:border-primary-200"><i class="fas fa-comments mr-2"></i>Contact your child’s teacher</button>
        </div>`;
    }
}
