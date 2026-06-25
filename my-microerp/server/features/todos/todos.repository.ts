import { TodoSchema } from '../../../shared/todos/schemas.js';
import type { Todo } from '../../../shared/todos/types.js';
import { AppError } from '../../lib/errors.js';
import type { DbClient } from '../../lib/db.js';

const TABLE_EXISTS_SQL = `
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'app' AND table_name = 'todos'
`;
const SETUP_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS app`;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app.todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export class TodoRepository {
  constructor(private readonly db: DbClient) {}

  async ensureSchema(): Promise<void> {
    try {
      const { rows } = await this.db.query(TABLE_EXISTS_SQL);
      if (rows.length > 0) {
        console.log('[todos] Table app.todos already exists, skipping setup');
      } else {
        await this.db.query(SETUP_SCHEMA_SQL);
        await this.db.query(CREATE_TABLE_SQL);
        console.log('[todos] Created schema and table app.todos');
      }
    } catch (err) {
      console.warn('[todos] Database setup failed:', (err as Error).message);
      console.warn('[todos] Routes will be registered but may return errors');
    }
  }

  async findAll(): Promise<Todo[]> {
    const { rows } = await this.db.query(
      'SELECT id, title, completed, created_at::text FROM app.todos ORDER BY created_at DESC',
    );
    return rows.map((row) => TodoSchema.parse(row));
  }

  async create(title: string): Promise<Todo> {
    const { rows } = await this.db.query(
      'INSERT INTO app.todos (title) VALUES ($1) RETURNING id, title, completed, created_at::text',
      [title],
    );
    return TodoSchema.parse(rows[0]);
  }

  async toggleCompleted(id: number): Promise<Todo> {
    const { rows } = await this.db.query(
      'UPDATE app.todos SET completed = NOT completed WHERE id = $1 RETURNING id, title, completed, created_at::text',
      [id],
    );
    if (rows.length === 0) throw new AppError(404, 'Todo not found');
    return TodoSchema.parse(rows[0]);
  }

  async remove(id: number): Promise<void> {
    const { rows } = await this.db.query(
      'DELETE FROM app.todos WHERE id = $1 RETURNING id',
      [id],
    );
    if (rows.length === 0) throw new AppError(404, 'Todo not found');
  }
}
