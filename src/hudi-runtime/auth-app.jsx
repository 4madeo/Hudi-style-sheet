import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DAppKitProvider, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { createDAppKit } from "@mysten/dapp-kit-core";
import { registerSlushWallet } from "@mysten/slush-wallet";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { ArrowUp, TelegramLogo, Users, X, XLogo } from "@phosphor-icons/react";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet as useCreatePrivyWallet } from "@privy-io/react-auth/extended-chains";

const REFERRAL_BOOST = 500;
const ACTION_BOOST = 100;
const MAX_REFERRAL_BOOST_COUNT = 3;
const REFERRAL_CODE_RE = /^[a-f0-9]{4}-[a-f0-9]{4}$/;
const X_URL = "https://x.com/tradeonhudi";
const TG_URL = "https://t.me/+-EGVpid830VjZjJh";

const dAppKit = createDAppKit({
  networks: ["mainnet"],
  createClient: (network) => new SuiJsonRpcClient({ network, url: getJsonRpcFullnodeUrl(network) }),
  defaultNetwork: "mainnet"
});

try {
  registerSlushWallet("Hudi");
} catch (error) {
  console.warn("[hudi] Slush wallet registration skipped", error);
}

class ApiClientError extends Error {
  constructor(code, detail, status) {
    super(detail ?? code);
    this.name = "ApiClientError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new ApiClientError(err?.error ?? `http_${res.status}`, err?.detail, res.status);
  }
  return res.json();
}

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new ApiClientError(err?.error ?? `http_${res.status}`, err?.detail, res.status);
  }
  return res.json();
}

const api = {
  signup: (req) => postJson("/api/waitlist/signup", req),
  track: (req) => postJson("/api/waitlist/track", req),
  referrer: (code) => getJson(`/api/waitlist/referrer?code=${encodeURIComponent(code)}`)
};

function readIncomingRefCode() {
  const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase();
  return ref && REFERRAL_CODE_RE.test(ref) ? ref : null;
}

function findSuiAddressInPrivyUser(user) {
  const linked = user?.linkedAccounts?.find((account) => (
    account.type === "wallet" && account.chainType === "sui"
  ));
  return linked && "address" in linked ? linked.address : undefined;
}

function formatPosition(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "----";
  return number.toLocaleString("en-US");
}

function truncateAddress(address) {
  if (!address) return "a friend on Hudi";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getReferralLink(code, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  if (!code) return "";
  return `https://hudi.com?ref=${code}`;
}

function getWaitlistErrorMessage(err) {
  if (err instanceof ApiClientError) {
    if (err.status === 404) {
      return "The waitlist API is not available from this local Vite server. Run through Vercel dev or a deployment to check your spot.";
    }
    if (err.code === "email_or_wallet_required") {
      return "We could not find an email or wallet for this session. Please sign in again.";
    }
    if (err.code === "invalid_referral_code") {
      return "This referral link looks invalid. Remove the ref code and try again.";
    }
  }
  if (err?.message === "auth_required") return "Please sign in first, then we can check your waitlist spot.";
  return "We could not check your waitlist spot yet. Please try again.";
}

function ModalFrame({ open, title = "Hudi", onClose, children, className = "" }) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(open);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setClosing(false);
      setEntered(false);
      requestAnimationFrame(() => setEntered(true));
      return;
    }
    if (!shouldRender) return;
    setClosing(true);
    setEntered(false);
    const timer = window.setTimeout(() => setShouldRender(false), 220);
    return () => window.clearTimeout(timer);
  }, [open, shouldRender]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      className={`hudi-flow-backdrop${entered && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`hudi-flow-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="hudi-flow-topbar">
          <h2 className="hudi-flow-kicker">{title}</h2>
          <button className="hudi-flow-close" type="button" onClick={onClose} aria-label="Close" />
        </div>
        <div className="hudi-flow-body">{children}</div>
      </section>
    </div>
  );
}

function StepDots({ index }) {
  return (
    <div className="hudi-flow-steps" aria-hidden="true">
      {[0, 1, 2].map((stepIndex) => (
        <span key={stepIndex} className={`hudi-flow-step-dot${stepIndex <= index ? " is-active" : ""}`} />
      ))}
    </div>
  );
}

