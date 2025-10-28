const mongoose = require('mongoose');
const User = require('../models/User');
const Rating = require('../models/Rating');
require('dotenv').config();

const sampleWorkers = [
  {
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria.santos@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2', // password123
    mobileNo: '09171234501',
    userType: 'employee',
    barangay: 'Barangay 1',
    city: 'Quezon City',
    province: 'Metro Manila',
    skills: ['Carpentry', 'Masonry', 'Painting'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3401',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan.delacruz@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234502',
    userType: 'employee',
    barangay: 'Barangay 2',
    city: 'Makati',
    province: 'Metro Manila',
    skills: ['Plumbing', 'Electrical Work', 'AC Repair'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3402',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Ana',
    lastName: 'Reyes',
    email: 'ana.reyes@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234503',
    userType: 'employee',
    barangay: 'Barangay 3',
    city: 'Pasig',
    province: 'Metro Manila',
    skills: ['Housekeeping', 'Cooking', 'Laundry'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3403',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Pedro',
    lastName: 'Garcia',
    email: 'pedro.garcia@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234504',
    userType: 'employee',
    barangay: 'Barangay 4',
    city: 'Mandaluyong',
    province: 'Metro Manila',
    skills: ['Gardening', 'Landscaping', 'Tree Trimming'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3404',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Rosa',
    lastName: 'Flores',
    email: 'rosa.flores@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234505',
    userType: 'employee',
    barangay: 'Barangay 5',
    city: 'Taguig',
    province: 'Metro Manila',
    skills: ['Sewing', 'Tailoring', 'Alterations'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3405',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Jose',
    lastName: 'Mendoza',
    email: 'jose.mendoza@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234506',
    userType: 'employee',
    barangay: 'Barangay 6',
    city: 'Parañaque',
    province: 'Metro Manila',
    skills: ['Welding', 'Metal Fabrication', 'Auto Repair'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3406',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Carmen',
    lastName: 'Torres',
    email: 'carmen.torres@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234507',
    userType: 'employee',
    barangay: 'Barangay 7',
    city: 'Las Piñas',
    province: 'Metro Manila',
    skills: ['Hairdressing', 'Manicure', 'Pedicure'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3407',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Roberto',
    lastName: 'Cruz',
    email: 'roberto.cruz@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234508',
    userType: 'employee',
    barangay: 'Barangay 8',
    city: 'Muntinlupa',
    province: 'Metro Manila',
    skills: ['Driving', 'Delivery', 'Logistics'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3408',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Luz',
    lastName: 'Ramos',
    email: 'luz.ramos@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234509',
    userType: 'employee',
    barangay: 'Barangay 9',
    city: 'Pasay',
    province: 'Metro Manila',
    skills: ['Childcare', 'Tutoring', 'Elderly Care'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3409',
    profilePicture: null,
    isVerified: true
  },
  {
    firstName: 'Miguel',
    lastName: 'Aquino',
    email: 'miguel.aquino@example.com',
    password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
    mobileNo: '09171234510',
    userType: 'employee',
    barangay: 'Barangay 10',
    city: 'Manila',
    province: 'Metro Manila',
    skills: ['Computer Repair', 'Network Setup', 'IT Support'],
    idType: 'National ID',
    idNumber: '1234-5678-9012-3410',
    profilePicture: null,
    isVerified: true
  }
];

async function createSampleWorkers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing sample workers
    await User.deleteMany({ email: { $in: sampleWorkers.map(w => w.email) } });
    console.log('Cleared existing sample workers');
    
    // Create workers
    const createdWorkers = await User.insertMany(sampleWorkers);
    console.log(`Created ${createdWorkers.length} workers`);
    
    // Create a dummy rater (employer)
    let rater = await User.findOne({ email: 'employer@example.com' });
    if (!rater) {
      rater = await User.create({
        firstName: 'Test',
        lastName: 'Employer',
        email: 'employer@example.com',
        password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36YQBbfCm2j.Q3P0XKhGAc2',
        mobileNo: '09171234500',
        userType: 'employer',
        barangay: 'Barangay Test',
        city: 'Manila',
        province: 'Metro Manila',
        idType: 'National ID',
        idNumber: '1234-5678-9012-3400',
        isVerified: true
      });
      console.log('Created test employer');
    }
    
    // Clear existing ratings for these workers
    await Rating.deleteMany({ ratee: { $in: createdWorkers.map(w => w._id) } });
    console.log('Cleared existing ratings');
    
    // Create ratings for each worker
    const ratings = [];
    createdWorkers.forEach((worker, index) => {
      // Each worker gets 3-8 ratings with varying scores (4.0-5.0)
      const numRatings = Math.floor(Math.random() * 6) + 3; // 3-8 ratings
      
      for (let i = 0; i < numRatings; i++) {
        const rating = 4.0 + Math.random() * 1.0; // 4.0-5.0
        ratings.push({
          rater: rater._id,
          ratee: worker._id,
          rating: Math.round(rating * 10) / 10, // Round to 1 decimal
          comment: `Great worker! Very professional and skilled in ${worker.skills[0]}.`,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
        });
      }
    });
    
    await Rating.insertMany(ratings);
    console.log(`Created ${ratings.length} ratings`);
    
    // Update worker stats
    for (const worker of createdWorkers) {
      const workerRatings = ratings.filter(r => r.ratee.toString() === worker._id.toString());
      const avgRating = workerRatings.reduce((sum, r) => sum + r.rating, 0) / workerRatings.length;
      
      await User.findByIdAndUpdate(worker._id, {
        averageRating: Math.round(avgRating * 10) / 10,
        totalRatings: workerRatings.length,
        completedJobs: Math.floor(Math.random() * 20) + 5 // 5-24 completed jobs
      });
    }
    
    console.log('Updated worker stats');
    console.log('\n✅ Sample workers created successfully!');
    console.log('\nYou can now log in with:');
    console.log('- Email: maria.santos@example.com (or any worker email)');
    console.log('- Password: password123');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error creating sample workers:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

createSampleWorkers();
