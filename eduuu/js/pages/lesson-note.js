let lessonNoteSelection = null;
let pendingLessonNotePdf = null;
let lessonNoteLibraryPromises = {};
let activeLessonNoteTableCell = null;
let activeLessonNoteShape = null;
let lessonNoteHoverHideTimer = null;
let lessonNoteUndoStack = [];
let lessonNotePaginationFrame = null;
let lessonNoteMoveMode = false;
let lessonNoteMoveTarget = null;
let lessonNoteMoveStart = null;
let lessonNoteEditingPlanId = null;

// ===================== UNDO AND OBJECT MOVEMENT =====================
function recordLessonNoteUndoState() {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) return;
    const current = sanitizeLessonNoteHtml(editor.innerHTML);
    if (lessonNoteUndoStack.length && lessonNoteUndoStack[0] === current) return;
    lessonNoteUndoStack.unshift(current);
    if (lessonNoteUndoStack.length > 2) lessonNoteUndoStack.pop();
}

function undoLessonNoteAction() {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor || lessonNoteUndoStack.length === 0) {
        showToast('There is no earlier action to undo.', 'error');
        return;
    }
    const previous = lessonNoteUndoStack.shift();
    editor.innerHTML = previous || '';
    preserveLessonNoteSelection();
    showToast('Last action undone.', 'success');
}

function beginLessonNoteMove(event) {
    const editor = document.getElementById('lessonNoteEditor');
    const target = event?.target;
    const element = target?.closest ? target.closest('table, svg[data-lesson-shape]') : null;
    if (!editor || !element || !editor.contains(element)) return;
    lessonNoteMoveMode = true;
    lessonNoteMoveTarget = element;
    lessonNoteMoveStart = {
        x: event.clientX,
        y: event.clientY,
        left: Number.parseFloat(element.style.left || '0'),
        top: Number.parseFloat(element.style.top || '0')
    };
    element.style.position = 'relative';
    element.style.zIndex = '5';
    element.style.cursor = 'grabbing';
    cancelLessonNoteHoverHide();
    recordLessonNoteUndoState();
}

function moveLessonNoteTarget(event) {
    if (!lessonNoteMoveMode || !lessonNoteMoveTarget || !event) return;
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) return;
    const deltaX = event.clientX - (lessonNoteMoveStart?.x ?? 0);
    const deltaY = event.clientY - (lessonNoteMoveStart?.y ?? 0);
    const currentLeft = Number.parseFloat(lessonNoteMoveTarget.style.left || '0');
    const currentTop = Number.parseFloat(lessonNoteMoveTarget.style.top || '0');
    lessonNoteMoveTarget.style.left = `${currentLeft + deltaX}px`;
    lessonNoteMoveTarget.style.top = `${currentTop + deltaY}px`;
    lessonNoteMoveStart = {
        ...lessonNoteMoveStart,
        x: event.clientX,
        y: event.clientY,
        left: currentLeft,
        top: currentTop
    };
}

function finishLessonNoteMove() {
    lessonNoteMoveMode = false;
    if (lessonNoteMoveTarget) {
        lessonNoteMoveTarget.style.cursor = 'move';
        lessonNoteMoveTarget.style.zIndex = '4';
    }
    lessonNoteMoveTarget = null;
    lessonNoteMoveStart = null;
}

