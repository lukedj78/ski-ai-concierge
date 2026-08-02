/**
 * Il negozio in memoria.
 *
 * Serve quando `DATABASE_URL` non e' configurata: i tool continuano a
 * rispondere e la demo gira end-to-end senza Neon. Con il database collegato
 * questo modulo non viene nemmeno toccato.
 *
 * I dati rispecchiano quelli del seed (`db/seed.ts`): sono verosimili ma
 * inventati. Prima di mostrarli a chi il mestiere lo conosce vanno sostituiti
 * con i listini veri.
 */

export type Level = "beginner" | "intermediate" | "advanced" | "expert";
export type Style = "piste" | "all_mountain" | "freeride";
export type Category = "skis" | "snowboard" | "boots" | "poles" | "helmet";

export type CatalogItem = {
  id: string;
  category: Category;
  brand: string;
  model: string;
  lengthCm?: number;
  mondopoint?: string;
  sizeLabel?: string;
  level?: Level;
  style?: Style;
  notes?: string;
};

/** `true` quando i tool devono leggere dal database invece che da qui. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const SKIS: {
  brand: string;
  model: string;
  level: Level;
  style: Style;
  lengths: number[];
}[] = [
  {
    brand: "Rossignol",
    model: "Experience 78",
    level: "beginner",
    style: "piste",
    lengths: [144, 152, 160, 166],
  },
  {
    brand: "Atomic",
    model: "Cloud Q8",
    level: "beginner",
    style: "piste",
    lengths: [147, 154, 161],
  },
  {
    brand: "Salomon",
    model: "S/Force 9",
    level: "intermediate",
    style: "piste",
    lengths: [155, 162, 168, 175],
  },
  {
    brand: "Head",
    model: "Kore 87",
    level: "intermediate",
    style: "all_mountain",
    lengths: [156, 163, 170, 177],
  },
  {
    brand: "Volkl",
    model: "Deacon 84",
    level: "advanced",
    style: "piste",
    lengths: [161, 168, 175, 182],
  },
  {
    brand: "Blizzard",
    model: "Rustler 10",
    level: "advanced",
    style: "all_mountain",
    lengths: [164, 172, 180, 188],
  },
  {
    brand: "Faction",
    model: "Dictator 3.0",
    level: "expert",
    style: "freeride",
    lengths: [172, 180, 186],
  },
  {
    brand: "Black Crows",
    model: "Corvus",
    level: "expert",
    style: "freeride",
    lengths: [178, 183, 188],
  },
];

const BOOTS = [
  {
    brand: "Nordica",
    model: "Speedmachine 3 85",
    flex: 85,
    level: "intermediate" as Level,
  },
  { brand: "Lange", model: "RX 110", flex: 110, level: "advanced" as Level },
  {
    brand: "Atomic",
    model: "Hawx Prime 70",
    flex: 70,
    level: "beginner" as Level,
  },
];

const MONDOPOINTS = Array.from({ length: 17 }, (_, i) =>
  (22.5 + i * 0.5).toFixed(1),
);

function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  let counter = 0;
  const id = () => `mem-${(counter += 1).toString().padStart(4, "0")}`;

  for (const ski of SKIS) {
    for (const length of ski.lengths) {
      // Due copie per misura: abbastanza per mostrare "ultimo pezzo" quando
      // una prenotazione ne occupa una.
      for (let copy = 0; copy < 2; copy += 1) {
        items.push({
          id: id(),
          category: "skis",
          brand: ski.brand,
          model: ski.model,
          lengthCm: length,
          level: ski.level,
          style: ski.style,
          sizeLabel: `${length} cm`,
        });
      }
    }
  }

  for (const boot of BOOTS) {
    for (const mondopoint of MONDOPOINTS) {
      items.push({
        id: id(),
        category: "boots",
        brand: boot.brand,
        model: boot.model,
        mondopoint,
        sizeLabel: `MP ${mondopoint}`,
        level: boot.level,
        notes: `Flex ${boot.flex}`,
      });
    }
  }

  for (const length of [100, 105, 110, 115, 120, 125, 130]) {
    for (let copy = 0; copy < 3; copy += 1) {
      items.push({
        id: id(),
        category: "poles",
        brand: "Leki",
        model: "Rider",
        lengthCm: length,
        sizeLabel: `${length} cm`,
      });
    }
  }

  for (const size of ["XS", "S", "M", "L", "XL"]) {
    for (let copy = 0; copy < 4; copy += 1) {
      items.push({
        id: id(),
        category: "helmet",
        brand: "Giro",
        model: "Ledge MIPS",
        sizeLabel: size,
      });
    }
  }

  return items;
}

export const catalog = buildCatalog();

/** Listino a fasce: `minDays` e' la soglia da cui la tariffa si applica. */
export const rates: {
  category: Category;
  level: Level | null;
  minDays: number;
  pricePerDayCents: number;
  depositCents: number;
  insurancePerDayCents: number;
}[] = [
  {
    category: "skis",
    level: "beginner",
    minDays: 1,
    pricePerDayCents: 2200,
    depositCents: 15000,
    insurancePerDayCents: 400,
  },
  {
    category: "skis",
    level: "beginner",
    minDays: 3,
    pricePerDayCents: 1900,
    depositCents: 15000,
    insurancePerDayCents: 400,
  },
  {
    category: "skis",
    level: "beginner",
    minDays: 6,
    pricePerDayCents: 1600,
    depositCents: 15000,
    insurancePerDayCents: 400,
  },
  {
    category: "skis",
    level: "intermediate",
    minDays: 1,
    pricePerDayCents: 2900,
    depositCents: 20000,
    insurancePerDayCents: 500,
  },
  {
    category: "skis",
    level: "intermediate",
    minDays: 3,
    pricePerDayCents: 2500,
    depositCents: 20000,
    insurancePerDayCents: 500,
  },
  {
    category: "skis",
    level: "intermediate",
    minDays: 6,
    pricePerDayCents: 2100,
    depositCents: 20000,
    insurancePerDayCents: 500,
  },
  {
    category: "skis",
    level: "advanced",
    minDays: 1,
    pricePerDayCents: 3600,
    depositCents: 30000,
    insurancePerDayCents: 600,
  },
  {
    category: "skis",
    level: "advanced",
    minDays: 3,
    pricePerDayCents: 3100,
    depositCents: 30000,
    insurancePerDayCents: 600,
  },
  {
    category: "skis",
    level: "advanced",
    minDays: 6,
    pricePerDayCents: 2600,
    depositCents: 30000,
    insurancePerDayCents: 600,
  },
  {
    category: "skis",
    level: "expert",
    minDays: 1,
    pricePerDayCents: 4400,
    depositCents: 40000,
    insurancePerDayCents: 800,
  },
  {
    category: "skis",
    level: "expert",
    minDays: 3,
    pricePerDayCents: 3800,
    depositCents: 40000,
    insurancePerDayCents: 800,
  },
  {
    category: "skis",
    level: "expert",
    minDays: 6,
    pricePerDayCents: 3200,
    depositCents: 40000,
    insurancePerDayCents: 800,
  },
  {
    category: "boots",
    level: null,
    minDays: 1,
    pricePerDayCents: 1500,
    depositCents: 10000,
    insurancePerDayCents: 300,
  },
  {
    category: "boots",
    level: null,
    minDays: 3,
    pricePerDayCents: 1300,
    depositCents: 10000,
    insurancePerDayCents: 300,
  },
  {
    category: "boots",
    level: null,
    minDays: 6,
    pricePerDayCents: 1100,
    depositCents: 10000,
    insurancePerDayCents: 300,
  },
  {
    category: "poles",
    level: null,
    minDays: 1,
    pricePerDayCents: 500,
    depositCents: 2000,
    insurancePerDayCents: 100,
  },
  {
    category: "poles",
    level: null,
    minDays: 6,
    pricePerDayCents: 400,
    depositCents: 2000,
    insurancePerDayCents: 100,
  },
  {
    category: "helmet",
    level: null,
    minDays: 1,
    pricePerDayCents: 700,
    depositCents: 3000,
    insurancePerDayCents: 100,
  },
  {
    category: "helmet",
    level: null,
    minDays: 6,
    pricePerDayCents: 600,
    depositCents: 3000,
    insurancePerDayCents: 100,
  },
  {
    category: "snowboard",
    level: null,
    minDays: 1,
    pricePerDayCents: 2800,
    depositCents: 20000,
    insurancePerDayCents: 500,
  },
  {
    category: "snowboard",
    level: null,
    minDays: 6,
    pricePerDayCents: 2200,
    depositCents: 20000,
    insurancePerDayCents: 500,
  },
];

