/* ==========================================================================
   當代中文課程 詞彙多功能閃卡遊戲 - Multi-Lesson Game Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Game States ---
  // 'idle'      : Ready to start drawing
  // 'flashing'  : Shuffling rapidly (slot machine scrolling animation running)
  // 'stopped'   : Word stopped and revealed
  // 'completed' : All cards completed, victory screen active
  let gameState = 'idle'; 
  
  let selectedLessons = ["B3L1", "B3L2"]; // Default selected lessons
  let currentMode = 'dialogue'; // 'dialogue', 'passage', 'combined'
  let activeWordsList = [];     // Shuffled array of words for this session
  let currentIndex = 0;         // Index of the next word to be revealed
  let currentWordStr = "";      // The word currently revealed on card
  let historyVisited = [];      // Track words revealed for backward review
  let historyIndex = -1;        // Pointer in history review (-1 means live play)
  
  let isSoundEnabled = true;    // Audio toggle
  let audioCtx = null;          // Web Audio Context (lazy initialized)
  let flashIntervalId = null;   // Timer ID for high-speed flashing
  
  // --- DOM Elements ---
  const pillsContainer = document.getElementById('lesson-pills-container');
  const selectAllBtn = document.getElementById('select-all-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  
  const countDialogue = document.getElementById('count-dialogue');
  const countPassage = document.getElementById('count-passage');
  const countCombined = document.getElementById('count-combined');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const vocabWordDisplay = document.getElementById('vocab-word');
  const currentIndexDisplay = document.getElementById('current-index');
  const totalCountDisplay = document.getElementById('total-count');
  const percentDisplay = document.getElementById('percent-display');
  const progressFill = document.getElementById('progress-fill');
  
  const flashcard = document.getElementById('flashcard');
  const cardTrigger = document.getElementById('card-trigger');
  const nextBtn = document.getElementById('next-btn');
  const prevBtn = document.getElementById('prev-btn');
  const resetBtn = document.getElementById('reset-btn');
  const audioToggle = document.getElementById('audio-toggle');
  const gameHint = document.getElementById('game-hint');
  
  const completionScreen = document.getElementById('completion-screen');
  const completionSummary = document.getElementById('completion-summary');
  const statTotal = document.getElementById('stat-total');
  const restartBtn = document.getElementById('restart-btn');
  const controlsPanel = document.getElementById('controls-panel');

  // --- Dynamic Lesson Pills Generator ---
  const renderLessonPills = () => {
    pillsContainer.innerHTML = '';
    Object.keys(VOCAB_DATA).forEach(lessonKey => {
      const lesson = VOCAB_DATA[lessonKey];
      const pill = document.createElement('div');
      pill.className = `lesson-pill ${selectedLessons.includes(lessonKey) ? 'selected' : ''}`;
      pill.dataset.lesson = lessonKey;
      pill.textContent = lesson.title;
      
      pill.addEventListener('click', () => {
        toggleLesson(lessonKey);
      });
      pillsContainer.appendChild(pill);
    });
  };

  const toggleLesson = (lessonKey) => {
    if (gameState === 'flashing') return; // Disable changes during spin
    
    const index = selectedLessons.indexOf(lessonKey);
    if (index > -1) {
      selectedLessons.splice(index, 1);
    } else {
      selectedLessons.push(lessonKey);
    }
    
    renderLessonPills();
    updateTabCounts();
    initGame(currentMode);
    playClickSound();
  };

  const updateTabCounts = () => {
    let dCount = 0;
    let pCount = 0;
    
    selectedLessons.forEach(key => {
      if (VOCAB_DATA[key]) {
        dCount += VOCAB_DATA[key].dialogue.length;
        pCount += VOCAB_DATA[key].passage.length;
      }
    });
    
    countDialogue.textContent = `${dCount} 字`;
    countPassage.textContent = `${pCount} 字`;
    countCombined.textContent = `${dCount + pCount} 字`;
  };

  selectAllBtn.addEventListener('click', () => {
    if (gameState === 'flashing') return;
    selectedLessons = Object.keys(VOCAB_DATA);
    renderLessonPills();
    updateTabCounts();
    initGame(currentMode);
    playClickSound();
  });

  clearAllBtn.addEventListener('click', () => {
    if (gameState === 'flashing') return;
    selectedLessons = [];
    renderLessonPills();
    updateTabCounts();
    initGame(currentMode);
    playClickSound();
  });

  // --- Web Audio Synthesizer (Zero asset dependencies) ---
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  // High-frequency mechanical clock ticking click sound
  const playTickSound = () => {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    const now = audioCtx.currentTime;
    
    osc.frequency.setValueAtTime(1200, now);
    
    gainNode.gain.setValueAtTime(0.03, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    
    osc.start(now);
    osc.stop(now + 0.015);
  };

  // Quick soft click UI feedback
  const playClickSound = () => {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    const now = audioCtx.currentTime;
    
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
    
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.06);
  };

  // Bright, magical arpeggio chime for stopping/revealing a card
  const playRevealSound = () => {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      
      const noteStart = now + (index * 0.05);
      const noteDuration = 0.35 - (index * 0.03);
      
      osc.frequency.setValueAtTime(freq, noteStart);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.setValueAtTime(0.06, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);
      
      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.05);
    });
  };

  // Triumphant arpeggio chords for game completion
  const playVictorySound = () => {
    if (!isSoundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const chords = [
      [261.63, 329.63, 392.00], // C major
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33], // G major
      [523.25, 659.25, 783.99, 1046.50] // High C major
    ];
    
    chords.forEach((chord, chordIdx) => {
      const chordStart = now + (chordIdx * 0.18);
      
      chord.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.setValueAtTime(0.05, chordStart);
        gainNode.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.6);
        
        osc.start(chordStart);
        osc.stop(chordStart + 0.7);
      });
    });
  };

  // --- Shuffle Utility (Fisher-Yates) ---
  const shuffleArray = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // --- Game Flow Engine ---

  // Start new game in selected mode
  const initGame = (mode) => {
    currentMode = mode;
    
    // Stop any running intervals
    if (flashIntervalId) {
      clearInterval(flashIntervalId);
      flashIntervalId = null;
    }
    flashcard.classList.remove('is-flashing');
    
    // Check if at least one lesson is selected
    if (selectedLessons.length === 0) {
      vocabWordDisplay.textContent = "請選擇課堂";
      vocabWordDisplay.className = "warning-text";
      
      currentIndexDisplay.textContent = "0";
      totalCountDisplay.textContent = "0";
      percentDisplay.textContent = "0%";
      progressFill.style.width = "0%";
      
      nextBtn.disabled = true;
      prevBtn.disabled = true;
      nextBtn.innerHTML = `請選擇課堂 <span class="btn-icon">⚠️</span>`;
      gameHint.textContent = "💡 請先在上方勾選想要練習的課堂！";
      
      gameState = 'idle';
      activeWordsList = [];
      return;
    }
    
    nextBtn.disabled = false;
    
    // Compile active words from selected lessons
    let sourceWords = [];
    selectedLessons.forEach(key => {
      if (VOCAB_DATA[key]) {
        if (mode === 'dialogue') {
          sourceWords.push(...VOCAB_DATA[key].dialogue);
        } else if (mode === 'passage') {
          sourceWords.push(...VOCAB_DATA[key].passage);
        } else if (mode === 'combined') {
          sourceWords.push(...VOCAB_DATA[key].dialogue, ...VOCAB_DATA[key].passage);
        }
      }
    });
    
    // Shuffle the compiled list once
    activeWordsList = shuffleArray(sourceWords);
    currentIndex = 0;
    historyVisited = [];
    historyIndex = -1;
    
    // Initialize UI
    completionScreen.classList.add('hidden');
    flashcard.parentElement.classList.remove('hidden');
    controlsPanel.classList.remove('hidden');
    
    gameState = 'idle';
    
    vocabWordDisplay.textContent = "準備";
    vocabWordDisplay.className = "";
    
    currentIndexDisplay.textContent = "0";
    totalCountDisplay.textContent = activeWordsList.length;
    percentDisplay.textContent = "0%";
    progressFill.style.width = "0%";
    
    prevBtn.disabled = true;
    nextBtn.innerHTML = `開始抽詞 <span class="btn-icon">🎰</span>`;
    nextBtn.className = "btn btn-primary btn-large";
    gameHint.textContent = "💡 點擊卡片或按 Enter 開始閃控抽詞！";
  };

  // Set card word and adjust font scale if word is long
  const setCardWord = (word) => {
    currentWordStr = word;
    vocabWordDisplay.textContent = word;
    vocabWordDisplay.className = ""; // Clear styling classes
    if (word.length >= 4) {
      vocabWordDisplay.classList.add('long-word');
    }
  };

  // Rapidly flashing words tick (slot machine effect)
  const tickFlash = () => {
    if (activeWordsList.length === 0) return;
    const randWord = activeWordsList[Math.floor(Math.random() * activeWordsList.length)];
    setCardWord(randWord);
    playTickSound();
  };

  // State A: Start Spinning Flashing
  const startFlashing = () => {
    if (activeWordsList.length === 0) return;
    initAudio();
    gameState = 'flashing';
    historyIndex = -1; // Reset history review back to live play
    
    vocabWordDisplay.className = "";
    
    // Add rapid border shake and glow
    flashcard.classList.add('is-flashing');
    
    // Start rapid text swapping (every 65ms)
    flashIntervalId = setInterval(tickFlash, 65);
    
    // Buttons updating
    prevBtn.disabled = true;
    nextBtn.innerHTML = `停止 🛑`;
    nextBtn.className = "btn btn-primary btn-large btn-danger"; 
    gameHint.textContent = "💡 點擊卡片或按 Enter 停止！";
  };

  // State B: Stop Spinning and Reveal Target Word
  const stopFlashingAndReveal = () => {
    gameState = 'stopped';
    
    // Clear flash intervals
    if (flashIntervalId) {
      clearInterval(flashIntervalId);
      flashIntervalId = null;
    }
    flashcard.classList.remove('is-flashing');
    
    // Grab the actual next word in the shuffled sequence
    const word = activeWordsList[currentIndex];
    setCardWord(word);
    
    // Save to visited history
    historyVisited.push(word);
    
    // Add reveal visual pop
    vocabWordDisplay.className = "";
    if (word.length >= 4) vocabWordDisplay.classList.add('long-word');
    void vocabWordDisplay.offsetWidth; // force reflow
    vocabWordDisplay.classList.add('word-reveal-anim');
    
    playRevealSound();
    currentIndex++;
    
    // Update progress bars & displays
    const displayIndex = currentIndex;
    const totalCount = activeWordsList.length;
    const percent = Math.round((displayIndex / totalCount) * 100);
    
    currentIndexDisplay.textContent = displayIndex;
    percentDisplay.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    
    // Reset buttons
    prevBtn.disabled = historyVisited.length <= 1;
    
    if (currentIndex === totalCount) {
      nextBtn.innerHTML = `完成遊戲 <span class="btn-icon">🏁</span>`;
      nextBtn.className = "btn btn-primary btn-large btn-victory";
      gameHint.textContent = "💡 點擊卡片或按 Enter 結算成績！";
    } else {
      nextBtn.innerHTML = `抽取下一個 <span class="btn-icon">🎰</span>`;
      nextBtn.className = "btn btn-primary btn-large";
      gameHint.textContent = "💡 點擊卡片或按 Enter 抽取下一個詞彙！";
    }
  };

  // Navigation: Action triggered on primary click/Enter/Space
  const handlePrimaryAction = () => {
    if (selectedLessons.length === 0) return;
    initAudio();
    
    if (gameState === 'idle') {
      startFlashing();
    } else if (gameState === 'flashing') {
      stopFlashingAndReveal();
    } else if (gameState === 'stopped') {
      if (currentIndex < activeWordsList.length) {
        startFlashing();
      } else {
        handleCompletion();
      }
    }
  };

  // Reviewing previous words in history
  const handlePrev = () => {
    if (gameState === 'flashing') return; // Cannot review while spinning
    
    if (historyIndex === -1) {
      historyIndex = historyVisited.length - 1;
    }
    
    if (historyIndex > 0) {
      historyIndex--;
      const prevWord = historyVisited[historyIndex];
      
      playClickSound();
      
      setCardWord(prevWord);
      vocabWordDisplay.className = "";
      if (prevWord.length >= 4) vocabWordDisplay.classList.add('long-word');
      void vocabWordDisplay.offsetWidth;
      vocabWordDisplay.classList.add('card-anim');
      
      const displayIndex = historyIndex + 1;
      currentIndexDisplay.textContent = displayIndex;
      
      nextBtn.innerHTML = `回歸最新 <span class="btn-icon">➔</span>`;
      nextBtn.className = "btn btn-primary btn-large";
      gameHint.textContent = "💡 點擊「回歸最新」或「下一個」繼續抽取未見字詞！";
      
      prevBtn.disabled = historyIndex === 0;
    }
  };

  // Complete game action
  const handleCompletion = () => {
    gameState = 'completed';
    playVictorySound();
    
    // Hide main screen
    flashcard.parentElement.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    
    // Configure statistics
    const totalCount = activeWordsList.length;
    let modeText = '對話';
    if (currentMode === 'passage') modeText = '短文';
    if (currentMode === 'combined') modeText = '綜合';
    
    // Compile list of selected lesson titles to show in completion screen
    const selectedTitles = selectedLessons.map(key => VOCAB_DATA[key] ? key : '').filter(Boolean).join('、');
    
    completionSummary.textContent = `您已成功學完 [${selectedTitles}] 的全部 ${totalCount} 個${modeText}詞彙！`;
    statTotal.textContent = totalCount;
    
    completionScreen.classList.remove('hidden');
    createConfettiEffect();
  };

  // --- Confetti particle celebration effect ---
  const createConfettiEffect = () => {
    const container = document.body;
    const colors = ['#6366f1', '#a855f7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
    
    for (let i = 0; i < 60; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti';
      
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      const size = Math.random() * 8 + 6;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      const delay = Math.random() * 2;
      particle.style.animationDelay = `${delay}s`;
      
      const duration = Math.random() * 2 + 2;
      particle.style.animationDuration = `${duration}s`;
      
      container.appendChild(particle);
      
      setTimeout(() => {
        particle.remove();
      }, (delay + duration) * 1000);
    }
  };

  // --- Interactive 3D Card Hover Physics ---
  cardTrigger.addEventListener('mousemove', (e) => {
    if (gameState === 'flashing' || selectedLessons.length === 0) return;
    
    const rect = cardTrigger.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const tiltX = -(y - centerY) / (rect.height / 15);
    const tiltY = (x - centerX) / (rect.width / 15);
    
    flashcard.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.025)`;
  });

  cardTrigger.addEventListener('mouseleave', () => {
    flashcard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
  });

  // --- Navigation Click Listeners ---
  
  // Card click acts as primary action
  cardTrigger.addEventListener('click', (e) => {
    if (e.target.closest('.btn') || e.target.closest('.icon-btn')) return;
    handlePrimaryAction();
  });

  // Control Buttons
  nextBtn.addEventListener('click', () => {
    if (selectedLessons.length === 0) return;
    
    if (historyIndex !== -1) {
      historyIndex = -1;
      
      // Restore latest state
      const word = historyVisited[historyVisited.length - 1];
      setCardWord(word);
      currentIndexDisplay.textContent = currentIndex;
      prevBtn.disabled = historyVisited.length <= 1;
      
      if (currentIndex === activeWordsList.length) {
        nextBtn.innerHTML = `完成遊戲 <span class="btn-icon">🏁</span>`;
        nextBtn.className = "btn btn-primary btn-large btn-victory";
        gameHint.textContent = "💡 點擊卡片或按 Enter 結算成績！";
      } else {
        nextBtn.innerHTML = `抽取下一個 <span class="btn-icon">🎰</span>`;
        nextBtn.className = "btn btn-primary btn-large";
        gameHint.textContent = "💡 點擊卡片或按 Enter 繼續抽取！";
      }
      playClickSound();
    } else {
      handlePrimaryAction();
    }
  });
  
  prevBtn.addEventListener('click', handlePrev);
  
  resetBtn.addEventListener('click', () => {
    playClickSound();
    initGame(currentMode);
  });
  
  restartBtn.addEventListener('click', () => {
    initGame(currentMode);
  });

  // Mode Selection Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.tab-btn');
      if (!targetBtn || targetBtn.classList.contains('active')) return;
      
      tabButtons.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      
      const newMode = targetBtn.getAttribute('data-mode');
      initGame(newMode);
      playClickSound();
    });
  });

  // Audio Toggle
  audioToggle.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    if (isSoundEnabled) {
      audioToggle.querySelector('.icon').textContent = '🔊';
      audioToggle.classList.remove('muted');
      initAudio();
      playClickSound();
    } else {
      audioToggle.querySelector('.icon').textContent = '🔇';
      audioToggle.classList.add('muted');
    }
  });

  // --- Keyboard Shortcuts (Space/Enter for primary action, Arrows for navigating) ---
  document.addEventListener('keydown', (e) => {
    if (selectedLessons.length === 0) return;
    if (e.code === 'Space') {
      e.preventDefault(); // Prevent page scroll
    }
    
    if (gameState !== 'completed') {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (historyIndex !== -1) {
          historyIndex = -1;
          const word = historyVisited[historyVisited.length - 1];
          setCardWord(word);
          currentIndexDisplay.textContent = currentIndex;
          prevBtn.disabled = historyVisited.length <= 1;
          
          if (currentIndex === activeWordsList.length) {
            nextBtn.innerHTML = `完成遊戲 <span class="btn-icon">🏁</span>`;
            nextBtn.className = "btn btn-primary btn-large btn-victory";
            gameHint.textContent = "💡 點擊卡片或按 Enter 結算成績！";
          } else {
            nextBtn.innerHTML = `抽取下一個 <span class="btn-icon">🎰</span>`;
            nextBtn.className = "btn btn-primary btn-large";
            gameHint.textContent = "💡 點擊卡片或按 Enter 繼續抽取！";
          }
          playClickSound();
        } else {
          handlePrimaryAction();
        }
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      } else if (e.code === 'ArrowRight' && historyIndex !== -1) {
        historyIndex = -1;
        const word = historyVisited[historyVisited.length - 1];
        setCardWord(word);
        currentIndexDisplay.textContent = currentIndex;
        prevBtn.disabled = historyVisited.length <= 1;
        
        if (currentIndex === activeWordsList.length) {
          nextBtn.innerHTML = `完成遊戲 <span class="btn-icon">🏁</span>`;
          nextBtn.className = "btn btn-primary btn-large btn-victory";
        } else {
          nextBtn.innerHTML = `抽取下一個 <span class="btn-icon">🎰</span>`;
          nextBtn.className = "btn btn-primary btn-large";
        }
        playClickSound();
      }
    } else {
      if (e.code === 'Enter' || e.code === 'Space') {
        initGame(currentMode);
      }
    }
  });

  // --- Initial Launch Setup ---
  renderLessonPills();
  updateTabCounts();
  initGame('dialogue');
});
