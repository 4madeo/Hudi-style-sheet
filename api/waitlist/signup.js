const { getServiceClient } = require("../_lib/supabase");
const {
  computeDisplayPosition,
  deriveReferralCode,
  isValidEmail,
  isValidReferralCode
} = require("../_lib/referral");

const SELECT_COLUMNS = "referral_code, position, followed_x, joined_telegram, email, wallet_address";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = req.body || {};
  const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
  const walletAddress = body.walletAddress ? String(body.walletAddress).trim() : undefined;
  const referredByCode = body.referredByCode ? String(body.referredByCode).trim().toLowerCase() : undefined;

  if (!email && !walletAddress) {
    res.status(400).json({ error: "email_or_wallet_required" });
    return;
  }
  if (email && !isValidEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  if (referredByCode && !isValidReferralCode(referredByCode)) {
    res.status(400).json({ error: "invalid_referral_code" });
    return;
  }

  try {
    const existing = await findExisting({ email, walletAddress });
    if (existing === "error") {
      res.status(500).json({ error: "db_error" });
      return;
    }

    if (existing) {
      const merged = await backfillMissingFields(existing, { email, walletAddress });
      res.status(200).json(await buildResponse(merged, true));
      return;
    }

    const supabase = getServiceClient();
    const codeIdentifier = walletAddress || email;
    const userAgent = req.headers["user-agent"]?.slice(0, 500);
    const ipCountry = req.headers["x-vercel-ip-country"]?.slice(0, 8);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referralCode = deriveReferralCode(codeIdentifier, attempt);
      const insert = await supabase
        .from("waitlist_signups")
        .insert({
          email: email || null,
          wallet_address: walletAddress || null,
          referral_code: referralCode,
          referred_by_code: referredByCode || null,
          ip_country: ipCountry || null,
          user_agent: userAgent || null
        })
        .select(SELECT_COLUMNS)
        .single();

      if (!insert.error && insert.data) {
        res.status(201).json(await buildResponse(insert.data, false));
        return;
      }

      if (insert.error?.code !== "23505") {
        console.error("[signup] insert failed", insert.error);
        res.status(500).json({ error: "db_error" });
        return;
      }

      const recheck = await findExisting({ email, walletAddress });
      if (recheck && recheck !== "error") {
        const merged = await backfillMissingFields(recheck, { email, walletAddress });
        res.status(200).json(await buildResponse(merged, true));
        return;
      }
    }

    res.status(500).json({ error: "code_generation_failed" });
  } catch (error) {
    console.error("[signup] failed", error);
    res.status(500).json({ error: "server_error" });
  }
};

async function findExisting({ email, walletAddress }) {
  const supabase = getServiceClient();
  if (walletAddress) {
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select(SELECT_COLUMNS)
      .eq("wallet_address", walletAddress)
      .maybeSingle();
    if (error) {
      console.error("[signup] lookup by wallet failed", error);
      return "error";
    }
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select(SELECT_COLUMNS)
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.error("[signup] lookup by email failed", error);
      return "error";
    }
    if (data) return data;
  }

  return null;
}

async function backfillMissingFields(row, incoming) {
  const updates = {};
  if (!row.email && incoming.email) updates.email = incoming.email;
  if (!row.wallet_address && incoming.walletAddress) updates.wallet_address = incoming.walletAddress;
  if (Object.keys(updates).length === 0) return row;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("waitlist_signups")
    .update(updates)
    .eq("referral_code", row.referral_code)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[signup] backfill failed", { error, updates, code: row.referral_code });
    return row;
  }
  return data;
}

async function buildResponse(row, alreadySignedUp) {
  const [referrals, referredUsers] = await Promise.all([
    countReferrals(row.referral_code),
    fetchReferredUsers(row.referral_code)
  ]);
  return {
    position: computeDisplayPosition({
      rawPosition: row.position,
      followedX: row.followed_x,
      joinedTelegram: row.joined_telegram,
      referrals
    }),
    referralCode: row.referral_code,
    referralUrl: `https://hudi.com?ref=${row.referral_code}`,
    alreadySignedUp,
    referrals,
    followedX: row.followed_x,
    joinedTelegram: row.joined_telegram,
    referredUsers
  };
}

async function countReferrals(code) {
  const supabase = getServiceClient();
  const { count } = await supabase
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_code", code);
  return count || 0;
}

async function fetchReferredUsers(code) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("waitlist_signups")
    .select("wallet_address")
    .eq("referred_by_code", code)
    .limit(3);
  return (data || []).map((row) => ({ walletAddress: row.wallet_address || null }));
}
