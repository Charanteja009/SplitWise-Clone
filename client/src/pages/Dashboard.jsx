import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import { 
  Plus, 
  LogOut, 
  Wallet, 
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create Group Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch groups
  const fetchGroups = async () => {
    try {
      setError('');
      const response = await fetch(`${API_BASE}/api/groups`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load groups');
      }

      const data = await response.json();
      setGroups(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the server to fetch groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Calculate overall balances
  const totalYouAreOwed = groups
    .filter(g => g.netBalance > 0)
    .reduce((sum, g) => sum + g.netBalance, 0);

  const totalYouOwe = groups
    .filter(g => g.netBalance < 0)
    .reduce((sum, g) => sum + Math.abs(g.netBalance), 0);

  const overallNetBalance = totalYouAreOwed - totalYouOwe;

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setModalError('Group name is required.');
      return;
    }

    setModalError('');
    setModalSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group.');
      }

      await fetchGroups();
      setNewGroupName('');
      setNewGroupDesc('');
      setIsModalOpen(false);
      setSuccessMessage('Group created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setModalError(err.message || 'Something went wrong.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Premium Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">Splitwise Separated</span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signed in as</p>
                <p className="text-base font-bold text-slate-900">{user?.name}</p>
              </div>
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
        
        {/* Alerts */}
        {successMessage && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold text-slate-800 shadow-sm">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-8 flex items-center gap-3.5 rounded-2xl border border-red-100 bg-red-50 p-5 text-base font-semibold text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
              <p className="text-base font-semibold text-slate-500">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Header & CTA */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-2 text-base text-slate-500">Overview of roommate balances and activity groups</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white transition-all hover:bg-slate-800"
              >
                <Plus className="h-5 w-5" />
                <span>Create Group</span>
              </button>
            </div>

            {/* Overall Balance Summary Card (Spacious layout) */}
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Total Net Balances</h2>
              <div className="mt-4 grid gap-8 sm:grid-cols-3">
                
                {/* Total Owed */}
                <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-900 border border-slate-200">
                    <ArrowUpRight className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">You are owed</p>
                    <p className="text-2xl font-black text-slate-900">₹{totalYouAreOwed.toFixed(2)}</p>
                  </div>
                </div>

                {/* Total Owe */}
                <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-200">
                    <ArrowDownLeft className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">You owe</p>
                    <p className="text-2xl font-black text-slate-600">₹{totalYouOwe.toFixed(2)}</p>
                  </div>
                </div>

                {/* Overall Balance */}
                <div className="flex items-center gap-4 rounded-2xl bg-slate-950 p-6 text-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Balance</p>
                    <p className={`text-2xl font-black ${overallNetBalance >= 0 ? 'text-white' : 'text-slate-300'}`}>
                      {overallNetBalance >= 0 ? '+' : ''}₹{overallNetBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Groups Grid */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Your Activity Groups</h2>
              
              {groups.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center">
                  <p className="text-base font-medium text-slate-400">You are not a member of any shared groups yet.</p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-900 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create your first group</span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <Link
                      key={group.id}
                      to={`/groups/${group.id}`}
                      className="group block rounded-[32px] border border-slate-200 bg-white p-8 transition-all hover:border-slate-950 hover:shadow-sm"
                    >
                      <div className="flex h-full flex-col justify-between space-y-6">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 group-hover:underline">{group.name}</h3>
                          {group.description && (
                            <p className="mt-2 text-sm text-slate-400 line-clamp-2">{group.description}</p>
                          )}
                        </div>
                        
                        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Status</span>
                          <span className={`text-base font-bold ${group.netBalance > 0 ? 'text-slate-900' : group.netBalance < 0 ? 'text-slate-500' : 'text-slate-400'}`}>
                            {group.netBalance > 0 ? `Owed: +₹${group.netBalance.toFixed(2)}` : group.netBalance < 0 ? `Owe: -₹${Math.abs(group.netBalance).toFixed(2)}` : 'Settle'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 sm:p-10 shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Create Group</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="mt-8 space-y-6">
              {modalError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Flat 4B Roommates"
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5 text-slate-800"
                />
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Description (Optional)</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g., Utility splits, rent shares, groceries"
                  rows="3"
                  className="block w-full rounded-2xl border border-slate-200 py-4 px-4 text-base outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5 text-slate-800"
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
                  disabled={modalSubmitting}
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {modalSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
