import {
  CompanySchema,
  ContactSchema,
  OpportunitySchema,
} from '../../../shared/crm/schemas.js';
import type {
  Company,
  CompanyType,
  Contact,
  Opportunity,
  CreateCompanyBody,
  UpdateCompanyBody,
  CreateContactBody,
  UpdateContactBody,
  CreateOpportunityBody,
  UpdateOpportunityBody,
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

const COMPANY_COLS = `id, name, type, tax_id, email, phone, notes, created_at::text`;
const CONTACT_COLS = `id, company_id, name, role, email, phone, created_at::text`;

// Postgres FK violation code
const FK_VIOLATION = '23503';

export class CrmRepository {
  constructor(private readonly db: DbClient) {}

  async ensureSchema(): Promise<void> {
    try {
      await this.db.query(SETUP_SCHEMA_SQL);
      await this.db.query(CREATE_COMPANIES_SQL);
      await this.db.query(CREATE_CONTACTS_SQL);
      await this.db.query(CREATE_OPPORTUNITIES_SQL);
      console.log('[crm] Ensured schema and tables');
    } catch (err) {
      console.warn('[crm] Database setup failed:', (err as Error).message);
      console.warn('[crm] Routes will be registered but may return errors');
    }
  }

  // ── Companies ────────────────────────────────────────────
  async findCompanies(type?: CompanyType): Promise<Company[]> {
    // type=customer inclui 'both'; type=supplier inclui 'both'
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
      [body.name, body.type, body.tax_id ?? null, body.email ?? null, body.phone ?? null, body.notes ?? null],
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
      [id, body.name ?? null, body.type ?? null, body.tax_id ?? null, body.email ?? null, body.phone ?? null, body.notes ?? null],
    );
    if (rows.length === 0) throw new AppError(404, 'Company not found');
    return CompanySchema.parse(rows[0]);
  }

  /** Conta títulos AR/AP vinculados; tolera schemas ainda inexistentes. */
  async countLinkedRecords(companyId: number): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM ar.receivables WHERE customer_id = $1), 0) +
         COALESCE((SELECT COUNT(*) FROM ap.payables   WHERE supplier_id = $1), 0) AS n`,
      [companyId],
    ).catch(async () => {
      // Se ar/ap ainda não existem, conta só o que existir.
      let n = 0;
      for (const [schema, table, col] of [
        ['ar', 'receivables', 'customer_id'],
        ['ap', 'payables', 'supplier_id'],
      ] as const) {
        const reg = await this.db.query<{ exists: string | null }>(
          `SELECT to_regclass($1) AS exists`,
          [`${schema}.${table}`],
        );
        if (reg.rows[0]?.exists) {
          const c = await this.db.query<{ n: string }>(
            `SELECT COUNT(*) AS n FROM ${schema}.${table} WHERE ${col} = $1`,
            [companyId],
          );
          n += Number(c.rows[0]?.n ?? 0);
        }
      }
      return { rows: [{ n: String(n) }] };
    });
    return Number(rows[0]?.n ?? 0);
  }

  async deleteCompany(id: number): Promise<void> {
    const { rows } = await this.db.query(
      `DELETE FROM crm.companies WHERE id = $1 RETURNING id`,
      [id],
    );
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
        [body.company_id, body.name, body.role ?? null, body.email ?? null, body.phone ?? null],
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
      [id, body.name ?? null, body.role ?? null, body.email ?? null, body.phone ?? null],
    );
    if (rows.length === 0) throw new AppError(404, 'Contact not found');
    return ContactSchema.parse(rows[0]);
  }

  async deleteContact(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.contacts WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Contact not found');
  }

  // ── Opportunities ────────────────────────────────────────
  async findOpportunities(): Promise<Opportunity[]> {
    const { rows } = await this.db.query(
      `SELECT o.id, o.company_id, c.name AS company_name, o.title, o.stage,
              o.amount::float8 AS amount, o.owner, o.expected_close::text, o.created_at::text
       FROM crm.opportunities o
       JOIN crm.companies c ON c.id = o.company_id
       ORDER BY o.created_at DESC`,
    );
    return rows.map((r) => OpportunitySchema.parse(r));
  }

  async createOpportunity(body: CreateOpportunityBody): Promise<Opportunity> {
    try {
      const { rows } = await this.db.query(
        `WITH ins AS (
           INSERT INTO crm.opportunities (company_id, title, stage, amount, owner, expected_close)
           VALUES ($1, $2, COALESCE($3, 'lead'), $4, $5, $6)
           RETURNING id, company_id, title, stage, amount, owner, expected_close, created_at
         )
         SELECT ins.id, ins.company_id, c.name AS company_name, ins.title, ins.stage,
                ins.amount::float8 AS amount, ins.owner, ins.expected_close::text, ins.created_at::text
         FROM ins JOIN crm.companies c ON c.id = ins.company_id`,
        [
          body.company_id,
          body.title,
          body.stage ?? null,
          body.amount ?? null,
          body.owner ?? null,
          body.expected_close ?? null,
        ],
      );
      return OpportunitySchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Company not found');
      throw err;
    }
  }

  async updateOpportunity(id: number, body: UpdateOpportunityBody): Promise<Opportunity> {
    const { rows } = await this.db.query(
      `WITH upd AS (
         UPDATE crm.opportunities SET
           company_id     = COALESCE($2, company_id),
           title          = COALESCE($3, title),
           stage          = COALESCE($4, stage),
           amount         = COALESCE($5, amount),
           owner          = COALESCE($6, owner),
           expected_close = COALESCE($7, expected_close)
         WHERE id = $1
         RETURNING id, company_id, title, stage, amount, owner, expected_close, created_at
       )
       SELECT upd.id, upd.company_id, c.name AS company_name, upd.title, upd.stage,
              upd.amount::float8 AS amount, upd.owner, upd.expected_close::text, upd.created_at::text
       FROM upd JOIN crm.companies c ON c.id = upd.company_id`,
      [
        id,
        body.company_id ?? null,
        body.title ?? null,
        body.stage ?? null,
        body.amount ?? null,
        body.owner ?? null,
        body.expected_close ?? null,
      ],
    );
    if (rows.length === 0) throw new AppError(404, 'Opportunity not found');
    return OpportunitySchema.parse(rows[0]);
  }

  async deleteOpportunity(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM crm.opportunities WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Opportunity not found');
  }
}
