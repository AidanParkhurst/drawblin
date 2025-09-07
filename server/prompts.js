// Context-aware prompt system for Guessing Game and QuickDraw
// - quickdrawConcepts: used by QuickDraw
// - phraseTemplates: templates with typed placeholders like (character), (ridable), (weapon)
// - adjectives: generic adjectives used by (adj)
// - lexicon: word bank with tags to enable contextual filling
const prompts = {
  // Broad, open-ended concept prompts for QuickDraw (encourage scene interpretation)
  quickdrawConcepts: [
    'love','winter','sports','celebration','speed','music','chaos','friendship','technology',
    'nature','adventure','dreams','festival','storm','silence','growth','time','journey',
    'memory','rebellion','world','desert oasis','future','haunted house',
    'space colony','ancient ruins','marketplace','invention','island','escape','teamwork',
    'mystery','balance','reflection','flight','gravity','ocean','forest spirits'
  ],

  // Phrase templates for Guessing Game. Placeholders:
  // - (adj) simple adjective
  // - (noun) any lexicon entry
  // - (tag) entry with that tag (e.g., (ridable), (character), (vehicle), (food))
  // - OR use (tag1|tag2) and/or (tag1+tag2) for OR/AND tag filters
  phraseTemplates: [
    '(character) riding a (ridable)',
    '(adj) (creature) fighting a (monster)',
    '(animal) driving a (vehicle)',
    '(person) wearing a (wearable)',
    '(person) juggling (object)',
    '(person) balancing on a (ridable)',
    '(person) hiding in a (place)',
    '(person) using a (tool) to fix a (object)',
    '(person) building a (structure) with a (tool)',
    '(person) cooking (food) in a (cookware)',
    '(person) painting a (object)',
    '(person) carrying (food) on a (ridable)',
    '(person) eating (food) with a (utensil)',
    '(animal) playing a (instrument)',
    '(person) saving a (person)',
    '(person) stuck in a (container)',
    '(creature) breathing (element) at a (structure)',
    'a stack of (object) on a (object)',
    'a (adj) (object) bouncing on a (object)',
    '(vehicle) parked next to a (structure)',
    '(adj) (vehicle) flying over a (place)',
    '(person) repairing a (vehicle) with a (tool)',
    '(person) climbing a (structure)',
    '(animal) wearing a (wearable)',
    '(person) unlocking a (container) with a (tool)',
    '(person) drawing a (object) with a (tool)',
    '(person) washing a (object) in a (container)',
    '(character) casting a spell on a (object)'
  ],

  adjectives: [
    'ancient','tiny','huge','gigantic','mini','fluffy','spiky','slimy','shiny','rusty','colorful',
    'striped','spotted','brave','sneaky','sleepy','grumpy','hungry','noisy','quiet','broken',
    'invisible','glowing','golden','wooden','metal','plastic','fuzzy','happy','sad','angry'
  ],

  // Rich word bank with tags for contextual selection
  // Add lots of specific and inanimate objects as requested
  lexicon: [
    // People and roles
    { word: 'Einstein', tags: ['person','famous'] },
    { word: 'Cleopatra', tags: ['person','famous'] },
    { word: 'Shakespeare', tags: ['person','famous','writer'] },
    { word: 'astronaut', tags: ['person','profession','character'] },
    { word: 'pirate', tags: ['person','character'] },
    { word: 'ninja', tags: ['person','character'] },
    { word: 'superhero', tags: ['person','character'] },
    { word: 'villain', tags: ['person','character'] },
    { word: 'chef', tags: ['person','profession','chef'] },
    { word: 'doctor', tags: ['person','profession'] },
    { word: 'teacher', tags: ['person','profession'] },
    { word: 'artist', tags: ['person','profession'] },
    { word: 'musician', tags: ['person','profession','musician'] },
    { word: 'farmer', tags: ['person','profession','farmer'] },
    { word: 'dancer', tags: ['person','profession'] },
    { word: 'athlete', tags: ['person','profession'] },
    { word: 'cowboy', tags: ['person','character'] },
    { word: 'detective', tags: ['person','profession','detective'] },
    { word: 'baby', tags: ['person'] },

    // Creatures and fantasy
    { word: 'wizard', tags: ['character','creature','mythical'] },
    { word: 'witch', tags: ['character','creature','mythical'] },
    { word: 'dragon', tags: ['creature','monster','mythical','ridable'] },
    { word: 'unicorn', tags: ['creature','mythical','ridable'] },
    { word: 'mermaid', tags: ['creature','mythical'] },
    { word: 'ghost', tags: ['creature','monster'] },
    { word: 'zombie', tags: ['creature','monster'] },
    { word: 'vampire', tags: ['creature','monster'] },
    { word: 'goblin', tags: ['creature','monster'] },
    { word: 'troll', tags: ['creature','monster'] },
    { word: 'ogre', tags: ['creature','monster'] },
    { word: 'giant', tags: ['creature','mythical'] },
    { word: 'phoenix', tags: ['creature','mythical','bird'] },
    { word: 'yeti', tags: ['creature','cryptid'] },
    { word: 'bigfoot', tags: ['creature','cryptid'] },

    // Animals
    { word: 'cat', tags: ['animal','pet'] },
    { word: 'dog', tags: ['animal','pet'] },
    { word: 'horse', tags: ['animal','ridable'] },
    { word: 'camel', tags: ['animal','ridable'] },
    { word: 'elephant', tags: ['animal','ridable'] },
    { word: 'lion', tags: ['animal'] },
    { word: 'tiger', tags: ['animal'] },
    { word: 'bear', tags: ['animal'] },
    { word: 'eagle', tags: ['animal','bird'] },
    { word: 'penguin', tags: ['animal','bird'] },
    { word: 'octopus', tags: ['animal'] },
    { word: 'whale', tags: ['animal','ridable'] },
    { word: 'shark', tags: ['animal'] },

    // Vehicles / ridables
    { word: 'bicycle', tags: ['vehicle','ridable'] },
    { word: 'motorcycle', tags: ['vehicle','ridable'] },
    { word: 'scooter', tags: ['vehicle','ridable'] },
    { word: 'skateboard', tags: ['vehicle','ridable'] },
    { word: 'car', tags: ['vehicle','ridable'] },
    { word: 'bus', tags: ['vehicle','ridable'] },
    { word: 'train', tags: ['vehicle','ridable'] },
    { word: 'boat', tags: ['vehicle','ridable'] },
    { word: 'airplane', tags: ['vehicle','ridable'] },
    { word: 'rocket', tags: ['vehicle','ridable','space'] },
    { word: 'hoverboard', tags: ['vehicle','ridable'] },

    // Food and kitchen
    { word: 'pizza', tags: ['food','edible'] },
    { word: 'cake', tags: ['food','edible','dessert'] },
    { word: 'apple', tags: ['food','edible','fruit'] },
    { word: 'banana', tags: ['food','edible','fruit'] },
    { word: 'corn', tags: ['food','edible','plant'] },
    { word: 'ice cream', tags: ['food','edible','dessert'] },
    { word: 'pan', tags: ['cookware'] },
    { word: 'pot', tags: ['cookware'] },
    { word: 'spoon', tags: ['tool','utensil'] },
    { word: 'fork', tags: ['tool','utensil'] },

    // Objects / tools / instruments
    { word: 'musket', tags: ['weapon','object'] },
    { word: 'orchestra', tags: ['group','music'] },
    { word: 'guitar', tags: ['instrument','music','object'] },
    { word: 'piano', tags: ['instrument','music','object'] },
    { word: 'violin', tags: ['instrument','music','object'] },
    { word: 'drum', tags: ['instrument','music','object'] },
    { word: 'microphone', tags: ['object','music','tool'] },
    { word: 'camera', tags: ['object','technology'] },
    { word: 'computer', tags: ['object','technology'] },
    { word: 'phone', tags: ['object','technology'] },
    { word: 'pencil', tags: ['object','tool'] },
    { word: 'paintbrush', tags: ['object','tool'] },
    { word: 'magnifying glass', tags: ['object','tool','clue'] },
    { word: 'map', tags: ['object','clue'] },
    { word: 'key', tags: ['object','tool'] },
    { word: 'lock', tags: ['object'] },
    { word: 'book', tags: ['object'] },
    { word: 'lantern', tags: ['object','tool','light'] },
    { word: 'sword', tags: ['weapon','object'] },
    { word: 'shield', tags: ['object','armor'] },
    { word: 'bow', tags: ['weapon','object'] },
    { word: 'hammer', tags: ['object','tool'] },
    { word: 'anvil', tags: ['object'] },
    { word: 'stapler', tags: ['object','tool'] },
    { word: 'microwave', tags: ['object','appliance'] },
    { word: 'bookshelf', tags: ['object','furniture'] },
    { word: 'vacuum', tags: ['object','appliance','tool'] },
    { word: 'helmet', tags: ['wearable','object'] },
    { word: 'crown', tags: ['wearable','object'] },
    { word: 'hat', tags: ['wearable','object'] },
    { word: 'shoes', tags: ['wearable','object'] },
    { word: 'backpack', tags: ['wearable','container'] },
    { word: 'box', tags: ['container','object'] },
    { word: 'jar', tags: ['container','object'] },
    { word: 'bucket', tags: ['container','object'] },

    // Places / structures / materials / elements
    { word: 'castle', tags: ['structure','place'] },
    { word: 'bridge', tags: ['structure','place'] },
    { word: 'lighthouse', tags: ['structure','place'] },
    { word: 'house', tags: ['structure','place'] },
    { word: 'forest', tags: ['place','nature'] },
    { word: 'ocean', tags: ['place','nature'] },
    { word: 'desert', tags: ['place','nature'] },
    { word: 'volcano', tags: ['place','nature'] },
    { word: 'cloud', tags: ['place','nature','ridable'] },
    { word: 'comet', tags: ['space','object','ridable'] },
    { word: 'fire', tags: ['element'] },
    { word: 'ice', tags: ['element','material'] },
    { word: 'stone', tags: ['material'] },
    { word: 'wood', tags: ['material'] },
    { word: 'metal', tags: ['material'] },

    // Body parts and misc
    { word: 'hair', tags: ['body_part'] },
  ]
};

export default prompts;