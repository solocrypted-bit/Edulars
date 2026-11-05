// ===================== 4. STUDENT ASSIGNMENT VIEW =====================
// ===================== STUDENT ASSIGNMENT VIEW =====================
function renderStudentAssignments() {
    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">My Assignments Dashboard</h1>
            <p class="text-slate-500">Assignments uploaded by your teachers for your class</p>
        </div>

        <div class="space-y-4">
            ${store.assignments.length === 0 ? '<p class="text-slate-500">There are no active assignments for your class.</p>' : store.assignments.map(a => {
                const submission = store.assignmentSubmissions.find(item => item.assignmentId === a.id);
                return `
                <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 bg-primary-100 text-primary-800 rounded-full text-xs font-bold">${escapeHTML(a.subject)}</span>
                            <span class="text-xs text-slate-400">Teacher: ${escapeHTML(a.teacher)}</span>
                        </div>
                        <h3 class="font-bold text-slate-800 text-lg">${escapeHTML(a.title)}</h3>
                        <p class="text-sm text-slate-600">${escapeHTML(a.description)}</p>
                        <p class="text-xs font-semibold text-amber-600 mt-2"><i class="fas fa-clock mr-1"></i> Due By: ${escapeHTML(a.dueDate)}</p>
                    </div>
                    <form onsubmit="submitAssignment(event, '${escapeHTML(a.id)}')" class="grid w-full max-w-md gap-2">
                        <textarea name="response" required maxlength="10000" rows="3" placeholder="Write your assignment response" class="w-full rounded-lg border p-2 text-sm">${escapeHTML(submission?.response || '')}</textarea>
                        <button class="justify-self-end px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                            ${submission ? 'Update submission' : 'Submit response'}
                        </button>
                        ${submission ? `<span class="text-right text-xs text-slate-500">Last saved ${escapeHTML(new Date(submission.submittedAt).toLocaleString())}</span>` : ''}
                    </form>
                </div>
            `}).join('')}
        </div>
    </div>`;
}

async function submitAssignment(event, assignmentId) {
    event.preventDefault();
    const response = String(new FormData(event.currentTarget).get('response') || '').trim();
    try {
        await apiRequest('/assignment-submissions', {
            method: 'POST',
            body: JSON.stringify({ assignmentId, response })
        });
        await loadStoreData();
        showToast('Assignment response saved.', 'success');
        navigateTo('studentAssignments');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
