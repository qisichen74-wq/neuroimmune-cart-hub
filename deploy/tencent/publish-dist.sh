#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DIST_DIR="${DIST_DIR:-${ROOT_DIR}/dist}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/neuroimmune-cart-hub}"
RELEASE_TAG="${RELEASE_TAG:-$(date +%Y%m%d-%H%M%S)}"

if [[ -z "${REMOTE_HOST}" ]]; then
  echo "请设置 REMOTE_HOST，例如：REMOTE_HOST=1.2.3.4"
  exit 1
fi

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "未找到 dist 目录，请先执行 npm run build:site"
  exit 1
fi

REMOTE_RELEASE="${REMOTE_ROOT}/releases/${RELEASE_TAG}"

ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_RELEASE}' '${REMOTE_ROOT}/current'"
rsync -az --delete -e "ssh -p ${REMOTE_PORT}" "${DIST_DIR}/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_RELEASE}/"
ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "rsync -a --delete '${REMOTE_RELEASE}/' '${REMOTE_ROOT}/current/'"

cat <<EOF
发布完成：
- 服务器: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}
- 发布目录: ${REMOTE_RELEASE}
- 生效目录: ${REMOTE_ROOT}/current

建议下一步：
1. 在服务器上执行 sudo nginx -t && sudo systemctl reload nginx
2. 如果是中国大陆节点，确认域名已完成腾讯云 ICP 备案
3. 如需加速，再在腾讯云 CDN 中把该域名接入并指向此源站
EOF
