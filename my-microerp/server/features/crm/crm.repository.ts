import {
  CompanySchema,
  ContactSchema,
  OpportunitySchema,
  PipelineSchema,
  StageSchema,
  ActivitySchema,
} from '../../../shared/crm/schemas.js';
import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  Pipeline,
  Stage,
  Activity,
  InsightsResponse,
  FunnelStageReport,
  ForecastMonth,
  OwnerPerformance,
  LostReason,
  CreateCompanyBody,
  UpdateCompanyBody,
  CreateContactBody,
  UpdateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
  ReorderOpportunitiesBody,
  CreatePipelineBody,
  UpdatePipelineBody,
  CreateStageBody,
  UpdateStageBody,
  ReorderStagesBody,
  CreateActivityBody,
  UpdateActivityBody,
} from '../../../shared/crm/types.js';
import { AppError } from '../../lib/errors.js';
import type { DbClient } from '../../lib/db.js';

const SETUP_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS crm`;

const CREATE_COMPANIES_SQL = `
  CREATE TABLE IF NOT EXISTS crm.companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer','supplier','both')),
    tax_id TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
const CREATE_CONTACTS_SQL = `
  CREATE TABLE IF NOT EXISTS crm.contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES crm.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
const CREATE_PIPELINES_SQL = `
  CREATE TABLE IF NOT EXISTS crm.pipelines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
