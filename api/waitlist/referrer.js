const { getServiceClient } = require("../_lib/supabase");
const { isValidReferralCode } = require("../_lib/referral");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const code = req.query.code ? String(req.query.code).trim().toLowerCase() : "";
  if (!code || !isValidReferralCode(code)) {
    res.status(400).json({ error: "invalid_referral_code" });
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select("wallet_address")
      .eq("referral_code", code)
      .maybeSingle();

    if (error) {
      console.error("[referrer] lookup failed", error);
      res.status(500).json({ error: "db_error" });
      return;
    }

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    res.status(200).json({
      exists: !!data,
      walletAddress: data?.wallet_address || null
    });
  } catch (error) {
    console.error("[referrer] failed", error);
    res.status(500).json({ error: "server_error" });
  }
};
