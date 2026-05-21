import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Check, Search, Download, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import api from '../../utils/api';

const DEPARTMENTS = ['All', 'IT', 'Non-IT', 'Management', 'Operations'];
const STATUSES = ['Present', 'Absent', 'Half Day', 'Leave'];

export default function HRAttendance() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({}); // keyed by employeeId
  const [notes, setNotes] = useState({}); // keyed by employeeId
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState({}); // keyed by employeeId: 'saving' | 'saved' | 'error'
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Date and View Configuration
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'monthly'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Monthly View States
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [monthlyLogs, setMonthlyLogs] = useState([]); // raw array of logs for the month

  // Load employees manually — triggered by button click, not auto
  const handleLoadEmployees = async () => {
    if (unsavedChanges && !window.confirm('You have unsaved changes. Proceed and lose them?')) return;
    setLoading(true);
    setHasLoaded(true);
    setUnsavedChanges(false);
    try {
      if (viewMode === 'daily') {
        const [usersRes, attendanceRes] = await Promise.all([
          api.get('/users'),
          api.get(`/attendance?date=${selectedDate}`)
        ]);
        const activeEmployees = usersRes.data.filter(u => u.role === 'employee');
        setEmployees(activeEmployees);
        const attMap = {};
        const notesMap = {};
        activeEmployees.forEach(emp => {
          const record = attendanceRes.data.find(r => (r.employee?._id || r.employee) === emp._id);
          attMap[emp._id] = record ? record.status : '';
          notesMap[emp._id] = record ? record.notes || '' : '';
        });
        setAttendance(attMap);
        setNotes(notesMap);
      } else {
        const usersRes = await api.get('/users');
        setEmployees(usersRes.data.filter(u => u.role === 'employee'));
        const attendanceRes = await api.get(`/attendance?month=${selectedMonth}&year=${selectedYear}`);
        setMonthlyLogs(attendanceRes.data);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (unsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsavedChanges]);

  const fetchDailyData = handleLoadEmployees;
  const fetchMonthlyData = handleLoadEmployees;

  // Mark/save attendance
  const handleMarkStatus = async (employeeId, status) => {
    setSaveStatus(prev => ({ ...prev, [employeeId]: 'saving' }));
    setAttendance(prev => ({ ...prev, [employeeId]: status }));
    setUnsavedChanges(false);

    try {
      await api.post('/attendance', {
        date: selectedDate,
        records: [{ employeeId, status, notes: notes[employeeId] || '' }]
      });
      setSaveStatus(prev => ({ ...prev, [employeeId]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [employeeId]: null })), 1500);
    } catch (err) {
      setSaveStatus(prev => ({ ...prev, [employeeId]: 'error' }));
    }
  };

  // Blur handler to save notes
  const handleSaveNotes = async (employeeId, noteValue) => {
    if (attendance[employeeId] === '') return;
    setSaveStatus(prev => ({ ...prev, [employeeId]: 'saving' }));
    setUnsavedChanges(false);
    try {
      await api.post('/attendance', {
        date: selectedDate,
        records: [{ employeeId, status: attendance[employeeId], notes: noteValue }]
      });
      setSaveStatus(prev => ({ ...prev, [employeeId]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [employeeId]: null })), 1500);
    } catch (err) {
      setSaveStatus(prev => ({ ...prev, [employeeId]: 'error' }));
    }
  };

  // Export via server
  const handleExport = (format) => {
    const params = viewMode === 'daily'
      ? `date=${selectedDate}&format=${format}`
      : `month=${selectedMonth}&year=${selectedYear}&format=${format}`;
    window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/attendance/export?${params}`, '_blank');
  };

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.companyEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'All' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  // Calculate days in the selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthDaysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Helper to find status of a specific day in monthly log
  const getDayStatus = (employeeId, dayNum) => {
    const dateStr = new Date(selectedYear, selectedMonth - 1, dayNum).toISOString().split('T')[0];
    const log = monthlyLogs.find(r => {
      const empId = r.employee?._id || r.employee;
      const logDate = new Date(r.date).toISOString().split('T')[0];
      return empId === employeeId && logDate === dateStr;
    });
    return log ? log.status : null;
  };

  // Export Daily/Monthly Attendance as CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (viewMode === 'daily') {
      csvContent += "Employee Name,Email,Department,Date,Status,Notes\n";
      filteredEmployees.forEach(emp => {
        const status = attendance[emp._id] || 'Unmarked';
        const note = notes[emp._id] || '';
        csvContent += `"${emp.fullName}","${emp.companyEmail}","${emp.department}","${selectedDate}","${status}","${note.replace(/"/g, '""')}"\n`;
      });
    } else {
      // Monthly roll-call layout
      csvContent += "Employee Name,Department,";
      csvContent += monthDaysArray.map(d => `${d}/${selectedMonth}/${selectedYear}`).join(",") + "\n";
      
      filteredEmployees.forEach(emp => {
        csvContent += `"${emp.fullName}","${emp.department}",`;
        const statuses = monthDaysArray.map(d => getDayStatus(emp._id, d) || "—");
        csvContent += statuses.join(",") + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${viewMode}_${viewMode === 'daily' ? selectedDate : `${selectedMonth}_${selectedYear}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <div className="mb-8">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Human Resources</p>
          <h1 className="font-heading text-navy text-4xl font-bold">Attendance</h1>
        </div>

        {/* View Toggle and Action Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          {/* Switch Daily vs Monthly */}
          <div className="flex bg-white rounded-xl shadow-card p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === 'daily' ? 'bg-navy text-gold shadow-sm' : 'text-navy text-opacity-65 hover:bg-cream'
              }`}
            >
              Daily Attendance
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === 'monthly' ? 'bg-navy text-gold shadow-sm' : 'text-navy text-opacity-65 hover:bg-cream'
              }`}
            >
              Monthly Roll Call Grid
            </button>
          </div>

          {/* Date / Month selectors */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {viewMode === 'daily' ? (
              <div className="flex items-center gap-2 bg-white rounded-xl shadow-card p-2 border border-navy border-opacity-10">
                <Calendar size={16} className="text-gold ml-1" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-navy font-semibold text-sm outline-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Month Dropdown */}
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="input font-semibold bg-white border border-navy border-opacity-15 shadow-sm py-2"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="input font-semibold bg-white border border-navy border-opacity-15 shadow-sm py-2"
                >
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Load Employees Button */}
            <button onClick={handleLoadEmployees} disabled={loading} className="btn-primary py-2 px-5 flex items-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Load Employees
            </button>
            {/* Export buttons */}
            {hasLoaded && employees.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => handleExport('csv')} className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5">
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => handleExport('excel')} className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5">
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button onClick={() => handleExport('pdf')} className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5">
                  <Download size={14} /> PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Directory Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 text-navy text-opacity-40" size={16} />
            <input
              type="text"
              placeholder="Search employee by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-10 py-2.5"
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="input font-semibold py-2.5"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Departments' : `${d} Department`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic View Panels */}
        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Loading attendance registry...</p>
          </div>
        ) : viewMode === 'daily' ? (
          /* ─── Daily View Table ─────────────────────────────────── */
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-navy border-opacity-10 bg-navy bg-opacity-5">
                  <th className="p-4 font-heading text-navy font-bold text-sm">Employee Name</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Department</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Mark Status</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Audit Notes</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm text-right">Saving Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-navy text-opacity-40">No employees found.</td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const status = attendance[emp._id] || '';
                    const saveState = saveStatus[emp._id];

                    return (
                      <tr key={emp._id} className="border-b border-navy border-opacity-5 hover:bg-navy hover:bg-opacity-[0.01]">
                        {/* Name & Photo */}
                        <td className="p-4 flex items-center gap-3">
                          {emp.profilePhoto ? (
                            <img src={emp.profilePhoto} alt={emp.fullName} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-navy text-gold font-bold text-xs flex items-center justify-center">
                              {emp.fullName[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-heading font-bold text-navy leading-tight">{emp.fullName}</p>
                            <p className="text-[10px] text-navy text-opacity-45 mt-0.5">{emp.designation}</p>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="p-4">
                          <span className={emp.department === 'IT' ? 'badge-it' : 'badge-non-it'}>
                            {emp.department}
                          </span>
                        </td>

                        {/* Status Pills */}
                        <td className="p-4">
                          <div className="flex gap-1">
                            {STATUSES.map(s => {
                              const isActive = status === s;
                              let colorClass = 'border-navy border-opacity-15 hover:bg-cream';
                              if (isActive) {
                                if (s === 'Present') colorClass = 'bg-green-600 border-green-600 text-white shadow-sm';
                                if (s === 'Absent') colorClass = 'bg-red-500 border-red-500 text-white shadow-sm';
                                if (s === 'Half Day') colorClass = 'bg-orange-500 border-orange-500 text-white shadow-sm';
                                if (s === 'Leave') colorClass = 'bg-gold border-gold text-navy shadow-sm';
                              }
                              return (
                                <button
                                  key={s}
                                  onClick={() => handleMarkStatus(emp._id, s)}
                                  className={`px-2.5 py-1 text-[11px] font-bold border rounded-lg transition-all ${colorClass}`}
                                >
                                  {s}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Note Input */}
                        <td className="p-4">
                          <input
                            type="text"
                            placeholder="Add memo/notes..."
                            value={notes[emp._id] || ''}
                            disabled={!status}
                            onChange={e => setNotes(prev => ({ ...prev, [emp._id]: e.target.value }))}
                            onBlur={e => handleSaveNotes(emp._id, e.target.value)}
                            className="w-full bg-cream border-none rounded-lg px-3 py-1.5 text-xs text-navy placeholder-navy placeholder-opacity-35 outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
                          />
                        </td>

                        {/* Save status check */}
                        <td className="p-4 text-right">
                          <AnimatePresence mode="wait">
                            {saveState === 'saving' && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-navy text-opacity-40 flex items-center justify-end gap-1 font-semibold">
                                <Loader2 size={12} className="animate-spin text-gold" /> Saving
                              </motion.span>
                            )}
                            {saveState === 'saved' && (
                              <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-success flex items-center justify-end gap-1 font-semibold">
                                <Check size={12} /> Saved
                              </motion.span>
                            )}
                            {saveState === 'error' && (
                              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-error flex items-center justify-end gap-1 font-semibold">
                                <AlertCircle size={12} /> Failed
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─── Monthly Roll Call Matrix View ────────────────────── */
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-navy border-opacity-10 bg-navy bg-opacity-5">
                  <th className="p-4 font-heading text-navy font-bold text-xs w-48 sticky left-0 bg-white z-10">Employee Name</th>
                  {monthDaysArray.map(d => (
                    <th key={d} className="p-2 font-heading text-navy text-opacity-65 font-bold text-[10px] text-center w-8">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="p-12 text-center text-navy text-opacity-40">No employees found.</td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => (
                    <tr key={emp._id} className="border-b border-navy border-opacity-5 hover:bg-navy hover:bg-opacity-[0.01]">
                      {/* Name sticky left */}
                      <td className="p-4 flex items-center gap-2 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 w-48">
                        <div className="w-7 h-7 rounded-full bg-navy text-gold font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {emp.fullName[0]}
                        </div>
                        <p className="font-heading font-bold text-navy text-xs truncate leading-tight">{emp.fullName}</p>
                      </td>

                      {/* Days row */}
                      {monthDaysArray.map(d => {
                        const status = getDayStatus(emp._id, d);
                        let indicatorClass = 'bg-gray-200 text-gray-400';
                        let symbol = '—';
                        if (status === 'Present') { indicatorClass = 'bg-green-100 text-success'; symbol = 'P'; }
                        if (status === 'Absent') { indicatorClass = 'bg-red-100 text-error'; symbol = 'A'; }
                        if (status === 'Half Day') { indicatorClass = 'bg-orange-100 text-warning'; symbol = 'H'; }
                        if (status === 'Leave') { indicatorClass = 'bg-yellow-100 text-gold-dark'; symbol = 'L'; }
                        
                        return (
                          <td key={d} className="p-1 text-center w-8">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold mx-auto transition-transform hover:scale-110 ${indicatorClass}`}
                              title={status ? `${status} on Day ${d}` : `No record`}
                            >
                              {symbol}
                            </span>
                          </td>
                        );
                      })}

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