const CREATE_STAGES_SQL = `
  CREATE TABLE IF NOT EXISTS crm.stages (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER NOT NULL REFERENCES crm.pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    probability INTEGER NOT NULL DEFAULT 100 CHECK (probability BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
const CREATE_OPPORTUNITIES_SQL = `
  CREATE TABLE IF NOT EXISTS crm.opportunities (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES crm.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','proposal','won','lost')),
    amount NUMERIC(14,2),
    owner TEXT,
    expected_close DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
// Colunas v2 adicionadas de forma idempotente (tabela pode já existir do v1).
const ALTER_OPPORTUNITIES_SQL = `
  ALTER TABLE crm.opportunities
    ADD COLUMN IF NOT EXISTS pipeline_id INTEGER REFERENCES crm.pipelines(id),
    ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES crm.stages(id),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
    ADD COLUMN IF NOT EXISTS lost_reason TEXT,
    ADD COLUMN IF NOT EXISTS sort_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ
`;
const CREATE_ACTIVITIES_SQL = `
  CREATE TABLE IF NOT EXISTS crm.activities (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES crm.opportunities(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call','email','meeting','task','note')),
    subject TEXT NOT NULL,
    notes TEXT,
    due_date TIMESTAMPTZ,
    done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// Funil padrão semeado quando não há nenhum pipeline.
const DEFAULT_STAGES: { name: string; probability: number }[] = [
  { name: 'Lead', probability: 20 },
  { name: 'Qualificado', probability: 40 },
  { name: 'Proposta', probability: 60 },
  { name: 'Negociação', probability: 80 },
];

const COMPANY_COLS = `id, name, type, tax_id, email, phone, notes, created_at::text`;
const CONTACT_COLS = `id, company_id, name, role, email, phone, created_at::text`;
const STAGE_COLS = `id, pipeline_id, name, position, probability, created_at::text`;
const ACTIVITY_COLS = `id, opportunity_id, type, subject, notes, due_date::text, done, created_at::text`;

// Opportunity com joins de company + stage (company_name, stage_name, probability).
const OPP_COLS = `
  o.id, o.company_id, c.name AS company_name, o.title,
  o.pipeline_id, o.stage_id, s.name AS stage_name, s.probability,
  o.status, o.amount::float8 AS amount, o.owner, o.lost_reason, o.sort_index,
  o.expected_close::text, o.stage_changed_at::text, o.won_at::text, o.lost_at::text, o.created_at::text`;
const OPP_FROM = `FROM crm.opportunities o
  JOIN crm.companies c ON c.id = o.company_id
  JOIN crm.stages s ON s.id = o.stage_id`;

// Postgres FK violation code
const FK_VIOLATION = '23503';

export class CrmRepository {
  constructor(private readonly db: DbClient) {}

  async ensureSchema(): Promise<void> {
    try {
      await this.db.query(SETUP_SCHEMA_SQL);
      await this.db.query(CREATE_COMPANIES_SQL);
      await this.db.query(CREATE_CONTACTS_SQL);
      await this.db.query(CREATE_PIPELINES_SQL);
      await this.db.query(CREATE_STAGES_SQL);
      await this.db.query(CREATE_OPPORTUNITIES_SQL);
      await this.db.query(ALTER_OPPORTUNITIES_SQL);
      await this.db.query(CREATE_ACTIVITIES_SQL);
      await this.seedDefaultPipeline();
      await this.backfillOpportunities();
      console.log('[crm] Ensured schema, tables and default pipeline');
    } catch (err) {
      console.warn('[crm] Database setup failed:', (err as Error).message);
      console.warn('[crm] Routes will be registered but may return errors');
    }
  }

  /** Cria o funil padrão e seus estágios apenas se não houver nenhum pipeline. */
  private async seedDefaultPipeline(): Promise<void> {
    const { rows } = await this.db.query<{ id: number }>(
      `INSERT INTO crm.pipelines (name, position)
       SELECT 'Funil de Vendas', 0
       WHERE NOT EXISTS (SELECT 1 FROM crm.pipelines)
       RETURNING id`
    );
    const pipelineId = rows[0]?.id;
    if (pipelineId === undefined) return; // já existia algum pipeline
    for (let i = 0; i < DEFAULT_STAGES.length; i++) {
      const s = DEFAULT_STAGES[i];
      await this.db.query(`INSERT INTO crm.stages (pipeline_id, name, position, probability) VALUES ($1, $2, $3, $4)`, [
        pipelineId,
        s.name,
        i,
        s.probability,
      ]);
    }
  }

  /** Mapeia oportunidades v1 (enum stage) para stage_id/status do funil padrão. */
  private async backfillOpportunities(): Promise<void> {
    await this.db.query(
      `UPDATE crm.opportunities o SET
         pipeline_id = dp.id,
         stage_id = COALESCE(
           (SELECT s.id FROM crm.stages s
              WHERE s.pipeline_id = dp.id AND s.name = CASE o.stage
                WHEN 'qualified' THEN 'Qualificado'
                WHEN 'proposal'  THEN 'Proposta'
                ELSE 'Lead' END
              ORDER BY s.position LIMIT 1),
           (SELECT id FROM crm.stages WHERE pipeline_id = dp.id ORDER BY position LIMIT 1)
         ),
         status = CASE o.stage WHEN 'won' THEN 'won' WHEN 'lost' THEN 'lost' ELSE 'open' END
       FROM (SELECT id FROM crm.pipelines ORDER BY position, id LIMIT 1) dp
       WHERE o.stage_id IS NULL`
    );
  }

  // ── Companies ────────────────────────────────────────────
  async findCompanies(type?: CompanyType): Promise<Company[]> {
    let sql = `SELECT ${COMPANY_COLS} FROM crm.companies`;
    const params: unknown[] = [];
    if (type === 'customer' || type === 'supplier') {
      sql += ` WHERE type IN ($1, 'both')`;
      params.push(type);
    } else if (type === 'both') {
      sql += ` WHERE type = 'both'`;
    }
    sql += ` ORDER BY name ASC`;
    const { rows } = await this.db.query(sql, params);
    return rows.map((r) => CompanySchema.parse(r));
  }

  async createCompany(body: CreateCompanyBody): Promise<Company> {
    const { rows } = await this.db.query(
      `INSERT INTO crm.companies (name, type, tax_id, email, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COMPANY_COLS}`,
      [body.name, body.type, body.tax_id ?? null, body.email ?? null, body.phone ?? null, body.notes ?? null]
    );
    return CompanySchema.parse(rows[0]);
  }

  async updateCompany(id: number, body: UpdateCompanyBody): Promise<Company> {
    const { rows } = await this.db.query(
      `UPDATE crm.companies SET
         name   = COALESCE($2, name),
         type   = COALESCE($3, type),
         tax_id = COALESCE($4, tax_id),
         email  = COALESCE($5, email),
         phone  = COALESCE($6, phone),
         notes  = COALESCE($7, notes)
       WHERE id = $1
       RETURNING ${COMPANY_COLS}`,
      [
        id,
        body.name ?? null,
        body.type ?? null,
        body.tax_id ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.notes ?? null,
      ]
    );
    if (rows.length === 0) throw new AppError(404, 'Company not found');
    return CompanySchema.parse(rows[0]);
  }

  /** Conta títulos AR/AP vinculados; tolera schemas ainda inexistentes. */
  async countLinkedRecords(companyId: number): Promise<number> {
    const { rows } = await this.db
      .query<{ n: string }>(
        `SELECT
         COALESCE((SELECT COUNT(*) FROM ar.receivables WHERE customer_id = $1), 0) +
         COALESCE((SELECT COUNT(*) FROM ap.payables   WHERE supplier_id = $1), 0) AS n`,
        [companyId]
      )
      .catch(async () => {
        let n = 0;
        for (const [schema, table, col] of [
          ['ar', 'receivables', 'customer_id'],
          ['ap', 'payables', 'supplier_id'],
        ] as const) {
          const reg = await this.db.query<{ exists: string | null }>(`SELECT to_regclass($1) AS exists`, [
            `${schema}.${table}`,
          ]);
          if (reg.rows[0]?.exists) {
            const c = await this.db.query<{ n: string }>(
              `SELECT COUNT(*) AS n FROM ${schema}.${table} WHERE ${col} = $1`,
              [companyId]
            );
            n += Number(c.rows[0]?.n ?? 0);
          }
        }
        return { rows: [{ n: String(n) }] };
      });
    return Number(rows[0]?.n ?? 0);
  }

  async deleteCompany(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.companies WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Company not found');
  }

  async companyExists(id: number): Promise<boolean> {
    const { rows } = await this.db.query(`SELECT 1 FROM crm.companies WHERE id = $1`, [id]);
    return rows.length > 0;
  }

  // ── Contacts ─────────────────────────────────────────────
  async findContacts(companyId?: number): Promise<Contact[]> {
    let sql = `SELECT ${CONTACT_COLS} FROM crm.contacts`;
    const params: unknown[] = [];
    if (companyId !== undefined) {
      sql += ` WHERE company_id = $1`;
      params.push(companyId);
    }
    sql += ` ORDER BY name ASC`;
    const { rows } = await this.db.query(sql, params);
    return rows.map((r) => ContactSchema.parse(r));
  }

  async createContact(body: CreateContactBody): Promise<Contact> {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO crm.contacts (company_id, name, role, email, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${CONTACT_COLS}`,
        [body.company_id, body.name, body.role ?? null, body.email ?? null, body.phone ?? null]
      );
      return ContactSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Company not found');
      throw err;
    }
  }

  async updateContact(id: number, body: UpdateContactBody): Promise<Contact> {
    const { rows } = await this.db.query(
      `UPDATE crm.contacts SET
         name  = COALESCE($2, name),
         role  = COALESCE($3, role),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone)
       WHERE id = $1
       RETURNING ${CONTACT_COLS}`,
      [id, body.name ?? null, body.role ?? null, body.email ?? null, body.phone ?? null]
    );
    if (rows.length === 0) throw new AppError(404, 'Contact not found');
    return ContactSchema.parse(rows[0]);
  }

  async deleteContact(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.contacts WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Contact not found');
  }

  // ── Pipelines & Stages ───────────────────────────────────
  async findPipelines(): Promise<Pipeline[]> {
    const { rows: pRows } = await this.db.query(
      `SELECT id, name, position, created_at::text FROM crm.pipelines ORDER BY position ASC, id ASC`
    );
    const { rows: sRows } = await this.db.query(`SELECT ${STAGE_COLS} FROM crm.stages ORDER BY position ASC, id ASC`);
    const stages = sRows.map((r) => StageSchema.parse(r));
    return pRows.map((p) =>
      PipelineSchema.parse({ ...p, stages: stages.filter((s) => s.pipeline_id === (p as { id: number }).id) })
    );
  }

  async createPipeline(body: CreatePipelineBody): Promise<Pipeline> {
    const { rows } = await this.db.query<{ id: number; name: string; position: number; created_at: string }>(
      `INSERT INTO crm.pipelines (name, position)
       VALUES ($1, COALESCE((SELECT MAX(position) + 1 FROM crm.pipelines), 0))
       RETURNING id, name, position, created_at::text`,
      [body.name]
    );
    return PipelineSchema.parse({ ...rows[0], stages: [] });
  }

  async updatePipeline(id: number, body: UpdatePipelineBody): Promise<Pipeline> {
    const { rows } = await this.db.query(
      `UPDATE crm.pipelines SET
         name = COALESCE($2, name),
         position = COALESCE($3, position)
       WHERE id = $1
       RETURNING id`,
      [id, body.name ?? null, body.position ?? null]
    );
    if (rows.length === 0) throw new AppError(404, 'Pipeline not found');
    const pipelines = await this.findPipelines();
    const found = pipelines.find((p) => p.id === id);
    if (!found) throw new AppError(404, 'Pipeline not found');
    return found;
  }

  async countPipelines(): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM crm.pipelines`);
    return Number(rows[0]?.n ?? 0);
  }

  async deletePipeline(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.pipelines WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Pipeline not found');
  }

  async createStage(body: CreateStageBody): Promise<Stage> {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO crm.stages (pipeline_id, name, position, probability)
         VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM crm.stages WHERE pipeline_id = $1), 0), $3)
         RETURNING ${STAGE_COLS}`,
        [body.pipeline_id, body.name, body.probability ?? 100]
      );
      return StageSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Pipeline not found');
      throw err;
    }
  }

  async updateStage(id: number, body: UpdateStageBody): Promise<Stage> {
    const { rows } = await this.db.query(
      `UPDATE crm.stages SET
         name = COALESCE($2, name),
         probability = COALESCE($3, probability),
         position = COALESCE($4, position)
       WHERE id = $1
       RETURNING ${STAGE_COLS}`,
      [id, body.name ?? null, body.probability ?? null, body.position ?? null]
    );
    if (rows.length === 0) throw new AppError(404, 'Stage not found');
    return StageSchema.parse(rows[0]);
  }

  async reorderStages(body: ReorderStagesBody): Promise<void> {
    const ids = body.items.map((i) => i.id);
    const positions = body.items.map((i) => i.position);
    await this.db.query(
      `UPDATE crm.stages AS s SET position = v.position
       FROM (SELECT * FROM UNNEST($1::int[], $2::int[]) AS t(id, position)) v
       WHERE s.id = v.id`,
      [ids, positions]
    );
  }

  async countOpportunitiesInStage(stageId: number): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM crm.opportunities WHERE stage_id = $1`,
      [stageId]
    );
    return Number(rows[0]?.n ?? 0);
  }

  async countStagesInPipeline(pipelineId: number): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM crm.stages WHERE pipeline_id = $1`, [
      pipelineId,
    ]);
    return Number(rows[0]?.n ?? 0);
  }

  async deleteStage(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.stages WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Stage not found');
  }

  // ── Opportunities ────────────────────────────────────────
  async findOpportunities(pipelineId?: number, status?: string, companyId?: number): Promise<Opportunity[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (pipelineId !== undefined) {
      params.push(pipelineId);
      where.push(`o.pipeline_id = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }
    if (companyId !== undefined) {
      params.push(companyId);
      where.push(`o.company_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT ${OPP_COLS} ${OPP_FROM} ${whereSql}
       ORDER BY s.position ASC, o.sort_index ASC, o.created_at DESC`,
      params
    );
    return rows.map((r) => OpportunitySchema.parse(r));
  }

  async getOpportunityById(id: number): Promise<Opportunity> {
    const { rows } = await this.db.query(`SELECT ${OPP_COLS} ${OPP_FROM} WHERE o.id = $1`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Opportunity not found');
    return OpportunitySchema.parse(rows[0]);
  }

  /** Resolve (pipeline_id, stage_id) a partir do body, com fallback no funil padrão. */
  private async resolvePlacement(
    pipelineId?: number,
    stageId?: number
  ): Promise<{ pipeline_id: number; stage_id: number }> {
    if (stageId !== undefined) {
      const { rows } = await this.db.query<{ pipeline_id: number }>(
        `SELECT pipeline_id FROM crm.stages WHERE id = $1`,
        [stageId]
      );
      if (rows.length === 0) throw new AppError(400, 'Stage not found');
      return { pipeline_id: rows[0].pipeline_id, stage_id: stageId };
    }
    const { rows: pRows } = await this.db.query<{ id: number }>(
      pipelineId !== undefined
        ? `SELECT id FROM crm.pipelines WHERE id = $1`
        : `SELECT id FROM crm.pipelines ORDER BY position, id LIMIT 1`,
      pipelineId !== undefined ? [pipelineId] : []
    );
    if (pRows.length === 0) throw new AppError(400, 'Pipeline not found');
    const pid = pRows[0].id;
    const { rows: sRows } = await this.db.query<{ id: number }>(
      `SELECT id FROM crm.stages WHERE pipeline_id = $1 ORDER BY position, id LIMIT 1`,
      [pid]
    );
    if (sRows.length === 0) throw new AppError(400, 'Pipeline has no stages');
    return { pipeline_id: pid, stage_id: sRows[0].id };
  }

  async createOpportunity(body: CreateOpportunityBody): Promise<Opportunity> {
    const placement = await this.resolvePlacement(body.pipeline_id, body.stage_id);
    try {
      const { rows } = await this.db.query<{ id: number }>(
        `INSERT INTO crm.opportunities
           (company_id, title, stage, pipeline_id, stage_id, status, amount, owner, expected_close, sort_index)
         VALUES ($1, $2, 'lead', $3, $4, 'open', $5, $6, $7,
           COALESCE((SELECT MAX(sort_index) + 1 FROM crm.opportunities WHERE stage_id = $4), 0))
         RETURNING id`,
        [
          body.company_id,
          body.title,
          placement.pipeline_id,
          placement.stage_id,
          body.amount ?? null,
          body.owner ?? null,
          body.expected_close ?? null,
        ]
      );
      return this.getOpportunityById(rows[0].id);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Company not found');
      throw err;
    }
  }

  async updateOpportunity(id: number, body: UpdateOpportunityBody): Promise<Opportunity> {
    // Se mudar de pipeline sem informar stage, recoloca no primeiro estágio do novo funil.
    let stageId = body.stage_id;
    if (stageId === undefined && body.pipeline_id !== undefined) {
      const placement = await this.resolvePlacement(body.pipeline_id, undefined);
      stageId = placement.stage_id;
    }
    try {
      const { rows } = await this.db.query<{ id: number }>(
        `UPDATE crm.opportunities SET
           company_id     = COALESCE($2, company_id),
           title          = COALESCE($3, title),
           pipeline_id    = COALESCE($4, pipeline_id),
           stage_id       = COALESCE($5, stage_id),
           status         = COALESCE($6, status),
           lost_reason    = CASE WHEN $6 = 'lost' THEN $7 WHEN $6 IN ('open','won') THEN NULL ELSE COALESCE($7, lost_reason) END,
           sort_index     = COALESCE($8, sort_index),
           amount         = COALESCE($9, amount),
           owner          = COALESCE($10, owner),
           expected_close = COALESCE($11, expected_close),
           stage_changed_at = CASE WHEN $5 IS NOT NULL AND $5 <> stage_id THEN NOW() ELSE stage_changed_at END,
           won_at  = CASE WHEN $6 = 'won' THEN NOW() WHEN $6 IN ('open','lost') THEN NULL ELSE won_at END,
           lost_at = CASE WHEN $6 = 'lost' THEN NOW() WHEN $6 IN ('open','won') THEN NULL ELSE lost_at END
         WHERE id = $1
         RETURNING id`,
        [
          id,
          body.company_id ?? null,
          body.title ?? null,
          body.pipeline_id ?? null,
          stageId ?? null,
          body.status ?? null,
          body.lost_reason ?? null,
          body.sort_index ?? null,
          body.amount ?? null,
          body.owner ?? null,
          body.expected_close ?? null,
        ]
      );
      if (rows.length === 0) throw new AppError(404, 'Opportunity not found');
      return this.getOpportunityById(rows[0].id);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Invalid stage or company');
      throw err;
    }
  }

  async reorderOpportunities(body: ReorderOpportunitiesBody): Promise<void> {
    const ids = body.items.map((i) => i.id);
    const stageIds = body.items.map((i) => i.stage_id);
    const sortIdx = body.items.map((i) => i.sort_index);
    await this.db.query(
      `UPDATE crm.opportunities AS o SET
         sort_index = v.sort_index,
         stage_id = v.stage_id,
         stage_changed_at = CASE WHEN o.stage_id <> v.stage_id THEN NOW() ELSE o.stage_changed_at END
       FROM (SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[]) AS t(id, stage_id, sort_index)) v
       WHERE o.id = v.id`,
      [ids, stageIds, sortIdx]
    );
  }

  async deleteOpportunity(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.opportunities WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Opportunity not found');
  }

  // ── Activities ───────────────────────────────────────────
  async findActivities(opportunityId: number): Promise<Activity[]> {
    const { rows } = await this.db.query(
      `SELECT ${ACTIVITY_COLS} FROM crm.activities WHERE opportunity_id = $1
       ORDER BY done ASC, COALESCE(due_date, created_at) DESC`,
      [opportunityId]
    );
    return rows.map((r) => ActivitySchema.parse(r));
  }

  async createActivity(body: CreateActivityBody): Promise<Activity> {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO crm.activities (opportunity_id, type, subject, notes, due_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${ACTIVITY_COLS}`,
        [body.opportunity_id, body.type, body.subject, body.notes ?? null, body.due_date ?? null]
      );
      return ActivitySchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Opportunity not found');
      throw err;
    }
  }

  async updateActivity(id: number, body: UpdateActivityBody): Promise<Activity> {
    const { rows } = await this.db.query(
      `UPDATE crm.activities SET
         type     = COALESCE($2, type),
         subject  = COALESCE($3, subject),
         notes    = COALESCE($4, notes),
         due_date = COALESCE($5, due_date),
         done     = COALESCE($6, done)
       WHERE id = $1
       RETURNING ${ACTIVITY_COLS}`,
      [id, body.type ?? null, body.subject ?? null, body.notes ?? null, body.due_date ?? null, body.done ?? null]
    );
    if (rows.length === 0) throw new AppError(404, 'Activity not found');
    return ActivitySchema.parse(rows[0]);
  }

  async deleteActivity(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.activities WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Activity not found');
  }

  // ── Insights / Reports ───────────────────────────────────
  async getDefaultPipelineId(): Promise<number | null> {
    const { rows } = await this.db.query<{ id: number }>(`SELECT id FROM crm.pipelines ORDER BY position, id LIMIT 1`);
    return rows[0]?.id ?? null;
  }

  async getInsights(pipelineId: number, from?: string, to?: string): Promise<InsightsResponse> {
    // Range aplicado a created_at (date). $2=from, $3=to (texto YYYY-MM-DD ou null).
    const rangeParams = [pipelineId, from ?? null, to ?? null];
    const rangeSql = `($2::date IS NULL OR o.created_at::date >= $2::date)
                      AND ($3::date IS NULL OR o.created_at::date <= $3::date)`;

    // Funnel — estágios do funil (abertos), na ordem.
    const { rows: funnelRows } = await this.db.query<{
      stage_id: number;
      stage_name: string;
      position: number;
      probability: number;
      count: number;
      value: number;
    }>(
      `SELECT s.id AS stage_id, s.name AS stage_name, s.position, s.probability,
              COUNT(o.id)::int AS count, COALESCE(SUM(o.amount), 0)::float8 AS value
       FROM crm.stages s
       LEFT JOIN crm.opportunities o
         ON o.stage_id = s.id AND o.status = 'open' AND ${rangeSql}
       WHERE s.pipeline_id = $1
       GROUP BY s.id, s.name, s.position, s.probability
       ORDER BY s.position ASC, s.id ASC`,
      rangeParams
    );
    const firstCount = funnelRows[0]?.count ?? 0;
    const funnel: FunnelStageReport[] = funnelRows.map((r) => ({
      stage_id: r.stage_id,
      stage_name: r.stage_name,
      position: r.position,
      probability: r.probability,
      count: r.count,
      value: r.value,
      conversion: firstCount > 0 ? Math.round((r.count / firstCount) * 1000) / 10 : 0,
    }));

    // Forecast — por mês de fechamento esperado (abertos).
    const { rows: forecastRows } = await this.db.query<{ month: string; value: number; weighted: number }>(
      `SELECT to_char(date_trunc('month', o.expected_close), 'YYYY-MM') AS month,
              COALESCE(SUM(o.amount), 0)::float8 AS value,
              COALESCE(SUM(o.amount * s.probability / 100.0), 0)::float8 AS weighted
       FROM crm.opportunities o JOIN crm.stages s ON s.id = o.stage_id
       WHERE o.pipeline_id = $1 AND o.status = 'open' AND o.expected_close IS NOT NULL
       GROUP BY 1 ORDER BY 1 ASC`,
      [pipelineId]
    );
    const forecast: ForecastMonth[] = forecastRows.map((r) => ({
      month: r.month,
      value: r.value,
      weighted: Math.round(r.weighted * 100) / 100,
    }));

    // Won/Lost summary.
    const { rows: wlRows } = await this.db.query<{
      open_count: number;
      open_value: number;
      weighted_value: number;
      won_count: number;
      won_value: number;
      lost_count: number;
      lost_value: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE o.status='open')::int AS open_count,
         COALESCE(SUM(o.amount) FILTER (WHERE o.status='open'), 0)::float8 AS open_value,
         COALESCE(SUM(o.amount * s.probability / 100.0) FILTER (WHERE o.status='open'), 0)::float8 AS weighted_value,
         COUNT(*) FILTER (WHERE o.status='won')::int AS won_count,
         COALESCE(SUM(o.amount) FILTER (WHERE o.status='won'), 0)::float8 AS won_value,
         COUNT(*) FILTER (WHERE o.status='lost')::int AS lost_count,
         COALESCE(SUM(o.amount) FILTER (WHERE o.status='lost'), 0)::float8 AS lost_value
       FROM crm.opportunities o JOIN crm.stages s ON s.id = o.stage_id
       WHERE o.pipeline_id = $1 AND ${rangeSql}`,
      rangeParams
    );
    const wl = wlRows[0] ?? {
      open_count: 0,
      open_value: 0,
      weighted_value: 0,
      won_count: 0,
      won_value: 0,
      lost_count: 0,
      lost_value: 0,
    };
    const closed = wl.won_count + wl.lost_count;

    const { rows: reasonRows } = await this.db.query<{ reason: string; count: number; value: number }>(
      `SELECT COALESCE(NULLIF(TRIM(o.lost_reason), ''), 'Sem motivo') AS reason,
              COUNT(*)::int AS count, COALESCE(SUM(o.amount), 0)::float8 AS value
       FROM crm.opportunities o
       WHERE o.pipeline_id = $1 AND o.status = 'lost' AND ${rangeSql}
       GROUP BY 1 ORDER BY count DESC, value DESC`,
      rangeParams
    );
    const lost_reasons: LostReason[] = reasonRows.map((r) => ({ reason: r.reason, count: r.count, value: r.value }));

    // Owner performance.
    const { rows: ownerRows } = await this.db.query<{
      owner: string;
      open_count: number;
      open_value: number;
      won_count: number;
      won_value: number;
      lost_count: number;
    }>(
      `SELECT COALESCE(NULLIF(TRIM(o.owner), ''), 'Sem responsável') AS owner,
              COUNT(*) FILTER (WHERE o.status='open')::int AS open_count,
              COALESCE(SUM(o.amount) FILTER (WHERE o.status='open'), 0)::float8 AS open_value,
              COUNT(*) FILTER (WHERE o.status='won')::int AS won_count,
              COALESCE(SUM(o.amount) FILTER (WHERE o.status='won'), 0)::float8 AS won_value,
              COUNT(*) FILTER (WHERE o.status='lost')::int AS lost_count
       FROM crm.opportunities o
       WHERE o.pipeline_id = $1 AND ${rangeSql}
       GROUP BY 1 ORDER BY won_value DESC, open_value DESC`,
      rangeParams
    );
    const owner_performance: OwnerPerformance[] = ownerRows.map((r) => ({
      owner: r.owner,
      open_count: r.open_count,
      open_value: r.open_value,
      won_count: r.won_count,
      won_value: r.won_value,
      lost_count: r.lost_count,
    }));

    return {
      funnel,
      forecast,
      won_lost: {
        open_count: wl.open_count,
        open_value: wl.open_value,
        weighted_value: Math.round(wl.weighted_value * 100) / 100,
        won_count: wl.won_count,
        won_value: wl.won_value,
        lost_count: wl.lost_count,
        lost_value: wl.lost_value,
        win_rate: closed > 0 ? Math.round((wl.won_count / closed) * 1000) / 10 : 0,
        avg_ticket: wl.won_count > 0 ? Math.round((wl.won_value / wl.won_count) * 100) / 100 : 0,
        lost_reasons,
      },
      owner_performance,
    };
  }
}
