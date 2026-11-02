import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Clock3, ShieldCheck, Wallet } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { formatZmw } from "@/lib/payments/manual-instructions.ts";
import { ORDER_STATUS_LABEL } from "@/lib/payments/order-status.ts";
import type { OrderStatus } from "@/lib/payments/types.ts";
import { PaymentOrderActions } from "@/components/admin/payment-order-actions";
import { PaymentDetailsForm, type PaymentDetailValues } from "@/components/admin/payment-details-form";

export const metadata = { title: "Payments — Admin Hub" };

type PageProps = { params: Promise<{ domain: string }> };

type OrderRow = {
  id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  payment_reference: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  payment_note: string | null;
  payment_submitted_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  created_at: string;
  user_id: string;
  course_id: string | null;
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  failed: "bg-slate-100 text-slate-500",
  refunded: "bg-slate-100 text-slate-500",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default async function TenantPaymentsPage({ params }: PageProps) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/admin/payments`);

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, admin_id, payment_settings")
    .eq("slug", domain)
    .maybeSingle();
  if (!company) notFound();

  // Payments are an admin job: company admins and super admins. Teachers see nothing here.
  const access = await getCurrentTenantAccess(company.id);
  const canManage = Boolean(
    access?.isSuperAdmin || access?.tenantRole === "company_admin" || company.admin_id === userId
  );
  if (!canManage) {
    return (
      <div className="container max-w-3xl py-16">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#fd5523]" />
          <h1 className="mt-4 text-2xl font-black text-[#062e39]">Payments are managed by academy admins</h1>
          <p className="mt-2 text-sm text-slate-500">Ask an academy admin to confirm payments for you.</p>
        </div>
      </div>
    );
  }

  const { data: courseRows } = await supabase.from("courses").select("id, title").eq("company_id", company.id);
  const courseTitles = new Map((courseRows ?? []).map((c) => [c.id, c.title]));
  const courseIds = [...courseTitles.keys()];

  let orders: OrderRow[] = [];
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, status, amount, currency, payment_reference, payment_method, transaction_id, payment_note, payment_submitted_at, rejection_reason, paid_at, created_at, user_id, course_id"
      )
      .in("course_id", courseIds)
      .order("created_at", { ascending: false })
      .limit(300);
    orders = (data ?? []) as OrderRow[];
  }

  const userIds = [...new Set(orders.map((o) => o.user_id))];
  const profileById = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
    for (const p of profiles ?? []) profileById.set(p.id, { full_name: p.full_name, email: p.email });
  }

  const awaiting = orders.filter((o) => o.status === "awaiting_confirmation");
  const waitingPayment = orders.filter((o) => o.status === "pending" || o.status === "rejected");
  const confirmed = orders.filter((o) => o.status === "paid" || o.status === "refunded").slice(0, 50);

  const stored = (company.payment_settings ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof stored[key] === "string" ? (stored[key] as string) : "");
  const details: PaymentDetailValues = {
    mtn: text("mtn"),
    airtel: text("airtel"),
    bank: text("bank"),
    instructions: text("instructions"),
  };

  const renderOrder = (order: OrderRow, withActions: boolean) => {
    const profile = profileById.get(order.user_id);
    return (
      <li key={order.id} className="space-y-4 rounded-[1.5rem] border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#062e39]">{profile?.full_name ?? "Learner"}</p>
            <p className="truncate text-xs text-slate-500">{profile?.email ?? order.user_id}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {courseTitles.get(order.course_id ?? "") ?? "Course"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-[#062e39]">{formatZmw(Number(order.amount))}</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[order.status]}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Reference</dt>
            <dd className="font-mono font-bold text-[#062e39]">{order.payment_reference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Transaction ID</dt>
            <dd className="break-all font-mono text-[#062e39]">{order.transaction_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Paid with</dt>
            <dd className="text-[#062e39]">{order.payment_method ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {order.status === "paid" ? "Confirmed" : "Submitted"}
            </dt>
            <dd className="text-[#062e39]">{formatDate(order.paid_at ?? order.payment_submitted_at ?? order.created_at)}</dd>
          </div>
        </dl>

        {order.payment_note && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-bold text-slate-500">Learner note: </span>
            {order.payment_note}
          </p>
        )}

        {order.status === "rejected" && order.rejection_reason && (
          <p className="text-sm text-red-600">
            <span className="font-bold">Rejected: </span>
            {order.rejection_reason}
          </p>
        )}

        {withActions && <PaymentOrderActions orderId={order.id} />}
      </li>
    );
  };

  return (
    <div className="container max-w-6xl py-12">
      <div className="space-y-10">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#fd5523]">Admin Hub</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-[#062e39]">Payments</h1>
          <p className="mt-2 text-lg font-medium text-slate-500">
            Confirm mobile money and bank payments for {company.name}. Confirming grants course access.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Awaiting confirmation", value: awaiting.length, icon: Clock3, accent: "bg-amber-50 text-amber-600" },
            { label: "Awaiting payment", value: waitingPayment.length, icon: Wallet, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Confirmed", value: confirmed.length, icon: ShieldCheck, accent: "bg-green-50 text-green-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${kpi.accent}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-black tracking-tight text-[#062e39]">{kpi.value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
            </div>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#062e39]">Awaiting confirmation</h2>
          {awaiting.length === 0 ? (
            <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No payments to check right now.
            </p>
          ) : (
            <ul className="space-y-4">{awaiting.map((o) => renderOrder(o, true))}</ul>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#062e39]">Awaiting payment</h2>
          {waitingPayment.length === 0 ? (
            <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No open orders.
            </p>
          ) : (
            <ul className="space-y-4">{waitingPayment.map((o) => renderOrder(o, false))}</ul>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#062e39]">Confirmed</h2>
          {confirmed.length === 0 ? (
            <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No confirmed payments yet.
            </p>
          ) : (
            <ul className="space-y-4">{confirmed.map((o) => renderOrder(o, false))}</ul>
          )}
        </section>

        <PaymentDetailsForm companyId={company.id} initial={details} />
      </div>
    </div>
  );
}
