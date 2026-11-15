const { execFileSync } = require('node:child_process');
function forbiddenPath(file) {
  const name = file.replaceAll('\\', '/');
  return /(^|\/)(backups|node_modules|dist|uploads)\//i.test(name) ||
    /\.(dump|bak|pem|key|p12|pfx)$/i.test(name) ||
    /(^|\/)(?:id_rsa|id_ed25519)$/i.test(name) ||
    /(^|\/)\.env(?:$|\.(?!example$))/i.test(name);
}
function checkRepository(cwd) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['ls-files', '--full-name', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return files.filter(forbiddenPath);
}
if (require.main === module) {
  try {
    const bad = checkRepository(process.cwd());
    if (bad.length) { console.error('Remove these paths from the Git index; keep local backups outside version control:\n' + bad.join('\n')); process.exitCode = 1; }
    else console.log('Repository index check passed. Historical commits still require a separate review.');
  } catch { console.error('Run this check inside the project Git repository.'); process.exitCode = 1; }
}
module.exports = { forbiddenPath, checkRepository };
