// ===================== DIRECTORY FORMATTING AND LOOKUP HELPERS =====================
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function nextRecordId(prefix, records) {
    const highestId = records.reduce((highest, record) => {
        const match = String(record.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `${prefix}-${String(highestId + 1).padStart(3, '0')}`;
}

function studentClassName(student) {
    const classroom = store.classes.find(item => item.id === student.classId);
    if (classroom) return classroom.name;
    return `${student.grade || ''}${student.section || ''}`.trim();
}

function getStudentClassRecord(student) {
    return store.classes.find(item => item.id === student.classId)
        || store.classes.find(item => item.name === `${student.grade || ''}${student.section || ''}`.trim() || item.name === student.grade)
        || null;
}

function filterDirectoryRows(query, containerId) {
    const normalizedQuery = query.trim().toLowerCase();
    document.querySelectorAll(`#${containerId} [data-search]`).forEach(row => {
        row.classList.toggle('hidden', !row.dataset.search.includes(normalizedQuery));
    });
}

// ===================== SHARED DIRECTORY MODAL =====================
let directoryModalKeydownHandler;
let directoryModalPreviousOverflow = '';
let directoryModalPreviousFocus;

function closeDirectoryModal() {
    const modal = document.getElementById('directoryModal');
    if (modal) modal.remove();
    if (directoryModalKeydownHandler) {
        document.removeEventListener('keydown', directoryModalKeydownHandler);
        directoryModalKeydownHandler = undefined;
    }
    document.body.style.overflow = directoryModalPreviousOverflow;
    directoryModalPreviousFocus?.focus();
    directoryModalPreviousFocus = undefined;
}

function openDirectoryModal(title, formMarkup) {
    closeDirectoryModal();
    directoryModalPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const modal = document.createElement('div');
    modal.id = 'directoryModal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'directoryModalTitle');
    modal.innerHTML = `
        <section class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 id="directoryModalTitle" class="text-lg font-semibold text-slate-800">${escapeHTML(title)}</h2>
                <button type="button" onclick="closeDirectoryModal()" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog"><i class="fas fa-times"></i></button>
            </div>
            ${formMarkup}
        </section>`;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeDirectoryModal();
    });
    directoryModalPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.append(modal);
    directoryModalKeydownHandler = event => {
        if (event.key === 'Escape') {
            closeDirectoryModal();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    document.addEventListener('keydown', directoryModalKeydownHandler);
    modal.querySelector('input, select')?.focus();
}

// ===================== STUDENT DIRECTORY AND RECORD ACTIONS =====================
function openStudentEditModal(studentId) {
    const student = store.students.find(item => item.id === studentId);
    if (!student) {
        showToast('This student is no longer in the directory.', 'error');
        return;
    }
    const attendance = Number(student.attendance || 0);
    const status = student.status || 'Active';
    const studentClass = getStudentClassRecord(student);
    openDirectoryModal(`Edit ${student.name}`, `
        <form onsubmit="updateStudent(event, '${escapeHTML(student.id)}')" class="grid gap-3">
            <input name="name" required value="${escapeHTML(student.name)}" placeholder="Student full name" class="rounded-lg border p-2 text-sm">
            <input name="email" type="email" value="${escapeHTML(student.email || '')}" placeholder="Student email (optional)" class="rounded-lg border p-2 text-sm">
            <input name="parentEmail" type="email" value="${escapeHTML(student.parentEmail || '')}" placeholder="Parent / guardian email (for payment updates)" class="rounded-lg border p-2 text-sm">
            <select name="classId" required class="rounded-lg border p-2 text-sm" ${store.classes.length ? '' : 'disabled'}><option value="" disabled ${studentClass ? '' : 'selected'}>Select class</option>${store.classes.map(classroom => `<option value="${escapeHTML(classroom.id)}" ${classroom.id === studentClass?.id ? 'selected' : ''}>${escapeHTML(classroom.name)}</option>`).join('')}</select>
            <input name="parent" required value="${escapeHTML(student.parent || '')}" placeholder="Parent / guardian" class="rounded-lg border p-2 text-sm">
            <div class="grid grid-cols-2 gap-2"><input name="attendance" type="number" min="0" max="100" required value="${attendance}" aria-label="Attendance percentage" class="rounded-lg border p-2 text-sm"><input name="status" required value="${escapeHTML(status)}" placeholder="Status" class="rounded-lg border p-2 text-sm"></div>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save changes</button></div>
        </form>`);
}

// ===================== TEACHER DIRECTORY AND RECORD ACTIONS =====================
function openTeacherEditModal(teacherId) {
    const teacher = store.teachers.find(item => item.id === teacherId);
    if (!teacher) {
        showToast('This teacher is no longer in the directory.', 'error');
        return;
    }
    openDirectoryModal(`Edit ${teacher.name}`, `
        <form onsubmit="updateTeacher(event, '${escapeHTML(teacher.id)}')" class="grid gap-3">
            <input name="name" required value="${escapeHTML(teacher.name)}" placeholder="Teacher full name" class="rounded-lg border p-2 text-sm">
            <input name="email" type="email" required value="${escapeHTML(teacher.email || '')}" placeholder="Teacher email (login)" class="rounded-lg border p-2 text-sm">
            <div class="grid grid-cols-2 gap-2"><input name="subject" required value="${escapeHTML(teacher.subject || '')}" placeholder="Subject" class="rounded-lg border p-2 text-sm"><input name="phone" value="${escapeHTML(teacher.phone || '')}" placeholder="Phone" class="rounded-lg border p-2 text-sm"></div>
            <input name="qualification" value="${escapeHTML(teacher.qualification || '')}" placeholder="Qualification" class="rounded-lg border p-2 text-sm">
            <input name="classes" value="${escapeHTML(getTeacherAssignedClasses(teacher).map(classroom => classroom.name).join(', '))}" placeholder="Classes (comma separated)" class="rounded-lg border p-2 text-sm">
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save changes</button></div>
        </form>`);
}

function openStudentAddModal() {
    openDirectoryModal('Add Student', `
        <form onsubmit="addStudent(event)" class="grid gap-3">
            <input name="name" required placeholder="Student full name" class="rounded-lg border p-2 text-sm">
            <label class="grid gap-1 text-sm font-medium text-slate-700">Class<select name="classId" required class="rounded-lg border p-2 font-normal" ${store.classes.length ? '' : 'disabled'}><option value="" selected disabled>${store.classes.length ? 'Select class' : 'Add a class first'}</option>${store.classes.map(classroom => `<option value="${escapeHTML(classroom.id)}">${escapeHTML(classroom.name)} · ${formatNaira(classroom.feeAmount || 0)} tuition</option>`).join('')}</select></label>
            <input name="parent" required placeholder="Parent / guardian" class="rounded-lg border p-2 text-sm">
            <input name="parentEmail" type="email" placeholder="Parent / guardian email (for payment updates)" class="rounded-lg border p-2 text-sm">
            <input name="email" type="email" placeholder="Student login email (optional)" class="rounded-lg border p-2 text-sm">
            <input name="password" type="password" minlength="12" placeholder="Student login password (required with email)" class="rounded-lg border p-2 text-sm">
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button ${store.classes.length ? '' : 'disabled'} class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">Save student</button></div>
        </form>`);
}

function openStudentRemoveModal() {
    openDirectoryModal('Remove Student', `
        <form onsubmit="removeStudent(event)" class="grid gap-3">
            <label for="removeStudentId" class="text-sm font-medium text-slate-700">Select a student to remove</label>
            <select id="removeStudentId" name="studentId" required class="rounded-lg border p-2 text-sm" ${store.students.length ? '' : 'disabled'}>
                <option value="" selected disabled>${store.students.length ? 'Choose a student' : 'No students to remove'}</option>
                ${store.students.map(student => `<option value="${escapeHTML(student.id)}">${escapeHTML(student.name)} (${escapeHTML(student.id)})</option>`).join('')}
            </select>
            <p class="text-xs text-slate-500">Existing academic and financial history will be retained.</p>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" ${store.students.length ? '' : 'disabled'} class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">Remove student</button></div>
        </form>`);
}

function openTeacherAddModal() {
    openDirectoryModal('Add Teacher', `
        <form onsubmit="addTeacher(event)" class="grid gap-3">
            <input name="name" required placeholder="Teacher full name" class="rounded-lg border p-2 text-sm">
            <input name="email" type="email" required placeholder="Teacher email" class="rounded-lg border p-2 text-sm">
            <input name="password" type="password" minlength="12" required placeholder="Initial password (at least 12 characters)" class="rounded-lg border p-2 text-sm">
            <div class="grid grid-cols-2 gap-2"><input name="subject" required placeholder="Subject" class="rounded-lg border p-2 text-sm"><input name="phone" placeholder="Phone" class="rounded-lg border p-2 text-sm"></div>
            <input name="qualification" placeholder="Qualification" class="rounded-lg border p-2 text-sm">
            <input name="classes" placeholder="Classes (comma separated)" class="rounded-lg border p-2 text-sm">
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save teacher</button></div>
        </form>`);
}

function openTeacherRemoveModal() {
    openDirectoryModal('Remove Teacher', `
        <form onsubmit="removeTeacher(event)" class="grid gap-3">
            <label for="removeTeacherId" class="text-sm font-medium text-slate-700">Select a teacher to remove</label>
            <select id="removeTeacherId" name="teacherId" required class="rounded-lg border p-2 text-sm" ${store.teachers.length ? '' : 'disabled'}>
                <option value="" selected disabled>${store.teachers.length ? 'Choose a teacher' : 'No teachers to remove'}</option>
                ${store.teachers.map(teacher => `<option value="${escapeHTML(teacher.id)}">${escapeHTML(teacher.name)} (${escapeHTML(teacher.id)})</option>`).join('')}
            </select>
            <p class="text-xs text-slate-500">Historical assignments and lesson records will be retained.</p>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" ${store.teachers.length ? '' : 'disabled'} class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">Remove teacher</button></div>
        </form>`);
}

function renderStudents() {
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div><h1 class="text-2xl font-bold text-slate-800">Students</h1><p class="text-slate-500">Manage pupil records and family contacts.</p></div>
            <div class="flex flex-wrap gap-2">
                <button type="button" onclick="openStudentAddModal()" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><i class="fas fa-plus mr-2"></i>Add Student</button>
                <button type="button" onclick="openStudentRemoveModal()" class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><i class="fas fa-user-minus mr-2"></i>Remove Student</button>
            </div>
        </div>
        <div class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div class="border-b border-slate-100 p-4"><input oninput="filterDirectoryRows(this.value, 'studentDirectoryRows')" placeholder="Search students, class or parent..." class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"></div>
            <div class="overflow-x-auto"><table class="w-full min-w-[42rem] text-left text-sm">
                <thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">ID</th><th class="px-4 py-3">Class</th><th class="px-4 py-3">Parent / Guardian</th><th class="px-4 py-3">Actions</th></tr></thead>
                <tbody id="studentDirectoryRows" class="divide-y divide-slate-100">
                    ${store.students.map(student => {
                        const studentClass = studentClassName(student);
                        return `<tr data-search="${escapeHTML(`${student.name} ${student.id} ${studentClass} ${student.parent}`.toLowerCase())}" class="table-row">
                            <td class="px-4 py-3"><p class="font-medium text-slate-800">${escapeHTML(student.name)}</p><p class="text-xs text-slate-400">${escapeHTML(student.email || '')}</p></td>
                            <td class="px-4 py-3 text-slate-500">${escapeHTML(student.id)}</td><td class="px-4 py-3">${escapeHTML(studentClass)}</td>
                            <td class="px-4 py-3">${escapeHTML(student.parent || 'Not set')}</td>
                            <td class="px-4 py-3">
                                <button type="button" onclick="openStudentEditModal('${escapeHTML(student.id)}')" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><i class="fas fa-pen mr-1"></i>Edit</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table></div>
        </div>
    </div>`;
}

async function addStudent(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const classroom = store.classes.find(item => item.id === values.get('classId'));
    if (!classroom) {
        showToast('Select a class before adding the student.', 'error');
        return;
    }
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    if (email && password.length < 12) {
        showToast('A student login password must contain at least 12 characters.', 'error');
        return;
    }
    try {
        await apiRequest('/students', {
            method: 'POST',
            body: JSON.stringify({
                name: String(values.get('name')).trim(),
                email,
                password,
                classId: classroom.id,
                parent: String(values.get('parent')).trim(),
                parentEmail: String(values.get('parentEmail')).trim()
            })
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Student record saved to the school database.', 'success');
        navigateTo('students');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateStudent(event, studentId) {
    event.preventDefault();
    const student = store.students.find(item => item.id === studentId);
    if (!student) {
        showToast('This student is no longer in the directory.', 'error');
        return;
    }

    const values = new FormData(event.currentTarget);
    const classroom = store.classes.find(item => item.id === values.get('classId'));
    if (!classroom) {
        showToast('Select a valid class for this student.', 'error');
        return;
    }
    try {
        await apiRequest(`/students/${encodeURIComponent(student.id)}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: String(values.get('name')).trim(),
                email: String(values.get('email')).trim(),
                classId: classroom.id,
                parent: String(values.get('parent')).trim(),
                parentEmail: String(values.get('parentEmail')).trim(),
                attendance: Number(values.get('attendance')),
                status: String(values.get('status')).trim()
            })
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Student details saved.', 'success');
        navigateTo('students');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function removeStudent(event) {
    event.preventDefault();
    const studentId = String(new FormData(event.currentTarget).get('studentId') || '');
    const studentIndex = store.students.findIndex(student => student.id === studentId);
    if (studentIndex === -1) {
        showToast('Select a student who is still in the directory.', 'error');
        return;
    }

    const student = store.students[studentIndex];
    if (!window.confirm(`Remove ${student.name} from the student directory? Existing academic and financial history will be retained.`)) return;

    try {
        await apiRequest(`/students/${encodeURIComponent(student.id)}`, { method: 'DELETE' });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Student deactivated. Academic and financial history was retained.', 'success');
        navigateTo('students');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderTeachers() {
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div><h1 class="text-2xl font-bold text-slate-800">Teaching Staff</h1><p class="text-slate-500">Staff directory, subjects and class assignments.</p></div>
            <div class="flex flex-wrap gap-2">
                <button type="button" onclick="openTeacherAddModal()" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><i class="fas fa-plus mr-2"></i>Add Teacher</button>
                <button type="button" onclick="openTeacherRemoveModal()" class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><i class="fas fa-user-minus mr-2"></i>Remove Teacher</button>
            </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            ${store.teachers.map(teacher => `<article class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <div class="flex items-start gap-3"><div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 font-bold text-primary-700">${escapeHTML(teacher.name.split(/\s+/).map(part => part[0]).slice(0, 2).join(''))}</div>
                    <div class="min-w-0"><h2 class="font-semibold text-slate-800">${escapeHTML(teacher.name)}</h2><p class="text-sm text-slate-500">${escapeHTML(teacher.subject)}</p></div>
                </div>
                <button type="button" onclick="openTeacherEditModal('${escapeHTML(teacher.id)}')" class="mt-4 inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><i class="fas fa-pen mr-1"></i>Edit teacher</button>
                <dl class="mt-4 space-y-2 text-sm">                <div class="flex justify-between gap-3"><dt class="text-slate-500">Classes</dt><dd class="text-right text-slate-700">${escapeHTML(getTeacherAssignedClasses(teacher).map(classroom => classroom.name).join(', ') || 'Not assigned')}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-slate-500">Qualification</dt><dd class="text-right text-slate-700">${escapeHTML(teacher.qualification || 'Not provided')}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-slate-500">Phone</dt><dd class="text-right text-slate-700">${escapeHTML(teacher.phone || 'Not provided')}</dd></div>
                </dl>
            </article>`).join('')}
        </div>
    </div>`;
}

async function addTeacher(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const classNames = String(values.get('classes')).split(',').map(value => value.trim()).filter(Boolean);
    const assignedClasses = store.classes.filter(classroom => classNames.includes(classroom.name));
    if (assignedClasses.some(classroom => classroom.teacherId || classroom.teacherEmail || classroom.teacher)) {
        showToast('One or more selected classes already have a class teacher.', 'error');
        return;
    }
    try {
        await apiRequest('/teachers', {
            method: 'POST',
            body: JSON.stringify({
                name: String(values.get('name')).trim(),
                email: String(values.get('email')).trim(),
                password: String(values.get('password')),
                subject: String(values.get('subject')).trim(),
                phone: String(values.get('phone')).trim(),
                qualification: String(values.get('qualification')).trim(),
                classNames
            })
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Teacher account and staff record created.', 'success');
        navigateTo('teachers');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateTeacher(event, teacherId) {
    event.preventDefault();
    const teacher = store.teachers.find(item => item.id === teacherId);
    if (!teacher) {
        showToast('This teacher is no longer in the directory.', 'error');
        return;
    }

    const values = new FormData(event.currentTarget);
    const updatedRecord = {
        name: String(values.get('name')).trim(),
        email: String(values.get('email')).trim(),
        subject: String(values.get('subject')).trim(),
        phone: String(values.get('phone')).trim(),
        qualification: String(values.get('qualification')).trim(),
        classNames: String(values.get('classes')).split(',').map(value => value.trim()).filter(Boolean)
    };
    const conflictingClass = store.classes.find(classroom =>
        updatedRecord.classNames.includes(classroom.name)
        && (
            (classroom.teacherId && classroom.teacherId !== teacher.id)
            || (classroom.teacher && classroom.teacher !== teacher.name)
        )
    );
    if (conflictingClass) {
        showToast(`${conflictingClass.name} is already assigned to another class teacher.`, 'error');
        return;
    }
    try {
        await apiRequest(`/teachers/${encodeURIComponent(teacher.id)}`, {
            method: 'PUT',
            body: JSON.stringify(updatedRecord)
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Teacher account and staff details saved.', 'success');
        navigateTo('teachers');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function removeTeacher(event) {
    event.preventDefault();
    const teacherId = String(new FormData(event.currentTarget).get('teacherId') || '');
    const teacherIndex = store.teachers.findIndex(teacher => teacher.id === teacherId);
    if (teacherIndex === -1) {
        showToast('Select a teacher who is still in the directory.', 'error');
        return;
    }

    const teacher = store.teachers[teacherIndex];
    if (!window.confirm(`Remove ${teacher.name} from the teaching staff directory? Historical assignments and lesson records will be retained.`)) return;

    try {
        await apiRequest(`/teachers/${encodeURIComponent(teacher.id)}`, { method: 'DELETE' });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Teacher deactivated; teaching records were retained.', 'success');
        navigateTo('teachers');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== CLASS DIRECTORY AND RECORD ACTIONS =====================
function openClassAddModal() {
    openDirectoryModal('Add Class', `
        <form onsubmit="addClass(event)" class="grid gap-3">
            <input name="name" required placeholder="Class name (e.g. Primary 5B)" class="rounded-lg border p-2 text-sm">
            <input name="room" required placeholder="Room" class="rounded-lg border p-2 text-sm">
            <select name="teacher" class="rounded-lg border p-2 text-sm"><option value="">Select class teacher</option>${store.teachers.map(teacher => `<option value="${escapeHTML(teacher.id)}">${escapeHTML(teacher.name)}</option>`).join('')}</select>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save class</button></div>
        </form>`);
}

function openClassEditModal(classId) {
    const classroom = store.classes.find(item => item.id === classId);
    if (!classroom) {
        showToast('This class is no longer in the directory.', 'error');
        return;
    }
    openDirectoryModal(`Edit ${classroom.name}`, `
        <form onsubmit="updateClass(event, '${escapeHTML(classroom.id)}')" class="grid gap-3">
            <input name="name" required value="${escapeHTML(classroom.name)}" placeholder="Class name (e.g. Primary 5B)" class="rounded-lg border p-2 text-sm">
            <input name="room" required value="${escapeHTML(classroom.room || '')}" placeholder="Room" class="rounded-lg border p-2 text-sm">
            <select name="teacher" class="rounded-lg border p-2 text-sm"><option value="">Select class teacher</option>${store.teachers.map(teacher => `<option value="${escapeHTML(teacher.id)}" ${teacher.id === classroom.teacherId || teacher.name === classroom.teacher ? 'selected' : ''}>${escapeHTML(teacher.name)}</option>`).join('')}</select>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save changes</button></div>
        </form>`);
}

function openClassRemoveModal() {
    openDirectoryModal('Remove Class', `
        <form onsubmit="removeClass(event)" class="grid gap-3">
            <label for="removeClassId" class="text-sm font-medium text-slate-700">Select a class to remove</label>
            <select id="removeClassId" name="classId" required class="rounded-lg border p-2 text-sm" ${store.classes.length ? '' : 'disabled'}>
                <option value="" selected disabled>${store.classes.length ? 'Choose a class' : 'No classes to remove'}</option>
                ${store.classes.map(classroom => `<option value="${escapeHTML(classroom.id)}">${escapeHTML(classroom.name)} (${escapeHTML(classroom.id)})</option>`).join('')}
            </select>
            <p class="text-xs text-slate-500">This will only remove the class record and keep student history intact.</p>
            <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeDirectoryModal()" class="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" ${store.classes.length ? '' : 'disabled'} class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">Remove class</button></div>
        </form>`);
}

function renderClasses() {
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div><h1 class="text-2xl font-bold text-slate-800">Classes & Rooms</h1><p class="text-slate-500">Class lists, room assignments and class teachers.</p></div>
            <div class="flex flex-wrap gap-2">
                <button type="button" onclick="openClassAddModal()" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><i class="fas fa-plus mr-2"></i>Add Class</button>
                <button type="button" onclick="openClassRemoveModal()" class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><i class="fas fa-user-minus mr-2"></i>Remove Class</button>
            </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            ${store.classes.map(classroom => {
                const members = store.students.filter(student => studentClassName(student) === classroom.name || student.grade === classroom.name);
                return `<article class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div class="flex items-center justify-between"><div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><i class="fas fa-school"></i></div><span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">${members.length} listed</span></div>
                    <h2 class="mt-4 text-lg font-bold text-slate-800">${escapeHTML(classroom.name)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHTML(classroom.room || 'Room not assigned')}</p>
                    <p class="mt-3 text-sm text-slate-600"><i class="fas fa-user-tie mr-2 text-primary-600"></i>${escapeHTML(classroom.teacher || 'Class teacher not assigned')}</p>
                    <div class="mt-4 flex gap-2">
                        <button type="button" onclick="openClassEditModal('${escapeHTML(classroom.id)}')" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><i class="fas fa-pen mr-1"></i>Edit</button>
                    </div>
                </article>`;
            }).join('')}
        </div>
    </div>`;
}

async function addClass(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get('name')).trim();
    const teacher = store.teachers.find(item => item.id === values.get('teacher'));
    if (store.classes.some(classroom => classroom.name.toLowerCase() === name.toLowerCase())) {
        showToast('A class with this name already exists.', 'error');
        return;
    }
    try {
        await apiRequest('/classes', {
            method: 'POST',
            body: JSON.stringify({ name, room: String(values.get('room')).trim(), teacherId: teacher?.id || '' })
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Class saved to the school database.', 'success');
        navigateTo('classes');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateClass(event, classId) {
    event.preventDefault();
    const classroom = store.classes.find(item => item.id === classId);
    if (!classroom) {
        showToast('This class is no longer in the directory.', 'error');
        return;
    }

    const values = new FormData(event.currentTarget);
    const name = String(values.get('name')).trim();
    if (store.classes.some(item => item.id !== classId && item.name.toLowerCase() === name.toLowerCase())) {
        showToast('A class with this name already exists.', 'error');
        return;
    }
    const newTeacher = store.teachers.find(item => item.id === values.get('teacher'));
    try {
        await apiRequest(`/classes/${encodeURIComponent(classroom.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ name, room: String(values.get('room')).trim(), teacherId: newTeacher?.id || '' })
        });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Class details saved.', 'success');
        navigateTo('classes');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function removeClass(event) {
    event.preventDefault();
    const classId = String(new FormData(event.currentTarget).get('classId') || '');
    const classIndex = store.classes.findIndex(classroom => classroom.id === classId);
    if (classIndex === -1) {
        showToast('Select a class that is still in the directory.', 'error');
        return;
    }

    const classroom = store.classes[classIndex];
    if (store.students.some(student => student.classId === classroom.id)) {
        showToast('Reassign the students in this class before removing it.', 'error');
        return;
    }
    if (!window.confirm(`Remove ${classroom.name} from the class directory? Student history will be retained.`)) return;

    try {
        await apiRequest(`/classes/${encodeURIComponent(classroom.id)}`, { method: 'DELETE' });
        await loadStoreData();
        closeDirectoryModal();
        showToast('Class removed from the database.', 'success');
        navigateTo('classes');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== TEACHER-ASSIGNED CLASS AND STUDENT VIEWS =====================
function renderMyClasses() {
    const assignedClasses = getTeacherAssignedClasses();
    return `<div class="space-y-6"><div><h1 class="text-2xl font-bold text-slate-800">My Classes</h1><p class="text-slate-500">Your class assignments and pupil counts.</p></div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">${assignedClasses.map(item => `<article class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><p class="text-sm text-primary-700">${escapeHTML(item.room)}</p><h2 class="mt-2 text-xl font-bold text-slate-800">${escapeHTML(item.name)}</h2><p class="mt-2 text-sm text-slate-500">${store.students.filter(student => student.classId === item.id).length} pupil records in this class</p></article>`).join('') || '<p class="rounded-xl bg-white p-6 text-slate-500">No classes have been assigned yet.</p>'}</div>
    </div>`;
}

function renderMyStudents() {
    const students = getTeacherAssignedStudents();
    return `<div class="space-y-6"><div><h1 class="text-2xl font-bold text-slate-800">My Students</h1><p class="text-slate-500">Pupils in your assigned classes.</p></div>
        <div class="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Class</th><th class="px-4 py-3">Parent / Guardian</th><th class="px-4 py-3">Attendance</th></tr></thead><tbody class="divide-y divide-slate-100">${students.map(student => `<tr><td class="px-4 py-3 font-medium">${escapeHTML(student.name)}</td><td class="px-4 py-3">${escapeHTML(studentClassName(student))}</td><td class="px-4 py-3">${escapeHTML(student.parent)}</td><td class="px-4 py-3 text-primary-700">${Number(student.attendance || 0)}%</td></tr>`).join('') || '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">No pupils are assigned to your classes yet.</td></tr>'}</tbody></table></div>
    </div>`;
}
