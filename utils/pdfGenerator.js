// --- Analytics PDF Generation ---
function generateAnalyticsReport(analytics, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const filename = `analytics-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Add logo and header
      addReportHeader(doc, 'ANALYTICS REPORT');

      // Add generation date
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, 50, doc.y, { align: 'right' });
      doc.moveDown(0.5);

      // Add filter information if any
      if (filters && Object.keys(filters).length > 0) {
        addFilterSection(doc, filters);
      }

      // Helper function for section dividers
      function sectionDivider() {
        doc.moveDown(0.8);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#2b6cb0').lineWidth(2).stroke();
        doc.moveDown(1);
      }

      // Helper function for subsection headers
      function subsectionHeader(title) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#2b6cb0').text(title, { align: 'left' });
        doc.moveDown(0.3);
      }

      // === KEY PERFORMANCE INDICATORS ===
      sectionDivider();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('KEY PERFORMANCE INDICATORS', { align: 'left' });
      doc.moveDown(0.5);
      
      if (analytics) {
        const kpis = [
          { label: 'Total Users', value: analytics.totalUsers || 0 },
          { label: 'Total Jobs', value: analytics.totalJobs || 0 },
          { label: 'Total Ratings', value: analytics.totalRatings || 0 },
          { label: 'Total Reports', value: analytics.totalReports || 0 },
        ];
        
        const startX = 70, startY = doc.y, colW = 110, rowH = 45;
        kpis.forEach((kpi, i) => {
          // Card background
          doc.rect(startX + i * colW, startY, colW - 5, rowH).fillAndStroke('#f0f7ff', '#2b6cb0');
          
          // Label
          doc.font('Helvetica').fontSize(9).fillColor('#555').text(kpi.label, startX + i * colW + 8, startY + 12, { width: colW - 16, align: 'center' });
          
          // Value
          doc.font('Helvetica-Bold').fontSize(16).fillColor('#2b6cb0').text(kpi.value.toLocaleString(), startX + i * colW + 8, startY + 25, { width: colW - 16, align: 'center' });
        });
        doc.y = startY + rowH + 15;
      }

      // === USER ANALYTICS ===
      sectionDivider();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('USER ANALYTICS', { align: 'left' });
      doc.moveDown(0.8);

      // User Type Distribution
      if (analytics?.userDistribution) {
        subsectionHeader('User Type Distribution');
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        
        const dist = analytics.userDistribution;
        const userTypes = [
          { label: 'Employees', count: dist.employee || 0, percent: dist.employeePercentage || 0, color: '#3b82f6' },
          { label: 'Employers', count: dist.employer || 0, percent: dist.employerPercentage || 0, color: '#10b981' },
          { label: 'Both', count: dist.both || 0, percent: dist.bothPercentage || 0, color: '#f59e0b' }
        ];

        let startX = 70;
        userTypes.forEach((type, i) => {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(type.color);
          doc.text(`${type.label}:`, startX + i * 150, doc.y, { continued: true });
          doc.font('Helvetica').fillColor('#333');
          doc.text(` ${type.count.toLocaleString()} (${type.percent}%)`);
        });
        doc.moveDown(1);
      }

      // Gender Distribution
      if (analytics?.genderDistribution) {
        subsectionHeader('Gender Distribution');
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        
        const gender = analytics.genderDistribution;
        const total = analytics.totalUsers || 1;
        const genders = [
          { label: 'Male', count: gender.male || 0 },
          { label: 'Female', count: gender.female || 0 },
          { label: 'Others', count: gender.others || 0 },
          { label: 'Not Specified', count: gender.notSpecified || 0 }
        ];

        genders.forEach((g, i) => {
          const percent = total > 0 ? Math.round((g.count / total) * 100) : 0;
          doc.fontSize(10).font('Helvetica');
          doc.text(`${g.label}:`, 70 + (i % 2) * 250, doc.y, { continued: true });
          doc.font('Helvetica-Bold').text(` ${g.count.toLocaleString()} (${percent}%)`);
          if (i % 2 === 1) doc.moveDown(0.3);
        });
        doc.moveDown(1.2);
      }

      // Verified Users
      if (analytics?.verifiedUsers) {
        subsectionHeader('User Verification Status');
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        
        const verified = analytics.verifiedUsers;
        doc.text('Verified Users:', 70, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#10b981').text(` ${verified.count?.toLocaleString() || 0} (${verified.percentage || 0}%)`);
        
        const unverified = (analytics.totalUsers || 0) - (verified.count || 0);
        const unverifiedPercent = 100 - (verified.percentage || 0);
        doc.font('Helvetica').fillColor('#333');
        doc.text('Unverified Users:', 70, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#ef4444').text(` ${unverified.toLocaleString()} (${unverifiedPercent}%)`);
        doc.moveDown(1);
      }

      // === JOB ANALYTICS ===
      sectionDivider();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('JOB ANALYTICS', { align: 'left' });
      doc.moveDown(0.8);

      // Job Statistics
      if (analytics?.jobStats) {
        subsectionHeader('Job Statistics');
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        
        const js = analytics.jobStats;
        doc.text('Active Jobs:', 70, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#3b82f6').text(` ${js.active?.toLocaleString() || 0}`);
        
        doc.font('Helvetica').fillColor('#333');
        doc.text('Completed Jobs:', 300, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#10b981').text(` ${js.completed?.toLocaleString() || 0}`);
        doc.moveDown(0.5);
        
        doc.font('Helvetica').fillColor('#333');
        doc.text('Total Value:', 70, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#059669').text(` PHP ${js.totalValue?.toLocaleString() || 0}`);
        
        doc.font('Helvetica').fillColor('#333');
        doc.text('Average Price:', 300, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#059669').text(` PHP ${js.averagePrice?.toLocaleString() || 0}`);
        doc.moveDown(1.5);
      }

      // Popular Jobs
      if (analytics?.popularJobs && analytics.popularJobs.length > 0) {
        subsectionHeader('Top 5 Popular Jobs (By Applicants)');
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        
        analytics.popularJobs.forEach((job, i) => {
          doc.font('Helvetica-Bold').text(`${i + 1}. ${job.title || 'Untitled'}`, 70, doc.y);
          doc.font('Helvetica').fontSize(9).fillColor('#666');
          doc.text(`   Location: ${job.barangay || 'N/A'} | Price: P${job.price?.toLocaleString() || 0} | Applicants: ${job.applicantCount}`, 70, doc.y);
          doc.fontSize(10).fillColor('#333');
          doc.moveDown(0.3);
        });
        doc.moveDown(0.8);
      }

      // === LOCATION ANALYTICS ===
      sectionDivider();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('LOCATION ANALYTICS', { align: 'left' });
      doc.moveDown(0.8);

      // Popular Barangays
      if (analytics?.popularBarangays && analytics.popularBarangays.length > 0) {
        subsectionHeader('Top 5 Popular Barangays');
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        
        analytics.popularBarangays.forEach((item, i) => {
          doc.text(`${i + 1}. ${item.barangay || 'N/A'}:`, 70, doc.y, { continued: true });
          doc.font('Helvetica-Bold').text(` ${item.count} jobs`);
          doc.font('Helvetica');
        });
        doc.moveDown(1.5);
      }

      // === SKILLS ANALYTICS ===
      sectionDivider();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('SKILLS ANALYTICS', { align: 'left' });
      doc.moveDown(0.8);

      // Popular Skills
      if (analytics?.popularSkills && analytics.popularSkills.length > 0) {
        subsectionHeader('Top 10 In-Demand Skills');
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        
        // Display in 2 columns
        analytics.popularSkills.forEach((skill, i) => {
          const xPos = i % 2 === 0 ? 70 : 320;
          const yPos = doc.y;
          
          doc.text(`${i + 1}. ${skill.skill}:`, xPos, yPos, { continued: true });
          doc.font('Helvetica-Bold').text(` ${skill.count} users`);
          doc.font('Helvetica');
          
          if (i % 2 === 1 || i === analytics.popularSkills.length - 1) {
            doc.moveDown(0.3);
          }
        });
        doc.moveDown(1);
      }

      // === RECENT ACTIVITY ===
      if (analytics?.recentActivity && analytics.recentActivity.length > 0) {
        sectionDivider();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('RECENT ACTIVITY', { align: 'left' });
        doc.moveDown(0.8);
        
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        analytics.recentActivity.slice(0, 8).forEach((activity, i) => {
          const date = new Date(activity.createdAt).toLocaleDateString();
          const time = new Date(activity.createdAt).toLocaleTimeString();
          const typeIcon = activity.type === 'user' ? '[User]' : '[Job]';
          doc.text(`${typeIcon} ${activity.description}`, 70, doc.y);
          doc.fontSize(9).fillColor('#666').text(`  ${date} at ${time}`, 70, doc.y);
          doc.fontSize(10).fillColor('#333');
          doc.moveDown(0.2);
        });
      }

      // Add footer
      addReportFooter(doc);

      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateUserReport(users, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      console.log('generateUserReport: Starting with', users.length, 'users');
      
      // Safety check - limit to reasonable number of users
      if (users.length > 100) {
        console.warn('WARNING: Attempting to generate PDF with', users.length, 'users. Limiting to first 100.');
        users = users.slice(0, 100);
      }
      
      const doc = new PDFDocument({ 
        margin: 50,
        bufferPages: true,
        compress: true  // Enable compression
      });
      const filename = `user-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      console.log('generateUserReport: Adding header...');
      // Add logo and header
      addReportHeader(doc, 'USER MANAGEMENT REPORT');
      
      // Add filter information
      addFilterSection(doc, filters);
      
      // Summary statistics
      addSummarySection(doc, users, 'Users');
      
      console.log('generateUserReport: Adding user table...');
      // User details table (with image links)
      addUserTable(doc, users);
      
      console.log('generateUserReport: Adding footer...');
      // Add footer
      addReportFooter(doc);
      
      console.log('generateUserReport: Ending document...');
      doc.end();
      
      stream.on('finish', () => {
        console.log('generateUserReport: PDF finished writing to', filepath);
        resolve(filepath);
      });
      
      stream.on('error', (err) => {
        console.error('generateUserReport: Stream error:', err);
        reject(err);
      });
      
    } catch (error) {
      console.error('generateUserReport: Caught error:', error);
      reject(error);
    }
  });
}

