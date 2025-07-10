const { Exam, Course, Chapter, Question } = require('../models');
const { validationResult } = require('express-validator');
const GeneticAlgorithm = require('../utils/geneticAlgorithm');

class ExamController {
    // Display all exams
    async index(req, res) {
        try {
            const exams = await Exam.find()
                .populate('courseId')
                .populate('selectedQuestions.questionId')
                .sort({ createdAt: -1 });
            res.render('exams/index', {
                title: 'Exams',
                exams: exams
            });
        } catch (error) {
            console.error('Error loading exams:', error);
            req.flash('error', 'Error loading exams');
            res.redirect('/');
        }
    }

    // Show form to create new exam
    async create(req, res) {
        try {
            const { courseId } = req.query;
            let selectedCourse = null;
            
            if (courseId) {
                selectedCourse = await Course.findById(courseId);
                if (!selectedCourse) {
                    req.flash('error', 'Course not found');
                    return res.redirect('/courses');
                }
            }

            const courses = await Course.find().sort({ name: 1 });
            
            res.render('exams/create', {
                title: 'Create New Exam',
                courses: courses,
                selectedCourse: selectedCourse,
                errors: {}
            });
        } catch (error) {
            console.error('Error loading create form:', error);
            req.flash('error', 'Error loading form');
            res.redirect('/courses');
        }
    }

    // Generate exam using genetic algorithm
    async generate(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const courses = await Course.find().sort({ name: 1 });
                const selectedCourse = await Course.findById(req.body.courseId);
                
                return res.render('exams/create', {
                    title: 'Create New Exam',
                    courses: courses,
                    selectedCourse: selectedCourse,
                    errors: errors.mapped(),
                    oldInput: req.body
                });
            }

            const {
                courseId,
                title,
                questionsPerChapter,
                simpleQuestions,
                difficultQuestions,
                remindingQuestions,
                understandingQuestions,
                creativityQuestions
            } = req.body;

            // Validate input
            const course = await Course.findById(courseId);
            if (!course) {
                req.flash('error', 'Course not found');
                return res.redirect('/exams/create');
            }

            // Check if requirements are feasible
            const totalQuestions = parseInt(questionsPerChapter) * course.numberOfChapters;
            const totalByDifficulty = parseInt(simpleQuestions) + parseInt(difficultQuestions);
            const totalByObjective = parseInt(remindingQuestions) + parseInt(understandingQuestions) + parseInt(creativityQuestions);

            if (totalByDifficulty !== totalQuestions) {
                const courses = await Course.find().sort({ name: 1 });
                return res.render('exams/create', {
                    title: 'Create New Exam',
                    courses: courses,
                    selectedCourse: course,
                    errors: { 
                        difficulty: { 
                            msg: `Total difficulty questions (${totalByDifficulty}) must equal total questions (${totalQuestions})` 
                        } 
                    },
                    oldInput: req.body
                });
            }

            if (totalByObjective !== totalQuestions) {
                const courses = await Course.find().sort({ name: 1 });
                return res.render('exams/create', {
                    title: 'Create New Exam',
                    courses: courses,
                    selectedCourse: course,
                    errors: { 
                        objective: { 
                            msg: `Total objective questions (${totalByObjective}) must equal total questions (${totalQuestions})` 
                        } 
                    },
                    oldInput: req.body
                });
            }

            // Get all chapters and their questions
            const chapters = await Chapter.find({ courseId: courseId });
            const allQuestions = await Question.find({ 
                chapterId: { $in: chapters.map(c => c._id) } 
            });

            // Check if there are enough questions
            const insufficientChapters = [];
            for (const chapter of chapters) {
                const chapterQuestions = allQuestions.filter(q => q.chapterId.toString() === chapter._id.toString());
                if (chapterQuestions.length < parseInt(questionsPerChapter)) {
                    insufficientChapters.push({
                        chapter: chapter,
                        available: chapterQuestions.length,
                        required: parseInt(questionsPerChapter)
                    });
                }
            }

            if (insufficientChapters.length > 0) {
                const maxQuestionsPerChapter = Math.min(...insufficientChapters.map(ic => ic.available));
                const totalAvailableQuestions = chapters.reduce((total, chapter) => {
                    const chapterQuestions = allQuestions.filter(q => q.chapterId.toString() === chapter._id.toString());
                    return total + chapterQuestions.length;
                }, 0);
                
                const suggestions = [
                    `Reduce "Questions per Chapter" to ${maxQuestionsPerChapter} or fewer.`,
                    `Alternatively, consider reducing the total questions to ${totalAvailableQuestions} and distribute them differently.`,
                    `You could also add more questions to the chapters with insufficient questions.`
                ];
                
                const courses = await Course.find().sort({ name: 1 });
                return res.render('exams/create', {
                    title: 'Create New Exam',
                    courses: courses,
                    selectedCourse: course,
                    errors: { 
                        insufficient: { 
                            msg: 'Some chapters don\'t have enough questions for your requirements.',
                            details: insufficientChapters.map(ic => 
                                `Chapter ${ic.chapter.chapterNumber}: has ${ic.available} questions, but you requested ${ic.required} per chapter`
                            ),
                            suggestions: suggestions
                        } 
                    },
                    oldInput: req.body
                });
            }