function QueuePosition({ position }) {
  return (
    <div className="hudi-flow-position">
      <span className="hudi-flow-position-line">
        <span className="hudi-flow-position-copy">you're</span>
        <strong>#{formatPosition(position)}</strong>
        <span className="hudi-flow-position-copy">in line</span>
      </span>
    </div>
  );
}

function WaitlistLoadingMatrix() {
  return (
    <div className="hudi-flow-loading-matrix" role="status" aria-label="Checking your waitlist spot">
      {Array.from({ length: 9 }, (_, index) => <span key={index} style={{ "--dot-index": index }} />)}
    </div>
  );
}

function ReferralStats({ referrals, referredUsers, followedX, joinedTelegram }) {
  const boostedSpots = (followedX ? ACTION_BOOST : 0)
    + (joinedTelegram ? ACTION_BOOST : 0)
    + Math.min(referrals, MAX_REFERRAL_BOOST_COUNT) * REFERRAL_BOOST;
  return (
    <div className="hudi-flow-referral-stats">
      {referredUsers.length > 0 && (
        <div className="hudi-flow-referral-avatars" aria-hidden="true">
          {referredUsers.slice(0, 3).map((user, index) => (
            <img
              key={`${user.walletAddress || "anon"}-${index}`}
              className="hudi-flow-mini-avatar"
              src={`/hudi-pfp-${(index % 3) + 1}.png`}
              alt=""
            />
          ))}
          {referrals > 3 && <span className="hudi-flow-avatar-overflow">+{referrals - 3}</span>}
        </div>
      )}
      <span><Users size={13} weight="bold" /> {referrals} {referrals === 1 ? "friend" : "friends"} referred</span>
      <span><ArrowUp size={13} weight="bold" /> {boostedSpots.toLocaleString("en-US")} spots boosted</span>
    </div>
  );
}

function ReferralBox({ link, copied, onCopy }) {
  return (
    <div className="hudi-flow-referral-box">
      <span className="hudi-flow-referral-link">{link}</span>
      <button className="hudi-flow-button" type="button" onClick={onCopy}>
        <span className="hudi-flow-button-label">{copied ? "copied" : "copy"}</span>
      </button>
    </div>
  );
}

