'use client';

import React from 'react';
import {
  FileText,
  Percent,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Brain,
  MessageSquare
} from 'lucide-react';
import { Assessment } from '../types';

interface DashboardScreenProps {
  assessment: Assessment;
  onEnterWorkspace: () => void;
  onNewAssessment: () => void;
}

export default function DashboardScreen({
  assessment,
  onEnterWorkspace,
  onNewAssessment
}: DashboardScreenProps) {
  const summary = assessment.summary;

  if (!summary) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Summary statistics compiling...</p>
      </div>
    );
  }

  // Color mappings
  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600 dark:text-emerald-405';
    if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getPercentageBg = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-50 dark:bg-emerald-950/20';
    if (pct >= 50) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-rose-50 dark:bg-rose-950/20';
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 select-none">
      
      {/* 1. Header Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Assessment Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Grading analysis processed successfully. Overview of student results and confidence alignments.
          </p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <button
            onClick={onNewAssessment}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            New Assessment
          </button>
          <button
            onClick={onEnterWorkspace}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Enter Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Score Ring */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Final Grade</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <h2 className={`text-4xl font-extrabold ${getPercentageColor(summary.percentage)}`}>
              {summary.percentage}%
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Score: {summary.marks_obtained} / {summary.total_marks} marks
            </p>
          </div>
          <div className={`text-[10px] font-bold px-2 py-1 rounded inline-block w-max ${getPercentageBg(summary.percentage)}`}>
            {summary.percentage >= 80 ? 'EXCELLENT' : summary.percentage >= 50 ? 'SATISFACTORY' : 'REQUIRES IMPROVEMENT'}
          </div>
        </div>

        {/* Questions Summary */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Questions</span>
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-650 dark:text-slate-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <h2 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100">
              {summary.total_questions}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Total questions processed in paper
            </p>
          </div>
          <div className="text-slate-400 text-[10px] font-bold font-mono">
            {summary.answered} ANSWERED · {summary.unanswered} UNANSWERED
          </div>
        </div>

        {/* Review Needed */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Needs Review</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/25 rounded-lg text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <h2 className={`text-4xl font-extrabold ${summary.needs_review > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
              {summary.needs_review}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Uncertain AI mapping flags
            </p>
          </div>
          <div className="text-[10px] font-bold">
            {summary.needs_review > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">AWAITING TEACHER OVERRIDE</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-450">ALL MAPPINGS ALIGNED</span>
            )}
          </div>
        </div>

        {/* Unmatched Blocks */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Unmatched Blocks</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <h2 className={`text-4xl font-extrabold ${summary.unmatched_answers > 0 ? 'text-purple-650' : 'text-slate-400'}`}>
              {summary.unmatched_answers}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Orphan answers on student sheet
            </p>
          </div>
          <div className="text-[10px] font-bold text-slate-400 font-mono">
            {summary.unmatched_answers > 0 ? 'REASSIGN IN WORKSPACE' : 'NO ORPHANS DETECTED'}
          </div>
        </div>

      </div>

      {/* 3. DeepSeek Feedback Synthesis */}
      <div className="glass-panel rounded-2xl p-6 mb-8 border-l-4 border-l-blue-500">
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
          <Brain className="w-4 h-4 text-blue-500" />
          <span>AI Feedback Synthesis</span>
        </h3>
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl mt-1">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-350">
            {summary.overall_feedback}
          </p>
        </div>
      </div>

      {/* 4. Question details lists */}
      <div className="glass-panel rounded-2xl p-6 overflow-hidden">
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-1.5">
          <TrendingUp className="w-4 h-4" />
          <span>Performance breakdown</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-bold">
                <th className="py-3 px-4">Q#</th>
                <th className="py-3 px-4">Question Text</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Awarded / Max</th>
                <th className="py-3 px-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {assessment.questions.map((q) => {
                const mapping = assessment.mappings.find((m) => m.question_id === q.id);
                const grade = assessment.grades.find((g) => g.question_id === q.id);
                const status = mapping?.status || 'unanswered';
                
                return (
                  <tr
                    key={q.id}
                    className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold">Q{q.number}</td>
                    <td className="py-3 px-4 max-w-sm truncate text-slate-600 dark:text-slate-350 font-medium" title={q.text}>
                      {q.text}
                    </td>
                    <td className="py-3 px-4">
                      {status === 'answered' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" /> Answered
                        </span>
                      ) : status === 'uncertain' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-955/40 dark:text-amber-400">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Needs Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-955/40 dark:text-rose-455">
                          <FileText className="w-2.5 h-2.5 mr-1" /> Unanswered
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {grade?.marks_obtained ?? 0} / {grade?.max_marks ?? q.marks ?? 5}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {grade && grade.percentage !== null ? (
                        <span className={`font-extrabold text-xs px-2 py-0.5 rounded-full ${getPercentageBg(grade.percentage)} ${getPercentageColor(grade.percentage)}`}>
                          {grade.percentage}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
