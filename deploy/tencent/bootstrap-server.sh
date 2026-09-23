#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 运行该脚本。"
  exit 1
fi

SERVER_NAME="${SERVER_NAME:-_}"
APP_ROOT="${APP_ROOT:-/var/www/neuroimmune-cart-hub}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/conf.d}"
TEMPLATE_PATH="${TEMPLATE_PATH:-$(cd "$(dirname "$0")" && pwd)/nginx-site.conf.template}"
TARGET_CONF="${NGINX_CONF_DIR}/neuroimmune-cart-hub.conf"

if [[ ! -f "${TEMPLATE_PATH}" ]]; then
  echo "未找到 Nginx 模板: ${TEMPLATE_PATH}"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx rsync

mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/current"

sed "s/__SERVER_NAME__/${SERVER_NAME}/g" "${TEMPLATE_PATH}" > "${TARGET_CONF}"

rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default || true
nginx -t
systemctl enable nginx
systemctl restart nginx

cat <<EOF
服务器初始化完成。

- 站点根目录: ${APP_ROOT}/current
- Nginx 配置: ${TARGET_CONF}
- 当前域名配置: ${SERVER_NAME}

下一步：
1. 上传 dist/ 到服务器的某个发布目录。
2. 用 rsync 或 mv 切换到 ${APP_ROOT}/current。
3. 如需大陆正式访问，请先完成腾讯云 ICP 备案，再把域名解析到该服务器。
EOF
