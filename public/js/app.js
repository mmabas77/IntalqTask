// Global JavaScript for Exam Design System

$(document).ready(function() {
    // Initialize tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();
    
    // Initialize popovers
    $('[data-bs-toggle="popover"]').popover();
    
    // Auto-hide alerts after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut('slow');
    }, 5000);
    
    // Confirm delete actions
    $('.delete-btn').click(function(e) {
        e.preventDefault();
        const form = $(this).closest('form');
        const itemName = $(this).data('item-name') || 'this item';
        
        if (confirm(`Are you sure you want to delete ${itemName}? This action cannot be undone.`)) {
            form.submit();
        }
    });
    
    // Course selection in exam creation
    $('#courseSelect').change(function() {
        const courseId = $(this).val();
        if (courseId) {
            loadCourseInfo(courseId);
        } else {
            $('#courseInfo').hide();
        }
    });
    
    // Real-time exam requirement validation
    $('.exam-requirement').on('input', function() {
        validateExamRequirements();
    });
    
    // Initialize exam form validation
    if ($('#examForm').length) {
        initializeExamForm();
    }
    
    // Initialize question statistics
    if ($('.chapter-stats').length) {
        loadChapterStatistics();
    }
});

// Load course information for exam creation
function loadCourseInfo(courseId) {
    $.ajax({
        url: `/exams/course/${courseId}/info`,
        method: 'GET',
        success: function(data) {
            displayCourseInfo(data);
            updateExamConstraints(data);
        },
        error: function() {
            showAlert('Error loading course information', 'danger');
        }
    });
}

