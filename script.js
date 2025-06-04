// script.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Add console logs here to verify they are all found
    const questionTextElement = document.getElementById('question-text');
    // console.log("Debug DOM - questionTextElement:", questionTextElement);
    const questionNumberElement = document.getElementById('question-number');
    // console.log("Debug DOM - questionNumberElement:", questionNumberElement);
    const choicesContainer = document.getElementById('choices-container');
    // console.log("Debug DOM - choicesContainer:", choicesContainer);
    const feedbackContentArea = document.getElementById('feedback-content-area');
    // console.log("Debug DOM - feedbackContentArea:", feedbackContentArea);
    const btnPrevious = document.getElementById('btnPrevious');
    // console.log("Debug DOM - btnPrevious:", btnPrevious);
    const btnNext = document.getElementById('btnNext');
    // console.log("Debug DOM - btnNext:", btnNext);
    const btnHome = document.getElementById('btnHome');
    // console.log("Debug DOM - btnHome:", btnHome);
    const btnSubmit = document.getElementById('btnSubmit');
    // console.log("Debug DOM - btnSubmit:", btnSubmit);
    const btnNewExam = document.getElementById('btnNewExam');
    // console.log("Debug DOM - btnNewExam:", btnNewExam);
    const scoreContainer = document.getElementById('score-container');
    // console.log("Debug DOM - scoreContainer:", scoreContainer);
    const scoreValueElement = document.getElementById('score-value');
    // console.log("Debug DOM - scoreValueElement:", scoreValueElement);
    const totalQuestionsValueElement = document.getElementById('total-questions-value');
    // console.log("Debug DOM - totalQuestionsValueElement:", totalQuestionsValueElement);
    const chatInputElement = document.getElementById('chat-input');
    // console.log("Debug DOM - chatInputElement:", chatInputElement);
    const btnSendChat = document.getElementById('btnSendChat');
    // console.log("Debug DOM - btnSendChat:", btnSendChat);
    const currentExamSectionTitleElement = document.getElementById('current-exam-section-title');
    // console.log("Debug DOM - currentExamSectionTitleElement:", currentExamSectionTitleElement);


    // Navigation Elements for Topic Selection
    const topicButtons = document.querySelectorAll('.topic-button');
    // console.log("Debug DOM - Topic buttons found in DOM:", topicButtons.length);

    // Modal Elements
    const confirmationModal = document.getElementById('confirmationModal');
    // console.log("Debug DOM - confirmationModal:", confirmationModal);
    const modalTitleElement = document.getElementById('modalTitle');
    // console.log("Debug DOM - modalTitleElement:", modalTitleElement);
    const modalMessageElement = document.getElementById('modalMessage');
    // console.log("Debug DOM - modalMessageElement:", modalMessageElement);
    const modalBtnYes = document.getElementById('modalBtnYes');
    // console.log("Debug DOM - modalBtnYes:", modalBtnYes);
    const modalBtnNo = document.getElementById('modalBtnNo');
    // console.log("Debug DOM - modalBtnNo:", modalBtnNo);

    // State Variables
    let allQuestionsData = [];
    let allFeedbackData = [];
    let allFaqData = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    const MAX_SELECTED_CHOICES = 2;
    let currentExamSection = null;
    let currentExamTitle = "All Sections";

    // --- DATA LOADING FUNCTIONS ---
    async function loadData(filePath, dataSourceSelector, itemSelector, parserFn) {
        console.log(`Debug loadData - Attempting to load: ${filePath} with selector: ${dataSourceSelector}`);
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                console.error(`Debug loadData - Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
            }
            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const dataSource = doc.querySelector(dataSourceSelector);
            if (!dataSource) {
                console.error(`Debug loadData - Data source selector "${dataSourceSelector}" NOT FOUND in ${filePath}`);
                return [];
            }
            const items = dataSource.querySelectorAll(itemSelector);
            console.log(`Debug loadData - Found ${items.length} items in ${filePath} using item selector "${itemSelector}"`);
            return Array.from(items).map(parserFn);
        } catch (error) {
            console.error(`Debug loadData - Error during loading/parsing from ${filePath}:`, error);
            return [];
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
        const question = item.querySelector('.faq-question')?.textContent.trim();
        const answer = item.querySelector('.faq-answer')?.textContent.trim() || "Answer not found.";
        return { keywords, question, answer };
    }

    // --- MODAL FUNCTIONS ---
    let onModalConfirm = null;

    function openModal(title, message, onConfirmCallback) {
        // console.log("Debug Modal - Opening modal with title:", title); // Keep this if modal is an issue
        if (modalTitleElement) modalTitleElement.textContent = title;
        if (modalMessageElement) modalMessageElement.textContent = message;
        onModalConfirm = onConfirmCallback;
        if (confirmationModal) {
            confirmationModal.classList.remove('hidden');
            confirmationModal.classList.add('flex');
        } else {
            console.error("Debug Modal - Confirmation Modal element not found in DOM");
        }
    }

    function closeModal() {
        if (confirmationModal) {
            confirmationModal.classList.add('hidden');
            confirmationModal.classList.remove('flex');
        }
        onModalConfirm = null;
    }

    if (modalBtnYes) {
        modalBtnYes.addEventListener('click', () => {
            // console.log("Debug Modal - 'Yes' button clicked.");
            if (typeof onModalConfirm === 'function') {
                // console.log("Debug Modal - Executing modal confirm callback.");
                onModalConfirm();
            }
            closeModal();
        });
    }

    if (modalBtnNo) {
        modalBtnNo.addEventListener('click', closeModal);
    }

    // --- UI UPDATE FUNCTIONS ---
    function updateActiveNavButton(selectedSectionCode = null) {
        // console.log("Debug UI Update - Updating active nav button for section:", selectedSectionCode);
        if (btnHome) btnHome.classList.remove('nav-button-active');
        if (btnNewExam) btnNewExam.classList.remove('nav-button-active');

        topicButtons.forEach(button => {
            button.classList.remove('topic-button-active');
            if (button.dataset.section === selectedSectionCode) {
                button.classList.add('topic-button-active');
            }
        });

        if (selectedSectionCode === null && btnHome) {
            btnHome.classList.add('nav-button-active');
        }
    }

    // --- EXAM DISPLAY AND LOGIC ---
    function displayQuestion(index) {
        // ... (rest of displayQuestion function remains the same)
        if (!allQuestionsData || allQuestionsData.length === 0 || index < 0 || index >= allQuestionsData.length) {
            if(questionTextElement) questionTextElement.textContent = "No more questions or error in loading data. Please try starting a new exam.";
            if(choicesContainer) choicesContainer.innerHTML = '';
            if(btnNext) btnNext.disabled = true;
            if(btnPrevious) btnPrevious.disabled = true;
            // console.warn("Invalid question index or no questions:", index, allQuestionsData.length);
            return;
        }
        const question = allQuestionsData[index];
        if(questionNumberElement) questionNumberElement.textContent = `Question ${index + 1} of ${allQuestionsData.length}`;
        if(questionTextElement) questionTextElement.textContent = question.text;
        if(choicesContainer) choicesContainer.innerHTML = '';

        const currentCorrectAnswers = [...question.correctAnswers];
        const currentIncorrectAnswers = question.choices.filter(c => !question.correctAnswers.includes(c));
        const displayChoices = [];

        for (let i = 0; i < MAX_SELECTED_CHOICES; i++) {
            if (currentCorrectAnswers.length > 0) {
                const randIndex = Math.floor(Math.random() * currentCorrectAnswers.length);
                displayChoices.push(currentCorrectAnswers.splice(randIndex, 1)[0]);
            }
        }
        const neededIncorrect = 5 - displayChoices.length;
        for (let i = 0; i < neededIncorrect; i++) {
            if (currentIncorrectAnswers.length > 0) {
                const randIndex = Math.floor(Math.random() * currentIncorrectAnswers.length);
                displayChoices.push(currentIncorrectAnswers.splice(randIndex, 1)[0]);
            } else if (currentCorrectAnswers.length > 0) {
                const randIndex = Math.floor(Math.random() * currentCorrectAnswers.length);
                displayChoices.push(currentCorrectAnswers.splice(randIndex, 1)[0]);
            }
        }
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
            if(choicesContainer) choicesContainer.appendChild(choiceWrapper);

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
        // ... (rest of handleChoiceSelection function remains the same)
        const selectedCheckbox = event.target;
        const currentQuestionCheckboxes = Array.from(choicesContainer.querySelectorAll(`input[name^="question-${currentQuestionIndex}-choice"]`));
        const selectedCheckboxes = currentQuestionCheckboxes.filter(cb => cb.checked);

        if (selectedCheckboxes.length > MAX_SELECTED_CHOICES) {
            selectedCheckbox.checked = false;
            const tempMsg = document.createElement('p');
            tempMsg.textContent = `You can only select up to ${MAX_SELECTED_CHOICES} answers.`;
            tempMsg.className = 'text-red-400 text-sm mt-2 text-center';
            if (choicesContainer && choicesContainer.parentNode) {
                if (choicesContainer.nextSibling) {
                    choicesContainer.parentNode.insertBefore(tempMsg, choicesContainer.nextSibling);
                } else {
                    choicesContainer.parentNode.appendChild(tempMsg);
                }
                setTimeout(() => tempMsg.remove(), 3000);
            }
            return;
        }

        currentQuestionCheckboxes.forEach(cb => {
            const wrapper = cb.closest('div');
            if (wrapper) {
                if (cb.checked) {
                    wrapper.classList.add('bg-indigo-900/50', 'ring-2', 'ring-indigo-500');
                } else {
                    wrapper.classList.remove('bg-indigo-900/50', 'ring-2', 'ring-indigo-500');
                }
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
        // ... (rest of displayFeedbackForQuestion function remains the same)
        if (!feedbackContentArea) return;
        feedbackContentArea.innerHTML = '';
        let feedbackToShow = [];

        if (optionText) {
            feedbackToShow = allFeedbackData.filter(fb => fb.questionId === questionId && fb.optionText === optionText);
        }
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
        // ... (rest of handleChatInput function remains the same)
        if (!chatInputElement || !feedbackContentArea) return;
        const userInput = chatInputElement.value.toLowerCase().trim();
        if (!userInput) return;

        const inputKeywords = userInput.split(/\s+/).filter(word => word.length > 2);
        let bestMatch = null;
        let maxMatchCount = 0;

        allFaqData.forEach(faq => {
            let currentMatchCount = 0;
            inputKeywords.forEach(keyword => {
                if (faq.keywords.includes(keyword)) {
                    currentMatchCount++;
                }
            });
            const questionMatchBonus = faq.question && userInput.includes(faq.question.toLowerCase().substring(0, Math.min(10, faq.question.length))) ? 2 : 0;
            currentMatchCount += questionMatchBonus;

            if (currentMatchCount > maxMatchCount) {
                maxMatchCount = currentMatchCount;
                bestMatch = faq;
            }
        });

        feedbackContentArea.innerHTML = '';
        const responseContainer = document.createElement('div');
        responseContainer.className = 'p-3 bg-gemini-surface rounded-md';

        const queryP = document.createElement('p');
        queryP.className = 'text-sm text-gemini-secondary-text mb-2 italic';
        queryP.textContent = `You asked: "${chatInputElement.value}"`;
        responseContainer.appendChild(queryP);

        if (bestMatch && maxMatchCount > 0) {
            if (bestMatch.question) {
                const titleEl = document.createElement('h4');
                titleEl.className = 'font-semibold text-gemini-accent mb-1';
                titleEl.textContent = bestMatch.question;
                responseContainer.appendChild(titleEl);
            }
            const textEl = document.createElement('p');
            textEl.className = 'text-sm';
            textEl.textContent = bestMatch.answer;
            responseContainer.appendChild(textEl);
        } else {
            const textEl = document.createElement('p');
            textEl.className = 'text-sm';
            textEl.textContent = "I'm sorry, I couldn't find a specific answer for that. Please try rephrasing your question, or check our general feedback for the current exam question if applicable.";
            responseContainer.appendChild(textEl);
        }
        feedbackContentArea.appendChild(responseContainer);
        chatInputElement.value = '';
    }

    function updateNavigationButtons() {
        // ... (rest of updateNavigationButtons function remains the same)
        if (btnPrevious) btnPrevious.disabled = currentQuestionIndex === 0;
        if (btnNext) btnNext.disabled = false;

        if (allQuestionsData.length === 0) {
            if (btnNext) {
                btnNext.textContent = 'Next';
                btnNext.disabled = true;
            }
            if (btnPrevious) btnPrevious.disabled = true;
            if (btnSubmit) btnSubmit.disabled = true;
        } else if (currentQuestionIndex === allQuestionsData.length - 1) {
            if (btnNext) btnNext.textContent = 'Finish Exam';
        } else {
            if (btnNext) btnNext.textContent = 'Next';
        }
    }

    function calculateScore() {
        // ... (rest of calculateScore function remains the same)
        let totalScore = 0;
        allQuestionsData.forEach(question => {
            const userAnswer = userAnswers.find(ua => ua.qId === question.id);
            let questionScore = 0;
            if (userAnswer && userAnswer.selectedChoices.length > 0) {
                userAnswer.selectedChoices.forEach(selectedChoice => {
                    if (question.correctAnswers.includes(selectedChoice)) {
                        questionScore += 1;
                    } else {
                        questionScore -= 0.5;
                    }
                });
                questionScore = Math.max(0, questionScore);
                questionScore = Math.min(question.correctAnswers.length, questionScore);
            }
            totalScore += questionScore;
        });
        return totalScore;
    }

    function submitExam() {
        // ... (rest of submitExam function remains the same)
        const finalScore = calculateScore();
        const totalPossibleScore = allQuestionsData.reduce((sum, q) => sum + q.correctAnswers.length, 0);

        const qContainerParent = questionTextElement?.parentElement;
        if (qContainerParent) qContainerParent.style.display = 'none';
        if (choicesContainer) choicesContainer.style.display = 'none';
        const navButtons = document.getElementById('navigation-buttons');
        if (navButtons) navButtons.style.display = 'none';
        const examInstructions = document.getElementById('exam-instructions');
        if (examInstructions) examInstructions.style.display = 'none';

        if (scoreValueElement) scoreValueElement.textContent = finalScore.toFixed(1);
        if (totalQuestionsValueElement) totalQuestionsValueElement.textContent = totalPossibleScore;
        if (scoreContainer) scoreContainer.classList.remove('hidden');

        if (btnSubmit) btnSubmit.disabled = true;
        if (btnNewExam) btnNewExam.disabled = false;

        if (feedbackContentArea) feedbackContentArea.innerHTML = `<h3 class="text-lg font-semibold text-gemini-accent mb-3">Exam Review:</h3>`;
        allQuestionsData.forEach((q, idx) => {
            const userAnswerObj = userAnswers.find(ua => ua.qId === q.id);
            const userAnswerText = userAnswerObj && userAnswerObj.selectedChoices.length > 0 ? userAnswerObj.selectedChoices.join('; ') : 'No answer selected';

            const reviewDiv = document.createElement('div');
            reviewDiv.className = 'p-3 bg-gemini-surface rounded-md mb-2 text-sm';

            let resultHtml = `<p class="font-semibold">Q${idx+1}: ${q.text}</p>
                              <p>Your Answer(s): <span class="text-gemini-accent">${userAnswerText}</span></p>
                              <p>Correct Answer(s): <span class="text-green-400">${q.correctAnswers.join('; ')}</span></p>`;

            let questionFeedbackText = ""; // Renamed to avoid conflict
            if (userAnswerObj) {
                const correctSelected = userAnswerObj.selectedChoices.filter(c => q.correctAnswers.includes(c));
                const incorrectSelected = userAnswerObj.selectedChoices.filter(c => !q.correctAnswers.includes(c));
                if (correctSelected.length === MAX_SELECTED_CHOICES && incorrectSelected.length === 0 && q.correctAnswers.length >= MAX_SELECTED_CHOICES) {
                    questionFeedbackText = `<p class="text-green-400 font-medium">Result: Correct!</p>`;
                } else if (correctSelected.length > 0) {
                    questionFeedbackText = `<p class="text-yellow-400 font-medium">Result: Partially Correct.</p>`;
                } else {
                     questionFeedbackText = `<p class="text-red-400 font-medium">Result: Incorrect.</p>`;
                }
            } else {
                 questionFeedbackText = `<p class="text-red-400 font-medium">Result: Not Answered.</p>`;
            }
            resultHtml += questionFeedbackText;
            reviewDiv.innerHTML = resultHtml;
            if (feedbackContentArea) feedbackContentArea.appendChild(reviewDiv);
        });
    }

    function updateCurrentExamTitle(sectionCode) {
        // ... (rest of updateCurrentExamTitle function remains the same)
        let title = "All Sections";
        if (sectionCode === 'a') {
            title = "Section A - Conditions For Sale";
        } else if (sectionCode === 'b') {
            title = "Section B - Narcotics / Controlled Drugs";
        } else if (sectionCode === 'c') {
            title = "Section C - Filling and Labelling";
        }
        currentExamTitle = title;
        if (currentExamSectionTitleElement) {
            currentExamSectionTitleElement.textContent = currentExamTitle;
        }
    }

    async function initializeExam(section = null) {
        console.log(`Debug initializeExam - STEP 0: START. Section: ${section || 'All'}`);
        currentQuestionIndex = 0; console.log("Debug initializeExam - STEP 1: currentQuestionIndex reset.");
        userAnswers = []; console.log("Debug initializeExam - STEP 2: userAnswers reset.");
        currentExamSection = section; console.log("Debug initializeExam - STEP 3: currentExamSection set.");

        console.log("Debug initializeExam - STEP 4: Calling updateCurrentExamTitle...");
        updateCurrentExamTitle(section);
        console.log("Debug initializeExam - STEP 5: Calling updateActiveNavButton...");
        updateActiveNavButton(section);

        console.log("Debug initializeExam - STEP 6: Resetting UI elements...");
        if(scoreContainer) { scoreContainer.classList.add('hidden'); console.log("Debug initializeExam - Score container hidden."); }
        const qContainerParent = questionTextElement?.parentElement;
        if (qContainerParent) {
            qContainerParent.style.display = 'block';
            console.log("Debug initializeExam - Question container parent display set to block.");
        } else {
            console.warn("Debug initializeExam - Question container parent not found.");
        }
        if(choicesContainer) {
            choicesContainer.style.display = 'block';
            choicesContainer.innerHTML = '';
            console.log("Debug initializeExam - Choices container display set to block and cleared.");
        } else {
            console.warn("Debug initializeExam - Choices container not found.");
        }

        const navButtonsContainer = document.getElementById('navigation-buttons');
        if (navButtonsContainer) {
            navButtonsContainer.style.display = 'flex';
            console.log("Debug initializeExam - Navigation buttons container display set to flex.");
        } else {
            console.warn("Debug initializeExam - Navigation buttons container not found.");
        }

        const examInstructionsElement = document.getElementById('exam-instructions');
        if (examInstructionsElement) {
            examInstructionsElement.style.display = 'block';
            console.log("Debug initializeExam - Exam instructions display set to block.");
        } else {
            console.warn("Debug initializeExam - Exam instructions element not found.");
        }

        if(btnSubmit) btnSubmit.disabled = false;
        if(btnNext) btnNext.disabled = false;
        if(btnPrevious) btnPrevious.disabled = true;
        console.log("Debug initializeExam - STEP 7: Button states reset.");

        if(questionTextElement) questionTextElement.textContent = "Loading exam data...";
        if(feedbackContentArea) feedbackContentArea.innerHTML = '<p class="italic text-sm">Loading resources...</p>';
        console.log("Debug initializeExam - STEP 8: UI reset complete. Starting data load.");

        try {
            let questionsToLoad = [];
            let feedbackToLoad = [];

            if (section === 'a') {
                console.log("Debug initializeExam - STEP 9a: Preparing to load Section A data.");
                questionsToLoad.push(loadData('questions-and-answers-section-a.html', '#exam-data-source-section-a', '.question-item', parseQuestionItem));
                feedbackToLoad.push(loadData('feedback-section-a.html', '#feedback-data-source-section-a', '.feedback-item', parseFeedbackItem));
            } else if (section === 'b') {
                console.log("Debug initializeExam - STEP 9b: Preparing to load Section B data.");
                questionsToLoad.push(loadData('questions-and-answers-section-b.html', '#exam-data-source-section-b', '.question-item', parseQuestionItem));
                feedbackToLoad.push(loadData('feedback-section-b.html', '#feedback-data-source-section-b', '.feedback-item', parseFeedbackItem));
            } else if (section === 'c') {
                console.log("Debug initializeExam - STEP 9c: Preparing to load Section C data.");
                questionsToLoad.push(loadData('questions-and-answers-section-c.html', '#exam-data-source-section-c', '.question-item', parseQuestionItem));
                feedbackToLoad.push(loadData('feedback-section-c.html', '#feedback-data-source-section-c', '.feedback-item', parseFeedbackItem));
            } else {
                console.log("Debug initializeExam - STEP 9all: Preparing to load All Sections data.");
                questionsToLoad.push(loadData('questions-and-answers-section-a.html', '#exam-data-source-section-a', '.question-item', parseQuestionItem));
                questionsToLoad.push(loadData('questions-and-answers-section-b.html', '#exam-data-source-section-b', '.question-item', parseQuestionItem));
                questionsToLoad.push(loadData('questions-and-answers-section-c.html', '#exam-data-source-section-c', '.question-item', parseQuestionItem));
                feedbackToLoad.push(loadData('feedback-section-a.html', '#feedback-data-source-section-a', '.feedback-item', parseFeedbackItem));
                feedbackToLoad.push(loadData('feedback-section-b.html', '#feedback-data-source-section-b', '.feedback-item', parseFeedbackItem));
                feedbackToLoad.push(loadData('feedback-section-c.html', '#feedback-data-source-section-c', '.feedback-item', parseFeedbackItem));
            }
            console.log("Debug initializeExam - STEP 10: Number of question files to load:", questionsToLoad.length);
            console.log("Debug initializeExam - STEP 11: Number of feedback files to load:", feedbackToLoad.length);

            const [loadedQuestionsArrays, loadedFeedbackArrays, faqData] = await Promise.all([
                Promise.all(questionsToLoad),
                Promise.all(feedbackToLoad),
                loadData('faq-chat-responses.html', '#faq-data-source', '.faq-item', parseFaqItem)
            ]);
            console.log("Debug initializeExam - STEP 12: Promise.all for data loading completed.");

            allQuestionsData = loadedQuestionsArrays.flat();
            allFeedbackData = loadedFeedbackArrays.flat();
            allFaqData = faqData;

            console.log("Debug initializeExam - STEP 13: All questions loaded:", allQuestionsData.length);
            console.log("Debug initializeExam - STEP 14: All feedback loaded:", allFeedbackData.length);
            console.log("Debug initializeExam - STEP 15: All FAQs loaded:", allFaqData.length);

        } catch (error) {
            console.error("Major error during data loading in initializeExam:", error);
            if(questionTextElement) questionTextElement.textContent = "A critical error occurred while loading exam data. Please refresh or contact support.";
            allQuestionsData = [];
        }

        console.log("Debug initializeExam - STEP 16: Data loading attempt finished. Question count:", allQuestionsData.length);

        if (allQuestionsData.length > 0) {
            console.log("Debug initializeExam - STEP 17: Calling displayQuestion for the first question.");
            displayQuestion(currentQuestionIndex);
        } else {
            console.warn("Debug initializeExam - STEP 17: No questions loaded, cannot display first question.");
            if(questionTextElement) questionTextElement.textContent = "No questions available for this section or failed to load. Please check console.";
            if(choicesContainer) choicesContainer.innerHTML = '';
            if(feedbackContentArea) feedbackContentArea.innerHTML = '<p class="italic text-sm">Could not load exam questions.</p>';
        }
        updateNavigationButtons();
        console.log("Debug initializeExam - STEP 18: END.");
    }

    // --- EVENT LISTENERS ---
    topicButtons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            const sectionTitle = button.dataset.sectionTitle || button.textContent.trim();
            // console.log(`Debug EventListener - Topic button clicked: Section Code = ${section}, Title = ${sectionTitle}`);
            openModal(
                `Start Exam: ${sectionTitle}`,
                `Are you sure you want to start a new exam for "${sectionTitle}"? Your current progress will be lost.`,
                () => {
                    // console.log(`Debug EventListener - Modal confirmed for section: ${section}. Calling initializeExam.`);
                    initializeExam(section);
                }
            );
        });
    });

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentQuestionIndex < allQuestionsData.length - 1) {
                currentQuestionIndex++;
                displayQuestion(currentQuestionIndex);
            } else if (currentQuestionIndex === allQuestionsData.length - 1 && allQuestionsData.length > 0) {
                submitExam();
            }
        });
    }

    if (btnPrevious) {
        btnPrevious.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                displayQuestion(currentQuestionIndex);
            }
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', () => {
            openModal(
                "Submit Exam",
                "Are you sure you want to submit your exam? You cannot make further changes.",
                submitExam
            );
        });
    }

    if (btnNewExam) {
        btnNewExam.addEventListener('click', () => {
             openModal(
                "Start New Exam (All Sections)",
                "Are you sure you want to start a new exam with all sections? Your current progress will be lost.",
                () => initializeExam(null)
            );
        });
    }

    if (btnHome) {
        btnHome.addEventListener('click', () => {
            openModal(
                "Return to Home (All Sections)",
                "This will start a new exam with all sections. Your current progress will be lost. Proceed?",
                () => initializeExam(null)
            );
        });
    }

    if (btnSendChat) {
        btnSendChat.addEventListener('click', handleChatInput);
    }
    if (chatInputElement) {
        chatInputElement.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleChatInput();
            }
        });
    }

    // Initial load (all sections by default)
    initializeExam(null);
});
