const PDFDocument = require('pdfkit'); const fs = require('fs'); const doc = new PDFDocument(); doc.pipe(fs.createWriteStream('qr.pdf')); doc.image('qr.png', 100, 100, {width: 400}); doc.end();