function generateJobReport(jobs, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      console.log('generateJobReport: Starting with', jobs.length, 'jobs');
      const doc = new PDFDocument({ margin: 50 });
      const filename = `job-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      console.log('generateJobReport: Adding header...');
      // Add logo and header
      addReportHeader(doc, 'JOB MANAGEMENT REPORT');
      
      // Add filter information
      addFilterSection(doc, filters);
      
      // Summary statistics
      addSummarySection(doc, jobs, 'Jobs');
      
      console.log('generateJobReport: Adding job table...');
      // Job details table (with image links and payment proof)
      addJobTable(doc, jobs);
      
      console.log('generateJobReport: Adding footer...');
      // Add footer
      addReportFooter(doc);
      
      console.log('generateJobReport: Ending document...');
      doc.end();
      
      stream.on('finish', () => {
        console.log('generateJobReport: PDF finished writing to', filepath);
        resolve(filepath);
      });
      
      stream.on('error', (err) => {
        console.error('generateJobReport: Stream error:', err);
        reject(err);
      });
      
    } catch (error) {
      console.error('generateJobReport: Caught error:', error);
      reject(error);
    }
  });
}function generateCustomReport(data, title, fields, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `custom-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);
      
      // Add logo and header
      addReportHeader(doc, title);
      
      // Add filter information
      addFilterSection(doc, filters);
      
      // Summary statistics
      addSummarySection(doc, data, 'Records');
      
      // Custom table
      addCustomTable(doc, data, fields);
      
      // Add footer
      addReportFooter(doc);
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(filepath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

function addReportHeader(doc, title) {
  // Try to add logo, but skip if not found
  try {
    const logoPath = path.join(__dirname, 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 50 }).fillColor('#444444');
    }
  } catch (err) {
    // Logo not found or error reading, skip logo
  }

  // Company info
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#2b6cb0').text('ResiLinked', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').fillColor('#444').text('123 Main Street, Barangay 1, City, Philippines 1000', { align: 'center' });
  doc.moveDown(0.5);
  // Report title
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#222').text(title, { align: 'center', underline: true });
  doc.moveDown(0.5);
  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#2b6cb0').stroke();
  doc.moveDown(1.2);
  doc.fillColor('#000');
}

