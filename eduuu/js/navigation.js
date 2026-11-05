// ===================== PAGE ROUTING =====================
function navigateTo(page) {
    store.currentPage = page;
    renderSidebar();
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-circle-notch fa-spin text-3xl text-primary-600"></i></div>';

    setTimeout(() => {
        const renderers = {
            dashboard: renderDashboard,
            writeLessonNote: renderWriteLessonNote,
            teacherAttendance: renderTeacherAttendance,
            teacherAssignments: renderTeacherAssignments,
            studentAssignments: renderStudentAssignments,
            reports: renderReportsManager,
            students: renderStudents,
            teachers: renderTeachers,
            classes: renderClasses,
            classFees: renderClassFees,
            gradeEntry: renderGradeEntry,
            attendance: renderAttendanceOverview,
            grades: renderGrades,
            lessonPlans: renderLessonPlans,
            fees: renderFees,
            library: renderLibrary,
            timetable: renderTimetable,
            announcements: renderAnnouncements,
            settings: renderSettings,
            myClasses: renderMyClasses,
            myStudents: renderMyStudents,
            childProfile: renderChildProfile,
            academicPerformance: renderAcademicPerformance,
            teacherMessages: renderTeacherMessages
        };
        const renderer = renderers[page] || renderDashboard;
        content.innerHTML = renderer();
        if (page === 'dashboard' && store.currentRole === 'admin') {
            initializeAdminEnrollmentChart();
        }
    }, 150);
}
