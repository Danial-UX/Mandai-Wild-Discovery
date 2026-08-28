// Mock animal library used when VITE_MOCK_MODE=true.
// Common names are chosen so the live GBIF map resolves a real distribution.
// Each entry carries age-specific facts + a canned chat answer.

export const MOCK_ANIMALS = [
  {
    id: 'clouded-leopard',
    species: 'Clouded Leopard',
    facts: {
      kids: [
        'Clouded leopards have the longest teeth compared to their body of any cat alive!',
        'They can climb down trees headfirst - their ankles rotate backwards like magic.',
        "Their spots are called 'clouds' because of their swirly, cloud-like shapes!",
      ],
      adult: [
        'Clouded leopards possess the longest canine teeth relative to skull size of any living felid.',
        'Highly arboreal, they can descend trees headfirst owing to uniquely rotating hind-limb ankles.',
        'Their cloud-shaped pelage markings provide effective camouflage in dappled Southeast Asian forest canopy.',
      ],
    },
    chat:
      'Clouded leopards have broad, padded paws that grip branches tightly - like built-in climbing shoes for a life in the trees.',
  },
  {
    id: 'orangutan',
    species: 'Bornean Orangutan',
    facts: {
      kids: [
        'Orangutans are super smart and use leaves as umbrellas when it rains!',
        'They build a brand-new cosy nest of branches to sleep in every single night.',
        "'Orangutan' means 'person of the forest' - they spend almost all their time in trees!",
      ],
      adult: [
        'Bornean orangutans are highly intelligent, exhibiting tool use and culturally transmitted behaviours.',
        'They construct a fresh arboreal sleeping nest nightly from folded branches and foliage.',
        'As the largest arboreal mammal, they are critically endangered, threatened chiefly by habitat loss.',
      ],
    },
    chat:
      'Orangutans are among the most intelligent primates - they use sticks to fish for insects and leaves as makeshift gloves and umbrellas.',
  },
  {
    id: 'asian-elephant',
    species: 'Asian Elephant',
    facts: {
      kids: [
        'An elephant can use its trunk like a hand to pick up something as tiny as a peanut!',
        'Baby elephants sometimes suck their trunks for comfort, just like kids suck their thumbs.',
        'Elephants say hello and comfort each other by touching trunks - a big friendly hug!',
      ],
      adult: [
        'The Asian elephant trunk contains roughly 40,000 muscles, enabling remarkable dexterity and strength.',
        'They are a keystone species, shaping forest structure through seed dispersal and foraging.',
        'Matriarch-led herds display complex social bonds, communication, and demonstrable long-term memory.',
      ],
    },
    chat:
      'An elephant trunk has around 40,000 muscles, so it can uproot a tree or delicately pluck a single blade of grass.',
  },
  {
    id: 'malayan-tapir',
    species: 'Malayan Tapir',
    facts: {
      kids: [
        'Baby tapirs are born with stripes and spots that make them look like watermelons!',
        'A tapir has a bendy little trunk-nose it uses to grab leaves and fruit.',
        'Tapirs love water and are excellent swimmers - they even walk along the riverbed!',
      ],
      adult: [
        'Malayan tapir calves display cryptic striped-and-spotted camouflage that fades within months.',
        'Its prehensile proboscis is used to grasp foliage and shoots while browsing.',
        'Semi-aquatic and largely nocturnal, tapirs are important seed dispersers in Southeast Asian forests.',
      ],
    },
    chat:
      'The tapir uses its short, flexible snout like a mini-trunk to grab leaves, and it will happily dive underwater to escape predators.',
  },
  {
    id: 'red-panda',
    species: 'Red Panda',
    facts: {
      kids: [
        'Red pandas wrap their big fluffy tails around themselves like a cosy blanket!',
        'They have a special wrist bone that works like a thumb for holding bamboo.',
        'Red pandas are mostly awake at dawn and dusk, napping in trees during the day.',
      ],
      adult: [
        'Red pandas possess a modified radial sesamoid - a "false thumb" - for manipulating bamboo.',
        'Primarily crepuscular and arboreal, they use their long bushy tail for balance and warmth.',
        'Despite the name, they are the sole living species of the family Ailuridae, not true pandas.',
      ],
    },
    chat:
      'The red panda has a "false thumb" - an extended wrist bone - that lets it grip bamboo stalks, and its bushy tail doubles as a blanket.',
  },
];

export const DEFAULT_MOCK_ID = MOCK_ANIMALS[0].id;

export function getMockAnimal(id) {
  return MOCK_ANIMALS.find((a) => a.id === id) || MOCK_ANIMALS[0];
}
