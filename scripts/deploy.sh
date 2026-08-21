#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
LOCAL_PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly LOCAL_PROJECT_ROOT
readonly ENV_FILE="${LOCAL_PROJECT_ROOT}/.env"

if [[ -f "${ENV_FILE}" ]]; then
	set -a
	# shellcheck disable=SC1090
	. "${ENV_FILE}"
	set +a
fi

readonly REMOTE_HOST="${FISH_REMOTE_HOST:?Set FISH_REMOTE_HOST in ${ENV_FILE} (copy .env.example first)}"
readonly REMOTE_SOURCE_DIR="${FISH_REMOTE_SOURCE_DIR:?Set FISH_REMOTE_SOURCE_DIR in ${ENV_FILE} (copy .env.example first)}"
readonly REMOTE_STACK_DIR="${FISH_REMOTE_STACK_DIR:?Set FISH_REMOTE_STACK_DIR in ${ENV_FILE} (copy .env.example first)}"
readonly -a RSYNC_EXCLUDES=(
	".git/"
	".env"
	".env.*"
	".DS_Store"
	"node_modules/"
	"dist/"
	"test-results/"
	"playwright-report/"
	"temp/"
	"AGENT.md"
	"AGENTS.md"
	"*.rules"
)

fail() {
	printf '%s\n' "- $*" >&2
	exit 1
}

require_command() {
	local command_name=$1
	command -v "${command_name}" >/dev/null 2>&1 || fail "Missing local command: ${command_name}"
}

run_remote_shell() {
	local remote_command=$1

	# Quote the complete command as one argument to the remote interactive shell.
	ssh "${REMOTE_HOST}" "zsh -lic $(printf '%q' "${remote_command}")"
}

remote_compose() {
	local compose_command=$1
	local remote_command

	# The source directory is passed only to the remote Compose process and is not
	# stored in the repository's Compose file.
	printf -v remote_command 'cd %q && FISH_SOURCE_DIR=%q' \
		"${REMOTE_STACK_DIR}" "${REMOTE_SOURCE_DIR}"
	if [[ -n "${WEB_PORT:-}" ]]; then
		printf -v remote_command '%s WEB_PORT=%q' "${remote_command}" "${WEB_PORT}"
	fi
	printf -v remote_command '%s of docker compose %s' "${remote_command}" "${compose_command}"
	run_remote_shell "${remote_command}"
}

on_error() {
	local exit_code=$?
	local line_number=$1

	printf '%s\n' "- Deployment failed at script line ${line_number} (exit ${exit_code})." >&2
	printf '%s\n' "| Inspect remote status with the configured Compose host and directory." >&2
	exit "${exit_code}"
}

trap 'on_error ${LINENO}' ERR

require_command rsync
require_command ssh

[[ -f "${LOCAL_PROJECT_ROOT}/compose.yaml" ]] || fail "Local compose.yaml not found: ${LOCAL_PROJECT_ROOT}/compose.yaml"
[[ -d "${LOCAL_PROJECT_ROOT}/web" ]] || fail "Local web project not found: ${LOCAL_PROJECT_ROOT}/web"
[[ -d "${LOCAL_PROJECT_ROOT}/arrow" ]] || fail "Local Arrow project not found: ${LOCAL_PROJECT_ROOT}/arrow"
[[ -d "${LOCAL_PROJECT_ROOT}/find-aemeath" ]] || fail "Local Find Aemeath project not found: ${LOCAL_PROJECT_ROOT}/find-aemeath"

rsync_arguments=(-az --delete --itemize-changes)
for exclude_pattern in "${RSYNC_EXCLUDES[@]}"; do
	rsync_arguments+=(--exclude "${exclude_pattern}")
done

printf '%s\n' "+ Deployment preview"
printf '%s\n' "| Local project:        ${LOCAL_PROJECT_ROOT}"
printf '%s\n' "| Remote build source:  ${REMOTE_HOST}:${REMOTE_SOURCE_DIR}"
printf '%s\n' "| Remote Compose stack: ${REMOTE_HOST}:${REMOTE_STACK_DIR}"
printf '%s\n' "| No local Docker command will be executed."

rsync "${rsync_arguments[@]}" --dry-run \
	"${LOCAL_PROJECT_ROOT}/" \
	"${REMOTE_HOST}:${REMOTE_SOURCE_DIR}/"

printf '%s\n' "+ Remote source sync"
# The configured paths intentionally expand on the local side for rsync targets.
printf -v remote_command 'mkdir -p %q %q' "${REMOTE_SOURCE_DIR}" "${REMOTE_STACK_DIR}"
run_remote_shell "${remote_command}"
rsync "${rsync_arguments[@]}" \
	"${LOCAL_PROJECT_ROOT}/" \
	"${REMOTE_HOST}:${REMOTE_SOURCE_DIR}/"
printf '%s\n' "| Local project synchronized to the remote build source."

printf '%s\n' "+ Remote Compose configuration"
# The remote stack receives a copy; the repository root remains the only source config.
printf -v remote_command 'install -m 0644 %q %q' \
	"${REMOTE_SOURCE_DIR}/compose.yaml" "${REMOTE_STACK_DIR}/compose.yaml"
run_remote_shell "${remote_command}"
remote_compose "config --quiet"
printf '%s\n' "| Remote Compose configuration is valid."

printf '%s\n' "+ Remote image build and service update"
remote_compose "up -d --build --remove-orphans --wait --wait-timeout 180"
remote_compose "ps"

printf '%s\n' "+ Remote HTTP verification"
published_binding="$(remote_compose "port web 80" | head -n 1)"
published_port="${published_binding##*:}"
[[ "${published_port}" =~ ^[0-9]+$ ]] || fail "Unable to determine the remote Web port from: ${published_binding}"

# HTTP checks run on the remote host against its published Compose port.
remote_command="curl -fsS -o /dev/null http://127.0.0.1:${published_port}/healthz && curl -fsS -o /dev/null http://127.0.0.1:${published_port}/games/arrow/ && curl -fsS -o /dev/null http://127.0.0.1:${published_port}/games/find-aemeath/"
run_remote_shell "${remote_command}"

printf '%s\n' "| Remote health and game routes passed on port ${published_port}."
printf '%s\n' "* Deployment complete"
