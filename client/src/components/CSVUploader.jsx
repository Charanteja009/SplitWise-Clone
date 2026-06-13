import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

export default function CSVUploader({ groupId, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file) => {
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setError("Please select a valid CSV file (.csv).");
      setSuccessMsg(null);
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/upload-csv`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process CSV file.');
      }

      setSuccessMsg(`File processed successfully. ${data.successCount} imported, ${data.quarantineCount} quarantined, ${data.rejectCount || 0} rejected.`);
      onUploadSuccess(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during file upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onSubmit={(e) => e.preventDefault()}
        className={`relative flex flex-col items-center justify-center p-12 border border-dashed rounded-[32px] transition-all duration-200 ${
          dragActive
            ? 'border-slate-400 bg-slate-50'
            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-600">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-800" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <p className="text-slate-800 text-sm font-bold mb-1.5">
            Drag and drop your export CSV here
          </p>
          <p className="text-slate-400 text-xs mb-4">
            Pre-editing or manually modifying files is prohibited. Only raw CSV exports supported.
          </p>

          <button
            type="button"
            onClick={onButtonClick}
            disabled={loading}
            className="px-6 py-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-2xl shadow-sm transition-all cursor-pointer"
          >
            Choose File
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-5 p-5 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-2xl font-medium flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-5 p-5 bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-2xl font-medium flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 text-slate-900 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