/** La tariffa applicabile: soglia piu' alta fra quelle raggiunte dai giorni. */
export function rateFor(
  category: Category,
  level: Level | undefined,
  days: number,
) {
  const candidates = rates
    .filter((rate) => rate.category === category && rate.minDays <= days)
    .filter((rate) =>
      level ? rate.level === level || rate.level === null : true,
    )
    .sort((a, b) => b.minDays - a.minDays);
  return candidates[0];
}

/** Prenotazioni create durante la sessione, per far vedere che il pezzo si occupa. */
export const bookings: {
  code: string;
  equipmentIds: string[];
  startDate: string;
  endDate: string;
}[] = [];

export function isBusy(
  id: string,
  startDate: string,
  endDate: string,
): boolean {
  return bookings.some(
    (booking) =>
      booking.equipmentIds.includes(id) &&
      booking.startDate <= endDate &&
      booking.endDate >= startDate,
  );
}

/** Policy e informazioni del negozio, come nel seed. */
export const knowledge = [
  {
    title: "Orari e sedi",
    section: "Informazioni generali",
    content:
      "Il negozio di Canazei e' aperto tutti i giorni dalle 8:00 alle 19:00 durante la stagione (dicembre-aprile). Il punto di ritiro a Campitello apre alle 8:30 e chiude alle 18:00.",
  },
  {
    title: "Ritiro dell'attrezzatura",
    section: "Noleggio",
    content:
      "Il ritiro avviene in negozio con un documento e il codice della prenotazione. Chi ritira dopo le 16:00 non paga quel giorno: il conteggio parte dal mattino successivo.",
  },
  {
    title: "Restituzione e ritardi",
    section: "Noleggio",
    content:
      "L'attrezzatura va restituita entro la chiusura dell'ultimo giorno. Il ritardo si conteggia a giorno intero, non a ore. Se dipende da un impianto chiuso non viene addebitato.",
  },
  {
    title: "Cauzione",
    section: "Noleggio",
    content:
      "La cauzione e' un'autorizzazione sulla carta, non un addebito, e viene rilasciata alla riconsegna: 150 euro per gli sci base, fino a 400 per il freeride, 100 per gli scarponi. Non si accettano contanti.",
  },
  {
    title: "Assicurazione",
    section: "Noleggio",
    content:
      "Facoltativa, si aggiunge al prezzo giornaliero. Copre rottura e furto con denuncia. Non copre lo smarrimento ne' l'uso improprio. Si sottoscrive alla prenotazione, non dopo il ritiro.",
  },
  {
    title: "Cancellazione e modifiche",
    section: "Policy",
    content:
      "Cancellazione gratuita fino a 48 ore prima. Fra 48 e 24 ore si trattiene il 30 per cento. Nelle ultime 24 ore l'importo e' dovuto per intero. Le modifiche di data sono gratuite se c'e' disponibilita'. Chiusura impianti per mancanza di neve: rimborso totale.",
  },
  {
    title: "Pagamenti",
    section: "Policy",
    content:
      "Si paga al ritiro, in negozio: carte, bancomat, contanti fino a 999 euro. La prenotazione online non richiede pagamento anticipato.",
  },
  {
    title: "Attrezzatura per bambini",
    section: "Noleggio",
    content:
      "Fino a dodici anni sci, scarponi, bastoncini e casco a 15 euro al giorno. Il casco per i minori e' obbligatorio per legge ed e' compreso.",
  },
  {
    title: "Manutenzione",
    section: "Servizi",
    content:
      "Sciolinatura e affilatura sono comprese nel noleggio e si fanno ogni sera. Per l'attrezzatura di proprieta' il servizio costa 25 euro.",
  },
  {
    title: "Come si scelgono le misure",
    section: "Consulenza",
    content:
      "La lunghezza degli sci dipende da altezza, peso, livello e stile, non dalla sola altezza. Gli scarponi si misurano in mondopoint, che non coincide col numero di scarpa. I bastoncini si prendono al 68 per cento dell'altezza.",
  },
];

/** Ricerca per parole: senza database non ci sono embedding. */
export function searchKnowledge(query: string, limit = 4) {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);

  return knowledge
    .map((document) => {
      const haystack = `${document.title} ${document.content}`.toLowerCase();
      const score = words.filter((word) => haystack.includes(word)).length;
      return { document, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.document);
}
