const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const previousCompanySchema = new mongoose.Schema({
  companyName:      { type: String, required: true },
  roleTitle:        { type: String, required: true },
  employmentType:   { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'], required: true },
  fromDate:         { type: Date, required: true },
  toDate:           { type: Date },
  isCurrentJob:     { type: Boolean, default: false },
  lastDrawnSalary:  { type: Number }, // HR-ONLY — sanitized out of all employee-facing responses
  reasonForLeaving: { type: String },
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName:         { type: String, required: true, trim: true },
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
  profilePhoto:     { type: String, default: '' }, // file path
  role:             { type: String, enum: ['hr', 'employee'], required: true },
  designation:      { type: String, trim: true },
  department:       { type: String, enum: ['IT', 'Non-IT', 'Management', 'Operations'], default: 'IT' },
  joiningDate:      { type: Date },
  experienceType:   { type: String, enum: ['fresher', 'experienced'], default: 'fresher' },
  previousCompanies: [previousCompanySchema],
  totalExperience: {
    years:  { type: Number, default: 0 },
    months: { type: Number, default: 0 },
  },
  isActive:         { type: Boolean, default: true },
  lastSeen:         { type: Date, default: Date.now },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never send password in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
