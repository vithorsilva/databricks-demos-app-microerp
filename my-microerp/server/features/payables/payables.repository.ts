import { PayableSchema, PayableSummarySchema } from '../../../shared/payables/schemas.js';
import type {
  Payable,
  PayableStatus,
  PayableSummary,
  CreatePayableBody,
  UpdatePayableBody,
} from '../../../shared/payables/types.js';
import { AppError } from '../../lib/errors.js';
import type { DbClient } from '../../lib/db.js';

const SETUP_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS ap`;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ap.payables (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES crm.companies(id),
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
    paid_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const STATUS_EXPR = `CASE WHEN p.status = 'pending' AND p.due_date < CURRENT_DATE THEN 'overdue' ELSE p.status END`;
const SELECT_COLS = `
  p.id, p.supplier_id, c.name AS supplier_name, p.description,
  p.amount::float8 AS amount, p.due_date::text,
  ${STATUS_EXPR} AS status, p.paid_at::text, p.created_at::text
`;

const FK_VIOLATION = '23503';

export class PayableRepository {
  constructor(private readonly db: DbClient) {}

  async ensureSchema(): Promise<void> {
    try {
      await this.db.query(SETUP_SCHEMA_SQL);
      await this.db.query(CREATE_TABLE_SQL);
      console.log('[payables] Ensured schema ap.payables');
    } catch (err) {
      console.warn('[payables] Database setup failed:', (err as Error).message);
      console.warn('[payables] Routes will be registered but may return errors');
    }
  }

  async findAll(status?: PayableStatus): Promise<Payable[]> {
    let where = '';
    if (status === 'overdue') {
      where = `WHERE p.status = 'pending' AND p.due_date < CURRENT_DATE`;
    } else if (status === 'pending') {
      where = `WHERE p.status = 'pending' AND p.due_date >= CURRENT_DATE`;
    } else if (status === 'paid') {
      where = `WHERE p.status = 'paid'`;
    }
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS}
       FROM ap.payables p
       JOIN crm.companies c ON c.id = p.supplier_id
       ${where}
       ORDER BY p.due_date ASC`,
    );
    return rows.map((row) => PayableSchema.parse(row));
  }

  async create(body: CreatePayableBody): Promise<Payable> {
    try {
      const { rows } = await this.db.query(
        `WITH ins AS (
           INSERT INTO ap.payables (supplier_id, description, amount, due_date)
           VALUES ($1, $2, $3, $4)
           RETURNING id, supplier_id, description, amount, due_date, status, paid_at, created_at
         )
         SELECT ins.id, ins.supplier_id, c.name AS supplier_name, ins.description,
                ins.amount::float8 AS amount, ins.due_date::text,
                ins.status, ins.paid_at::text, ins.created_at::text
         FROM ins JOIN crm.companies c ON c.id = ins.supplier_id`,
        [body.supplier_id, body.description, body.amount, body.due_date],
      );
      return PayableSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Supplier not found');
      throw err;
    }
  }

  async update(id: number, body: UpdatePayableBody): Promise<Payable> {
    try {
      const { rows } = await this.db.query(
        `WITH upd AS (
           UPDATE ap.payables SET
             supplier_id = COALESCE($2, supplier_id),
             description = COALESCE($3, description),
             amount      = COALESCE($4, amount),
             due_date    = COALESCE($5::date, due_date)
           WHERE id = $1
           RETURNING id, supplier_id, description, amount, due_date, status, paid_at, created_at
         )
         SELECT upd.id, upd.supplier_id, c.name AS supplier_name, upd.description,
                upd.amount::float8 AS amount, upd.due_date::text,
                upd.status, upd.paid_at::text, upd.created_at::text
         FROM upd JOIN crm.companies c ON c.id = upd.supplier_id`,
        [id, body.supplier_id ?? null, body.description ?? null, body.amount ?? null, body.due_date ?? null],
      );
      if (rows.length === 0) throw new AppError(404, 'Payable not found');
      return PayableSchema.parse(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === FK_VIOLATION) throw new AppError(400, 'Supplier not found');
      throw err;
    }
  }

  async getRawStatus(id: number): Promise<string | null> {
    const { rows } = await this.db.query<{ status: string }>(
      `SELECT status FROM ap.payables WHERE id = $1`,
      [id],
    );
    return rows[0]?.status ?? null;
  }

  async settle(id: number): Promise<Payable> {
    const { rows } = await this.db.query(
      `WITH upd AS (
         UPDATE ap.payables
         SET status = 'paid', paid_at = CURRENT_DATE
         WHERE id = $1
         RETURNING id, supplier_id, description, amount, due_date, status, paid_at, created_at
       )
       SELECT upd.id, upd.supplier_id, c.name AS supplier_name, upd.description,
              upd.amount::float8 AS amount, upd.due_date::text,
              upd.status, upd.paid_at::text, upd.created_at::text
       FROM upd JOIN crm.companies c ON c.id = upd.supplier_id`,
      [id],
    );
    if (rows.length === 0) throw new AppError(404, 'Payable not found');
    return PayableSchema.parse(rows[0]);
  }

  async remove(id: number): Promise<void> {
    const { rows } = await this.db.query(`DELETE FROM ap.payables WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new AppError(404, 'Payable not found');
  }

  async summary(): Promise<PayableSummary> {
    const { rows } = await this.db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date >= CURRENT_DATE), 0)::float8 AS total_pending,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0)::float8  AS total_overdue,
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)), 0)::float8 AS total_paid_month,
         COALESCE(COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE), 0)::int AS count_overdue
       FROM ap.payables`,
    );
    return PayableSummarySchema.parse(rows[0]);
  }
}
