"use client";

import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { login } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("passwordChanged") === "1") setNotice("Parolingiz o'zgartirildi. Yangi parol bilan qayta kiring."); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(identifier.trim(), password);
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kirish amalga oshmadi.");
    } finally { setPending(false); }
  }

  return <main className="login-page">
    <div className="login-brand"><span className="brand-mark"><img src="/best-team-logo.webp" alt="" /></span><span>BestTeam <strong>Control</strong></span></div>
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-icon"><ShieldCheck size={25} /></div>
      <p className="eyebrow">XUSUSI BOSHQARUV</p>
      <h1 id="login-title">Tizimga kirish</h1>
      <p className="muted">Restoranlar holati va faoliyatini boshqarish uchun egasi hisobidan kiring.</p>
      <form onSubmit={submit} className="form-stack">
      {notice && <p className="notice" role="status">{notice}</p>}
        <label>Login yoki telefon<input autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} required /></label>
        <label>Parol<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full" disabled={pending} type="submit"><LockKeyhole size={16} />{pending ? "Tekshirilmoqda..." : "Kirish"}<ArrowRight size={16} /></button>
      </form>
    </section>
  </main>;
}
