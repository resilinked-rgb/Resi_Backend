// middleware/verifyAdmin.js
module.exports = (req, res, next) => {
  if (!req.user || req.user.userType !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
