// --- Analytics PDF Generation ---
function generateAnalyticsReport(analytics, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
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

      // Add filter information
      addFilterSection(doc, filters);

      // --- Analytics Summary Section ---
      doc.moveDown(1);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('KEY PERFORMANCE INDICATORS', { align: 'left' });
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#b5d0ea').stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(11).fillColor('#222');
      if (analytics) {
        const kpis = [
          { label: 'Total Users', value: analytics.totalUsers },
          { label: 'Total Jobs', value: analytics.totalJobs },
          { label: 'Total Ratings', value: analytics.totalRatings },
          { label: 'Total Reports', value: analytics.totalReports },
        ];
        // Table-like layout for KPIs
        const startX = 70, startY = doc.y, colW = 110, rowH = 22;
        kpis.forEach((kpi, i) => {
          doc.rect(startX + i * colW, startY, colW, rowH).strokeColor('#e0e7ef').stroke();
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#222').text(kpi.label, startX + i * colW + 8, startY + 4, { width: colW - 16, align: 'center' });
          doc.font('Helvetica').fontSize(13).fillColor('#2b6cb0').text(kpi.value ?? 0, startX + i * colW + 8, startY + 14, { width: colW - 16, align: 'center' });
        });
        doc.y = startY + rowH + 10;
      }

      // Add a horizontal divider before each section
      function sectionDivider() {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#2b6cb0').stroke();
        doc.moveDown(0.8);
      }

      // --- User Distribution ---
      sectionDivider();
      if (analytics && analytics.userDistribution) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('USER DISTRIBUTION', { align: 'left' });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).fillColor('#222');
        const dist = analytics.userDistribution;
        doc.text(`Employees:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${dist.employee ?? 0} (${dist.employeePercentage?.toFixed(1) ?? 0}%)`);
        doc.font('Helvetica').text(`Employers:`, 270, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${dist.employer ?? 0} (${dist.employerPercentage?.toFixed(1) ?? 0}%)`);
        doc.moveDown(1);
      }

      // --- Job Statistics ---
      sectionDivider();
      if (analytics && analytics.jobStats) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('JOB STATISTICS', { align: 'left' });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).fillColor('#222');
        const js = analytics.jobStats;
        doc.text(`Active Jobs:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${js.active ?? 0}`);
        doc.font('Helvetica').text(`Completed Jobs:`, 270, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${js.completed ?? 0}`);
        doc.moveDown(0.2);
        doc.font('Helvetica').text(`Total Value:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ₱${js.totalValue?.toLocaleString() ?? 0}`);
        doc.font('Helvetica').text(`Average Price:`, 270, doc.y, { continued: true }).font('Helvetica-Bold').text(` ₱${js.averagePrice?.toLocaleString() ?? 0}`);
        doc.moveDown(1);
      }

      // --- Popular Barangays ---
      sectionDivider();
      if (analytics && analytics.popularBarangays && analytics.popularBarangays.length > 0) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('POPULAR BARANGAYS', { align: 'left' });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).fillColor('#222');
        analytics.popularBarangays.slice(0, 5).forEach((item, i) => {
          doc.text(`${i + 1}. ${item.barangay}:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${item.count} jobs`);
        });
        doc.moveDown(1);
      }

      // --- Recent Activity ---
      sectionDivider();
      if (analytics && analytics.recentActivity && analytics.recentActivity.length > 0) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('RECENT ACTIVITY', { align: 'left' });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).fillColor('#222');
        analytics.recentActivity.slice(0, 6).forEach((activity, i) => {
          doc.text(`- ${activity.description} (${new Date(activity.createdAt).toLocaleDateString()})`, 70, doc.y);
        });
        doc.moveDown(1);
      }

      // --- System Performance ---
      sectionDivider();
      if (analytics && analytics.performance) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#2b6cb0').text('SYSTEM PERFORMANCE', { align: 'left' });
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).fillColor('#222');
        const perf = analytics.performance;
        doc.text(`Response Time:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${perf.responseTime ?? 'N/A'}`);
        doc.font('Helvetica').text(`Uptime:`, 270, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${perf.uptime ?? 'N/A'}`);
        doc.moveDown(0.2);
        doc.font('Helvetica').text(`Error Rate:`, 70, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${perf.errorRate ?? 'N/A'}`);
        doc.font('Helvetica').text(`Active Sessions:`, 270, doc.y, { continued: true }).font('Helvetica-Bold').text(` ${perf.activeSessions ?? 'N/A'}`);
        doc.moveDown(1);
      }

      // Add footer
      addReportFooter(doc);

      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });
      stream.on('error', reject);

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
      const doc = new PDFDocument({ margin: 50 });
      const filename = `user-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      doc.pipe(fs.createWriteStream(filepath));
      
      // Add logo and header
      addReportHeader(doc, 'USER MANAGEMENT REPORT');
      
      // Add filter information
      addFilterSection(doc, filters);
      
      // Summary statistics
      addSummarySection(doc, users, 'Users');
      
      // User details table
      addUserTable(doc, users);
      
      // Add footer
      addReportFooter(doc);
      
      doc.end();
      
      doc.on('end', () => {
        resolve(filepath);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

function generateJobReport(jobs, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `job-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      doc.pipe(fs.createWriteStream(filepath));
      
      // Add logo and header
      addReportHeader(doc, 'JOB MANAGEMENT REPORT');
      
      // Add filter information
      addFilterSection(doc, filters);
      
      // Summary statistics
      addSummarySection(doc, jobs, 'Jobs');
      
      // Job details table
      addJobTable(doc, jobs);
      
      // Add footer
      addReportFooter(doc);
      
      doc.end();
      
      doc.on('end', () => {
        resolve(filepath);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

function generateCustomReport(data, title, fields, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `custom-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, '..', 'temp', filename);
      
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      doc.pipe(fs.createWriteStream(filepath));
      
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
      
      doc.on('end', () => {
        resolve(filepath);
      });
      
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
  if (filters.minPrice) filterText += `Min Price: ₱${filters.minPrice}\n`;
  if (filters.maxPrice) filterText += `Max Price: ₱${filters.maxPrice}\n`;
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
                 `Verified: ${verified} (${Math.round((verified / total) * 100)}%)\n` +
                 `Employees: ${employees}\n` +
                 `Employers: ${employers}\n` +
                 `Both: ${both}`;
  } else if (dataType === 'Jobs') {
    const total = data.length;
    const open = data.filter(j => j.status === 'open').length;
    const assigned = data.filter(j => j.status === 'assigned').length;
    const completed = data.filter(j => j.status === 'completed').length;
    const cancelled = data.filter(j => j.status === 'cancelled').length;
    
    summaryText = `Total ${dataType}: ${total}\n` +
                 `Open: ${open}\n` +
                 `Assigned: ${assigned}\n` +
                 `Completed: ${completed}\n` +
                 `Cancelled: ${cancelled}`;
  } else {
    summaryText = `Total ${dataType}: ${data.length}`;
  }
  
  doc.font('Helvetica').fontSize(10).text(summaryText, 50, doc.y);
  doc.y += summaryText.split('\n').length * 15 + 20;
}

function addUserTable(doc, users) {
  doc.fontSize(12).font('Helvetica-Bold').text('USER DETAILS:', 50, doc.y);
  doc.y += 20;
  
  const tableTop = doc.y;
  const leftMargin = 50;
  const colWidths = [80, 100, 120, 80, 60, 60];
  
  // Table headers
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Name', leftMargin, tableTop);
  doc.text('Email', leftMargin + colWidths[0], tableTop);
  doc.text('Contact', leftMargin + colWidths[0] + colWidths[1], tableTop);
  doc.text('Type', leftMargin + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
  doc.text('Barangay', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
  doc.text('Status', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
  
  let y = tableTop + 20;
  
  // Horizontal line
  doc.moveTo(leftMargin, y - 5).lineTo(leftMargin + colWidths.reduce((a, b) => a + b, 0), y - 5).stroke();
  
  // Table rows
  doc.font('Helvetica');
  users.forEach((user, i) => {
    if (y > 700) { // Add new page if needed
      doc.addPage();
      y = 50;
      // Add headers again on new page
      doc.font('Helvetica-Bold');
      doc.text('Name', leftMargin, y);
      doc.text('Email', leftMargin + colWidths[0], y);
      doc.text('Contact', leftMargin + colWidths[0] + colWidths[1], y);
      doc.text('Type', leftMargin + colWidths[0] + colWidths[1] + colWidths[2], y);
      doc.text('Barangay', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
      doc.text('Status', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y);
      y += 20;
      doc.font('Helvetica');
    }
    
    doc.fontSize(8).text(`${user.firstName} ${user.lastName}`, leftMargin, y);
    doc.text(user.email, leftMargin + colWidths[0], y);
    doc.text(user.mobileNo || 'N/A', leftMargin + colWidths[0] + colWidths[1], y);
    doc.text(user.userType, leftMargin + colWidths[0] + colWidths[1] + colWidths[2], y);
    doc.text(user.barangay || 'N/A', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
    doc.text(user.isVerified ? 'Verified' : 'Unverified', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y);
    
    y += 15;
    
    // Add horizontal line every 5 rows for better readability
    if (i % 5 === 4) {
      doc.moveTo(leftMargin, y - 2).lineTo(leftMargin + colWidths.reduce((a, b) => a + b, 0), y - 2).stroke();
      y += 5;
    }
  });
}

function addJobTable(doc, jobs) {
  doc.fontSize(12).font('Helvetica-Bold').text('JOB DETAILS:', 50, doc.y);
  doc.y += 20;
  
  const tableTop = doc.y;
  const leftMargin = 50;
  const colWidths = [100, 120, 60, 80, 80, 60];
  
  // Table headers
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Title', leftMargin, tableTop);
  doc.text('Description', leftMargin + colWidths[0], tableTop);
  doc.text('Price', leftMargin + colWidths[0] + colWidths[1], tableTop);
  doc.text('Barangay', leftMargin + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
  doc.text('Posted By', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
  doc.text('Status', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
  
  let y = tableTop + 20;
  
  // Horizontal line
  doc.moveTo(leftMargin, y - 5).lineTo(leftMargin + colWidths.reduce((a, b) => a + b, 0), y - 5).stroke();
  
  // Table rows
  doc.font('Helvetica');
  jobs.forEach((job, i) => {
    if (y > 700) { // Add new page if needed
      doc.addPage();
      y = 50;
      // Add headers again on new page
      doc.font('Helvetica-Bold');
      doc.text('Title', leftMargin, y);
      doc.text('Description', leftMargin + colWidths[0], y);
      doc.text('Price', leftMargin + colWidths[0] + colWidths[1], y);
      doc.text('Barangay', leftMargin + colWidths[0] + colWidths[1] + colWidths[2], y);
      doc.text('Posted By', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
      doc.text('Status', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y);
      y += 20;
      doc.font('Helvetica');
    }
    
    const description = job.description && job.description.length > 30 
      ? job.description.substring(0, 30) + '...' 
      : job.description || 'N/A';
    
    const postedBy = job.postedBy 
      ? `${job.postedBy.firstName} ${job.postedBy.lastName}` 
      : 'Unknown';
    
    doc.fontSize(8).text(job.title, leftMargin, y);
    doc.text(description, leftMargin + colWidths[0], y);
    doc.text(`₱${job.price}`, leftMargin + colWidths[0] + colWidths[1], y);
    doc.text(job.barangay || 'N/A', leftMargin + colWidths[0] + colWidths[1] + colWidths[2], y);
    doc.text(postedBy, leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y);
    doc.text(job.status || 'Unknown', leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y);
    
    y += 15;
    
    // Add horizontal line every 5 rows for better readability
    if (i % 5 === 4) {
      doc.moveTo(leftMargin, y - 2).lineTo(leftMargin + colWidths.reduce((a, b) => a + b, 0), y - 2).stroke();
      y += 5;
    }
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