// ===================== LESSON NOTE SAVE DETAILS =====================
function openLessonNoteSaveModal() {
    const modal = document.getElementById('lessonNoteSaveModal');
    if (!modal) return;
    const dateField = modal.querySelector('input[name="date"]');
    if (dateField && !dateField.value) dateField.value = new Date().toISOString().slice(0, 10);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeLessonNoteSaveModal() {
    const modal = document.getElementById('lessonNoteSaveModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function submitLessonNoteSave(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const subject = String(values.get('subject') || '').trim();
    const topic = String(values.get('topic') || '').trim();
    const className = String(values.get('className') || '').trim();
    const date = String(values.get('date') || '').trim();
    if (!subject || !topic || !className || !date) {
        showToast('Subject, topic, class, and date are required before saving a lesson plan.', 'error');
        return;
    }
    const saved = await saveLessonNote({ subject, topic, className, date });
    if (saved) {
        lessonNoteEditingPlanId = null;
        closeLessonNoteSaveModal();
        if (store.currentRole === 'teacher') navigateTo('lessonPlans');
    }
}

// ===================== DOCUMENT CONTENT SANITIZATION =====================
function escapeLessonNoteHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function sanitizeLessonNoteHtml(html) {
    const allowedTags = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'CIRCLE', 'DIV', 'EM', 'ELLIPSE', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'LINE', 'OL', 'P', 'PATH', 'POLYGON', 'RECT', 'S', 'SPAN', 'STRIKE', 'STRONG', 'SVG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL']);
    const documentFragment = new DOMParser().parseFromString(String(html), 'text/html').body;

    documentFragment.querySelectorAll('*').forEach(element => {
        const tagName = element.tagName.toUpperCase();
        if (!allowedTags.has(tagName)) {
            if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'MATH'].includes(tagName)) {
                element.remove();
            } else {
                element.replaceWith(...element.childNodes);
            }
            return;
        }

        Array.from(element.attributes).forEach(attribute => {
            const attributeName = attribute.name.toLowerCase();
            if (attributeName === 'style') {
                const safeStyles = Array.from(element.style).filter(property =>
                    ['align-items', 'background-color', 'border', 'border-bottom', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-color', 'border-left', 'border-left-color', 'border-left-style', 'border-left-width', 'border-radius', 'border-right', 'border-right-color', 'border-right-style', 'border-right-width', 'border-spacing', 'border-style', 'border-top', 'border-top-color', 'border-top-left-radius', 'border-top-right-radius', 'border-top-style', 'border-top-width', 'border-width', 'box-sizing', 'color', 'display', 'font-family', 'font-size', 'font-style', 'font-weight', 'height', 'inset', 'justify-content', 'left', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-width', 'min-height', 'overflow', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position', 'right', 'text-align', 'text-decoration', 'top', 'vertical-align', 'width', 'bottom'].includes(property)
                    && !/url\s*\(|expression\s*\(/i.test(element.style.getPropertyValue(property))
                ).map(property => `${property}:${element.style.getPropertyValue(property)}`);
                if (safeStyles.length) element.setAttribute('style', safeStyles.join(';'));
                else element.removeAttribute('style');
                return;
            }
            if (tagName === 'FONT' && ['face', 'size', 'color'].includes(attributeName)) return;
            if (tagName === 'A' && attributeName === 'href' && /^(https?:|mailto:)/i.test(attribute.value)) return;
            if (tagName === 'IMG' && attributeName === 'src' && /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(attribute.value)) return;
            if (tagName === 'IMG' && ['alt', 'width', 'height'].includes(attributeName)) return;
            if (tagName === 'SVG' && attributeName === 'data-lesson-shape' && /^(rectangle|rounded-rectangle|circle|oval|triangle|diamond|right-arrow|line)$/.test(attribute.value)) return;
            if (['SVG', 'RECT', 'CIRCLE', 'ELLIPSE', 'LINE', 'POLYGON', 'PATH'].includes(tagName)
                && ['viewbox', 'width', 'height', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap'].includes(attributeName)
                && /^[#(),.\-\w\s]+$/.test(attribute.value)) return;
            element.removeAttribute(attribute.name);
        });
    });

    return documentFragment.innerHTML;
}

// ===================== LESSON NOTE EDITOR AND SAVED DRAFTS =====================
function renderWriteLessonNote() {
    const editingPlan = lessonNoteEditingPlanId
        ? store.lessonPlans.find(plan => plan.id === lessonNoteEditingPlanId)
        : null;
    // If not editing, start with a blank note (do not use getLatestLessonNote)
    const savedNote = editingPlan
        ? {
            lessonPlanId: editingPlan.id,
            subject: editingPlan.subject,
            topic: editingPlan.title,
            className: editingPlan.class,
            date: editingPlan.date,
            body: editingPlan.content || ''
        }
        : { subject: '', topic: '', className: '', date: '', body: '' };
    const body = sanitizeLessonNoteHtml(savedNote.body || '');
    const assignedClasses = store.currentRole === 'teacher' ? getTeacherAssignedClasses() : [];
    const classField = store.currentRole === 'teacher'
        ? `<select name="className" required ${assignedClasses.length ? '' : 'disabled'} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"><option value="" disabled ${assignedClasses.some(classroom => classroom.name === savedNote.className) ? '' : 'selected'}>Select an assigned class</option>${assignedClasses.map(classroom => `<option value="${escapeLessonNoteHtml(classroom.name)}" ${classroom.name === savedNote.className ? 'selected' : ''}>${escapeLessonNoteHtml(classroom.name)}</option>`).join('')}</select>`
        : `<select name="className" required class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"><option value="" selected disabled>Select a class</option>${store.classes.map(classroom => `<option value="${escapeLessonNoteHtml(classroom.name)}" ${classroom.name === savedNote.className ? 'selected' : ''}>${escapeLessonNoteHtml(classroom.name)}</option>`).join('')}</select>`;
    const saveModalTitle = editingPlan ? 'Update lesson plan' : 'Save lesson plan';
    const saveModalLabel = editingPlan ? 'Update lesson plan' : 'Save lesson note';
    requestAnimationFrame(paginateLessonNoteEditor);

    return `
    <div class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">Write Lesson Note</h1>
                <p class="mt-1 text-sm text-slate-500">Write and format your lesson on a document-style page.</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <button onclick="openLessonNoteSaveModal()" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><i class="fas fa-save mr-1"></i> Save note</button>
                <label class="cursor-pointer rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"><i class="fas fa-paperclip mr-1"></i> Add file<input type="file" accept=".doc,.docx,.pdf,.txt,.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" onchange="openLessonNoteFile(event)" class="hidden"></label>
                <button onclick="printLessonNote()" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><i class="fas fa-print mr-1"></i> Print / PDF</button>
            </div>
        </div>

        <div id="lessonNoteSaveModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="lessonNoteSaveModalTitle">
            <div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
                <div class="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wide text-primary-700">${saveModalLabel}</p>
                        <h2 id="lessonNoteSaveModalTitle" class="text-xl font-bold text-slate-800">${saveModalTitle}</h2>
                    </div>
                    <button type="button" onclick="closeLessonNoteSaveModal()" class="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close save dialog"><i class="fas fa-times"></i></button>
                </div>
                <form onsubmit="submitLessonNoteSave(event)" class="space-y-4">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="text-sm font-medium text-slate-700">Subject<input name="subject" required value="${escapeLessonNoteHtml(savedNote.subject || '')}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none" placeholder="Mathematics"></label>
                        <label class="text-sm font-medium text-slate-700">Topic<input name="topic" required value="${escapeLessonNoteHtml(savedNote.topic || '')}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none" placeholder="Fractions"></label>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="text-sm font-medium text-slate-700">Class${classField}</label>
                        <label class="text-sm font-medium text-slate-700">Date<input name="date" type="date" required value="${escapeLessonNoteHtml(savedNote.date || '')}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"></label>
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                        <button type="button" onclick="closeLessonNoteSaveModal()" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                        <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">${saveModalTitle}</button>
                    </div>
                </form>
            </div>
        </div>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Document editor">
            <div class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2" onmousedown="preserveLessonNoteSelection()">
                <button type="button" onclick="undoLessonNoteAction()" class="lesson-note-tool" title="Undo last action" aria-label="Undo"><i class="fas fa-undo"></i></button>
                <button type="button" onclick="formatLessonNote('redo')" class="lesson-note-tool" title="Redo" aria-label="Redo"><i class="fas fa-redo"></i></button>
                <button type="button" onclick="formatLessonNote('insertUnorderedList')" class="lesson-note-tool" title="Bulleted list" aria-label="Bulleted list"><i class="fas fa-list-ul"></i></button>
                <button type="button" onclick="formatLessonNote('insertOrderedList')" class="lesson-note-tool" title="Numbered list" aria-label="Numbered list"><i class="fas fa-list-ol"></i></button>
                <span class="mx-1 h-6 border-l border-slate-300"></span>
                <select onchange="formatLessonNote('formatBlock', this.value)" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Paragraph style">
                    <option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading</option><option value="h3">Subheading</option>
                </select>
                <select onchange="formatLessonNote('fontName', this.value)" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Font family">
                    <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option>
                </select>
                <select onchange="formatLessonNote('fontSize', this.value)" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Font size">
                    <option value="3">12</option><option value="2">10</option><option value="4">14</option><option value="5">18</option><option value="6">24</option>
                </select>
                <span class="mx-1 h-6 border-l border-slate-300"></span>
                <button type="button" onclick="formatLessonNote('bold')" class="lesson-note-tool font-bold" title="Bold" aria-label="Bold"><i class="fas fa-bold"></i></button>
                <button type="button" onclick="formatLessonNote('italic')" class="lesson-note-tool italic" title="Italic" aria-label="Italic"><i class="fas fa-italic"></i></button>
                <button type="button" onclick="formatLessonNote('underline')" class="lesson-note-tool underline" title="Underline" aria-label="Underline"><i class="fas fa-underline"></i></button>
                <button type="button" onclick="formatLessonNote('strikeThrough')" class="lesson-note-tool" title="Strikethrough" aria-label="Strikethrough"><i class="fas fa-strikethrough"></i></button>
                <label class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-200" title="Text color">
                    <i class="fas fa-font"></i><input type="color" value="#1e293b" onchange="formatLessonNote('foreColor', this.value)" class="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Text color">
                </label>
                <label class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-200" title="Highlight">
                    <i class="fas fa-highlighter"></i><input type="color" value="#fef08a" onchange="formatLessonNote('hiliteColor', this.value)" class="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Highlight color">
                </label>
                <span class="mx-1 h-6 border-l border-slate-300"></span>
                <button type="button" onclick="formatLessonNote('justifyLeft')" class="lesson-note-tool" title="Align left" aria-label="Align left"><i class="fas fa-align-left"></i></button>
                <button type="button" onclick="formatLessonNote('justifyCenter')" class="lesson-note-tool" title="Align center" aria-label="Align center"><i class="fas fa-align-center"></i></button>
                <button type="button" onclick="formatLessonNote('justifyRight')" class="lesson-note-tool" title="Align right" aria-label="Align right"><i class="fas fa-align-right"></i></button>
                <button type="button" onclick="formatLessonNote('justifyFull')" class="lesson-note-tool" title="Justify" aria-label="Justify"><i class="fas fa-align-justify"></i></button>
                <span class="mx-1 h-6 border-l border-slate-300"></span>
                <button type="button" onclick="formatLessonNote('outdent')" class="lesson-note-tool" title="Decrease indent" aria-label="Decrease indent"><i class="fas fa-outdent"></i></button>
                <button type="button" onclick="formatLessonNote('indent')" class="lesson-note-tool" title="Increase indent" aria-label="Increase indent"><i class="fas fa-indent"></i></button>
                <button type="button" onclick="insertLessonNoteLink()" class="lesson-note-tool" title="Insert link" aria-label="Insert link"><i class="fas fa-link"></i></button>
                <button type="button" onclick="formatLessonNote('removeFormat')" class="lesson-note-tool" title="Clear formatting" aria-label="Clear formatting"><i class="fas fa-remove-format"></i></button>
                <span class="mx-1 h-6 border-l border-slate-300"></span>
                <button type="button" onclick="showLessonNoteInsertDialog('table')" class="lesson-note-tool" title="Insert table" aria-label="Insert table"><i class="fas fa-table"></i> Table</button>
                <button type="button" onclick="showLessonNoteInsertDialog('shape')" class="lesson-note-tool" title="Insert shape" aria-label="Insert shape"><i class="fas fa-draw-polygon"></i> Shape</button>
                <button type="button" onclick="beginLessonNoteMove({ target: activeLessonNoteShape || activeLessonNoteTableCell?.closest('table') || document.querySelector('#lessonNoteEditor table') })" class="lesson-note-tool" title="Move selected object" aria-label="Move object"><i class="fas fa-arrows-up-down-left-right"></i> Move</button>
            </div>

            <div class="overflow-auto bg-slate-100 p-4 sm:p-8">
                <article class="mx-auto min-h-[850px] w-full max-w-[816px] bg-white px-8 py-10 shadow-md sm:px-16 sm:py-14" aria-label="Lesson plan sheet">
                    <div class="mb-8 border-b-2 border-primary-600 pb-5 text-center">
                        <p class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-700">${escapeLessonNoteHtml(store.settings.schoolName || 'EDULARS School')}</p>
                        <h2 class="text-xl font-bold uppercase tracking-wide text-slate-800">Lesson Plan</h2>
                    </div>
                    <div id="lessonNoteEditor" contenteditable="true" role="textbox" aria-label="Lesson plan document" aria-multiline="true" oninput="scheduleLessonNotePagination()" onkeydown="handleLessonNoteEditorKeydown(event)" onmouseover="handleLessonNoteEditorHover(event)" onmouseleave="scheduleLessonNoteHoverHide()" onfocusin="handleLessonNoteEditorHover(event)" onmousedown="if (event.target.closest('table, svg[data-lesson-shape]')) { beginLessonNoteMove(event); }" onmousemove="if (lessonNoteMoveMode) moveLessonNoteTarget(event);" onmouseup="finishLessonNoteMove()" class="lesson-note-editor text-[15px] leading-7 text-slate-800 outline-none focus:outline-none"><div class="lesson-note-page-content" data-placeholder="Start writing your lesson plan here...">${body}</div></div>
                </article>
            </div>
        </section>
        <div id="lessonNoteObjectToolbar" class="lesson-note-object-toolbar fixed z-40 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg" role="toolbar" aria-label="Selected object tools" onmouseenter="pinLessonNoteToolbar()" onmouseleave="scheduleLessonNoteHoverHide()" onmousedown="preserveLessonNoteSelection()">
            <div id="lessonNoteTableTools" class="hidden items-center gap-1">
                <button type="button" onclick="modifyLessonNoteTable('add-row-below')" class="lesson-note-tool lesson-note-tool-label" title="Add a row below the selected cell" aria-label="Add row"><i class="fas fa-plus"></i><span>Add row</span></button>
                <button type="button" onclick="modifyLessonNoteTable('add-column-right')" class="lesson-note-tool lesson-note-tool-label" title="Add a column to the right of the selected cell" aria-label="Add column"><i class="fas fa-plus"></i><span>Add column</span></button>
                <details class="lesson-note-more">
                    <summary class="lesson-note-tool lesson-note-tool-label" aria-label="More table tools"><i class="fas fa-ellipsis-h"></i><span>More</span></summary>
                    <div class="lesson-note-more-menu" role="group" aria-label="More table tools">
                        <label class="lesson-note-menu-item lesson-note-size-control">Row height <output id="lessonNoteRowHeightValue">32 px</output><input id="lessonNoteRowHeight" type="range" min="32" max="240" step="4" value="32" oninput="resizeLessonNoteTable('row', this.value)" aria-label="Row height in pixels"></label>
                        <label class="lesson-note-menu-item lesson-note-size-control">Column width <output id="lessonNoteColumnWidthValue">80 px</output><input id="lessonNoteColumnWidth" type="range" min="48" max="400" step="4" value="80" oninput="resizeLessonNoteTable('column', this.value)" aria-label="Column width in pixels"></label>
                        <button type="button" onclick="modifyLessonNoteTable('add-row-above')" class="lesson-note-menu-item" aria-label="Insert row above"><i class="fas fa-arrow-up"></i> Insert row above</button>
                        <button type="button" onclick="modifyLessonNoteTable('add-column-left')" class="lesson-note-menu-item" aria-label="Insert column left"><i class="fas fa-arrow-left"></i> Insert column left</button>
                        <button type="button" onclick="modifyLessonNoteTable('remove-row')" class="lesson-note-menu-item" aria-label="Delete row"><i class="fas fa-minus"></i> Delete row</button>
                        <button type="button" onclick="modifyLessonNoteTable('remove-column')" class="lesson-note-menu-item" aria-label="Delete column"><i class="fas fa-minus"></i> Delete column</button>
                        <button type="button" onclick="modifyLessonNoteTable('toggle-header-row')" class="lesson-note-menu-item" aria-label="Toggle header row"><i class="fas fa-heading"></i> Toggle header row</button>
                        <label class="lesson-note-menu-item cursor-pointer"><i class="fas fa-fill-drip"></i> Cell color<input type="color" value="#dcfce7" onchange="setLessonNoteCellColor(this.value)" class="ml-auto h-6 w-8 cursor-pointer border-0 bg-transparent p-0" aria-label="Cell background color"></label>
                        <button type="button" onclick="setLessonNoteCellColor('')" class="lesson-note-menu-item" aria-label="Clear cell color"><i class="fas fa-eraser"></i> Clear cell color</button>
                        <button type="button" onclick="modifyLessonNoteTable('delete-table')" class="lesson-note-menu-item text-red-600" aria-label="Delete table"><i class="fas fa-trash"></i> Delete table</button>
                    </div>
                </details>
            </div>
            <div id="lessonNoteShapeTools" class="hidden items-center gap-1">
                <label class="flex items-center gap-1 px-1 text-xs text-slate-600" title="Shape fill"><input id="lessonNoteShapeFill" type="checkbox" onchange="setLessonNoteShapeFill(this.checked)" class="accent-primary-600" aria-label="Shape fill"> Fill</label>
                <input id="lessonNoteShapeColor" type="color" value="#16a34a" onchange="setLessonNoteShapeColor(this.value)" class="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" aria-label="Shape color">
                <button type="button" onclick="deleteLessonNoteShape()" class="lesson-note-tool text-red-600" title="Delete shape" aria-label="Delete shape"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div id="lessonNotePdfDialog" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="lessonNotePdfDialogTitle">
            <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <h2 id="lessonNotePdfDialogTitle" class="text-lg font-bold text-slate-800">How should this PDF be opened?</h2>
                <p class="mt-2 text-sm text-slate-600">Choose editable text, or preserve the pages and add editable text and shapes over them.</p>
                <div class="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button type="button" onclick="importLessonNotePdf('text')" class="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Convert to editable text</button>
                    <button type="button" onclick="importLessonNotePdf('overlay')" class="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Preserve pages with editable overlays</button>
                </div>
                <button type="button" onclick="cancelLessonNotePdfImport()" class="mt-3 w-full rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">Cancel</button>
            </div>
        </div>
        <div id="lessonNoteInsertDialog" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="lessonNoteInsertDialogTitle">
            <form id="lessonNoteInsertForm" onsubmit="submitLessonNoteInsert(event)" class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 id="lessonNoteInsertDialogTitle" class="text-lg font-bold text-slate-800">Insert into lesson plan</h2>
                <div id="lessonNoteTableOptions" class="mt-4 grid grid-cols-2 gap-3">
                    <label class="text-sm font-medium text-slate-700">Rows<input name="rows" type="number" min="1" max="12" value="3" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"></label>
                    <label class="text-sm font-medium text-slate-700">Columns<input name="columns" type="number" min="1" max="8" value="3" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"></label>
                </div>
                <div id="lessonNoteShapeOptions" class="mt-4 hidden space-y-3">
                    <label class="block text-sm font-medium text-slate-700">Shape<select name="shape" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="rectangle">Rectangle</option><option value="rounded-rectangle">Rounded rectangle</option><option value="circle">Circle</option><option value="oval">Oval</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="right-arrow">Right arrow</option><option value="line">Line</option></select></label>
                    <div class="flex items-center justify-between gap-4"><label class="flex items-center gap-2 text-sm text-slate-700"><input name="filled" type="checkbox" checked class="accent-primary-600"> Filled shape</label><label class="flex items-center gap-2 text-sm text-slate-700">Color<input name="color" type="color" value="#16a34a" class="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"></label></div>
                </div>
                <div class="mt-5 flex justify-end gap-2">
                    <button type="button" onclick="closeLessonNoteInsertDialog()" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                    <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Insert</button>
                </div>
            </form>
        </div>
        <style>
            .lesson-note-tool { border-radius: .375rem; padding: .45rem .55rem; color: #334155; }
            .lesson-note-tool:hover { background: #e2e8f0; color: #15803d; }
            .lesson-note-object-toolbar { opacity: 0; pointer-events: none; transform: translateY(5px); transition: opacity .45s ease, transform .45s ease, visibility .45s ease; visibility: hidden; }
            .lesson-note-object-toolbar.is-visible { opacity: .42; pointer-events: auto; transform: translateY(0); visibility: visible; }
            .lesson-note-object-toolbar.is-pinned, .lesson-note-object-toolbar.is-visible:hover, .lesson-note-object-toolbar:focus-within { opacity: 1; }
            .lesson-note-tool-label { display: inline-flex; align-items: center; gap: .35rem; white-space: nowrap; font-size: .75rem; font-weight: 600; }
            .lesson-note-more { position: relative; }
            .lesson-note-more > summary { cursor: pointer; list-style: none; }
            .lesson-note-more > summary::-webkit-details-marker { display: none; }
            .lesson-note-more-menu { position: absolute; top: calc(100% + .4rem); right: 0; z-index: 1; display: flex; min-width: 12rem; flex-direction: column; border: 1px solid #e2e8f0; border-radius: .5rem; background: white; padding: .25rem; box-shadow: 0 8px 24px rgb(15 23 42 / .16); }
            .lesson-note-menu-item { display: flex; align-items: center; gap: .55rem; border-radius: .375rem; padding: .45rem .6rem; text-align: left; font-size: .75rem; color: #334155; white-space: nowrap; }
            .lesson-note-menu-item:hover { background: #f1f5f9; color: #15803d; }
            .lesson-note-size-control { display: grid; grid-template-columns: 1fr auto; white-space: nowrap; }
            .lesson-note-size-control input { grid-column: 1 / -1; width: 100%; accent-color: #16a34a; }
            @media (prefers-reduced-motion: reduce) { .lesson-note-object-toolbar { transition-duration: .01ms; } }
            .lesson-note-editor { min-height: 620px; }
            .lesson-note-page-content { box-sizing: border-box; height: 620px; overflow: visible; }
            .lesson-note-page-content + .lesson-note-page-content { margin-top: 48px; border-top: 1px dashed #cbd5e1; padding-top: 32px; }
            .lesson-note-page-content h1 { margin: 1.25rem 0 .75rem; font-size: 1.75rem; font-weight: 700; line-height: 1.25; }
            .lesson-note-page-content h2 { margin: 1.1rem 0 .45rem; font-size: 1.2rem; font-weight: 700; line-height: 1.4; }
            .lesson-note-page-content h3 { margin: 1rem 0 .4rem; font-size: 1.05rem; font-weight: 700; }
            .lesson-note-page-content p { margin: .55rem 0; }
            .lesson-note-page-content ul, .lesson-note-page-content ol { margin: .5rem 0; padding-left: 1.75rem; }
            .lesson-note-page-content ul { list-style: disc; }
            .lesson-note-page-content ol { list-style: decimal; }
            .lesson-note-page-content:empty::before { color: #94a3b8; content: attr(data-placeholder); pointer-events: none; }
            .lesson-note-page-content table { width: 100%; border-collapse: collapse; margin: .75rem 0; }
            .lesson-note-page-content td, .lesson-note-page-content th { min-width: 3rem; border: 1px solid #94a3b8; padding: .5rem; }
            .lesson-note-page-content table:hover { outline: 1px solid #86efac; outline-offset: 2px; }
            .lesson-note-page-content td:hover, .lesson-note-page-content th:hover { background-color: #f0fdf4; }
            .lesson-note-shape { cursor: move; }
            .lesson-note-pdf-page { position: relative; margin: 0 auto 1.5rem; max-width: 100%; }
            .lesson-note-pdf-page > img { display: block; width: 100%; height: auto; }
            .lesson-note-pdf-overlay { position: absolute; inset: 0; box-sizing: border-box; overflow: hidden; padding: 8%; }
            @media print { body * { visibility: hidden !important; } #lessonNoteEditor, #lessonNoteEditor *, article, article * { visibility: visible !important; } article { position: absolute; inset: 0; width: 100%; max-width: none; box-shadow: none; } .lesson-note-page-content + .lesson-note-page-content { break-before: page; page-break-before: always; margin-top: 0; border: 0; } }
        </style>
    </div>`;
}

// ===================== EDITING, SAVE, AND PRINT ACTIONS =====================
function formatLessonNote(command, value) {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) return;
    recordLessonNoteUndoState();
    editor.focus();
    if (lessonNoteSelection && editor.contains(lessonNoteSelection.commonAncestorContainer)) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(lessonNoteSelection);
    }
    document.execCommand(command, false, value || null);
    preserveLessonNoteSelection();
}

function scheduleLessonNotePagination() {
    if (lessonNotePaginationFrame) cancelAnimationFrame(lessonNotePaginationFrame);
    lessonNotePaginationFrame = requestAnimationFrame(() => {
        lessonNotePaginationFrame = null;
        paginateLessonNoteEditor();
    });
}

function createLessonNotePage() {
    const page = document.createElement('div');
    page.className = 'lesson-note-page-content';
    page.dataset.placeholder = 'Continue writing your lesson plan here...';
    return page;
}

function splitLessonNoteBlock(block, page) {
    const textWalker = block.nodeType === Node.TEXT_NODE
        ? null
        : document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const textEntries = [];
    let fullText = '';
    if (block.nodeType === Node.TEXT_NODE) {
        textEntries.push({ node: block, start: 0, end: block.length });
        fullText = block.textContent;
    }
    while (textWalker?.nextNode()) {
        const node = textWalker.currentNode;
        textEntries.push({ node, start: fullText.length, end: fullText.length + node.length });
        fullText += node.textContent;
    }
    if (fullText.length < 2) return null;

    const pageStyles = getComputedStyle(page);
    const pageBottom = page.getBoundingClientRect().top + page.clientHeight - Number.parseFloat(pageStyles.paddingBottom || '0');
    const range = document.createRange();
    let low = 1;
    let high = fullText.length - 1;
    let splitOffset = 0;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const entry = textEntries.find(item => middle - 1 >= item.start && middle - 1 < item.end);
        if (!entry) break;
        range.setStart(entry.node, middle - 1 - entry.start);
        range.setEnd(entry.node, middle - entry.start);
        const characterBounds = range.getBoundingClientRect();
        if (!characterBounds.height || characterBounds.bottom <= pageBottom) {
            splitOffset = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    if (!splitOffset) return null;

    const precedingSpace = Math.max(fullText.lastIndexOf(' ', splitOffset - 1), fullText.lastIndexOf('\n', splitOffset - 1));
    if (precedingSpace > splitOffset - 40) splitOffset = precedingSpace || splitOffset;
    const splitEntry = textEntries.find(item => splitOffset >= item.start && splitOffset < item.end);
    if (!splitEntry) return null;

    if (block.nodeType === Node.TEXT_NODE) return block.splitText(splitOffset);

    range.setStart(splitEntry.node, splitOffset - splitEntry.start);
    range.setEnd(block, block.childNodes.length);
    const remainder = range.extractContents();
    if (!remainder.childNodes.length) return null;
    const continuation = block.cloneNode(false);
    continuation.appendChild(remainder);
    return continuation;
}

function paginateLessonNoteEditor() {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) return;

    let pages = Array.from(editor.children).filter(child => child.classList.contains('lesson-note-page-content'));
    if (!pages.length) {
        const page = createLessonNotePage();
        while (editor.firstChild) page.appendChild(editor.firstChild);
        editor.appendChild(page);
        pages = [page];
    }

    pages.forEach(page => {
        Array.from(page.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .forEach(node => {
                if (!node.textContent.trim()) {
                    node.remove();
                    return;
                }
                const paragraphs = document.createDocumentFragment();
                node.textContent.split(/\r?\n/).forEach(line => {
                    const paragraph = document.createElement('p');
                    if (line) paragraph.textContent = line;
                    else paragraph.innerHTML = '<br>';
                    paragraphs.appendChild(paragraph);
                });
                node.replaceWith(paragraphs);
            });
    });

    for (let index = 0; index < pages.length - 1; index += 1) {
        const page = pages[index];
        let sourceIndex = index + 1;
        let pageIsFull = false;
        while (sourceIndex < pages.length && !pageIsFull) {
            const sourcePage = pages[sourceIndex];
            while (sourcePage.firstChild) {
                const node = sourcePage.firstChild;
                page.appendChild(node);
                if (page.scrollHeight > page.clientHeight + 1) {
                    sourcePage.insertBefore(node, sourcePage.firstChild);
                    pageIsFull = true;
                    break;
                }
            }
            if (pageIsFull) break;
            if (sourcePage.hasChildNodes()) break;
            sourcePage.remove();
            pages.splice(sourceIndex, 1);
        }
    }

    for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        while (page.scrollHeight > page.clientHeight + 1 && page.lastChild) {
            let nextPage = pages[index + 1];
            if (!nextPage) {
                nextPage = createLessonNotePage();
                editor.appendChild(nextPage);
                pages.push(nextPage);
            }

            const block = page.lastElementChild || page.lastChild;
            if (page.childNodes.length === 1) {
                const continuation = splitLessonNoteBlock(block, page);
                if (!continuation) break;
                nextPage.insertBefore(continuation, nextPage.firstChild);
            } else {
                nextPage.insertBefore(block, nextPage.firstChild);
            }
        }
    }

    while (pages.length > 1 && !pages[pages.length - 1].hasChildNodes()) {
        pages.pop().remove();
    }
}

function handleLessonNoteEditorKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const listItem = anchorElement?.closest('li');
    if (!listItem || listItem.textContent.trim()) return;

    event.preventDefault();
    recordLessonNoteUndoState();
    const list = listItem.parentElement;
    const listWrapper = list.parentElement;
    if (listWrapper?.tagName === 'P'
        && listWrapper.childNodes.length === 1
        && listWrapper.firstChild === list) {
        listWrapper.replaceWith(list);
    }
    listItem.remove();
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    if (list.children.length > 0) list.after(paragraph);
    else list.replaceWith(paragraph);

    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    preserveLessonNoteSelection();
    scheduleLessonNotePagination();
}

function preserveLessonNoteSelection() {
    const editor = document.getElementById('lessonNoteEditor');
    const selection = window.getSelection();
    if (editor && selection.rangeCount && editor.contains(selection.anchorNode)) {
        lessonNoteSelection = selection.getRangeAt(0).cloneRange();
    }
}

function insertLessonNoteLink() {
    const url = window.prompt('Enter the web address for the link:');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
        showToast('Enter a link starting with http:// or https://.', 'error');
        return;
    }
    formatLessonNote('createLink', url);
}

