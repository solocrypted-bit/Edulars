// ===================== LIBRARY AND BOOK CHECKOUT =====================
function renderLibrary() {
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold text-slate-800">School Library</h1><p class="text-slate-500">Browse resources and track available copies.</p></div>${store.currentRole === 'admin' ? `<form onsubmit="addLibraryBook(event)" class="flex flex-wrap gap-2"><input name="title" required placeholder="Book title" class="rounded-lg border px-3 py-2 text-sm"><input name="author" required placeholder="Author" class="rounded-lg border px-3 py-2 text-sm"><input name="category" placeholder="Category" class="rounded-lg border px-3 py-2 text-sm"><input name="copies" type="number" min="0" required placeholder="Copies" class="w-24 rounded-lg border px-3 py-2 text-sm"><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">Add book</button></form>` : ''}</div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="rounded-xl border border-slate-100 bg-white p-4"><p class="text-sm text-slate-500">Titles</p><p class="mt-1 text-2xl font-bold text-slate-800">${store.libraryBooks.length}</p></div><div class="rounded-xl border border-slate-100 bg-white p-4"><p class="text-sm text-slate-500">Copies available</p><p class="mt-1 text-2xl font-bold text-primary-700">${store.libraryBooks.reduce((sum, book) => sum + book.available, 0)}</p></div><div class="rounded-xl border border-slate-100 bg-white p-4"><p class="text-sm text-slate-500">Borrowed</p><p class="mt-1 text-2xl font-bold text-slate-800">${store.libraryBooks.reduce((sum, book) => sum + book.copies - book.available, 0)}</p></div></div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">${store.libraryBooks.map(book => `<article class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase text-primary-700">${escapeHTML(book.category)}</p><h2 class="mt-1 font-bold text-slate-800">${escapeHTML(book.title)}</h2><p class="text-sm text-slate-500">${escapeHTML(book.author)}</p></div><i class="fas fa-book-open text-xl text-primary-600"></i></div>
            <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span class="text-sm text-slate-500">${book.available} of ${book.copies} copies available</span>${book.available > 0 ? `<button onclick="borrowLibraryBook('${escapeHTML(book.id)}')" class="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700">Borrow</button>` : '<span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Unavailable</span>'}</div>
        </article>`).join('')}</div>
        ${store.borrowedBooks?.length ? `<section class="rounded-xl border border-slate-100 bg-white p-4"><h2 class="font-semibold text-slate-800">My borrowed books</h2><div class="mt-3 divide-y divide-slate-100">${store.borrowedBooks.filter(item => item.borrower === store.currentUser.name && !item.returned).map(item => `<div class="flex justify-between gap-3 py-3 text-sm"><span>${escapeHTML(store.libraryBooks.find(book => book.id === item.bookId)?.title || 'Book')}</span><button onclick="returnLibraryBook('${escapeHTML(item.id)}')" class="text-primary-700 hover:underline">Return</button></div>`).join('') || '<p class="py-3 text-sm text-slate-500">You have no borrowed books.</p>'}</div></section>` : ''}
    </div>`;
}

