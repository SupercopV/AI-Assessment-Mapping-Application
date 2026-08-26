'use client';

import React, { useState, useEffect } from 'react';
import { Assessment, ProcessingStatus } from '../types';
import UploadScreen from '../components/UploadScreen';
import ProcessingScreen from '../components/ProcessingScreen';
import WorkspaceScreen from '../components/WorkspaceScreen';
import DashboardScreen from '../components/DashboardScreen';
import { RefreshCw, Layout, Brain, Info, AlertTriangle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type AppState = 'upload' | 'processing' | 'workspace' | 'dashboard';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    development_mode: boolean;
    deepseek_key_configured: boolean;
    model_name?: string;
  } | null>(null);
  
  const [errorText, setErrorText] = useState<string | null>(null);

  // Check health / config on load
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setHealthStatus(data))
      .catch((err) => {
        console.error('Error fetching backend health:', err);
        setErrorText('Could not connect to the backend server. Make sure it is running on port 8000.');
      });
  }, []);

  // Poll processing status
  useEffect(() => {
    if (appState !== 'processing' || !sessionId) return;

    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/assessment/${sessionId}/status`);
        if (!res.ok) throw new Error('Failed to retrieve processing status');
        const data: ProcessingStatus = await res.json();
        setProcessingStatus(data);

        if (data.step === 'complete' && data.status === 'success') {
          clearInterval(pollInterval);
          // Fetch final assessment data
          const assessRes = await fetch(`${API_BASE_URL}/api/assessment/${sessionId}`);
          if (!assessRes.ok) throw new Error('Failed to retrieve final assessment');
          const assessData: Assessment = await assessRes.json();
          setAssessment(assessData);
          setAppState('dashboard');
        } else if (data.step === 'failed' || data.status === 'failed') {
          clearInterval(pollInterval);
          setErrorText(data.message || 'Processing failed. Check backend logs.');
          setAppState('upload');
        }
      } catch (err: any) {
        console.error('Error polling status:', err);
        setErrorText(err.message || 'Error occurred while communicating with database server.');
        clearInterval(pollInterval);
        setAppState('upload');
      }
    };

    // Poll every 1.5 seconds
    pollInterval = setInterval(checkStatus, 1500);
    // Initial check
    checkStatus();

    return () => clearInterval(pollInterval);
  }, [appState, sessionId]);

  const handleStartAnalysis = async (qpFile: File, asFile: File) => {
    setErrorText(null);
    setAppState('processing');
    setProcessingStatus({
      step: 'uploading',
      status: 'running',
      progress: 5,
      message: 'Packaging document files container upload...'
    });

    const formData = new FormData();
    formData.append('question_paper', qpFile);
    formData.append('student_answer', asFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/process`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to initialize document processor pipeline');
      }

      const data = await response.json();
      setSessionId(data.session_id);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorText(err.message || 'File upload failed. Please verify API server configurations.');
      setAppState('upload');
    }
  };

  const handleRestart = () => {
    setAppState('upload');
    setSessionId(null);
    setAssessment(null);
    setProcessingStatus(null);
    setErrorText(null);
  };

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* Dynamic Header */}
      <header className="glass-panel sticky top-0 w-full z-45 bg-white/70 dark:bg-slate-900/70 border-b border-slate-205 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3.5 cursor-pointer" onClick={handleRestart}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/10">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight leading-none">AI ASSESSMENT MAPPING</h1>
            <span className="text-[10px] text-slate-400 font-bold tracking-wider">EXTRACTION & GRADING</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {healthStatus && (
            <div className="flex items-center space-x-2 text-xs">
              {healthStatus.development_mode ? (
                <span className="flex items-center px-2 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-md border border-amber-250/20 font-bold space-x-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>DEMO / DEV MODE</span>
                </span>
              ) : (
                <span className="flex items-center px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-250/20 font-bold space-x-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>LIVE MODE ({healthStatus.model_name || 'AI LLM'})</span>
                </span>
              )}
            </div>
          )}

          {(appState === 'workspace' || appState === 'dashboard') && (
            <button
              onClick={handleRestart}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Assessment Home</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container Sections */}
      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/30">
        {errorText && (
          <div className="max-w-xl mx-auto mt-6 w-full p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start space-x-3 shadow-md z-1">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block mb-0.5">Configuration Message</span>
              <p>{errorText}</p>
            </div>
          </div>
        )}

        {appState === 'upload' && (
          <UploadScreen onProcess={handleStartAnalysis} />
        )}

        {appState === 'processing' && processingStatus && (
          <ProcessingScreen status={processingStatus} />
        )}

        {appState === 'workspace' && assessment && (
          <WorkspaceScreen
            assessment={assessment}
            sessionId={sessionId!}
            baseUrl={API_BASE_URL}
            onUpdateAssessment={(updated) => setAssessment(updated)}
          />
        )}

        {appState === 'dashboard' && assessment && (
          <DashboardScreen
            assessment={assessment}
            onEnterWorkspace={() => setAppState('workspace')}
            onNewAssessment={handleRestart}
          />
        )}
      </main>

      {/* footer details */}
      <footer className="py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center select-none text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        AI Assessment Extraction & Answer Mapping Pipeline · Powered by PaddleOCR & {healthStatus?.model_name || 'AI LLM'}
      </footer>

    </div>
  );
}
