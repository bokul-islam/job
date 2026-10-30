"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui";

const COLORS = ["#0b2447", "#0ba5a0", "#648ac6", "#f59e0b", "#ef4444", "#8b5cf6", "#9ca3af"];

export function StatusDonut({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <Card>
      <CardHeader title={title} subtitle={`${total} total`} />
      <div className="h-56 p-4">
        {total === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-gray-400">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4">
        {data.map((d, i) => (
          <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </Card>
  );
}

export function MiniBarChart({ title, subtitle, data, xKey = "name", yKey = "value" }: {
  title: string; subtitle?: string; data: Record<string, string | number>[]; xKey?: string; yKey?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="h-56 p-4">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-gray-400">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey={yKey} fill="#0b2447" radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

export function GrowthLine({ title, data }: { title: string; data: { month: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader title={title} subtitle="Registrations per month" />
      <div className="h-60 p-4">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-gray-400">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0ba5a0" strokeWidth={2.5} dot={{ r: 3, fill: "#0ba5a0" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
