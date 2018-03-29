/*jshint esversion:6, devel: true, browser: true*/

(function () {
  
  /****************************/
  /* SETUP - SHARED VARIABLES */
  /****************************/
  
  //variables for enabling retrying of wrong answers at the end
  let cardsToRetry = 0,
      retryIndexes = [];
  
  /*****************************/
  /* HANDLEBARS TEMPLATE SETUP */
  /*****************************/
  
  //gets handlebars templates from the DOM
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

  //replaces default difficulty # with what's stored in each card object
  Handlebars.registerHelper('diffselect', function (difficulty, options) {
    let repl = `value=${difficulty}`;
    return options.fn(this).replace(repl, `${repl} selected="selected"`);
  });
  
  /**********************************/
  /* BIND PERMANENT EVENT LISTENERS */
  /**********************************/
  
  // handle changes to deck display name
  document.querySelector('.header').addEventListener('change', (e) => {
    flashcards.setDisplayName(e.target.value);
    e.stopPropagation();
  });
  
  // handle button clicks in the header
  document.querySelector('.header').addEventListener('click', (e) => {
    if (e.target.id === 'deleteDeck') {
      flashcards.deleteDeck(e.target.dataset.name);
      window.location.href = '#';
    }
    if (e.target.id === 'flip') {
      flashcards.flipDeck();
      // re-draw the current card from the deck
      let currentIndex = flashcards.getSessionInfo().currentIndex,
          card = flashcards.draw(currentIndex);
      // render the new 'answer' side of the current card; don't change score/progress!
      Render.question(card.question[0], card.difficulty, true);
    }
    e.stopPropagation();
  });
  
  // handle adding / deleting of cards in edit mode
  document.querySelector('.main').addEventListener('click', (e) => {
    const el = e.target;
    if (el.id === 'addCard' || el.parentNode.id === 'addCard') {
      makeNewCard();
    }
    else if (el.id === 'deleteCard') {
      let cardToDelete = el.parentNode.parentNode,
          indexToDelete = cardToDelete.dataset.index,
          cards;
      flashcards.deleteCard(indexToDelete);
      Render.deleteCard(cardToDelete);
      cards = document.querySelectorAll('.cardline');
      [].forEach.call(cards, c => {
        if (c.dataset.index > indexToDelete) {
          c.dataset.index -= 1;
        }
      });
    }
  });
  
  // handle updates to cards in edit mode
  document.querySelector('.main').addEventListener('change', (e) => {
    const el = e.target,
          parent = el.parentNode;
    if (el.id === 'side1' || el.id === 'side2') {
      let val = el.value.split('/').map( x => x.trim() );
      flashcards.editCard(parent.dataset.index, el.id, val);
    }
    else if (el.id === 'diff') {
      flashcards.editCard(parent.dataset.index, 'difficulty', parseInt(el.value));
    }
  });
  
  // allow creation of new cards via enter key press in edit mode
  document.querySelector('.main').addEventListener('keydown', (e) => {
    const el = e.target;
    if (event.keyCode === 13 && (el.id === 'side1' || el.id === 'side2')) {
      event.preventDefault();
      makeNewCard();
    }
  });
  
  /**********************/
  /*   SET UP ROUTING   */
  /**********************/
  
  const routes = {
    '/': select,
    '/train/:deckname': train,
    '/edit/:deckname': edit,
    '/editnew': editnew
  };
  
  //set up and initiate rendering of home interface with deck list
  function select() {
    const sortedDeck = flashcards.listDecks().sort( (a, b) => {
      return parseInt(a.name) - parseInt(b.name);
    });
    console.log(sortedDeck);
    let context = {
      deck: sortedDeck
    };
    document.querySelector(".main").innerHTML = selectTemplate(context);
    Render.header(false, "Flashcards.js demo");
  }
  
  // set up and initiate rendering of training interface
  function train(name) {
    flashcards.openDeck(name);
    document.querySelector(".main").innerHTML = trainTemplate();
    Render.header(true, flashcards.getDisplayName(), false, name);
    //render deck
    drawNextCard();
    //bind event listeners to training buttons
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
  
  // set up and initiate rendering of edit interface for new deck
  function editnew() {
    let newName = Math.floor(Date.now() / 1000).toString();
    flashcards.openDeck(newName);
    flashcards.setDisplayName('New Deck');
    window.location.href = `#/edit/${newName}`;
  }
  
  // get card details and initiate rendering of edit interface for existing deck
  function edit(name) {
    flashcards.openDeck(name);
    Render.header(true, flashcards.getDisplayName(), true, name);
    Render.editing(flashcards.exposeDeck().cards, flashcards.deckLength());
  }
  
  /****************************************/
  /* HELPER FUNCTIONS FOR EVENT LISTENERS */
  /****************************************/
  
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
  
  function makeNewCard () {
    flashcards.addCard('', '', 5);
    let newIndex = flashcards.deckLength() - 1;
    Render.newCard('', '', 5, newIndex);
  }

  /**************************/
  /* METHODS FOR RENDERING  */
  /**************************/
  
  const Render = {
    
    // changes the header according to what area the user's in
    header: function (backlink, title, editing, name) {
      let context = {
        backlink: backlink,
        title: title,
        editing: editing || false,
        name: name || false
      };
      document.querySelector(".header").innerHTML = headerTemplate(context);
    },
    
    //renders the question side of a card + check button
    question: function (qText, diff, isFlipped) {
      let context = {
        question: qText,
        difficulty: diff
      },
          userAnswer = document.querySelector('.answer__input');
      document.querySelector('.card__side--question').innerHTML = questionTemplate(context);
      //animate card flip
      document.querySelector('#maincard').classList.remove('card--flip');
      //as long as the reason for rendering isn't a deck flip, then...
      if (!isFlipped) {
        //clear user answer and focus on input
        userAnswer.value = '';
        userAnswer.readOnly = false;
        userAnswer.focus();
        //turn button to 'check' button
        document.getElementById('checkAnswer').classList.remove('js-hidden');
        document.getElementById('nextCard').classList.add('js-hidden');
      }
    },
    
    //renders the answer side of a card + next button
    answer: function (answers, newDiff, outcome) {
      let context = {
        answers: answers,
        difficulty: newDiff,
        outcome: outcome
      },
          nextButton = document.getElementById('nextCard');
      document.querySelector('.card__side--answer').innerHTML = answerTemplate(context);  
      //animate card flip
      document.querySelector('#maincard').classList.add('card--flip');
      //turn button to 'next' button
      document.getElementById('checkAnswer').classList.add('js-hidden');
      nextButton.classList.remove('js-hidden');
      //freeze/disable input and focus on 'next' button
      document.querySelector('.answer__input').readOnly = true;
      nextButton.focus();
    },
    
    //renders updated user progress bar
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
    
    //renders user's final score + retry button
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
    
    //resets the training interface so card and input field are visible
    reset: function () {
      document.querySelector('.card').classList.remove('js-hidden');
      document.querySelector('.answer__input').classList.remove('js-hidden');
      document.getElementById('retry').classList.add('js-hidden');
      document.querySelector('.score').classList.add('js-hidden');
    },
    
    //renders editing interface with any existing cards
    editing: function (cards, decklength) {
      document.querySelector(".main").innerHTML = addCardTemplate();
      for (let i = 0; i < decklength; i++) {
        let side1 = cards[i].side1.join(' / '),
            side2 = cards[i].side2.join(' / '),
            difficulty = cards[i].difficulty,
            index = i;
        Render.newCard(side1, side2, difficulty, index);
      }
    },
    
    //renders a new blank card in the DOM, ready for editing
    newCard: function (side1, side2, difficulty, index) {
      let context = {
        index: index,
        side1: side1,
        side2: side2,
        difficulty: difficulty
      };
      document.querySelector("#addCard").insertAdjacentHTML('afterend', editCardTemplate(context));
      //focus on the new card's first input field
      document.getElementById(`card-${index}`).firstChild.focus();
    },
    
    //removes card from editing interface
    deleteCard: function (cardToDelete) {
      document.querySelector('.main').removeChild(cardToDelete);
    }
    
  };
  
  /**********************/
  /* ROUTER, BLAST OFF! */
  /**********************/
  
  Router(routes).init('/');

})();
