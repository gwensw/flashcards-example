/*jshint esversion:6, devel: true, browser: true*/

(function () {
  
  /****************************/
  /* SETUP - SHARED VARIABLES */
  /****************************/
  
  //keep track of incorrect cards to allow retrying of wrong answers at the end
  let cardsToRetry = [];
  
  //default user settings for deck behaviour
  const __defaultSettings = { qSide: 'side1', autocheck: true, firstanswer: true};  
  
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
        addCardTemplate = getTemplate("addCardTemplate"),
        modalTemplate = getTemplate("modalTemplate");

  //replaces default difficulty # with what's stored in each card object
  Handlebars.registerHelper('diffselect', (difficulty, options) => {
    let repl = `value=${difficulty}`;
    return options.fn(this).replace(repl, `${repl} selected="selected"`);
  });
	
	//returns star icons corresponding to difficulty
	Handlebars.registerHelper('difficon', (difficulty, options) => {
		const fullStar = '<i class="fa fa-star" aria-hidden="true"></i>',
					halfStar = '<i class="fa fa-star-half-o" aria-hidden="true"></i>',
					emptyStar = '<i class="fa fa-star-o" aria-hidden="true"></i>',
					diff = 10 - parseInt(difficulty);
		let i = 0,
				stars = [];
		for (i; i < 5; i++) {
			if (diff >= i * 2 + 2) {
				stars.push(fullStar);
			} else if (diff >= i * 2 + 1) {
				stars.push(halfStar);
			} else {
				stars.push(emptyStar);
			}
		}
		return new Handlebars.SafeString(stars.join(''));
	});
	
	//returns progress icons for true/false/incomplete
	Handlebars.registerHelper('progressicon', (status, options) => {
		const icons = {
			correct: 'fa fa-check',
			incorrect: 'fa fa-times',
			incomplete: 'fa fa-minus'
		};
		return new Handlebars.SafeString(`<i class="${icons[status]}" aria-hidden="true"></i>`);
	});
  
  /**********************************/
  /* BIND PERMANENT EVENT LISTENERS */
  /**********************************/
  
  //create empty user settings object in local storage, if none exists
  //& make sure any existing decks have user settings (backwards compatibility check)
  document.addEventListener('DOMContentLoaded', (e) => {
    const decks = flashcards.listDecks();
    let i = 0,
        usersettings = JSON.parse(localStorage.getItem('usersettings')) || {};
    for (i; i < decks.length; i++) {
      if (!usersettings[decks[i].name]) {
        usersettings[decks[i].name] = __defaultSettings;
      }
    }
    localStorage.setItem('usersettings', JSON.stringify(usersettings));
  });
  
  // handle changes to deck display name
  document.querySelector('.header').addEventListener('change', (e) => {
    flashcards.setDisplayName(e.target.value);
    e.stopPropagation();
  });
  
  document.querySelector('.header').addEventListener('keydown', (e) => {
    if (event.keyCode === 13) {
      e.target.blur();
    } 
  });
  
  // handle button clicks in the header
  document.querySelector('.header').addEventListener('click', (e) => {
    const el = e.target;
    if (el.id === 'flip') {
      //flip deck and update settings
      flashcards.flipDeck();
      let name = flashcards.exposeDeck().name,
          s = getUserSettings(name);
      s.qSide = flashcards.settings.questionSide;
      updateUserSettings(name, s);
      // re-draw the current card from the deck
      let currentIndex = flashcards.getSessionInfo().currentIndex,
          card = flashcards.draw(currentIndex);
      // render the new 'answer' side of the current card; don't change score/progress!
      Render.question(card.question[0], card.difficulty, true);
    }
    if (el.id === 'deckSettings') {
      Render.modal();
    }
    e.stopPropagation();
  });
  
  // handle adding / deleting of cards in edit mode
  document.querySelector('.main').addEventListener('click', (e) => {
    const el = e.target;
    if (el.id === 'addCard' || el.parentNode.id === 'addCard') {
      makeNewCard();
    }
    else if (el.classList.contains('deleteCard')) {
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
    if (el.classList.contains('side1') || el.classList.contains('side2')) {
      let side = el.classList.contains('side1') ? 'side1' : 'side2';
      let val = el.value.split('/').map( x => x.trim() );
      flashcards.editCard(parent.dataset.index, side, val);
    }
    else if (el.classList.contains('diff')) {
      flashcards.editCard(parent.dataset.index, 'difficulty', parseInt(el.value));
    }
  });
  
  // allow creation of new cards via enter key press in edit mode
  document.querySelector('.main').addEventListener('keydown', (e) => {
    const el = e.target;
    if (event.keyCode === 13 && (el.classList.contains('side1') || el.classList.contains('side2'))) {
      event.preventDefault();
      makeNewCard();
    }
  });
  
  // closing modal or deleting deck
  document.querySelector('.modal').addEventListener('click', (e) => {
    const el = e.target,
          deck = document.querySelector('.modal__content').dataset.name;
    if (el.classList.contains('modal') || el.classList.contains('modal__close')) {
      Render.modal();
    }
    if (el.id === 'deleteDeck' || el.parentNode.id === 'deleteDeck') {
      flashcards.deleteDeck(deck);
      //TODO: delete deck usersettings too?
      Render.modal();
      window.location.href = '#';
    }
  });
  
  // change settings in modal
  document.querySelector('.modal').addEventListener('change', (e) => {
    const el = e.target,
          deck = document.querySelector('.modal__content').dataset.name,
          s = getUserSettings(deck);
    if (el.id === 'firstanswer') {
      s.firstanswer = el.checked;
      updateUserSettings(deck, s);
    }
    if (el.id === 'autocheck') {
      s.autocheck = el.checked;
      updateUserSettings(deck, s);
    }
    if (el.id === 'sideselect') {
      s.qSide = el.value;
      updateUserSettings(deck, s);
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
    for (let i = 0; i < sortedDeck.length; i++) {
      sortedDeck[i].shortname = truncate(sortedDeck[i].displayName);
    }
    let context = {
      deck: sortedDeck
    };
    document.querySelector(".main").innerHTML = selectTemplate(context);
    Render.header(false, "Flashcards.js demo");
  }
  
  // set up and initiate rendering of training interface
  function train(name) {
    const usersettings = getUserSettings(name),
          autocheck = getUserSettings(name).autocheck;
    
    //open deck and flip if user settings dictate
    flashcards.openDeck(name);
    if (usersettings.qSide !== flashcards.settings.questionSide) {
      flashcards.flipDeck();
    }
    
    //if a saved state exists for this deck, apply it
    if (usersettings.state !== undefined) {
      flashcards.setSessionInfo(usersettings.state);
    }
    
    //render training interface and deck
    document.querySelector(".main").innerHTML = trainTemplate({
      autocheck: autocheck
    });
    Render.header(true, flashcards.getDisplayName(), false, name);
    
    //bind event listeners to training interface buttons
    document.getElementById('shuffle').addEventListener('click', () => {
      cardsToRetry = [];
      Render.reset();
      flashcards.shuffle();
      drawNextCard();
    });
    document.getElementById('checkAnswer').addEventListener('click', () => {
      submitAnswer();
    });
    document.getElementById('retry').addEventListener('click', () => {
      cardsToRetry = flashcards.getSessionInfo().incorrectCards;
      Render.reset();
      flashcards.openDeck(name);
      drawNextCard();
    });
    if (autocheck) {
      document.getElementById('nextCard').addEventListener('click', () => {
        drawNextCard();
      });
    } else {
      document.getElementById('nextButtons').addEventListener('click', (e) => {
        const el = e.target;
        if (el.id === 'wrongAnswer' || el.id === 'correctAnswer') {
          const submission = el.id === 'correctAnswer' ? flashcards.revealAnswer().answers[0] : '';
          flashcards.checkAnswer(submission);
          drawNextCard();
        }
      });
    }
		document.getElementById('inputAnswer').addEventListener('focus', (e) => {
			//TODO - make fullscreen if on mobile (header click exists fullscreen)
			if (/Android|webOS|iPhone|iPad|BlackBerry|Windows Phone|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)) {
				const doc = window.document,
							docEl = doc.documentElement,
							requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;

				if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
					requestFullScreen.call(docEl);
				}
	//			if (screenfull.enabled) {
	//				screenfull.request();
	//				alert(screenfull.isFullscreen);
	//				document.getElementById('header').addEventListener('click', () => {
	//					screenfull.exit();
	//				});
	//			}
			}
		}, true);
		
		drawNextCard();
  }
  
  // set up and initiate rendering of edit interface for new deck
  function editnew() {
    const newName = Math.floor(Date.now() / 1000).toString();
    flashcards.openDeck(newName);
    flashcards.setDisplayName('New Deck');
    updateUserSettings(newName, __defaultSettings);
    window.location.href = `#/edit/${newName}`;
  }
  
  // get card details and initiate rendering of edit interface for existing deck
  function edit(name) {
    flashcards.openDeck(name);
    Render.header(true, flashcards.getDisplayName(), true, name);
    Render.editing(flashcards.exposeDeck().cards, flashcards.deckLength(), name, getUserSettings(name));
  }
  
  /****************************************/
  /* HELPER FUNCTIONS FOR EVENT LISTENERS */
  /****************************************/
  
  function drawNextCard () {
    recordProgress();
    let card = cardsToRetry.length ? flashcards.draw(cardsToRetry.splice(0, 1)[0]) : flashcards.drawNext();
    if (!card) {
      Render.score(flashcards.getSessionInfo());
    } else {
      Render.question(card.question[0], card.difficulty);
      document.querySelector('.answer__input').addEventListener('keydown', enterAnswer);
    }
  }
  
  //autosaves progress and triggers progress bar render
  function recordProgress () {
    const si = flashcards.getSessionInfo(),
        name = flashcards.exposeDeck().name;
    let usersettings = getUserSettings(name);
    usersettings.state = si;
    updateUserSettings(name, usersettings);
    Render.progress(si, flashcards.deckLength());
  }
  
  function submitAnswer () {
    const name = flashcards.exposeDeck().name,
          usersettings = getUserSettings(name),
          userAnswer = document.querySelector('.answer__input');
    if (usersettings.autocheck) {
      const result = flashcards.checkAnswer(userAnswer.value.trim()),
           answers = usersettings.firstanswer ? [result.answers[0]] : result.answers;
      Render.answer(answers, result.newDifficulty, result.outcome);
      recordProgress();
    } else {
      const a = flashcards.revealAnswer(),
          answers = usersettings.firstanswer ? a.answers.slice(0, 1) : a.answers,
          difficulty = a.difficulty;
      Render.answer(answers, difficulty);
    }
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
    document.getElementById(`card-${newIndex}`).children[0].focus();
  }

  function updateUserSettings (name, deckSettings) {
    let usersettings = JSON.parse(localStorage.getItem('usersettings'));
    usersettings[name] = deckSettings;
    localStorage.setItem('usersettings', JSON.stringify(usersettings));
  }
  
  function getUserSettings (name) {
    return JSON.parse(localStorage.getItem('usersettings'))[name];
  }
  
  function truncate (title) {
    let mobilemax = 15, //max title length on narrow screens (750px)
        allmax = 45, //max title length anywhere
        mobilewordmax = 11, //max length of any individual word on mobile
        allwordmax = 17, //max length of any individual word anywhere
        len = title.length,
        max = window.innerWidth > 350 ? allmax : mobilemax;

    //if whole title longer than any max, truncate
    if (len > max) {
      let rgx = new RegExp(`.{${len - max}}$`);
      title = title.replace(rgx, '...');
    }
    
    return title;
  }
  
  /**************************/
  /* METHODS FOR RENDERING  */
  /**************************/
  
  const Render = {
    
    // changes the header according to what area the user's in
    header: function (backlink, title, editing, name) {
      let shorttitle = truncate(title),
          context = {
            backlink: backlink,
            title: title,
            shorttitle: shorttitle,
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
        document.getElementById('nextButtons').classList.add('js-hidden');
      }
    },
    
    //renders the answer side of a card + reveals next button(s)
    answer: function (answers, diff, outcome) {
			outcome = outcome ? 'correct' : 'incorrect';
      const autocheck = arguments.length > 2;
      let context = {
        answers: answers,
        difficulty: diff,
        outcome: outcome,
        autocheck: autocheck
      };
      document.querySelector('.card__side--answer').innerHTML = answerTemplate(context);  
      //animate card flip
      document.querySelector('#maincard').classList.add('card--flip');
      //turn button to 'next' button(s)
      document.getElementById('checkAnswer').classList.add('js-hidden');
      document.getElementById('nextButtons').classList.remove('js-hidden');
      //freeze/disable input and focus on 'next' or 'correct' button
      document.querySelector('.answer__input').readOnly = true;
      if (autocheck) {
        document.getElementById('nextCard').focus();
      } else {
        document.getElementById('correctAnswer').focus();
      }
    },
    
    //renders updated user progress bar
    progress: function (sessionInfo, totalCards) {
      let bars = [],
          cardsAnswered = sessionInfo.correct + sessionInfo.incorrect,
          cardsRemaining = cardsToRetry.length ? cardsToRetry.length - cardsAnswered : totalCards - cardsAnswered,
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
			document.querySelector('.button--submit').classList.add('js-hidden');
      document.getElementById('nextButtons').classList.add('js-hidden');
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
    
    //renders editing interface with settings and any existing cards
    editing: function (cards, decklength, deckname, usersettings) {
      let mContext = {
        name: deckname,
        isSide2: usersettings.qSide === 'side2',
        firstanswer: usersettings.firstanswer,
        autocheck: usersettings.autocheck
      };
      document.querySelector(".main").innerHTML = addCardTemplate();
      for (let i = 0; i < decklength; i++) {
        let side1 = cards[i].side1.join(' / '),
            side2 = cards[i].side2.join(' / '),
            difficulty = cards[i].difficulty,
            index = i;
        Render.newCard(side1, side2, difficulty, index);
      }
      document.querySelector(".modal").innerHTML = modalTemplate(mContext);
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
    },
    
    //removes card from editing interface
    deleteCard: function (cardToDelete) {
      document.querySelector('.main').removeChild(cardToDelete);
    },
    
    //show/hide the settings modal
    modal: function () {
      document.querySelector(".modal").classList.toggle("modal--show");
    }
    
  };
  
  /**********************/
  /* ROUTER, BLAST OFF! */
  /**********************/
  
  Router(routes).init('/');

})();
