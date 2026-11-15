import { db, migrate } from "./db";
import { assertReviewDatabase, reviewEnabled } from "./review";
Promise.resolve()
  .then(async () => {
    if (reviewEnabled()) await assertReviewDatabase(db);
    await migrate();
  })
  .then(() => {
    console.log("Migrations appliquées");
    return db.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
    return db.end();
  });
