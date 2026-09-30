import { Button, Input, Skeleton } from '@databricks/appkit-ui/react';
import { useState } from 'react';
import {
  PageHeader,
  Panel,
  FieldLabel,
  ErrorBanner,
  EmptyState,
  TextAction,
} from '@/components/brand/index.js';
import { useTodos } from './hooks.js';

export function TodosPage() {
  const { todos, loading, error, createTodo, toggleTodo, deleteTodo } = useTodos();
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setSubmitting(true);
    void createTodo(title).finally(() => {
      setNewTitle('');
      setSubmitting(false);
    });
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Tarefas" subtitle="Exemplo de CRUD sobre o Databricks Lakebase (PostgreSQL)." />

      <Panel>
        <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
          <FieldLabel label="Nova tarefa" className="flex-1">
            <Input
              placeholder="O que precisa ser feito?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={submitting}
            />
          </FieldLabel>
          <Button type="submit" disabled={submitting || !newTitle.trim()}>
            {submitting ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>

        {error && <ErrorBanner message={error} className="mb-4" />}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-12 w-full" />
            ))}
          </div>
        )}

        {!loading && todos.length === 0 && (
          <EmptyState title="Nenhuma tarefa" hint="Adicione a primeira tarefa no campo acima." />
        )}

        {!loading && todos.length > 0 && (
          <div className="space-y-2">
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 border px-3 py-2 transition-colors hover:bg-dex-tint">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => { void toggleTodo(todo.id); }}
                  className="size-5 shrink-0 accent-dex-azul"
                  aria-label={todo.completed ? `Reabrir: ${todo.title}` : `Concluir: ${todo.title}`}
                />

                <span className={`flex-1 ${todo.completed ? 'text-muted-foreground line-through' : ''}`}>
                  {todo.title}
                </span>

                <TextAction tone="muted" onClick={() => { void deleteTodo(todo.id); }}>
                  Excluir
                </TextAction>
              </div>
            ))}

            <p className="pt-2 text-xs text-muted-foreground">
              {completedCount} de {todos.length} concluídas
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