function WaitlistModal({ open, onClose, signupResult, resolveSignup, authReady }) {
  const [step, setStep] = useState("loading");
  const [signup, setSignup] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStep("loading");
      setSignup(null);
      setCopied(false);
      setError("");
      setRetryNonce(0);
      resolvedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !signupResult) return;
    resolvedRef.current = true;
    setSignup(signupResult);
    setError("");
    setStep(signupResult.alreadySignedUp ? "already-signed-up" : "follow-x");
  }, [open, signupResult]);

  useEffect(() => {
    if (!open || signupResult || !authReady) return;
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    let cancelled = false;
    setError("");
    setStep("loading");
    resolveSignup()
      .then((result) => {
        if (cancelled) return;
        setSignup(result);
        setError("");
        setStep(result.alreadySignedUp ? "already-signed-up" : "follow-x");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[waitlist] resolve failed", err);
        setError(getWaitlistErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, open, resolveSignup, retryNonce, signupResult]);

  const referralLink = getReferralLink(signup?.referralCode, signup?.referralUrl);
  const trackAction = async (action) => {
    if (!signup?.referralCode) return;
    try {
      const update = await api.track({ referralCode: signup.referralCode, action });
      setSignup((current) => ({ ...current, ...update }));
    } catch (err) {
      console.error("[track] failed", err);
    }
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[copy] failed", err);
    }
  };
  const handleShareX = () => {
    const text = `Just claimed my spot for @tradeonhudi - Asian equities perps, 24/7. Get in: ${referralLink}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <ModalFrame open={open} onClose={onClose} title={(step === "already-signed-up" || step === "loading") ? "Welcome back" : "Waitlist"}>
      {step === "loading" && (
        <div className="hudi-flow-stack hudi-flow-centered">
          <WaitlistLoadingMatrix />
          <h3 className="hudi-flow-title">Checking your spot</h3>
          <p className="hudi-flow-copy">One sec. Looking up your waitlist position.</p>
          {error && <p className="hudi-flow-error">{error}</p>}
          {error && (
            <button
              className="hudi-flow-button"
              type="button"
              onClick={() => {
                resolvedRef.current = false;
                setError("");
                setRetryNonce((value) => value + 1);
              }}
            >
              <span className="hudi-flow-button-label">try again</span>
            </button>
          )}
        </div>
      )}

      {signup && step === "follow-x" && (
        <div className="hudi-flow-stack">
          <StepDots index={0} />
          <QueuePosition position={signup.position} />
          <p className="hudi-flow-copy">Follow us on X to climb 100 spots in the waitlist.</p>
          <a
            className="hudi-flow-button is-primary"
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void trackAction("followed_x");
              window.setTimeout(() => setStep("join-tg"), 300);
            }}
          >
            <span className="hudi-flow-button-shine" aria-hidden="true" />
            <XLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">follow @tradeonhudi</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />100</span>
          </a>
          <button className="hudi-flow-secondary" type="button" onClick={() => setStep("join-tg")}>skip</button>
        </div>
      )}

      {signup && step === "join-tg" && (
        <div className="hudi-flow-stack">
          <StepDots index={1} />
          <QueuePosition position={signup.position} />
          <p className="hudi-flow-copy">Join our Telegram to climb another 100 spots and get early alpha drops.</p>
          <a
            className="hudi-flow-button is-primary"
            href={TG_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void trackAction("joined_telegram");
              window.setTimeout(() => setStep("share"), 300);
            }}
          >
            <span className="hudi-flow-button-shine" aria-hidden="true" />
            <TelegramLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">join telegram</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />100</span>
          </a>
          <button className="hudi-flow-secondary" type="button" onClick={() => setStep("share")}>skip</button>
        </div>
      )}

      {signup && step === "share" && (
        <div className="hudi-flow-stack">
          <StepDots index={2} />
          <QueuePosition position={signup.position} />
          <p className="hudi-flow-copy">Share your link to jump the queue. Up to 3 referrals boost your position.</p>
          <ReferralBox link={referralLink} copied={copied} onCopy={handleCopy} />
          <button className="hudi-flow-button is-primary" type="button" onClick={handleShareX}>
            <span className="hudi-flow-button-shine" aria-hidden="true" />
            <XLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">share on x</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />500</span>
          </button>
          <ReferralStats {...signup} />
        </div>
      )}

      {signup && step === "already-signed-up" && (
        <div className="hudi-flow-stack">
          <h3 className="hudi-flow-title">We got you here</h3>
          <QueuePosition position={signup.position} />
          <p className="hudi-flow-copy">Keep sharing your referral link to climb before launch.</p>
          <ReferralBox link={referralLink} copied={copied} onCopy={handleCopy} />
          <button className="hudi-flow-button is-primary" type="button" onClick={handleShareX}>
            <span className="hudi-flow-button-shine" aria-hidden="true" />
            <XLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">share on x</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />500</span>
          </button>
          <ReferralStats {...signup} />
          <div className="hudi-flow-divider" />
          <a className="hudi-flow-button" href={X_URL} target="_blank" rel="noopener noreferrer" onClick={() => void trackAction("followed_x")}>
            <XLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">follow @tradeonhudi</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />100</span>
          </a>
          <a className="hudi-flow-button" href={TG_URL} target="_blank" rel="noopener noreferrer" onClick={() => void trackAction("joined_telegram")}>
            <TelegramLogo size={18} weight="fill" /> <span className="hudi-flow-button-label">join telegram</span> <span className="hudi-flow-boost"><ArrowUp size={14} weight="bold" />100</span>
          </a>
        </div>
      )}
    </ModalFrame>
  );
}

function AccessCodeModal({ open, onClose, onWaitlist }) {
  const [chars, setChars] = useState(Array(8).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputsRef = useRef([]);
  const panelRef = useRef(null);
  const code = chars.join("");
  const valid = code.length === 8 && /^[A-Z0-9]+$/.test(code);

  useEffect(() => {
    if (!open) {
      setChars(Array(8).fill(""));
      setSubmitting(false);
      setInvalid(false);
      return;
    }
    window.setTimeout(() => inputsRef.current[0]?.focus(), 80);
  }, [open]);

  const focusBox = (index) => {
    const target = inputsRef.current[Math.max(0, Math.min(7, index))];
    target?.focus();
    target?.select();
  };

  const writeChars = (start, value) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!clean) return start;
    setChars((prev) => {
      const next = [...prev];
      for (let index = 0; index < clean.length && start + index < 8; index += 1) {
        next[start + index] = clean[index];
      }
      return next;
    });
    return Math.min(start + clean.length, 7);
  };

  const clearChar = (index) => {
    setChars((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
  };

  const shake = () => {
    const el = panelRef.current;
    if (!el || typeof el.animate !== "function") return;
    el.animate([
      { transform: "translateX(0) rotate(0)" },
      { transform: "translateX(-5px) rotate(-0.45deg)", offset: 0.18 },
      { transform: "translateX(5px) rotate(0.45deg)", offset: 0.4 },
      { transform: "translateX(-3px) rotate(-0.3deg)", offset: 0.62 },
      { transform: "translateX(3px) rotate(0.3deg)", offset: 0.84 },
      { transform: "translateX(0) rotate(0)" }
    ], { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)", composite: "add" });
  };
  const submit = () => {
    if (!valid || submitting) {
      setInvalid(true);
      shake();
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setInvalid(true);
      shake();
    }, 350);
  };

  return (
    <ModalFrame open={open} onClose={onClose} title="Access code">
      <div ref={panelRef} className="hudi-flow-stack">
        <h3 className="hudi-flow-title">Enter your access code</h3>
        <p className="hudi-flow-copy">Got an early-access code? Drop it in to start trading.</p>
        <div className="hudi-flow-code-row">
          {chars.map((char, index) => (
            <span key={index} className={`hudi-flow-code-cell${invalid ? " is-invalid" : ""}`}>
            <input
              ref={(el) => { inputsRef.current[index] = el; }}
              className={`hudi-flow-code-input${invalid ? " is-invalid" : ""}`}
              value={char}
              maxLength={1}
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => {
                setInvalid(false);
                const raw = event.target.value;
                if (raw === "") {
                  clearChar(index);
                  return;
                }
                focusBox(writeChars(index, raw));
              }}
              onPaste={(event) => {
                event.preventDefault();
                setInvalid(false);
                focusBox(writeChars(index, event.clipboardData.getData("text")));
              }}
              onFocus={(event) => {
                event.target.select();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                  return;
                }
                if (event.key === "Backspace") {
                  if (chars[index]) {
                    setInvalid(false);
                    return;
                  }
                  event.preventDefault();
                  if (index > 0) {
                    setInvalid(false);
                    clearChar(index - 1);
                    focusBox(index - 1);
                  }
                  return;
                }
                if (event.key === "ArrowLeft" && index > 0) {
                  event.preventDefault();
                  focusBox(index - 1);
                  return;
                }
                if (event.key === "ArrowRight" && index < 7) {
                  event.preventDefault();
                  focusBox(index + 1);
                }
              }}
              aria-label={`Access code character ${index + 1} of 8`}
            />
            </span>
          ))}
        </div>
        {invalid && <p className="hudi-flow-error">That access code is not open yet.</p>}
        <button className="hudi-flow-button is-primary" type="button" onClick={submit} disabled={submitting}>
          <span className="hudi-flow-button-shine" aria-hidden="true" />
          <span className="hudi-flow-button-label">{submitting ? "checking" : "continue"}</span>
        </button>
        <button className="hudi-flow-secondary" type="button" onClick={onWaitlist}>join the waitlist instead</button>
      </div>
    </ModalFrame>
  );
}

function ReferralModal({ open, onClose, onContinue, walletAddress, referralCode }) {
  const seed = walletAddress || referralCode || "hudi";
  const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}&size=128`;
  return (
    <ModalFrame open={open} onClose={onClose} title="Referral">
      <div className="hudi-flow-stack hudi-flow-centered">
        <img className="hudi-flow-avatar" src={avatarUrl} alt="" width={104} height={104} />
        <p className="hudi-flow-copy">You've been tapped in by</p>
        <h3 className="hudi-flow-title">{truncateAddress(walletAddress)}</h3>
        <p className="hudi-flow-copy">Hudi is opening 24/7 Asian equities perps. Your friend just bumped you up the line.</p>
        <button className="hudi-flow-button is-primary" type="button" onClick={onContinue}><span className="hudi-flow-button-shine" aria-hidden="true" /><span className="hudi-flow-button-label">claim your spot</span></button>
      </div>
    </ModalFrame>
  );
}

function MissingPrivyRuntime() {
  const [accessOpen, setAccessOpen] = useState(false);
  useEffect(() => {
    const openAccess = () => setAccessOpen(true);
    const buttons = [".landing-final-button", ".market-copy-button"]
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    buttons.forEach((button) => button.addEventListener("click", openAccess));
    return () => buttons.forEach((button) => button.removeEventListener("click", openAccess));
  }, []);
  return (
    <AccessCodeModal
      open={accessOpen}
      onClose={() => setAccessOpen(false)}
      onWaitlist={() => {
        setAccessOpen(false);
        console.warn("[hudi] VITE_PRIVY_APP_ID is required for waitlist auth.");
      }}
    />
  );
}

function HudiLandingRuntime() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [signupResult, setSignupResult] = useState(null);
  const [referrerWallet, setReferrerWallet] = useState(null);
  const incomingRef = useMemo(readIncomingRefCode, []);
  const referralCheckedRef = useRef(false);
  const lastPrivySuiAddressRef = useRef(null);
  const dAppKitApi = useDAppKit();
  const currentAccount = useCurrentAccount();
  const { ready: privyReady, authenticated: privyAuthed, user: privyUser, logout: privyLogout } = usePrivy();
  const { createWallet: createPrivyWallet } = useCreatePrivyWallet();
  const isConnected = !!currentAccount || privyAuthed;

  const runSignup = useCallback(async (input) => {
    const res = await api.signup({
      email: input.email,
      walletAddress: input.walletAddress,
      referredByCode: incomingRef ?? undefined
    });
    setSignupResult(res);
    setWaitlistOpen(true);
    return res;
  }, [incomingRef]);

  const { login: privyLogin } = useLogin({
    onComplete: async ({ user: completedUser }) => {
      try {
        let suiAddress = findSuiAddressInPrivyUser(completedUser);
        if (!suiAddress) {
          const result = await createPrivyWallet({ chainType: "sui" });
          suiAddress = result.wallet.address;
        }
        lastPrivySuiAddressRef.current = suiAddress;
        const privyEmail = completedUser.email?.address ?? completedUser.google?.email;
        await runSignup({ email: privyEmail, walletAddress: suiAddress });
      } catch (err) {
        console.error("[privy] signup failed", err);
        setSignupResult(null);
        setWaitlistOpen(true);
      }
    },
    onError: (errorCode) => {
      if (errorCode !== "exited_auth_flow") console.error("[privy] login error", errorCode);
    }
  });

  const openWaitlist = useCallback(() => {
    setSignupResult(null);
    setWaitlistOpen(true);
  }, []);
  const openAccess = useCallback(() => setAccessOpen(true), []);
  const requestWaitlistAuth = useCallback(() => {
    if (isConnected) {
      openWaitlist();
      return;
    }
    privyLogin({ loginMethods: ["email", "google"] });
  }, [isConnected, openWaitlist, privyLogin]);

  useEffect(() => {
    const label = document.querySelector(".landing-start-button .pill-label");
    if (label) label.textContent = isConnected ? "check waitlist" : "join waitlist";
  }, [isConnected]);

  const resolveSignup = useCallback(async () => {
    const externalAddress = currentAccount?.address;
    const privySuiAddress = privyAuthed
      ? (findSuiAddressInPrivyUser(privyUser) ?? lastPrivySuiAddressRef.current ?? undefined)
      : undefined;
    const privyEmail = privyUser?.email?.address ?? privyUser?.google?.email;

    if (externalAddress) return runSignup({ walletAddress: externalAddress });
    if (privySuiAddress || privyEmail) return runSignup({ email: privyEmail, walletAddress: privySuiAddress });
    throw new Error("auth_required");
  }, [currentAccount, privyAuthed, privyUser, runSignup]);

  useEffect(() => {
    const startButton = document.querySelector(".landing-start-button");
    const finalButtons = Array.from(document.querySelectorAll(".landing-final-button"));
    const marketButtons = Array.from(document.querySelectorAll(".market-copy-button"));
    const chatButtons = Array.from(document.querySelectorAll(".chat-copy-button"));

    startButton?.addEventListener("click", requestWaitlistAuth);
    finalButtons.forEach((button) => button.addEventListener("click", openAccess));
    marketButtons.forEach((button) => button.addEventListener("click", openAccess));
    chatButtons.forEach((button) => button.addEventListener("click", openAccess));

    return () => {
      startButton?.removeEventListener("click", requestWaitlistAuth);
      finalButtons.forEach((button) => button.removeEventListener("click", openAccess));
      marketButtons.forEach((button) => button.removeEventListener("click", openAccess));
      chatButtons.forEach((button) => button.removeEventListener("click", openAccess));
    };
  }, [openAccess, requestWaitlistAuth]);

  useEffect(() => {
    if (!incomingRef || !privyReady || referralCheckedRef.current) return;
    referralCheckedRef.current = true;
    if (currentAccount || privyAuthed) return;

    setReferralOpen(true);
    let cancelled = false;
    api.referrer(incomingRef)
      .then((data) => {
        if (!cancelled && data.exists) setReferrerWallet(data.walletAddress);
      })
      .catch((err) => console.error("[referral] lookup failed", err));
    return () => {
      cancelled = true;
    };
  }, [currentAccount, incomingRef, privyAuthed, privyReady]);

  useEffect(() => {
    window.hudiLandingAuth = {
      openAccess,
      openWaitlist: requestWaitlistAuth,
      disconnect: async () => {
        if (currentAccount) await dAppKitApi.disconnectWallet().catch((err) => console.error("[disconnect] dapp-kit failed", err));
        if (privyAuthed) await privyLogout().catch((err) => console.error("[disconnect] privy failed", err));
      }
    };
    return () => {
      delete window.hudiLandingAuth;
    };
  }, [currentAccount, dAppKitApi, openAccess, privyAuthed, privyLogout, requestWaitlistAuth]);

  return (
    <>
      <ReferralModal
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        onContinue={() => {
          setReferralOpen(false);
          requestWaitlistAuth();
        }}
        walletAddress={referrerWallet}
        referralCode={incomingRef ?? ""}
      />
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => {
          setWaitlistOpen(false);
          setSignupResult(null);
        }}
        signupResult={signupResult}
        resolveSignup={resolveSignup}
        authReady={privyReady}
      />
      <AccessCodeModal
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        onWaitlist={() => {
          setAccessOpen(false);
          requestWaitlistAuth();
        }}
      />
    </>
  );
}

function AppRoot() {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
  if (!privyAppId) {
    console.warn("[hudi] Missing VITE_PRIVY_APP_ID. Access-code modal is active; Privy waitlist auth is disabled.");
    return <MissingPrivyRuntime />;
  }

  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["email", "google"],
          appearance: {
            theme: "light",
            accentColor: "#0080FF",
            loginMessage: "Enter your email to claim your spot on the waitlist.",
            walletChainType: "ethereum-and-solana"
          },
          embeddedWallets: {
            ethereum: { createOnLogin: "off" },
            solana: { createOnLogin: "off" }
          }
        }}
      >
        <HudiLandingRuntime />
      </PrivyProvider>
    </DAppKitProvider>
  );
}

export default AppRoot;
