// script.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionTextElement = document.getElementById('question-text');
    const questionNumberElement = document.getElementById('question-number');
    const choicesContainer = document.getElementById('choices-container');
    const feedbackContentArea = document.getElementById('feedback-content-area');
    const btnPrevious = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnHome = document.getElementById('btnHome');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnNewExam = document.getElementById('btnNewExam');
    const scoreContainer = document.getElementById('score-container');
    const scoreValueElement = document.getElementById('score-value');
    const totalQuestionsValueElement = document.getElementById('total-questions-value');
    const chatInputElement = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btnSendChat');

    // State Variables
    let allQuestionsData = [];
    let allFeedbackData = [];
    let allFaqData = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // Stores { qId: string, selectedChoices: string[] }
    const MAX_SELECTED_CHOICES = 2;

    // --- DATA LOADING FUNCTIONS ---
    async function loadData(filePath, dataSourceSelector, itemSelector, parserFn) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
            }
            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const dataSource = doc.querySelector(dataSourceSelector);
            if (!dataSource) {
                console.error(`Data source selector "${dataSourceSelector}" not found in ${filePath}`);
                return [];
            }
            const items = dataSource.querySelectorAll(itemSelector);
            return Array.from(items).map(parserFn);
        } catch (error) {
            console.error(`Error loading data from ${filePath}:`, error);
            return []; // Return empty array on error
        }
    }

    function parseQuestionItem(item) {
        const id = item.dataset.id;
        const text = item.querySelector('.question-text')?.textContent.trim() || "Question text not found";
        const choiceElements = item.querySelectorAll('.choices .choice-option');
        const choices = [];
        const correctAnswers = [];
        choiceElements.forEach(choiceEl => {
            const choiceText = choiceEl.textContent.trim();
            choices.push(choiceText);
            if (choiceEl.dataset.correct === 'true') {
                correctAnswers.push(choiceText);
            }
        });
        return { id, text, choices, correctAnswers };
    }

    function parseFeedbackItem(item) {
        const questionId = item.dataset.questionId;
        const optionText = item.dataset.optionText;
        const title = item.querySelector('.feedback-title')?.textContent.trim();
        const text = item.querySelector('.feedback-text')?.textContent.trim() || "Feedback text not found";
        return { questionId, optionText, title, text };
    }

    function parseFaqItem(item) {
        const keywords = item.dataset.keywords?.toLowerCase().split(',').map(k => k.trim()) || [];
        const question = item.querySelector('.faq-question')?.textContent.trim(); // Optional
        const answer = item.querySelector('.faq-answer')?.textContent.trim() || "Answer not found.";
        return { keywords, question, answer };
    }

    // --- EXAM DISPLAY AND LOGIC ---
    function displayQuestion(index) {
        if (!allQuestionsData || allQuestionsData.length === 0 || index < 0 || index >= allQuestionsData.length) {
            questionTextElement.textContent = "No more questions or error in loading.";
            choicesContainer.innerHTML = '';
            btnNext.disabled = true;
            btnPrevious.disabled = true;
            console.warn("Invalid question index or no questions:", index, allQuestionsData);
            return;
        }
        const question = allQuestionsData[index];
        questionNumberElement.textContent = `Question ${index + 1} of ${allQuestionsData.length}`;
        questionTextElement.textContent = question.text;
        choicesContainer.innerHTML = '';

        const currentCorrectAnswers = [...question.correctAnswers];
        const currentIncorrectAnswers = question.choices.filter(c => !question.correctAnswers.includes(c));
        const displayChoices = [];

        // Ensure we get exactly 2 correct answers if available
        for (let i = 0; i < MAX_SELECTED_CHOICES; i++) {
            if (currentCorrectAnswers.length > 0) {
                const randIndex = Math.floor(Math.random() * currentCorrectAnswers.length);
                displayChoices.push(currentCorrectAnswers.splice(randIndex, 1)[0]);
            }
        }
        // Fill remaining spots (up to 5 total) with incorrect answers
        const neededIncorrect = 5 - displayChoices.length;
        for (let i = 0; i < neededIncorrect; i++) {
            if (currentIncorrectAnswers.length > 0) {
                const randIndex = Math.floor(Math.random() * currentIncorrectAnswers.length);
                displayChoices.push(currentIncorrectAnswers.splice(randIndex, 1)[0]);
            } else if (currentCorrectAnswers.length > 0) { // Fallback if not enough incorrect
                const randIndex = Math.floor(Math.random() * currentCorrectAnswers.length);
                displayChoices.push(currentCorrectAnswers.splice(randIndex, 1)[0]);
            }
        }
        // Shuffle the final list of 5 choices
        displayChoices.sort(() => Math.random() - 0.5);

        displayChoices.forEach((choiceText, i) => {
            const choiceId = `q${index}-choice-${i}`;
            const choiceWrapper = document.createElement('div');
            choiceWrapper.className = "flex items-center p-3 md:p-4 bg-gemini-surface-contrast rounded-lg hover:bg-slate-700/70 transition-colors duration-150 cursor-pointer";

            const checkbox = document.createElement('input');
            checkbox.id = choiceId;
            checkbox.type = 'checkbox';
            checkbox.name = `question-${index}-choice`;
            checkbox.value = choiceText;
            checkbox.className = "custom-checkbox h-5 w-5 text-indigo-500 border-gemini-border rounded focus:ring-indigo-400 focus:ring-opacity-50 shrink-0";

            const label = document.createElement('label');
            label.htmlFor = choiceId;
            label.textContent = choiceText;
            label.className = "ml-3 block text-md text-gemini-primary-text cursor-pointer";

            choiceWrapper.appendChild(checkbox);
            choiceWrapper.appendChild(label);
            choicesContainer.appendChild(choiceWrapper);

            const userAnswer = userAnswers.find(ua => ua.qId === question.id);
            if (userAnswer && userAnswer.selectedChoices.includes(choiceText)) {
                checkbox.checked = true;
                choiceWrapper.classList.add('bg-indigo-900/50', 'ring-2', 'ring-indigo-500');
            }

            checkbox.addEventListener('change', (event) => handleChoiceSelection(event, question.id));
            choiceWrapper.addEventListener('click', () => {
                if (!checkbox.disabled) checkbox.click();
            });
        });

        updateNavigationButtons();
        displayFeedbackForQuestion(question.id);
    }

    function handleChoiceSelection(event, questionId) {
        const selectedCheckbox = event.target;
        const currentQuestionCheckboxes = Array.from(choicesContainer.querySelectorAll(`input[name^="question-${currentQuestionIndex}-choice"]`));
        const selectedCheckboxes = currentQuestionCheckboxes.filter(cb => cb.checked);

        if (selectedCheckboxes.length > MAX_SELECTED_CHOICES) {
            selectedCheckbox.checked = false; // Undo the last selection
            // Provide user feedback (e.g., a temporary message or alert)
            const tempMsg = document.createElement('p');
            tempMsg.textContent = `You can only select up to ${MAX_SELECTED_CHOICES} answers.`;
            tempMsg.className = 'text-red-400 text-sm mt-2 text-center';
            choicesContainer.appendChild(tempMsg);
            setTimeout(() => tempMsg.remove(), 3000);
            return;
        }

        currentQuestionCheckboxes.forEach(cb => {
            const wrapper = cb.closest('div');
            if (cb.checked) {
                wrapper.classList.add('bg-indigo-900/50', 'ring-2', 'ring-indigo-500');
            } else {
                wrapper.classList.remove('bg-indigo-900/50', 'ring-2', 'ring-indigo-500');
            }
        });

        let userAnswer = userAnswers.find(ua => ua.qId === questionId);
        if (!userAnswer) {
            userAnswer = { qId: questionId, selectedChoices: [] };
            userAnswers.push(userAnswer);
        }
        userAnswer.selectedChoices = selectedCheckboxes.map(cb => cb.value);
    }

    function displayFeedbackForQuestion(questionId, optionText = null) {
        feedbackContentArea.innerHTML = '';
        let feedbackToShow = [];

        if (optionText) { // If specific option feedback is requested
            feedbackToShow = allFeedbackData.filter(fb => fb.questionId === questionId && fb.optionText === optionText);
        }
        // If no option-specific feedback, or none requested, show general question feedback
        if (feedbackToShow.length === 0) {
            feedbackToShow = allFeedbackData.filter(fb => fb.questionId === questionId && !fb.optionText);
        }

        if (feedbackToShow.length === 0) {
            feedbackContentArea.innerHTML = '<p class="italic text-sm">No specific feedback available for this item yet. Try the chat for general questions.</p>';
            return;
        }

        feedbackToShow.forEach(fb => {
            const fbDiv = document.createElement('div');
            fbDiv.className = 'p-3 bg-gemini-surface rounded-md mb-3';
            if (fb.title) {
                const titleEl = document.createElement('h4');
                titleEl.className = 'font-semibold text-gemini-accent mb-1';
                titleEl.textContent = fb.title;
                fbDiv.appendChild(titleEl);
            }
            const textEl = document.createElement('p');
            textEl.className = 'text-sm';
            textEl.textContent = fb.text;
            fbDiv.appendChild(textEl);
            feedbackContentArea.appendChild(fbDiv);
        });
    }

    function handleChatInput() {
        const userInput = chatInputElement.value.toLowerCase().trim();
        if (!userInput) return;

        const inputKeywords = userInput.split(/\s+/).filter(word => word.length > 2); // Simple tokenizer
        let bestMatch = null;
        let maxMatchCount = 0;

        allFaqData.forEach(faq => {
            let currentMatchCount = 0;
            inputKeywords.forEach(keyword => {
                if (faq.keywords.includes(keyword)) {
                    currentMatchCount++;
                }
            });
            if (currentMatchCount > maxMatchCount) {
                maxMatchCount = currentMatchCount;
                bestMatch = faq;
            }
        });

        feedbackContentArea.innerHTML = ''; // Clear previous content
        const responseDiv = document.createElement('div');
        responseDiv.className = 'p-3 bg-gemini-surface rounded-md mb-3';
        const queryP = document.createElement('p');
        queryP.className = 'text-sm text-gemini-secondary-text mb-1';
        queryP.textContent = `You asked: "${chatInputElement.value}"`;
        responseDiv.appendChild(queryP);


        if (bestMatch && maxMatchCount > 0) {
            if (bestMatch.question) {
                const titleEl = document.createElement('h4');
                titleEl.className = 'font-semibold text-gemini-accent mb-1';
                titleEl.textContent = bestMatch.question;
                responseDiv.appendChild(titleEl);
            }
            const textEl = document.createElement('p');
            textEl.className = 'text-sm';
            textEl.textContent = bestMatch.answer;
            responseDiv.appendChild(textEl);
        } else {
            const textEl = document.createElement('p');
            textEl.className = 'text-sm';
            textEl.textContent = "I'm sorry, I couldn't find a specific answer for that. Please try rephrasing your question or check our general feedback for the current exam question.";
            responseDiv.appendChild(textEl);
        }
        feedbackContentArea.appendChild(responseDiv);
        chatInputElement.value = ''; // Clear input field
    }


    function updateNavigationButtons() {
        btnPrevious.disabled = currentQuestionIndex === 0;
        btnNext.disabled = false; // Re-enable next button by default

        if (currentQuestionIndex === allQuestionsData.length - 1) {
            btnNext.textContent = 'Finish Exam';
        } else if (allQuestionsData.length === 0) {
             btnNext.textContent = 'Next';
             btnNext.disabled = true; // Disable if no questions
        }
        else {
            btnNext.textContent = 'Next';
        }
    }

    function calculateScore() {
        let totalScore = 0;
        allQuestionsData.forEach(question => {
            const userAnswer = userAnswers.find(ua => ua.qId === question.id);
            let questionScore = 0;
            if (userAnswer && userAnswer.selectedChoices.length > 0) {
                userAnswer.selectedChoices.forEach(selectedChoice => {
                    if (question.correctAnswers.includes(selectedChoice)) {
                        questionScore += 1; // +1 for each correct choice
                    } else {
                        questionScore -= 0.5; // -0.5 for each incorrect choice
                    }
                });
                // Ensure score for a question is not negative and not more than the number of actual correct answers for that question
                questionScore = Math.max(0, questionScore);
                questionScore = Math.min(question.correctAnswers.length, questionScore);
            }
            totalScore += questionScore;
        });
        return totalScore;
    }

    function submitExam() {
        const finalScore = calculateScore();
        const totalPossibleScore = allQuestionsData.reduce((sum, q) => sum + q.correctAnswers.length, 0);

        // Hide exam elements
        questionTextElement.parentElement.style.display = 'none';
        choicesContainer.style.display = 'none';
        document.getElementById('navigation-buttons').style.display = 'none';

        // Display score
        scoreValueElement.textContent = finalScore.toFixed(1);
        totalQuestionsValueElement.textContent = totalPossibleScore;
        scoreContainer.classList.remove('hidden');

        // Disable interaction buttons
        btnSubmit.disabled = true;
        btnNewExam.disabled = false; // Allow starting a new exam

        feedbackContentArea.innerHTML = `<h3 class="text-lg font-semibold text-gemini-accent mb-2">Exam Review:</h3>`;
        allQuestionsData.forEach((q, idx) => {
            const userAnswerObj = userAnswers.find(ua => ua.qId === q.id);
            const userAnswerText = userAnswerObj && userAnswerObj.selectedChoices.length > 0 ? userAnswerObj.selectedChoices.join('; ') : 'No answer selected';

            const reviewDiv = document.createElement('div');
            reviewDiv.className = 'p-3 bg-gemini-surface rounded-md mb-2 text-sm';

            let resultHtml = `<p class="font-semibold">Q${idx+1}: ${q.text}</p>
                              <p>Your Answer(s): <span class="text-gemini-accent">${userAnswerText}</span></p>
                              <p>Correct Answer(s): <span class="text-green-400">${q.correctAnswers.join('; ')}</span></p>`;

            // Check if user's answer was fully correct, partially, or incorrect for this question
            let questionFeedback = "";
            if (userAnswerObj) {
                const correctSelected = userAnswerObj.selectedChoices.filter(c => q.correctAnswers.includes(c));
                const incorrectSelected = userAnswerObj.selectedChoices.filter(c => !q.correctAnswers.includes(c));
                if (correctSelected.length === q.correctAnswers.length && incorrectSelected.length === 0 && correctSelected.length === MAX_SELECTED_CHOICES) {
                    questionFeedback = `<p class="text-green-400">Result: Correct!</p>`;
                } else if (correctSelected.length > 0) {
                    questionFeedback = `<p class="text-yellow-400">Result: Partially Correct.</p>`;
                } else {
                     questionFeedback = `<p class="text-red-400">Result: Incorrect.</p>`;
                }
            } else {
                 questionFeedback = `<p class="text-red-400">Result: Not Answered.</p>`;
            }
            resultHtml += questionFeedback;
            reviewDiv.innerHTML = resultHtml;
            feedbackContentArea.appendChild(reviewDiv);
        });
    }

    async function initializeExam() {
        console.log("Initializing exam...");
        currentQuestionIndex = 0;
        userAnswers = [];

        // Reset UI states
        scoreContainer.classList.add('hidden');
        questionTextElement.parentElement.style.display = 'block';
        choicesContainer.style.display = 'block';
        document.getElementById('navigation-buttons').style.display = 'flex';
        btnSubmit.disabled = false;
        btnNext.disabled = false;
        btnPrevious.disabled = true;


        // Load all data
        allQuestionsData = await loadData('questions-and-answers.html', '#exam-data-source', '.question-item', parseQuestionItem);
        allFeedbackData = await loadData('feedback.html', '#feedback-data-source', '.feedback-item', parseFeedbackItem);
        allFaqData = await loadData('faq-chat-responses.html', '#faq-data-source', '.faq-item', parseFaqItem);

        if (allQuestionsData.length > 0) {
            displayQuestion(currentQuestionIndex);
        } else {
            questionTextElement.textContent = "No questions available or failed to load. Please check console.";
            choicesContainer.innerHTML = '';
            updateNavigationButtons(); // This will disable next if no questions
        }
    }

    // --- EVENT LISTENERS ---
    btnNext.addEventListener('click', () => {
        if (currentQuestionIndex < allQuestionsData.length - 1) {
            currentQuestionIndex++;
            displayQuestion(currentQuestionIndex);
        } else if (currentQuestionIndex === allQuestionsData.length - 1) {
            // "Finish Exam" was clicked
            submitExam();
        }
    });

    btnPrevious.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion(currentQuestionIndex);
        }
    });

    btnSubmit.addEventListener('click', () => {
        const confirmSubmit = confirm("Are you sure you want to submit your exam?");
        if (confirmSubmit) {
            submitExam();
        }
    });

    btnNewExam.addEventListener('click', () => {
        const confirmNew = confirm("Are you sure you want to start a new exam? Your current progress will be lost.");
        if (confirmNew) {
            initializeExam();
        }
    });

    btnHome.addEventListener('click', () => {
        const confirmHome = confirm("Return to the start? Your current progress will be lost if you haven't submitted.");
        if (confirmHome) {
             initializeExam();
        }
    });

    btnSendChat.addEventListener('click', handleChatInput);
    chatInputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if it were in a form
            handleChatInput();
        }
    });

    // Initial load
    initializeExam();
});
