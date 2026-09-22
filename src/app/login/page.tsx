"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }

    // callbackUrl может быть абсолютным (его ставит middleware) —
    // router.push принимает только same-origin путь, иначе навигации нет.
    // Чужой origin отбрасываем (защита от open-redirect).
    let callbackUrl = "/";
    try {
      const u = new URL(searchParams.get("callbackUrl") ?? "/", window.location.origin);
      if (u.origin === window.location.origin) {
        callbackUrl = u.pathname + u.search + u.hash;
      }
    } catch {
      callbackUrl = "/";
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-head">
          <div className="login-logo">
            <span>L</span>
          </div>
          <div className="login-title">Limove OS</div>
          <p className="login-sub">Войдите в систему, чтобы продолжить</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-row">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@limove.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="notice notice--err">{error}</p>}

          <Button type="submit" className="btn-block" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  );
}
