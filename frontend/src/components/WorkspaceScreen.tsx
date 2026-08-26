'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  FileMinus,
  Edit2,
  Check,
  RefreshCw,
  CornerDownRight
} from 'lucide-react';
import { Assessment, Question, AnswerBlock, AnswerMapping, BoundingBox } from '../types';

interface WorkspaceScreenProps {
  assessment: Assessment;
  sessionId: string;
  baseUrl: string;
  onUpdateAssessment: (updated: Assessment) => void;
}

export default function WorkspaceScreen({
  assessment,
  sessionId,
  baseUrl,
  onUpdateAssessment
}: WorkspaceScreenProps) {
  // UI states
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null); // For unmatched navigation
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // PDF Viewer states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0); // scale multiplier
  const [dimensions, setDimensions] = useState<Record<string, Array<{page: number, width: number, height: number}>>>({});
  const [loadingDims, setLoadingDims] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Fetch page dimensions from backend on mount
  useEffect(() => {
    fetch(`${baseUrl}/api/assessment/${sessionId}/dimensions`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dimensions');
        return res.json();
      })
      .then((data) => {
        setDimensions(data);
        setLoadingDims(false);
      })
      .catch((err) => {
        console.error('Error loading dimensions:', err);
        setLoadingDims(false);
      });
  }, [sessionId, baseUrl]);

  // Sync selected question with answer sheet pages & page navigation
  const selectedQuestion = assessment.questions.find((q) => q.id === selectedQuestionId);
  const selectedAnswerMapping = assessment.mappings.find((m) => m.question_id === selectedQuestionId);
  const selectedAnswerBlock = assessment.answers.find(
    (a) => a.id === (selectedQuestionId ? selectedAnswerMapping?.answer_id : selectedAnswerId)
  );

  // Auto navigate to the correct page when a question is clicked
  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    setSelectedAnswerId(null);
    const mapping = assessment.mappings.find((m) => m.question_id === qId);
    if (mapping && mapping.answer_id) {
      const block = assessment.answers.find((a) => a.id === mapping.answer_id);
      if (block && block.pages && block.pages.length > 0) {
        setCurrentPage(block.pages[0]);
      }
    } else {
      // Fallback: go to the question paper source page if unanswered
      const qObj = assessment.questions.find((q) => q.id === qId);
      if (qObj && qObj.source_pages && qObj.source_pages.length > 0) {
        // Since we are viewing the STUDENT ANSWER sheet, this might not correspond, but it's a fallback.
      }
    }
  };

  const handleSelectUnmatchedAnswer = (ansId: string) => {
    setSelectedAnswerId(ansId);
    setSelectedQuestionId(null);
    const block = assessment.answers.find((a) => a.id === ansId);
    if (block && block.pages && block.pages.length > 0) {
      setCurrentPage(block.pages[0]);
    }
  };

  // Get status of a question based on its mapping
  const getQuestionStatus = (qId: string) => {
    const m = assessment.mappings.find((mapping) => mapping.question_id === qId);
    if (!m) return 'unanswered';
    return m.status; // answered | unanswered | uncertain
  };

  // Filter questions
  const filteredQuestions = assessment.questions.filter((q) => {
    const status = getQuestionStatus(q.id);
    if (filterStatus === 'all') return true;
    if (filterStatus === 'answered') return status === 'answered';
    if (filterStatus === 'unanswered') return status === 'unanswered';
    if (filterStatus === 'review') return status === 'uncertain';
    return true;
  });

  const unmatchedAnswers = assessment.mappings.filter((m) => m.status === 'unmatched');

  // Manual mapping configuration updating API
  const handleUpdateMapping = async (qId: string | null, aId: string | null, targetStatus: 'answered' | 'unanswered' | 'unmatched' | 'uncertain') => {
    setIsUpdating(true);
    
    // Construct new mapping request payload
    let newMappings = [...assessment.mappings];
    
    if (qId) {
      // 1. Find existing mapping for this question, customize it
      newMappings = newMappings.map((m) => {
        if (m.question_id === qId) {
          return {
            ...m,
            answer_id: targetStatus === 'unanswered' ? null : aId,
            status: targetStatus,
            confidence: 1.0,
            reason: 'Manually corrected by teacher.'
          };
        }
        return m;
      });
      
      // If we assigned an answer block, we must make sure no other question is mapped to the SAME answer block,
      // OR if we do, this is in-memory. Let's make sure it releases any previous mappings that had this answer block matching.
      if (aId && targetStatus === 'answered') {
        newMappings = newMappings.map((m) => {
          if (m.question_id !== qId && m.answer_id === aId) {
            return {
              ...m,
              answer_id: null,
              status: 'unanswered',
              confidence: 0.0,
              reason: 'Reassigned to another question.'
            };
          }
          return m;
        });
      }
    } else if (aId) {
      // Direct unmatched override edits. If the teacher reassigned an unmatched block to a question Q_x
      // we handle it. The teacher dropdown selection can trigger it.
    }

    try {
      const response = await fetch(`${baseUrl}/api/assessment/${sessionId}/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: newMappings })
      });
      if (!response.ok) throw new Error('Failed to update mapping');
      const updated = await response.json();
      onUpdateAssessment(updated);
    } catch (err) {
      console.error('Error updating mapping on backend:', err);
      alert('Failed to update mapping. Please check server log.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get active highlight regions for the current page
  const getActiveHighlights = () => {
    if (!selectedAnswerBlock) return [];
    
    // Return bounding boxes for this answer block that lie on the current page
    return selectedAnswerBlock.regions.filter((reg) => reg.page === currentPage);
  };

  // Calculate coordinates overlay scale factors
  const getBoundingBoxStyles = (box: BoundingBox) => {
    // We need original page dimensions to scale correctly
    const sheetDims = dimensions['answer_sheet'] || [];
    const pageDim = sheetDims.find((d) => d.page === currentPage);
    if (!pageDim) return {};

    // Standard width / height in points (e.g. 595 x 842)
    const { width: origW, height: origH } = pageDim;

    // Use percentage placement to adapt directly to the page image rendering container sizes!
    // x, y, width, height relative to origW, origH
    const left = (box.x / origW) * 100;
    const top = (box.y / origH) * 100;
    const w = (box.width / origW) * 100;
    const h = (box.height / origH) * 100;

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${w}%`,
      height: `${h}%`
    };
  };

  // Total pages
  const totalPages = dimensions['answer_sheet']?.length || 1;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'answered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3 mr-1" /> Answered
          </span>
        );
      case 'uncertain':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3 mr-1" /> Needs Review
          </span>
        );
      case 'unmatched':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400">
            <HelpCircle className="w-3 h-3 mr-1" /> Unmatched
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
            <FileMinus className="w-3 h-3 mr-1" /> Unanswered
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden border-t border-slate-200 dark:border-slate-800">
      
      {/* 1. Left Sidebar: Question List */}
      <div className="w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0 select-none">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg mb-3">Questions</h3>
          <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'answered', label: 'Ans' },
              { id: 'review', label: 'Review' },
              { id: 'unanswered', label: 'No Ans' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredQuestions.map((q) => {
            const status = getQuestionStatus(q.id);
            const isSelected = selectedQuestionId === q.id;
            const grade = assessment.grades.find((g) => g.question_id === q.id);
            
            return (
              <div
                key={q.id}
                onClick={() => handleSelectQuestion(q.id)}
                className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/10 dark:bg-blue-900/10 ring-1 ring-blue-500'
                    : 'border-slate-200/60 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    Q{q.number}
                  </span>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(status)}
                    {q.marks !== null && (
                      <span className="text-xs text-slate-400 font-medium">
                        [{q.marks}m]
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {q.text}
                </p>
                {status === 'answered' && grade && grade.marks_obtained !== null && (
                  <div className="mt-2 text-right">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded">
                      {grade.marks_obtained} / {grade.max_marks} marks
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unmatched student handwritten response blocks (for orphans review) */}
          {unmatchedAnswers.length > 0 && filterStatus === 'all' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">
                Unmatched Answers ({unmatchedAnswers.length})
              </h4>
              <div className="space-y-2">
                {unmatchedAnswers.map((m) => {
                  const block = assessment.answers.find((a) => a.id === m.answer_id);
                  const isSelected = selectedAnswerId === m.answer_id;
                  if (!block) return null;

                  return (
                    <div
                      key={block.id}
                      onClick={() => handleSelectUnmatchedAnswer(block.id)}
                      className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/10 dark:bg-purple-950/10 ring-1 ring-purple-500'
                          : 'border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                          {block.id.toUpperCase()}
                        </span>
                        {getStatusBadge('unmatched')}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 font-mono">
                        {block.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: Document Viewer with Highlighting */}
      <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-900/60 overflow-hidden relative">
        
        {/* Document Header Controls */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center select-none z-10">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setZoom(Math.max(0.6, zoom - 0.1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2.5, zoom + 0.1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              Actual Size
            </button>
          </div>
        </div>

        {/* Document Scroll area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-8 flex justify-center items-start scroll-smooth"
        >
          {loadingDims ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Configuring coordinate canvas overlays...</p>
            </div>
          ) : (
            <div
              className="relative shadow-xl border border-slate-350 dark:border-slate-800 bg-white rounded-lg select-none duration-150 transition-all"
              style={{
                width: `${(dimensions['answer_sheet']?.find((d) => d.page === currentPage)?.width || 612) * zoom}px`,
                aspectRatio: `${
                  (dimensions['answer_sheet']?.find((d) => d.page === currentPage)?.width || 612) /
                  (dimensions['answer_sheet']?.find((d) => d.page === currentPage)?.height || 792)
                }`
              }}
            >
              {/* Served Page Image */}
              <img
                ref={imageRef}
                src={`${baseUrl}/api/assessment/${sessionId}/page/answer_sheet/${currentPage}`}
                alt={`Student answer sheet page ${currentPage}`}
                className="w-full h-full object-contain rounded-lg pointer-events-none"
              />

              {/* Absolute Canvas Overlay bounding boxes */}
              <div className="absolute inset-0 top-0 left-0 w-full h-full pointer-events-none">
                {getActiveHighlights().map((box, index) => {
                  let styleClass = 'highlight-box-active';
                  if (selectedAnswerMapping?.status === 'uncertain') {
                    styleClass = 'highlight-box-needs-review';
                  } else if (!selectedQuestionId && selectedAnswerId) {
                    styleClass = 'highlight-box-unmatched';
                  }
                  
                  return (
                    <div
                      key={index}
                      className={`absolute ${styleClass}`}
                      style={getBoundingBoxStyles(box)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Panel: Question details, manual mappings, and grades */}
      <div className="w-full md:w-96 border-l border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0">
        
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-lg">Analysis Panel</h3>
          {isUpdating && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {selectedQuestion ? (
            <div className="space-y-6">
              
              {/* Question overview */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-blue-105 text-blue-800 text-xs font-bold px-2 py-0.5 rounded dark:bg-blue-950/40 dark:text-blue-400">
                    Q{selectedQuestion.number}
                  </span>
                  {selectedQuestion.marks && (
                    <span className="text-xs text-slate-500 font-bold">
                      Max Marks: {selectedQuestion.marks}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedQuestion.text}
                </p>
              </div>

              {/* Mapping Status & Override */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                  Mapping & Source Reference
                </h4>
                
                <div className="flex items-center space-x-2 text-sm">
                  <span className="font-medium text-slate-500">Status:</span>
                  {getStatusBadge(selectedAnswerMapping?.status || 'unanswered')}
                </div>

                {selectedAnswerMapping && selectedAnswerMapping.status !== 'unanswered' && (
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium text-slate-500">AI Confidence:</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      selectedAnswerMapping.mapping_confidence === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : selectedAnswerMapping.mapping_confidence === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-850 dark:bg-amber-955/40 dark:text-amber-400'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-955/40 dark:text-rose-455'
                    }`}>
                      {selectedAnswerMapping.mapping_confidence} ({Math.round(selectedAnswerMapping.confidence * 100)}%)
                    </span>
                  </div>
                )}

                {selectedAnswerMapping?.reason && (
                  <p className="text-xs text-slate-455 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-250/20">
                    {selectedAnswerMapping.reason}
                  </p>
                )}

                {/* Option to manual override */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    Assign Mapped Answer block:
                  </label>
                  <select
                    disabled={isUpdating}
                    value={selectedAnswerMapping?.answer_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleUpdateMapping(selectedQuestion.id, null, 'unanswered');
                      } else {
                        // Mark as answered
                        handleUpdateMapping(selectedQuestion.id, val, 'answered');
                      }
                    }}
                    className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-840 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Unanswered (No matching block) --</option>
                    {assessment.answers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id.toUpperCase()} (Page {a.pages[0]} - OCR Confidence {Math.round(a.ocr_confidence * 100)}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick actions */}
                {selectedAnswerMapping && selectedAnswerMapping.status === 'uncertain' && (
                  <button
                    onClick={() =>
                      handleUpdateMapping(
                        selectedQuestion.id,
                        selectedAnswerMapping.answer_id,
                        'answered'
                      )
                    }
                    className="w-full mt-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> <span>Confirm Mapping alignment</span>
                  </button>
                )}
              </div>

              {/* Student Answer Text Extract */}
              {selectedAnswerBlock ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                      Student Answer Text
                    </h4>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                      OCR Confidence: {Math.round(selectedAnswerBlock.ocr_confidence * 100)}%
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/40 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {selectedAnswerBlock.text}
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50/30 dark:bg-rose-950/10 border border-dashed border-rose-200/50 dark:border-rose-900/50 p-4 rounded-xl text-center text-rose-500 text-xs">
                  No student answer maps to Q{selectedQuestion.number} currently.
                </div>
              )}

              {/* AI Grading */}
              {selectedQuestionId && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                    AI Grading & Evaluation
                  </h4>
                  {(() => {
                    const grade = assessment.grades.find((g) => g.question_id === selectedQuestion.id);
                    if (!grade) return <p className="text-xs text-slate-400">Grading details compiling...</p>;

                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-lg">
                          <span className="text-xs font-semibold text-slate-500">Awarded Score:</span>
                          <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                            {grade.marks_obtained ?? 0} / {grade.max_marks ?? 5} ({grade.percentage ?? 0}%)
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500">Feedback:</span>
                          <p className="text-xs bg-blue-50/15 dark:bg-blue-950/10 p-3 rounded-lg border border-blue-100/60 dark:border-blue-950/30 text-slate-600 dark:text-slate-350 leading-normal">
                            {grade.feedback}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          ) : selectedAnswerId && selectedAnswerBlock ? (
            // Orphan / Unmatched view details
            <div className="space-y-6">
              <div className="glass-card rounded-xl p-4 border-purple-200 dark:border-purple-900/40">
                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded dark:bg-purple-950/40 dark:text-purple-400 block w-max mb-2">
                  Unmatched response segment
                </span>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono mb-2">
                  {selectedAnswerBlock.id.toUpperCase()}
                </h4>
                <p className="text-xs text-slate-500">
                  This text block was extracted on Page {selectedAnswerBlock.pages[0]} but PaddleOCR/DeepSeek was unable to safely link it to a question.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                  Raw Text Segment
                </h4>
                <div className="bg-slate-55 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/40 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedAnswerBlock.text}
                </div>
              </div>

              {/* Force map unmatched to a question */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                  Reassign to Question
                </h4>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    If this text belongs to a question paper item, select it below to create the manual link.
                  </p>
                  <select
                    disabled={isUpdating}
                    onChange={(e) => {
                      const qId = e.target.value;
                      if (!qId) return;
                      // map details
                      handleUpdateMapping(qId, selectedAnswerId, 'answered');
                      setSelectedQuestionId(qId);
                      setSelectedAnswerId(null);
                    }}
                    className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose Target Question --</option>
                    {assessment.questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        Question {q.number} ({q.text.substring(0, 30)}...)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <CornerDownRight className="w-8 h-8 mb-2 animate-bounce" />
              <p className="text-sm font-medium">Select a question or unmatched block on the left to inspect detailed OCR segments, highlights, and grades.</p>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
