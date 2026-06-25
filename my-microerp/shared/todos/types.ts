import type { z } from 'zod';
import type {
  TodoSchema,
  CreateTodoBodySchema,
  UpdateTodoBodySchema,
  TodoListResponseSchema,
  ErrorResponseSchema,
} from './schemas.js';

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoBody = z.infer<typeof CreateTodoBodySchema>;
export type UpdateTodoBody = z.infer<typeof UpdateTodoBodySchema>;
export type TodoListResponse = z.infer<typeof TodoListResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
