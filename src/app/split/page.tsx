import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SplitPage() {
  return (
    <div style={{ padding: "4rem 2rem", textAlign: "center", minHeight: "100vh" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem", color: "var(--primary)" }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Split PDF (Coming Soon)</h1>
      <p style={{ opacity: 0.7 }}>This tool is currently under development.</p>
    </div>
  );
}
