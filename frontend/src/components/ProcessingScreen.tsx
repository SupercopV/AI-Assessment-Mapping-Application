'use client';

import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, FileText, Cpu, Brain, Layers } from 'lucide-react';
import { ProcessingStatus } from '../types';

interface ProcessingScreenProps {
  status: ProcessingStatus;
}

export default function ProcessingScreen({ status }: ProcessingScreenProps) {
  const steps = [
    {
      id: 'uploading',
      label: 'File Upload',
      icon: FileText,
      description: 'Uploading document assets to API server...',
    },
    {
      id: 'processing_qp',
      label: 'Question Paper OCR',
      icon: Cpu,
      description: 'Running PaddleOCR tokenization layout checks...',
    },
    {
      id: 'extracting_questions',
      label: 'Question Parsing',
      icon: Brain,
      description: 'DeepSeek extracting numbered questions & marks...',
    },
    {
      id: 'processing_as',
      label: 'Answer Sheet OCR',
      icon: Cpu,
      description: 'Segmenting handwriting and layouts...',
    },
    {
      id: 'mapping_answers',
      label: 'Answer Matching',
      icon: Layers,
      description: 'DeepSeek mapping sheet answers to questions...',
    },
    {
      id: 'grading',
      label: 'Grading & Feedback',
      icon: Brain,
      description: 'Comparing concepts and calculating marks...',
    },
  ];

  // Helper to determine step status
  const getStepState = (stepId: string) => {
    const order = [
      'uploading',
      'processing_qp',
      'extracting_questions',
      'processing_as',
      'extracting_answers', // Subpart of mapping
      'mapping_answers',
      'grading',
      'complete',
    ];
    
    const currentIndex = order.indexOf(status.step);
    const stepIndex = order.indexOf(stepId);

    if (status.step === 'failed') {
      if (stepIndex === currentIndex) return 'error';
      if (stepIndex < currentIndex) return 'completed';
      return 'pending';
    }

    if (stepIndex < currentIndex) return 'completed';
    if (stepId === status.step || (stepId === 'mapping_answers' && status.step === 'extracting_answers')) {
      return 'active';
    }
    return 'pending';
  };

  const getStepProgressColor = (stepState: string) => {
    switch (stepState) {
      case 'completed':
        return 'bg-emerald-500 text-white border-emerald-500';
      case 'active':
        return 'bg-blue-600 text-white border-blue-600 pulse-active';
      case 'error':
        return 'bg-rose-500 text-white border-rose-500';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="glass-panel rounded-2xl p-8 text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Analyzing Assessment</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-sm mx-auto">
          Please wait while PaddleOCR and DeepSeek analyze your student answers.
        </p>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-4 border border-slate-200/50 dark:border-slate-700/50">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              status.step === 'failed' ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
          <span>{status.message}</span>
          <span className="font-mono">{status.progress}%</span>
        </div>
      </div>

      {/* Accordion list of analysis pipeline */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const state = getStepState(step.id);
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-start p-4 rounded-xl border transition-all duration-300 ${
                state === 'active'
                  ? 'border-blue-200 dark:border-blue-900/55 bg-blue-50/20 dark:bg-blue-900/5'
                  : 'border-slate-200/60 dark:border-slate-800/40 bg-white/40 dark:bg-slate-900/10'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-sm mr-4 flex-shrink-0 transition-colors ${getStepProgressColor(
                  state
                )}`}
              >
                {state === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : state === 'active' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : state === 'error' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <h3
                  className={`font-semibold text-sm ${
                    state === 'active'
                      ? 'text-blue-600 dark:text-blue-400'
                      : state === 'error'
                      ? 'text-rose-500'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {step.label}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
