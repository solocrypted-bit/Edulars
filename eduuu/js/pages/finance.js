// ===================== FINANCIAL HELPERS AND PAYMENT RECEIPTS =====================
function formatNaira(amount) {
    return `₦${Number(amount || 0).toLocaleString('en-NG')}`;
}

function getStudentFeeBalance(studentId) {
    return store.fees
        .filter(fee => fee.studentId === studentId)
        .reduce((sum, fee) => sum + Math.max(0, Number(fee.amount || 0) - Number(fee.paid || 0)), 0);
}

function getSettledInvoiceSnapshot(student) {
    const studentFees = store.fees.filter(fee => fee.studentId === student.id).sort((a, b) => a.id.localeCompare(b.id));
    if (!studentFees.length || studentFees.some(fee => Number(fee.paid || 0) < Number(fee.amount || 0))) return null;
    return studentFees.map(fee => ({
        feeId: fee.id,
        type: fee.type,
        amount: Number(fee.amount || 0),
        paid: Number(fee.paid || 0)
    }));
}

async function createSettledInvoice(student) {
    const feeLines = getSettledInvoiceSnapshot(student);
    if (!feeLines) return null;
    const snapshotKey = JSON.stringify(feeLines);
    const existing = store.invoices.find(invoice => invoice.studentId === student.id && invoice.snapshotKey === snapshotKey);
    if (existing) return existing;
    const result = await apiRequest('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id })
    });
    await loadStoreData();
    return store.invoices.find(invoice => invoice.id === result.invoice.id) || result.invoice;
}

function getInvoiceEmailStatusText(invoice) {
    if (invoice.emailStatus === 'queued') return `Email notification queued for ${invoice.parentEmail}. Configure an email service for delivery.`;
    if (invoice.emailStatus === 'pending') return `Email notification pending for ${invoice.parentEmail}.`;
    if (invoice.emailStatus === 'unconfigured') return `Email delivery has not been configured for ${invoice.parentEmail}.`;
    if (invoice.emailStatus === 'failed') return 'Parent notification could not be sent.';
    if (invoice.emailStatus === 'missing') return 'No parent email is saved.';
    return 'No parent email is saved. Add one to the student record to enable email updates.';
}

let invoiceModalKeydownHandler;

function closeInvoiceModal() {
    document.getElementById('invoiceModal')?.remove();
    if (invoiceModalKeydownHandler) {
        document.removeEventListener('keydown', invoiceModalKeydownHandler);
        invoiceModalKeydownHandler = undefined;
    }
}

