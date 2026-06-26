import { ReceivableSchema, ReceivableSummarySchema } from '../../../shared/receivables/schemas.js';
import type {
  Receivable,
  ReceivableStatus,
  ReceivableSummary,
  CreateReceivableBody,
  UpdateReceivableBody,
} from '../../../shared/receivables/types.js';
import type { Installment } from '../../../shared/crm/types.js';
import { AppError } from '../../lib/errors.js';
import type { DbClient } from '../../lib/db.js';

const SETUP_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS ar`;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ar.receivables (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES crm.companies(id),
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
    paid_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
// v2: vínculo opcional com a oportunidade que originou o lançamento (idempotente).
const ALTER_OPPORTUNITY_SQL = `
  ALTER TABLE ar.receivables
    ADD COLUMN IF NOT EXISTS opportunity_id INTEGER REFERENCES crm.opportunities(id) ON DELETE SET NULL
`;

// status overdue derivado: pending vencido vira overdue na leitura
const STATUS_EXPR = `CASE WHEN r.status = 'pending' AND r.due_date < CURRENT_DATE THEN 'overdue' ELSE r.status END`;
const SELECT_COLS = `
  r.id, r.customer_id, c.name AS customer_name, r.description,
  r.amount::float8 AS amount, r.due_date::text,
  ${STATUS_EXPR} AS status, r.paid_at::text, r.opportunity_id, r.created_at::text
