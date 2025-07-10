// Global JavaScript for Exam Design System

// Helper function to ensure URLs use current protocol
function getCurrentProtocolUrl(path) {
    // Remove leading slash if present, we'll add it
    path = path.replace(/^\//, '');
    return `${window.location.protocol}//${window.location.host}/${path}`;
}

// Helper function to make protocol-relative URLs
function makeRelativeUrl(path) {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    return path;
}

$(document).ready(function() {
    // Configure jQuery AJAX to use relative URLs
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            // Ensure URL is relative by stripping protocol and host
            if (settings.url) {
                // Remove any absolute URL parts and keep only the path
                settings.url = settings.url.replace(/^https?:\/\/[^\/]+/, '');
                // Ensure it starts with /
                if (!settings.url.startsWith('/')) {
                    settings.url = '/' + settings.url;
                }
            }
        }
    });

    // Fix form actions to be relative
    $('form').each(function() {
        var action = $(this).attr('action');
        if (action) {
            // Remove any protocol/host from action
            action = action.replace(/^https?:\/\/[^\/]+/, '');
            // Ensure it starts with /
            if (!action.startsWith('/')) {
                action = '/' + action;
            }
            $(this).attr('action', action);
        }
    });
    
    // Initialize tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();
    
    // Initialize popovers
    $('[data-bs-toggle="popover"]').popover();
    
    // Don't auto-hide alerts - let users dismiss them manually
    
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
        console.log('Course selected:', courseId);
        if (courseId) {
            // Show course info immediately and keep it visible
            $('#courseInfo').show();
            loadCourseInfo(courseId);
            // Reset button state while loading
            $('#generateBtn').prop('disabled', true);
            // Update total questions
            if (typeof window.updateTotalQuestions === 'function') {
                window.updateTotalQuestions();
            }
        } else {
            // Only hide course info if explicitly selecting empty option
            $('#courseInfo').hide();
            $('#generateBtn').prop('disabled', true);
            $('#totalQuestions').text('0');
        }
    });
    
    // Real-time exam requirement validation
    $('.exam-requirement, #title').on('input', function() {
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
    console.log('Loading course info for:', courseId);
    $.ajax({
        url: makeRelativeUrl(`/exams/course/${courseId}/info`),
        method: 'GET',
        success: function(data) {
            console.log('Course info loaded:', data);
            displayCourseInfo(data);
            updateExamConstraints(data);
            // Update total questions after course info is loaded
            if (typeof window.updateTotalQuestions === 'function') {
                window.updateTotalQuestions();
            }
            // Trigger validation after course info is loaded
            setTimeout(function() {
                validateExamRequirements();
            }, 100);
        },
        error: function(xhr, status, error) {
            console.error('Error loading course info:', error);
            showAlert('Error loading course information', 'danger');
            // Don't hide course info on error - keep previous data visible
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
    console.log('Validating exam requirements, courseId:', courseId);
    if (!courseId) {
        $('#generateBtn').prop('disabled', true);
        console.log('No course selected, disabling generate button');
        // Don't hide course info - keep it visible if it exists
        return;
    }
    
    const requirements = {
        courseId: courseId,
        questionsPerChapter: parseInt($('#questionsPerChapter').val()) || 0,
        simpleQuestions: parseInt($('#simpleQuestions').val()) || 0,
        difficultQuestions: parseInt($('#difficultQuestions').val()) || 0,
        remindingQuestions: parseInt($('#remindingQuestions').val()) || 0,
        understandingQuestions: parseInt($('#understandingQuestions').val()) || 0,
        creativityQuestions: parseInt($('#creativityQuestions').val()) || 0
    };
    
    // Check if all fields are filled including title
    const examTitle = $('#title').val().trim();
    const numericFields = [
        requirements.questionsPerChapter,
        requirements.simpleQuestions,
        requirements.difficultQuestions,
        requirements.remindingQuestions,
        requirements.understandingQuestions,
        requirements.creativityQuestions
    ];
    const allFieldsFilled = numericFields.every(v => v > 0) && examTitle.length > 0;
    if (!allFieldsFilled) {
        $('#generateBtn').prop('disabled', true);
        return;
    }
    
    // Client-side validation
    const totalQuestions = requirements.questionsPerChapter * (parseInt($('#courseSelect option:selected').attr('data-chapters')) || 0);
    const totalByDifficulty = requirements.simpleQuestions + requirements.difficultQuestions;
    const totalByObjective = requirements.remindingQuestions + requirements.understandingQuestions + requirements.creativityQuestions;
    
    let isValid = true;
    let errors = [];
    
    if (totalQuestions === 0) {
        errors.push('Please select a course first');
        isValid = false;
        console.log('Total questions is 0, adding error. chapters attr:', $('#courseSelect option:selected').attr('data-chapters'));
    }
    
    if (totalByDifficulty !== totalQuestions && totalQuestions > 0) {
        errors.push(`Total difficulty questions (${totalByDifficulty}) must equal total questions (${totalQuestions})`);
        isValid = false;
    }
    
    if (totalByObjective !== totalQuestions && totalQuestions > 0) {
        errors.push(`Total objective questions (${totalByObjective}) must equal total questions (${totalQuestions})`);
        isValid = false;
    }
    
    updateValidationDisplay(isValid, errors);
    
    // Server-side validation only if client-side validation passes
    if (isValid && allFieldsFilled) {
        $.ajax({
            url: makeRelativeUrl('/exams/validate'),
            method: 'POST',
            data: requirements,
            success: function(data) {
                updateValidationDisplay(data.valid, data.errors);
                $('#generateBtn').prop('disabled', !data.valid);
            },
            error: function() {
                $('#generateBtn').prop('disabled', true);
            }
        });
    } else {
        $('#generateBtn').prop('disabled', true);
    }
}

// Update validation display
function updateValidationDisplay(isValid, errors) {
    const validationDiv = $('#validationResults');
    
    if (errors.length === 0) {
        validationDiv.hide();
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
            url: makeRelativeUrl('/exams/generate'),
            method: 'POST',
            data: form.serialize(),
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function(data) {
                hideSpinner();
                if (data.success) {
                    // Ensure redirect URL is relative
                    let redirectUrl = data.redirect;
                    if (redirectUrl) {
                        // Remove any protocol/host from redirect URL
                        redirectUrl = redirectUrl.replace(/^https?:\/\/[^\/]+/, '');
                        // Ensure it starts with /
                        if (!redirectUrl.startsWith('/')) {
                            redirectUrl = '/' + redirectUrl;
                        }
                        window.location.href = redirectUrl;
                    }
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
            url: makeRelativeUrl(`/questions/chapter/${chapterId}/stats`),
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
    
    // Don't auto-hide alerts - let users dismiss them manually
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
            url: makeRelativeUrl(`/exams/${examId}/regenerate`),
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
