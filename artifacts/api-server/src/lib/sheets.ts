/**
 * Google Sheets sync helper.
 * Render version uses Google Sheets REST API with a Google service account.
 *
 * Required environment variables:
 * GOOGLE_SERVICE_ACCOUNT_EMAIL
 * GOOGLE_PRIVATE_KEY
 *
 * Optional environment variable:
 * GOOGLE_SHEET_ID
 */
import { createSign } from "node:crypto";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenariosTable,
  financialInputsTable,
  calculationsTable,
  formulaDefinitionsTable,
  regionalParametersTable,
  auditLogTable,
} from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";
import { calculateROI } from "./calculations";
import { logger } from "./logger";

const DEFAULT_SHEET_ID = "1kysyHbkIsz_G5GbJEnbiuF6Qb4n2VduqsicjIsFP3gs";
const SHEET_ID = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

const INPUT_HEADERS = [
  "Project Name",
  "Region",
  "Category",
  "Investment ($)",
  "Scenario",
  "Year",
  "Revenue ($)",
  "COGS ($)",
  "OPEX ($)",
  "CapEx ($)",
  "Status",
];

const OUTPUT_HEADERS = [
  "Project Name",
  "Region",
  "Category",
  "Investment ($)",
  "Status",
  "Scenario",
  "NPV ($)",
  "IRR (%)",
  "Payback Period (y)",
  "ROI (%)",
  "Total Revenue ($)",
  "Total Cost ($)",
  "Total CapEx ($)",
  "Last Synced (HKT)",
];

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

function getServiceAccountConfig(): { email: string; privateKey: string } {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key.");
    }
    return {
      email: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      "Google Sheets credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Render."
    );
  }

  return {
    email,
    privateKey: normalizePrivateKey(privateKey),
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.token;
  }

  const { email, privateKey } = getServiceAccountConfig();

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();

  const signature = signer.sign(privateKey);
  const assertion = `${unsignedJwt}.${base64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Google OAuth token request failed: ${resp.status} ${text}`);
  }

  const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Google OAuth token response did not include access_token.");
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };

  return cachedToken.token;
}

