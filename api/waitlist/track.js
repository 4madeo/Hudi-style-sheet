const { getServiceClient } = require("../_lib/supabase");
const { computeDisplayPosition, isValidReferralCode } = require("../_lib/referral");

const ALLOWED_ACTIONS = new Set(["followed_x", "joined_telegram"]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = req.body || {};
  const referralCode = body.referralCode ? String(body.referralCode).trim().toLowerCase() : "";
  const action = body.action;

  if (!referralCode || !isValidReferralCode(referralCode)) {
    res.status(400).json({ error: "invalid_referral_code" });
    return;
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: "invalid_action" });
    return;
  }

  try {
    const supabase = getServiceClient();
    const update = await supabase
      .from("waitlist_signups")
      .update({ [action]: true })
      .eq("referral_code", referralCode)
      .select("referral_code, position, followed_x, joined_telegram")
      .single();

    if (update.error || !update.data) {
      res.status(update.error?.code === "PGRST116" ? 404 : 500).json({ error: update.error?.code === "PGRST116" ? "not_found" : "db_error" });
      return;
    }

    const [referralsRes, referredUsersRes] = await Promise.all([
      supabase
        .from("waitlist_signups")
        .select("id", { count: "exact", head: true })
        .eq("referred_by_code", referralCode),
      supabase
        .from("waitlist_signups")
        .select("wallet_address")
        .eq("referred_by_code", referralCode)
        .limit(3)
    ]);

    const referrals = referralsRes.count || 0;
    const referredUsers = (referredUsersRes.data || []).map((row) => ({ walletAddress: row.wallet_address || null }));
    res.status(200).json({
      position: computeDisplayPosition({
        rawPosition: update.data.position,
        followedX: update.data.followed_x,
        joinedTelegram: update.data.joined_telegram,
        referrals
      }),
      referrals,
      followedX: update.data.followed_x,
      joinedTelegram: update.data.joined_telegram,
      referredUsers
    });
  } catch (error) {
    console.error("[track] failed", error);
    res.status(500).json({ error: "server_error" });
  }
};
