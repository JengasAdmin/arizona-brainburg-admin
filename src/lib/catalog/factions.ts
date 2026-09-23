/**
 * Faction catalog — Server #5. Pure data: used by the seed script and the UI.
 * Adding a faction later only requires a new entry here (or the Administration UI).
 */

export interface FactionSeed {
  key: string;
  name: string;
  shortName: string;
  categoryKey: string;
  departmentKey: string;
  description: string;
  /** Allows several simultaneous active leader-kind positions (e.g. ministers). */
  allowMultipleLeaders?: boolean;
  leaderTitle: string;
  /** Up to two deputy titles. */
  deputyTitles?: string[];
}

export const FACTION_CATEGORIES: { key: string; name: string; description: string; sortOrder: number }[] = [
  { key: "government", name: "Government", description: "State governance structures.", sortOrder: 0 },
  { key: "law_enforcement", name: "Law Enforcement", description: "Police and sheriff departments.", sortOrder: 1 },
  { key: "military", name: "Military", description: "Armed forces.", sortOrder: 2 },
  { key: "healthcare", name: "Healthcare", description: "Medical and rescue services.", sortOrder: 3 },
  { key: "media", name: "Media", description: "Television and press.", sortOrder: 4 },
  { key: "licensing", name: "Licensing", description: "Licensing and permitting services.", sortOrder: 5 },
  { key: "corrections", name: "Corrections", description: "Prisons and correctional facilities.", sortOrder: 6 },
];

export const FACTIONS: FactionSeed[] = [
  {
    key: "government",
    name: "Government",
    shortName: "GOV",
    categoryKey: "government",
    departmentKey: "state_structures",
    description: "Government of the State of San Andreas — Governor's office and ministries.",
    allowMultipleLeaders: true,
    leaderTitle: "Governor",
    deputyTitles: ["Vice Governor", "Minister of Justice", "Minister of Defense"],
  },
  {
    key: "los_santos_tv_studio",
    name: "Los Santos TV Studio",
    shortName: "LSTV",
    categoryKey: "media",
    departmentKey: "central_management",
    description: "State television studio of Los Santos.",
    leaderTitle: "Director of Los Santos TV Studio",
    deputyTitles: ["Deputy Director"],
  },
  {
    key: "licensing_center",
    name: "Licensing Center",
    shortName: "LC",
    categoryKey: "licensing",
    departmentKey: "central_management",
    description: "Licensing and permit center.",
    leaderTitle: "Director of Licensing Center",
    deputyTitles: ["Deputy Director"],
  },
  {
    key: "fbi",
    name: "Federal Bureau of Investigation",
    shortName: "FBI",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Federal investigative bureau.",
    leaderTitle: "Director of Federal Bureau of Investigation",
    deputyTitles: ["Deputy Director"],
  },
  {
    key: "lspd",
    name: "Los Santos Police Department",
    shortName: "LSPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Los Santos Police Department.",
    leaderTitle: "Chief of Los Santos Police Department",
    deputyTitles: ["Deputy Chief"],
  },
  {
    key: "sfpd",
    name: "San Fierro Police Department",
    shortName: "SFPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "San Fierro Police Department.",
    leaderTitle: "Chief of San Fierro Police Department",
    deputyTitles: ["Deputy Chief"],
  },
  {
    key: "lsd",
    name: "Los Santos Sheriff Department",
    shortName: "LSSD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Los Santos Sheriff Department.",
    leaderTitle: "Sheriff of Los Santos Sheriff Department",
    deputyTitles: ["Deputy Sheriff"],
  },
  {
    key: "lvpd",
    name: "Las Venturas Police Department",
    shortName: "LVPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Las Venturas Police Department.",
    leaderTitle: "Chief of Las Venturas Police Department",
    deputyTitles: ["Deputy Chief"],
  },
  {
    key: "los_santos_army",
    name: "Los Santos Army",
    shortName: "LSA",
    categoryKey: "military",
    departmentKey: "ministry_of_defense",
    description: "Los Santos Army.",
    leaderTitle: "General of Los Santos Army",
    deputyTitles: ["Deputy General"],
  },
  {
    key: "san_fierro_army",
    name: "San Fierro Army",
    shortName: "SFA",
    categoryKey: "military",
    departmentKey: "ministry_of_defense",
    description: "San Fierro Army.",
    leaderTitle: "General of San Fierro Army",
    deputyTitles: ["Deputy General"],
  },
  {
    key: "los_santos_medical_center",
    name: "Los Santos Medical Center",
    shortName: "LSMC",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Los Santos Medical Center.",
    leaderTitle: "Director of Los Santos Medical Center",
    deputyTitles: ["Deputy Director"],
  },
  {
    key: "academy_ministry_of_health",
    name: "Academy of the Ministry of Health",
    shortName: "AMH",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Academy of the Ministry of Health.",
    leaderTitle: "Director of the Academy of the Ministry of Health",
    deputyTitles: ["Deputy Director"],
  },
  {
    key: "fire_department",
    name: "Fire Department",
    shortName: "FD",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Los Santos Fire Department.",
    leaderTitle: "Fire Chief",
    deputyTitles: ["Deputy Fire Chief"],
  },
  {
    key: "lv_maximum_security_prison",
    name: "Las Venturas Maximum Security Prison",
    shortName: "LVMSP",
    categoryKey: "corrections",
    departmentKey: "max_prison",
    description: "Las Venturas Maximum Security Prison.",
    leaderTitle: "Warden of Las Venturas Maximum Security Prison",
    deputyTitles: ["Deputy Warden"],
  },
];
