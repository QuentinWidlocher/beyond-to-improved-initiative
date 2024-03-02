import { Output, array, boolean, nullish, number, object, string, transform } from "valibot"

const statKeys = [
  'Str',
  'Dex',
  'Con',
  'Int',
  'Wis',
  'Cha',
] as const

type StatKey = typeof statKeys[number]

const skills = {
  'Acrobatics': "Dex",
  'Animal Handling': "Wis",
  'Arcana': "Int",
  'Athletics': "Str",
  'Deception': "Cha",
  'History': "Int",
  'Insight': "Wis",
  'Intimidation': "Cha",
  'Investigation': "Int",
  'Medicine': "Wis",
  'Nature': "Int",
  'Perception': "Wis",
  'Performance': "Cha",
  'Persuasion': "Cha",
  'Religion': "Int",
  'Sleight of Hand': "Dex",
  'Stealth': "Dex",
  'Survival': "Wis",
} satisfies Record<string, StatKey>;

type IIModifier = { "Name": string, "Modifier": number }
type IIContent = { "Name": string, "Content": string, }

type IIData =
  {
    "Source": string,
    "Type": string,
    "HP": {
      "Value": number,
      "Notes": string,
    },
    "AC": {
      "Value": number,
      "Notes": string,
    },
    "InitiativeModifier": number
    "InitiativeAdvantage": boolean
    "Speed": string[],
    "Abilities": Record<StatKey, number>,
    "DamageVulnerabilities": string[],
    "DamageResistances": string[],
    "DamageImmunities": string[],
    "ConditionImmunities": string[],
    "Saves": IIModifier[],
    "Skills": IIModifier[],
    "Senses": string[],
    "Languages": string[],
    "Challenge": string,
    "Traits": IIContent[],
    "Actions": IIContent[],
    "BonusActions": IIContent[],
    "Reactions": IIContent[],
    "LegendaryActions": IIContent[],
    "MythicActions": IIContent[],
    "Description": "string",
    "Player": string,
    "Version": "3.9.2",
    "ImageURL": string,
    "InitiativeSpecialRoll": "advantage" | "disadvantage" | "take-ten" | ""
  }

const BeyondModifierSchema = object({
  availableToMulticlass: boolean(),
  componentId: number(),
  bonusTypes: array(number()),
  type: string(),
  subType: string(),
  value: nullish(number()),
  friendlySubtypeName: string(),
})

export const BeyondSchema = object({
  baseHitPoints: number(),
  classes: array(object({
    level: number(),
    classFeatures: array(object({
      definition: object({
        id: number(),
      })
    })),
    definition: object({
      name: string(),
      hitDice: number(),
    }),
    subclassDefinition: nullish(object({
      name: string(),
      hitDice: number(),
    })),
    isStartingClass: boolean(),
  })),
  race: object({
    weightSpeeds: object({
      normal: object({
        burrow: number(),
        climb: number(),
        fly: number(),
        swim: number(),
        walk: number(),
      })
    })
  }),
  stats: transform(array(object({
    value: number(),
  })), arr => ({
    Str: arr[0].value,
    Dex: arr[1].value,
    Con: arr[2].value,
    Int: arr[3].value,
    Wis: arr[4].value,
    Cha: arr[5].value,
  } satisfies Record<StatKey, number>)),
  modifiers: object({
    background: array(BeyondModifierSchema),
    class: array(BeyondModifierSchema),
    race: array(BeyondModifierSchema),
    item: array(BeyondModifierSchema)
  }),
  inventory: array(object({
    equipped: nullish(boolean()),
    definition: object({
      armorClass: nullish(number()),
      armorTypeId: nullish(number()),
      name: string(),
    })
  })),
})

type BeyondData = Output<typeof BeyondSchema>;

