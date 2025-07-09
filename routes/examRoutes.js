const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const examController = require('../controllers/examController');

// Validation rules
const examValidation = [
    body('courseId')
        .notEmpty()
        .withMessage('Course is required')
        .isMongoId()
        .withMessage('Invalid course ID'),
    body('title')
        .notEmpty()
        .withMessage('Exam title is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('Exam title must be between 2 and 200 characters')
        .trim(),
    body('questionsPerChapter')
        .notEmpty()
        .withMessage('Questions per chapter is required')
        .isInt({ min: 1, max: 12 })
        .withMessage('Questions per chapter must be between 1 and 12'),
    body('simpleQuestions')
        .notEmpty()
        .withMessage('Number of simple questions is required')
        .isInt({ min: 0 })
        .withMessage('Number of simple questions must be non-negative'),
    body('difficultQuestions')
        .notEmpty()
        .withMessage('Number of difficult questions is required')
        .isInt({ min: 0 })
        .withMessage('Number of difficult questions must be non-negative'),
    body('remindingQuestions')
        .notEmpty()
        .withMessage('Number of reminding questions is required')
        .isInt({ min: 0 })
        .withMessage('Number of reminding questions must be non-negative'),
    body('understandingQuestions')
        .notEmpty()
        .withMessage('Number of understanding questions is required')
        .isInt({ min: 0 })
        .withMessage('Number of understanding questions must be non-negative'),
    body('creativityQuestions')
        .notEmpty()
        .withMessage('Number of creativity questions is required')
        .isInt({ min: 0 })
        .withMessage('Number of creativity questions must be non-negative')
];

// Routes
router.get('/', examController.index);
router.get('/create', examController.create);
router.post('/generate', examValidation, examController.generate);
router.get('/:id', examController.show);
router.delete('/:id', examController.destroy);
router.get('/:id/export', examController.export);
router.post('/:id/regenerate', examController.regenerate);
router.get('/course/:courseId/info', examController.getCourseInfo);
router.post('/validate', examController.validateRequirements);

module.exports = router;
