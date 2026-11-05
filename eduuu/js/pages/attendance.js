let attendanceRegisterState = { className: '', term: 'First Term', week: 1 };

function renderTeacherAttendance() {
    const teacher = store.teachers.find(item => item.userId === store.currentUser?.id);
    const assignedClasses = teacher ? teacher.classes : [];
    if (!attendanceRegisterState.className || !assignedClasses.includes(attendanceRegisterState.className)) {
        attendanceRegisterState.className = assignedClasses[0] || '';
    }

    const students = store.students.filter(student => studentClassName(student) === attendanceRegisterState.className);
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const existing = Object.values(store.dailyAttendance).flat().filter(record =>
        record.className === attendanceRegisterState.className
        && record.term === attendanceRegisterState.term
        && Number(record.week) === Number(attendanceRegisterState.week)
    );
    const dateForDay = day => existing.find(record => record.weekday === day)?.date || '';
    const recordForStudentAndDay = (studentId, day) => existing.find(record =>
        record.studentId === studentId && record.weekday === day
    );

    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">Attendance Register</h1>
            <p class="text-slate-500">Record attendance for students in your assigned classes.</p>
        </div>
        <div class="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label class="grid gap-1 text-sm font-medium text-slate-700">Class
                <select id="attendanceClassSelect" class="rounded-lg border px-3 py-2" onchange="changeAttendanceSelection('className', this.value)">
                    ${assignedClasses.map(name => `<option value="${escapeHTML(name)}" ${name === attendanceRegisterState.className ? 'selected' : ''}>${escapeHTML(name)}</option>`).join('')}
                </select>
            </label>
            <label class="grid gap-1 text-sm font-medium text-slate-700">Term
                <select class="rounded-lg border px-3 py-2" onchange="changeAttendanceSelection('term', this.value)">
                    ${['First Term', 'Second Term', 'Third Term'].map(term => `<option ${term === attendanceRegisterState.term ? 'selected' : ''}>${term}</option>`).join('')}
                </select>
            </label>
            <label class="grid gap-1 text-sm font-medium text-slate-700">Week
                <input type="number" min="1" max="52" value="${attendanceRegisterState.week}" class="w-24 rounded-lg border px-3 py-2" onchange="changeAttendanceSelection('week', this.value)">
            </label>
        </div>
        ${assignedClasses.length ? `<form onsubmit="saveTeacherAttendance(event)" class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full min-w-[52rem] text-left text-sm">
                <thead class="border-b bg-slate-50 text-slate-600">
                    <tr><th class="p-3">Student</th>${weekdays.map((day, index) => `<th class="p-3 text-center">${day}<input type="date" data-attendance-date="${index}" value="${escapeHTML(dateForDay(day))}" aria-label="${day} attendance date" class="mt-2 block w-full min-w-32 rounded border p-1 text-xs"></th>`).join('')}<th class="p-3 text-center">Present %</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${students.map(student => {
                        const states = weekdays.map(day => recordForStudentAndDay(student.id, day)?.present);
                        const marked = states.filter(value => typeof value === 'boolean');
                        const percent = marked.length ? Math.round(marked.filter(Boolean).length / marked.length * 100) : '—';
                        return `<tr><td class="p-3 font-medium text-slate-800">${escapeHTML(student.name)}</td>${weekdays.map((day, index) => {
                            const record = recordForStudentAndDay(student.id, day);
                            const value = typeof record?.present === 'boolean' ? String(record.present) : '';
                            return `<td class="p-3 text-center"><select data-student-id="${escapeHTML(student.id)}" data-weekday="${day}" class="rounded border p-2 text-xs"><option value="" ${value === '' ? 'selected' : ''}>Not marked</option><option value="true" ${value === 'true' ? 'selected' : ''}>Present</option><option value="false" ${value === 'false' ? 'selected' : ''}>Absent</option></select></td>`;
                        }).join('')}<td class="p-3 text-center font-semibold">${percent}${percent === '—' ? '' : '%'}</td></tr>`;
                    }).join('') || '<tr><td colspan="7" class="p-8 text-center text-slate-500">No students are enrolled in this class.</td></tr>'}
                </tbody>
            </table>
            <div class="flex justify-end border-t p-4"><button class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Save attendance</button></div>
        </form>` : '<p class="rounded-xl bg-white p-6 text-slate-500">No classes have been assigned to your account.</p>'}
    </div>`;
}

function changeAttendanceSelection(field, value) {
    attendanceRegisterState[field] = field === 'week' ? Number(value) : value;
    navigateTo('teacherAttendance');
}

async function saveTeacherAttendance(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const dates = [...form.querySelectorAll('[data-attendance-date]')];
    const selections = [...form.querySelectorAll('select[data-student-id]')]
        .filter(select => select.value !== '');
    if (!selections.length) {
        showToast('Mark at least one student as present or absent before saving.', 'error');
        return;
    }
    const payload = selections.map(select => {
        const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(select.dataset.weekday);
        const date = dates[dayIndex]?.value || '';
        return {
            studentId: select.dataset.studentId,
            date,
            present: select.value === 'true',
            term: attendanceRegisterState.term,
            week: attendanceRegisterState.week,
            weekday: select.dataset.weekday
        };
    });
    if (payload.some(record => !record.date)) {
        showToast('Choose a calendar date for each weekday with attendance marks.', 'error');
        return;
    }
    try {
        await Promise.all(payload.map(record => apiRequest('/academics/attendance', {
            method: 'POST',
            body: JSON.stringify(record)
        })));
        await loadStoreData();
        showToast('Attendance saved to the school database.', 'success');
        navigateTo('teacherAttendance');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
