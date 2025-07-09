const { Course, Chapter, Question } = require('../models');
const { validationResult } = require('express-validator');

class CourseController {
    // Display all courses
    async index(req, res) {
        try {
            const courses = await Course.find().sort({ createdAt: -1 });
            
            // Calculate progress for each course
            const coursesWithProgress = await Promise.all(
                courses.map(async (course) => {
                    const chapters = await Chapter.find({ courseId: course._id });
                    
                    let totalQuestions = 0;
                    let completedChapters = 0;
                    
                    for (const chapter of chapters) {
                        const questions = await Question.find({ chapterId: chapter._id });
                        totalQuestions += questions.length;
                        
                        if (questions.length === 12) {
                            completedChapters++;
                        }
                    }
                    
                    const progressPercentage = course.numberOfChapters > 0 
                        ? (completedChapters / course.numberOfChapters) * 100 
                        : 0;
                    
                    return {
                        ...course.toObject(),
                        totalQuestions,
                        completedChapters,
                        progressPercentage: Math.round(progressPercentage)
                    };
                })
            );
            
            res.render('courses/index', { 
                title: 'Courses',
                courses: coursesWithProgress
            });
        } catch (error) {
            req.flash('error', 'Error loading courses');
            res.redirect('/');
        }
    }

    // Show form to create new course
    async create(req, res) {
        res.render('courses/create', { 
            title: 'Create New Course',
            errors: {}
        });
    }

    // Store new course
    async store(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.render('courses/create', {
                    title: 'Create New Course',
                    errors: errors.mapped(),
                    oldInput: req.body
                });
            }

            const { name, numberOfChapters } = req.body;
            
            // Check if course already exists
            const existingCourse = await Course.findOne({ name: name.trim() });
            if (existingCourse) {
                return res.render('courses/create', {
                    title: 'Create New Course',
                    errors: { name: { msg: 'Course with this name already exists' } },
                    oldInput: req.body
                });
            }

            const course = new Course({
                name: name.trim(),
                numberOfChapters: parseInt(numberOfChapters)
            });

