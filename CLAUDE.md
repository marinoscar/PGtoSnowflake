# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PGtoSnowflake is a CLI tool for importing data from PostgreSQL to Snowflake. It uses an interactive menu (powered by `@inquirer/prompts` `select`) for all user interaction — no commands to type or remember.

## Project Status

The CLI is implemented with an interactive menu-based interface. Core features include schema mapping, data export via DuckDB, and Snowflake DDL generation.

## Development Setup

- Node.js 20+
- npm package manager
- `npm install` to install dependencies
- `npm run build` to compile TypeScript
- `npm run dev` to run with tsx (no build needed)
- `npm test` to run tests with vitest