function addFilterSection(doc, filters) {
  if (Object.keys(filters).length === 0) return;
  
  doc.y = 150;
  doc.fontSize(12).font('Helvetica-Bold').text('APPLIED FILTERS:', 50, doc.y);
  doc.y += 20;
  
  doc.font('Helvetica');
  let filterText = '';
  
  if (filters.search) filterText += `Search: ${filters.search}\n`;
  if (filters.userType) filterText += `User Type: ${filters.userType}\n`;
  if (filters.barangay) filterText += `Barangay: ${filters.barangay}\n`;
  if (filters.verified !== undefined) filterText += `Verified: ${filters.verified ? 'Yes' : 'No'}\n`;
  if (filters.status) filterText += `Status: ${filters.status}\n`;
  if (filters.minPrice) filterText += `Min Price: PHP ${filters.minPrice}\n`;
  if (filters.maxPrice) filterText += `Max Price: PHP ${filters.maxPrice}\n`;
  if (filters.minRating) filterText += `Min Rating: ${filters.minRating} stars\n`;
  if (filters.maxRating) filterText += `Max Rating: ${filters.maxRating} stars\n`;
  if (filters.startDate) filterText += `Start Date: ${new Date(filters.startDate).toLocaleDateString()}\n`;
  if (filters.endDate) filterText += `End Date: ${new Date(filters.endDate).toLocaleDateString()}\n`;
  
  doc.fontSize(10).text(filterText, 50, doc.y);
  doc.y += filterText.split('\n').length * 15 + 10;
  
  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.y += 20;
}

