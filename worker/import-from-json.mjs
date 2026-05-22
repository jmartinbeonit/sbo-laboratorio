import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const source = new URL("../data/responses.json", import.meta.url);
const responses = JSON.parse(readFileSync(source, "utf8"));

console.log("BEGIN TRANSACTION;");
for (const response of responses) {
  const id = response.id || randomUUID();
  const createdAt = response.timestamp || new Date().toISOString();
  const payload = JSON.stringify({ ...response, timestamp: createdAt });

  console.log(
    `INSERT OR IGNORE INTO responses (id, created_at, payload) VALUES (` +
      `${sql(id)}, ${sql(createdAt)}, ${sql(payload)});`
  );
}
console.log("COMMIT;");

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
