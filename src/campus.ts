import { searchMatchingPlaces } from "./search";

export type Category =
  "Teaching" | "Library" | "Food" | "Services" | "Toilets" | "Parking";
export type Point = { x: number; y: number };
export type PathNode = Point & { id: string; landmark: string };
export type PathEdge = { from: string; to: string; stepFree: boolean };
export type Place = {
  id: string;
  name: string;
  shortName: string;
  aliases?: string[];
  category: Category;
  description: string;
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  tag: string;
};
export const CAMPUS_ID = "willowbrook";
export const SAMPLE_QR = "uniway://willowbrook/south-gate";
export const places: Place[] = [
  {
    id: "library",
    name: "The Central Library",
    shortName: "Central Library",
    aliases: ["Library", "Reading room"],
    category: "Library",
    description:
      "Your quiet corner on campus. Find study spaces, books, and a little room to think.",
    nodeId: "library-door",
    x: 350,
    y: 250,
    w: 205,
    h: 112,
    color: "sand",
    tag: "Study & discover",
  },
  {
    id: "science",
    name: "School of Science",
    shortName: "School of Science",
    category: "Teaching",
    description:
      "Laboratories, lecture halls, and the science faculty help desk.",
    nodeId: "science-door",
    x: 350,
    y: 80,
    w: 165,
    h: 94,
    color: "stone",
    tag: "Learn & explore",
  },
  {
    id: "engineering",
    name: "Engineering Building",
    shortName: "Engineering",
    category: "Teaching",
    description:
      "Engineering studios, collaborative workshops, and teaching spaces.",
    nodeId: "engineering-door",
    x: 730,
    y: 85,
    w: 175,
    h: 88,
    color: "stone",
    tag: "Make something new",
  },
  {
    id: "arts",
    name: "Faculty of Arts",
    shortName: "Faculty of Arts",
    category: "Teaching",
    description:
      "A home for humanities, creative studios, and new perspectives.",
    nodeId: "arts-door",
    x: 130,
    y: 250,
    w: 135,
    h: 104,
    color: "rose",
    tag: "Ideas live here",
  },
  {
    id: "admin",
    name: "University House",
    shortName: "University House",
    aliases: ["Administration", "Admissions"],
    category: "Services",
    description:
      "Admissions, university administration, and guidance for your first few weeks.",
    nodeId: "admin-door",
    x: 745,
    y: 265,
    w: 150,
    h: 87,
    color: "stone",
    tag: "Here to help",
  },
  {
    id: "cafe",
    name: "The Common Ground",
    shortName: "Common Ground Café",
    aliases: ["Café", "Cafe", "Cafeteria", "Canteen"],
    category: "Food",
    description: "Coffee, a quick bite, and a good place to meet someone new.",
    nodeId: "cafe-door",
    x: 370,
    y: 493,
    w: 157,
    h: 87,
    color: "sand",
    tag: "Take a little break",
  },
  {
    id: "student",
    name: "Student Centre",
    shortName: "Student Centre",
    aliases: ["Student Center"],
    category: "Services",
    description:
      "Find your people. Clubs, student support, and a friendly welcome desk.",
    nodeId: "student-door",
    x: 720,
    y: 498,
    w: 172,
    h: 112,
    color: "rose",
    tag: "Your campus community",
  },
  {
    id: "residence",
    name: "Willow Residence Office",
    shortName: "Willow Residence",
    category: "Services",
    description:
      "Accommodation support and residence information for campus life.",
    nodeId: "residence-door",
    x: 145,
    y: 495,
    w: 116,
    h: 122,
    color: "stone",
    tag: "Settle right in",
  },
  {
    id: "toilets",
    name: "Accessible Toilets",
    shortName: "Toilets",
    aliases: ["Restrooms", "Washrooms", "WC"],
    category: "Toilets",
    description:
      "Public toilets with a step-free accessible cubicle beside the sports grounds.",
    nodeId: "toilets-door",
    x: 1035,
    y: 497,
    w: 65,
    h: 64,
    color: "stone",
    tag: "Campus essentials",
  },
  {
    id: "parking",
    name: "East Visitor Parking",
    shortName: "Visitor Parking",
    aliases: ["Car park"],
    category: "Parking",
    description:
      "Visitor parking with accessible bays. Follow the signed pedestrian path to campus.",
    nodeId: "parking-door",
    x: 986,
    y: 105,
    w: 121,
    h: 120,
    color: "parking",
    tag: "Arrive & explore",
  },
];
export const entrances = [
  { id: "south-gate", name: "South Gate", x: 620, y: 805 },
  { id: "west-gate", name: "West Gate", x: 110, y: 420 },
  { id: "north-gate", name: "North Gate", x: 620, y: 65 },
];
export const nodes: PathNode[] = [
  ...entrances.map((p) => ({ ...p, landmark: p.name })),
  ...[200, 420, 650].flatMap((y) =>
    [300, 620, 950].map((x) => ({
      id: `${x}-${y}`,
      x,
      y,
      landmark:
        x === 620 && y === 420
          ? "Founders’ Square"
          : y === 650
            ? "Garden Walk"
            : y === 200
              ? "North Walk"
              : "University Walk",
    })),
  ),
  { id: "455-420", x: 455, y: 420, landmark: "the library steps" },
  { id: "800-420", x: 800, y: 420, landmark: "University House" },
  { id: "420-200", x: 420, y: 200, landmark: "the science gardens" },
  { id: "800-200", x: 800, y: 200, landmark: "Engineering Walk" },
  { id: "300-300", x: 300, y: 300, landmark: "the arts courtyard" },
  { id: "300-560", x: 300, y: 560, landmark: "Willow Residence" },
  { id: "950-540", x: 950, y: 540, landmark: "the sports grounds" },
  { id: "library-door", x: 455, y: 378, landmark: "the library entrance" },
  { id: "library-ramp", x: 582, y: 378, landmark: "the library ramp" },
  { id: "620-378", x: 620, y: 378, landmark: "Founders’ Square" },
  { id: "science-door", x: 420, y: 184, landmark: "the science entrance" },
  {
    id: "engineering-door",
    x: 800,
    y: 183,
    landmark: "the engineering entrance",
  },
  { id: "arts-door", x: 278, y: 300, landmark: "the arts entrance" },
  {
    id: "admin-door",
    x: 800,
    y: 366,
    landmark: "the University House entrance",
  },
  { id: "cafe-door", x: 455, y: 480, landmark: "the café terrace" },
  {
    id: "student-door",
    x: 800,
    y: 480,
    landmark: "the student centre entrance",
  },
  { id: "residence-door", x: 276, y: 560, landmark: "the residence office" },
  { id: "toilets-door", x: 1020, y: 540, landmark: "the accessible toilets" },
  { id: "parking-door", x: 970, y: 200, landmark: "visitor parking" },
];
const chain = (...ids: string[]): PathEdge[] =>
  ids.slice(1).map((id, i) => ({ from: ids[i], to: id, stepFree: true }));
