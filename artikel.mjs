import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";

// ============================================================
// KONFIGURATION — hier anpassen
// ============================================================
const BLOG_PATH = "./src/content/blog"; // Pfad zu deinem Blog-Ordner
const API_KEY = process.env.ANTHROPIC_API_KEY; // API Key aus Umgebungsvariable
// ============================================================

const client = new Anthropic({ apiKey: API_KEY });

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDate() {
  return new Date().toISOString().split("T")[0];
}

async function generateArticle(topic) {
  console.log(`\n✍️  Artikel wird generiert: "${topic}"\n`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Schreibe einen deutschen Blog-Artikel für einen KI-Blog der sich an Anfänger richtet.

Thema: ${topic}

Anforderungen:
- Ton: locker, freundlich, ohne Fachwörter
- Länge: 900-1200 Wörter
- Struktur: Intro (Hook), 3-4 Hauptabschnitte mit ## Überschriften, Fazit
- Konkrete Beispiel-Prompts in Blockquotes (> Prompt hier)
- Am Ende eine kurze FAQ mit 3 Fragen
- Keine Werbung, ehrliche Einschätzungen
- Interne Links am Ende zu: /blog/was-ist-claude-ai und /blog/claude-vs-chatgpt

Gib NUR den Markdown-Inhalt zurück, OHNE Frontmatter (kein --- oben).
Fang direkt mit dem ersten Satz des Artikels an.`,
      },
    ],
  });

  return response.content[0].text;
}

function createFile(topic, content) {
  const slug = slugify(topic);
  const date = getDate();
  const filename = `${slug}.md`;
  const filepath = path.join(BLOG_PATH, filename);

  // Wähle zufällig ein Platzhalterbild (1-5)
  const imgNum = Math.floor(Math.random() * 5) + 1;

  const frontmatter = `---
title: '${topic}'
description: '${topic} — einfach erklärt für KI-Einsteiger.'
pubDate: '${date}'
heroImage: '../../assets/blog-placeholder-${imgNum}.jpg'
---

`;

  fs.writeFileSync(filepath, frontmatter + content, "utf8");
  console.log(`✅ Datei erstellt: ${filepath}`);
  return { slug, filepath };
}

function deployToGit(topic) {
  console.log("\n🚀 Wird auf GitHub gepusht...\n");
  try {
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "neuer artikel: ${topic}"`, { stdio: "inherit" });
    execSync("git push", { stdio: "inherit" });
    console.log("\n✅ Erfolgreich gepusht! Netlify deployed jetzt automatisch.");
    console.log("⏱️  In ~60 Sekunden ist der Artikel live.\n");
  } catch (err) {
    console.error("❌ Git-Fehler:", err.message);
  }
}

async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("   🤖 KI-Blog Artikel Generator");
  console.log("═══════════════════════════════════════\n");

  if (!API_KEY) {
    console.error(
      '❌ Kein API Key gefunden! Setze die Umgebungsvariable ANTHROPIC_API_KEY.\n'
    );
    console.log('Windows: set ANTHROPIC_API_KEY=dein-key-hier');
    console.log('Mac/Linux: export ANTHROPIC_API_KEY=dein-key-hier\n');
    process.exit(1);
  }

  // Thema aus Argument oder interaktiv
  let topic = process.argv[2];
  if (!topic) {
    topic = await ask("📝 Artikel-Thema: ");
  }

  if (!topic.trim()) {
    console.error("❌ Kein Thema angegeben.");
    process.exit(1);
  }

  try {
    // 1. Artikel generieren
    const content = await generateArticle(topic);

    // 2. Datei erstellen
    const { slug } = createFile(topic, content);

    // 3. Vorschau
    console.log("\n📄 Vorschau (erste 300 Zeichen):");
    console.log("─".repeat(40));
    console.log(content.substring(0, 300) + "...");
    console.log("─".repeat(40));

    // 4. Bestätigung vor Push
    const confirm = await ask("\n🚀 Jetzt auf GitHub pushen und live stellen? (j/n): ");

    if (confirm.toLowerCase() === "j") {
      deployToGit(topic);
      console.log(`🌐 Dein Artikel wird live unter: /blog/${slug}/`);
    } else {
      console.log("\n⏸️  Nicht gepusht. Du kannst später manuell pushen:");
      console.log("   git add . && git commit -m 'neuer artikel' && git push\n");
    }
  } catch (err) {
    console.error("❌ Fehler:", err.message);
    process.exit(1);
  }
}

main();
