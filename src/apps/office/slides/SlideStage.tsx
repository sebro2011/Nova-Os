import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { PresentationSlide, SlideObject } from '../core/presentation-model/presentation-model';

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

type ObjectPatch = Partial<Pick<SlideObject, 'x' | 'y' | 'width' | 'height'>>;

interface DragState {
  pointerId: number;
  objectId: string;
  mode: 'move' | 'resize';
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  changed: boolean;
}

interface SlideStageProps {
  slide: PresentationSlide;
  label?: string;
  editable?: boolean;
  selectedObjectId?: string | null;
  onSelect?: (id: string | null) => void;
  onBeginTransform?: () => void;
  onObjectChange?: (id: string, patch: ObjectPatch) => void;
  onDelete?: (id: string) => void;
}

export default function SlideStage({ slide, label, editable = false, selectedObjectId = null, onSelect, onBeginTransform, onObjectChange, onDelete }: SlideStageProps) {
  const stageRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const selected = slide.objects.find((object) => object.id === selectedObjectId);

  const startTransform = (event: ReactPointerEvent<SVGElement>, object: SlideObject, mode: DragState['mode']) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(object.id);
    dragRef.current = { pointerId: event.pointerId, objectId: object.id, mode, clientX: event.clientX, clientY: event.clientY, x: object.x, y: object.y, width: object.width, height: object.height, changed: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveTransform = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rect?.width || !rect.height) return;
    const dx = (event.clientX - drag.clientX) / rect.width * 100;
    const dy = (event.clientY - drag.clientY) / rect.height * 100;
    if (!dx && !dy) return;
    if (!drag.changed) onBeginTransform?.();
    drag.changed = true;
    onObjectChange?.(drag.objectId, drag.mode === 'move'
      ? { x: drag.x + dx, y: drag.y + dy }
      : { width: drag.width + dx, height: drag.height + dy });
  };

  const objectKeyboard = (event: KeyboardEvent<SVGGElement>, object: SlideObject) => {
    if (!editable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(object.id);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete?.(object.id);
      return;
    }
    const movement: Record<string, ObjectPatch> = {
      ArrowLeft: { x: object.x - (event.shiftKey ? 5 : 1) },
      ArrowRight: { x: object.x + (event.shiftKey ? 5 : 1) },
      ArrowUp: { y: object.y - (event.shiftKey ? 5 : 1) },
      ArrowDown: { y: object.y + (event.shiftKey ? 5 : 1) },
    };
    const patch = movement[event.key];
    if (!patch) return;
    event.preventDefault();
    onSelect?.(object.id);
    onBeginTransform?.();
    onObjectChange?.(object.id, patch);
  };

  const transform = (object: SlideObject) => object.rotation ? `rotate(${object.rotation} ${(object.x + object.width / 2) * SLIDE_WIDTH / 100} ${(object.y + object.height / 2) * SLIDE_HEIGHT / 100})` : undefined;
  const box = (object: SlideObject) => ({ x: object.x * SLIDE_WIDTH / 100, y: object.y * SLIDE_HEIGHT / 100, width: object.width * SLIDE_WIDTH / 100, height: object.height * SLIDE_HEIGHT / 100 });

  return <svg
    ref={stageRef}
    className={`slides-stage ${editable ? 'is-editable' : ''}`}
    viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
    role={editable ? 'group' : 'img'}
    aria-label={label ?? slide.name}
    onPointerDown={(event) => { if (editable && event.target === event.currentTarget) onSelect?.(null); }}
    onPointerMove={moveTransform}
    onPointerUp={() => { dragRef.current = null; }}
    onPointerCancel={() => { dragRef.current = null; }}
  >
    <rect width={SLIDE_WIDTH} height={SLIDE_HEIGHT} fill={slide.background} onPointerDown={() => { if (editable) onSelect?.(null); }} />
    {slide.objects.map((object) => {
      const bounds = box(object);
      return <g
        key={object.id}
        transform={transform(object)}
        className={`slides-object ${editable ? 'is-selectable' : ''}`}
        tabIndex={editable ? 0 : undefined}
        role={editable ? 'button' : undefined}
        aria-label={editable ? `Select ${object.type} object` : undefined}
        onPointerDown={(event) => startTransform(event, object, 'move')}
        onClick={(event) => { if (editable) { event.stopPropagation(); onSelect?.(object.id); } }}
        onKeyDown={(event) => objectKeyboard(event, object)}
      >
        {object.type === 'text' && <foreignObject {...bounds}>
          <div className="slides-text-object" style={{ color: object.color, fontSize: object.fontSize, fontWeight: object.bold ? 700 : 400, textAlign: object.align }}>{object.text}</div>
        </foreignObject>}
        {object.type === 'image' && <image {...bounds} href={object.src} preserveAspectRatio="xMidYMid meet"><title>{object.alt}</title></image>}
        {object.type === 'shape' && object.shape === 'rectangle' && <rect {...bounds} fill={object.fill} stroke={object.stroke} strokeWidth={2} />}
        {object.type === 'shape' && object.shape === 'ellipse' && <ellipse cx={bounds.x + bounds.width / 2} cy={bounds.y + bounds.height / 2} rx={bounds.width / 2} ry={bounds.height / 2} fill={object.fill} stroke={object.stroke} strokeWidth={2} />}
      </g>;
    })}
    {editable && selected && <g transform={transform(selected)} className="slides-selection" aria-hidden="true">
      <rect {...box(selected)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="7 4" />
      <circle
        className="slides-resize-handle"
        cx={(selected.x + selected.width) * SLIDE_WIDTH / 100}
        cy={(selected.y + selected.height) * SLIDE_HEIGHT / 100}
        r={8}
        fill="var(--accent)"
        stroke="#fff"
        strokeWidth={2}
        onPointerDown={(event) => startTransform(event, selected, 'resize')}
      />
    </g>}
  </svg>;
}
