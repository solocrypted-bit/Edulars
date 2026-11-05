// ===================== REPORTS DASHBOARD =====================
function renderReportsManager() {
    const outstanding = store.fees.reduce((sum, fee) => sum + Math.max(0, fee.amount - fee.paid), 0);
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">Reports & Report Cards</h1><p class="text-slate-500">Review school summaries, export records, and generate report cards.</p></div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Students enrolled</p><p class="mt-1 text-2xl font-bold text-slate-800">${store.students.length}</p></div>
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Grade records</p><p class="mt-1 text-2xl font-bold text-slate-800">${store.grades.length}</p></div>
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Outstanding fees</p><p class="mt-1 text-2xl font-bold text-amber-700">${formatNaira(outstanding)}</p></div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button onclick="downloadSchoolReport('students')" class="rounded-xl border border-slate-100 bg-white p-4 text-left text-sm font-medium text-slate-700 shadow-sm hover:border-primary-200"><i class="fas fa-download mr-2 text-primary-600"></i>Export student directory</button>
            <button onclick="downloadSchoolReport('grades')" class="rounded-xl border border-slate-100 bg-white p-4 text-left text-sm font-medium text-slate-700 shadow-sm hover:border-primary-200"><i class="fas fa-download mr-2 text-primary-600"></i>Export grade report</button>
            <button onclick="downloadSchoolReport('fees')" class="rounded-xl border border-slate-100 bg-white p-4 text-left text-sm font-medium text-slate-700 shadow-sm hover:border-primary-200"><i class="fas fa-download mr-2 text-primary-600"></i>Export fees report</button>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button onclick="openReportCardModal('primary')" class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-primary-300">
                <i class="fas fa-file-alt text-2xl text-primary-600"></i><h2 class="mt-3 text-lg font-bold text-slate-800">Primary Section Report Card</h2>
                <p class="mt-1 text-xs text-slate-500">Standard Nigerian curriculum with scores and term results.</p>
            </button>
            <button onclick="openReportCardModal('seniorSecondary')" class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-primary-300">
                <i class="fas fa-graduation-cap text-2xl text-primary-600"></i><h2 class="mt-3 text-lg font-bold text-slate-800">Senior Secondary Report Card</h2>
                <p class="mt-1 text-xs text-slate-500">Senior school academic report sheet.</p>
            </button>
        </div>
    </div>`;
}

// ===================== CSV REPORT EXPORT =====================
function downloadSchoolReport(reportType) {
    const reports = {
        students: {
            filename: 'edulars-students.csv',
            headers: ['Student ID', 'Name', 'Class', 'Parent / Guardian', 'Attendance'],
            rows: store.students.map(student => [student.id, student.name, studentClassName(student), student.parent, `${student.attendance || 0}%`])
        },
        grades: {
            filename: 'edulars-grades.csv',
            headers: ['Student ID', 'Student', 'Subject', 'Score', 'Grade', 'Term'],
            rows: store.grades.map(grade => [grade.studentId, store.students.find(student => student.id === grade.studentId)?.name || '', grade.subject, grade.score, gradeLetter(Number(grade.score)), grade.term])
        },
        fees: {
            filename: 'edulars-fees.csv',
            headers: ['Fee ID', 'Student ID', 'Student', 'Type', 'Amount', 'Paid', 'Balance', 'Due date'],
            rows: store.fees.map(fee => [fee.id, fee.studentId, store.students.find(student => student.id === fee.studentId)?.name || '', fee.type, fee.amount, fee.paid, Math.max(0, fee.amount - fee.paid), fee.dueDate])
        }
    };
    const report = reports[reportType];
    if (!report) {
        showToast('That report is not available.', 'error');
        return;
    }
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [report.headers, ...report.rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = report.filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Report downloaded.', 'success');
}
