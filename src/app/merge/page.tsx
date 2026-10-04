"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, X, Loader2, Eye, LayoutGrid, FileText, Download, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from 'pdfjs-dist';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import styles from "./merge.module.css";

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

type PdfDocument = {
  id: string;
  file: File;
  name: string;
  pageCount: number;
};

type SelectedPage = {
  id: string; // unique sequence id
  docId: string;
  pageIndex: number;
};

// Thumbnail Component
function PdfThumbnail({ file, pageIndex }: { file: File, pageIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let renderTask: any = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(pageIndex + 1); // pdf.js is 1-indexed

        if (!isMounted || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: 1 });
        const scale = 140 / viewport.width; // Scale down for thumbnail
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
        });

        await renderTask.promise;
        if (isMounted) setLoading(false);
      } catch (error) {
        console.error("Thumbnail rendering error", error);
        if (isMounted) setLoading(false);
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {}
      }
    };
  }, [file, pageIndex]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {loading && <div style={{ position: 'absolute', opacity: 0.5, fontSize: '0.8rem' }}>Loading...</div>}
      <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
}

// Sortable Card Component
function SortablePageCard({ 
  page, 
  docIndex, 
  document, 
  removePage,
  isChecked,
  toggleCheck 
}: { 
  page: SelectedPage, 
  docIndex: number, 
  document: PdfDocument, 
  removePage: (id: string) => void,
  isChecked: boolean,
  toggleCheck: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const docColor = `hsl(${docIndex * 40}, 70%, 50%)`;

  return (
    <div ref={setNodeRef} style={style} className={`${styles.pageCard} ${isChecked ? styles.selected : ''}`}>
      
      {/* Overlay with Checkbox and Hover Delete */}
      <div className={styles.cardOverlay}>
        <input 
          type="checkbox" 
          className={`${styles.cardCheckbox} ${isChecked ? styles.checked : ''}`}
          checked={isChecked}
          onChange={() => toggleCheck(page.id)}
          onPointerDown={(e) => e.stopPropagation()} 
        />
        <button 
          className={styles.cardDeleteBtn}
          onClick={() => removePage(page.id)}
          onPointerDown={(e) => e.stopPropagation()}
          title="Remove from sequence"
        >
          <X size={14} />
        </button>
      </div>

      <div 
        className={styles.pageCardVisual} 
        style={{ borderTop: `4px solid ${docColor}`, cursor: isDragging ? 'grabbing' : 'grab' }} 
        {...attributes} 
        {...listeners}
      >
        <PdfThumbnail file={document.file} pageIndex={page.pageIndex} />
      </div>
      <div className={styles.pageCardInfo}>
        <div className={styles.pageCardTitle}>Doc {docIndex + 1}</div>
        <div className={styles.pageCardSubtitle}>Page {page.pageIndex + 1}</div>
      </div>
    </div>
  );
}

export default function MergePage() {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [selectedPages, setSelectedPages] = useState<SelectedPage[]>([]);
  const [checkedPages, setCheckedPages] = useState<Set<string>>(new Set());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"sequence" | "preview">("sequence");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setMergedPdfUrl(null);
    }
  };

  // Upload and parse PDFs
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsProcessing(true);
    
    try {
      const newFiles = Array.from(e.target.files).filter(file => file.type === "application/pdf");
      const newDocs: PdfDocument[] = [];
      const newPages: SelectedPage[] = [];
      
      for (const file of newFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        const docId = Math.random().toString(36).substring(7);
        
        newDocs.push({
          id: docId,
          file,
          name: file.name,
          pageCount
        });
        
        // Auto-add all pages to the sequence by default
        for (let i = 0; i < pageCount; i++) {
          newPages.push({
            id: Math.random().toString(36).substring(7),
            docId,
            pageIndex: i
          });
        }
      }
      
      setDocuments(prev => [...prev, ...newDocs]);
      setSelectedPages(prev => [...prev, ...newPages]);
      setViewMode("sequence");
      setMergedPdfUrl(null);
    } catch (error) {
      console.error("Error reading PDFs:", error);
      alert("Error reading one or more PDF files. Ensure they are valid PDFs.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDocument = (docId: string) => {
    setDocuments(docs => docs.filter(d => d.id !== docId));
    setSelectedPages(pages => pages.filter(p => p.docId !== docId));
    
    // Clean up checked pages
    setCheckedPages(prev => {
      const newSet = new Set(prev);
      selectedPages.filter(p => p.docId === docId).forEach(p => newSet.delete(p.id));
      return newSet;
    });
    setMergedPdfUrl(null);
  };

  const togglePageInSequence = (docId: string, pageIndex: number) => {
    const isSelected = selectedPages.some(p => p.docId === docId && p.pageIndex === pageIndex);
    
    if (isSelected) {
      // Find the id and remove it from checked state if needed
      const pageToRemove = selectedPages.find(p => p.docId === docId && p.pageIndex === pageIndex);
      if (pageToRemove && checkedPages.has(pageToRemove.id)) {
        setCheckedPages(prev => {
          const newSet = new Set(prev);
          newSet.delete(pageToRemove.id);
          return newSet;
        });
      }
      setSelectedPages(pages => pages.filter(p => !(p.docId === docId && p.pageIndex === pageIndex)));
    } else {
      setSelectedPages(pages => [
        ...pages, 
        { id: Math.random().toString(36).substring(7), docId, pageIndex }
      ]);
    }
    setMergedPdfUrl(null);
  };

  const removePageFromSequence = (id: string) => {
    setSelectedPages(pages => pages.filter(p => p.id !== id));
    if (checkedPages.has(id)) {
      setCheckedPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
    setMergedPdfUrl(null);
  };

  const toggleCheck = (id: string) => {
    setCheckedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const deleteSelected = () => {
    setSelectedPages(pages => pages.filter(p => !checkedPages.has(p.id)));
    setCheckedPages(new Set());
    setMergedPdfUrl(null);
  };

  const toggleCheckAll = () => {
    if (checkedPages.size === selectedPages.length) {
      setCheckedPages(new Set());
    } else {
      setCheckedPages(new Set(selectedPages.map(p => p.id)));
    }
  };

  const mergeAndPreview = async () => {
    if (selectedPages.length === 0) return;
    setIsProcessing(true);
    
    try {
      const mergedPdf = await PDFDocument.create();
      const loadedDocs = new Map<string, PDFDocument>();
      
      for (const page of selectedPages) {
        if (!loadedDocs.has(page.docId)) {
          const docInfo = documents.find(d => d.id === page.docId);
          if (docInfo) {
            const arrayBuffer = await docInfo.file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            loadedDocs.set(page.docId, pdfDoc);
          }
        }
        
        const sourceDoc = loadedDocs.get(page.docId);
        if (sourceDoc) {
          const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [page.pageIndex]);
          mergedPdf.addPage(copiedPage);
        }
      }
      
      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setMergedPdfUrl(url);
      setViewMode("preview");
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("An error occurred while merging the PDFs.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backButton}>
            <ArrowLeft size={20} />
            Back
          </Link>
          <h1>Advanced Merge & Rearrange</h1>
        </div>
        
        <div className={styles.headerRight}>
          {documents.length > 0 && selectedPages.length > 0 && (
            <button 
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={mergeAndPreview}
              disabled={isProcessing || viewMode === "preview"}
            >
              {isProcessing ? <><Loader2 size={16} className={styles.spinner}/> Processing...</> : <><Eye size={16} /> Preview & Build</>}
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          
          {/* LEFT SIDEBAR: Document List & Upload */}
          <div className={styles.sidebar}>
            <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} className={styles.uploadIcon} />
              <p>Add PDF Files</p>
              <input 
                type="file" 
                multiple 
                accept="application/pdf" 
                className={styles.hiddenInput} 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            {documents.length > 0 && (
              <div className={styles.docList}>
                <h3>Source Documents</h3>
                {documents.map((doc, idx) => (
                  <div key={doc.id} className={styles.docItem}>
                    <div className={styles.docHeader}>
                      <span className={styles.docTitle}>
                        <div style={{ backgroundColor: `hsl(${idx * 40}, 70%, 50%)`, width: 12, height: 12, borderRadius: 2 }}></div>
                        {doc.name}
                      </span>
                      <button className={styles.removeDocBtn} onClick={() => removeDocument(doc.id)}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className={styles.docMeta}>{doc.pageCount} pages total</div>
                    
                    {/* Clickable grid of pages for this doc */}
                    <div className={styles.pageGrid}>
                      {Array.from({ length: doc.pageCount }).map((_, i) => {
                        const isSelected = selectedPages.some(p => p.docId === doc.id && p.pageIndex === i);
                        return (
                          <button 
                            key={i}
                            onClick={() => togglePageInSequence(doc.id, i)}
                            className={`${styles.pageToggle} ${isSelected ? styles.selected : ''}`}
                            title={`Toggle Page ${i + 1}`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MAIN WORKSPACE: Sequence or Preview */}
          <div className={styles.workspace}>
            {documents.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText size={64} />
                <h2>Start by adding PDF files</h2>
                <p>You'll be able to select specific pages, rearrange them, and merge them perfectly.</p>
              </div>
            ) : viewMode === "sequence" ? (
              <>
                <div className={styles.sequenceHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {selectedPages.length > 0 && (
                      <input 
                        type="checkbox" 
                        title="Select All / Deselect All"
                        checked={selectedPages.length > 0 && checkedPages.size === selectedPages.length}
                        onChange={toggleCheckAll}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                    )}
                    <div>
                      <h2>Final PDF Sequence ({selectedPages.length} pages)</h2>
                      <p style={{opacity: 0.7, fontSize: '0.9rem'}}>Drag pages to reorder them. Hover to delete or select.</p>
                    </div>
                  </div>
                  
                  {checkedPages.size > 0 && (
                    <button 
                      className={`${styles.button} ${styles.dangerButton}`}
                      onClick={deleteSelected}
                    >
                      <Trash2 size={16} /> Delete {checkedPages.size} Selected
                    </button>
                  )}
                </div>
                
                {selectedPages.length === 0 ? (
                  <div className={styles.emptyState} style={{marginTop: '4rem'}}>
                    <LayoutGrid size={48} />
                    <p>No pages selected. Select pages from the sidebar.</p>
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={selectedPages.map(p => p.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className={styles.sequenceList}>
                        {selectedPages.map((page) => {
                          const docIndex = documents.findIndex(d => d.id === page.docId);
                          const doc = documents[docIndex];
                          if (!doc) return null;
                          return (
                            <SortablePageCard 
                              key={page.id} 
                              page={page} 
                              docIndex={docIndex} 
                              document={doc} 
                              removePage={removePageFromSequence}
                              isChecked={checkedPages.has(page.id)}
                              toggleCheck={toggleCheck}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </>
            ) : (
              <div className={styles.previewSection}>
                <div className={styles.previewHeader}>
                  <div style={{display: 'flex', gap: '1rem'}}>
                    <h2>Document Preview</h2>
                    <button className={styles.secondaryButton} onClick={() => setViewMode("sequence")}>
                      <LayoutGrid size={16} style={{marginRight: '0.5rem'}}/> Edit Sequence
                    </button>
                  </div>
                  {mergedPdfUrl && (
                    <a href={mergedPdfUrl} download="Custom_Merged.pdf" className={`${styles.button} ${styles.successButton}`}>
                      <Download size={16} /> Download PDF
                    </a>
                  )}
                </div>
                {mergedPdfUrl && (
                  <iframe src={mergedPdfUrl} className={styles.pdfPreview} title="PDF Preview" />
                )}
              </div>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}
