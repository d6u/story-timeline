import type { Example } from './types.js';

/**
 * Homer's Odyssey. The poem is public domain. Every text below is a fresh summary in English;
 * nothing is copied from a translation.
 *
 * The poem is told out of order, and the project shows it in two ways:
 * - `sortOrder` is story time. The wanderings (sortOrder 30 to 160) come before the Telemachy (200 on).
 * - The act of an event is the part of the poem that tells it at length. So the wanderings sit in
 *   the act `Books 9–12`, after the Telemachy, and the boar hunt of Odysseus's youth sits in
 *   `Books 17–20`. The web app's act mode shows the telling order; its time mode shows story time.
 * The event that tells a flashback has `flashback` (reveal) links to the events it tells.
 */
const B1 = 'Books 1–4 · Telemachus';
const B5 = 'Books 5–8 · Calypso and the Phaeacians';
const B9 = 'Books 9–12 · The tale in Alcinous’s hall';
const B13 = 'Books 13–16 · Home in disguise';
const B17 = 'Books 17–20 · The beggar in his own hall';
const B21 = 'Books 21–24 · The bow and the peace';
const G = 'homer-greek';
const E = 'butler-1900';

export const odyssey: Example = {
  file: 'odyssey.sqlite',
  acts: [
    { name: B1, span: 'Year 20 of the absence, days 1–6', description: 'Athena stirs Telemachus to call an assembly and sail for news of his father. Nestor and Menelaus tell him of the war and the returns. The suitors plot to kill him.' },
    { name: B5, span: 'Year 20, about days 7–33', description: 'Hermes frees Odysseus from Calypso. Poseidon wrecks his raft. He comes ashore on Scheria, where Nausicaa and her parents take him in.' },
    { name: B9, span: 'Told on one night of year 20; the events are years 10–13', description: 'Odysseus names himself and tells the Phaeacians of his wanderings. This is a flashback: in story time, every event here comes before Book 1.' },
    { name: B13, span: 'Year 20, about days 34–38', description: 'The Phaeacians leave Odysseus on Ithaca. Athena disguises him as a beggar. He stays with the swineherd and makes himself known to his son.' },
    { name: B17, span: 'Year 20, about days 38–39', description: 'The beggar is mocked in his own hall. Penelope questions him. The nurse knows him by his scar; the poem stops to tell how he got it.' },
    { name: B21, span: 'Year 20, about days 39–41', description: 'Odysseus strings the bow, kills the suitors, and is known by Penelope and Laertes. Athena ends the feud.' },
  ],
  places: [
    { key: 'ithaca', name: 'Ithaca', description: 'Odysseus’s island kingdom.' },
    { key: 'palace', name: 'Odysseus’s hall', parent: 'ithaca', description: 'The house where the suitors feast on Odysseus’s goods.' },
    { key: 'penelope-dream', name: 'Penelope’s dream', realm: 'dream', parent: 'palace', description: 'Where Penelope meets the phantom Athena sends her.' },
    { key: 'agora', name: 'Assembly place of Ithaca', parent: 'ithaca' },
    { key: 'phorcys', name: 'Harbour of Phorcys', parent: 'ithaca', description: 'A sheltered bay with an olive tree and the cave of the nymphs.' },
    { key: 'eumaeus-hut', name: 'Eumaeus’s farmstead', parent: 'ithaca', description: 'The swineherd’s hut and pig yards, far from town.' },
    { key: 'laertes-farm', name: 'Laertes’s farm', parent: 'ithaca', description: 'The orchard and vineyard where Odysseus’s old father lives.' },
    { key: 'olympus', name: 'Olympus', description: 'Home of the gods.' },
    { key: 'troy', name: 'Troy', description: 'The city the Greeks besieged for ten years.' },
    { key: 'mycenae', name: 'Mycenae', description: 'Agamemnon’s home.' },
    { key: 'pylos', name: 'Pylos', description: 'Nestor’s sandy kingdom.' },
    { key: 'sparta', name: 'Sparta', description: 'The palace of Menelaus and Helen.' },
    { key: 'ismarus', name: 'Ismarus', description: 'City of the Cicones, in Thrace.' },
    { key: 'lotus-land', name: 'Land of the Lotus-Eaters' },
    { key: 'cyclops-land', name: 'Land of the Cyclopes', description: 'The cave of Polyphemus is here.' },
    { key: 'aeolia', name: 'Aeolia', description: 'The floating island of Aeolus, walled with bronze.' },
    { key: 'telepylus', name: 'Telepylus', description: 'The harbour town of the Laestrygonians.' },
    { key: 'aeaea', name: 'Aeaea', description: 'Circe’s island.' },
    { key: 'underworld', name: 'The house of Hades', realm: 'spirit', description: 'The land of the dead. Odysseus calls up the ghosts at its edge, by the stream of Ocean.' },
    { key: 'sirens-isle', name: 'Island of the Sirens' },
    { key: 'strait', name: 'Strait of Scylla and Charybdis' },
    { key: 'thrinacia', name: 'Thrinacia', description: 'The island where the cattle of the Sun graze.' },
    { key: 'ogygia', name: 'Ogygia', description: 'Calypso’s island, far out at sea.' },
    { key: 'sea', name: 'The open sea' },
    { key: 'scheria', name: 'Scheria', description: 'Island of the Phaeacians, a people of ships.' },
    { key: 'river-mouth', name: 'Washing pools at the river mouth', parent: 'scheria' },
    { key: 'alcinous-hall', name: 'Hall of Alcinous', parent: 'scheria' },
    { key: 'parnassus', name: 'Mount Parnassus', description: 'Home ground of Autolycus, Odysseus’s grandfather.' },
  ],
  sources: [
    {
      key: G, title: 'Homer, Odyssey (Greek text)', lang: 'grc', location: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0135',
      note: 'Public domain. Refs are book numbers. Every text in this project is a fresh summary; none is taken from a translation.',
    },
    {
      key: E, title: 'Homer, The Odyssey, translated by Samuel Butler (1900)', lang: 'en', location: 'https://www.gutenberg.org/ebooks/1727',
      note: 'Public domain prose translation. Used to check names and the order of scenes. No text is copied.',
    },
  ],
  characters: [
    {
      key: 'odysseus', name: 'Odysseus', category: 'main', color: 'light-dark(oklch(0.5 0.14 250), oklch(0.72 0.12 250))', description: 'King of Ithaca, the man of many turns. He spends ten years at Troy and ten more coming home.',
      names: [
        { name: 'Ὀδυσσεύς', lang: 'grc' },
        { name: 'Ulysses', lang: 'la', note: 'Latin form' },
        { name: 'Nobody', lang: 'en', note: 'The name he gives Polyphemus (Greek Outis)' },
        { name: 'Aethon', lang: 'en', note: 'The false name he gives Penelope, a Cretan, brother of Idomeneus (Book 19)' },
      ],
      relations: [
        { to: 'laertes', relation: 'son', tone: 'family' },
        { to: 'anticlea', relation: 'son', tone: 'family' },
        { to: 'crew', relation: 'captain', tone: 'work', until: 'shipwreck' },
      ],
      stages: [
        { stage: 'Young hunter', time: 'Youth', since: 'boar-hunt', description: 'Wins his scar on Parnassus.' },
        { stage: 'Sacker of cities', time: 'Year 10', since: 'troy-falls', description: 'Takes Troy with the wooden horse and raids Ismarus.' },
        { stage: 'Boaster', since: 'cyclops-curse', description: 'Shouts his true name at the Cyclops and earns Poseidon’s anger.' },
        { stage: 'Survivor', since: 'shipwreck', description: 'Loses his last ship and every companion.' },
        { stage: 'Captive', time: 'Seven years', since: 'ogygia-arrival', description: 'Sits on Calypso’s shore and weeps for home.' },
        { stage: 'Nobody on the shore', since: 'storm', description: 'Lands on Scheria naked and alone.' },
        { stage: 'Teller of his tale', since: 'tale-told', description: 'Names himself and tells his story.' },
        { stage: 'Beggar in disguise', since: 'arrive-ithaca', description: 'Waits, tests, and hides his anger.' },
        { stage: 'Avenger', since: 'slaughter', description: 'Kills the suitors in his hall.' },
        { stage: 'Husband, son, and king', since: 'recognition', description: 'Is known again by wife and father; Athena makes peace.' },
      ],
    },
    {
      key: 'telemachus', name: 'Telemachus', category: 'main', color: 'oklch(0.6 0.14 160)', description: 'Son of Odysseus and Penelope. A baby when his father sailed; about twenty when the poem begins.',
      relations: [
        { to: 'odysseus', relation: 'son', tone: 'family' },
        { to: 'penelope', relation: 'son', tone: 'family' },
        { to: 'suitors', relation: 'enemy', tone: 'hostile', mutual: true, since: 'assembly' },
        { to: 'odysseus', relation: 'ally', tone: 'friend', mutual: true, since: 'father-and-son' },
      ],
      stages: [
        { stage: 'Boy among the suitors', description: 'Watches the suitors waste his house and does nothing.' },
        { stage: 'Speaks up', since: 'assembly', description: 'Calls the assembly and accuses the suitors.' },
        { stage: 'Traveller', since: 'pylos', description: 'Seeks news of his father from the old kings.' },
        { stage: 'His father’s son', since: 'father-and-son', description: 'Meets his father and plans with him.' },
        { stage: 'Fighter', since: 'slaughter', description: 'Fights beside his father in the hall.' },
      ],
    },
    {
      key: 'penelope', name: 'Penelope', category: 'main', color: 'oklch(0.58 0.15 20)', description: 'Wife of Odysseus. She holds off the suitors for years with patience and tricks.',
      relations: [{ to: 'odysseus', relation: 'wife', tone: 'love' }],
      stages: [
        { stage: 'Weaver', time: 'Three years', since: 'penelope-shroud', description: 'Weaves a shroud by day and unpicks it by night.' },
        { stage: 'Mother in fear', since: 'suitors-plot', description: 'Learns her son has sailed and that the suitors plan to kill him.' },
        { stage: 'Tester', since: 'penelope-interview', description: 'Questions the stranger and sets the contest of the bow.' },
        { stage: 'Reunited', since: 'recognition', description: 'Tests her husband with the secret of the bed, then takes him back.' },
      ],
    },
    {
      key: 'athena', name: 'Athena', category: 'main', color: 'oklch(0.65 0.13 80)', description: 'Goddess of wisdom and craft. She favours Odysseus and guides his son, often in disguise.',
      names: [
        { name: 'Pallas Athena', lang: 'en' },
        { name: 'Mentes', lang: 'en', note: 'Disguise in Book 1, a lord of the Taphians' },
        { name: 'Mentor', lang: 'en', note: 'Disguise in Books 2–3, 22 and 24, an old friend of Odysseus' },
      ],
      relations: [
        { to: 'odysseus', relation: 'protector', tone: 'friend' },
        { to: 'telemachus', relation: 'mentor', tone: 'work', since: 'athena-mentes' },
      ],
      stages: [
        { stage: 'Advocate', since: 'council', description: 'Pleads for Odysseus among the gods.' },
        { stage: 'Guide in disguise', since: 'athena-mentes', description: 'Moves father and son in the shapes of men.' },
        { stage: 'Peacemaker', since: 'peace', description: 'Stops the feud on Ithaca.' },
      ],
    },
    { key: 'zeus', name: 'Zeus', category: 'minor', description: 'King of the gods.', relations: [{ to: 'athena', relation: 'father', tone: 'family' }, { to: 'hermes', relation: 'father', tone: 'family' }, { to: 'poseidon', relation: 'brother', tone: 'family', mutual: true }] },
    {
      key: 'poseidon', name: 'Poseidon', category: 'minor', description: 'God of the sea and earthquakes. He hates Odysseus for blinding his son.',
      relations: [{ to: 'odysseus', relation: 'enemy', tone: 'hostile', since: 'cyclops-curse', until: 'arrive-ithaca' }],
    },
    { key: 'hermes', name: 'Hermes', category: 'minor', description: 'Messenger of the gods and guide of the dead.', relations: [{ to: 'odysseus', relation: 'helper', tone: 'friend', since: 'circe' }] },
    { key: 'helios', name: 'Helios', category: 'minor', description: 'The Sun, who sees everything. His cattle graze on Thrinacia.', relations: [{ to: 'crew', relation: 'avenger', tone: 'hostile', since: 'thrinacia' }] },
    { key: 'calypso', name: 'Calypso', category: 'minor', description: 'A nymph, daughter of Atlas. She keeps Odysseus for seven years and offers to make him immortal.', relations: [{ to: 'odysseus', relation: 'lover', tone: 'love', since: 'ogygia-arrival', until: 'raft' }] },
    { key: 'circe', name: 'Circe', category: 'minor', description: 'A goddess and witch who turns men into animals.', relations: [{ to: 'odysseus', relation: 'lover', tone: 'love', since: 'circe', until: 'return-aeaea' }] },
    {
      key: 'polyphemus', name: 'Polyphemus', category: 'minor', description: 'A one-eyed Cyclops, son of Poseidon. He eats six of Odysseus’s men.',
      names: [{ name: 'the Cyclops', lang: 'en' }],
      relations: [{ to: 'poseidon', relation: 'son', tone: 'family' }, { to: 'odysseus', relation: 'enemy', tone: 'hostile', since: 'cyclops' }],
    },
    { key: 'aeolus', name: 'Aeolus', category: 'minor', description: 'Keeper of the winds.' },
    { key: 'tiresias', name: 'Tiresias', category: 'minor', description: 'The blind prophet of Thebes. Among the dead he keeps his mind.', relations: [{ to: 'odysseus', relation: 'prophet', tone: 'other', since: 'underworld' }] },
    { key: 'anticlea', name: 'Anticlea', category: 'minor', description: 'Mother of Odysseus. She died of grief while he was away.' },
    { key: 'elpenor', name: 'Elpenor', category: 'minor', description: 'The youngest of the crew, not very brave or wise.', relations: [{ to: 'crew', relation: 'member', member: true }] },
    {
      key: 'eurylochus', name: 'Eurylochus', category: 'minor', description: 'Second in command on the ship, and a kinsman of Odysseus by marriage.',
      relations: [{ to: 'crew', relation: 'member', member: true }, { to: 'odysseus', relation: 'kinsman', tone: 'family' }],
    },
    { key: 'agamemnon', name: 'Agamemnon', category: 'minor', description: 'King of Mycenae and leader of the Greeks at Troy.', relations: [{ to: 'menelaus', relation: 'brother', tone: 'family', mutual: true }] },
    { key: 'aegisthus', name: 'Aegisthus', category: 'minor', description: 'Agamemnon’s cousin, who takes his wife and throne.', relations: [{ to: 'agamemnon', relation: 'murderer', tone: 'hostile', since: 'agamemnon-murdered' }] },
    { key: 'clytemnestra', name: 'Clytemnestra', category: 'minor', description: 'Agamemnon’s wife, who betrays him.', relations: [{ to: 'agamemnon', relation: 'wife', tone: 'love', until: 'agamemnon-murdered' }, { to: 'aegisthus', relation: 'lover', tone: 'love' }] },
    { key: 'orestes', name: 'Orestes', category: 'minor', description: 'Agamemnon’s son, held up to Telemachus as a model.', relations: [{ to: 'agamemnon', relation: 'son', tone: 'family' }, { to: 'aegisthus', relation: 'avenger', tone: 'hostile', since: 'agamemnon-murdered' }] },
    { key: 'nestor', name: 'Nestor', category: 'minor', description: 'The old king of Pylos.', relations: [{ to: 'odysseus', relation: 'comrade at Troy', tone: 'friend' }, { to: 'telemachus', relation: 'host', tone: 'friend', since: 'pylos' }] },
    { key: 'menelaus', name: 'Menelaus', category: 'minor', description: 'King of Sparta, home at last after eight years of wandering.', relations: [{ to: 'telemachus', relation: 'host', tone: 'friend', since: 'sparta' }] },
    { key: 'helen', name: 'Helen', category: 'minor', description: 'Wife of Menelaus, whose flight to Troy began the war.', relations: [{ to: 'menelaus', relation: 'wife', tone: 'love' }] },
    {
      key: 'nausicaa', name: 'Nausicaa', category: 'minor', description: 'Daughter of Alcinous. She finds Odysseus on the beach.',
      relations: [{ to: 'alcinous', relation: 'daughter', tone: 'family' }, { to: 'phaeacians', relation: 'member', member: true }, { to: 'odysseus', relation: 'helper', tone: 'friend', since: 'nausicaa' }],
    },
    { key: 'alcinous', name: 'Alcinous', category: 'minor', description: 'King of the Phaeacians.', relations: [{ to: 'phaeacians', relation: 'member', member: true }] },
    { key: 'arete', name: 'Arete', category: 'minor', description: 'Queen of the Phaeacians, wise and honoured.', relations: [{ to: 'alcinous', relation: 'wife', tone: 'love' }, { to: 'phaeacians', relation: 'member', member: true }] },
    { key: 'demodocus', name: 'Demodocus', category: 'minor', description: 'The blind bard of the Phaeacians.', relations: [{ to: 'phaeacians', relation: 'member', member: true }] },
    { key: 'eumaeus', name: 'Eumaeus', category: 'minor', description: 'Odysseus’s loyal swineherd, born a prince and sold as a slave.', relations: [{ to: 'odysseus', relation: 'swineherd', tone: 'work' }] },
    { key: 'philoetius', name: 'Philoetius', category: 'minor', description: 'Odysseus’s loyal cowherd.', relations: [{ to: 'odysseus', relation: 'cowherd', tone: 'work' }] },
    {
      key: 'eurycleia', name: 'Eurycleia', category: 'minor', description: 'Old nurse of Odysseus and of Telemachus.',
      names: [{ name: 'Euryclea', lang: 'en', note: 'Another spelling' }],
      relations: [{ to: 'odysseus', relation: 'nurse', tone: 'work' }, { to: 'telemachus', relation: 'nurse', tone: 'work' }],
    },
    { key: 'argos', name: 'Argos', category: 'minor', description: 'Odysseus’s hunting dog, now old and left on the dung heap.', relations: [{ to: 'odysseus', relation: 'hound', tone: 'friend' }] },
    {
      key: 'melanthius', name: 'Melanthius', category: 'minor', description: 'A goatherd who serves the suitors and abuses the beggar.',
      relations: [{ to: 'odysseus', relation: 'goatherd', tone: 'work' }, { to: 'odysseus', relation: 'abuser', tone: 'hostile', since: 'argos' }, { to: 'suitors', relation: 'ally', tone: 'friend' }],
    },
    { key: 'antinous', name: 'Antinous', category: 'minor', description: 'The boldest and cruelest of the suitors.', relations: [{ to: 'suitors', relation: 'member', member: true }] },
    { key: 'eurymachus', name: 'Eurymachus', category: 'minor', description: 'A smooth-tongued leader of the suitors.', relations: [{ to: 'suitors', relation: 'member', member: true }] },
    { key: 'laertes', name: 'Laertes', category: 'minor', description: 'Odysseus’s father, who lives in grief on his farm.' },
    { key: 'eupeithes', name: 'Eupeithes', category: 'minor', description: 'Father of Antinous. He leads the kin of the suitors against Odysseus.', relations: [{ to: 'antinous', relation: 'father', tone: 'family' }] },
    { key: 'scylla', name: 'Scylla', category: 'minor', description: 'A six-headed monster in a cliff cave above the strait.' },
    { key: 'crew', name: 'Odysseus’s companions', kind: 'group', category: 'faction', description: 'The men of Ithaca who sail home from Troy with Odysseus. None of them reaches home.' },
    { key: 'suitors', name: 'The suitors', kind: 'group', category: 'faction', description: 'More than a hundred young lords who court Penelope and feast in Odysseus’s hall.', relations: [{ to: 'penelope', relation: 'suitors', tone: 'other' }] },
    { key: 'phaeacians', name: 'The Phaeacians', kind: 'group', category: 'faction', description: 'Seafarers of Scheria, close to the gods.' },
    { key: 'sirens', name: 'The Sirens', kind: 'group', category: 'faction', description: 'Singers whose song draws sailors to their death.' },
    { key: 'cicones', name: 'The Cicones', kind: 'group', category: 'faction', description: 'Allies of Troy in Thrace.', relations: [{ to: 'crew', relation: 'enemy', tone: 'hostile', since: 'cicones' }] },
    { key: 'laestrygonians', name: 'The Laestrygonians', kind: 'group', category: 'faction', description: 'Cannibal giants.', relations: [{ to: 'crew', relation: 'enemy', tone: 'hostile', since: 'laestrygonians' }] },
  ],
  events: [
    // Books 1–4
    {
      key: 'troy-falls', title: 'Troy falls to the wooden horse', act: B1, sortOrder: 10, time: 'Year 10 of the absence', place: 'troy', core: true,
      description: 'The Greeks hide their best men in a wooden horse, and the Trojans take it into the city. Helen walks round it and calls the men inside in the voices of their wives; Odysseus holds them silent. That night the Greeks sack Troy.',
      cast: [['odysseus', 'body'], ['menelaus', 'body'], ['helen', 'body']],
      links: [{ to: 'cicones', relation: 'leads to', note: 'The fleet leaves Troy.' }],
      cite: [{ source: G, ref: 'Books 4 and 8' }, { source: E, ref: 'Books 4 and 8' }],
    },
    {
      key: 'agamemnon-murdered', title: 'Agamemnon is murdered at home', act: B1, sortOrder: 25, time: 'Year 10 or 11, soon after Troy', place: 'mycenae', confidence: 'likely',
      description: 'Agamemnon comes home from Troy. Aegisthus, who has taken his wife, kills him at a feast, with Clytemnestra’s help. In the eighth year Orestes comes back and kills Aegisthus, and he buries both him and his mother.',
      cast: [['agamemnon', 'body', 'dies'], ['aegisthus', 'body', 'dies'], ['clytemnestra', 'body', 'dies'], ['orestes', 'related']],
      links: [{ to: 'slaughter', relation: 'parallel', mutual: true, note: 'A son avenges the house his father lost; Telemachus helps his father kill the men who would take it.' }],
      cite: [{ source: G, ref: 'Books 1, 3, 4, 11 and 24' }],
    },
    {
      key: 'penelope-shroud', title: 'Penelope’s web', act: B1, sortOrder: 170, time: 'Years 17–20', place: 'palace',
      description: 'The suitors press Penelope to choose one of them. She says she will marry when she has woven a shroud for old Laertes. For three years she weaves by day and unpicks the work by night. In the fourth year a maid betrays her, and the suitors catch her at it.',
      cast: [['penelope', 'body'], ['suitors', 'body'], ['laertes', 'mentioned']],
      cite: [{ source: G, ref: 'Books 2, 19 and 24' }],
    },
    {
      key: 'council', title: 'The gods take counsel', act: B1, sortOrder: 200, time: 'Year 20, day 1', place: 'olympus', core: true,
      description: 'Poseidon is away among the Ethiopians. Zeus speaks of Aegisthus, who was warned and still did wrong. Athena pleads for Odysseus, kept on Ogygia while his house is ruined. Zeus says Poseidon is angry because Odysseus blinded his son, but agrees that Odysseus shall go home. Athena goes to Ithaca.',
      cast: [['zeus', 'body'], ['athena', 'body'], ['poseidon', 'mentioned'], ['odysseus', 'mentioned'], ['aegisthus', 'mentioned'], ['orestes', 'mentioned']],
      links: [
        { to: 'athena-mentes', relation: 'leads to' },
        { to: 'hermes-calypso', relation: 'leads to', note: 'The plan to send Hermes is carried out in Book 5.' },
        { to: 'agamemnon-murdered', relation: 'recalls' },
        { to: 'cyclops-curse', relation: 'explains', note: 'Zeus tells why Poseidon hates Odysseus.' },
      ],
      cite: [{ source: G, ref: 'Book 1' }, { source: E, ref: 'Book 1' }],
    },
    {
      key: 'athena-mentes', title: 'Athena visits Telemachus as Mentes', act: B1, sortOrder: 210, time: 'Year 20, day 1', place: 'palace', core: true,
      description: 'Athena comes to the hall in the shape of Mentes, an old guest-friend. Telemachus sits among the feasting suitors, dreaming of his father. She tells him to call an assembly and sail to Pylos and Sparta for news, and to think of Orestes. She leaves like a bird, and he knows a god was with him. That evening he tells his mother he is master in the house.',
      cast: [['athena', 'body'], ['telemachus', 'body'], ['suitors', 'body'], ['penelope', 'body'], ['odysseus', 'mentioned']],
      links: [{ to: 'assembly', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 1' }],
    },
    {
      key: 'assembly', title: 'The assembly, and a secret voyage', act: B1, sortOrder: 220, time: 'Year 20, day 2', place: 'agora',
      description: 'Telemachus calls the first assembly since his father left and accuses the suitors. Antinous blames Penelope and tells of her web. Two eagles fight over the crowd, and the old seer Halitherses says Odysseus is near. The suitors mock him. Athena, now as Mentor, finds a ship and crew. Telemachus tells only Eurycleia and sails that night.',
      cast: [['telemachus', 'body'], ['suitors', 'body'], ['antinous', 'body'], ['eurymachus', 'body'], ['athena', 'body'], ['eurycleia', 'body']],
      links: [
        { to: 'penelope-shroud', relation: 'reveals', note: 'Antinous tells of the trick.' },
        { to: 'pylos', relation: 'leads to' },
        { to: 'suitors-plot', relation: 'triggers', note: 'The suitors later learn the ship has gone.' },
      ],
      cite: [{ source: G, ref: 'Book 2' }],
    },
    {
      key: 'pylos', title: 'Nestor at Pylos', act: B1, sortOrder: 230, time: 'Year 20, day 3', place: 'pylos',
      description: 'Telemachus finds Nestor sacrificing on the shore. Nestor tells how the Greeks scattered after Troy, how Agamemnon died, and how Orestes took revenge. He has no news of Odysseus. Athena leaves in the form of a sea-eagle, and Nestor knows her. Nestor’s son Peisistratus drives Telemachus to Sparta.',
      cast: [['telemachus', 'body'], ['nestor', 'body'], ['athena', 'body'], ['odysseus', 'mentioned'], ['agamemnon', 'mentioned'], ['orestes', 'mentioned']],
      links: [
        { to: 'agamemnon-murdered', relation: 'reveals', note: 'Nestor holds up Orestes as a model for Telemachus.' },
        { to: 'sparta', relation: 'leads to' },
      ],
      cite: [{ source: G, ref: 'Book 3' }],
    },
    {
      key: 'sparta', title: 'Menelaus and Helen at Sparta', act: B1, sortOrder: 240, time: 'Year 20, days 5–6', place: 'sparta', core: true,
      description: 'Menelaus and Helen welcome Telemachus. Helen tells how Odysseus once slipped into Troy dressed as a beggar, and she alone knew him. Menelaus tells of the wooden horse. Next day he tells how, stranded in Egypt, he caught the sea-god Proteus, who said that Odysseus is alive, held by the nymph Calypso.',
      cast: [['telemachus', 'body'], ['menelaus', 'body'], ['helen', 'body'], ['odysseus', 'mentioned'], ['calypso', 'mentioned']],
      links: [
        { to: 'troy-falls', relation: 'reveals' },
        { to: 'ogygia-arrival', relation: 'reveals', note: 'Proteus’s news.' },
        { to: 'beggar-in-hall', relation: 'mirrors', mutual: true, note: 'Odysseus in beggar’s rags among his enemies, at Troy and again at home.' },
      ],
      cite: [{ source: G, ref: 'Book 4' }, { source: E, ref: 'Book 4' }],
    },
    {
      key: 'suitors-plot', title: 'The suitors plot an ambush', act: B1, sortOrder: 250, time: 'Year 20, day 6', place: 'palace',
      description: 'The suitors learn that Telemachus has really sailed. Antinous takes a ship to lie in wait for him in the strait by the island of Asteris. The herald Medon tells Penelope. She learns for the first time that her son is gone, and she prays to Athena.',
      cast: [['suitors', 'body'], ['antinous', 'body'], ['penelope', 'body'], ['eurycleia', 'body'], ['telemachus', 'mentioned']],
      links: [{ to: 'penelope-dream', relation: 'answered by', kind: 'cause', note: 'Athena hears her prayer.' }],
      cite: [{ source: G, ref: 'Book 4' }],
    },
    {
      key: 'penelope-dream', title: 'A phantom comforts Penelope', act: B1, sortOrder: 255, time: 'Year 20, night of day 6', place: 'penelope-dream',
      description: 'Athena sends a phantom in the shape of Penelope’s sister Iphthime. It tells her not to fear: her son has a guide the gods protect. It will not say whether Odysseus lives.',
      cast: [['penelope', 'mind'], ['athena', 'related'], ['telemachus', 'mentioned']],
      cite: [{ source: G, ref: 'Book 4' }],
    },
    // Books 5–8
    {
      key: 'ogygia-arrival', title: 'Washed up on Ogygia', act: B5, sortOrder: 160, time: 'About years 13–20 (seven years)', place: 'ogygia',
      description: 'Alone on the wreck, Odysseus drifts for nine days and reaches Ogygia on the tenth night. Calypso takes him in and keeps him as her husband for seven years. In the end he sits each day on the shore and weeps.',
      cast: [['odysseus', 'body'], ['calypso', 'body']],
      cite: [{ source: G, ref: 'Book 7; also Books 5 and 12' }],
    },
    {
      key: 'hermes-calypso', title: 'Hermes brings Zeus’s order to Calypso', act: B5, sortOrder: 300, time: 'Year 20, about day 7', place: 'ogygia', confidence: 'unsure',
      description: 'At a second council Zeus sends Hermes to Ogygia. Calypso protests that the gods begrudge goddesses their mortal lovers, but she obeys. She finds Odysseus weeping on the shore and tells him he may go.',
      cast: [['hermes', 'body'], ['calypso', 'body'], ['odysseus', 'body'], ['zeus', 'related']],
      links: [
        { to: 'raft', relation: 'leads to' },
        { to: 'sparta', relation: 'meanwhile', mutual: true, note: 'The poem tells these one after the other, but in story time they overlap. How exactly is debated.' },
      ],
      cite: [{ source: G, ref: 'Book 5' }],
    },
    {
      key: 'raft', title: 'Odysseus leaves on a raft', act: B5, sortOrder: 310, time: 'Year 20, about days 8–28', place: 'ogygia',
      description: 'Odysseus builds a raft in four days with Calypso’s tools. He refuses her offer to make him immortal and sails on the fifth day. He steers by the stars for seventeen days.',
      cast: [['odysseus', 'body'], ['calypso', 'body', 'leaves']],
      links: [{ to: 'storm', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 5' }],
    },
    {
      key: 'storm', title: 'Poseidon wrecks the raft', act: B5, sortOrder: 320, time: 'Year 20, about days 28–31', place: 'sea',
      description: 'On the eighteenth day Scheria is in sight. Poseidon, coming back from the Ethiopians, sees him and raises a storm. The sea-goddess Ino gives him a veil to keep him afloat. He swims for two days and nights and crawls ashore at a river mouth, where he sleeps under olive bushes.',
      cast: [['odysseus', 'body'], ['poseidon', 'body']],
      links: [{ to: 'nausicaa', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 5' }],
    },
    {
      key: 'nausicaa', title: 'Nausicaa at the washing pools', act: B5, sortOrder: 330, time: 'Year 20, about day 32', place: 'river-mouth', core: true,
      description: 'Athena, in a dream, tells Nausicaa to wash clothes at the river. Her maids’ ball game wakes Odysseus. He comes out naked, holding a branch, and pleads with her. She gives him clothes and tells him to throw himself on the mercy of her mother, the queen.',
      cast: [['nausicaa', 'body'], ['odysseus', 'body'], ['athena', 'related']],
      links: [{ to: 'phaeacian-court', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 6' }],
    },
    {
      key: 'phaeacian-court', title: 'At the Phaeacian court', act: B5, sortOrder: 340, time: 'Year 20, about days 32–33', place: 'alcinous-hall',
      description: 'Odysseus kneels before Queen Arete and is welcomed. He tells briefly of Calypso and the storm, but not his name. Next day there are games; when a young man taunts him, he throws the discus farther than all. Nausicaa bids him farewell. At the feast he asks the bard Demodocus to sing of the wooden horse, and he weeps. Alcinous asks who he is.',
      cast: [['odysseus', 'body'], ['alcinous', 'body'], ['arete', 'body'], ['demodocus', 'body'], ['phaeacians', 'body'], ['nausicaa', 'body', 'leaves']],
      links: [
        { to: 'troy-falls', relation: 'reveals', note: 'Demodocus sings the wooden horse at Odysseus’s request.' },
        { to: 'tale-told', relation: 'leads to', note: 'Alcinous sees him weep and asks his name.' },
      ],
      cite: [{ source: G, ref: 'Books 7–8' }, { source: E, ref: 'Books 7–8' }],
    },
    // Books 9–12: the flashback
    {
      key: 'tale-told', title: 'Odysseus names himself and tells his tale', act: B9, sortOrder: 350, time: 'Year 20, night of about day 33', place: 'alcinous-hall', core: true,
      description: '“I am Odysseus, son of Laertes.” Through the night he tells the Phaeacians of his wanderings, from Troy to Calypso’s island. Halfway through, Arete and Alcinous press him to go on. They promise him a ship home.',
      cast: [['odysseus', 'body'], ['alcinous', 'body'], ['arete', 'body'], ['phaeacians', 'body']],
      links: [
        { to: 'cicones', relation: 'flashback' },
        { to: 'lotus-eaters', relation: 'flashback' },
        { to: 'cyclops', relation: 'flashback' },
        { to: 'aeolus', relation: 'flashback' },
        { to: 'laestrygonians', relation: 'flashback' },
        { to: 'circe', relation: 'flashback' },
        { to: 'underworld', relation: 'flashback' },
        { to: 'sirens', relation: 'flashback' },
        { to: 'scylla', relation: 'flashback' },
        { to: 'thrinacia', relation: 'flashback' },
        { to: 'shipwreck', relation: 'flashback' },
        { to: 'arrive-ithaca', relation: 'leads to', note: 'The Phaeacians take him home.' },
      ],
      cite: [{ source: G, ref: 'Books 9–12' }, { source: E, ref: 'Books 9–12' }],
    },
    {
      key: 'cicones', title: 'The raid on the Cicones', act: B9, sortOrder: 30, time: 'Year 10, soon after Troy', place: 'ismarus',
      description: 'The fleet sacks Ismarus. Odysseus spares Maron, a priest of Apollo, who gives him a strong dark wine. The men stay to feast against his orders, and the Cicones strike back. Six men from each ship die.',
      cast: [['odysseus', 'body'], ['crew', 'body'], ['cicones', 'body']],
      links: [{ to: 'cyclops', relation: 'sets up', note: 'Maron’s wine later puts Polyphemus to sleep.' }],
      cite: [{ source: G, ref: 'Book 9' }],
    },
    {
      key: 'lotus-eaters', title: 'The Lotus-Eaters', act: B9, sortOrder: 40, time: 'Year 10', place: 'lotus-land',
      description: 'After a storm the ships reach the land of the Lotus-Eaters. The scouts eat the honey-sweet lotus and no longer want to go home. Odysseus drags them back weeping and ties them under the benches.',
      cast: [['odysseus', 'body'], ['crew', 'body']],
      cite: [{ source: G, ref: 'Book 9' }],
    },
    {
      key: 'cyclops', title: 'In the cave of the Cyclops', act: B9, sortOrder: 50, time: 'Year 10', place: 'cyclops-land', core: true,
      description: 'Odysseus and twelve men wait in a cave to see its owner. Polyphemus comes home, shuts the door with a huge stone, and eats two men at a time, six in all. Odysseus gives him Maron’s wine and says his name is Nobody. When the giant sleeps, they drive a burning stake into his eye. His neighbours ask who hurts him; “Nobody,” he cries, and they leave. The men escape tied under his rams.',
      cast: [['odysseus', 'body'], ['polyphemus', 'body'], ['crew', 'body']],
      links: [{ to: 'cyclops-curse', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 9' }, { source: E, ref: 'Book 9' }],
    },
    {
      key: 'cyclops-curse', title: 'Odysseus shouts his name; the Cyclops curses him', act: B9, sortOrder: 55, time: 'Year 10', place: 'cyclops-land', core: true,
      description: 'From the ship Odysseus shouts that it was Odysseus, son of Laertes, of Ithaca, who blinded him. Polyphemus remembers an old prophecy and prays to his father Poseidon: let Odysseus never reach home, or if he must, let him come late, alone, on a stranger’s ship, and find trouble in his house. Poseidon hears.',
      cast: [['odysseus', 'body'], ['polyphemus', 'body', 'leaves'], ['crew', 'body'], ['poseidon', 'related']],
      links: [
        { to: 'storm', relation: 'causes', note: 'Poseidon’s anger.' },
        { to: 'arrive-ithaca', relation: 'is fulfilled in', kind: 'setup', note: 'Late, alone, on a stranger’s ship, as the Cyclops prayed.' },
      ],
      cite: [{ source: G, ref: 'Book 9' }],
    },
    {
      key: 'aeolus', title: 'The bag of winds', act: B9, sortOrder: 60, time: 'Year 10 (a month on Aeolia)', place: 'aeolia',
      description: 'Aeolus hosts them for a month. He ties all the storm winds in an ox-hide bag and gives it to Odysseus, leaving only the west wind free to blow them home.',
      cast: [['odysseus', 'body'], ['aeolus', 'body'], ['crew', 'body']],
      links: [{ to: 'bag-opened', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 10' }],
    },
    {
      key: 'bag-opened', title: 'The bag is opened in sight of home', act: B9, sortOrder: 65, time: 'Year 10, the tenth day out', place: 'sea',
      description: 'On the tenth day they can see the fires of Ithaca. Odysseus, worn out from steering, falls asleep. The men think the bag holds gold and open it. The winds blow them back to Aeolia, and Aeolus sends them away as men the gods hate.',
      cast: [['odysseus', 'body'], ['crew', 'body'], ['aeolus', 'body']],
      cite: [{ source: G, ref: 'Book 10' }],
    },
    {
      key: 'laestrygonians', title: 'The Laestrygonians', act: B9, sortOrder: 70, time: 'Year 10', place: 'telepylus',
      description: 'In a closed harbour the giant Laestrygonians smash the ships with rocks and spear the men like fish. Only Odysseus’s ship, moored outside, gets away.',
      cast: [['odysseus', 'body'], ['crew', 'body'], ['laestrygonians', 'body']],
      cite: [{ source: G, ref: 'Book 10' }],
    },
    {
      key: 'circe', title: 'Circe', act: B9, sortOrder: 80, time: 'About years 10–11 (a year on Aeaea)', place: 'aeaea', core: true,
      description: 'Circe turns half the crew into pigs; Eurylochus escapes and brings the news. On the way to her house Hermes gives Odysseus the herb moly. Her drugs fail on him, he draws his sword, and she swears not to harm him. She frees the men, and they stay a year. When they leave, Circe tells him he must first visit the dead. Elpenor, asleep on the roof, falls and breaks his neck.',
      cast: [['odysseus', 'body'], ['circe', 'body'], ['hermes', 'body'], ['eurylochus', 'body'], ['crew', 'body'], ['elpenor', 'body', 'dies']],
      links: [{ to: 'underworld', relation: 'leads to', note: 'Circe sends him to ask Tiresias the way home.' }],
      cite: [{ source: G, ref: 'Book 10' }, { source: E, ref: 'Book 10' }],
    },
    {
      key: 'underworld', title: 'Among the dead', act: B9, sortOrder: 90, time: 'About year 11', place: 'underworld', core: true,
      description: 'At the edge of the world Odysseus pours blood into a pit, and the ghosts come. Elpenor begs to be buried. Tiresias foretells his journey: spare the cattle of the Sun; at home kill the suitors; then walk inland with an oar until someone calls it a winnowing fan. His mother Anticlea tells him she died of longing for him. Agamemnon tells how his wife and her lover killed him. Achilles says he would rather be a poor man’s labourer alive than king of the dead.',
      cast: [['odysseus', 'body'], ['tiresias', 'spirit'], ['anticlea', 'spirit'], ['elpenor', 'spirit'], ['agamemnon', 'spirit'], ['crew', 'body']],
      links: [
        { to: 'agamemnon-murdered', relation: 'reveals', note: 'Agamemnon’s ghost tells his own death.' },
        { to: 'thrinacia', relation: 'foreshadows', note: 'Tiresias’s warning about the cattle.' },
        { to: 'slaughter', relation: 'foreshadows', note: 'Tiresias foretells the suitors’ deaths.' },
      ],
      cite: [{ source: G, ref: 'Book 11' }, { source: E, ref: 'Book 11' }],
    },
    {
      key: 'return-aeaea', title: 'Back on Aeaea: burial and warnings', act: B9, sortOrder: 95, time: 'About year 11', place: 'aeaea',
      description: 'They return to bury Elpenor and set his oar on the mound. Circe warns Odysseus of the Sirens, of Scylla and Charybdis, and of the cattle on Thrinacia.',
      cast: [['odysseus', 'body'], ['circe', 'body', 'leaves'], ['crew', 'body'], ['elpenor', 'related']],
      links: [
        { to: 'sirens', relation: 'warns of', kind: 'setup', note: 'Wax for the men’s ears, and the mast.' },
        { to: 'scylla', relation: 'warns of', kind: 'setup', note: 'Better to lose six men to Scylla than all to Charybdis.' },
      ],
      cite: [{ source: G, ref: 'Book 12' }],
    },
    {
      key: 'sirens', title: 'The Sirens', act: B9, sortOrder: 100, time: 'About year 11', place: 'sirens-isle',
      description: 'Odysseus stops the men’s ears with wax and has himself tied to the mast. The Sirens sing that they know everything that happened at Troy. He begs to be untied, and the men bind him tighter until the ship is past.',
      cast: [['odysseus', 'body'], ['crew', 'body'], ['sirens', 'body']],
      cite: [{ source: G, ref: 'Book 12' }],
    },
    {
      key: 'scylla', title: 'Scylla and Charybdis', act: B9, sortOrder: 110, time: 'About year 11', place: 'strait',
      description: 'They keep clear of the whirlpool Charybdis. Scylla reaches down from her cave and snatches six men, who cry Odysseus’s name as she eats them.',
      cast: [['odysseus', 'body'], ['crew', 'body'], ['scylla', 'body']],
      cite: [{ source: G, ref: 'Book 12' }],
    },
    {
      key: 'thrinacia', title: 'The cattle of the Sun', act: B9, sortOrder: 120, time: 'About year 12 (a month on Thrinacia)', place: 'thrinacia', core: true,
      description: 'Eurylochus makes Odysseus land. Contrary winds hold them for a month, and the food runs out. The men swear not to touch the cattle. While Odysseus sleeps, Eurylochus talks them into killing the best of the herd. Helios demands revenge, and Zeus promises it.',
      cast: [['odysseus', 'body'], ['eurylochus', 'body'], ['crew', 'body'], ['helios', 'body'], ['zeus', 'body']],
      links: [{ to: 'shipwreck', relation: 'causes' }],
      cite: [{ source: G, ref: 'Book 12' }, { source: E, ref: 'Book 12' }],
    },
    {
      key: 'shipwreck', title: 'Zeus destroys the ship', act: B9, sortOrder: 130, time: 'About year 12', place: 'sea', core: true,
      description: 'When they put to sea, Zeus strikes the ship with a thunderbolt. Every man drowns. Odysseus lashes the mast to the keel, is carried back to Charybdis, and clings to a fig tree until the wreck comes up again.',
      cast: [['odysseus', 'body'], ['crew', 'body', 'dies'], ['eurylochus', 'body', 'dies'], ['zeus', 'body']],
      links: [{ to: 'ogygia-arrival', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 12' }],
    },
    // Books 13–16
    {
      key: 'arrive-ithaca', title: 'Asleep on his own shore', act: B13, sortOrder: 400, time: 'Year 20, about day 34', place: 'phorcys', core: true,
      description: 'The Phaeacians carry Odysseus home asleep and leave him on the beach with their gifts. Poseidon, with Zeus’s leave, turns their ship to stone as it comes home. Odysseus wakes and does not know his land. Athena, first as a young shepherd, then as herself, shows him Ithaca, helps him hide his treasure in the nymphs’ cave, and turns him into an old beggar.',
      cast: [['odysseus', 'body'], ['athena', 'body'], ['poseidon', 'body'], ['phaeacians', 'body', 'leaves']],
      links: [{ to: 'eumaeus', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 13' }, { source: E, ref: 'Book 13' }],
    },
    {
      key: 'eumaeus', title: 'The swineherd’s welcome', act: B13, sortOrder: 410, time: 'Year 20, about days 34–37', place: 'eumaeus-hut',
      description: 'Eumaeus saves the beggar from his dogs and feeds him, though he has little. He speaks with love of his lost master and with anger of the suitors. The beggar tells a long false tale of a Cretan life and swears Odysseus will come home. Eumaeus believes the Cretan, not the oath.',
      cast: [['odysseus', 'body'], ['eumaeus', 'body']],
      links: [{ to: 'father-and-son', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Books 14–15' }],
    },
    {
      key: 'father-and-son', title: 'Father and son', act: B13, sortOrder: 430, time: 'Year 20, about days 37–38', place: 'eumaeus-hut', core: true,
      description: 'Athena sends Telemachus home from Sparta. He slips past the ambush and goes first to the swineherd. When Eumaeus leaves for town, Athena restores Odysseus’s looks, and he tells his son who he is. They weep, then plan: Telemachus will go back to the hall, and his father will follow as a beggar.',
      cast: [['odysseus', 'body'], ['telemachus', 'body'], ['athena', 'body'], ['eumaeus', 'body']],
      links: [{ to: 'slaughter', relation: 'sets up', note: 'The plan to take the weapons out of the hall.' }],
      cite: [{ source: G, ref: 'Books 15–16' }, { source: E, ref: 'Book 16' }],
    },
    // Books 17–20
    {
      key: 'boar-hunt', title: 'The boar on Parnassus', act: B17, sortOrder: 5, time: 'Odysseus’s youth', place: 'parnassus', confidence: 'likely',
      description: 'As a young man Odysseus visits his grandfather Autolycus. On a hunt on Parnassus a wild boar gores him above the knee before he kills it. The wound heals into a long scar.',
      cast: [['odysseus', 'body']],
      cite: [{ source: G, ref: 'Book 19' }],
    },
    {
      key: 'argos', title: 'The old dog Argos', act: B17, sortOrder: 500, time: 'Year 20, about day 38', place: 'palace', core: true,
      description: 'Telemachus tells his mother what Menelaus heard of Odysseus. Later the beggar walks to town with Eumaeus; the goatherd Melanthius kicks him on the road. At the gate lies Argos, the dog Odysseus raised, old and full of fleas. He knows his master, wags his tail, and dies. Odysseus hides a tear.',
      cast: [['odysseus', 'body'], ['eumaeus', 'body'], ['melanthius', 'body'], ['argos', 'body', 'dies'], ['telemachus', 'body'], ['penelope', 'body']],
      cite: [{ source: G, ref: 'Book 17' }, { source: E, ref: 'Book 17' }],
    },
    {
      key: 'beggar-in-hall', title: 'The beggar among the suitors', act: B17, sortOrder: 510, time: 'Year 20, about day 38', place: 'palace',
      description: 'Odysseus begs from each suitor in turn. Antinous hits him with a footstool. The local beggar Irus picks a fight, and Odysseus breaks his jaw with one blow. Penelope comes down and draws gifts from the suitors. Eurymachus throws a stool at the beggar.',
      cast: [['odysseus', 'body'], ['suitors', 'body'], ['antinous', 'body'], ['eurymachus', 'body'], ['penelope', 'body'], ['telemachus', 'body']],
      cite: [{ source: G, ref: 'Books 17–18' }],
    },
    {
      key: 'penelope-interview', title: 'Penelope and the stranger', act: B17, sortOrder: 520, time: 'Year 20, night of about day 38', place: 'palace', core: true,
      description: 'Father and son take the weapons from the hall. At night Penelope talks with the beggar. He says he is Aethon of Crete and once hosted Odysseus, and he describes his clothes and brooch so well that she weeps. She tells him of her web and of a dream: an eagle kills her twenty geese and says he is her husband. He says the dream is true. She decides to set the contest of the bow.',
      cast: [['penelope', 'body'], ['odysseus', 'body'], ['telemachus', 'body']],
      links: [{ to: 'bow-contest', relation: 'leads to', note: 'She will marry the man who strings the bow and shoots through twelve axes.' }],
      cite: [{ source: G, ref: 'Book 19' }, { source: E, ref: 'Book 19' }],
    },
    {
      key: 'scar', title: 'The nurse finds the scar', act: B17, sortOrder: 525, time: 'Year 20, night of about day 38', place: 'palace', core: true,
      description: 'Eurycleia washes the beggar’s feet and feels the old scar. She drops his foot, and the basin spills. He grips her throat and makes her swear silence. Athena turns Penelope’s eyes away.',
      cast: [['eurycleia', 'body'], ['odysseus', 'body'], ['penelope', 'body'], ['athena', 'related']],
      links: [{ to: 'boar-hunt', relation: 'digression', kind: 'reveal', note: 'The poem stops to tell how he got the scar.' }],
      cite: [{ source: G, ref: 'Book 19' }],
    },
    // Books 21–24
    {
      key: 'bow-contest', title: 'The contest of the bow', act: B21, sortOrder: 600, time: 'Year 20, about day 39 (a feast of Apollo)', place: 'palace', core: true,
      description: 'Penelope brings out Odysseus’s great bow. Telemachus nearly strings it but stops at his father’s nod. The suitors fail one after another. Outside, Odysseus shows the scar to Eumaeus and Philoetius and gives them orders. Back inside, he strings the bow with ease, plucks the string, and shoots through all twelve axes.',
      cast: [['odysseus', 'body'], ['penelope', 'body'], ['telemachus', 'body'], ['suitors', 'body'], ['eumaeus', 'body'], ['philoetius', 'body'], ['eurycleia', 'body']],
      links: [{ to: 'slaughter', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 21' }, { source: E, ref: 'Book 21' }],
    },
    {
      key: 'slaughter', title: 'The killing of the suitors', act: B21, sortOrder: 610, time: 'Year 20, about day 39', place: 'palace', core: true,
      description: 'His first arrow takes Antinous in the throat. He names himself. Eurymachus blames Antinous and offers payment, and dies. Telemachus, Eumaeus and Philoetius fight beside him. Melanthius brings arms to the suitors and is caught. Athena, as Mentor and then as a swallow on the rafters, turns the fight. Every suitor dies. The bard and the herald are spared. The disloyal maids and Melanthius are put to death.',
      cast: [['odysseus', 'body'], ['telemachus', 'body'], ['eumaeus', 'body'], ['philoetius', 'body'], ['athena', 'body'], ['antinous', 'body', 'dies'], ['eurymachus', 'body', 'dies'], ['melanthius', 'body', 'dies'], ['suitors', 'body', 'dies']],
      links: [
        { to: 'suitors-in-hades', relation: 'leads to' },
        { to: 'peace', relation: 'causes', note: 'The kin of the suitors want revenge.' },
      ],
      cite: [{ source: G, ref: 'Book 22' }, { source: E, ref: 'Book 22' }],
    },
    {
      key: 'recognition', title: 'The secret of the bed', act: B21, sortOrder: 620, time: 'Year 20, night of about day 39', place: 'palace', core: true,
      description: 'Eurycleia wakes Penelope, but she will not believe. She tells the maid to move their bed out of the bedroom. Odysseus is angry: he built that bed himself on the trunk of a living olive tree. Only he could know. She runs to him. Athena holds back the dawn, and he tells her of Tiresias’s prophecy and of all his wanderings.',
      cast: [['penelope', 'body'], ['odysseus', 'body'], ['eurycleia', 'body'], ['telemachus', 'body'], ['athena', 'related']],
      links: [
        { to: 'laertes', relation: 'leads to' },
        { to: 'laertes', relation: 'the same kind of test', kind: 'echo', note: 'Each time he is known by a secret of the house: the bed, then the trees.' },
      ],
      cite: [{ source: G, ref: 'Book 23' }, { source: E, ref: 'Book 23' }],
    },
    {
      key: 'suitors-in-hades', title: 'The suitors’ ghosts come to Hades', act: B21, sortOrder: 630, time: 'Year 20, about day 40', place: 'underworld',
      description: 'Hermes leads the suitors’ ghosts down, squeaking like bats. One of them tells Agamemnon the whole story: the web, the bow, the killing. Agamemnon praises Penelope’s faithfulness and sets it against his own wife’s crime.',
      cast: [['hermes', 'body'], ['suitors', 'spirit'], ['agamemnon', 'spirit']],
      links: [
        { to: 'agamemnon-murdered', relation: 'contrasts with', note: 'Penelope against Clytemnestra.' },
        { to: 'penelope-shroud', relation: 'recalls' },
      ],
      cite: [{ source: G, ref: 'Book 24' }],
    },
    {
      key: 'laertes', title: 'Odysseus and his father', act: B21, sortOrder: 640, time: 'Year 20, about day 40', place: 'laertes-farm',
      description: 'Odysseus finds old Laertes digging in the orchard in rags. He tests him first with another false tale, and the old man’s grief breaks him. He shows the scar and names the trees his father gave him as a boy: thirteen pear trees, ten apple trees, forty fig trees. Laertes faints in his arms.',
      cast: [['odysseus', 'body'], ['laertes', 'body'], ['telemachus', 'body'], ['eumaeus', 'body'], ['philoetius', 'body']],
      links: [{ to: 'peace', relation: 'leads to' }],
      cite: [{ source: G, ref: 'Book 24' }],
    },
    {
      key: 'peace', title: 'Athena makes peace', act: B21, sortOrder: 650, time: 'Year 20, about day 40', place: 'laertes-farm', core: true,
      description: 'Eupeithes leads the suitors’ kin against Odysseus. Laertes, made strong by Athena, kills him with a spear. Zeus throws a thunderbolt, and Athena, as Mentor, orders both sides to stop and swear peace.',
      cast: [['athena', 'body'], ['odysseus', 'body'], ['telemachus', 'body'], ['laertes', 'body'], ['eupeithes', 'body', 'dies'], ['zeus', 'related']],
      cite: [{ source: G, ref: 'Book 24' }, { source: E, ref: 'Book 24' }],
    },
  ],
  learnings: [
    {
      key: 'held-by-calypso', text: 'Odysseus is alive, held by the nymph Calypso on her island.',
      knownBy: [
        { who: 'calypso', since: 'ogygia-arrival' },
        { who: 'athena' },
        { who: 'zeus' },
        { who: 'menelaus', time: 'On his way home from Troy', note: 'The sea-god Proteus told him in Egypt.' },
        { who: 'telemachus', since: 'sparta' },
        { who: 'penelope', since: 'argos', note: 'Telemachus tells her what Menelaus heard (Book 17).' },
      ],
    },
    {
      key: 'telemus-prophecy', text: 'A seer foretold that a man named Odysseus would take the Cyclops’s sight.',
      knownBy: [
        { who: 'polyphemus', time: 'Long before', note: 'The seer was Telemus. Polyphemus expected a tall, strong man.' },
        { who: 'odysseus', since: 'cyclops-curse' },
      ],
    },
    {
      key: 'name-is-nobody', text: 'The man in the cave is called Nobody.', kind: 'idea', description: 'A trick name.',
      knownBy: [{ who: 'polyphemus', since: 'cyclops', until: 'cyclops-curse' }],
    },
    {
      key: 'wish-for-home', text: 'We must sail home.', kind: 'idea', description: 'The lotus takes this wish away.',
      knownBy: [{ who: 'crew', until: 'lotus-eaters', note: 'Only the scouts who eat the lotus lose it. Odysseus ties them under the benches.' }],
    },
    {
      key: 'bag-holds-gold', text: 'Aeolus’s bag holds gold and silver.', kind: 'idea', description: 'It holds the winds.',
      knownBy: [{ who: 'crew', since: 'aeolus', until: 'bag-opened' }],
    },
    {
      key: 'tiresias-prophecy', text: 'Spare the cattle of the Sun, or come home late, alone, on a stranger’s ship, to men eating your house. Kill them; then carry an oar inland until someone calls it a winnowing fan.',
      knownBy: [
        { who: 'tiresias' },
        { who: 'odysseus', since: 'underworld' },
        { who: 'penelope', since: 'recognition', note: 'He tells her that night.' },
      ],
    },
    {
      key: 'mother-died', text: 'Anticlea, Odysseus’s mother, died of grief while she waited for him.',
      knownBy: [
        { who: 'laertes' },
        { who: 'eumaeus', note: 'He tells the beggar of it in Book 15.' },
        { who: 'odysseus', since: 'underworld' },
      ],
    },
    {
      key: 'cattle-forbidden', text: 'The cattle on Thrinacia belong to the Sun and must not be touched.',
      knownBy: [
        { who: 'odysseus', since: 'underworld', note: 'From Tiresias, and again from Circe.' },
        { who: 'eurylochus', since: 'thrinacia' },
        { who: 'crew', since: 'thrinacia', note: 'They swear an oath and then break it.' },
      ],
    },
    {
      key: 'gods-quarrel', text: 'Helios threatened to shine among the dead unless he was avenged, and Zeus promised to strike the ship.', description: 'A talk among the gods that no man heard.',
      knownBy: [
        { who: 'helios', since: 'thrinacia' },
        { who: 'zeus', since: 'thrinacia' },
        { who: 'odysseus', since: 'ogygia-arrival', note: 'He says Calypso told him, and she heard it from Hermes (Book 12).' },
      ],
    },
    {
      key: 'guest-was-a-god', text: 'The guest who came as a man was a god.', kind: 'realization',
      knownBy: [
        { who: 'telemachus', since: 'athena-mentes' },
        { who: 'nestor', since: 'pylos', note: 'He knows Athena when she leaves as a bird.' },
      ],
    },
    {
      key: 'telemachus-sailed', text: 'Telemachus has sailed in secret to seek news of his father.',
      knownBy: [
        { who: 'athena', since: 'assembly' },
        { who: 'eurycleia', since: 'assembly', note: 'Sworn to keep it from Penelope for eleven or twelve days.' },
        { who: 'suitors', since: 'suitors-plot' },
        { who: 'penelope', since: 'suitors-plot', note: 'The herald Medon tells her.' },
      ],
    },
    {
      key: 'son-is-guarded', text: 'Telemachus has a divine guide, and he will come home.',
      knownBy: [{ who: 'penelope', since: 'penelope-dream' }],
    },
    {
      key: 'phaeacians-know', text: 'The weeping guest is Odysseus, son of Laertes.',
      knownBy: [
        { who: 'alcinous', since: 'tale-told' },
        { who: 'arete', since: 'tale-told' },
        { who: 'phaeacians', since: 'tale-told' },
      ],
    },
    {
      key: 'beggar-is-odysseus', text: 'The old beggar is Odysseus.', description: 'The order in which people learn it is the plot of Books 13–24.',
      knownBy: [
        { who: 'athena', since: 'arrive-ithaca' },
        { who: 'telemachus', since: 'father-and-son' },
        { who: 'argos', since: 'argos' },
        { who: 'eurycleia', since: 'scar' },
        { who: 'eumaeus', since: 'bow-contest' },
        { who: 'philoetius', since: 'bow-contest' },
        { who: 'suitors', since: 'slaughter' },
        { who: 'penelope', since: 'recognition', note: 'Only after the test of the bed.' },
        { who: 'laertes', since: 'laertes' },
      ],
    },
    {
      key: 'cretan-stranger', text: 'The stranger is a wanderer from Crete with news of Odysseus.', kind: 'idea', description: 'A story Odysseus makes up.',
      knownBy: [
        { who: 'eumaeus', since: 'eumaeus', until: 'bow-contest' },
        { who: 'penelope', since: 'penelope-interview', until: 'recognition' },
      ],
    },
    {
      key: 'kill-the-suitors', text: 'Kill the suitors in the hall.', kind: 'idea',
      knownBy: [
        { who: 'odysseus', since: 'father-and-son', until: 'slaughter' },
        { who: 'telemachus', since: 'father-and-son', until: 'slaughter' },
      ],
    },
    {
      key: 'olive-bed', text: 'The marriage bed is built on the trunk of a living olive tree and cannot be moved.',
      knownBy: [
        { who: 'odysseus', note: 'He built it.' },
        { who: 'penelope', note: 'Only the two of them and one maid, Actoris, have seen it.' },
      ],
    },
  ],
};
