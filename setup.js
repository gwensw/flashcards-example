//create sample decks with some cards (if not already in localstorage)
  
flashcards.openDeck('100');
if (!flashcards.deckLength()) {
  flashcards.setDisplayName('food');
  flashcards.addCards(
    ['milk', 'llaeth'],
    ['bread', 'bara'],
    ['soup', 'cawl'],
    ['butter', 'menyn'],
    ['cheese', 'caws'],
    ['tasty', 'blasus'],
    ['healthy', 'iachus'],
    ['chocolate', 'siocled'],
    ['carrots', 'moron'],
    ['beans', 'ffa'],
    ['toast', 'tost'],
    ['tomatoes', 'tomatos'],
    ['salt', 'halen'],
    ['salty', 'hallt'],
    ['pepper', ['pubr', 'pubur']],
    ['coffee', 'coffi']);
}

flashcards.openDeck('200');
if (!flashcards.deckLength()) {
  flashcards.setDisplayName('adjectives');
  flashcards.addCards(
    ['thin', 'tenau'],
    ['funny', 'doniol'],
    ['tall', 'tal'],
    ['angry', ['crac', 'dig']],
    ['fat', 'tew'],
    ['slow', 'araf'],
    ['fast', 'cyflym'],
    ['generous', 'hael'],
    ['kind', 'caredig'],
    ['successful', 'llwyddiannus'],
    ['interesting', 'diddorol'],
    ['honest', 'gonest'],
    ['lively', 'bywiog'],
    ['lonely', 'unig']);
}