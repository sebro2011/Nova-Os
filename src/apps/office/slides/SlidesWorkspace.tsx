import { useEffect, useRef, useState, type SetStateAction } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Download, FilePlus2,
  FileUp, History, Image, MonitorPlay, Play, Plus, Redo2, Save, Settings2, Shapes,
  Square, TextCursorInput, Trash2, Undo2, X,
} from 'lucide-react';
import type { FileNode } from '../../../types';
import { useI18n } from '../../../context/LocalizationContext';
import { errorMessage } from '../../../lib/utils';
import type { OfficeSaveStatus } from '../core/autosave/useOfficeDocument';
import { OFFICE_EXTENSION, OFFICE_MIME, type OfficeTemplate } from '../core/file-formats/constants';
import { parseOfficeData, serializeOfficeData } from '../core/file-formats/native';
import { readRasterInfo } from '../core/file-formats/raster';
import {
  applyPresentationTheme, applySlideLayout, addPresentationSlide, addSlideObject,
  constrainSlideObject, createImageSlideObject, createShapeSlideObject, createTextSlideObject,
  deletePresentationSlide, duplicatePresentationSlide, duplicateSlideObject,
  movePresentationSlide, moveSlideObject,
} from '../core/presentation-model/presentation-operations';
import { validatePresentationDocument, type PresentationDocument, type PresentationSlide, type ShapeSlideObject, type SlideLayout, type SlideObject } from '../core/presentation-model/presentation-model';
import { OfficeMenu, OfficeSaveIndicator, OfficeToolbarButton, OfficeWarnings } from '../components/OfficeUI';
import OfficeRevisionDialog from '../components/OfficeRevisionDialog';
import { downloadBlob, downloadText, readFileAsDataUrl } from '../services/download';
import SlideStage from './SlideStage';

interface SlidesWorkspaceProps {
  file: FileNode;
  data: PresentationDocument;
  status: OfficeSaveStatus;
  error: string;
  updateData: (update: SetStateAction<PresentationDocument>) => void;
  rename: (name: string) => void;
  flush: (forceRevision?: boolean) => Promise<void>;
  createNew: (name?: string, template?: OfficeTemplate) => Promise<void>;
}