function addSummarySection(doc, data, dataType) {
  doc.fontSize(12).font('Helvetica-Bold').text('SUMMARY STATISTICS:', 50, doc.y);
  doc.y += 20;
  
  let summaryText = '';
  
  if (dataType === 'Users') {
    const total = data.length;
    const verified = data.filter(u => u.isVerified).length;
    const employees = data.filter(u => u.userType === 'employee').length;
    const employers = data.filter(u => u.userType === 'employer').length;
    const both = data.filter(u => u.userType === 'both').length;
    
    summaryText = `Total ${dataType}: ${total}\n` +
                 `Verified: ${verified} (${total > 0 ? Math.round((verified / total) * 100) : 0}%)\n` +
                 `Employees: ${employees}\n` +
                 `Employers: ${employers}\n` +
                 `Both: ${both}`;
  } else if (dataType === 'Jobs') {
    const total = data.length;
    const open = data.filter(j => j.isOpen === true).length;
    const closed = data.filter(j => j.isOpen === false && !j.isCompleted && !j.completed).length;
    const completed = data.filter(j => j.isCompleted === true || j.completed === true).length;
    const withWorker = data.filter(j => j.assignedTo).length;
    
    summaryText = `Total ${dataType}: ${total}\n` +
                 `Open: ${open}\n` +
                 `Closed: ${closed}\n` +
                 `Completed: ${completed}\n` +
                 `With Assigned Worker: ${withWorker}`;
  } else {
    summaryText = `Total ${dataType}: ${data.length}`;
  }
  
  doc.font('Helvetica').fontSize(10).text(summaryText, 50, doc.y);
  doc.y += summaryText.split('\n').length * 15 + 20;
}

function addUserTable(doc, users) {
  console.log('addUserTable: Processing', users.length, 'users');
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('USER PROFILES', 50, doc.y);
  doc.moveDown(1);
  
  users.forEach((user, index) => {
    if (index % 10 === 0) {
      console.log(`addUserTable: Processing user ${index + 1}/${users.length}`);
    }
    
    // Check if need new page - fixed card height of 280
    if (doc.y > 500) {
      doc.addPage();
    }
    
    const cardTop = doc.y;
    const cardLeft = 50;
    const cardWidth = 500;
    const cardHeight = 280; // Fixed height for consistency
    
    // Header Section
    doc.rect(cardLeft, cardTop, cardWidth, 35).fillAndStroke('#2b6cb0', '#2b6cb0');
    
    // User name and number in header
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(`${user.firstName} ${user.lastName}`, cardLeft + 15, cardTop + 10);
    doc.fontSize(9).font('Helvetica').fillColor('#e0e0e0');
    doc.text(`User #${index + 1} | ${user.userType.toUpperCase()}`, cardLeft + cardWidth - 150, cardTop + 12);
    
    doc.fillColor('#000');
    let currentY = cardTop + 45;
    
    const infoLeft = cardLeft + 20;
    const lineHeight = 14;
    
    // === PERSONAL INFORMATION ===
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
    doc.text('PERSONAL INFORMATION', cardLeft + 15, currentY);
    currentY += 18;
    
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    
    doc.font('Helvetica-Bold').text('Name:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.firstName} ${user.lastName}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Email:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.email}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Mobile:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.mobileNo || 'N/A'}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Barangay:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.barangay || 'N/A'}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Gender:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.gender || 'N/A'}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Verification:', infoLeft, currentY, { continued: true });
    doc.fillColor(user.isVerified ? '#10b981' : '#ef4444');
    doc.font('Helvetica-Bold').text(` ${user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}`);
    doc.fillColor('#333');
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Joined:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${new Date(user.createdAt).toLocaleDateString()}`);
    currentY += 20;
    
    // === IDENTIFICATION ===
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
    doc.text('IDENTIFICATION', cardLeft + 15, currentY);
    currentY += 18;
    
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    
    doc.font('Helvetica-Bold').text('ID Type:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.idType || 'N/A'}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('ID Number:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${user.idNumber || 'N/A'}`);
    currentY += 18;
    
    // Display image availability
    doc.fontSize(8).font('Helvetica').fillColor('#666');
    const docs = [];
    if (user.profilePicture) docs.push('Profile');
    if (user.idFrontImage) docs.push('ID Front');
    if (user.idBackImage) docs.push('ID Back');
    if (user.barangayClearanceImage) docs.push('Brgy Clearance');
    
    if (docs.length > 0) {
      doc.text('Documents: ' + docs.join(', '), infoLeft, currentY);
      currentY += 15;
    }
    doc.fillColor('#333');
    
    // === SKILLS ===
    if (user.skills && user.skills.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
      doc.text('SKILLS', cardLeft + 15, currentY);
      currentY += 15;
      
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const skillsText = user.skills.slice(0, 5).join(', '); // Limit to 5 skills
      doc.text(skillsText, infoLeft, currentY, { width: 470 });
    }
    
    // Draw card border - fixed height
    doc.rect(cardLeft, cardTop, cardWidth, cardHeight).stroke('#d0d0d0');
    
    // Move to next card position
    doc.y = cardTop + cardHeight + 15;
  });
  
  console.log('addUserTable: Completed processing all users');
}

