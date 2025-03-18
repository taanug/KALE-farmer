import chalk from "chalk";

export const visual = {
  separator: () =>
    console.log(
      chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
    ),
  header: (title: string) => {
    console.log("");
    console.log(
      chalk.bold.white(
        `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`,
      ),
    );
    console.log(chalk.bold.white(`┃ ${title.padEnd(55)} ┃`));
    console.log(
      chalk.bold.white(
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
      ),
    );
    console.log("");
  },
  progressBar: (percent: number) => {
    const completed = Math.round(percent * 20);
    const remaining = 20 - completed;
    return `[${"█".repeat(completed)}${" ".repeat(remaining)}] ${(percent * 100).toFixed(0)}%`;
  },
};

export const log = {
  info: (message: string) =>
    console.log(chalk.gray(`🤖 ${getTimestamp()} | ${message}`)),
  success: (message: string) =>
    console.log(chalk.green(`✅ ${getTimestamp()} | ${message}`)),
  warning: (message: string) =>
    console.log(chalk.yellow(`⚠️ ${getTimestamp()} | ${message}`)),
  error: (message: string) =>
    console.log(chalk.red(`❌ ${getTimestamp()} | ${message}`)),
  plant: (message: string) =>
    console.log(chalk.cyan(`🌱 ${getTimestamp()} | ${message}`)),
  work: (message: string) =>
    console.log(chalk.yellow(`🚜 ${getTimestamp()} | ${message}`)),
  harvest: (message: string) =>
    console.log(chalk.green(`🥬 ${getTimestamp()} | ${message}`)),
  block: (message: string) =>
    console.log(chalk.magenta(`📦 ${getTimestamp()} | ${message}`)),
  schedule: (message: string) =>
    console.log(chalk.blue(`⏰ ${getTimestamp()} | ${message}`)),
};

// Helper function to get formatted timestamp
function getTimestamp(): string {
  return new Date().toLocaleTimeString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
