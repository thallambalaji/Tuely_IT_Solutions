import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import {
  Plus, Search, Edit2, Trash2, Key, Check, X,
  Loader2, AlertCircle, Calendar, UserPlus, FileText,
  Eye, EyeOff, Lock, ChevronDown, Upload, ZoomIn, ZoomOut,
  Building2, Briefcase, Clock, IndianRupee, Phone, Mail,
  MapPin, User as UserIcon, Badge, Crop
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

const DEPARTMENTS = ['All', 'IT', 'Non-IT', 'Management', 'Operations'];
const DESIGNATIONS = [
  'XML Developer', 'Customer Support Executive', 'Virtual Assistant',
  'Content Moderator', 'Data Entry Specialist', 'IT Consultant',
  'Web Designer', 'Digital Marketing Executive', 'Other'
];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const WORK_STATUS_OPTIONS = ['Completed', 'Working', 'Not Completed'];
const PRIORITY_COLORS = {
  Low: 'badge-success', Medium: 'badge-warning',
  High: 'bg-orange-200 text-orange-800', Urgent: 'badge-error'
};

const blankCompany = () => ({
  companyName: '', roleTitle: '', employmentType: 'Full-time', address: '',
  durationYears: 0, durationMonths: 0, fromDate: '', toDate: '',
  isCurrentJob: false, lastDrawnSalary: '', reasonForLeaving: ''
});

// Canvas crop helper
async function getCroppedImg(imageSrc, croppedAreaPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0, size, size
  );
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

// Calculate total experience from multiple companies
function calcTotalExperience(companies) {
  let totalMonths = 0;
  companies.forEach(c => {
    totalMonths += (parseInt(c.durationYears) || 0) * 12 + (parseInt(c.durationMonths) || 0);
  });
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

// Initials avatar
function InitialsAvatar({ name, size = 40 }) {
  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
    : '?';
  return (
    <div
      className="rounded-full bg-navy text-gold font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export default function Employees() {
  const { onlineUsers } = useSocket();
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Panel/Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeTaskPanel, setActiveTaskPanel] = useState(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Photo crop
  const [showCropModal, setShowCropModal] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);
  const [photoFor, setPhotoFor] = useState('add'); // 'add' or 'edit'

  // Add form
  const [addForm, setAddForm] = useState({
    firstName: '', middleName: '', lastName: '',
    gender: 'Prefer Not To Say', dateOfBirth: '',
    personalEmail: '', companyEmail: '',
    password: '', confirmPassword: '',
    phone: '', alternatePhone: '',
    address: { street: '', city: '', state: '', pincode: '' },
    designation: '', department: 'IT', salary: '', joiningDate: '',
    experienceType: 'fresher',
  });
  const [addCompanies, setAddCompanies] = useState([blankCompany()]);
  const [addShowPassword, setAddShowPassword] = useState(false);
  const [addShowConfirm, setAddShowConfirm] = useState(false);
  const [addResume, setAddResume] = useState(null);
  const [addResumeError, setAddResumeError] = useState('');

  // ── Bug Fix States ───────────────────────────────────
  const [employeeId, setEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [customRole, setCustomRole] = useState('');

  // Edit form
  const [editForm, setEditForm] = useState({});
  const [editCompanies, setEditCompanies] = useState([blankCompany()]);

  // Password form
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // Task form
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'Medium', dueDate: '' });

  const toastTimeoutRef = useRef(null);
  const showToast = (toastData) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (typeof toastData === 'string') {
      setToast({ type: 'success', title: 'Success', message: toastData });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
    } else {
      setToast(toastData);
      toastTimeoutRef.current = setTimeout(() => setToast(null), toastData.duration || 4000);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, tasksRes] = await Promise.all([
        api.get('/users'),
        api.get('/tasks'),
      ]);
      setEmployees(usersRes.data.filter(u => u.role === 'employee'));
      setTasks(tasksRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch next Employee ID when modal opens
  useEffect(() => {
    if (showAddModal) {
      const fetchNextId = async () => {
        try {
          const res = await api.get('/users/next-id');
          setEmployeeId(res.data.employeeId);
        } catch (err) {
          console.error('Failed to fetch employee ID:', err.response?.status, err.response?.data || err.message);
        }
      };
      fetchNextId();
    }
  }, [showAddModal]);

  const employeeTasksMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const eid = task.assignedTo?._id || task.assignedTo;
      if (eid && (!map[eid] || task.status !== 'Completed')) map[eid] = task;
    });
    return map;
  }, [tasks]);

  const filteredEmployees = useMemo(() =>
    employees.filter(emp => {
      const q = searchQuery.toLowerCase();
      const match = emp.fullName?.toLowerCase().includes(q) ||
        emp.companyEmail?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q) ||
        emp.employeeId?.toLowerCase().includes(q);
      const dept = selectedDept === 'All' || emp.department === selectedDept;
      return match && dept;
    }), [employees, searchQuery, selectedDept]);

  // ── Photo Crop ─────────────────────────────────────────────────
  const handlePhotoFileSelect = (e, target) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFor(target);
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result); setShowCropModal(true); };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, areaPixels) => setCroppedAreaPixels(areaPixels), []);

  const handleCropConfirm = async () => {
    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels);
      setCroppedBlob(blob);
      setCroppedPreview(URL.createObjectURL(blob));
      setShowCropModal(false);
    } catch (err) {
      console.error('Crop failed:', err);
    }
  };

  // ── Resume validation ──────────────────────────────────────────
  const handleResumeSelect = (e, setter, errorSetter) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(file.type) || !['pdf', 'docx'].includes(ext)) {
      errorSetter('Only PDF or Word (.docx) format is accepted for resume.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { errorSetter('File must be under 10MB.'); return; }
    errorSetter('');
    setter(file);
  };

  // ── Add Employee ───────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    if (!addForm.firstName?.trim()) errors.firstName = 'First name is required.';
    if (!addForm.lastName?.trim()) errors.lastName = 'Last name is required.';
    if (!addForm.companyEmail?.trim()) errors.companyEmail = 'Company email is required.';
    if (!addForm.personalEmail?.trim()) errors.personalEmail = 'Personal email is required.';
    if (!addForm.password) errors.password = 'Password is required.';
    
    if (addForm.password !== addForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (addForm.phone && !/^\d{10}$/.test(addForm.phone.replace(/\s/g, ''))) {
      errors.phone = 'Phone number must be 10 digits.';
    }
    
    if (!addForm.designation) {
      errors.role = 'Please select a role.';
    } else if (addForm.designation === 'Other' && !customRole.trim()) {
      errors.role = 'Please specify the custom role name';
    }
    
    return errors;
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setFormErrors({});

    // Run ALL validations first
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setError(Object.values(errors)[0]);
      return; // DO NOT submit if validation fails
    }

    if (isSubmitting) return; // prevent double submit
    setIsSubmitting(true);

    try {
      const experience = calcTotalExperience(addCompanies);
      const previousCompanies = addForm.experienceType === 'experienced'
        ? addCompanies.map(c => ({ ...c, yearsWorked: parseInt(c.durationYears) || 0 }))
        : [];

      const finalRole = addForm.designation === 'Other' ? customRole : addForm.designation;

      const formData = new FormData();
      if (croppedBlob && photoFor === 'add') {
        formData.append('profilePhoto', croppedBlob, 'profile.jpg');
      }
      formData.append('employeeId', employeeId);
      formData.append('firstName', addForm.firstName);
      formData.append('middleName', addForm.middleName);
      formData.append('lastName', addForm.lastName);
      formData.append('gender', addForm.gender);
      formData.append('dateOfBirth', addForm.dateOfBirth);
      formData.append('personalEmail', addForm.personalEmail);
      formData.append('companyEmail', addForm.companyEmail);
      formData.append('password', addForm.password);
      formData.append('phone', addForm.phone);
      formData.append('alternatePhone', addForm.alternatePhone);
      formData.append('designation', finalRole);
      formData.append('department', addForm.department);
      formData.append('salary', Number(addForm.salary) || 0);
      formData.append('joiningDate', addForm.joiningDate);
      formData.append('experienceType', addForm.experienceType);
      
      formData.append('address', JSON.stringify(addForm.address));
      formData.append('previousCompanies', JSON.stringify(previousCompanies));
      formData.append('totalExperience', JSON.stringify(addForm.experienceType === 'experienced' ? experience : { years: 0, months: 0 }));

      const { data } = await api.post('/users', formData);
      const userId = data.user._id;

      // Upload resume
      if (addResume) {
        const fd = new FormData();
        fd.append('resume', addResume, addResume.name);
        await api.post(`/users/${userId}/resume`, fd);
      }

      // Show success toast notification
      showToast({
        type: 'success',
        title: 'Employee Created Successfully!',
        message: `${addForm.firstName} ${addForm.lastName} (${employeeId}) has been added.`,
        duration: 4000
      });

      setShowAddModal(false);
      resetAddForm();
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to create employee. Please try again.';
      setError(errorMsg);
      showToast({
        type: 'error',
        title: 'Error Creating Employee',
        message: errorMsg,
        duration: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setAddForm({
      firstName: '', middleName: '', lastName: '',
      gender: 'Prefer Not To Say', dateOfBirth: '',
      personalEmail: '', companyEmail: '', password: '', confirmPassword: '',
      phone: '', alternatePhone: '',
      address: { street: '', city: '', state: '', pincode: '' },
      designation: '', department: 'IT', salary: '', joiningDate: '',
      experienceType: 'fresher',
    });
    setAddCompanies([blankCompany()]);
    setCroppedBlob(null); setCroppedPreview(null);
    setAddResume(null); setAddResumeError('');
    setEmployeeId('');
    setCustomRole('');
    setFormErrors({});
  };

  // ── Edit Employee ──────────────────────────────────────────────
  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setEditForm({
      firstName: emp.firstName || '', middleName: emp.middleName || '', lastName: emp.lastName || '',
      gender: emp.gender || 'Prefer Not To Say', dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      personalEmail: emp.personalEmail || '', companyEmail: emp.companyEmail || '',
      phone: emp.phone || '', alternatePhone: emp.alternatePhone || '',
      address: emp.address || { street: '', city: '', state: '', pincode: '' },
      designation: emp.designation || '', department: emp.department || 'IT',
      salary: emp.salary || '', joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      experienceType: emp.experienceType || 'fresher',
    });
    setEditCompanies(emp.previousCompanies?.length > 0
      ? emp.previousCompanies.map(c => ({
          ...blankCompany(), ...c,
          fromDate: c.fromDate ? c.fromDate.split('T')[0] : '',
          toDate: c.toDate ? c.toDate.split('T')[0] : '',
        }))
      : [blankCompany()]
    );
    setError('');
    setShowEditModal(true);
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      const experience = calcTotalExperience(editCompanies);
      const previousCompanies = editForm.experienceType === 'experienced'
        ? editCompanies.map(c => ({ ...c, yearsWorked: parseInt(c.durationYears) || 0 }))
        : [];
      const payload = {
        ...editForm,
        previousCompanies,
        totalExperience: editForm.experienceType === 'experienced' ? experience : { years: 0, months: 0 },
        salary: Number(editForm.salary) || 0,
      };
      await api.put(`/users/${selectedEmployee._id}`, payload);
      setShowEditModal(false);
      fetchData();
      showToast('Employee profile updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Change Password ────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setError('Passwords do not match.');
    if (passwordForm.newPassword.length < 6) return setError('Password must be at least 6 characters.');
    setActionLoading(true);
    try {
      await api.put(`/users/${selectedEmployee._id}/change-password`, { newPassword: passwordForm.newPassword });
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete Employee ────────────────────────────────────────────
  const handleDeleteEmployee = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/users/${selectedEmployee._id}`);
      setShowDeleteConfirm(false);
      setSelectedEmployee(null);
      fetchData();
      showToast(`${selectedEmployee.fullName} has been removed.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Assign Task ────────────────────────────────────────────────
  const handleAssignTask = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.post('/tasks', { ...taskForm, assignedTo: showTaskModal._id });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'Medium', dueDate: '' });
      fetchData();
      showToast('Task assigned.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign task.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Work Status Change ─────────────────────────────────────────
  const handleWorkStatusChange = async (task, newLabel) => {
    const statusMap = { 'Completed': 'Completed', 'Working': 'In Progress', 'Not Completed': 'Pending' };
    try {
      await api.put(`/tasks/${task._id}`, { status: statusMap[newLabel] });
      fetchData();
    } catch (err) { console.error('Status change failed:', err); }
  };

  // ── Task Panel ─────────────────────────────────────────────────
  const handleRowClick = (emp, e) => {
    if (e.target.closest('button') || e.target.closest('select')) return;
    const task = employeeTasksMap[emp._id];
    if (task) {
      setActiveTaskPanel(emp);
      setEditingTask({ ...task });
      setIsEditingTask(false);
    } else {
      setShowTaskModal(emp);
    }
  };

  const handleSaveTaskInline = async () => {
    try {
      await api.put(`/tasks/${editingTask._id}`, editingTask);
      setIsEditingTask(false);
      fetchData();
      showToast('Task updated.');
    } catch (err) { console.error('Save task failed:', err); }
  };

  const handleDeleteTaskInline = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${editingTask._id}`);
      setActiveTaskPanel(null);
      fetchData();
    } catch (err) { console.error('Delete task failed:', err); }
  };

  // ── Company block helpers ──────────────────────────────────────
  const updateCompany = (arr, setArr, idx, field, value) => {
    setArr(arr.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  const addCompany = (setArr) => setArr(prev => [...prev, blankCompany()]);
  const removeCompany = (arr, setArr, idx) => {
    if (!window.confirm('Remove this company block?')) return;
    setArr(arr.filter((_, i) => i !== idx));
  };

  if (loading) return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gold" />
      </main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 relative">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-6 right-6 z-[9999] p-4 rounded-2xl shadow-xl font-semibold text-sm flex gap-3 max-w-sm border ${
                toast.type === 'success'
                  ? 'bg-white border-green-200 text-navy'
                  : 'bg-white border-red-200 text-navy'
              }`}
            >
              <div className={`p-2 rounded-xl h-fit flex-shrink-0 ${
                toast.type === 'success' ? 'bg-green-100 text-success' : 'bg-red-100 text-error'
              }`}>
                {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading font-bold text-navy text-base">
                  {toast.title || (toast.type === 'success' ? 'Success' : 'Error')}
                </span>
                <span className="text-xs text-navy/60 font-normal">
                  {toast.message || toast.msg}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Human Resources</p>
            <h1 className="font-heading text-navy text-4xl font-bold">Team Directory</h1>
            <p className="text-navy/50 mt-1">Manage employee profiles, tasks, credentials, and account statuses.</p>
          </div>
          <button onClick={() => { setShowAddModal(true); resetAddForm(); }} className="btn-primary">
            <UserPlus size={18} /> Add Employee
          </button>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-navy/40" size={18} />
            <input
              type="text" placeholder="Search by name, ID, email, or designation..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="input pl-11"
            />
          </div>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="input w-full md:w-52 font-semibold">
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-navy/10 bg-navy/5">
                {['Photo & Name', 'Employee ID', 'Department / Role', 'Task Status', 'Work Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 font-heading text-navy font-bold text-sm whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-navy/40">No employees found.</td></tr>
              ) : filteredEmployees.map(emp => {
                const task = employeeTasksMap[emp._id];
                const isOnline = onlineUsers.has(emp._id);
                let displayStatus = 'Not Completed';
                if (task?.status === 'In Progress') displayStatus = 'Working';
                if (task?.status === 'Completed') displayStatus = 'Completed';

                return (
                  <motion.tr
                    key={emp._id}
                    onClick={(e) => handleRowClick(emp, e)}
                    className="border-b border-navy/5 hover:bg-navy/[0.02] cursor-pointer transition-colors"
                  >
                    {/* Identity */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          {emp.profilePhoto
                            ? <img src={emp.profilePhoto} alt={emp.fullName} className="w-10 h-10 rounded-full object-cover border border-navy/10" />
                            : <InitialsAvatar name={emp.fullName} size={40} />
                          }
                          {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />}
                        </div>
                        <div>
                          <p className="font-heading font-bold text-navy leading-tight">{emp.fullName}</p>
                          <p className="text-xs text-navy/50 mt-0.5">{emp.companyEmail}</p>
                        </div>
                      </div>
                    </td>
                    {/* Employee ID */}
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-navy/10 text-navy font-mono font-bold text-xs">
                        {emp.employeeId || '—'}
                      </span>
                    </td>
                    {/* Dept / Role */}
                    <td className="p-4">
                      <span className={emp.department === 'IT' ? 'badge-it' : 'badge-non-it'}>{emp.department}</span>
                      <p className="text-xs text-navy/50 mt-1">{emp.designation || 'No Role'}</p>
                    </td>
                    {/* Task Badge */}
                    <td className="p-4">
                      <span className={task ? 'badge-gold' : 'badge-gray'}>
                        {task ? 'Task Assigned' : 'Not Assigned'}
                      </span>
                    </td>
                    {/* Work Status */}
                    <td className="p-4">
                      {task ? (
                        <select
                          value={displayStatus}
                          onChange={e => handleWorkStatusChange(task, e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                            displayStatus === 'Completed' ? 'bg-green-50 text-success border-success' :
                            displayStatus === 'Working' ? 'bg-gold-soft text-navy border-gold' :
                            'bg-red-50 text-error border-error'
                          }`}
                        >
                          {WORK_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : <span className="text-xs text-navy/40 italic">No Active Task</span>}
                    </td>
                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        {!task && (
                          <button onClick={() => setShowTaskModal(emp)} className="px-2.5 py-1.5 bg-gold text-navy font-bold text-xs rounded-lg hover:bg-gold-light text-nowrap">
                            Assign Task
                          </button>
                        )}
                        <button onClick={() => openEditModal(emp)} className="p-2 text-navy/60 hover:text-navy hover:bg-navy/5 rounded-lg" title="Edit Profile">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => { setSelectedEmployee(emp); setShowPasswordModal(true); setError(''); }} className="p-2 text-navy/60 hover:text-gold hover:bg-gold-soft rounded-lg" title="Change Password">
                          <Key size={15} />
                        </button>
                        <button onClick={() => { setSelectedEmployee(emp); setShowDeleteConfirm(true); setError(''); }} className="p-2 text-navy/60 hover:text-error hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Task Detail Slide-out Panel ─────────────────────── */}
        <AnimatePresence>
          {activeTaskPanel && editingTask && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
                onClick={() => setActiveTaskPanel(null)} className="fixed inset-0 bg-navy z-40" />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
              >
                {/* Panel Header */}
                <div className="p-6 border-b border-navy/10 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {activeTaskPanel.profilePhoto
                      ? <img src={activeTaskPanel.profilePhoto} className="w-12 h-12 rounded-full object-cover" />
                      : <InitialsAvatar name={activeTaskPanel.fullName} size={48} />
                    }
                    <div>
                      <p className="font-heading text-navy font-bold text-lg leading-none">{activeTaskPanel.fullName}</p>
                      <p className="text-xs text-navy/50 mt-0.5">{activeTaskPanel.employeeId} · {activeTaskPanel.designation}</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTaskPanel(null)} className="p-2 hover:bg-cream rounded-full"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isEditingTask ? (
                    <div className="space-y-4">
                      <div>
                        <label className="label">Task Name</label>
                        <input type="text" className="input" value={editingTask.title}
                          onChange={e => setEditingTask(t => ({ ...t, title: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Description</label>
                        <textarea rows={4} className="input resize-none" value={editingTask.description}
                          onChange={e => setEditingTask(t => ({ ...t, description: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Priority</label>
                          <div className="flex gap-2 flex-wrap">
                            {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                              <button key={p} type="button" onClick={() => setEditingTask(t => ({ ...t, priority: p }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${editingTask.priority === p ? 'border-gold bg-gold text-navy' : 'border-navy/10 text-navy/50'}`}>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="label">Due Date</label>
                          <input type="date" className="input" value={editingTask.dueDate?.split('T')[0] || ''}
                            onChange={e => setEditingTask(t => ({ ...t, dueDate: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${PRIORITY_COLORS[editingTask.priority] || 'badge-gray'}`}>
                            {editingTask.priority?.toUpperCase()}
                          </span>
                          <h3 className="font-heading text-navy text-2xl font-bold mt-2">{editingTask.title}</h3>
                        </div>
                        {editingTask.isEdited && (
                          <span className="badge-gold text-[10px] flex items-center gap-1 whitespace-nowrap">
                            <Lock size={10} /> Edited by HR
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy/50 uppercase tracking-widest mb-1">Description</p>
                        <p className="text-navy text-sm leading-relaxed">{editingTask.description || 'No description.'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-navy/10">
                        <div>
                          <p className="text-[10px] font-semibold text-navy/50 uppercase tracking-widest">Due Date</p>
                          <p className={`font-semibold text-sm mt-0.5 ${new Date(editingTask.dueDate) < new Date() && editingTask.status !== 'Completed' ? 'text-error' : 'text-navy'}`}>
                            {editingTask.dueDate ? new Date(editingTask.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-navy/50 uppercase tracking-widest">Status</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-3 h-3 rounded-full ${editingTask.status === 'Completed' ? 'bg-success' : editingTask.status === 'In Progress' ? 'bg-gold' : 'bg-red-400'}`} />
                            <span className="text-navy font-bold text-sm">{editingTask.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-navy/10 space-y-3">
                  {isEditingTask ? (
                    <div className="flex gap-3">
                      <button onClick={handleSaveTaskInline} className="btn-primary flex-1"><Check size={16} /> Save Changes</button>
                      <button onClick={() => setIsEditingTask(false)} className="btn-secondary flex-1">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setIsEditingTask(true)} className="btn-primary w-full"><Edit2 size={16} /> Edit Task</button>
                      <div className="flex gap-3">
                        <button onClick={handleDeleteTaskInline} className="btn-danger flex-1"><Trash2 size={16} /> Delete</button>
                        <button onClick={() => setActiveTaskPanel(null)} className="btn-secondary flex-1">Close</button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Photo Crop Modal ─────────────────────────────────── */}
        <AnimatePresence>
          {showCropModal && rawImageSrc && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black" onClick={() => setShowCropModal(false)} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 bg-white rounded-3xl p-6 w-full max-w-md">
                <h3 className="font-heading text-navy text-xl font-bold mb-4 flex items-center gap-2"><Crop size={20} className="text-gold" /> Crop Profile Photo</h3>
                <div className="relative h-64 rounded-2xl overflow-hidden bg-navy/10">
                  <Cropper
                    image={rawImageSrc} crop={crop} zoom={zoom}
                    aspect={1} cropShape="round" showGrid={false}
                    onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}
                  />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <ZoomOut size={16} className="text-navy/50" />
                  <input type="range" min={1} max={3} step={0.1} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="flex-1 accent-gold"
                  />
                  <ZoomIn size={16} className="text-navy/50" />
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={handleCropConfirm} className="btn-gold flex-1"><Check size={16} /> Crop & Save</button>
                  <button onClick={() => setShowCropModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Add Employee Modal ──────────────────────────────── */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 px-8 pt-8 pb-4 border-b border-navy/10 flex justify-between items-center">
                  <h2 className="font-heading text-navy text-2xl font-bold flex items-center gap-2">
                    <UserPlus className="text-gold" size={24} /> Add Employee
                  </h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={18} /></button>
                </div>

                <form autoComplete="off" onSubmit={handleAddEmployee} className="px-8 pb-8 pt-6 space-y-8">
                  {error && <div className="bg-red-50 border border-error/20 text-error rounded-xl px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

                  {/* Auto-generated Employee ID preview */}
                  <div className="flex items-center gap-3 p-4 bg-navy/5 rounded-2xl">
                    <Badge size={18} className="text-gold" />
                    <div>
                      <p className="text-xs font-semibold text-navy/50 uppercase tracking-wider">Employee ID</p>
                      <div className="employee-id-badge mt-1">
                        {employeeId
                          ? <span className="gold-badge">{employeeId}</span>
                          : <span className="loading-text">Generating...</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* ─ Section 1: Identity ─ */}
                  <FormSection title="Identity" icon={<UserIcon size={18} className="text-gold" />}>
                    {/* Profile Photo */}
                    <div className="col-span-2 flex items-center gap-6">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden bg-navy/10 flex items-center justify-center flex-shrink-0 border-2 border-dashed border-navy/20">
                        {croppedPreview && photoFor === 'add'
                          ? <img src={croppedPreview} className="w-full h-full object-cover" alt="Preview" />
                          : <div className="flex flex-col items-center gap-1">
                              <UserIcon size={28} className="text-navy/30" />
                              {addForm.firstName && <span className="text-xs font-bold text-navy/50">{[addForm.firstName[0], addForm.lastName[0]].filter(Boolean).join('')}</span>}
                            </div>
                        }
                      </div>
                      <div>
                        <label className="btn-secondary cursor-pointer text-sm py-2 px-4 inline-flex items-center gap-2">
                          <Upload size={15} /> {croppedPreview && photoFor === 'add' ? 'Change Photo' : 'Upload Photo'}
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handlePhotoFileSelect(e, 'add')} />
                        </label>
                        <p className="text-xs text-navy/40 mt-1.5">JPG, PNG, WEBP · Max 5MB · Optional</p>
                      </div>
                    </div>
                    {/* Name fields */}
                    <FieldGroup label="First Name *">
                      <input required type="text" className="input" value={addForm.firstName}
                        onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" />
                    </FieldGroup>
                    <FieldGroup label="Middle Name">
                      <input type="text" className="input" value={addForm.middleName}
                        onChange={e => setAddForm(f => ({ ...f, middleName: e.target.value }))} placeholder="Optional" />
                    </FieldGroup>
                    <FieldGroup label="Last Name *">
                      <input required type="text" className="input" value={addForm.lastName}
                        onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
                    </FieldGroup>
                    {/* Gender */}
                    <FieldGroup label="Gender" className="col-span-2">
                      <div className="flex gap-4">
                        {['Male', 'Female', 'Prefer Not To Say'].map(g => (
                          <label key={g} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="addGender" value={g} checked={addForm.gender === g}
                              onChange={() => setAddForm(f => ({ ...f, gender: g }))}
                              className="w-4 h-4 accent-gold" />
                            <span className="text-sm font-medium text-navy">{g}</span>
                          </label>
                        ))}
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Date of Birth">
                      <input type="date" className="input" value={addForm.dateOfBirth}
                        onChange={e => setAddForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Personal Email *">
                      <input
                        required
                        type="email"
                        name="personalEmail"
                        autoComplete="off"
                        className="input"
                        value={addForm.personalEmail}
                        onChange={e => setAddForm(f => ({ ...f, personalEmail: e.target.value }))}
                        placeholder="personal@gmail.com"
                      />
                    </FieldGroup>
                    <FieldGroup label="Company Email * (Login Email)">
                      <input
                        required
                        type="email"
                        name="companyEmail"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        className="input"
                        value={addForm.companyEmail}
                        onChange={e => setAddForm(f => ({ ...f, companyEmail: e.target.value }))}
                        placeholder="company@teulyitsolutions.com"
                      />
                    </FieldGroup>
                    <FieldGroup label="Password *">
                      <div className="relative">
                        <input
                          required
                          type={addShowPassword ? 'text' : 'password'}
                          minLength={6}
                          name="newPassword"
                          autoComplete="new-password"
                          className="input pr-10"
                          value={addForm.password}
                          onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Enter password"
                        />
                        <button type="button" onClick={() => setAddShowPassword(!addShowPassword)} className="absolute right-3 top-3.5 text-navy/40 hover:text-navy">
                          {addShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Confirm Password *">
                      <div className="relative">
                        <input
                          required
                          type={addShowConfirm ? 'text' : 'password'}
                          name="confirmNewPassword"
                          autoComplete="new-password"
                          className="input pr-10"
                          value={addForm.confirmPassword}
                          onChange={e => setAddForm(f => ({ ...f, confirmPassword: e.target.value }))}
                          placeholder="Confirm password"
                        />
                        <button type="button" onClick={() => setAddShowConfirm(!addShowConfirm)} className="absolute right-3 top-3.5 text-navy/40 hover:text-navy">
                          {addShowConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {addForm.confirmPassword && addForm.password !== addForm.confirmPassword &&
                        <p className="text-error text-xs mt-1">Passwords do not match</p>}
                    </FieldGroup>
                    <FieldGroup label="Phone Number *">
                      <input required type="tel" className="input" value={addForm.phone}
                        onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit number" maxLength={15} />
                    </FieldGroup>
                    <FieldGroup label="Alternate Phone">
                      <input type="tel" className="input" value={addForm.alternatePhone}
                        onChange={e => setAddForm(f => ({ ...f, alternatePhone: e.target.value }))} placeholder="Optional" />
                    </FieldGroup>
                    {/* Address */}
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-navy/50 uppercase tracking-widest mb-3 flex items-center gap-1.5"><MapPin size={13} /> Address</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" className="input col-span-2" placeholder="Street Address"
                          value={addForm.address.street} onChange={e => setAddForm(f => ({ ...f, address: { ...f.address, street: e.target.value } }))} />
                        <input type="text" className="input" placeholder="City"
                          value={addForm.address.city} onChange={e => setAddForm(f => ({ ...f, address: { ...f.address, city: e.target.value } }))} />
                        <input type="text" className="input" placeholder="State"
                          value={addForm.address.state} onChange={e => setAddForm(f => ({ ...f, address: { ...f.address, state: e.target.value } }))} />
                        <input type="text" className="input" placeholder="Pincode" maxLength={6}
                          value={addForm.address.pincode} onChange={e => setAddForm(f => ({ ...f, address: { ...f.address, pincode: e.target.value } }))} />
                      </div>
                    </div>
                  </FormSection>

                  {/* ─ Section 2: Company Details ─ */}
                  <FormSection title="Company Details" icon={<Building2 size={18} className="text-gold" />}>
                    <FieldGroup label="Role in Company *">
                      <select
                        required
                        className="input"
                        value={addForm.designation}
                        onChange={e => setAddForm(f => ({ ...f, designation: e.target.value }))}
                      >
                        <option value="">Select Role</option>
                        {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {addForm.designation === 'Other' && (
                        <div className="other-role-input" style={{ marginTop: '8px' }}>
                          <input
                            type="text"
                            placeholder="Please specify the role..."
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            autoComplete="off"
                            maxLength={100}
                            required
                            className="input-gold-focus"
                          />
                          <small style={{ color: '#5A5E72', fontSize: '12px' }}>
                            Enter the custom role name
                          </small>
                        </div>
                      )}
                    </FieldGroup>
                    <FieldGroup label="Department *">
                      <select required className="input" value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}>
                        <option value="IT">IT</option>
                        <option value="Non-IT">Non-IT</option>
                      </select>
                    </FieldGroup>
                    <FieldGroup label="CTC (Annual) *">
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-3.5 text-navy/40" size={16} />
                        <input required type="number" className="input pl-9" value={addForm.salary} placeholder="Annual CTC in INR"
                          onChange={e => setAddForm(f => ({ ...f, salary: e.target.value }))} />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Joining Date *">
                      <input required type="date" className="input" value={addForm.joiningDate}
                        onChange={e => setAddForm(f => ({ ...f, joiningDate: e.target.value }))} />
                    </FieldGroup>
                  </FormSection>

                  {/* ─ Section 3: Resume ─ */}
                  <FormSection title="Resume" icon={<FileText size={18} className="text-gold" />}>
                    <div className="col-span-2">
                      <label className="btn-secondary cursor-pointer text-sm py-2 px-4 inline-flex items-center gap-2">
                        <Upload size={15} /> {addResume ? 'Change Resume' : 'Upload Resume'}
                        <input type="file" accept=".pdf,.docx" className="hidden"
                          onChange={e => handleResumeSelect(e, setAddResume, setAddResumeError)} />
                      </label>
                      {addResume && (
                        <span className="ml-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gold/15 text-navy rounded-lg text-xs font-bold">
                          {addResume.name.endsWith('.pdf') ? '📄' : '📝'} {addResume.name} <Check size={12} className="text-success" />
                        </span>
                      )}
                      {addResumeError && <p className="text-error text-xs mt-2">{addResumeError}</p>}
                      <p className="text-xs text-navy/40 mt-1.5">PDF or Word (.docx) · Max 10MB · Optional</p>
                    </div>
                  </FormSection>

                  {/* ─ Section 4: Experience ─ */}
                  <FormSection title="Experience" icon={<Briefcase size={18} className="text-gold" />}>
                    <div className="col-span-2">
                      <div className="flex gap-4">
                        {['fresher', 'experienced'].map(t => (
                          <label key={t} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="addExpType" value={t} checked={addForm.experienceType === t}
                              onChange={() => setAddForm(f => ({ ...f, experienceType: t }))} className="w-4 h-4 accent-gold" />
                            <span className="text-sm font-semibold text-navy capitalize">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {addForm.experienceType === 'experienced' && (
                      <div className="col-span-2 space-y-4">
                        {addCompanies.map((company, idx) => (
                          <CompanyBlock
                            key={idx} company={company} idx={idx}
                            isFirst={idx === 0} totalCompanies={addCompanies.length}
                            onChange={(field, val) => updateCompany(addCompanies, setAddCompanies, idx, field, val)}
                            onRemove={() => removeCompany(addCompanies, setAddCompanies, idx)}
                            isHR={true}
                          />
                        ))}

                        <button type="button" onClick={() => addCompany(setAddCompanies)}
                          className="flex items-center gap-2 text-gold font-semibold text-sm hover:text-gold-light transition-colors">
                          <Plus size={16} /> Add Another Company
                        </button>

                        {/* Total Experience Badge */}
                        {addCompanies.length > 0 && (() => {
                          const exp = calcTotalExperience(addCompanies);
                          return (exp.years > 0 || exp.months > 0) ? (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/15 rounded-xl">
                              <Clock size={16} className="text-gold" />
                              <span className="font-bold text-navy text-sm">
                                Total Experience: {exp.years > 0 ? `${exp.years} Year${exp.years > 1 ? 's' : ''}` : ''}{exp.months > 0 ? ` ${exp.months} Month${exp.months > 1 ? 's' : ''}` : ''}
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </FormSection>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={isSubmitting ? 'btn-disabled w-full py-4 text-base' : 'btn-gold w-full py-4 text-base'}
                  >
                    {isSubmitting ? (
                      <><Loader2 size={20} className="animate-spin" /> Adding Employee...</>
                    ) : (
                      <><UserPlus size={20} /> Add Employee</>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Edit Employee Modal ───────────────────────────────── */}
        <AnimatePresence>
          {showEditModal && selectedEmployee && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 px-8 pt-8 pb-4 border-b border-navy/10 flex justify-between items-center">
                  <h2 className="font-heading text-navy text-2xl font-bold flex items-center gap-2">
                    <Edit2 className="text-gold" size={22} /> Edit — {selectedEmployee.fullName}
                  </h2>
                  <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={18} /></button>
                </div>
                <form onSubmit={handleEditEmployee} className="px-8 pb-8 pt-6 space-y-8">
                  {error && <div className="bg-red-50 border border-error/20 text-error rounded-xl px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

                  {/* Employee ID readonly */}
                  <div className="flex items-center gap-3 p-4 bg-gold/10 rounded-2xl">
                    <Badge size={18} className="text-gold" />
                    <span className="font-mono font-bold text-navy">{selectedEmployee.employeeId || 'No ID'}</span>
                    <span className="text-xs text-navy/40 ml-auto">Read-only</span>
                  </div>

                  <FormSection title="Identity" icon={<UserIcon size={18} className="text-gold" />}>
                    <FieldGroup label="First Name *">
                      <input required type="text" className="input" value={editForm.firstName}
                        onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Middle Name">
                      <input type="text" className="input" value={editForm.middleName}
                        onChange={e => setEditForm(f => ({ ...f, middleName: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Last Name *">
                      <input required type="text" className="input" value={editForm.lastName}
                        onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Personal Email *">
                      <input required type="email" className="input" value={editForm.personalEmail}
                        onChange={e => setEditForm(f => ({ ...f, personalEmail: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Phone *">
                      <input required type="tel" className="input" value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Alternate Phone">
                      <input type="tel" className="input" value={editForm.alternatePhone}
                        onChange={e => setEditForm(f => ({ ...f, alternatePhone: e.target.value }))} />
                    </FieldGroup>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-navy/50 uppercase tracking-widest mb-3 flex items-center gap-1.5"><MapPin size={13} /> Address</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" className="input col-span-2" placeholder="Street" value={editForm.address?.street || ''}
                          onChange={e => setEditForm(f => ({ ...f, address: { ...f.address, street: e.target.value } }))} />
                        <input type="text" className="input" placeholder="City" value={editForm.address?.city || ''}
                          onChange={e => setEditForm(f => ({ ...f, address: { ...f.address, city: e.target.value } }))} />
                        <input type="text" className="input" placeholder="State" value={editForm.address?.state || ''}
                          onChange={e => setEditForm(f => ({ ...f, address: { ...f.address, state: e.target.value } }))} />
                        <input type="text" className="input" placeholder="Pincode" value={editForm.address?.pincode || ''}
                          onChange={e => setEditForm(f => ({ ...f, address: { ...f.address, pincode: e.target.value } }))} />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Company Details" icon={<Building2 size={18} className="text-gold" />}>
                    <FieldGroup label="Role in Company *">
                      <select required className="input" value={editForm.designation}
                        onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))}>
                        <option value="">Select Role</option>
                        {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Department *">
                      <select required className="input" value={editForm.department}
                        onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                        <option value="IT">IT</option>
                        <option value="Non-IT">Non-IT</option>
                      </select>
                    </FieldGroup>
                    <FieldGroup label="CTC (Annual) *">
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-3.5 text-navy/40" size={16} />
                        <input required type="number" className="input pl-9" value={editForm.salary}
                          onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))} />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="Joining Date *">
                      <input required type="date" className="input" value={editForm.joiningDate}
                        onChange={e => setEditForm(f => ({ ...f, joiningDate: e.target.value }))} />
                    </FieldGroup>
                  </FormSection>

                  <FormSection title="Experience" icon={<Briefcase size={18} className="text-gold" />}>
                    <div className="col-span-2 flex gap-4">
                      {['fresher', 'experienced'].map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="editExpType" value={t} checked={editForm.experienceType === t}
                            onChange={() => setEditForm(f => ({ ...f, experienceType: t }))} className="w-4 h-4 accent-gold" />
                          <span className="text-sm font-semibold text-navy capitalize">{t}</span>
                        </label>
                      ))}
                    </div>
                    {editForm.experienceType === 'experienced' && (
                      <div className="col-span-2 space-y-4">
                        {editCompanies.map((company, idx) => (
                          <CompanyBlock key={idx} company={company} idx={idx}
                            isFirst={idx === 0} totalCompanies={editCompanies.length}
                            onChange={(field, val) => updateCompany(editCompanies, setEditCompanies, idx, field, val)}
                            onRemove={() => removeCompany(editCompanies, setEditCompanies, idx)}
                            isHR={true}
                          />
                        ))}
                        <button type="button" onClick={() => addCompany(setEditCompanies)}
                          className="flex items-center gap-2 text-gold font-semibold text-sm">
                          <Plus size={16} /> Add Another Company
                        </button>
                        {(() => {
                          const exp = calcTotalExperience(editCompanies);
                          return (exp.years > 0 || exp.months > 0) ? (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/15 rounded-xl">
                              <Clock size={16} className="text-gold" />
                              <span className="font-bold text-navy text-sm">
                                Total: {exp.years}y {exp.months}m
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </FormSection>

                  <button type="submit" disabled={actionLoading} className="btn-primary w-full py-4 text-base">
                    {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> Save Changes</>}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Password Modal ───────────────────────────────────── */}
        <AnimatePresence>
          {showPasswordModal && selectedEmployee && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowPasswordModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Key className="text-gold" size={20} /> Change Password
                  </h2>
                  <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>
                <p className="text-sm text-navy/60 mb-5">Set new password for <strong>{selectedEmployee.fullName}</strong></p>
                {error && <div className="bg-red-50 text-error text-sm px-3 py-2 rounded-xl mb-4">{error}</div>}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <input required type={showPwd1 ? 'text' : 'password'} minLength={6} className="input pr-10"
                        value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
                      <button type="button" onClick={() => setShowPwd1(!showPwd1)} className="absolute right-3 top-3.5 text-navy/40">
                        {showPwd1 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm Password</label>
                    <div className="relative">
                      <input required type={showPwd2 ? 'text' : 'password'} className="input pr-10"
                        value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                      <button type="button" onClick={() => setShowPwd2(!showPwd2)} className="absolute right-3 top-3.5 text-navy/40">
                        {showPwd2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword &&
                      <p className="text-error text-xs mt-1">Passwords do not match</p>}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={actionLoading} className="btn-primary flex-1">
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Update Password</>}
                    </button>
                    <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Delete Confirmation Modal ────────────────────────── */}
        <AnimatePresence>
          {showDeleteConfirm && selectedEmployee && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-md">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Trash2 size={22} className="text-error" />
                  </div>
                  <div>
                    <h2 className="font-heading text-navy text-xl font-bold">Delete Employee</h2>
                    <p className="text-sm text-navy/50 mt-0.5">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-navy/70 bg-red-50 rounded-xl p-4 mb-5">
                  Are you sure you want to delete <strong>{selectedEmployee.fullName} ({selectedEmployee.employeeId || selectedEmployee.companyEmail})</strong>?
                  This will immediately log them out and disable their account.
                </p>
                {error && <div className="text-error text-sm mb-3">{error}</div>}
                <div className="flex gap-3">
                  <button onClick={handleDeleteEmployee} disabled={actionLoading} className="btn-danger flex-1">
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Yes, Delete Permanently</>}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Assign Task Modal ────────────────────────────────── */}
        <AnimatePresence>
          {showTaskModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowTaskModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-navy text-xl font-bold">Assign Task to {showTaskModal.fullName}</h2>
                  <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>
                {error && <div className="bg-red-50 text-error text-sm px-3 py-2 rounded-xl mb-4">{error}</div>}
                <form onSubmit={handleAssignTask} className="space-y-4">
                  <div>
                    <label className="label">Task Name *</label>
                    <input required type="text" className="input" value={taskForm.title}
                      onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Update client database" />
                  </div>
                  <div>
                    <label className="label">Description *</label>
                    <textarea required rows={3} className="input resize-none" value={taskForm.description}
                      onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <div className="flex gap-2">
                      {[['Low', 'bg-green-100 text-green-700'], ['Medium', 'bg-orange-100 text-orange-700'], ['High', 'bg-red-100 text-red-700'], ['Urgent', 'bg-red-200 text-red-900']].map(([p, cls]) => (
                        <button key={p} type="button"
                          onClick={() => setTaskForm(f => ({ ...f, priority: p }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${taskForm.priority === p ? `${cls} border-current` : 'border-navy/10 text-navy/40'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Due Date *</label>
                    <input required type="date" className="input" value={taskForm.dueDate}
                      onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={actionLoading} className="btn-gold flex-1">
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Assign Task</>}
                    </button>
                    <button type="button" onClick={() => setShowTaskModal(false)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────
function FormSection({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-navy/10">
        {icon}
        <h3 className="font-heading text-navy text-lg font-bold">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FieldGroup({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function CompanyBlock({ company, idx, isFirst, totalCompanies, onChange, onRemove, isHR }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="border border-navy/10 rounded-2xl p-5 bg-cream/50 relative">
      {!isFirst && totalCompanies > 1 && (
        <button type="button" onClick={onRemove}
          className="absolute top-4 right-4 p-1.5 text-error hover:bg-red-50 rounded-lg transition-colors" title="Remove company">
          <Trash2 size={15} />
        </button>
      )}
      <p className="font-heading text-navy font-bold text-sm mb-4 flex items-center gap-2">
        <Building2 size={15} className="text-gold" /> Company #{idx + 1}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Company Name *</label>
          <input required type="text" className="input text-sm" value={company.companyName}
            onChange={e => onChange('companyName', e.target.value)} placeholder="Company name" />
        </div>
        <div>
          <label className="label">Role / Designation *</label>
          <input required type="text" className="input text-sm" value={company.roleTitle}
            onChange={e => onChange('roleTitle', e.target.value)} placeholder="e.g. Frontend Engineer" />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select className="input text-sm" value={company.employmentType} onChange={e => onChange('employmentType', e.target.value)}>
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Address (optional)</label>
          <input type="text" className="input text-sm" value={company.address} onChange={e => onChange('address', e.target.value)} placeholder="City, State" />
        </div>
        <div>
          <label className="label">Duration Worked</label>
          <div className="flex gap-2">
            <select className="input text-sm" value={company.durationYears} onChange={e => onChange('durationYears', e.target.value)}>
              {Array.from({ length: 21 }, (_, i) => <option key={i} value={i}>{i}y</option>)}
            </select>
            <select className="input text-sm" value={company.durationMonths} onChange={e => onChange('durationMonths', e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i}m</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="month" className="input text-sm" value={company.fromDate?.substring(0, 7) || ''}
            onChange={e => onChange('fromDate', e.target.value)} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="month" className="input text-sm" value={company.toDate?.substring(0, 7) || ''}
            disabled={company.isCurrentJob} onChange={e => onChange('toDate', e.target.value)} />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={company.isCurrentJob} onChange={e => onChange('isCurrentJob', e.target.checked)} className="w-3.5 h-3.5 accent-gold" />
            <span className="text-xs text-navy/60">Currently Working Here</span>
            {company.isCurrentJob && <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-bold">Current</span>}
          </label>
        </div>
        {isHR && (
          <div>
            <label className="label">Salary Drawn (CTC) — HR Only</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-3.5 text-navy/40" size={14} />
              <input type="number" className="input pl-8 text-sm" value={company.lastDrawnSalary}
                onChange={e => onChange('lastDrawnSalary', e.target.value)} placeholder="₹ Annual CTC" />
            </div>
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Reason for Leaving (optional)</label>
          <textarea rows={2} className="input resize-none text-sm" value={company.reasonForLeaving}
            onChange={e => onChange('reasonForLeaving', e.target.value)} placeholder="e.g. Better opportunity, career growth..." />
        </div>
      </div>
    </motion.div>
  );
}
