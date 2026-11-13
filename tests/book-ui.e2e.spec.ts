import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
async function unlock(page: Page) {
  await page
    .getByRole("button", { name: "Tresor entsperren", exact: true })
    .click();
  await page
    .getByLabel("Kennwort", { exact: true })
    .fill("Writely Testvektor Grüße 2026");
  await page.getByRole("button", { name: "Entsperren", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  const text = await readFile("tests/fixtures/sealed-v1.writely", "utf8");
  await page.addInitScript((text) => {
    if (!localStorage.getItem("writely.sealed.workspace.v1"))
      localStorage.setItem("writely.sealed.workspace.v1", text);
    localStorage.setItem("writely.sealed.background", "false");
  }, text);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/?mobile=1");
  await unlock(page);
  await page
    .getByLabel("Bibliotheksansicht", { exact: true })
    .selectOption("books");
});
async function createBook(page: Page) {
  await page
    .getByRole("button", { name: "Neues Buchprojekt", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Buchprojekt erstellen",
    exact: true,
  });
  await dialog
    .getByLabel("Buchtitel", { exact: true })
    .fill("Die violette Stadt");
  await dialog.getByLabel("Autor", { exact: true }).fill("Erika Muster");
  await dialog
    .getByLabel("Private Projektnotizen")
    .fill("Niemals im Manuskript veröffentlichen");
  await dialog
    .getByRole("button", { name: "Buchprojekt erstellen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Die violette Stadt", exact: true }),
  ).toBeVisible();
}
async function newEntry(
  page: Page,
  title: string,
  kind = "chapter",
  parent?: string,
) {
  await page
    .getByRole("button", { name: "Neuer Eintrag", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Manuskripteintrag erstellen",
  });
  await dialog.getByLabel("Eintragsart").selectOption(kind);
  await dialog.getByLabel("Eintragstitel").fill(title);
  await dialog
    .getByLabel("Zusammenfassung", { exact: true })
    .fill("Eine Szene in Köln.");
  if (parent)
    await dialog
      .getByLabel("Übergeordneter Eintrag")
      .selectOption({ label: parent });
  await dialog
    .getByRole("button", { name: "Eintrag erstellen", exact: true })
    .click();
}
test("phone book creation, chapter editing, scenes and encrypted reload use real shared editor/storage", async ({
  page,
}) => {
  await createBook(page);
  await newEntry(page, "Ankunft");
  await expect(page.locator(".secure-prose")).toBeVisible();
  await page
    .locator(".secure-prose")
    .fill("Grüße aus Köln. Die Straße glitzert. 🪶");
  await expect(page.getByRole("status")).toContainText(
    "Verschlüsselt gespeichert",
  );
  await page
    .getByRole("button", { name: "Zur Projektübersicht", exact: true })
    .click();
  await newEntry(page, "Am Fluss", "scene", "Ankunft");
  await page.locator(".secure-prose").fill("Sie wartet am Ufer.");
  await page
    .getByRole("button", { name: "Zur Projektübersicht", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Projektübersicht" }),
  ).toContainText("1Kapitel");
  await page.getByRole("button", { name: "Gliederung", exact: true }).click();
  const outline = page.getByRole("region", { name: "Gliederungsansicht" });
  await expect(outline).toContainText("Ankunft");
  await expect(outline).toContainText("Am Fluss");
  await page
    .getByRole("button", { name: "Zur Bücherübersicht", exact: true })
    .click();
  await page.reload();
  await unlock(page);
  await page
    .getByLabel("Bibliotheksansicht", { exact: true })
    .selectOption("books");
  await page
    .locator(".book-project-open")
    .filter({ hasText: "Die violette Stadt" })
    .click();
  await page.getByRole("button", { name: /Weiterschreiben: Am Fluss/ }).click();
  await expect(page.locator(".secure-prose")).toContainText(
    "Sie wartet am Ufer.",
  );
  const stored = await page.evaluate(async () => {
    const request = indexedDB.open("writely.book-blocks.v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("blocks", "readonly"),
      q = tx.objectStore("blocks").getAll();
    return new Promise<string>((resolve, reject) => {
      q.onsuccess = () => resolve(JSON.stringify(q.result));
      q.onerror = () => reject(q.error);
    });
  });
  expect(stored).not.toContain("Sie wartet");
  expect(stored).not.toContain("Die violette Stadt");
  expect(stored).not.toContain("Niemals im Manuskript");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir("work/books-project", { recursive: true });
  await page.screenshot({ path: "work/books-project/phone-editor.png" });
});
test("tablet cards reorder and restore complete chapter trees", async ({
  page,
}) => {
  await createBook(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await newEntry(page, "Kapitel Eins");
  await page
    .getByRole("button", { name: "Zur Projektübersicht", exact: true })
    .click();
  await newEntry(page, "Kapitel Zwei");
  await page
    .getByRole("button", { name: "Zur Projektübersicht", exact: true })
    .click();
  await page.getByRole("button", { name: "Karteikarten", exact: true }).click();
  const cards = page.getByRole("region", { name: "Karteikarten" });
  await cards
    .getByRole("button", { name: "Kapitel Zwei nach oben", exact: true })
    .click();
  await expect(cards.locator(".book-card-open").first()).toContainText(
    "Kapitel Zwei",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await cards
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Kapitel Eins", exact: true }),
    })
    .getByRole("button", { name: "Papierkorb", exact: true })
    .click();
  await expect(cards).not.toContainText("Kapitel Eins");
  await page
    .getByRole("button", { name: "Projektpapierkorb", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Projektpapierkorb" })
    .getByRole("button", { name: "Eintrag wiederherstellen", exact: true })
    .click();
  await page.getByRole("button", { name: "Karteikarten", exact: true }).click();
  await expect(cards).toContainText("Kapitel Eins");
  await mkdir("work/books-project", { recursive: true });
  await page.screenshot({ path: "work/books-project/tablet-cards.png" });
});
test("native back closes editor actions before returning to project and named snapshots restore text", async ({
  page,
}) => {
  await createBook(page);
  await newEntry(page, "Anfang");
  await page.locator(".secure-prose").fill("Erster Entwurf.");
  await page
    .getByRole("button", { name: "Dokumentaktionen", exact: true })
    .click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("writely:back", { cancelable: true })),
  );
  await expect(page.locator(".writing-menu")).toHaveCount(0);
  await expect(page.locator(".secure-prose")).toBeVisible();
  await page
    .getByRole("button", { name: "Dokumentaktionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kapitelversionen", exact: true })
    .click();
  const versions = page.getByRole("dialog", {
    name: "Kapitelversionen",
    exact: true,
  });
  await versions.getByLabel("Sicherungsname").fill("Vor Überarbeitung");
  await versions
    .getByRole("button", { name: "Schnappschuss speichern", exact: true })
    .click();
  await expect(versions.getByLabel("Gesicherte Kapitelversion")).toContainText(
    "Vor Überarbeitung",
  );
  await versions
    .getByRole("button", { name: "Schließen", exact: true })
    .click();
  await page.locator(".secure-prose").fill("Zweiter Entwurf mit Änderungen.");
  await page
    .getByRole("button", { name: "Dokumentaktionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kapitelversionen", exact: true })
    .click();
  await versions
    .getByRole("button", { name: "Textvorschau öffnen", exact: true })
    .click();
  await expect(versions.getByLabel("Textvorschau")).toContainText(
    "Erster Entwurf.",
  );
  page.once("dialog", (d) => d.accept());
  await versions
    .getByRole("button", {
      name: "Kapitelversion wiederherstellen",
      exact: true,
    })
    .click();
  await expect(page.locator(".secure-prose")).toContainText("Erster Entwurf.");
});
test("Windows start screen exposes books through the same encrypted workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bücher", exact: true }).click();
  await unlock(page);
  await expect(
    page.getByRole("region", { name: "Buchprojekte" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zur Windows-Bibliothek", exact: true })
    .click();
  await expect(page.locator(".library-shell")).toBeVisible();
});
