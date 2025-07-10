class GeneticAlgorithm {
    constructor(questions, requirements) {
        this.questions = questions;
        this.requirements = requirements;
        this.populationSize = 100;
        this.generations = 200;
        this.mutationRate = 0.1;
        this.crossoverRate = 0.8;
        this.eliteSize = 10;
    }

    // Initialize population with random question combinations
    initializePopulation() {
        const population = [];
        
        for (let i = 0; i < this.populationSize; i++) {
            const individual = this.createRandomIndividual();
            population.push(individual);
        }
        
        return population;
    }

    // Create a random individual (exam configuration)
    createRandomIndividual() {
        const selectedQuestions = [];
        const questionsPerChapter = this.requirements.questionsPerChapter;
        
        // Group questions by chapter
        const questionsByChapter = {};
        this.questions.forEach(q => {
            if (!questionsByChapter[q.chapterId]) {
                questionsByChapter[q.chapterId] = [];
            }
            questionsByChapter[q.chapterId].push(q);
        });

        // Select questions from each chapter
        Object.keys(questionsByChapter).forEach(chapterId => {
            const chapterQuestions = questionsByChapter[chapterId];
            const selected = this.selectRandomQuestions(chapterQuestions, questionsPerChapter);
            selectedQuestions.push(...selected);
        });

        return {
            questions: selectedQuestions,
            fitness: 0
        };
    }

    // Select random questions from a list
    selectRandomQuestions(questions, count) {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // Calculate fitness score for an individual
    calculateFitness(individual) {
        let score = 0;
        const questions = individual.questions;
        
        // Count question types
        const counts = {
            simple: 0,
            difficult: 0,
            reminding: 0,
            understanding: 0,
            creativity: 0
        };

        questions.forEach(q => {
            counts[q.difficulty]++;
            counts[q.objective]++;
        });

        // Calculate fitness based on how close we are to requirements
        const req = this.requirements;
        
        // Difficulty distribution fitness
        const difficultyFitness = 1000 - Math.abs(counts.simple - req.simpleQuestions) * 50 
                                       - Math.abs(counts.difficult - req.difficultQuestions) * 50;
        
        // Objective distribution fitness
        const objectiveFitness = 1000 - Math.abs(counts.reminding - req.remindingQuestions) * 50
                                      - Math.abs(counts.understanding - req.understandingQuestions) * 50
                                      - Math.abs(counts.creativity - req.creativityQuestions) * 50;

        // Total questions fitness
        const totalQuestionsFitness = 1000 - Math.abs(questions.length - req.totalQuestions) * 100;

        // Chapter distribution fitness
        const chapterFitness = this.calculateChapterDistributionFitness(questions);

        score = difficultyFitness + objectiveFitness + totalQuestionsFitness + chapterFitness;
        
        // Penalty for duplicate questions
        const uniqueQuestions = new Set(questions.map(q => q._id.toString()));
        if (uniqueQuestions.size !== questions.length) {
            score -= 500;
        }

        return Math.max(0, score);
    }

    // Calculate fitness for chapter distribution
    calculateChapterDistributionFitness(questions) {
        const chapterCounts = {};
        questions.forEach(q => {
            chapterCounts[q.chapterId] = (chapterCounts[q.chapterId] || 0) + 1;
        });

        const targetPerChapter = this.requirements.questionsPerChapter;
        let fitness = 0;

        Object.values(chapterCounts).forEach(count => {
            fitness += 100 - Math.abs(count - targetPerChapter) * 20;
        });

        return fitness;
    }

    // Tournament selection
    tournamentSelection(population, tournamentSize = 5) {
        const selected = [];
        
        for (let i = 0; i < this.populationSize; i++) {
            const tournament = [];
            for (let j = 0; j < tournamentSize; j++) {
                const randomIndex = Math.floor(Math.random() * population.length);
                tournament.push(population[randomIndex]);
            }
            
            tournament.sort((a, b) => b.fitness - a.fitness);
            selected.push(tournament[0]);
        }
        
        return selected;
    }

    // Crossover operation
    crossover(parent1, parent2) {
        if (Math.random() > this.crossoverRate) {
            return [parent1, parent2];
        }

        const child1Questions = [];
        const child2Questions = [];
        
        // Group questions by chapter for both parents
        const p1ByChapter = this.groupByChapter(parent1.questions);
        const p2ByChapter = this.groupByChapter(parent2.questions);
        
        // For each chapter, randomly select questions from either parent
        Object.keys(p1ByChapter).forEach(chapterId => {
            const p1Questions = p1ByChapter[chapterId] || [];
            const p2Questions = p2ByChapter[chapterId] || [];
            
            const targetCount = this.requirements.questionsPerChapter;
            const allQuestions = [...p1Questions, ...p2Questions];
            
            // Remove duplicates
            const uniqueQuestions = allQuestions.filter((q, index, self) => 
                index === self.findIndex(t => t._id.toString() === q._id.toString())
            );
            
            // Select random questions for children
            const shuffled = [...uniqueQuestions].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));
            
            child1Questions.push(...selected.slice(0, Math.ceil(selected.length / 2)));
            child2Questions.push(...selected.slice(Math.ceil(selected.length / 2)));
        });

        return [
            { questions: child1Questions, fitness: 0 },
            { questions: child2Questions, fitness: 0 }
        ];
    }

    // Group questions by chapter
    groupByChapter(questions) {
        const grouped = {};
        questions.forEach(q => {
            if (!grouped[q.chapterId]) {
                grouped[q.chapterId] = [];
            }
            grouped[q.chapterId].push(q);
        });
        return grouped;
    }

    // Mutation operation
    mutate(individual) {
        if (Math.random() > this.mutationRate) {
            return individual;
        }

        const questions = [...individual.questions];
        const chapterGroups = this.groupByChapter(questions);
        
        // Randomly select a chapter to mutate
        const chapterIds = Object.keys(chapterGroups);
        const randomChapterId = chapterIds[Math.floor(Math.random() * chapterIds.length)];
        
        // Get available questions for this chapter
        const availableQuestions = this.questions.filter(q => 
            q.chapterId.toString() === randomChapterId
        );
        
        // Replace a random question with a new one
        const chapterQuestions = chapterGroups[randomChapterId];
        if (chapterQuestions.length > 0 && availableQuestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * chapterQuestions.length);
            const newQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
            
            // Replace the question
            const questionIndex = questions.findIndex(q => 
                q._id.toString() === chapterQuestions[randomIndex]._id.toString()
            );
            if (questionIndex !== -1) {
                questions[questionIndex] = newQuestion;
            }
        }

        return {
            questions: questions,
            fitness: 0
        };
    }

    // Main genetic algorithm execution
    evolve() {
        let population = this.initializePopulation();
        let bestFitness = 0;
        let bestIndividual = null;
        let generationWithoutImprovement = 0;

        for (let generation = 0; generation < this.generations; generation++) {
            // Calculate fitness for all individuals
            population.forEach(individual => {
                individual.fitness = this.calculateFitness(individual);
            });

            // Sort population by fitness
            population.sort((a, b) => b.fitness - a.fitness);

            // Track best solution
            if (population[0].fitness > bestFitness) {
                bestFitness = population[0].fitness;
                bestIndividual = { ...population[0] };
                generationWithoutImprovement = 0;
            } else {
                generationWithoutImprovement++;
            }

            // Early termination if no improvement for too long
            if (generationWithoutImprovement > 50) {
                break;
            }

            // Create next generation
            const elite = population.slice(0, this.eliteSize);
            const selected = this.tournamentSelection(population);
            const newPopulation = [...elite];

            // Crossover and mutation
            for (let i = this.eliteSize; i < this.populationSize; i += 2) {
                const parent1 = selected[i % selected.length];
                const parent2 = selected[(i + 1) % selected.length];
                
                const [child1, child2] = this.crossover(parent1, parent2);
                
                newPopulation.push(this.mutate(child1));
                if (newPopulation.length < this.populationSize) {
                    newPopulation.push(this.mutate(child2));
                }
            }

            population = newPopulation;
        }

        return bestIndividual;
    }

    // Validate if the solution meets all requirements
    validateSolution(individual) {
        if (!individual || !individual.questions) {
            return { valid: false, errors: ['No solution found'] };
        }

        const questions = individual.questions;
        const errors = [];

        // Count question types
        const counts = {
            simple: 0,
            difficult: 0,
            reminding: 0,
            understanding: 0,
            creativity: 0
        };

        const chapterCounts = {};
        questions.forEach(q => {
            counts[q.difficulty]++;
            counts[q.objective]++;
            chapterCounts[q.chapterId] = (chapterCounts[q.chapterId] || 0) + 1;
        });

        // Check total questions (must be exact)
        if (questions.length !== this.requirements.totalQuestions) {
            errors.push(`Total questions: expected ${this.requirements.totalQuestions}, got ${questions.length}`);
        }

        // Check difficulty distribution (allow small tolerance)
        const diffTolerance = 1; // Allow 1 question difference
        if (Math.abs(counts.simple - this.requirements.simpleQuestions) > diffTolerance) {
            errors.push(`Simple questions: expected ${this.requirements.simpleQuestions}, got ${counts.simple}`);
        }
        if (Math.abs(counts.difficult - this.requirements.difficultQuestions) > diffTolerance) {
            errors.push(`Difficult questions: expected ${this.requirements.difficultQuestions}, got ${counts.difficult}`);
        }

        // Check objective distribution (allow small tolerance)
        const objTolerance = 1; // Allow 1 question difference
        if (Math.abs(counts.reminding - this.requirements.remindingQuestions) > objTolerance) {
            errors.push(`Reminding questions: expected ${this.requirements.remindingQuestions}, got ${counts.reminding}`);
        }
        if (Math.abs(counts.understanding - this.requirements.understandingQuestions) > objTolerance) {
            errors.push(`Understanding questions: expected ${this.requirements.understandingQuestions}, got ${counts.understanding}`);
        }
        if (Math.abs(counts.creativity - this.requirements.creativityQuestions) > objTolerance) {
            errors.push(`Creativity questions: expected ${this.requirements.creativityQuestions}, got ${counts.creativity}`);
        }

        // Check chapter distribution
        Object.values(chapterCounts).forEach((count, index) => {
            if (count !== this.requirements.questionsPerChapter) {
                errors.push(`Chapter ${index + 1}: expected ${this.requirements.questionsPerChapter} questions, got ${count}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors,
            fitness: individual.fitness
        };
    }
}

module.exports = GeneticAlgorithm;
