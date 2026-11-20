---
title: 'Linux 服务器 Mihomo 安装配置教程'
description: 'Linux 服务器 Mihomo 安装配置教程'
pubDate: 'Oct 12 2026'
tags: [tool]
---

# Linux 服务器 Mihomo 安装配置教程

适用于 Linux x86_64、无 sudo/root 权限、Clash 订阅、SSH 服务器。

目标：Mihomo 后台运行，通过 `proxy_on` / `proxy_off` 控制当前终端代理，支持 Clash 规则分流和 Web Dashboard 节点切换。

## 1. 安装 Mihomo

下载地址：[Mihomo GitHub Releases](https://github.com/MetaCubeX/mihomo/releases?utm_source=chatgpt.com)

确认架构：

```
uname -m
```

如果输出 `x86_64`，下载 `mihomo-linux-amd64-v版本号.gz`。

以 `v1.19.33` 为例：

```
mkdir -p ~/.local/bin ~/.config/mihomo

gzip -dk mihomo-linux-amd64-v1.19.33.gz
mv mihomo-linux-amd64-v1.19.33 ~/.local/bin/mihomo
chmod +x ~/.local/bin/mihomo
```

配置 PATH：

```
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

验证：

```
mihomo -v
```

## 2. 配置 Clash 订阅

将 Clash/Mihomo 格式的完整 YAML 订阅下载为配置文件：

```
curl -fL -A "clash.meta" \
  "你的Clash订阅链接" \
  -o ~/.config/mihomo/config.yaml
```

编辑配置：

```shell
vim ~/.config/mihomo/config.yaml
```

由于服务器上可能有端口已被占用，因此需要自定义端口号`port` , `socks-port` and `external-controller`, 此处分别是6636, 6637, 8392. 之后的各个步骤都记得切换端口号。

```
port: 6636
socks-port: 6637

allow-lan: false
bind-address: 127.0.0.1

mode: rule

external-controller: 127.0.0.1:8392
```

端口说明：

| 端口 | 用途               |
| ---- | ------------------ |
| 6636 | HTTP 代理          |
| 6637 | SOCKS5 代理        |
| 8392 | Dashboard 控制接口 |

## 3. 测试并启动 Mihomo

测试配置：

```
mihomo -d ~/.config/mihomo -t
```

确认日志包含：

```
HTTP proxy listening at: 127.0.0.1:6636
SOCKS proxy listening at: 127.0.0.1:6637
RESTful API listening at: 127.0.0.1:8392
```

首次启动可能自动下载 `Country.mmdb` 等地理位置数据库, 如果下载缓慢，可以提前将数据库下载好：

```
curl -fL \
  https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb \
  -o ~/.config/mihomo/Country.mmdb
```

测试成功后，可以用tmux新建一个session, 让mihomo在后台执行：

```
tmux new -s mihomo
mihomo -d ~/.config/mihomo
```

## 4. 配置 proxy_on / proxy_off

编辑 Bash 配置：

```
vim ~/.bashrc
```

添加：

```
# Mihomo proxy switch
proxy_on() {
    # 端口号应该与前文设置的一致
    export http_proxy="http://127.0.0.1:6636"
    export https_proxy="http://127.0.0.1:6636"
    export all_proxy="socks5h://127.0.0.1:6637"

    export HTTP_PROXY="$http_proxy"
    export HTTPS_PROXY="$https_proxy"
    export ALL_PROXY="$all_proxy"

    echo "Mihomo proxy ON"
}

proxy_off() {
    unset http_proxy https_proxy all_proxy
    unset HTTP_PROXY HTTPS_PROXY ALL_PROXY

    echo "Mihomo proxy OFF"
}

proxy_status() {
    env | grep -i '_proxy='
}
```

使配置生效：

```
source ~/.bashrc
```

日常使用：

```
proxy_on       # 开启当前终端代理，不影响其他终端网络
proxy_off      # 关闭当前终端代理
proxy_status   # 查看代理环境变量
```

注意：

- `proxy_on` 仅影响当前 Shell 及其子进程中支持代理环境变量的程序。
- 不执行 `proxy_on` 时，普通终端程序默认直连，不会自动判断哪些网站需要代理。
- 执行 `proxy_on` 后，请求进入 Mihomo，再由 `mode: rule` 决定直连或代理。
- `ping` 不使用 HTTP/SOCKS 代理，不能用于测试代理是否生效。

## 5. 测试代理

确保 Mihomo 已启动，测试

```
proxy_on
curl -I https://www.google.com
```

## 6. Web Dashboard 管理节点

推荐使用 [MetaCubeXD](https://d.metacubex.one/?utm_source=chatgpt.com)

在本地电脑执行 SSH 端口转发：

```
ssh -N -L 8392:127.0.0.1:8392 用户名@服务器地址
```

也可以使用 VS Code Remote SSH 的端口转发功能。

浏览器打开 MetaCubeXD Dashboard，在设置中"切换 后端"，填写控制器地址：

```
http://127.0.0.1:8392
```

如果设置了 `secret`，还需要填写密钥。在线 HTTPS 面板可能受到跨域或混合内容限制，此时可改用 Mihomo 本地托管的 Dashboard。

Dashboard 可以切换节点、测速、查看连接和选择规则/全局模式。

