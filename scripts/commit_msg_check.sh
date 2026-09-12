#!/usr/bin/env bash
# commit_msg_check.sh — Universal commit message format check
#
# Checks:
#   1. Non-empty message
#   2. Minimum length (title >= 10 characters)
#   3. Conventional Commits format (optional, ENFORCE_CONV_COMMITS=1)
#   4. Title line length limit (optional, max 72 chars)
#
# Install: ln -sf ../../scripts/commit_msg_check.sh .git/hooks/commit-msg
#
# AI-friendly: outputs structured error with expected format and examples

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

error() { echo -e "${RED}[BLOCK]${RESET} $*" >&2; }
warn()  { echo -e "${YELLOW}[WARN]${RESET} $*" >&2; }

# commit-msg hook receives the message file path as $1
COMMIT_MSG_FILE="${1:-}"
if [[ -z "${COMMIT_MSG_FILE}" ]] || [[ ! -f "${COMMIT_MSG_FILE}" ]]; then
  exit 0
fi

# Read message (strip comment lines and leading empty lines)
MSG_TITLE=$(grep -v '^#' "${COMMIT_MSG_FILE}" | grep -v '^$' | head -1)
MSG_BODY=$(grep -v '^#' "${COMMIT_MSG_FILE}" | tail -n +2)

# ── Check 1: Non-empty message ─────────────────────────────────
if [[ -z "${MSG_TITLE}" ]]; then
  error "Commit message must not be empty."
  echo "" >&2
  echo -e "  ${CYAN}Expected:${RESET} A descriptive commit message explaining WHY this change was made." >&2
  echo -e "  ${CYAN}Example:${RESET}  feat: add JWT token refresh to prevent session expiry" >&2
  echo -e "  ${CYAN}Example:${RESET}  fix: handle nil pointer when user has no email configured" >&2
  exit 1
fi

# ── Check 2: Minimum length ────────────────────────────────────
if [[ ${#MSG_TITLE} -lt 10 ]]; then
  error "Commit message title too short (minimum 10 characters): \"${MSG_TITLE}\""
  echo "" >&2
  echo -e "  ${CYAN}Problem:${RESET}  Title is ${#MSG_TITLE} chars, minimum is 10." >&2
  echo -e "  ${CYAN}Reason:${RESET}   A good commit message explains WHY, not just WHAT." >&2
  echo -e "  ${CYAN}Bad:${RESET}      \"fix bug\"" >&2
  echo -e "  ${CYAN}Good:${RESET}     \"fix: resolve race condition in connection pool cleanup\"" >&2
  echo "" >&2
  echo -e "  ${CYAN}Action:${RESET}   Rewrite with: git commit --amend -m \"<better message>\"" >&2
  exit 1
fi

# ── Check 3: Title length warning (> 72 chars) ─────────────────
if [[ ${#MSG_TITLE} -gt 72 ]]; then
  warn "Commit title is ${#MSG_TITLE} chars (recommended max: 72). Consider shortening."
  echo -e "  ${CYAN}Tip:${RESET} Move details to the commit body (leave a blank line after title)." >&2
  # Warning only, don't block
fi

# ── Check 4: Conventional Commits format (enforced by default) ─────────
# SOP 红线 4 / agents.md.tmpl Commit 规范强制：<type>(<scope>): <subject>
# 禁用：export DISABLE_CONV_COMMITS=1（不推荐，仅遗留项目过渡用）
if [[ "${DISABLE_CONV_COMMITS:-}" != "1" ]]; then
  CONV_PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|other)(\(.+\))?(!)?:[[:space:]].+'
  if ! echo "${MSG_TITLE}" | grep -E "${CONV_PATTERN}" >/dev/null 2>&1; then
    error "Commit message does not match Conventional Commits format."
    echo "" >&2
    echo -e "  ${CYAN}Expected format:${RESET} <type>[optional scope]: <description>" >&2
    echo "" >&2
    echo -e "  ${CYAN}Allowed types:${RESET}" >&2
    echo "    feat     — A new feature" >&2
    echo "    fix      — A bug fix" >&2
    echo "    docs     — Documentation only changes" >&2
    echo "    style    — Formatting, missing semi-colons, etc (no code change)" >&2
    echo "    refactor — Code change that neither fixes a bug nor adds a feature" >&2
    echo "    perf     — Performance improvement" >&2
    echo "    test     — Adding or correcting tests" >&2
    echo "    build    — Changes to build system or external dependencies" >&2
    echo "    ci       — Changes to CI configuration files and scripts" >&2
    echo "    chore    — Other changes that don't modify src or test files" >&2
    echo "    revert   — Reverts a previous commit" >&2
    echo "    other    — Custom message that doesn't fit other types" >&2
    echo "" >&2
    echo -e "  ${CYAN}Examples:${RESET}" >&2
    echo -e "    ${GREEN}feat: add user authentication via OAuth2${RESET}" >&2
    echo -e "    ${GREEN}fix(parser): handle escaped quotes in string literals${RESET}" >&2
    echo -e "    ${GREEN}docs: update API reference for v2 endpoints${RESET}" >&2
    echo -e "    ${GREEN}refactor!: rename User to Account across codebase${RESET}" >&2
    echo -e "    ${GREEN}other: sync upstream configuration changes${RESET}" >&2
    echo "" >&2
    echo -e "  ${CYAN}Your message:${RESET} \"${MSG_TITLE}\"" >&2
    echo -e "  ${CYAN}Action:${RESET} git commit --amend -m \"<type>: ${MSG_TITLE}\"" >&2
    exit 1
  fi
fi

exit 0