function getLessonNoteDraft() {
    const editor = document.getElementById('lessonNoteEditor');
    const pages = Array.from(editor.children).filter(child => child.classList.contains('lesson-note-page-content'));
    const body = pages.length ? pages.map(page => page.innerHTML).join('') : editor.innerHTML;
    return {
        title: 'Lesson Plan',
        body: sanitizeLessonNoteHtml(body),
        updatedAt: new Date().toISOString()
    };
}

async function saveLessonNote(metadata = {}) {
    const draft = getLessonNoteDraft();
    const editingPlan = lessonNoteEditingPlanId
        ? store.lessonPlans.find(plan => plan.id === lessonNoteEditingPlanId)
        : null;
    const className = String(metadata.className || editingPlan?.class || '').trim();
    const classroom = store.classes.find(item => item.name === className);
    if (!classroom) {
        showToast('Choose a valid class before saving this lesson plan.', 'error');
        return false;
    }
    if (store.currentRole === 'teacher' && !getTeacherAssignedClasses().some(item => item.id === classroom.id)) {
        showToast('Choose one of your assigned classes before saving this lesson plan.', 'error');
        return false;
    }
    if (editingPlan && !['Draft', 'Submitted'].includes(editingPlan.status) && store.currentRole !== 'admin') {
        showToast('This lesson plan can no longer be edited by your teacher account.', 'error');
        return false;
    }

    const payload = {
        subject: String(metadata.subject || editingPlan?.subject || '').trim(),
        topic: String(metadata.topic || editingPlan?.title || '').trim(),
        title: String(metadata.topic || editingPlan?.title || '').trim(),
        className,
        date: String(metadata.date || editingPlan?.date || new Date().toISOString().slice(0, 10)),
        duration: editingPlan?.duration || '40 minutes',
        objectives: String(metadata.topic || editingPlan?.objectives || '').trim(),
        materials: editingPlan?.materials || '',
        content: draft.body,
        status: editingPlan?.status || 'Draft'
    };
    try {
        const path = editingPlan
            ? `/academics/lesson-plans/${encodeURIComponent(editingPlan.id)}`
            : '/academics/lesson-plans';
        const result = await apiRequest(path, {
            method: editingPlan ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        await loadStoreData();
        lessonNoteEditingPlanId = result.lessonPlan.id;
        showToast(store.currentRole === 'teacher'
            ? 'Lesson plan saved to the database. Submit it from Lesson Plans when ready.'
            : 'Lesson plan saved to the database.', 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

function printLessonNote() {
    window.print();
}

// ===================== TABLES, SHAPES, AND ON-SHEET CONTROLS =====================
function insertLessonNoteHtml(html) {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) return;
    recordLessonNoteUndoState();
    editor.focus();
    if (lessonNoteSelection && editor.contains(lessonNoteSelection.commonAncestorContainer)) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(lessonNoteSelection);
    }
    document.execCommand('insertHTML', false, sanitizeLessonNoteHtml(html));
    preserveLessonNoteSelection();
}

function showLessonNoteInsertDialog(mode) {
    const dialog = document.getElementById('lessonNoteInsertDialog');
    if (!dialog || !['table', 'shape'].includes(mode)) return;
    dialog.dataset.mode = mode;
    document.getElementById('lessonNoteInsertDialogTitle').textContent = mode === 'table' ? 'Insert a table' : 'Insert a shape';
    document.getElementById('lessonNoteTableOptions').classList.toggle('hidden', mode !== 'table');
    document.getElementById('lessonNoteShapeOptions').classList.toggle('hidden', mode !== 'shape');
    dialog.classList.remove('hidden');
    dialog.classList.add('flex');
}

function closeLessonNoteInsertDialog() {
    const dialog = document.getElementById('lessonNoteInsertDialog');
    dialog?.classList.add('hidden');
    dialog?.classList.remove('flex');
}

function submitLessonNoteInsert(event) {
    event.preventDefault();
    const dialog = document.getElementById('lessonNoteInsertDialog');
    const values = new FormData(event.currentTarget);
    if (dialog.dataset.mode === 'table') {
        const rows = Number(values.get('rows'));
        const columns = Number(values.get('columns'));
        if (!Number.isInteger(rows) || rows < 1 || rows > 12 || !Number.isInteger(columns) || columns < 1 || columns > 8) {
            showToast('Tables can have 1–12 rows and 1–8 columns.', 'error');
            return;
        }
        insertLessonNoteTable(rows, columns);
    } else {
        insertLessonNoteShape(String(values.get('shape')), String(values.get('color')), values.get('filled') === 'on');
    }
    closeLessonNoteInsertDialog();
}

function insertLessonNoteTable(rows, columns) {
    const tableRows = Array.from({ length: rows }, () => `<tr>${Array.from({ length: columns }, () => '<td><br></td>').join('')}</tr>`).join('');
    insertLessonNoteHtml(`<table style="width:100%;border-collapse:collapse;margin:12px 0"><tbody>${tableRows}</tbody></table><p><br></p>`);
}

function insertLessonNoteShape(shape, color, filled) {
    const normalizedShape = shape.trim().toLowerCase();
    const shapes = {
        rectangle: '<rect x="8" y="8" width="104" height="64"/>',
        'rounded-rectangle': '<rect x="8" y="8" width="104" height="64" rx="10"/>',
        circle: '<circle cx="60" cy="40" r="32"/>',
        oval: '<ellipse cx="60" cy="40" rx="50" ry="29"/>',
        triangle: '<polygon points="60,7 113,72 7,72"/>',
        diamond: '<polygon points="60,5 115,40 60,75 5,40"/>',
        'right-arrow': '<path d="M5 25 H70 V8 L115 40 70 72 V55 H5 Z"/>',
        line: '<line x1="8" y1="40" x2="112" y2="40"/>'
    };
    if (!shapes[normalizedShape] || !/^#[0-9a-f]{6}$/i.test(color)) {
        showToast('Choose a supported shape and valid color.', 'error');
        return;
    }
    const fill = filled && normalizedShape !== 'line' ? color : 'none';
    const shapeSvg = shapes[normalizedShape].replace(/\/?>$/, match => match.startsWith('</') ? match : ` fill="${fill}" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
    const shapeHtml = `<svg data-lesson-shape="${normalizedShape}" viewBox="0 0 120 80" width="180" height="120" style="display:inline-block;max-width:100%;vertical-align:middle;margin:8px;cursor:move;position:relative" role="img" aria-label="${normalizedShape.replace('-', ' ')} shape">${shapeSvg}</svg><p><br></p>`;
    insertLessonNoteHtml(shapeHtml);
}

function handleLessonNoteEditorHover(event) {
    const editor = document.getElementById('lessonNoteEditor');
    const target = event.target?.closest ? event.target.closest('table, svg[data-lesson-shape]') : null;
    if (!editor || !target || !editor.contains(target)) return;
    cancelLessonNoteHoverHide();
    const targetTagName = target.tagName.toUpperCase();
    activeLessonNoteTableCell = targetTagName === 'TABLE' ? event.target.closest('td, th') : null;
    activeLessonNoteShape = targetTagName === 'SVG' ? target : null;
    const toolbar = document.getElementById('lessonNoteObjectToolbar');
    const tableTools = document.getElementById('lessonNoteTableTools');
    const shapeTools = document.getElementById('lessonNoteShapeTools');
    tableTools.classList.toggle('hidden', !activeLessonNoteTableCell);
    tableTools.classList.toggle('flex', Boolean(activeLessonNoteTableCell));
    shapeTools.classList.toggle('hidden', !activeLessonNoteShape);
    shapeTools.classList.toggle('flex', Boolean(activeLessonNoteShape));
    if (!activeLessonNoteTableCell && !activeLessonNoteShape) {
        toolbar.classList.remove('is-visible');
        return;
    }
    if (activeLessonNoteShape) {
        const fill = activeLessonNoteShape.getAttribute('fill') || activeLessonNoteShape.firstElementChild?.getAttribute('fill');
        const stroke = activeLessonNoteShape.getAttribute('stroke') || activeLessonNoteShape.firstElementChild?.getAttribute('stroke') || '#16a34a';
        document.getElementById('lessonNoteShapeFill').checked = fill !== 'none';
        document.getElementById('lessonNoteShapeColor').value = /^#[0-9a-f]{6}$/i.test(stroke) ? stroke : '#16a34a';
    }
    if (activeLessonNoteTableCell) {
        const rowHeight = Math.max(32, Math.round(activeLessonNoteTableCell.parentElement.getBoundingClientRect().height));
        const columnWidth = Math.max(48, Math.round(activeLessonNoteTableCell.getBoundingClientRect().width));
        document.getElementById('lessonNoteRowHeight').value = String(Math.min(240, rowHeight));
        document.getElementById('lessonNoteRowHeightValue').value = `${rowHeight} px`;
        document.getElementById('lessonNoteColumnWidth').value = String(Math.min(400, columnWidth));
        document.getElementById('lessonNoteColumnWidthValue').value = `${columnWidth} px`;
    }
    toolbar.classList.add('is-visible');
    const bounds = target.getBoundingClientRect();
    const toolbarWidth = Math.min(toolbar.offsetWidth, window.innerWidth - 16);
    toolbar.style.top = `${Math.max(8, bounds.top - toolbar.offsetHeight - 8)}px`;
    toolbar.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - toolbarWidth - 8))}px`;
}

function pinLessonNoteToolbar() {
    cancelLessonNoteHoverHide();
    document.getElementById('lessonNoteObjectToolbar')?.classList.add('is-pinned');
}

function scheduleLessonNoteHoverHide() {
    cancelLessonNoteHoverHide();
    document.getElementById('lessonNoteObjectToolbar')?.classList.remove('is-pinned');
    lessonNoteHoverHideTimer = setTimeout(() => {
        const toolbar = document.getElementById('lessonNoteObjectToolbar');
        toolbar?.classList.remove('is-visible');
        document.querySelector('#lessonNoteTableTools details[open]')?.removeAttribute('open');
        activeLessonNoteTableCell = null;
        activeLessonNoteShape = null;
    }, 650);
}

function cancelLessonNoteHoverHide() {
    if (lessonNoteHoverHideTimer) clearTimeout(lessonNoteHoverHideTimer);
    lessonNoteHoverHideTimer = null;
}

function modifyLessonNoteTable(action) {
    const cell = activeLessonNoteTableCell;
    const table = cell?.closest('table');
    if (!cell || !table) {
        showToast('Hover over a table cell to edit its rows or columns.', 'error');
        return;
    }
    const row = cell.parentElement;
    const rowIndex = row.rowIndex;
    const columnIndex = cell.cellIndex;
    const columnCount = row.cells.length;
    let focusCell = null;
    if (action === 'add-row-above' || action === 'add-row-below') {
        const insertIndex = rowIndex + (action === 'add-row-below' ? 1 : 0);
        const newRow = table.insertRow(insertIndex);
        for (let index = 0; index < columnCount; index += 1) {
            newRow.insertCell().innerHTML = '<br>';
        }
        focusCell = newRow.cells[Math.min(columnIndex, columnCount - 1)];
    } else if (action === 'add-column-left' || action === 'add-column-right') {
        const insertIndex = columnIndex + (action === 'add-column-right' ? 1 : 0);
        Array.from(table.rows).forEach(tableRow => {
            const newCell = tableRow.insertCell(insertIndex);
            newCell.innerHTML = '<br>';
        });
        focusCell = table.rows[rowIndex].cells[insertIndex];
    } else if (action === 'remove-row') {
        table.deleteRow(rowIndex);
        if (!table.rows.length) {
            table.remove();
            activeLessonNoteTableCell = null;
            scheduleLessonNoteHoverHide();
            return;
        }
        focusCell = table.rows[Math.min(rowIndex, table.rows.length - 1)].cells[Math.min(columnIndex, table.rows[Math.min(rowIndex, table.rows.length - 1)].cells.length - 1)];
    } else if (action === 'remove-column') {
        if (columnCount <= 1) {
            showToast('A table must keep at least one column. Delete the table to remove it entirely.', 'error');
            return;
        }
        Array.from(table.rows).forEach(tableRow => tableRow.deleteCell(columnIndex));
        focusCell = table.rows[Math.min(rowIndex, table.rows.length - 1)].cells[Math.min(columnIndex, table.rows[0].cells.length - 1)];
    } else if (action === 'toggle-header-row') {
        const headerRow = table.rows[0];
        if (!headerRow) return;
        const useHeaderCells = headerRow.cells[0]?.tagName !== 'TH';
        Array.from(headerRow.cells).forEach(headerCell => {
            const replacement = document.createElement(useHeaderCells ? 'th' : 'td');
            replacement.innerHTML = headerCell.innerHTML;
            replacement.style.cssText = headerCell.style.cssText;
            headerCell.replaceWith(replacement);
        });
        focusCell = headerRow.cells[Math.min(columnIndex, headerRow.cells.length - 1)];
    } else if (action === 'delete-table') {
        table.remove();
        activeLessonNoteTableCell = null;
        scheduleLessonNoteHoverHide();
        return;
    } else {
        showToast('That table action is not available.', 'error');
        return;
    }
    document.querySelector('#lessonNoteTableTools details[open]')?.removeAttribute('open');
    activeLessonNoteTableCell = focusCell;
    focusCell?.focus();
    if (focusCell) handleLessonNoteEditorHover({ target: focusCell });
}

function resizeLessonNoteTable(dimension, value) {
    const cell = activeLessonNoteTableCell;
    const size = Number(value);
    if (!cell || !Number.isFinite(size) || size <= 0) {
        showToast('Hover over a table cell before adjusting its size.', 'error');
        return;
    }
    if (dimension === 'row') {
        cell.parentElement.style.height = `${size}px`;
        document.getElementById('lessonNoteRowHeightValue').value = `${size} px`;
        return;
    }
    if (dimension === 'column') {
        const table = cell.closest('table');
        const columnIndex = cell.cellIndex;
        Array.from(table.rows).forEach(row => {
            if (row.cells[columnIndex]) row.cells[columnIndex].style.width = `${size}px`;
        });
        document.getElementById('lessonNoteColumnWidthValue').value = `${size} px`;
        return;
    }
    showToast('Choose a row or column size to adjust.', 'error');
}

function setLessonNoteCellColor(color) {
    if (!activeLessonNoteTableCell) return;
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        showToast('Choose a valid cell color.', 'error');
        return;
    }
    activeLessonNoteTableCell.style.backgroundColor = color || '';
}

function setLessonNoteShapeFill(filled) {
    if (!activeLessonNoteShape) return;
    const shape = activeLessonNoteShape.firstElementChild;
    if (!shape || shape.tagName === 'LINE') return;
    const color = document.getElementById('lessonNoteShapeColor').value;
    shape.setAttribute('fill', filled ? color : 'none');
}

function setLessonNoteShapeColor(color) {
    if (!activeLessonNoteShape || !/^#[0-9a-f]{6}$/i.test(color)) return;
    const shape = activeLessonNoteShape.firstElementChild;
    if (!shape) return;
    shape.setAttribute('stroke', color);
    if (document.getElementById('lessonNoteShapeFill').checked && shape.tagName !== 'LINE') {
        shape.setAttribute('fill', color);
    }
}

function deleteLessonNoteShape() {
    if (!activeLessonNoteShape) return;
    activeLessonNoteShape.remove();
    activeLessonNoteShape = null;
    scheduleLessonNoteHoverHide();
}

// ===================== FILE IMPORT AND DOCUMENT CONVERSION =====================
function loadLessonNoteLibrary(name, source, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!lessonNoteLibraryPromises[name]) {
        lessonNoteLibraryPromises[name] = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = source;
            script.async = true;
            script.onload = () => {
                if (window[globalName]) {
                    resolve(window[globalName]);
                    return;
                }
                delete lessonNoteLibraryPromises[name];
                reject(new Error(`The ${name} editing library loaded without its expected API.`));
            };
            script.onerror = () => {
                delete lessonNoteLibraryPromises[name];
                reject(new Error(`The ${name} editing library could not be loaded. Check your internet connection and try again.`));
            };
            document.head.appendChild(script);
        });
    }
    return lessonNoteLibraryPromises[name];
}

function replaceLessonNoteBody(html) {
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) throw new Error('The lesson-plan editor is not available.');
    editor.innerHTML = sanitizeLessonNoteHtml(html);
    lessonNoteSelection = null;
}

