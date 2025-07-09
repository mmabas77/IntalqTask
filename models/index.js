const mongoose = require('mongoose');

// Course Schema
const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 200
    },
    numberOfChapters: {
        type: Number,
        required: true,
        min: 1,
        max: 50
    }
}, {
    timestamps: true
});

// Chapter Schema
const chapterSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    chapterNumber: {
        type: Number,
        required: true,
        min: 1
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    questionCount: {
        type: Number,
        default: 0,
        max: 12
    }
}, {
    timestamps: true
});

// Question Schema
const questionSchema = new mongoose.Schema({
    chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        required: true
    },
    questionText: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 1000
    },
    choices: [{
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 200
    }],
    correctAnswer: {
        type: Number,
        required: true,
        min: 0,
        max: 2
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['simple', 'difficult']
    },
    objective: {
        type: String,
        required: true,
        enum: ['reminding', 'understanding', 'creativity']
    }
}, {
    timestamps: true
});

// Exam Schema
const examSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    questionsPerChapter: {
        type: Number,
        required: true,
        min: 1
    },
    simpleQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    difficultQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    remindingQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    understandingQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    creativityQuestions: {
        type: Number,
        required: true,
        min: 0
    },
    selectedQuestions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        },
        orderIndex: Number
    }],
    fitnessScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Exam Question Schema (for many-to-many relationship)
const examQuestionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    orderIndex: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Validation middleware
questionSchema.pre('save', function(next) {
    if (this.choices.length !== 3) {
        return next(new Error('Each question must have exactly 3 choices'));
    }
    if (this.correctAnswer < 0 || this.correctAnswer > 2) {
        return next(new Error('Correct answer must be between 0 and 2'));
    }
    next();
});

// Course middleware to create chapters
courseSchema.post('save', async function(course) {
    const Chapter = mongoose.model('Chapter');
    
    // Create chapters for the course
    const chapters = [];
    for (let i = 1; i <= course.numberOfChapters; i++) {
        chapters.push({
            courseId: course._id,
            chapterNumber: i,
            title: `Chapter ${i}`,
            questionCount: 0
        });
    }
    
    await Chapter.insertMany(chapters);
});

// Update question count when question is added/removed
questionSchema.post('save', async function(question) {
    try {
        const Chapter = mongoose.model('Chapter');
        const count = await mongoose.model('Question').countDocuments({ chapterId: question.chapterId });
        await Chapter.findByIdAndUpdate(question.chapterId, { questionCount: count });
        console.log(`Updated chapter ${question.chapterId} question count to ${count}`);
    } catch (error) {
        console.error('Error updating question count on save:', error);
    }
});

questionSchema.post('remove', async function(question) {
    try {
        const Chapter = mongoose.model('Chapter');
        const count = await mongoose.model('Question').countDocuments({ chapterId: question.chapterId });
        await Chapter.findByIdAndUpdate(question.chapterId, { questionCount: count });
        console.log(`Updated chapter ${question.chapterId} question count to ${count}`);
    } catch (error) {
        console.error('Error updating question count on remove:', error);
    }
});

// Also handle deleteOne and findOneAndDelete
questionSchema.post('deleteOne', async function() {
    try {
        const question = this.getQuery();
        if (question.chapterId) {
            const Chapter = mongoose.model('Chapter');
            const count = await mongoose.model('Question').countDocuments({ chapterId: question.chapterId });
            await Chapter.findByIdAndUpdate(question.chapterId, { questionCount: count });
            console.log(`Updated chapter ${question.chapterId} question count to ${count}`);
        }
    } catch (error) {
        console.error('Error updating question count on deleteOne:', error);
    }
});

questionSchema.post('findOneAndDelete', async function(question) {
    try {
        if (question && question.chapterId) {
            const Chapter = mongoose.model('Chapter');
            const count = await mongoose.model('Question').countDocuments({ chapterId: question.chapterId });
            await Chapter.findByIdAndUpdate(question.chapterId, { questionCount: count });
            console.log(`Updated chapter ${question.chapterId} question count to ${count}`);
        }
    } catch (error) {
        console.error('Error updating question count on findOneAndDelete:', error);
    }
});

// Create models
const Course = mongoose.model('Course', courseSchema);
const Chapter = mongoose.model('Chapter', chapterSchema);
const Question = mongoose.model('Question', questionSchema);
const Exam = mongoose.model('Exam', examSchema);
const ExamQuestion = mongoose.model('ExamQuestion', examQuestionSchema);

module.exports = {
    Course,
    Chapter,
    Question,
    Exam,
    ExamQuestion
};
