# 腾讯云大陆可访问部署方案

更新日期：2026-08-08

## 目标

把当前站点部署到腾讯云服务器，并让中国大陆用户可稳定访问。

当前仓库的生产产物是 `dist/`，属于纯静态站点，最稳妥的大陆落地方式是：

1. 腾讯云轻量应用服务器或 CVM 作为源站
2. Nginx 提供静态站点
3. 域名解析到腾讯云服务器
4. 如使用中国大陆节点或腾讯云 CDN 中国境内/全球加速，先完成 ICP 备案

## 推荐路线

### 路线 A：正式生产

- 地域：广州 / 上海 / 北京等中国内地地域
- 资源：轻量应用服务器或 CVM
- Web 服务：Nginx
- 域名：绑定业务域名
- 可选：腾讯云 CDN 中国境内或全球加速

适用场景：

- 需要稳定大陆访问
- 需要后续备案、HTTPS、CDN、日志和运维能力

### 路线 B：快速试运行

- 地域：香港
- 资源：轻量应用服务器或 CVM
- Web 服务：Nginx

适用场景：

- 想先快速在线验证
- 暂时不做 ICP 备案

注意：

- 香港节点通常可在大陆访问，但线路和稳定性不如内地节点。
- 如果要做中国内地正式业务访问，仍建议回到路线 A。

## 官方要求摘要

以下要求来自腾讯云官方文档：

- 中国大陆境内服务器开办网站或 APP，需要先办理 ICP 备案。
- 若域名已在其他接入商备案，域名指向腾讯云服务器时，需要在腾讯云做接入备案。
- 腾讯云 CDN 若选择中国境内或全球加速，域名也需要先完成 ICP 备案。
- 腾讯云免费 SSL 证书有效期 90 天，官方说明主要用于前期测试，正式项目建议使用正式证书。

## 仓库内已准备的文件

- `deploy/tencent/nginx-site.conf.template`
  Nginx 站点模板
- `deploy/tencent/bootstrap-server.sh`
  服务器初始化脚本
- `deploy/tencent/publish-dist.sh`
  本地发布 `dist/` 到服务器的脚本
- `release/tencent-mainland/`
  通过 `npm run package:tencent` 生成的腾讯云部署包

## 一次性初始化服务器

以 Ubuntu 为例，在服务器上执行：

```bash
sudo SERVER_NAME=example.com bash deploy/tencent/bootstrap-server.sh
```

如果暂时还没绑定域名，也可以先这样：

```bash
sudo SERVER_NAME=_ bash deploy/tencent/bootstrap-server.sh
```

脚本会：

1. 安装 Nginx 和 rsync
2. 创建 `/var/www/neuroimmune-cart-hub/current`
3. 写入 Nginx 配置
4. 重启 Nginx

## 本地构建并打包

在本地仓库执行：

```bash
npm run build:site
npm run package:tencent
```

生成目录：

```text
release/tencent-mainland/
```

## 发布到腾讯云服务器

先配置环境变量，再执行发布脚本：

```bash
REMOTE_HOST=1.2.3.4 \
REMOTE_USER=ubuntu \
REMOTE_PORT=22 \
bash deploy/tencent/publish-dist.sh
```

发布完成后，在服务器上执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 域名与备案

### 如果是中国大陆服务器

需要先满足以下条件：

1. 购买满足备案要求的腾讯云资源
2. 在腾讯云 ICP 备案控制台做首次备案或接入备案
3. 备案通过后，再把域名正式解析到腾讯云服务器

### 如果域名已在其他服务商备案

只要源站切到腾讯云，就需要在腾讯云做接入备案；原备案无需注销。

## CDN 建议

站点跑通后，可以再接腾讯云 CDN：

- 源站：当前腾讯云服务器公网 IP
- 业务类型：静态加速
- 加速区域：如果面向大陆用户，选中国境内或全球

注意：

- 中国境内 / 全球加速都要求域名先完成 ICP 备案。

## HTTPS 建议

可选方案：

1. 腾讯云 SSL 证书
2. Let's Encrypt

如果用腾讯云免费证书，官方说明其主要适合测试，正式项目建议使用正式证书。

## 适合你这个项目的最短路径

推荐直接这样做：

1. 买一台腾讯云轻量应用服务器，地域选广州或上海，系统选 Ubuntu 22.04
2. 在腾讯云完成 ICP 备案或接入备案
3. 用本仓库的 `build:site` 产物部署到 Nginx
4. 域名解析到该服务器
5. 最后再接腾讯云 CDN

这样改动最小，也最符合你现在这个纯静态站点的结构。