`;

const FK_VIOLATION = '23503';

export class ReceivableRepository {
  constructor(private readonly db: DbClient) {}

  async ensureSchema(): Promise<void> {
    try {
      await this.db.query(SETUP_SCHEMA_SQL);
      await this.db.query(CREATE_TABLE_SQL);
      await this.db.query(ALTER_OPPORTUNITY_SQL);
      console.log('[receivables] Ensured schema ar.receivables');
    } catch (err) {
      console.warn('[receivables] Database setup failed:', (err as Error).message);
      console.warn('[receivables] Routes will be registered but may return errors');
    }
  }

  async findAll(status?: ReceivableStatus): Promise<Receivable[]> {
    let where = '';
    if (status === 'overdue') {
      where = `WHERE r.status = 'pending' AND r.due_date < CURRENT_DATE`;
    } else if (status === 'pending') {
      where = `WHERE r.status = 'pending' AND r.due_date >= CURRENT_DATE`;
    } else if (status === 'paid') {
      where = `WHERE r.status = 'paid'`;
    }
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS}
       FROM ar.receivables r
       JOIN crm.companies c ON c.id = r.customer_id
       ${where}
       ORDER BY r.due_date ASC`,
    );
    return rows.map((row) => ReceivableSchema.parse(row));
  }

  async create(body: CreateReceivableBody): Promise<Receivable> {
    try {
      const { rows } = await this.db.query(
        `WITH ins AS (
           INSERT INTO ar.receivables (customer_id, description, amount, due_date)
           VALUES ($1, $2, $3, $4)
           RETURNING id, customer_id, description, amount, due_date, status, paid_at, opportunity_id, created_at
         )
         SELECT ins.id, ins.customer_id, c.name AS customer_name, ins.description,
                ins.amount::float8 AS amount, ins.due_date::text,
                ins.status, ins.paid_at::text, ins.opportunity_id, ins.created_at::text
         FROM ins JOIN crm.companies c ON c.id = ins.customer_id`,
        [body.customer_id, body.description, body.amount, body.due_date],
      );
      return ReceivableSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Customer not found');
      throw err;
    }
  }

  /** Cria N parcelas (uma por installment) vinculadas a uma oportunidade, numa única instrução. */
  async createForOpportunity(
    opportunityId: number,
    customerId: number,
    items: Installment[],
  ): Promise<Receivable[]> {
    const descriptions = items.map((it) => it.description ?? '');
    const amounts = items.map((it) => it.amount);
    const dueDates = items.map((it) => it.due_date);
    try {
      const { rows } = await this.db.query(
        `WITH ins AS (
           INSERT INTO ar.receivables (customer_id, opportunity_id, description, amount, due_date)
           SELECT $1, $2, t.description, t.amount, t.due_date::date
           FROM UNNEST($3::text[], $4::numeric[], $5::date[]) AS t(description, amount, due_date)
           RETURNING id, customer_id, description, amount, due_date, status, paid_at, opportunity_id, created_at
         )
         SELECT ins.id, ins.customer_id, c.name AS customer_name, ins.description,
                ins.amount::float8 AS amount, ins.due_date::text,
                ins.status, ins.paid_at::text, ins.opportunity_id, ins.created_at::text
         FROM ins JOIN crm.companies c ON c.id = ins.customer_id
         ORDER BY ins.due_date ASC, ins.id ASC`,
        [customerId, opportunityId, descriptions, amounts, dueDates],
      );
      return rows.map((row) => ReceivableSchema.parse(row));
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Customer not found');
      throw err;
    }
  }

  /** Remove os lançamentos pendentes (não baixados) gerados por uma oportunidade. */
  async deletePendingByOpportunity(opportunityId: number): Promise<void> {
    await this.db.query(
      `DELETE FROM ar.receivables WHERE opportunity_id = $1 AND status = 'pending'`,
      [opportunityId],
    );
  }

  async update(id: number, body: UpdateReceivableBody): Promise<Receivable> {
    try {
      const { rows } = await this.db.query(
        `WITH upd AS (
           UPDATE ar.receivables SET
             customer_id = COALESCE($2, customer_id),
             description = COALESCE($3, description),
             amount      = COALESCE($4, amount),
             due_date    = COALESCE($5::date, due_date)
           WHERE id = $1
           RETURNING id, customer_id, description, amount, due_date, status, paid_at, opportunity_id, created_at
         )
         SELECT upd.id, upd.customer_id, c.name AS customer_name, upd.description,
                upd.amount::float8 AS amount, upd.due_date::text,
                upd.status, upd.paid_at::text, upd.opportunity_id, upd.created_at::text
         FROM upd JOIN crm.companies c ON c.id = upd.customer_id`,
        [id, body.customer_id ?? null, body.description ?? null, body.amount ?? null, body.due_date ?? null],
      );
      if (rows.length === 0) throw new AppError(404, 'Receivable not found');
      return ReceivableSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Customer not found');
      throw err;
    }
  }

  /** Status persistido cru (pending|paid), sem derivação — para a regra de baixa. */
  async getRawStatus(id: number): Promise<string | null> {
    const { rows } = await this.db.query<{ status: string }>(
      `SELECT status FROM ar.receivables WHERE id = $1`,
      [id],
    );
    return rows[0]?.status ?? null;
  }

  async settle(id: number): Promise<Receivable> {
    const { rows } = await this.db.query(
      `WITH upd AS (
         UPDATE ar.receivables
         SET status = 'paid', paid_at = CURRENT_DATE
         WHERE id = $1
         RETURNING id, customer_id, description, amount, due_date, status, paid_at, opportunity_id, created_at
       )
       SELECT upd.id, upd.customer_id, c.name AS customer_name, upd.description,
              upd.amount::float8 AS amount, upd.due_date::text,
              upd.status, upd.paid_at::text, upd.opportunity_id, upd.created_at::text
       FROM upd JOIN crm.companies c ON c.id = upd.customer_id`,
      [id],
    );
    if (rows.length === 0) throw new AppError(404, 'Receivable not found');
    return ReceivableSchema.parse(rows[0]);
  }

  async remove(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM ar.receivables WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Receivable not found');
  }

  async summary(): Promise<ReceivableSummary> {
    const { rows } = await this.db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date >= CURRENT_DATE), 0)::float8 AS total_pending,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0)::float8  AS total_overdue,
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)), 0)::float8 AS total_received_month,
         COALESCE(COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0)::int AS count_overdue
       FROM ar.receivables`,
    );
    return ReceivableSummarySchema.parse(rows[0]);
  }
}
