"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SourceOperationsPanel() {
  const [running, setRunning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSync() {
    setRunning(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/run-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Sync failed.");
      }

      const count = Array.isArray(payload) ? payload.length : 1;
      setMessage(`Finished syncing ${count} active source${count === 1 ? "" : "s"}. Refresh to see the newest stored opportunities.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run source sync.");
    } finally {
      setRunning(false);
    }
  }

  async function runEnrichment() {
    setEnriching(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/run-enrichment", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Enrichment failed.");
      }

      setMessage(`Re-enriched ${payload.processed} builder record${payload.processed === 1 ? "" : "s"}. Refresh to see updated builder identity and contact data.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run enrichment.");
    } finally {
      setEnriching(false);
    }
  }

  async function runDiagnostics() {
    setDiagnosing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/run-diagnostics", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Diagnostics failed.");
      }

      setMessage(
        `Diagnostics complete: ${payload.summary.openReviewItems} open review item(s), ${payload.summary.missingSnapshots} missing contact snapshot(s), ${payload.summary.unhealthySources} unhealthy source(s).`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run diagnostics.");
    } finally {
      setDiagnosing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run background sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Trigger the active official-source connectors and write fresh results into the database.
        </p>
        <Button className="bg-neutral-950 hover:bg-neutral-800" onClick={runSync} disabled={running}>
          {running ? "Running sync..." : "Sync active sources"}
        </Button>
        <Button variant="outline" onClick={runEnrichment} disabled={enriching}>
          {enriching ? "Running enrichment..." : "Re-enrich builders"}
        </Button>
        <Button variant="outline" onClick={runDiagnostics} disabled={diagnosing}>
          {diagnosing ? "Running diagnostics..." : "Run diagnostics"}
        </Button>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
