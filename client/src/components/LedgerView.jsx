import React, { useState } from 'react';
import { 
  FileText, 
  Trash2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  Calendar, 
  Tag, 
  AlertCircle 
} from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

export default function LedgerView({ expenses, settlements, groupId, onUpdate, currentUserId }) {
  const [filter, setFilter] = useState('ALL'); // ALL, EXPENSES, SETTLEMENTS, QUARANTINED
  const [expandedExpense, setExpandedExpense] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter items
  const activeExpenses = expenses.filter(e => e.status === 'ACTIVE');
  const quarantinedExpenses = expenses.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DUPLICATE');

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    setError(null);
    setDeletingId(expenseId);
    try {
      const response = await fetch(`${API_BASE}/api/expenses/${expenseId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete expense.');
      }
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApproveExpense = async (expenseId) => {
    setError(null);
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/expenses/${expenseId}/approve`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve expense.');
      }
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Combine items for ledger display based on filter
  const items = [];
  if (filter === 'ALL' || filter === 'EXPENSES') {
    activeExpenses.forEach(e => items.push({ ...e, type: 'EXPENSE' }));
  }
  if (filter === 'ALL' || filter === 'SETTLEMENTS') {
    settlements.forEach(s => items.push({ ...s, type: 'SETTLEMENT', date: s.settledAt }));
  }
  if (filter === 'QUARANTINED') {
    quarantinedExpenses.forEach(e => items.push({ ...e, type: 'EXPENSE' }));
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 justify-between sm:justify-start sm:gap-2 max-w-lg">
        {['ALL', 'EXPENSES', 'SETTLEMENTS', 'QUARANTINED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              filter === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Ledger Table/List */}
      <div className="rounded-[32px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            No transactions found for this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              if (item.type === 'SETTLEMENT') {
                return (
                  <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50/20">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {item.fromUser.name} paid {item.toUser.name}
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          {new Date(item.settledAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900">₹{item.amount.toFixed(2)}</span>
                    </div>
                  </div>
                );
              }

              // Expense type
              const isQuarantined = item.status !== 'ACTIVE';
              const isExpanded = expandedExpense === item.id;

              return (
                <div key={item.id} className="divide-y divide-slate-100">
                  <div className="p-6 flex items-center justify-between hover:bg-slate-50/20">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-150 text-slate-800">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{item.description}</p>
                          {isQuarantined && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                              {item.status}
                            </span>
                          )}
                          {item.isRefund && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wide">
                              Refund
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          Paid by <span className="font-bold">{item.paidBy.name}</span> on {new Date(item.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">₹{item.amount.toFixed(2)}</p>
                        {item.originalAmount && (
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {item.originalAmount.toFixed(2)} {item.originalCurrency}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isQuarantined && (
                          <button
                            onClick={() => handleApproveExpense(item.id)}
                            disabled={actionLoading}
                            className="p-2.5 rounded-xl border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all flex items-center gap-1"
                            title="Approve Quarantine"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Approve</span>
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedExpense(isExpanded ? null : item.id)}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          disabled={deletingId === item.id}
                          className="p-2.5 rounded-xl border border-rose-100 bg-white text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Split details */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 p-6 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill Splits Breakdown</h4>
                      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {item.splits.map((s) => (
                          <div key={s.userId} className="flex justify-between items-center bg-white p-4.5 rounded-2xl border border-slate-200">
                            <span className="text-sm font-semibold text-slate-700">{s.userName}</span>
                            <span className="text-sm font-black text-slate-900">₹{s.owedAmount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