async function generateSettledInvoice(studentId) {
    const student = store.students.find(item => item.id === studentId);
    if (!student) {
        showToast('This student is no longer in the directory.', 'error');
        return;
    }
    if (getStudentFeeBalance(student.id) > 0) {
        showToast('An invoice is available after the student’s full fee account is paid.', 'error');
        return;
    }
    try {
        const invoice = await createSettledInvoice(student);
        if (!invoice) {
            showToast('No fee records are available for this student.', 'error');
            return;
        }
        openInvoiceModal(invoice.id);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function openInvoiceModal(invoiceId) {
    const invoice = store.invoices.find(item => item.id === invoiceId);
    if (!invoice) {
        showToast('This invoice could not be found.', 'error');
        return;
    }
    closeInvoiceModal();
    let modal = document.getElementById('invoiceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invoiceModal';
        modal.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'invoiceModalTitle');
        modal.addEventListener('click', event => {
            if (event.target === modal) closeInvoiceModal();
        });
        document.body.append(modal);
    }
    modal.innerHTML = `
        <section class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
                <div><h2 id="invoiceModalTitle" class="text-xl font-bold text-slate-800">Payment invoice</h2><p class="text-sm text-slate-500">${escapeHTML(invoice.id)}</p></div>
                <button type="button" onclick="closeInvoiceModal()" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close invoice"><i class="fas fa-times"></i></button>
            </div>
            ${renderInvoiceDocument(invoice)}
            <p id="invoiceEmailStatus" class="mt-4 text-sm text-slate-500">${escapeHTML(getInvoiceEmailStatusText(invoice))}</p>
            <div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onclick="printInvoice('${escapeHTML(invoice.id)}')" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"><i class="fas fa-print mr-2"></i>Print / Save PDF</button>
                <button type="button" onclick="closeInvoiceModal()" class="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Close</button>
            </div>
        </section>`;
    invoiceModalKeydownHandler = event => {
        if (event.key === 'Escape') {
            closeInvoiceModal();
        }
    };
    document.addEventListener('keydown', invoiceModalKeydownHandler);
}

function renderInvoiceDocument(invoice) {
    return `
        <article id="invoiceDocument" class="space-y-5 rounded-xl border border-slate-200 p-5">
            <header class="flex flex-wrap justify-between gap-4">
                <div><p class="text-xs font-semibold uppercase tracking-wider text-primary-700">School invoice / payment receipt</p><h3 class="mt-1 text-xl font-bold text-slate-800">${escapeHTML(invoice.schoolName)}</h3></div>
                <div class="text-right text-sm"><p><span class="text-slate-500">Invoice:</span> <strong>${escapeHTML(invoice.id)}</strong></p><p><span class="text-slate-500">Date:</span> ${escapeHTML(invoice.issueDate)}</p><p class="mt-1 font-bold text-primary-700">PAID</p></div>
            </header>
            <div class="grid gap-2 border-y border-slate-100 py-4 text-sm sm:grid-cols-2">
                <p><span class="text-slate-500">Student:</span> <strong>${escapeHTML(invoice.studentName)}</strong></p>
                <p><span class="text-slate-500">Student ID:</span> ${escapeHTML(invoice.studentId)}</p>
                <p><span class="text-slate-500">Class:</span> ${escapeHTML(invoice.className)}</p>
                <p><span class="text-slate-500">Parent / guardian:</span> ${escapeHTML(invoice.parentName || 'Not provided')}</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-slate-600"><tr><th class="px-3 py-2">Description</th><th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-right">Paid</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">${invoice.feeLines.map(line => `<tr><td class="px-3 py-3">${escapeHTML(line.type)}</td><td class="px-3 py-3 text-right">${formatNaira(line.amount)}</td><td class="px-3 py-3 text-right">${formatNaira(line.paid)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="ml-auto grid max-w-xs gap-1 border-t border-slate-200 pt-3 text-right text-sm">
                <p>Total fees: <strong>${formatNaira(invoice.totalAmount)}</strong></p>
                <p>Total paid: <strong>${formatNaira(invoice.amountPaid)}</strong></p>
                <p class="text-base">Balance: <strong>${formatNaira(invoice.amountDue)}</strong></p>
            </div>
            <p class="text-xs text-slate-500">This receipt confirms the student’s fee account was fully settled on the invoice date.</p>
        </article>`;
}

function printInvoice(invoiceId) {
    const invoice = store.invoices.find(item => item.id === invoiceId);
    if (!invoice) {
        showToast('This invoice could not be found.', 'error');
        return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        showToast('Allow pop-ups to print or save the invoice as a PDF.', 'error');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(invoice.id)} - ${escapeHTML(invoice.schoolName)}</title><style>
        body{font:14px Arial,sans-serif;color:#1e293b;margin:36px}header,.between{display:flex;justify-content:space-between;gap:24px}h1{font-size:22px;margin:8px 0}.muted{color:#64748b}.paid{color:#15803d;font-weight:bold;margin-top:8px}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-block:1px solid #e2e8f0;padding:18px 0;margin:20px 0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0}th{background:#f8fafc}.right{text-align:right}.totals{margin-left:auto;width:270px;text-align:right;border-top:1px solid #cbd5e1;padding-top:12px;line-height:1.8}.note{font-size:12px;color:#64748b;margin-top:28px}@media print{body{margin:15mm}}
    </style></head><body><header><div><p class="muted">SCHOOL INVOICE / PAYMENT RECEIPT</p><h1>${escapeHTML(invoice.schoolName)}</h1></div><div class="right"><p>Invoice: <strong>${escapeHTML(invoice.id)}</strong></p><p>Date: ${escapeHTML(invoice.issueDate)}</p><p class="paid">PAID</p></div></header><div class="details"><div>Student: <strong>${escapeHTML(invoice.studentName)}</strong></div><div>Student ID: ${escapeHTML(invoice.studentId)}</div><div>Class: ${escapeHTML(invoice.className)}</div><div>Parent / guardian: ${escapeHTML(invoice.parentName || 'Not provided')}</div></div><table><thead><tr><th>Description</th><th class="right">Amount</th><th class="right">Paid</th></tr></thead><tbody>${invoice.feeLines.map(line => `<tr><td>${escapeHTML(line.type)}</td><td class="right">${formatNaira(line.amount)}</td><td class="right">${formatNaira(line.paid)}</td></tr>`).join('')}</tbody></table><div class="totals"><div>Total fees: <strong>${formatNaira(invoice.totalAmount)}</strong></div><div>Total paid: <strong>${formatNaira(invoice.amountPaid)}</strong></div><div>Balance: <strong>${formatNaira(invoice.amountDue)}</strong></div></div><p class="note">This receipt confirms the student’s fee account was fully settled on the invoice date.</p><script>window.addEventListener('load',()=>{window.focus();window.print();});</script></body></html>`);
    printWindow.document.close();
}

// ===================== CLASS TUITION SETTINGS =====================
function renderClassFees() {
    if (store.currentRole !== 'admin') {
        return '<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">Class fee settings are only available to administrators.</div>';
    }
    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">Class Fees</h1>
            <p class="text-slate-500">Set tuition for each class. Changes update enrolled students’ tuition balances.</p>
        </div>
        <form onsubmit="saveClassFees(event)" class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full min-w-[38rem] text-left text-sm">
                    <thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">Class</th><th class="px-4 py-3">Enrolled students</th><th class="px-4 py-3">Tuition fee (₦)</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                        ${store.classes.map(classroom => {
                            const enrolled = store.students.filter(student => getStudentClassRecord(student)?.id === classroom.id).length;
                            return `<tr>
                                <td class="px-4 py-3 font-medium text-slate-800">${escapeHTML(classroom.name)}</td>
                                <td class="px-4 py-3 text-slate-500">${enrolled}</td>
                                <td class="px-4 py-3"><input name="feeAmount_${escapeHTML(classroom.id)}" type="number" min="0" step="1" required value="${Number(classroom.feeAmount || 0)}" aria-label="${escapeHTML(classroom.name)} tuition fee" class="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"></td>
                            </tr>`;
                        }).join('') || '<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500">Add a class before setting its tuition fee.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <div class="flex justify-end border-t border-slate-100 p-4"><button type="submit" ${store.classes.length ? '' : 'disabled'} class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">Save class fees</button></div>
        </form>
        <p class="text-xs text-slate-500">Recorded payments are retained when a class fee changes. Any amount already paid above a new lower fee will not create a negative balance.</p>
    </div>`;
}

async function saveClassFees(event) {
    event.preventDefault();
    if (store.currentRole !== 'admin') {
        showToast('Only administrators can update class fees.', 'error');
        return;
    }

    const values = new FormData(event.currentTarget);
    const updatedFees = store.classes.map(classroom => ({
        classroom,
        amount: Number(values.get(`feeAmount_${classroom.id}`))
    }));
    if (updatedFees.some(item => !Number.isFinite(item.amount) || item.amount < 0)) {
        showToast('Enter a valid non-negative fee for every class.', 'error');
        return;
    }

    try {
        await Promise.all(updatedFees.map(({ classroom, amount }) => apiRequest(
            `/classes/${encodeURIComponent(classroom.id)}/fee`,
            { method: 'PATCH', body: JSON.stringify({ amount }) }
        )));
        await loadStoreData();
        showToast('Class fees saved and student fee accounts updated.', 'success');
        navigateTo('classFees');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===================== STUDENT FEE ACCOUNTS AND PAYMENT ENTRY =====================
function renderFees() {
    const isAdmin = store.currentRole === 'admin';
    const student = isAdmin ? null : getCurrentStudent();
    const visibleStudents = isAdmin
        ? store.students
        : store.currentRole === 'parent'
            ? store.students.filter(item => item.parentUserId === store.currentUser?.id)
            : [student].filter(Boolean);
    const visibleStudentIds = visibleStudents.map(item => item.id);
    const fees = store.fees.filter(fee => visibleStudentIds.includes(fee.studentId));
    const payments = store.payments.filter(payment => visibleStudentIds.includes(payment.studentId));
    const totalDue = fees.reduce((sum, fee) => sum + Math.max(0, Number(fee.amount) - Number(fee.paid)), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return `
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold text-slate-800">${isAdmin ? 'Fees & Payments' : 'School Fees'}</h1><p class="text-slate-500">${isAdmin ? 'Track fee balances and record payments.' : `Fee account for ${escapeHTML(student?.name || 'your child')}.`}</p></div></div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Payments recorded</p><p class="mt-1 text-2xl font-bold text-primary-700">${formatNaira(totalPaid)}</p></div>
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Outstanding balance</p><p class="mt-1 text-2xl font-bold text-amber-600">${formatNaira(totalDue)}</p></div>
            <div class="rounded-xl border border-slate-100 bg-white p-5"><p class="text-sm text-slate-500">Fee accounts</p><p class="mt-1 text-2xl font-bold text-slate-800">${fees.length}</p></div>
        </div>
        ${totalDue > 0 && ['admin', 'parent'].includes(store.currentRole) ? `<form onsubmit="recordFeePayment(event)" class="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-3">
            <select name="feeId" required class="rounded-lg border p-2 text-sm">${fees.filter(fee => Number(fee.amount) > Number(fee.paid)).map(fee => `<option value="${escapeHTML(fee.id)}">${escapeHTML(store.students.find(item => item.id === fee.studentId)?.name || fee.studentId)} · ${escapeHTML(fee.type)} · ${formatNaira(fee.amount - fee.paid)}</option>`).join('')}</select>
            <input name="amount" type="number" min="1" step="1" required placeholder="Amount (₦)" class="rounded-lg border p-2 text-sm">
            <button class="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"><i class="fas fa-credit-card mr-2"></i>Record payment</button>
        </form>` : totalDue > 0 ? '<div class="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">Ask a parent or school administrator to arrange a payment.</div>' : '<div class="rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800"><i class="fas fa-check-circle mr-2"></i>All displayed fees are paid.</div>'}
        <div class="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-slate-600"><tr>${isAdmin ? '<th class="px-4 py-3">Student</th>' : ''}<th class="px-4 py-3">Fee type</th><th class="px-4 py-3">Amount</th><th class="px-4 py-3">Paid</th><th class="px-4 py-3">Balance</th><th class="px-4 py-3">Due date</th></tr></thead><tbody class="divide-y divide-slate-100">${fees.map(fee => {
            const owner = store.students.find(item => item.id === fee.studentId);
            const balance = Math.max(0, Number(fee.amount) - Number(fee.paid));
            return `<tr>${isAdmin ? `<td class="px-4 py-3 font-medium">${escapeHTML(owner?.name || fee.studentId)}</td>` : ''}<td class="px-4 py-3">${escapeHTML(fee.type)}</td><td class="px-4 py-3">${formatNaira(fee.amount)}</td><td class="px-4 py-3">${formatNaira(fee.paid)}</td><td class="px-4 py-3 font-semibold ${balance ? 'text-amber-700' : 'text-primary-700'}">${formatNaira(balance)}</td><td class="px-4 py-3 text-slate-500">${escapeHTML(fee.dueDate)}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No fee records found.</td></tr>'}</tbody></table></div>
        <section class="rounded-xl border border-slate-100 bg-white shadow-sm"><h2 class="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">Payment history</h2><div class="divide-y divide-slate-100">${payments.map(payment => `<div class="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"><span class="text-slate-700">${escapeHTML(store.students.find(item => item.id === payment.studentId)?.name || '')} · ${escapeHTML(payment.type)}</span><span class="text-slate-500">${escapeHTML(payment.date)} · ${escapeHTML(payment.method)}</span><strong class="text-primary-700">${formatNaira(payment.amount)}</strong></div>`).join('') || '<p class="p-4 text-sm text-slate-500">No payments have been recorded.</p>'}</div></section>
        <section class="rounded-xl border border-slate-100 bg-white shadow-sm">
            <h2 class="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">Invoices & receipts</h2>
            <div class="divide-y divide-slate-100">
                ${store.invoices.filter(invoice => visibleStudentIds.includes(invoice.studentId)).map(invoice => `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><span><strong class="text-slate-800">${escapeHTML(invoice.id)}</strong><span class="ml-2 text-slate-500">${escapeHTML(invoice.studentName)} · ${escapeHTML(invoice.issueDate)}</span></span><button type="button" onclick="openInvoiceModal('${escapeHTML(invoice.id)}')" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">View invoice</button></div>`).join('')}
                ${visibleStudents.filter(item => getStudentFeeBalance(item.id) === 0 && getSettledInvoiceSnapshot(item) && !store.invoices.some(invoice => invoice.studentId === item.id && invoice.snapshotKey === JSON.stringify(getSettledInvoiceSnapshot(item)))).map(item => `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><span><strong class="text-slate-800">${escapeHTML(item.name)}</strong><span class="ml-2 text-slate-500">Fully paid</span></span><button type="button" onclick="generateSettledInvoice('${escapeHTML(item.id)}')" class="rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">Generate invoice</button></div>`).join('')}
                ${!store.invoices.some(invoice => visibleStudentIds.includes(invoice.studentId)) && !visibleStudents.some(item => getStudentFeeBalance(item.id) === 0 && getSettledInvoiceSnapshot(item)) ? '<p class="p-4 text-sm text-slate-500">Invoices will be available once a student’s full fee account is paid.</p>' : ''}
            </div>
        </section>
    </div>`;
}

async function recordFeePayment(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fee = store.fees.find(item => item.id === values.get('feeId'));
    const amount = Number(values.get('amount'));
    if (!fee || !Number.isFinite(amount) || amount <= 0) {
        showToast('Select a valid fee and payment amount.', 'error');
        return;
    }
    const studentId = fee.studentId;
    const balance = Number(fee.amount) - Number(fee.paid);
    if (amount > balance) {
        showToast(`Payment cannot exceed the outstanding balance of ${formatNaira(balance)}.`, 'error');
        return;
    }
    try {
        await apiRequest('/finance/payments', {
            method: 'POST',
            body: JSON.stringify({ studentId, feeId: fee.id, amount })
        });
        await loadStoreData();
        showToast('Payment recorded and saved.', 'success');
        navigateTo('fees');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