            // Prepare requirements for genetic algorithm
            const requirements = {
                questionsPerChapter: parseInt(questionsPerChapter),
                totalQuestions: totalQuestions,
                simpleQuestions: parseInt(simpleQuestions),
                difficultQuestions: parseInt(difficultQuestions),
                remindingQuestions: parseInt(remindingQuestions),
                understandingQuestions: parseInt(understandingQuestions),
                creativityQuestions: parseInt(creativityQuestions)
            };

            // Run genetic algorithm
            const geneticAlgorithm = new GeneticAlgorithm(allQuestions, requirements);
            const solution = geneticAlgorithm.evolve();

            // Validate solution
            const validation = geneticAlgorithm.validateSolution(solution);
            
            if (!validation.valid) {
                // Analyze available questions to provide better error messages
                const questionsByDifficulty = allQuestions.reduce((acc, q) => {
                    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
                    return acc;
                }, {});
                
                const questionsByObjective = allQuestions.reduce((acc, q) => {
                    acc[q.objective] = (acc[q.objective] || 0) + 1;
                    return acc;
                }, {});
                
                const questionsByChapter = {};
                for (const chapter of chapters) {
                    const chapterQuestions = allQuestions.filter(q => q.chapterId.toString() === chapter._id.toString());
                    questionsByChapter[chapter.chapterNumber] = {
                        total: chapterQuestions.length,
                        simple: chapterQuestions.filter(q => q.difficulty === 'simple').length,
                        difficult: chapterQuestions.filter(q => q.difficulty === 'difficult').length,
                        reminding: chapterQuestions.filter(q => q.objective === 'reminding').length,
                        understanding: chapterQuestions.filter(q => q.objective === 'understanding').length,
                        creativity: chapterQuestions.filter(q => q.objective === 'creativity').length
                    };
                }
                
                // Generate helpful suggestions
                const suggestions = [];
                
                // Check if we have enough questions of each type
                if (questionsByDifficulty.simple < requirements.simpleQuestions) {
                    suggestions.push(`Only ${questionsByDifficulty.simple} simple questions available, but you requested ${requirements.simpleQuestions}. Try requesting ${questionsByDifficulty.simple} or fewer simple questions.`);
                }
                
                if (questionsByDifficulty.difficult < requirements.difficultQuestions) {
                    suggestions.push(`Only ${questionsByDifficulty.difficult} difficult questions available, but you requested ${requirements.difficultQuestions}. Try requesting ${questionsByDifficulty.difficult} or fewer difficult questions.`);
                }
                
                if (questionsByObjective.reminding < requirements.remindingQuestions) {
                    suggestions.push(`Only ${questionsByObjective.reminding} reminding questions available, but you requested ${requirements.remindingQuestions}. Try requesting ${questionsByObjective.reminding} or fewer reminding questions.`);
                }
                
                if (questionsByObjective.understanding < requirements.understandingQuestions) {
                    suggestions.push(`Only ${questionsByObjective.understanding} understanding questions available, but you requested ${requirements.understandingQuestions}. Try requesting ${questionsByObjective.understanding} or fewer understanding questions.`);
                }
                
                if (questionsByObjective.creativity < requirements.creativityQuestions) {
                    suggestions.push(`Only ${questionsByObjective.creativity} creativity questions available, but you requested ${requirements.creativityQuestions}. Try requesting ${questionsByObjective.creativity} or fewer creativity questions.`);
                }
                
                // Check chapter constraints
                const problematicChapters = [];
                Object.entries(questionsByChapter).forEach(([chapterNum, counts]) => {
                    if (counts.total < requirements.questionsPerChapter) {
                        problematicChapters.push(`Chapter ${chapterNum} has only ${counts.total} questions but you requested ${requirements.questionsPerChapter} per chapter`);
                    }
                });
                
                if (problematicChapters.length > 0) {
                    suggestions.push(...problematicChapters);
                    suggestions.push(`Consider reducing "Questions per Chapter" to ${Math.min(...Object.values(questionsByChapter).map(c => c.total))} or fewer.`);
                }
                
                // Suggest optimal distribution
                const optimalSimple = Math.min(questionsByDifficulty.simple || 0, Math.floor(totalQuestions * 0.6));
                const optimalDifficult = Math.min(questionsByDifficulty.difficult || 0, totalQuestions - optimalSimple);
                
                suggestions.push(`Try this distribution: ${optimalSimple} simple, ${optimalDifficult} difficult questions.`);
                
                const courses = await Course.find().sort({ name: 1 });
                return res.render('exams/create', {
                    title: 'Create New Exam',
                    courses: courses,
                    selectedCourse: course,
                    errors: { 
                        algorithm: { 
                            msg: 'Could not generate optimal exam with your requirements.',
                            details: validation.errors,
                            suggestions: suggestions,
                            availableQuestions: {
                                total: allQuestions.length,
                                byDifficulty: questionsByDifficulty,
                                byObjective: questionsByObjective,
                                byChapter: questionsByChapter
                            }
                        } 
                    },
                    oldInput: req.body
                });
            }