export const edges: PathEdge[] = [
  ...chain(
    "300-200",
    "420-200",
    "620-200",
    "800-200",
    "950-200",
    "parking-door",
  ),
  ...chain("west-gate", "300-420", "455-420", "620-420", "800-420", "950-420"),
  ...chain("300-650", "620-650", "950-650"),
  ...chain("300-200", "300-300", "300-420", "300-560", "300-650"),
  ...chain(
    "north-gate",
    "620-200",
    "620-378",
    "620-420",
    "620-650",
    "south-gate",
  ),
  ...chain("950-200", "950-420", "950-540", "950-650"),
  ...chain("library-door", "library-ramp", "620-378"),
  ...chain("science-door", "420-200"),
  ...chain("engineering-door", "800-200"),
  ...chain("arts-door", "300-300"),
  ...chain("admin-door", "800-420"),
  ...chain("cafe-door", "455-420"),
  ...chain("student-door", "800-420"),
  ...chain("residence-door", "300-560"),
  ...chain("toilets-door", "950-540"),
  { from: "library-door", to: "455-420", stepFree: false },
];
export const nodeById = new Map(nodes.map((n) => [n.id, n]));
export const categories: Category[] = [
  "Teaching",
  "Library",
  "Food",
  "Services",
  "Toilets",
  "Parking",
];
export function searchPlaces(query: string, category: Category | "All") {
  return searchMatchingPlaces(
    places.filter((p) => category === "All" || p.category === category),
    query,
  );
}
