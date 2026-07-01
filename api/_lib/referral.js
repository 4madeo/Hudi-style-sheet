const { createHash } = require("crypto");

const REFERRAL_BOOST = 500;
const ACTION_BOOST = 100;
const MAX_REFERRAL_BOOST_COUNT = 3;
const POSITION_DISPLAY_OFFSET = 2420;
const REFERRAL_CODE_RE = /^[a-f0-9]{4}-[a-f0-9]{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidReferralCode(code) {
  return REFERRAL_CODE_RE.test(code);
}

function isValidEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}

function deriveReferralCode(identifier, attempt = 0) {
  const normalized = String(identifier || "").toLowerCase().trim();
  const input = attempt > 0 ? `${normalized}:${attempt}` : normalized;
  const hex = createHash("sha256").update(input).digest("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function computeDisplayPosition({ rawPosition, followedX, joinedTelegram, referrals }) {
  const cappedReferrals = Math.min(referrals, MAX_REFERRAL_BOOST_COUNT);
  const boost = (followedX ? ACTION_BOOST : 0)
    + (joinedTelegram ? ACTION_BOOST : 0)
    + cappedReferrals * REFERRAL_BOOST;
  return Math.max(1, Number(rawPosition) + POSITION_DISPLAY_OFFSET - boost);
}

module.exports = {
  REFERRAL_BOOST,
  ACTION_BOOST,
  MAX_REFERRAL_BOOST_COUNT,
  computeDisplayPosition,
  deriveReferralCode,
  isValidEmail,
  isValidReferralCode
};
