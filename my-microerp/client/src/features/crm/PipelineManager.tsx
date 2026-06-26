import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Separator,
} from '@databricks/appkit-ui/react';
import { Settings, Trash2, Plus, Check } from 'lucide-react';
import type { Pipeline, CreateStageBody, UpdateStageBody } from '@shared/crm/types.js';

interface PipelineManagerProps {
  current: Pipeline | undefined;
  createPipeline: (name: string) => void;
  renamePipeline: (id: number, name: string) => void;
  deletePipeline: (id: number) => void;
  createStage: (body: CreateStageBody) => void;
  updateStage: (id: number, body: UpdateStageBody) => void;
  deleteStage: (id: number) => void;
}

export function PipelineManager(props: PipelineManagerProps) {
  const { current, createPipeline, renamePipeline, deletePipeline, createStage, updateStage, deleteStage } = props;
  const [open, setOpen] = useState(false);
  const [newPipeline, setNewPipeline] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [newStage, setNewStage] = useState('');

  // sincroniza o nome do funil ao abrir / trocar de funil
  const currentName = current?.name ?? '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPipelineName(currentName);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-1 h-4 w-4" /> Gerenciar funil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar funis e estágios</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Funil atual */}
          {current && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funil atual</p>
              <div className="flex items-center gap-2">
                <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pipelineName.trim() || pipelineName.trim() === current.name}
                  onClick={() => renamePipeline(current.id, pipelineName.trim())}
                >
                  Renomear
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deletePipeline(current.id)}
                  aria-label="Excluir funil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Estágios */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estágios</p>
            {(current?.stages ?? []).map((s) => (
              <StageRow
                key={s.id}
                name={s.name}
                probability={s.probability}
                onSave={(name, probability) => updateStage(s.id, { name, probability })}
                onDelete={() => deleteStage(s.id)}
              />
            ))}

            {current && (
              <form
                className="flex items-center gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newStage.trim()) return;
                  createStage({ pipeline_id: current.id, name: newStage.trim() });
                  setNewStage('');
                }}
              >
                <Input
                  placeholder="Novo estágio"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!newStage.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Estágio
                </Button>
              </form>
            )}
          </div>

          <Separator />

          {/* Novo funil */}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPipeline.trim()) return;
              createPipeline(newPipeline.trim());
              setNewPipeline('');
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Novo funil</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do funil"
                value={newPipeline}
                onChange={(e) => setNewPipeline(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!newPipeline.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Criar
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageRow({
  name,
  probability,
  onSave,
  onDelete,
}: {
  name: string;
  probability: number;
  onSave: (name: string, probability: number) => void;
  onDelete: () => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(String(probability));
  const dirty = n.trim() !== name || Number(p) !== probability;

  return (
    <div className="flex items-center gap-2">
      <Input value={n} onChange={(e) => setN(e.target.value)} className="flex-1" />
      <Input
        type="number"
        min={0}
        max={100}
        value={p}
        onChange={(e) => setP(e.target.value)}
        className="w-20"
        title="Probabilidade (%)"
      />
      <Button
        size="icon"
        variant="ghost"
        disabled={!dirty || !n.trim()}
        onClick={() => onSave(n.trim(), Math.max(0, Math.min(100, Number(p) || 0)))}
        aria-label="Salvar estágio"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label="Excluir estágio"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
