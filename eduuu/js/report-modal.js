// ===================== REPORT CARD MODAL =====================
function openReportCardModal(sectionKey = 'primary') {
    const availableStudents = store.currentRole === 'admin' || store.currentRole === 'teacher'
        ? store.students
        : [getCurrentStudent()].filter(Boolean);
    const student = availableStudents[0];
    if (!student) {
        showToast('No student record is available for this report.', 'error');
        return;
    }
    renderReportCard(student.id, sectionKey, availableStudents.length > 1);
    document.getElementById('reportCardModal').classList.remove('hidden');
}

function renderReportCard(studentId, sectionKey, canSelectStudent) {
    const student = store.students.find(item => item.id === studentId);
    if (!student) {
        showToast('The selected student record could not be found.', 'error');
        return;
    }
    const grades = store.grades.filter(grade => grade.studentId === student.id);
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
    const sectionName = sectionKey === 'seniorSecondary' ? 'Senior Secondary' : 'Primary Section';
    document.getElementById('reportCardContent').innerHTML = `
        <div class="space-y-5">
            ${canSelectStudent ? `<label class="flex flex-wrap items-center gap-3 text-sm"><span class="font-medium text-slate-700">Student</span><select onchange="renderReportCard(this.value, '${sectionKey}', true)" class="rounded-lg border px-3 py-2">${store.students.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === student.id ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('')}</select></label>` : ''}
            <div class="border-b border-primary-200 pb-4 text-center"><p class="text-sm font-semibold uppercase tracking-widest text-primary-700">EDULARS School</p><h2 class="mt-2 text-xl font-bold text-slate-800">${sectionName} Academic Report</h2><p class="mt-1 text-sm text-slate-500">Academic year ${escapeHTML(store.settings.academicYear)}</p></div>
            <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"><p><strong>Student:</strong> ${escapeHTML(student.name)}</p><p><strong>Student ID:</strong> ${escapeHTML(student.id)}</p><p><strong>Class:</strong> ${escapeHTML(studentClassName(student))}</p><p><strong>Parent / Guardian:</strong> ${escapeHTML(student.parent || 'Not provided')}</p></div>
            <div class="overflow-x-auto rounded-lg border border-slate-200"><table class="w-full text-left text-sm"><thead class="bg-primary-50 text-slate-700"><tr><th class="px-3 py-2">Subject</th><th class="px-3 py-2">Score</th><th class="px-3 py-2">Grade</th><th class="px-3 py-2">Term</th></tr></thead><tbody class="divide-y divide-slate-100">${grades.map(grade => `<tr><td class="px-3 py-2">${escapeHTML(grade.subject)}</td><td class="px-3 py-2">${Number(grade.score)}%</td><td class="px-3 py-2 font-semibold text-primary-700">${gradeLetter(Number(grade.score))}</td><td class="px-3 py-2">${escapeHTML(grade.term || 'Current term')}</td></tr>`).join('') || '<tr><td colspan="4" class="px-3 py-5 text-center text-slate-500">No grades recorded for this student.</td></tr>'}</tbody></table></div>
            <div class="flex flex-wrap justify-between gap-3 rounded-lg bg-primary-50 p-4 text-sm"><span>Attendance: <strong>${Number(student.attendance || 0)}%</strong></span><span>Subjects: <strong>${grades.length}</strong></span><span>Average: <strong>${average}%</strong> (${gradeLetter(average)})</span></div>
        </div>`;
}

function closeReportCardModal() {
    document.getElementById('reportCardModal').classList.add('hidden');
}