export default function SlidesWorkspace({ file, data, status, error, updateData, rename, flush, createNew }: SlidesWorkspaceProps) {
  const { t } = useI18n();
  const dataRef = useRef(data);
  dataRef.current = data;
  const pastRef = useRef<PresentationDocument[]>([]);
  const redoRef = useRef<PresentationDocument[]>([]);
  const editSessionRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [, setHistoryVersion] = useState(0);
  const [activeSlideId, setActiveSlideId] = useState(data.slides[0].id);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const activeSlide = data.slides.find((slide) => slide.id === activeSlideId) ?? data.slides[0];
  const activeSlideRef = useRef(activeSlide.id);
  activeSlideRef.current = activeSlide.id;
  const selectedObject = activeSlide.objects.find((object) => object.id === selectedObjectId) ?? null;
  const title = file.name.replace(/\.nwslides$/i, '');
  const activeIndex = data.slides.findIndex((slide) => slide.id === activeSlide.id);

  useEffect(() => {
    if (!data.slides.some((slide) => slide.id === activeSlideId)) setActiveSlideId(data.slides[0].id);
    if (selectedObjectId && !activeSlide.objects.some((object) => object.id === selectedObjectId)) setSelectedObjectId(null);
  }, [data, activeSlideId, selectedObjectId, activeSlide.objects]);

  useEffect(() => {
    if (!presenting) return;
    const keyboard = (event: globalThis.KeyboardEvent) => {
      const current = dataRef.current;
      const index = Math.max(0, current.slides.findIndex((slide) => slide.id === activeSlideRef.current));
      if (event.key === 'Escape') setPresenting(false);
      else if (event.key === 'ArrowRight' || event.key === 'PageDown') setActiveSlideId(current.slides[Math.min(current.slides.length - 1, index + 1)].id);
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') setActiveSlideId(current.slides[Math.max(0, index - 1)].id);
      else if (event.key === 'Home') setActiveSlideId(current.slides[0].id);
      else if (event.key === 'End') setActiveSlideId(current.slides[current.slides.length - 1].id);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [presenting]);

  const pushHistory = () => {
    pastRef.current.push(structuredClone(dataRef.current));
    if (pastRef.current.length > 50) pastRef.current.shift();
    redoRef.current = [];
    setHistoryVersion((current) => current + 1);
  };
  const applyData = (next: PresentationDocument, record = true) => {
    if (record) pushHistory();
    dataRef.current = next;
    updateData(next);
  };
  const mutate = (action: () => void) => {
    setActionError('');
    try { action(); } catch (caught) { setActionError(errorMessage(caught)); }
  };
  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try { await action(); } catch (caught) { setActionError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const updateSlide = (slideId: string, update: (slide: PresentationSlide) => PresentationSlide, record = true) => {
    const current = dataRef.current;
    applyData({ ...current, slides: current.slides.map((slide) => slide.id === slideId ? update(slide) : slide) }, record);
  };
  const updateActiveSlide = (update: (slide: PresentationSlide) => PresentationSlide, record = true) => updateSlide(activeSlideRef.current, update, record);
  const updateObject = (id: string, update: (object: SlideObject) => SlideObject, record = true) => {
    updateActiveSlide((slide) => ({ ...slide, objects: slide.objects.map((object) => object.id === id ? constrainSlideObject(update(object)) : object) }), record);
  };
  const updateSelected = (patch: Record<string, unknown>, continuous = false) => {
    if (!selectedObject) return;
    const record = !continuous || !editSessionRef.current;
    if (continuous) editSessionRef.current = true;
    updateObject(selectedObject.id, (object) => ({ ...object, ...patch }) as SlideObject, record);
  };
  const selectSlide = (id: string) => {
    editSessionRef.current = false;
    setActiveSlideId(id);
    setSelectedObjectId(null);
  };
  const undo = () => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    redoRef.current.push(structuredClone(dataRef.current));
    dataRef.current = previous;
    updateData(previous);
    setActiveSlideId(previous.slides.some((slide) => slide.id === activeSlideRef.current) ? activeSlideRef.current : previous.slides[0].id);
    setSelectedObjectId(null);
    setHistoryVersion((current) => current + 1);
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    pastRef.current.push(structuredClone(dataRef.current));
    dataRef.current = next;
    updateData(next);
    setActiveSlideId(next.slides.some((slide) => slide.id === activeSlideRef.current) ? activeSlideRef.current : next.slides[0].id);
    setSelectedObjectId(null);
    setHistoryVersion((current) => current + 1);
  };
  const addSlide = () => mutate(() => {
    const result = addPresentationSlide(dataRef.current);
    applyData(result.document);
    selectSlide(result.slide.id);
  });
  const deleteSlide = () => {
    if (data.slides.length <= 1 || !window.confirm(`Delete slide “${activeSlide.name}”?`)) return;
    mutate(() => {
      const next = deletePresentationSlide(dataRef.current, activeSlide.id);
      applyData(next);
      selectSlide(next.slides[Math.min(activeIndex, next.slides.length - 1)].id);
    });
  };
  const addObject = (object: SlideObject) => mutate(() => {
    updateActiveSlide((slide) => addSlideObject(slide, object));
    setSelectedObjectId(object.id);
    setInspectorOpen(true);
  });
  const deleteObject = (id: string) => mutate(() => {
    updateActiveSlide((slide) => ({ ...slide, objects: slide.objects.filter((object) => object.id !== id) }));
    setSelectedObjectId(null);
  });

  const importPresentation = (selected?: File) => {
    if (!selected) return;
    void runAction(async () => {
      if (!selected.name.toLowerCase().endsWith('.nwslides') || selected.size > 12_000_000) throw new Error('Choose a .nwslides file under 12 MB.');
      const imported = parseOfficeData('slides', await selected.text());
      applyData(imported);
      selectSlide(imported.slides[0].id);
      setWarnings(['The imported NOVA presentation replaced the current presentation. Use undo or revision history to recover the previous state.']);
    });
  };
  const importImage = (selected?: File) => {
    if (!selected) return;
    void runAction(async () => {
      if (selected.size > 4_000_000) throw new Error('Slide images are limited to 4 MB before encoding.');
      const src = await readFileAsDataUrl(selected);
      readRasterInfo(src);
      addObject(createImageSlideObject(src, selected.name));
    });
  };
  const exportNative = () => runAction(async () => {
    await flush();
    downloadText(serializeOfficeData('slides', dataRef.current), `${title}${OFFICE_EXTENSION.slides}`, OFFICE_MIME.slides);
  });
  const exportPptx = () => runAction(async () => {
    await flush();
    const { exportPresentationPptx } = await import('./slides-export');
    downloadBlob(await exportPresentationPptx(dataRef.current, title), `${title}.pptx`);
  });

  return <div className="office-app slides-app" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void flush(true); }
  }}>
    <header className="office-app-header">
      <input className="office-title-input" aria-label={t('common.name')} value={title} maxLength={120} onChange={(event) => rename(event.target.value)} />
      <OfficeSaveIndicator status={status} />
      <button type="button" className="office-primary-button" onClick={() => void flush(true)} disabled={busy}><Save size={14} />{t('common.save')}</button>
    </header>
    <div className="office-toolbar" role="toolbar" aria-label="Presentation tools">
      <OfficeMenu label={t('common.file')}>
        <button className="office-menu-item" onClick={() => void createNew(undefined, 'blank')}><FilePlus2 size={14} />{t('office.newPresentation')}</button>
        <button className="office-menu-item" onClick={() => void createNew(undefined, 'pitch')}><FilePlus2 size={14} />New pitch deck</button>
        <button className="office-menu-item" onClick={() => importRef.current?.click()}><FileUp size={14} />Import NOVA presentation</button>
        <button className="office-menu-item" onClick={() => setRevisionsOpen(true)}><History size={14} />{t('office.revisionHistory')}</button>
        <button className="office-menu-item" onClick={() => void exportNative()} disabled={busy}><Download size={14} />Download NOVA presentation</button>
        <button className="office-menu-item" onClick={() => void exportPptx()} disabled={busy}><Download size={14} />Export PowerPoint (.pptx)</button>
      </OfficeMenu>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('common.undo')} onClick={undo} disabled={!pastRef.current.length}><Undo2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.redo')} onClick={redo} disabled={!redoRef.current.length}><Redo2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label="Add text" onClick={() => addObject(createTextSlideObject(dataRef.current.theme))}><TextCursorInput size={15} /></OfficeToolbarButton>
      <OfficeMenu label={t('slides.shape')} icon={<Shapes size={14} />}>
        <button className="office-menu-item" onClick={() => addObject(createShapeSlideObject('rectangle'))}><Square size={14} />Rectangle</button>
        <button className="office-menu-item" onClick={() => addObject(createShapeSlideObject('ellipse'))}><Shapes size={14} />Ellipse</button>
      </OfficeMenu>
      <OfficeToolbarButton label="Add image" onClick={() => imageRef.current?.click()}><Image size={15} /></OfficeToolbarButton>
      <span className="office-toolbar-divider" />
      <select className="office-select" aria-label={t('slides.layout')} value={activeSlide.layout} onChange={(event) => mutate(() => updateActiveSlide((slide) => applySlideLayout(slide, event.target.value as SlideLayout, dataRef.current.theme)))}>
        <option value="blank">Blank</option><option value="title">Title</option><option value="title-content">Title & content</option><option value="two-column">Two columns</option>
      </select>
      <select className="office-select" aria-label={t('slides.theme')} value={data.theme} onChange={(event) => applyData(applyPresentationTheme(dataRef.current, event.target.value as PresentationDocument['theme']))}>
        <option value="cosmic">Cosmic</option><option value="midnight">Midnight</option><option value="light">Light</option>
      </select>
      <label className="office-color-control" title={t('slides.background')}><span className="slides-background-icon" /><span className="sr-only">{t('slides.background')}</span><input type="color" aria-label={t('slides.background')} value={activeSlide.background} onChange={(event) => updateActiveSlide((slide) => ({ ...slide, background: event.target.value }))} /></label>
      <OfficeToolbarButton label="Object properties" active={inspectorOpen} onClick={() => setInspectorOpen((current) => !current)}><Settings2 size={15} /></OfficeToolbarButton>
      <button type="button" className="office-primary-button slides-present-button" onClick={() => { setSelectedObjectId(null); setPresenting(true); }}><Play size={14} />{t('slides.present')}</button>
    </div>
    {(error || actionError || busy) && <div className={`office-action-banner ${error || actionError ? 'is-error' : ''}`} role={error || actionError ? 'alert' : 'status'}>{error || actionError || t('common.loading')}</div>}
    <OfficeWarnings warnings={warnings} onDismiss={() => setWarnings([])} />
    <div className="slides-main">
      <aside className="slides-sidebar" aria-label="Slides">
        <div className="slides-sidebar-heading"><strong>{t('office.slides')}</strong><OfficeToolbarButton label={t('slides.addSlide')} onClick={addSlide}><Plus size={15} /></OfficeToolbarButton></div>
        <div className="slides-thumbnail-list app-scroll">
          {data.slides.map((slide, index) => <button key={slide.id} type="button" className={`slides-thumbnail ${slide.id === activeSlide.id ? 'is-active' : ''}`} onClick={() => selectSlide(slide.id)} aria-label={`${t('slides.slide')} ${index + 1}: ${slide.name}`} aria-current={slide.id === activeSlide.id ? 'page' : undefined}>
            <span className="slides-thumbnail-number">{index + 1}</span><SlideStage slide={slide} label="" /><span className="slides-thumbnail-name">{slide.name}</span>
          </button>)}
        </div>
        <div className="slides-slide-actions">
          <OfficeToolbarButton label="Move slide up" onClick={() => applyData(movePresentationSlide(dataRef.current, activeSlide.id, -1))} disabled={activeIndex <= 0}><ArrowUp size={14} /></OfficeToolbarButton>
          <OfficeToolbarButton label="Move slide down" onClick={() => applyData(movePresentationSlide(dataRef.current, activeSlide.id, 1))} disabled={activeIndex >= data.slides.length - 1}><ArrowDown size={14} /></OfficeToolbarButton>
          <OfficeToolbarButton label={t('common.duplicate')} onClick={() => mutate(() => { const result = duplicatePresentationSlide(dataRef.current, activeSlide.id); applyData(result.document); selectSlide(result.slide.id); })}><Copy size={14} /></OfficeToolbarButton>
          <OfficeToolbarButton label={t('common.delete')} onClick={deleteSlide} disabled={data.slides.length <= 1}><Trash2 size={14} /></OfficeToolbarButton>
        </div>
      </aside>
      <main className="slides-workspace app-scroll">
        <div className="slides-stage-frame"><SlideStage slide={activeSlide} editable selectedObjectId={selectedObjectId} onSelect={setSelectedObjectId} onBeginTransform={pushHistory} onObjectChange={(id, patch) => updateObject(id, (object) => ({ ...object, ...patch }), false)} onDelete={deleteObject} /></div>
        <p className="slides-editing-hint">Select an object to edit. Drag to move, use the corner handle to resize, or use arrow keys.</p>
      </main>
      <aside className={`office-side-panel slides-inspector app-scroll ${inspectorOpen ? 'is-open' : ''}`} aria-label="Slide properties">
        <div className="office-panel-heading"><h2>Slide properties</h2><OfficeToolbarButton label={t('common.close')} onClick={() => setInspectorOpen(false)}><X size={14} /></OfficeToolbarButton></div>
        <label className="office-field"><span>Slide name</span><input className="office-input" value={activeSlide.name} maxLength={80} onFocus={() => { editSessionRef.current = false; }} onBlur={() => { editSessionRef.current = false; }} onChange={(event) => {
          const record = !editSessionRef.current; editSessionRef.current = true;
          updateActiveSlide((slide) => ({ ...slide, name: event.target.value }), record);
        }} /></label>
        {selectedObject ? <section className="slides-object-properties">
          <h3>{selectedObject.type[0].toUpperCase() + selectedObject.type.slice(1)} object</h3>
          {selectedObject.type === 'text' && <>
            <label className="office-field"><span>{t('slides.text')}</span><textarea className="office-input" rows={5} value={selectedObject.text} maxLength={50_000} onFocus={() => { editSessionRef.current = false; }} onBlur={() => { editSessionRef.current = false; }} onChange={(event) => updateSelected({ text: event.target.value }, true)} /></label>
            <label className="office-field"><span>{t('writer.fontSize')}</span><input className="office-input" type="number" min={8} max={120} value={selectedObject.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} /></label>
            <label className="office-field"><span>Alignment</span><select className="office-input" value={selectedObject.align} onChange={(event) => updateSelected({ align: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            <label className="office-checkbox-field"><input type="checkbox" checked={selectedObject.bold} onChange={(event) => updateSelected({ bold: event.target.checked })} />{t('writer.bold')}</label>
            <label className="office-field"><span>{t('writer.textColor')}</span><input type="color" value={selectedObject.color} onChange={(event) => updateSelected({ color: event.target.value })} /></label>
          </>}
          {selectedObject.type === 'image' && <label className="office-field"><span>Alternative text</span><input className="office-input" value={selectedObject.alt} maxLength={300} onChange={(event) => updateSelected({ alt: event.target.value })} /></label>}
          {selectedObject.type === 'shape' && <>
            <label className="office-field"><span>{t('slides.shape')}</span><select className="office-input" value={selectedObject.shape} onChange={(event) => updateSelected({ shape: event.target.value as ShapeSlideObject['shape'] })}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option></select></label>
            <label className="office-field"><span>{t('sheets.fillColor')}</span><input type="color" value={selectedObject.fill} onChange={(event) => updateSelected({ fill: event.target.value })} /></label>
            <label className="office-field"><span>Stroke color</span><input type="color" value={selectedObject.stroke} onChange={(event) => updateSelected({ stroke: event.target.value })} /></label>
          </>}
          <div className="slides-geometry-grid">
            {(['x', 'y', 'width', 'height', 'rotation'] as const).map((property) => <label className="office-field" key={property}><span>{property === 'x' ? 'X %' : property === 'y' ? 'Y %' : property === 'width' ? 'Width %' : property === 'height' ? 'Height %' : 'Rotation °'}</span><input className="office-input" type="number" min={property === 'rotation' ? -180 : property === 'width' || property === 'height' ? 1 : 0} max={property === 'rotation' ? 180 : 100} value={selectedObject[property] ?? 0} onChange={(event) => updateSelected({ [property]: Number(event.target.value) })} /></label>)}
          </div>
          <div className="slides-object-actions">
            <OfficeToolbarButton label="Send backward" onClick={() => updateActiveSlide((slide) => moveSlideObject(slide, selectedObject.id, -1))}><ArrowLeft size={14} /></OfficeToolbarButton>
            <OfficeToolbarButton label="Bring forward" onClick={() => updateActiveSlide((slide) => moveSlideObject(slide, selectedObject.id, 1))}><ArrowRight size={14} /></OfficeToolbarButton>
            <OfficeToolbarButton label={t('common.duplicate')} onClick={() => mutate(() => { const result = duplicateSlideObject(activeSlide, selectedObject.id); updateActiveSlide(() => result.slide); setSelectedObjectId(result.object.id); })}><Copy size={14} /></OfficeToolbarButton>
            <OfficeToolbarButton label={t('common.delete')} onClick={() => deleteObject(selectedObject.id)}><Trash2 size={14} /></OfficeToolbarButton>
          </div>
        </section> : <p className="office-panel-note">Select text, an image, or a shape on the slide to edit its content, position, size, and layer order.</p>}
      </aside>
    </div>
    <footer className="office-statusbar"><span>{t('slides.slide')} {activeIndex + 1} / {data.slides.length}</span><span>{activeSlide.objects.length} objects</span><span className="office-statusbar-right">{t('office.localOffline')}</span></footer>
    <input ref={importRef} type="file" className="hidden" accept=".nwslides,application/x-nova-slides+json" onChange={(event) => { importPresentation(event.target.files?.[0]); event.target.value = ''; }} />
    <input ref={imageRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(event) => { importImage(event.target.files?.[0]); event.target.value = ''; }} />
    {revisionsOpen && <OfficeRevisionDialog fileId={file.id} kind="slides" onClose={() => setRevisionsOpen(false)} onRestore={(revision) => { const restored = validatePresentationDocument(revision); applyData(restored); selectSlide(restored.slides[0].id); }} />}
    {presenting && <section className="slides-presenter" aria-label="Presentation mode">
      <div className="slides-presenter-stage"><SlideStage slide={activeSlide} label={`${t('slides.slide')} ${activeIndex + 1}: ${activeSlide.name}`} /></div>
      <div className="slides-presenter-controls">
        <OfficeToolbarButton label={t('common.previous')} onClick={() => selectSlide(data.slides[Math.max(0, activeIndex - 1)].id)} disabled={activeIndex <= 0}><ArrowLeft size={18} /></OfficeToolbarButton>
        <span>{activeIndex + 1} / {data.slides.length}</span>
        <OfficeToolbarButton label={t('common.next')} onClick={() => selectSlide(data.slides[Math.min(data.slides.length - 1, activeIndex + 1)].id)} disabled={activeIndex >= data.slides.length - 1}><ArrowRight size={18} /></OfficeToolbarButton>
        <button type="button" className="office-secondary-button" onClick={() => setPresenting(false)}><X size={15} />{t('slides.exitPresentation')}</button>
      </div>
      <div className="slides-presenter-brand"><MonitorPlay size={15} />NOVA Slides</div>
    </section>}
  </div>;
}
