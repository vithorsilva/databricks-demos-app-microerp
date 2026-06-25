import { z } from 'zod';

export const TodoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  completed: z.boolean(),
  created_at: z.string(),
});

export const CreateTodoBodySchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
});

export const UpdateTodoBodySchema = z.object({
  completed: z.boolean(),
});

export const TodoListResponseSchema = z.array(TodoSchema);
export const ErrorResponseSchema = z.object({ error: z.string() });
