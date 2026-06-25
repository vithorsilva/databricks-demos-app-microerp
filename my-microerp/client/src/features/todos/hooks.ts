import { useState, useEffect, useCallback } from 'react';
import { todosApi } from './api.js';
import type { Todo } from '@shared/todos/types.js';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    todosApi
      .list()
      .then(setTodos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load todos'))
      .finally(() => setLoading(false));
  }, []);

  const createTodo = useCallback(async (title: string) => {
    try {
      const created = await todosApi.create({ title });
      setTodos((prev) => [created, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add todo');
    }
  }, []);

  const toggleTodo = useCallback(async (id: number) => {
    try {
      const updated = await todosApi.toggle(id);
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update todo');
    }
  }, []);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      await todosApi.remove(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete todo');
    }
  }, []);

  return { todos, loading, error, createTodo, toggleTodo, deleteTodo };
}