async function openLessonNoteFile(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    const editor = document.getElementById('lessonNoteEditor');
    if (!editor) {
        showToast('Open the lesson-plan editor before adding a file.', 'error');
        return;
    }
    const extension = file.name.split('.').pop().toLowerCase();
    try {
        if (extension === 'docx') {
            const mammoth = await loadLessonNoteLibrary('Word document', 'https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js', 'mammoth');
            const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
            if (result.messages.some(message => message.type === 'error')) {
                console.warn('Word import reported conversion issues.', result.messages);
            }
            replaceLessonNoteBody(result.value || '');
            showToast(`${file.name} opened for editing. Some Word-specific formatting may change.`, 'success');
            return;
        }
        if (extension === 'pdf' || file.type === 'application/pdf') {
            pendingLessonNotePdf = file;
            const dialog = document.getElementById('lessonNotePdfDialog');
            dialog.classList.remove('hidden');
            dialog.classList.add('flex');
            return;
        }
        if (extension === 'txt' || file.type === 'text/plain') {
            replaceLessonNoteBody(`<p>${escapeLessonNoteHtml(await file.text()).replace(/\r?\n/g, '<br>')}</p>`);
            showToast(`${file.name} opened for editing.`, 'success');
            return;
        }
        if (file.type.startsWith('image/')) {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error(`The image file "${file.name}" could not be read.`));
                reader.readAsDataURL(file);
            });
            insertLessonNoteHtml(`<p><img src="${dataUrl}" alt="${escapeLessonNoteHtml(file.name)}" style="max-width:100%;height:auto"></p>`);
            showToast(`${file.name} added to the lesson plan.`, 'success');
            return;
        }
        if (extension === 'doc') {
            throw new Error('Legacy .doc files are not supported for direct editing. Open the file in Word and save it as .docx, then add it again.');
        }
        throw new Error('This file type cannot be edited here. Add a .docx, .pdf, .txt, or image file.');
    } catch (error) {
        console.error('The selected lesson-plan file could not be imported.', error);
        showToast(`File could not be opened: ${error.message}`, 'error');
    }
}

