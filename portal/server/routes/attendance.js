const express = require('express');
const path = require('path');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/attendance — HR: all for date | Employee: own monthly
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, month, year, employeeId } = req.query;
    let query = {};

    if (req.user.role === 'employee') {
      query.employee = req.user._id;
      if (month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
      }
    } else {
      // HR queries
      if (date) {
        const d = new Date(date);
        const start = new Date(d.setHours(0, 0, 0, 0));
        const end = new Date(new Date(date).setHours(23, 59, 59, 999));
        query.date = { $gte: start, $lte: end };
      }
      if (employeeId && employeeId !== 'all') query.employee = employeeId;
    }

    const records = await Attendance.find(query)
      .populate('employee', 'fullName firstName lastName employeeId designation department profilePhoto')
      .populate('markedBy', 'fullName')
      .sort({ date: -1, 'employee.fullName': 1 });

    return res.json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch attendance.' });
  }
});

// POST /api/attendance — HR only: batch save attendance for a date
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const { date, records } = req.body; // records: [{ employeeId, status, notes }]
    if (!date || !records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Date and attendance records are required.' });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const results = [];

    for (const rec of records) {
      const { employeeId, status, notes } = rec;
      try {
        const saved = await Attendance.findOneAndUpdate(
          { employee: employeeId, date: { $gte: attendanceDate, $lt: new Date(attendanceDate.getTime() + 86400000) } },
          { employee: employeeId, date: attendanceDate, status, notes: notes || '', markedBy: req.user._id },
          { upsert: true, new: true, runValidators: true }
        );
        results.push(saved);
      } catch (err) {
        // Skip individual errors, continue batch
        console.error(`Attendance save error for employee ${employeeId}:`, err.message);
      }
    }

    return res.json({ message: `Attendance saved for ${records.length} employees.`, results });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save attendance.', error: err.message });
  }
});

// PUT /api/attendance/:id — HR only: edit single attendance record
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, notes, markedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('employee', 'fullName employeeId');
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });
    return res.json(record);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update attendance.', error: err.message });
  }
});

// GET /api/attendance/export — HR only: PDF, CSV, Excel exports
router.get('/export', authenticate, requireHR, async (req, res) => {
  try {
    const { format, date, month, year } = req.query;
    let query = {};

    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(new Date(date).setHours(23, 59, 59, 999));
      query.date = { $gte: start, $lte: end };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(query)
      .populate('employee', 'fullName employeeId designation department')
      .populate('markedBy', 'fullName')
      .sort({ date: 1, 'employee.fullName': 1 });

    const label = date || `${year}-${String(month).padStart(2, '0')}`;

    if (format === 'csv') {
      const header = 'Date,Employee ID,Name,Department,Designation,Status,Notes\n';
      const rows = records.map(r =>
        `${new Date(r.date).toLocaleDateString('en-IN')},${r.employee?.employeeId || ''},${r.employee?.fullName || ''},${r.employee?.department || ''},${r.employee?.designation || ''},${r.status},"${r.notes || ''}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${label}.csv"`);
      return res.send(header + rows);
    }

    if (format === 'excel') {
      const XLSX = require('xlsx');
      const wsData = [
        ['Date', 'Employee ID', 'Name', 'Department', 'Designation', 'Status', 'Notes'],
        ...records.map(r => [
          new Date(r.date).toLocaleDateString('en-IN'),
          r.employee?.employeeId || '',
          r.employee?.fullName || '',
          r.employee?.department || '',
          r.employee?.designation || '',
          r.status,
          r.notes || ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${label}.xlsx"`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${label}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0D1B3E').text('Teuly IT Solutions — Attendance Report', { align: 'center' });
      doc.fontSize(11).font('Helvetica').fillColor('#555').text(`Period: ${label}`, { align: 'center' });
      doc.moveDown(1.5);

      // Column headers
      const cols = [60, 70, 140, 80, 110, 80, 120];
      const headers = ['Date', 'Emp ID', 'Name', 'Dept', 'Designation', 'Status', 'Notes'];
      let x = 40;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0D1B3E');
      headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: cols[i], lineBreak: false }); x += cols[i]; });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(800, doc.y).stroke('#C9A84C');
      doc.moveDown(0.3);

      // Rows
      doc.font('Helvetica').fontSize(8).fillColor('#333');
      records.forEach((r, idx) => {
        if (doc.y > 520) { doc.addPage(); }
        const row = [
          new Date(r.date).toLocaleDateString('en-IN'),
          r.employee?.employeeId || '',
          r.employee?.fullName || '',
          r.employee?.department || '',
          r.employee?.designation || '',
          r.status,
          r.notes || ''
        ];
        x = 40;
        const rowColor = idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF';
        row.forEach((cell, i) => { doc.text(String(cell), x, doc.y, { width: cols[i], lineBreak: false }); x += cols[i]; });
        doc.moveDown(0.6);
      });

      doc.end();
      return;
    }

    return res.status(400).json({ message: 'Invalid export format. Use csv, excel, or pdf.' });
  } catch (err) {
    return res.status(500).json({ message: 'Export failed.', error: err.message });
  }
});

module.exports = router;
