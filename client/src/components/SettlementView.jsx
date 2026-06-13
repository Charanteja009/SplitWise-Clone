import React, { useState } from 'react';
import { ArrowRight, CheckCircle, Wallet, AlertCircle, X } from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

export default function SettlementView({ members, netBalances, peerDebts, groupId, onUpdate, currentUserId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!fromUserId || !toUserId || !amount) {
      setError('Please fill in all fields.');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fromUserId, toUserId, amount: amt }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record settlement.');
      }

      setFromUserId('');
      setToUserId('');
      setAmount('');
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSettle = (fromId, toId, rawAmount) => {
    setFromUserId(fromId);
    setToUserId(toId);
    setAmount(rawAmount.toString());
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      
      {/* Dynamic Summary Balances */}
      <div className="grid gap-6 sm:grid-cols-2">
        
        {/* Net Balances List */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Roommate Balances</h3>
          <div className="divide-y divide-slate-100">
            {members.map((m) => {
              const bal = netBalances[m.id] || 0;
              const joinedDate = new Date(m.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              const leftDate = m.leftAt ? new Date(m.leftAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
              return (
                <div key={m.id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{m.email}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Joined: {joinedDate}{leftDate ? ` | Left: ${leftDate}` : ' | Present'}
                    </p>
                  </div>
                  <span className={`text-base font-black ${bal > 0 ? 'text-slate-900' : bal < 0 ? 'text-slate-400' : 'text-slate-350'}`}>
                    {bal > 0 ? `+₹${bal.toFixed(2)}` : bal < 0 ? `-₹${Math.abs(bal).toFixed(2)}` : 'Settled'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simplified Payouts (Aisha's View) */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Simplified Debts</h3>
              <span className="px-3 py-1 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">Aisha's View</span>
            </div>
            
            {peerDebts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-semibold text-sm">
                All roommates are fully settled! No payments required.
              </div>
            ) : (
              <div className="space-y-4">
                {peerDebts.map((debt, index) => (
                  <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl gap-4">
                    <div className="flex items-center gap-3.5 flex-wrap">
                      <span className="font-bold text-slate-800">{debt.fromUser.name}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-800">{debt.toUser.name}</span>
                      <span className="text-base font-black text-slate-900">₹{debt.amount.toFixed(2)}</span>
                    </div>
                    
                    <button
                      onClick={() => handleQuickSettle(debt.fromUser.id, debt.toUser.id, debt.amount)}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
                    >
                      Settle Debt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setFromUserId('');
              setToUserId('');
              setAmount('');
              setIsModalOpen(true);
            }}
            className="w-full mt-6 py-4 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="h-5 w-5" />
            <span>Record Settlement</span>
          </button>
        </div>

      </div>

      {/* Settle Debt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 sm:p-10 shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Record a Settlement</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSettle} className="mt-8 space-y-6">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Payer (Who Paid)</label>
                <select
                  value={fromUserId}
                  onChange={(e) => setFromUserId(e.target.value)}
                  required
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800 bg-white"
                >
                  <option value="">Select payer</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Recipient (Who Received)</label>
                <select
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  required
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800 bg-white"
                >
                  <option value="">Select recipient</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Repayment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? 'Recording...' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
