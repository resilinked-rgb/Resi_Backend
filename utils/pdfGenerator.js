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
      doc.text(`Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 50, doc.y, { align: 'right' });
      doc.moveDown(1);

      // Helper function for section dividers
      function sectionDivider() {
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#2b6cb0').lineWidth(2).stroke();
        doc.moveDown(0.8);
      }

      // Helper function for card backgrounds
      function drawCard(x, y, width, height, fillColor = '#f8f9fa') {
        doc.rect(x, y, width, height).fillAndStroke(fillColor, '#ddd');
      }

      // === KEY PERFORMANCE INDICATORS ===
      sectionDivider();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('KEY PERFORMANCE INDICATORS', 50, doc.y);
      doc.moveDown(1);
      
      if (analytics) {
        const kpis = [
          { label: 'Total Users', value: analytics.totalUsers || 0 },
          { label: 'Total Jobs', value: analytics.totalJobs || 0 },
          { label: 'Total Ratings', value: analytics.totalRatings || 0 },
          { label: 'Total Reports', value: analytics.totalReports || 0 },
        ];
        
        const startX = 65, startY = doc.y, colW = 115, rowH = 55, gap = 5;
        kpis.forEach((kpi, i) => {
          const x = startX + (i * (colW + gap));
          // Card background with border
          doc.rect(x, startY, colW, rowH).fillAndStroke('#f0f7ff', '#2b6cb0');
          
          // Label
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#666')
            .text(kpi.label, x + 5, startY + 10, { width: colW - 10, align: 'center' });
          
          // Value
          doc.font('Helvetica-Bold').fontSize(20).fillColor('#2b6cb0')
            .text(kpi.value.toLocaleString(), x + 5, startY + 28, { width: colW - 10, align: 'center' });
        });
        doc.y = startY + rowH + 20;
      }

      // === USER ANALYTICS ===
      sectionDivider();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('USER ANALYTICS', 50, doc.y);
      doc.moveDown(1.2);

      // User Type Distribution Box
      if (analytics?.userDistribution) {
        const boxY = doc.y;
        drawCard(65, boxY, 235, 100);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('User Type Distribution', 75, boxY + 10);
        doc.moveDown(0.5);
        
        const dist = analytics.userDistribution;
        doc.font('Helvetica').fontSize(11).fillColor('#333');
        doc.text(`Employees:`, 75, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').fillColor('#3b82f6').text(` ${dist.employee || 0} (${dist.employeePercentage || 0}%)`);
        
        doc.font('Helvetica').fillColor('#333');
        doc.text(`Employers:`, 75, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').fillColor('#10b981').text(` ${dist.employer || 0} (${dist.employerPercentage || 0}%)`);
        
        doc.font('Helvetica').fillColor('#333');
        doc.text(`Both:`, 75, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').fillColor('#f59e0b').text(` ${dist.both || 0} (${dist.bothPercentage || 0}%)`);
        
        doc.y = boxY;
      }

      // Gender Distribution Box
      if (analytics?.genderDistribution) {
        const boxY = doc.y;
        drawCard(310, boxY, 235, 100);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('Gender Distribution', 320, boxY + 10);
        doc.moveDown(0.5);
        
        const gender = analytics.genderDistribution;
        const total = analytics.totalUsers || 1;
        
        doc.font('Helvetica').fontSize(11).fillColor('#333');
        const malePercent = total > 0 ? Math.round((gender.male / total) * 100) : 0;
        doc.text(`Male:`, 320, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').text(` ${gender.male || 0} (${malePercent}%)`);
        
        doc.font('Helvetica').fillColor('#333');
        const femalePercent = total > 0 ? Math.round((gender.female / total) * 100) : 0;
        doc.text(`Female:`, 320, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').text(` ${gender.female || 0} (${femalePercent}%)`);
        
        doc.font('Helvetica').fillColor('#333');
        const othersPercent = total > 0 ? Math.round((gender.others / total) * 100) : 0;
        doc.text(`Others:`, 320, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').text(` ${gender.others || 0} (${othersPercent}%)`);
        
        doc.y = boxY + 110;
      }

      // Verification Status Box
      if (analytics?.verifiedUsers) {
        const boxY = doc.y;
        drawCard(65, boxY, 480, 55);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('User Verification Status', 75, boxY + 10);
        doc.moveDown(0.5);
        
        const verified = analytics.verifiedUsers;
        const unverified = (analytics.totalUsers || 0) - (verified.count || 0);
        const unverifiedPercent = 100 - (verified.percentage || 0);
        
        doc.font('Helvetica').fontSize(11).fillColor('#333');
        doc.text(`Verified:`, 75, doc.y, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').fillColor('#10b981')
          .text(` ${verified.count?.toLocaleString() || 0} (${verified.percentage || 0}%)`, { continued: true });
        
        doc.font('Helvetica').fillColor('#333').text('   |   ', { continued: true });
        doc.text(`Unverified:`, { continued: true, width: 100 });
        doc.font('Helvetica-Bold').fillColor('#ef4444')
          .text(` ${unverified.toLocaleString()} (${unverifiedPercent}%)`);
        
        doc.y = boxY + 65;
      }

      // === JOB ANALYTICS ===
      sectionDivider();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('JOB ANALYTICS', 50, doc.y);
      doc.moveDown(1.2);

      // Job Statistics Box
      if (analytics?.jobStats) {
        const boxY = doc.y;
        drawCard(65, boxY, 480, 80);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('Job Statistics', 75, boxY + 10);
        doc.moveDown(0.5);
        
        const js = analytics.jobStats;
        doc.font('Helvetica').fontSize(11).fillColor('#333');
        
        // First row
        doc.text(`Active Jobs:`, 75, doc.y, { continued: true, width: 120 });
        doc.font('Helvetica-Bold').fillColor('#3b82f6').text(` ${js.active?.toLocaleString() || 0}`, { continued: true });
        
        doc.font('Helvetica').fillColor('#333').text('   |   ', { continued: true });
        doc.text(`Completed Jobs:`, { continued: true, width: 130 });
        doc.font('Helvetica-Bold').fillColor('#10b981').text(` ${js.completed?.toLocaleString() || 0}`);
        
        doc.moveDown(0.5);
        
        // Second row
        doc.font('Helvetica').fillColor('#333');
        doc.text(`Total Value:`, 75, doc.y, { continued: true, width: 120 });
        doc.font('Helvetica-Bold').fillColor('#059669').text(` PHP ${js.totalValue?.toLocaleString() || 0}`, { continued: true });
        
        doc.font('Helvetica').fillColor('#333').text('   |   ', { continued: true });
        doc.text(`Average Price:`, { continued: true, width: 130 });
        doc.font('Helvetica-Bold').fillColor('#059669').text(` PHP ${js.averagePrice?.toLocaleString() || 0}`);
        
        doc.y = boxY + 90;
      }

      // Popular Jobs
      if (analytics?.popularJobs && analytics.popularJobs.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('Top 5 Popular Jobs (By Applicants)', 65, doc.y);
        doc.moveDown(0.8);
        
        analytics.popularJobs.forEach((job, i) => {
          const jobY = doc.y;
          drawCard(75, jobY, 460, 45);
          
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#333')
            .text(`${i + 1}. ${job.title || 'Untitled'}`, 85, jobY + 10);
          
          doc.font('Helvetica').fontSize(10).fillColor('#666')
            .text(`Location: ${job.barangay || 'N/A'}`, 85, jobY + 25, { continued: true });
          doc.text(`  |  Price: PHP ${job.price?.toLocaleString() || 0}`, { continued: true });
          doc.text(`  |  Applicants: ${job.applicantCount}`, { continued: false });
          
          doc.y = jobY + 50;
        });
        doc.moveDown(0.5);
      }

      // === LOCATION ANALYTICS ===
      sectionDivider();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('LOCATION ANALYTICS', 50, doc.y);
      doc.moveDown(1.2);

      // Popular Barangays
      if (analytics?.popularBarangays && analytics.popularBarangays.length > 0) {
        const boxY = doc.y;
        drawCard(65, boxY, 480, 100);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('Top 5 Popular Barangays', 75, boxY + 10);
        doc.moveDown(0.5);
        
        doc.font('Helvetica').fontSize(11).fillColor('#333');
        analytics.popularBarangays.forEach((item, i) => {
          doc.text(`${i + 1}. ${item.barangay || 'N/A'}`, 85, doc.y, { continued: true, width: 300 });
          doc.font('Helvetica-Bold').fillColor('#2b6cb0').text(` ${item.count} jobs`, { align: 'left' });
          doc.font('Helvetica').fillColor('#333');
        });
        
        doc.y = boxY + 110;
      }

      // === SKILLS ANALYTICS ===
      sectionDivider();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('SKILLS ANALYTICS', 50, doc.y);
      doc.moveDown(1.2);

      // Popular Skills in a grid
      if (analytics?.popularSkills && analytics.popularSkills.length > 0) {
        const boxY = doc.y;
        drawCard(65, boxY, 480, 130);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2b6cb0')
          .text('Top 10 In-Demand Skills', 75, boxY + 10);
        doc.moveDown(0.5);
        
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        
        analytics.popularSkills.forEach((skill, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 85 + (col * 230);
          const y = boxY + 30 + (row * 18);
          
          doc.text(`${i + 1}. ${skill.skill}`, x, y, { continued: true, width: 150 });
          doc.font('Helvetica-Bold').fillColor('#2b6cb0').text(` ${skill.count} users`);
          doc.font('Helvetica').fillColor('#333');
        });
        
        doc.y = boxY + 140;
      }

      // === RECENT ACTIVITY ===
      if (analytics?.recentActivity && analytics.recentActivity.length > 0) {
        sectionDivider();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#2b6cb0').text('RECENT ACTIVITY', 50, doc.y);
        doc.moveDown(1.2);
        
        const boxY = doc.y;
        const activityHeight = Math.min(analytics.recentActivity.length * 35 + 30, 250);
        drawCard(65, boxY, 480, activityHeight);
        
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        let currentY = boxY + 15;
        
        analytics.recentActivity.slice(0, 8).forEach((activity, i) => {
          const date = new Date(activity.createdAt).toLocaleDateString();
          const time = new Date(activity.createdAt).toLocaleTimeString();
          const typeTag = activity.type === 'user' ? '[User]' : '[Job]';
          
          doc.font('Helvetica-Bold').fillColor('#2b6cb0').text(typeTag, 75, currentY, { continued: true });
          doc.font('Helvetica').fillColor('#333').text(` ${activity.description}`, { continued: false });
          currentY += 12;
          doc.fontSize(9).fillColor('#999').text(`${date} at ${time}`, 85, currentY);
          currentY += 23;
          doc.fontSize(10).fillColor('#333');
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