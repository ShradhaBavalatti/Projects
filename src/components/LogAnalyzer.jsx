import React, { useState } from 'react';
import { Upload, Send, Loader, AlertCircle } from 'lucide-react';
import ChatWindow from './ChatWindow';

export default function LogAnalyzer() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('http://localhost:8000/api/analyze-log', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSessionId(data.session_id);
        setAnalysis(data.analysis);
      } else {
        setError('Failed to analyze log');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show chat interface after analysis
  if (sessionId && analysis) {
    return <ChatWindow sessionId={sessionId} initialAnalysis={analysis} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Log Analyzer</h1>
          <p className="text-slate-400">Upload your log file for AI-powered analysis</p>
        </div>

        {/* Upload Box */}
        <div className="bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 p-12 text-center hover:border-blue-500 transition-colors duration-300">
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-slate-400" />
              <div>
                <p className="text-white font-semibold">
                  {file ? file.name : 'Drag and drop your log file'}
                </p>
                <p className="text-slate-400 text-sm">or click to select</p>
              </div>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".log,.txt"
              disabled={loading}
            />
          </label>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Loader className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-slate-300">Analyzing your log file...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-8 bg-red-900/30 border border-red-500 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}