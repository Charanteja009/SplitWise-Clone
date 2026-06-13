import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Plus, 
  UserPlus, 
  FileText, 
  Wallet, 
  ShieldAlert, 
  Upload, 
  AlertCircle, 
  X 
} from 'lucide-react';
import LedgerView from '../components/LedgerView';
import SettlementView from '../components/SettlementView';
import ResolutionBoard from '../components/ResolutionBoard';
import CSVUploader from '../components/CSVUploader';
import ImportReportPanel from '../components/ImportReportPanel';

export default function GroupDetails() {
  const { id: groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('LEDGER'); // LEDGER, SETTLEMENTS, RESOLUTION, UPLOADER
  const [groupData, setGroupData] = useState(null);
  const [quarantined, setQuarantined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isRoommateModalOpen, setIsRoommateModalOpen] = useState(false);
  const [roommateEmail, setRoommateEmail] = useState('');
  const [roommateSubmitting, setRoommateSubmitting] = useState(false);
  const [roommateError, setRoommateError] = useState('');
  const [roommateSuccess, setRoommateSuccess] = useState('');

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidById, setExpPaidById] = useState('');
  const [expSplitType, setExpSplitType] = useState('EQUAL');
  const [expSplits, setExpSplits] = useState([]);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [expError, setExpError] = useState('');

  // Ingestion Ingestion report
  const [ingestionReport, setIngestionReport] = useState(null);

  const fetchGroupDetails = async () => {
    try {
      setError('');
      const response = await fetch(`${API_BASE}/api/groups/${groupId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load group details.');
      }

      const data = await response.json();
      setGroupData(data);
      if (expPaidById === '') {
        setExpPaidById(user?.id || '');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch group data.');
    }
  };

  const fetchQuarantined = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/quarantined`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setQuarantined(data);
      }
    } catch (err) {
      console.error('Failed to load quarantined rows:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchGroupDetails(), fetchQuarantined()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [groupId]);

  const handleAddRoommate = async (e) => {
    e.preventDefault();
    if (!roommateEmail.trim()) return;

    setRoommateSubmitting(true);
    setRoommateError('');
    setRoommateSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: roommateEmail.trim() }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member.');
      }

      setRoommateSuccess(`Successfully added ${data.user.name} to Flatmates!`);
      setRoommateEmail('');
      await fetchGroupDetails();
      setTimeout(() => setRoommateSuccess(''), 3000);
    } catch (err) {
      setRoommateError(err.message);
    } finally {
      setIsRoommateModalOpen(false);
      setRoommateSubmitting(false);
    }
  };

  const handleLogExpense = async (e) => {
    e.preventDefault();
    if (!expDescription.trim() || !expAmount || !expPaidById) return;

    setExpSubmitting(true);
    setExpError('');

    try {
      const payload = {
        description: expDescription.trim(),
        totalAmount: parseFloat(expAmount),
        paidById: expPaidById,
        splitType: expSplitType,
        splits: expSplitType === 'EQUAL' ? [] : expSplits
      };

      const response = await fetch(`${API_BASE}/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record expense.');
      }

      setExpDescription('');
      setExpAmount('');
      setExpSplitType('EQUAL');
      setExpSplits([]);
      setIsExpenseModalOpen(false);
      await loadAll();
    } catch (err) {
      setExpError(err.message);
    } finally {
      setExpSubmitting(false);
    }
  };

  const initializeSplitsState = () => {
    if (!groupData) return;
    const initial = groupData.members.map((m) => ({
      userId: m.id,
      name: m.name,
      amount: '',
      value: '' // percentage or share ratio
    }));
    setExpSplits(initial);
  };

  const handleSplitValueChange = (userId, field, value) => {
    const updated = expSplits.map((item) => {
      if (item.userId === userId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setExpSplits(updated);
  };

  const handleCsvSuccess = (report) => {
    setIngestionReport(report);
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
          <p className="text-base font-semibold text-slate-500">Loading ledger details...</p>
        </div>
      </div>
    );
  }

  if (error || !groupData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <AlertCircle className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-900">Failed to Load Group</h2>
        <p className="mt-2 text-slate-500">{error || 'Group not found.'}</p>
        <Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const { group, members, expenses, settlements, netBalances, peerDebts } = groupData;
  const inReview = expenses.filter((e) => e.status === 'PENDING_APPROVAL' || e.status === 'DUPLICATE');
  const quarantineCount = quarantined.length + inReview.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 bg-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-slate-900">{group.name}</h1>
                {group.description && <p className="text-xs text-slate-400 font-semibold mt-0.5">{group.description}</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsRoommateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Roommate</span>
              </button>
              <button
                onClick={() => {
                  initializeSplitsState();
                  setIsExpenseModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Log Expense</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content grid */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-12 space-y-10">
        
        {roommateSuccess && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-800">
            {roommateSuccess}
          </div>
        )}

        {/* Tab Pills */}
        <div className="flex border-b border-slate-200 gap-6">
          {[
            { id: 'LEDGER', label: 'Rohan\'s Ledger', icon: FileText },
            { id: 'SETTLEMENTS', label: 'Aisha\'s View', icon: Wallet },
            { 
              id: 'RESOLUTION', 
              label: 'Meera\'s Board', 
              icon: ShieldAlert, 
              badge: quarantineCount > 0 ? quarantineCount : null 
            },
            { id: 'UPLOADER', label: 'CSV Import', icon: Upload }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'UPLOADER') setIngestionReport(null);
                }}
                className={`flex items-center gap-2 pb-4 border-b-2 font-bold text-sm transition-all relative cursor-pointer ${
                  isActive 
                    ? 'border-slate-900 text-slate-950' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Viewport */}
        <div>
          {activeTab === 'LEDGER' && (
            <LedgerView 
              expenses={expenses} 
              settlements={settlements} 
              groupId={groupId} 
              onUpdate={loadAll} 
              currentUserId={user?.id}
            />
          )}

          {activeTab === 'SETTLEMENTS' && (
            <SettlementView 
              members={members} 
              netBalances={netBalances} 
              peerDebts={peerDebts} 
              groupId={groupId} 
              onUpdate={loadAll} 
              currentUserId={user?.id}
            />
          )}

          {activeTab === 'RESOLUTION' && (
            <ResolutionBoard 
              groupId={groupId} 
              quarantinedExpenses={quarantined} 
              expensesInReview={inReview} 
              registeredUsers={members} 
              onResolutionProcessed={loadAll}
            />
          )}

          {activeTab === 'UPLOADER' && (
            <div className="space-y-10">
              <CSVUploader groupId={groupId} onUploadSuccess={handleCsvSuccess} />
              {ingestionReport && <ImportReportPanel report={ingestionReport} />}
            </div>
          )}
        </div>

      </main>

      {/* Add Roommate Modal */}
      {isRoommateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 sm:p-10 shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Add Roommate</h2>
              <button onClick={() => setIsRoommateModalOpen(false)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddRoommate} className="mt-8 space-y-6">
              {roommateError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{roommateError}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Registered Roommate Email</label>
                <input
                  type="email"
                  required
                  value={roommateEmail}
                  onChange={(e) => setRoommateEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-850"
                />
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsRoommateModalOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roommateSubmitting}
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {roommateSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-8 sm:p-10 shadow-lg animate-in fade-in zoom-in duration-200 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Log Shared Expense</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLogExpense} className="mt-8 space-y-6">
              {expError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{expError}</span>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Bill Description</label>
                  <input
                    type="text"
                    required
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    placeholder="e.g., Electricity Bill"
                    className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Bill Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Paid By</label>
                  <select
                    value={expPaidById}
                    onChange={(e) => setExpPaidById(e.target.value)}
                    required
                    className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800 bg-white"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Split Method</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    required
                    className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 text-slate-800 bg-white"
                  >
                    <option value="EQUAL">Split Equally</option>
                    <option value="UNEQUAL">Unequal Amounts</option>
                    <option value="PERCENTAGE">Percentage Splits</option>
                    <option value="SHARE">Shares/Ratios</option>
                  </select>
                </div>
              </div>

              {/* Detailed splits values input */}
              {expSplitType !== 'EQUAL' && (
                <div className="space-y-4 border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-450">Individual Split Items</h3>
                  <div className="space-y-3">
                    {expSplits.map((split) => (
                      <div key={split.userId} className="flex justify-between items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                        <span className="font-bold text-slate-700">{split.name}</span>
                        <div className="w-36">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={expSplitType === 'UNEQUAL' ? split.amount : split.value}
                            onChange={(e) => handleSplitValueChange(
                              split.userId, 
                              expSplitType === 'UNEQUAL' ? 'amount' : 'value', 
                              e.target.value
                            )}
                            placeholder={expSplitType === 'UNEQUAL' ? 'Amount (₹)' : expSplitType === 'PERCENTAGE' ? 'Percent (%)' : 'Shares'}
                            className="w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-sm outline-none focus:border-slate-950 bg-white text-slate-850"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSubmitting}
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {expSubmitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
