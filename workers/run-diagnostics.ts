import { runDiagnostics } from "@/lib/diagnostics/run-diagnostics";

runDiagnostics()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
