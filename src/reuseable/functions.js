import db from "../config/db.js";

export const executeQuery = (sql, values) => {
    return new Promise((resolve, reject) => {
        db.query(sql, values, (error, results) => {
            if (error) {
                console.error('SQL Error:', error);
                return reject(error);
            }
            console.log('Query Results:', results); // Debug log
            resolve(results);
        });
    });
};

export const dbQuery = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};