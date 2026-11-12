import Image from "next/image"
import type { Metadata } from "next"
import { CalendarRange, FileCheck2, ShieldCheck } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to DaryelCare leave and compliance management",
}

const highlights = [
  { icon: CalendarRange, title: "Leave at a glance", text: "See who is off across every branch, and when." },
  { icon: FileCheck2, title: "Right-to-work tracking", text: "Passport, BRP and visa expiry, flagged in time." },
  { icon: ShieldCheck, title: "Branch-level access", text: "Managers see their own branches. Admins see everything." },
]

export default function LoginPage() {
  return (
    <div className="flex min-h-svh bg-background">
      {/* Brand panel (large screens) */}
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden border-r border-border/70 bg-card p-12 lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,hsl(var(--primary)/0.10),transparent_70%),radial-gradient(50%_40%_at_90%_90%,hsl(var(--success)/0.08),transparent_70%)]"
        />
        <Image src="/images/daryelcare-wordmark.png" alt="DaryelCare" width={190} height={33} priority className="relative h-[33px] w-auto self-start" />

        <div className="relative space-y-10">
          <div className="space-y-4">
            <p className="eyebrow text-primary">Leave &amp; compliance</p>
            <h2 className="max-w-md text-[38px] font-semibold leading-[1.1] tracking-[-0.035em]">
              Every branch, every carer, in one calm place.
            </h2>
          </div>
          <ul className="space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card text-primary shadow-card">
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="space-y-0.5 pt-0.5">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} DaryelCare</p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="page-enter flex w-full justify-center">
          <LoginForm />
        </div>
      </main>
    </div>
  )
}
