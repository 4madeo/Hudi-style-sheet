module.exports = function handler(req, res) {
  res.status(200).json({
    privyAppId: process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || null
  });
};
