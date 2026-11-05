// ===================== 3. ASSIGNMENTS (Teacher Upload & Student Sync) =====================
// ===================== TEACHER ASSIGNMENT MANAGEMENT =====================
function renderTeacherAssignments() {
    return `
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">Class Assignments Manager</h1>
                <p class="text-slate-500">Upload assignments that automatically sync to the student assignment dashboard</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Assignment Upload Form -->
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 class="font-bold text-slate-800 text-base"><i class="fas fa-upload text-primary-600 mr-2"></i> Post New Assignment</h3>
                <form onsubmit="handleTeacherUploadAssignment(event)" class="space-y-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Assignment Title</label>
                        <input type="text" id="asgTitle" required class="w-full p-2 border rounded-lg text-sm" placeholder="e.g. Quadratic Equations">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Subject</label>
                        <input type="text" id="asgSubject" required class="w-full p-2 border rounded-lg text-sm" placeholder="e.g. Mathematics">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Target Class</label>
                        <select id="asgClass" required class="w-full p-2 border rounded-lg text-sm" ${store.classes.length ? '' : 'disabled'}>
                            <option value="" selected disabled>${store.classes.length ? 'Select an assigned class' : 'No classes are assigned'}</option>
                            ${getTeacherAssignedClasses().map(classroom => `<option value="${escapeHTML(classroom.name)}">${escapeHTML(classroom.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
                        <input type="date" id="asgDueDate" required class="w-full p-2 border rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Instructions / Description</label>
                        <textarea id="asgDesc" rows="3" required class="w-full p-2 border rounded-lg text-sm" placeholder="Provide instructions..."></textarea>
                    </div>
                    <button type="submit" class="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 shadow transition">Publish Assignment</button>
                </form>
            </div>

            <!-- Uploaded Assignments List -->
            <div class="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 class="font-bold text-slate-800 text-base">Published Assignments (${store.assignments.length})</h3>
                <div class="space-y-3" id="teacherAssignmentList">
                    ${store.assignments.map(a => `
                        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div>
                                <span class="px-2 py-0.5 bg-primary-100 text-primary-800 rounded font-semibold text-xs">${a.class} ·${a.subject}</span>
                                <h4 class="font-bold text-slate-800 mt-1">${a.title}</h4>
                                <p class="text-xs text-slate-600 mt-0.5">${a.description}</p>
                                <p class="text-xs text-slate-400 mt-2"><i class="fas fa-calendar mr-1"></i> Due Date: ${a.dueDate}</p>
                            </div>
                            <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Active</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

// ===================== ASSIGNMENT SUBMISSION =====================
async function handleTeacherUploadAssignment(event) {
    event.preventDefault();
    try {
        await apiRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('asgTitle').value.trim(),
                subject: document.getElementById('asgSubject').value.trim(),
                className: document.getElementById('asgClass').value,
                dueDate: document.getElementById('asgDueDate').value,
                description: document.getElementById('asgDesc').value.trim()
            })
        });
        await loadStoreData();
        showToast('Assignment saved and published.', 'success');
        navigateTo('teacherAssignments');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
