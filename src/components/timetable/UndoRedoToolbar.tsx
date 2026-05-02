import { Button } from '@/components/ui/button';
import { Undo2, Redo2 } from 'lucide-react';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const UndoRedoToolbar = ({ canUndo, canRedo, onUndo, onRedo }: Props) => (
  <div className="flex items-center gap-1">
    <Button
      variant="outline"
      size="sm"
      onClick={onUndo}
      disabled={!canUndo}
      title="Undo (Ctrl+Z)"
    >
      <Undo2 className="h-4 w-4" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={onRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
    >
      <Redo2 className="h-4 w-4" />
    </Button>
  </div>
);