// Display course information
function displayCourseInfo(data) {
    const courseInfo = $('#courseInfo');
    let html = `
        <div class="row">
            <div class="col-md-6">
                <h5>${data.course.name}</h5>
                <p><strong>Total Chapters:</strong> ${data.totalChapters}</p>
            </div>
            <div class="col-md-6">
                <h6>Chapter Status:</h6>
                <div class="chapter-status">
    `;
    
    data.chapters.forEach(chapter => {
        const statusClass = chapter.isComplete ? 'success' : 'warning';
        const statusText = chapter.isComplete ? 'Complete' : 'Incomplete';
        html += `
            <span class="badge bg-${statusClass} me-1">
                Ch ${chapter.chapterNumber}: ${chapter.questionCount}/12 (${statusText})
            </span>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    courseInfo.html(html).show();
}

// Update exam constraints based on course
function updateExamConstraints(data) {
    const maxQuestionsPerChapter = Math.min(...data.chapters.map(c => c.questionCount));
    $('#questionsPerChapter').attr('max', maxQuestionsPerChapter);
    
    if (maxQuestionsPerChapter < 12) {
        showAlert(`Warning: Some chapters have fewer than 12 questions. Maximum questions per chapter: ${maxQuestionsPerChapter}`, 'warning');
    }
}

// Validate exam requirements in real-time
function validateExamRequirements() {
    const courseId = $('#courseSelect').val();
    if (!courseId) return;
    
    const requirements = {
        courseId: courseId,
        questionsPerChapter: parseInt($('#questionsPerChapter').val()) || 0,
        simpleQuestions: parseInt($('#simpleQuestions').val()) || 0,
        difficultQuestions: parseInt($('#difficultQuestions').val()) || 0,
        remindingQuestions: parseInt($('#remindingQuestions').val()) || 0,
        understandingQuestions: parseInt($('#understandingQuestions').val()) || 0,
        creativityQuestions: parseInt($('#creativityQuestions').val()) || 0
    };
    
    // Client-side validation
    const totalQuestions = requirements.questionsPerChapter * $('#courseSelect option:selected').data('chapters') || 0;
    const totalByDifficulty = requirements.simpleQuestions + requirements.difficultQuestions;
    const totalByObjective = requirements.remindingQuestions + requirements.understandingQuestions + requirements.creativityQuestions;
    
    let isValid = true;
    let errors = [];
    
    if (totalByDifficulty !== totalQuestions) {
        errors.push(`Total difficulty questions (${totalByDifficulty}) must equal total questions (${totalQuestions})`);
        isValid = false;
    }
    
    if (totalByObjective !== totalQuestions) {
        errors.push(`Total objective questions (${totalByObjective}) must equal total questions (${totalQuestions})`);
        isValid = false;
    }
    
    updateValidationDisplay(isValid, errors);
    
    // Server-side validation
    if (Object.values(requirements).every(v => v > 0)) {
        $.ajax({
            url: '/exams/validate',
            method: 'POST',
            data: requirements,
            success: function(data) {
                updateValidationDisplay(data.valid, data.errors);
                $('#generateBtn').prop('disabled', !data.valid);
            }
        });
    }
}

// Update validation display
function updateValidationDisplay(isValid, errors) {
    const validationDiv = $('#validationResults');
    
    if (errors.length === 0) {
        validationDiv.hide();
        $('#generateBtn').prop('disabled', false);
        return;
    }
    
    let html = '<div class="alert alert-' + (isValid ? 'warning' : 'danger') + '">';
    html += '<strong>Validation Issues:</strong><ul>';
    errors.forEach(error => {
        html += `<li>${error}</li>`;
    });
    html += '</ul></div>';
    
    validationDiv.html(html).show();
    $('#generateBtn').prop('disabled', !isValid);
}

// Initialize exam form
function initializeExamForm() {
    const form = $('#examForm');
    
    form.submit(function(e) {
        e.preventDefault();
        
        // Show loading spinner
        showSpinner();
        
        // Submit form
        $.ajax({
            url: form.attr('action'),
            method: 'POST',
            data: form.serialize(),
            success: function(data) {
                hideSpinner();
                if (data.success) {
                    window.location.href = data.redirect;
                } else {
                    showAlert(data.message || 'Error generating exam', 'danger');
                }
            },
            error: function(xhr) {
                hideSpinner();
                showAlert('Error generating exam. Please try again.', 'danger');
            }
        });
    });
}

// Load chapter statistics
function loadChapterStatistics() {
    $('.chapter-stats').each(function() {
        const chapterId = $(this).data('chapter-id');
        const element = $(this);
        
        $.ajax({
            url: `/questions/chapter/${chapterId}/stats`,
            method: 'GET',
            success: function(data) {
                updateChapterStats(element, data);
            }
        });
    });
}

// Update chapter statistics display
function updateChapterStats(element, data) {
    const progressPercent = (data.total / 12) * 100;
    
    let html = `
        <div class="progress mb-2">
            <div class="progress-bar" role="progressbar" style="width: ${progressPercent}%">
                ${data.total}/12 Questions
            </div>
        </div>
        <div class="row text-center">
            <div class="col-4">
                <small class="text-muted">Difficulty</small><br>
                <span class="badge bg-success">${data.difficulty.simple}</span>
                <span class="badge bg-danger">${data.difficulty.difficult}</span>
            </div>
            <div class="col-8">
                <small class="text-muted">Objective</small><br>
                <span class="badge bg-info">${data.objective.reminding}</span>
                <span class="badge bg-warning text-dark">${data.objective.understanding}</span>
                <span class="badge bg-secondary">${data.objective.creativity}</span>
            </div>
        </div>
    `;
    
    element.html(html);
}

// Utility functions
function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('main .container').prepend(alertHtml);
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut('slow');
    }, 5000);
}

function showSpinner() {
    const spinnerHtml = `
        <div class="spinner-overlay">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    $('body').append(spinnerHtml);
}

function hideSpinner() {
    $('.spinner-overlay').remove();
}

// Question form validation
function validateQuestionForm() {
    const choices = [
        $('input[name="choice1"]').val().trim(),
        $('input[name="choice2"]').val().trim(),
        $('input[name="choice3"]').val().trim()
    ];
    
    // Check for empty choices
    if (choices.some(choice => choice === '')) {
        showAlert('All choices must be filled', 'danger');
        return false;
    }
    
    // Check for duplicate choices
    const uniqueChoices = [...new Set(choices)];
    if (uniqueChoices.length !== choices.length) {
        showAlert('All choices must be different', 'danger');
        return false;
    }
    
    return true;
}

// Chart initialization for statistics
function initializeCharts() {
    // Initialize Chart.js charts if needed
    if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('statisticsChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Simple', 'Difficult'],
                    datasets: [{
                        data: [60, 40],
                        backgroundColor: ['#198754', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }
}

// Export functionality
function exportExam(examId) {
    window.open(`/exams/${examId}/export`, '_blank');
}

// Print functionality
function printExam() {
    window.print();
}

// Regenerate exam
function regenerateExam(examId) {
    if (confirm('Are you sure you want to regenerate this exam? This will create a new question selection.')) {
        showSpinner();
        
        $.ajax({
            url: `/exams/${examId}/regenerate`,
            method: 'POST',
            success: function() {
                hideSpinner();
                location.reload();
            },
            error: function() {
                hideSpinner();
                showAlert('Error regenerating exam', 'danger');
            }
        });
    }
}