            await course.save();
            req.flash('success', 'Course created successfully!');
            res.redirect('/courses');
        } catch (error) {
            console.error('Error creating course:', error);
            req.flash('error', 'Error creating course');
            res.redirect('/courses');
        }
    }

    // Show single course with chapters
    async show(req, res) {
        try {
            const course = await Course.findById(req.params.id);
            if (!course) {
                req.flash('error', 'Course not found');
                return res.redirect('/courses');
            }

            const chapters = await Chapter.find({ courseId: course._id }).sort({ chapterNumber: 1 });
            
            // Get question counts for each chapter
            const chaptersWithQuestions = await Promise.all(
                chapters.map(async (chapter) => {
                    const questions = await Question.find({ chapterId: chapter._id });
                    
                    // Count by difficulty
                    const difficultyCount = {
                        simple: questions.filter(q => q.difficulty === 'simple').length,
                        difficult: questions.filter(q => q.difficulty === 'difficult').length
                    };
                    
                    // Count by objective
                    const objectiveCount = {
                        reminding: questions.filter(q => q.objective === 'reminding').length,
                        understanding: questions.filter(q => q.objective === 'understanding').length,
                        creativity: questions.filter(q => q.objective === 'creativity').length
                    };

                    return {
                        ...chapter.toObject(),
                        questionCount: questions.length,
                        difficultyCount,
                        objectiveCount,
                        isComplete: questions.length === 12
                    };
                })
            );

            res.render('courses/show', {
                title: course.name,
                course: course,
                chapters: chaptersWithQuestions
            });
        } catch (error) {
            console.error('Error loading course:', error);
            req.flash('error', 'Error loading course');
            res.redirect('/courses');
        }
    }

    // Show edit form
    async edit(req, res) {
        try {
            const course = await Course.findById(req.params.id);
            if (!course) {
                req.flash('error', 'Course not found');
                return res.redirect('/courses');
            }

            res.render('courses/edit', {
                title: 'Edit Course',
                course: course,
                errors: {}
            });
        } catch (error) {
            req.flash('error', 'Error loading course');
            res.redirect('/courses');
        }
    }

    // Update course
    async update(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const course = await Course.findById(req.params.id);
                return res.render('courses/edit', {
                    title: 'Edit Course',
                    course: course,
                    errors: errors.mapped(),
                    oldInput: req.body
                });
            }

            const { name, numberOfChapters } = req.body;
            const course = await Course.findById(req.params.id);
            
            if (!course) {
                req.flash('error', 'Course not found');
                return res.redirect('/courses');
            }

            // Check if name already exists (excluding current course)
            const existingCourse = await Course.findOne({ 
                name: name.trim(),
                _id: { $ne: course._id }
            });
            
            if (existingCourse) {
                return res.render('courses/edit', {
                    title: 'Edit Course',
                    course: course,
                    errors: { name: { msg: 'Course with this name already exists' } },
                    oldInput: req.body
                });
            }

            const oldChapterCount = course.numberOfChapters;
            const newChapterCount = parseInt(numberOfChapters);

            course.name = name.trim();
            course.numberOfChapters = newChapterCount;
            await course.save();

            // Handle chapter count changes
            if (newChapterCount > oldChapterCount) {
                // Add new chapters
                const newChapters = [];
                for (let i = oldChapterCount + 1; i <= newChapterCount; i++) {
                    newChapters.push({
                        courseId: course._id,
                        chapterNumber: i,
                        title: `Chapter ${i}`,
                        questionCount: 0
                    });
                }
                await Chapter.insertMany(newChapters);
            } else if (newChapterCount < oldChapterCount) {
                // Remove chapters and their questions
                const chaptersToRemove = await Chapter.find({
                    courseId: course._id,
                    chapterNumber: { $gt: newChapterCount }
                });

                for (const chapter of chaptersToRemove) {
                    await Question.deleteMany({ chapterId: chapter._id });
                }
                
                await Chapter.deleteMany({
                    courseId: course._id,
                    chapterNumber: { $gt: newChapterCount }
                });
            }

            req.flash('success', 'Course updated successfully!');
            res.redirect(`/courses/${course._id}`);
        } catch (error) {
            console.error('Error updating course:', error);
            req.flash('error', 'Error updating course');
            res.redirect('/courses');
        }
    }

    // Delete course
    async destroy(req, res) {
        try {
            const course = await Course.findById(req.params.id);
            if (!course) {
                req.flash('error', 'Course not found');
                return res.redirect('/courses');
            }

            // Delete all chapters and questions
            const chapters = await Chapter.find({ courseId: course._id });
            for (const chapter of chapters) {
                await Question.deleteMany({ chapterId: chapter._id });
            }
            await Chapter.deleteMany({ courseId: course._id });

            // Delete the course
            await Course.findByIdAndDelete(req.params.id);

            req.flash('success', 'Course deleted successfully!');
            res.redirect('/courses');
        } catch (error) {
            console.error('Error deleting course:', error);
            req.flash('error', 'Error deleting course');
            res.redirect('/courses');
        }
    }

    // Get course statistics
    async getStatistics(req, res) {
        try {
            const course = await Course.findById(req.params.id);
            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }

            const chapters = await Chapter.find({ courseId: course._id });
            const statistics = {
                totalChapters: chapters.length,
                totalQuestions: 0,
                completedChapters: 0,
                difficultyDistribution: { simple: 0, difficult: 0 },
                objectiveDistribution: { reminding: 0, understanding: 0, creativity: 0 }
            };

            for (const chapter of chapters) {
                const questions = await Question.find({ chapterId: chapter._id });
                statistics.totalQuestions += questions.length;
                
                if (questions.length === 12) {
                    statistics.completedChapters++;
                }

                questions.forEach(q => {
                    statistics.difficultyDistribution[q.difficulty]++;
                    statistics.objectiveDistribution[q.objective]++;
                });
            }

            res.json(statistics);
        } catch (error) {
            console.error('Error getting statistics:', error);
            res.status(500).json({ error: 'Error getting statistics' });
        }
    }
}

module.exports = new CourseController();