            // Save exam
            const exam = new Exam({
                courseId: courseId,
                title: title.trim(),
                questionsPerChapter: parseInt(questionsPerChapter),
                simpleQuestions: parseInt(simpleQuestions),
                difficultQuestions: parseInt(difficultQuestions),
                remindingQuestions: parseInt(remindingQuestions),
                understandingQuestions: parseInt(understandingQuestions),
                creativityQuestions: parseInt(creativityQuestions),
                selectedQuestions: solution.questions.map((q, index) => ({
                    questionId: q._id,
                    orderIndex: index
                })),
                fitnessScore: solution.fitness
            });

            await exam.save();
            req.flash('success', `Exam generated successfully! Fitness score: ${solution.fitness.toFixed(2)}`);
            res.redirect(`/exams/${exam._id}`);

        } catch (error) {
            console.error('Error generating exam:', error);
            req.flash('error', 'Error generating exam');
            res.redirect('/exams/create');
        }
    }

    // Show single exam
    async show(req, res) {
        try {
            const exam = await Exam.findById(req.params.id)
                .populate('courseId')
                .populate('selectedQuestions.questionId');

            if (!exam) {
                req.flash('error', 'Exam not found');
                return res.redirect('/exams');
            }

            // Get questions with chapter information
            const questionsWithChapter = await Promise.all(
                exam.selectedQuestions.map(async (sq) => {
                    const question = await Question.findById(sq.questionId).populate('chapterId');
                    return {
                        ...question.toObject(),
                        orderIndex: sq.orderIndex
                    };
                })
            );

            // Sort by order index
            questionsWithChapter.sort((a, b) => a.orderIndex - b.orderIndex);

            // Calculate statistics
            const stats = this.calculateExamStats(questionsWithChapter);

            res.render('exams/show', {
                title: `Exam: ${exam.title}`,
                exam: exam,
                questions: questionsWithChapter,
                stats: stats
            });

        } catch (error) {
            console.error('Error loading exam:', error);
            req.flash('error', 'Error loading exam');
            res.redirect('/exams');
        }
    }

    // Delete exam
    async destroy(req, res) {
        try {
            const exam = await Exam.findById(req.params.id);
            if (!exam) {
                req.flash('error', 'Exam not found');
                return res.redirect('/exams');
            }

            await Exam.findByIdAndDelete(req.params.id);
            req.flash('success', 'Exam deleted successfully!');
            res.redirect('/exams');

        } catch (error) {
            console.error('Error deleting exam:', error);
            req.flash('error', 'Error deleting exam');
            res.redirect('/exams');
        }
    }

    // Export exam as printable format
    async export(req, res) {
        try {
            const exam = await Exam.findById(req.params.id)
                .populate('courseId')
                .populate('selectedQuestions.questionId');

            if (!exam) {
                req.flash('error', 'Exam not found');
                return res.redirect('/exams');
            }

            // Get questions with chapter information
            const questionsWithChapter = await Promise.all(
                exam.selectedQuestions.map(async (sq) => {
                    const question = await Question.findById(sq.questionId).populate('chapterId');
                    return {
                        ...question.toObject(),
                        orderIndex: sq.orderIndex
                    };
                })
            );

            // Sort by order index
            questionsWithChapter.sort((a, b) => a.orderIndex - b.orderIndex);

            res.render('exams/export', {
                title: `Export: ${exam.title}`,
                exam: exam,
                questions: questionsWithChapter,
                layout: false // No layout for printing
            });

        } catch (error) {
            console.error('Error exporting exam:', error);
            req.flash('error', 'Error exporting exam');
            res.redirect('/exams');
        }
    }

    // Regenerate exam with same parameters
    async regenerate(req, res) {
        try {
            const exam = await Exam.findById(req.params.id).populate('courseId');
            if (!exam) {
                req.flash('error', 'Exam not found');
                return res.redirect('/exams');
            }

            // Get all questions for the course
            const chapters = await Chapter.find({ courseId: exam.courseId });
            const allQuestions = await Question.find({ 
                chapterId: { $in: chapters.map(c => c._id) } 
            });

            // Prepare requirements
            const requirements = {
                questionsPerChapter: exam.questionsPerChapter,
                totalQuestions: exam.questionsPerChapter * exam.courseId.numberOfChapters,
                simpleQuestions: exam.simpleQuestions,
                difficultQuestions: exam.difficultQuestions,
                remindingQuestions: exam.remindingQuestions,
                understandingQuestions: exam.understandingQuestions,
                creativityQuestions: exam.creativityQuestions
            };

            // Run genetic algorithm
            const geneticAlgorithm = new GeneticAlgorithm(allQuestions, requirements);
            const solution = geneticAlgorithm.evolve();

            // Update exam with new solution
            exam.selectedQuestions = solution.questions.map((q, index) => ({
                questionId: q._id,
                orderIndex: index
            }));
            exam.fitnessScore = solution.fitness;

            await exam.save();
            req.flash('success', `Exam regenerated successfully! New fitness score: ${solution.fitness.toFixed(2)}`);
            res.redirect(`/exams/${exam._id}`);

        } catch (error) {
            console.error('Error regenerating exam:', error);
            req.flash('error', 'Error regenerating exam');
            res.redirect('/exams');
        }
    }

    // Get course info for exam creation
    async getCourseInfo(req, res) {
        try {
            const course = await Course.findById(req.params.courseId);
            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }

            const chapters = await Chapter.find({ courseId: course._id });
            const chapterStats = await Promise.all(
                chapters.map(async (chapter) => {
                    const questions = await Question.find({ chapterId: chapter._id });
                    return {
                        chapterNumber: chapter.chapterNumber,
                        questionCount: questions.length,
                        isComplete: questions.length === 12
                    };
                })
            );

            res.json({
                course: course,
                chapters: chapterStats,
                totalChapters: course.numberOfChapters
            });

        } catch (error) {
            console.error('Error getting course info:', error);
            res.status(500).json({ error: 'Error getting course information' });
        }
    }

    // Helper method to calculate exam statistics
    calculateExamStats(questions) {
        const stats = {
            total: questions.length,
            difficulty: { simple: 0, difficult: 0 },
            objective: { reminding: 0, understanding: 0, creativity: 0 },
            chapterDistribution: {}
        };

        questions.forEach(q => {
            stats.difficulty[q.difficulty]++;
            stats.objective[q.objective]++;
            
            const chapterNum = q.chapterId.chapterNumber;
            stats.chapterDistribution[chapterNum] = (stats.chapterDistribution[chapterNum] || 0) + 1;
        });

        return stats;
    }

    // API endpoint to validate exam requirements
    async validateRequirements(req, res) {
        try {
            const {
                courseId,
                questionsPerChapter,
                simpleQuestions,
                difficultQuestions,
                remindingQuestions,
                understandingQuestions,
                creativityQuestions
            } = req.body;

            const course = await Course.findById(courseId);
            if (!course) {
                return res.json({ valid: false, errors: ['Course not found'] });
            }

            const errors = [];
            const totalQuestions = parseInt(questionsPerChapter) * course.numberOfChapters;
            const totalByDifficulty = parseInt(simpleQuestions) + parseInt(difficultQuestions);
            const totalByObjective = parseInt(remindingQuestions) + parseInt(understandingQuestions) + parseInt(creativityQuestions);

            if (totalByDifficulty !== totalQuestions) {
                errors.push(`Total difficulty questions (${totalByDifficulty}) must equal total questions (${totalQuestions})`);
            }

            if (totalByObjective !== totalQuestions) {
                errors.push(`Total objective questions (${totalByObjective}) must equal total questions (${totalQuestions})`);
            }

            // Check if there are enough questions in each chapter
            const chapters = await Chapter.find({ courseId: courseId });
            for (const chapter of chapters) {
                const questionCount = await Question.countDocuments({ chapterId: chapter._id });
                if (questionCount < parseInt(questionsPerChapter)) {
                    errors.push(`Chapter ${chapter.chapterNumber} has only ${questionCount} questions, but ${questionsPerChapter} are required`);
                }
            }

            res.json({
                valid: errors.length === 0,
                errors: errors,
                totalQuestions: totalQuestions
            });

        } catch (error) {
            console.error('Error validating requirements:', error);
            res.status(500).json({ error: 'Error validating requirements' });
        }
    }
}

const examController = new ExamController();

// Bind methods to preserve context
module.exports = {
    index: examController.index.bind(examController),
    create: examController.create.bind(examController),
    generate: examController.generate.bind(examController),
    show: examController.show.bind(examController),
    destroy: examController.destroy.bind(examController),
    export: examController.export.bind(examController),
    regenerate: examController.regenerate.bind(examController),
    getCourseInfo: examController.getCourseInfo.bind(examController),
    validateRequirements: examController.validateRequirements.bind(examController)
};