async function sheetsRequest(
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const token = await getAccessToken();
  const isWrite = method !== "GET";

  const resp = await fetch(`https://sheets.googleapis.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isWrite || body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : isWrite ? "{}" : undefined,
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Google Sheets API ${method} ${path} failed: ${resp.status} ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function normalizeStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "approved" || raw === "approve") return "approved";
  if (raw === "conditional approval" || raw === "conditional_approval" || raw === "conditionally approved" || raw === "conditional") return "conditional_approval";
  if (raw === "review" || raw === "in review" || raw === "finance review") return "review";
  if (raw === "draft") return "draft";
  if (raw === "archived") return "archived";
  if (raw === "rejected" || raw === "reject") return "rejected";

  return "draft";
}

function asText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/[$,%\s,]/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Push all DB inputs and calculation results to the spreadsheet. */
export async function exportToSheets(): Promise<{
  inputRows: number;
  outputRows: number;
}> {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(ne(projectsTable.status, "archived"));

  const inputRows: (string | number)[][] = [INPUT_HEADERS];
  const outputRows: (string | number)[][] = [OUTPUT_HEADERS];
  const now = new Date().toLocaleString("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (const project of projects) {
    const scenarios = await db
      .select()
      .from(scenariosTable)
      .where(eq(scenariosTable.projectId, project.id))
      .orderBy(scenariosTable.id);

    for (const scenario of scenarios) {
      const inputs = await db
        .select()
        .from(financialInputsTable)
        .where(eq(financialInputsTable.scenarioId, scenario.id))
        .orderBy(financialInputsTable.year);

      const [calc] = await db
        .select()
        .from(calculationsTable)
        .where(eq(calculationsTable.scenarioId, scenario.id))
        .orderBy(desc(calculationsTable.calculatedAt))
        .limit(1);

      for (const inp of inputs) {
        const revenue = parseFloat(inp.salesVolume) * parseFloat(inp.netPrice);
        inputRows.push([
          project.name,
          project.region,
          project.productCategory ?? "",
          project.investmentSize ? parseFloat(project.investmentSize) : "",
          scenario.name,
          inp.year,
          +revenue.toFixed(2),
          +parseFloat(inp.cogs).toFixed(2),
          +parseFloat(inp.opex).toFixed(2),
          +parseFloat(inp.capex).toFixed(2),
          project.status,
        ]);
      }

      if (calc) {
        outputRows.push([
          project.name,
          project.region,
          project.productCategory ?? "",
          project.investmentSize ? parseFloat(project.investmentSize) : "",
          project.status,
          scenario.name,
          +parseFloat(calc.npv).toFixed(2),
          calc.irr != null ? +(parseFloat(calc.irr) * 100).toFixed(2) : "",
          calc.paybackPeriod != null
            ? +parseFloat(calc.paybackPeriod).toFixed(2)
            : "",
          calc.roiPercent != null
            ? +parseFloat(calc.roiPercent).toFixed(2)
            : "",
          calc.totalRevenue != null
            ? +parseFloat(calc.totalRevenue).toFixed(2)
            : "",
          calc.totalCost != null ? +parseFloat(calc.totalCost).toFixed(2) : "",
          calc.totalCapex != null
            ? +parseFloat(calc.totalCapex).toFixed(2)
            : "",
          now,
        ]);
      }
    }
  }

  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:K1000:clear`,
    "POST"
  );
  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:K${inputRows.length}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: inputRows }
  );

  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Output!A1:N1000:clear`,
    "POST"
  );
  await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Output!A1:N${outputRows.length}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: outputRows }
  );

  logger.info(
    { inputRows: inputRows.length - 1, outputRows: outputRows.length - 1 },
    "Exported to Google Sheets"
  );
  return { inputRows: inputRows.length - 1, outputRows: outputRows.length - 1 };
}

/** Retry a DB operation on transient connection errors with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4
): Promise<T> {
  const TRANSIENT = [
    "terminating connection",
    "connection terminated",
    "connection timeout",
    "connection lost",
    "client was closed",
    "the database system is",
  ];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient = TRANSIENT.some((t) => msg.includes(t));
      if (isTransient && attempt < maxAttempts) {
        const delay = 500 * 2 ** (attempt - 1); // 500ms, 1s, 2s
        logger.warn({ attempt, delay, label }, "Transient DB error — retrying");
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  /* istanbul ignore next */
  throw new Error("withRetry: unreachable");
}

/** Read the Input sheet and upsert financial data, then recalculate every touched scenario. */
export async function importFromSheets(): Promise<{
  updated: number;
  calculated: number;
  errors: string[];
}> {
  const raw = (await sheetsRequest(
    `/v4/spreadsheets/${SHEET_ID}/values/Input!A1:K1000?valueRenderOption=UNFORMATTED_VALUE`
  )) as { values?: unknown[][] };
  const rows: unknown[][] = raw.values ?? [];

  if (rows.length <= 1) {
    return { updated: 0, calculated: 0, errors: [] };
  }

  const dataRows = rows
    .slice(1)
    .filter((r) => r.length >= 10 && asText(r[0]) && asText(r[4]) && asText(r[5]));

  type YearEntry = {
    year: number;
    revenue: number;
    cogs: number;
    opex: number;
    capex: number;
  };

  type ScenarioMap = Map<string, YearEntry[]>;

  type ProjectEntry = {
    region: string;
    category: string;
    investment: string;
    status: string;
    scenarios: ScenarioMap;
  };

  const projectMap = new Map<string, ProjectEntry>();

  for (const row of dataRows) {
    const projectName = asText(row[0]);
    const region = asText(row[1]) || "NA";
    const category = asText(row[2]);
    const investment = asText(row[3]);
    const scenarioName = asText(row[4]) || "Baseline";
    const year = Math.trunc(asNumber(row[5]));
    const revenue = asNumber(row[6]);
    const cogs = asNumber(row[7]);
    const opex = asNumber(row[8]);
    const capex = asNumber(row[9]);
    const status = normalizeStatus(row[10]);

    if (!projectName || isNaN(year) || year < 1) continue;

    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, {
        region,
        category,
        investment,
        status,
        scenarios: new Map(),
      });
    }

    const pd = projectMap.get(projectName)!;
    if (!pd.scenarios.has(scenarioName)) pd.scenarios.set(scenarioName, []);

    pd.scenarios.get(scenarioName)!.push({
      year,
      revenue,
      cogs,
      opex,
      capex,
    });
  }

  const [formula] = await withRetry(
    () => db.select().from(formulaDefinitionsTable).orderBy(desc(formulaDefinitionsTable.version)).limit(1),
    "fetch formula"
  );
  const defaultWacc = formula ? parseFloat(formula.wacc) : 0.1;

  const errors: string[] = [];
  let updated = 0;
  let calculated = 0;

  for (const [projectName, pd] of projectMap) {
    try {
      const existingProjects = await withRetry(
        () => db.select().from(projectsTable).where(eq(projectsTable.name, projectName)),
        `find project "${projectName}"`
      );

      let project = existingProjects.find((p) => p.status !== "archived") ?? existingProjects[0];
      const inv = pd.investment ? asNumber(pd.investment) : null;

      if (!project) {
        [project] = await withRetry(
          () =>
            db
              .insert(projectsTable)
              .values({
                name: projectName,
                region: pd.region || "NA",
                productCategory: pd.category || null,
                investmentSize: inv != null ? String(inv) : null,
                status: pd.status,
                createdBy: "sheets-import",
                description: "Imported from Google Sheets",
              })
              .returning(),
          `create project "${projectName}"`
        );
      } else {
        [project] = await withRetry(
          () =>
            db
              .update(projectsTable)
              .set({
                region: pd.region || project.region,
                productCategory: pd.category || project.productCategory,
                investmentSize: inv != null ? String(inv) : project.investmentSize,
                status: pd.status || project.status,
              })
              .where(eq(projectsTable.id, project.id))
              .returning(),
          `update project "${projectName}"`
        );
      }

      const [regional] = await withRetry(
        () => db.select().from(regionalParametersTable).where(eq(regionalParametersTable.region, project.region)),
        `fetch regional "${project.region}"`
      );
      const taxRate = regional ? parseFloat(regional.taxRate) : 0.25;

      for (const [scenarioName, yearInputs] of pd.scenarios) {
        const label = `"${scenarioName}" in "${projectName}"`;

        try {
          await withRetry(async () => {
            await db.transaction(async (tx) => {
              const allScenarios = await tx
                .select()
                .from(scenariosTable)
                .where(eq(scenariosTable.projectId, project.id));

              let scenario =
                allScenarios.find((s) => s.name.toLowerCase() === scenarioName.toLowerCase()) ?? null;

              const lifecycleYears = Math.max(...yearInputs.map((y) => y.year));

              if (!scenario) {
                [scenario] = await tx
                  .insert(scenariosTable)
                  .values({
                    projectId: project.id,
                    name: scenarioName,
                    lifecycleYears,
                    isBaseline: allScenarios.length === 0 || scenarioName.toLowerCase() === "baseline" ? "true" : "false",
                    assumptionsSummary: "Imported from Google Sheets",
                  })
                  .returning();
              }

              const existingInputs = await tx
                .select()
                .from(financialInputsTable)
                .where(eq(financialInputsTable.scenarioId, scenario.id));

              for (const yd of yearInputs) {
                const existing = existingInputs.find((r) => r.year === yd.year);

                const vals = {
                  salesVolume: yd.revenue.toFixed(2),
                  netPrice: "1",
                  cogs: yd.cogs.toFixed(2),
                  opex: yd.opex.toFixed(2),
                  capex: yd.capex.toFixed(2),
                };

                if (existing) {
                  await tx
                    .update(financialInputsTable)
                    .set(vals)
                    .where(
                      and(
                        eq(financialInputsTable.scenarioId, scenario.id),
                        eq(financialInputsTable.year, yd.year)
                      )
                    );
                } else {
                  await tx
                    .insert(financialInputsTable)
                    .values({ scenarioId: scenario.id, year: yd.year, ...vals });
                }
              }

              const allInputs = await tx
                .select()
                .from(financialInputsTable)
                .where(eq(financialInputsTable.scenarioId, scenario.id))
                .orderBy(financialInputsTable.year);

              if (allInputs.length > 0) {
                const mapped = allInputs.map((i) => ({
                  year: i.year,
                  salesVolume: parseFloat(i.salesVolume),
                  netPrice: parseFloat(i.netPrice),
                  cogs: parseFloat(i.cogs),
                  opex: parseFloat(i.opex),
                  capex: parseFloat(i.capex),
                }));

                const result = calculateROI(mapped, defaultWacc, taxRate);

                await tx.delete(calculationsTable).where(eq(calculationsTable.scenarioId, scenario.id));

                await tx.insert(calculationsTable).values({
                  scenarioId: scenario.id,
                  npv: result.npv.toFixed(2),
                  irr: result.irr != null ? result.irr.toFixed(6) : null,
                  paybackPeriod: result.paybackPeriod != null ? result.paybackPeriod.toFixed(4) : null,
                  roiPercent: result.roiPercent != null ? result.roiPercent.toFixed(4) : null,
                  totalRevenue: result.totalRevenue.toFixed(2),
                  totalCost: result.totalCost.toFixed(2),
                  totalCogs: result.totalCogs.toFixed(2),
                  totalCapex: result.totalCapex.toFixed(2),
                  cashFlows: JSON.stringify(result.cashFlows),
                });

                await tx.insert(auditLogTable).values({
                  tableName: "calculations",
                  recordId: project.id,
                  fieldName: "sheets_import",
                  oldValue: null,
                  newValue: `NPV: ${result.npv.toFixed(2)}`,
                  changedBy: "sheets-import",
                });
              }
            });
          }, label);

          updated++;
          calculated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
          errors.push(`Scenario ${label}: ${msg}`);
          logger.error({ err }, "Sheets import: scenario error");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      errors.push(`Project "${projectName}": ${msg}`);
      logger.error({ err }, "Sheets import: project error");
    }
  }

  logger.info({ updated, calculated, errors: errors.length }, "Imported from Google Sheets");
  return { updated, calculated, errors };
}
