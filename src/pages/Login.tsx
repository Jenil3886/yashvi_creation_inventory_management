import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Fingerprint,
  PlusCircle,
  Link2,
  ArrowLeft,
} from "lucide-react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import useAuthStore from "../store/useAuthStore";
import apiClient from "../services/apiClient";

export const Login: React.FC = () => {
  const { token, userId, setAuth, setRegisteredUserId } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Device Linking states
  const [showLinkingForm, setShowLinkingForm] = useState(false);
  const [linkCodeInput, setLinkCodeInput] = useState("");

  useEffect(() => {
    // If already authenticated, redirect to Dashboard
    if (token) {
      navigate("/");
    }
  }, [token, navigate]);

  const handleRegisterDevice = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch options from server
      const resOptions = await apiClient.post("/auth/register-options");
      const { options, stateToken } = resOptions.data.data;

      // 2. Start biometric registration using browser authenticator
      const regResponse = await startRegistration(options);

      // 3. Verify response on backend
      const resVerify = await apiClient.post("/auth/register-verify", {
        credentialResponse: regResponse,
        stateToken,
      });

      if (resVerify.data.status === "success") {
        const { token, user } = resVerify.data.data;
        setAuth(token, user);
        navigate("/");
      } else {
        setError("Device registration failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Biometric registration cancelled or not supported.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch login options
      const resOptions = await apiClient.post("/auth/login-options", {
        userId,
      });
      const { options, stateToken } = resOptions.data.data;

      // 2. Start biometric unlock
      const authResponse = await startAuthentication(options);

      // 3. Verify assertion on backend
      const resVerify = await apiClient.post("/auth/login-verify", {
        credentialResponse: authResponse,
        stateToken,
      });

      if (resVerify.data.status === "success") {
        const { token, user } = resVerify.data.data;
        setAuth(token, user);
        navigate("/");
      } else {
        setError("Verification failed. Try again.");
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Biometric unlock cancelled or failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle device pairing verification
  const handleLinkSecondaryDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCodeInput.trim() || linkCodeInput.trim().length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify link code on backend and retrieve registration options
      const resLink = await apiClient.post("/auth/link-verify", {
        code: linkCodeInput.trim(),
      });

      const { options, stateToken } = resLink.data.data;

      // 2. Run WebAuthn registration on the secondary device
      const regResponse = await startRegistration(options);

      // 3. Post back registration assertion
      const resVerify = await apiClient.post("/auth/register-verify", {
        credentialResponse: regResponse,
        stateToken,
      });

      if (resVerify.data.status === "success") {
        const { token, user } = resVerify.data.data;
        setAuth(token, user);
        navigate("/");
      } else {
        setError("Device linking failed.");
      }
    } catch (err: any) {
      console.error("Linking error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Device pairing was cancelled or failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between min-h-[80vh] py-8">
      {/* App Branding */}
      <div className="flex flex-col items-center mt-8">
        <div className="w-16 h-16 bg-[#003229]/10 rounded-2xl flex items-center justify-center border border-brand-500/20 shadow-lg glow-brand mb-4">
          <ShieldCheck size={36} className="text-brand-500" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-center bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400 bg-clip-text text-transparent">
          Yashvi Creation
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Wholesale Purchase Management
        </p>
      </div>

      {/* Main Panel */}
      <div className="my-auto flex flex-col items-center w-full">
        {showLinkingForm ? (
          // Link Device Input code form
          <div className="w-full max-w-sm p-6 bg-white dark:bg-darkCard rounded-2xl shadow-xl border border-slate-100 dark:border-darkBorder animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setShowLinkingForm(false);
                  setError(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Link to Primary Account
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-5">
              Enter the 6-digit code generated under settings on your primary
              device.
            </p>

            <form onSubmit={handleLinkSecondaryDevice} className="space-y-4">
              <input
                type="text"
                required
                maxLength={6}
                value={linkCodeInput}
                onChange={(e) =>
                  setLinkCodeInput(e.target.value.replace(/\D/g, ""))
                }
                placeholder="000 000"
                className="w-full tracking-[1em] text-center font-bold px-3 py-3 border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-darkBg rounded-xl text-lg focus:outline-none dark:text-slate-100"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] text-xs uppercase"
              >
                <Fingerprint size={16} />
                <span>{loading ? "Verifying Code..." : "Bind Biometrics"}</span>
              </button>
            </form>
          </div>
        ) : userId ? (
          // Welcome back state
          <div className="w-full max-w-sm p-6 bg-white dark:bg-darkCard rounded-2xl shadow-xl border border-slate-100 dark:border-darkBorder text-center animate-slide-up">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Welcome Back
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6 font-medium">
              Unlock the application using your device fingerprint, face, or
              PIN.
            </p>

            <button
              onClick={handleAuthenticate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all"
            >
              <Fingerprint size={20} />
              <span>{loading ? "Verifying..." : "Unlock App"}</span>
            </button>

            {/* Linking option trigger */}
            <button
              onClick={() => {
                setShowLinkingForm(true);
                setError(null);
              }}
              className="text-[10px] text-slate-400 hover:text-brand-500 mt-6 inline-flex items-center gap-1 font-bold uppercase transition-colors"
            >
              <Link2 size={12} />
              <span>Or Link as Secondary Device</span>
            </button>
          </div>
        ) : (
          // First time Registration state
          <div className="w-full max-w-sm p-6 bg-white dark:bg-darkCard rounded-2xl shadow-xl border border-slate-100 dark:border-darkBorder text-center animate-slide-up">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Register Device
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6 font-medium">
              No passwords, emails, or usernames. Initialize this device
              securely using biometrics.
            </p>

            <button
              onClick={handleRegisterDevice}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all"
            >
              <PlusCircle size={20} />
              <span>
                {loading ? "Initializing..." : "Register This Device"}
              </span>
            </button>

            {/* Linking option trigger */}
            <button
              onClick={() => {
                setShowLinkingForm(true);
                setError(null);
              }}
              className="text-[10px] text-slate-400 hover:text-brand-500 mt-6 inline-flex items-center gap-1 font-bold uppercase transition-colors"
            >
              <Link2 size={12} />
              <span>Link as Secondary Device</span>
            </button>
          </div>
        )}

        {/* Error reporting */}
        {error && (
          <div className="mt-6 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl max-w-xs text-center font-semibold animate-slide-up">
            {error}
          </div>
        )}
      </div>

      {/* Footer policy */}
      <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
        Protected by WebAuthn authentication protocols. Biometrics are processed
        on-device and never shared.
      </div>
    </div>
  );
};

export default Login;
