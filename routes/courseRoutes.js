const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const courseController = require('../controllers/courseController');

// Validation rules
const courseValidation = [
    body('name')
        .notEmpty()
        .withMessage('Course name is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('Course name must be between 2 and 200 characters')
        .trim(),
    body('numberOfChapters')
        .notEmpty()
        .withMessage('Number of chapters is required')
        .isInt({ min: 1, max: 50 })
        .withMessage('Number of chapters must be between 1 and 50')
];

// Routes
router.get('/', courseController.index);
router.get('/create', courseController.create);
router.post('/', courseValidation, courseController.store);
router.get('/:id', courseController.show);
router.get('/:id/edit', courseController.edit);
router.put('/:id', courseValidation, courseController.update);
router.delete('/:id', courseController.destroy);
router.get('/:id/statistics', courseController.getStatistics);

module.exports = router;