export function convertBeyondToII(r: BeyondData) {

  function getModSkillKey(name: string): StatKey | null {
    const modSkillKey = name.slice(0, 3);
    if (modSkillKey in stats) {
      return modSkillKey as StatKey
    } else {
      return null
    }
  }

  const proficiencyBonus = Math.ceil(1 + (r.classes[0].level / 4));

  let stats = r.stats;
  let savingThrows: IIModifier[] = [];
  let skillsProficiency: IIModifier[] = [];
  let senses: string[] = [];
  let languages: string[] = [];

  let ac = 10;

  let initiativeBonus = 0;
  let speedBonus = 0;

  const modifierOrder = [
    'bonus',
    'proficiency',
    'expertise',
    'set',
  ]
  const modifiers = [...r.modifiers.race, ...r.modifiers.background, ...r.modifiers.class, ...r.modifiers.item].sort((a, b) => (modifierOrder.findIndex(v => v == a.type)) - (modifierOrder.findIndex(v => v == b.type)))

  for (const m of modifiers) {
    const modSkillKey = getModSkillKey(m.friendlySubtypeName);

    if (m.type == 'bonus') {
      if (modSkillKey) {
        stats[modSkillKey] += m.value || 0;
      } else if (m.subType == 'unarmored-movement') {
        speedBonus = m.value || 0;
      } else if (m.bonusTypes.includes(1) && m.subType == 'initiative') {
        initiativeBonus = proficiencyBonus;
      }
    }

    if (m.type == 'proficiency' || m.type == 'expertise') {
      if (!m.availableToMulticlass) {
        const classGivingThisProficiency = r.classes.find(c => c.classFeatures.some(f => f.definition.id == m.componentId))

        if (!classGivingThisProficiency?.isStartingClass) {
          continue
        }
      }

      const bonus = m.type == 'proficiency' ? proficiencyBonus : proficiencyBonus * 2

      if (m.subType.endsWith('saving-throws') && modSkillKey) {
        const name = m.friendlySubtypeName.split(' ')[0];
        const modifier = statMod(stats[modSkillKey]) + bonus;
        console.log({ name, modifier })

        if (!savingThrows.some(s => s.Name == name)) {
          savingThrows.push({
            Name: name,
            Modifier: modifier
          })
        } else {
          const index = savingThrows.findIndex(s => s.Name == name)

          savingThrows[index].Modifier = Math.max(savingThrows[index].Modifier, modifier)
        }
      } else if (m.friendlySubtypeName in skills) {
        const modKey = skills[m.friendlySubtypeName as keyof typeof skills];
        const name = m.friendlySubtypeName;
        const modifier = statMod(stats[modKey]) + bonus;

        if (!skillsProficiency.some(s => s.Name == name)) {
          skillsProficiency.push({
            Name: name,
            Modifier: modifier
          })
        } else {
          const index = skillsProficiency.findIndex(s => s.Name == name)

          skillsProficiency[index].Modifier = Math.max(skillsProficiency[index].Modifier, modifier)
        }
      }
    }

    if (m.type == 'language' && !modSkillKey) {
      languages.push(m.friendlySubtypeName)
    }

    if (m.type == 'set') {
      if (modSkillKey) {
        stats[modSkillKey] = m.value || stats[modSkillKey];
      } else {
        if (m.subType == 'unarmored-armor-class') {
          ac = 10 + statMod(stats.Dex) + statMod(stats.Wis)
        }
      }
    }

    if (m.type == 'set-base' && !modSkillKey) {
      senses.push(`${m.friendlySubtypeName} ${m.value || 0}`)
    }
  }


  const armors = r.inventory.filter(i => i.equipped && i.definition.armorClass).sort((a, b) => b.definition.armorClass! - a.definition.armorClass!);
  const acDexBonus = !armors[0] || armors[0].definition.armorTypeId! < 2 ? statMod(stats.Dex) :
    armors[0].definition.armorTypeId! < 3 ? Math.min(statMod(stats.Dex), 2) : 0;
  console.debug('acDexBonus', acDexBonus);

  ac = Math.max(ac, (armors.map(i => i.definition.armorClass).reduce((acc, i) => acc! + i!, 0) || 10) + acDexBonus);

  function statMod(stat: number) {
    return Math.floor(stat / 2 - 5)
  }


  function getHP(classes: BeyondData['classes']) {
    const baseHp = classes.flatMap(c => new Array(c.level).fill(c)).reduce((hp, c, level) => {
      let modifier = 0;
      if (level == 1) {
        modifier = (c.definition.hitDice + statMod(stats.Con))
      } else {
        modifier = (1 + Math.floor(c.definition.hitDice / 2) + statMod(stats.Con))
      }
      return hp + modifier
    }, 0)

    return baseHp + (r.modifiers.race.some(m => m.subType == 'hit-points-per-level') ? classes.reduce((levels, c) => levels + c.level, 0) : 0)
  }

  const result: Partial<IIData> = {
    "Source": "",
    Type: r.classes.map(c => `${c.definition.name}${c.subclassDefinition ? ` (${c.subclassDefinition.name})` : ''}`).join(' / '),
    HP: {
      Value: getHP(r.classes),
      Notes: '(' + r.classes.map(c => `${c.level}d${c.definition.hitDice}+${statMod(stats.Con)}`).join(' / ') + ')'
    },
    AC: {
      Value: ac,
      Notes: armors.length ? '(' + armors.map(i => i.definition.name).join(' + ') + ')' : ''
    },
    InitiativeModifier: initiativeBonus,
    InitiativeAdvantage: false,
    Speed: Object.entries(r.race.weightSpeeds.normal).filter(([_, v]) => v > 0).map(([k, v]) => [k, v + speedBonus] as const).map(([k, v]) => `${k} ${v}ft. (${Math.round(v * 0.3048)}m) (${Math.round(v / 5)}c.)`),
    Abilities: r.stats,
    DamageVulnerabilities: r.modifiers.race.filter(m => m.type == 'vulnerability').map(m => m.friendlySubtypeName),
    DamageResistances: r.modifiers.race.filter(m => m.type == 'resistance').map(m => m.friendlySubtypeName),
    DamageImmunities: r.modifiers.race.filter(m => m.type == 'immunity').map(m => m.friendlySubtypeName),
    ConditionImmunities: r.modifiers.race.filter(m => m.type == 'condition-immunity' /* @FIXME probably not called like this */).map(m => m.friendlySubtypeName),
    Saves: savingThrows.sort((a, b) => a.Name.localeCompare(b.Name)),
    Skills: skillsProficiency.sort((a, b) => a.Name.localeCompare(b.Name)),
    Senses: [
      `Passive perception: ${10 + (skillsProficiency.find(s => s.Name == 'Perception')?.Modifier ?? statMod(stats.Wis))}`,
      `Passive investigation: ${10 + (skillsProficiency.find(s => s.Name == 'Investigation')?.Modifier ?? statMod(stats.Int))}`,
      `Passive insight: ${10 + (skillsProficiency.find(s => s.Name == 'Insight')?.Modifier ?? statMod(stats.Wis))}`,
      ...senses.sort((a, b) => a.localeCompare(b)),
    ],
    Languages: languages,
    Challenge: String(r.classes.reduce((acc, c) => acc + c.level, 0)),
  }

  return result;
}