function addJobTable(doc, jobs) {
  console.log('addJobTable: Processing', jobs.length, 'jobs');
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#2b6cb0').text('JOB LISTINGS', 50, doc.y);
  doc.moveDown(1);
  
  jobs.forEach((job, index) => {
    if (index % 10 === 0) {
      console.log(`addJobTable: Processing job ${index + 1}/${jobs.length}`);
    }
    
    // Check if need new page - fixed card height of 330
    if (doc.y > 460) {
      doc.addPage();
    }
    
    const cardTop = doc.y;
    const cardLeft = 50;
    const cardWidth = 500;
    const cardHeight = 330; // Fixed height for consistency
    
    // Header Section with status color
    const statusColor = job.isCompleted || job.completed ? '#10b981' : job.isOpen ? '#3b82f6' : '#6b7280';
    doc.rect(cardLeft, cardTop, cardWidth, 35).fillAndStroke(statusColor, statusColor);
    
    // Job title in header
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
    const titleText = job.title && job.title.length > 50 ? job.title.substring(0, 50) + '...' : job.title || 'Untitled Job';
    doc.text(titleText, cardLeft + 15, cardTop + 10, { width: 380 });
    doc.fontSize(9).font('Helvetica').fillColor('#e0e0e0');
    const statusText = job.isCompleted || job.completed ? 'COMPLETED' : job.isOpen ? 'OPEN' : 'CLOSED';
    doc.text(statusText, cardLeft + cardWidth - 100, cardTop + 12);
    
    doc.fillColor('#000');
    let currentY = cardTop + 45;
    
    const infoLeft = cardLeft + 20;
    const lineHeight = 14;
    
    // === JOB DETAILS ===
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
    doc.text('JOB DETAILS', cardLeft + 15, currentY);
    currentY += 18;
    
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    
    doc.font('Helvetica-Bold').text('Price:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').fillColor('#10b981');
    doc.text(` PHP ${job.price?.toLocaleString() || '0'}`);
    doc.fillColor('#333');
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Barangay:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${job.barangay || 'N/A'}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Posted:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${new Date(job.datePosted || job.createdAt).toLocaleDateString()}`);
    currentY += lineHeight;
    
    doc.font('Helvetica-Bold').text('Applicants:', infoLeft, currentY, { continued: true });
    doc.font('Helvetica').text(` ${job.applicants?.length || 0}`);
    currentY += 20;
    
    // === DESCRIPTION ===
    if (job.description) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
      doc.text('DESCRIPTION', cardLeft + 15, currentY);
      currentY += 15;
      
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const descText = job.description.length > 180 ? job.description.substring(0, 180) + '...' : job.description;
      doc.text(descText, infoLeft, currentY, { width: 470 });
      currentY += 30; // Fixed space
    }
    
    // === REQUIRED SKILLS ===
    if (job.skillsRequired && job.skillsRequired.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
      doc.text('REQUIRED SKILLS', cardLeft + 15, currentY);
      currentY += 15;
      
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const skillsText = job.skillsRequired.slice(0, 5).join(', '); // Limit to 5 skills
      doc.text(skillsText, infoLeft, currentY, { width: 470 });
      currentY += 20;
    }
    
    // === EMPLOYER ===
    if (job.postedBy) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2b6cb0');
      doc.text('EMPLOYER', cardLeft + 15, currentY);
      currentY += 15;
      
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      doc.text(`${job.postedBy.firstName} ${job.postedBy.lastName} - ${job.postedBy.email}`, infoLeft, currentY);
      currentY += 12;
      doc.text(`Mobile: ${job.postedBy.mobileNo || 'N/A'} | Location: ${job.postedBy.barangay || 'N/A'}`, infoLeft, currentY);
      currentY += 20;
    }
    
    // === ASSIGNED EMPLOYEE ===
    if (job.assignedTo) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#10b981');
      doc.text('ASSIGNED EMPLOYEE', cardLeft + 15, currentY);
      currentY += 15;
      
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      doc.text(`${job.assignedTo.firstName} ${job.assignedTo.lastName} - ${job.assignedTo.email}`, infoLeft, currentY);
      currentY += 12;
      if (job.assignedTo.skills && job.assignedTo.skills.length > 0) {
        doc.text(`Skills: ${job.assignedTo.skills.slice(0, 3).join(', ')}`, infoLeft, currentY);
      }
    }
    
    // Draw card border - fixed height
    doc.rect(cardLeft, cardTop, cardWidth, cardHeight).stroke('#d0d0d0');
    
    // Move to next card position
    doc.y = cardTop + cardHeight + 15;
  });
}

function addCustomTable(doc, data, fields) {
  doc.fontSize(12).font('Helvetica-Bold').text('DETAILS:', 50, doc.y);
  doc.y += 20;
  
  const tableTop = doc.y;
  const leftMargin = 50;
  const colWidth = (500 - leftMargin) / fields.length;
  
  // Table headers
  doc.fontSize(10).font('Helvetica-Bold');
  fields.forEach((field, i) => {
    doc.text(field.label, leftMargin + (i * colWidth), tableTop, {
      width: colWidth,
      align: 'left'
    });
  });
  
  let y = tableTop + 20;
  
  // Horizontal line
  doc.moveTo(leftMargin, y - 5).lineTo(leftMargin + (colWidth * fields.length), y - 5).stroke();
  
  // Table rows
  doc.font('Helvetica');
  data.forEach((item, i) => {
    if (y > 700) { // Add new page if needed
      doc.addPage();
      y = 50;
      // Add headers again on new page
      doc.font('Helvetica-Bold');
      fields.forEach((field, i) => {
        doc.text(field.label, leftMargin + (i * colWidth), y, {
          width: colWidth,
          align: 'left'
        });
      });
      y += 20;
      doc.font('Helvetica');
    }
    
    fields.forEach((field, j) => {
      const value = field.key.split('.').reduce((obj, key) => obj && obj[key], item);
      const displayValue = value !== undefined && value !== null ? value.toString() : 'N/A';
      
      doc.fontSize(8).text(displayValue, leftMargin + (j * colWidth), y, {
        width: colWidth,
        align: 'left'
      });
    });
    
    y += 15;
    
    // Add horizontal line every 5 rows for better readability
    if (i % 5 === 4) {
      doc.moveTo(leftMargin, y - 2).lineTo(leftMargin + (colWidth * fields.length), y - 2).stroke();
      y += 5;
    }
  });
}

function addReportFooter(doc) {
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 50;
  
  doc.fontSize(8).text(
    `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    50,
    footerY,
    { align: 'left' }
  );
  
  doc.text(
    `Page ${doc.bufferedPageRange().count} of ${doc.bufferedPageRange().count}`,
    50,
    footerY + 15,
    { align: 'left' }
  );
  
  doc.text(
    'ResiLinked - Connecting Skilled Workers with Local Opportunities',
    50,
    footerY,
    { align: 'right' }
  );
}

module.exports = { 
  generateUserReport, 
  generateJobReport, 
  generateCustomReport,
  generateAnalyticsReport
};