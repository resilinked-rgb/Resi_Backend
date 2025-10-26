// utils/csv.js
const { Parser } = require("json2csv");

function convertToCSV(data) {
  if (!data || data.length === 0) return "";
  
  // Convert mongoose docs to plain objects
  const plainData = data.map(item => 
    item.toObject ? item.toObject() : item
  );

  const fields = Object.keys(plainData[0]);
  const parser = new Parser({ fields });
  return parser.parse(plainData);
}

module.exports = convertToCSV;
