'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, X, AlertCircle } from 'lucide-react';

interface UploadScreenProps {
  onProcess: (qpFile: File, asFile: File) => void;
}

export default function UploadScreen({ onProcess }: UploadScreenProps) {
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [asFile, setAsFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qpInputRef = useRef<HTMLInputElement>(null);
  const asInputRef = useRef<HTMLInputElement>(null);

  const [isDragQp, setIsDragQp] = useState(false);
  const [isDragAs, setIsDragAs] = useState(false);

  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
  const maxSizeBytes = 30 * 1024 * 1024; // 30 MB

  const validateFile = (file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return `Invalid format for "${file.name}". Supported: PDF, PNG, JPG, JPEG.`;
    }
    if (file.size > maxSizeBytes) {
      return `File "${file.name}" is too large. Max allowed size is 30MB.`;
    }
    return null;
  };

  const handleFileChange = (file: File | null, isQP: boolean) => {
    if (!file) return;
    setError(null);
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    if (isQP) {
      setQpFile(file);
    } else {
      setAsFile(file);
    }
  };

  const clearFile = (isQP: boolean) => {
    if (isQP) {
      setQpFile(null);
      if (qpInputRef.current) qpInputRef.current.value = '';
    } else {
      setAsFile(null);
      if (asInputRef.current) asInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent, isQP: boolean) => {
    e.preventDefault();
    if (isQP) setIsDragQp(true);
    else setIsDragAs(true);
  };

  const handleDragLeave = (isQP: boolean) => {
    if (isQP) setIsDragQp(false);
    else setIsDragAs(false);
  };

  const handleDrop = (e: React.DragEvent, isQP: boolean) => {
    e.preventDefault();
    if (isQP) {
      setIsDragQp(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChange(e.dataTransfer.files[0], true);
      }
    } else {
      setIsDragAs(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileChange(e.dataTransfer.files[0], false);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const renderUploadCard = (
    title: string,
    file: File | null,
    isQP: boolean,
    inputRef: React.RefObject<HTMLInputElement | null>,
    isDragging: boolean
  ) => {
    return (
      <div
        className={`glass-panel rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-900/10'
            : file
            ? 'border-emerald-500/50 bg-emerald-50/5 dark:bg-emerald-950/5'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
        onDragOver={(e) => handleDragOver(e, isQP)}
        onDragLeave={() => handleDragLeave(isQP)}
        onDrop={(e) => handleDrop(e, isQP)}
      >
        <input
          type="file"
          ref={inputRef}
          id={isQP ? "qp-file-input" : "as-file-input"}
          className="block mt-3 text-xs text-slate-500/65 font-mono cursor-pointer"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null, isQP)}
        />

        {!file ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 transition-transform hover:scale-105">
              <Upload className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{title}</h3>
            <p className="text-sm text-slate-500 mb-6">
              Drag and drop sheet here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-blue-500 font-semibold hover:underline"
              >
                browse files
              </button>
            </p>
            <div className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              Supports: PDF, JPG, PNG (Max 30MB)
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl relative overflow-hidden group">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                {file.name.endsWith('.pdf') ? (
                  <FileText className="w-8 h-8" />
                ) : (
                  <ImageIcon className="w-8 h-8" />
                )}
              </div>
              <div className="text-left select-none overflow-hidden max-w-[200px] sm:max-w-xs md:max-w-md">
                <p className="font-semibold text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {formatSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => clearFile(isQP)}
              className="p-1 px-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const loadDemoData = () => {
    setError(null);
    const createPngFromLines = (title: string, lines: string[]): Promise<File> => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(`MOCK ${title.toUpperCase()}`, 50, 60);

          ctx.fillStyle = '#334155';
          ctx.font = '14px monospace';
          let y = 120;
          lines.forEach((line) => {
            ctx.fillText(line, 50, y);
            y += 35;
          });
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `${title.toLowerCase().replace(/\s+/g, '_')}_mock.png`, {
              type: 'image/png',
            });
            resolve(file);
          }
        }, 'image/png');
      });
    };

    const qpTitle = 'Question Paper';
    const qpLines = [
      'Q1. Explain the differences between supervised and unsupervised learning. [5m]',
      'Q2. Explain what is a convolution layer in CNN and why it is parameter-efficient. [10m]',
      'Q3(a). What is SGD optimizer? [3m]',
      'Q3(b). Compare ReLU and GELU activation functions. [4m]'
    ];

    const asTitle = 'Answer Sheet';
    const asLines = [
      'Ans 1. Supervised learning requires labeled dataset input, where each',
      'example has a target output. Unsupervised learning identifies hidden',
      'patterns in unlabeled data, for instance clustering similar attributes.',
      '',
      'Ans 3(a). SGD stands for Stochastic Gradient Descent. It computes the gradient',
      'and updates parameters using a single random sample per iteration.',
      '',
      'Ans 2. A convolution layer slides filters over inputs to construct local feature maps.',
      'It is parameter-efficient because weights are shared (weight sharing).',
      '',
      'Random notes about activation functions like Sigmoid being saturated.',
      'This is an orphan block.'
    ];

    Promise.all([
      createPngFromLines(qpTitle, qpLines),
      createPngFromLines(asTitle, asLines)
    ]).then(([qp, as]) => {
      onProcess(qp, as);
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 select-none">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent sm:text-5xl">
          AI Assessment Assistant
        </h1>
        <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
          Upload a question paper and student handwritten response sheet to map and grade answers instantly.
        </p>

        <div className="mt-6 flex justify-center">
          <button
            onClick={loadDemoData}
            id="btn-load-demo"
            className="px-5 py-2.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-900/50 font-bold text-xs hover:bg-amber-100 hover:border-amber-305 transition-all duration-200 flex items-center space-x-1.5 cursor-pointer shadow-sm hover:shadow active:scale-95"
          >
            <span>🚀 Run Demo Assessment (No Upload Needed)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {renderUploadCard('Question Paper', qpFile, true, qpInputRef, isDragQp)}
        {renderUploadCard('Student Answer Sheet', asFile, false, asInputRef, isDragAs)}
      </div>

      <div className="text-center">
        <button
          onClick={() => qpFile && asFile && onProcess(qpFile, asFile)}
          disabled={!qpFile || !asFile}
          className={`px-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-300 ${
            qpFile && asFile
              ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/20 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0'
              : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          Process Assessment
        </button>
      </div>
    </div>
  );
}
