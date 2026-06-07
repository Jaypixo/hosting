"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Github, LogOut, RefreshCw, Rocket } from "lucide-react";
import { apiFetch, authStartUrl, clearSessionToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
};

type Project = {
  id: string;
  githubRepoFullName: string;
  githubRepoName: string;
  buildCommand: string;
  outputDir: string;
  subdomain: string;
  webhookSecret?: string;
  latestSuccessfulDeploymentId: string | null;
  deployments: Array<{
    id: string;
    status: string;
    createdAt: string;
    commitSha: string;
    branch: string;
  }>;
  customDomains: Array<{ hostname: string }>;
};

export default function DashboardPage() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "myhosting.com";
  const [ready, setReady] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDir, setOutputDir] = useState("dist");
  const [subdomain, setSubdomain] = useState("");
  const [createdProjectSecret, setCreatedProjectSecret] = useState<string | null>(null);

  const selectedRepo = useMemo(() => repos.find((repo) => String(repo.id) === selectedRepoId), [repos, selectedRepoId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [reposResponse, projectsResponse] = await Promise.all([
        apiFetch<{ repos: Repo[] }>("/github/repos"),
        apiFetch<{ projects: Project[] }>("/github/projects")
      ]);

      setRepos(reposResponse.repos);
      setProjects(projectsResponse.projects);

      if (!selectedRepoId && reposResponse.repos[0]) {
        setSelectedRepoId(String(reposResponse.repos[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("hosting_session")) {
      setReady(true);
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProject() {
    if (!selectedRepo) return;
    setLoading(true);
    try {
      const response = await apiFetch<{ project: Project & { webhookSecret: string } }>("/github/projects", {
        method: "POST",
        body: JSON.stringify({
          githubRepoId: String(selectedRepo.id),
          githubRepoFullName: selectedRepo.full_name,
          githubRepoName: selectedRepo.name,
          githubDefaultBranch: selectedRepo.default_branch,
          buildCommand,
          outputDir,
          subdomain
        })
      });

      setCreatedProjectSecret(response.project.webhookSecret || null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  async function triggerDeploy(projectId: string) {
    setLoading(true);
    try {
      await apiFetch(`/github/projects/${projectId}/deploy`, {
        method: "POST",
        body: JSON.stringify({ commitSha: "manual" })
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger deployment");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <DashboardShell title="Loading dashboard..." />;
  }

  if (typeof window !== "undefined" && !localStorage.getItem("hosting_session")) {
    return <LoggedOutState />;
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Deploy GitHub repos to Cloudflare edge</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Connect a repository, choose a build command and output directory, then push to watch the deployment pipeline run.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearSessionToken();
                window.location.reload();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="mb-6 border-red-400/20 bg-red-500/5">
            <CardContent className="py-4 text-red-200">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5 text-cyan-300" />
                GitHub onboarding
              </CardTitle>
              <CardDescription>Connect a repository, configure the build settings, and create a deployment-ready project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <a href={authStartUrl()}>
                  <Button>
                    Connect GitHub
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <Badge>{repos.length} accessible repositories</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="repo">Repository</Label>
                  <Select id="repo" value={selectedRepoId} onChange={(event) => setSelectedRepoId(event.target.value)}>
                    {repos.length === 0 ? <option value="">Connect GitHub to list repos</option> : null}
                    {repos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.full_name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subdomain">Project subdomain</Label>
                  <Input
                    id="subdomain"
                    value={subdomain}
                    onChange={(event) => setSubdomain(event.target.value)}
                    placeholder="my-site"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="buildCommand">Build command</Label>
                  <Input id="buildCommand" value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="outputDir">Output directory</Label>
                  <Input id="outputDir" value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={createProject} disabled={loading || !selectedRepo}>
                  Create project
                </Button>
                <span className="text-sm text-slate-400">
                  Defaults: <span className="font-mono text-slate-200">npm run build</span> and <span className="font-mono text-slate-200">dist</span>
                </span>
              </div>

              {createdProjectSecret ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-sm font-medium text-cyan-100">Webhook configuration</p>
                  <p className="mt-2 text-sm text-slate-200">
                    Payload URL: <span className="font-mono">http://localhost:4000/webhooks/github</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-200">
                    Secret: <span className="font-mono break-all">{createdProjectSecret}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Copy this secret into the GitHub repository webhook you want to connect.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment overview</CardTitle>
              <CardDescription>Latest projects, domains, and deployment IDs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 ? (
                <p className="text-sm text-slate-400">No projects yet. Create one from the onboarding panel.</p>
              ) : (
                projects.map((project) => {
                  const latestDeployment = project.deployments[0];
                  return (
                    <div key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{project.githubRepoFullName}</p>
                          <p className="text-xs text-slate-400">
                            {project.subdomain}.{rootDomain}
                            {project.customDomains.length ? ` · ${project.customDomains.map((domain) => domain.hostname).join(", ")}` : ""}
                          </p>
                        </div>
                        <Badge>{project.latestSuccessfulDeploymentId ? "deployed" : "idle"}</Badge>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-400">
                        <p>
                          Build: <span className="font-mono text-slate-200">{project.buildCommand}</span>
                        </p>
                        <p>
                          Output: <span className="font-mono text-slate-200">{project.outputDir}</span>
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {latestDeployment ? (
                          <Link href={`/deployments/${latestDeployment.id}`}>
                            <Button variant="secondary" size="sm">
                              View logs
                            </Button>
                          </Link>
                        ) : null}
                        <Button variant="outline" size="sm" onClick={() => triggerDeploy(project.id)} disabled={loading}>
                          <Rocket className="mr-2 h-4 w-4" />
                          Deploy now
                        </Button>
                      </div>

                      {project.deployments.length ? (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-2">
                            {project.deployments.map((deployment) => (
                              <div key={deployment.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                                <div>
                                  <p className="font-mono text-xs text-slate-200">{deployment.commitSha.slice(0, 8)}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {deployment.branch} · {new Date(deployment.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <Link href={`/deployments/${deployment.id}`} className="text-xs text-cyan-300 hover:text-cyan-200">
                                  Logs
                                  <ExternalLink className="ml-1 inline-block h-3 w-3" />
                                </Link>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function DashboardShell({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-md text-center">
        <CardTitle>{title}</CardTitle>
      </Card>
    </main>
  );
}

function LoggedOutState() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-lg text-center">
        <CardHeader>
          <CardTitle>Sign in to continue</CardTitle>
          <CardDescription>Use GitHub OAuth to connect your account and view repositories.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={authStartUrl()}>
            <Button>
              Connect GitHub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </CardContent>
      </Card>
    </main>
  );
}

