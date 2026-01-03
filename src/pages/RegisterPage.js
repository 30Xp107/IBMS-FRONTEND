import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Utensils, Eye, EyeOff, ArrowLeft } from "lucide-react";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      await register(name, email, password);
      toast.success("Registration successful! Please wait for admin approval.");
      navigate("/login");
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.detail || "Registration failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero image */}
      <div
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1734174051632-c99a253ddb9d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxmaWxpcGlubyUyMGZpZWxkJTIwd29ya2VyJTIwdGFibGV0fGVufDB8fHx8MTc2NjcyNjY3NXww&ixlib=rb-4.1.0&q=85')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-900/70" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Utensils className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Walang Gutom</h1>
              <p className="text-emerald-400">Program</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Join Our Team
          </h2>
          <p className="text-lg text-slate-300 max-w-md">
            Register to become part of the program. Once approved by an administrator, 
            you'll be assigned to a specific area to manage beneficiary data.
          </p>
          <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-emerald-400 mb-2">Registration Process</h3>
            <ol className="text-sm text-slate-300 space-y-2">
              <li>1. Fill out the registration form</li>
              <li>2. Wait for admin approval</li>
              <li>3. Get assigned to your area</li>
              <li>4. Start managing beneficiary data</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Right side - Register form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-stone-50">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
          >
            <ArrowLeft size={18} />
            Back to Login
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Utensils className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">WGP</h1>
              <p className="text-xs text-slate-500">Walang Gutom Program</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Create Account</h2>
              <p className="text-slate-500 mt-1">Register for a new account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  data-testid="register-name"
                  placeholder="Juan Dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="register-email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    data-testid="register-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-700">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  data-testid="register-confirm-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 text-slate-900"
                />
              </div>

              <Button
                type="submit"
                data-testid="register-submit-btn"
                className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" /> Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="text-center mt-6 text-slate-600">
              Already have an account?{" "}
              <Link
                to="/login"
                data-testid="login-link"
                className="text-emerald-700 font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center mt-6 text-sm text-slate-500">
            &copy; 2025 Walang Gutom Program. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