function cancelLessonNotePdfImport() {
    pendingLessonNotePdf = null;
    const dialog = document.getElementById('lessonNotePdfDialog');
    dialog?.classList.add('hidden');
    dialog?.classList.remove('flex');
}

async function importLessonNotePdf(mode) {
    const file = pendingLessonNotePdf;
    cancelLessonNotePdfImport();
    if (!file) {
        showToast('Choose the PDF file again; it is no longer available.', 'error');
        return;
    }
    try {
        const pdfjs = await loadLessonNoteLibrary('PDF', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (pdf.numPages > 20) throw new Error('This PDF has more than 20 pages. Split it into smaller files and add them separately.');
        const editorHtml = [];
        let embeddedImageBytes = 0;
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.filter(item => typeof item.str === 'string' && item.str.trim());
            if (mode === 'text') {
                const lines = [];
                textItems.sort((left, right) => right.transform[5] - left.transform[5] || left.transform[4] - right.transform[4])
                    .forEach(item => {
                        const y = item.transform[5];
                        let line = lines.find(candidate => Math.abs(candidate.y - y) < 4);
                        if (!line) {
                            line = { y, items: [] };
                            lines.push(line);
                        }
                        line.items.push({ x: item.transform[4], text: item.str });
                    });
                const paragraphs = lines.sort((left, right) => right.y - left.y).map(line =>
                    line.items.sort((left, right) => left.x - right.x).map(item => item.text).join(' ')
                );
                editorHtml.push(`<h2>Page ${pageNumber}</h2>${paragraphs.map(line => `<p>${escapeLessonNoteHtml(line)}</p>`).join('')}`);
                continue;
            }
            const viewport = page.getViewport({ scale: 1.25 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const imageUrl = canvas.toDataURL('image/jpeg', 0.68);
            embeddedImageBytes += imageUrl.length * 0.75;
            if (embeddedImageBytes > 800_000) {
                throw new Error('The preserved PDF pages are too large to save reliably in this browser. Choose “Convert to editable text” instead.');
            }
            editorHtml.push(`<div style="position:relative;max-width:100%;margin:0 auto 24px"><img src="${imageUrl}" alt="PDF page ${pageNumber}" style="display:block;width:100%;height:auto"><div contenteditable="true" style="position:absolute;inset:0;box-sizing:border-box;overflow:hidden;padding:8%"></div></div>`);
        }
        replaceLessonNoteBody(editorHtml.join('') || '<p>No pages were found in this PDF.</p>');
        showToast(mode === 'text'
            ? `${file.name} converted to editable text. PDF layout and images are not retained.`
            : `${file.name} pages are preserved. Click a page and type to add editable overlays.`, 'success');
    } catch (error) {
        console.error('The selected PDF could not be imported.', error);
        showToast(`PDF could not be opened: ${error.message}`, 'error');
    }
}
