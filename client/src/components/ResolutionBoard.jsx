import React, { useState } from 'react';
import { ShieldAlert, Trash2, Edit2, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

export default function ResolutionBoard({
  groupId,
  quarantinedExpenses,
  expensesInReview,
  registeredUsers,
  onResolutionProcessed
}) {
  const [editingId, setEditingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  // Edit form states
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSplitType, setEditSplitType] = useState('EQUAL');
  const [editSplitsText, setEditSplitsText] = useState('');
  const [editParticipantsText, setEditParticipantsText] = useState('');

  const handleStartEdit = (q) => {
    setError(null);
    setEditingId(q.id);
    const raw = q.rawRowData;
    setEditDescription(raw.description || '');
    setEditAmount(raw.amount || '');
    setEditPaidBy(raw.paid_by || '');
    setEditDate(raw.date || '');
    setEditSplitType(raw.split_type || 'EQUAL');
    setEditSplitsText(raw.split_detail || raw.splits || '');
    setEditParticipantsText(raw.split_with || raw.participants || '');
  };

  const handleResolveAction = async (id, action) => {
    setError(null);
    setLoadingId(id);

    try {
      if (action === 'DELETE') {
        const response = await fetch(`${API_BASE}/api/expenses/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete staged item.');
        }
      } else {
        // Construct updated row data from edit states
        const updatedRowData = {
          id: id,
          description: editDescription,
          amount: editAmount,
          paid_by: editPaidBy,
          date: editDate,
          split_type: editSplitType,
          split_detail: editSplitsText,
          split_with: editParticipantsText
        };

        const response = await fetch(`${API_BASE}/api/groups/${groupId}/quarantined/${id}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedRowData),
          credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to resolve quarantined expense.');
        }
      }

      setEditingId(null);
      onResolutionProcessed();
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during resolution.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleApproveState = async (expId, action) => {
    setError(null);
    setLoadingId(expId);

    try {
      if (action === 'DELETE') {
        const response = await fetch(`${API_BASE}/api/expenses/${expId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete transaction.');
        }
      } else {
        const response = await fetch(`${API_BASE}/api/expenses/${expId}/approve`, {
          method: 'PUT',
          credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to approve transaction.');
        }
      }
      onResolutionProcessed();
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during status updates.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
          Meera&apos;s Anomaly Resolution Board
        </h3>
        <p className="text-slate-500 text-sm mt-1">
          Review quarantined rows, resolve user mappings, fix unbalanced splits, or approve duplicate/pending events.
        </p>
      </div>

      {error && (
        <div className="p-4.5 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-2xl flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Queue 1: Quarantined CSV Rows */}
      <div className="space-y-6">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Quarantine Stage Queue ({quarantinedExpenses.length})
        </h4>

        {quarantinedExpenses.length === 0 ? (
          <p className="text-slate-400 text-sm py-6 text-center border border-dashed border-slate-200 rounded-[24px] bg-slate-50/50">
            No staged quarantined rows found.
          </p>
        ) : (
          <div className="space-y-6">
            {quarantinedExpenses.map((q) => {
              const isEditing = editingId === q.id;
              const isLoading = loadingId === q.id;
              const raw = q.rawRowData;

              return (
                <div
                  key={q.id}
                  className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-6 hover:border-slate-300 transition-colors space-y-4"
                >
                  <div className="flex flex-wrap justify-between items-start gap-2.5 border-b border-slate-100 pb-3.5">
                    <div>
                      <span className="text-xs text-slate-400 font-mono block">Row ID: {q.id}</span>
                      <span className="text-sm text-slate-800 font-extrabold block mt-0.5">
                        {raw.description || 'Imported Expense'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {q.anomalies.map((anom) => (
                        <span
                          key={anom}
                          className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold"
                        >
                          {anom}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Amount (in rupees/dollars)</label>
                        <input
                          type="text"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                        <input
                          type="text"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Paid By (Payer Name)</label>
                        <select
                          value={editPaidBy}
                          onChange={(e) => setEditPaidBy(e.target.value)}
                          className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all bg-white"
                        >
                          <option value="">Select payer</option>
                          {registeredUsers.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Split Method</label>
                        <select
                          value={editSplitType}
                          onChange={(e) => setEditSplitType(e.target.value)}
                          className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all bg-white"
                        >
                          <option value="EQUAL">Equal Split</option>
                          <option value="UNEQUAL">Unequal Amounts</option>
                          <option value="PERCENTAGE">Percentage Ratios</option>
                          <option value="SHARE">Shares Distribution</option>
                        </select>
                      </div>

                      {editSplitType === 'EQUAL' ? (
                        <div className="space-y-1.5 md:col-span-3">
                          <label className="text-xs font-bold text-slate-500 uppercase">Participants (Comma separated names)</label>
                          <input
                            type="text"
                            value={editParticipantsText}
                            onChange={(e) => setEditParticipantsText(e.target.value)}
                            placeholder="Aisha, Rohan, Priya"
                            className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5 md:col-span-3">
                          <label className="text-xs font-bold text-slate-500 uppercase">Split Details (Format: Name:Val; Name:Val)</label>
                          <input
                            type="text"
                            value={editSplitsText}
                            onChange={(e) => setEditSplitsText(e.target.value)}
                            placeholder="Aisha:50; Rohan:50"
                            className="w-full px-4.5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 transition-all"
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-3 md:col-span-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-5 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveAction(q.id, 'EDIT_IMPORT')}
                          disabled={isLoading}
                          className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5"
                        >
                          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Re-verify & Commit</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1.5 text-xs text-slate-500 leading-relaxed font-medium">
                        <p><strong>Description:</strong> {raw.description || 'N/A'}</p>
                        <p><strong>Raw Payer:</strong> {raw.paid_by || 'N/A'} | <strong>Raw Amount:</strong> {raw.amount || '0.00'} {raw.currency || 'INR'}</p>
                        <p><strong>Raw Date:</strong> {raw.date || 'N/A'} | <strong>Split Details:</strong> {raw.split_detail || raw.splits || raw.split_with || 'N/A'}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-slate-900 hover:border-slate-350 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </button>
                        <button
                          onClick={() => handleResolveAction(q.id, 'DELETE')}
                          disabled={isLoading}
                          className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 hover:text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Queue 2: Pending Approval & Duplicates */}
      <div className="space-y-6">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
          Pending Approvals & Duplicates Queue ({expensesInReview.length})
        </h4>

        {expensesInReview.length === 0 ? (
          <p className="text-slate-400 text-sm py-6 text-center border border-dashed border-slate-200 rounded-[24px] bg-slate-50/50">
            No pending approvals or duplicates found.
          </p>
        ) : (
          <div className="space-y-4">
            {expensesInReview.map((e) => {
              const isLoading = loadingId === e.id;
              return (
                <div
                  key={e.id}
                  className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-slate-300 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800">{e.description}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        e.status === 'DUPLICATE' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {e.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Paid by <span className="font-bold">{e.paidBy?.name || 'N/A'}</span> on {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-lg font-black text-slate-900">₹{e.amount.toFixed(2)}</span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveState(e.id, 'APPROVE')}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleApproveState(e.id, 'DELETE')}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl border border-rose-100 bg-white text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