async function borrowLibraryBook(bookId) {
    const book = store.libraryBooks.find(item => item.id === bookId);
    if (!book || book.available < 1) {
        showToast('No copies of this title are currently available.', 'error');
        return;
    }
    try {
        await apiRequest(`/school-life/library/${encodeURIComponent(bookId)}/borrow`, { method: 'POST' });
        await loadStoreData();
        showToast('Book checkout saved.', 'success');
        navigateTo('library');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function returnLibraryBook(borrowId) {
    const record = store.borrowedBooks?.find(item => item.id === borrowId && !item.returned);
    if (!record) {
        showToast('This book is no longer listed as borrowed.', 'error');
        return;
    }
    try {
        await apiRequest(`/school-life/library/returns/${encodeURIComponent(borrowId)}`, { method: 'POST' });
        await loadStoreData();
        showToast('Book return saved.', 'success');
        navigateTo('library');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function addLibraryBook(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        await apiRequest('/school-life/library', {
            method: 'POST',
            body: JSON.stringify({
                title: String(values.get('title')).trim(),
                author: String(values.get('author')).trim(),
                category: String(values.get('category')).trim(),
                copies: Number(values.get('copies'))
            })
        });
        await loadStoreData();
        showToast('Book saved to the library.', 'success');
        navigateTo('library');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== WEEKLY TIMETABLE =====================
function renderTimetable() {
    const days = Object.keys(store.timetable);
    const selectedDay = days[0];
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold text-slate-800">Class Timetable</h1><p class="text-slate-500">Weekly lesson schedule for your school.</p></div>${store.currentRole === 'admin' ? `<form onsubmit="addTimetableEntry(event)" class="flex flex-wrap gap-2"><select name="day" required class="rounded-lg border px-3 py-2 text-sm"><option value="" selected disabled>Day</option>${['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => `<option>${day}</option>`).join('')}</select><input name="period" required placeholder="Period" class="w-24 rounded-lg border px-3 py-2 text-sm"><input name="time" placeholder="Time" class="w-28 rounded-lg border px-3 py-2 text-sm"><select name="className" required class="rounded-lg border px-3 py-2 text-sm"><option value="" selected disabled>Class</option>${store.classes.map(classroom => `<option>${escapeHTML(classroom.name)}</option>`).join('')}</select><input name="subject" required placeholder="Subject" class="w-28 rounded-lg border px-3 py-2 text-sm"><select name="teacher" required class="rounded-lg border px-3 py-2 text-sm"><option value="" selected disabled>Teacher</option>${store.teachers.map(teacher => `<option>${escapeHTML(teacher.name)}</option>`).join('')}</select><input name="room" placeholder="Room" class="w-24 rounded-lg border px-3 py-2 text-sm"><button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">Add period</button></form>` : ''}<select id="timetableDay" onchange="updateTimetable(this.value)" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">${days.map(day => `<option>${escapeHTML(day)}</option>`).join('')}</select></div>
        <div id="timetableContent">${renderTimetableDay(selectedDay)}</div>
    </div>`;
}

async function addTimetableEntry(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        await apiRequest('/school-life/timetable', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(values.entries()))
        });
        await loadStoreData();
        showToast('Timetable period saved.', 'success');
        navigateTo('timetable');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderTimetableDay(day) {
    const periods = store.timetable[day] || [];
    return `<div class="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Time</th><th class="px-4 py-3">Subject / Activity</th><th class="px-4 py-3">Teacher</th><th class="px-4 py-3">Room</th></tr></thead><tbody class="divide-y divide-slate-100">${periods.map(period => `<tr class="${period.subject === 'Break' ? 'bg-primary-50/60' : ''}"><td class="whitespace-nowrap px-4 py-3 font-medium text-slate-700">${escapeHTML(period.time)}</td><td class="px-4 py-3">${escapeHTML(period.subject)}</td><td class="px-4 py-3 text-slate-500">${escapeHTML(period.teacher)}</td><td class="px-4 py-3 text-slate-500">${escapeHTML(period.room)}</td></tr>`).join('')}</tbody></table></div>`;
}

function updateTimetable(day) {
    const container = document.getElementById('timetableContent');
    if (container) container.innerHTML = renderTimetableDay(day);
}

// ===================== SCHOOL ANNOUNCEMENTS =====================
function renderAnnouncements() {
    const canPost = ['admin', 'teacher'].includes(store.currentRole);
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold text-slate-800">Announcements</h1><p class="text-slate-500">School notices and updates for your community.</p></div>${canPost ? `<details class="relative"><summary class="cursor-pointer list-none rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><i class="fas fa-plus mr-2"></i>Post announcement</summary><form onsubmit="postAnnouncement(event)" class="absolute right-0 z-20 mt-2 grid w-[min(90vw,28rem)] gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><input name="title" required placeholder="Announcement title" class="rounded-lg border p-2 text-sm"><textarea name="content" required rows="3" placeholder="Write your notice..." class="rounded-lg border p-2 text-sm"></textarea><div class="grid grid-cols-2 gap-2"><select name="audience" class="rounded-lg border p-2 text-sm"><option>All</option><option>Parents</option><option>Students</option><option>Teachers</option></select><select name="priority" class="rounded-lg border p-2 text-sm"><option>Normal</option><option>High</option></select></div><button class="rounded-lg bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700">Publish notice</button></form></details>` : ''}</div>
        <div class="space-y-4">${[...store.announcements].sort((a, b) => b.date.localeCompare(a.date)).map(item => `<article class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><span class="rounded-full ${item.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-primary-50 text-primary-700'} px-2 py-1 text-xs font-semibold">${escapeHTML(item.priority)} priority</span><span class="ml-2 text-xs text-slate-400">${escapeHTML(item.audience)} · ${escapeHTML(item.date)}</span><h2 class="mt-3 text-lg font-bold text-slate-800">${escapeHTML(item.title)}</h2></div><span class="text-xs text-slate-400">${escapeHTML(item.author)}</span></div><p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">${escapeHTML(item.content)}</p></article>`).join('') || '<p class="rounded-xl bg-white p-6 text-slate-500">There are no announcements yet.</p>'}</div>
    </div>`;
}

async function postAnnouncement(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        await apiRequest('/school-life/announcements', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(values.entries()))
        });
        await loadStoreData();
        showToast('Announcement saved and published.', 'success');
        navigateTo('announcements');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== SCHOOL SETTINGS =====================
function renderSettings() {
    const settings = store.settings;
    return `
    <div class="space-y-6">
        <div><h1 class="text-2xl font-bold text-slate-800">School Settings</h1><p class="text-slate-500">Manage school details and notification preferences.</p></div>
        <form onsubmit="saveSchoolSettings(event)" class="space-y-5">
            <section class="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm"><h2 class="border-b border-slate-100 px-5 py-4 font-semibold text-slate-800">General</h2><label class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span><strong class="block text-slate-700">School name</strong><span class="text-xs text-slate-400">Shown on school pages and notices</span></span><input name="schoolName" required value="${escapeHTML(settings.schoolName)}" class="w-full max-w-sm rounded-lg border px-3 py-2"></label><label class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span><strong class="block text-slate-700">Academic year</strong><span class="text-xs text-slate-400">Current school session</span></span><input name="academicYear" required value="${escapeHTML(settings.academicYear)}" class="w-full max-w-sm rounded-lg border px-3 py-2"></label></section>
            <section class="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm"><h2 class="border-b border-slate-100 px-5 py-4 font-semibold text-slate-800">Preferences</h2>${[['emailNotifications','Email notifications','Receive updates about school activity'],['smsNotifications','SMS notifications','Enable urgent text-message alerts'],['onlinePayments','Online payments','Allow fee payments to be recorded'],['lateFeePenalty','Late fee reminders','Show late-fee reminders for overdue balances']].map(([key,label,description]) => `<label class="flex items-center justify-between gap-4 p-4"><span><strong class="block text-sm text-slate-700">${label}</strong><span class="text-xs text-slate-400">${description}</span></span><input name="${key}" type="checkbox" ${settings[key] ? 'checked' : ''} class="h-4 w-4 accent-primary-600"></label>`).join('')}</section>
            <div class="flex justify-end"><button class="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700">Save settings</button></div>
        </form>
    </div>`;
}

async function saveSchoolSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const settings = {
        schoolName: String(values.get('schoolName')).trim(),
        academicYear: String(values.get('academicYear')).trim()
    };
    for (const key of ['emailNotifications', 'smsNotifications', 'onlinePayments', 'lateFeePenalty']) {
        settings[key] = form.elements[key].checked;
    }
    try {
        await apiRequest('/settings', { method: 'PUT', body: JSON.stringify(settings) });
        await loadStoreData();
        showToast('School settings saved.', 'success');
        navigateTo('settings');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== PARENT AND FAMILY VIEWS =====================
function renderChildProfile() {
    const student = getCurrentStudent();
    if (!student) return '<p class="rounded-xl bg-white p-6 text-slate-500">No linked child profile is available.</p>';
    const grades = store.grades.filter(grade => grade.studentId === student.id);
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
    const feeBalance = store.fees.filter(fee => fee.studentId === student.id).reduce((sum, fee) => sum + Math.max(0, fee.amount - fee.paid), 0);
    return `<div class="space-y-6"><div><h1 class="text-2xl font-bold text-slate-800">Child Profile</h1><p class="text-slate-500">Student information and current school summary.</p></div>
        <section class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"><div class="bg-gradient-to-r from-primary-700 to-primary-900 p-6 text-white"><div class="flex items-center gap-4"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=16a34a&color=fff&size=80" alt="" class="h-16 w-16 rounded-full border-2 border-white/50"><div><h2 class="text-2xl font-bold">${escapeHTML(student.name)}</h2><p class="text-white/80">${escapeHTML(studentClassName(student))} · ${escapeHTML(student.id)}</p></div></div></div>
        <div class="grid grid-cols-1 gap-6 p-6 md:grid-cols-2"><div><h3 class="mb-3 font-semibold text-slate-800">Student details</h3><dl class="space-y-2 text-sm"><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Email</dt><dd>${escapeHTML(student.email || 'Not provided')}</dd></div><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Parent / guardian</dt><dd>${escapeHTML(student.parent || 'Not provided')}</dd></div><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Status</dt><dd>${escapeHTML(student.status || 'Active')}</dd></div></dl></div><div><h3 class="mb-3 font-semibold text-slate-800">Term summary</h3><dl class="space-y-2 text-sm"><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Attendance</dt><dd class="font-semibold text-primary-700">${Number(student.attendance || 0)}%</dd></div><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Average score</dt><dd>${average}%</dd></div><div class="flex justify-between border-b py-2"><dt class="text-slate-500">Fees outstanding</dt><dd>${formatNaira(feeBalance)}</dd></div></dl></div></div></section>
    </div>`;
}

function renderAcademicPerformance() {
    const student = getCurrentStudent();
    if (!student) return '<p class="rounded-xl bg-white p-6 text-slate-500">No linked student record was found.</p>';
    const grades = store.grades.filter(grade => grade.studentId === student.id);
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length) : 0;
    return `<div class="space-y-6"><div><h1 class="text-2xl font-bold text-slate-800">Academic Performance</h1><p class="text-slate-500">Subject results and progress for ${escapeHTML(student.name)}.</p></div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-primary-700">${average}%</p><p class="text-sm text-slate-500">Average score</p></div><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-primary-700">${grades.filter(grade => gradeLetter(Number(grade.score)) === 'A').length}</p><p class="text-sm text-slate-500">A grades</p></div><div class="rounded-xl border border-slate-100 bg-white p-5 text-center"><p class="text-3xl font-bold text-slate-700">${grades.length}</p><p class="text-sm text-slate-500">Subjects recorded</p></div></div>
        <div class="space-y-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><h2 class="font-semibold text-slate-800">Subject breakdown</h2>${grades.map(grade => `<div><div class="mb-1 flex justify-between text-sm"><span>${escapeHTML(grade.subject)}</span><strong class="text-primary-700">${Number(grade.score)}% · ${gradeLetter(Number(grade.score))}</strong></div><div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-primary-600" style="width:${Math.max(0, Math.min(100, Number(grade.score)))}%"></div></div></div>`).join('') || '<p class="text-sm text-slate-500">No marks have been entered yet.</p>'}</div>
    </div>`;
}

function renderTeacherMessages() {
    return `<div class="space-y-6"><div><h1 class="text-2xl font-bold text-slate-800">Teacher Messages</h1><p class="text-slate-500">Send a message to your child’s teaching team.</p></div>
        <form onsubmit="sendTeacherMessage(event)" class="grid gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"><select name="recipientUserId" required class="rounded-lg border p-2 text-sm">${store.teachers.filter(teacher => teacher.userId).map(teacher => `<option value="${escapeHTML(teacher.userId)}">${escapeHTML(teacher.name)}</option>`).join('')}</select><input name="subject" required placeholder="Subject" class="rounded-lg border p-2 text-sm"><textarea name="content" required rows="4" placeholder="Write your message..." class="rounded-lg border p-2 text-sm"></textarea><button ${store.teachers.some(teacher => teacher.userId) ? '' : 'disabled'} class="justify-self-end rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Send message</button></form>
        <div class="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm"><h2 class="px-4 py-3 font-semibold">Inbox and sent messages</h2>${store.messages.map(message => `<article class="px-4 py-3"><div class="flex justify-between gap-3"><h3 class="font-medium text-slate-800">${escapeHTML(message.subject)}</h3><span class="text-xs text-slate-400">${escapeHTML(message.time)}</span></div><p class="mt-1 text-xs text-slate-500">${message.senderUserId === store.currentUser.id ? 'To' : 'From'} ${escapeHTML(message.senderUserId === store.currentUser.id ? message.to : message.from)}</p><p class="mt-2 text-sm text-slate-600">${escapeHTML(message.content || '')}</p></article>`).join('') || '<p class="p-4 text-sm text-slate-500">No messages have been sent or received.</p>'}</div>
    </div>`;
}

async function sendTeacherMessage(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        await apiRequest('/school-life/messages', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(values.entries()))
        });
        await loadStoreData();
        showToast('Message saved and sent.', 'success');
        navigateTo('teacherMessages');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== NOTIFICATIONS, MESSAGES, AND SCHOOL ASSISTANT =====================
function renderActivityPanels() {
    const notificationList = document.getElementById('notificationList');
    const messageList = document.getElementById('messageList');
    const visibleNotifications = store.notifications.filter(item => {
        if (store.currentRole !== 'parent' || item.recipientRole !== 'parent') return true;
        const child = store.students.find(student => student.id === item.studentId);
        return item.recipientParent === store.currentUser?.name
            || item.recipientEmail === store.currentUser?.email
            || child?.parent === store.currentUser?.name;
    });
    if (notificationList) {
        notificationList.innerHTML = visibleNotifications.map(item => `<div class="border-b border-slate-50 p-3 ${item.read ? '' : 'bg-primary-50/40'}">${item.invoiceId ? `<button type="button" onclick="openNotificationInvoice('${escapeHTML(item.invoiceId)}', '${escapeHTML(item.id)}')" class="w-full text-left text-sm text-slate-700 hover:text-primary-700">${escapeHTML(item.text)}</button>` : `<p class="text-sm text-slate-700">${escapeHTML(item.text)}</p>`}<p class="mt-1 text-xs text-slate-400">${escapeHTML(item.time)}</p>${item.emailStatus ? `<p class="mt-1 text-xs ${item.emailStatus === 'queued' ? 'text-amber-700' : item.emailStatus === 'missing' ? 'text-slate-500' : item.emailStatus === 'failed' ? 'text-red-700' : 'text-primary-700'}">${item.emailStatus === 'sent' ? 'Email sent' : item.emailStatus === 'queued' ? 'Email queued; delivery service not configured' : item.emailStatus === 'missing' ? 'No parent email saved' : item.emailStatus === 'failed' ? 'Notification could not be saved' : 'Email pending'}</p>` : ''}</div>`).join('') || '<p class="p-4 text-sm text-slate-500">No notifications.</p>';
    }
    if (messageList) {
        messageList.innerHTML = store.messages.slice(0, 8).map(item => `<div class="rounded-lg p-3 ${item.unread ? 'bg-primary-50/50' : ''}"><p class="truncate text-sm font-medium text-slate-700">${escapeHTML(item.from)}</p><p class="truncate text-xs text-slate-500">${escapeHTML(item.subject)}</p><p class="mt-1 text-xs text-slate-400">${escapeHTML(item.time)}</p></div>`).join('') || '<p class="p-3 text-sm text-slate-500">No messages.</p>';
    }
    const badge = document.getElementById('notificationBadge');
    if (badge) badge.classList.toggle('hidden', !visibleNotifications.some(item => !item.read));
}

function openNotificationInvoice(invoiceId, notificationId) {
    const notification = store.notifications.find(item => item.id === notificationId);
    if (notification) notification.read = true;
    renderActivityPanels();
    openInvoiceModal(invoiceId);
}

function toggleNotifications() {
    document.getElementById('notificationPanel').classList.toggle('hidden');
    document.getElementById('messagePanel').classList.add('hidden');
    document.getElementById('assistantPanel').classList.add('hidden');
}

function toggleMessages() {
    document.getElementById('messagePanel').classList.toggle('hidden');
    document.getElementById('notificationPanel').classList.add('hidden');
    document.getElementById('assistantPanel').classList.add('hidden');
}

function toggleAssistant() {
    document.getElementById('assistantPanel').classList.toggle('hidden');
    document.getElementById('notificationPanel').classList.add('hidden');
    document.getElementById('messagePanel').classList.add('hidden');
}

function markNotificationsRead() {
    store.notifications.forEach(item => {
        const belongsToParent = store.currentRole !== 'parent'
            || item.recipientRole !== 'parent'
            || item.recipientParent === store.currentUser?.name
            || item.recipientEmail === store.currentUser?.email
            || store.students.some(student => student.id === item.studentId && student.parent === store.currentUser?.name);
        if (belongsToParent) item.read = true;
    });
    renderActivityPanels();
}

function sendAssistantPrompt(prompt) {
    const answerBox = document.getElementById('assistantAnswer');
    const query = (prompt || document.getElementById('assistantInput').value).trim();
    if (!query) return;
    const normalized = query.toLowerCase();
    let answer;
    if (normalized.includes('assignment')) {
        answer = `There are ${store.assignments.length} assignments in the school workspace. The next due date is ${store.assignments.map(item => item.dueDate).sort()[0] || 'not set'}.`;
    } else if (normalized.includes('fee') || normalized.includes('payment')) {
        const outstanding = store.fees.reduce((sum, fee) => sum + Math.max(0, fee.amount - fee.paid), 0);
        answer = `The current outstanding balance across fee records is ${formatNaira(outstanding)}. Open Fees & Payments for the student-by-student breakdown.`;
    } else if (normalized.includes('attendance')) {
        answer = `There are ${store.students.length} student records. Open Attendance to review or update today's register.`;
    } else if (normalized.includes('class')) {
        answer = `There are ${store.classes.length} classes in the directory. Open Classes to review rooms and class teachers.`;
    } else {
        answer = 'I can summarize assignments, fee balances, attendance, and class counts from the records available to your account.';
    }
    answerBox.innerHTML = `<p class="font-medium text-slate-700">${escapeHTML(query)}</p><p class="mt-2 text-sm text-slate-600">${escapeHTML(answer)}</p>`;
    document.getElementById('assistantInput').value = '';
}
