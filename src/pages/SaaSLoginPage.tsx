import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { saasService } from "@/services/saasService";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SaaSLoginPage = () => {
  const navigate = useNavigate();
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      // Check if platform admin
      setChecking(true);
      saasService.isPlatformAdmin().then((isAdmin) => {
        if (isAdmin) {
          navigate("/saas/dashboard", { replace: true });
        } else {
          setError("You do not have platform administrator access.");
          setChecking(false);
        }
      });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-lg border-primary/20">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Platform Admin</CardTitle>
            <CardDescription>Sign in with your platform administrator credentials</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}
            {checking ? (
              <p className="text-center text-muted-foreground">Verifying access...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">Sign In</Button>
              </form>
            )}
          </CardContent>
        </Card>
        <div className="text-center">
          <button onClick={() => navigate("/auth")} className="text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to School Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaaSLoginPage;
