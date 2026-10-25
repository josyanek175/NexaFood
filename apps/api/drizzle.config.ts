import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Used only by drizzle-kit locally; never expose to the web app.
    url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5432/nexafood",
  },
  strict: true,
  verbose: true,
});
