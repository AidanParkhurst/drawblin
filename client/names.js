// Simple "goblinny" name generator
// Exported function returns a fun, pronounceable goblin-style name

const ADJECTIVES = [
  'Grubby', 'Mossy', 'Warty', 'Dank', 'Feral', 'Sooty', 'Gunky', 'Gnarled',
  'Nimble', 'Sly', 'Snaggle', 'Boggy', 'Stinky', 'Dribbly', 'Scrappy', 'Raggy',
  'Rusty', 'Clumpy', 'Snaggy', 'Gloomy', 'Scree', 'Gritty', 'Mucky', 'Scabby'
];

const NOUNS = [
  'Snout', 'Mittens', 'Gob', 'Grin', 'Gizzard', 'Toes', 'Fang', 'Wart',
  'Mop', 'Claw', 'Sprocket', 'Twig', 'Muck', 'Smudge', 'Nose', 'Puddle',
  'Nubbins', 'Scuttle', 'Snag', 'Gloop', 'Cricket', 'Sprout', 'Rumble', 'Boggle'
];

const SUFFIXES = [' of the Bog', ' the Squishy', ' the Damp', '', '', '', ''];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateGoblinName() {
  const base = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  const suffix = pick(SUFFIXES);
  return `${base}${suffix}`.trim();
}

export default generateGoblinName;
