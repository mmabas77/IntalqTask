// Exam creation specific JavaScript
$(document).ready(function() {
    // Check if jQuery is available
    if (typeof $ === 'undefined') {
        console.error('jQuery is not available');
        return;
    }
    // Calculate total questions when inputs change
    window.updateTotalQuestions = function() {
        try {
            // Check if required DOM elements exist
            if (!$('#questionsPerChapter').length || !$('#courseSelect').length || !$('#totalQuestions').length) {
                console.warn('Required DOM elements for updateTotalQuestions not found');
                return;
            }
            
            const questionsPerChapter = parseInt($('#questionsPerChapter').val()) || 0;
            const selectedCourse = $('#courseSelect option:selected');
            const chapters = parseInt(selectedCourse.attr('data-chapters')) || 0;
            const total = questionsPerChapter * chapters;
            $('#totalQuestions').text(total);
            
            // Enhanced logging for debugging
            console.log('Total questions updated:', total, 'chapters:', chapters, 'questionsPerChapter:', questionsPerChapter);
            console.log('Selected course:', selectedCourse.val(), 'data-chapters:', selectedCourse.attr('data-chapters'));
            console.log('Course select element:', $('#courseSelect').length);
            console.log('Selected option element:', selectedCourse.length);
            
            // Validate calculation
            if (total === 0 && questionsPerChapter > 0) {
                console.warn('Total questions is 0 but questionsPerChapter is', questionsPerChapter);
                console.warn('This suggests chapters count is 0 or undefined');
            }
            
            // Try alternative method if chapters is 0
            if (chapters === 0 && selectedCourse.val()) {
                console.log('Trying to extract chapters from option text');
                const optionText = selectedCourse.text();
                const match = optionText.match(/\((\d+)\s+chapters?\)/);
                if (match) {
                    const chaptersFromText = parseInt(match[1]);
                    console.log('Found chapters from text:', chaptersFromText);
                    const recalculatedTotal = questionsPerChapter * chaptersFromText;
                    $('#totalQuestions').text(recalculatedTotal);
                    console.log('Recalculated total:', recalculatedTotal);
                }
            }
        } catch (error) {
            console.error('Error in updateTotalQuestions:', error);
        }
    }

    // Bind events for total questions calculation
    if ($('#questionsPerChapter').length) {
        $('#questionsPerChapter').on('change input', window.updateTotalQuestions);
    } else {
        console.warn('questionsPerChapter element not found for event binding');
    }
    
    // Load course info if already selected
    if ($('#courseSelect').length && $('#courseSelect').val()) {
        // Check if loadCourseInfo function exists before calling it
        if (typeof loadCourseInfo === 'function') {
            loadCourseInfo($('#courseSelect').val());
        } else {
            console.warn('loadCourseInfo function not available');
        }
        
        window.updateTotalQuestions();
        
        // Trigger validation after course is loaded
        setTimeout(function() {
            if (typeof validateExamRequirements === 'function') {
                validateExamRequirements();
            } else {
                console.warn('validateExamRequirements function not available');
            }
        }, 500);
    }
    
    // Initial call to update total questions
    window.updateTotalQuestions();
});