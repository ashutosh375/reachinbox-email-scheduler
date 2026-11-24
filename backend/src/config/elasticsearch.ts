
import "dotenv/config";
import { Client } from "@elastic/elasticsearch";

export const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200",
});

export const EMAIL_INDEX = "reachinbox-emails";

export async function initializeElasticsearch() {
  const exists = await elasticsearch.indices.exists({
    index: EMAIL_INDEX,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          userId: { type: "keyword" },
          senderEmail: { type: "keyword" },
          recipientEmail: {
            type: "text",
            fields: {
              keyword: { type: "keyword" },
            },
          },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });

    console.log("Elasticsearch email index created");
  } else {
    console.log("Elasticsearch email index already exists");
  }
}

