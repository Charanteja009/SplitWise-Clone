import React, { useState } from 'react';
import { Eye, ShieldAlert, Sparkles, Search } from 'lucide-react';

export default function ImportReportPanel({ report }) {
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const filteredLogs = report.logs.filter((log) => {
    const matchesFilter = filter === 'ALL' || log.status === filter;
    const matchesSearch = log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.paidBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5.5 h-5.5 text-indigo-600" />
            Ingestion Import Report
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Programmatic anomaly audit logs and ledger insertion reports.
          </p>
        </div>

        {/* High-level metrics */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="px-4.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-center items-center shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluated</span>
            <span className="text-base font-extrabold text-slate-700">{report.totalEvaluated}</span>
          </div>
          <div className="px-4.5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col justify-center items-center shrink-0">
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Success</span>
            <span className="text-base font-extrabold text-emerald-700">{report.successCount}</span>
          </div>
          <div className="px-4.5 py-2.5 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col justify-center items-center shrink-0">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Quarantined</span>
            <span className="text-base font-extrabold text-amber-700">{report.quarantineCount}</span>
          </div>
          <div className="px-4.5 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col justify-center items-center shrink-0">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Rejected</span>
            <span className="text-base font-extrabold text-rose-700">{report.rejectCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-6">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto justify-between">
          {['ALL', 'SUCCESS', 'QUARANTINED', 'REJECTED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search description, payer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-slate-50/20">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold">
              <th className="p-4.5 w-12 text-center">Row</th>
              <th className="p-4.5">Description</th>
              <th className="p-4.5">Amount</th>
              <th className="p-4.5">Paid By</th>
              <th className="p-4.5 text-center">Status</th>
              <th className="p-4.5">Action Taken</th>
              <th className="p-4.5 w-16 text-center">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No matching audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <React.Fragment key={log.rowIndex}>
                  <tr className={`hover:bg-slate-50/50 transition-colors ${selectedRow === log.rowIndex ? 'bg-slate-50' : ''}`}>
                    <td className="p-4.5 text-center text-slate-400 font-mono">{log.rowIndex}</td>
                    <td className="p-4.5">
                      <div className="font-bold text-slate-800 truncate max-w-[160px]" title={log.description}>
                        {log.description}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1 truncate max-w-[120px]" title={log.id}>
                        {log.id}
                      </div>
                    </td>
                    <td className="p-4.5 font-bold text-slate-700">
                      ₹{log.amount.toFixed(2)}
                    </td>
                    <td className="p-4.5 text-slate-600 font-medium">{log.paidBy}</td>
                    <td className="p-4.5 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.status === 'QUARANTINED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4.5 text-slate-500 font-medium leading-relaxed">
                      {log.action}
                    </td>
                    <td className="p-4.5 text-center">
                      <button
                        onClick={() => setSelectedRow(selectedRow === log.rowIndex ? null : log.rowIndex)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          selectedRow === log.rowIndex
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Panel */}
                  {selectedRow === log.rowIndex && (
                    <tr className="bg-slate-50 border-l-2 border-slate-900">
                      <td colSpan={7} className="p-6">
                        <div className="space-y-4">
                          <h4 className="text-slate-600 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-slate-700" />
                            Anomaly Audit Ledger Report (Row {log.rowIndex})
                          </h4>

                          <div className="flex flex-wrap gap-3.5">
                            <span className="text-xs text-slate-400 font-bold self-center">Caught Flags:</span>
                            {log.anomalies.length === 0 ? (
                              <span className="px-3 py-1 rounded bg-slate-100 border border-slate-200 text-slate-500 text-xs">None</span>
                            ) : (
                              log.anomalies.map((anom) => (
                                <span
                                  key={anom}
                                  className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold"
                                >
                                  {anom}
                                </span>
                              ))
                            )}
                          </div>

                          {log.reasons && log.reasons.length > 0 && (
                            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-2">
                              <span className="text-[11px] font-bold text-slate-400 block">System Warnings & Reasonings:</span>
                              <ul className="list-disc list-inside text-rose-700 text-xs leading-relaxed space-y-1">
                                {log.reasons.map((reason, rIdx) => (
                                  <li key={rIdx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
