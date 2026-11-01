#!/bin/sh
# Claude Code PostToolUse hook: after an edit to a TypeScript file, typecheck the project and lint the file.
# Exit code 2 sends the errors back to the agent, so it fixes them while writing instead of at review time.
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{console.log("")}})')
case "$file" in
  *.ts|*.js) ;;
  *) exit 0 ;;
esac
cd "$(dirname "$0")/.." || exit 0
[ -f "$file" ] || exit 0
out=$(npx --no-install tsc --noEmit 2>&1 && npx --no-install eslint --no-warn-ignored "$file" 2>&1)
status=$?
[ $status -eq 0 ] && exit 0
printf '%s\n' "$out" >&2
exit 2
