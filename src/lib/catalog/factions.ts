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
  { key: "government", name: "Правительство", description: "Государственные структуры управления.", sortOrder: 0 },
  { key: "law_enforcement", name: "Правоохранительные органы", description: "Полиция и департаменты шерифа.", sortOrder: 1 },
  { key: "military", name: "Военные", description: "Вооружённые силы.", sortOrder: 2 },
  { key: "healthcare", name: "Здравоохранение", description: "Медицинские и спасательные службы.", sortOrder: 3 },
  { key: "media", name: "СМИ", description: "Телевидение и пресса.", sortOrder: 4 },
  { key: "licensing", name: "Лицензирование", description: "Услуги по выдаче лицензий и разрешений.", sortOrder: 5 },
  { key: "corrections", name: "Исправительные учреждения", description: "Тюрьмы и исправительные заведения.", sortOrder: 6 },
];

export const FACTIONS: FactionSeed[] = [
  {
    key: "government",
    name: "Правительство",
    shortName: "GOV",
    categoryKey: "government",
    departmentKey: "state_structures",
    description: "Правительство штата Сан-Андреас — офис губернатора и министерства.",
    allowMultipleLeaders: true,
    leaderTitle: "Губернатор",
    deputyTitles: ["Заместитель губернатора", "Министр юстиции", "Министр обороны"],
  },
  {
    key: "los_santos_tv_studio",
    name: "Телестудия Лос-Сантоса",
    shortName: "LSTV",
    categoryKey: "media",
    departmentKey: "central_management",
    description: "Государственная телестудия Лос-Сантоса.",
    leaderTitle: "Директор телестудии Лос-Сантоса",
    deputyTitles: ["Заместитель директора"],
  },
  {
    key: "licensing_center",
    name: "Лицензионный центр",
    shortName: "LC",
    categoryKey: "licensing",
    departmentKey: "central_management",
    description: "Центр выдачи лицензий и разрешений.",
    leaderTitle: "Директор лицензионного центра",
    deputyTitles: ["Заместитель директора"],
  },
  {
    key: "fbi",
    name: "Федеральное бюро расследований",
    shortName: "FBI",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Федеральное бюро расследований.",
    leaderTitle: "Директор Федерального бюро расследований",
    deputyTitles: ["Заместитель директора"],
  },
  {
    key: "lspd",
    name: "Полиция Лос-Сантоса",
    shortName: "LSPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Полиция Лос-Сантоса.",
    leaderTitle: "Начальник полиции Лос-Сантоса",
    deputyTitles: ["Заместитель начальника"],
  },
  {
    key: "sfpd",
    name: "Полиция Сан-Фиерро",
    shortName: "SFPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Полиция Сан-Фиерро.",
    leaderTitle: "Начальник полиции Сан-Фиерро",
    deputyTitles: ["Заместитель начальника"],
  },
  {
    key: "lsd",
    name: "Департамент шерифа Лос-Сантоса",
    shortName: "LSSD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Департамент шерифа Лос-Сантоса.",
    leaderTitle: "Шериф Лос-Сантоса",
    deputyTitles: ["Заместитель шерифа"],
  },
  {
    key: "lvpd",
    name: "Полиция Лас-Вентурас",
    shortName: "LVPD",
    categoryKey: "law_enforcement",
    departmentKey: "state_structures",
    description: "Полиция Лас-Вентурас.",
    leaderTitle: "Начальник полиции Лас-Вентурас",
    deputyTitles: ["Заместитель начальника"],
  },
  {
    key: "los_santos_army",
    name: "Армия Лос-Сантоса",
    shortName: "LSA",
    categoryKey: "military",
    departmentKey: "ministry_of_defense",
    description: "Армия Лос-Сантоса.",
    leaderTitle: "Генерал Армии Лос-Сантоса",
    deputyTitles: ["Заместитель генерала"],
  },
  {
    key: "san_fierro_army",
    name: "Армия Сан-Фиерро",
    shortName: "SFA",
    categoryKey: "military",
    departmentKey: "ministry_of_defense",
    description: "Армия Сан-Фиерро.",
    leaderTitle: "Генерал Армии Сан-Фиерро",
    deputyTitles: ["Заместитель генерала"],
  },
  {
    key: "los_santos_medical_center",
    name: "Медицинский центр Лос-Сантоса",
    shortName: "LSMC",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Медицинский центр Лос-Сантоса.",
    leaderTitle: "Директор медицинского центра Лос-Сантоса",
    deputyTitles: ["Заместитель директора"],
  },
  {
    key: "academy_ministry_of_health",
    name: "Академия Минздрава",
    shortName: "AMH",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Академия Министерства здравоохранения.",
    leaderTitle: "Директор Академии Минздрава",
    deputyTitles: ["Заместитель директора"],
  },
  {
    key: "fire_department",
    name: "Пожарная служба",
    shortName: "FD",
    categoryKey: "healthcare",
    departmentKey: "healthcare",
    description: "Пожарная служба Лос-Сантоса.",
    leaderTitle: "Начальник пожарной службы",
    deputyTitles: ["Заместитель начальника пожарной службы"],
  },
  {
    key: "lv_maximum_security_prison",
    name: "Тюрьма особого режима Лас-Вентурас",
    shortName: "LVMSP",
    categoryKey: "corrections",
    departmentKey: "max_prison",
    description: "Тюрьма особого режима Лас-Вентурас.",
    leaderTitle: "Начальник тюрьмы особого режима Лас-Вентурас",
    deputyTitles: ["Заместитель начальника тюрьмы"],
  },
];
