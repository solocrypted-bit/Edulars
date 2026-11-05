// ===================== STUDENT CONTEXT AND GRADE DISPLAY =====================
function getCurrentStudent() {
    if (store.currentRole === 'student') {
        return store.students.find(student => student.userId === store.currentUser?.id) || null;
    }
    if (store.currentRole === 'parent') {
        return store.students.find(student => student.parentUserId === store.currentUser?.id) || null;
    }
    return null;
}

function gradeLetter(score) {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

function renderGrades() {
    if (store.currentRole !== 'student') {
        return '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">Student grade records are only available to students.</div>';
    }
    const student = getCurrentStudent();
    const grades = store.grades.filter(grade => grade.studentId === student?.id);
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">My Grades</h1><p class="text-slate-500">Review your subject scores and academic progress.</p></div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-primary-700">${average}%</p><p class="text-sm text-slate-500">Average score</p></div><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-primary-700">${grades.filter(grade => gradeLetter(grade.score) === 'A').length}</p><p class="text-sm text-slate-500">A grades</p></div><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-slate-700">${grades.length}</p><p class="text-sm text-slate-500">Subjects</p></div></div>
        <div class="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm"><table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Subject</th><th class="px-4 py-3">Teacher</th><th class="px-4 py-3">Score</th><th class="px-4 py-3">Grade</th><th class="px-4 py-3">Term</th></tr></thead>
            <tbody class="divide-y divide-slate-100">${grades.map(grade => {
                const score = Number(grade.score);
                return `<tr><td class="px-4 py-3">${escapeHTML(grade.subject)}</td><td class="px-4 py-3 text-slate-500">${escapeHTML(grade.teacher || 'Not assigned')}</td><td class="px-4 py-3"><span class="font-semibold text-primary-700">${score}%</span></td><td class="px-4 py-3"><span class="rounded bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">${gradeLetter(score)}</span></td><td class="px-4 py-3 text-slate-500">${escapeHTML(grade.term || 'Current term')}</td></tr>`;
            }).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">No grades have been recorded yet.</td></tr>'}</tbody>
        </table></div>
    </div>`;
}

function renderGradeEntry() {
    const assignedClasses = store.currentRole === 'teacher' ? getTeacherAssignedClasses() : store.classes;
    const className = assignedClasses[0]?.name || '';
    const students = store.students.filter(student => studentClassName(student) === className);
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">Record Grades</h1><p class="text-slate-500">Save assessment results for students in your authorized classes.</p></div>
        <form onsubmit="recordGrade(event)" class="grid max-w-2xl gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <label class="grid gap-1 text-sm font-medium text-slate-700">Class
                <select id="gradeClass" name="className" required class="rounded-lg border p-2" onchange="updateGradeStudentOptions(this.value)" ${assignedClasses.length ? '' : 'disabled'}>
                    ${assignedClasses.map(item => `<option value="${escapeHTML(item.name)}">${escapeHTML(item.name)}</option>`).join('')}
                </select>
            </label>
            <label class="grid gap-1 text-sm font-medium text-slate-700">Student
                <select id="gradeStudent" name="studentId" required class="rounded-lg border p-2" ${students.length ? '' : 'disabled'}>
                    ${students.map(student => `<option value="${escapeHTML(student.id)}">${escapeHTML(student.name)}</option>`).join('')}
                </select>
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
                <label class="grid gap-1 text-sm font-medium text-slate-700">Subject<input name="subject" required maxlength="100" class="rounded-lg border p-2"></label>
                <label class="grid gap-1 text-sm font-medium text-slate-700">Assessment<input name="assessment" required maxlength="120" placeholder="Assessment name" class="rounded-lg border p-2"></label>
                <label class="grid gap-1 text-sm font-medium text-slate-700">Score (%)<input name="score" type="number" min="0" max="100" required class="rounded-lg border p-2"></label>
                <label class="grid gap-1 text-sm font-medium text-slate-700">Term<input name="term" value="${escapeHTML(store.settings.term || 'Current Term')}" class="rounded-lg border p-2"></label>
            </div>
            <label class="grid gap-1 text-sm font-medium text-slate-700">Remark<textarea name="remark" rows="3" maxlength="1000" class="rounded-lg border p-2"></textarea></label>
            <button ${assignedClasses.length && students.length ? '' : 'disabled'} class="justify-self-end rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Save grade</button>
            ${assignedClasses.length ? '' : '<p class="text-sm text-slate-500">No classes are assigned to your account.</p>'}
        </form>
        <p class="text-sm text-slate-500">${store.grades.length} grade records are currently available to your account.</p>
    </div>`;
}

function updateGradeStudentOptions(className) {
    const select = document.getElementById('gradeStudent');
    if (!select) return;
    const students = store.students.filter(student => studentClassName(student) === className);
    select.innerHTML = students.map(student => `<option value="${escapeHTML(student.id)}">${escapeHTML(student.name)}</option>`).join('');
    select.disabled = students.length === 0;
    const submit = select.form?.querySelector('button[type="submit"], button:not([type])');
    if (submit) submit.disabled = students.length === 0;
}

async function recordGrade(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = {
        studentId: String(values.get('studentId') || ''),
        subject: String(values.get('subject') || '').trim(),
        assessment: String(values.get('assessment') || '').trim(),
        score: Number(values.get('score')),
        term: String(values.get('term') || '').trim(),
        remark: String(values.get('remark') || '').trim()
    };
    try {
        await apiRequest('/academics/grades', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        await loadStoreData();
        showToast('Grade saved to the school database.', 'success');
        navigateTo('gradeEntry');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== LESSON PLAN CLASSIFICATION AND DISPLAY =====================
const LESSON_PLAN_STAGES = [
    { id: 'toddlers', label: 'Toddlers' },
    { id: 'nursery', label: 'Nursery' },
    { id: 'primary', label: 'Primary' },
    { id: 'secondary', label: 'Secondary' }
];

const LESSON_PLAN_CLASSES = {
    toddlers: ['Creche'],
    nursery: ['Nursery 1', 'Nursery 2', 'Nursery 3'],
    primary: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
    secondary: ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3']
};

let selectedLessonPlanClass = null;
let selectedLessonPlan = null;

function getLessonPlanClassLabel(className) {
    const normalizedClass = String(className || '').toLowerCase();
    if (/\bcreche\b|\bcrèche\b|\btoddler|\btoddlers/.test(normalizedClass)) return 'Creche';
    const nursery = normalizedClass.match(/\bnursery\s*([1-3])(?:[a-z])?\b/);
    if (nursery) return `Nursery ${nursery[1]}`;
    const primary = normalizedClass.match(/\b(?:primary|prymary|grade)\s*([1-6])(?:[a-z])?\b/);
    if (primary) return `Grade ${primary[1]}`;
    const juniorSecondary = normalizedClass.match(/\b(?:jss|junior secondary)\s*([1-3])(?:[a-z])?\b/);
    if (juniorSecondary) return `JSS ${juniorSecondary[1]}`;
    const seniorSecondary = normalizedClass.match(/\b(?:sss|ss|senior secondary)\s*([1-3])(?:[a-z])?\b/);
    if (seniorSecondary) return `SS ${seniorSecondary[1]}`;
    const secondary = normalizedClass.match(/\bsecondary\s*([1-3])(?:[a-z])?\b/);
    if (secondary) return `JSS ${secondary[1]}`;
    return '';
}

function getLessonPlanStage(className) {
    const label = getLessonPlanClassLabel(className);
    if (label === 'Creche') return 'toddlers';
    if (label.startsWith('Nursery ')) return 'nursery';
    if (label.startsWith('Grade ')) return 'primary';
    if (label.startsWith('JSS ') || label.startsWith('SS ')) return 'secondary';
    return '';
}

function getLessonPlanClass(plan) {
    const classroom = store.classes.find(item => item.id === plan.classId || item.name === plan.class);
    return getLessonPlanClassLabel(plan.class || classroom?.name || classroom?.grade);
}

function groupLessonPlansBySubject(plans) {
    const subjects = new Map();
    plans.forEach(plan => {
        const subject = String(plan.subject || 'Unspecified subject').trim() || 'Unspecified subject';
        if (!subjects.has(subject)) subjects.set(subject, []);
        subjects.get(subject).push(plan);
    });
    return [...subjects.entries()];
}

function selectLessonPlanClass(classLabel) {
    selectedLessonPlanClass = selectedLessonPlanClass === classLabel ? null : classLabel;
    navigateTo('lessonPlans');
}

function openLessonPlan(button) {
    const planIndex = Number(button.dataset.planIndex);
    const plan = store.lessonPlans[planIndex];
    if (!Number.isInteger(planIndex) || !plan || !isLessonPlanVisibleToCurrentUser(plan)) {
        showToast('This lesson plan is no longer available.', 'error');
        return;
    }
    selectedLessonPlan = plan;
    navigateTo('lessonPlans');
}

function isLessonPlanVisibleToCurrentUser(plan) {
    if (store.currentRole === 'admin') return plan.status === 'Submitted';
    if (store.currentRole === 'teacher') {
        return Boolean(store.currentUser
            && (plan.teacherId === store.currentUser.id || plan.teacher === store.currentUser.name));
    }
    return plan.status === 'Approved';
}

function editSavedLessonPlan(planId) {
    const plan = store.lessonPlans.find(item => item.id === planId);
    if (!plan || store.currentRole !== 'teacher' || !isLessonPlanVisibleToCurrentUser(plan)) {
        showToast('This lesson plan is not available to your teacher account.', 'error');
        return;
    }
    const classroom = store.classes.find(item => item.id === plan.classId);
    if (!classroom || !getTeacherAssignedClasses().some(item => item.id === classroom.id)) {
        showToast('You can only edit lesson plans for your assigned classes.', 'error');
        return;
    }
    lessonNoteEditingPlanId = plan.id;
    selectedLessonPlan = null;
    navigateTo('writeLessonNote');
}

async function submitSavedLessonPlan(planId) {
    const plan = store.lessonPlans.find(item => item.id === planId);
    if (!plan || !isLessonPlanVisibleToCurrentUser(plan) || store.currentRole !== 'teacher') {
        showToast('This saved lesson plan is not available to your teacher account.', 'error');
        return;
    }
    if (plan.status !== 'Draft') {
        showToast('This lesson plan has already been submitted to the administrator.', 'error');
        return;
    }
    const classroom = store.classes.find(item => item.id === plan.classId);
    if (!classroom || !getTeacherAssignedClasses().some(item => item.id === classroom.id)) {
        showToast('You can only submit lesson plans for your assigned classes.', 'error');
        return;
    }
    try {
        await apiRequest(`/academics/lesson-plans/${encodeURIComponent(plan.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'Submitted' })
        });
        await loadStoreData();
        showToast('Lesson plan submitted to the administrator for review.', 'success');
        navigateTo('lessonPlans');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function closeLessonPlan() {
    selectedLessonPlan = null;
    navigateTo('lessonPlans');
}

async function reviewLessonPlan(planId, status) {
    if (store.currentRole !== 'admin' || !['Approved', 'Rejected'].includes(status)) return;
    try {
        await apiRequest(`/academics/lesson-plans/${encodeURIComponent(planId)}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadStoreData();
        selectedLessonPlan = null;
        showToast(`Lesson plan ${status.toLowerCase()}.`, 'success');
        navigateTo('lessonPlans');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderLessonPlanCard(plan) {
    const planIndex = store.lessonPlans.indexOf(plan);
    return `<button type="button" data-plan-index="${planIndex}" onclick="openLessonPlan(this)" aria-label="Open ${escapeHTML(plan.subject || 'lesson')} lesson plan: ${escapeHTML(plan.title || 'Untitled')}" class="block w-full rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase text-primary-700">${escapeHTML(plan.subject || 'Unspecified subject')} · ${escapeHTML(plan.class || 'Class not specified')}</p><h3 class="mt-1 text-lg font-bold text-slate-800">${escapeHTML(plan.title || 'Untitled lesson plan')}</h3></div><span class="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">${escapeHTML(plan.status || 'Submitted')}</span></div>
        <div class="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-slate-500"><span><i class="fas fa-calendar mr-1"></i>${escapeHTML(plan.date || 'Date not set')}</span><span>${escapeHTML(plan.duration || '40 minutes')}</span><span>${escapeHTML(plan.teacher || '')}</span></div>
        <span class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">Open full lesson plan <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
    </button>`;
}

function renderLessonPlanDetail(plan) {
    const details = [
        { label: 'Materials and preparation', value: plan.materials }
    ].filter(detail => String(detail.value || '').trim());
    const lessonContent = typeof plan.content === 'string' && plan.content.trim()
        ? sanitizeLessonNoteHtml(plan.content)
        : '';
    return `<div class="fixed inset-0 z-[100] flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="fullLessonPlanTitle">
        <header class="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-8">
            <button type="button" onclick="closeLessonPlan()" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><i class="fas fa-arrow-left" aria-hidden="true"></i> Back to lesson plans</button>
            <span class="hidden text-sm font-medium text-slate-500 sm:block">Full lesson plan</span>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
            <article class="mx-auto max-w-5xl">
                <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                    <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary-700"><span>${escapeHTML(plan.subject || 'Unspecified subject')}</span><span aria-hidden="true">·</span><span>${escapeHTML(plan.class || 'Class not specified')}</span></div>
                    <h1 id="fullLessonPlanTitle" class="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">${escapeHTML(plan.title || 'Untitled lesson plan')}</h1>
                    <div class="mt-6 grid gap-3 border-y border-slate-100 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p><p class="mt-1 font-medium text-slate-800">${escapeHTML(plan.date || 'Not set')}</p></div>
                        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</p><p class="mt-1 font-medium text-slate-800">${escapeHTML(plan.duration || '40 minutes')}</p></div>
                        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher</p><p class="mt-1 font-medium text-slate-800">${escapeHTML(plan.teacher || 'Not specified')}</p></div>
                        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p><p class="mt-1 font-medium text-slate-800">${escapeHTML(plan.status || 'Submitted')}</p></div>
                    </div>
                    <div class="mt-8 space-y-8">${lessonContent ? `<section><h2 class="text-lg font-bold text-slate-800">Lesson note</h2><div class="lesson-plan-content mt-3 overflow-x-auto text-base leading-8 text-slate-700">${lessonContent}</div></section>` : ''}${details.map(detail => `<section><h2 class="text-lg font-bold text-slate-800">${detail.label}</h2><div class="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-700">${escapeHTML(detail.value)}</div></section>`).join('') || (!lessonContent ? '<p class="text-slate-500">No lesson details have been added to this plan yet.</p>' : '')}</div>
                    ${store.currentRole === 'admin' && plan.status === 'Submitted' ? `<div class="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onclick="reviewLessonPlan('${escapeHTML(plan.id)}', 'Rejected')" class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Reject</button><button type="button" onclick="reviewLessonPlan('${escapeHTML(plan.id)}', 'Approved')" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Approve</button></div>` : ''}
                </div>
            </article>
        </div>
    </div>`;
}

// ===================== LESSON PLAN BROWSING AND SUBMISSION =====================
function renderLessonPlans() {
    const plans = store.lessonPlans.filter(isLessonPlanVisibleToCurrentUser);
    if (selectedLessonPlan && !plans.includes(selectedLessonPlan)) selectedLessonPlan = null;
    if (selectedLessonPlan) return renderLessonPlanDetail(selectedLessonPlan);
    if (store.currentRole === 'admin' && selectedLessonPlanClass
        && !Object.values(LESSON_PLAN_CLASSES).flat().includes(selectedLessonPlanClass)) {
        selectedLessonPlanClass = null;
    }
    const categorizedPlans = LESSON_PLAN_STAGES.map(stage => ({
        ...stage,
        classes: LESSON_PLAN_CLASSES[stage.id].map(classLabel => ({
            label: classLabel,
            plans: plans.filter(plan => getLessonPlanClass(plan) === classLabel)
        }))
    }));
    const teacherPlans = store.currentRole === 'teacher'
        ? plans.filter(plan => isLessonPlanVisibleToCurrentUser(plan))
        : [];
    const selectedClassPlans = plans.filter(plan => getLessonPlanClass(plan) === selectedLessonPlanClass);
    if (store.currentRole === 'teacher') {
        return `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div><h1 class="text-2xl font-bold text-slate-800">Saved Lesson Plans</h1><p class="text-slate-500">View, edit, and submit your saved lesson plans to the administrator.</p></div>
            </div>
            <div class="space-y-3">
                ${teacherPlans.map(plan => `<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div><p class="text-xs font-semibold uppercase text-primary-700">${escapeHTML(plan.subject || 'Unspecified subject')} · ${escapeHTML(plan.class || 'Class not specified')}</p><h2 class="mt-1 text-lg font-bold text-slate-800">${escapeHTML(plan.title || 'Untitled lesson plan')}</h2><p class="mt-1 text-sm text-slate-500">${escapeHTML(plan.date || 'Date not set')}</p></div>
                        <span class="rounded-full ${plan.status === 'Draft' ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'} px-3 py-1 text-xs font-semibold">${plan.status === 'Draft' ? 'Saved · Not submitted' : 'Submitted to admin'}</span>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" data-plan-index="${store.lessonPlans.indexOf(plan)}" onclick="openLessonPlan(this)" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">View lesson plan</button>
                        ${plan.status === 'Draft' ? `<button type="button" onclick="submitSavedLessonPlan('${escapeHTML(plan.id)}')" class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700">Submit to admin</button>` : ''}
                        <button type="button" onclick="editSavedLessonPlan('${escapeHTML(plan.id)}')" class="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"><i class="fas fa-pen mr-1" aria-hidden="true"></i>Edit lesson plan</button>
                    </div>
                </article>`).join('') || '<p class="rounded-xl bg-white p-5 text-sm text-slate-500">No saved lesson plans yet. Write a lesson note and save it first.</p>'}
            </div>
        </div>`;
    }
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">${store.currentRole === 'admin' ? 'View Lesson Plans' : 'Lesson Plans'}</h1><p class="text-slate-500">${store.currentRole === 'admin' ? 'Choose a class to review submitted lesson plans by subject.' : 'Review lesson plans by school section.'}</p></div>
        ${store.currentRole === 'admin' ? `<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">${categorizedPlans.map(stage => `<section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-labelledby="lessonPlan-${stage.id}">
            <h2 id="lessonPlan-${stage.id}" class="text-lg font-bold text-slate-800">${stage.label}</h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">${stage.classes.map(classroom => `<button type="button" onclick="selectLessonPlanClass('${classroom.label}')" aria-pressed="${selectedLessonPlanClass === classroom.label}" class="flex items-center justify-between gap-2 rounded-lg border ${selectedLessonPlanClass === classroom.label ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'} px-3 py-2 text-left text-sm font-semibold">${classroom.label}<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${classroom.plans.length}</span></button>`).join('')}</div>
        </section>`).join('')}</div>
        ${selectedLessonPlanClass ? `<section class="space-y-4 rounded-xl border border-primary-200 bg-white p-5" aria-labelledby="selectedLessonPlanClass">
            <div class="flex items-center justify-between gap-3"><h2 id="selectedLessonPlanClass" class="text-xl font-bold text-slate-800">${selectedLessonPlanClass} lesson plans</h2><button type="button" onclick="selectLessonPlanClass('${selectedLessonPlanClass}')" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Close</button></div>
            ${groupLessonPlansBySubject(selectedClassPlans).map(([subject, subjectPlans]) => `<section class="space-y-3"><h3 class="border-b border-slate-100 pb-2 font-semibold text-primary-800">${escapeHTML(subject)}</h3><div class="grid gap-3 lg:grid-cols-2">${subjectPlans.map(renderLessonPlanCard).join('')}</div></section>`).join('') || '<p class="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No lesson plans have been submitted for this class yet.</p>'}
        </section>` : '<p class="rounded-xl bg-white p-4 text-sm text-slate-500">Select a class above to view its lesson plans by subject.</p>'}` : ''}
        ${!['admin', 'teacher'].includes(store.currentRole) ? `<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">${categorizedPlans.map(stage => `<section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-labelledby="lessonPlan-${stage.id}"><h2 id="lessonPlan-${stage.id}" class="text-lg font-bold text-slate-800">${stage.label}</h2><div class="grid gap-3">${stage.classes.flatMap(classroom => classroom.plans).map(renderLessonPlanCard).join('') || '<p class="rounded-lg bg-white p-4 text-sm text-slate-500">No lesson plans in this section yet.</p>'}</div></section>`).join('')}</div>` : ''}
    </div>`;
}

// ===================== STUDENT AND PARENT ATTENDANCE VIEW =====================
function renderAttendanceOverview() {
    if (!['student', 'parent'].includes(store.currentRole)) {
        return '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">Attendance records are only available to students and parents.</div>';
    }
    const date = new Date().toISOString().slice(0, 10);
    const visibleStudents = [getCurrentStudent()].filter(Boolean);
    const dayRecords = store.dailyAttendance[date] || {};
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">My Attendance</h1><p class="text-slate-500">Daily attendance records for ${escapeHTML(date)}.</p></div>
        <div class="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Student</th><th class="px-4 py-3">Class</th><th class="px-4 py-3">Date</th><th class="px-4 py-3">Status</th></tr></thead><tbody class="divide-y divide-slate-100">${visibleStudents.map(student => `<tr><td class="px-4 py-3 font-medium">${escapeHTML(student.name)}</td><td class="px-4 py-3">${escapeHTML(studentClassName(student))}</td><td class="px-4 py-3">${escapeHTML(date)}</td><td class="px-4 py-3"><span class="font-semibold text-primary-700">${escapeHTML(dayRecords[student.id] || 'Present')}</span></td></tr>`).join('')}</tbody></table></div>
    </div>`;
}
