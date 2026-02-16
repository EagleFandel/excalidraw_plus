const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  VITE_APP_DISABLE_SENTRY: "true",
  VITE_APP_GIT_SHA:
    process.env.VITE_APP_GIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "docker-local",
};

const result = spawnSync("vite", ["build"], {
  stdio: "inherit",
  shell: true,
  env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
