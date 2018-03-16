/*jshint esversion:6, devel: true, browser: true*/

(function () {
  
  /* SETUP - SHARED VARIABLES */
  
  //get handlebars templates
  function getTemplate (name) {
    return Handlebars.compile(document.getElementById(name).innerHTML);
  }
  const headerTemplate = getTemplate("headerTemplate"),
        trainTemplate = getTemplate("trainTemplate"),
        selectTemplate = getTemplate("selectTemplate"),
        questionTemplate = getTemplate("questionTemplate"),
        answerTemplate = getTemplate("answerTemplate"),
        progressTemplate = getTemplate("progressTemplate"),
        scoreTemplate = getTemplate("scoreTemplate"),
        editCardTemplate = getTemplate("editCardTemplate"),
        addCardTemplate = getTemplate("addCardTemplate");
  
  //variables for retrying wrong answers
  let cardsToRetry = 0,
      retryIndexes = [];
  
  /* BIND GLOBAL EVENT LISTENERS */
  
  document.querySelector('.header').addEventListener('change', (e) => {
    flashcards.setDisplayName(e.target.value);
    e.stopPropagation();
  });
  
  document.querySelector('.header').addEventListener('click', (e) => {
    if (e.target.id === 'deleteDeck') {
      flashcards.deleteDeck(e.target.dataset.name);
      window.location.href = '#';
    }
    e.stopPropagation();
  });
  
  document.querySelector('.main').addEventListener('click', (e) => {
    const el = e.target;
    console.log(el);
    if (el.id === 'addCard' || el.parentNode.id === 'addCard') {
      flashcards.addCard('', '', 5);
      let newIndex = flashcards.deckLength() - 1;
      Render.newCard('', '', 5, newIndex);
    }
    else if (el.id === 'deleteCard') {
      let cardToDelete = el.parentNode.parentNode,
          indexToDelete = cardToDelete.dataset.index,
          cards;
      flashcards.deleteCard();
      document.querySelector('.main').removeChild(cardToDelete);
      cards = document.querySelectorAll('.cardline');
      [].forEach.call(cards, c => {
        if (c.dataset.index > indexToDelete) {
          c.dataset.index -= 1;
        }
      });
    }
  });
  
  /* SET UP ROUTING */
  
  const routes = {
    '/train/:deckname': train,
    '/edit/:deckname': edit,
    '/': select,
    '/editnew': editnew
  };
  
  /* FUNCTIONS FOR ROUTING */
  
  function train(name) {
    flashcards.openDeck(name);
    
    // make necessary rendering changes to homepage
    document.querySelector(".main").innerHTML = trainTemplate();
    changeHeader(true, flashcards.getDisplayName(), false, name);
    
    //render deck
    drawNextCard();
    
    //bind event listeners
    document.getElementById('shuffle').addEventListener('click', () => {
      cardsToRetry = 0;
      retryIndexes = [];
      Render.reset();
      flashcards.shuffle();
      drawNextCard();
    });

    document.getElementById('checkAnswer').addEventListener('click', () => {
      submitAnswer();
    });

    document.getElementById('nextCard').addEventListener('click', () => {
      drawNextCard();
    });

    document.getElementById('retry').addEventListener('click', () => {
      cardsToRetry = flashcards.getSessionInfo().incorrect;
      retryIndexes = flashcards.getSessionInfo().incorrectCards;
      Render.reset();
      flashcards.openDeck(name);
      drawNextCard();
    });
  }
  
  function editnew() {
    let newName = Math.floor(Date.now() / 1000).toString();
    flashcards.openDeck(newName);
    flashcards.setDisplayName('New Deck');
    window.location.href = `#/edit/${newName}`;
  }
  
  function edit(name) {
    flashcards.openDeck(name);
    const cards = flashcards.exposeDeck().cards;
    //bind event listeners to main
    //and bind to header
    changeHeader(true, flashcards.getDisplayName(), true, name);
    //move below stuff to Render
    document.querySelector(".main").innerHTML = addCardTemplate();
    for (let i = 0; i < flashcards.deckLength(); i++) {
      let side1 = cards[i].side1.join(' / '),
          side2 = cards[i].side2.join(' / '),
          difficulty = cards[i].difficulty,
          index = i;
      Render.newCard(side1, side2, difficulty, index);
    }
  }
  
  function select() {
    const sortedDeck = flashcards.listDecks().sort( (a, b) => {
      return parseInt(a.name) - parseInt(b.name);
    });
    console.log(sortedDeck);
    let context = {
      deck: sortedDeck
    };
    document.querySelector(".main").innerHTML = selectTemplate(context);
    changeHeader(false, "Flashcards.js demo");
  }
  
  /* HELPER FUNCTIONS FOR EVENT LISTENERS */
  
  function drawNextCard () {
    let card = cardsToRetry ? flashcards.draw(retryIndexes.splice(0, 1)[0]) : flashcards.drawNext();
    if (!card) {
      Render.score(flashcards.getSessionInfo());
    } else {
      Render.question(card.question[0], card.difficulty);
      document.querySelector('.answer__input').addEventListener('keydown', enterAnswer);
      Render.progress(flashcards.getSessionInfo(), flashcards.deckLength());
    }
  }
  
  function submitAnswer () {
    let userAnswer = document.querySelector('.answer__input'),
        result = flashcards.checkAnswer(userAnswer.value.trim());
    Render.answer(result.answers, result.newDifficulty, result.outcome);
    Render.progress(flashcards.getSessionInfo(), flashcards.deckLength());
    userAnswer.removeEventListener('keydown', enterAnswer);
  }
      
  function enterAnswer (event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      submitAnswer();
    }
  }
  
  function changeHeader (backlink, title, editing, name) {
    let context = {
      backlink: backlink,
      title: title,
      editing: editing || false,
      name: name || false
    };
    document.querySelector(".header").innerHTML = headerTemplate(context);
  }

  /* FUNCTIONS FOR RENDERING */
  
  const Render = {
    
    question: function (qText, diff) {
      let context = {
        question: qText,
        difficulty: diff
      },
          userAnswer = document.querySelector('.answer__input');
      document.querySelector('.card__side--question').innerHTML = questionTemplate(context);
      document.querySelector('#maincard').classList.remove('card--flip');
      userAnswer.value = '';
      userAnswer.readOnly = false;
      userAnswer.focus();
      document.getElementById('checkAnswer').classList.remove('js-hidden');
      document.getElementById('nextCard').classList.add('js-hidden');
    },
    
    answer: function (answers, newDiff, outcome) {
      let context = {
        answers: answers,
        difficulty: newDiff,
        outcome: outcome
      },
          nextButton = document.getElementById('nextCard');
      document.querySelector('.card__side--answer').innerHTML = answerTemplate(context);
      
      //flip card
      document.querySelector('#maincard').classList.add('card--flip');
      
      //turn button to 'next' button
      document.getElementById('checkAnswer').classList.add('js-hidden');
      nextButton.classList.remove('js-hidden');
      
      //freeze/disable input and focus on 'next' button
      document.querySelector('.answer__input').readOnly = true;
      nextButton.focus();
    },
    
    progress: function (sessionInfo, totalCards) {
      let bars = [],
          cardsAnswered = sessionInfo.correct + sessionInfo.incorrect,
          cardsRemaining = cardsToRetry ? cardsToRetry - cardsAnswered : totalCards - cardsAnswered,
          i;
      for (i = 0; i < totalCards; i++) {
        if (sessionInfo.correctCards.includes(i)) {
          bars.push('correct');
        } else if (sessionInfo.incorrectCards.includes(i)) {
          bars.push('incorrect');
        }
      }
      for (i = 0; i < cardsRemaining; i++) {
        bars.push('incomplete');
      }
      document.querySelector('.progress').innerHTML = progressTemplate( {bars: bars} );
    },
    
    score: function (sessionInfo) {
      let context = {
        correct: sessionInfo.correct,
        total: sessionInfo.incorrect + sessionInfo.correct
      },
          retryButton = document.getElementById('retry'),
          scoreIndicator = document.querySelector('.score');
      scoreIndicator.innerHTML = scoreTemplate(context);
      scoreIndicator.classList.remove('js-hidden');
      document.querySelector('.card').classList.add('js-hidden');
      document.querySelector('.answer__input').classList.add('js-hidden');
      document.getElementById('nextCard').classList.add('js-hidden');
      if (sessionInfo.incorrect) {
        retryButton.classList.remove('js-hidden');
        retryButton.focus();
      } else {
        document.getElementById('shuffle').focus();
      }
    },
    
    reset: function () {
      document.querySelector('.card').classList.remove('js-hidden');
      document.querySelector('.answer__input').classList.remove('js-hidden');
      document.getElementById('retry').classList.add('js-hidden');
      document.querySelector('.score').classList.add('js-hidden');
    },
    
    newCard: function (side1, side2, difficulty, index) {
      let context = {
        index: index,
        side1: side1,
        side2: side2,
        difficulty: difficulty
      };
      document.querySelector("#addCard").insertAdjacentHTML('afterend', editCardTemplate(context));
    }
    
  };
  
  Router(routes).init('/');

})();
