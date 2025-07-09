const { Question, Chapter, Course } = require('../models');
const { validationResult } = require('express-validator');

class QuestionController {
    // Display questions for a chapter
    async index(req, res) {
        try {
            const { chapterId } = req.params;
            const chapter = await Chapter.findById(chapterId).populate('courseId');
            
            if (!chapter) {
                req.flash('error', 'Chapter not found');
                return res.redirect('/courses');
            }

            const questions = await Question.find({ chapterId: chapterId }).sort({ createdAt: -1 });
            
            // Count questions by type
            const questionCounts = {
                total: questions.length,
                simple: questions.filter(q => q.difficulty === 'simple').length,
                difficult: questions.filter(q => q.difficulty === 'difficult').length,
                reminding: questions.filter(q => q.objective === 'reminding').length,
                understanding: questions.filter(q => q.objective === 'understanding').length,
                creativity: questions.filter(q => q.objective === 'creativity').length
            };

            res.render('questions/index', {
                title: `Questions - ${chapter.title}`,
                chapter: chapter,
                questions: questions,
                questionCounts: questionCounts
            });
        } catch (error) {
            console.error('Error loading questions:', error);
            req.flash('error', 'Error loading questions');
            res.redirect('/courses');
        }
    }

    // Show form to create new question
    async create(req, res) {
        try {
            const { chapterId } = req.params;
            const { objective } = req.query;
            const chapter = await Chapter.findById(chapterId).populate('courseId');
            
            if (!chapter) {
                req.flash('error', 'Chapter not found');
                return res.redirect('/courses');
            }

            // Check if chapter already has 12 questions
            const questionCount = await Question.countDocuments({ chapterId: chapterId });
            if (questionCount >= 12) {
                req.flash('error', 'Chapter already has the maximum number of questions (12)');
                return res.redirect(`/questions/chapter/${chapterId}`);
            }

            // Get current question counts by objective
            const questions = await Question.find({ chapterId: chapterId });
            const questionCounts = {
                total: questions.length,
                reminding: questions.filter(q => q.objective === 'reminding').length,
                understanding: questions.filter(q => q.objective === 'understanding').length,
                creativity: questions.filter(q => q.objective === 'creativity').length
            };

            res.render('questions/create', {
                title: 'Add New Question',
                chapter: chapter,
                objective: objective,
                questionCounts: questionCounts,
                errors: {}
            });
        } catch (error) {
            console.error('Error loading create form:', error);
            req.flash('error', 'Error loading form');
            res.redirect('/courses');
        }
    }

    // Store new question
    async store(req, res) {
        const { chapterId } = req.params;
        try {
            const chapter = await Chapter.findById(chapterId).populate('courseId');
            
            if (!chapter) {
                req.flash('error', 'Chapter not found');
                return res.redirect('/courses');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/create', {
                    title: 'Add New Question',
                    chapter: chapter,
                    questionCounts: questionCounts,
                    errors: errors.mapped(),
                    oldInput: req.body
                });
            }

