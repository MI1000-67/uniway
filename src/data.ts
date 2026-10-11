export type Point = { x: number; y: number };
export type Building = Point & { width: number; height: number; color?: string };
export type Place = Point & {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  floor: number;
  confidence?: number;
  aliases?: string[];
};
export type Edge = {
  a: string;
  b: string;
  accessible: boolean;
  distance?: number;
  points?: Point[];
  confirmed?: boolean;
  source?: 'detected' | 'manual';
};
export type MapImage = {
  name: string;
  data: string;
  buildings?: Building[];
  roads?: Point[][];
  reviewed?: boolean;
  warnings?: string[];
  unplacedLabels?: { name: string; confidence?: number; color?: string }[];
};
export type Campus = {
  version: 1;
  name: string;
  places: Place[];
  edges: Edge[];
  images: MapImage[];
  junctions?: Place[];
};
export const places: Place[] = [
  {
    id: 'gate',
    name: 'Main entrance',
    aliases: ['main gate', 'welcome desk'],
    x: 490,
    y: 702,
    category: 'Services',
    description: 'The starting point for a new chapter. Beside the campus welcome desk.',
    icon: 'gate',
    floor: 0,
  },
  {
    id: 'library',
    name: 'Central Library',
    x: 555,
    y: 293,
    category: 'Study',
    description: 'Find a quiet corner, your next great read, or a little help with your research.',
    icon: 'book',
    floor: 0,
  },
  {
    id: 'science',
    name: 'Faculty of Science',
    x: 305,
    y: 244,
    category: 'Study',
    description: 'Teaching laboratories, lecture halls, and the faculty help desk.',
    icon: 'flask',
    floor: 0,
  },
  {
    id: 'cafe',
    name: 'The Commons Café',
    aliases: ['canteen', 'coffee', 'dining'],
    x: 700,
    y: 490,
    category: 'Food',
    description: 'A place to pause. Coffee, quick bites, and good company between classes.',
    icon: 'coffee',
    floor: 0,
  },
  {
    id: 'student',
    name: 'Student Centre',
    x: 312,
    y: 492,
    category: 'Services',
    description: 'Your first stop for student support, clubs, and campus life.',
    icon: 'people',
    floor: 0,
  },
  {
    id: 'arts',
    name: 'Arts & Humanities',
    x: 789,
    y: 271,
    category: 'Study',
    description: 'Creative studios and seminar rooms overlooking the east gardens.',
    icon: 'building',
    floor: 0,
  },
  {
    id: 'garden',
    name: 'Founders’ Garden',
    x: 550,
    y: 469,
    category: 'Outdoors',
    description: 'Take the scenic route. A peaceful green space in the heart of campus.',
    icon: 'leaf',
    floor: 0,
  },
  {
    id: 'sports',
    name: 'Sports Pavilion',
    x: 198,
    y: 644,
    category: 'Outdoors',
    description: 'Indoor activities and the entrance to the western sports grounds.',
    icon: 'ball',
    floor: 0,
  },
  {
    id: 'health',
    name: 'Health & Wellbeing',
    x: 824,
    y: 638,
    category: 'Services',
    description:
      'The campus wellbeing desk. This fictional demo does not provide emergency directions.',
    icon: 'heart',
    floor: 0,
  },
];
export const junctions: Place[] = [
  ['j1', 490, 603],
  ['j2', 490, 397],
  ['j3', 555, 397],
  ['j4', 700, 397],
  ['j5', 305, 397],
  ['j6', 790, 397],
  ['j7', 700, 603],
  ['j8', 312, 603],
  ['j9', 550, 520],
].map(([id, x, y]) => ({
  id: String(id),
  name: 'Campus path',
  x: Number(x),
  y: Number(y),
  category: 'Path',
  description: '',
  icon: 'pin',
  floor: 0,
}));
export const edges: Edge[] = [
  ['gate', 'j1'],
  ['j1', 'j2'],
  ['j2', 'j3'],
  ['j3', 'j4'],
  ['j4', 'j6'],
  ['j2', 'j5'],
  ['j5', 'science'],
  ['j3', 'library'],
  ['j4', 'cafe'],
  ['j6', 'arts'],
  ['j5', 'student'],
  ['j1', 'j8'],
  ['j8', 'student'],
  ['j8', 'sports'],
  ['j1', 'j7'],
  ['j7', 'cafe'],
  ['j7', 'health'],
  ['j1', 'j9'],
  ['j9', 'garden'],
].map(([a, b]) => ({ a, b, accessible: true }));
edges.push({ a: 'garden', b: 'j3', accessible: false });
export const demo: Campus = {
  version: 1,
  name: 'Greenfield University',
  places,
  edges,
  images: [],
};
