import { api } from '../../api/index.js';
import type { Todo, CreateTodoBody, TodoListResponse } from '@shared/todos/types.js';

export const todosApi = {
  list:   ()                     => api.get<TodoListResponse>('/api/todos'),
  create: (body: CreateTodoBody) => api.post<Todo>('/api/todos', body),
  toggle: (id: number)           => api.patch<Todo>(`/api/todos/${id}`),
  remove: (id: number)           => api.delete<void>(`/api/todos/${id}`),
};