            // Check if chapter already has 12 questions
            const questionCount = await Question.countDocuments({ chapterId: chapterId });
            if (questionCount >= 12) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/create', {
                    title: 'Add New Question',
                    chapter: chapter,
                    questionCounts: questionCounts,
                    errors: { general: { msg: 'Chapter already has the maximum number of questions (12)' } },
                    oldInput: req.body
                });
            }

            const { text, choice1, choice2, choice3, correctAnswer, difficulty, objective } = req.body;

            // Validate that choices are not empty and different
            const choices = [choice1.trim(), choice2.trim(), choice3.trim()];
            if (choices.some(choice => choice === '')) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/create', {
                    title: 'Add New Question',
                    chapter: chapter,
                    questionCounts: questionCounts,
                    errors: { choices: { msg: 'All choices must be filled' } },
                    oldInput: req.body
                });
            }

            // Check for duplicate choices
            const uniqueChoices = [...new Set(choices)];
            if (uniqueChoices.length !== choices.length) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/create', {
                    title: 'Add New Question',
                    chapter: chapter,
                    questionCounts: questionCounts,
                    errors: { choices: { msg: 'All choices must be different' } },
                    oldInput: req.body
                });
            }

            // Check objective distribution constraint
            const questions = await Question.find({ chapterId: chapterId });
            const currentObjectiveCounts = {
                reminding: 0,
                understanding: 0,
                creativity: 0
            };
            questions.forEach(q => {
                currentObjectiveCounts[q.objective]++;
            });
            if (currentObjectiveCounts[objective] >= 4) {
                // Get current question counts for error rendering
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/create', {
                    title: 'Add New Question',
                    chapter: chapter,
                    questionCounts: questionCounts,
                    errors: { 
                        objective: { 
                            msg: `This chapter already has 4 ${objective} questions. Each chapter must have equal distribution (4 of each type).` 
                        } 
                    },
                    oldInput: req.body
                });
            }

            const question = new Question({
                chapterId: chapterId,
                questionText: text.trim(),
                choices: choices,
                correctAnswer: parseInt(correctAnswer),
                difficulty: difficulty,
                objective: objective
            });

            await question.save();
            req.flash('success', 'Question added successfully!');
            res.redirect(`/questions/chapter/${chapterId}`);
        } catch (error) {
            console.error('Error creating question:', error);
            console.error('Question data:', {
                chapterId,
                requestBody: req.body
            });
            req.flash('error', 'Error creating question: ' + error.message);
            res.redirect(`/questions/chapter/${chapterId}`);
        }
    }

    // Show single question
    async show(req, res) {
        try {
            const question = await Question.findById(req.params.id).populate({
                path: 'chapterId',
                populate: {
                    path: 'courseId'
                }
            });

            if (!question) {
                req.flash('error', 'Question not found');
                return res.redirect('/courses');
            }

            res.render('questions/show', {
                title: 'Question Details',
                question: question
            });
        } catch (error) {
            console.error('Error loading question:', error);
            req.flash('error', 'Error loading question');
            res.redirect('/courses');
        }
    }

    // Show edit form
    async edit(req, res) {
        try {
            const question = await Question.findById(req.params.id).populate({
                path: 'chapterId',
                populate: {
                    path: 'courseId'
                }
            });

            if (!question) {
                req.flash('error', 'Question not found');
                return res.redirect('/courses');
            }

            // Get current question counts by objective
            const questions = await Question.find({ chapterId: question.chapterId });
            const questionCounts = {
                total: questions.length,
                reminding: questions.filter(q => q.objective === 'reminding').length,
                understanding: questions.filter(q => q.objective === 'understanding').length,
                creativity: questions.filter(q => q.objective === 'creativity').length
            };

            res.render('questions/edit', {
                title: 'Edit Question',
                question: question,
                questionCounts: questionCounts,
                errors: {}
            });
        } catch (error) {
            console.error('Error loading edit form:', error);
            req.flash('error', 'Error loading form');
            res.redirect('/courses');
        }
    }

    // Update question
    async update(req, res) {
        try {
            const question = await Question.findById(req.params.id).populate({
                path: 'chapterId',
                populate: {
                    path: 'courseId'
                }
            });

            if (!question) {
                req.flash('error', 'Question not found');
                return res.redirect('/courses');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: question.chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/edit', {
                    title: 'Edit Question',
                    question: question,
                    questionCounts: questionCounts,
                    errors: errors.mapped(),
                    oldInput: req.body
                });
            }

            const { text, choice1, choice2, choice3, correctAnswer, difficulty, objective } = req.body;

            // Validate choices
            const choices = [choice1.trim(), choice2.trim(), choice3.trim()];
            if (choices.some(choice => choice === '')) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: question.chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/edit', {
                    title: 'Edit Question',
                    question: question,
                    questionCounts: questionCounts,
                    errors: { choices: { msg: 'All choices must be filled' } },
                    oldInput: req.body
                });
            }

            // Check for duplicate choices
            const uniqueChoices = [...new Set(choices)];
            if (uniqueChoices.length !== choices.length) {
                // Get current question counts for error rendering
                const questions = await Question.find({ chapterId: question.chapterId });
                const questionCounts = {
                    total: questions.length,
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                };
                
                return res.render('questions/edit', {
                    title: 'Edit Question',
                    question: question,
                    questionCounts: questionCounts,
                    errors: { choices: { msg: 'All choices must be different' } },
                    oldInput: req.body
                });
            }

            // Check objective distribution constraint (only if objective is changing)
            if (objective !== question.objective) {
                const currentObjectiveCounts = await this.getObjectiveCounts(question.chapterId);
                // Decrease old objective count
                currentObjectiveCounts[question.objective]--;
                // Check if new objective would exceed limit
                if (currentObjectiveCounts[objective] >= 4) {
                    // Get current question counts for error rendering
                    const questions = await Question.find({ chapterId: question.chapterId });
                    const questionCounts = {
                        total: questions.length,
                        reminding: questions.filter(q => q.objective === 'reminding').length,
                        understanding: questions.filter(q => q.objective === 'understanding').length,
                        creativity: questions.filter(q => q.objective === 'creativity').length
                    };
                    
                    return res.render('questions/edit', {
                        title: 'Edit Question',
                        question: question,
                        questionCounts: questionCounts,
                        errors: { 
                            objective: { 
                                msg: `This chapter already has 4 ${objective} questions. Each chapter must have equal distribution (4 of each type).` 
                            } 
                        },
                        oldInput: req.body
                    });
                }
            }

            question.questionText = text.trim();
            question.choices = choices;
            question.correctAnswer = parseInt(correctAnswer);
            question.difficulty = difficulty;
            question.objective = objective;

            await question.save();
            req.flash('success', 'Question updated successfully!');
            res.redirect(`/questions/${question._id}`);
        } catch (error) {
            console.error('Error updating question:', error);
            req.flash('error', 'Error updating question');
            res.redirect('/courses');
        }
    }

    // Delete question
    async destroy(req, res) {
        try {
            const question = await Question.findById(req.params.id);
            if (!question) {
                req.flash('error', 'Question not found');
                return res.redirect('/courses');
            }

            const chapterId = question.chapterId;
            await Question.findByIdAndDelete(req.params.id);
            
            req.flash('success', 'Question deleted successfully!');
            res.redirect(`/questions/chapter/${chapterId}`);
        } catch (error) {
            console.error('Error deleting question:', error);
            req.flash('error', 'Error deleting question');
            res.redirect('/courses');
        }
    }

    // Helper method to get objective counts for a chapter
    async getObjectiveCounts(chapterId) {
        const questions = await Question.find({ chapterId: chapterId });
        const counts = {
            reminding: 0,
            understanding: 0,
            creativity: 0
        };

        questions.forEach(q => {
            counts[q.objective]++;
        });

        return counts;
    }

    // API endpoint to get question statistics
    async getChapterStats(req, res) {
        try {
            const { chapterId } = req.params;
            const questions = await Question.find({ chapterId: chapterId });
            
            const stats = {
                total: questions.length,
                remaining: 12 - questions.length,
                difficulty: {
                    simple: questions.filter(q => q.difficulty === 'simple').length,
                    difficult: questions.filter(q => q.difficulty === 'difficult').length
                },
                objective: {
                    reminding: questions.filter(q => q.objective === 'reminding').length,
                    understanding: questions.filter(q => q.objective === 'understanding').length,
                    creativity: questions.filter(q => q.objective === 'creativity').length
                }
            };

            res.json(stats);
        } catch (error) {
            console.error('Error getting chapter stats:', error);
            res.status(500).json({ error: 'Error getting statistics' });
        }
    }
}

module.exports = new QuestionController();
