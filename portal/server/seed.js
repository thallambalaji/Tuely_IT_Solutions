require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const SEED_DATA = [
  {
    fullName: 'Teuly HR Admin',
    companyEmail: 'hr@teulyitsolutions.com',
    password: 'TeulyHR@2025',
    role: 'hr',
    designation: 'HR Manager',
    department: 'Management',
    joiningDate: new Date('2019-01-01'),
    experienceType: 'experienced',
    isActive: true,
  },
  {
    fullName: 'Teuly Employee',
    companyEmail: 'employee@teulyitsolutions.com',
    password: 'TeulyEmp@2025',
    role: 'employee',
    designation: 'Software Engineer',
    department: 'IT',
    joiningDate: new Date('2023-06-01'),
    experienceType: 'fresher',
    isActive: true,
  },
];

const seed = async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set. Add it to .env before running the seed script.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  for (const data of SEED_DATA) {
    const existing = await User.findOne({ companyEmail: data.companyEmail });
    if (existing) {
      console.log(`⚠️  User already exists: ${data.companyEmail}`);
      continue;
    }
    const user = new User(data); // pre-save hook hashes password
    await user.save();
    console.log(`✅ Created: ${data.fullName} (${data.role}) — ${data.companyEmail}`);
  }

  console.log('\n🔐 Phase 1 Test Credentials:');
  console.log('   HR:       hr@teulyitsolutions.com    / TeulyHR@2025');
  console.log('   Employee: employee@teulyitsolutions.com / TeulyEmp@2025\n');

  await mongoose.connection.close();
  console.log('✅ Seed complete. DB connection closed.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
