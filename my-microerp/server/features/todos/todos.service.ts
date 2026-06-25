import type { Todo } from '../../../shared/todos/types.js';
import type { TodoRepository } from './todos.repository.js';

export class TodoService {
  constructor(private readonly repo: TodoRepository) {}

  listTodos(): Promise<Todo[]> {
    return this.repo.findAll();
  }

  createTodo(title: string): Promise<Todo> {
    return this.repo.create(title.trim());
  }

  toggleTodo(id: number): Promise<Todo> {
    return this.repo.toggleCompleted(id);
  }

  async deleteTodo(id: number): Promise<void> {
    return this.repo.remove(id);
  }
}
