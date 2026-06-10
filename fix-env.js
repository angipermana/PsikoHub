const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, 'utf8');
  let changed = false;
  
  env = env.split('\n').map(line => {
    // Strip Hostinger-injected quotes and backslashes from all env vars
    if (line.includes('=')) {
      const parts = line.split('=');
      const key = parts[0];
      let val = parts.slice(1).join('=');
      
      if (val && (val.includes("'") || val.includes('"') || val.includes('\\'))) {
        val = val.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim();
        changed = true;
        return `${key}=${val}`;
      }
    }
    return line;
  }).join('\n');
  
  if (changed) {
    fs.writeFileSync(envPath, env);
    console.log('Fixed .env file formatting for Hostinger compatibility.');
  }
} else {
  console.log('No .env file found. Skipping fix-env.');
}
