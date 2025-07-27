import { globby } from "globby";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const banner = (file: string) => `/**
 * 📄 ${path.basename(file)}
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose : ${inferPurpose(file)}
 * Generated : ${new Date().toISOString().split("T")[0]}
 * ------------------------------------------------------
 * DO NOT remove this banner; update "Purpose" if logic changes.
 */
`;

function inferPurpose(file: string) {
  if (file.includes("/components/")) return "React component";
  if (file.includes("/pages/api/"))  return "Next.js API route";
  if (file.endsWith(".sql"))         return "Supabase migration";
  if (file.endsWith(".md"))          return "Documentation";
  return "Utility / Hook / Helper";
}

(async () => {
  const files = await globby([
    "src/**/*.{ts,tsx}",
    "supabase/migrations/**/*.sql",
    "DOC/**/*.md",
    "*.md"
  ], { gitignore: true });

  files.forEach(f => {
    const txt = readFileSync(f, "utf8");
    if (txt.startsWith("/** 📄")) return;          // already has banner
    writeFileSync(f, banner(f) + "\n" + txt);
    console.log("Annotated", f);
  });
})();