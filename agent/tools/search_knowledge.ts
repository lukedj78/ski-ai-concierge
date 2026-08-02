import { embed } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDb } from "../../db/index";
import { knowledgeDocuments } from "../../db/schema";

/**
 * Sotto questa somiglianza la risposta non e' nella documentazione. Il tool
 * ritorna vuoto invece di restituire il documento meno peggio: e' la skill
 * `faq` a dover dire "questo non lo trovo scritto".
 */
const SIMILARITY_FLOOR = 0.35;

export default defineTool({
  description:
    "Cerca nelle policy e nelle informazioni del negozio (cauzione, cancellazione, ritardi, assicurazione, orari, pagamenti). Ricerca semantica: passa la domanda del cliente per intero, in italiano. Se ritorna vuoto, la documentazione non copre l'argomento: dillo, non ricostruire una policy.",
  inputSchema: z.object({
    query: z.string().min(3).describe("La domanda del cliente, per intero."),
    limit: z.number().int().min(1).max(8).default(4),
  }),
  async execute(input) {
    const db = getDb();

    const { embedding } = await embed({
      model: gateway.textEmbeddingModel(
        process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
      ),
      value: input.query,
    });

    const similarity = sql<number>`1 - (${cosineDistance(
      knowledgeDocuments.embedding,
      embedding,
    )})`;

    const rows = await db
      .select({
        title: knowledgeDocuments.title,
        section: knowledgeDocuments.section,
        content: knowledgeDocuments.content,
        similarity,
      })
      .from(knowledgeDocuments)
      .where(gt(similarity, SIMILARITY_FLOOR))
      .orderBy(desc(similarity))
      .limit(input.limit);

    return {
      query: input.query,
      passages: rows.map((row) => ({
        title: row.title,
        section: row.section,
        content: row.content,
        similarity: Number(row.similarity.toFixed(3)),
      })),
      note:
        rows.length === 0
          ? "La documentazione del negozio non copre questa domanda."
          : undefined,
    };
  },
});
