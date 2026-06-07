"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Deployment = {
  id: string;
  status: string;
  logs: string;
  commitSha: string;
  branch: string;
  artifactPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  project: {
    id: string;
    githubRepoFullName: string;
    subdomain: string;
  };
};

export default function DeploymentPage() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "myhosting.com";
  const params = useParams<{ id: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await apiFetch<{ deployment: Deployment }>(`/deployments/${params.id}`);
      if (cancelled) return;
      setDeployment(response.deployment);
      setLogs(response.deployment.logs);
    }

    void load();

    const interval = window.setInterval(async () => {
      try {
        const response = await apiFetch<{ logs: string; status: string }>(`/deployments/${params.id}/logs`);
        if (!cancelled) {
          setLogs(response.logs);
          setDeployment((current) => (current ? { ...current, status: response.status } : current));
        }
      } catch {
        // keep polling until the deployment becomes available
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [params.id]);

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Deployment</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{deployment?.project.githubRepoFullName ?? "Loading deployment..."}</h1>
            <p className="mt-2 text-slate-400">
              {deployment ? `${deployment.branch} · ${deployment.commitSha}` : "Fetching deployment state"}
            </p>
          </div>
          <div className="flex gap-3">
            {deployment?.project?.subdomain ? (
              <a href={`https://${deployment.project.subdomain}.${rootDomain}`}>
                <Button variant="secondary">Open site</Button>
              </a>
            ) : null}
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Build status
              <Badge>{deployment?.status ?? "loading"}</Badge>
            </CardTitle>
            <CardDescription>Tail logs and final build metadata for the selected deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Artifact</p>
                <p className="mt-2 font-mono text-sm text-slate-200">{deployment?.artifactPath || "Pending"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Created</p>
                <p className="mt-2 text-sm text-slate-200">{deployment ? new Date(deployment.createdAt).toLocaleString() : "..."}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Error</p>
                <p className="mt-2 text-sm text-slate-200">{deployment?.errorMessage || "None"}</p>
              </div>
            </div>

            <Separator />

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-cyan-100">
                {logs || "Logs will appear here as the worker streams build output."}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
