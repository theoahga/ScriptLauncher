#!/usr/bin/env node

console.log("🎉 Hello from Script Launcher!");
console.log("================================");
console.log("Cet script Node.js a été exécuté avec succès.");
console.log();
console.log("Date et heure actuelle:");
console.log(new Date().toLocaleString());
console.log();
console.log("Version Node.js:");
console.log(process.version);
console.log();
console.log("Arguments reçus:");
console.log(process.argv.slice(2));
console.log();
console.log("✅ Script terminé!");
