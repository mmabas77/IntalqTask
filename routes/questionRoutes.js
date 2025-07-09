const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const questionController = require('../controllers/questionController');

// Validation rules
const questionValidation = [
    body('questionText')
        .notEmpty()
        .withMessage('Question text is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Question text must be between 10 and 1000 characters')
        .trim(),
    body('choice1')
        .notEmpty()
        .withMessage('Choice 1 is required')
        .isLength({ min: 1, max: 200 })
        .withMessage('Choice 1 must be between 1 and 200 characters')
        .trim(),
    body('choice2')
        .notEmpty()
        .withMessage('Choice 2 is required')
        .isLength({ min: 1, max: 200 })
        .withMessage('Choice 2 must be between 1 and 200 characters')
        .trim(),
    body('choice3')
        .notEmpty()
        .withMessage('Choice 3 is required')
        .isLength({ min: 1, max: 200 })
        .withMessage('Choice 3 must be between 1 and 200 characters')
        .trim(),
    body('correctAnswer')
        .notEmpty()
        .withMessage('Correct answer is required')
        .isIn(['0', '1', '2'])
        .withMessage('Correct answer must be 0, 1, or 2'),
    body('difficulty')
        .notEmpty()
        .withMessage('Difficulty is required')
        .isIn(['simple', 'difficult'])
        .withMessage('Difficulty must be simple or difficult'),
    body('objective')
        .notEmpty()
        .withMessage('Objective is required')
        .isIn(['reminding', 'understanding', 'creativity'])
        .withMessage('Objective must be reminding, understanding, or creativity')
];

// Routes
router.get('/chapter/:chapterId', questionController.index);
router.get('/chapter/:chapterId/create', questionController.create);
router.post('/chapter/:chapterId', questionValidation, questionController.store);
router.get('/:id', questionController.show);
router.get('/:id/edit', questionController.edit);
router.put('/:id', questionValidation, questionController.update);
router.delete('/:id', questionController.destroy);
router.get('/chapter/:chapterId/stats', questionController.getChapterStats);

module.exports = router;
