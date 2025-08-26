const prompts = {
  "difficulty": {
    "easy": [
      "cat", "dog", "house", "tree", "car", "fish", "bird", "sun", "moon", "star",
      "flower", "apple", "banana", "heart", "smile", "eye", "hand", "shoe", "hat",
      "key", "door", "window", "book", "clock", "cake", "pizza"
    ],
    "medium": [
      "ice cream", "robot", "dinosaur", "butterfly", "rainbow", "mountain", "ocean",
      "castle", "rocket", "airplane", "bicycle", "guitar", "piano", "camera", "phone",
      "computer", "pencil", "umbrella", "crown", "bridge", "lighthouse", "snowman",
      "campfire", "tent", "balloon", "kite", "boat", "train", "bus", "truck"
    ],
    "hard": [
      "centaur", "minotaur", "sphinx", "pegasus", "griffin", "kraken", "hydra",
      "banshee", "gargoyle", "phoenix", "bigfoot", "yeti", "mothman"
    ]
  },
  "categories": {
    "animals": {
      "pets": ["cat", "dog", "rabbit", "bird", "fish"],
      "farm": ["cow", "pig", "sheep", "horse", "chicken"],
      "wild": ["elephant", "lion", "tiger", "bear", "wolf", "fox", "deer"],
      "african": ["elephant", "lion", "giraffe", "zebra", "rhino", "hippo"],
      "ocean": ["whale", "shark", "octopus", "jellyfish", "starfish", "crab", "lobster", "seahorse", "turtle"],
      "birds": ["eagle", "owl", "parrot", "penguin", "flamingo", "peacock", "toucan"],
      "small": ["squirrel", "hedgehog", "spider", "bee", "ladybug", "frog", "snake"],
      "exotic": ["panda", "koala", "monkey", "gorilla", "kangaroo", "sloth"],
      "reptiles": ["lizard", "crocodile", "alligator", "turtle", "snake"]
    },
    "food": [
      "apple", "banana", "pizza", "cake", "ice cream"
    ],
    "objects": {
      "household": ["house", "door", "window", "clock", "key", "umbrella", "book"],
      "clothing": ["shoe", "hat", "crown"],
      "technology": ["phone", "computer", "camera", "robot"],
      "music": ["guitar", "piano"],
      "tools": ["pencil"]
    },
    "transportation": [
      "car", "airplane", "bicycle", "boat", "train", "bus", "truck", "rocket"
    ],
    "nature": [
      "tree", "flower", "sun", "moon", "star", "mountain", "ocean", "rainbow"
    ],
    "fantasy": {
      "creatures": ["dragon", "unicorn", "phoenix", "mermaid", "fairy", "angel"],
      "monsters": ["ghost", "vampire", "zombie", "alien", "monster", "demon"],
      "mythical": ["centaur", "minotaur", "sphinx", "pegasus", "griffin", "kraken", "hydra", "banshee", "gargoyle"],
      "cryptids": ["bigfoot", "yeti", "mothman"],
      "beings": ["witch", "wizard", "genie", "mummy", "skeleton", "reaper", "devil"],
      "races": ["giant", "dwarf", "elf", "goblin", "troll", "ogre"]
    },
    "people": {
      "royalty": ["princess", "king", "queen", "knight"],
      "professions": ["chef", "doctor", "teacher", "firefighter", "police", "astronaut", "farmer", "artist", "musician", "dancer", "athlete", "magician"],
      "characters": ["pirate", "ninja", "superhero", "villain", "clown"]
    },
    "body": ["heart", "smile", "eye", "hand"],
    "structures": ["house", "castle", "bridge", "lighthouse", "tent"],
    "activities": ["campfire", "snowman"],
    "toys": ["balloon", "kite"]
  },
  "themes": {
    "halloween": ["ghost", "witch", "vampire", "zombie", "mummy", "skeleton", "reaper"],
    "christmas": ["snowman", "tree", "angel"],
    "space": ["rocket", "alien", "moon", "star", "astronaut"],
    "underwater": ["whale", "shark", "octopus", "jellyfish", "starfish", "crab", "lobster", "seahorse", "mermaid"],
    "medieval": ["castle", "knight", "princess", "king", "queen", "dragon", "wizard"],
    "scary": ["monster", "demon", "devil", "ghost", "vampire", "zombie", "skeleton", "reaper"],
    "cute": ["cat", "dog", "rabbit", "panda", "koala", "fairy", "unicorn"]
  }
}

// Broad, open-ended concept prompts for QuickDraw (encourage scene interpretation)
prompts.quickdrawConcepts = [
  'love','winter','sports','celebration','speed','music','chaos','friendship','technology',
  'nature','adventure','dreams','festival','storm','silence','growth','time','journey',
  'memory','rebellion','world','desert oasis','future','haunted house',
  'space colony','ancient ruins','marketplace','invention','island', 'escape', 'teamwork',
  'mystery','balance','reflection','flight','gravity','ocean', 'forest spirits'
];

// Additional phrase-based prompt system for Guessing Game mode.
// Each template may include the tokens (noun) and (adj) which will be
// replaced at runtime with a random noun or adjective from the lists below.
// Only the substituted (noun)/(adj) words are scored for players' guesses.
prompts.phrases = {
  templates: [
  '(noun) jumping over a (adj) (noun)',
  '(adj) (noun) riding a (noun)',
  '(adj) (noun) eating a (noun)',
  '(noun) wearing a (adj) (noun)',
  '(noun) chasing a (adj) (noun)',
  '(adj) (noun) playing with a (noun)',
  '(adj) (noun) next to a (noun)',
  '(adj) (noun) balancing on a (noun)',
  '(adj) (noun) painting a (noun)',
  '(adj) (noun) cooking a (noun)'
  ],
  // Basic word pools. These intentionally overlap with existing categories
  // but are kept simple for template filling.
  nouns: [
    'wizard','dragon','unicorn','goblin','robot','pirate','ninja','astronaut','cat','dog','bird','fish','crab','turtle','bear','lion','tiger','ghost','vampire','zombie','skeleton','camera','robot','pencil','castle','bridge','rocket','pizza','cake','apple','banana','mermaid','giant','dwarf','elf','troll','ogre','witch','king','queen','princess','knight','monster','chef','doctor','teacher','artist','musician','dancer','athlete','genie','mummy','reaper','alien'
  ],
  adjectives: [
    'old','young','happy','sad','angry','sleepy','tiny','huge','giant','fuzzy','slimy','spooky','shiny','rusty','colorful','striped','spotted','fierce','brave','sneaky','lazy','crazy','wild','magic','smart','silly','noisy','quiet','friendly','grumpy'
  ]
};

export default prompts;