/* Liste canonique des lieux de la Citadelle Chrysaldus.
   Source : la liste du MJ (onglet « Rooms by the hour » + dortoirs).
   Utilisee par le serveur ET par le cockpit : c'est le seul endroit a modifier
   pour ajouter, renommer ou retirer une salle. L'ordre ci-dessous est l'ordre
   d'affichage (menu deroulant et tableau « Lieux occupes »).

   DEUX NOMS PAR SALLE :
     id    = le nom MJ, inchange. Le cockpit, data.js, timeline.json et les
             generateurs Python continuent de s'en servir. Ne pas y toucher.
     label = le nom montre aux JOUEURS sur le Chronovestigation Board.
             Debarrasse du prefixe d'etage et de tout ce qui spoile :
             les dortoirs ne disent plus qui y dort. Une salle n'apparait
             chez les joueurs qu'une fois deverrouillee dans l'onglet Warden. */
const M1_LOCATIONS = [
  { id: "0 Arrival area",        etage: "RDC", label: "Arrival area" },
  { id: "0 Main hall",           etage: "RDC", label: "Main hall" },
  { id: "0 Mr Jacques office",   etage: "RDC", label: "Mr Jacques' office" },
  { id: "0' Mr Jacques studio",  etage: "RDC", label: "Mr Jacques' studio" },
  { id: "0 Storage",             etage: "RDC", label: "Storage" },
  { id: "0 Arena",               etage: "RDC", label: "Arena" },
  { id: "0 Theater",             etage: "RDC", label: "Theater" },
  { id: "0 Foyer",               etage: "RDC", label: "Foyer" },
  { id: "0 Gymnasium",           etage: "RDC", label: "Gymnasium" },
  { id: "0 Staircase",           etage: "RDC", label: "Staircase, ground floor" },
  { id: "1 Stairecase",          etage: "1er", label: "Staircase, first floor" },
  { id: "1 Corridor",            etage: "1er", label: "Corridor, first floor" },
  { id: "1 Dorms A (Hayeva Esteban Markel Norvodavius Askii)", etage: "1er", label: "Dorms A" },
  { id: "1 Dorms B (Carnage Balerion Framschtak, Pryah, Müne)", etage: "1er", label: "Dorms B" },
  { id: "1 Dorms C (Citello Nerasho Bardik)", etage: "1er", label: "Dorms C" },
  { id: "1 Dorms D (Doulahex, Paxel, Gasper)", etage: "1er", label: "Dorms D" },
  { id: "1 Library",             etage: "1er", label: "Library" },
  { id: "1' Library 1st floor",  etage: "1er", label: "Library, upper level" },
  { id: "1 Chill Zone",          etage: "1er", label: "Chill Zone" },
  { id: "2 Staircase",           etage: "2e",  label: "Staircase, second floor" },
  { id: "2 Corridor",            etage: "2e",  label: "Corridor, second floor" },
  { id: "2 Classroom",           etage: "2e",  label: "Classroom" },
  { id: "2 Workshop room",       etage: "2e",  label: "Workshop room" },
  { id: "2 Armory",              etage: "2e",  label: "Armory" },
  { id: "2 Greenhouse",          etage: "2e",  label: "Greenhouse" },
  { id: "2 Alchemy Lab",         etage: "2e",  label: "Alchemy Lab" },
  { id: "2' Alchemy lab mezzanine (Myst's room)", etage: "2e", label: "Alchemy lab mezzanine" },
  { id: "3 Staircase",           etage: "3e",  label: "Staircase, third floor" },
  { id: "3 Corridor",            etage: "3e",  label: "Corridor, third floor" },
  { id: "3 Banquet room",        etage: "3e",  label: "Banquet room" },
  { id: "3 Guest House",         etage: "3e",  label: "Guest House" },
  { id: "3 The Great Balcony",   etage: "3e",  label: "The Great Balcony" },
  { id: "3 Kitchens",            etage: "3e",  label: "Kitchens" },
  { id: "4 Staircase",           etage: "4e",  label: "Staircase, fourth floor" },
  { id: "4 Corridor",            etage: "4e",  label: "Corridor, fourth floor" },
  { id: "4 Eve's office",        etage: "4e",  label: "Eve's office" },
  { id: "4' Eve's studio",       etage: "4e",  label: "Eve's studio" },
  { id: "4 Orb's room",          etage: "4e",  label: "Orb's room" },
  { id: "4' Orb's labyrinth",    etage: "4e",  label: "Orb's labyrinth" },
  { id: "4 Monitoring room",     etage: "4e",  label: "Monitoring room" },
  { id: "4' Secret Elevator",    etage: "4e",  label: "Secret elevator, fourth floor" },
  { id: "5 Staircase",           etage: "5e",  label: "Staircase, fifth floor" },
  { id: "5 Corridor",            etage: "5e",  label: "Corridor, fifth floor" },
  { id: "5 Aesteria's lab",      etage: "5e",  label: "Aesterias' lab" },
  { id: "5' Secret Elevator",    etage: "5e",  label: "Secret elevator, fifth floor" },
  { id: "5 Recollection Room",   etage: "5e",  label: "Recollection Room" },
  { id: "6 Staircase",           etage: "6e",  label: "Staircase, sixth floor" },
  { id: "6 Maevis' office",      etage: "6e",  label: "Mrs Maevis' office" },
  { id: "6' Maevis' Suite",      etage: "6e",  label: "Mrs Maevis' suite" },
  { id: "7 Aesterias office",    etage: "7e",  label: "Aesterias' office" },
  { id: "7' Aesterias balcony",  etage: "7e",  label: "Aesterias' balcony" },
  { id: "7' Secret Elevator",    etage: "7e",  label: "Secret elevator, seventh floor" },
  { id: "X In transit",          etage: "⇅",   label: "In transit" },
];
if (typeof module !== 'undefined' && module.exports) module.exports = { M1_LOCATIONS };
