import chalk from 'chalk';

export const theme = {
  // Brand colors
  primary: chalk.hex('#1E90FF'),      // Dodger blue
  secondary: chalk.hex('#00CED1'),    // Dark turquoise
  accent: chalk.hex('#FF6347'),       // Tomato

  // Status colors
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  muted: chalk.gray,

  // Text styling
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
  underline: chalk.underline,

  // Semantic
  label: chalk.bold.white,
  value: chalk.cyan,
  highlight: chalk.bold.hex('#1E90FF'),
  command: chalk.bold.yellow,
  path: chalk.underline.gray,
};
