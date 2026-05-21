const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const previousCompanySchema = new mongoose.Schema({
  companyName:      { type: String, required: true },
  roleTitle:        { type: String, required: true },
  employmentType:   { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'], default: 'Full-time' },
  address:          { type: String },
  fromDate:         { type: Date },
  toDate:           { type: Date },
  isCurrentJob:     { type: Boolean, default: false },
  durationYears:    { type: Number, default: 0 },
  durationMonths:   { type: Number, default: 0 },
  lastDrawnSalary:  { type: Number }, // HR-ONLY — sanitized out of all employee-facing responses
  yearsWorked:      { type: Number, default: 0 },
  location:         { type: String },
  reasonForLeaving: { type: String },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // ── Identity ─────────────────────────────────────────────────────
  employeeId:       { type: String, unique: true, sparse: true, trim: true }, // e.g. TIS_001
  firstName:        { type: String, trim: true },
  middleName:       { type: String, trim: true, default: '' },
  lastName:         { type: String, trim: true },
  fullName:         { type: String, required: true, trim: true }, // auto-composed: firstName + lastName
  gender:           { type: String, enum: ['Male', 'Female', 'Prefer Not To Say'], default: 'Prefer Not To Say' },
  dateOfBirth:      { type: Date },

  // ── Contact ───────────────────────────────────────────────────────
  personalEmail:    { type: String, trim: true, lowercase: true },
  companyEmail:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:         { type: String, required: true, minlength: 6 },
  phone:            { type: String, trim: true },
  alternatePhone:   { type: String, trim: true },
  address: {
    street:  { type: String },
    city:    { type: String },
    state:   { type: String },
    pincode: { type: String },
  },

  // ── Media ─────────────────────────────────────────────────────────
  profilePhoto:     { type: String, default: '' }, // file path
  resumeUrl:        { type: String, default: '' },
  resumeFilename:   { type: String, default: '' }, // original filename

  // ── Company ───────────────────────────────────────────────────────
  role:             { type: String, enum: ['hr', 'employee'], required: true },
  designation:      { type: String, trim: true },
  department:       { type: String, enum: ['IT', 'Non-IT', 'Management', 'Operations'], default: 'IT' },
  joiningDate:      { type: Date },
  salary:           { type: Number, default: 0 }, // CTC Annual

  // ── Experience ────────────────────────────────────────────────────
  experienceType:   { type: String, enum: ['fresher', 'experienced'], default: 'fresher' },
  previousCompanies: [previousCompanySchema],
  totalExperience: {
    years:  { type: Number, default: 0 },
    months: { type: Number, default: 0 },
  },

  // ── Status ────────────────────────────────────────────────────────
  isActive:         { type: Boolean, default: true },
  lastSeen:         { type: Date, default: Date.now },
}, { timestamps: true });

// ── Auto-compose fullName from firstName + lastName ────────────────
userSchema.pre('save', function (next) {
  if (this.firstName || this.lastName) {
    const parts = [this.firstName, this.middleName, this.lastName].filter(Boolean);
    this.fullName = parts.join(' ');
  }
  next();
});

// ── Hash password before saving ────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Compare passwords ─────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Never send password in JSON ───────────────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
