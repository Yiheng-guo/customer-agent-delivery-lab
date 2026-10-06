#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  print '需要先安装 Node.js 24，再双击此文件。'
  read '?按回车退出…'
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<24){console.error("需要 Node.js 24 或更高版本");process.exit(1)}'
if command -v codex >/dev/null 2>&1; then
  export LAB_ENABLE_MODEL=1
elif [[ -x /Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex ]]; then
  export CODEX_BIN=/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex
  export LAB_ENABLE_MODEL=1
fi
print '浏览器打开 http://127.0.0.1:4340'
print '默认回答不调用模型；显式选真实模型后才消耗已登录账号额度。'
print '保留此终端运行；按 Control+C 停止。'
exec node src/server.mjs
