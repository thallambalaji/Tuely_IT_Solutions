import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import {
  User, Mail, Phone, MapPin, Briefcase, Plus, Trash2,
  Save, Key, ShieldAlert, Loader2, Sparkles, CheckCircle2, FileText, X,
  Crop, ZoomIn, ZoomOut, Building2, Clock, IndianRupee
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const STATES_LIST = ['Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Maharashtra', 'Delhi', 'Kerala'];

const blankCompany = () => ({
  companyName: '', roleTitle: '', employmentType: 'Full-time', address: '',
  durationYears: 0, durationMonths: 0, fromDate: '', toDate: '',
  isCurrentJob: false, reasonForLeaving: ''
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

// Calculate total experience
function calcTotalExperience(companies) {
  let totalMonths = 0;
  companies.forEach(c => {
    totalMonths += (parseInt(c.durationYears) || 0) * 12 + (parseInt(c.durationMonths) || 0);
  });
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

function CompanyBlock({ company, idx, isFirst, totalCompanies, onChange, onRemove }) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
        <div>
          <label className="label">Company Name *</label>
          <input required type="text" className="input text-xs" value={company.companyName}
            onChange={e => onChange('companyName', e.target.value)} placeholder="Company name" />
        </div>
        <div>
          <label className="label">Role / Designation *</label>
          <input required type="text" className="input text-xs" value={company.roleTitle}
            onChange={e => onChange('roleTitle', e.target.value)} placeholder="e.g. Frontend Engineer" />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select className="input text-xs" value={company.employmentType} onChange={e => onChange('employmentType', e.target.value)}>
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Address (optional)</label>
          <input type="text" className="input text-xs" value={company.address || ''} onChange={e => onChange('address', e.target.value)} placeholder="City, State" />
        </div>
        <div>
          <label className="label">Duration Worked</label>
          <div className="flex gap-2">
            <select className="input text-xs" value={company.durationYears} onChange={e => onChange('durationYears', Number(e.target.value))}>
              {Array.from({ length: 21 }, (_, i) => <option key={i} value={i}>{i}y</option>)}
            </select>
            <select className="input text-xs" value={company.durationMonths} onChange={e => onChange('durationMonths', Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i}m</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="month" className="input text-xs" value={company.fromDate?.substring(0, 7) || ''}
            onChange={e => onChange('fromDate', e.target.value)} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="month" className="input text-xs" value={company.toDate?.substring(0, 7) || ''}
            disabled={company.isCurrentJob} onChange={e => onChange('toDate', e.target.value)} />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={company.isCurrentJob} onChange={e => onChange('isCurrentJob', e.target.checked)} className="w-3.5 h-3.5 accent-gold" />
            <span className="text-xs text-navy/60">Currently Working Here</span>
            {company.isCurrentJob && <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-bold">Current</span>}
          </label>
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="label">Reason for Leaving (optional)</label>
          <textarea rows={2} className="input resize-none text-xs" value={company.reasonForLeaving || ''}
            onChange={e => onChange('reasonForLeaving', e.target.value)} placeholder="e.g. Better opportunity, career growth..." />
        </div>
      </div>
    </motion.div>
  );
}

export default function EmployeeProfile() {
  const { user } = useAuth();
  
  // Profile Info States
  const [userRecord, setUserRecord] = useState(null);
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [gender, setGender] = useState('Prefer Not To Say');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  
  // Experience Details
  const [experienceType, setExperienceType] = useState('fresher');
  const [previousCompanies, setPreviousCompanies] = useState([]);

  // Photo Crop states
  const [showCropModal, setShowCropModal] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  // Password Change States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // General Loading & Saving States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const u = data.user || data;
      setUserRecord(u);
      setPersonalEmail(u.personalEmail || '');
      setPhone(u.phone || '');
      setAlternatePhone(u.alternatePhone || '');
      setGender(u.gender || 'Prefer Not To Say');
      setStreet(u.address?.street || '');
      setCity(u.address?.city || '');
      setState(u.address?.state || '');
      setPincode(u.address?.pincode || '');
      setExperienceType(u.experienceType || 'fresher');
      setPreviousCompanies(u.previousCompanies || []);
      setProfilePhoto(u.profilePhoto || '');
      setResumeUrl(u.resumeUrl || '');
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Add Company Row
  const handleAddCompany = () => {
    setPreviousCompanies(prev => [...prev, blankCompany()]);
  };

  // Remove Company Row
  const handleRemoveCompany = (index) => {
    setPreviousCompanies(prev => prev.filter((_, i) => i !== index));
  };

  // Change Company field values
  const handleCompanyChange = (index, field, value) => {
    setPreviousCompanies(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'isCurrentJob' && value === true) {
        updated.toDate = '';
      }
      return updated;
    }));
  };

  // Submit Profile update
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    // Compute dynamic total experience
    const totalExp = calcTotalExperience(previousCompanies);

    // Map duration parameters
    const mappedCompanies = previousCompanies.map(c => ({
      ...c,
      yearsWorked: parseInt(c.durationYears) || 0
    }));

    try {
      await api.put(`/users/${user._id}`, {
        personalEmail,
        phone,
        alternatePhone,
        gender,
        address: { street, city, state, pincode },
        experienceType,
        previousCompanies: mappedCompanies,
        totalExperience: totalExp
      });
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  // Photo Select trigger
  const handlePhotoFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, areaPixels) => setCroppedAreaPixels(areaPixels), []);

  const handleCropConfirm = async () => {
    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels);
      setShowCropModal(false);

      const formData = new FormData();
      formData.append('photo', blob, 'profile.jpg');
      setSaving(true);
      const { data } = await api.post(`/users/${user._id}/photo`, formData);
      setProfilePhoto(data.photoPath);
      setSuccessMsg('Profile photo updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchProfile();
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Photo upload failed.');
    } finally {
      setSaving(false);
    }
  };

  // Upload Resume (PDF and DOCX)
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      alert('Only PDF or Word (.docx) format is accepted for resume.');
      return;
    }
    const formData = new FormData();
    formData.append('resume', file);
    try {
      setSaving(true);
      const { data } = await api.post(`/users/${user._id}/resume`, formData);
      setResumeUrl(data.resumePath);
      setSuccessMsg('Resume uploaded successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchProfile();
    } catch (err) {
      console.error('Error uploading resume:', err);
      alert(err.response?.data?.message || 'Resume upload failed.');
    } finally {
      setSaving(false);
    }
  };

  // Password reset submit
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      await api.put(`/users/${user._id}/change-password`, {
        currentPassword,
        newPassword
      });
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setActionLoading(false);
    }
  };

  const computedExperience = calcTotalExperience(previousCompanies);

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-gold" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <Header title="My Profile Settings" />

        {/* Change password action bar */}
        <div className="flex justify-between items-center mb-8 bg-white px-5 py-3 rounded-2xl shadow-card border border-navy border-opacity-5">
          <p className="text-navy text-opacity-50 text-sm">Review your joining details and manage employment record information.</p>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="btn-secondary py-2 text-xs flex items-center gap-1.5"
          >
            <Key size={14} /> Security Controls
          </button>
        </div>

        <form onSubmit={handleSubmitProfile} className="space-y-8 text-left">
          
          {/* ─── Grid: Read-Only HR Data vs Editable Personal info ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Card: HR Record (Read-Only) */}
            <div className="card space-y-4">
              <h3 className="font-heading text-navy text-xl font-bold pb-2 border-b border-navy border-opacity-5 flex items-center gap-2">
                <Briefcase size={20} className="text-gold" /> Operations Placement
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Employee ID</p>
                  <span className="inline-block mt-1 bg-gold-soft bg-opacity-20 text-navy font-bold px-2.5 py-0.5 rounded-full border border-gold border-opacity-15">
                    {userRecord?.employeeId || 'N/A'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">CTC (Annual)</p>
                  <p className="text-navy font-bold text-sm mt-1 flex items-center gap-0.5">
                    <IndianRupee size={12} className="text-navy/50" />
                    {userRecord?.salary ? userRecord.salary.toLocaleString('en-IN') : '0'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">First Name</p>
                  <p className="text-navy font-semibold text-sm mt-1">{userRecord?.firstName || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Middle Name</p>
                  <p className="text-navy font-semibold text-sm mt-1">{userRecord?.middleName || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Last Name</p>
                  <p className="text-navy font-semibold text-sm mt-1">{userRecord?.lastName || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Date of Birth</p>
                  <p className="text-navy font-semibold text-sm mt-1">
                    {userRecord?.dateOfBirth ? new Date(userRecord.dateOfBirth).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Designation</p>
                  <p className="text-navy font-bold text-sm mt-1">{userRecord?.designation || 'Team Member'}</p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Department</p>
                  <span className={`mt-1.5 inline-block ${userRecord?.department === 'IT' ? 'badge-it' : 'badge-non-it'}`}>
                    {userRecord?.department || 'IT'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Company Email</p>
                  <p className="text-navy font-semibold text-sm mt-1">{userRecord?.companyEmail}</p>
                </div>
                <div>
                  <p className="font-semibold text-navy text-opacity-40 uppercase tracking-wider">Joining Date</p>
                  <p className="text-navy font-semibold text-sm mt-1">
                    {userRecord?.joiningDate ? new Date(userRecord.joiningDate).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Editable Contact Details */}
            <div className="card space-y-4">
              <h3 className="font-heading text-navy text-xl font-bold pb-2 border-b border-navy border-opacity-5 flex items-center gap-2">
                <User size={20} className="text-gold" /> Personal & Contacts
              </h3>

              {/* Profile Photo upload with rounded, adjustable layout */}
              <div className="flex items-center gap-4 pb-4 border-b border-navy border-opacity-5">
                <div className="relative w-16 h-16 rounded-full bg-cream border border-navy border-opacity-15 flex items-center justify-center overflow-hidden group">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-navy text-opacity-35" />
                  )}
                  <label className="absolute inset-0 bg-navy bg-opacity-65 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-[9px] text-white font-bold uppercase tracking-wider text-center">Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoFileSelect}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-xs font-bold text-navy">Profile Picture</p>
                  <p className="text-[10px] text-navy text-opacity-40 mt-0.5">Click photo to upload a local file.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-[10px]">Personal Email</label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={e => setPersonalEmail(e.target.value)}
                    className="input text-xs"
                    placeholder="Enter private email address..."
                  />
                </div>
                <div>
                  <label className="label text-[10px]">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="input text-xs"
                    placeholder="Enter phone digits..."
                  />
                </div>
                <div>
                  <label className="label text-[10px]">Alternate Phone</label>
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={e => setAlternatePhone(e.target.value)}
                    className="input text-xs"
                    placeholder="Enter emergency number..."
                  />
                </div>
                <div>
                  <label className="label text-[10px]">Gender *</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer Not To Say">Prefer Not To Say</option>
                  </select>
                </div>

                {/* Resume Upload Section */}
                <div className="md:col-span-2 border-t border-navy border-opacity-5 pt-4">
                  <label className="label text-[10px] font-bold text-navy flex items-center gap-1">
                    <FileText size={12} className="text-gold" /> Resume (PDF or DOCX)
                  </label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="btn-secondary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1">
                      <Plus size={14} /> Upload Resume
                      <input
                        type="file"
                        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleResumeUpload}
                      />
                    </label>
                    {resumeUrl ? (
                      <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gold font-semibold hover:underline flex items-center gap-1"
                      >
                        View Current Resume
                      </a>
                    ) : (
                      <span className="text-xs text-navy text-opacity-40 italic">No resume uploaded</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* ─── Card: Address Info ────────────────────────────────── */}
          <div className="card space-y-4">
            <h3 className="font-heading text-navy text-xl font-bold pb-2 border-b border-navy border-opacity-5 flex items-center gap-2">
              <MapPin size={20} className="text-gold" /> Primary Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="label text-[10px]">Street / Suite</label>
                <input
                  type="text"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  className="input text-xs"
                  placeholder="Enter house no., street..."
                />
              </div>
              <div>
                <label className="label text-[10px]">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="input text-xs"
                  placeholder="Enter city..."
                />
              </div>
              <div>
                <label className="label text-[10px]">State</label>
                <select
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">Select State</option>
                  {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-[10px]">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                  className="input text-xs"
                  placeholder="Pin..."
                />
              </div>
            </div>
          </div>

          {/* ─── Card: Experience History (Dynamic Form) ───────────── */}
          <div className="card space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-navy border-opacity-5">
              <h3 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                <Briefcase size={20} className="text-gold" /> Previous Work Experience
              </h3>
              
              <div className="flex items-center gap-4">
                <select
                  value={experienceType}
                  onChange={e => setExperienceType(e.target.value)}
                  className="input text-xs max-w-[150px] py-1 shadow-sm font-semibold"
                >
                  <option value="fresher">Fresher</option>
                  <option value="experienced">Experienced</option>
                </select>
                
                {experienceType === 'experienced' && (
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    className="btn-gold py-1.5 px-3 text-xs flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Company
                  </button>
                )}
              </div>
            </div>

            {experienceType === 'fresher' ? (
              <p className="text-xs text-navy text-opacity-40 italic py-4">No previous company history required for freshers.</p>
            ) : (
              <div className="space-y-6">
                
                {/* Dynamically calculated badge */}
                {(computedExperience.years > 0 || computedExperience.months > 0) && (
                  <div className="inline-flex items-center gap-1.5 bg-gold-soft bg-opacity-20 text-navy font-bold text-xs px-3.5 py-1.5 rounded-xl border border-gold border-opacity-15">
                    <Sparkles size={12} className="text-gold" /> Calculated Total Experience: {computedExperience.years} Years {computedExperience.months} Months
                  </div>
                )}

                {previousCompanies.length === 0 ? (
                  <p className="text-xs text-navy text-opacity-40 italic py-4">No company rows added. Click "Add Company" to include records.</p>
                ) : (
                  previousCompanies.map((company, index) => (
                    <CompanyBlock
                      key={index}
                      company={company}
                      idx={index}
                      isFirst={index === 0}
                      totalCompanies={previousCompanies.length}
                      onChange={(field, val) => handleCompanyChange(index, field, val)}
                      onRemove={() => handleRemoveCompany(index)}
                    />
                  ))
                )}

              </div>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-gold py-2 px-6 flex items-center gap-2 text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Profile Changes
            </button>

            <AnimatePresence>
              {successMsg && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-success font-semibold text-sm flex items-center gap-1"
                >
                  <CheckCircle2 size={16} /> {successMsg}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

        </form>

        {/* ─── Security Change Password Popover ─────────────────── */}
        <AnimatePresence>
          {showPasswordModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPasswordModal(false)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-sm relative z-50"
              >
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Key className="text-gold" size={18} /> Update Password
                  </h2>
                  <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4 text-left">
                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 text-error rounded-xl p-3 text-xs flex items-center gap-1.5 font-semibold">
                      <ShieldAlert size={14} /> {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-green-50 border border-green-200 text-success rounded-xl p-3 text-xs flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 size={14} /> {passwordSuccess}
                    </div>
                  )}

                  <div>
                    <label className="label text-[10px]">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-[10px]">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-[10px]">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-navy border-opacity-10">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-gold flex-grow py-2 text-sm flex items-center justify-center gap-1.5"
                    >
                      Update Password
                    </button>
                    <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-grow py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── Profile Photo Cropping Modal ───────────────────── */}
        <AnimatePresence>
          {showCropModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowCropModal(false);
                  setRawImageSrc(null);
                }}
                className="fixed inset-0 bg-navy"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-md relative z-50"
              >
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-navy/10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Crop className="text-gold" size={18} /> Crop Profile Photo
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCropModal(false);
                      setRawImageSrc(null);
                    }}
                    className="p-2 hover:bg-cream rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="relative w-full h-64 bg-navy/5 rounded-xl overflow-hidden mb-4">
                  <Cropper
                    image={rawImageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <ZoomIn size={16} className="text-navy/50" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-gold"
                    />
                    <ZoomOut size={16} className="text-navy/50" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-navy/10">
                  <button
                    type="button"
                    onClick={handleCropConfirm}
                    disabled={saving}
                    className="btn-gold flex-grow py-2 text-sm flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Apply & Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCropModal(false);
                      setRawImageSrc(null);
                    }}
                    className="btn-secondary flex-grow py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
