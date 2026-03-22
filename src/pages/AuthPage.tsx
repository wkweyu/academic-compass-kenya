import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { saasService } from "@/services/saasService";
import { useRateLimit } from "@/hooks/useRateLimit";
import { Building2, ArrowLeft, LogIn, UserPlus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const AuthPage = () => {
  const navigate = useNavigate();
  const { user, login, register, loading } = useAuth();
  const { rateLimited, retryAfter, attemptsRemaining, checkLimit, recordAttempt } = useRateLimit();

  const [step, setStep] = useState<"school_code" | "credentials">("school_code");
  const [schoolCode, setSchoolCode] = useState("");
  const [school, setSchool] = useState<{ id: number; name: string; code: string; logo: string | null } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [lookingUp, setLookingUp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!loading && user && school) {
      // Verify user belongs to the looked-up school
      setVerifying(true);
      saasService.verifyUserSchool(school.id).then((belongs) => {
        if (belongs) {
          navigate("/dashboard", { replace: true });
        } else {
          setError("Your account is not associated with this school. Please check the school code.");
          setVerifying(false);
        }
      });
    } else if (!loading && user && !school) {
      // User is logged in but no school selected (direct nav)
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate, school]);

  const handleSchoolLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLookingUp(true);

    try {
      const result = await saasService.lookupSchoolByCode(schoolCode.trim());
      if (!result) {
        setError("School not found. Please check the code and try again.");
        return;
      }
      if (!result.active) {
        setError("This school account is currently inactive. Contact your administrator.");
        return;
      }
      setSchool(result);
      setStep("credentials");
    } catch (err: any) {
      setError(err.message || "Failed to look up school");
    } finally {
      setLookingUp(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Rate limit check
    const identifier = `${email.toLowerCase()}:${school?.code || ""}`;
    const allowed = await checkLimit(identifier);
    if (!allowed) return;

    try {
      if (mode === "login") {
        await login(email, password);
        await recordAttempt(identifier, true);
      } else {
        await register(email, password, password);
        await recordAttempt(identifier, true);
      }
    } catch (err: any) {
      await recordAttempt(identifier, false);
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-muted to-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              SkoolTrack Pro
            </CardTitle>
            <CardDescription>
              {step === "school_code"
                ? "Enter your school code to get started"
                : `Signing into ${school?.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {rateLimited && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Too many login attempts. Try again in {retryAfter} seconds.</span>
              </div>
            )}

            {verifying ? (
              <p className="text-center text-muted-foreground">Verifying school access...</p>
            ) : step === "school_code" ? (
              <form onSubmit={handleSchoolLookup} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    School Code
                  </label>
                  <Input
                    placeholder="e.g. SCH001"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    required
                    className="text-center text-lg font-mono tracking-widest"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Your school code was provided by your administrator
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={lookingUp || !schoolCode.trim()}>
                  {lookingUp ? "Looking up..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                {school && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-2">
                    <Building2 className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{school.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{school.code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStep("school_code"); setSchool(null); setError(null); }}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {attemptsRemaining <= 2 && !rateLimited && (
                  <p className="text-xs text-amber-600">
                    {attemptsRemaining} login attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                  </p>
                )}

                <Button type="submit" className="w-full gap-2" disabled={rateLimited}>
                  {mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Button>

                <p className="text-sm text-center text-muted-foreground">
                  {mode === "login" ? (
                    <>
                      Need an account?{" "}
                      <button type="button" className="text-primary underline font-medium" onClick={() => setMode("register")}>
                        Register
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button type="button" className="text-primary underline font-medium" onClick={() => setMode("login")}>
                        Sign In
                      </button>
                    </>
                  )}
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/saas/login")}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Platform Administrator Login →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
